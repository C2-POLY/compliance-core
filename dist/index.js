// @c2-poly/compliance-core: reads a compliance repo (C2-POLY/compliance-spec v0.1 and v0.2) from an in-memory tree
// and builds its v0.1 register or its v0.2 dossier. No filesystem access here: see `@c2-poly/compliance-core/fs`.
export { ComplianceError, SPEC_URL } from './errors.js';
export { parseStrict } from './yaml.js';
export { isRepoPath, treeFromFiles } from './tree.js';
export { SCHEMA_NAMES, SPEC_COMMIT, SPEC_VERSIONS, validateDocument, validateText, versionOf, } from './schema.js';
export { EU_EEA, REGISTER_VERSION, TO_COMPLETE, anchorsYaml, buildRegister, cell, codeSpan, isPlaceholder, openSummary, readDoc, renderTemplate, } from './register.js';
export { ACTIONS, ACTION_IDS, ART30_KEYS, CHECK_KEYS, DOSSIER_VERSION, ITEM_LABELS, LANGUAGES, ORGANISATION_KEYS, ROLES, WORDS, actionLabel, actionsSummary, buildDossier, buildDossierModel, dossierLanguage, renderDossier, renderPhrase, roleLabel, } from './dossier.js';
