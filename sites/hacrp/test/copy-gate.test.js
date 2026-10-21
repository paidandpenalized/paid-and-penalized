// The copy gate: no copy file holds a digit (every number arrives through a placeholder), every claim id is well
// formed, and every id used resolves to a checked row of sites/hacrp/CLAIMS.md (and every row is used).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// The register's rows: table lines whose first cell is a claim id. Cells are id, claim, source, quote, checked.
const registerRows = () => readFileSync(new URL('../CLAIMS.md', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => /^\|\s*HACRP-/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

// Every claim id the site uses: copy entries in every copy file, and the method constants.
async function usedClaims() {
  const used = new Set(Object.values(CLAIMS));
  for (const file of copyFiles()) {
    const { COPY } = await import(pathToFileURL(REPO_ROOT + file));
    for (const [, { claim }] of entries(COPY)) if (claim) used.add(claim);
  }
  return used;
}

const words = (quote) => quote.replace(/^"|"$/g, '').split(/\s+/).filter(Boolean).length;

test('CLAIMS.md: every row is well formed, sourced, quoted in at most 25 words and dated', () => {
  const rows = registerRows();
  assert.ok(rows.length > 0, 'the register has rows');
  const ids = new Set();
  for (const [id, claim, source, quote, checked, ...rest] of rows) {
    assert.equal(rest.length, 0, `${id}: five cells`);
    assert.match(id, CLAIM, `${id}: id`);
    assert.ok(!ids.has(id), `${id}: one row per id`);
    ids.add(id);
    assert.ok(claim, `${id}: claim`);
    assert.match(source, /^https:\/\/\S+$/, `${id}: source is one https:// URL`);
    assert.match(quote, /^".+"$/, `${id}: quoted support in quotation marks`);
    assert.ok(words(quote) <= 25, `${id}: quote is ${words(quote)} words`);
    assert.match(checked, /^\d{4}-\d{2}-\d{2}$/, `${id}: checked is a date, not "${checked}"`);
  }
});

test('every claim id used in copy or constants resolves to a checked row, and every row is used', async () => {
  const rows = new Map(registerRows().map((row) => [row[0], row]));
  const used = await usedClaims();
  assert.ok(used.size > 0);
  for (const id of used) {
    const row = rows.get(id);
    assert.ok(row, `${id}: no row in CLAIMS.md`);
    assert.doesNotMatch(row[4], /unverified/, `${id}: unverified`);
    assert.match(row[2], /^https:\/\//, `${id}: source`);
  }
  for (const id of rows.keys()) assert.ok(used.has(id), `${id}: a row no copy or constant uses`);
});
