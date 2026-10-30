// The browser checks' command (npm run e2e): every tools/e2e/*.test.js through node --test, each test given 3 minutes,
// at most four files at once and one fewer than the machine's cores (CI's 2-core runner: one at a time). One file per
// core, each with its tabs (lib.js CONCURRENCY), left Firefox's checks timing out on a laptop.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

const DIR = 'tools/e2e';
const files = readdirSync(DIR).filter((f) => f.endsWith('.test.js')).sort().map((f) => join(DIR, f));
const concurrency = Math.max(1, Math.min(4, availableParallelism() - 1));
const { status, error } = spawnSync(process.execPath, ['--test', `--test-concurrency=${concurrency}`, '--test-timeout=180000', ...files], { stdio: 'inherit' });
if (error) console.error(error);
// A run that ended by a signal, or never started, failed.
process.exit(status ?? 1);
