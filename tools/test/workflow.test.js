// The CI workflow follows the repo's Actions rules: pinned actions, a read-only token, no untrusted interpolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';

const text = readFileSync(REPO_ROOT + '.github/workflows/ci.yml', 'utf8');
const lines = text.split('\n');
const jobsAt = text.indexOf('\njobs:');

test('every action is pinned to a full commit SHA with its version noted', () => {
  const uses = lines.filter((l) => /^\s*-?\s*uses:/.test(l));
  assert.ok(uses.length > 0);
  for (const l of uses) assert.match(l, /uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, l);
});

test('the token is read-only and pull_request_target is never used', () => {
  const top = text.slice(0, jobsAt);
  assert.match(top, /^permissions:\n {2}contents: read\n/m);
  assert.doesNotMatch(text, /pull_request_target/);
  assert.doesNotMatch(text.slice(jobsAt), /^\s+permissions:/m);
});

test('event data reaches scripts through env only: no ${{ }} inside run blocks, and only in known places elsewhere', () => {
  let runIndent = -1; // indent of the current run: key, or -1 outside a run block
  for (const l of lines) {
    const indent = l.length - l.trimStart().length;
    if (runIndent >= 0 && l.trim() !== '' && indent <= runIndent) runIndent = -1;
    const run = /^(\s*)(- )?run:/.exec(l);
    if (run) runIndent = run[1].length + (run[2] ? 2 : 0); // a "- run:" step's sibling keys sit two deeper
    if (!l.includes('${{')) continue;
    assert.ok(runIndent < 0, `\${{ }} inside a run block: ${l}`);
    assert.match(l, /^\s*(if: \$\{\{|group: |[A-Z_]+: \$\{\{)/, l);
  }
});

test('every checkout drops its credentials', () => {
  const checkouts = lines.map((l, i) => [l, i]).filter(([l]) => /uses: actions\/checkout@/.test(l));
  assert.ok(checkouts.length > 0);
  for (const [, i] of checkouts) {
    const block = lines.slice(i + 1, i + 6).join('\n');
    assert.match(block, /persist-credentials: false/);
  }
});

test('the gitleaks download is checked against a pinned SHA-256', () => {
  assert.match(text, /GITLEAKS_SHA256: [0-9a-f]{64}\b/);
  assert.match(text, /sha256sum -c/);
});

test('every setup step pins an exact toolchain version', () => {
  const versions = lines.filter((l) => /^\s*[\w-]+-version:/.test(l));
  assert.ok(versions.length >= 2);
  for (const l of versions) assert.match(l, /-version: '?\d+\.\d+\.\d+'?$/, l);
});

test('python runs isolated (-I), so the working directory never shadows a module', () => {
  const runs = lines.filter((l) => /run: python/.test(l));
  assert.ok(runs.length > 0);
  for (const l of runs) assert.match(l, /run: python3? -I /, l);
});

// The text of one job, from its "  <name>:" line to the next job's.
function jobText(name) {
  const start = lines.indexOf(`  ${name}:`);
  assert.ok(start > 0, `no "${name}" job`);
  const end = lines.findIndex((l, i) => i > start && /^ {2}[\w-]+:/.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

test('the browser job runs on a pinned runner with a time limit: Chromium only, built site, then the e2e suite', () => {
  const job = jobText('browser');
  assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/m);
  assert.match(job, /^ {4}timeout-minutes: 15$/m);
  // The commands in order: the browser is installed before the checks run, and the site is built before they read it.
  // Chromium alone: Firefox and WebKit run in the launch command on a machine that has them, not on every push.
  const commands = job.split('\n').filter((l) => /^\s+run: /.test(l)).map((l) => l.replace(/^\s+run: /, ''));
  assert.deepEqual(commands, ['npm ci', 'npx playwright install --with-deps chromium', 'make build', 'npm run e2e']);
});

test('the browser job checks out without credentials and pins Node like the others', () => {
  const job = jobText('browser');
  assert.match(job, /uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+persist-credentials: false/);
  assert.match(job, /uses: actions\/setup-node@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+node-version: 24\.21\.0/);
});
