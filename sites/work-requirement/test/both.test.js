// Step 5, exposed on both: the corner's count against the data, the cut computed from the data, the named table collapsed
// by default and sorted by share lost (ties by name), hub links only where a page exists, the page's hospital marked or
// given its reason, and every label inside its drawing at every case, use rate and width. Fixtures pick hospitals by
// property, never by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowToBase, scenario } from '../../../engine/js/medicaid/scenario.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { money } from '../../../web/render/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { BOTH_QUANTILE, BOTH_SHARE, NAMED_FIRST, SCENARIOS } from '../web/constants.js';
import { loadAway, loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import {
  DRAWINGS, LABEL_FONTS, bothBody, bothInput, bothLayout, bothModel, countsAt, cutOf, decodeBoth, exposed, covers, headHtml, namedBody, placed, readHtml, sumsOf, xOf, youHtml,
} from '../web/program/both.js';
import { awayRows, decodeChunk, hospChunks, numbersOf, serverPick, subjectOf } from '../web/program/hospital.js';
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
  assert.match(text, /a year \(\d{4} dollars\), is about/);
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
  // R28: the order is the share's, so no row carries a rank: each row opens on the hospital's name, and the head has no
  // number column.
  for (const row of String(namedBody(model, MIDDLE, 1)).match(/<tr[^>]*>[\s\S]*?<\/tr>/g)) assert.match(row, /^<tr[^>]*><th scope="row">/);
  const head = /<table class="gb wr-named__t">[\s\S]*?<\/thead>/.exec(section)[0];
  assert.equal([...head.matchAll(/<th scope="col"/g)].length, 5, 'the hospital, then the two Medicaid and the two Medicare columns');
  assert.doesNotMatch(head, /No\./);
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

// Dalton's review 11-11 (D1): the penalties' sum moves with the case because the group crossing the loss line changes, not
// any hospital's penalty. Its label names the group (the count) and a line under it says so, on the server's step and in
// what the browser redraws (client/both.js sets readHtml's markup) at every case and use rate.
test('the corner\'s penalties are labeled as these hospitals\', with their count, and a line says a case moves the group, not the penalties', () => {
  const read = /<div class="wr-both__read" data-b-read>([\s\S]*?)<\/div>/.exec(section)?.[1];
  assert.ok(read, 'the server\'s readout');
  assert.equal(read, String(readHtml(browser, MIDDLE, 1)), 'the server\'s readout is the browser\'s at the middle case and default use rate');
  const shift = 'Another case or use rate changes which hospitals cross the 1% line, not any hospital’s penalties.';
  for (const use of [0.75, 1, 1.25]) {
    for (const [k] of SCENARIOS.entries()) {
      const list = exposed(model, k, use);
      const out = readHtml(model, k, use, list);
      assert.equal(typeof out.text, 'string', 'markup the browser sets');
      const dts = [...out.text.matchAll(/<dt>([\s\S]*?)<\/dt>/g)].map((m) => words(m[1]));
      assert.ok(list.length > 1, `the corner holds more than one hospital at case ${k}, use ${use}`);
      assert.ok(dts[1].startsWith(`Medicare penalties of these ${list.length.toLocaleString('en-US')} hospitals, FY${model.penaltyFy}`), `case ${k}, use ${use}: ${dts[1]}`);
      assert.ok(words(out.text).includes(shift), `case ${k}, use ${use}: the line under the numbers`);
      // The sum is the listed hospitals' own penalties, the same at any use rate for the same hospitals.
      assert.ok(out.text.includes(`<dd>${money(-sumsOf(list, k, use).pen)}</dd>`), `case ${k}, use ${use}: their penalties`);
      assert.doesNotMatch(words(out.text), BAD);
    }
  }
  // The counts move with the case while no hospital's penalty does: a hospital in two cases' corners carries one penalty.
  const [low, high] = [exposed(model, 0, 1), exposed(model, SCENARIOS.length - 1, 1)];
  assert.ok(low.length < high.length);
  for (const p of low) assert.equal(high.find((q) => q.ccn === p.ccn)?.pen, p.pen, p.ccn);
  // One hospital, or none: the words say "this one" or nothing to count, and never "these 1".
  const one = { ...model, pts: [exposed(model, MIDDLE, 1)[0]] };
  assert.match(words(readHtml(one, MIDDLE, 1)), /Medicare penalties of this one hospital, FY\d{4}/);
  const none = { ...model, pts: [] };
  const empty = words(readHtml(none, MIDDLE, 1));
  assert.match(empty, /None exposed on both/);
  assert.match(empty, /Medicare penalties, FY\d{4}/);
  assert.ok(empty.includes(shift));
  assert.doesNotMatch(empty, /these \d/);
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
  for (const r of none) {
    const out = String(youHtml(model, r, MIDDLE, 1));
    assert.match(out, /<a href="#hospital">/);
    assert.match(words(out), /has no dot here/);
  }
  const zero = rows.find((r) => model.at.get(r.ccn)?.kind === 'plot' && model.pts[model.at.get(r.ccn).i].pen === 0);
  assert.match(words(youHtml(model, zero, MIDDLE, 1)), /no FY\d{4} penalty/);
  assert.match(words(youHtml(model, plotRow, MIDDLE, 1)), /FY\d{4} penalties of [\d.]+% of its patient revenue\./);
  // Markup the browser sets with .text, for every kind of hospital, case and use rate, and never a bad value.
  for (const r of [stripRow, plotRow, zero, ...none, null]) {
    for (const [k] of SCENARIOS.entries()) {
      const out = youHtml(model, r, k, 1.25);
      assert.equal(typeof out.text, 'string', r?.ccn ?? 'none');
      assert.doesNotMatch(words(out.text), BAD);
    }
  }
});

// R43: the page's hospital's share in step 5's line prints through step 4's formatter (web/medicaid/format.js
// caseShareTexts: one decision over the three cases, "under" a share too small to print, never "0.00%"), so the same
// hospital reads the same string in both steps. Step 5's shares come from step 1's 7-place shares (and the file's whole-dollar
// middle loss at other use rates), step 4's from the engine, so the two agree to 1e-7 and a dollar of patient revenue;
// the strings differ only where a printing boundary falls between them (a handful of the thousands of lines).
test('the page\'s hospital\'s share lost in step 5 is step 4\'s string, at every case and the default and extreme use rates', () => {
  const chunks = new Map([...hospChunks(data, rows, hubCcns)].map(([code, chunk]) => [code, decodeChunk(JSON.parse(JSON.stringify(chunk)))]));
  const shareOf = (markup) => /(?:exposed on both|outside the corner): (.+?) of its patient revenue lost/.exec(words(markup))?.[1];
  const places = (text) => (/\.(\d+)%/.exec(text)?.[1].length ?? 0) + 2;
  let n = 0;
  let under = 0;
  const straddles = [];
  for (const r of rows) {
    const at = model.at.get(r.ccn);
    if (at?.kind !== 'plot') continue;
    const p = model.pts[at.i];
    const s = subjectOf(r, chunks.get(r.state));
    for (const use of [0.75, 1, 1.25]) {
      const step4 = numbersOf(s, use);
      const mine = SCENARIOS.map((_, k) => xOf(p, k, use));
      for (const k of SCENARIOS.keys()) {
        const got = shareOf(youHtml(model, r, k, use));
        n += 1;
        assert.doesNotMatch(got, /^0\.0+%$/, `${r.ccn}: never a zero share`);
        if (got.startsWith('under')) under += 1;
        assert.ok(Math.abs(mine[k] - step4.share[k]) < 1e-7 + 1 / p.npr, `${r.ccn} case ${k} use ${use}: the shares agree`);
        if (got === step4.shareText[k]) continue;
        // Not the formatter: the same two values, rounded at the printed places, land either side of a boundary.
        const unit = 10 ** places(got);
        assert.notEqual(Math.round(mine[k] * unit), Math.round(step4.share[k] * unit), `${r.ccn} case ${k} use ${use}: ${got} vs ${step4.shareText[k]}`);
        straddles.push(r.ccn);
      }
    }
  }
  assert.ok(n > 5000, `${n} lines checked`);
  assert.ok(under > 0, 'a hospital whose share prints as "under" the smallest share is among them');
  assert.ok(straddles.length <= n / 1000, `${straddles.length} of ${n} lines straddle a boundary`);
  // The server's own hospital reads the same in both steps.
  const pick = serverPick(rows);
  const s = subjectOf(pick, chunks.get(pick.state));
  if (model.at.get(pick.ccn)?.kind === 'plot') assert.equal(shareOf(youHtml(model, pick, MIDDLE, 1)), numbersOf(s, 1).shareText[MIDDLE]);
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

test('no strip dot sits under a label, at every case, use rate and width', () => {
  for (const drawing of ['narrow', 'wide']) {
    for (const [k] of SCENARIOS.entries()) {
      for (const use of USES) {
        const L = bothLayout({ model, drawing, k, use });
        const boxes = [...L.labels, ...L.tags, ...L.xTicks.map((x) => x.label), ...L.yTicks.map((y) => y.label)].filter(Boolean).map((l) => l.box);
        const r = L.geo.stripDot / 2;
        for (const [x, y] of L.stripDots) assert.ok(!boxes.some((b) => overlap(b, [x - r, y - r, 2 * r, 2 * r])), `${drawing} ${k} ${use}: a strip dot at ${x}, ${y} under a label`);
      }
    }
  }
});

test('the page\'s hospital, every one plotted or in the strip, at each case, use rate and width: its mark under no label, its name inside the plot, no two labels touching', () => {
  let n = 0;
  for (const drawing of ['narrow', 'wide']) {
    const geo = DRAWINGS[drawing];
    for (const [k] of SCENARIOS.entries()) {
      for (const use of [0.75, 1, 1.25]) {
        const L = bothLayout({ model, drawing, k, use });
        const still = [...L.tags, ...L.xTicks.map((x) => x.label), ...L.yTicks.map((y) => y.label)].filter(Boolean);
        for (const ccn of [...model.pts, ...model.strip].map((p) => p.ccn)) {
          const { labels, page } = placed(model, L, ccn);
          const what = `${ccn} ${drawing} ${k} ${use}`;
          const all = [...labels, ...still, ...(page.label ? [page.label] : [])];
          for (const l of all) {
            assert.ok(!covers(l.box, page, L.strip), `${what}: "${l.text}" covers the mark`);
            assert.ok(l.box[0] >= 0 && l.box[0] + l.box[2] <= geo.width && l.box[1] >= 0 && l.box[1] + l.box[3] <= geo.height, `${what}: "${l.text}" leaves the drawing`);
          }
          for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) assert.ok(!overlap(all[i].box, all[j].box), `${what}: "${all[i].text}" touches "${all[j].text}"`);
          if (!page.inStrip) {
            assert.ok(page.label, `${what}: no room for the name`);
            const b = page.label.box;
            assert.ok(b[0] >= L.plot.x0 && b[0] + b[2] <= L.plot.x1 && b[1] >= L.plot.y0 && b[1] + b[3] <= L.plot.y1, `${what}: the name leaves the plot`);
          }
          n += 1;
        }
      }
    }
  }
  assert.ok(n > 50000, `${n} placements`);
});
