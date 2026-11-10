// A hospital page's what-if and its other-hospitals table (figures/whatif-data.js, whatif.js, neighbors-data.js, neighbors.js):
// the server's state at the actual ratios is whatIfPaf and CMS's factor; the sliders, their ranges and escape values; nothing to
// simulate; the area table (more than one hospital, current row marked, cut descending, 25 to a page) with its one CSV and the map.
// First on synthetic hospitals, then on the data, hospitals picked by property.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP, CONDS, cutPct, isMeasured, peerMedian } from '../../../engine/js/hrrp/formula.js';
import { sliderRange, whatIfPaf } from '../../../engine/js/hrrp/whatif.js';
import { createContext } from '../../../pipeline/site/context.js';
import { generateHrrp } from '../web/generate.js';
import { areaGroups, areaKeyOf } from '../web/figures/neighbors-data.js';
import { FACTOR_STEP, WI_STEP, medianTarget, movedHospital, resultWords, whatIfData, whatIfState, whatIfWaterfall } from '../web/figures/whatif-data.js';
import { escapeWords, overNote } from '../web/figures/whatif.js';
import { fmtMoney } from '../web/numbers.js';
import { HOSPITAL_COLUMNS, hospitalCsv } from '../web/csv.js';
import { csvPath } from '../web/links.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalContext, hospitalView } from '../web/view.js';
import { ASSETS, CONDITIONS, CUT, HISTORY, META, NONE_MEASURED, OTHERS, hospital, loadHrrpOnce } from './fixtures.js';
import { withTemp } from '../../../pipeline/test/helpers.js';

const ctxFor = (hospitals, extra = {}) => hospitalContext({ hospitals, meta: META, history: HISTORY, conditions: CONDITIONS, ...extra });
const pageOf = (h, ctx) => hospitalPage({ view: hospitalView(h, ctx), robots: null, assets: ASSETS });
const figureOf = (text, n) => new RegExp(`<figure class="fig" id="figure-${n}"[\\s\\S]*?</figure>`).exec(text)?.[0] ?? '';
const ALL = [CUT, NONE_MEASURED, ...OTHERS];
const ctx = ctxFor(ALL);

// ---------- the what-if, synthetic ----------

test('what-if: at the actual ratios the state is whatIfPaf, which is CMS\'s factor; at the median it is no cut', () => {
  const start = whatIfState(CUT, META);
  assert.equal(start.paf, CUT.paf);
  assert.equal(start.paf, whatIfPaf(CUT, META, {}));
  assert.equal(start.cut, cutPct(CUT.paf));
  assert.equal(start.dollars, CUT.pen);
  const med = peerMedian(META, CUT.peer, 'HF');
  assert.deepEqual(whatIfState(CUT, META, { HF: med }), { paf: 1, cut: 0, dollars: 0 });
  // half-way down: the cut moves by the recomputed part (weight 0.1 x neutrality modifier 1 x 0.05 = 0.5 points)
  const half = whatIfState(CUT, META, { HF: 1.05 });
  assert.equal(half.paf, 0.995);
  assert.equal(half.dollars, 50000);
  assert.equal(whatIfState({ ...CUT, base: null, pen: null }, META).dollars, null, 'no base payments, no dollars');
});

test('what-if: one slider for each measured condition, its range from sliderRange widened to hold the ratio, step 0.001', () => {
  const wi = whatIfData(CUT, ctx);
  assert.deepEqual(wi.sliders.map((s) => s.cond), ['AMI', 'HF'], 'only the measured ones, in the data\'s order');
  for (const s of wi.sliders) {
    assert.deepEqual([s.min, s.max], sliderRange(s.err));
    assert.ok(s.min <= s.err && s.err <= s.max);
  }
  const far = hospital({ id: '990030', c: { HF: { n: 40, err: 1.6, flag: 1, ratio: 0.1 } } });
  const [s] = whatIfData(far, ctx).sliders;
  assert.ok(s.max >= 1.6 && s.max > 1.25, 'widened past the usual 1.25');
  const page = figureOf(pageOf(CUT, ctx), 2);
  assert.equal((page.match(/type="range"/g) ?? []).length, 2);
  assert.equal((page.match(new RegExp(`step="${WI_STEP}"`, 'g')) ?? []).length, 2);
  assert.ok(page.includes('<fieldset class="wi__fields" data-wi="fields" disabled>'), 'disabled until the script enables it');
  assert.ok(page.includes('value="1.1"') && page.includes('>1.100</output>'), 'at the actual ratio');
});

test('what-if: escape value (the ratio that reaches the median) and what it saves, for a condition over its median', () => {
  const [ami, hf] = whatIfData(CUT, ctx).sliders;
  assert.equal(ami.escape, null, 'under its median: no escape');
  assert.equal(hf.escape.ratio, 1);
  assert.equal(hf.escape.saveCut, 1);
  assert.equal(hf.escape.saveDollars, 100000);
  const text = figureOf(pageOf(CUT, ctx), 2);
  assert.match(text, /Down to 1\.0000, it adds nothing: the cut shrinks by 1\.00% of base payments, about \$100K\./);
  assert.match(text, /At or under the median already\./);
  // the table behind it has the same numbers
  assert.match(text, /<td[^>]*data-value="1"[^>]*>1\.0000<\/td>/);
});

test('what-if: while the other conditions keep the cut at its maximum, reaching the median alone saves nothing, and says so', () => {
  const capped = hospital({ id: '990031', paf: 0.97, red: 3, pen: 300000, c: { HF: { n: 40, err: 1.5, flag: 1, ratio: 0.1 }, AMI: { n: 40, err: 1.5, flag: 1, ratio: 0.1 } } });
  const wi = whatIfData(capped, ctx);
  for (const s of wi.sliders) assert.deepEqual([s.escape.saveCut, s.escape.saveDollars, s.escape.atCap], [0, 0, true]);
  assert.match(figureOf(pageOf(capped, ctx), 2), /the other conditions still keep the cut at its maximum/);
  assert.ok(CAP === 0.03);
});

test('what-if: where each condition alone saves a step more than its share, the rows add up past the cut, and a note under the figure says why', () => {
  // Two conditions, each 0.014% of base payments over its median: together 0.028%, a cut of three steps of the factor; either
  // alone leaves 0.014%, one step, so each saves two, and the rows add up to four.
  const c = { HF: { n: 40, err: 1.0014, flag: 1, ratio: 0.1 }, AMI: { n: 40, err: 1.0014, flag: 1, ratio: 0.1 } };
  const stepped = hospital({ id: '990033', paf: 0.9997, red: 0.03, base: 10000000, pen: 3000, c });
  const wi = whatIfData(stepped, ctx);
  assert.deepEqual(wi.sliders.map((s) => [s.escape.saveCut, s.escape.saveDollars]), [[0.02, 2000], [0.02, 2000]]);
  assert.equal(wi.start.cut, 0.03);
  assert.deepEqual(wi.over, { why: 'steps', step: 1000 });
  const note = 'Each saving is for that condition alone. The payment adjustment factor has four decimal places, so the cut moves in steps of about $1K, and the savings above add up to more than the cut.';
  const fig = figureOf(pageOf(stepped, ctx), 2);
  assert.ok(fig.includes(`<p class="small muted fig__note">${note}</p>`), 'under the figure');
  assert.ok(fig.indexOf('fig__note') > fig.indexOf('data-wi="parts"') && fig.indexOf('fig__note') < fig.indexOf('fig__source'), 'after the chart, before the source');
  assert.match(overNote({ why: 'steps', step: null }), /in steps of 0\.01% of base payments,/, 'with no base payments, the step as their share');
  // One step each and two in all, so the percents add up; only the dollars, $1,500 each printed as $2K, come to more than $3K.
  const half = { HF: { ...c.HF, err: 1.001 }, AMI: { ...c.AMI, err: 1.001 } };
  const rounded = hospital({ id: '990034', paf: 0.9998, red: 0.02, base: 15000000, pen: 3000, c: half });
  const wr = whatIfData(rounded, ctx);
  assert.deepEqual(wr.sliders.map((s) => [s.escape.saveCut, s.escape.saveDollars]), [[0.01, 1500], [0.01, 1500]]);
  assert.equal(wr.over.why, 'rounded');
  assert.ok(figureOf(pageOf(rounded, ctx), 2).includes('<p class="small muted fig__note">Each dollar figure is rounded, so the savings above add up to more than the cut.</p>'));
  // One condition over its median saves the whole cut: no note.
  assert.equal(whatIfData(CUT, ctx).over.why, null);
  assert.ok(!figureOf(pageOf(CUT, ctx), 2).includes('fig__note'));
});

test('what-if: the waterfall follows the ratios; a condition brought under its median reads "at or under", not "rounds to nothing"', () => {
  const wf0 = whatIfWaterfall(CUT, META, CONDITIONS);
  assert.ok(wf0.sum > 0);
  const med = peerMedian(META, CUT.peer, 'HF');
  const moved = movedHospital(CUT, META, { HF: med });
  assert.equal(moved.c.HF.flag, 0);
  assert.equal(moved.c.AMI.flag, CUT.c.AMI.flag, 'a condition not moved keeps CMS\'s flag');
  assert.equal(CUT.c.HF.flag, 1, 'the hospital itself is not changed');
  const wf = whatIfWaterfall(CUT, META, CONDITIONS, { HF: med });
  assert.equal(wf.sum, 0);
  const hf = wf.parts.find((p) => p.cond === 'HF');
  assert.equal(hf.zero, 'below');
});

test('what-if: no condition measured says there is nothing to simulate and carries no figure number or script data', () => {
  const text = pageOf(NONE_MEASURED, ctx);
  assert.match(text, /No condition had 25 or more cases, so there is nothing to simulate\./);
  assert.ok(!text.includes('data-hosp-whatif') && !text.includes('id="hrrp-hospital"'));
  assert.ok(/id="figure-2"[\s\S]*Penalized|id="figure-2"[\s\S]*year/.test(text), 'the history takes figure 2');
});

test('what-if: no estimate leaves the dollars field saying so; the page data hold what the browser needs and nothing else', () => {
  const noEst = hospital({ id: '990032', base: null, pen: null });
  const text = pageOf(noEst, ctx);
  assert.match(text, /<span data-wi="dollars">—<\/span>/);
  assert.ok(text.includes('no estimate for this hospital'));
  const json = /<script type="application\/json" id="hrrp-hospital">([\s\S]*?)<\/script>/.exec(pageOf(CUT, ctx));
  const data = JSON.parse(json[1]);
  assert.deepEqual(Object.keys(data).sort(), ['base', 'conditions', 'edition', 'meta', 'row'].sort());
  assert.deepEqual(Object.keys(data.meta.peerMedians), [String(CUT.peer)], 'only its own peer group\'s medians');
  assert.ok(json[1].length < 1500, `small (${json[1].length} bytes)`);
});

test('what-if: the page loads the hospital script, and the figure numbers follow the page order', () => {
  const text = pageOf(CUT, ctx);
  assert.ok(text.includes('src="/assets/hrrp-hospital.test.js"'));
  assert.deepEqual([...text.matchAll(/<figure class="fig" id="figure-(\d)"/g)].map((m) => m[1]), ['1', '2', '3', '4']);
  assert.match(figureOf(text, 2), /Drag a ratio to see how the cut would change\. This is an approximation: peer medians, payment weights and the neutrality modifier stay at their FY2027 values\./);
});

// ---------- the area table, synthetic ----------

test('neighbors: only areas with more than one hospital; largest cut first, current row marked, 25 to a page', () => {
  const groups = areaGroups(ALL, META);
  assert.equal(groups.size, 1);
  const area = [...groups.values()][0];
  assert.deepEqual(area.rows.map((r) => r.h.red), [...area.rows.map((r) => r.h.red)].sort((a, b) => b - a));
  assert.deepEqual(area.rows.map((r) => r.rank), area.rows.map((_, i) => i + 1));
  assert.equal(areaGroups([CUT], META).size, 0, 'a hospital alone');
  const text = pageOf(CUT, ctx);
  const fig = figureOf(text, 4);
  assert.equal((fig.match(/aria-current="true"/g) ?? []).length, 1);
  assert.match(fig, /This hospital<\/span>/);
  assert.match(fig, /hospitals in the Exampleton, ZZ metro area, largest cut first\./);
  // the alone hospital has no figure
  assert.ok(!pageOf(CUT, ctxFor([CUT])).includes('data-nb'));
  const many = Array.from({ length: 60 }, (_, i) => hospital({ id: `9901${String(i).padStart(2, '0')}`, red: i / 10, paf: 1 - i / 1000, pen: i * 1000 }));
  const big = [...areaGroups(many, META).values()][0];
  assert.deepEqual(big.pages.map((p) => p.length), [25, 25, 10]);
  const bigText = pageOf(many[40], ctxFor(many));
  assert.equal((bigText.match(/<tbody data-page="/g) ?? []).length, 3);
  assert.equal((bigText.match(/data-to-page="/g) ?? []).length, 3);
  assert.match(bigText, /<nav class="seg nb__pager"[^>]*hidden>/, 'the pager is hidden until the script');
});

test('neighbors: outside any metro area the table is the rest of the state', () => {
  const a = hospital({ id: '990040', cbsa: null, cbsaName: null });
  const b = hospital({ id: '990041', cbsa: null, cbsaName: null, red: 0, paf: 1 });
  const c = hospital({ id: '990042', cbsa: null, cbsaName: null, st: 'ZY' });
  const groups = areaGroups([a, b, c], META);
  assert.deepEqual([...groups.keys()], ['state-zz']);
  assert.match(figureOf(pageOf(a, ctxFor([a, b, c])), 4), /in the part of Zedland outside metro areas/);
  assert.equal(areaKeyOf(c), 'state-zy');
});

test('neighbors: the map marks this hospital and draws the others as dots, and is left out without outlines or placed hospitals', () => {
  const rows = OTHERS.map((h, i) => ({ ...h, lat: 40 + i * 0.05, lon: -100 + i * 0.05 }));
  const shapes = new Map();
  const withShapes = ctxFor([CUT, ...rows], { shapes });
  const text = figureOf(pageOf(CUT, withShapes), 4);
  assert.ok(text.includes('chart--area-map'));
  assert.equal((text.match(/class="chart-pin /g) ?? []).length, rows.length);
  assert.equal((text.match(/chart-this--map/g) ?? []).length, 1);
  assert.ok(!figureOf(pageOf(CUT, ctxFor([CUT, ...rows])), 4).includes('chart--area-map'), 'no outlines: no map, the table stays');
  const nowhere = [CUT, ...OTHERS.map((h) => ({ ...h, lat: null, lon: null }))];
  assert.ok(!figureOf(pageOf(CUT, ctxFor(nowhere, { shapes })), 4).includes('chart--area-map'));
});

test('neighbors: the area CSV is the table\'s hospitals in its order, in the hospital columns, one file for the area', () => withTemp('pp-hrrp-', async (dir) => {
  const { hospitals, meta } = loadHrrpOnce();
  const data = { ...loadHrrpOnce(), hospitals: hospitals.slice(0, 40) };
  const built = createContext({ outDir: dir, env: 'production', assets: ASSETS });
  generateHrrp(built, { data, released: true, log: () => {} });
  const groups = areaGroups(data.hospitals, meta);
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  for (const area of groups.values()) {
    const file = join(dir, csvPath(meta.fy, area.csvName));
    assert.ok(existsSync(file), area.key);
    assert.equal(readFileSync(file, 'utf8'), hospitalCsv(area.rows.map((r) => r.h)));
  }
  const [area] = [...groups.values()];
  const lines = readFileSync(join(dir, csvPath(meta.fy, area.csvName)), 'utf8').split('\r\n');
  assert.equal(`${lines[0]}\r\n`, hospitalCsv([]), 'the hospital columns, as the full file writes them');
  assert.equal(lines[0].split(',').length - 1, HOSPITAL_COLUMNS.length - 1 + 1, 'the 31 columns (one name holds a comma)');
  assert.equal(lines.length, area.rows.length + 2, 'header, rows, a closing line end');
  // a hospital page links its area's file
  const page = readFileSync(join(dir, `hrrp/hospital/${area.rows[0].h.id}/index.html`), 'utf8');
  assert.ok(page.includes(`href="${csvPath(meta.fy, area.csvName)}"`));
}));

test('neighbors: a name that could read as a formula is written as text in the area CSV', () => {
  const h = hospital({ id: '990050', name: '=SUM(A1)' });
  assert.match(hospitalCsv([h]), /,'=SUM\(A1\),/);
});

// ---------- on the data ----------

const DATA = loadHrrpOnce();
const SHARED = hospitalContext(DATA);

test('on the data: the what-if at the actual ratios is whatIfPaf, CMS\'s factor and the modeled dollars, for every hospital', () => {
  for (const h of DATA.hospitals) {
    const { paf, cut, dollars } = whatIfState(h, DATA.meta);
    assert.equal(paf, h.paf, h.id);
    assert.equal(cut, h.red, h.id);
    assert.ok(dollars === null ? h.pen == null || h.base == null : Math.abs(dollars - (h.pen ?? dollars)) <= 1, `${h.id}: dollars ${dollars} vs ${h.pen}`);
  }
});

test('on the data: bringing every ratio over its median down to it gives no cut, and a slider range holds every ratio', () => {
  for (const h of DATA.hospitals) {
    const all = {};
    for (const k of CONDS) if (isMeasured(h.c[k])) all[k] = Math.min(h.c[k].err, peerMedian(DATA.meta, h.peer, k));
    const state = whatIfState(h, DATA.meta, all);
    assert.equal(state.paf, 1, h.id);
    for (const s of whatIfData(h, SHARED).sliders) assert.ok(s.min <= s.err && s.err <= s.max, `${h.id} ${s.cond}`);
  }
});

test('on the data: each escape value is the peer median and what it saves is whatIfPaf at the median', () => {
  let checked = 0;
  for (const h of DATA.hospitals) {
    for (const s of whatIfData(h, SHARED).sliders) {
      assert.equal(s.over, s.err > s.med, h.id);
      if (!s.over) { assert.equal(s.escape, null); continue; }
      const paf = whatIfPaf(h, DATA.meta, { [s.cond]: s.med });
      assert.equal(s.escape.ratio, s.med);
      if (s.escape.saveCut === null) { assert.deepEqual([s.escape.saveCut, s.escape.saveDollars], [null, null]); continue; }
      assert.equal(s.escape.saveCut, Math.round((cutPct(h.paf) - cutPct(paf)) * 100) / 100, `${h.id} ${s.cond}`);
      assert.ok(s.escape.saveCut >= 0, 'bringing a ratio down never makes the cut larger');
      checked += 1;
    }
  }
  assert.ok(checked > 1000);
});

const render = (h) => pageOf(h, SHARED);

test('on the data: every page builds its what-if and area table by property, with no stray words', () => {
  const byId = (id) => DATA.hospitals.find((h) => h.id === id);
  const none = DATA.hospitals.find((h) => !CONDS.some((k) => isMeasured(h.c[k])));
  assert.ok(render(none).includes('nothing to simulate'));
  const noEst = DATA.hospitals.find((h) => h.pen == null && CONDS.some((k) => isMeasured(h.c[k])));
  assert.match(render(noEst), /<span data-wi="dollars">—<\/span>/);
  const capped = DATA.hospitals.find((h) => h.red >= 3);
  assert.match(render(capped), /still keep the cut at its maximum/);
  const alone = DATA.hospitals.find((h) => !SHARED.areas.has(areaKeyOf(h)));
  assert.ok(!render(alone).includes('data-nb'), 'a hospital alone in its area has no table');
  const biggest = [...SHARED.areas.values()].sort((a, b) => b.rows.length - a.rows.length)[0];
  assert.ok(biggest.rows.length > 25);
  const page = render(biggest.rows[40].h);
  assert.equal((page.match(/<tbody data-page="/g) ?? []).length, Math.ceil(biggest.rows.length / 25));
  assert.equal((figureOf(page, 4).match(/aria-current="true"/g) ?? []).length, 1);
  assert.ok(page.includes('chart--area-map'));
  for (const h of [none, noEst, capped, alone, byId(biggest.rows[3].h.id)]) {
    const text = render(h);
    assert.ok(!/NaN|undefined|\[object Object\]|Infinity/.test(text.replace(/<script[\s\S]*?<\/script>/g, '')), h.id);
  }
});

test('on the data: the page data for the browser rebuild the same hospital, and the page is within its budget in plain bytes', () => {
  const h = DATA.hospitals.find((x) => x.c?.HF?.flag === 1 && x.pen > 0) ?? DATA.hospitals[100];
  const text = render(h);
  const json = JSON.parse(/<script type="application\/json" id="hrrp-hospital">([\s\S]*?)<\/script>/.exec(text)[1]);
  assert.equal(json.row[0], h.id);
  assert.equal(json.base, h.base);
  assert.equal(json.meta.nm, DATA.meta.nm);
  assert.ok(text.length < 240000, `page is ${text.length} bytes`);
});

test('on the data: a condition CMS flagged with no published payment weight says it cannot be recomputed, and its table row has dashes', () => {
  const rows = DATA.hospitals.flatMap((h) => whatIfData(h, SHARED).sliders.filter((s) => s.escape?.saveCut === null).map((s) => [h, s]));
  assert.ok(rows.length >= 4, `${rows.length} rows`);
  for (const [h] of rows.slice(0, 4)) {
    const fig = figureOf(render(h), 2);
    assert.match(fig, /CMS counted this one, but its payment weight is not published/);
    assert.ok(!/it adds nothing, but the cut does not change/.test(fig.split('wi__escape').filter((p) => /not published/.test(p)).join('')), h.id);
  }
  const [h, s] = rows[0];
  const tr = new RegExp(`<tr><th[^>]*>${s.short}</th>[\\s\\S]*?</tr>`).exec(figureOf(render(h), 2))[0];
  assert.ok(!tr.includes('0.00%') && !tr.includes('$0<'), tr);
});

// The savings the rows print (escapeWords: "the cut shrinks by 0.06% of base payments, about $186K"), in hundredths of a percent and
// in dollars as printed, and the cut as the result box prints it.
const UNIT = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
const shownDollars = (s) => { const [, n, u] = /^\$([\d.]+)([KMB]?)$/.exec(s); return Math.round(Number(n) * UNIT[u]); };
const hundredths = (s) => Math.round(Number(s.replace('%', '')) * 100);
function printedSums(wi) {
  const saved = wi.sliders.map((s) => /shrinks by ([\d.]+%) of base payments(?:, about (\$[\d.]+[KMB]?))?/.exec(escapeWords(s))).filter(Boolean);
  const words = resultWords(wi.start);
  return {
    pctOver: saved.reduce((n, m) => n + hundredths(m[1]), 0) > hundredths(words.cut),
    dollarsOver: wi.start.dollars !== null && saved.reduce((n, m) => n + (m[2] ? shownDollars(m[2]) : 0), 0) > shownDollars(words.dollars),
  };
}

test('on the data: the note under the what-if is on every page whose rows, as printed, add up to more than the cut, and on no other', () => {
  const by = { steps: [], rounded: [], none: [] };
  for (const h of DATA.hospitals) {
    const wi = whatIfData(h, SHARED);
    const { pctOver, dollarsOver } = printedSums(wi);
    assert.equal(wi.over.why, pctOver ? 'steps' : dollarsOver ? 'rounded' : null, h.id);
    if (wi.sliders.filter((s) => s.escape?.saveCut > 0).length > 1) by[wi.over.why ?? 'none'].push(h);
  }
  assert.ok(by.steps.length > 100 && by.rounded.length > 10 && by.none.length > 100, `${by.steps.length} by steps, ${by.rounded.length} by rounding, ${by.none.length} with two or more savings and no note`);
  for (const h of by.steps.slice(0, 5)) {
    const fig = figureOf(render(h), 2);
    assert.match(fig, /<p class="small muted fig__note">Each saving is for that condition alone\./, h.id);
    assert.ok(fig.includes(`so the cut moves in steps of about ${fmtMoney(h.base * FACTOR_STEP)},`), `${h.id}: one step of the hospital's own base payments`);
  }
  for (const h of by.rounded.slice(0, 5)) assert.match(figureOf(render(h), 2), /fig__note">Each dollar figure is rounded/, h.id);
  for (const h of by.none.slice(0, 5)) assert.ok(!figureOf(render(h), 2).includes('fig__note'), h.id);
});

test('on the data: a ratio over its median by under half a step still comes to no cut at the median (Bring all to median)', () => {
  const close = DATA.hospitals.filter((h) => CONDS.some((k) => isMeasured(h.c[k]) && h.c[k].err > peerMedian(DATA.meta, h.peer, k) && h.c[k].err - peerMedian(DATA.meta, h.peer, k) < WI_STEP / 2));
  assert.ok(close.length > 10);
  for (const h of close.slice(0, 50)) {
    const all = {};
    for (const k of CONDS) if (isMeasured(h.c[k])) all[k] = Math.min(h.c[k].err, peerMedian(DATA.meta, h.peer, k));
    assert.equal(whatIfState(h, DATA.meta, all).paf, 1, h.id);
  }
});

test('Bring all to median acts on the current value: over the median it comes down to it, at or under it stays', () => {
  assert.equal(medianTarget(1.2, 1.0), 1.0);
  assert.equal(medianTarget(1.0004, 1.0), 1.0, 'over by under half a step still comes to it');
  assert.equal(medianTarget(1.0, 1.0), null);
  assert.equal(medianTarget(0.8, 1.0), null, 'dragged under the median: stays');
  assert.equal(medianTarget(1.2, null), null, 'no median published');
});

test('on the data: with nothing to simulate the words stand in the what-if\'s place, before the history', () => {
  const none = DATA.hospitals.find((h) => !CONDS.some((k) => isMeasured(h.c[k])));
  const text = render(none);
  const nowi = text.indexOf('hosp__nowi');
  const history = text.indexOf('class="hosphist"');
  assert.ok(nowi > 0 && nowi < history, 'the words come before the history');
  assert.ok(!text.includes('data-hosp-whatif'), 'no what-if');
});

test('on the data: the what-if\'s result sits in its own block after the sliders, and the history follows the what-if', () => {
  const some = DATA.hospitals.find((h) => CONDS.some((k) => isMeasured(h.c[k])));
  const text = render(some);
  const wi = text.indexOf('data-hosp-whatif');
  assert.ok(wi > 0 && wi < text.indexOf('data-wi="fields"') && text.indexOf('data-wi="fields"') < text.indexOf('class="wi__result"'));
  assert.ok(text.indexOf('class="wi__result"') < text.indexOf('data-wi="parts"'), 'the parts are in the result block');
  assert.ok(text.indexOf('class="wi__result"') < text.indexOf('class="hosphist"'), 'the history comes after the what-if');
  assert.ok(!text.includes('hosp__pair'));
});
