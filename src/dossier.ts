import { ComplianceError } from './errors.js';
import { TEMPLATE_FILES } from './generated/spec.js';
import {
  EU_EEA,
  atomic,
  cell,
  cmp,
  composite,
  duration,
  isPlaceholder,
  processingSource,
  readDoc,
  renderTemplate,
  type Cand,
  type Context,
  type Doc,
  type Manifest,
  type Src,
} from './register.js';
import { validateDocument, versionOf } from './schema.js';
import type { ComplianceTree } from './tree.js';

// The v0.2 compliance dossier: the rules are in templates/register/README.md of the spec, part "v0.2: the compliance dossier".
// Two steps: buildDossierModel reads the tree into a structured, language-neutral model (stable keys, no translated text,
// open items flagged where each value is built); renderDossier turns the model into the markdown of one language.

export const DOSSIER_VERSION = '0.2';
const TEMPLATES = { en: 'register.en.md.tmpl', fr: 'register.fr.md.tmpl' } as const;

export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

const NO_SOURCE = '—';
const FROM_COMPLIANCE = 'declared: compliance.yaml';

// ---------- translations ----------

/** The words the dossier adds to the values of the sources, per language. A Phrase refers to them by key. */
export const WORDS = {
  en: {
    toComplete: 'To complete',
    noneFound: 'None identified in the sources',
    none: 'None',
    notExpected: 'Not expected for this legal basis',
    notDesignated: 'Not designated',
    notRequired: 'Not required',
    countryUnknown: 'country unknown',
    destinationToAssess: 'destination to assess',
    safeguardNotDeclared: 'safeguard not declared',
    arrangement: 'arrangement',
    interest: 'Interest',
    necessity: 'Necessity',
    impact: 'Impact',
    safeguards: 'Safeguards',
    collection: 'Collection',
    withdrawal: 'Withdrawal',
    reference: 'Reference',
    required: 'Required',
    criteria: 'Criteria',
    dpa: 'DPA',
  },
  fr: {
    toComplete: 'À compléter',
    noneFound: 'Aucun identifié dans les sources',
    none: 'Aucun',
    notExpected: 'Non attendu pour cette base légale',
    notDesignated: 'Non désigné',
    notRequired: 'Non requis',
    countryUnknown: 'pays inconnu',
    destinationToAssess: 'destination à évaluer',
    safeguardNotDeclared: 'garantie non déclarée',
    arrangement: 'accord',
    interest: 'Intérêt',
    necessity: 'Nécessité',
    impact: 'Impact',
    safeguards: 'Garanties',
    collection: 'Recueil',
    withdrawal: 'Retrait',
    reference: 'Référence',
    required: 'Requise',
    criteria: 'Critères',
    dpa: 'DPA',
  },
} as const satisfies Record<Language, Record<string, string>>;
export type WordKey = keyof (typeof WORDS)['en'];

export const ORGANISATION_KEYS = ['controller', 'dpo', 'representative', 'privacy-contact'] as const;
export type OrganisationKey = (typeof ORGANISATION_KEYS)[number];
/** The items of GDPR Art. 30(1), in the order of the dossier. */
export const ART30_KEYS = ['controller', 'joint-controller', 'representative', 'dpo', 'purposes', 'data-subjects', 'personal-data', 'recipients', 'transfers', 'erasure-time-limits', 'security-measures'] as const;
export type Art30Key = (typeof ART30_KEYS)[number];
/** The DPO checks, in the order of the dossier. */
export const CHECK_KEYS = ['legal-basis', 'legal-basis-detail', 'dpia', 'information', 'sensitive-data', 'processor-contracts'] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];
export type PlaceKind = 'organisation' | 'processing' | 'ai' | 'outside';

/** The labels of the rows and places of the dossier, per language. */
export const ITEM_LABELS = {
  en: {
    organisation: { controller: 'Controller', dpo: 'Data protection officer', representative: 'Representative (Art. 27)', 'privacy-contact': 'Privacy contact' },
    art30: {
      controller: '(a) Controller',
      'joint-controller': '(a) Joint controller',
      representative: '(a) Representative',
      dpo: '(a) Data protection officer',
      purposes: '(b) Purposes',
      'data-subjects': '(c) Data subjects',
      'personal-data': '(c) Personal data',
      recipients: '(d) Recipients',
      transfers: '(e) Transfers',
      'erasure-time-limits': '(f) Erasure time limits',
      'security-measures': '(g) Security measures',
    },
    checks: { 'legal-basis': 'Legal basis', 'legal-basis-detail': 'Legal basis detail', dpia: 'DPIA', information: 'Information of persons', 'sensitive-data': 'Sensitive data', 'processor-contracts': 'Processor contracts' },
    places: { organisation: 'Organisation', ai: 'AI features', outside: 'Outside the register' },
  },
  fr: {
    organisation: { controller: 'Responsable du traitement', dpo: 'Délégué à la protection des données', representative: 'Représentant (art. 27)', 'privacy-contact': "Contact pour l'exercice des droits" },
    art30: {
      controller: '(a) Responsable du traitement',
      'joint-controller': '(a) Responsable conjoint',
      representative: '(a) Représentant',
      dpo: '(a) Délégué à la protection des données',
      purposes: '(b) Finalités',
      'data-subjects': '(c) Personnes concernées',
      'personal-data': '(c) Données personnelles',
      recipients: '(d) Destinataires',
      transfers: '(e) Transferts',
      'erasure-time-limits': "(f) Délais d'effacement",
      'security-measures': '(g) Mesures de sécurité',
    },
    checks: { 'legal-basis': 'Base légale', 'legal-basis-detail': 'Détail de la base légale', dpia: 'AIPD', information: 'Information des personnes', 'sensitive-data': 'Données sensibles', 'processor-contracts': 'Contrats de sous-traitance' },
    places: { organisation: 'Organisation', ai: "Fonctionnalités d'IA", outside: 'Hors du registre' },
  },
} as const satisfies Record<
  Language,
  { organisation: Record<OrganisationKey, string>; art30: Record<Art30Key, string>; checks: Record<CheckKey, string>; places: Record<Exclude<PlaceKind, 'processing'>, string> }
>;

export type Role = 'organisation' | 'dpo' | 'developer';
/** The roles of the Actions table, in their order, with their labels. */
export const ROLES: Record<Role, { order: number; en: string; fr: string }> = {
  organisation: { order: 0, en: 'Organisation', fr: 'Organisation' },
  dpo: { order: 1, en: 'DPO', fr: 'DPO' },
  developer: { order: 2, en: 'Developer', fr: 'Développeur' },
};

/** The action catalogue: each action closes one kind of open item (templates/register/README.md, Actions). */
export const ACTIONS = {
  'organisation-identity': { role: 'organisation', en: "Complete the controller's identity", fr: "Compléter l'identité du responsable du traitement" },
  'organisation-dpo': { role: 'organisation', en: 'Designate a DPO, or state why none is required', fr: "Désigner un DPO, ou indiquer pourquoi aucun n'est requis" },
  'organisation-representative': { role: 'organisation', en: 'State whether a representative in the EU is required (Art. 27)', fr: "Indiquer si un représentant dans l'UE est requis (art. 27)" },
  'joint-controllers': { role: 'organisation', en: 'List the joint controllers, or state that there are none', fr: "Lister les responsables conjoints, ou indiquer qu'il n'y en a pas" },
  'personal-data': { role: 'developer', en: 'Describe the personal data and classify the unknown categories', fr: 'Décrire les données personnelles et classer les catégories inconnues' },
  'transfer-safeguards': { role: 'developer', en: 'Declare the safeguard of each transfer outside the EU', fr: "Déclarer la garantie de chaque transfert hors de l'UE" },
  'processor-contracts': { role: 'organisation', en: 'Sign or locate the processor contracts (Art. 28)', fr: 'Signer ou retrouver les contrats de sous-traitance (art. 28)' },
  retention: { role: 'dpo', en: 'Set the retention periods', fr: 'Fixer les durées de conservation' },
  'security-measures': { role: 'developer', en: 'Describe the security measures', fr: 'Décrire les mesures de sécurité' },
  'legal-basis-detail': { role: 'dpo', en: 'Document the legal basis', fr: 'Documenter la base légale' },
  dpia: { role: 'dpo', en: 'Assess whether a DPIA is required, and reference it', fr: 'Évaluer si une AIPD est requise, et la référencer' },
  information: { role: 'organisation', en: 'State how the persons are informed (Art. 13 and 14)', fr: 'Indiquer comment les personnes sont informées (art. 13 et 14)' },
  'sensitive-data': { role: 'dpo', en: 'Assess the sensitive data (Art. 9)', fr: 'Évaluer les données sensibles (art. 9)' },
  'ai-classification': { role: 'dpo', en: 'Classify the AI features: role and risk level', fr: "Classer les fonctionnalités d'IA : rôle et niveau de risque" },
  'ai-obligations': { role: 'developer', en: 'Meet or document the AI Act obligations', fr: "Remplir ou documenter les obligations de l'AI Act" },
  'controller-rationale': { role: 'dpo', en: 'Explain why the organisation is not the controller', fr: "Expliquer pourquoi l'organisation n'est pas responsable du traitement" },
} as const satisfies Record<string, { role: Role; en: string; fr: string }>;
export type ActionId = keyof typeof ACTIONS;
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];

export const actionLabel = (id: ActionId, language: Language): string => ACTIONS[id][language];
export const roleLabel = (role: Role, language: Language): string => ROLES[role][language];

/** `<N>(s)`: English singular for 1, French singular for 0 and 1. */
const plural = (n: number, language: Language, one: string, many: string): string => ((language === 'fr' ? n <= 1 : n === 1) ? one : many);

export function actionsSummary(openItems: number, actions: number, language: Language): string {
  if (openItems === 0) return language === 'fr' ? 'Aucun point ouvert.' : 'No open item.';
  if (language === 'fr') {
    return `${openItems} ${plural(openItems, language, 'point ouvert', 'points ouverts')}, ${plural(openItems, language, 'fermé', 'fermés')} par ${actions} ${plural(actions, language, 'action', 'actions')}.`;
  }
  return `${openItems} open ${plural(openItems, language, 'item', 'items')}, closed by ${actions} ${plural(actions, language, 'action', 'actions')}.`;
}

function aiSummary(k: number, language: Language): string {
  if (language === 'fr') return k === 0 ? "Aucune fonctionnalité d'IA dans les services des traitements." : `${k} ${plural(k, language, 'fonctionnalité', 'fonctionnalités')} d'IA dans les services des traitements.`;
  return k === 0 ? 'No AI feature in the services of the processing activities.' : `${k} AI ${plural(k, language, 'feature', 'features')} in the services of the processing activities.`;
}

function outsideSummary(k: number, language: Language): string {
  if (language === 'fr') {
    return k === 0
      ? "Tous les services et composants ont l'organisation pour responsable."
      : `${k} ${plural(k, language, 'service', 'services')} ou ${plural(k, language, 'composant', 'composants')} dont le responsable n'est pas l'organisation seule.`;
  }
  return k === 0
    ? 'Every service and component is controlled by the organisation.'
    : `${k} ${plural(k, language, 'service', 'services')} or ${plural(k, language, 'component', 'components')} whose controller is not the organisation alone.`;
}

// ---------- phrases: language-neutral values ----------

/** A value of the dossier: text of the sources, and words of the dossier by key (WORDS), joined in order. */
export type Phrase = (string | { word: WordKey })[];

/** Builds a phrase, merging adjacent texts so that two equal phrases have the same segments. */
function phrase(...parts: (string | { word: WordKey } | Phrase)[]): Phrase {
  const out: Phrase = [];
  for (const part of parts.flat()) {
    if (typeof part === 'string') {
      if (part === '') continue;
      if (typeof out[out.length - 1] === 'string') out[out.length - 1] = (out[out.length - 1] as string) + part;
      else out.push(part);
    } else out.push(part);
  }
  return out;
}
const word = (key: WordKey): { word: WordKey } => ({ word: key });
const joinPhrases = (list: Phrase[], separator: string): Phrase => phrase(...list.flatMap((p, i) => (i === 0 ? [p] : [separator, p])));
const phraseKey = (p: Phrase): string => JSON.stringify(p);

/** The text of a phrase in a language. */
export function renderPhrase(p: Phrase, language: Language): string {
  return p.map((s) => (typeof s === 'string' ? s : WORDS[language][s.word])).join('');
}

// ---------- the model ----------

/** One value of a row: its source (`null`: no source, shown `—`), and the action that closes it when it is an open item. */
export interface ValueRow {
  value: Phrase;
  source: string | null;
  open: ActionId | null;
}

/**
 * The values of one item. `order` is how the values are merged and sorted once translated, which the renderer applies
 * again in the language of the document: `atomic` (one row per value, the strongest source), `composite` (one row per value and
 * source), `sorted` (sorted by value), `as-is`. The model holds them in that order in English.
 */
export interface ItemRows<K extends string> {
  item: K;
  values: ValueRow[];
  order: 'atomic' | 'composite' | 'sorted' | 'as-is';
}

export interface OrganisationRow {
  key: OrganisationKey;
  value: Phrase;
  source: string | null;
  /** The action that closes it when the value is open. The privacy contact never raises an open item. */
  open: ActionId | null;
}

export type Place = { kind: 'organisation' } | { kind: 'processing'; id: string } | { kind: 'ai' } | { kind: 'outside' };

export interface OpenItem {
  kind: ActionId;
  /** What the open item is about (a storage, a processor, a feature...): an open item found twice in one place is one open item. */
  subject: string;
}

export interface ModelAction {
  id: ActionId;
  role: Role;
  count: number;
  /** In the order of the dossier: organisation, the processings by id, AI features, outside the register. */
  places: Place[];
}

export interface RecipientModel {
  /** `processor` of a manifest, `flow` (an outbound flow to no processor), `declared` (recipients of processing.yaml). */
  kind: 'processor' | 'flow' | 'declared';
  name: string;
  /** ISO code, `unknown`, or null for a declared recipient. */
  country: string | null;
  /** The repo name or declared tool id of the manifest, null for a declared recipient. */
  service: string | null;
  /** The processor id in its manifest. */
  processor: string | null;
  /** The ids of the outbound flows of this processing that reach it. */
  flows: string[];
  dpa: string | null;
  dpaRef: string | null;
  safeguard: string | null;
  transferOutsideEu: boolean | null;
  source: string;
}

export interface ProcessingModel {
  id: string;
  name: string;
  /** The raw legal_basis of processing.yaml. */
  legalBasis: string;
  art30: ItemRows<Art30Key>[];
  checks: ItemRows<CheckKey>[];
  /** The open items placed in this processing, in the order they were found. */
  openItems: OpenItem[];
  recipients: RecipientModel[];
  /** The raw `review` of processing.yaml (v0.2.1), or null. */
  review: Doc | null;
  /** The repos and declared tools that feed the processing, in the order of processing.yaml. */
  services: ProcessingServiceModel[];
}

/** One entry of `services` of processing.yaml. */
export interface ProcessingServiceModel {
  /** The repo name, or null for a declared tool. */
  repo: string | null;
  /** The declared tool id, or null for a repo. */
  tool: string | null;
  /** The personal_data ids in scope: the `data` filter, or every id of the manifest when there is none. Sorted. */
  data: string[];
  /** The `recipients` filter, sorted, or null when the entry has none. */
  recipients: string[] | null;
}

export interface ComponentModel {
  id: string;
  kind: string;
  /** The controller the manifest states for the component (v0.2), or null. */
  controller: string | null;
  /** The component's controller, or else the service's. */
  effectiveController: string;
}

export interface NoticeModel {
  id: string;
  component: string | null;
  kind: string;
  ref: string;
  source: string;
}

export interface PersonalDataModel {
  id: string;
  component: string | null;
  subjects: string[];
  purpose: string;
  /** The raw legal_basis of the manifest, or null when absent. */
  legalBasis: string | null;
  fields: { name: string; category: string }[];
  source: string;
}

export interface StorageModel {
  id: string;
  component: string | null;
  kind: string;
  location: string;
  /** The personal_data ids stored, as in the manifest. */
  data: string[];
  retention: { duration: string; trigger: string | null } | null;
  source: string;
}

/** What a manifest declares about its service, in the order of the manifest. */
export interface ServiceFacts {
  /** service.repo (`owner/name`), or null. */
  fullName: string | null;
  description: string;
  /** service.controller. */
  controller: string;
  components: ComponentModel[];
  notices: NoticeModel[];
  personalData: PersonalDataModel[];
  storage: StorageModel[];
}

/** A declared tool of compliance.yaml, with the facts of its manifest. */
export interface ToolModel extends ServiceFacts {
  id: string;
  /** service.name of its manifest. */
  name: string;
  /** The path of its manifest in the compliance repo. */
  path: string;
}

export interface AiObligation {
  id: string;
  /** The status of the manifest, or null for an expected obligation the manifest does not list (to complete). */
  status: string | null;
  ref: string | null;
}

export interface AiFeatureModel {
  /** The repo name or declared tool id. */
  service: string;
  id: string;
  description: string;
  /** The raw role (`provider`, `deployer`, `to-assess`...), or null when absent. */
  role: string | null;
  risk: { level: string; reason: string | null } | null;
  /** Sorted by id. */
  obligations: AiObligation[];
  /** The kinds of the open items of this feature. */
  open: ActionId[];
  source: string;
}

export interface OutsideModel {
  /** `<service>` or `<service>/<component>`. */
  service: string;
  component: string | null;
  controller: string;
  rationale: string | null;
  /** Sorted; null when the manifest states none. */
  privacyByDesign: string[] | null;
  /** Sorted by id, with the sorted categories of their fields. */
  data: { id: string; categories: string[] }[];
  open: ActionId | null;
  source: string;
}

export interface ServiceModel extends ServiceFacts {
  repo: string;
  /** service.name of its manifest. */
  name: string;
  sha: string;
  receivedAt: string;
  /** The raw lag of sync.yaml. */
  lag: Doc;
}

export interface DossierModel {
  specVersion: typeof DOSSIER_VERSION;
  organisation: {
    name: string;
    /** organisation.language of compliance.yaml (v0.2.1), or null. */
    language: string | null;
    rows: OrganisationRow[];
  };
  /** Repo name to the full sha of its sync.yaml, sorted by repo name. */
  anchors: Record<string, string>;
  /** The repos that have a services/ folder, in the order of compliance.yaml. */
  services: ServiceModel[];
  /** The declared tools, in the order of compliance.yaml. */
  tools: ToolModel[];
  openItems: number;
  /** In the order of the Actions table: role, then count (descending), then id. */
  actions: ModelAction[];
  processings: ProcessingModel[];
  /** Sorted by service then id. */
  aiFeatures: AiFeatureModel[];
  /** Sorted by service. */
  outside: OutsideModel[];
  /** The parsed actions.yaml (v0.2.1) when present and read, else null. The markdown does not use it. */
  actionsFile: Doc | null;
}

export interface DossierModelOptions {
  /** Read and validate actions.yaml when present (default true). buildDossier passes false: the dossier does not read it. */
  actionsFile?: boolean;
}

// ---------- AI Act ----------

const HIGH_RISK = ['art9-risk-management', 'art10-data-governance', 'art11-technical-documentation', 'art12-logging', 'art13-transparency', 'art14-human-oversight', 'art15-accuracy-robustness'];

/** The obligations the dossier expects of a feature (spec/manifest.md, ai_features). */
function expectedObligations(f: Doc): string[] {
  const out = ['art4-ai-literacy'];
  if (f.interacts_with_persons === true) out.push('art50-interaction');
  if (f.generates_content === true) out.push('art50-synthetic-content');
  if (f.risk?.level === 'high') {
    out.push(...HIGH_RISK);
    if (f.role === 'deployer') out.push('art26-deployer-duties', 'art27-fria');
  }
  return out;
}

/** A manifest with the name the dossier shows for it: the repo name or the declared tool id. */
type Labelled = Manifest & { label: string };

/** Places of the open items that are not a processing (a processing is its id, which cannot start with `#`). */
const ORGANISATION = '#organisation';
const AI_FEATURES = '#ai';
const OUTSIDE = '#outside';
const toPlace = (place: string): Place =>
  place === ORGANISATION ? { kind: 'organisation' } : place === AI_FEATURES ? { kind: 'ai' } : place === OUTSIDE ? { kind: 'outside' } : { kind: 'processing', id: place };

/** A value with its source; the open item it raises. */
type PCand = { value: Phrase; source: string; open: ActionId | null };

/** One row per value; the source is the strongest. Sorted by the English text. */
function atomicP(cands: PCand[]): ValueRow[] {
  const byKey = new Map<string, PCand[]>();
  for (const c of cands) byKey.set(phraseKey(c.value), [...(byKey.get(phraseKey(c.value)) ?? []), c]);
  const rows = [...byKey.values()].map((group) => {
    const best = atomic(group.map((c) => ({ value: '', source: c.source })))[0].source;
    // The value is open when any of its candidates is.
    return { value: group[0].value, source: best, open: group.find((c) => c.open !== null)?.open ?? null };
  });
  return rows.sort((a, b) => cmp(renderPhrase(a.value, 'en'), renderPhrase(b.value, 'en')));
}

/** One row per value and source, sorted by the English text then the source. */
function compositeP(cands: PCand[]): ValueRow[] {
  const seen = new Set<string>();
  return cands
    .filter((c) => {
      const key = `${phraseKey(c.value)}\u0000${c.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => cmp(renderPhrase(a.value, 'en'), renderPhrase(b.value, 'en')) || cmp(a.source, b.source));
}

/** Builds the structured model of the v0.2 dossier from a tree of a v0.2 compliance repo. Pure: reads the tree, never the clock. */
export function buildDossierModel(tree: ComplianceTree, options: DossierModelOptions = {}): DossierModel {
  const TC: Phrase = [word('toComplete')];
  const fill = (value: string): Phrase => (isPlaceholder(value) ? TC : [value]);

  const compliance = readDoc(tree, 'compliance.yaml', 'compliance');
  if (versionOf(compliance) !== DOSSIER_VERSION) throw new ComplianceError(`compliance.yaml is spec_version "${compliance.spec_version}": the dossier needs "${DOSSIER_VERSION}".`);
  const org = compliance.organisation as Doc;
  const repos = compliance.repos as Doc[];
  const tools = (compliance.declared_tools as Doc[] | undefined) ?? [];
  // Repos and tools share one namespace in the dossier (labels, open item subjects): a clash would merge two open items into one.
  for (const t of tools) {
    if (repos.some((r) => r.name === t.id)) throw new ComplianceError(`compliance.yaml: "${t.id}" is both a repo and a declared tool. Rename one. Nothing was generated.`);
  }

  // ---------- loading ----------

  const manifests = new Map<string, Labelled>();
  const syncs = new Map<string, Doc>();
  const loadRepo = (repo: string, who: string): Labelled => {
    if (!repos.some((r) => r.name === repo)) throw new ComplianceError(`${who}: repo "${repo}" is not listed in compliance.yaml.`);
    if (repo === '.' || repo === '..') throw new ComplianceError(`${who}: "${repo}" is not a repo name.`);
    const file = `services/${repo}/manifest.yaml`;
    const known = manifests.get(file);
    if (known) return known;
    const doc = readDoc(tree, file, 'manifest');
    const sync = readDoc(tree, `services/${repo}/sync.yaml`, 'sync');
    const m: Labelled = { file, doc, repo, sha: sync.sha as string, sha7: (sync.sha as string).slice(0, 7), label: repo };
    manifests.set(file, m);
    syncs.set(repo, sync);
    return m;
  };
  const loadTool = (tool: string, who: string): Labelled => {
    const entry = tools.find((t) => t.id === tool);
    if (!entry) throw new ComplianceError(`${who}: tool "${tool}" is not listed in declared_tools of compliance.yaml.`);
    const known = manifests.get(entry.path);
    if (known) return known;
    const m: Labelled = { file: entry.path, doc: readDoc(tree, entry.path, 'manifest'), label: tool };
    manifests.set(entry.path, m);
    return m;
  };
  const loadEntry = (e: { repo?: string; tool?: string }, who: string): Labelled => (e.repo !== undefined ? loadRepo(e.repo, who) : loadTool(e.tool!, who));

  // Every manifest of the compliance repo: the repos that have a services/<repo>/ folder, then the declared tools.
  const all: Labelled[] = [];
  for (const r of repos) {
    if (r.name === '.' || r.name === '..') throw new ComplianceError(`compliance.yaml: "${r.name}" is not a repo name.`);
    if (tree.has(`services/${r.name}`)) all.push(loadRepo(r.name, 'compliance.yaml'));
  }
  for (const t of tools) all.push(loadTool(t.id, 'compliance.yaml'));
  const inside = new Set(all.map((m) => m.doc.service.name as string));

  const anchors = Object.fromEntries(all.filter((m) => m.repo !== undefined).map((m) => [m.repo!, m.sha!] as const).sort(([a], [b]) => cmp(a, b)));

  const processings: Doc[] = tree
    .listDirs('processings')
    .filter((d) => tree.has(`processings/${d}/processing.yaml`))
    .map((d) => readDoc(tree, `processings/${d}/processing.yaml`, 'processing'))
    .sort((a, b) => cmp(a.id, b.id));
  for (let i = 1; i < processings.length; i++) {
    if (processings[i].id === processings[i - 1].id) throw new ComplianceError(`Two processings have the id "${processings[i].id}".`);
  }

  // Resolve every reference first: an unresolved one fails before anything is built.
  type Entry = { m: Labelled; scope: Set<string>; recipients?: Set<string> };
  type Notice = { m: Labelled; notice: Doc };
  const entries = new Map<Doc, Entry[]>();
  const notices = new Map<Doc, Notice[]>();
  const referenced = new Set<Labelled>();
  for (const p of processings) {
    const who = `processings/${p.id}`;
    entries.set(
      p,
      (p.services as Doc[]).map((entry) => {
        const m = loadEntry(entry, who);
        referenced.add(m);
        const ids = new Set<string>((m.doc.personal_data as Doc[]).map((d) => d.id));
        for (const id of (entry.data as string[] | undefined) ?? []) {
          if (!ids.has(id)) throw new ComplianceError(`${who}: no personal_data "${id}" in ${m.file}.`);
        }
        const recipientIds = new Set<string>([...m.doc.processors, ...m.doc.outbound_flows].map((x: Doc) => x.id));
        for (const id of (entry.recipients as string[] | undefined) ?? []) {
          if (!recipientIds.has(id)) throw new ComplianceError(`${who}: no processor or outbound flow "${id}" in ${m.file}.`);
        }
        return { m, scope: entry.data ? new Set<string>(entry.data) : ids, recipients: entry.recipients ? new Set<string>(entry.recipients) : undefined };
      }),
    );
    notices.set(
      p,
      ((p.information?.notices as Doc[] | undefined) ?? []).map((ref) => {
        const m = loadEntry(ref, `${who} (information)`);
        const notice = ((m.doc.notices as Doc[] | undefined) ?? []).find((n) => n.id === ref.id);
        if (!notice) throw new ComplianceError(`${who} (information): no notice "${ref.id}" in ${m.file}.`);
        return { m, notice };
      }),
    );
  }

  const actionsFile = options.actionsFile !== false && tree.has('actions.yaml') ? readDoc(tree, 'actions.yaml', 'actions') : null;

  // ---------- open items ----------

  /** Place, kind and subject: an open item found twice in one place is one open item. */
  const opens = new Map<string, { place: string; kind: ActionId; subject: string }>();
  const flag = (place: string, kind: ActionId, subject: string): ActionId => {
    opens.set(`${place}\u0000${kind}\u0000${subject}`, { place, kind, subject });
    return kind;
  };

  const src = (m: Manifest, s: Src): string => {
    if (s.kind === 'spec') return `spec: ${s.ref}`;
    if (s.kind === 'code' && m.repo !== undefined) return `code: ${m.repo}@${m.sha7}:${s.ref}`;
    return `declared: ${m.file} (${s.ref})`;
  };
  /** A value with no source is a placeholder: its source is null (`—`). */
  const placeholder = (value: Phrase, open: ActionId | null = null): ValueRow => ({ value, source: null, open });

  // ---------- Organisation ----------

  const orgRow = (value: Phrase | undefined, open: ActionId | null): ValueRow => (value === undefined ? placeholder(TC, open) : { value, source: FROM_COMPLIANCE, open });
  const oc = org.controller as Doc | undefined;
  const orgController = oc
    ? joinPhrases(
        [oc.legal_name, oc.address, oc.registration, oc.contact].filter((x) => x !== undefined).map(fill),
        ', ',
      )
    : undefined;
  const orgControllerOpen = !oc || [oc.legal_name, oc.address, oc.registration, oc.contact].some((x) => x !== undefined && isPlaceholder(x));

  const od = org.dpo as Doc | undefined;
  let orgDpo: Phrase | undefined;
  let orgDpoOpen = false;
  if (!od || od.designated === 'unknown') orgDpoOpen = true;
  else if (od.designated === true) {
    orgDpo = phrase(fill(od.name), ', ', fill(od.contact));
    orgDpoOpen = isPlaceholder(od.name) || isPlaceholder(od.contact);
  } else orgDpo = phrase(word('notDesignated'), `: ${od.reason}`);

  const or = org.representative as Doc | undefined;
  let orgRepresentative: Phrase | undefined;
  let orgRepresentativeOpen: ActionId | null = null;
  if (!or || or.required === 'unknown') orgRepresentativeOpen = flag(ORGANISATION, 'organisation-representative', 'representative');
  else if (or.required === true) {
    orgRepresentative = phrase(fill(or.name), ', ', fill(or.contact));
    if (isPlaceholder(or.name) || isPlaceholder(or.contact)) orgRepresentativeOpen = flag(ORGANISATION, 'organisation-representative', 'representative');
  } else orgRepresentative = or.reason !== undefined ? phrase(word('notRequired'), `: ${or.reason}`) : [word('notRequired')];

  const controllerOpen: ActionId | null = orgControllerOpen ? 'organisation-identity' : null;
  const dpoOpen: ActionId | null = orgDpoOpen ? 'organisation-dpo' : null;
  // A privacy contact written `to complete` is the placeholder itself: it has no source.
  const privacy = org.privacy_contact as string | undefined;
  const organisationRows: OrganisationRow[] = (
    [
      ['controller', orgRow(orgController, controllerOpen)],
      ['dpo', orgRow(orgDpo, dpoOpen)],
      ['representative', orgRow(orgRepresentative, orgRepresentativeOpen)],
      ['privacy-contact', privacy === undefined || isPlaceholder(privacy) ? placeholder(TC) : orgRow([privacy], null)],
    ] as const
  ).map(([key, v]) => ({ key, ...v }));

  // ---------- processings ----------

  const sections: ProcessingModel[] = processings.map((p) => {
    const place = p.id as string;
    const P = `declared: ${p.source.ref}`;
    const list = entries.get(p)!;

    // (a)
    let controller: ValueRow;
    if (p.controller) {
      const open = isPlaceholder(p.controller.name) || isPlaceholder(p.controller.contact) ? flag(place, 'organisation-identity', 'controller') : null;
      controller = { value: phrase(fill(p.controller.name), ', ', fill(p.controller.contact)), source: P, open };
    } else {
      controller = orgRow(orgController, orgControllerOpen ? flag(place, 'organisation-identity', 'controller') : null);
    }

    let joint: ValueRow[];
    const jc = p.joint_controllers as Doc[] | undefined;
    if (jc === undefined) joint = [placeholder(TC, flag(place, 'joint-controllers', 'joint controllers'))];
    else if (jc.length === 0) joint = [{ value: [word('none')], source: P, open: null }];
    else {
      joint = jc
        .map((j) => ({
          value: phrase(fill(j.name), ', ', fill(j.contact), ' (', word('arrangement'), ': ', fill(j.arrangement), ')'),
          source: P,
          open: [j.name, j.contact, j.arrangement].some(isPlaceholder) ? flag(place, 'joint-controllers', 'joint controllers') : null,
        }))
        .sort((a, b) => cmp(renderPhrase(a.value, 'en'), renderPhrase(b.value, 'en')));
    }

    let dpo: ValueRow;
    if (p.dpo) {
      const open = isPlaceholder(p.dpo.name) || isPlaceholder(p.dpo.contact) ? flag(place, 'organisation-dpo', 'dpo') : null;
      dpo = { value: phrase(fill(p.dpo.name), ', ', fill(p.dpo.contact)), source: P, open };
    } else {
      dpo = orgRow(orgDpo, orgDpoOpen ? flag(place, 'organisation-dpo', 'dpo') : null);
    }

    // (c), (f), and the processors and flows of (d) and (e)
    const subjects: Cand[] = (p.data_subjects as string[]).map((value) => ({ value, source: processingSource(p.source) }));
    const personal: PCand[] = [];
    const storageRows: PCand[] = [];
    const procs: { m: Labelled; pr: Doc }[] = [];
    const flows: { m: Labelled; fl: Doc; linked?: Doc }[] = [];
    const seenProcs = new Set<string>();
    for (const { m, scope, recipients } of list) {
      const d = m.doc;
      const inScope = (data: string[] | undefined): boolean => (data ?? []).some((id) => scope.has(id));
      for (const item of (d.personal_data as Doc[]).filter((x) => scope.has(x.id))) {
        const source = src(m, item.source);
        for (const s of item.subjects as string[]) subjects.push({ value: s, source });
        const byCategory = new Map<string, Set<string>>();
        for (const f of item.fields as Doc[]) byCategory.set(f.category, (byCategory.get(f.category) ?? new Set()).add(f.name));
        for (const [category, names] of byCategory) {
          personal.push({ value: [`${category}: ${[...names].sort(cmp).join(', ')}`], source, open: category === 'unknown' ? flag(place, 'personal-data', 'unknown') : null });
        }
      }
      for (const st of (d.storage as Doc[]).filter((x) => inScope(x.data))) {
        const open = !p.retention && st.retention.duration === 'unknown' ? flag(place, 'retention', `storage ${st.id}`) : null;
        storageRows.push({ value: [`${st.id} (${st.kind}): ${duration(st.retention)}`], source: src(m, st.source), open });
      }
      const wanted = (x: Doc): boolean => (recipients ? recipients.has(x.id) : x.data === undefined || inScope(x.data));
      const addProc = (pr: Doc): void => {
        const key = `${m.file}\u0000${pr.id}`;
        if (seenProcs.has(key)) return;
        seenProcs.add(key);
        procs.push({ m, pr });
      };
      for (const pr of (d.processors as Doc[]).filter(wanted)) addProc(pr);
      for (const fl of (d.outbound_flows as Doc[]).filter(wanted)) {
        // Linked by its `processor`, or, without one, by the same name and country (the v0.1 matching).
        const linked = (d.processors as Doc[]).find((x) => (fl.processor !== undefined ? x.id === fl.processor : x.name === fl.to.name && x.country === fl.to.country));
        if (linked) addProc(linked);
        flows.push({ m, fl, linked });
      }
    }

    // (d) Recipients
    const processorValue = (pr: Doc): Phrase => phrase(`${pr.name} (${pr.country}): `, word('dpa'), ` ${pr.dpa}`);
    const countryOf = (country: string): Phrase => (country === 'unknown' ? [word('countryUnknown')] : [country]);
    const recipientCands: PCand[] = [];
    const recipientNames: string[] = [];
    const recipients: RecipientModel[] = [];
    for (const { m, pr } of procs) {
      recipientCands.push({ value: processorValue(pr), source: src(m, pr.source), open: null });
      recipientNames.push(pr.name);
      recipients.push({
        kind: 'processor',
        name: pr.name,
        country: pr.country,
        service: m.label,
        processor: pr.id,
        flows: flows.filter((f) => f.m === m && f.linked === pr).map((f) => f.fl.id as string),
        dpa: pr.dpa ?? null,
        dpaRef: pr.dpa_ref ?? null,
        safeguard: pr.safeguard ?? null,
        transferOutsideEu: pr.transfer_outside_eu ?? null,
        source: src(m, pr.source),
      });
    }
    for (const { m, fl, linked } of flows) {
      if (linked || inside.has(fl.to.name)) continue;
      recipientCands.push({ value: phrase(`${fl.to.name} (`, countryOf(fl.to.country), ')'), source: src(m, fl.source), open: null });
      recipientNames.push(fl.to.name);
      recipients.push({
        kind: 'flow',
        name: fl.to.name,
        country: fl.to.country,
        service: m.label,
        processor: null,
        flows: [fl.id],
        dpa: null,
        dpaRef: null,
        safeguard: fl.safeguard ?? null,
        transferOutsideEu: null,
        source: src(m, fl.source),
      });
    }
    for (const r of (p.recipients as Doc[] | undefined) ?? []) {
      if (recipientNames.some((n) => r.name === n || r.name.startsWith(`${n} (`))) continue;
      recipientCands.push({ value: [r.name], source: processingSource(r.source), open: null });
      recipients.push({ kind: 'declared', name: r.name, country: null, service: null, processor: null, flows: [], dpa: null, dpaRef: null, safeguard: null, transferOutsideEu: null, source: processingSource(r.source) });
    }

    // (e) Transfers
    const transferCands: PCand[] = [];
    const transfer = (name: string, country: string, safeguard: string | undefined, source: string): void => {
      const fallback = word(country === 'unknown' ? 'destinationToAssess' : 'safeguardNotDeclared');
      const open = safeguard === undefined ? flag(place, 'transfer-safeguards', `${name} (${country})`) : null;
      transferCands.push({ value: phrase(`${name} (`, countryOf(country), '): ', safeguard ?? fallback), source, open });
    };
    for (const { m, pr } of procs) if (pr.transfer_outside_eu === true) transfer(pr.name, pr.country, pr.safeguard, src(m, pr.source));
    for (const { m, fl, linked: x } of flows) {
      if (x) {
        if (x.transfer_outside_eu === true || !EU_EEA.has(x.country)) {
          transfer(x.name, x.country, fl.safeguard ?? x.safeguard, fl.safeguard !== undefined ? src(m, fl.source) : src(m, x.source));
        }
      } else if (fl.to.country === 'unknown' || !EU_EEA.has(fl.to.country)) {
        transfer(fl.to.name, fl.to.country, fl.safeguard, src(m, fl.source));
      }
    }

    // (f) Erasure time limits
    let erasure: ValueRow[];
    let erasureOrder: ItemRows<Art30Key>['order'] = 'as-is';
    if (p.retention) {
      const open = p.retention.duration === 'unknown' ? flag(place, 'retention', 'processing') : null;
      erasure = [{ value: [duration(p.retention)], source: processingSource(p.retention.source), open }];
    } else if (storageRows.length > 0) {
      erasure = compositeP(storageRows);
      erasureOrder = 'composite';
    } else erasure = [placeholder(TC, flag(place, 'retention', 'processing'))];

    // (g) Security measures
    const security = atomic(((p.security_measures as Doc[] | undefined) ?? []).map((s) => ({ value: s.measure, source: processingSource(s.source) })));
    const securityOpen = security.length === 0 ? flag(place, 'security-measures', 'processing') : null;

    const personalRows = compositeP(personal);
    const personalOpen = personalRows.length === 0 ? flag(place, 'personal-data', 'To complete') : null;
    const recipientRows = atomicP(recipientCands);
    const transferRows = atomicP(transferCands);

    const fromCands = (cands: Cand[]): ValueRow[] => cands.map((c) => ({ value: [c.value], source: c.source, open: null }));
    const art30: ItemRows<Art30Key>[] = [
      { item: 'controller', values: [controller], order: 'as-is' },
      { item: 'joint-controller', values: joint, order: 'sorted' },
      { item: 'representative', values: [orgRow(orgRepresentative, orgRepresentativeOpen)], order: 'as-is' },
      { item: 'dpo', values: [dpo], order: 'as-is' },
      { item: 'purposes', values: [{ value: [p.purpose], source: processingSource(p.source), open: null }], order: 'as-is' },
      { item: 'data-subjects', values: fromCands(atomic(subjects)), order: 'atomic' },
      { item: 'personal-data', values: personalRows.length > 0 ? personalRows : [placeholder(TC, personalOpen)], order: 'composite' },
      { item: 'recipients', values: recipientRows.length > 0 ? recipientRows : [placeholder([word('noneFound')])], order: 'atomic' },
      { item: 'transfers', values: transferRows.length > 0 ? transferRows : [placeholder([word('noneFound')])], order: 'atomic' },
      { item: 'erasure-time-limits', values: erasure, order: erasureOrder },
      { item: 'security-measures', values: security.length > 0 ? fromCands(security) : [placeholder(TC, securityOpen)], order: 'atomic' },
    ];

    // DPO checks
    const basis = p.legal_basis as string;
    const detail = p.legal_basis_detail as Doc | undefined;
    let basisDetail: ValueRow[];
    if (basis === 'not-applicable') basisDetail = [placeholder([word('notExpected')])];
    else {
      const parts: [WordKey, string][] | undefined =
        basis === 'legitimate-interests'
          ? detail?.balancing_test && [
              ['interest', detail.balancing_test.interest],
              ['necessity', detail.balancing_test.necessity],
              ['impact', detail.balancing_test.impact],
              ['safeguards', detail.balancing_test.safeguards],
            ]
          : basis === 'consent'
            ? detail?.consent && [
                ['collection', detail.consent.collection],
                ['withdrawal', detail.consent.withdrawal],
              ]
            : detail?.reference !== undefined
              ? [['reference', detail.reference]]
              : undefined;
      const open = !parts || parts.some(([, text]) => isPlaceholder(text)) ? flag(place, 'legal-basis-detail', 'processing') : null;
      basisDetail = parts
        ? parts.map(([label, text]) => ({ value: phrase(word(label), ': ', fill(text)), source: P, open: isPlaceholder(text) ? open : null }))
        : [placeholder(TC, open)];
    }

    const dpia = p.dpia as Doc | undefined;
    let dpiaRow: ValueRow;
    if (!dpia) dpiaRow = placeholder(TC, flag(place, 'dpia', 'processing'));
    else {
      const value = phrase(word('required'), `: ${dpia.required}`);
      if (dpia.criteria !== undefined) value.push(...phrase('; ', word('criteria'), ': ', dpia.criteria.length > 0 ? [[...dpia.criteria].sort(cmp).join(', ')] : [word('none')]));
      if (dpia.ref !== undefined) value.push(...phrase('; ', word('reference'), ': ', fill(dpia.ref)));
      else if (dpia.required === 'yes') value.push(...phrase('; ', word('reference'), ': ', TC));
      const open = dpia.required === 'to-assess' || (dpia.required === 'yes' && (dpia.ref === undefined || isPlaceholder(dpia.ref))) ? flag(place, 'dpia', 'processing') : null;
      dpiaRow = { value: phrase(value), source: P, open };
    }

    let information: ValueRow[];
    if (!p.information) information = [placeholder(TC, flag(place, 'information', 'processing'))];
    else {
      const opened = new Set<string>();
      const rows = atomic(
        notices.get(p)!.map(({ m, notice }) => {
          const value = `${notice.kind}: ${notice.ref} (${m.label})`;
          if (notice.kind === 'none') {
            flag(place, 'information', `${m.label}/${notice.id}`);
            opened.add(value);
          }
          return { value, source: src(m, notice.source) };
        }),
      );
      information = rows.map((c) => ({ value: [c.value], source: c.source, open: opened.has(c.value) ? 'information' : null }));
      if (p.information.text !== undefined) information.push({ value: [p.information.text], source: P, open: null });
    }

    const sensitive = p.sensitive_data as string | string[] | undefined;
    const sensitiveOpen = sensitive === undefined || sensitive === 'to-assess' ? flag(place, 'sensitive-data', 'processing') : null;
    const sensitiveRow: ValueRow =
      sensitive === undefined ? placeholder(TC, sensitiveOpen) : { value: [typeof sensitive === 'string' ? sensitive : [...sensitive].sort(cmp).join(', ')], source: P, open: sensitiveOpen };

    const contracts = atomicP(
      procs.map(({ m, pr }) => ({
        value: phrase(processorValue(pr), pr.dpa_ref !== undefined ? ` (${pr.dpa_ref})` : ''),
        source: src(m, pr.source),
        open: pr.dpa === 'no' || pr.dpa === 'unknown' ? flag(place, 'processor-contracts', `${pr.name} (${pr.country})`) : null,
      })),
    );

    const checks: ItemRows<CheckKey>[] = [
      { item: 'legal-basis', values: [{ value: [basis], source: P, open: null }], order: 'as-is' },
      { item: 'legal-basis-detail', values: basisDetail, order: 'as-is' },
      { item: 'dpia', values: [dpiaRow], order: 'as-is' },
      { item: 'information', values: information, order: 'as-is' },
      { item: 'sensitive-data', values: [sensitiveRow], order: 'as-is' },
      { item: 'processor-contracts', values: contracts.length > 0 ? contracts : [placeholder([word('noneFound')])], order: 'atomic' },
    ];

    return {
      id: p.id as string,
      name: p.name as string,
      legalBasis: basis,
      art30,
      checks,
      openItems: [],
      recipients,
      review: (p.review as Doc | undefined) ?? null,
      services: list.map((e) => ({
        repo: e.m.repo ?? null,
        tool: e.m.repo === undefined ? e.m.label : null,
        data: [...e.scope].sort(cmp),
        recipients: e.recipients ? [...e.recipients].sort(cmp) : null,
      })),
    };
  });

  // ---------- AI features ----------

  const aiFeatures: AiFeatureModel[] = [...referenced]
    .flatMap((m) =>
      ((m.doc.ai_features as Doc[] | undefined) ?? []).map((f) => {
        const subject = `${m.label}/${f.id}`;
        const open = new Set<ActionId>();
        if (f.role === undefined || f.role === 'to-assess') open.add(flag(AI_FEATURES, 'ai-classification', `${subject} role`));
        if (f.risk === undefined || f.risk.level === 'to-assess' || f.risk.level === 'prohibited') open.add(flag(AI_FEATURES, 'ai-classification', `${subject} risk`));
        const listed = (f.obligations as Doc[] | undefined) ?? [];
        const obligations: AiObligation[] = listed.map((o) => {
          if (o.status === 'open') open.add(flag(AI_FEATURES, 'ai-obligations', `${subject} ${o.id}`));
          return { id: o.id as string, status: o.status as string, ref: (o.ref as string | undefined) ?? null };
        });
        for (const id of expectedObligations(f)) {
          if (listed.some((o) => o.id === id)) continue;
          open.add(flag(AI_FEATURES, 'ai-obligations', `${subject} ${id}`));
          obligations.push({ id, status: null, ref: null });
        }
        return {
          service: m.label,
          id: f.id as string,
          description: f.description as string,
          role: (f.role as string | undefined) ?? null,
          risk: f.risk ? { level: f.risk.level as string, reason: (f.risk.reason as string | undefined) ?? null } : null,
          obligations: obligations.sort((a, b) => cmp(a.id, b.id)),
          open: [...open],
          source: src(m, f.source),
        };
      }),
    )
    .sort((a, b) => cmp(a.service, b.service) || cmp(a.id, b.id));

  // ---------- Outside the register ----------

  const outside: OutsideModel[] = [];
  for (const m of all) {
    const s = m.doc.service as Doc;
    const components = (s.components as Doc[] | undefined) ?? [];
    const items = m.doc.personal_data as Doc[];
    const row = (service: string, component: string | null, controller: string, data: Doc[]): void => {
      const open = s.controller_rationale === undefined ? flag(OUTSIDE, 'controller-rationale', m.label) : null;
      outside.push({
        service,
        component,
        controller,
        rationale: (s.controller_rationale as string | undefined) ?? null,
        privacyByDesign: s.privacy_by_design ? [...(s.privacy_by_design as string[])].sort(cmp) : null,
        data: [...data].sort((a, b) => cmp(a.id, b.id)).map((d) => ({ id: d.id as string, categories: [...new Set((d.fields as Doc[]).map((f) => f.category as string))].sort(cmp) })),
        open,
        source: src(m, s.source),
      });
    };
    if (s.controller !== 'organisation') {
      const own = new Set(components.filter((c) => c.controller === undefined || c.controller === s.controller).map((c) => c.id));
      row(m.label, null, s.controller, items.filter((d) => d.component === undefined || own.has(d.component)));
    }
    for (const c of components) {
      if (c.controller === undefined || c.controller === 'organisation' || c.controller === s.controller) continue;
      row(`${m.label}/${c.id}`, c.id, c.controller, items.filter((d) => d.component === c.id));
    }
  }
  outside.sort((a, b) => cmp(a.service, b.service));

  // ---------- actions ----------

  for (const x of opens.values()) {
    sections.find((s) => s.id === x.place)?.openItems.push({ kind: x.kind, subject: x.subject });
  }
  const order = [ORGANISATION, ...processings.map((p) => p.id as string), AI_FEATURES, OUTSIDE];
  const byKind = new Map<ActionId, { count: number; places: Set<string> }>();
  for (const { place, kind } of opens.values()) {
    const a = byKind.get(kind) ?? { count: 0, places: new Set<string>() };
    a.count += 1;
    a.places.add(place);
    byKind.set(kind, a);
  }
  const actions: ModelAction[] = [...byKind]
    .map(([id, a]) => ({ id, role: ACTIONS[id].role as Role, count: a.count, places: order.filter((pl) => a.places.has(pl)).map(toPlace) }))
    .sort((a, b) => ROLES[a.role].order - ROLES[b.role].order || b.count - a.count || cmp(a.id, b.id));

  /** The facts of a manifest as written; a field the manifest (v0.1 or v0.2) does not have is null or []. */
  const facts = (m: Labelled): ServiceFacts => {
    const service = m.doc.service as Doc;
    const items = (value: unknown): Doc[] => (value as Doc[] | undefined) ?? [];
    const orNull = (value: unknown): string | null => (value as string | undefined) ?? null;
    return {
      fullName: orNull(service.repo),
      description: service.description as string,
      controller: service.controller as string,
      components: items(service.components).map((c) => ({
        id: c.id as string,
        kind: c.kind as string,
        controller: orNull(c.controller),
        effectiveController: (c.controller as string | undefined) ?? (service.controller as string),
      })),
      notices: items(m.doc.notices).map((n) => ({ id: n.id as string, component: orNull(n.component), kind: n.kind as string, ref: n.ref as string, source: src(m, n.source) })),
      personalData: items(m.doc.personal_data).map((d) => ({
        id: d.id as string,
        component: orNull(d.component),
        subjects: [...(d.subjects as string[])],
        purpose: d.purpose as string,
        legalBasis: orNull(d.legal_basis),
        fields: items(d.fields).map((f) => ({ name: f.name as string, category: f.category as string })),
        source: src(m, d.source),
      })),
      storage: items(m.doc.storage).map((s) => ({
        id: s.id as string,
        component: orNull(s.component),
        kind: s.kind as string,
        location: s.location as string,
        data: [...((s.data as string[] | undefined) ?? [])],
        retention: s.retention ? { duration: s.retention.duration as string, trigger: orNull(s.retention.trigger) } : null,
        source: src(m, s.source),
      })),
    };
  };

  const services: ServiceModel[] = all
    .filter((m) => m.repo !== undefined)
    .map((m) => {
      const sync = syncs.get(m.repo!)!;
      return { repo: m.repo!, name: m.doc.service.name as string, sha: sync.sha as string, receivedAt: sync.received_at as string, lag: sync.lag as Doc, ...facts(m) };
    });
  const declaredTools: ToolModel[] = tools.map((t) => {
    const m = manifests.get(t.path as string)!;
    return { id: t.id as string, name: m.doc.service.name as string, path: t.path as string, ...facts(m) };
  });

  return {
    specVersion: DOSSIER_VERSION,
    organisation: { name: org.name as string, language: (org.language as string | undefined) ?? null, rows: organisationRows },
    anchors,
    services,
    tools: declaredTools,
    openItems: opens.size,
    actions,
    processings: sections,
    aiFeatures,
    outside,
    actionsFile,
  };
}

// ---------- render ----------

/** The rows of one item in a language: translated, then merged and sorted again as `order` says, the label on the first row. */
function renderItem(label: string, group: ItemRows<string>, language: Language): Context[] {
  let rows: Cand[] = group.values.map((v) => ({ value: renderPhrase(v.value, language), source: v.source ?? NO_SOURCE }));
  if (group.order === 'atomic') rows = atomic(rows);
  else if (group.order === 'composite') rows = composite(rows);
  else if (group.order === 'sorted') rows = [...rows].sort((a, b) => cmp(a.value, b.value));
  return rows.map((r, i) => ({ item: cell(i === 0 ? label : ''), value: cell(r.value), source: cell(r.source) }));
}

/** The markdown of the dossier in a language, from its model. Pure: the same model, date and language give the same bytes. */
export function renderDossier(model: DossierModel, generatedAt: string, language: Language): string {
  if (!LANGUAGES.includes(language)) throw new ComplianceError(`Unknown language "${language}". Use ${LANGUAGES.join(' or ')}.`);
  const anchorErrors = validateDocument('anchors', { spec_version: DOSSIER_VERSION, generated_at: generatedAt, repos: Object.fromEntries(Object.entries(model.anchors).map(([k, sha]) => [k, { sha }])) });
  if (anchorErrors.length > 0) throw new ComplianceError(`generated_at "${generatedAt}" is not usable: ${anchorErrors[0].instancePath}: ${anchorErrors[0].message}.`);

  const W = WORDS[language];
  const L = ITEM_LABELS[language];
  const TC = W.toComplete;
  const placeLabel = (place: Place): string => (place.kind === 'processing' ? place.id : L.places[place.kind]);

  let template = TEMPLATE_FILES[TEMPLATES[language]];
  // With no anchor, `anchors: {}` takes the place of the block.
  if (Object.keys(model.anchors).length === 0) template = template.replace(/^anchors:\n\{\{#each anchors\}\}\n[\s\S]*?\{\{\/each\}\}\n/m, 'anchors: {}\n');
  return renderTemplate(template, {
    spec_version: DOSSIER_VERSION,
    language,
    generated_at: generatedAt,
    open_items: String(model.openItems),
    action_count: String(model.actions.length),
    anchors: Object.entries(model.anchors).map(([repo, sha]) => ({ repo, sha })),
    organisation: cell(model.organisation.name),
    organisation_rows: model.organisation.rows.flatMap((r) => renderItem(L.organisation[r.key], { item: r.key, values: [r], order: 'as-is' }, language)),
    actions_summary: actionsSummary(model.openItems, model.actions.length, language),
    actions: model.actions.map((a) => ({ id: a.id, label: cell(ACTIONS[a.id][language]), role: cell(ROLES[a.role][language]), count: String(a.count), where: cell(a.places.map(placeLabel).join(', ')) })),
    processings: model.processings.map((x) => ({
      id: cell(x.id),
      name: cell(x.name),
      rows: x.art30.flatMap((g) => renderItem(L.art30[g.item], g, language)),
      checks: x.checks.flatMap((g) => renderItem(L.checks[g.item], g, language)),
    })),
    ai_summary: aiSummary(model.aiFeatures.length, language),
    ai_features: model.aiFeatures.map((f) => ({
      service: cell(f.service),
      feature: cell(`${f.id}: ${f.description}`),
      role: cell(f.role ?? TC),
      risk: cell(f.risk ? (f.risk.reason !== null ? `${f.risk.level}: ${f.risk.reason}` : f.risk.level) : TC),
      obligations: cell(f.obligations.map((o) => (o.status === null ? `${o.id}: ${TC}` : `${o.id}: ${o.status}${o.ref !== null ? ` (${o.ref})` : ''}`)).join('; ')),
      source: cell(f.source),
    })),
    outside_summary: outsideSummary(model.outside.length, language),
    outside: model.outside.map((r) => ({
      service: cell(r.service),
      controller: cell(r.controller),
      rationale: cell(r.rationale ?? TC),
      privacy_by_design: cell(r.privacyByDesign ? r.privacyByDesign.join('; ') : W.noneFound),
      personal_data: cell(r.data.length > 0 ? r.data.map((d) => `${d.id} (${d.categories.join(', ')})`).join('; ') : W.noneFound),
      source: cell(r.source),
    })),
  });
}

export interface DossierAction {
  id: ActionId;
  role: Role;
  count: number;
}

export interface Dossier {
  markdown: string;
  /** Repo name to the full sha of its sync.yaml, sorted by repo name. */
  anchors: Record<string, string>;
  openItems: number;
  /** In the order of the Actions table. */
  actions: DossierAction[];
}

/** Builds the v0.2 dossier of a tree: its model, rendered in `language`. Does not read actions.yaml. */
export function buildDossier(tree: ComplianceTree, generatedAt: string, language: Language): Dossier {
  const model = buildDossierModel(tree, { actionsFile: false });
  const markdown = renderDossier(model, generatedAt, language);
  return { markdown, anchors: model.anchors, openItems: model.openItems, actions: model.actions.map(({ id, role, count }) => ({ id, role, count })) };
}

/** The input when given, else organisation.language of compliance.yaml (v0.2.1), else `en`. */
export function dossierLanguage(tree: ComplianceTree, input?: string): Language {
  if (input) return input as Language;
  const declared = (readDoc(tree, 'compliance.yaml', 'compliance').organisation as Doc | undefined)?.language;
  return LANGUAGES.includes(declared as Language) ? (declared as Language) : 'en';
}
