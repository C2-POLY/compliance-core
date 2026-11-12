import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDossier, buildDossierModel, dossierLanguage, renderDossier } from '../src/dossier.js';
import { loadDirectory } from '../src/fs.js';
import { buildRegister } from '../src/register.js';
import { treeFromFiles } from '../src/tree.js';
import { EXAMPLE, EXAMPLE_V02, GENERATED_AT, filesOf } from './helpers.js';

describe('treeFromFiles', () => {
  it('gives the same dossier as loadDirectory, byte for byte, from a record of the fixture files', () => {
    const tree = treeFromFiles(filesOf(EXAMPLE_V02));
    expect(buildDossier(tree, GENERATED_AT, 'en').markdown).toBe(readFileSync(join(EXAMPLE_V02, 'documents/register.md'), 'utf8'));
    expect(buildDossier(tree, GENERATED_AT, 'fr').markdown).toBe(readFileSync(join(EXAMPLE_V02, 'documents/register.fr.md'), 'utf8'));
    expect(renderDossier(buildDossierModel(tree), GENERATED_AT, 'fr')).toBe(readFileSync(join(EXAMPLE_V02, 'documents/register.fr.md'), 'utf8'));
    expect(buildDossierModel(tree)).toEqual(buildDossierModel(loadDirectory(EXAMPLE_V02)));
    expect(dossierLanguage(tree)).toBe('en');
  });

  it('gives the same v0.1 register as loadDirectory, byte for byte', () => {
    const tree = treeFromFiles(filesOf(EXAMPLE));
    expect(buildRegister(tree, GENERATED_AT)).toEqual(buildRegister(loadDirectory(EXAMPLE), GENERATED_AT));
    expect(buildRegister(tree, GENERATED_AT).markdown).toBe(readFileSync(join(EXAMPLE, 'documents/register.md'), 'utf8'));
  });

  it('accepts entries as well as a record', () => {
    const tree = treeFromFiles(Object.entries(filesOf(EXAMPLE_V02)));
    expect(buildDossier(tree, GENERATED_AT, 'en').markdown).toBe(readFileSync(join(EXAMPLE_V02, 'documents/register.md'), 'utf8'));
  });

  it('answers has, read and listDirs from the paths alone', () => {
    const tree = treeFromFiles({ 'a.yaml': 'a', 'services/x/manifest.yaml': 'm', 'services/y/sync.yaml': 's', 'services/y/deep/z.yaml': 'z' }, ['processings/empty']);
    expect(tree.has('services')).toBe(true);
    expect(tree.has('services/x')).toBe(true);
    expect(tree.has('services/x/manifest.yaml')).toBe(true);
    expect(tree.has('services/z')).toBe(false);
    expect(tree.has('../a.yaml')).toBe(false);
    expect(tree.read('a.yaml')).toBe('a');
    expect(tree.read('services')).toBeUndefined();
    expect(tree.listDirs('')).toEqual(['processings', 'services']);
    expect(tree.listDirs('services')).toEqual(['x', 'y']);
    expect(tree.listDirs('processings')).toEqual(['empty']);
    expect(tree.listDirs('nothing')).toEqual([]);
    expect(tree.listDirs('../services')).toEqual([]);
  });

  it('refuses a path that is not repo-relative POSIX, or a text that is not a string', () => {
    for (const bad of ['/etc/passwd', '../x.yaml', 'a/../b.yaml', './a.yaml', 'a//b.yaml', 'a/', '']) {
      expect(() => treeFromFiles({ [bad]: 'x' }), bad).toThrow(/is not a repo-relative POSIX path/);
    }
    expect(() => treeFromFiles({ a: 1 as unknown as string })).toThrow(/must be a text/);
    expect(() => treeFromFiles({ a: 'x', 'a/b': 'y' })).toThrow(/both a file and a folder/);
  });

  it('is a snapshot: changing the record afterwards changes nothing', () => {
    const files: Record<string, string> = { 'a.yaml': 'a' };
    const tree = treeFromFiles(files);
    files['a.yaml'] = 'b';
    files['c.yaml'] = 'c';
    expect(tree.read('a.yaml')).toBe('a');
    expect(tree.has('c.yaml')).toBe(false);
  });

  it('fails like loadDirectory when a referenced file is missing', () => {
    const files = filesOf(EXAMPLE_V02);
    delete files['services/bistro-web/sync.yaml'];
    expect(() => buildDossier(treeFromFiles(files), GENERATED_AT, 'en')).toThrow(/services\/bistro-web\/sync\.yaml not found/);
  });
});
