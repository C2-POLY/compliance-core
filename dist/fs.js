import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ComplianceError } from './errors.js';
import { isRepoPath, treeFromFiles } from './tree.js';
import { parseStrict } from './yaml.js';
// The only module of the package that touches the filesystem. It reads what the engine may read, and nothing else:
// compliance.yaml, actions.yaml, anchors.yaml, services/<repo>/{manifest,sync}.yaml, processings/<id>/processing.yaml
// and the manifests of the declared tools. A symbolic link anywhere on those paths is refused, even a dangling one,
// so that nothing is silently left out and nothing outside the repo is read.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** lstat that says "absent" instead of throwing ENOENT (or ENOTDIR: a parent is a file). */
function lstatOrNull(path) {
    try {
        return lstatSync(path);
    }
    catch (err) {
        const code = err.code;
        if (code === 'ENOENT' || code === 'ENOTDIR')
            return null;
        throw err;
    }
}
/** Refuses a symbolic link at any level of `rel` below the root. Stops at the first missing part. */
function assertNoSymlink(root, rel) {
    let current = root;
    const parts = rel.split('/');
    for (let i = 0; i < parts.length; i++) {
        current = join(current, parts[i]);
        const stat = lstatOrNull(current);
        if (!stat)
            return;
        if (stat.isSymbolicLink())
            throw new ComplianceError(`Refused: ${parts.slice(0, i + 1).join('/')} is a symbolic link.`);
    }
}
/**
 * Loads the compliance repo checked out at `dir` into a tree, keeping every safety rule of compliance-action:
 * a symbolic link is refused wherever the engine reads (files, folders under services/ and processings/, dangling links included),
 * YAML is parsed strictly, and no path leaves the repo. A file that is absent stays absent: the engine then reports it.
 */
export function loadDirectory(dir) {
    const root = resolve(dir);
    const files = new Map();
    const dirs = new Set();
    const readFile = (rel) => {
        if (files.has(rel))
            return;
        assertNoSymlink(root, rel);
        const stat = lstatOrNull(join(root, ...rel.split('/')));
        if (!stat)
            return;
        if (!stat.isFile())
            throw new ComplianceError(`${rel} is not a regular file. Nothing was generated.`);
        let text;
        try {
            text = readFileSync(join(root, ...rel.split('/')), 'utf8');
        }
        catch {
            throw new ComplianceError(`${rel} not found (or not readable). Nothing was generated.`);
        }
        files.set(rel, text);
    };
    /** The folders directly under `rel`; a symbolic link among its entries is refused. */
    const subfolders = (rel) => {
        assertNoSymlink(root, rel);
        const stat = lstatOrNull(join(root, rel));
        if (!stat || !stat.isDirectory())
            return [];
        const entries = readdirSync(join(root, rel), { withFileTypes: true });
        const link = entries.find((e) => e.isSymbolicLink());
        if (link)
            throw new ComplianceError(`${rel}/${link.name} is a symbolic link: refused, so that nothing is silently left out. Nothing was generated.`);
        const names = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort(cmp);
        for (const name of names)
            dirs.add(`${rel}/${name}`);
        return names;
    };
    for (const rel of ['compliance.yaml', 'actions.yaml', 'anchors.yaml'])
        readFile(rel);
    for (const repo of subfolders('services')) {
        readFile(`services/${repo}/manifest.yaml`);
        readFile(`services/${repo}/sync.yaml`);
    }
    for (const id of subfolders('processings'))
        readFile(`processings/${id}/processing.yaml`);
    // The declared tools: their path comes from compliance.yaml. An unreadable compliance.yaml is reported by the engine.
    const compliance = files.get('compliance.yaml');
    if (compliance !== undefined) {
        let doc;
        try {
            doc = parseStrict(compliance);
        }
        catch {
            doc = undefined;
        }
        const tools = doc?.declared_tools;
        for (const tool of Array.isArray(tools) ? tools : []) {
            const path = tool?.path;
            // A path that leaves the repo is never read; the schema of compliance.yaml then rejects it.
            if (typeof path === 'string' && isRepoPath(path) && !path.includes('\\'))
                readFile(path);
        }
    }
    return treeFromFiles(files, dirs);
}
