import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIONS, ART30_KEYS, CHECK_KEYS, ITEM_LABELS, LANGUAGES, ROLES, WORDS, buildDossier, buildDossierModel, renderDossier, renderPhrase, type DossierModel, type Place } from '../src/dossier.js';
import { loadDirectory } from '../src/fs.js';
import { treeFromFiles } from '../src/tree.js';
import { EXAMPLE_V02, GENERATED_AT, filesOf } from './helpers.js';

const golden = {
  en: readFileSync(join(EXAMPLE_V02, 'documents/register.md'), 'utf8'),
  fr: readFileSync(join(EXAMPLE_V02, 'documents/register.fr.md'), 'utf8'),
};
const model = (): DossierModel => buildDossierModel(loadDirectory(EXAMPLE_V02));

/** The rows of the Actions table of a golden dossier: id, role label, count, where. */
function goldenActions(markdown: string): { id: string; role: string; count: number; where: string[] }[] {
  return markdown
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) => {
      const [action, role, count, where] = l.slice(2, -2).split(' | ');
      return { id: /^`([a-z-]+)`/.exec(action)![1], role, count: Number(count), where: where.split(', ') };
    });
}

describe('renderDossier(buildDossierModel(tree))', () => {
  it('equals the golden dossiers byte for byte, in English and French', () => {
    const m = model();
    expect(renderDossier(m, GENERATED_AT, 'en')).toBe(golden.en);
    expect(renderDossier(m, GENERATED_AT, 'fr')).toBe(golden.fr);
  });

  it('one model renders both languages: rendering does not change it', () => {
    const m = model();
    const before = JSON.stringify(m);
    renderDossier(m, GENERATED_AT, 'fr');
    renderDossier(m, GENERATED_AT, 'en');
    expect(JSON.stringify(m)).toBe(before);
  });

  it('refuses an unusable generated_at or an unknown language', () => {
    expect(() => renderDossier(model(), 'yesterday', 'en')).toThrow(/generated_at "yesterday" is not usable/);
    expect(() => renderDossier(model(), GENERATED_AT, 'de' as 'en')).toThrow(/Unknown language "de"/);
  });
});

describe('the model of the Bistro Booking example', () => {
  it('counts the open items and the actions of the golden dossier', () => {
    const m = model();
    const front = /open_items: (\d+)\nactions: (\d+)/.exec(golden.en)!;
    expect(m.openItems).toBe(Number(front[1]));
    expect(m.actions).toHaveLength(Number(front[2]));
    expect(m.openItems).toBe(15);
    expect(m.actions.reduce((n, a) => n + a.count, 0)).toBe(m.openItems);
    expect(buildDossier(loadDirectory(EXAMPLE_V02), GENERATED_AT, 'en').openItems).toBe(m.openItems);
  });

  it('places every action where the golden dossier says, with its role and count, in the same order', () => {
    const label = (p: Place): string => (p.kind === 'processing' ? p.id : ITEM_LABELS.en.places[p.kind]);
    const expected = goldenActions(golden.en);
    expect(model().actions.map((a) => ({ id: a.id, role: ROLES[a.role].en, count: a.count, where: a.places.map(label) }))).toEqual(expected);
    // Spelled out, so that a change in the golden is a change here too.
    const places = Object.fromEntries(model().actions.map((a) => [a.id, a.places]));
    const me: Place = { kind: 'processing', id: 'marketing-emails' };
    expect(places).toEqual({
      information: [me],
      'joint-controllers': [me],
      'organisation-representative': [{ kind: 'organisation' }],
      'processor-contracts': [me],
      'ai-classification': [{ kind: 'ai' }],
      'controller-rationale': [{ kind: 'outside' }],
      dpia: [me],
      'legal-basis-detail': [me],
      retention: [me],
      'sensitive-data': [me],
      'ai-obligations': [{ kind: 'ai' }],
      'personal-data': [me],
      'security-measures': [me],
      'transfer-safeguards': [me],
    });
  });

  it('keeps each processing open items, and flags the values that carry them', () => {
    const m = model();
    const [me, tb] = m.processings;
    expect([me.id, tb.id]).toEqual(['marketing-emails', 'table-bookings']);
    expect(tb.openItems).toEqual([]);
    expect(me.openItems.map((o) => o.kind).sort()).toEqual(
      ['dpia', 'information', 'joint-controllers', 'legal-basis-detail', 'personal-data', 'processor-contracts', 'retention', 'security-measures', 'sensitive-data', 'transfer-safeguards'].sort(),
    );
    const flagged = new Set([...me.art30, ...me.checks].flatMap((g) => g.values.map((v) => v.open)).filter((k) => k !== null));
    // Every open item of the processing is on one of its values; the representative is the organisation's, shown in each processing.
    expect([...flagged].sort()).toEqual([...me.openItems.map((o) => o.kind), 'organisation-representative'].sort());
    for (const p of m.processings) {
      expect(p.art30.map((g) => g.item)).toEqual([...ART30_KEYS]);
      expect(p.checks.map((g) => g.item)).toEqual([...CHECK_KEYS]);
    }
    const organisation = Object.fromEntries(m.organisation.rows.map((r) => [r.key, r.open]));
    expect(organisation).toEqual({ controller: null, dpo: null, representative: 'organisation-representative', 'privacy-contact': null });
  });

  it('holds no translated word: placeholders are word keys, rendered per language', () => {
    const text = JSON.stringify(model());
    for (const language of LANGUAGES) {
      for (const [key, value] of Object.entries(WORDS[language])) {
        if (key === 'dpa') continue; // "DPA" is also the name of a manifest field value
        expect(text, `${language}.${key}`).not.toContain(`"${value}"`);
      }
    }
    const tb = model().processings[1];
    const recipients = tb.art30.find((g) => g.item === 'recipients')!;
    const calendar = recipients.values.find((v) => renderPhrase(v.value, 'en').startsWith('the calendar'))!;
    expect(calendar.value).toEqual(['the calendar application chosen by the guest (', { word: 'countryUnknown' }, ')']);
    expect(renderPhrase(calendar.value, 'fr')).toBe('the calendar application chosen by the guest (pays inconnu)');
  });

  it('carries the organisation, the services with their sync, the recipients, the AI features and what is outside', () => {
    const m = model();
    expect(m.organisation).toMatchObject({ name: 'Bistro Booking Group', language: 'en' });
    expect(m.services.map((s) => [s.repo, s.sha.slice(0, 7)])).toEqual([
      ['bistro-api', '7c1e4f9'],
      ['bistro-web', '9d3f6b1'],
    ]);
    expect(m.services[0]).toMatchObject({ receivedAt: '2026-03-12T09:41:07Z', lag: { count: 2 } });
    expect(m.anchors).toEqual(Object.fromEntries(m.services.map((s) => [s.repo, s.sha])));

    const tb = m.processings[1];
    expect(tb.legalBasis).toBe('contract');
    const paygate = tb.recipients.find((r) => r.name === 'PayGate')!;
    expect(paygate).toMatchObject({ kind: 'processor', country: 'US', service: 'bistro-api', processor: 'paygate', dpa: 'yes', safeguard: 'standard contractual clauses', transferOutsideEu: true });
    expect(paygate.flows).toContain('charge-deposit');
    expect(tb.recipients.find((r) => r.kind === 'flow')).toMatchObject({ name: 'the calendar application chosen by the guest', country: 'unknown', flows: ['calendar-link'] });

    expect(m.aiFeatures.map((f) => `${f.service}/${f.id}`)).toEqual(goldenRows('AI features').map((r) => `${r[0]}/${r[1].split(':')[0]}`));
    for (const f of m.aiFeatures) expect(f.obligations.map((o) => o.id)).toEqual([...f.obligations.map((o) => o.id)].sort());
    expect(m.aiFeatures.map((f) => [f.id, f.role, f.open])).toEqual([
      ['booking-assistant', 'to-assess', ['ai-classification', 'ai-obligations']],
      ['no-show-prediction', 'provider', ['ai-obligations']],
    ]);
    // Listed obligations keep their status; an expected one the manifest does not list has none (to complete).
    expect(m.aiFeatures[0].obligations.map((o) => [o.id, o.status])).toEqual([
      ['art4-ai-literacy', 'done'],
      ['art50-interaction', 'done'],
      ['art50-synthetic-content', null],
    ]);

    expect(m.outside.map((o) => o.service)).toEqual(goldenRows('Outside the register').map((r) => r[0]));
    expect(m.outside.filter((o) => o.open === 'controller-rationale').map((o) => o.service)).toEqual(['crm']);
  });

  it('carries the raw review of each processing and the parsed actions.yaml (v0.2.1), which the markdown does not use', () => {
    const m = model();
    expect(m.processings.find((p) => p.id === 'table-bookings')!.review).toMatchObject({ status: 'validated', by: 'Data protection office' });
    expect(m.actionsFile).toMatchObject({ spec_version: '0.2', contacts: [{ id: 'data-protection-office' }, { id: 'platform-team' }] });
    expect(buildDossierModel(loadDirectory(EXAMPLE_V02), { actionsFile: false }).actionsFile).toBeNull();

    // An invalid actions.yaml fails the model, not buildDossier (which never reads it).
    const files = { ...filesOf(EXAMPLE_V02), 'actions.yaml': 'spec_version: "0.2"\ncontacts:\n  - {id: x, role: lawyer, name: n, contact: c}\n' };
    expect(() => buildDossierModel(treeFromFiles(files))).toThrow(/actions\.yaml is invalid: \/contacts\/0\/role/);
    expect(buildDossier(treeFromFiles(files), GENERATED_AT, 'en').markdown).toBe(golden.en);
  });

  it('exports the action catalogue with a role and both labels for each action', () => {
    for (const [id, a] of Object.entries(ACTIONS)) {
      expect(ROLES[a.role], id).toBeDefined();
      expect(a.en.length).toBeGreaterThan(0);
      expect(a.fr.length).toBeGreaterThan(0);
    }
  });
});

/** The cells of the rows of the table under `## <heading>` of the English golden. */
function goldenRows(heading: string): string[][] {
  const section = golden.en.split(`## ${heading}\n`)[1].split(/^## /m)[0];
  return section
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| ---') && !l.startsWith('| Service |'))
    .map((l) => l.slice(2, -2).split(' | '));
}
