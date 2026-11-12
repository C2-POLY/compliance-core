#!/usr/bin/env node
// Copy the JSON Schemas (v0.1 and v0.2) and the register templates from a checkout of C2-POLY/compliance-spec
// into schemas/ and templates/register/, record the spec commit in schemas/SOURCE.json,
// then regenerate src/generated/spec.ts, the module the engine reads them from.
// Usage: node scripts/sync-spec.mjs <path-to-compliance-spec>
//        node scripts/sync-spec.mjs --generate   (only regenerate src/generated/spec.ts from the copies)
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { TEMPLATES, VERSIONS, specModule } from './spec-module.mjs';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/sync-spec.mjs <path-to-compliance-spec> | --generate');
  process.exit(2);
}

if (arg !== '--generate') {
  const source = resolve(arg);
  const schemas = {};
  for (const version of VERSIONS) {
    const from = join(source, 'schema', `v${version}`);
    const to = join(here, 'schemas', `v${version}`);
    mkdirSync(to, { recursive: true });
    const files = readdirSync(from).filter((f) => f.endsWith('.json')).sort();
    if (files.length === 0) {
      console.error(`No schema found in ${from}`);
      process.exit(1);
    }
    for (const f of files) copyFileSync(join(from, f), join(to, f));
    schemas[version] = files;
  }

  const templateTo = join(here, 'templates', 'register');
  mkdirSync(templateTo, { recursive: true });
  for (const t of TEMPLATES) copyFileSync(join(source, 'templates', 'register', t), join(templateTo, t));

  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    // not a git checkout: keep "unknown"
  }
  const record = { spec_versions: VERSIONS, source: 'C2-POLY/compliance-spec', commit, schemas, templates: TEMPLATES.map((t) => `register/${t}`) };
  writeFileSync(join(here, 'schemas', 'SOURCE.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Synced the v${VERSIONS.join(' and v')} schemas and ${TEMPLATES.length} register templates from ${source} (spec commit ${commit})`);
}

mkdirSync(join(here, 'src', 'generated'), { recursive: true });
writeFileSync(join(here, 'src', 'generated', 'spec.ts'), specModule(here));
console.log('Wrote src/generated/spec.ts');
