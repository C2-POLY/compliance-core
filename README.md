# compliance-core

The engine that reads a compliance repo and builds its documents: the records of processing (v0.1 register) or the compliance dossier (v0.2). It implements the format of [C2-POLY/compliance-spec](https://github.com/C2-POLY/compliance-spec), versions **0.1** and **0.2** (including the **v0.2.1** additions: `organisation.language`, `review` of a processing, `actions.yaml`).

It was extracted from [compliance-action](https://github.com/C2-POLY/compliance-action) so that the GitHub Action and the web platform share one engine.

> compliance-core prepares documentation for review by the controller and its data protection officer. It does not certify compliance with the GDPR or the AI Act.

## The guarantee

For the same compliance repo, the same `generated_at` and the same language, the markdown is byte for byte what compliance-action writes to `documents/register.md`. The tests hold it to the golden files of the Bistro Booking example (v0.1 register; v0.2 dossier in English and French), whichever loader built the tree.

## Install

The package is installed from git; `dist/` is committed, so there is no build step:

```sh
npm install github:C2-POLY/compliance-core
```

Runtime dependencies: `ajv`, `ajv-formats`, `yaml`. ESM only, with type declarations.

## Two loaders, one tree

The engine never touches the filesystem. It reads a `ComplianceTree`: a read-only snapshot of repo-relative POSIX paths to UTF-8 text, with `has(path)`, `read(path)` and `listDirs(prefix)`.

From a checkout, in Node (the Action):

```ts
import { buildDossier, dossierLanguage } from '@c2-poly/compliance-core';
import { loadDirectory } from '@c2-poly/compliance-core/fs';

const tree = loadDirectory('path/to/compliance-repo');
const { markdown, anchors, openItems, actions } = buildDossier(tree, '2026-11-11T00:00:00Z', dossierLanguage(tree));
```

`loadDirectory` reads only what the engine may read (`compliance.yaml`, `actions.yaml`, `anchors.yaml`, `services/<repo>/manifest.yaml` and `sync.yaml`, `processings/<id>/processing.yaml`, the manifests of the declared tools). It refuses a symbolic link anywhere on those paths, a dangling one included, and never reads outside the repo.

From files fetched elsewhere, such as the GitHub API (the platform):

```ts
import { buildDossierModel, treeFromFiles } from '@c2-poly/compliance-core';

const tree = treeFromFiles({
  'compliance.yaml': complianceText,
  'services/bistro-api/manifest.yaml': manifestText,
  // ...
});
const model = buildDossierModel(tree);
```

Every file is parsed by a strict YAML 1.2 parser (no anchor, alias, tag or directive) and validated against the JSON Schema of its own `spec_version` before use.

## API

| Export | What it does |
| --- | --- |
| `treeFromFiles(files, dirs?)` | A tree from a record (or entries) of path to text. |
| `loadDirectory(dir)` (from `/fs`) | A tree from a folder, with the safety rules above. |
| `versionOf(doc)`, `validateDocument(name, doc)`, `validateText(name, text)` | The schema version of a parsed file, and its validation (`manifest`, `processing`, `compliance`, `sync`, `anchors`, `actions`). |
| `buildRegister(tree, generatedAt)` | The v0.1 register: `{ markdown, anchors, open }`. |
| `buildDossierModel(tree, options?)` | The structured, language-neutral model of the v0.2 dossier. |
| `renderDossier(model, generatedAt, language)` | The markdown of the dossier in `en` or `fr`. |
| `buildDossier(tree, generatedAt, language)` | Model then render: `{ markdown, anchors, openItems, actions }`. |
| `dossierLanguage(tree, input?)` | The input, else `organisation.language`, else `en`. |
| `anchorsYaml(anchors, generatedAt, specVersion?)` | The `anchors.yaml` that goes with a document. |
| `ACTIONS`, `ACTION_IDS`, `ROLES`, `ITEM_LABELS`, `WORDS` | The action catalogue (id, role, English and French labels), the role labels, the row labels and the words the dossier adds, as data. |

### The dossier model

`buildDossierModel` returns stable keys, never translated text. Open items are flagged where each value is built, never found by reading text.

- `organisation`: `name`, `language`, and `rows` (`key`, `value`, `source`, `open`).
- `anchors` and `services` (`repo`, `name`, `sha`, `receivedAt`, `lag` of each `sync.yaml`).
- `openItems` and `actions` (`id`, `role`, `count`, `places`: a processing id, the organisation, the AI features or outside the register).
- `processings`: `id`, `name`, `legalBasis`, `art30` and `checks` (one group per item key, each value with its `source` and the action that closes it when open), `openItems`, `recipients` (`kind`, `name`, `country`, `dpa`, `dpaRef`, `safeguard`, `processor`, `flows`, `service`), and the raw `review`.
- `aiFeatures` (`service`, `id`, `description`, `role`, `risk`, `obligations` with their status, `open`) and `outside` (`service`, `component`, `controller`, `rationale`, `privacyByDesign`, `data`, `open`).
- `actionsFile`: the parsed `actions.yaml` when present (`buildDossierModel(tree, { actionsFile: false })` skips it). The markdown does not use it.

A value is a `Phrase`: text of the sources and word keys (`{ word: 'toComplete' }`); `renderPhrase(phrase, language)` gives its text.

## The spec it implements

`schemas/` and `templates/register/` are copies from compliance-spec; `schemas/SOURCE.json` records the commit. `src/generated/spec.ts` embeds them for the engine. To update from a checkout of the spec:

```sh
npm run sync-spec -- ../compliance-spec
```

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build   # writes dist/, which is committed
```

Examples use the fictional app Bistro Booking only.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
