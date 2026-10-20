// The copy gate: no copy file holds a digit (every number arrives through a placeholder), and every claim id is
// well formed. (Each id resolving to a checked row of CLAIMS.md is added with the claims register.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, repoFiles } from '../../../pipeline/files.js';
import { CLAIMS } from '../web/constants.js';

const CLAIM = /^HACRP-\d{2}$/;

const copyFiles = () => ['web/', 'sites/', 'hub/']
  .flatMap((dir) => repoFiles(dir, { untracked: true }))
  .filter((p) => p.split('/').at(-1) === 'copy.js');

// A copy entry is a plain string (shared page chrome) or { text, claim }.
const entries = (COPY) => Object.entries(COPY).map(([key, v]) => [key, typeof v === 'string' ? { text: v, claim: null } : v]);

test('the gate finds the shared copy and the HACRP copy', () => {
  const files = copyFiles();
  assert.ok(files.includes('web/copy.js'));
  assert.ok(files.includes('sites/hacrp/web/copy.js'));
});

for (const file of copyFiles()) {
  test(`${file}: no digits in any text; claim ids well formed`, async () => {
    const { COPY } = await import(pathToFileURL(REPO_ROOT + file));
    assert.ok(COPY && Object.keys(COPY).length > 0, 'exports a non-empty COPY');
    for (const [key, { text, claim }] of entries(COPY)) {
      assert.equal(typeof text, 'string', `${key}: text`);
      assert.doesNotMatch(text, /\d/, `${key}: a digit in copy`);
      assert.ok(claim === null || (typeof claim === 'string' && CLAIM.test(claim)), `${key}: claim "${claim}"`);
    }
  });
}

test('every method constant carries a well-formed claim id', async () => {
  const constants = await import('../web/constants.js');
  for (const name of ['REDUCTION_PCT', 'CUTOFF_PERCENTILE', 'WINSOR_LOW', 'WINSOR_HIGH']) {
    assert.equal(typeof constants[name], 'number', name);
    assert.match(CLAIMS[name], CLAIM, name);
  }
  for (const [name, claim] of Object.entries(CLAIMS)) assert.match(claim, CLAIM, name);
});
