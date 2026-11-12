import { type ComplianceTree } from './tree.js';
/**
 * Loads the compliance repo checked out at `dir` into a tree, keeping every safety rule of compliance-action:
 * a symbolic link is refused wherever the engine reads (files, folders under services/ and processings/, dangling links included),
 * YAML is parsed strictly, and no path leaves the repo. A file that is absent stays absent: the engine then reports it.
 */
export declare function loadDirectory(dir: string): ComplianceTree;
