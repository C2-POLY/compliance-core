#!/usr/bin/env node
// Empties dist/ before tsc writes it, so that a removed source file leaves no stale output behind.
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

rmSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'), { recursive: true, force: true });
