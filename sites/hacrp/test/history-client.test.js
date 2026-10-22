// The history's page scripts (client/explore.js mountRoll and mountYearMap, client/roll-picker.js mountStatePicker, and
// the two entry scripts that mount them) against a stand-in DOM. Two kinds of test: the scripts on small synthetic assets (invented CCNs 990001 and so on,
// invented names), where every expectation is worked out by hand; and the scripts on the markup the build writes for
// the pinned data (rollFigure, placeYearsFigure, yearMapFigure) and the history asset it writes beside it (rollAsset),
// where the check is that the drawing and the script agree: the widths the script is told about are the widths drawn, a
// pointer on a drawn run names a hospital of that ink, and the year map the script redraws for the newest year is the
// one the build drew. No test names a real hospital: rows are picked by property and named from their CCNs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountRoll, mountYearMap } from '../client/explore.js';
import { mountStatePicker } from '../client/roll-picker.js';
import { YEAR_CLASSES, yearClass } from '../web/year-classes.js';
import { fill, t } from '../web/explore/copy.js';
import { fill as historyFill, t as historyText } from '../web/history/copy.js';
import { STATE_NAMES } from '../../../web/charts/geo.js';
import { count, pct } from '../../../web/render/format.js';
import { historyData } from '../web/history-data.js';
import { HIST_MAP_WIDE, placeMembers, placeYearsFigure, rollAsset, rollFigure, yearMapFigure } from '../web/history-figures.js';
import { DATA, PLACES } from './pinned.js';
import { rollParts } from '../../../web/charts/rollCall.js';
import { placePath } from '../web/place-paths.js';

const HD = historyData({ history: DATA.history, master: DATA.master });
const ASSET = rollAsset(HD, { shapes: DATA.shapes, master: DATA.master });
const HOSPITALS_URL = '/assets/hacrp-hospitals.0000abcd.json';
const ROLL_URL = '/assets/hacrp-history.0000abcd.json';

// ---------- a stand-in DOM ----------

const settle = () => new Promise((resolve) => { setImmediate(resolve); });

// An element that keeps attributes, classes, listeners and children, and answers the few queries the scripts make.
function el(over = {}) {
  const node = {
    hidden: false, dataset: {}, attrs: {}, classes: new Set(), handlers: {}, textContent: '', innerHTML: '', value: '',
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute: (k) => node.attrs[k] ?? null,
    addEventListener(type, fn) { node.handlers[type] = fn; },
    classList: { toggle: (c, on) => (on ? node.classes.add(c) : node.classes.delete(c)) },
    querySelector: () => null,
    querySelectorAll: () => [],
    ...over,
  };
  return node;
}

// The screen is PX pixels to an SVG unit: a pointer event at unit x is at client x * PX, and the SVG's own matrix
// brings it back, as getScreenCTM().inverse() does in a browser.
const PX = 2;
const at = (x) => ({ clientX: x * PX, clientY: 0 });

// A roll call's SVG: its drawn width and height as the viewBox, the pointer matrix, what the build drew (its nodes, its
// viewBox and its label, which the state picker swaps), and the one node the script adds and takes away: the outline of
// the column under the pointer. Its content is a list of nodes, each standing for its markup; setting innerHTML or
// replacing the children puts new ones in and, as in a browser, takes the outline away with the old.
function rollSvg(width, height = 100) {
  let nodes = [{ markup: `<path class="built-${width}"/>` }];
  const svg = el({
    viewBox: { baseVal: { width, height } },
    attrs: { viewBox: `0 0 ${width} ${height}`, 'aria-label': 'The national grid, as built' },
    createSVGPoint() {
      const pt = { x: 0, y: 0, matrixTransform: (m) => ({ x: pt.x * m.k, y: pt.y * m.k }) };
      return pt;
    },
    getScreenCTM: () => ({ inverse: () => ({ k: 1 / PX }) }),
    append(node) {
      svg.cursor = node;
      node.remove = () => { svg.cursor = null; };
    },
    replaceChildren(...next) {
      nodes = next;
      svg.cursor = null;
    },
  });
  Object.defineProperties(svg, {
    innerHTML: { get: () => nodes.map((n) => n.markup).join(''), set: (markup) => svg.replaceChildren({ markup }) },
    childNodes: { get: () => nodes },
  });
  svg.cursor = null;
  svg.querySelector = (s) => (s === '.chart-roll__cursor' ? svg.cursor : null);
  return svg;
}

// The figure around a roll call: the box (its data-* attributes), the readout (hint: its data-* attributes), the SVGs at
// the given [width, height]s and, when asked, the state picker with its link. options: the picker's options
// [{ value, textContent }]; pickerData: its data-* attributes (the nation's share).
function rollRig({ dataset, sizes, options = null, readoutData = {}, pickerData = SYN_PICKER }) {
  const readout = el({ dataset: { ...readoutData } });
  const svgs = sizes.map(([w, h]) => rollSvg(w, h));
  const select = options && el();
  if (select) Object.defineProperty(select, 'selectedOptions', { get: () => [options.find((o) => o.value === select.value)] });
  const link = options && el({ hidden: true });
  const picker = options && el({ hidden: true, dataset: { ...pickerData }, querySelector: (s) => ({ select, '.roll__open': link })[s] ?? null });
  const box = el({
    dataset,
    classes: new Set(['roll']),
    querySelector: (s) => ({ '.roll__readout': readout, '.roll__pick': picker })[s] ?? null,
    querySelectorAll: (s) => (s === 'svg.chart--roll' ? svgs : []),
  });
  const fig = el({ querySelector: (s) => (s === '.roll' ? box : null) });
  box.closest = (s) => (s === '.fig' ? fig : null);
  return { fig, box, readout, svgs, picker, select, link };
}

// Globals a script reads, set for one test and put back after.
async function withGlobals(over, fn) {
  const saved = Object.keys(over).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const [k, value] of Object.entries(over)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}

const ok = (body) => () => ({ ok: true, json: async () => body });
const fail = (status) => () => ({ ok: false, status });
// A fetch that answers by URL, one response per call (a function in routes may differ call to call), and records them.
function fetchStub(routes) {
  const calls = [];
  const stub = async (url) => {
    calls.push(url);
    const route = routes[url];
    return route ? route() : { ok: false, status: 404 };
  };
  stub.calls = calls;
  return stub;
}

// The hospitals asset's loader, as the page's hospitalLoader() gives it: one call per ask, and the asset's rows.
function hospitalsStub(rows, hospitalPath = '/hacrp/hospital/') {
  const calls = [];
  const load = async (src) => { calls.push(src); return { hospitalPath, rows }; };
  load.calls = calls;
  return load;
}

// A document that makes the SVG node the roll call draws (the column outline), and holds the page's JSON scripts by id
// (scripts: { id: text }; a place page's grid order).
const documentStub = (scripts = {}) => ({ createElementNS: (ns, tag) => el({ ns, tag }), getElementById: (id) => (id in scripts ? { textContent: scripts[id] } : null) });

// A window that records the pages it is sent to.
const windowStub = () => {
  const assigned = [];
  return { location: { assign: (url) => assigned.push(url) }, assigned };
};

// Errors thrown inside a script's promise chains reach no handler; a test that expects none says so.
async function noUnhandled(fn) {
  const seen = [];
  const onRejection = (error) => seen.push(error);
  process.on('unhandledRejection', onRejection);
  try {
    await fn();
    await settle();
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  assert.deepEqual(seen.map(String), [], 'no unhandled rejection');
}

// ---------- the markup the build writes, read back ----------

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
// An element's data-* attributes, as a browser's dataset reads them (entities undone).
const datasetOf = (tag) => Object.fromEntries([...tag.matchAll(/\sdata-([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [camel(k), unescape(v)]));
const viewBoxOf = (tag) => /viewBox="0 0 (\d+) (\d+)"/.exec(tag).slice(1).map(Number);
// Each drawing in a figure's markup: its opening tag and everything to its end.
const drawings = (markup, kind) => markup.split('<svg ').slice(1).map((chunk) => `<svg ${chunk}`).filter((s) => s.startsWith('<svg') && new RegExp(`^<svg [^>]*chart--${kind}[ "]`).test(s));
const openTag = (svg) => /^<svg[^>]*>/.exec(svg)[0];

// The JSON scripts in a figure's markup, by id, as a page's document holds them.
const scriptsOf = (markup) => Object.fromEntries([...markup.matchAll(/<script type="application\/json" id="([^"]+)">([^<]*)<\/script>/g)].map(([, id, body]) => [id, body]));

// The rig for a roll figure's markup: the box's attributes, a stand-in SVG at each drawn size, the picker's options.
function rigFromMarkup(markup) {
  const sizes = drawings(markup, 'roll').map((s) => viewBoxOf(openTag(s)));
  const options = /class="roll__pick"/.test(markup) ? [...markup.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(([, value, textContent]) => ({ value, textContent: unescape(textContent) })) : null;
  const pickerTag = /<p class="roll__pick"[^>]*>/.exec(markup);
  return rollRig({ dataset: datasetOf(/<div class="roll"[^>]*>/.exec(markup)[0]), sizes, options, readoutData: datasetOf(/<p class="roll__readout[^>]*>/.exec(markup)[0]), pickerData: pickerTag ? datasetOf(pickerTag[0]) : {} });
}

// The runs (or cells) the drawing paints in its first row, by ink: [start, end] in SVG units. Each run is a stroke
// "M x y H x2" along its row's band; the first row's is the one highest up.
function firstRowRuns(svg) {
  const moves = (cls) => {
    const d = new RegExp(`<path class="${cls}" stroke-width="[\\d.]+" d="([^"]*)"`).exec(svg)[1];
    return [...d.matchAll(/M([\d.]+) ([\d.]+)H([\d.]+)/g)].map((m) => m.slice(1).map(Number));
  };
  const all = { yes: moves('chart-roll__yes'), no: moves('chart-roll__no') };
  const top = Math.min(...[...all.yes, ...all.no].map(([, y]) => y));
  const row = (list) => list.filter(([, y]) => y === top).map(([a, , b]) => [a, b]);
  return { yes: row(all.yes), no: row(all.no) };
}
// Where to put the pointer for some of a list of runs (its first, middle and last): the middle of each, and just inside
// both ends of one wide enough to have an inside.
const INSIDE = 0.02;
function probes(runs) {
  const some = [...new Set([runs[0], runs[runs.length >> 1], runs[runs.length - 1]])];
  return some.flatMap(([a, b]) => [(a + b) / 2, ...(b - a > 4 * INSIDE ? [a + INSIDE, b - INSIDE] : [])]);
}

// ---------- a small history, by hand ----------

// Five hospitals over three years, in the grid's order. 990004 is in no current file (CMS no longer lists it);
// 990005 was never cut. The hospitals asset's rows: [ccn, name, city, state, total, decision, zip]; 990002 now
// lists another state than the history's.
const SYN = {
  fys: [2024, 2025, 2026],
  ccns: ['990001', '990002', '99A003', '990004', '990005'],
  recs: ['YYN', 'YN.', 'NYN', '.YY', 'NNN'],
  states: ['AL', 'AL', 'MD', 'MD', 'AL'],
  // Each year's [cut, ever cut by then].
  counts: [[2, 2], [3, 4], [1, 4]],
};
const SYN_ROWS = [
  ['990001', 'Example One', 'Alphaville', 'AL', '0.5000', 'Yes', '35000'],
  ['990002', 'Example Two', 'Betaville', 'GA', '0.4000', 'Yes', '30000'],
  ['99A003', 'Example Three', 'Gammaville', 'MD', '0.1000', 'No', '21000'],
  ['990005', 'Example Five', 'Epsilonville', 'AL', '-0.2000', 'No', '35001'],
];
// The geometry the build writes (history-figures.js rollGeom): [label column, right margin, row height, top] by width.
const SYN_GEOM = { 300: [30, 0, 11, 4], 1180: [40, 0, 17, 4] };
// The picker's data-* attributes as the build writes them (history-figures.js rollFigure): the nation's share ever cut
// (four of the five hospitals).
const SYN_PICKER = { nation: '80%' };
// The middle of grid column j at a drawn width.
const middle = (j, width, [label, right], n = SYN.ccns.length) => label + ((j + 0.5) * (width - label - right)) / n;
const synRig = (extra = {}) => rollRig({ dataset: { geom: JSON.stringify(SYN_GEOM), roll: ROLL_URL, src: HOSPITALS_URL }, sizes: [[300, 100], [1180, 100]], ...extra });
const synFetch = () => fetchStub({ [ROLL_URL]: ok(SYN) });

// ---------- mountRoll ----------

test('mountRoll: a figure without a roll call is left alone', () => {
  const fig = el();
  assert.equal(mountRoll(fig, { hospitals: hospitalsStub([]) }), undefined);
});

test('mountRoll, the program page: nothing is fetched until the pointer arrives, and each asset only once; the hospital under the pointer is named', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, async () => {
    const f = synFetch();
    const hospitals = hospitalsStub(SYN_ROWS);
    await withGlobals({ fetch: f }, async () => {
      const rig = synRig();
      mountRoll(rig.fig, { hospitals });
      await settle();
      assert.deepEqual([f.calls, hospitals.calls], [[], []], 'nothing yet');
      const [svg] = rig.svgs;
      svg.handlers.pointerenter();
      await settle();
      assert.deepEqual([f.calls, hospitals.calls], [[ROLL_URL], [HOSPITALS_URL]], 'the history asset and the hospitals asset, as the box names them');
      // Column 0: cut in 2024 and 2025 of three years decided.
      svg.handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
      await settle();
      assert.equal(rig.readout.textContent, fill('rollSay', { who: 'Example One, AL', cut: '2', decided: '3', years: 'FY24, FY25' }));
      // Column 1: two years decided (the third is blank), cut in one; the hospitals asset's state, not the history's.
      svg.handlers.pointermove(at(middle(1, 300, SYN_GEOM[300])));
      await settle();
      assert.equal(rig.readout.textContent, fill('rollSay', { who: 'Example Two, GA', cut: '1', decided: '2', years: 'FY24' }));
      assert.deepEqual([f.calls.length, hospitals.calls.length], [1, 1], 'moving the pointer fetches nothing more');
    });
  }));

test('mountRoll names a hospital CMS no longer lists by its CCN, in the state the history recorded', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => withGlobals({ fetch: synFetch() }, async () => {
    const rig = synRig();
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    rig.svgs[1].handlers.pointermove(at(middle(3, 1180, SYN_GEOM[1180])));
    await settle();
    assert.equal(rig.readout.textContent, fill('rollSay', { who: `${fill('rollClosed', { ccn: '990004' })}, MD`, cut: '2', decided: '2', years: 'FY25, FY26' }));
    assert.match(rig.readout.textContent, /990004/);
  })));

test('mountRoll: at each drawn width the pointer finds the column under it, and the label column and the right margin name no one', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => withGlobals({ fetch: synFetch() }, async () => {
    // Two geometries: the program page's (no right margin) and a place page's (notes at the right).
    for (const geom of [SYN_GEOM, { 300: [30, 70], 760: [40, 90] }]) {
      const widths = Object.keys(geom).map(Number);
      const rig = rollRig({ dataset: { geom: JSON.stringify(geom), roll: ROLL_URL, src: HOSPITALS_URL }, sizes: widths.map((w) => [w, 100]) });
      const w = window;
      w.assigned.length = 0;
      mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
      for (const [svg, width] of rig.svgs.map((s, i) => [s, widths[i]])) {
        const [label, right] = geom[width];
        // Every column in the hospitals asset opens its page, from its own middle...
        const opened = [];
        for (let j = 0; j < SYN.ccns.length; j++) {
          const before = w.assigned.length;
          svg.handlers.click(at(middle(j, width, geom[width])));
          await settle();
          opened.push(w.assigned.length > before ? w.assigned[w.assigned.length - 1] : null);
        }
        assert.deepEqual(opened, ['/hacrp/hospital/990001/', '/hacrp/hospital/990002/', '/hacrp/hospital/99a003/', null, '/hacrp/hospital/990005/'], `width ${width}: a click on a column's middle opens its hospital; 990004 is in no current file`);
        // ...the first and the last column's edges still belong to it, and just past either end belongs to no one.
        const before = w.assigned.length;
        for (const x of [label - 0.5, 0, width - right, width]) svg.handlers.click(at(x));
        await settle();
        assert.equal(w.assigned.length, before, `width ${width}: the label column and the right margin open nothing`);
        svg.handlers.click(at(label + 0.01));
        svg.handlers.click(at(width - right - 0.01));
        await settle();
        assert.deepEqual(w.assigned.slice(before), ['/hacrp/hospital/990001/', '/hacrp/hospital/990005/'], `width ${width}: the grid's own first and last pixel`);
      }
    }
  })));

test('mountRoll: a pointer off the grid leaves the readout as it was', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => withGlobals({ fetch: synFetch() }, async () => {
    const rig = synRig();
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    const [svg] = rig.svgs;
    svg.handlers.pointermove(at(middle(2, 300, SYN_GEOM[300])));
    await settle();
    const said = rig.readout.textContent;
    assert.match(said, /Example Three/);
    for (const x of [5, 29, 300, 400]) svg.handlers.pointermove(at(x));
    await settle();
    assert.equal(rig.readout.textContent, said);
  })));

test('mountRoll: a hospital never cut is named without error, by its name, state and the years it had a decision', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => noUnhandled(async () => {
    await withGlobals({ fetch: synFetch() }, async () => {
      const rig = synRig();
      mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
      // Column 4 (990005) was decided in all three years and never cut.
      rig.svgs[0].handlers.pointermove(at(middle(4, 300, SYN_GEOM[300])));
      await settle();
      assert.equal(rig.readout.textContent, fill('rollSayNone', { who: 'Example Five, AL', decided: '3' }));
      assert.match(rig.readout.textContent, /never cut in 3 years/);
      // And the pointer moving on to a cut hospital says that one's cuts again.
      rig.svgs[0].handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
      await settle();
      assert.match(rig.readout.textContent, /cut in 2 of 3 years \(FY24, FY25\)/);
    });
  })));

test('mountRoll: the readout starts as the build\'s hint when there is one, until a hospital is named; with none it is left as built', () =>
  withGlobals({ window: windowStub(), document: documentStub(), fetch: synFetch() }, async () => {
    const hint = 'Point at a sliver to name its hospital.';
    const hinted = synRig({ readoutData: { hint } });
    mountRoll(hinted.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    assert.equal(hinted.readout.textContent, hint, 'seeded at mount, before any pointer');
    hinted.svgs[0].handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
    await settle();
    assert.match(hinted.readout.textContent, /Example One/, 'a hospital replaces the hint');
    // Off the grid, the readout keeps what it said.
    const said = hinted.readout.textContent;
    hinted.svgs[0].handlers.pointermove(at(5));
    await settle();
    assert.equal(hinted.readout.textContent, said);
    const plain = synRig();
    plain.readout.textContent = 'as built';
    mountRoll(plain.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    assert.equal(plain.readout.textContent, 'as built', 'no hint, nothing written');
  }));

test('mountRoll: an outline marks the column under the pointer, one rect that moves, and stays put when the pointer is off the grid', () =>
  withGlobals({ window: windowStub(), document: documentStub(), fetch: synFetch() }, async () => {
    const rig = synRig();
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    const [narrow, wide] = rig.svgs;
    assert.deepEqual([narrow.cursor, wide.cursor], [null, null], 'nothing outlined until the pointer is on the grid');
    narrow.handlers.pointermove(at(middle(2, 300, SYN_GEOM[300])));
    await settle();
    const rect = narrow.cursor;
    assert.equal(rect.attrs.class, 'chart-roll__cursor');
    assert.equal(rect.ns, 'http://www.w3.org/2000/svg');
    assert.equal(rect.tag, 'rect');
    // Five columns over 270 units (300 less the 30 of labels): 54 each. Column 2 starts at 138; the outline is a unit
    // wider at each side; it runs over the grid's rows from the geometry: from 2 above the top (4) for 3 years of 11.
    assert.deepEqual([rect.attrs.x, rect.attrs.width, rect.attrs.y, rect.attrs.height], ['137.0', '56.0', '2', '35']);
    narrow.handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
    await settle();
    assert.equal(narrow.cursor, rect, 'the same rect, moved rather than another added');
    assert.equal(rect.attrs.x, '29.0');
    // Off the grid (the label column, past the right edge): it stays on the column it was.
    for (const x of [5, 29, 400]) narrow.handlers.pointermove(at(x));
    await settle();
    assert.equal(rect.attrs.x, '29.0');
    assert.equal(wide.cursor, null, 'each drawing has its own outline, drawn when its own pointer arrives');
    // A column CMS's file no longer lists (990004) is outlined all the same: the history names it.
    wide.handlers.pointermove(at(middle(3, 1180, SYN_GEOM[1180])));
    await settle();
    const w = (1180 - 40) / SYN.ccns.length;
    assert.deepEqual([wide.cursor.attrs.x, wide.cursor.attrs.width], [(40 + 3 * w - 1).toFixed(1), (w + 2).toFixed(1)]);
  }));

test('mountRoll, a place page: the grid\'s order is on the page (the JSON script data-inline names) and the history asset is never fetched', () =>
  withGlobals({ window: windowStub(), document: documentStub({ 'place-order': JSON.stringify(SYN) }) }, () => withGlobals({ fetch: fetchStub({ [ROLL_URL]: fail(500) }) }, async () => {
    const geom = { 300: [30, 70], 760: [40, 90] };
    const hospitals = hospitalsStub(SYN_ROWS);
    // data-roll is not on a place's figure; if it were, the inline order still wins.
    const rig = rollRig({ dataset: { geom: JSON.stringify(geom), inline: 'place-order', src: HOSPITALS_URL, roll: ROLL_URL }, sizes: [[300, 100], [760, 100]] });
    mountRoll(rig.fig, { hospitals });
    rig.svgs[1].handlers.pointermove(at(middle(0, 760, geom[760])));
    await settle();
    assert.match(rig.readout.textContent, /Example One, AL/);
    assert.deepEqual(globalThis.fetch.calls, [], 'no fetch for the order');
    assert.deepEqual(hospitals.calls, [HOSPITALS_URL], 'the names still come from the hospitals asset');
    // The right margin (the notes) is not a hospital.
    const before = rig.readout.textContent;
    rig.svgs[1].handlers.pointermove(at(760 - 45));
    await settle();
    assert.equal(rig.readout.textContent, before);
  })));

// ---------- the state picker ----------

// The cells a drawing's body paints in each ink: one move each (a few columns are wide enough to be one cell each).
const inkCells = (body, ink) => (new RegExp(`<path class="chart-roll__${ink}" stroke-width="[\\d.]+" d="([^"]*)"`).exec(body)?.[1].match(/M/g) ?? []).length;
const AL_PICK = [{ value: '', textContent: 'Every state' }, { value: 'AL', textContent: 'Alabama' }, { value: 'MD', textContent: 'Maryland' }];
const pickIn = (rig) => async (value) => {
  rig.select.value = value;
  rig.select.handlers.change();
  await settle();
};

test('mountRoll, the state picker: a state redraws each drawing with its hospitals alone, says them against the nation, links to its page; "Every state" puts the drawings back as built', () =>
  withGlobals({ window: windowStub(), document: documentStub(), fetch: synFetch() }, () => noUnhandled(async () => {
    const hint = 'Point at a sliver';
    const rig = synRig({ options: AL_PICK, readoutData: { hint } });
    const built = rig.svgs.map((svg) => ({ body: svg.innerHTML, attrs: { ...svg.attrs } }));
    const builtNodes = rig.svgs.map((svg) => [...svg.childNodes]);
    assert.equal(rig.picker.hidden, true, 'hidden until the script runs');
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS), picker: mountStatePicker });
    assert.equal(rig.picker.hidden, false);
    assert.equal(rig.link.hidden, true, 'no link until a state is picked');
    const pick = pickIn(rig);
    // An outline on the national grid goes with it.
    rig.svgs[0].handlers.pointermove(at(middle(2, 300, SYN_GEOM[300])));
    await settle();
    assert.ok(rig.svgs[0].cursor);
    await pick('AL');
    assert.equal(rig.svgs[0].cursor, null, 'the outline goes with the national grid');
    // Alabama: columns 0, 1 and 4 of the national order, in that order (records YYN, YN., NNN): ever cut 2, never 1.
    const recs = ['YYN', 'YN.', 'NNN'];
    const [ever, never] = [fill('rollEver', { n: '2' }), fill('rollNever', { n: '1' })];
    for (const [svg, width, height] of [[rig.svgs[0], 300, 4 + 3 * 11 + 30], [rig.svgs[1], 1180, 4 + 3 * 17 + 30]]) {
      const [label, right, rowH] = SYN_GEOM[width];
      const kit = rollParts({ records: recs, years: SYN.fys.map(String), brackets: [{ from: 0, to: 2, label: ever, pen: true }, { from: 2, to: 3, label: never }], blank: t('rollNone'), width, rowH, label, right });
      assert.equal(svg.innerHTML, String(kit.body), `width ${width}: the kit's grid at the drawing's own width and geometry`);
      assert.equal(svg.attrs.viewBox, `0 0 ${width} ${height}`, `width ${width}: the same width; a row a year and the brackets`);
      // By hand: cut in 2024 and 2025, in 2024; not cut in 2026, in 2025, in all three. One cell each (90 units a column
      // at 300).
      assert.deepEqual([inkCells(svg.innerHTML, 'yes'), inkCells(svg.innerHTML, 'no')], [3, 5], `width ${width}`);
      assert.ok(svg.innerHTML.includes(`>${ever}</text>`) && svg.innerHTML.includes(`>${never}</text>`), 'the brackets in the grid\'s own words, the state\'s own counts');
      assert.equal(svg.attrs['aria-label'], fill('rollStateAlt', { state: 'Alabama', hospitals: '3' }));
    }
    assert.equal(rig.readout.textContent, fill('rollStateSay', { state: 'Alabama', ever: '2', hospitals: '3', share: '67%', nation: '80%' }));
    assert.match(rig.readout.textContent, /^Alabama: 2 of 3 hospitals ever cut \(67%\), against 80% nationally/);
    assert.equal(rig.link.hidden, false);
    assert.equal(rig.link.attrs.href, placePath('state', 'AL'));
    assert.equal(rig.link.attrs.href, '/hacrp/state/al/');
    assert.equal(rig.link.textContent, fill('rollStateLink', { state: 'Alabama' }));
    // Another state replaces the grid. Maryland's two (NYN, .YY) were both cut: no brackets, so a shorter drawing.
    await pick('MD');
    assert.equal(rig.svgs[0].attrs.viewBox, `0 0 300 ${4 + 3 * 11 + 6}`);
    assert.deepEqual([inkCells(rig.svgs[0].innerHTML, 'yes'), inkCells(rig.svgs[0].innerHTML, 'no')], [3, 2]);
    assert.doesNotMatch(rig.svgs[0].innerHTML, /chart-roll__bracket/);
    assert.equal(rig.readout.textContent, fill('rollStateSay', { state: 'Maryland', ever: '2', hospitals: '2', share: '100%', nation: '80%' }));
    assert.equal(rig.link.attrs.href, placePath('state', 'MD'));
    // Back to Alabama, then "Every state": each drawing as built, its very nodes, so to the character; the outline on
    // the state's grid goes with it; the link hidden; the hint again.
    await pick('AL');
    rig.svgs[0].handlers.pointermove(at(middle(1, 300, SYN_GEOM[300], 3)));
    await settle();
    assert.ok(rig.svgs[0].cursor);
    await pick('');
    rig.svgs.forEach((svg, i) => {
      assert.deepEqual({ body: svg.innerHTML, attrs: { ...svg.attrs } }, built[i], `drawing ${i}`);
      assert.ok(svg.childNodes.length === builtNodes[i].length && svg.childNodes.every((node, k) => node === builtNodes[i][k]), `drawing ${i}: the nodes the build drew`);
    });
    assert.equal(rig.svgs[0].cursor, null, 'the outline goes with the state\'s grid');
    assert.equal(rig.link.hidden, true);
    assert.equal(rig.readout.textContent, hint);
    // With no hint, the readout is left empty.
    const plain = synRig({ options: AL_PICK });
    mountRoll(plain.fig, { hospitals: hospitalsStub(SYN_ROWS), picker: mountStatePicker });
    await pickIn(plain)('AL');
    await pickIn(plain)('');
    assert.equal(plain.readout.textContent, '');
  })));

test('mountRoll without the picker\'s script (a place page\'s script carries none) leaves a picker as built: hidden, nothing listening', () =>
  withGlobals({ window: windowStub(), document: documentStub(), fetch: synFetch() }, () => {
    const rig = synRig({ options: AL_PICK });
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    assert.equal(rig.picker.hidden, true);
    assert.equal(rig.select.handlers.change, undefined);
    assert.ok(rig.svgs[0].handlers.pointermove, 'the grid itself is mounted');
  }));

test('mountRoll, a picked state: the pointer names the state\'s own columns, a click opens one, a tap names first, and leaving brings the state\'s sentence back', () =>
  withGlobals({ window: windowStub(), document: documentStub(), fetch: synFetch() }, () => noUnhandled(async () => {
    const rig = synRig({ options: AL_PICK, readoutData: { hint: 'Point at a sliver' } });
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS), picker: mountStatePicker });
    await pickIn(rig)('AL');
    const sentence = rig.readout.textContent;
    const [narrow, wide] = rig.svgs;
    const mid = (j, width) => middle(j, width, SYN_GEOM[width], 3);
    // Three columns now: 990001, 990002 (its state from the hospitals asset), 990005.
    narrow.handlers.pointermove(at(mid(0, 300)));
    await settle();
    assert.equal(rig.readout.textContent, fill('rollSay', { who: 'Example One, AL', cut: '2', decided: '3', years: 'FY24, FY25' }));
    wide.handlers.pointermove(at(mid(1, 1180)));
    await settle();
    assert.equal(rig.readout.textContent, fill('rollSay', { who: 'Example Two, GA', cut: '1', decided: '2', years: 'FY24' }));
    narrow.handlers.pointermove(at(mid(2, 300)));
    await settle();
    assert.equal(rig.readout.textContent, fill('rollSayNone', { who: 'Example Five, AL', decided: '3' }));
    // The outline is a state column wide: 270 units over three columns, 90 each, a unit more each side.
    narrow.handlers.pointermove(at(mid(1, 300)));
    await settle();
    assert.deepEqual([narrow.cursor.attrs.x, narrow.cursor.attrs.width], ['119.0', '92.0']);
    narrow.handlers.pointerleave({});
    assert.equal(rig.readout.textContent, sentence, 'leaving the grid brings the state\'s sentence back, not the hint');
    narrow.handlers.click(at(mid(2, 300)));
    await settle();
    assert.deepEqual(window.assigned, ['/hacrp/hospital/990005/']);
    narrow.handlers.click({ ...at(mid(0, 300)), pointerType: 'touch' });
    await settle();
    assert.ok(rig.readout.textContent.startsWith('Example One, AL') && rig.readout.textContent.endsWith(fill('rollTapAgain')), 'a first tap names it');
    assert.equal(window.assigned.length, 1, 'and opens nothing');
    narrow.handlers.click({ ...at(mid(0, 300)), pointerType: 'touch' });
    await settle();
    assert.equal(window.assigned.at(-1), '/hacrp/hospital/990001/', 'a second tap on it opens it');
    // A tap named on one grid does not open on the next: after a pick, a tap names first again, even the same hospital
    // in the same column (990002 is column 1 of both).
    narrow.handlers.click({ ...at(mid(1, 300)), pointerType: 'touch' });
    await settle();
    await pickIn(rig)('');
    narrow.handlers.click({ ...at(middle(1, 300, SYN_GEOM[300])), pointerType: 'touch' });
    await settle();
    assert.equal(window.assigned.length, 2, 'the national grid\'s first tap names, it does not open');
    assert.ok(rig.readout.textContent.startsWith('Example Two, GA'));
    // Every state: the pointer reads the national columns again.
    narrow.handlers.pointermove(at(middle(2, 300, SYN_GEOM[300])));
    await settle();
    assert.match(rig.readout.textContent, /^Example Three, MD/);
  })));

// Four years, the second of which no hospital had a decision in (CMS cut no one, scored no one).
const GAPPED = { fys: [2024, 2025, 2026, 2027], ccns: SYN.ccns, recs: ['Y.YN', 'N.NN', 'Y.N.', '..YY', 'N.NN'], states: SYN.states };

test('mountRoll, a picked state: a year in which none of its hospitals had a decision says so, in the grid\'s own words; a page\'s own order works too', () =>
  withGlobals({ window: windowStub(), document: documentStub({ gapped: JSON.stringify(GAPPED) }), fetch: fetchStub({}) }, () => noUnhandled(async () => {
    const rig = rollRig({ dataset: { geom: JSON.stringify(SYN_GEOM), inline: 'gapped', src: HOSPITALS_URL }, sizes: [[300, 100], [1180, 100]], options: AL_PICK });
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS), picker: mountStatePicker });
    await pickIn(rig)('AL');
    for (const svg of rig.svgs) assert.equal([...svg.innerHTML.matchAll(new RegExp(`class="chart-roll__blank"[^>]*>${t('rollNone')}<`, 'g'))].length, 1, 'the second year, once');
    assert.equal(rig.svgs[0].attrs.viewBox, `0 0 300 ${4 + 4 * 11 + 30}`);
    assert.deepEqual(globalThis.fetch.calls, []);
  })));

test('mountRoll, the state picker: a history asset that will not load leaves the drawings as built and the picker on every state, and the next pick tries again', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => noUnhandled(async () => {
    let attempt = 0;
    await withGlobals({ fetch: fetchStub({ [ROLL_URL]: () => (attempt++ === 0 ? fail(503)() : ok(SYN)()) }) }, async () => {
      const rig = synRig({ options: AL_PICK });
      mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS), picker: mountStatePicker });
      await pickIn(rig)('AL');
      assert.equal(rig.svgs[0].innerHTML, '<path class="built-300"/>');
      assert.equal(rig.link.hidden, true);
      assert.equal(rig.select.value, '', 'the picker never names a state the grid does not show');
      await pickIn(rig)('AL');
      assert.match(rig.svgs[0].innerHTML, /chart-roll__yes/);
      assert.equal(rig.link.hidden, false);
    });
  })));

test('mountRoll: a history asset that will not load is let go quietly, and the next pointer tries again', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => noUnhandled(async () => {
    let attempt = 0;
    const f = fetchStub({ [ROLL_URL]: () => (attempt++ === 0 ? fail(503)() : ok(SYN)()) });
    await withGlobals({ fetch: f }, async () => {
      const rig = synRig();
      rig.readout.textContent = 'as built';
      mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
      const [svg] = rig.svgs;
      svg.handlers.pointerenter();
      svg.handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
      svg.handlers.click(at(middle(0, 300, SYN_GEOM[300])));
      await settle();
      assert.equal(rig.readout.textContent, 'as built', 'nothing said');
      assert.equal(window.assigned.length, 0);
      svg.handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
      await settle();
      assert.match(rig.readout.textContent, /Example One/);
      assert.deepEqual(f.calls, [ROLL_URL, ROLL_URL], 'one failed try, one that worked');
    });
  })));

test('mountRoll: a hospitals asset that will not load is let go quietly too', () =>
  withGlobals({ window: windowStub(), document: documentStub() }, () => noUnhandled(async () => {
    let attempt = 0;
    const hospitals = async () => {
      if (attempt++ === 0) throw new Error('hospital list: HTTP 503');
      return { hospitalPath: '/hacrp/hospital/', rows: SYN_ROWS };
    };
    await withGlobals({ fetch: synFetch() }, async () => {
      const rig = synRig();
      mountRoll(rig.fig, { hospitals });
      const [svg] = rig.svgs;
      svg.handlers.pointerenter();
      svg.handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
      await settle();
      assert.equal(rig.readout.textContent, '');
      svg.handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
      await settle();
      assert.match(rig.readout.textContent, /Example One/);
    });
  })));

// ---------- mountRoll on the markup the build writes ----------

test('the program page\'s roll call: its attributes are what the script reads, and a click on a drawn run opens a hospital CMS gave that ink that year', () => {
  const markup = rollFigure(HD, { n: 1, source: 'Synthetic source', rollUrl: ROLL_URL, src: HOSPITALS_URL }).toString();
  const rig = rigFromMarkup(markup);
  assert.equal(rig.box.dataset.roll, ROLL_URL);
  assert.equal(rig.box.dataset.src, HOSPITALS_URL);
  const geom = JSON.parse(rig.box.dataset.geom);
  assert.deepEqual(rig.svgs.map((s) => String(s.viewBox.baseVal.width)).sort(), Object.keys(geom).sort(), 'the script is told the geometry of each width drawn, and only those');
  // The readout is empty in the markup and carries, when the script can run, the hint it starts with.
  assert.match(markup, /<p class="roll__readout[^"]*" aria-live="polite" data-hint="[^"]+"><\/p>/);
  assert.equal(rig.readout.dataset.hint, historyText('rollHint'));
  assert.doesNotMatch(rollFigure(HD, { n: 1, source: 'Synthetic source' }).toString(), /data-hint/, 'a picture without its script has no hint to show');
  // The picker offers "every state" and each state the asset's hospitals are in, by its name.
  assert.ok(rig.picker && rig.select, 'a picker, for the script to show');
  assert.equal(rig.select.selectedOptions[0].textContent.length > 0, true);
  const offered = [...markup.matchAll(/<option value="([A-Z]{2})">([^<]*)<\/option>/g)].map((m) => [m[1], unescape(m[2])]);
  assert.deepEqual(offered.map(([st]) => st).sort(), [...new Set(ASSET.states.filter((st) => STATE_NAMES[st]))].sort(), 'a state for each the history has hospitals in');
  for (const [st, name] of offered) assert.equal(name, STATE_NAMES[st]);

  return withGlobals({ window: windowStub(), document: documentStub(), fetch: fetchStub({ [ROLL_URL]: ok(ASSET) }) }, async () => {
    // Every hospital in the asset has a row, named from its CCN.
    const rows = ASSET.ccns.map((ccn, j) => [ccn, `Example ${ccn}`, 'Exampleton', ASSET.states[j], '0.0000', 'No', '00000']);
    mountRoll(rig.fig, { hospitals: hospitalsStub(rows) });
    const svgs = drawings(markup, 'roll');
    let checked = 0;
    for (const [i, svg] of rig.svgs.entries()) {
      const width = svg.viewBox.baseVal.width;
      const [label, right] = geom[String(width)];
      const { yes, no } = firstRowRuns(svgs[i]);
      assert.ok(yes.length > 0 && no.length > 0, `width ${width}: the first year has cut and not-cut runs`);
      for (const [ink, xs] of [['Y', probes(yes)], ['N', probes(no)]]) {
        for (const x of xs) {
          window.assigned.length = 0;
          svg.handlers.click(at(x));
          await settle();
          assert.equal(window.assigned.length, 1, `width ${width}: a click at ${x} opens a page`);
          const ccn = window.assigned[0].split('/').at(-2).toUpperCase();
          assert.equal(ASSET.recs[ASSET.ccns.indexOf(ccn)][0], ink, `width ${width}: x ${x} is in a run of ${ink}`);
          checked++;
        }
      }
      // Outside the grid: the labels at the left, and (none drawn at the right on this page) the edge.
      window.assigned.length = 0;
      for (const x of [0, label - 1, width - right]) svg.handlers.click(at(x));
      await settle();
      assert.deepEqual(window.assigned, [], `width ${width}: outside the grid`);
    }
    assert.ok(checked >= 12, `checked ${checked}`);
  });
});

test('the program page\'s roll call names a hospital CMS no longer lists, from the history asset alone', () => {
  const markup = rollFigure(HD, { n: 1, source: 'Synthetic source', rollUrl: ROLL_URL, src: HOSPITALS_URL }).toString();
  const rig = rigFromMarkup(markup);
  const geom = JSON.parse(rig.box.dataset.geom);
  // A hospital in the history that the current master no longer places, and its column.
  const j = ASSET.ccns.findIndex((ccn, k) => !DATA.master.get(ccn) && ASSET.recs[k].includes('Y'));
  assert.ok(j >= 0, 'the pinned history holds a closed hospital that was cut');
  return withGlobals({ window: windowStub(), document: documentStub(), fetch: fetchStub({ [ROLL_URL]: ok(ASSET) }) }, async () => {
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    const width = rig.svgs[1].viewBox.baseVal.width;
    rig.svgs[1].handlers.pointermove(at(middle(j, width, geom[String(width)], ASSET.ccns.length)));
    await settle();
    const cut = [...ASSET.recs[j]].flatMap((c, i) => (c === 'Y' ? [`FY${String(ASSET.fys[i]).slice(-2)}`] : []));
    assert.equal(rig.readout.textContent, fill('rollSay', { who: `${fill('rollClosed', { ccn: ASSET.ccns[j] })}, ${ASSET.states[j]}`, cut: String(cut.length), decided: String([...ASSET.recs[j]].filter((c) => c !== '.').length), years: cut.join(', ') }));
  });
});

test('the program page\'s state picker on the pinned history: each state\'s grid is its own page\'s grid, its sentence is its page\'s counts against the takeaway\'s share, and its link is its page', () => {
  const markup = rollFigure(HD, { n: 1, source: 'Synthetic source', rollUrl: ROLL_URL, src: HOSPITALS_URL }).toString();
  const rig = rigFromMarkup(markup);
  const geom = JSON.parse(rig.box.dataset.geom);
  // The nation's share ever cut, worked out from the takeaway's own two counts.
  const ever = ASSET.recs.filter((r) => r.includes('Y')).length;
  const takeaway = unescape(/<figcaption[^>]*>.*?<\/span> ([^<]*)<\/figcaption>/.exec(markup)[1]);
  assert.ok(takeaway.includes(count(ever)) && takeaway.includes(count(ASSET.recs.length)), takeaway);
  const nation = pct(ever / ASSET.recs.length, 0);
  assert.equal(rig.picker.dataset.nation, nation);
  const codes = [...markup.matchAll(/<option value="([A-Z]{2})">/g)].map((m) => m[1]);
  const bySize = [...codes].sort((a, b) => ASSET.states.filter((st) => st === a).length - ASSET.states.filter((st) => st === b).length);
  const probeAt = [bySize[0], bySize.at(-1)];
  const built = rig.svgs.map((svg) => svg.innerHTML);
  return withGlobals({ window: windowStub(), document: documentStub(), fetch: fetchStub({ [ROLL_URL]: ok(ASSET) }) }, () => noUnhandled(async () => {
    const rows = ASSET.ccns.map((ccn, j) => [ccn, `Example ${ccn}`, 'Exampleton', ASSET.states[j], '0.0000', 'No', '00000']);
    mountRoll(rig.fig, { hospitals: hospitalsStub(rows), picker: mountStatePicker });
    const pick = pickIn(rig);
    let probed = 0;
    for (const code of codes) {
      // Every state offered has a page, and its page draws the same hospitals in the same order.
      const place = PLACES.list.find((p) => p.kind === 'state' && p.key.toUpperCase() === code);
      assert.ok(place, `${code}: a state page`);
      const page = placeYearsFigure({ place, hd: HD, master: DATA.master, next: () => 1, source: 'Synthetic source', src: HOSPITALS_URL }).toString();
      const own = JSON.parse(Object.values(scriptsOf(page))[0]);
      await pick(code);
      const name = STATE_NAMES[code];
      assert.equal(rig.link.attrs.href, place.path, `${code}: the link opens its page`);
      assert.equal(rig.link.textContent, fill('rollStateLink', { state: name }));
      const k = own.recs.filter((r) => r.includes('Y')).length;
      assert.equal(rig.readout.textContent, fill('rollStateSay', { state: name, ever: count(k), hospitals: count(own.recs.length), share: pct(k / own.recs.length, 0), nation }), code);
      // The page's own takeaway has the same two counts.
      const pageTakeaway = unescape(/<figcaption[^>]*>.*?<\/span> ([^<]*)<\/figcaption>/.exec(page)[1]);
      assert.ok(pageTakeaway.includes(` ${count(k)} of its ${count(own.recs.length)} `), `${code}: ${pageTakeaway}`);
      for (const svg of rig.svgs) {
        const width = svg.viewBox.baseVal.width;
        const [label, right, rowH] = geom[String(width)];
        // The kit's grid of the page's order at this drawing's width and geometry, in the build's words: the same
        // hospitals, the same order.
        const kit = rollParts({ records: own.recs, years: HD.fys.map(String), width, rowH, label, right, blank: historyText('rollNone'), brackets: !k || k === own.recs.length ? [] : [{ from: 0, to: k, label: historyFill('rollEver', { n: count(k) }), pen: true }, { from: k, to: own.recs.length, label: historyFill('rollNever', { n: count(own.recs.length - k) }) }] });
        assert.equal(svg.innerHTML, String(kit.body), `${code} at ${width}`);
        assert.equal(svg.attrs.viewBox, `0 0 ${width} ${kit.height}`, `${code} at ${width}`);
        assert.equal(svg.attrs['aria-label'], fill('rollStateAlt', { state: name, hospitals: count(own.recs.length) }));
        // The biggest state and the smallest: a click on a drawn run opens one of the state's hospitals of that ink.
        if (!probeAt.includes(code)) continue;
        const { yes, no } = firstRowRuns(svg.innerHTML);
        for (const [ink, runs] of [['Y', yes], ['N', no]]) {
          for (const x of runs.length ? probes(runs) : []) {
            window.assigned.length = 0;
            svg.handlers.click(at(x));
            await settle();
            const ccn = window.assigned[0]?.split('/').at(-2).toUpperCase();
            assert.equal(own.recs[own.ccns.indexOf(ccn)]?.[0], ink, `${code} at ${width}: x ${x} opens a hospital of the state cut (${ink}) that year`);
            probed++;
          }
        }
      }
    }
    assert.ok(probed >= 12, `probed ${probed}`);
    await pick('');
    assert.deepEqual(rig.svgs.map((svg) => svg.innerHTML), built, 'every state: the national drawings back');
  }));
});

test('a place page\'s roll call: the order is on the figure, agrees with the history, and the drawing\'s notes column names no one', () => {
  const place = [...PLACES.list].filter((p) => p.kind === 'state').sort((a, b) => b.ccns.length - a.ccns.length)[0];
  const markup = placeYearsFigure({ place, hd: HD, master: DATA.master, next: () => 1, source: 'Synthetic source', src: HOSPITALS_URL }).toString();
  const rig = rigFromMarkup(markup);
  const scripts = scriptsOf(markup);
  const inline = JSON.parse(scripts[rig.box.dataset.inline]);
  assert.deepEqual(Object.keys(scripts), [rig.box.dataset.inline], 'the order is one JSON script in the figure, named by data-inline');
  assert.equal(rig.box.dataset.roll, undefined, 'no history asset on a place page');
  assert.equal(rig.box.dataset.src, HOSPITALS_URL, 'place.js mounts the grids that name the hospitals asset');
  assert.deepEqual(inline.fys, HD.fys);
  assert.deepEqual([...inline.ccns].sort(), placeMembers(place, HD, DATA.master).sort(), 'the place\'s hospitals');
  assert.equal(new Set(inline.ccns).size, inline.ccns.length);
  inline.ccns.forEach((ccn, j) => {
    assert.equal(inline.recs[j], HD.recs.get(ccn), `${ccn}: its record`);
    assert.equal(inline.states[j], HD.stateOf.get(ccn));
  });
  const geom = JSON.parse(rig.box.dataset.geom);
  assert.deepEqual(rig.svgs.map((s) => String(s.viewBox.baseVal.width)).sort(), Object.keys(geom).sort());

  return withGlobals({ window: windowStub(), document: documentStub(scripts), fetch: fetchStub({}) }, async () => {
    const rows = inline.ccns.map((ccn, j) => [ccn, `Example ${ccn}`, 'Exampleton', inline.states[j], '0.0000', 'No', '00000']);
    mountRoll(rig.fig, { hospitals: hospitalsStub(rows) });
    const svgs = drawings(markup, 'roll');
    let checked = 0;
    for (const [i, svg] of rig.svgs.entries()) {
      const width = svg.viewBox.baseVal.width;
      const [label, right] = geom[String(width)];
      assert.ok(right > 0, 'a place page keeps the right margin for its notes');
      const { yes, no } = firstRowRuns(svgs[i]);
      for (const [ink, xs] of [['Y', probes(yes)], ['N', probes(no)]]) {
        for (const x of xs) {
          window.assigned.length = 0;
          svg.handlers.click(at(x));
          await settle();
          assert.equal(window.assigned.length, 1);
          const ccn = window.assigned[0].split('/').at(-2).toUpperCase();
          assert.equal(inline.recs[inline.ccns.indexOf(ccn)][0], ink, `width ${width}: x ${x}`);
          checked++;
        }
      }
      window.assigned.length = 0;
      for (const x of [label - 1, width - right, width - right / 2, width]) svg.handlers.click(at(x));
      await settle();
      assert.deepEqual(window.assigned, [], `width ${width}: the label column and the notes`);
    }
    assert.ok(checked > 0);
    assert.deepEqual(globalThis.fetch.calls, [], 'a place page fetches no history');
  });
});

// ---------- mountYearMap ----------

// The year map's figure: the box (its data-roll), the controls, a button for each year, the play button, the readout,
// and its one SVG with its dots group. The group starts with the markup the build drew.
function yearRig({ roll = ROLL_URL, years = SYN.fys.length, widths = [960], built = '<path class="built"/>', play = { play: 'Play', stop: 'Stop' } } = {}) {
  const buttons = Array.from({ length: years }, (_, i) => el({ dataset: { i: String(i) }, attrs: { 'aria-pressed': String(i === years - 1) } }));
  const playButton = el({ dataset: play, textContent: play.play });
  const controls = el({ hidden: true });
  const readout = el({ textContent: 'as built' });
  const groups = widths.map(() => el({ dataset: { size: '4.2' }, innerHTML: built }));
  const svgs = widths.map((w, i) => el({ viewBox: { baseVal: { width: w } }, querySelector: (s) => (s === '.chart-years__dots' ? groups[i] : null) }));
  const box = el({
    dataset: roll ? { roll } : {},
    querySelector: (s) => ({ '.ymap__controls': controls, '.ymap__play': playButton, '.ymap__readout': readout })[s] ?? null,
    querySelectorAll: (s) => (s === '.ymap__y' ? buttons : s === 'svg.chart--us-years' ? svgs : []),
  });
  const fig = el({ querySelector: (s) => (s === '.ymap' ? box : null) });
  box.closest = (s) => (s === '.fig' ? fig : null);
  box.classes.add('ymap');
  return { fig, box, controls, buttons, play: playButton, readout, groups, svgs };
}

// A year map's dots group, read back: { class: number of dots, … } and each class's path d.
function dotsIn(innerHTML) {
  const paths = [...innerHTML.matchAll(/<path class="chart-dots ([^"]+)" stroke-width="([^"]*)" d="([^"]*)"\/>/g)];
  return Object.fromEntries(paths.map(([, cls, , d]) => [cls, { n: (d.match(/h0/g) ?? []).length, d }]));
}
const [CLEAR, SCAR, NOW] = [YEAR_CLASSES.clear, YEAR_CLASSES.scar, YEAR_CLASSES.now];

// Five hospitals over three years with a place on the map (tenths of a unit; null: no place), and each year's
// [cut, ever cut]. Worked by hand, A: 'YNN' B: 'NYN' C: '.YY' D: '..N' E: 'NNN' (no place).
const YEARS_ASSET = {
  fys: [2024, 2025, 2026],
  recs: ['YNN', 'NYN', '.YY', '..N', 'NNN'],
  counts: [[1, 1], [2, 3], [1, 3]],
  at: [100, 200, 300, 400, 500, 600, 700, 800, null, null],
};

test('mountYearMap: a figure without a year map, or a year map without the history asset, is left as it was', () => {
  assert.equal(mountYearMap(el()), undefined);
  const rig = yearRig({ roll: null });
  mountYearMap(rig.fig);
  assert.equal(rig.controls.hidden, true, 'the controls stay hidden: a picture');
  assert.deepEqual(Object.keys(rig.play.handlers), []);
  assert.deepEqual(rig.buttons.flatMap((b) => Object.keys(b.handlers)), []);
});

test('mountYearMap: the controls appear; a year\'s button draws that year\'s dots, says it, and marks the button pressed', () =>
  withGlobals({ fetch: fetchStub({ [ROLL_URL]: ok(YEARS_ASSET) }) }, async () => {
    const rig = yearRig();
    mountYearMap(rig.fig);
    assert.equal(rig.controls.hidden, false);
    assert.deepEqual(globalThis.fetch.calls, [], 'nothing is fetched until a year is asked for');
    const year = async (i) => {
      rig.buttons[i].handlers.click();
      await settle();
    };
    // 2024: A cut (now), B not cut yet cut never (clear); C and D have no decision, E has no place.
    await year(0);
    let [narrow] = rig.groups.map((g) => dotsIn(g.innerHTML));
    assert.deepEqual(Object.keys(narrow).sort(), [CLEAR, NOW].sort());
    assert.equal(narrow[NOW].d, 'M10 20h0');
    assert.equal(narrow[CLEAR].d, 'M30 40h0');
    assert.deepEqual(rig.buttons.map((b) => b.attrs['aria-pressed']), ['true', 'false', 'false']);
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2024', cut: '1', ever: '1' }));
    // 2025: B and C cut now; A cut earlier (scar); D has no decision yet.
    await year(1);
    [narrow] = rig.groups.map((g) => dotsIn(g.innerHTML));
    assert.deepEqual(Object.keys(narrow).sort(), [NOW, SCAR].sort());
    assert.equal(narrow[NOW].d, 'M30 40h0m20 20h0');
    assert.equal(narrow[SCAR].d, 'M10 20h0');
    assert.deepEqual(rig.buttons.map((b) => b.attrs['aria-pressed']), ['false', 'true', 'false']);
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2025', cut: '2', ever: '3' }));
    // 2026: C cut; A and B scarred; D, never cut, appears in the clear; E has no place so none of its years draw.
    await year(2);
    [narrow] = rig.groups.map((g) => dotsIn(g.innerHTML));
    assert.deepEqual(Object.fromEntries(Object.entries(narrow).map(([k, v]) => [k, v.n])), { [CLEAR]: 1, [SCAR]: 2, [NOW]: 1 });
    assert.equal(narrow[CLEAR].d, 'M70 80h0');
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2026', cut: '1', ever: '3' }));
    // Each year's group holds a path per class that has dots, in the key's order (clear, scar, now: the last on top).
    const classes = [...rig.groups[0].innerHTML.matchAll(/class="chart-dots ([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(classes, [CLEAR, SCAR, NOW]);
    assert.equal(globalThis.fetch.calls.length, 1, 'the asset once, for every year');
  }));

test('mountYearMap: a year CMS cut no one says so; an asset with no placements still says the year and leaves the dots as built', () =>
  withGlobals({ fetch: fetchStub({ [ROLL_URL]: ok({ fys: [2022, 2023], recs: ['YN', 'NN', 'N.'], counts: [[1, 1], [0, 1]] }) }) }, async () => {
    const rig = yearRig({ years: 2, built: '<path class="built"/>' });
    mountYearMap(rig.fig);
    rig.buttons[0].handlers.click();
    await settle();
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2022', cut: '1', ever: '1' }));
    rig.buttons[1].handlers.click();
    await settle();
    assert.equal(rig.readout.textContent, fill('ymapSayNone', { fy: '2023', ever: '1' }));
    assert.deepEqual(rig.groups.map((g) => g.innerHTML), ['<path class="built"/>'], 'no placements, no redraw');
  }));

test('mountYearMap: a history asset that will not load is let go quietly, and the next year asked for tries again', () => noUnhandled(async () => {
  let attempt = 0;
  const f = fetchStub({ [ROLL_URL]: () => (attempt++ === 0 ? fail(503)() : ok(YEARS_ASSET)()) });
  await withGlobals({ fetch: f }, async () => {
    const rig = yearRig();
    mountYearMap(rig.fig);
    rig.buttons[0].handlers.click();
    await settle();
    assert.equal(rig.readout.textContent, 'as built');
    assert.deepEqual(rig.groups.map((g) => g.innerHTML), ['<path class="built"/>']);
    rig.buttons[0].handlers.click();
    await settle();
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2024', cut: '1', ever: '1' }));
    assert.equal(f.calls.length, 2);
  });
}));

// Timers a test steps by hand.
function timers() {
  const live = new Map();
  let next = 1;
  return {
    live,
    setInterval: (fn, ms) => { live.set(next, { fn, ms }); return next++; },
    clearInterval: (id) => { live.delete(id); },
    tick: () => [...live.values()].forEach((t) => t.fn()),
  };
}

test('mountYearMap, Play: steps through the years oldest first, once, and says Stop while it runs', () => {
  const clock = timers();
  return withGlobals({ fetch: fetchStub({ [ROLL_URL]: ok(YEARS_ASSET) }), setInterval: clock.setInterval, clearInterval: clock.clearInterval }, async () => {
    const rig = yearRig();
    mountYearMap(rig.fig);
    const shown = () => rig.buttons.findIndex((b) => b.attrs['aria-pressed'] === 'true');
    rig.play.handlers.click();
    await settle();
    assert.equal(rig.play.textContent, 'Stop');
    assert.equal(clock.live.size, 1);
    assert.ok([...clock.live.values()][0].ms > 0, 'a pause between years');
    assert.equal(shown(), 0, 'it starts from the oldest year, at once');
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2024', cut: '1', ever: '1' }));
    clock.tick();
    await settle();
    assert.equal(shown(), 1);
    clock.tick();
    await settle();
    assert.equal(shown(), 2);
    assert.equal(rig.play.textContent, 'Stop', 'the newest year is shown; the run ends at the next beat');
    clock.tick();
    await settle();
    assert.equal(rig.play.textContent, 'Play');
    assert.equal(clock.live.size, 0, 'the timer is cleared');
    assert.equal(shown(), 2, 'it stays on the newest year');
    assert.equal(rig.readout.textContent, fill('ymapSay', { fy: '2026', cut: '1', ever: '3' }));
    // Played again, it begins again.
    rig.play.handlers.click();
    await settle();
    assert.equal(shown(), 0);
    assert.equal(clock.live.size, 1);
  });
});

test('mountYearMap, Play: Play pressed again, or a year\'s button, stops it where it is', () => {
  const clock = timers();
  return withGlobals({ fetch: fetchStub({ [ROLL_URL]: ok(YEARS_ASSET) }), setInterval: clock.setInterval, clearInterval: clock.clearInterval }, async () => {
    const rig = yearRig();
    mountYearMap(rig.fig);
    const shown = () => rig.buttons.findIndex((b) => b.attrs['aria-pressed'] === 'true');
    rig.play.handlers.click();
    await settle();
    clock.tick();
    await settle();
    assert.equal(shown(), 1);
    // Play again: stop. The year stays, the timer is gone, and a late beat draws nothing.
    rig.play.handlers.click();
    await settle();
    assert.deepEqual([rig.play.textContent, clock.live.size, shown()], ['Play', 0, 1]);
    clock.tick();
    await settle();
    assert.equal(shown(), 1);
    // A year's button during a run: the run stops and that year shows.
    rig.play.handlers.click();
    await settle();
    assert.equal(clock.live.size, 1);
    rig.buttons[2].handlers.click();
    await settle();
    assert.deepEqual([rig.play.textContent, clock.live.size, shown()], ['Play', 0, 2]);
  });
});

// ---------- mountYearMap on the markup the build writes ----------

function yearRigFromMarkup(markup) {
  const box = datasetOf(/<div class="ymap"[^>]*>/.exec(markup)[0]);
  const buttons = [...markup.matchAll(/<button type="button" class="ymap__y"[^>]*>/g)].map((m) => datasetOf(m[0]));
  const built = drawings(markup, 'us-years').map((s) => ({
    width: viewBoxOf(openTag(s))[0],
    size: /<g class="chart-years__dots" data-size="([^"]*)">/.exec(s)[1],
    inner: /<g class="chart-years__dots" data-size="[^"]*">([\s\S]*?)<\/g>/.exec(s)[1],
  }));
  const rig = yearRig({ roll: box.roll, years: buttons.length, widths: built.map((b) => b.width), play: datasetOf(/<button type="button" class="ymap__play"[^>]*>/.exec(markup)[0]) });
  rig.groups.forEach((g, i) => { g.dataset.size = built[i].size; });
  return { ...rig, built, buttons: rig.buttons.map((b, i) => Object.assign(b, { dataset: buttons[i] })) };
}

test('the year map the build draws: one drawing, the placements are its, and the newest year the script redraws is the one the build drew', () => {
  const markup = yearMapFigure(HD, { n: 1, source: 'Synthetic source', shapes: DATA.shapes, master: DATA.master, rollUrl: ROLL_URL }).toString();
  const rig = yearRigFromMarkup(markup);
  assert.equal(rig.box.dataset.roll, ROLL_URL);
  assert.equal(rig.buttons.length, HD.fys.length, 'a button for each year');
  assert.deepEqual(rig.buttons.map((b) => b.dataset.i), HD.fys.map((_, i) => String(i)));
  assert.deepEqual(rig.built.map((b) => b.width), [HIST_MAP_WIDE], 'one drawing at every width; charts.css sizes its dots');
  assert.equal(ASSET.at.length, 2 * ASSET.ccns.length);
  assert.doesNotMatch(markup, /data-fit=/);
  assert.match(markup, /<ul class="ymap__key"/);

  return withGlobals({ fetch: fetchStub({ [ROLL_URL]: ok(ASSET) }) }, async () => {
    mountYearMap(rig.fig);
    assert.equal(rig.controls.hidden, false);
    rig.buttons[HD.fys.length - 1].handlers.click();
    await settle();
    rig.groups.forEach((g, i) => assert.equal(g.innerHTML, rig.built[i].inner, `width ${rig.built[i].width}: the same dots the build drew`));
    assert.ok(rig.built.every((b) => b.inner.length > 1000), 'and they are many');
  });
});

test('the year map for every year: each ink\'s dots are the hospitals in it that year, and the words are the history\'s own counts', () => {
  const markup = yearMapFigure(HD, { n: 1, source: 'Synthetic source', shapes: DATA.shapes, master: DATA.master, rollUrl: ROLL_URL }).toString();
  const rig = yearRigFromMarkup(markup);
  return withGlobals({ fetch: fetchStub({ [ROLL_URL]: ok(ASSET) }) }, async () => {
    mountYearMap(rig.fig);
    const placed = (flat) => (_, j) => flat[2 * j] !== null;
    let cutNone = 0;
    for (let i = 0; i < HD.fys.length; i++) {
      rig.buttons[i].handlers.click();
      await settle();
      const c = HD.counts[i];
      const words = c.cut ? fill('ymapSay', { fy: String(HD.fys[i]), cut: count(c.cut), ever: count(c.ever) }) : fill('ymapSayNone', { fy: String(HD.fys[i]), ever: count(c.ever) });
      assert.equal(rig.readout.textContent, words, `FY${HD.fys[i]}`);
      cutNone += c.cut ? 0 : 1;
      assert.deepEqual(rig.buttons.map((b) => b.attrs['aria-pressed']), rig.buttons.map((_, k) => String(k === i)));
      for (const [g, built] of rig.groups.map((g, k) => [g, rig.built[k]])) {
        const flat = ASSET.at;
        const recs = ASSET.recs.filter(placed(flat));
        const dots = dotsIn(g.innerHTML);
        const n = (cls) => dots[cls]?.n ?? 0;
        const early = (rec) => rec.slice(0, i);
        assert.equal(n(NOW), recs.filter((r) => r[i] === 'Y').length, `FY${HD.fys[i]} at ${built.width}: cut that year`);
        assert.equal(n(SCAR), recs.filter((r) => r[i] !== 'Y' && early(r).includes('Y')).length, `FY${HD.fys[i]} at ${built.width}: cut before`);
        assert.equal(n(CLEAR), recs.filter((r) => !r.slice(0, i + 1).includes('Y') && /[YN]/.test(r.slice(0, i + 1))).length, `FY${HD.fys[i]} at ${built.width}: decided, never cut so far`);
        assert.equal(n(NOW) + n(SCAR) + n(CLEAR), recs.filter((r) => yearClass(r, i) !== null).length);
      }
    }
    assert.equal(cutNone, 1, 'the one year CMS cut no one');
  });
});

// ---------- the entry scripts ----------

// A document whose queries find the given nodes by the one kind of selector the entry scripts use for them: a class,
// and optionally an attribute that must be present (".roll[data-src]").
function pageDocument(nodes, scripts = {}) {
  const matches = (node, selector) => {
    const m = /^\.([\w-]+)(?:\[data-([\w-]+)\])?$/.exec(selector);
    return Boolean(m) && node.classes.has(m[1]) && (!m[2] || node.dataset[m[2]] !== undefined);
  };
  return { ...documentStub(scripts), querySelector: () => null, querySelectorAll: (selector) => nodes.filter((n) => matches(n, selector)), createElement: () => el() };
}

test('program.js mounts every roll call and year map on the page, with the hospitals asset the page names', async () => {
  const roll = synRig({ options: [{ value: '', textContent: 'Every state' }] });
  const ymap = yearRig();
  const f = fetchStub({ [HOSPITALS_URL]: ok({ hospitalPath: '/hacrp/hospital/', rows: SYN_ROWS }), [ROLL_URL]: ok(SYN) });
  await withGlobals({ document: pageDocument([roll.box, ymap.box]), window: windowStub(), fetch: f }, async () => {
    await import('../client/program.js');
    assert.equal(roll.picker.hidden, false, 'the roll call is mounted, with its state picker');
    assert.equal(ymap.controls.hidden, false, 'and the year map');
    roll.svgs[0].handlers.pointermove(at(middle(0, 300, SYN_GEOM[300])));
    await settle();
    assert.match(roll.readout.textContent, /Example One, AL/);
    assert.deepEqual(f.calls, [ROLL_URL, HOSPITALS_URL]);
    ymap.buttons[0].handlers.click();
    await settle();
    assert.equal(ymap.readout.textContent, fill('ymapSay', { fy: '2024', cut: '2', ever: '2' }));
    assert.deepEqual(f.calls, [ROLL_URL, HOSPITALS_URL], 'the year map reads the history asset the roll call fetched');
  });
});

test('place.js mounts the roll calls that name the hospitals asset, and no others', async () => {
  const geom = { 300: [30, 70], 760: [40, 90] };
  const inline = 'place-order';
  const named = rollRig({ dataset: { geom: JSON.stringify(geom), inline, src: HOSPITALS_URL }, sizes: [[300, 100], [760, 100]] });
  const unnamed = rollRig({ dataset: { geom: JSON.stringify(geom), inline }, sizes: [[300, 100]] });
  const ymap = yearRig();
  const f = fetchStub({ [HOSPITALS_URL]: ok({ hospitalPath: '/hacrp/hospital/', rows: SYN_ROWS }) });
  await withGlobals({ document: pageDocument([named.box, unnamed.box, ymap.box], { [inline]: JSON.stringify(SYN) }), window: windowStub(), fetch: f }, async () => {
    await import('../client/place.js');
    assert.deepEqual(Object.keys(named.svgs[0].handlers).sort(), ['click', 'pointerenter', 'pointerleave', 'pointermove']);
    assert.deepEqual(unnamed.svgs[0].handlers, {}, 'a grid without data-src is left a picture');
    assert.equal(ymap.controls.hidden, true, 'a place page has no year map to mount');
    named.svgs[1].handlers.pointermove(at(middle(0, 760, geom[760])));
    await settle();
    assert.match(named.readout.textContent, /Example One, AL/);
    assert.deepEqual(f.calls, [HOSPITALS_URL], 'only the hospitals asset; the order was inline');
  });
});

// The verify pass, M3: a hospital with one year of decisions reads in the singular; a tap names a hospital before a
// second tap opens it; leaving the grid brings the hint back.
test('mountRoll: one decided year reads in the singular; a tap names first and a second tap opens; leaving restores the hint', () =>
  withGlobals({ window: windowStub(), document: documentStub(), fetch: synFetch() }, async () => {
    const rig = synRig();
    rig.readout.dataset.hint = 'Point at a sliver';
    mountRoll(rig.fig, { hospitals: hospitalsStub(SYN_ROWS) });
    const [narrow] = rig.svgs;
    const hint = rig.readout.textContent;
    assert.equal(hint, 'Point at a sliver');
    narrow.handlers.pointerenter?.({});
    narrow.handlers.pointermove(at(middle(1, 300, SYN_GEOM[300])));
    await settle();
    assert.notEqual(rig.readout.textContent, hint);
    assert.doesNotMatch(rig.readout.textContent, /\b1 years\b/);
    narrow.handlers.pointerleave({});
    assert.equal(rig.readout.textContent, hint, 'leaving the grid brings the hint back');
    narrow.handlers.click({ ...at(middle(0, 300, SYN_GEOM[300])), pointerType: 'touch' });
    await settle();
    assert.ok(rig.readout.textContent.endsWith(fill('rollTapAgain')), 'the first tap names it and says to tap again');
    assert.deepEqual(globalThis.window.assigned, [], 'the first tap opens nothing');
    narrow.handlers.click({ ...at(middle(0, 300, SYN_GEOM[300])), pointerType: 'touch' });
    await settle();
    assert.equal(globalThis.window.assigned.length, 1, 'a second tap on the same hospital opens it');
  }));
