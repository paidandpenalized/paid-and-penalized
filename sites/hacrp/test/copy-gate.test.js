// The copy gate: no copy file holds a digit (every number arrives through a placeholder), every claim id is well
// formed, and every id used resolves to a checked row of sites/hacrp/CLAIMS.md (and every row is used). A sentence
// that states two sourced facts names both: `claim` is null, one id, or a list of ids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { copyFiles } from '../../../pipeline/test/helpers.js';
import { CLAIMS } from '../web/constants.js';

const CLAIM = /^HACRP-\d{2}$/;

// A copy entry is a plain string (shared page chrome) or { text, claim }.
const entries = (COPY) => Object.entries(COPY).map(([key, v]) => [key, typeof v === 'string' ? { text: v, claim: null } : v]);
// An entry's claim ids: none, one, or a list.
const idsOf = (claim) => (claim === null ? [] : [claim].flat());

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
      const ids = idsOf(claim);
      assert.ok(claim === null || ids.length > 0, `${key}: an empty claim list`);
      for (const id of ids) assert.ok(typeof id === 'string' && CLAIM.test(id), `${key}: claim "${id}"`);
      assert.equal(new Set(ids).size, ids.length, `${key}: a claim id named twice`);
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
    for (const [, { claim }] of entries(COPY)) for (const id of idsOf(claim)) used.add(id);
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

// The register's link check: each source URL a row cites is a row of the "Link check" table, with its status.
test('CLAIMS.md: every source URL a row cites is in the Link check table', () => {
  const text = readFileSync(new URL('../CLAIMS.md', import.meta.url), 'utf8');
  const table = text.slice(text.indexOf('## Link check'));
  assert.ok(table.length < text.length, 'the register has a Link check section');
  const checked = new Set(table.split('\n').filter((line) => line.startsWith('| https://')).map((line) => line.split('|')[1].trim()));
  for (const [id, , source] of registerRows()) assert.ok(checked.has(source), `${id}: ${source} is not in the Link check table`);
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
