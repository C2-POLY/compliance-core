import { ComplianceError } from './errors.js';

/**
 * A read-only snapshot of a compliance repo: repo-relative POSIX paths (`services/bistro-api/manifest.yaml`) to UTF-8 text.
 * The engine reads nothing else: build it with `loadDirectory` (`@c2-poly/compliance-core/fs`) or `treeFromFiles`.
 */
export interface ComplianceTree {
  /** Every file of the snapshot, path to text. */
  readonly files: ReadonlyMap<string, string>;
  /** True when the path is a file or a folder of the snapshot. */
  has(path: string): boolean;
  /** The text of a file, or undefined when the snapshot has no such file. */
  read(path: string): string | undefined;
  /** The names of the folders directly under `prefix` (`''` for the root), sorted. */
  listDirs(prefix: string): string[];
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A normalised repo-relative POSIX path: no leading `/`, no empty, `.` or `..` segment. */
export function isRepoPath(path: string): boolean {
  return path !== '' && path.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

/**
 * A tree from a record of files, such as the files of a commit fetched from the GitHub API.
 * `dirs` adds folders that hold no file (a git tree never has one; `loadDirectory` passes them).
 * Throws on a path that is not a normalised repo-relative POSIX path.
 */
export function treeFromFiles(files: Readonly<Record<string, string>> | Iterable<readonly [string, string]>, dirs: Iterable<string> = []): ComplianceTree {
  const map = new Map<string, string>();
  const entries = Symbol.iterator in Object(files) ? (files as Iterable<readonly [string, string]>) : Object.entries(files as Record<string, string>);
  for (const [path, text] of entries) {
    if (!isRepoPath(path)) throw new ComplianceError(`"${path}" is not a repo-relative POSIX path.`);
    if (typeof text !== 'string') throw new ComplianceError(`${path}: the content of a file must be a text.`);
    map.set(path, text);
  }
  const folders = new Set<string>();
  const addParents = (path: string): void => {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'));
  };
  for (const path of map.keys()) addParents(path);
  for (const dir of dirs) {
    if (!isRepoPath(dir)) throw new ComplianceError(`"${dir}" is not a repo-relative POSIX path.`);
    folders.add(dir);
    addParents(dir);
  }
  for (const path of map.keys()) {
    if (folders.has(path)) throw new ComplianceError(`"${path}" is both a file and a folder.`);
  }
  return {
    files: map,
    has: (path) => map.has(path) || folders.has(path),
    read: (path) => map.get(path),
    listDirs: (prefix) => {
      const base = prefix === '' ? '' : `${prefix}/`;
      if (prefix !== '' && !isRepoPath(prefix)) return [];
      const names = new Set<string>();
      for (const dir of folders) {
        if (!dir.startsWith(base)) continue;
        const rest = dir.slice(base.length);
        if (rest !== '' && !rest.includes('/')) names.add(rest);
      }
      return [...names].sort(cmp);
    },
  };
}
