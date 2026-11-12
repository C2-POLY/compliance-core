import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
/** The v0.1 Bistro Booking example, with its golden register. */
export const EXAMPLE = join(FIXTURES, 'bistro-booking');
/** The v0.2 example of the spec (examples/bistro-booking), with its golden dossier in English and French. */
export const EXAMPLE_V02 = join(FIXTURES, 'v0.2', 'bistro-booking');
export const GENERATED_AT = '2026-11-11T00:00:00Z';

export function tmp(prefix = 'cc-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function write(dir: string, path: string, content: string): void {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Every file under `dir`, as a record of repo-relative POSIX paths to text: what the platform fetches from the GitHub API. */
export function filesOf(dir: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix === '' ? e.name : `${prefix}/${e.name}`;
    if (e.isDirectory()) Object.assign(out, filesOf(dir, rel));
    else out[rel] = readFileSync(join(dir, rel), 'utf8');
  }
  return out;
}
