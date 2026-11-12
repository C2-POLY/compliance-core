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
/** A normalised repo-relative POSIX path: no leading `/`, no empty, `.` or `..` segment. */
export declare function isRepoPath(path: string): boolean;
/**
 * A tree from a record of files, such as the files of a commit fetched from the GitHub API.
 * `dirs` adds folders that hold no file (a git tree never has one; `loadDirectory` passes them).
 * Throws on a path that is not a normalised repo-relative POSIX path.
 */
export declare function treeFromFiles(files: Readonly<Record<string, string>> | Iterable<readonly [string, string]>, dirs?: Iterable<string>): ComplianceTree;
