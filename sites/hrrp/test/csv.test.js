// The Readmissions CSVs (web/csv.js) and the data dictionary: the full hospitals file with the 31 columns, units in its
// headers, the CCN as plain text, the per-row rules (beds source words, the inactive date or "date not listed", the
// penalized Y/N blank under 25 cases), hostile text safe in a spreadsheet, the area files' 8 columns, the files the build
// writes, and the dictionary (the Markdown file and its page) naming every column. Methods promises these conventions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../../../engine/js/csv.js';
import { CONDS, MIN_DISCHARGES } from '../../../engine/js/hrrp/formula.js';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { createContext } from '../../../pipeline/site/context.js';
import { ASSETS, withTemp } from '../../../pipeline/test/helpers.js';
import { COPY as METHODS_COPY } from '../web/methods/copy.js';
import {
  CSV_SCHEMA_VERSION, HOSPITAL_COLUMNS, dictionaryText, hospitalCsv, hospitalsCsvName, placeCsv, placeColumns,
} from '../web/csv.js';
import { generateHrrp } from '../web/generate.js';
import { DICTIONARY_PAGE, METHODS_PATH, csvPath, dictionaryPath } from '../web/links.js';
import { hospital, loadHrrpOnce, NAME } from './fixtures.js';

const DATA = loadHrrpOnce();
const DICTIONARY = readFileSync(join(REPO_ROOT, 'sites/hrrp/DATA-DICTIONARY.md'), 'utf8');
const quiet = { log: () => {} };
const ALL_CSV = hospitalCsv(DATA.hospitals);
const ALL_ROWS = parseCsv(ALL_CSV);
const one = (extra) => parseCsv(hospitalCsv([hospital(extra)]))[0];

test('the full file: one row per hospital, the 31 columns of the source in order, CRLF with a trailing CRLF', () => {
  assert.equal(HOSPITAL_COLUMNS.length, 31);
  assert.equal(ALL_ROWS.length, DATA.hospitals.length);
  assert.deepEqual(Object.keys(ALL_ROWS[0]), HOSPITAL_COLUMNS.map((c) => c.name));
  assert.ok(ALL_CSV.endsWith('\r\n'));
  assert.ok(!/(^|[^\r])\n/.test(ALL_CSV.replace(/"[^"]*"/g, '""')), 'no bare LF outside a quoted cell');
  assert.equal(ALL_CSV.split('\r\n').length, DATA.hospitals.length + 2, 'header, rows, and the empty piece after the last CRLF');
});

test('header names carry units', () => {
  const names = HOSPITAL_COLUMNS.map((c) => c.name);
  for (const unit of ['Payment reduction (%)', 'Estimated penalty ($, modeled)', 'Inactive (date)', 'penalized (Y/N)']) {
    assert.ok(names.some((n) => n.includes(unit)), unit);
  }
  for (const k of CONDS) assert.ok(names.includes(`${k} penalized (Y/N)`) && names.includes(`${k} discharges`) && names.includes(`${k} ERR`), k);
  assert.ok(placeColumns('State').map((c) => c.name).includes('Penalized (% of measured)'));
  assert.ok(placeColumns('State').map((c) => c.name).includes('Estimated penalties ($, modeled)'));
});

test('the CCN is plain text: no ="..." wrapper, a leading zero kept in the file', () => {
  assert.ok(!ALL_CSV.includes('="'));
  const zero = DATA.hospitals.find((h) => h.id.startsWith('0'));
  assert.ok(zero, 'the file has a CCN with a leading zero');
  const row = ALL_ROWS[DATA.hospitals.indexOf(zero)];
  assert.equal(row.CCN, zero.id);
  assert.match(row.CCN, /^\d{6}$/);
  assert.equal(one({ id: '990001' }).CCN, '990001');
});

test('beds source words: the Provider of Services file, the cost report, and blank with no beds', () => {
  assert.equal(one({ beds: 220 })['Beds source'], 'certified (Provider of Services file)');
  assert.equal(one({ beds: 90, bedsSrc: 'cr' })['Beds source'], 'cost report');
  const none = one({ beds: null, bedsSrc: 'cr' });
  assert.equal(none.Beds, '');
  assert.equal(none['Beds source'], '');
  assert.equal(one({ beds: 220 }).Beds, '220');
  assert.ok(ALL_ROWS.some((r) => r['Beds source'] === 'cost report'));
});

test('inactive: the date CMS lists, "date not listed" when it lists none, blank when active', () => {
  assert.equal(one({ inactive: { date: '2026-03-30', reason: 'x' } })['Inactive (date)'], '2026-03-30');
  assert.equal(one({ inactive: { date: null, reason: 'x' } })['Inactive (date)'], 'date not listed');
  assert.equal(one({ inactive: {} })['Inactive (date)'], 'date not listed');
  assert.equal(one({ inactive: null })['Inactive (date)'], '');
});

test('a condition\'s penalized column is blank, not 0, under the case minimum; its discharges still show', () => {
  const row = one({ c: {
    HF: { n: MIN_DISCHARGES, err: 1.1, flag: 1, ratio: 0.1 },
    AMI: { n: MIN_DISCHARGES - 1, err: 1.2, flag: 1, ratio: 0.1 },
    PN: { n: 60, err: 0.9, flag: 0, ratio: 0.1 },
    COPD: { n: 60, err: null, flag: 0 },
  } });
  assert.equal(row['HF penalized (Y/N)'], 'Y');
  assert.equal(row['PN penalized (Y/N)'], 'N');
  assert.equal(row['AMI penalized (Y/N)'], '');
  assert.equal(row['AMI discharges'], String(MIN_DISCHARGES - 1));
  assert.equal(row['COPD penalized (Y/N)'], '', 'no ratio, not measured');
  assert.equal(row['CABG penalized (Y/N)'], '', 'no cases at all');
  for (const r of ALL_ROWS) for (const k of CONDS) assert.ok(['Y', 'N', ''].includes(r[`${k} penalized (Y/N)`]));
  DATA.hospitals.forEach((h, i) => {
    for (const k of CONDS) {
      const n = h.c[k]?.n ?? 0;
      if (n < MIN_DISCHARGES) assert.equal(ALL_ROWS[i][`${k} penalized (Y/N)`], '', `${k} under the minimum`);
    }
  });
});

test('values are written as the data holds them: the factor, the cut, the dollars, a blank for no estimate', () => {
  const row = one({ paf: 0.9905, red: 0.95, pen: 123456, dual: 0.2351, peer: 3 });
  assert.equal(row['Payment adjustment factor'], '0.9905');
  assert.equal(row['Payment reduction (%)'], '0.95');
  assert.equal(row['Estimated penalty ($, modeled)'], '123456');
  assert.equal(row['Dual proportion'], '0.2351');
  assert.equal(row['Peer group'], '3');
  assert.equal(one({ pen: null })['Estimated penalty ($, modeled)'], '');
  assert.equal(one({ cbsaName: null })['Metro area'], '');
});

test('hostile text is safe in a spreadsheet: a leading =, +, -, @, tab or CR gets a quote; a comma, quote or newline is quoted', () => {
  for (const lead of ['=', '+', '-', '@', '\t', '\r']) {
    const evil = `${lead}HYPERLINK("http://example.org","x")`;
    const row = one({ name: evil, city: evil, cbsaName: evil });
    for (const column of ['Hospital', 'City', 'Metro area']) assert.equal(row[column], `'${evil}`, `${JSON.stringify(lead)} in ${column}`);
  }
  assert.equal(one({ name: 'A, "B"\nC' }).Hospital, 'A, "B"\nC');
  // A real minus in a number column is a number, not a formula.
  assert.equal(parseCsv(placeCsv([{ label: 'X', n: 1, nMeasured: 1, nPen: 0, pctPen: 0, meanRed: -0.5, nGe1: 0, penTotal: 0 }]))[0]['Average cut (%)'], '-0.5');
});

test('the area files: 8 columns with the counts behind each share, the first named for the kind of area', () => {
  assert.equal(placeColumns('State').length, 8);
  const row = { label: '=EVIL', n: 10, nMeasured: 8, nPen: 5, pctPen: 62.5, meanRed: 0.4567, nGe1: 2, penTotal: 1234567.8 };
  for (const label of ['State', 'Metro area', 'Division', 'Region']) {
    const rows = parseCsv(placeCsv([row], label));
    assert.equal(Object.keys(rows[0]).length, 8);
    assert.equal(Object.keys(rows[0])[0], label);
    assert.deepEqual(Object.keys(rows[0]).slice(1), placeColumns('State').slice(1).map((c) => c.name));
    assert.equal(rows[0][label], "'=EVIL");
    assert.equal(rows[0]['Penalized (% of measured)'], '62.5');
    assert.equal(rows[0]['Average cut (%)'], '0.46');
    assert.equal(rows[0]['Estimated penalties ($, modeled)'], '1234568');
  }
  assert.ok(placeCsv([row]).endsWith('\r\n'));
});

// ---------- the dictionary ----------

// The dictionary's tables: rows are "| `column` | type | meaning | notes |", under "## Hospital files" and "## Area files".
const documented = (heading) => {
  const section = DICTIONARY.split(/^## /m).find((s) => s.startsWith(heading));
  assert.ok(section, `the dictionary has a "${heading}" section`);
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
};

test('the dictionary lists every hospital column in file order, and nothing else', () => {
  assert.deepEqual(documented('Hospital files'), HOSPITAL_COLUMNS.map((c) => c.name));
});

test('the dictionary lists every area column (the first by the kinds of area it is named for)', () => {
  const area = documented('Area files');
  assert.deepEqual(area.slice(1), placeColumns('State').slice(1).map((c) => c.name));
  for (const kind of ['State', 'Metro area', 'Division', 'Region']) assert.ok(DICTIONARY.includes(`\`${kind}\``), kind);
  assert.equal(area[0], 'State');
});

test('the dictionary states the schema version, the conventions Methods promises, and that there is no patient information', () => {
  assert.match(DICTIONARY, new RegExp(`schema_version: ${CSV_SCHEMA_VERSION}\\b`));
  assert.match(DICTIONARY, /CRLF/);
  assert.match(DICTIONARY, /plain text/);
  assert.match(DICTIONARY, /blank/);
  assert.match(DICTIONARY, /no patient information/i);
  assert.match(DICTIONARY, /date not listed/);
  assert.match(DICTIONARY, /cost report/);
  assert.match(DICTIONARY, /certified \(Provider of Services file\)/);
  // Methods' promise: the three conventions it states are the dictionary's too.
  assert.match(METHODS_COPY.reuseText.text, /CCN is plain text/);
  assert.match(METHODS_COPY.reuseText.text, /headers name their units/);
  assert.match(METHODS_COPY.reuseText.text, /penalized column is blank/);
});

test('the dictionary fills its placeholders from the build, none left over and none typed twice', () => {
  const filled = dictionaryText(DICTIONARY, { edition: 'FY2027', fy: 2027, minCases: MIN_DISCHARGES });
  assert.ok(!/\{[a-z]+\}/i.test(filled), 'no placeholder left');
  assert.ok(filled.includes(hospitalsCsvName(2027)));
  assert.ok(filled.includes('FY2027'));
  assert.throws(() => dictionaryText('A {nope}.', { edition: 'FY2027', fy: 2027, minCases: 25 }), /nope/);
});

// ---------- the build ----------

test('the build writes the hospitals file and the dictionary beside the other downloads, and the dictionary page renders it', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const data = { ...DATA, hospitals: DATA.hospitals.slice(0, 8) };
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data, released: false, ...quiet });
    const fy = data.meta.fy;
    const file = join(dir, csvPath(fy, hospitalsCsvName(fy).replace(/\.csv$/, '')));
    assert.ok(existsSync(file), 'hrrp-fy<fy>-hospitals.csv');
    assert.equal(file.slice(dir.length), `/data/hrrp/fy${fy}/hrrp-fy${fy}-hospitals.csv`);
    const rows = parseCsv(readFileSync(file, 'utf8'));
    assert.deepEqual(rows.map((r) => r.CCN), data.hospitals.map((h) => h.id));
    const md = readFileSync(join(dir, dictionaryPath(fy)), 'utf8');
    assert.equal(dictionaryPath(fy), `/data/hrrp/fy${fy}/DATA-DICTIONARY.md`);
    assert.ok(md.startsWith('# '));
    assert.ok(!/\{[a-z]+\}/i.test(md));

    const page = readFileSync(join(dir, DICTIONARY_PAGE, 'index.html'), 'utf8');
    assert.equal(DICTIONARY_PAGE, '/hrrp/data/');
    assert.match(page, /<h1>[^<]*[Dd]ata dictionary[^<]*<\/h1>/);
    for (const c of HOSPITAL_COLUMNS) assert.ok(page.includes(`<th scope="row"><code>${c.name.replace(/&/g, '&amp;')}</code></th>`), c.name);
    assert.equal([...page.matchAll(/<th scope="row">/g)].length, HOSPITAL_COLUMNS.length + placeColumns('State').length);
    assert.ok(page.includes(`href="${csvPath(fy, hospitalsCsvName(fy).replace(/\.csv$/, ''))}"`), 'the page links the file');
    assert.ok(page.includes(`href="${dictionaryPath(fy)}"`), 'and the Markdown dictionary');
    assert.doesNotMatch(page, /undefined|NaN|\{[a-z]+\}/);
    assert.match(page, /<meta name="robots" content="noindex">/);
    const methods = readFileSync(join(dir, METHODS_PATH, 'index.html'), 'utf8');
    assert.ok(methods.includes(`href="${DICTIONARY_PAGE}"`), 'Methods links the dictionary page');
  }));

test('the dictionary page is indexable when released, as a page of the site', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data: { ...DATA, hospitals: DATA.hospitals.slice(0, 5) }, released: true, ...quiet });
    assert.ok(ctx.indexable.includes(DICTIONARY_PAGE));
  }));

test('the synthetic name stays out of the real file', () => {
  assert.ok(!ALL_CSV.includes(NAME));
});
