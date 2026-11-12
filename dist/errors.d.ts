/** An error of the engine: its message is meant for the person who maintains the compliance repo. */
export declare class ComplianceError extends Error {
    constructor(message: string);
}
export declare const SPEC_URL = "https://github.com/C2-POLY/compliance-spec/blob/main/spec/manifest.md";
