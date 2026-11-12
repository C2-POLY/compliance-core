import { describe, expect, it } from 'vitest';
import { validateText } from '../src/schema.js';
import { parseStrict } from '../src/yaml.js';

const bad: Record<string, string> = {
  'a !!python/object/apply tag': 'a: !!python/object/apply:os.system ["id"]\n',
  'a %YAML 1.1 directive with a merge key': '%YAML 1.1\n---\nbase: &b {x: 1}\nother:\n  <<: *b\n',
  'an alias': 'a: &x [1, 2]\nb: *x\n',
  'a custom !foo tag': 'a: !foo bar\n',
  'an anchor without alias': 'a: &x 1\n',
  'an explicit %YAML 1.2 directive': '%YAML 1.2\n---\na: 1\n',
  'a %TAG directive': '%TAG !e! tag:example.com,2026:\n---\na: 1\n',
  'a standard tag': 'a: !!str 1\n',
  'two documents': 'a: 1\n---\nb: 2\n',
  'a duplicate key': 'a: 1\na: 2\n',
};

describe('strict YAML', () => {
  for (const [name, text] of Object.entries(bad)) {
    it(`rejects ${name}`, () => {
      expect(() => parseStrict(text)).toThrow();
      expect(validateText('manifest', text).errors[0]).toMatchObject({ keyword: 'yaml' });
    });
  }

  it('accepts plain YAML 1.2 (and keeps "<<" a plain key)', () => {
    expect(parseStrict('a: 1\n"<<": x\nb: [yes, no]\n')).toEqual({ a: 1, '<<': 'x', b: ['yes', 'no'] });
  });
});
