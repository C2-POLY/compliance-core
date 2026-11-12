import ajv2020 from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { SCHEMA_FILES, SPEC_SOURCE } from './generated/spec.js';
import { parseStrict } from './yaml.js';

/** The commit of C2-POLY/compliance-spec the schemas and templates were copied from (schemas/SOURCE.json). */
export const SPEC_COMMIT: string = SPEC_SOURCE.commit;

export const SPEC_VERSIONS = ['0.1', '0.2'] as const;
export type SpecVersion = (typeof SPEC_VERSIONS)[number];
/** The files of a compliance repo that have a schema. `actions` (actions.yaml) exists from v0.2.1 on, under spec_version "0.2". */
export const SCHEMA_NAMES = ['manifest', 'processing', 'compliance', 'sync', 'anchors', 'actions'] as const;
export type SchemaName = (typeof SCHEMA_NAMES)[number];

/** The schema version of a parsed file: its own spec_version when known, else "0.1" (which then reports the bad spec_version). */
export function versionOf(doc: unknown): SpecVersion {
  const v = (doc as { spec_version?: unknown } | null)?.spec_version;
  return typeof v === 'string' && (SPEC_VERSIONS as readonly string[]).includes(v) ? (v as SpecVersion) : '0.1';
}

export interface ValidationError {
  instancePath: string;
  keyword: string;
  message: string;
}

// ajv and ajv-formats ship CommonJS: depending on the loader (Node, a bundler), the export sits on `.default` or not.
type Ajv2020 = typeof ajv2020.default;
type AddFormats = typeof ajvFormats.default;
const AjvCtor: Ajv2020 = (ajv2020 as unknown as { default?: Ajv2020 }).default ?? (ajv2020 as unknown as Ajv2020);
const addFormatsFn: AddFormats = (ajvFormats as unknown as { default?: AddFormats }).default ?? (ajvFormats as unknown as AddFormats);

const ajv = new AjvCtor({ allErrors: true });
addFormatsFn(ajv);
for (const version of SPEC_VERSIONS) {
  for (const [name, schema] of Object.entries(SCHEMA_FILES[version])) ajv.addSchema(schema, `${version}/${name}`);
}

// Port of the cross-reference checks of compliance-spec/scripts/validate.mjs:
// rules JSON Schema cannot express (unique ids, references between items of one manifest).
function crossChecks(name: SchemaName, doc: unknown): ValidationError[] {
  if (name !== 'manifest' || typeof doc !== 'object' || doc === null) return [];
  const m = doc as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const errors: ValidationError[] = [];
  const fail = (instancePath: string, message: string) => errors.push({ instancePath, keyword: 'ref', message });
  const duplicate = (instancePath: string, id: string) => errors.push({ instancePath, keyword: 'uniqueId', message: `duplicate id "${id}"` });
  const ids = (list: unknown): Set<unknown> => new Set(((list as any[]) ?? []).map((item: any) => item?.id)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const dataIds = ids(m.personal_data);
  const componentIds = ids(m.service?.components);
  const processorIds = ids(m.processors);
  const seenComponents = new Set();
  (m.service?.components ?? []).forEach((item: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (seenComponents.has(item?.id)) duplicate(`/service/components/${i}/id`, item.id);
    seenComponents.add(item?.id);
  });
  for (const list of ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features', 'notices']) {
    const seen = new Set();
    (m[list] ?? []).forEach((item: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (seen.has(item?.id)) duplicate(`/${list}/${i}/id`, item.id);
      seen.add(item?.id);
      (item?.data ?? []).forEach((ref: string, j: number) => {
        if (!dataIds.has(ref)) fail(`/${list}/${i}/data/${j}`, `no personal_data with id "${ref}"`);
      });
      if (item?.component !== undefined && !componentIds.has(item.component)) {
        fail(`/${list}/${i}/component`, `no service component with id "${item.component}"`);
      }
      if (list === 'outbound_flows' && item?.processor !== undefined && !processorIds.has(item.processor)) {
        fail(`/${list}/${i}/processor`, `no processor with id "${item.processor}"`);
      }
      if (list === 'ai_features') {
        const obligations = new Set();
        (item?.obligations ?? []).forEach((o: any, j: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (obligations.has(o?.id)) duplicate(`/${list}/${i}/obligations/${j}/id`, o.id);
          obligations.add(o?.id);
        });
      }
    });
  }
  return errors;
}

/**
 * Validates an already parsed document against the schema of its own spec_version. An empty list means valid. The root path is "/".
 * A file whose schema does not exist in that version (actions.yaml under "0.1") is checked against the latest version that has it.
 */
export function validateDocument(name: SchemaName, doc: unknown): ValidationError[] {
  const version = versionOf(doc);
  const latest = [...SPEC_VERSIONS].reverse().find((v) => name in SCHEMA_FILES[v])!;
  const validate = ajv.getSchema(`${name in SCHEMA_FILES[version] ? version : latest}/${name}`)!;
  const errors = validate(doc) ? [] : (validate.errors ?? []);
  return [...errors, ...crossChecks(name, doc)].map((e) => ({
    instancePath: e.instancePath || '/',
    keyword: e.keyword,
    message: e.message ?? 'invalid',
  }));
}

export interface Validated {
  doc: unknown;
  errors: ValidationError[];
}

/** Parses YAML text then validates it. A YAML syntax error is reported as a validation error. */
export function validateText(name: SchemaName, text: string): Validated {
  let doc: unknown;
  try {
    doc = parseStrict(text);
  } catch (err) {
    const message = err instanceof Error ? err.message.split('\n')[0] : 'invalid YAML';
    return { doc: undefined, errors: [{ instancePath: '/', keyword: 'yaml', message: `YAML syntax error: ${message}` }] };
  }
  return { doc, errors: validateDocument(name, doc) };
}
