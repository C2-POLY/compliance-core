import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, without types
import { specModule } from '../scripts/spec-module.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('the package', () => {
  it('embeds exactly the schemas and templates of schemas/ and templates/ (run `npm run sync-spec -- --generate` after a copy)', () => {
    expect(readFileSync(join(ROOT, 'src/generated/spec.ts'), 'utf8')).toBe((specModule as (root: string) => string)(ROOT));
  });

  it('has no node-only import outside src/fs.ts', () => {
    const files = readdirSync(join(ROOT, 'src'), { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const e of files) {
      const path = join(e.parentPath, e.name);
      if (path === join(ROOT, 'src/fs.ts')) continue;
      const imports = [...readFileSync(path, 'utf8').matchAll(/^\s*(?:import|export)\b[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
      for (const spec of imports) expect(spec, path).toMatch(/^(\.{1,2}\/|ajv\/dist\/2020\.js$|ajv-formats$|yaml$)/);
    }
  });

  it('exports the engine from "." and loadDirectory from "./fs" only', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.exports)).toEqual(['.', './fs', './package.json']);
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['ajv', 'ajv-formats', 'yaml']);
    expect(pkg.files).toContain('dist');
  });
});
