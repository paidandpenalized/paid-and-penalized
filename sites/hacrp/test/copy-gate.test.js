// The copy gate: no copy file holds a digit (every number arrives through a placeholder), and every claim id is
// well formed. (Each id resolving to a checked row of CLAIMS.md is added with the claims register.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { CLAIMS } from '../web/constants.js';

const CLAIM = /^HACRP-\d{2}$/;

function copyFiles() {
  const found = existsSync(REPO_ROOT + 'web/copy.js') ? ['web/copy.js'] : [];
  for (const dir of ['sites', 'hub']) {
    if (!existsSync(REPO_ROOT + dir)) continue;
    for (const p of readdirSync(REPO_ROOT + dir, { recursive: true })) {
      if (p.split('/').at(-1) === 'copy.js') found.push(`${dir}/${p}`);
    }
  }
  return found;
}

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
