import { ComplianceError } from './errors.js';
import { TEMPLATE_FILES } from './generated/spec.js';
import { EU_EEA, atomic, cell, cmp, composite, duration, isPlaceholder, processingSource, readDoc, renderTemplate, } from './register.js';
import { validateDocument, versionOf } from './schema.js';
// The v0.2 compliance dossier: the rules are in templates/register/README.md of the spec, part "v0.2: the compliance dossier".
// Two steps: buildDossierModel reads the tree into a structured, language-neutral model (stable keys, no translated text,
// open items flagged where each value is built); renderDossier turns the model into the markdown of one language.
export const DOSSIER_VERSION = '0.2';
const TEMPLATES = { en: 'register.en.md.tmpl', fr: 'register.fr.md.tmpl' };
export const LANGUAGES = ['en', 'fr'];
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
};
export const ORGANISATION_KEYS = ['controller', 'dpo', 'representative', 'privacy-contact'];
/** The items of GDPR Art. 30(1), in the order of the dossier. */
export const ART30_KEYS = ['controller', 'joint-controller', 'representative', 'dpo', 'purposes', 'data-subjects', 'personal-data', 'recipients', 'transfers', 'erasure-time-limits', 'security-measures'];
/** The DPO checks, in the order of the dossier. */
export const CHECK_KEYS = ['legal-basis', 'legal-basis-detail', 'dpia', 'information', 'sensitive-data', 'processor-contracts'];
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
};
/** The roles of the Actions table, in their order, with their labels. */
export const ROLES = {
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
};
export const ACTION_IDS = Object.keys(ACTIONS);
export const actionLabel = (id, language) => ACTIONS[id][language];
export const roleLabel = (role, language) => ROLES[role][language];
/** `<N>(s)`: English singular for 1, French singular for 0 and 1. */
const plural = (n, language, one, many) => ((language === 'fr' ? n <= 1 : n === 1) ? one : many);
export function actionsSummary(openItems, actions, language) {
    if (openItems === 0)
        return language === 'fr' ? 'Aucun point ouvert.' : 'No open item.';
    if (language === 'fr') {
        return `${openItems} ${plural(openItems, language, 'point ouvert', 'points ouverts')}, ${plural(openItems, language, 'fermé', 'fermés')} par ${actions} ${plural(actions, language, 'action', 'actions')}.`;
    }
    return `${openItems} open ${plural(openItems, language, 'item', 'items')}, closed by ${actions} ${plural(actions, language, 'action', 'actions')}.`;
}
function aiSummary(k, language) {
    if (language === 'fr')
        return k === 0 ? "Aucune fonctionnalité d'IA dans les services des traitements." : `${k} ${plural(k, language, 'fonctionnalité', 'fonctionnalités')} d'IA dans les services des traitements.`;
    return k === 0 ? 'No AI feature in the services of the processing activities.' : `${k} AI ${plural(k, language, 'feature', 'features')} in the services of the processing activities.`;
}
function outsideSummary(k, language) {
    if (language === 'fr') {
        return k === 0
            ? "Tous les services et composants ont l'organisation pour responsable."
            : `${k} ${plural(k, language, 'service', 'services')} ou ${plural(k, language, 'composant', 'composants')} dont le responsable n'est pas l'organisation seule.`;
    }
    return k === 0
        ? 'Every service and component is controlled by the organisation.'
        : `${k} ${plural(k, language, 'service', 'services')} or ${plural(k, language, 'component', 'components')} whose controller is not the organisation alone.`;
}
/** Builds a phrase, merging adjacent texts so that two equal phrases have the same segments. */
function phrase(...parts) {
    const out = [];
    for (const part of parts.flat()) {
        if (typeof part === 'string') {
            if (part === '')
                continue;
            if (typeof out[out.length - 1] === 'string')
                out[out.length - 1] = out[out.length - 1] + part;
            else
                out.push(part);
        }
        else
            out.push(part);
    }
    return out;
}
const word = (key) => ({ word: key });
const joinPhrases = (list, separator) => phrase(...list.flatMap((p, i) => (i === 0 ? [p] : [separator, p])));
const phraseKey = (p) => JSON.stringify(p);
/** The text of a phrase in a language. */
export function renderPhrase(p, language) {
    return p.map((s) => (typeof s === 'string' ? s : WORDS[language][s.word])).join('');
}
// ---------- AI Act ----------
const HIGH_RISK = ['art9-risk-management', 'art10-data-governance', 'art11-technical-documentation', 'art12-logging', 'art13-transparency', 'art14-human-oversight', 'art15-accuracy-robustness'];
/** The obligations the dossier expects of a feature (spec/manifest.md, ai_features). */
function expectedObligations(f) {
    const out = ['art4-ai-literacy'];
    if (f.interacts_with_persons === true)
        out.push('art50-interaction');
    if (f.generates_content === true)
        out.push('art50-synthetic-content');
    if (f.risk?.level === 'high') {
        out.push(...HIGH_RISK);
        if (f.role === 'deployer')
            out.push('art26-deployer-duties', 'art27-fria');
    }
    return out;
}
/** Places of the open items that are not a processing (a processing is its id, which cannot start with `#`). */
const ORGANISATION = '#organisation';
const AI_FEATURES = '#ai';
const OUTSIDE = '#outside';
const toPlace = (place) => place === ORGANISATION ? { kind: 'organisation' } : place === AI_FEATURES ? { kind: 'ai' } : place === OUTSIDE ? { kind: 'outside' } : { kind: 'processing', id: place };
/** One row per value; the source is the strongest. Sorted by the English text. */
function atomicP(cands) {
    const byKey = new Map();
    for (const c of cands)
        byKey.set(phraseKey(c.value), [...(byKey.get(phraseKey(c.value)) ?? []), c]);
    const rows = [...byKey.values()].map((group) => {
        const best = atomic(group.map((c) => ({ value: '', source: c.source })))[0].source;
        // The value is open when any of its candidates is.
        return { value: group[0].value, source: best, open: group.find((c) => c.open !== null)?.open ?? null };
    });
    return rows.sort((a, b) => cmp(renderPhrase(a.value, 'en'), renderPhrase(b.value, 'en')));
}
/** One row per value and source, sorted by the English text then the source. */
function compositeP(cands) {
    const seen = new Set();
    return cands
        .filter((c) => {
        const key = `${phraseKey(c.value)}\u0000${c.source}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .sort((a, b) => cmp(renderPhrase(a.value, 'en'), renderPhrase(b.value, 'en')) || cmp(a.source, b.source));
}
/** Builds the structured model of the v0.2 dossier from a tree of a v0.2 compliance repo. Pure: reads the tree, never the clock. */
export function buildDossierModel(tree, options = {}) {
    const TC = [word('toComplete')];
    const fill = (value) => (isPlaceholder(value) ? TC : [value]);
    const compliance = readDoc(tree, 'compliance.yaml', 'compliance');
    if (versionOf(compliance) !== DOSSIER_VERSION)
        throw new ComplianceError(`compliance.yaml is spec_version "${compliance.spec_version}": the dossier needs "${DOSSIER_VERSION}".`);
    const org = compliance.organisation;
    const repos = compliance.repos;
    const tools = compliance.declared_tools ?? [];
    // Repos and tools share one namespace in the dossier (labels, open item subjects): a clash would merge two open items into one.
    for (const t of tools) {
        if (repos.some((r) => r.name === t.id))
            throw new ComplianceError(`compliance.yaml: "${t.id}" is both a repo and a declared tool. Rename one. Nothing was generated.`);
    }
    // ---------- loading ----------
    const manifests = new Map();
    const syncs = new Map();
    const loadRepo = (repo, who) => {
        if (!repos.some((r) => r.name === repo))
            throw new ComplianceError(`${who}: repo "${repo}" is not listed in compliance.yaml.`);
        if (repo === '.' || repo === '..')
            throw new ComplianceError(`${who}: "${repo}" is not a repo name.`);
        const file = `services/${repo}/manifest.yaml`;
        const known = manifests.get(file);
        if (known)
            return known;
        const doc = readDoc(tree, file, 'manifest');
        const sync = readDoc(tree, `services/${repo}/sync.yaml`, 'sync');
        const m = { file, doc, repo, sha: sync.sha, sha7: sync.sha.slice(0, 7), label: repo };
        manifests.set(file, m);
        syncs.set(repo, sync);
        return m;
    };
    const loadTool = (tool, who) => {
        const entry = tools.find((t) => t.id === tool);
        if (!entry)
            throw new ComplianceError(`${who}: tool "${tool}" is not listed in declared_tools of compliance.yaml.`);
        const known = manifests.get(entry.path);
        if (known)
            return known;
        const m = { file: entry.path, doc: readDoc(tree, entry.path, 'manifest'), label: tool };
        manifests.set(entry.path, m);
        return m;
    };
    const loadEntry = (e, who) => (e.repo !== undefined ? loadRepo(e.repo, who) : loadTool(e.tool, who));
    // Every manifest of the compliance repo: the repos that have a services/<repo>/ folder, then the declared tools.
    const all = [];
    for (const r of repos) {
        if (r.name === '.' || r.name === '..')
            throw new ComplianceError(`compliance.yaml: "${r.name}" is not a repo name.`);
        if (tree.has(`services/${r.name}`))
            all.push(loadRepo(r.name, 'compliance.yaml'));
    }
    for (const t of tools)
        all.push(loadTool(t.id, 'compliance.yaml'));
    const inside = new Set(all.map((m) => m.doc.service.name));
    const anchors = Object.fromEntries(all.filter((m) => m.repo !== undefined).map((m) => [m.repo, m.sha]).sort(([a], [b]) => cmp(a, b)));
    const processings = tree
        .listDirs('processings')
        .filter((d) => tree.has(`processings/${d}/processing.yaml`))
        .map((d) => readDoc(tree, `processings/${d}/processing.yaml`, 'processing'))
        .sort((a, b) => cmp(a.id, b.id));
    for (let i = 1; i < processings.length; i++) {
        if (processings[i].id === processings[i - 1].id)
            throw new ComplianceError(`Two processings have the id "${processings[i].id}".`);
    }
    const entries = new Map();
    const notices = new Map();
    const referenced = new Set();
    for (const p of processings) {
        const who = `processings/${p.id}`;
        entries.set(p, p.services.map((entry) => {
            const m = loadEntry(entry, who);
            referenced.add(m);
            const ids = new Set(m.doc.personal_data.map((d) => d.id));
            for (const id of entry.data ?? []) {
                if (!ids.has(id))
                    throw new ComplianceError(`${who}: no personal_data "${id}" in ${m.file}.`);
            }
            const recipientIds = new Set([...m.doc.processors, ...m.doc.outbound_flows].map((x) => x.id));
            for (const id of entry.recipients ?? []) {
                if (!recipientIds.has(id))
                    throw new ComplianceError(`${who}: no processor or outbound flow "${id}" in ${m.file}.`);
            }
            return { m, scope: entry.data ? new Set(entry.data) : ids, recipients: entry.recipients ? new Set(entry.recipients) : undefined };
        }));
        notices.set(p, (p.information?.notices ?? []).map((ref) => {
            const m = loadEntry(ref, `${who} (information)`);
            const notice = (m.doc.notices ?? []).find((n) => n.id === ref.id);
            if (!notice)
                throw new ComplianceError(`${who} (information): no notice "${ref.id}" in ${m.file}.`);
            return { m, notice };
        }));
    }
    const actionsFile = options.actionsFile !== false && tree.has('actions.yaml') ? readDoc(tree, 'actions.yaml', 'actions') : null;
    // ---------- open items ----------
    /** Place, kind and subject: an open item found twice in one place is one open item. */
    const opens = new Map();
    const flag = (place, kind, subject) => {
        opens.set(`${place}\u0000${kind}\u0000${subject}`, { place, kind, subject });
        return kind;
    };
    const src = (m, s) => {
        if (s.kind === 'spec')
            return `spec: ${s.ref}`;
        if (s.kind === 'code' && m.repo !== undefined)
            return `code: ${m.repo}@${m.sha7}:${s.ref}`;
        return `declared: ${m.file} (${s.ref})`;
    };
    /** A value with no source is a placeholder: its source is null (`—`). */
    const placeholder = (value, open = null) => ({ value, source: null, open });
    // ---------- Organisation ----------
    const orgRow = (value, open) => (value === undefined ? placeholder(TC, open) : { value, source: FROM_COMPLIANCE, open });
    const oc = org.controller;
    const orgController = oc
        ? joinPhrases([oc.legal_name, oc.address, oc.registration, oc.contact].filter((x) => x !== undefined).map(fill), ', ')
        : undefined;
    const orgControllerOpen = !oc || [oc.legal_name, oc.address, oc.registration, oc.contact].some((x) => x !== undefined && isPlaceholder(x));
    const od = org.dpo;
    let orgDpo;
    let orgDpoOpen = false;
    if (!od || od.designated === 'unknown')
        orgDpoOpen = true;
    else if (od.designated === true) {
        orgDpo = phrase(fill(od.name), ', ', fill(od.contact));
        orgDpoOpen = isPlaceholder(od.name) || isPlaceholder(od.contact);
    }
    else
        orgDpo = phrase(word('notDesignated'), `: ${od.reason}`);
    const or = org.representative;
    let orgRepresentative;
    let orgRepresentativeOpen = null;
    if (!or || or.required === 'unknown')
        orgRepresentativeOpen = flag(ORGANISATION, 'organisation-representative', 'representative');
    else if (or.required === true) {
        orgRepresentative = phrase(fill(or.name), ', ', fill(or.contact));
        if (isPlaceholder(or.name) || isPlaceholder(or.contact))
            orgRepresentativeOpen = flag(ORGANISATION, 'organisation-representative', 'representative');
    }
    else
        orgRepresentative = or.reason !== undefined ? phrase(word('notRequired'), `: ${or.reason}`) : [word('notRequired')];
    const controllerOpen = orgControllerOpen ? 'organisation-identity' : null;
    const dpoOpen = orgDpoOpen ? 'organisation-dpo' : null;
    // A privacy contact written `to complete` is the placeholder itself: it has no source.
    const privacy = org.privacy_contact;
    const organisationRows = [
        ['controller', orgRow(orgController, controllerOpen)],
        ['dpo', orgRow(orgDpo, dpoOpen)],
        ['representative', orgRow(orgRepresentative, orgRepresentativeOpen)],
        ['privacy-contact', privacy === undefined || isPlaceholder(privacy) ? placeholder(TC) : orgRow([privacy], null)],
    ].map(([key, v]) => ({ key, ...v }));
    // ---------- processings ----------
    const sections = processings.map((p) => {
        const place = p.id;
        const P = `declared: ${p.source.ref}`;
        const list = entries.get(p);
        // (a)
        let controller;
        if (p.controller) {
            const open = isPlaceholder(p.controller.name) || isPlaceholder(p.controller.contact) ? flag(place, 'organisation-identity', 'controller') : null;
            controller = { value: phrase(fill(p.controller.name), ', ', fill(p.controller.contact)), source: P, open };
        }
        else {
            controller = orgRow(orgController, orgControllerOpen ? flag(place, 'organisation-identity', 'controller') : null);
        }
        let joint;
        const jc = p.joint_controllers;
        if (jc === undefined)
            joint = [placeholder(TC, flag(place, 'joint-controllers', 'joint controllers'))];
        else if (jc.length === 0)
            joint = [{ value: [word('none')], source: P, open: null }];
        else {
            joint = jc
                .map((j) => ({
                value: phrase(fill(j.name), ', ', fill(j.contact), ' (', word('arrangement'), ': ', fill(j.arrangement), ')'),
                source: P,
                open: [j.name, j.contact, j.arrangement].some(isPlaceholder) ? flag(place, 'joint-controllers', 'joint controllers') : null,
            }))
                .sort((a, b) => cmp(renderPhrase(a.value, 'en'), renderPhrase(b.value, 'en')));
        }
        let dpo;
        if (p.dpo) {
            const open = isPlaceholder(p.dpo.name) || isPlaceholder(p.dpo.contact) ? flag(place, 'organisation-dpo', 'dpo') : null;
            dpo = { value: phrase(fill(p.dpo.name), ', ', fill(p.dpo.contact)), source: P, open };
        }
        else {
            dpo = orgRow(orgDpo, orgDpoOpen ? flag(place, 'organisation-dpo', 'dpo') : null);
        }
        // (c), (f), and the processors and flows of (d) and (e)
        const subjects = p.data_subjects.map((value) => ({ value, source: processingSource(p.source) }));
        const personal = [];
        const storageRows = [];
        const procs = [];
        const flows = [];
        const seenProcs = new Set();
        for (const { m, scope, recipients } of list) {
            const d = m.doc;
            const inScope = (data) => (data ?? []).some((id) => scope.has(id));
            for (const item of d.personal_data.filter((x) => scope.has(x.id))) {
                const source = src(m, item.source);
                for (const s of item.subjects)
                    subjects.push({ value: s, source });
                const byCategory = new Map();
                for (const f of item.fields)
                    byCategory.set(f.category, (byCategory.get(f.category) ?? new Set()).add(f.name));
                for (const [category, names] of byCategory) {
                    personal.push({ value: [`${category}: ${[...names].sort(cmp).join(', ')}`], source, open: category === 'unknown' ? flag(place, 'personal-data', 'unknown') : null });
                }
            }
            for (const st of d.storage.filter((x) => inScope(x.data))) {
                const open = !p.retention && st.retention.duration === 'unknown' ? flag(place, 'retention', `storage ${st.id}`) : null;
                storageRows.push({ value: [`${st.id} (${st.kind}): ${duration(st.retention)}`], source: src(m, st.source), open });
            }
            const wanted = (x) => (recipients ? recipients.has(x.id) : x.data === undefined || inScope(x.data));
            const addProc = (pr) => {
                const key = `${m.file}\u0000${pr.id}`;
                if (seenProcs.has(key))
                    return;
                seenProcs.add(key);
                procs.push({ m, pr });
            };
            for (const pr of d.processors.filter(wanted))
                addProc(pr);
            for (const fl of d.outbound_flows.filter(wanted)) {
                // Linked by its `processor`, or, without one, by the same name and country (the v0.1 matching).
                const linked = d.processors.find((x) => (fl.processor !== undefined ? x.id === fl.processor : x.name === fl.to.name && x.country === fl.to.country));
                if (linked)
                    addProc(linked);
                flows.push({ m, fl, linked });
            }
        }
        // (d) Recipients
        const processorValue = (pr) => phrase(`${pr.name} (${pr.country}): `, word('dpa'), ` ${pr.dpa}`);
        const countryOf = (country) => (country === 'unknown' ? [word('countryUnknown')] : [country]);
        const recipientCands = [];
        const recipientNames = [];
        const recipients = [];
        for (const { m, pr } of procs) {
            recipientCands.push({ value: processorValue(pr), source: src(m, pr.source), open: null });
            recipientNames.push(pr.name);
            recipients.push({
                kind: 'processor',
                name: pr.name,
                country: pr.country,
                service: m.label,
                processor: pr.id,
                flows: flows.filter((f) => f.m === m && f.linked === pr).map((f) => f.fl.id),
                dpa: pr.dpa ?? null,
                dpaRef: pr.dpa_ref ?? null,
                safeguard: pr.safeguard ?? null,
                transferOutsideEu: pr.transfer_outside_eu ?? null,
                source: src(m, pr.source),
            });
        }
        for (const { m, fl, linked } of flows) {
            if (linked || inside.has(fl.to.name))
                continue;
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
        for (const r of p.recipients ?? []) {
            if (recipientNames.some((n) => r.name === n || r.name.startsWith(`${n} (`)))
                continue;
            recipientCands.push({ value: [r.name], source: processingSource(r.source), open: null });
            recipients.push({ kind: 'declared', name: r.name, country: null, service: null, processor: null, flows: [], dpa: null, dpaRef: null, safeguard: null, transferOutsideEu: null, source: processingSource(r.source) });
        }
        // (e) Transfers
        const transferCands = [];
        const transfer = (name, country, safeguard, source) => {
            const fallback = word(country === 'unknown' ? 'destinationToAssess' : 'safeguardNotDeclared');
            const open = safeguard === undefined ? flag(place, 'transfer-safeguards', `${name} (${country})`) : null;
            transferCands.push({ value: phrase(`${name} (`, countryOf(country), '): ', safeguard ?? fallback), source, open });
        };
        for (const { m, pr } of procs)
            if (pr.transfer_outside_eu === true)
                transfer(pr.name, pr.country, pr.safeguard, src(m, pr.source));
        for (const { m, fl, linked: x } of flows) {
            if (x) {
                if (x.transfer_outside_eu === true || !EU_EEA.has(x.country)) {
                    transfer(x.name, x.country, fl.safeguard ?? x.safeguard, fl.safeguard !== undefined ? src(m, fl.source) : src(m, x.source));
                }
            }
            else if (fl.to.country === 'unknown' || !EU_EEA.has(fl.to.country)) {
                transfer(fl.to.name, fl.to.country, fl.safeguard, src(m, fl.source));
            }
        }
        // (f) Erasure time limits
        let erasure;
        let erasureOrder = 'as-is';
        if (p.retention) {
            const open = p.retention.duration === 'unknown' ? flag(place, 'retention', 'processing') : null;
            erasure = [{ value: [duration(p.retention)], source: processingSource(p.retention.source), open }];
        }
        else if (storageRows.length > 0) {
            erasure = compositeP(storageRows);
            erasureOrder = 'composite';
        }
        else
            erasure = [placeholder(TC, flag(place, 'retention', 'processing'))];
        // (g) Security measures
        const security = atomic((p.security_measures ?? []).map((s) => ({ value: s.measure, source: processingSource(s.source) })));
        const securityOpen = security.length === 0 ? flag(place, 'security-measures', 'processing') : null;
        const personalRows = compositeP(personal);
        const personalOpen = personalRows.length === 0 ? flag(place, 'personal-data', 'To complete') : null;
        const recipientRows = atomicP(recipientCands);
        const transferRows = atomicP(transferCands);
        const fromCands = (cands) => cands.map((c) => ({ value: [c.value], source: c.source, open: null }));
        const art30 = [
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
        const basis = p.legal_basis;
        const detail = p.legal_basis_detail;
        let basisDetail;
        if (basis === 'not-applicable')
            basisDetail = [placeholder([word('notExpected')])];
        else {
            const parts = basis === 'legitimate-interests'
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
        const dpia = p.dpia;
        let dpiaRow;
        if (!dpia)
            dpiaRow = placeholder(TC, flag(place, 'dpia', 'processing'));
        else {
            const value = phrase(word('required'), `: ${dpia.required}`);
            if (dpia.criteria !== undefined)
                value.push(...phrase('; ', word('criteria'), ': ', dpia.criteria.length > 0 ? [[...dpia.criteria].sort(cmp).join(', ')] : [word('none')]));
            if (dpia.ref !== undefined)
                value.push(...phrase('; ', word('reference'), ': ', fill(dpia.ref)));
            else if (dpia.required === 'yes')
                value.push(...phrase('; ', word('reference'), ': ', TC));
            const open = dpia.required === 'to-assess' || (dpia.required === 'yes' && (dpia.ref === undefined || isPlaceholder(dpia.ref))) ? flag(place, 'dpia', 'processing') : null;
            dpiaRow = { value: phrase(value), source: P, open };
        }
        let information;
        if (!p.information)
            information = [placeholder(TC, flag(place, 'information', 'processing'))];
        else {
            const opened = new Set();
            const rows = atomic(notices.get(p).map(({ m, notice }) => {
                const value = `${notice.kind}: ${notice.ref} (${m.label})`;
                if (notice.kind === 'none') {
                    flag(place, 'information', `${m.label}/${notice.id}`);
                    opened.add(value);
                }
                return { value, source: src(m, notice.source) };
            }));
            information = rows.map((c) => ({ value: [c.value], source: c.source, open: opened.has(c.value) ? 'information' : null }));
            if (p.information.text !== undefined)
                information.push({ value: [p.information.text], source: P, open: null });
        }
        const sensitive = p.sensitive_data;
        const sensitiveOpen = sensitive === undefined || sensitive === 'to-assess' ? flag(place, 'sensitive-data', 'processing') : null;
        const sensitiveRow = sensitive === undefined ? placeholder(TC, sensitiveOpen) : { value: [typeof sensitive === 'string' ? sensitive : [...sensitive].sort(cmp).join(', ')], source: P, open: sensitiveOpen };
        const contracts = atomicP(procs.map(({ m, pr }) => ({
            value: phrase(processorValue(pr), pr.dpa_ref !== undefined ? ` (${pr.dpa_ref})` : ''),
            source: src(m, pr.source),
            open: pr.dpa === 'no' || pr.dpa === 'unknown' ? flag(place, 'processor-contracts', `${pr.name} (${pr.country})`) : null,
        })));
        const checks = [
            { item: 'legal-basis', values: [{ value: [basis], source: P, open: null }], order: 'as-is' },
            { item: 'legal-basis-detail', values: basisDetail, order: 'as-is' },
            { item: 'dpia', values: [dpiaRow], order: 'as-is' },
            { item: 'information', values: information, order: 'as-is' },
            { item: 'sensitive-data', values: [sensitiveRow], order: 'as-is' },
            { item: 'processor-contracts', values: contracts.length > 0 ? contracts : [placeholder([word('noneFound')])], order: 'atomic' },
        ];
        return {
            id: p.id,
            name: p.name,
            legalBasis: basis,
            art30,
            checks,
            openItems: [],
            recipients,
            review: p.review ?? null,
        };
    });
    // ---------- AI features ----------
    const aiFeatures = [...referenced]
        .flatMap((m) => (m.doc.ai_features ?? []).map((f) => {
        const subject = `${m.label}/${f.id}`;
        const open = new Set();
        if (f.role === undefined || f.role === 'to-assess')
            open.add(flag(AI_FEATURES, 'ai-classification', `${subject} role`));
        if (f.risk === undefined || f.risk.level === 'to-assess' || f.risk.level === 'prohibited')
            open.add(flag(AI_FEATURES, 'ai-classification', `${subject} risk`));
        const listed = f.obligations ?? [];
        const obligations = listed.map((o) => {
            if (o.status === 'open')
                open.add(flag(AI_FEATURES, 'ai-obligations', `${subject} ${o.id}`));
            return { id: o.id, status: o.status, ref: o.ref ?? null };
        });
        for (const id of expectedObligations(f)) {
            if (listed.some((o) => o.id === id))
                continue;
            open.add(flag(AI_FEATURES, 'ai-obligations', `${subject} ${id}`));
            obligations.push({ id, status: null, ref: null });
        }
        return {
            service: m.label,
            id: f.id,
            description: f.description,
            role: f.role ?? null,
            risk: f.risk ? { level: f.risk.level, reason: f.risk.reason ?? null } : null,
            obligations: obligations.sort((a, b) => cmp(a.id, b.id)),
            open: [...open],
            source: src(m, f.source),
        };
    }))
        .sort((a, b) => cmp(a.service, b.service) || cmp(a.id, b.id));
    // ---------- Outside the register ----------
    const outside = [];
    for (const m of all) {
        const s = m.doc.service;
        const components = s.components ?? [];
        const items = m.doc.personal_data;
        const row = (service, component, controller, data) => {
            const open = s.controller_rationale === undefined ? flag(OUTSIDE, 'controller-rationale', m.label) : null;
            outside.push({
                service,
                component,
                controller,
                rationale: s.controller_rationale ?? null,
                privacyByDesign: s.privacy_by_design ? [...s.privacy_by_design].sort(cmp) : null,
                data: [...data].sort((a, b) => cmp(a.id, b.id)).map((d) => ({ id: d.id, categories: [...new Set(d.fields.map((f) => f.category))].sort(cmp) })),
                open,
                source: src(m, s.source),
            });
        };
        if (s.controller !== 'organisation') {
            const own = new Set(components.filter((c) => c.controller === undefined || c.controller === s.controller).map((c) => c.id));
            row(m.label, null, s.controller, items.filter((d) => d.component === undefined || own.has(d.component)));
        }
        for (const c of components) {
            if (c.controller === undefined || c.controller === 'organisation' || c.controller === s.controller)
                continue;
            row(`${m.label}/${c.id}`, c.id, c.controller, items.filter((d) => d.component === c.id));
        }
    }
    outside.sort((a, b) => cmp(a.service, b.service));
    // ---------- actions ----------
    for (const x of opens.values()) {
        sections.find((s) => s.id === x.place)?.openItems.push({ kind: x.kind, subject: x.subject });
    }
    const order = [ORGANISATION, ...processings.map((p) => p.id), AI_FEATURES, OUTSIDE];
    const byKind = new Map();
    for (const { place, kind } of opens.values()) {
        const a = byKind.get(kind) ?? { count: 0, places: new Set() };
        a.count += 1;
        a.places.add(place);
        byKind.set(kind, a);
    }
    const actions = [...byKind]
        .map(([id, a]) => ({ id, role: ACTIONS[id].role, count: a.count, places: order.filter((pl) => a.places.has(pl)).map(toPlace) }))
        .sort((a, b) => ROLES[a.role].order - ROLES[b.role].order || b.count - a.count || cmp(a.id, b.id));
    const services = all
        .filter((m) => m.repo !== undefined)
        .map((m) => {
        const sync = syncs.get(m.repo);
        return { repo: m.repo, name: m.doc.service.name, sha: sync.sha, receivedAt: sync.received_at, lag: sync.lag };
    });
    return {
        specVersion: DOSSIER_VERSION,
        organisation: { name: org.name, language: org.language ?? null, rows: organisationRows },
        anchors,
        services,
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
function renderItem(label, group, language) {
    let rows = group.values.map((v) => ({ value: renderPhrase(v.value, language), source: v.source ?? NO_SOURCE }));
    if (group.order === 'atomic')
        rows = atomic(rows);
    else if (group.order === 'composite')
        rows = composite(rows);
    else if (group.order === 'sorted')
        rows = [...rows].sort((a, b) => cmp(a.value, b.value));
    return rows.map((r, i) => ({ item: cell(i === 0 ? label : ''), value: cell(r.value), source: cell(r.source) }));
}
/** The markdown of the dossier in a language, from its model. Pure: the same model, date and language give the same bytes. */
export function renderDossier(model, generatedAt, language) {
    if (!LANGUAGES.includes(language))
        throw new ComplianceError(`Unknown language "${language}". Use ${LANGUAGES.join(' or ')}.`);
    const anchorErrors = validateDocument('anchors', { spec_version: DOSSIER_VERSION, generated_at: generatedAt, repos: Object.fromEntries(Object.entries(model.anchors).map(([k, sha]) => [k, { sha }])) });
    if (anchorErrors.length > 0)
        throw new ComplianceError(`generated_at "${generatedAt}" is not usable: ${anchorErrors[0].instancePath}: ${anchorErrors[0].message}.`);
    const W = WORDS[language];
    const L = ITEM_LABELS[language];
    const TC = W.toComplete;
    const placeLabel = (place) => (place.kind === 'processing' ? place.id : L.places[place.kind]);
    let template = TEMPLATE_FILES[TEMPLATES[language]];
    // With no anchor, `anchors: {}` takes the place of the block.
    if (Object.keys(model.anchors).length === 0)
        template = template.replace(/^anchors:\n\{\{#each anchors\}\}\n[\s\S]*?\{\{\/each\}\}\n/m, 'anchors: {}\n');
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
/** Builds the v0.2 dossier of a tree: its model, rendered in `language`. Does not read actions.yaml. */
export function buildDossier(tree, generatedAt, language) {
    const model = buildDossierModel(tree, { actionsFile: false });
    const markdown = renderDossier(model, generatedAt, language);
    return { markdown, anchors: model.anchors, openItems: model.openItems, actions: model.actions.map(({ id, role, count }) => ({ id, role, count })) };
}
/** The input when given, else organisation.language of compliance.yaml (v0.2.1), else `en`. */
export function dossierLanguage(tree, input) {
    if (input)
        return input;
    const declared = readDoc(tree, 'compliance.yaml', 'compliance').organisation?.language;
    return LANGUAGES.includes(declared) ? declared : 'en';
}
