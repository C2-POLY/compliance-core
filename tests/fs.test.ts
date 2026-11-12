import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDossier } from '../src/dossier.js';
import { loadDirectory } from '../src/fs.js';
import { buildRegister } from '../src/register.js';
import { EXAMPLE, EXAMPLE_V02, GENERATED_AT, tmp, write } from './helpers.js';

function copy(example = EXAMPLE_V02): string {
  const dir = tmp('cc-fs-');
  cpSync(example, dir, { recursive: true });
  return dir;
}

describe('loadDirectory', () => {
  it('reads only what the engine may read', () => {
    const dir = copy();
    write(dir, 'README.md', 'A compliance repo.\n');
    write(dir, 'services/bistro-api/notes.yaml', 'not: read\n');
    write(dir, '.git/config', '[core]\n');
    const tree = loadDirectory(dir);
    expect([...tree.files.keys()].sort()).toEqual([
      'actions.yaml',
      'anchors.yaml',
      'compliance.yaml',
      'declared/crm/manifest.yaml',
      'processings/marketing-emails/processing.yaml',
      'processings/table-bookings/processing.yaml',
      'services/bistro-api/manifest.yaml',
      'services/bistro-api/sync.yaml',
      'services/bistro-web/manifest.yaml',
      'services/bistro-web/sync.yaml',
    ]);
    expect(tree.read('compliance.yaml')).toBe(readFileSync(join(dir, 'compliance.yaml'), 'utf8'));
    expect(tree.listDirs('services')).toEqual(['bistro-api', 'bistro-web']);
  });

  it('keeps an empty folder under services/, so that a repo with no manifest still fails', () => {
    const dir = copy();
    mkdirSync(join(dir, 'services/bistro-analytics'));
    const tree = loadDirectory(dir);
    expect(tree.has('services/bistro-analytics')).toBe(true);
    expect(() => buildDossier(tree, GENERATED_AT, 'en')).toThrow(/services\/bistro-analytics\/manifest\.yaml not found/);
  });

  describe('refuses a symbolic link wherever it reads', () => {
    const cases: [string, (dir: string) => void, RegExp][] = [
      ['compliance.yaml', (d) => { rmSync(join(d, 'compliance.yaml')); symlinkSync(join(EXAMPLE_V02, 'compliance.yaml'), join(d, 'compliance.yaml')); }, /Refused: compliance\.yaml is a symbolic link/],
      ['actions.yaml, even dangling', (d) => { rmSync(join(d, 'actions.yaml')); symlinkSync('/nonexistent', join(d, 'actions.yaml')); }, /Refused: actions\.yaml is a symbolic link/],
      ['the services/ folder', (d) => { cpSync(join(d, 'services'), join(d, 'elsewhere'), { recursive: true }); rmSync(join(d, 'services'), { recursive: true }); symlinkSync(join(d, 'elsewhere'), join(d, 'services')); }, /Refused: services is a symbolic link/],
      ['a folder under services/', (d) => symlinkSync(join(d, 'services/bistro-api'), join(d, 'services/bistro-ghost')), /services\/bistro-ghost is a symbolic link: refused/],
      ['a sync.yaml', (d) => { rmSync(join(d, 'services/bistro-web/sync.yaml')); symlinkSync(join(d, 'services/bistro-api/sync.yaml'), join(d, 'services/bistro-web/sync.yaml')); }, /Refused: services\/bistro-web\/sync\.yaml is a symbolic link/],
      ['a dangling processing.yaml', (d) => { mkdirSync(join(d, 'processings/ghost')); symlinkSync('/nonexistent', join(d, 'processings/ghost/processing.yaml')); }, /Refused: processings\/ghost\/processing\.yaml is a symbolic link/],
      ['a dangling folder under processings/', (d) => symlinkSync('/nonexistent', join(d, 'processings/ghost')), /processings\/ghost is a symbolic link: refused/],
      ['a symlinked folder under processings/', (d) => symlinkSync(join(d, 'processings/table-bookings'), join(d, 'processings/ghost')), /processings\/ghost is a symbolic link: refused/],
      ['the manifest of a declared tool', (d) => { rmSync(join(d, 'declared/crm/manifest.yaml')); symlinkSync('/etc/hosts', join(d, 'declared/crm/manifest.yaml')); }, /Refused: declared\/crm\/manifest\.yaml is a symbolic link/],
      ['the folder of a declared tool', (d) => { cpSync(join(d, 'declared/crm'), join(d, 'crm-copy'), { recursive: true }); rmSync(join(d, 'declared/crm'), { recursive: true }); symlinkSync(join(d, 'crm-copy'), join(d, 'declared/crm')); }, /Refused: declared\/crm is a symbolic link/],
    ];
    for (const [name, arrange, error] of cases) {
      it(name, () => {
        const dir = copy();
        arrange(dir);
        expect(() => loadDirectory(dir)).toThrow(error);
      });
    }

    it('in a v0.1 repo too', () => {
      const dir = copy(EXAMPLE);
      rmSync(join(dir, 'services/bistro-web/sync.yaml'));
      symlinkSync(join(dir, 'services/bistro-api/sync.yaml'), join(dir, 'services/bistro-web/sync.yaml'));
      expect(() => buildRegister(loadDirectory(dir), GENERATED_AT)).toThrow(/symbolic link/);
    });
  });

  it('never reads outside the repo: a declared tool path that leaves it is not read, and the schema rejects it', () => {
    const outside = tmp('cc-outside-');
    write(outside, 'manifest.yaml', 'secret: true\n');
    const dir = copy();
    const file = join(dir, 'compliance.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('path: declared/crm/manifest.yaml', `path: ../${outside.split('/').pop()}/manifest.yaml`));
    const tree = loadDirectory(dir);
    expect([...tree.files.values()].join('\n')).not.toContain('secret: true');
    expect(() => buildDossier(tree, GENERATED_AT, 'en')).toThrow(/compliance\.yaml is invalid: \/declared_tools\/0\/path/);
  });

  it('refuses a file the engine reads that is not a regular file', () => {
    const dir = copy();
    rmSync(join(dir, 'processings/table-bookings/processing.yaml'));
    mkdirSync(join(dir, 'processings/table-bookings/processing.yaml'));
    expect(() => loadDirectory(dir)).toThrow(/processings\/table-bookings\/processing\.yaml is not a regular file/);
  });

  it('leaves an absent file absent, for the engine to report', () => {
    const dir = copy();
    rmSync(join(dir, 'compliance.yaml'));
    expect(() => buildDossier(loadDirectory(dir), GENERATED_AT, 'en')).toThrow(/compliance\.yaml not found/);
  });

  it('gives the YAML to the strict parser: an alias in compliance.yaml fails', () => {
    const dir = copy();
    const file = join(dir, 'compliance.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('name: Bistro Booking Group\n', 'name: &n Bistro Booking Group\n'));
    expect(() => buildDossier(loadDirectory(dir), GENERATED_AT, 'en')).toThrow(/compliance\.yaml is invalid: \/: YAML syntax error: anchors are not allowed/);
  });
});
