/**
 * The only YAML parser of the engine. Strict on purpose: YAML 1.2 core schema, a single document,
 * no `%` directive, no tag, no anchor, no alias (so no merge keys, no custom types, no expansion).
 * Throws an Error whose message is one line.
 */
export declare function parseStrict(text: string): unknown;
