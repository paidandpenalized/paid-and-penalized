// The copy gate: no copy file holds a digit (every number arrives through a placeholder), every claim id is well
// formed, and every id used resolves to a checked row of its site's claims register (sites/<id>/CLAIMS.md), and every
// row is used by its own site. A sentence that states two sourced facts names both: `claim` is null, one id, or a list.
// A copy file under sites/<id>/ may cite only that site's ids; shared copy (web/, hub/) may cite any site's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../files.js';
import { copyFiles } from './helpers.js';

// Each site's claim-id prefix.
const CLAIM_PREFIX = { hacrp: 'HACRP', hrrp: 'HRRP' };
// Each site's method constants (named in its web/constants.js, with the type each has): each carries a claim id in that
// file's CLAIMS. Not listed on purpose: a constant that is presentation, not a claim (HRRP's ROUND_COUNT_TO).
const METHOD_CONSTANTS = {
  hacrp: { REDUCTION_PCT: 'number', CUTOFF_PERCENTILE: 'number', WINSOR_LOW: 'number', WINSOR_HIGH: 'number' },
  hrrp: { NTAP_TOTAL: 'string', NTAP_SHARE: 'number', PARHM_END: 'string' },
};
const SITES = Object.keys(CLAIM_PREFIX);
const siteOfPrefix = (id) => SITES.find((site) => id.startsWith(`${CLAIM_PREFIX[site]}-`));
const CLAIM = new RegExp(`^(${Object.values(CLAIM_PREFIX).join('|')})-\\d{2}$`);

// The site a copy file belongs to (sites/<id>/...), or null for shared copy.
const siteOfFile = (file) => /^sites\/([^/]+)\//.exec(file)?.[1] ?? null;
// Why a copy file may not cite this id, or null when it may.
export const citeError = (file, id) => {
  const own = siteOfFile(file);
  return own && siteOfPrefix(id) !== own ? `${id} is not a ${CLAIM_PREFIX[own]} claim, in ${own}'s copy` : null;
};
// The ids of a register no copy or constant uses.
export const unusedRows = (rowIds, used) => [...rowIds].filter((id) => !used.has(id));

// A copy entry is a plain string (shared page chrome) or { text, claim }.
const entries = (COPY) => Object.entries(COPY).map(([key, v]) => [key, typeof v === 'string' ? { text: v, claim: null } : v]);
// An entry's claim ids: none, one, or a list.
const idsOf = (claim) => (claim === null ? [] : [claim].flat());
const importRepo = (path) => import(pathToFileURL(REPO_ROOT + path));
const constantsOf = (site) => importRepo(`sites/${site}/web/constants.js`);

test('the gate finds the shared copy and each site\'s copy', () => {
  const files = copyFiles();
  assert.ok(files.includes('web/copy.js'));
  for (const site of SITES) assert.ok(files.includes(`sites/${site}/web/copy.js`), site);
});

test('a copy file cites only its own site\'s claims; shared copy cites any', () => {
  assert.equal(citeError('sites/hacrp/web/copy.js', 'HACRP-01'), null);
  assert.equal(citeError('sites/hrrp/web/copy.js', 'HRRP-01'), null);
  assert.match(citeError('sites/hacrp/web/copy.js', 'HRRP-01'), /not a HACRP claim/);
  assert.match(citeError('sites/hrrp/pages/hospital/copy.js', 'HACRP-01'), /not a HRRP claim/);
  assert.equal(citeError('web/copy.js', 'HRRP-01'), null);
  assert.equal(citeError('hub/copy.js', 'HACRP-01'), null);
});

test('a register row no copy or constant uses is found', () => {
  assert.deepEqual(unusedRows(['HRRP-01', 'HRRP-02'], new Set(['HRRP-01'])), ['HRRP-02']);
  assert.deepEqual(unusedRows(['HRRP-01'], new Set(['HRRP-01', 'HACRP-01'])), []);
});

for (const file of copyFiles()) {
  test(`${file}: no digits in any text; claim ids well formed and its own`, async () => {
    const { COPY } = await importRepo(file);
    assert.ok(COPY && Object.keys(COPY).length > 0, 'exports a non-empty COPY');
    for (const [key, { text, claim }] of entries(COPY)) {
      assert.equal(typeof text, 'string', `${key}: text`);
      assert.doesNotMatch(text, /\d/, `${key}: a digit in copy`);
      const ids = idsOf(claim);
      assert.ok(claim === null || ids.length > 0, `${key}: an empty claim list`);
      for (const id of ids) {
        assert.ok(typeof id === 'string' && CLAIM.test(id), `${key}: claim "${id}"`);
        assert.equal(citeError(file, id), null, `${key}: ${citeError(file, id)}`);
      }
      assert.equal(new Set(ids).size, ids.length, `${key}: a claim id named twice`);
    }
  });
}

// The register's rows: table lines whose first cell is a claim id. Cells are id, claim, source, quote, checked.
const registerText = (site) => readFileSync(new URL(`../../sites/${site}/CLAIMS.md`, import.meta.url), 'utf8');
const registerRows = (site) => registerText(site)
  .split('\n')
  .filter((line) => line.startsWith(`| ${CLAIM_PREFIX[site]}-`))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

// Every claim id a site uses: copy entries in its own copy files and in the shared ones, and its method constants.
async function usedClaims(site) {
  const { CLAIMS } = await constantsOf(site);
  const used = new Set(Object.values(CLAIMS));
  for (const file of copyFiles()) {
    const { COPY } = await importRepo(file);
    for (const [, { claim }] of entries(COPY)) for (const id of idsOf(claim)) if (siteOfPrefix(id) === site) used.add(id);
  }
  return used;
}

const words = (quote) => quote.replace(/^"|"$/g, '').split(/\s+/).filter(Boolean).length;

for (const site of SITES) {
  const prefix = CLAIM_PREFIX[site];

  test(`${site}: every method constant carries a well-formed claim id of its own`, async () => {
    const constants = await constantsOf(site);
    for (const [name, type] of Object.entries(METHOD_CONSTANTS[site])) {
      assert.equal(typeof constants[name], type, name);
      assert.match(constants.CLAIMS[name], CLAIM, name);
    }
    for (const [name, claim] of Object.entries(constants.CLAIMS)) {
      assert.match(claim, CLAIM, name);
      assert.equal(siteOfPrefix(claim), site, `${name}: ${claim} is not a ${prefix} claim`);
    }
  });

  test(`${site} CLAIMS.md: every row is well formed, sourced, quoted in at most 25 words and dated`, () => {
    const rows = registerRows(site);
    assert.ok(rows.length > 0, 'the register has rows');
    const ids = new Set();
    for (const [id, claim, source, quote, checked, ...rest] of rows) {
      assert.equal(rest.length, 0, `${id}: five cells`);
      assert.match(id, CLAIM, `${id}: id`);
      assert.equal(siteOfPrefix(id), site, `${id}: a ${prefix} id`);
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
  test(`${site} CLAIMS.md: every source URL a row cites is in the Link check table`, () => {
    const text = registerText(site);
    const table = text.slice(text.indexOf('## Link check'));
    assert.ok(table.length < text.length, 'the register has a Link check section');
    const checked = new Set(table.split('\n').filter((line) => line.startsWith('| https://')).map((line) => line.split('|')[1].trim()));
    for (const [id, , source] of registerRows(site)) assert.ok(checked.has(source), `${id}: ${source} is not in the Link check table`);
  });

  test(`${site}: every claim id used in copy or constants resolves to a checked row, and every row is used`, async () => {
    const rows = new Map(registerRows(site).map((row) => [row[0], row]));
    const used = await usedClaims(site);
    assert.ok(used.size > 0);
    for (const id of used) {
      const row = rows.get(id);
      assert.ok(row, `${id}: no row in sites/${site}/CLAIMS.md`);
      assert.doesNotMatch(row[4], /unverified/, `${id}: unverified`);
      assert.match(row[2], /^https:\/\//, `${id}: source`);
    }
    assert.deepEqual(unusedRows(rows.keys(), used), [], 'a row no copy or constant uses');
  });
}
