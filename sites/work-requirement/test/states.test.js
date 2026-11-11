// Step 3, state by state: the states on the two numbers their exposure multiplies (Figure 3), the selected state's
// headline, worksheet card and most exposed hospitals, the full state table, and what the browser redraws from the
// page's state. Maryland is starred and out of the ranking; every state without a scenario sits in the hatched gutter or
// the territories' list with its reason and never a number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { rowToBase, scenario } from '../../../engine/js/medicaid/scenario.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { textWidth } from '../../../web/charts/text.js';
import { hospitalPathOf } from '../../../web/site.js';
import { SCENARIOS } from '../web/constants.js';
import { COPY } from '../web/copy.js';
import { loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { drawn, hospitalRows, median, stripsAlt } from '../web/program/strips.js';
import { pct } from '../../../web/render/format.js';
import {
  CAP, DRAWINGS, LABEL_FONTS, cardBody, decodeStates, headlineOf, mostExposed, numbersOf, ranked, statesAlt, statesAsset, statesBody, statesLayout,
  statesModel, tableRows,
} from '../web/program/states.js';

const data = loadMedicaid();
const rows = hospitalRows(data);
const hubCcns = loadHubCcns();
const model = statesModel(data, rows, hubCcns);
const byCode = new Map(model.states.map((s) => [s.code, s]));
const MIDDLE = SCENARIOS.indexOf('middle');
const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', hubCcns });
const section = /<section class="step wr-step wr-states" id="states"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';
const words = (markup) => textOf(markup).replace(/\s+/g, ' ').trim();
const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
const scenarioCodes = Object.entries(data.states).filter(([, s]) => s.cls === 'scenario').map(([c]) => c);

test('the model: every state in the file once, its class, and a scenario state\'s dollars its own roll-up\'s', () => {
  assert.deepEqual(model.states.map((s) => s.code).sort(), Object.keys(data.states).sort());
  for (const [code, s] of Object.entries(data.states)) {
    const m = byCode.get(code);
    assert.equal(m.cls, s.cls, code);
    assert.equal(m.name, s.name, code);
    if (s.cls !== 'scenario') {
      for (const key of ['lost', 'lostP', 'revenue', 'atRisk', 'top']) assert.ok(!(key in m), `${code}: no ${key} without a scenario`);
      continue;
    }
    SCENARIOS.forEach((c, k) => assert.equal(m.lost[k], s.rollup[c].lost, `${code} ${c}`));
    assert.equal(m.revenue, s.rollup.middle.medicaid_revenue, code);
    assert.equal(m.atRisk, s.rollup.middle.at_risk, code);
    assert.equal(m.n, s.rollup.middle.hospitals, `${code}: the roll-up's hospitals`);
    assert.deepEqual(m.declines, SCENARIOS.map((c) => s.declines[c]), code);
  }
});

test('a state\'s share of patient revenue lost is its loss over its patient revenue, both over the same hospitals', () => {
  for (const code of scenarioCodes) {
    const st = data.states[code];
    // The hospitals that report patient revenue (and have a cost report that is scored): their loss over their revenue.
    const p = [...data.hospitals.values()].filter((r) => r[col.state] === code && r[col.cls] === 'scenario' && r[col.scored] && r[col.net_patient_revenue] > 0);
    const npr = p.reduce((a, r) => a + r[col.net_patient_revenue], 0);
    const rev = p.reduce((a, r) => a + (r[col.medicaid_net_revenue] || 0), 0);
    const m = byCode.get(code);
    assert.equal(m.nP, p.length, code);
    assert.ok(Math.abs(m.nprP - npr) < 1e-6 * npr, code);
    SCENARIOS.forEach((c, k) => {
      const lost = p.reduce((a, r) => { const b = rowToBase(data.columns, r); return a + scenario(b, b.share, st.declines[c]).lost; }, 0);
      assert.ok(Math.abs(m.lostP[k] - lost) <= 1e-6 * lost, `${code} ${c}`);
      assert.ok(m.lostP[k] <= m.lost[k] * (1 + 5e-6), `${code} ${c}: part of the roll-up's loss (rows carry rounded inputs)`);
      const n = numbersOf(m, k, 1);
      assert.ok(Math.abs(n.share - lost / npr) < 1e-12, `${code} ${c}: share`);
      assert.ok(Math.abs(n.x * n.y - n.share) < 1e-12, `${code} ${c}: across × up is the share`);
      assert.ok(Math.abs(n.y - rev / npr) < 1e-12, `${code}: up is Medicaid's share of their patient revenue`);
    });
  }
});

test('the default state is the most exposed by data, the middle case\'s largest share of patient revenue lost', () => {
  const shares = scenarioCodes.map((code) => [code, numbersOf(byCode.get(code), MIDDLE, 1).share]);
  const top = shares.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.equal(mostExposed(model), top[0]);
  assert.equal(model.selected, top[0]);
  assert.match(section, new RegExp(`data-st-default="${top[0]}"`));
  assert.match(words(section), new RegExp(`${data.states[top[0]].name} is the most exposed`));
});

test('Maryland is starred, out of the bubbles and the ranking, and gets its own card', () => {
  const md = byCode.get('MD');
  assert.equal(md.cls, 'all_payer');
  for (const k of [0, 1, 2]) assert.ok(!ranked(model, k).includes('MD'), 'not ranked');
  for (const drawing of Object.keys(DRAWINGS)) {
    const layout = statesLayout({ model, drawing, k: MIDDLE, use: 1, selected: model.selected });
    assert.ok(!layout.points.some((p) => p.code === 'MD'), 'no bubble');
    const g = layout.gutter.find((p) => p.code === 'MD');
    assert.ok(g, 'in the gutter');
    assert.equal(g.label, `MD${COPY.stMark_all_payer.text}`);
    assert.match(statesBody(layout).text, /MD\*/);
  }
  const card = words(cardBody(model, 'MD', { k: MIDDLE, use: 1 }).text);
  assert.ok(card.includes(COPY.stStatus_all_payer.text), card);
  assert.equal(headlineOf(model, 'MD', { k: MIDDLE, use: 1 }).why, COPY.stWhy_all_payer.text);
  assert.doesNotMatch(card, /\$|NaN|undefined/);
  assert.equal(headlineOf(model, 'MD', { k: MIDDLE, use: 1 }).big, 'Maryland: not modeled');
});

test('non-expansion states and Wisconsin sit in the hatched gutter; territories are listed under the figure', () => {
  const gutterClasses = new Set(['not_expansion', 'no_viii_group', 'all_payer']);
  for (const drawing of Object.keys(DRAWINGS)) {
    const layout = statesLayout({ model, drawing, k: MIDDLE, use: 1, selected: model.selected });
    const want = model.states.filter((s) => gutterClasses.has(s.cls)).map((s) => s.code).sort();
    assert.deepEqual(layout.gutter.map((p) => p.code).sort(), want, drawing);
    const [g0, g1] = layout.geo.gut;
    for (const p of layout.gutter) {
      assert.ok(p.x >= g0 && p.x <= g1, `${p.code} inside the gutter`);
      assert.ok(p.y >= layout.geo.T && p.y <= layout.geo.height - layout.geo.B, `${p.code} inside the plot's height`);
    }
    assert.deepEqual(layout.points.map((p) => p.code).sort(), [...scenarioCodes].sort(), drawing);
    assert.equal(layout.gutter.find((p) => p.code === 'WI').label, `WI${COPY.stMark_no_viii_group.text}`);
    assert.match(statesBody(layout).text, /<rect class="wr-gutter" [^>]*fill="url\(#chart-wr-st-(narrow|wide)-hatch\)"/);
  }
  const note = words(/<p class="small muted fig__note">[\s\S]*?<\/p>/.exec(section)[0]);
  for (const s of model.states.filter((x) => x.cls === 'territory')) assert.ok(note.includes(s.code), s.code);
});

test('the table: one row per state or territory, with its class, sorted by share; no number for a state without a scenario', () => {
  const table = /<details class="fig__table">[\s\S]*?<\/details>/.exec(section)[0];
  const trs = [...table.matchAll(/<tr>(<th scope="row"[\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  assert.equal(trs.length, Object.keys(data.states).length);
  const status = (cls) => COPY[`stStatus_${cls}`].text;
  const seen = trs.map((tr) => {
    const cells = [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => words(m[1]));
    const s = model.states.find((x) => x.name === cells[0]);
    assert.ok(s, cells[0]);
    assert.equal(cells[1], status(s.cls), s.code);
    assert.equal(cells[3], s.y === null ? COPY.stNoNumber.text : pct(s.y, 1), `${s.code}: Medicaid share`);
    if (s.cls !== 'scenario') for (const c of cells.slice(4)) assert.equal(c, COPY.stNoNumber.text, `${s.code}: ${c}`);
    return s;
  });
  const shares = seen.filter((s) => s.cls === 'scenario').map((s) => numbersOf(s, MIDDLE, 1).share);
  assert.deepEqual(shares, [...shares].sort((a, b) => b - a), 'sorted by the middle case\'s share');
  assert.deepEqual(seen.slice(0, scenarioCodes.length).map((s) => s.cls), scenarioCodes.map(() => 'scenario'), 'scenario states first');
  assert.equal(tableRows(model).length, trs.length);
});

test('no copy says "worst"; the hospitals are "most exposed"', () => {
  for (const [key, v] of Object.entries(COPY)) assert.doesNotMatch(typeof v === 'string' ? v : v.text, /worst/i, key);
  assert.match(section, /Most exposed hospitals/);
  assert.doesNotMatch(words(page), /worst/i);
});

test('a card\'s most exposed hospitals: up to four of the state\'s drawn hospitals, sorted by share, linked only to a hub page that exists', () => {
  for (const code of scenarioCodes) {
    const m = byCode.get(code);
    const drawn = rows.filter((r) => r.state === code && r.share).sort((a, b) => b.share[MIDDLE] - a.share[MIDDLE]);
    assert.equal(m.top.length, Math.min(4, drawn.length), code);
    assert.deepEqual(m.top.map((h) => h.ccn), drawn.slice(0, 4).map((r) => r.ccn), code);
    for (const h of m.top) assert.equal(h.hub, hubCcns.has(h.ccn), `${h.ccn}: hub flag`);
  }
  // Synthetic: a model built with no hub pages links none; one with a single hub page links only it.
  const code = model.selected;
  const ccns = byCode.get(code).top.map((h) => h.ccn);
  const none = cardBody(statesModel(data, rows, new Set()), code, { k: MIDDLE, use: 1 }).text;
  assert.doesNotMatch(none, /href="\/hospital\//);
  const one = cardBody(statesModel(data, rows, new Set([ccns[1]])), code, { k: MIDDLE, use: 1 }).text;
  assert.deepEqual([...one.matchAll(/href="([^"]+)"/g)].map((x) => x[1]), [hospitalPathOf('hub', ccns[1])]);
  // Names are escaped by the family's html helper.
  const evil = { ...model, states: model.states.map((s) => (s.code === code ? { ...s, top: [{ ...s.top[0], name: '<b>x</b> & y', hub: false }] } : s)) };
  assert.match(cardBody(evil, code, { k: MIDDLE, use: 1 }).text, /&lt;b&gt;x&lt;\/b&gt; &amp; y/);
});

test('a card\'s most exposed hospitals are a closed disclosure until the reader opens it; the script keeps one opened open', () => {
  assert.match(section, /<details class="wr-hits" data-st-hits><summary class="wr-hits__h">/, 'the server draws it closed');
  assert.doesNotMatch(section, /data-st-hits open/);
  const code = model.selected;
  const closed = cardBody(model, code, { k: MIDDLE, use: 1 }).text;
  const opened = cardBody(model, code, { k: MIDDLE, use: 1, open: true }).text;
  assert.match(closed, /<details class="wr-hits" data-st-hits>/);
  assert.match(opened, /<details class="wr-hits" data-st-hits open>/);
  assert.equal(opened.replace(' data-st-hits open>', ' data-st-hits>'), closed, 'open changes nothing else');
  // Still sorted by share, largest first.
  const shares = [...closed.matchAll(/<span class="wr-hit__v">([^<]+)<\/span>/g)].map((x) => Number.parseFloat(x[1]));
  assert.deepEqual(shares, [...shares].sort((a, b) => b - a));
  // A state with no hospital to draw: a line, no disclosure to open.
  const empty = { ...model, states: model.states.map((s) => (s.code === code ? { ...s, top: [] } : s)) };
  const none = cardBody(empty, code, { k: MIDDLE, use: 1 }).text;
  assert.doesNotMatch(none, /<details/);
  assert.ok(none.includes(COPY.stHitsNone.text));
});

test('a range note keeps each bound whole on one line, a signed amount never split from its "$"', () => {
  for (const code of scenarioCodes) {
    const card = cardBody(model, code, { k: MIDDLE, use: 1 }).text;
    const notes = [...card.matchAll(/<small class="wr-wl__rg">([\s\S]*?)<\/small>/g)].map((x) => x[1]);
    assert.ok(notes.length >= 2, code);
    for (const note of notes) assert.equal((note.match(/<span class="nw">/g) ?? []).length, 2, `${code}: ${note}`);
  }
});

test('every state\'s card and headline have numbers or a reason, never "$0", NaN or an empty bar', () => {
  for (const s of model.states) {
    for (const k of [0, 1, 2]) {
      for (const use of [0.75, 1, 1.25]) {
        const card = words(cardBody(model, s.code, { k, use }).text);
        const head = headlineOf(model, s.code, { k, use });
        const all = `${card} ${head.big} ${head.why}`;
        assert.doesNotMatch(all, /NaN|undefined|null|\$0(?![.\d])|Infinity/, `${s.code} ${k} ${use}: ${all}`);
        if (s.cls !== 'scenario') {
          assert.doesNotMatch(card, /\$/, `${s.code}: no dollars`);
          assert.ok(card.includes(COPY[`stStatus_${s.cls}`].text), s.code);
          assert.equal(head.why, COPY[`stWhy_${s.cls}`].text, s.code);
        }
      }
    }
  }
});

test('the server draws the default state in the middle case; the browser\'s redraw at the default is the same markup', () => {
  const svgs = section.match(/<svg role="img"[\s\S]*?<\/svg>/g) ?? [];
  assert.equal(svgs.length, 2, 'the phone drawing and the wide one');
  for (const svg of svgs) {
    const drawing = /data-fit="(\w+)"/.exec(svg)[1];
    const body = statesBody(statesLayout({ model, drawing, k: MIDDLE, use: 1, selected: model.selected })).text;
    assert.ok(svg.includes(body), `${drawing}: the browser's body is the server's`);
    assert.match(svg, new RegExp(`<g class="wr-st wr-st--on" data-st="${model.selected}"`));
  }
  const back = decodeStates(JSON.parse(JSON.stringify(statesAsset(model))));
  assert.deepEqual(back, model);
  assert.throws(() => decodeStates({ states: [] }), TypeError);
  const card = /<div class="wr-stcard__body" data-st-card>([\s\S]*?)<\/div><!-- \/wr-stcard__body -->/.exec(section)[1];
  assert.equal(card, cardBody(back, back.selected, { k: MIDDLE, use: 1 }).text);
  // Without the script the picker is hidden and the state's name stands in its place.
  assert.match(section, /<select class="wr-stcard__pick"[^>]*hidden/);
  assert.match(section, new RegExp(`<p class="wr-stcard__name"[^>]*>${data.states[model.selected].name}</p>`));
});

test('a state\'s numbers at another use rate are the engine\'s, run at that rate over its hospitals; the case orders them', () => {
  for (const code of scenarioCodes) {
    const st = data.states[code];
    const m = byCode.get(code);
    const mine = [...data.hospitals.values()].filter((r) => r[col.state] === code && r[col.cls] === 'scenario');
    for (const use of [0.75, 1.25]) {
      SCENARIOS.forEach((c, k) => {
        let all = 0;
        let lostP = 0;
        let nprP = 0;
        for (const r of mine) {
          const b = rowToBase(data.columns, r);
          const lost = scenario(b, b.share, st.declines[c], { use }).lost;
          all += lost;
          if (b.scored && b.net_patient_revenue > 0) {
            lostP += lost;
            nprP += b.net_patient_revenue;
          }
        }
        const n = numbersOf(m, k, use);
        // The file's roll-up is summed from unrounded inputs; the rows carry rounded ones (6-place shares).
        assert.ok(Math.abs(n.lost - all) <= 5e-6 * all, `${code} ${c} at ${use}: ${n.lost} vs the engine's ${all}`);
        assert.ok(Math.abs(n.share - lostP / nprP) <= 1e-9, `${code} ${c} at ${use}: share`);
      });
    }
    assert.ok(numbersOf(m, 0, 1).share < numbersOf(m, 1, 1).share && numbersOf(m, 1, 1).share < numbersOf(m, 2, 1).share, `${code}: low < middle < high`);
  }
});

// Each label's extent as drawn: x, anchor and its font (LABEL_FONTS, by class), with the kit's width estimate.
const LABEL = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
const attr = (attrs, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(` ${attrs}`)?.[1];
const plainText = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function fontOf(cls, drawing) {
  const key = Object.keys(LABEL_FONTS).find((c) => cls.split(' ').includes(c));
  assert.ok(key, `a font for "${cls}"`);
  const f = LABEL_FONTS[key];
  return { size: f.size[drawing] ?? f.size, mono: f.mono };
}

const touch = (a, b, pad = 0) => a[0] - pad < b[0] + b[2] && a[0] + a[2] + pad > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
const onDot = (box, c, extra = 0) => {
  const nx = Math.max(box[0], Math.min(c.x, box[0] + box[2]));
  const ny = Math.max(box[1], Math.min(c.y, box[1] + box[3]));
  return (nx - c.x) ** 2 + (ny - c.y) ** 2 < (c.r + extra) ** 2;
};

test('Figure 3\'s labels, in every case at every use rate with any state selected, phone and wide: inside the drawing, none touching another, none on a dot', () => {
  let checked = 0;
  for (const drawing of Object.keys(DRAWINGS)) {
    const { width, height } = DRAWINGS[drawing];
    for (const k of [0, 1, 2]) {
      for (const use of [0.75, 1, 1.25]) {
        for (const selected of model.states.map((s) => s.code)) {
          const layout = statesLayout({ model, drawing, k, use, selected });
          const at = `${drawing} ${SCENARIOS[k]} at ${use}, ${selected} selected`;
          // Every <text> inside the drawing, by its font (LABEL_FONTS) and the kit's width estimate.
          for (const [, attrs, inner] of statesBody(layout).text.matchAll(LABEL)) {
            const { size, mono } = fontOf(attr(attrs, 'class'), drawing);
            const x = Number(attr(attrs, 'x'));
            const y = Number(attr(attrs, 'y'));
            const w = textWidth(plainText(inner), size, { mono });
            const anchor = attr(attrs, 'text-anchor') ?? 'start';
            const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
            const where = `${at}: "${plainText(inner)}" spans ${left.toFixed(1)}–${(left + w).toFixed(1)} of ${width}, baseline ${y}`;
            assert.ok(left >= 0 && left + w <= width, where);
            assert.ok(y - size * 0.8 >= 0 && y + size * 0.25 <= height, where);
            checked += 1;
          }
          // The plot's labels (the states', the contours' and their title) clear one another by 2 px across.
          const boxes = [...layout.labels.map((l) => [l.code, l.box]), ...layout.isoLabels.map((l) => [l.text, l.box]), ...(layout.isoTitle ? [['title', layout.isoTitle.box]] : [])];
          boxes.forEach(([a, ba], i) => boxes.slice(i + 1).forEach(([b, bb]) => assert.ok(!touch(ba, bb, 2), `${at}: ${a} and ${b} touch`)));
          // A state's label sits on no other state's dot; a contour's label on no dot and no whisker.
          for (const l of layout.labels) for (const p of layout.points) if (p.code !== l.code) assert.ok(!onDot(l.box, p), `${at}: ${l.code} on ${p.code}'s dot`);
          for (const l of layout.isoLabels) {
            for (const p of layout.points) {
              assert.ok(!onDot(l.box, p, 1), `${at}: ${l.text} on ${p.code}'s dot`);
              assert.ok(!(p.y + CAP >= l.box[1] && p.y - CAP <= l.box[1] + l.box[3] && p.hi >= l.box[0] && p.lo <= l.box[0] + l.box[2]), `${at}: ${l.text} on ${p.code}'s whisker or its end cap`);
            }
          }
          // Every contour drawn is labeled (statesBody draws the labeled levels only), and the selected state is named.
          assert.equal(layout.isoLabels.length, 3, `${at}: every level labeled`);
          if (layout.points.some((p) => p.on) || layout.gutter.some((g) => g.on)) assert.ok(layout.labels.some((l) => l.code === selected && l.cls === 'wr-st__name'), `${at}: the selected state named`);
          // The gutter: every dot and code inside it, none touching another.
          const [g0, g1] = layout.geo.gut;
          const gboxes = layout.gutter.flatMap((g) => [[`${g.code} dot`, [g.x - g.r, g.y - g.r, 2 * g.r, 2 * g.r]], [g.code, g.labelBox]]);
          for (const [name, b] of gboxes) assert.ok(b[0] >= g0 && b[0] + b[2] <= g1, `${at}: ${name} inside the gutter`);
          gboxes.forEach(([a, ba], i) => gboxes.slice(i + 1).forEach(([b, bb]) => assert.ok(!touch(ba, bb, 1), `${at}: gutter ${a} and ${b} touch`)));
        }
      }
    }
  }
  assert.ok(checked > 50000, `${checked} labels checked`);
});

test('the hub pages the cards link to are the ones the hub writes; a hospital without one is named in plain text', async () => {
  const { hubModel } = await import('../../../hub/data.js');
  assert.deepEqual([...hubCcns].sort(), hubModel().hospitals.map((h) => h.ccn).sort());
  const without = model.states.flatMap((s) => (s.top ?? []).filter((h) => !h.hub).map((h) => [s.code, h]));
  assert.ok(without.length > 0, 'some most exposed hospital has no hub page (a critical access hospital outside the dollar file)');
  for (const [code, h] of without) {
    const card = cardBody(model, code, { k: MIDDLE, use: 1 }).text;
    assert.ok(!card.includes(`href="${hospitalPathOf('hub', h.ccn)}"`), `${h.ccn}: not linked`);
  }
  const linked = model.states.flatMap((s) => (s.top ?? []).filter((h) => h.hub));
  assert.ok(linked.length > 0);
});

test('the figures\' text alternatives follow the case and the use rate (the browser rewrites them as they move)', () => {
  for (const svg of section.match(/<svg role="img"[^>]*>/g)) assert.ok(svg.includes(`aria-label="${statesAlt(model, MIDDLE, 1)}"`), 'step 3 at the default');
  const top = ranked(model, 2)[0];
  const at = statesAlt(model, 2, 1.25);
  assert.ok(at.includes(`${data.states[top].name} ${pct(numbersOf(byCode.get(top), 2, 1.25).share, 2)}`), at);
  assert.ok(at.includes('high case'), at);
  // Step 1's: each case's median share, scaled by the use rate.
  const items = drawn(rows);
  const mid = pct(median(items.map((r) => r.share[1] * 1.25)), 2);
  assert.ok(stripsAlt(items, 1.25).includes(mid), stripsAlt(items, 1.25));
  assert.notEqual(stripsAlt(items, 1.25), stripsAlt(items, 1));
});

test('the gutter discloses its stack: the note says dots may sit off their level, and each dot\'s title carries its true share', () => {
  const note = words(/<p class="small muted fig__note">[\s\S]*?<\/p>/.exec(section)[0]);
  assert.ok(note.includes('Gutter dots sit near their share (the table has it exactly).'), note);
  for (const drawing of Object.keys(DRAWINGS)) {
    const layout = statesLayout({ model, drawing, k: MIDDLE, use: 1, selected: model.selected });
    const body = statesBody(layout).text;
    for (const g of layout.gutter) {
      const title = new RegExp(`<g class="wr-st wr-st--none[^"]*" data-st="${g.code}"><title>([^<]*)</title>`).exec(body)?.[1];
      assert.ok(title, `${drawing} ${g.code}: a title`);
      assert.ok(title.includes(data.states[g.code].name) && title.includes(pct(byCode.get(g.code).y, 1)), `${drawing} ${g.code}: ${title}`);
    }
  }
});

// The fit test above measures each label at LABEL_FONTS's size, in the drawing's own units; the stylesheet draws them at
// the same sizes (a viewBox unit is a CSS pixel of the drawing, scaled with it), so the test holds at the size shown.
test('Figure 3\'s label sizes in the stylesheet are LABEL_FONTS\'s, in both drawings', () => {
  const css = readFileSync(REPO_ROOT + 'sites/work-requirement/web/styles.css', 'utf8');
  const sizeIn = (rule) => Number(/font(?:-size)?:[^;]*?([\d.]+)px/.exec(rule)?.[1]);
  for (const [cls, { size }] of Object.entries(LABEL_FONTS)) {
    if (!cls.startsWith('wr-')) continue;
    const base = [...css.matchAll(/^([^{}\n]+)\{([^}]*)\}/gm)].filter(([, sel, body]) => !sel.includes('data-fit') && sel.split(',').some((x) => x.trim() === `.${cls}`) && /font/.test(body));
    assert.ok(base.length, `${cls}: a font rule`);
    const wide = typeof size === 'number' ? size : size.wide;
    assert.equal(sizeIn(base[base.length - 1][2]), wide, `${cls} wide`);
    if (typeof size !== 'number' && size.narrow !== size.wide) {
      const narrow = [...css.matchAll(/^\.chart--states\[data-fit="narrow"\] ([^{]+)\{([^}]*)\}/gm)].find(([, sel]) => sel.includes(`.${cls}`));
      assert.ok(narrow, `${cls}: a narrow rule`);
      assert.equal(sizeIn(narrow[2]), size.narrow, `${cls} narrow`);
    }
  }
});
