import { ComplianceError } from './errors.js';
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** A normalised repo-relative POSIX path: no leading `/`, no empty, `.` or `..` segment. */
export function isRepoPath(path) {
    return path !== '' && path.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}
/**
 * A tree from a record of files, such as the files of a commit fetched from the GitHub API.
 * `dirs` adds folders that hold no file (a git tree never has one; `loadDirectory` passes them).
 * Throws on a path that is not a normalised repo-relative POSIX path.
 */
export function treeFromFiles(files, dirs = []) {
    const map = new Map();
    const entries = Symbol.iterator in Object(files) ? files : Object.entries(files);
    for (const [path, text] of entries) {
        if (!isRepoPath(path))
            throw new ComplianceError(`"${path}" is not a repo-relative POSIX path.`);
        if (typeof text !== 'string')
            throw new ComplianceError(`${path}: the content of a file must be a text.`);
        map.set(path, text);
    }
    const folders = new Set();
    const addParents = (path) => {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++)
            folders.add(parts.slice(0, i).join('/'));
    };
    for (const path of map.keys())
        addParents(path);
    for (const dir of dirs) {
        if (!isRepoPath(dir))
            throw new ComplianceError(`"${dir}" is not a repo-relative POSIX path.`);
        folders.add(dir);
        addParents(dir);
    }
    for (const path of map.keys()) {
        if (folders.has(path))
            throw new ComplianceError(`"${path}" is both a file and a folder.`);
    }
    return {
        files: map,
        has: (path) => map.has(path) || folders.has(path),
        read: (path) => map.get(path),
        listDirs: (prefix) => {
            const base = prefix === '' ? '' : `${prefix}/`;
            if (prefix !== '' && !isRepoPath(prefix))
                return [];
            const names = new Set();
            for (const dir of folders) {
                if (!dir.startsWith(base))
                    continue;
                const rest = dir.slice(base.length);
                if (rest !== '' && !rest.includes('/'))
                    names.add(rest);
            }
            return [...names].sort(cmp);
        },
    };
}
