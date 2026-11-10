// Step 1, the finding: the three strips (one dot per drawn hospital per strip, the medians where the shares put them), the
// three ranges from the national roll-up, the group chips' readout in the copy's words, and the page's hospital from
// ?h= (a well-formed CCN in the file, else the random default outside Virginia).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { r2 } from '../../../web/charts/svg.js';
import { fillCopy } from '../../../web/render/components.js';
import { count, money, moneyRange, pct } from '../../../web/render/format.js';
import { pageHospital, defaultPool } from '../client/find.js';
import { GROUPS, REF_SHARE, SCENARIOS } from '../web/constants.js';
import { COPY } from '../web/copy.js';
import { loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { stripWords } from '../web/program/finding.js';
import { axisOf, axisTop, decodeStrips, drawn, groupReadout, hospitalRows, inGroup, median, stripsAsset, stripsBody, stripsLayout } from '../web/program/strips.js';

const data = loadMedicaid();
const rows = hospitalRows(data);
const items = drawn(rows);
const top = axisTop(rows, data.params.use_max);
const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json' });
const section = /<section class="step wr-step wr-finding" id="finding"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';
const words = (markup) => textOf(markup).replace(/\s+/g, ' ').trim();
const col = (name) => data.columns.indexOf(name);
const scenarioRows = [...data.hospitals.values()].filter((r) => r[col('cls')] === 'scenario');

test('the rows: a dot only for a scenario-class hospital with a loss to draw, its middle loss the file\'s', () => {
  assert.equal(rows.length, data.hospitals.size);
  assert.ok(items.every((r) => r.cls === 'scenario'), 'only scenario-class hospitals are drawn');
  assert.equal(scenarioRows.length, 3044);
  assert.ok(items.length > 2900 && items.length < 3044, `${items.length} drawn`);
  for (const r of items) {
    const row = data.hospitals.get(r.ccn);
    const middle = row[col('middle_lost')] / row[col('net_patient_revenue')];
    assert.ok(Math.abs(r.share[1] - middle) < 1e-6, `${r.ccn}: ${r.share[1]} vs ${middle}`);
    assert.ok(r.share[0] < r.share[1] && r.share[1] < r.share[2], `${r.ccn}: low < middle < high`);
  }
  // Every hospital not drawn has no loss to draw (none is drawn at $0): none, or under a tenth of a basis point.
  for (const r of rows.filter((x) => x.cls === 'scenario' && !x.share)) {
    const row = data.hospitals.get(r.ccn);
    assert.ok(!(row[col('scored')] && row[col('net_patient_revenue')] > 0 && row[col('middle_lost')] / row[col('net_patient_revenue')] >= 1e-7), r.ccn);
  }
});

test('the groups: each chip\'s test counts the hospitals the file\'s roll-up of that group counts', () => {
  const counted = rows.filter((r) => r.cls !== 'all_payer' && r.cls !== 'no_cost_report');
  assert.equal(counted.length, data.national.middle.hospitals);
  for (const key of GROUPS) assert.equal(counted.filter((r) => inGroup(r, key)).length, data.groups[key].middle.hospitals, key);
});

test('the asset round-trips the rows and the axis', () => {
  const back = decodeStrips(JSON.parse(JSON.stringify(stripsAsset(rows, { top, words: stripWords(data) }))));
  assert.equal(back.top, top);
  assert.deepEqual(back.rows, rows);
  assert.deepEqual(back.words, stripWords(data));
  assert.throws(() => decodeStrips({ cols: ['ccn'], rows: [], top: 1, words: {} }), TypeError);
});

test('the server SVG holds one dot per drawn scenario hospital per strip, in both drawings, and no thread', () => {
  const svgs = section.match(/<svg role="img"[\s\S]*?<\/svg>/g) ?? [];
  assert.equal(svgs.length, 2, 'the phone drawing and the wide one');
  for (const svg of svgs) {
    const strips = [...svg.matchAll(/<g class="wr-strip[^"]*" data-scen="(\w+)">([\s\S]*?)<\/g>/g)];
    assert.deepEqual(strips.map((m) => m[1]), SCENARIOS);
    for (const [, s, body] of strips) {
      const d = /<path class="chart-dots wr-dots[^"]*" stroke-width="[^"]+" d="([^"]+)"\/>/.exec(body)[1];
      assert.equal(d.match(/h0/g).length, items.length, `${s}: one dot per drawn hospital`);
    }
    assert.match(svg, /class="wr-dots wr-dots--on"|class="chart-dots wr-dots wr-dots--on"/);
    assert.doesNotMatch(svg, /wr-thread/, 'the server draws no page hospital');
  }
  // The caption counts the drawn against all scenario hospitals, and the note the rest.
  const cap = words(/<figcaption[\s\S]*?<\/figcaption>/.exec(section)[0]);
  assert.ok(cap.includes(count(items.length)) && cap.includes(count(scenarioRows.length)), cap);
  assert.ok(words(section).includes(fillCopy(COPY, 'figNotPlaced', { n: count(scenarioRows.length - items.length) })));
});

test('the median line in each strip sits at that case\'s median share; the middle strip is tall and labels it', () => {
  const layout = stripsLayout({ items, drawing: 'wide', top, selected: 'middle' });
  const x = axisOf(layout.geo, top);
  const wide = (section.match(/<svg role="img"[\s\S]*?<\/svg>/g) ?? [])[1];
  SCENARIOS.forEach((s, k) => {
    const want = median(items.map((r) => r.share[k]));
    const body = new RegExp(`data-scen="${s}">([\\s\\S]*?)</g>`).exec(wide)[1];
    const line = /<line class="wr-median[^"]*" x1="([\d.]+)"/.exec(body);
    assert.equal(Number(line[1]), r2(x(want)), s);
  });
  assert.equal(layout.strips[1].h > layout.strips[0].h, true);
  assert.ok(wide.includes(fillCopy(COPY, 'stripMedian', { share: pct(median(items.map((r) => r.share[1])), 2) })));
});

test('the ranges: low to high from the national roll-up, the middle case\'s value as national.middle formatted', () => {
  const { national } = data;
  const want = {
    lost: [national.low.lost, national.high.lost, national.middle.lost],
    added: [national.low.added_uncompensated, national.high.added_uncompensated, national.middle.added_uncompensated],
    income: [-national.low.income_change, -national.high.income_change, -national.middle.income_change],
  };
  for (const [key, [low, high, middle]] of Object.entries(want)) {
    const row = new RegExp(`<div class="wr-range" data-range="${key}">([\\s\\S]*?)</svg>`).exec(section);
    assert.ok(row, key);
    const mid = words(/<p class="wr-range__mid">[\s\S]*?<\/p>/.exec(row[1])[0]);
    assert.equal(mid, fillCopy(COPY, 'rangeMid', { scenario: 'Middle', value: money(middle) }), key);
    assert.equal(words(/<p class="wr-range__v">[\s\S]*?<\/p>/.exec(row[1])[0]), moneyRange(low, high), key);
  }
  assert.equal(national.middle.falls_1pp, 234);
  assert.equal(national.middle.into_red, 36);
  assert.ok(words(section).includes(fillCopy(COPY, 'counts', {
    fallsLow: count(national.low.falls_1pp), fallsHigh: count(national.high.falls_1pp), falls: count(national.middle.falls_1pp),
    redLow: count(national.low.into_red), redHigh: count(national.high.into_red), red: count(national.middle.into_red),
  })));
});

test('the chips: one button per group and a state picker, hidden until the script shows them', () => {
  const chips = /<div class="wr-chips"[\s\S]*?class="wr-chips__out/.exec(section)?.[0] ?? '';
  assert.match(chips, /hidden/);
  assert.deepEqual([...chips.matchAll(/data-group="([a-z_0-9]+)"/g)].map((m) => m[1]), GROUPS);
  // Each chip names its group for the readout in the copy's words (data-name), not its own label's.
  const names = Object.fromEntries([...chips.matchAll(/data-group="([a-z_0-9]+)" data-name="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  assert.equal(names.safety_net, fillCopy(COPY, 'group_safety_net'));
  assert.equal(names.beds_lt50, fillCopy(COPY, 'group_beds_lt50', { n: '50' }));
  const states = [...chips.matchAll(/<option value="([A-Z]{2})">/g)].map((m) => m[1]);
  assert.ok(states.length > 30, `${states.length} states`);
  assert.ok(states.every((st) => items.some((r) => r.state === st)), 'every state listed has a hospital drawn');
});

test('the chips\' readout comes from COPY with its placeholders filled', () => {
  const members = items.filter((r) => inGroup(r, 'critical_access'));
  const name = fillCopy(COPY, 'group_critical_access');
  const line = groupReadout({ name, members, all: items, k: 1 });
  assert.equal(line, fillCopy(COPY, 'chipReadout', {
    group: name, n: count(members.length), median: pct(median(members.map((r) => r.share[1])), 2), all: pct(median(items.map((r) => r.share[1])), 2),
    big: count(members.filter((r) => r.share[1] >= REF_SHARE).length), line: pct(REF_SHARE, 0), scenario: 'middle',
  }));
  const one = groupReadout({ name: 'Somewhere', members: members.slice(0, 1), all: items, k: 0 });
  assert.equal(one, fillCopy(COPY, 'chipReadoutOne', { group: 'Somewhere', median: pct(members[0].share[0], 2), all: pct(median(items.map((r) => r.share[0])), 2), scenario: 'low' }));
  // The template's words are all there is: the copy's text with each placeholder matched by a value.
  const pattern = new RegExp(`^${COPY.chipReadout.text.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+')}$`);
  assert.match(line, pattern);
});

test('?h=: a well-formed CCN in the file is the page\'s hospital; anything else is ignored', () => {
  const byCcn = new Map(rows.map((r) => [r.ccn, r]));
  const one = items[0];
  assert.equal(pageHospital(`?h=${one.ccn}`, byCcn), one);
  assert.equal(pageHospital(`?h=${one.ccn.toLowerCase()}`, byCcn), one, 'either case');
  const other = rows.find((r) => r.cls === 'not_expansion');
  assert.equal(pageHospital(`?h=${other.ccn}`, byCcn), other, 'in the file without a scenario: the page hospital, with no thread');
  for (const bad of ['', '?h=', '?h=12345', '?h=1234567', '?h=<svg>', '?h=ZZZZZZ', '?h=%3Cscript%3E', '?x=010001', '?h=01000 ']) {
    assert.equal(pageHospital(bad, byCcn), null, bad);
  }
});

test('the random default is drawn and outside Virginia', () => {
  const pool = defaultPool(rows);
  assert.ok(pool.length > 2800);
  assert.ok(pool.every((r) => r.share && r.cls === 'scenario' && r.state !== 'VA'));
  assert.ok(items.some((r) => r.state === 'VA'), 'Virginia has drawn hospitals, all left out');
});

test('the page top: the title and the dek in step 1\'s words column, before the chips', () => {
  const head = section.indexOf('<h1');
  assert.ok(head > 0 && head < section.indexOf('wr-chips'));
  assert.match(page, /<div class="wr-stage__head" data-stage-head><\/div>/, 'the stage head, empty until the controls arrive');
  assert.match(page, /<form class="omni" id="omni"[^>]* data-src="\/assets\/wr-strips\.test\.json"/, 'the masthead Find over the strips asset');
});

test('the low strip alone carries the small note that CMS\'s count sits there, in both drawings', () => {
  const note = fillCopy(COPY, 'stripOfficial');
  for (const svg of section.match(/<svg role="img"[\s\S]*?<\/svg>/g)) {
    const heads = [...svg.matchAll(/<g class="wr-head[^"]*" data-scen="(\w+)">([\s\S]*?)<\/g>/g)];
    assert.deepEqual(heads.map((m) => m[1]), SCENARIOS);
    for (const [, s, body] of heads) assert.equal(body.includes(note), s === 'low', s);
    assert.equal(svg.split(note).length - 1, 1, 'once');
  }
  assert.deepEqual(COPY.stripOfficial.claim, ['WR-03', 'WR-04']);
});

test('the drawing\'s order: gridlines under the strips; the thread over the dots; the headers over the thread', () => {
  const layout = stripsLayout({ items, drawing: 'wide', top, selected: 'middle' });
  const body = stripsBody(layout, { words: stripWords(data), hospital: { i: 0, name: items[0].name } }).text;
  const at = (s) => body.indexOf(s);
  assert.ok(at('class="chart-grid"') < at('<g class="wr-strip'));
  assert.ok(at('<g class="wr-strip') < at('<g class="wr-thread"'));
  assert.ok(at('<g class="wr-thread"') < at('<g class="wr-head'));
  assert.ok(!body.slice(at('<g class="wr-head')).includes('chart-grid'), 'no gridline after the headers');
});

// The dots of each case, selected or not, clear 3:1 against both papers in both themes (WCAG's non-text contrast).
test('the strips\' dot inks stand 3:1 or more off --paper and --paper-2, light and dark', () => {
  const tokens = readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8');
  const split = tokens.indexOf('@media (prefers-color-scheme: dark)');
  const blocks = { light: tokens.slice(0, split), dark: tokens.slice(split) };
  const token = (block, name) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)[1];
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const css = readFileSync(REPO_ROOT + 'sites/work-requirement/web/styles.css', 'utf8');
  const inkOf = (selector) => new RegExp(`^\\${selector} \\{ stroke: var\\(--([a-z0-9-]+)\\); \\}`, 'm').exec(css)[1];
  for (const cls of ['.wr-dots', '.wr-dots--on']) {
    const ink = inkOf(cls);
    for (const [theme, block] of Object.entries(blocks)) {
      for (const paper of ['paper', 'paper-2']) {
        const r = ratio(token(block, ink), token(block, paper));
        assert.ok(r >= 3, `${cls} (--${ink}) on --${paper}, ${theme}: ${r.toFixed(2)}:1`);
      }
    }
  }
});
