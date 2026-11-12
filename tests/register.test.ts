import { cpSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { loadDirectory } from '../src/fs.js';
import { anchorsYaml, buildRegister as registerOfTree, codeSpan, openSummary } from '../src/register.js';
import { validateDocument } from '../src/schema.js';
import { EXAMPLE, GENERATED_AT, tmp } from './helpers.js';

// Ported from compliance-action (tests/register.test.ts): the same checks, on a tree loaded from the folder.
const buildRegister = (dir: string, generatedAt: string) => registerOfTree(loadDirectory(dir), generatedAt);

const golden = readFileSync(join(EXAMPLE, 'documents/register.md'), 'utf8');

/** A copy of the example without the generated files. */
function exampleCopy(withGenerated = true): string {
  const dir = tmp('cc-register-');
  cpSync(EXAMPLE, dir, { recursive: true });
  if (!withGenerated) {
    rmSync(join(dir, 'documents'), { recursive: true });
    rmSync(join(dir, 'anchors.yaml'));
  }
  return dir;
}

describe('buildRegister', () => {
  it('equals the golden register of the Bistro Booking example, byte for byte', () => {
    const { markdown } = buildRegister(EXAMPLE, GENERATED_AT);
    expect(markdown).toBe(golden);
  });

  it('gives identical output on two runs, and ignores the clock', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      const a = buildRegister(EXAMPLE, GENERATED_AT);
      vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
      const b = buildRegister(EXAMPLE, GENERATED_AT);
      expect(b).toEqual(a);
    } finally {
      vi.useRealTimers();
    }
  });

  it('puts a Source on every table row, and "—" only on To complete / None identified rows', () => {
    const sectionRows = (md: string) => md.slice(md.indexOf('\n## ', md.indexOf('## Open items') + 1)).split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Item') && !l.startsWith('| ---'));
    const rows = sectionRows(golden);
    expect(rows.length).toBeGreaterThan(30);
    const { markdown } = buildRegister(EXAMPLE, GENERATED_AT);
    const mine = sectionRows(markdown);
    expect(mine).toEqual(rows);
    for (const row of mine) {
      const cells = row.slice(1, -1).split(' | ').map((c) => c.trim());
      expect(cells).toHaveLength(3);
      const [, value, source] = cells;
      expect(source).not.toBe('');
      if (value === 'To complete' || value === 'None identified in the sources') expect(source).toBe('—');
      else expect(source).toMatch(/^(code: [\w.-]+@[0-9a-f]{7}:|spec: |declared: )/);
    }
    expect(markdown).toContain('| (a) Joint controller | To complete | — |');
  });

  it('returns the anchors, equal to the front matter and to the sync shas', () => {
    const { markdown, anchors } = buildRegister(EXAMPLE, GENERATED_AT);
    const front = parse(markdown.split('---\n')[1]);
    expect(front).toEqual({ spec_version: '0.1', generated_at: GENERATED_AT, open_items: 2, anchors });
    for (const repo of Object.keys(anchors)) {
      const sync = parse(readFileSync(join(EXAMPLE, 'services', repo, 'sync.yaml'), 'utf8'));
      expect(anchors[repo]).toBe(sync.sha);
    }
    expect(Object.keys(anchors)).toEqual(['bistro-api', 'bistro-web']);
    // bistro-analytics has no processing, the CRM is a declared tool: neither is an anchor.
    expect(anchorsYaml(anchors, GENERATED_AT)).toBe(readFileSync(join(EXAMPLE, 'anchors.yaml'), 'utf8'));
    expect(validateDocument('anchors', parse(anchorsYaml(anchors, GENERATED_AT)))).toEqual([]);
  });

  it('writes `anchors: {}` when no processing refers to a repo', () => {
    const dir = exampleCopy();
    rmSync(join(dir, 'processings'), { recursive: true });
    const { markdown, anchors } = buildRegister(dir, GENERATED_AT);
    expect(anchors).toEqual({});
    expect(markdown.startsWith('---\nspec_version: "0.1"\ngenerated_at: "2026-11-11T00:00:00Z"\nopen_items: 0\nanchors: {}\n---\n\n# Records')).toBe(true);
    expect(markdown.match(/^## .*/gm)).toEqual(['## Open items']);
    expect(markdown).toContain('\nNo processing activity yet.\n');
  });

  describe('fails, and writes nothing', () => {
    it('when a processing points to a repo with no sync', () => {
      const dir = exampleCopy();
      rmSync(join(dir, 'services/bistro-web/sync.yaml'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/services\/bistro-web\/sync\.yaml not found/);
    });

    it('when a processing points to a repo with no manifest', () => {
      const dir = exampleCopy();
      rmSync(join(dir, 'services/bistro-web/manifest.yaml'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/services\/bistro-web\/manifest\.yaml not found/);
    });

    it('when a tool is not in compliance.yaml', () => {
      const dir = exampleCopy();
      const p = join(dir, 'processings/marketing-emails/processing.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace('tool: crm', 'tool: payroll'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/tool "payroll" is not listed/);
    });

    it('when a repo is not listed in compliance.yaml', () => {
      const dir = exampleCopy();
      const p = join(dir, 'processings/marketing-emails/processing.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace('repo: bistro-api', 'repo: bistro-ghost'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/repo "bistro-ghost" is not listed/);
    });

    it('when a data or recipients filter names an unknown id', () => {
      const dir = exampleCopy();
      const p = join(dir, 'processings/table-bookings/processing.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace('textflow-sms]', 'ghost]'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/no processor or outbound flow "ghost"/);
    });

    it('on an invalid file, a YAML alias, a symlink or a bad date', () => {
      const dir = exampleCopy();
      const p = join(dir, 'processings/table-bookings/processing.yaml');
      const original = readFileSync(p, 'utf8');
      writeFileSync(p, original.replace('legal_basis: contract', 'legal_basis: whatever'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/processing\.yaml is invalid/);
      writeFileSync(p, original.replace('purpose: ', 'purpose: &a '));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/processing\.yaml is invalid/);
      writeFileSync(p, original);
      expect(() => buildRegister(dir, 'yesterday')).toThrow(/generated_at "yesterday" is not usable/);
      rmSync(join(dir, 'services/bistro-web/sync.yaml'));
      symlinkSync(join(dir, 'services/bistro-api/sync.yaml'), join(dir, 'services/bistro-web/sync.yaml'));
      expect(() => buildRegister(dir, GENERATED_AT)).toThrow(/symbolic link/);
    });
  });

  describe('open items', () => {
    it('lists the gaps of the golden register first, and counts them in the front matter', () => {
      const { markdown, open } = buildRegister(EXAMPLE, GENERATED_AT);
      expect(open).toEqual([
        { id: 'marketing-emails', name: 'Marketing emails', items: ['(g) Security measures'] },
        { id: 'table-bookings', name: 'Table bookings', items: ['(e) Transfers: destination to assess for the calendar application chosen by the guest (country unknown)'] },
      ]);
      expect(markdown.indexOf('## Open items')).toBeLessThan(markdown.indexOf('## Marketing emails'));
      expect(markdown).toContain('\n2 open items in 2 of the 2 processing activities.\n');
    });

    it('finds every kind of gap where the rows are built, once each, and never joint controller or representative', () => {
      const dir = exampleCopy();
      const edit = (rel: string, from: string, to: string) => {
        const file = join(dir, rel);
        const text = readFileSync(file, 'utf8');
        expect(text).toContain(from);
        writeFileSync(file, text.replace(from, to));
      };
      edit('processings/marketing-emails/processing.yaml', 'controller: {name: Bistro Booking Group,', 'controller: {name: to complete,');
      edit('processings/marketing-emails/processing.yaml', 'contact: dpo@bistro-booking.example}', 'contact: TO COMPLETE}');
      edit('processings/table-bookings/processing.yaml', 'duration: P3Y', 'duration: unknown');
      edit('services/bistro-api/manifest.yaml', '{name: guest name, category: identity}', '{name: guest name, category: unknown}');
      edit('services/bistro-api/manifest.yaml', 'retention: {duration: P30D, trigger: log rotation}', 'retention: {duration: unknown, trigger: log rotation}');
      edit('services/bistro-api/manifest.yaml', '    safeguard: standard contractual clauses\n', '');
      const { markdown, open } = buildRegister(dir, GENERATED_AT);
      expect(markdown).toContain('| (a) Controller | To complete, privacy@bistro-booking.example |');
      expect(open[0].items).toEqual([
        '(a) Controller',
        '(a) Data protection officer',
        '(c) Personal data: category unknown',
        '(f) Erasure time limits: unknown for app-logs',
        '(g) Security measures',
      ]);
      expect(open[1].items).toEqual([
        '(c) Personal data: category unknown',
        '(e) Transfers: safeguard not declared for PayGate (US)',
        '(e) Transfers: destination to assess for the calendar application chosen by the guest (country unknown)',
        '(f) Erasure time limits: unknown',
      ]);
      expect(markdown).toContain('open_items: 9\n');
      expect(open.flatMap((x) => x.items).join(' ')).not.toMatch(/Joint controller|Representative/);
    });

    it('takes free text that only looks like a gap as a value', () => {
      const dir = exampleCopy();
      const file = join(dir, 'services/bistro-api/manifest.yaml');
      writeFileSync(file, readFileSync(file, 'utf8').replace('safeguard: standard contractual clauses', 'safeguard: "SCC, safeguard not declared"'));
      const p = join(dir, 'processings/marketing-emails/processing.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace('purpose: Send', 'purpose: To complete our offers, send'));
      const { open } = buildRegister(dir, GENERATED_AT);
      expect(open.map((x) => x.items)).toEqual([['(g) Security measures'], ['(e) Transfers: destination to assess for the calendar application chosen by the guest (country unknown)']]);
    });

    it('escapes the Open items table and the pull request lines', () => {
      const dir = exampleCopy();
      const p = join(dir, 'processings/marketing-emails/processing.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace('name: Marketing emails', 'name: "Mail|ing @bob `x`"'));
      const { markdown } = buildRegister(dir, GENERATED_AT);
      expect(markdown).toContain('| Mail\\|ing @bob `x` (marketing-emails) | (g) Security measures |');
      expect(codeSpan('Mail|ing\n@bob `x`')).toBe("`Mail|ing @bob 'x'`");
    });

    it('writes a controller contact typed "to complete" as To complete, and counts it', () => {
      const dir = exampleCopy();
      const file = join(dir, 'processings/marketing-emails/processing.yaml');
      writeFileSync(file, readFileSync(file, 'utf8').replace('contact: privacy@bistro-booking.example}', 'contact: to Complete}'));
      const { markdown, open } = buildRegister(dir, GENERATED_AT);
      expect(markdown).toContain('| (a) Controller | Bistro Booking Group, To complete | declared: marketing team |');
      expect(open[0].items).toEqual(['(a) Controller', '(g) Security measures']);
      expect(markdown).toContain('open_items: 3\n');
    });

    it('says when nothing is open', () => {
      expect(openSummary(0, 0, 2)).toBe('No open item in the 2 processing activities.');
      expect(openSummary(0, 0, 1)).toBe('No open item in the 1 processing activity.');
      expect(openSummary(1, 1, 1)).toBe('1 open item in 1 of the 1 processing activity.');
      expect(openSummary(0, 0, 0)).toBe('No processing activity yet.');
    });
  });

  it('escapes cells: a newline becomes a space and | becomes \\|', () => {
    const dir = exampleCopy();
    const p = join(dir, 'processings/table-bookings/processing.yaml');
    writeFileSync(p, readFileSync(p, 'utf8').replace('purpose: Take, confirm, remind and secure table bookings made by guests.', 'purpose: "  Take bookings\\nand | more  "'));
    expect(buildRegister(dir, GENERATED_AT).markdown).toContain('| (b) Purposes | Take bookings and \\| more | declared: operations team |');
  });
});
