import { type SchemaName, type SpecVersion } from './schema.js';
import type { ComplianceTree } from './tree.js';
/** The version of the register this module writes: a v0.2 compliance repo gets the dossier of dossier.ts. */
export declare const REGISTER_VERSION = "0.1";
export declare const EU_EEA: Set<string>;
export declare const TO_COMPLETE = "To complete";
/** A required text a person wrote as "to complete" is a gap, not a value. */
export declare const isPlaceholder: (value: string) => boolean;
/** Free text as an inline code span on one line: no markdown, no @mention, no line break. */
export declare function codeSpan(value: string): string;
/** The summary line of the open items. */
export declare function openSummary(count: number, withOpen: number, total: number): string;
export type Doc = Record<string, any>;
export type Src = {
    kind: 'code' | 'spec' | 'declared';
    ref: string;
};
type Value = string | Context[];
export interface Context {
    [name: string]: Value;
}
/** {{name}}, {{#each name}}...{{/each}}; a line holding only a block tag is removed with its newline. */
export declare function renderTemplate(template: string, root: Context): string;
export declare const cmp: (a: string, b: string) => number;
/** One line, trimmed, `|` escaped. */
export declare function cell(value: string): string;
export interface Cand {
    value: string;
    source: string;
}
/** One row per value; the source is the strongest (kind, then ascending string). Sorted by value. */
export declare function atomic(cands: Cand[]): Cand[];
/** Composite values: sorted by value then source; the same value from the same source is one row. */
export declare function composite(cands: Cand[]): Cand[];
/** A value of processing.yaml: a processing file has no sync, so `code` is written as `declared`. */
export declare function processingSource(source: Src): string;
export declare const duration: (r: {
    duration: string;
    trigger?: string;
}) => string;
export interface Manifest {
    /** services/<repo>/manifest.yaml or declared/<tool>/manifest.yaml */
    file: string;
    /** Folder name under services/, absent for a declared tool. */
    repo?: string;
    sha7?: string;
    sha?: string;
    doc: Doc;
}
/** Reads and validates one file of the tree. Throws when it is absent or invalid. */
export declare function readDoc(tree: ComplianceTree, rel: string, schema: SchemaName): Doc;
export interface Register {
    markdown: string;
    /** Repo name to the full sha of its sync.yaml, sorted by repo name. */
    anchors: Record<string, string>;
    /** The open items of each processing, in the order of the sections. */
    open: {
        id: string;
        name: string;
        items: string[];
    }[];
}
/** Builds the v0.1 register from a tree of a v0.1 compliance repo. Pure: reads the tree, never the clock. */
export declare function buildRegister(tree: ComplianceTree, generatedAt: string): Register;
/** The anchors.yaml that goes with a register: same repos, same shas, same generated_at, the version of the document. */
export declare function anchorsYaml(anchors: Record<string, string>, generatedAt: string, specVersion?: SpecVersion): string;
export {};
