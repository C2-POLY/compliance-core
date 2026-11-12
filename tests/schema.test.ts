import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { SCHEMA_NAMES, SPEC_COMMIT, SPEC_VERSIONS, validateDocument, validateText, versionOf } from '../src/schema.js';
import { EXAMPLE, EXAMPLE_V02, FIXTURES } from './helpers.js';

const dir = join(FIXTURES, 'manifests');

describe('schemas', () => {
  it('knows both spec versions and the commit of the spec they come from', () => {
    expect(SPEC_VERSIONS).toEqual(['0.1', '0.2']);
    expect(SPEC_COMMIT).toMatch(/^[0-9a-f]{40}$/);
    expect(SCHEMA_NAMES).toContain('actions');
    expect(versionOf({ spec_version: '0.2' })).toBe('0.2');
    expect(versionOf({ spec_version: '9.9' })).toBe('0.1');
    expect(versionOf(null)).toBe('0.1');
  });

  it('accepts every file of both Bistro Booking examples, against the schema of its own spec_version', () => {
    const files: [string, (typeof SCHEMA_NAMES)[number]][] = [
      ['compliance.yaml', 'compliance'],
      ['anchors.yaml', 'anchors'],
      ['services/bistro-api/manifest.yaml', 'manifest'],
      ['services/bistro-api/sync.yaml', 'sync'],
      ['services/bistro-web/manifest.yaml', 'manifest'],
      ['declared/crm/manifest.yaml', 'manifest'],
      ['processings/table-bookings/processing.yaml', 'processing'],
      ['processings/marketing-emails/processing.yaml', 'processing'],
    ];
    for (const example of [EXAMPLE, EXAMPLE_V02]) {
      for (const [file, name] of files) expect(validateText(name, readFileSync(join(example, file), 'utf8')).errors, `${example} ${file}`).toEqual([]);
    }
    expect(validateText('manifest', readFileSync(join(dir, 'valid.yaml'), 'utf8')).errors).toEqual([]);
    expect(validateText('manifest', readFileSync(join(dir, 'valid-v0.2.yaml'), 'utf8')).errors).toEqual([]);
  });

  it('validates actions.yaml (v0.2.1)', () => {
    const doc = parse(readFileSync(join(EXAMPLE_V02, 'actions.yaml'), 'utf8'));
    expect(validateDocument('actions', doc)).toEqual([]);
    expect(validateDocument('actions', { ...doc, assignments: [{ action: 'make-coffee', contact: 'platform-team' }] })[0]).toMatchObject({ instancePath: '/assignments/0/action', keyword: 'enum' });
    // actions.yaml has no v0.1 schema: a spec_version "0.1" is checked against v0.2, and refused.
    expect(validateDocument('actions', { ...doc, spec_version: '0.1' })[0]).toMatchObject({ instancePath: '/spec_version' });
  });

  const invalid = readdirSync(dir).filter((f) => f.startsWith('invalid-'));
  it('has invalid fixtures', () => expect(invalid.length).toBeGreaterThanOrEqual(20));
  for (const file of invalid) {
    it(`rejects ${file} at the expected field`, () => {
      const text = readFileSync(join(dir, file), 'utf8');
      const [, instancePath] = /^# expect: (\S+) (\S+)/.exec(text)!;
      const { errors } = validateText('manifest', text);
      expect(errors.map((e) => e.instancePath)).toContain(instancePath);
    });
  }

  it('reports broken YAML as a validation error', () => {
    expect(validateText('manifest', readFileSync(join(FIXTURES, 'broken.txt'), 'utf8')).errors[0]).toMatchObject({ instancePath: '/', keyword: 'yaml' });
  });
});
