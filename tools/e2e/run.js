// The browser checks' command (npm run e2e): every tools/e2e/*.test.js through node --test, each test given 3 minutes,
// as many files at once as e2eConcurrency gives (concurrency.js: CI pins it to 1).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { e2eConcurrency } from './concurrency.js';

const DIR = 'tools/e2e';
const files = readdirSync(DIR).filter((f) => f.endsWith('.test.js')).sort().map((f) => join(DIR, f));
const concurrency = e2eConcurrency(process.env, availableParallelism());
const { status, error } = spawnSync(process.execPath, ['--test', `--test-concurrency=${concurrency}`, '--test-timeout=180000', ...files], { stdio: 'inherit' });
if (error) console.error(error);
// A run that ended by a signal, or never started, failed.
process.exit(status ?? 1);
