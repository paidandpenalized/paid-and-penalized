// The fixes from the /code-review of milestones 2 to 4 (m2m4-review-fixes.md), one test or more for each finding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS, PEERS } from '../../../engine/js/hrrp/formula.js';
import { columns } from '../../../web/charts/columns.js';
import { createContext } from '../../../pipeline/site/context.js';
import { headersFile, headersFor, parseHeaders } from '../../../pipeline/site/headers.js';
import { textOf } from '../../../pipeline/site/html.js';
import { ASSETS, withTemp } from '../../../pipeline/test/helpers.js';
import { conditionShort } from '../web/derive.js';
import { HISTORY_SIMULATED_FYS } from '../web/constants.js';
import { coinFlip, ridges } from '../web/figures/picture-data.js';
import { dualBins, howData } from '../web/figures/how-data.js';
import { howPart } from '../web/figures/how.js';
import { generateHrrp } from '../web/generate.js';
import { buildPlaces } from '../web/places.js';
import { dictionaryPage } from '../web/pages/dictionary.js';
import { methodsPage } from '../web/pages/methods.js';
import { areaContext, methodsView } from '../web/view.js';
import { ALL, CONDITIONS, HISTORY, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';

const quiet = { log: () => {} };
const m = (n, err, flag = 0) => ({ n, err, flag, ratio: 0.1 });

// ---------- 1. Step 3's band labels never overlap ----------

// The band labels a drawing carries: [{ text, x }] and the drawing's bands as [x0, x1] in drawing units.
function bandLabels(svg) {
  const labels = [...svg.matchAll(/<text class="chart-band__label" x="([\d.]+)"[^>]*>([^<]*)</g)].map((r) => ({ x: Number(r[1]), text: r[2] }));
  const bands = [...svg.matchAll(/<rect class="chart-band[^"]*" x="([\d.-]+)" y="[\d.]+" width="([\d.]+)"/g)].map((r) => [Number(r[1]), Number(r[1]) + Number(r[2])]);
  return { labels, bands };
}

test('Step 3 on the real cutoffs, wide and phone: a band label is inside its band and never touches another', () => {
  const data = loadHrrpOnce();
  const dual = dualBins(data.hospitals, data.meta.peerCutoffs);
  const CHAR = 6;  // a little under the 6.4 units a character is estimated to take in the 10px type (columns.js)
  for (const width of [300, 560]) {
    const bands = dual.bands.map((b) => ({ x0: b.x0, x1: b.x1, label: `Group ${b.peer}`, short: String(b.peer) }));
    const svg = columns({ bins: dual.bins.map((b) => ({ ...b, cls: 'chart-col', tip: 'x' })), domain: [0, dual.top], ticks: dual.ticks, format: String, width, height: 150, bands }).text;
    const { labels, bands: spans } = bandLabels(svg);
    assert.equal(spans.length, dual.bands.length, `${width}: every band is shaded`);
    const boxes = labels.map((l) => ({ lo: l.x - (l.text.length * CHAR) / 2, hi: l.x + (l.text.length * CHAR) / 2, text: l.text }));
    boxes.forEach((b, i) => { if (i) assert.ok(boxes[i - 1].hi < b.lo, `${width}: "${boxes[i - 1].text}" and "${b.text}" overlap`); });
    spans.forEach(([lo, hi], i) => {
      const own = labels.find((l) => l.x > lo && l.x < hi);
      if (own) assert.ok(own.text.length * CHAR <= hi - lo, `${width}: "${own.text}" fits band ${i + 1}`);
    });
    assert.ok(labels.length >= 2, `${width}: the bands are still labeled`);
  }
});

test('band labels: the label where it fits, else the short form, else none; the shading stays', () => {
  const base = { bins: [{ x0: 0, x1: 1, n: 3, cls: 'chart-col', tip: 'a' }], domain: [0, 100], ticks: [0, 100], format: String, width: 300, height: 150 };
  const out = (bands) => bandLabels(columns({ ...base, bands }).text);
  assert.deepEqual(out([{ x0: 0, x1: 60, label: 'Group 1', short: '1' }]).labels.map((l) => l.text), ['Group 1']);
  assert.deepEqual(out([{ x0: 0, x1: 10, label: 'Group 1', short: '1' }]).labels.map((l) => l.text), ['1']);
  const tiny = out([{ x0: 0, x1: 1, label: 'Group 1', short: '1' }]);
  assert.deepEqual(tiny.labels, []);
  assert.equal(tiny.bands.length, 1);
  assert.deepEqual(out([{ x0: 0, x1: 10, label: 'Group 1' }]).labels, [], 'no short form, no room: none');
});

// ---------- 2. Unreleased data files are noindex by header ----------

test('while unreleased, a production build sends X-Robots-Tag: noindex for the data files; released, none; pages keep their meta robots', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const data = { ...loadHrrpOnce(), hospitals: loadHrrpOnce().hospitals.slice(0, 5) };
    const held = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(held, { data, released: false, ...quiet });
    const files = held.noindexFiles;
    assert.equal(files.length, 4, 'largest-penalties, states, hospitals CSVs and the dictionary Markdown');
    assert.ok(files.every((p) => p.startsWith('/data/hrrp/')), files.join());
    assert.ok(files.some((p) => p.endsWith('.csv')) && files.some((p) => p.endsWith('.md')));
    const rules = parseHeaders(headersFile({ env: 'production', noindexFiles: files }));
    for (const p of files) assert.equal(headersFor(rules, p)['x-robots-tag'], 'noindex', p);
    for (const p of ['/hrrp/', '/hacrp/', '/', '/assets/site.ab12cd34.css']) assert.equal(headersFor(rules, p)['x-robots-tag'], undefined, p);
    // Every other build already says noindex on every path, once.
    const preview = parseHeaders(headersFile({ env: 'preview', noindexFiles: files }));
    assert.equal(headersFor(preview, files[0])['x-robots-tag'], 'noindex');

    const open = createContext({ outDir: `${dir}-open`, env: 'production', assets: ASSETS });
    generateHrrp(open, { data, released: true, ...quiet });
    assert.deepEqual(open.noindexFiles, []);
    assert.ok(!headersFile({ env: 'production', noindexFiles: open.noindexFiles }).includes('X-Robots-Tag'));
  }));

test('a build with no noindex data files (HACRP, the hub) writes the same _headers as before', () => {
  assert.equal(headersFile({ env: 'production' }), headersFile({ env: 'production', noindexFiles: [] }));
  assert.ok(!headersFile({ env: 'production' }).includes('X-Robots-Tag'));
});

// ---------- 3. Medicare-dependent row guard ----------

const mdhRows = (fy, endDate) => {
  const meta = { ...META, fy, mdh: { endDate, maxShortfall: 33 }, totals: { modelBase: 9e10, modelPen: 3e8, cmsEst: 3e8 } };
  const ctx = areaContext({ hospitals: ALL, meta, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(ALL, meta), pinsUsed: [] });
  return methodsView(ctx).assumptions.map((r) => r[0]).filter((a) => a.startsWith('The Medicare-dependent'));
};

test('the Medicare-dependent row: an end before the payment year starts reverses no range and the row drops out', () => {
  assert.deepEqual(mdhRows(2028, '2026-12-31'), []);
  assert.equal(mdhRows(2027, '2026-12-31').length, 1);
  assert.match(mdhRows(2027, '2026-12-31')[0], /for Oct–Dec 2026 only/);
  assert.match(mdhRows(2028, '2028-12-31')[0], /whole year/);
});

// ---------- 4. An unknown condition key stops the build ----------

test('conditionShort throws on a key the data does not list', () => {
  assert.equal(conditionShort(CONDITIONS, 'HF'), 'Heart failure');
  assert.throws(() => conditionShort(CONDITIONS, 'ZZZ'), /no condition "ZZZ"/);
  assert.throws(() => conditionShort([], 'HF'), RangeError);
});

// ---------- 5 and 6: see csv.test.js (the dictionary's words) ----------

// ---------- 7. The history sentence keys on years, pinned to the data ----------

test('the years the totals sentence calls simulated are exactly those whose source in the data says simulation', () => {
  const national = loadHrrpOnce().history.national;
  const bySource = national.filter((r) => /simulation/i.test(r.totalSrc?.label ?? '')).map((r) => r.fy);
  assert.deepEqual([...HISTORY_SIMULATED_FYS], bySource);
});

test('the totals sentence names the simulated years whatever a source label says, and only years with a total', () => {
  const src = (label) => ({ kind: 'CMS', label, url: 'https://example.org/x' });
  const render = (national) => {
    const ctx = areaContext({ hospitals: ALL, meta: META, history: { ...HISTORY, national }, conditions: CONDITIONS, places: buildPlaces(ALL, META), pinsUsed: [] });
    return textOf(methodsPage({ view: methodsView(ctx), robots: null, assets: ASSETS }));
  };
  assert.ok(render([{ fy: 2024, totalEst: 5e8, totalSrc: src('a rule table') }, { fy: 2025, totalEst: 3e8, totalSrc: src('CMS estimate, Table X') }]).includes('for FY2025, a later simulation of that year under the earlier method'));
  assert.ok(!render([{ fy: 2025, totalEst: null }]).includes('a later simulation'));
});

// ---------- 8. The dictionary page loads the figure script ----------

test('the dictionary page loads the figure script, as HACRP\'s does', () => {
  const text = '# Dictionary\n\nAn opening paragraph.\n\n## A section\n\nWords.\n';
  const html = String(dictionaryPage({ text, edition: 'FY2027', csvHref: '/d.csv', markdownHref: '/d.md', robots: null, assets: ASSETS }));
  assert.ok(html.includes(`src="${ASSETS.js.figure}"`));
});

// ---------- 9. Singular forms ----------

test('Step 1\'s tips say "1 hospital" and "1 rarer set" for one', () => {
  // Distinct sets of measured conditions, one hospital each: twelve are kept and the rest pooled.
  const pool = (count) => Array.from({ length: count }, (_, i) => hospital({
    id: String(990001 + i), peer: 2, dual: 0.15, red: 0, paf: 1,
    c: Object.fromEntries(CONDS.filter((_, b) => (i + 1) & (1 << b)).map((k) => [k, m(40, 0.9)])),
  }));
  const part = (hospitals) => howPart(howData({ ...areaOf(hospitals), whatsNew: null }), { figure: (() => { let n = 0; return () => ++n; })(), edition: 'FY2027', sourceLine: 'x' }).text;
  for (const [count, other] of [[13, '1 rarer set: 1 hospital, 0 with a cut'], [14, '2 rarer sets: 2 hospitals, 0 with a cut']]) {
    const how = part(pool(count));
    assert.ok(how.includes(other), other);
    assert.ok(how.includes(': 1 hospital, 0 with a cut'), 'a set of one hospital');
    assert.doesNotMatch(how, /\b1 hospitals\b|\b1 rarer sets\b/);
  }
  const none = part([...pool(2), hospital({ id: '990050', c: {} })]);
  assert.match(none, /Not measured on any condition: 1 hospital[^s]/);
});

test('Methods: "1 hospital has no dot", "3 hospitals have no dot"', () => {
  const view = (none) => {
    const meta = { ...META, geocode: { address: 1, zip: 1, county: 1, none } };
    return textOf(methodsPage({ view: methodsView(areaContext({ hospitals: ALL, meta, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(ALL, meta), pinsUsed: [] })), robots: null, assets: ASSETS }));
  };
  assert.ok(view(1).includes('1 hospital has no dot.'));
  assert.ok(view(3).includes('3 hospitals have no dot.'));
  assert.ok(!view(0).includes('no dot'));
});

// ---------- 10. Ridges and the coin-flip follow the engine's lists ----------

test('ridges has a row for each peer group and coinFlip a row for each count of conditions the engine lists', () => {
  const hs = [hospital({ id: '990001', peer: 2, red: 1, c: { HF: m(40, 1.2, 1) } }), hospital({ id: '990002', peer: 4, red: 0, paf: 1, c: { HF: m(40, 0.9) } })];
  assert.deepEqual(ridges(hs).rows.map((r) => r.peer), PEERS);
  const six = hospital({ id: '990003', peer: 1, red: 0, paf: 1, c: Object.fromEntries(CONDS.map((k) => [k, m(40, 0.9)])) });
  const c = coinFlip([...hs, six]);
  assert.equal(c.rows.length, CONDS.length);
  assert.equal(c.sixFlags.length, CONDS.length + 1);
  assert.equal(c.sixFlags[0].n, 1, 'the all-measured hospital has no flags');
});
