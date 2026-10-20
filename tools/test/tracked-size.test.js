// The size limit for files in git, enforced in CI too (the pre-commit hook can be skipped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { REPO_ROOT, repoFiles } from '../../pipeline/files.js';
import { MAX_BYTES } from '../hygiene/precommit-checks.js';

test('no tracked file is 10 MiB or more', () => {
  const paths = repoFiles();
  assert.ok(paths.length > 0);
  const big = paths.filter((p) => statSync(REPO_ROOT + p).size >= MAX_BYTES);
  assert.deepEqual(big, []);
});
