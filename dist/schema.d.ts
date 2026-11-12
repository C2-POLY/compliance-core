/** The commit of C2-POLY/compliance-spec the schemas and templates were copied from (schemas/SOURCE.json). */
export declare const SPEC_COMMIT: string;
export declare const SPEC_VERSIONS: readonly ['0.1', '0.2'];
export type SpecVersion = (typeof SPEC_VERSIONS)[number];
/** The files of a compliance repo that have a schema. `actions` (actions.yaml) exists from v0.2.1 on, under spec_version "0.2". */
export declare const SCHEMA_NAMES: readonly ['manifest', 'processing', 'compliance', 'sync', 'anchors', 'actions'];
export type SchemaName = (typeof SCHEMA_NAMES)[number];
/** The schema version of a parsed file: its own spec_version when known, else "0.1" (which then reports the bad spec_version). */
export declare function versionOf(doc: unknown): SpecVersion;
export interface ValidationError {
    instancePath: string;
    keyword: string;
    message: string;
}
/**
 * Validates an already parsed document against the schema of its own spec_version. An empty list means valid. The root path is "/".
 * A file whose schema does not exist in that version (actions.yaml under "0.1") is checked against the latest version that has it.
 */
export declare function validateDocument(name: SchemaName, doc: unknown): ValidationError[];
export interface Validated {
    doc: unknown;
    errors: ValidationError[];
}
/** Parses YAML text then validates it. A YAML syntax error is reported as a validation error. */
export declare function validateText(name: SchemaName, text: string): Validated;
