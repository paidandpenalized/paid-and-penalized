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
    const run = /^(\s*)(?:- )?run:/.exec(l);
    if (run) runIndent = run[1].length;
    if (!l.includes('${{')) continue;
    assert.ok(runIndent < 0, `\${{ }} inside a run block: ${l}`);
    assert.match(l, /^\s*(if: \$\{\{|group: |cancel-in-progress: \$\{\{|[A-Z_]+: \$\{\{)/, l);
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
