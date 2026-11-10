// Step 5, exposed on both: the corner's count against the data, the cut computed from the data, the named table collapsed
// by default and sorted by share lost (ties by name), hub links only where a page exists, the page's hospital marked or
// given its reason, and every label inside its drawing at every case, use rate and width. Fixtures pick hospitals by
// property, never by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowToBase, scenario } from '../../../engine/js/medicaid/scenario.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { hospitalPathOf } from '../../../web/site.js';
import { BOTH_QUANTILE, BOTH_SHARE, NAMED_FIRST, SCENARIOS } from '../web/constants.js';
import { loadAway, loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import {
  DRAWINGS, LABEL_FONTS, bothBody, bothInput, bothLayout, bothModel, countsAt, cutOf, decodeBoth, exposed, headHtml, namedBody, pageMark, xOf, youHtml,
} from '../web/program/both.js';
import { awayRows, serverPick } from '../web/program/hospital.js';
import { hospitalRows } from '../web/program/strips.js';

const data = loadMedicaid();
const rows = hospitalRows(data);
const hubCcns = loadHubCcns();
const input = bothInput(data, rows, hubCcns);
const model = bothModel(rows, input);
// The browser's copy: the input through JSON, decoded, over the strips' rows.
const browser = bothModel(rows, decodeBoth(JSON.parse(JSON.stringify(input))));
const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
const MIDDLE = SCENARIOS.indexOf('middle');
const USES = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25];
const words = (markup) => textOf(String(markup)).replace(/\s+/g, ' ').trim();
const BAD = /NaN|undefined|null|Infinity|(?<![\d.,])\$0(?![\d.,])/;
const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', hubCcns });
const section = /<section class="step wr-step wr-both" id="both"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';

// The corner straight from the file, with none of both.js: each hospital step 1 draws (a share) that the file gives a
// FY penalty (hrrp or hac not null); across, its loss in the case over its patient revenue (the file's middle_lost in the
// middle case, the engine's otherwise) times the use rate; up, its penalties over the same revenue.
const fromFile = (() => {
  const drawnCcns = new Set(rows.filter((r) => r.share).map((r) => r.ccn));
  const out = [];
  for (const row of data.hospitals.values()) {
    if (!drawnCcns.has(row[col.ccn]) || (row[col.hrrp] === null && row[col.hac] === null)) continue;
    const b = rowToBase(data.columns, row);
    const npr = row[col.net_patient_revenue];
    const lost = SCENARIOS.map((s, k) => (k === MIDDLE ? row[col.middle_lost] : scenario(b, b.share, data.states[b.state].declines[s]).lost));
    out.push({ ccn: b.ccn, npr, lost, y: -((row[col.hrrp] ?? 0) + (row[col.hac] ?? 0)) / npr });
  }
  return out;
})();

test('the cut is the top quarter of penalty share among the hospitals plotted, computed from the data', () => {
  assert.equal(model.pts.length, fromFile.length);
  const sorted = fromFile.map((h) => h.y).sort((a, b) => a - b);
  assert.equal(model.cut, sorted[Math.floor(BOTH_QUANTILE * (sorted.length - 1))]);
  // A quarter of the plotted hospitals (to the rank's rounding) sit at or above it; the plotted include those with no penalty.
  const above = sorted.filter((y) => y >= model.cut).length;
  assert.ok(Math.abs(above - sorted.length / 4) <= 2, `${above} of ${sorted.length}`);
  assert.ok(sorted[0] === 0, 'hospitals with no penalty are plotted, and count toward the cut');
  assert.ok(model.cut > 0);
  assert.equal(cutOf([4, 1, 3, 2, 5], 0.75), 4);
  assert.equal(browser.cut, model.cut);
});

test('the corner\'s count equals the hospitals in the data meeting both cuts, in each case at each use rate', () => {
  for (const use of USES) {
    const want = SCENARIOS.map((_, k) => fromFile.filter((h) => (h.lost[k] * use) / h.npr >= BOTH_SHARE && h.y >= model.cut).length);
    assert.deepEqual(countsAt(model, use), want, `use ${use}`);
    assert.deepEqual(countsAt(browser, use), want, `browser, use ${use}`);
    assert.ok(want[0] < want[1] && want[1] < want[2], `low < middle < high at ${use}: ${want}`);
    // The layout's count, the one the corner prints, is the same.
    for (const [k] of SCENARIOS.entries()) assert.equal(bothLayout({ model, drawing: 'wide', k, use }).n, want[k]);
  }
  // Every hospital in the corner pays a FY penalty.
  for (const [k] of SCENARIOS.entries()) for (const p of exposed(model, k, 1.25)) assert.ok(p.pen > 0, p.ccn);
});

test('the middle case at the default use rate uses the file\'s own loss', () => {
  for (const p of model.pts) assert.equal(p.lost[MIDDLE], data.hospitals.get(p.ccn)[col.middle_lost], p.ccn);
});

test('the step leads with its range and finding; the corner is named as the top quarter of penalty share', () => {
  assert.ok(section, 'step 5 is on the page');
  const counts = countsAt(model, 1);
  const text = words(section);
  assert.match(text, new RegExp(`${counts[0].toLocaleString('en-US')} to ${counts[2].toLocaleString('en-US')} hospitals exposed on both`));
  assert.match(text, /top quarter of penalty share/);
  assert.match(text, /about \d+ times their FY\d{4} Medicare penalties/);
  assert.doesNotMatch(text, /\bworst\b/i);
  assert.doesNotMatch(text, BAD);
  assert.ok(section.includes('SCENARIO · 2023 $') || /Scenario · 2023 \$/.test(section));
});

test('the named table is collapsed by default: a <details> without open, the first rows shown, the rest held for "Show all"', () => {
  const details = /<details class="wr-named"[^>]*>/.exec(section)?.[0];
  assert.ok(details, 'the named table is a <details>');
  assert.doesNotMatch(details, /\bopen\b/);
  // Exactly one <details> on the step is open-able by default and none is open.
  assert.doesNotMatch(section, /<details[^>]*\bopen\b/);
  const trs = [...section.matchAll(/<tr( class="wr-named__more")? data-ccn="(\d{6})">/g)];
  const list = exposed(model, MIDDLE, 1);
  assert.equal(trs.length, list.length);
  trs.forEach(([, more], i) => assert.equal(Boolean(more), i >= NAMED_FIRST, `row ${i + 1}`));
  assert.match(section, /<button type="button" class="wr-hrand" data-b-all hidden>Show all [\d,]+<\/button>/);
});

test('the named table is sorted by share lost, largest first, ties broken by name', () => {
  for (const [k] of SCENARIOS.entries()) {
    for (const use of [0.75, 1, 1.25]) {
      const list = exposed(model, k, use);
      for (let i = 1; i < list.length; i += 1) {
        const [a, b] = [list[i - 1], list[i]];
        const d = xOf(a, k, use) - xOf(b, k, use);
        assert.ok(d > 0 || (d === 0 && a.name.localeCompare(b.name) <= 0), `${a.ccn} before ${b.ccn}`);
      }
      const ccns = [...String(namedBody(model, k, use)).matchAll(/data-ccn="(\d{6})"/g)].map((m) => m[1]);
      assert.deepEqual(ccns, list.map((p) => p.ccn));
    }
  }
  // Ties, on synthetic hospitals: equal shares go by name.
  const synth = (ccn, name, share) => ({ ccn, name, city: 'X', state: 'ZZ', cls: 'scenario', groups: 0, share: [share, share, share] });
  const synthRows = [synth('990001', 'Zeta', 0.02), synth('990002', 'Alpha', 0.02), synth('990003', 'Mid', 0.03), synth('990004', 'Low', 0.001)];
  const synthModel = bothModel(synthRows, { fy: 2023, penaltyFy: 2026, top: 0.2, cols: ['ccn', 'npr', 'pen', 'hub', 'mid'], rows: synthRows.map((r) => [r.ccn, 1e6, 5000, 0, r.share[1] * 1e6]) });
  assert.deepEqual(exposed(synthModel, MIDDLE, 1).map((p) => p.name), ['Mid', 'Alpha', 'Zeta']);
});

test('a name links to /hospital/<ccn>/ only when the hub page exists; every hospital in the corner has one; names are escaped', () => {
  for (const [k] of SCENARIOS.entries()) {
    for (const p of exposed(model, k, 1.25)) assert.ok(hubCcns.has(p.ccn) && p.hub, `${p.ccn} is exposed on both and has a hub page`);
  }
  for (const p of model.pts) assert.equal(p.hub, hubCcns.has(p.ccn));
  const body = String(namedBody(model, MIDDLE, 1));
  for (const p of exposed(model, MIDDLE, 1)) assert.ok(body.includes(`<a href="${hospitalPathOf('hub', p.ccn)}">`), p.ccn);
  // Synthetic: no hub page, no link; a name with markup characters is escaped.
  const r = { ccn: '990001', name: 'A & B <Clinic>', city: 'X', state: 'ZZ', cls: 'scenario', groups: 0, share: [0.02, 0.02, 0.02] };
  const m = bothModel([r], { fy: 2023, penaltyFy: 2026, top: 0.2, cols: ['ccn', 'npr', 'pen', 'hub', 'mid'], rows: [[r.ccn, 1e6, 5000, 0, 20000]] });
  const out = String(namedBody(m, MIDDLE, 1));
  assert.ok(out.includes('A &amp; B &lt;Clinic&gt;'));
  assert.doesNotMatch(out, /<a /);
});

test('the server\'s figure, words and table equal the browser\'s for the server\'s own hospital (R5)', () => {
  const pick = serverPick(rows);
  for (const drawing of ['narrow', 'wide']) {
    const svg = new RegExp(`<svg[^>]*data-fit="${drawing}"[^>]*>([\\s\\S]*?)</svg>`).exec(section)?.[1];
    assert.ok(svg, drawing);
    assert.equal(svg, String(bothBody(bothLayout({ model: browser, drawing, k: MIDDLE, use: 1, ccn: pick.ccn }))));
  }
  assert.ok(section.includes(String(headHtml(browser, MIDDLE, 1))));
  assert.ok(section.includes(String(namedBody(browser, MIDDLE, 1))));
  assert.ok(section.includes(String(youHtml(browser, pick, MIDDLE, 1))));
});

test('the page\'s hospital: marked in the plot or the strip, or a reason line linking step 4; never a bad value', () => {
  const stripRow = rows.find((r) => model.at.get(r.ccn)?.kind === 'strip');
  const plotRow = rows.find((r) => model.at.get(r.ccn)?.kind === 'plot');
  const none = [rows.find((r) => r.cls === 'all_payer'), rows.find((r) => r.cls === 'not_expansion'), rows.find((r) => r.cls === 'scenario' && !r.share), awayRows(loadAway(data, hubCcns))[0]];
  for (const drawing of ['narrow', 'wide']) {
    const s = bothLayout({ model, drawing, k: MIDDLE, use: 1, ccn: stripRow.ccn }).page;
    assert.ok(s.inStrip && s.label === null);
    const p = bothLayout({ model, drawing, k: MIDDLE, use: 1, ccn: plotRow.ccn }).page;
    assert.ok(!p.inStrip && p.label);
    for (const r of none) assert.equal(bothLayout({ model, drawing, k: MIDDLE, use: 1, ccn: r.ccn }).page, null, r.ccn);
  }
  assert.match(words(youHtml(model, stripRow, MIDDLE, 1)), /hatched strip/);
  // Every strip hospital, each case and width: the strip's label stays inside the drawing, and off the mark where the
  // strip's other end has room.
  for (const drawing of ['narrow', 'wide']) {
    for (const [k] of SCENARIOS.entries()) {
      for (const s of model.strip) {
        const L = bothLayout({ model, drawing, k, use: 1, ccn: s.ccn });
        const b = L.labels.find((l) => l.cls === 'wr-b__strip').box;
        assert.ok(b[0] >= L.plot.x0 && b[0] + b[2] <= L.plot.x1, `${s.ccn} ${drawing}: the strip's label`);
        if (L.page.x > L.plot.x0 + 12 + b[2]) assert.ok(L.page.x < b[0] - 6 || L.page.x > b[0] + b[2] + 6, `${s.ccn} ${drawing} ${k}: the label covers the mark`);
      }
    }
  }
  for (const r of none) {
    const out = String(youHtml(model, r, MIDDLE, 1));
    assert.match(out, /<a href="#hospital">/);
    assert.match(words(out), /has no dot here/);
  }
  const zero = rows.find((r) => model.at.get(r.ccn)?.kind === 'plot' && model.pts[model.at.get(r.ccn).i].pen === 0);
  assert.match(words(youHtml(model, zero, MIDDLE, 1)), /no FY\d{4} penalty/);
  // Markup the browser sets with .text, for every kind of hospital, case and use rate, and never a bad value.
  for (const r of [stripRow, plotRow, zero, ...none, null]) {
    for (const [k] of SCENARIOS.entries()) {
      const out = youHtml(model, r, k, 1.25);
      assert.equal(typeof out.text, 'string', r?.ccn ?? 'none');
      assert.doesNotMatch(words(out.text), BAD);
    }
  }
});

// The fit test: a label's box, its font's width estimate (an upper bound on what the browser draws).
const inside = (box, geo) => box[0] >= 0 && box[0] + box[2] <= geo.width && box[1] >= 0 && box[1] + box[3] <= geo.height;
const overlap = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

test('every label in Figure 5 stays inside its drawing, whole, with no two touching, at every case, use rate and width', () => {
  for (const drawing of ['narrow', 'wide']) {
    const geo = DRAWINGS[drawing];
    for (const [k] of SCENARIOS.entries()) {
      for (const use of USES) {
        const L = bothLayout({ model, drawing, k, use });
        const fixed = [...L.labels, ...L.tags, ...L.xTicks.map((x) => x.label), ...L.yTicks.map((y) => y.label)].filter(Boolean);
        for (const l of fixed) {
          assert.ok(LABEL_FONTS[l.cls], l.cls);
          assert.ok(inside(l.box, geo), `${drawing} ${k} ${use}: "${l.text}" leaves the drawing`);
          assert.doesNotMatch(l.text, /…/);
        }
        for (let i = 0; i < fixed.length; i += 1) {
          for (let j = i + 1; j < fixed.length; j += 1) assert.ok(!overlap(fixed[i].box, fixed[j].box), `${drawing} ${k} ${use}: "${fixed[i].text}" touches "${fixed[j].text}"`);
        }
      }
    }
  }
});

test('the page\'s hospital\'s name, for every plotted hospital, case, use rate and width: inside the plot, clear of the fixed labels', () => {
  let n = 0;
  for (const drawing of ['narrow', 'wide']) {
    for (const [k] of SCENARIOS.entries()) {
      for (const use of [0.75, 1, 1.25]) {
        const L = bothLayout({ model, drawing, k, use });
        for (const p of model.pts) {
          const m = pageMark(model, L, p.ccn);
          assert.ok(m.label, `${p.ccn} ${drawing} ${k} ${use}: no room for the name`);
          const b = m.label.box;
          assert.ok(b[0] >= L.plot.x0 && b[0] + b[2] <= L.plot.x1 && b[1] >= L.plot.y0 && b[1] + b[3] <= L.plot.y1, `${p.ccn} ${drawing}: the name leaves the plot`);
          for (const l of L.labels) assert.ok(!overlap(b, l.box), `${p.ccn} ${drawing} ${k} ${use}: the name touches "${l.text}"`);
          n += 1;
        }
      }
    }
  }
  assert.ok(n > 30000, `${n} names placed`);
});
