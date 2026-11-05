// Worksheet R (kept as Thirty Day Readmissions had it) and the waterfall's data: the rows and totals on synthetic hospitals
// and, for every hospital in the data, the recomputed factor against CMS's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raw } from '../../../web/render/html.js';
import { CAP, CONDS, WEIGHT_MISSING, contrib } from '../../../engine/js/hrrp/formula.js';
import { exampleHospital, withDerived } from '../web/derive.js';
import { howData } from '../web/figures/how-data.js';
import { howPart } from '../web/figures/how.js';
import { WORKSHEET_NOTE, excessText, factorCheck, waterfallData, worksheetHtml, worksheetRows } from '../web/worksheet.js';
import { CONDITIONS, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';

const m = (n, err, flag = 0, ratio = 0.1) => ({ n, err, flag, ratio });
const TAG = '<a class="est-tag">estimate</a>';
const DOLLARS = { payShort: 'Oct 1, 2026 to Sep 30, 2027', tag: raw(TAG) };
const line = (rows, cond) => rows.lines.find((l) => l.cond === cond);

test('line 4 is the stored excess to four decimals, and a sliver above zero reads "< 0.0001"', () => {
  assert.equal(excessText(1.02484, 0.99276), '+0.0321');
  assert.equal(excessText(1.0899, 0.9928), '+0.0971');
  assert.equal(excessText(0.99284, 0.99281), '< 0.0001');
  assert.equal(excessText(0.9929, 0.99281), '+0.0001');
  // The source's note, with the family's curly apostrophe.
  assert.equal(WORKSHEET_NOTE, "Ratios, medians, weights, and the neutrality modifier are printed to four decimals; lines 4 and 6 use the site’s stored values, kept to six or more decimals, so the last digit can differ from a hand calculation.");
});

test('the check against CMS: matches, or differs by the gap', () => {
  assert.equal(factorCheck({ matches: true, diff: 0 }), '· matches');
  assert.equal(factorCheck({ matches: false, diff: 0.0001 }), '· differs by 0.0001');
});

test('each reason a condition does not count, and none for one that does', () => {
  const h = hospital({
    peer: 2,
    c: {
      HF: m(40, 1.1, 1), AMI: m(30, 0.9), COPD: m(10, 1.5), PN: { n: 40, err: 1.0000001, flag: 1, ratio: 0.1 }, CABG: { n: 40, err: 1.2, flag: 1, ratio: null },
    },
  });
  const rows = worksheetRows(withDerived(h, META), META, CONDITIONS);
  assert.deepEqual(rows.lines.map((l) => l.cond), CONDS);
  assert.equal(line(rows, 'HF').reason, null);
  assert.equal(line(rows, 'AMI').reason, 'at or below median');
  assert.equal(line(rows, 'COPD').reason, 'under 25 cases');
  assert.equal(line(rows, 'THA_TKA').reason, 'no cases');
  assert.equal(line(rows, 'CABG').reason, WEIGHT_MISSING);
  // 1.0000001 is 0.0000001 over the median: CMS flagged it, its part is under a ten-thousandth, and it prints as a sliver.
  assert.equal(line(rows, 'PN').reason, null);
  assert.equal(line(rows, 'PN').part > 0, true);
  assert.equal(excessText(line(rows, 'PN').err, line(rows, 'PN').med), '< 0.0001');
});

test('a flagged condition that rounds to its median is counted by CMS but adds nothing here', () => {
  const h = hospital({ c: { HF: { n: 40, err: 1, flag: 1, ratio: 0.1 } } });
  const rows = worksheetRows(withDerived(h, META), META, CONDITIONS);
  assert.equal(line(rows, 'HF').reason, 'rounds to the median; CMS counted it');
  assert.equal(line(rows, 'HF').part, 0);
});

test('lines 7 to 9: the sum, the cap at 3 percent, the rounded cut and the factor', () => {
  const small = worksheetRows(withDerived(hospital(), META), META, CONDITIONS);
  assert.ok(Math.abs(small.totals.sum - 0.01) < 1e-9, 'a ratio 0.1 over a median, at a weight of 0.1');
  assert.equal(small.totals.capped, false);
  assert.equal(small.totals.reduction, 0.01);
  assert.equal(small.totals.factor, 0.99);
  assert.deepEqual(small.cms, { factor: 0.99, matches: true, diff: 0 });
  const big = hospital({ paf: 0.97, c: { HF: m(40, 2, 1, 0.5), AMI: m(30, 1.5, 1, 0.5) } });
  const capped = worksheetRows(withDerived(big, META), META, CONDITIONS);
  assert.ok(capped.totals.sum > CAP);
  assert.equal(capped.totals.capped, true);
  assert.equal(capped.totals.reduction, CAP, 'line 8 is capped at 3 percent');
  assert.equal(capped.totals.factor, 0.97);
  const odd = worksheetRows(withDerived(hospital({ paf: 0.9, c: { HF: m(40, 1.123456, 1, 0.1) } }), META), META, CONDITIONS);
  assert.equal(odd.totals.reduction, Math.round(odd.totals.sum * 1e4) / 1e4, 'line 8 is rounded to four decimals');
  assert.equal(odd.cms.matches, false);
  assert.ok(odd.cms.diff > 0.07);
});

test('the three fields: hospital, peer group, neutrality modifier', () => {
  const rows = worksheetRows(withDerived(hospital(), META), META, CONDITIONS);
  assert.deepEqual(rows.fields.map((f) => f.no), ['A', 'B', 'C']);
  assert.equal(rows.fields[0].value, 'EXAMPLE GENERAL HOSPITAL');
  assert.equal(rows.fields[0].id, '990001');
  assert.equal(rows.fields[1].value, '2 of 5');
  assert.equal(rows.fields[1].note, '23.5% dual-eligible stays');
  assert.equal(rows.fields[2].value, '1.0000');
});

test('the form: every line, the reasons, the CMS check, and the dollars line only when not compact', () => {
  const rows = worksheetRows(withDerived(hospital(), META), META, CONDITIONS);
  const full = String(worksheetHtml(rows, { compact: false, dollars: DOLLARS }));
  assert.match(full, /Worksheet R · Readmissions payment adjustment/);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.ok(full.includes(`Line ${n}`), `Line ${n}`);
  assert.match(full, /Line 8 · Line 7, capped at 3%, rounded/);
  assert.match(full, /Line 9 · Payment adjustment factor \(1 − line 8\)/);
  assert.match(full, /Excess \(2 − 3\)/);
  assert.match(full, /3 × 4 × 5|C × 4 × 5/);
  assert.match(full, /at or below median/);
  assert.match(full, /no cases/);
  assert.match(full, /CMS published factor<\/span><b>0\.9900 · matches/);
  assert.match(full, /1\.00%/);
  assert.match(full, /Applied to every traditional Medicare base payment, Oct 1, 2026 to Sep 30, 2027/);
  assert.match(full, /≈ \$100K/);
  assert.ok(full.includes(TAG));
  const compact = String(worksheetHtml(rows, { compact: true, dollars: DOLLARS }));
  assert.doesNotMatch(compact, /Applied to every/);
  assert.doesNotMatch(String(worksheetHtml(rows, {})), /Applied to every/);
  const none = worksheetRows(withDerived(hospital({ pen: null }), META), META, CONDITIONS);
  assert.match(String(worksheetHtml(none, { dollars: DOLLARS })), /no estimate/);
});

test('a sliver of excess prints "< 0.0001" on the form, and a hospital name is escaped', () => {
  const h = hospital({ name: 'A <b>&</b> B', c: { HF: { n: 40, err: 1.00004, flag: 1, ratio: 0.1 } } });
  const out = String(worksheetHtml(worksheetRows(withDerived(h, META), META, CONDITIONS), {}));
  assert.match(out, /&lt; 0\.0001/);
  assert.match(out, /A &lt;b&gt;&amp;&lt;\/b&gt; B/);
});

test('the waterfall: parts in order summing to line 7, running totals, the cap and the rounded line 8', () => {
  const big = hospital({ paf: 0.97, c: { HF: m(40, 2, 1, 0.5), AMI: m(30, 1.5, 1, 0.5), COPD: m(10, 1.5), PN: m(40, 0.9) } });
  const rows = worksheetRows(withDerived(big, META), META, CONDITIONS);
  const wf = waterfallData(rows, CONDITIONS);
  assert.deepEqual(wf.parts.map((p) => p.cond), CONDS);
  assert.deepEqual(wf.parts.map((p) => p.label), CONDITIONS.map((c) => c.short));
  assert.ok(Math.abs(wf.parts.reduce((s, p) => s + p.part, 0) - rows.totals.sum) < 1e-12, 'the parts sum to line 7');
  assert.equal(wf.sum, rows.totals.sum);
  assert.equal(wf.parts.at(-1).running, wf.sum);
  assert.ok(wf.parts.every((p, i) => p.running >= (wf.parts[i - 1]?.running ?? 0)));
  assert.equal(wf.cap, 0.03, 'the cap sits at 3 percent');
  assert.equal(wf.binds, true);
  assert.equal(wf.line8, 0.03);
  assert.equal(line(rows, 'COPD').reason, 'under 25 cases');
  assert.equal(wf.parts.find((p) => p.cond === 'COPD').why, 'under 25 cases');
  assert.equal(wf.parts.find((p) => p.cond === 'HF').why, null);
  const small = waterfallData(worksheetRows(withDerived(hospital(), META), META, CONDITIONS), CONDITIONS);
  assert.equal(small.binds, false);
  assert.equal(small.line8, 0.01);
  // The figure's table: a row for each part, then the sum, the cap and the cut after it.
  assert.equal(small.rows.length, CONDS.length + 3);
  assert.deepEqual(small.rows.slice(-3).map((r) => r[0]), ['Sum (line 7)', 'The 3% cap', 'Cut after the cap (line 8)']);
  assert.deepEqual(small.rows.at(-1).slice(1), ['', '1.000']);
});

test('on every hospital in the data, the recomputed factor is CMS\'s (all of them)', () => {
  const { hospitals, meta } = loadHrrpOnce();
  let exact = 0;
  for (const h of hospitals) {
    const rows = worksheetRows(withDerived(h, meta), meta, []);
    assert.equal(rows.totals.factor, contrib(h, meta).paf);
    if (rows.totals.factor === h.paf) exact += 1;
    assert.equal(rows.cms.matches, rows.totals.factor === h.paf || Math.abs(rows.totals.factor - h.paf) < 1e-9);
    const wf = waterfallData(rows);
    assert.ok(Math.abs(wf.parts.reduce((s, p) => s + p.part, 0) - rows.totals.sum) < 1e-12);
    assert.equal(wf.line8, rows.totals.reduction);
    assert.equal(rows.totals.capped, rows.totals.sum > CAP);
  }
  assert.equal(exact, hospitals.length, `${exact} of ${hospitals.length}`);
  assert.ok(hospitals.length > 2000);
});

test('Step 5 on the page: Worksheet R for the example hospital, drawn on the server', () => {
  const { hospitals, meta } = loadHrrpOnce();
  const ex = exampleHospital(hospitals.map((h) => withDerived(h, meta)));
  const how = howData({ hospitals, meta, edition: { conditions: CONDITIONS, payShort: 'PAYSHORT' }, whatsNew: null, whatsNewFy: null });
  assert.equal(how.worksheet.fields[0].id, ex.id, 'the hospital Step 2 marks');
  assert.equal(how.worksheet.cms.factor, ex.paf);
  const out = String(howPart(how, { figure: (() => { let n = 0; return () => ++n; })(), edition: 'FY2027', estimateTag: raw(TAG) }));
  assert.match(out, /id="step-5"/);
  assert.match(out, /Worksheet R · Readmissions payment adjustment/);
  assert.match(out, /Applied to every traditional Medicare base payment, PAYSHORT/);
  assert.ok(out.includes(TAG));
  assert.ok(out.includes(`CCN ${ex.id}`));
  assert.doesNotMatch(out, /<script/);
});

test('the example is the same on a synthetic area', () => {
  const how = howData({ ...areaOf(), whatsNew: null });
  assert.equal(how.worksheet.fields[0].id, how.exampleId);
});

test('the sheet pins Worksheet R to the column so a nowrap table cannot widen the page', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
  assert.match(css, /^\.wsr \{[^}]*grid-template-columns: minmax\(0, 1fr\)/m, 'an implicit grid column would size to the table\'s no-wrap width');
  assert.match(css, /^\.wsr__id \{[^}]*minmax\(min\(\d+px, 100%\), 1fr\)/m, 'the fields never ask for more than the column');
});
