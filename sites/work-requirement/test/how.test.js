// Step 2, how the scenario works: the chain's four links equal the national roll-up, each link's worksheet adds up to
// it, the what-if at the default use rate shows the file's own numbers (and comes back to them exactly), the engine's
// roll-up at other use rates stays in order, and the page's shared state tells each step what changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { fillCopy } from '../../../web/render/components.js';
import { decimal } from '../../../web/render/format.js';
import { textWidth } from '../../../web/charts/text.js';
import { createStore } from '../client/state.js';
import { useControl } from '../client/whatif.js';
import { SCENARIOS, USE_STEP } from '../web/constants.js';
import { COPY } from '../web/copy.js';
import { loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { LINKS, VAL, axisFigure, linkFigure, worksheetBody } from '../web/program/chain.js';
import { howModel } from '../web/program/how.js';
import { baseAsset, decodeBase, serverTotals, totalsAt } from '../web/program/model.js';
import { rangesInner } from '../web/program/ranges.js';

const data = loadMedicaid();
const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', baseUrl: '/assets/wr-base.test.json' });
const section = /<section class="step wr-step wr-how" id="how"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';
const finding = /<section class="step wr-step wr-finding" id="finding"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';
const words = (markup) => textOf(markup).replace(/\s+/g, ' ').trim();
const server = serverTotals(data);
const how = howModel(data);
const base = decodeBase(JSON.parse(JSON.stringify(baseAsset(data))));
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// Each worksheet's lines, from the server's markup: { line number: raw value } and the split's parts.
const popover = (n) => new RegExp(`<div class="wr-ws" id="wr-ws-${n}"[\\s\\S]*?<!-- /wr-ws -->`).exec(section)?.[0] ?? '';
const linesOf = (markup) => Object.fromEntries([...markup.matchAll(/data-line="(\d+)" data-v="([^"]+)"/g)].map(([, n, v]) => [Number(n), Number(v)]));
const partsOf = (markup, kind) => [...markup.matchAll(new RegExp(`data-${kind}="[a-z-]+" data-v="([^"]+)"`, 'g'))].map(([, v]) => Number(v));

test('the totals: national\'s dollars and counts by case, and the expansion states\' Medicaid revenue', () => {
  for (const s of SCENARIOS) {
    for (const k of ['at_risk', 'lost', 'lost_cost', 'added_uncompensated', 'care_avoided', 'other_coverage', 'income_change', 'falls_1pp', 'into_red']) {
      assert.equal(server[s][k], data.national[s][k], `${s} ${k}`);
    }
    assert.equal(server[s].medicaid_revenue, data.groups.expansion_states[s].medicaid_revenue, s);
  }
});

test('the chain\'s four values equal national.middle\'s, in the server\'s markup', () => {
  const links = [...section.matchAll(/<li class="wr-link" data-link="(\d)" data-v="([^"]+)">/g)].map(([, n, v]) => [Number(n), Number(v)]);
  assert.deepEqual(links.map(([n]) => n), [1, 2, 3, 4]);
  const want = [data.national.middle.at_risk, data.national.middle.lost, data.national.middle.lost_cost, data.national.middle.income_change];
  assert.deepEqual(links.map(([, v]) => v), want);
  assert.deepEqual(LINKS.map((l) => l.key), ['at_risk', 'lost', 'lost_cost', 'income_change']);
  // Each link's figure is drawn twice (phone and wide), named for a screen reader, and carries its value in words.
  for (const { n } of LINKS) {
    const li = new RegExp(`<li class="wr-link" data-link="${n}"[\\s\\S]*?</li>`).exec(section)[0];
    assert.equal((li.match(/<svg [^>]*role="img"/g) ?? []).length, 2, `link ${n}`);
    assert.match(li, /data-fit="narrow"/);
    assert.match(li, /data-fit="wide"/);
  }
});

test('each pop-out\'s lines add up to its link', () => {
  const m = data.national.middle;
  const p = data.params;
  const [w1, w2, w3, w4] = [1, 2, 3, 4].map(popover);
  const l1 = linesOf(w1);
  assert.deepEqual(Object.keys(l1).map(Number), [1, 2, 3]);
  assert.ok(near(l1[1] * l1[2], l1[3]), 'line 1 × line 2 = line 3');
  assert.equal(l1[3], m.at_risk);
  const l2 = linesOf(w2);
  assert.deepEqual(Object.keys(l2).map(Number), [4, 5, 6]);
  assert.equal(l2[5], 1, 'the default use rate');
  assert.ok(near(l1[3] * l2[4] * l2[5], l2[6]), 'line 3 × line 4 × line 5 = line 6');
  assert.equal(l2[6], m.lost);
  const l3 = linesOf(w3);
  assert.deepEqual(Object.keys(l3).map(Number), [7, 8, 9, 10]);
  assert.ok(near(l2[6] * l3[7], l3[8]), 'line 6 × line 7 = line 8');
  assert.equal(l3[8], m.lost_cost);
  assert.equal(l3[9], p.uninsured_share);
  assert.equal(l3[10], p.care_still_used);
  const split = partsOf(w3, 'part');
  assert.equal(split.length, 3);
  assert.ok(near(split.reduce((a, b) => a + b, 0), l3[8]), 'the three parts add up to line 8');
  const l4 = linesOf(w4);
  assert.deepEqual(Object.keys(l4).map(Number), [11, 12]);
  assert.equal(l4[11], m.added_uncompensated);
  assert.ok(near(l3[8] * l3[9] * l3[10], l4[11]), 'line 8 × line 9 × line 10 = line 11');
  const steps = partsOf(w4, 'step');
  assert.equal(steps.length, 3);
  assert.ok(near(steps.reduce((a, b) => a + b, 0), l4[12]), 'less revenue lost, plus what other coverage pays and the care not given');
  assert.equal(l4[12], m.income_change);
  assert.ok(near(l3[8] - l2[6] - l4[11], l4[12]), 'line 8 less line 6 less line 11');
});

test('each link opens its worksheet as a popover the button and Esc close; the mitigation link opens the second', () => {
  for (const { n } of LINKS) {
    assert.match(section, new RegExp(`<button type="button" class="wr-lines" popovertarget="wr-ws-${n}"`), `link ${n}'s button`);
    const pop = popover(n);
    assert.match(pop, new RegExp(`^<div class="wr-ws" id="wr-ws-${n}" popover role="dialog" aria-labelledby="wr-ws-${n}-t">`));
    assert.match(pop, new RegExp(`popovertarget="wr-ws-${n}" popovertargetaction="hide"`), `link ${n}'s close button`);
  }
  assert.match(section, /<button type="button" class="wr-mit" popovertarget="wr-ws-2">/);
  // Pop-outs sit in the words column, so a browser without popovers shows them there as text.
  const wordsCol = /<div class="wr-step__words">[\s\S]*?<\/div>\s*<div class="wr-step__stage"/.exec(section)?.[0] ?? '';
  for (const { n } of LINKS) assert.ok(wordsCol.includes(`id="wr-ws-${n}"`), `worksheet ${n} in the words column`);
});

test('Urban\'s three cases: the file\'s enrollment declines, the middle case marked, the CMS note at the low case only', () => {
  const rows = [...section.matchAll(/<li class="wr-case[^"]*" data-scen="(\w+)"[^>]*>([\s\S]*?)<\/li>/g)];
  assert.deepEqual(rows.map((r) => r[1]), SCENARIOS);
  for (const [, s, body] of rows) {
    const k = data.scenarios.find((x) => x.id === s).decline_enrollment;
    assert.ok(words(body).includes(fillCopy(COPY, 'stripEnrollees', { n: decimal(k / 1000, 1) })), s);
  }
  assert.deepEqual(rows.map((r) => /aria-current="true"/.test(r[0])), [false, true, false]);
  assert.deepEqual(rows.map((r) => r[2].includes(fillCopy(COPY, 'caseOfficial'))), [true, false, false]);
  assert.ok(near(data.scenarios.find((x) => x.id === 'low').decline_enrollment, 2977, 0) && near(data.scenarios.find((x) => x.id === 'high').decline_enrollment, 7045, 0));
});

test('the stage head: the scenario switch (middle checked) and the use slider, hidden until the script shows them', () => {
  const head = /<div class="wr-stage__head" data-stage-head hidden>[\s\S]*?<!-- \/wr-stage__head -->/.exec(finding)?.[0] ?? '';
  assert.ok(head, 'the head, hidden');
  const radios = [...head.matchAll(/<input type="radio" name="wr-scen" value="(\w+)"( checked)?>/g)];
  assert.deepEqual(radios.map((r) => r[1]), SCENARIOS);
  assert.deepEqual(radios.map((r) => Boolean(r[2])), [false, true, false]);
  const slider = /<input class="wi-range" type="range" id="wr-use" min="(\d+)" max="(\d+)" step="(\d+)" value="(\d+)"/.exec(head);
  assert.ok(slider, 'the slider');
  assert.deepEqual(slider.slice(1).map(Number), [data.params.use_min * 100, data.params.use_max * 100, Math.round(USE_STEP * 100), data.params.use_default * 100]);
  assert.deepEqual(slider.slice(1).map(Number), [75, 125, 5, 100]);
});

// The what-if's control with a fetch the test settles by hand: each call to fetchBase returns the next deferred promise.
function harness() {
  const fetches = [];
  const applied = [];
  let failed = 0;
  const control = useControl({
    server,
    fetchBase: () => new Promise((resolve, reject) => fetches.push({ resolve, reject })),
    apply: (use, totals) => applied.push([use, totals]),
    fail: () => { failed += 1; },
  });
  return { control, fetches, applied, failed: () => failed };
}
const asset = () => JSON.parse(JSON.stringify(baseAsset(data)));
const tick = () => new Promise((r) => setTimeout(r, 0));

test('the slider at 100 reproduces the server\'s numbers exactly, and coming back to it restores them', async () => {
  const h = harness();
  await h.control.setUse(1);
  assert.equal(h.fetches.length, 0, 'the default needs no asset');
  const moving = h.control.setUse(1.25);
  await tick();
  h.fetches[0].resolve(asset());
  await moving;
  await h.control.setUse(1);
  assert.equal(h.applied[0][1], server);
  assert.notEqual(h.applied[1][1], server);
  assert.equal(h.applied[2][1], server, 'back at 100: the file\'s own numbers, the same object');
  const moved = h.applied[1][1];
  // The client's drawing at the default equals the server's, byte for byte: each link's figure, each worksheet, the ranges.
  const view = { totals: server, scenario: 'middle', use: 1, how };
  for (const { n } of LINKS) {
    const li = new RegExp(`<div class="wr-link__fig" data-fig="${n}">([\\s\\S]*?)</div><!-- /fig -->`).exec(section)[1];
    assert.equal(linkFigure(n, view).text, li, `link ${n}`);
    const body = new RegExp(`<tbody class="wr-ws__body" data-ws-body="${n}">([\\s\\S]*?)</tbody>`).exec(popover(n))[1];
    assert.equal(worksheetBody(n, view).text, body, `worksheet ${n}`);
  }
  const ranges = /<div class="wr-ranges">([\s\S]*?)<\/div>\s*<p class="wr-counts/.exec(finding)[1];
  assert.equal(rangesInner(server, 'middle').text.trim(), ranges.trim());
  assert.notEqual(linkFigure(2, { ...view, totals: moved, use: 1.25 }).text, linkFigure(2, view).text);
});

test('the what-if: a newer move wins over an older one still loading, and a failed load snaps back and tries again', async () => {
  const h = harness();
  const first = h.control.setUse(1.25);
  const second = h.control.setUse(1.1);
  await tick();
  assert.equal(h.fetches.length, 1, 'one fetch for both moves');
  h.fetches[0].resolve(asset());
  await Promise.all([first, second]);
  assert.deepEqual(h.applied.map(([use]) => use), [1.1], 'only the newest move is applied');
  assert.ok(near(h.applied[0][1].middle.lost, server.middle.lost * 1.1));

  const f = harness();
  const failing = f.control.setUse(0.75);
  await tick();
  f.fetches[0].reject(new Error('503'));
  await failing;
  assert.equal(f.failed(), 1);
  assert.equal(f.applied.length, 0, 'nothing applied: the page stays as it was');
  const retry = f.control.setUse(0.75);
  await tick();
  assert.equal(f.fetches.length, 2, 'the next move fetches again');
  f.fetches[1].resolve(asset());
  await retry;
  assert.deepEqual(f.applied.map(([use]) => use), [0.75]);
  // A failure behind a newer move says nothing: the newer move's own result stands.
  const g = harness();
  const old = g.control.setUse(1.2);
  await tick();
  const fresh = g.control.setUse(1);
  g.fetches[0].reject(new Error('503'));
  await Promise.all([old, fresh]);
  assert.equal(g.failed(), 0);
  assert.deepEqual(g.applied.map(([use]) => use), [1]);
});

test('every computed worksheet line carries the scenario tag; line 1, from the cost reports, is measured', () => {
  const view = { totals: server, scenario: 'middle', use: 1, how };
  const rows = LINKS.flatMap(({ n }) => [...worksheetBody(n, view).text.matchAll(/<tr class="wr-wl[^"]*" data-line="(\d+)"[\s\S]*?<\/tr>/g)].map((m) => [Number(m[1]), m[0]]));
  assert.deepEqual(rows.map(([n]) => n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  // Lines 5, 9 and 10 are inputs (the what-if and two method constants), not results.
  const inputs = [5, 9, 10];
  for (const [n, row] of rows) {
    if (n === 1) {
      assert.ok(row.includes(fillCopy(COPY, 'wsMeasured')) && !row.includes('scen-tag'), 'line 1: measured');
    } else if (!inputs.includes(n)) {
      assert.match(row, /<span class="scen-tag">SCENARIO · \d{4} \$<\/span>/, `line ${n}`);
    }
  }
});

// Each label's extent as drawn, from its x, anchor and type (the kit's width estimate, an upper bound).
const LABEL = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
const attr = (attrs, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(` ${attrs}`)?.[1];
const plainText = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, '\'').replace(/&quot;/g, '"');
function extent(cls, x, anchor, inner, drawing) {
  let w;
  if (cls.includes('wr-val')) w = textWidth(plainText(inner), VAL[drawing], { mono: true });
  else if (cls.includes('chart-axis__label')) w = textWidth(plainText(inner), 11, { mono: true });
  else {
    const value = /<tspan class="wr-val--sm">([^<]*)<\/tspan>/.exec(inner);
    w = value ? textWidth(value[1], 11, { mono: true }) + textWidth(plainText(inner.replace(value[0], '')), 11) : textWidth(plainText(inner), 11);
  }
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return [left, left + w];
}

test('every label in the chain stays inside its drawing, in every case at every use rate, phone and wide', () => {
  const uses = [0.75, 1, 1.25];
  let checked = 0;
  for (const use of uses) {
    const totals = use === 1 ? server : totalsAt(base, use);
    for (const scenario of SCENARIOS) {
      const view = { totals, scenario, use, how };
      const drawings = [...LINKS.map(({ n }) => [`link ${n}`, linkFigure(n, view).text]), ['axis', axisFigure(view).text]];
      for (const [name, markup] of drawings) {
        for (const svg of markup.match(/<svg [\s\S]*?<\/svg>/g)) {
          const drawing = /data-fit="(\w+)"/.exec(svg)[1];
          const width = Number(/viewBox="0 0 ([\d.]+) /.exec(svg)[1]);
          for (const [, attrs, inner] of svg.matchAll(LABEL)) {
            const anchor = attr(attrs, 'text-anchor') ?? 'start';
            const [left, right] = extent(attr(attrs, 'class'), Number(attr(attrs, 'x')), anchor, inner, drawing);
            const where = `${name} ${drawing}, ${scenario} at ${use}: "${plainText(inner)}" spans ${left.toFixed(1)} to ${right.toFixed(1)} of ${width}`;
            assert.ok(left >= 0 && right <= width, where);
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 300, `${checked} labels checked`);
});

test('the engine\'s roll-up of the scenario hospitals equals the file\'s at the default, and stays in order at 75% and 125%', () => {
  const at1 = totalsAt(base, 1);
  for (const s of SCENARIOS) {
    for (const k of ['at_risk', 'lost', 'lost_cost', 'added_uncompensated', 'care_avoided', 'other_coverage', 'income_change', 'medicaid_revenue']) {
      assert.ok(near(at1[s][k], server[s][k]), `${s} ${k}: ${at1[s][k]} vs ${server[s][k]}`);
    }
    assert.equal(at1[s].falls_1pp, server[s].falls_1pp, s);
    assert.equal(at1[s].into_red, server[s].into_red, s);
  }
  for (const use of [0.75, 1.25]) {
    const t = totalsAt(base, use);
    for (const k of ['lost', 'lost_cost', 'added_uncompensated', 'falls_1pp', 'into_red']) {
      assert.ok(t.low[k] < t.middle[k] && t.middle[k] < t.high[k], `${use} ${k}: low < middle < high`);
    }
    assert.ok(t.low.income_change > t.middle.income_change && t.middle.income_change > t.high.income_change, `${use}: income falls further`);
    assert.ok(near(t.middle.lost, server.middle.lost * use), `${use}: revenue lost scales with use`);
    assert.equal(t.middle.at_risk, at1.middle.at_risk, 'the revenue at risk does not move with use');
  }
  assert.throws(() => decodeBase({ cols: ['x'], rows: [], declines: {} }), TypeError);
});

test('the use slider\'s every stop is a use the engine takes', () => {
  const stops = [];
  for (let u = Math.round(data.params.use_min * 100); u <= Math.round(data.params.use_max * 100); u += Math.round(USE_STEP * 100)) stops.push(u / 100);
  assert.equal(stops.length, 11);
  for (const u of stops) assert.doesNotThrow(() => totalsAt(base, u), String(u));
});

test('the shared state: set() tells each subscriber what changed, once, and nothing when nothing did', () => {
  const store = createStore({ scenario: 'middle', use: 1, hospital: null, totals: server });
  const seen = [];
  const off = store.subscribe((state, changed) => seen.push([state.scenario, state.use, [...changed].sort()]));
  store.set({ scenario: 'high' });
  store.set({ scenario: 'high' });
  store.set({ use: 1.1, totals: server });
  assert.deepEqual(seen, [['high', 1, ['scenario']], ['high', 1.1, ['use']]]);
  assert.equal(store.get().scenario, 'high');
  assert.throws(() => store.set({ scenario: 'worst' }), RangeError);
  assert.throws(() => store.set({ colour: 'red' }), RangeError);
  assert.ok(Object.isFrozen(store.get()));
  off();
  store.set({ scenario: 'low' });
  assert.equal(seen.length, 2, 'unsubscribed');
});
