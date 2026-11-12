import { type Doc } from './register.js';
import type { ComplianceTree } from './tree.js';
export declare const DOSSIER_VERSION = "0.2";
export declare const LANGUAGES: readonly ['en', 'fr'];
export type Language = (typeof LANGUAGES)[number];
/** The words the dossier adds to the values of the sources, per language. A Phrase refers to them by key. */
export declare const WORDS: {
    readonly en: {
        readonly toComplete: 'To complete';
        readonly noneFound: 'None identified in the sources';
        readonly none: 'None';
        readonly notExpected: 'Not expected for this legal basis';
        readonly notDesignated: 'Not designated';
        readonly notRequired: 'Not required';
        readonly countryUnknown: 'country unknown';
        readonly destinationToAssess: 'destination to assess';
        readonly safeguardNotDeclared: 'safeguard not declared';
        readonly arrangement: 'arrangement';
        readonly interest: 'Interest';
        readonly necessity: 'Necessity';
        readonly impact: 'Impact';
        readonly safeguards: 'Safeguards';
        readonly collection: 'Collection';
        readonly withdrawal: 'Withdrawal';
        readonly reference: 'Reference';
        readonly required: 'Required';
        readonly criteria: 'Criteria';
        readonly dpa: 'DPA';
    };
    readonly fr: {
        readonly toComplete: 'À compléter';
        readonly noneFound: 'Aucun identifié dans les sources';
        readonly none: 'Aucun';
        readonly notExpected: 'Non attendu pour cette base légale';
        readonly notDesignated: 'Non désigné';
        readonly notRequired: 'Non requis';
        readonly countryUnknown: 'pays inconnu';
        readonly destinationToAssess: 'destination à évaluer';
        readonly safeguardNotDeclared: 'garantie non déclarée';
        readonly arrangement: 'accord';
        readonly interest: 'Intérêt';
        readonly necessity: 'Nécessité';
        readonly impact: 'Impact';
        readonly safeguards: 'Garanties';
        readonly collection: 'Recueil';
        readonly withdrawal: 'Retrait';
        readonly reference: 'Référence';
        readonly required: 'Requise';
        readonly criteria: 'Critères';
        readonly dpa: 'DPA';
    };
};
export type WordKey = keyof (typeof WORDS)['en'];
export declare const ORGANISATION_KEYS: readonly ['controller', 'dpo', 'representative', 'privacy-contact'];
export type OrganisationKey = (typeof ORGANISATION_KEYS)[number];
/** The items of GDPR Art. 30(1), in the order of the dossier. */
export declare const ART30_KEYS: readonly ['controller', 'joint-controller', 'representative', 'dpo', 'purposes', 'data-subjects', 'personal-data', 'recipients', 'transfers', 'erasure-time-limits', 'security-measures'];
export type Art30Key = (typeof ART30_KEYS)[number];
/** The DPO checks, in the order of the dossier. */
export declare const CHECK_KEYS: readonly ['legal-basis', 'legal-basis-detail', 'dpia', 'information', 'sensitive-data', 'processor-contracts'];
export type CheckKey = (typeof CHECK_KEYS)[number];
export type PlaceKind = 'organisation' | 'processing' | 'ai' | 'outside';
/** The labels of the rows and places of the dossier, per language. */
export declare const ITEM_LABELS: {
    readonly en: {
        readonly organisation: {
            readonly controller: 'Controller';
            readonly dpo: 'Data protection officer';
            readonly representative: 'Representative (Art. 27)';
            readonly 'privacy-contact': 'Privacy contact';
        };
        readonly art30: {
            readonly controller: '(a) Controller';
            readonly 'joint-controller': '(a) Joint controller';
            readonly representative: '(a) Representative';
            readonly dpo: '(a) Data protection officer';
            readonly purposes: '(b) Purposes';
            readonly 'data-subjects': '(c) Data subjects';
            readonly 'personal-data': '(c) Personal data';
            readonly recipients: '(d) Recipients';
            readonly transfers: '(e) Transfers';
            readonly 'erasure-time-limits': '(f) Erasure time limits';
            readonly 'security-measures': '(g) Security measures';
        };
        readonly checks: {
            readonly 'legal-basis': 'Legal basis';
            readonly 'legal-basis-detail': 'Legal basis detail';
            readonly dpia: 'DPIA';
            readonly information: 'Information of persons';
            readonly 'sensitive-data': 'Sensitive data';
            readonly 'processor-contracts': 'Processor contracts';
        };
        readonly places: {
            readonly organisation: 'Organisation';
            readonly ai: 'AI features';
            readonly outside: 'Outside the register';
        };
    };
    readonly fr: {
        readonly organisation: {
            readonly controller: 'Responsable du traitement';
            readonly dpo: 'Délégué à la protection des données';
            readonly representative: 'Représentant (art. 27)';
            readonly 'privacy-contact': "Contact pour l'exercice des droits";
        };
        readonly art30: {
            readonly controller: '(a) Responsable du traitement';
            readonly 'joint-controller': '(a) Responsable conjoint';
            readonly representative: '(a) Représentant';
            readonly dpo: '(a) Délégué à la protection des données';
            readonly purposes: '(b) Finalités';
            readonly 'data-subjects': '(c) Personnes concernées';
            readonly 'personal-data': '(c) Données personnelles';
            readonly recipients: '(d) Destinataires';
            readonly transfers: '(e) Transferts';
            readonly 'erasure-time-limits': "(f) Délais d'effacement";
            readonly 'security-measures': '(g) Mesures de sécurité';
        };
        readonly checks: {
            readonly 'legal-basis': 'Base légale';
            readonly 'legal-basis-detail': 'Détail de la base légale';
            readonly dpia: 'AIPD';
            readonly information: 'Information des personnes';
            readonly 'sensitive-data': 'Données sensibles';
            readonly 'processor-contracts': 'Contrats de sous-traitance';
        };
        readonly places: {
            readonly organisation: 'Organisation';
            readonly ai: "Fonctionnalités d'IA";
            readonly outside: 'Hors du registre';
        };
    };
};
export type Role = 'organisation' | 'dpo' | 'developer';
/** The roles of the Actions table, in their order, with their labels. */
export declare const ROLES: Record<Role, {
    order: number;
    en: string;
    fr: string;
}>;
/** The action catalogue: each action closes one kind of open item (templates/register/README.md, Actions). */
export declare const ACTIONS: {
    readonly 'organisation-identity': {
        readonly role: 'organisation';
        readonly en: "Complete the controller's identity";
        readonly fr: "Compléter l'identité du responsable du traitement";
    };
    readonly 'organisation-dpo': {
        readonly role: 'organisation';
        readonly en: 'Designate a DPO, or state why none is required';
        readonly fr: "Désigner un DPO, ou indiquer pourquoi aucun n'est requis";
    };
    readonly 'organisation-representative': {
        readonly role: 'organisation';
        readonly en: 'State whether a representative in the EU is required (Art. 27)';
        readonly fr: "Indiquer si un représentant dans l'UE est requis (art. 27)";
    };
    readonly 'joint-controllers': {
        readonly role: 'organisation';
        readonly en: 'List the joint controllers, or state that there are none';
        readonly fr: "Lister les responsables conjoints, ou indiquer qu'il n'y en a pas";
    };
    readonly 'personal-data': {
        readonly role: 'developer';
        readonly en: 'Describe the personal data and classify the unknown categories';
        readonly fr: 'Décrire les données personnelles et classer les catégories inconnues';
    };
    readonly 'transfer-safeguards': {
        readonly role: 'developer';
        readonly en: 'Declare the safeguard of each transfer outside the EU';
        readonly fr: "Déclarer la garantie de chaque transfert hors de l'UE";
    };
    readonly 'processor-contracts': {
        readonly role: 'organisation';
        readonly en: 'Sign or locate the processor contracts (Art. 28)';
        readonly fr: 'Signer ou retrouver les contrats de sous-traitance (art. 28)';
    };
    readonly retention: {
        readonly role: 'dpo';
        readonly en: 'Set the retention periods';
        readonly fr: 'Fixer les durées de conservation';
    };
    readonly 'security-measures': {
        readonly role: 'developer';
        readonly en: 'Describe the security measures';
        readonly fr: 'Décrire les mesures de sécurité';
    };
    readonly 'legal-basis-detail': {
        readonly role: 'dpo';
        readonly en: 'Document the legal basis';
        readonly fr: 'Documenter la base légale';
    };
    readonly dpia: {
        readonly role: 'dpo';
        readonly en: 'Assess whether a DPIA is required, and reference it';
        readonly fr: 'Évaluer si une AIPD est requise, et la référencer';
    };
    readonly information: {
        readonly role: 'organisation';
        readonly en: 'State how the persons are informed (Art. 13 and 14)';
        readonly fr: 'Indiquer comment les personnes sont informées (art. 13 et 14)';
    };
    readonly 'sensitive-data': {
        readonly role: 'dpo';
        readonly en: 'Assess the sensitive data (Art. 9)';
        readonly fr: 'Évaluer les données sensibles (art. 9)';
    };
    readonly 'ai-classification': {
        readonly role: 'dpo';
        readonly en: 'Classify the AI features: role and risk level';
        readonly fr: "Classer les fonctionnalités d'IA : rôle et niveau de risque";
    };
    readonly 'ai-obligations': {
        readonly role: 'developer';
        readonly en: 'Meet or document the AI Act obligations';
        readonly fr: "Remplir ou documenter les obligations de l'AI Act";
    };
    readonly 'controller-rationale': {
        readonly role: 'dpo';
        readonly en: 'Explain why the organisation is not the controller';
        readonly fr: "Expliquer pourquoi l'organisation n'est pas responsable du traitement";
    };
};
export type ActionId = keyof typeof ACTIONS;
export declare const ACTION_IDS: ActionId[];
export declare const actionLabel: (id: ActionId, language: Language) => string;
export declare const roleLabel: (role: Role, language: Language) => string;
export declare function actionsSummary(openItems: number, actions: number, language: Language): string;
/** A value of the dossier: text of the sources, and words of the dossier by key (WORDS), joined in order. */
export type Phrase = (string | {
    word: WordKey;
})[];
/** The text of a phrase in a language. */
export declare function renderPhrase(p: Phrase, language: Language): string;
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
export type Place = {
    kind: 'organisation';
} | {
    kind: 'processing';
    id: string;
} | {
    kind: 'ai';
} | {
    kind: 'outside';
};
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
    fields: {
        name: string;
        category: string;
    }[];
    source: string;
}
export interface StorageModel {
    id: string;
    component: string | null;
    kind: string;
    location: string;
    /** The personal_data ids stored, as in the manifest. */
    data: string[];
    retention: {
        duration: string;
        trigger: string | null;
    } | null;
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
    risk: {
        level: string;
        reason: string | null;
    } | null;
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
    data: {
        id: string;
        categories: string[];
    }[];
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
/** Builds the structured model of the v0.2 dossier from a tree of a v0.2 compliance repo. Pure: reads the tree, never the clock. */
export declare function buildDossierModel(tree: ComplianceTree, options?: DossierModelOptions): DossierModel;
/** The markdown of the dossier in a language, from its model. Pure: the same model, date and language give the same bytes. */
export declare function renderDossier(model: DossierModel, generatedAt: string, language: Language): string;
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
export declare function buildDossier(tree: ComplianceTree, generatedAt: string, language: Language): Dossier;
/** The input when given, else organisation.language of compliance.yaml (v0.2.1), else `en`. */
export declare function dossierLanguage(tree: ComplianceTree, input?: string): Language;
