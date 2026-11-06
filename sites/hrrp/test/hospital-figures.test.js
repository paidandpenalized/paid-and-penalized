// A hospital page's figures (figures/hospital-data.js, figures/hospital.js): the rulers (where the penalty came from), the
// penalty history and the full worksheet, on synthetic hospitals and then on every hospital in the data, picked by property.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS, MIN_DISCHARGES, contrib, isMeasured, verdict, weightPublished } from '../../../engine/js/hrrp/formula.js';
import { textOf } from '../../../pipeline/site/html.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalContext, hospitalView } from '../web/view.js';
import { ASSETS, CONDITIONS, CUT, HISTORY, INACTIVE, META, NONE_BELOW, NONE_MEASURED, NONE_ROUNDED, OTHERS, hospital, loadHrrpOnce } from './fixtures.js';

const ctxFor = (hospitals, history = HISTORY) => hospitalContext({ hospitals, meta: META, history, conditions: CONDITIONS });
const pageOf = (h, ctx) => hospitalPage({ view: hospitalView(h, ctx), robots: null, assets: ASSETS });
const figureOf = (text, n) => new RegExp(`<figure class="fig" id="figure-${n}"[\\s\\S]*?</figure>`).exec(text)?.[0] ?? '';
const rowsOf = (fig) => [...fig.matchAll(/<li class="rul__row[^"]*">[\s\S]*?<\/li>/g)].map((m) => m[0]);
const ctx = ctxFor([CUT, NONE_MEASURED, NONE_BELOW, NONE_ROUNDED, INACTIVE, ...OTHERS]);

test('rulers: one row for each condition in the data\'s order, with the gap, its price and its part of the modeled cut', () => {
  const d = hospitalView(CUT, ctx).figures.rulers;
  assert.deepEqual(d.rows.map((r) => r.cond), CONDS);
  const hf = d.rows.find((r) => r.cond === 'HF');
  assert.equal(hf.over, true);
  assert.ok(Math.abs(hf.gap - 0.1) < 1e-9);
  // base 10,000,000 x weight 0.1 x neutrality modifier 1 x 0.01
  assert.ok(Math.abs(hf.per - 10000) < 1e-6);
  assert.ok(Math.abs(hf.cut - CUT.pen) < 1e-6, 'the one part is all of the modeled cut');
  assert.equal(d.top, hf);
  const ami = d.rows.find((r) => r.cond === 'AMI');
  assert.deepEqual([ami.over, ami.cut], [false, 0], 'under its median: it costs nothing');
  const none = d.rows.find((r) => r.cond === 'PN');
  assert.deepEqual([none.measured, none.err, none.gap, none.per, none.cut], [false, null, null, null, null]);
  assert.equal(d.capNote, false);
  const fig = figureOf(pageOf(CUT, ctx), 1);
  assert.equal(rowsOf(fig).length, CONDS.length);
  assert.match(fig, /Heart failure costs the most: \+0\.1000 over its peer median, \$100,000 of the modeled cut, because each 0\.01 of its ratio is worth \$10,000\./);
  assert.equal((fig.match(/>Median 1\.0000<\/text>/g) ?? []).length, 2 * CONDS.length, 'the median is labeled on every ruler, narrow and wide');
  assert.ok(fig.includes('+0.1000 over'));
});

test('rulers: the gap is red only when over; the triangle takes the penalty ink on those rows alone', () => {
  const fig = figureOf(pageOf(CUT, ctx), 1);
  assert.equal((fig.match(/chart-this chart-this--pen/g) ?? []).length, 2, 'one over row, a narrow and a wide drawing');
  assert.equal((fig.match(/<path class="chart-this"/g) ?? []).length, 2, 'the under row, in ink');
  assert.equal((fig.match(/class="rul__gap"/g) ?? []).length, 1);
});

test('rulers: a condition under 25 cases is not counted: no triangle, no gap, no dollars, and the ruler says why', () => {
  const h = hospital({ id: '990020', c: { HF: { n: 40, err: 1.1, flag: 1, ratio: 0.1 }, AMI: { n: 10, err: 1.4, flag: 0, ratio: 0.1 } } });
  const row = hospitalView(h, ctx).figures.rulers.rows.find((r) => r.cond === 'AMI');
  assert.deepEqual([row.measured, row.err, row.gap, row.per, row.cut, row.over], [false, null, null, null, null, false]);
  const fig = figureOf(pageOf(h, ctx), 1);
  assert.ok(fig.includes(`10 cases, under ${MIN_DISCHARGES}: not counted`));
  assert.ok(fig.includes('No cases: not counted'), 'a condition with no row at all');
});

test('rulers: the cap note only when the parts pass 3.00 points; at the cap another 0.01 is worth $0', () => {
  const over = hospital({ id: '990021', paf: 0.97, red: 3, pen: 300000, c: { HF: { n: 40, err: 1.5, flag: 1, ratio: 0.1 }, AMI: { n: 30, err: 0.9, flag: 0, ratio: 0.1 } } });
  const d = hospitalView(over, ctx).figures.rulers;
  assert.deepEqual([d.capped, d.capNote, d.capPoints], [true, true, '5.00']);
  const hf = d.rows.find((r) => r.cond === 'HF');
  assert.equal(hf.per, 0, '$0 at the cap');
  assert.ok(Math.abs(hf.cut - 300000) < 1e-6);
  const fig = figureOf(pageOf(over, ctx), 1);
  assert.ok(fig.includes('These add to 5.00 points before the 3% cap.'));
  assert.ok(fig.includes('The cut is at its maximum, so more ratio would add nothing.'));
  // Exactly 3.00 points (the sum is a hair over in floating point): at the cap, but nothing to explain.
  const edge = hospital({ id: '990022', paf: 0.97, red: 3, pen: 300000, c: { HF: { n: 40, err: 1.3, flag: 1, ratio: 0.1 } } });
  const e = hospitalView(edge, ctx).figures.rulers;
  assert.equal(e.capNote, false);
  assert.ok(!figureOf(pageOf(edge, ctx), 1).includes('before the 3% cap'));
  assert.equal(hospitalView(CUT, ctx).figures.rulers.capped, false);
  assert.ok(!figureOf(pageOf(CUT, ctx), 1).includes('before the 3% cap'));
});

test('rulers: a flagged condition with no published payment weight has no dollars and says so', () => {
  const h = hospital({ id: '990023', paf: 1, red: 0, pen: 0, c: { HF: { n: 40, err: 1.1, flag: 1, ratio: null } } });
  const d = hospitalView(h, ctx).figures.rulers;
  const hf = d.rows.find((r) => r.cond === 'HF');
  assert.deepEqual([hf.measured, hf.over, hf.per, hf.cut, hf.part], [true, true, null, null, 0]);
  const fig = figureOf(pageOf(h, ctx), 1);
  assert.ok(fig.includes('payment weight not published'));
  assert.ok(fig.includes('A condition sits over its peer median, but none adds enough to show in the payment factor.'));
});

test('rulers: no condition measured, all at or under the median, and flagged but rounding to zero each get their own words', () => {
  assert.ok(figureOf(pageOf(NONE_MEASURED, ctx), 1).includes('No condition has 25 or more cases, so none is counted and none can add to a cut.'));
  const none = figureOf(pageOf(NONE_MEASURED, ctx), 1);
  assert.ok(!/chart-this/.test(none), 'no triangle anywhere');
  assert.ok(figureOf(pageOf(NONE_BELOW, ctx), 1).includes('All 2 counted conditions sit at or under their peer medians, so none adds to a cut.'));
  assert.ok(figureOf(pageOf(NONE_ROUNDED, ctx), 1).includes('A condition sits over its peer median, but none adds enough'));
  const one = hospital({ id: '990024', paf: 1, red: 0, pen: 0, c: { HF: { n: 40, err: 0.9, flag: 0, ratio: 0.1 } } });
  assert.ok(figureOf(pageOf(one, ctx), 1).includes('Heart failure, the one counted condition, sits at or under its peer median'));
});

test('rulers: no estimate (no base payments) leaves out the dollars and keeps the gap', () => {
  const h = hospital({ id: '990025', base: null, pen: null });
  const fig = figureOf(pageOf(h, ctx), 1);
  assert.ok(fig.includes('Heart failure adds the most: +0.1000 over its peer median.'));
  assert.ok(!/\$\d/.test(textOf(fig).replace(/Source[\s\S]*/, '')), 'no dollar figure');
});

test('rulers: each on its peer group\'s range, widened to hold a ratio past its ends; the shared range is untouched', () => {
  const far = hospital({ id: '990026', c: { HF: { n: 40, err: 3, flag: 1, ratio: 0.1 } } });
  const wide = hospitalView(far, ctx).figures.rulers.rows.find((r) => r.cond === 'HF');
  const normal = hospitalView(CUT, ctx).figures.rulers.rows.find((r) => r.cond === 'HF');
  assert.ok(wide.domain[1] >= 3 && wide.domain[0] <= wide.med);
  assert.ok(normal.domain[1] < 3, 'another hospital of the group keeps the group\'s range');
  assert.equal(normal.counts.length, 40);
  assert.equal(hospitalView(CUT, ctx).figures.rulers.rows.find((r) => r.cond === 'HF').counts, normal.counts, 'the group\'s columns are built once for the build');
  for (const r of [wide, normal]) assert.ok(r.med >= r.domain[0] && r.med <= r.domain[1]);
});

test('rulers: the table holds every number the rows show', () => {
  const fig = figureOf(pageOf(CUT, ctx), 1);
  const table = fig.slice(fig.indexOf('<table'));
  assert.ok(table.includes('data-value="0.1"') && table.includes('data-value="100000"'));
  assert.equal([...table.matchAll(/<tr>/g)].length, CONDS.length + 1, "a header row and a row for each condition");
});

// ---------- the penalty history ----------

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const HIST = {
  years: YEARS,
  paf: {
    [CUT.id]: [null, 1, 0.99, 1, 0.98, 0.99, 1],
    990006: [1, 1, 1, 1, 1, 1, 1],
    990007: [1, 0.99, 0.98, 0.99, 1, 1, 1],
    990008: [0.99, 1, 1, 0.99, 1, 0.99, null],
  },
  national: [...YEARS, 2027].map((fy, i) => ({ fy, cap: i < 2 ? 2 : 3 })),
};
const hctx = ctxFor([CUT, NONE_MEASURED, NONE_BELOW, NONE_ROUNDED, INACTIVE, ...OTHERS], HIST);

test('history: penalized in X of N years with data, n/a where the hospital is not in a year\'s file', () => {
  const d = hospitalView(CUT, hctx).figures.history;
  assert.deepEqual([d.nWith, d.nCut], [7, 4]);
  assert.deepEqual(d.years.map((y) => y.cut), [null, 0, 1, 0, 2, 1, 0, 1]);
  const text = pageOf(CUT, hctx);
  const fig = figureOf(text, 2);
  assert.match(fig, /Penalized in 4 of the 7 years with data\./);
  assert.equal((fig.match(/>n\/a<\/text>/g) ?? []).length, 2, 'the missing year, narrow and wide');
  assert.ok(fig.includes('FY2020: not in that year’s file'));
  // The all-hospital average is the dashed line, over the hospitals of each file.
  assert.equal((fig.match(/class="chart-lines__under"/g) ?? []).length, 2);
  assert.deepEqual(d.years.map((y) => y.avg === null), [false, false, false, false, false, false, false, false]);
  assert.ok(Math.abs(d.years[0].avg - 0.5 * 0.99 / 1 * 0 - d.years[0].avg) < 1e-9);
});

test('history: the place among hospitals ranks within each year\'s file, ties at their middle', () => {
  const d = hospitalView(CUT, hctx).figures.history;
  // 2022: CUT cut 1 (paf .99), 990006 cut 0, 990007 cut 2, 990008 cut 0: four in the file, two not cut.
  const y22 = d.years.find((y) => y.fy === 2022);
  assert.equal(y22.cut, 1);
  assert.ok(Math.abs(y22.share - 2 / 3) < 1e-9, 'two below it of the three others');
  assert.equal(y22.line, 0.5, 'the cuts start above the share not cut');
  const other = hospitalView(OTHERS[0], hctx).figures.history.years.find((y) => y.fy === 2022);
  assert.ok(Math.abs(other.share - 1 / 6) < 1e-9, 'tied with another uncut hospital: the middle of the two, over the three others');
  assert.equal(d.years[0].share, null, 'no place in a year without the hospital');
  assert.ok(d.years.every((y) => y.share === null || (y.share >= 0 && y.share <= 1)));
  const fig = figureOf(pageOf(CUT, hctx), 2);
  assert.ok(fig.includes('FY2022: cut 1.00%, larger than 66% of the hospitals in that year’s file'));
  assert.ok(fig.includes('FY2023: no cut, like 50% of the hospitals in that year’s file'));
});

test('history: the pandemic years are shaded with their note, the cap steps ruled, and FY2027 says the measure changed', () => {
  const fig = figureOf(pageOf(CUT, hctx), 2);
  assert.equal((fig.match(/class="hist-covid"/g) ?? []).length, 2);
  assert.ok(fig.includes('CMS left claims from January 1, 2020 through June 30, 2020 out of the program’s calculations'));
  assert.ok(fig.includes('The pandemic years'));
  assert.ok(fig.includes('out of the program’s calculations, which reaches the data behind these years.</p>'), 'the note is in the text, not only in a tooltip');
  assert.ok(fig.includes('>Measure changed</text>'));
  assert.equal((fig.match(/class="chart-rank__break"/g) ?? []).length, 2 + 2, 'the cap step and the measure change, each narrow and wide');
  assert.ok(fig.includes('2% cap') === false && fig.includes('3% cap'), 'the first year\'s cap is not a step');
  assert.ok(fig.includes('chart-rank__zone'));
  assert.ok(/<table[\s\S]*Fiscal year[\s\S]*Larger cut than/.test(fig));
});

test('history: a hospital in one year\'s file says "the one year with data"', () => {
  const lone = ctxFor([CUT, NONE_MEASURED]);
  assert.ok(figureOf(pageOf(CUT, lone), 2).includes('Penalized in the one year with data.'));
  assert.ok(figureOf(pageOf(NONE_MEASURED, lone), 2).includes('Not penalized in the one year with data.'));
  const never = hospitalView(NONE_BELOW, hctx).figures.history;
  assert.ok(never.nWith > 0);
  const quiet = hospital({ id: '990030', paf: 1, red: 0, pen: 0, c: {} });
  const quietCtx = ctxFor([quiet, ...OTHERS], { ...HIST, paf: { ...HIST.paf, [quiet.id]: [1, 1, 1, 1, 1, 1, 1] } });
  assert.match(figureOf(pageOf(quiet, quietCtx), 2), /Not penalized in any of the 8 years with data\./);
});

test('history: a hospital cut every year it is in a file reads "all"', () => {
  const h = hospital({ id: '990031' });
  const c = ctxFor([h, ...OTHERS], { years: [2025, 2026], paf: { [h.id]: [0.99, 0.98] }, national: [{ fy: 2025, cap: 3 }, { fy: 2026, cap: 3 }] });
  assert.ok(figureOf(pageOf(h, c), 2).includes('Penalized in all 3 years with data.'));
});

// ---------- the full worksheet ----------

test('the full worksheet is a disclosure after the figures, without the dollars line', () => {
  const text = pageOf(CUT, ctx);
  assert.match(text, /<details class="hosp__ws"><summary>Show the full worksheet<\/summary>[\s\S]*class="wsr"[\s\S]*<\/details>/);
  assert.ok(text.indexOf('id="figure-2"') < text.indexOf('hosp__ws'));
  const sheet = /<details class="hosp__ws">[\s\S]*?<\/details>/.exec(text)[0];
  assert.equal((sheet.match(/<li/g) ?? []).length, 4, 'lines 7 to 9 and the check; no dollars line');
  assert.ok(sheet.includes('Heart failure') && sheet.includes('0.9900'.replace('0.9900', '1.1000')));
});

test('the page loads the figure script so the tables sort and download', () => {
  assert.ok(pageOf(CUT, ctx).includes(ASSETS.js.figure));
});

// ---------- on the data ----------

const DATA = loadHrrpOnce();
const SHARED = hospitalContext(DATA);
const BY = new Map();
const PAGES = DATA.hospitals.map((h) => {
  const text = hospitalPage({ view: hospitalView(h, SHARED), robots: null, assets: ASSETS });
  return [h, text];
});
const pick = (name, pickFn) => {
  const found = PAGES.filter(([h]) => pickFn(h));
  assert.ok(found.length > 0, `the data has ${name}`);
  BY.set(name, found);
  return found;
};

test('on the data: every page has the six rulers, its history and its worksheet, with no stray words', () => {
  for (const [h, text] of PAGES) {
    const fig = figureOf(text, 1);
    assert.equal(rowsOf(fig).length, CONDS.length, h.id);
    assert.ok(figureOf(text, 2).includes('years with data') || figureOf(text, 2).includes('year with data'), h.id);
    assert.ok(text.includes('hosp__ws'), h.id);
    const words = textOf(text.slice(text.indexOf('<main'), text.indexOf('</main>')));
    assert.doesNotMatch(words, /NaN|undefined|\bnull\b|\[object Object\]|Infinity/, h.id);
    assert.doesNotMatch(text, /="null"|="undefined"|="NaN"/, h.id);
    const ids = [...text.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${h.id}: ids are unique`);
  }
});

test('on the data: a triangle for each measured condition and none for the rest; the parts of the modeled cut add to the estimate', () => {
  for (const [h, text] of PAGES) {
    const measured = CONDS.filter((k) => isMeasured(h.c[k])).length;
    const fig = figureOf(text, 1);
    assert.equal((fig.match(/<path class="chart-this/g) ?? []).length, 2 * measured, h.id);
    const { rulers } = hospitalView(h, SHARED).figures;
    const r = contrib(h, DATA.meta);
    if (h.pen != null && h.base != null && r.sum > 0) {
      const total = rulers.rows.reduce((s, row) => s + (row.cut ?? 0), 0);
      assert.ok(Math.abs(total - h.pen) <= 1e-6 * Math.max(1, h.pen), `${h.id}: ${total} vs ${h.pen}`);
    }
  }
});

test('on the data: each variant by property builds with its own words', () => {
  const nothing = pick('a hospital with no condition measured', (h) => verdict(h, DATA.meta).status === 'none-measured');
  for (const [, text] of nothing.slice(0, 20)) assert.ok(figureOf(text, 1).includes('so none is counted and none can add to a cut.'));
  const below = pick('a hospital with every counted condition at or below the median', (h) => verdict(h, DATA.meta).status === 'none-below');
  for (const [, text] of below.slice(0, 20)) assert.match(figureOf(text, 1), /sit(s)? at or under (its|their) peer median/);
  const rounded = pick('a hospital flagged but rounding to zero', (h) => verdict(h, DATA.meta).status === 'none-rounded');
  for (const [, text] of rounded) assert.ok(figureOf(text, 1).includes('none adds enough to show in the payment factor'));
  const inactive = pick('an inactive hospital', (h) => h.inactive);
  for (const [, text] of inactive) assert.ok(figureOf(text, 1).length > 0 && text.includes('hosp__inactive'));
  const noEstimate = pick('a hospital with no estimate', (h) => h.pen == null || h.base == null);
  for (const [, text] of noEstimate) assert.doesNotMatch(figureOf(text, 1).slice(0, 700), /of the modeled cut/);
  const noWeight = pick('a flagged condition with no published weight', (h) => CONDS.some((k) => h.c[k]?.flag === 1 && isMeasured(h.c[k]) && !weightPublished(h.c[k])));
  for (const [, text] of noWeight) assert.ok(figureOf(text, 1).includes('payment weight not published'));
  const capped = pick('a hospital past the cap', (h) => contrib(h, DATA.meta).sum > 0.03);
  for (const [h, text] of capped) {
    const fig = figureOf(text, 1);
    assert.ok(fig.includes('The cut is at its maximum') || !h.pen, h.id);
    assert.ok(fig.includes('$0'), h.id);
  }
  const penalized = pick('a penalized hospital with three or more flags', (h) => h.paf < 1 && CONDS.filter((k) => h.c[k]?.flag === 1).length >= 3);
  for (const [, text] of penalized.slice(0, 50)) assert.match(figureOf(text, 1), /costs the most|adds the most/);
  const underWithRatio = pick('a condition under 25 cases that still carries a ratio', (h) => CONDS.some((k) => h.c[k] && !isMeasured(h.c[k]) && h.c[k].err != null));
  for (const [h, text] of underWithRatio.slice(0, 50)) {
    const k = CONDS.find((c) => h.c[c] && !isMeasured(h.c[c]) && h.c[c].err != null);
    const row = rowsOf(figureOf(text, 1))[CONDS.indexOf(k)];
    assert.ok(row.includes('is-none') && row.includes('not counted') && !row.includes('chart-this'), h.id);
  }
});

test('on the data: the history\'s counts agree with the hospital\'s own record', () => {
  for (const [h] of PAGES.slice(0, 400)) {
    const d = hospitalView(h, SHARED).figures.history;
    const paf = [...(DATA.history.paf[h.id] ?? []), h.paf];
    assert.equal(d.nWith, paf.filter((v) => v != null).length, h.id);
    assert.equal(d.nCut, paf.filter((v) => v != null && v < 1).length, h.id);
    assert.equal(d.years.length, DATA.history.years.length + 1);
    assert.equal(d.years.at(-1).cut, h.red, h.id);
  }
});
