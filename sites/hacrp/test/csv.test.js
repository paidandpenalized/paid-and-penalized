// The dataset CSV (web/csv.js): one row per hospital in CMS's file, CMS's text verbatim, hostile text safe in a
// spreadsheet, every column in the data dictionary; its build output beside the dictionary; and the citation block
// on both page types, with its Copy script (web/client/cite.js) against a stand-in DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../../../engine/js/csv.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { REPO_ROOT, readManifest } from '../../../pipeline/files.js';
import { createContext } from '../../../pipeline/site/context.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { isoDate } from '../../../web/render/format.js';
import { COLUMNS, CSV_SCHEMA_VERSION, dictionaryText, hospitalsCsv } from '../web/csv.js';
import { rangeOf } from '../web/money.js';
import { FOOTNOTES_ID } from '../web/data.js';
import { generateHacrp } from '../web/generate.js';
import { DICTIONARY_PAGE, csvPath, dictionaryPath } from '../web/links.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { METHODS_PATH } from '../web/pages/methods.js';
import { programPage } from '../web/pages/program.js';
import { buildPlaces } from '../web/places.js';
import { programData } from '../web/program-data.js';
import { ASSETS, CASES, esc, hospital, inputs, master, measured } from './fixtures.js';
import { DATA, PROGRAM_ARGS, PAGE_CTX } from './pinned.js';
import { hospitalView } from '../web/view.js';

const DICTIONARY = readFileSync(join(REPO_ROOT, 'sites/hacrp/DATA-DICTIONARY.md'), 'utf8');

const masters = (...records) => new Map(records.map((r) => [r.ccn, r]));
const quiet = () => {};

// The pinned file's CSV, built once: without the dollar estimates (text and rows), and with them (rows).
const PLAIN_CSV = hospitalsCsv(DATA.hospitals, DATA.master);
const PLAIN_ROWS = parseCsv(PLAIN_CSV);
const DOLLAR_ROWS = parseCsv(hospitalsCsv(DATA.hospitals, DATA.master, DATA.dollars.byCcn));

test('one row per hospital in CMS\'s file; every name and city round-trips through parseCsv', () => {
  assert.equal(PLAIN_ROWS.length, DATA.hospitals.length);
  PLAIN_ROWS.forEach((row, i) => {
    const h = DATA.hospitals[i];
    const m = DATA.master.get(h.ccn);
    assert.equal(row.ccn, h.ccn);
    assert.equal(row.fiscal_year, h.fiscalYear);
    // A name or city starting with =, +, - or @ is guarded; none of the pinned ones should, so they come back as is.
    assert.equal(row.name, m.name);
    assert.equal(row.city, m.city);
    assert.equal(row.state, m.state);
    assert.equal(row.county, m.county ?? '');
  });
});

test('the CSV states CMS\'s text verbatim: hyphen-minus, CMS\'s decimals, N/A, footnote codes, period dates', () => {
  PLAIN_ROWS.forEach((row, i) => {
    const h = DATA.hospitals[i];
    assert.equal(row.total_hac_score, h.totalText);
    assert.equal(row.total_footnote, h.totalFootnote);
    assert.equal(row.payment_reduction, h.paymentReduction);
    assert.equal(row.payment_reduction_footnote, h.paymentReductionFootnote);
    for (const id of MEASURE_IDS) {
      const m = h.measures[id];
      const k = id.toLowerCase();
      assert.deepEqual(
        [row[`${k}_value`], row[`${k}_value_footnote`], row[`${k}_z`], row[`${k}_z_footnote`]],
        [m.valueText, m.valueFootnote, m.zText, m.zFootnote],
        `${h.ccn} ${id}`,
      );
    }
    assert.deepEqual(
      [row.psi90_start, row.psi90_end, row.hai_start, row.hai_end],
      [h.periods.psi90.start, h.periods.psi90.end, h.periods.hai.start, h.periods.hai.end],
    );
  });
  assert.ok(PLAIN_ROWS.some((r) => /^-0\.\d+$/.test(r.total_hac_score)), 'the pinned file has a negative score, written with a plain hyphen-minus');
  assert.ok(PLAIN_ROWS.some((r) => r.total_hac_score === 'N/A'));
  assert.ok(!PLAIN_CSV.includes('−'), 'no true minus in the data file');
});

test('a score stays as CMS wrote it: -0.2580 is not guarded or re-rounded', () => {
  const h = hospital('990001', { total: '-0.2580', decision: 'No', measures: { PSI90: measured('0.9515', '-0.2580') } });
  const csv = hospitalsCsv([h], masters(master('990001')));
  const [row] = parseCsv(csv);
  assert.equal(row.total_hac_score, '-0.2580');
  assert.equal(row.psi90_z, '-0.2580');
  assert.ok(csv.includes(',-0.2580,'));
  assert.ok(!csv.includes("'-0.2580"));
});

test('hostile text: a formula name is guarded; quotes, commas, newlines and < round-trip; numeric cells keep their sign (Review Focus 1, 5)', () => {
  const names = ['=SUM(A1)', '+1', '@cmd', '\tTAB', 'Say "hi", then\nleave <b>&</b>'];
  const hospitals = names.map((_, i) => hospital(`99000${i + 1}`, { total: '-0.1000', decision: 'No', measures: { PSI90: measured('0.9455', '-0.3000') } }));
  const records = names.map((name, i) => master(`99000${i + 1}`, { name, city: i === 0 ? '=1+1' : 'Exampleton', county: '-' }));
  const csv = hospitalsCsv(hospitals, masters(...records));
  const rows = parseCsv(csv);
  assert.equal(rows.length, names.length);
  assert.equal(rows[0].name, "'=SUM(A1)");
  assert.equal(rows[0].city, "'=1+1");
  assert.equal(rows[1].name, "'+1");
  assert.equal(rows[2].name, "'@cmd");
  assert.equal(rows[3].name, "'\tTAB");
  assert.equal(rows[4].name, names[4]);
  assert.equal(rows[0].county, "'-");
  assert.equal(rows[0].total_hac_score, '-0.1000');
  assert.ok(csv.includes('\'=SUM(A1)'));
  // CMS's own text in a text column is guarded too: a footnote cell is data, not a formula.
  const odd = hospital('990006', { total: '0.1000', decision: 'No', totalFootnote: '=HYPERLINK("x")', measures: {} });
  assert.equal(parseCsv(hospitalsCsv([odd], masters(master('990006'))))[0].total_footnote, '\'=HYPERLINK("x")');
});

test('a footnote cell with several codes is one quoted cell and round-trips', () => {
  const h = hospital('990001', { total: '0.1000', decision: 'No', totalFootnote: '12, 29', measures: { PSI90: { value: '0.9', valueFootnote: '12,29', z: '0.1000', zFootnote: '' } } });
  const csv = hospitalsCsv([h], masters(master('990001')));
  assert.ok(csv.includes('"12, 29"'));
  assert.ok(csv.includes('"12,29"'));
  const [row] = parseCsv(csv);
  assert.equal(row.total_footnote, '12, 29');
  assert.equal(row.psi90_value_footnote, '12,29');
});

test('RFC 4180 shape: UTF-8 without a BOM, CRLF line ends, a header row of the documented columns, a closing CRLF', () => {
  const csv = hospitalsCsv(DATA.hospitals.slice(0, 3), DATA.master);
  assert.notEqual(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.replaceAll('\r\n', '').includes('\n'), false, 'no bare LF outside quoted cells (the pinned names have none)');
  assert.equal(csv.split('\r\n').length, 5);
  assert.equal(csv.split('\r\n')[0], COLUMNS.map((c) => c.name).join(','));
  assert.deepEqual(Object.keys(parseCsv(csv)[0]), COLUMNS.map((c) => c.name));
  assert.equal(COLUMNS.length, 10 + 4 * MEASURE_IDS.length + 4 + 9);
  assert.deepEqual(COLUMNS.slice(-9).map((c) => c.name).filter((name) => name.endsWith('_modeled')).length, 8, 'the estimates say so in their names');
  assert.deepEqual(COLUMNS.slice(0, 2).map((c) => c.name), ['ccn', 'fiscal_year']);
});

test('a hospital with no master record is an error, not a blank row', () => {
  assert.throws(() => hospitalsCsv([CASES.yes], new Map()), /990001/);
});

// The dictionary's table: rows are "| `column` | type | meaning | CMS source column | notes |".
const documented = () => [...DICTIONARY.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);

test('every CSV column is in the data dictionary, and every documented column is in the CSV', () => {
  const columns = COLUMNS.map((c) => c.name);
  assert.deepEqual(documented(), columns, 'same columns, same order');
  assert.equal(new Set(columns).size, columns.length);
});

test('the dictionary states the schema version, the licence, the footnote crosswalk and that there is no patient information', () => {
  assert.match(DICTIONARY, new RegExp(`schema_version: ${CSV_SCHEMA_VERSION}\\b`));
  assert.match(DICTIONARY, /CC BY 4\.0/);
  assert.match(DICTIONARY, /public domain/);
  assert.match(DICTIONARY, /no patient information/i);
  assert.ok(readManifest().some((e) => e.id === FOOTNOTES_ID), 'the crosswalk is in the pinned manifest');
  assert.ok(DICTIONARY.includes(FOOTNOTES_ID), 'the dictionary names the crosswalk dataset');
  assert.match(DICTIONARY, /\{source_id\}/);
});

test('dictionaryText fills the fiscal year, dataset id and release date, and refuses an unknown placeholder or an unused value', () => {
  const text = dictionaryText(DICTIONARY, { fy: DATA.fy, source: DATA.source });
  assert.ok(text.includes(String(DATA.fy)));
  assert.ok(text.includes(DATA.source.id));
  assert.ok(text.includes(isoDate(DATA.source.pdcReleased)), 'the date as the pages word it');
  assert.ok(text.includes(`"${DATA.source.title}"`), "CMS's dataset title, from the manifest (the Markdown file is not typeset)");
  assert.doesNotMatch(text, /\{\w+\}/);
  assert.throws(() => dictionaryText('a {nope} b', { fy: 1, source: DATA.source }), /nope/);
  assert.throws(() => dictionaryText('a {source_title} b', { fy: 1, source: { ...DATA.source, title: undefined } }), /source_title/);
  assert.throws(() => dictionaryText('{fy} {source_id} {source_title}', { fy: 1, source: DATA.source }), /unused value\(s\) pdc_released/);
});

test('the build writes the CSV and the dictionary beside it (neither a page nor in the sitemap), and the dictionary as a page', () =>
  withTemp('pp-csv-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    const slice = { ...DATA, hospitals: DATA.hospitals.slice(0, 4) };
    await generateHacrp(ctx, { released: true, data: slice, log: quiet });
    assert.equal(csvPath(DATA.fy), `/data/hacrp/fy${DATA.fy}/hacrp-hospitals.csv`);
    assert.equal(dictionaryPath(DATA.fy), `/data/hacrp/fy${DATA.fy}/DATA-DICTIONARY.md`);
    const csv = readFileSync(join(dir, csvPath(DATA.fy)), 'utf8');
    assert.equal(csv, hospitalsCsv(slice.hospitals, DATA.master, DATA.dollars.byCcn));
    assert.equal(readFileSync(join(dir, dictionaryPath(DATA.fy)), 'utf8'), dictionaryText(DICTIONARY, { fy: DATA.fy, source: DATA.source }));
    // The program page, the dictionary page, the Methods page, the four hospitals and a page for each place they are in.
    const places = buildPlaces({ hospitals: slice.hospitals, master: DATA.master, rows: programData({ hospitals: slice.hospitals, master: DATA.master, model: DATA.model }).rows });
    assert.ok(places.list.length > 0);
    assert.equal(ctx.pages, 1 + 1 + 1 + 4 + places.list.length);
    assert.ok(existsSync(join(dir, METHODS_PATH, 'index.html')), 'the Methods page is written');
    assert.ok(!ctx.indexable.some((p) => p.startsWith('/data/')));
    // The page: the file's own words in the site shell, its columns table labelled by its heading, column names in mono.
    assert.ok(ctx.indexable.includes(DICTIONARY_PAGE));
    const page = readFileSync(join(dir, DICTIONARY_PAGE, 'index.html'), 'utf8');
    assert.match(page, /<h1>Data dictionary: hacrp-hospitals\.csv<\/h1>/);
    assert.match(page, /<h2 id="dict-columns" class="h-sm">Columns<\/h2>/);
    assert.match(page, /<table class="gb gb--dict" aria-labelledby="dict-columns">/);
    assert.equal(page.match(/<th scope="row"><code>[a-z0-9_]+<\/code><\/th>/g).length, COLUMNS.length);
    assert.ok(page.includes(`dataset ${DATA.source.id}`), 'filled as the file is');
    assert.match(page, /<meta name="description" content="hacrp-hospitals\.csv holds what CMS reports/);
  }));

// ---------- the citation block ----------

const hospitalHtml = (h, overrides = {}) => {
  const view = hospitalView({ ...inputs(h, { model: DATA.model, estimate: DATA.estimate, footnotes: DATA.footnotes, boundaryText: DATA.boundaryText }), ...overrides });
  const whatif = view.scored ? { hospital: h, model: DATA.model, estimate: DATA.estimate, range: { low: -0.5, high: 0.8 } } : null;
  return { view, html: hospitalPage({ ...PAGE_CTX, view, source: DATA.source, robots: null, assets: ASSETS, whatif }) };
};
const sourceText = `Source: CMS Provider Data Catalog, HACRP FY${DATA.fy} (${DATA.source.id}), released ${isoDate(DATA.source.pdcReleased)}.`;
const citeBlock = (page) => /<section class="block cite"[\s\S]*?<\/section>/.exec(page)?.[0];
// The citation's text, without the span that keeps the dataset id on one line (the copied text is the same).
const citeText = (block) => /<p class="cite__text"[^>]*>([\s\S]*?)<\/p>/.exec(block)[1].replace(/<\/?span[^>]*>/g, '');
// A data link to a site path, as the page writes it: its address printed in full on paper (data-print-href).
const dataLink = (path, text) => `<a href="${path}" data-print-href="https://paidandpenalized.org${path}">${text}</a>`;
const CSV_LINK = dataLink(csvPath(DATA.fy), 'Download all hospitals’ data (CSV)');
const DICTIONARY_LINK = dataLink(DICTIONARY_PAGE, 'Data dictionary');

test('the program page cites its title, FY, canonical URL and source line, and links the CSV and the dictionary', () => {
  const page = programPage(PROGRAM_ARGS);
  const block = citeBlock(page);
  assert.ok(block, 'citation block');
  const text = citeText(block);
  for (const part of ['Paid &amp; Penalized', `Hospital-Acquired Conditions (HACRP), FY${DATA.fy}`, `https://paidandpenalized.org/hacrp/`, esc(sourceText)]) {
    assert.ok(text.includes(part), part);
  }
  assert.doesNotMatch(text, /accessed/i, 'no clock in the page');
  assert.ok(block.includes(`<span class="nw">(${DATA.source.id})</span>`), 'the dataset id never breaks at its hyphen');
  assert.match(block, /<button type="button" class="fig__btn" data-cite-copy hidden>Copy citation<\/button>/);
  assert.match(block, /aria-live="polite"/);
  assert.ok(page.includes(CSV_LINK));
  assert.ok(page.includes(DICTIONARY_LINK));
  assert.ok(page.includes('<script type="module" src="/assets/cite.test.js">'));
});

test('every hospital page, whatever its status, cites its name, place, FY, canonical URL and source line, and links the data', () => {
  for (const [name, h] of Object.entries(CASES)) {
    const { view, html: page } = hospitalHtml(h);
    const block = citeBlock(page);
    assert.ok(block, `${name}: citation block`);
    const text = citeText(block);
    assert.ok(text.includes(`https://paidandpenalized.org${view.path}`), `${name}: URL`);
    assert.ok(text.includes(`FY${DATA.fy}`), `${name}: FY`);
    assert.ok(text.includes('Example General Hospital'), `${name}: title`);
    assert.ok(text.includes(esc(sourceText)), `${name}: source line`);
    assert.ok(page.includes(CSV_LINK), `${name}: CSV link`);
    assert.ok(page.includes(DICTIONARY_LINK), `${name}: dictionary link`);
    assert.ok(page.includes('/assets/cite.test.js'), `${name}: script`);
  }
});

test('hostile text in a name is text in the citation, never markup', () => {
  const { html: page } = hospitalHtml(CASES.no, { master: master('990002', { name: '<img src=x onerror=alert(1)> & "Co"', state: 'AL' }) });
  const text = citeText(citeBlock(page));
  assert.ok(text.includes(esc('<img src=x onerror=alert(1)> & "Co"')));
  assert.ok(!text.includes('<img'));
});

test('a page with the citation block needs the cite script path', () => {
  const noCite = { ...ASSETS, js: { ...ASSETS.js, cite: undefined } };
  assert.throws(() => programPage({ ...PROGRAM_ARGS, assets: noCite }), /every script must be a path/);
});

// ---------- the Copy script ----------

const ORIGINAL = { document: globalThis.document, window: globalThis.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };

async function runCite(t, { clipboard, selection = true }) {
  const handlers = {};
  const status = { textContent: '' };
  const textNode = { textContent: 'Paid & Penalized. A cite.' };
  const button = { hidden: true, addEventListener: (type, fn) => { handlers[type] = fn; } };
  const selected = [];
  const section = {
    dataset: { copied: 'Copied.', failed: 'Not copied; the citation is selected.' },
    querySelector: (s) => ({ '[data-cite-copy]': button, '[data-cite-text]': textNode, '[data-cite-status]': status })[s],
  };
  globalThis.document = {
    querySelectorAll: (s) => (s === '.cite' ? [section] : []),
    createRange: () => ({ selectNodeContents: (n) => selected.push(['range', n]) }),
  };
  globalThis.window = { getSelection: () => (selection ? { removeAllRanges() {}, addRange: (r) => selected.push(['add', r]) } : null) };
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true });
  t.after(() => {
    for (const k of ['document', 'window']) {
      if (ORIGINAL[k] === undefined) delete globalThis[k];
      else globalThis[k] = ORIGINAL[k];
    }
    Object.defineProperty(globalThis, 'navigator', ORIGINAL.navigator);
  });
  await import(`../../../web/client/cite.js?run=${Math.random()}`);
  return { button, status, selected, click: async () => { await handlers.click(); } };
}

test('cite script: shows the button, copies the text, says Copied', async (t) => {
  const written = [];
  const seen = [];
  const s = await runCite(t, { clipboard: { writeText: async (x) => { written.push(x); seen.push(s.status.textContent); } } });
  assert.equal(s.button.hidden, false);
  await s.click();
  assert.deepEqual(written, ['Paid & Penalized. A cite.']);
  assert.equal(s.status.textContent, 'Copied.');
  assert.deepEqual(s.selected, []);
  // A second click clears the line before writing it again, so a screen reader announces it again.
  await s.click();
  assert.deepEqual(seen, ['', '']);
  assert.equal(s.status.textContent, 'Copied.');
});

test('cite script: when the copy fails (or there is no clipboard), the text is selected and the status says so', async (t) => {
  const failing = await runCite(t, { clipboard: { writeText: async () => { throw new Error('denied'); } } });
  await failing.click();
  assert.equal(failing.status.textContent, 'Not copied; the citation is selected.');
  assert.equal(failing.selected.length, 2);
  const none = await runCite(t, { clipboard: undefined });
  await none.click();
  assert.equal(none.status.textContent, 'Not copied; the citation is selected.');
  // A browser with no selection object still gets the message, with no error.
  const bare = await runCite(t, { clipboard: undefined, selection: false });
  await bare.click();
  assert.equal(bare.status.textContent, 'Not copied; the citation is selected.');
});

test('the dollar columns are this site\'s estimates, from each hospital\'s row, whole dollars that add; blank without one', () => {
  let estimated = 0;
  DOLLAR_ROWS.forEach((row, i) => {
    const d = DATA.dollars.byCcn.get(DATA.hospitals[i].ccn);
    assert.equal(row.dollars_status, d.status);
    const cells = ['inpatient_payment_modeled', 'hrrp_dollars_modeled', 'hvbp_dollars_modeled', 'hac_at_stake_modeled', 'hac_dollars_modeled', 'net_dollars_modeled'].map((k) => row[k]);
    if (d.status !== 'estimated') {
      assert.deepEqual(cells, ['', '', '', '', '', ''], d.status);
      return;
    }
    estimated++;
    const [total, hrrp, hvbp, atStake, hac, net] = cells.map(Number);
    assert.deepEqual([total, hrrp, hvbp, atStake, hac, net], [d.total, d.hrrp, d.hvbp, d.atStake, d.hac, d.net]);
    assert.equal(hrrp + hvbp + hac, net, 'a row adds exactly');
  });
  assert.equal(estimated, DATA.dollars.national.hospitals);
  // Without the estimates (a synthetic hospital), the dollar cells are blank.
  const [blank] = parseCsv(hospitalsCsv([CASES.yes], masters(master('990001'))));
  assert.equal(blank.dollars_status, '');
  assert.equal(blank.hac_dollars_modeled, '');
});

test('the HAC cut\'s likely range: two columns in the cut\'s own sign, low the larger cut; 0 and 0 with no cut; blank without an estimate', () => {
  let cut = 0;
  for (const r of DOLLAR_ROWS) {
    const d = DATA.dollars.byCcn.get(r.ccn);
    if (d.status !== 'estimated') {
      assert.deepEqual([r.hac_dollars_low_modeled, r.hac_dollars_high_modeled], ['', ''], r.ccn);
      continue;
    }
    const [low, high, est] = [Number(r.hac_dollars_low_modeled), Number(r.hac_dollars_high_modeled), Number(r.hac_dollars_modeled)];
    if (!d.cut) {
      assert.deepEqual([low, high, est], [0, 0, 0], r.ccn);
      continue;
    }
    cut++;
    const [lo, hi] = rangeOf(DATA.dollars.bands, 'hac', d.stratum, d.atStake);
    assert.deepEqual([low, high], [-hi, -lo], r.ccn);
    assert.ok(low < est && est < high, r.ccn);
  }
  assert.ok(cut > 500);
});
