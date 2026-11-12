/** An error of the engine: its message is meant for the person who maintains the compliance repo. */
export class ComplianceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ComplianceError';
    }
}
export const SPEC_URL = 'https://github.com/C2-POLY/compliance-spec/blob/main/spec/manifest.md';
