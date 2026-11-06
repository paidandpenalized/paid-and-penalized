// Step 2's swarm (figures/swarm.js) and Step 5's waterfall (figures/waterfall.js): the numbers and words the drawings carry, on the
// data and on synthetic hospitals, and the kit options they use (scoreSwarm's lens, waterfall's zoom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP, CONDS } from '../../../engine/js/hrrp/formula.js';
import { scoreSwarm } from '../../../web/charts/scoreSwarm.js';
import { waterfall } from '../../../web/charts/waterfall.js';
import { withDerived } from '../web/derive.js';
import { BAND, SWARM_ORDER, howData, swarmDomain } from '../web/figures/how-data.js';
import { howPart } from '../web/figures/how.js';
import { drawSwarm, swarmFigure, swarmRest, swarmTakeaway } from '../web/figures/swarm.js';
import { capShare, waterfallFigure, waterfallTakeaway } from '../web/figures/waterfall.js';
import { gapText } from '../web/numbers.js';
import { counter } from '../../../web/charts/figure.js';
import { waterfallData, worksheetRows, zoomOf } from '../web/worksheet.js';
import { CONDITIONS, META, hospital, loadHrrpOnce } from './fixtures.js';

const data = () => {
  const { hospitals, meta } = loadHrrpOnce();
  const how = howData({ hospitals, meta, edition: { conditions: CONDITIONS, payShort: 'Oct 1, 2026 to Sep 30, 2027' }, whatsNew: null, whatsNewFy: null });
  return { hospitals, meta, how };
};
const textOf = (svg) => [...String(svg).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join('\n');
const m = (n, err, flag = 0, ratio = 0.1) => ({ n, err, flag, ratio });

// ---------- Step 2 ----------

test('Step 2 on the data: the takeaway counts the hospitals, the ones over their own median and the ones within 0.01', () => {
  const { how } = data();
  const hf = how.swarm('HF');
  assert.equal(swarmTakeaway({ sw: hf, cond: 'heart failure' }), `Of 2,624 hospitals measured on heart failure, 1,300 are over their own peer group’s median; 400 sit within 0.01 of it.`);
  assert.equal(hf.over + hf.atOrUnder, hf.items.length);
  assert.equal(hf.over, hf.items.filter((i) => i.flag).length, 'the red dots are CMS\'s flagged hospitals: no ratio disagrees with the line');
  for (const k of SWARM_ORDER) {
    const sw = how.swarm(k);
    assert.equal(sw.items.filter((i) => i.flag !== i.d > 0).length, 0, `${k}: the colors split clean at zero`);
  }
});

test('Step 2: the takeaway for no hospital, one hospital, or many within 0.01 of the line', () => {
  const sw = (n) => ({ items: [1, 2, 3, 4], over: 2, band: { n } });
  assert.match(swarmTakeaway({ sw: sw(0), cond: 'COPD' }), /^Of 4 hospitals measured on COPD, 2 are over their own peer group’s median; none sits within 0\.01 of it\.$/);
  assert.match(swarmTakeaway({ sw: sw(1), cond: 'COPD' }), /; one sits within 0\.01 of it\.$/);
  assert.match(swarmTakeaway({ sw: sw(3), cond: 'COPD' }), /; 3 sit within 0\.01 of it\.$/);
});

test('Step 2: the lens holds every hospital within 0.01 of the line, counted just over and just under in words', () => {
  const { how } = data();
  for (const k of SWARM_ORDER) {
    const sw = how.swarm(k);
    const name = 'Example';
    for (const width of [300, 560]) {
      const { svg } = drawSwarm({ sw, width, name, cond: k });
      const words = textOf(svg);
      assert.ok(words.includes(`${sw.band.atOrUnder.toLocaleString('en-US')} just under`) && words.includes(`${sw.band.over.toLocaleString('en-US')} just over`), `${k} at ${width}`);
      // Each hospital is one dot in the main swarm and, within the band, one more in the lens.
      assert.equal((String(svg).match(/h0/g) ?? []).length, sw.items.length + sw.band.n, `${k} at ${width}: a dot per hospital in the lens`);
    }
  }
  assert.equal(how.swarm('HF').band.n, 400);
  assert.equal(how.swarm('HF').band.over + how.swarm('HF').band.atOrUnder, 400);
});

test('Step 2: the line is named as the peer median, not 1.0, over the swarm', () => {
  const { how } = data();
  const wide = textOf(drawSwarm({ sw: how.swarm('HF'), width: 560, name: 'Example', cond: 'heart failure' }).svg);
  assert.match(wide, /The line: each hospital’s own peer-group median \(not 1\.0\)/);
  assert.match(wide, /1,324 at or under: no part of the cut/);
  assert.match(wide, /1,300 over: counted toward the cut/);
  assert.match(textOf(drawSwarm({ sw: how.swarm('HF'), width: 300, name: 'Example', cond: 'heart failure' }).svg), /The line: own peer-group median/);
});

test('Step 2: the closest gap prints at four decimals, a sliver as "< 0.0001"', () => {
  const { how } = data();
  const hf = how.swarm('HF');
  assert.equal(hf.closestOver, 0.000041);
  assert.equal(gapText(hf.closestOver), '< 0.0001');
  assert.equal(gapText(0.0123456), '+0.0123');
  assert.equal(gapText(-0.01734), '−0.0173');
  assert.equal(gapText(0), '0.0000');
  assert.equal(gapText(-0.00004), '> −0.0001');
  assert.equal(hf.sliver, 5, '5 hospitals over the line by less than 0.0001');
  const figure = swarmFigure({ how, n: 2, edition: 'FY2027' }).text;
  assert.match(figure, /Closest over the line: &lt; 0\.0001\. CMS compares the stored values, so gaps print to four decimals\. 5 hospitals over the line by less than 0\.0001\./);
  assert.equal(how.swarm('CABG').closestOver, 0.000227);
  assert.match(figure, /Closest over the line: \+0\.0002\./, 'a condition whose closest dot is not a sliver prints the gap');
});

test('Step 2: the example hospital is marked with a ▲ where it is measured, and the note says where it is not', () => {
  const { how } = data();
  const hf = drawSwarm({ sw: how.swarm('HF'), width: 560, name: 'Example Hospital', cond: 'heart failure' });
  assert.ok(String(hf.svg).includes('class="chart-this"'));
  assert.match(textOf(hf.svg), /Example Hospital, −0\.0173: at or under, adds nothing/);
  const hip = drawSwarm({ sw: how.swarm('THA_TKA'), width: 560, name: 'Example Hospital', cond: 'hip/knee replacement' });
  assert.ok(!String(hip.svg).includes('class="chart-this"'), 'the example has 2 cases of hip/knee: not on the chart');
  const figure = swarmFigure({ how, n: 2, edition: 'FY2027' }).text;
  assert.match(figure, /The example hospital in the worksheet below is not measured on hip\/knee replacement, so it is not marked here\./);
  assert.equal((figure.match(/is not measured on/g) ?? []).length, 1, 'only the one condition');
});

test('Step 2: six panels, heart failure first and the only one showing, the switch hidden until a script unhides it', () => {
  const { how } = data();
  const figure = swarmFigure({ how, n: 2, edition: 'FY2027' }).text;
  assert.equal((figure.match(/class="swarm__m"/g) ?? []).length, 6);
  assert.equal((figure.match(/class="swarm__m" data-cond="[A-Z_]+" data-takeaway="[^"]*" hidden/g) ?? []).length, 5);
  assert.match(figure, /<div class="swarm__m" data-cond="HF"/);
  assert.ok(figure.indexOf('data-cond="HF"') < figure.indexOf('data-cond="AMI"'));
  assert.match(figure, /<div class="swarm__controls" hidden>/);
  assert.equal((figure.match(/<button type="button" class="btn" data-cond="/g) ?? []).length, 6);
  assert.match(figure, /data-cond="HF" aria-pressed="true"/);
  assert.match(figure, /<figcaption[^>]*><span class="fig__n">Figure 2\.<\/span> Of 2,624 hospitals measured on heart failure/, 'the caption holds heart failure\'s takeaway');
  assert.equal((figure.match(/data-fit="narrow"/g) ?? []).length, 6, 'each condition drawn for a phone and for a wide screen');
  assert.equal((figure.match(/data-fit="wide"/g) ?? []).length, 6);
});

test('Step 2: the phone drawing folds the far tails into end columns and says how many; the wide drawing holds the whole span', () => {
  const { how } = data();
  const sw = how.swarm('HF');
  const narrow = drawSwarm({ sw, width: 300, name: 'Example', cond: 'heart failure' });
  const wide = drawSwarm({ sw, width: 560, name: 'Example', cond: 'heart failure' });
  assert.equal(wide.below + wide.above, 0);
  assert.ok(narrow.below > 0 && narrow.above > 0);
  assert.equal(narrow.below, sw.items.filter((i) => i.d < narrow.lo).length);
  const figure = swarmFigure({ how, n: 2, edition: 'FY2027' }).text;
  assert.match(figure, /class="small muted swarm__note swarm__note--phone">On a phone the end columns also hold \d+ below −0\.\d\d and \d+ above \+0\.\d\d\./);
});

test('Step 2: the table lists each condition\'s bins 0.05 wide, over and at or under, adding to the hospitals measured', () => {
  const { how } = data();
  const figure = swarmFigure({ how, n: 2, edition: 'FY2027' }).text;
  const rows = [...figure.matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><td class="num" data-value="(\d+)">[^<]*<\/td><td class="num" data-value="(\d+)">/g)].map((r) => [r[1], r[2], Number(r[3]), Number(r[4])]);
  assert.ok(rows.length > 40 && rows.length < 150);
  for (const k of SWARM_ORDER) {
    const label = CONDITIONS.find((c) => c.key === k).short;
    const mine = rows.filter((r) => r[0] === label);
    assert.equal(mine.reduce((s, r) => s + r[2] + r[3], 0), how.swarm(k).items.length, label);
    assert.equal(mine.reduce((s, r) => s + r[2], 0), how.swarm(k).over, `${label}: the over column is the dots over the line`);
  }
  assert.ok(rows.some((r) => r[1] === '0.00 to +0.05'));
});

test('Step 2: the domain puts zero on a column edge and holds the span in the columns it is given', () => {
  const { how } = data();
  for (const k of SWARM_ORDER) {
    const items = how.swarm(k).items;
    for (const maxBins of [40, 56]) {
      const dom = swarmDomain(items, { maxBins });
      assert.ok(dom.lo < 0 && dom.hi > 0);
      assert.ok(Math.round((dom.hi - dom.lo) / dom.bin) <= maxBins, `${k}: ${dom.bin}`);
      assert.ok(Math.abs(dom.lo / dom.bin - Math.round(dom.lo / dom.bin)) < 1e-6, 'zero is an edge');
      assert.equal(dom.below + dom.above, 0, 'the whole span');
    }
    const trimmed = swarmDomain(items, { maxBins: 40, trim: 0.005 });
    assert.ok(trimmed.below + trimmed.above > 0 && trimmed.below + trimmed.above < items.length * 0.02);
  }
  assert.deepEqual(swarmDomain([{ d: -0.03 }, { d: 0.02 }], { maxBins: 40 }), { lo: -0.03, hi: 0.02, bin: 0.005, below: 0, above: 0 });
});

// ---------- the kit: scoreSwarm's lens ----------

test('scoreSwarm: a loupe of several dots across a bin, binned (a, b], holds more dots in the room than the default', () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ score: -0.004 + (i % 10) * 0.0008, yes: i % 2 === 0 }));
  const edges = [-0.01, 0, 0.01];
  const base = { items, edges, band: [-0.0001, 0.0001], labels: { loupe: 'L', highestNo: 'a', lowestYes: 'b', below: 'x', above: 'y' }, width: 560, pitch: 3, cols: 3, place: 'below' };
  const tall = String(scoreSwarm({ ...base, loupe: { from: -0.01, to: 0.01, step: 0.0005 } }));
  const packed = String(scoreSwarm({ ...base, loupe: { from: -0.01, to: 0.01, step: 0.0005, cols: 3, pitch: 4 } }));
  const height = (s) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(s)[1]);
  assert.equal(height(tall), height(packed), 'the glass is the same height unless the caller sets it');
  assert.equal(String(scoreSwarm({ ...base, loupe: { from: -0.01, to: 0.01, step: 0.0005, cols: 3, pitch: 4, height: 150 } })).match(/viewBox="0 0 \d+ (\d+)"/)[1], String(height(packed) + 38));
  assert.equal((packed.match(/h0/g) ?? []).length, 120, 'a dot per item in the main swarm and in the lens');
  // On an edge: (a, b] puts a score of exactly 0 on the lower side, [a, b) on the upper.
  const edge = (upper) => String(scoreSwarm({ ...base, items: [{ score: 0, yes: false }], upper, edges: [-0.01, 0, 0.01], cols: 1, loupe: { from: -0.01, to: 0.01, step: 0.01, cols: 1 } }));
  assert.notEqual(edge(true), edge(false));
});

test('scoreSwarm: defaults draw as before: no title, no zone, no mark, the caps beside the line', () => {
  const svg = String(scoreSwarm({ items: [{ score: 0.5, yes: true }, { score: -1, yes: false }], edges: [-2, -1, 0, 1, 2], band: [-0.1, 0.1], labels: { below: 'B', above: 'A', loupe: 'L', highestNo: 'h', lowestYes: 'l' }, width: 300, pitch: 3, cols: 3 }));
  assert.ok(!svg.includes('chart-lens-zone') && !svg.includes('chart-this'));
  assert.match(svg, /class="chart-cap" x="[\d.]+" y="20" text-anchor="end">B/);
  assert.match(svg, /chart-cap chart-cap--pen" x="[\d.]+" y="20" text-anchor="start">A/);
});

// ---------- Step 5 ----------

const rowsOf = (extra, hospitalFields = {}) => worksheetRows(withDerived(hospital({ peer: 2, ...hospitalFields, c: extra }), META), META, CONDITIONS);

test('Step 5: each zero row gives its reason: none measured, under 25 cases, at or under the median', () => {
  const rows = rowsOf({ HF: m(40, 1.1, 1), AMI: m(30, 0.9), COPD: m(10, 1.5), PN: m(40, 1.2, 1) });
  const wf = waterfallData(rows, CONDITIONS);
  const byCond = Object.fromEntries(wf.parts.map((p) => [p.cond, p]));
  assert.equal(byCond.HF.zero, null);
  assert.equal(byCond.AMI.zero, 'below');
  assert.equal(byCond.COPD.zero, 'few');
  assert.equal(byCond.THA_TKA.zero, 'none');
  const figure = waterfallFigure({ rows, conditions: CONDITIONS, n: 4, edition: 'FY2027' }).text;
  assert.match(figure, /0\.9000 at or under the median 1\.0000/);
  assert.match(figure, /10 cases, under 25: not counted/);
  assert.match(figure, /no cases: not counted/);
  assert.match(figure, /at or under its median/, 'the phone\'s short words');
  assert.match(figure, /10 cases \(under 25\)/);
  const svg = textOf(waterfallFigure({ rows, conditions: CONDITIONS, n: 4, edition: 'FY2027' }).text);
  assert.ok(svg.includes('Heart attack') && svg.includes('Against the cap'));
});

test('Step 5 on the data: the example\'s zero rows, its sum on the 0 to 3 percent scale against the cap, and the table', () => {
  const { how } = data();
  const wf = waterfallData(how.worksheet, how.conditions);
  assert.equal(wf.counted, wf.parts.filter((p) => p.part > 0).length);
  assert.equal(wf.sum, how.worksheet.totals.sum);
  assert.equal(wf.ofCap, wf.sum / CAP);
  assert.ok(wf.sum < CAP && !wf.binds);
  assert.equal(wf.biggest.part, Math.max(...wf.parts.map((p) => p.part)));
  const figure = waterfallFigure({ rows: how.worksheet, conditions: how.conditions, n: 4, edition: 'FY2027' }).text;
  assert.match(figure, new RegExp(`data-value="${wf.sum} ${CAP}"`), 'the cap strip is a mark holding the sum and the cap');
  assert.ok(figure.includes('class="chart-track"') && figure.includes('class="chart-loupe__beam"'), 'the strip and the beams');
  assert.match(figure, /Zoomed: 0\.0% to 0\.6% of base payments/);
  assert.match(figure, /Full scale: the sum is 17% of the cap; the factor is 0\.9948\./);
  // The table: every condition, the sum, the cap and the factor.
  const rows = [...figure.matchAll(/<tr><th scope="row">([^<]+)<\/th>/g)].map((r) => r[1]);
  assert.deepEqual(rows, [...how.conditions.map((c) => c.short), 'Sum (line 7)', 'The 3% cap', 'Payment adjustment factor (line 9)']);
  // Each plotted value is in the table (figure() checks); the parts add to the sum.
  assert.ok(Math.abs(wf.parts.reduce((s, p) => s + p.part, 0) - wf.sum) < 1e-12);
});

test('Step 5: the takeaway for no part, one part, several parts and a sum over the cap', () => {
  const none = waterfallData(rowsOf({ HF: m(40, 0.9), AMI: m(30, 0.8) }), CONDITIONS);
  assert.equal(none.counted, 0);
  assert.equal(waterfallTakeaway(none), 'No condition adds to the cut, so the sum is 0.000% and the payment adjustment factor stays at 1.0000.');
  const one = waterfallData(rowsOf({ HF: m(40, 1.1, 1) }), CONDITIONS);
  assert.equal(one.counted, 1);
  assert.match(waterfallTakeaway(one), /^One condition, heart failure, adds 1\.000%, about 33% of the 3% cap\.$/);
  const several = waterfallData(rowsOf({ HF: m(40, 1.1, 1, 0.01), AMI: m(30, 1.2, 1, 0.01), PN: m(30, 1.05, 1, 0.01) }), CONDITIONS);
  assert.equal(several.counted, 3);
  assert.match(waterfallTakeaway(several), /^Three conditions add [\d.]+%, about \d+% of the 3% cap; heart attack alone is \d+% of the sum\.$/);
  const big = { ...hospital({ peer: 2, c: { HF: m(40, 1.1, 1, 0.5), AMI: m(30, 1.2, 1, 0.5) } }) };
  const over = waterfallData(worksheetRows(withDerived(big, META), META, CONDITIONS), CONDITIONS);
  assert.equal(over.binds, true);
  assert.match(waterfallTakeaway(over), /^Two conditions add [\d.]+%, over the 3% cap, so the cut stops at 3%; heart attack alone is \d+% of the sum\.$/);
  const figure = waterfallFigure({ rows: worksheetRows(withDerived(big, META), META, CONDITIONS), conditions: CONDITIONS, n: 4, edition: 'FY2027' }).text;
  assert.match(figure, /the sum is over the cap, so the cut stops at 3% and the factor is 0\.9700/);
});

test('Step 5: a sum under a tenth of a percent of the cap reads "under", not "about under"', () => {
  const rows = rowsOf({ HF: m(40, 1.001, 1, 0.01) });
  const wf = waterfallData(rows, CONDITIONS);
  assert.ok(wf.ofCap > 0 && wf.ofCap < 0.001);
  assert.match(waterfallTakeaway(wf), /^One condition, heart failure, adds [\d.]+%, under 0\.1% of the 3% cap\.$/);
});

test('Step 5: the share of the cap reads in whole percents, tenths under ten percent, and never as a false zero', () => {
  assert.equal(capShare(0.174), '17%');
  assert.equal(capShare(0.0047), '0.5%');
  assert.equal(capShare(0.0004), 'under 0.1%');
  assert.equal(capShare(0), '0.0%');
});

test('Step 5: the zoomed scale fits the sum and holds at most seven ticks', () => {
  assert.deepEqual(zoomOf(0.0052), { step: 0.001, top: 0.006 });
  assert.deepEqual(zoomOf(0.0049), { step: 0.001, top: 0.005 });
  assert.deepEqual(zoomOf(0), { step: 0.001, top: 0.001 });
  assert.deepEqual(zoomOf(0.0152), { step: 0.005, top: 0.02 });
  for (const sum of [0.0001, 0.003, 0.0099, 0.012, 0.03, 0.06]) {
    const { step, top } = zoomOf(sum);
    assert.ok(top >= sum && Math.round(top / step) <= 7, String(sum));
  }
});

test('Step 5: the Part carries both figures in page order, the waterfall under the full-width sheet with its number kept for the redraw', () => {
  const { how } = data();
  const text = howPart(how, { figure: counter(), edition: 'FY2027', estimateTag: '', hospitalsUrl: '/data/hospitals.json', worksheetUrl: '/data/worksheet.json' }).text;
  assert.deepEqual([...text.matchAll(/id="figure-(\d+)"/g)].map((x) => Number(x[1])), [1, 2, 3, 4]);
  assert.ok(text.indexOf('id="figure-2"') > text.indexOf('id="step-2"') && text.indexOf('id="figure-2"') < text.indexOf('id="step-3"'), 'the swarm is Step 2\'s');
  assert.ok(text.indexOf('id="worksheet"') < text.indexOf('class="wf-holder"'), 'the waterfall is under the sheet');
  assert.match(text, /<div class="wf-holder" data-figure-n="4">/);
  assert.ok(CONDS.every((k) => text.includes(`data-cond="${k}"`)));
});

// ---------- the kit: waterfall's zoom ----------

const WF = { id: 'w', width: 560, rows: [{ label: 'A', value: 0.001, valueText: '0.1%', tip: 'A', pen: true }, { label: 'B', value: 0, valueText: '0', tip: 'B', note: 'because' }], total: { label: 'Sum', value: 0.001, valueText: '0.1%', tip: 'Sum', pen: true } };

test('waterfall: a fixed domain is the scale as given, a wide label column moves the bars right, and a part of zero shows its note, not a bar', () => {
  const zoom = String(waterfall({ ...WF, band: null, domain: [0, 0.002], ticks: [0, 0.001, 0.002], format: (v) => `${v * 100}%`, labelW: 120 }));
  assert.ok(zoom.includes('>0%<') && zoom.includes('>0.1%<') && zoom.includes('>0.2%<'));
  assert.ok(!zoom.includes('chart-zone') && !zoom.includes('chart-line'), 'no line without a band');
  assert.ok(zoom.includes('>because<'));
  assert.equal((zoom.match(/class="chart-step/g) ?? []).length, 2, 'a bar for the part and one for the sum, none for the zero');
  assert.match(zoom, /x1="120" x2="506" y1="[\d.]+" y2="[\d.]+"/, 'the rule runs from the label column to the value column');
});

test('waterfall: stacked rows put each label over its bar; a cap strip draws the sum on the cap\'s scale with beams from the zoom', () => {
  const svg = String(waterfall({
    ...WF, width: 300, band: null, domain: [0, 0.002], stacked: true, caption: 'Zoomed',
    cap: { value: 0.03, title: 'Against the cap', label: '3% cap', share: '3%', tip: 'cap tip', ticks: [0, 0.01, 0.02, 0.03], format: (v) => `${v * 100}%` },
  }));
  assert.ok(svg.includes('>Zoomed<') && svg.includes('>3% cap<') && svg.includes('>Against the cap<'));
  assert.ok(svg.includes('chart-loupe__beam') && svg.includes('data-value="0.001 0.03"'));
  assert.equal((svg.match(/class="chart-step chart-step--pen" x=/g) ?? []).length, 1, 'one part of the sum in the strip');
  const over = String(waterfall({ ...WF, width: 300, band: null, domain: [0, 0.002], cap: { value: 0.03, max: 0.05, title: 'c', label: 'cap', share: '1', tip: 't', ticks: [0, 0.05], format: String } }));
  assert.ok(over.includes('>0.05<'), 'a sum past the cap gets a strip that holds it');
});

test('the swarm and waterfall switch off nothing else: BAND is 0.01 and the six conditions are the switches', () => {
  assert.equal(BAND, 0.01);
  assert.equal(new Set(SWARM_ORDER).size, CONDS.length);
});

test('Step 2: the lens leaves off a closest gap that lies outside it (its label and the gap line), and keeps one inside', () => {
  const { how } = data();
  const hf = how.swarm('HF');
  const draw = (sw) => drawSwarm({ sw, width: 560, name: 'Example', cond: 'heart failure' }).svg.text;
  const inside = draw({ ...hf, closestUnder: -BAND / 2, closestOver: BAND / 2 });
  assert.ok(inside.includes('just under') && inside.includes('just over') && inside.includes('chart-loupe__gap'));
  for (const sw of [{ ...hf, closestUnder: -3 * BAND, closestOver: BAND / 2 }, { ...hf, closestUnder: -BAND / 2, closestOver: 3 * BAND }, { ...hf, closestUnder: null, closestOver: null }]) {
    const out = draw(sw);
    assert.ok(!out.includes('chart-loupe__gap'), 'no gap line when an end is outside the lens');
    assert.equal(out.includes('just under'), sw.closestUnder !== null && Math.abs(sw.closestUnder) <= BAND);
    assert.equal(out.includes('just over'), sw.closestOver !== null && Math.abs(sw.closestOver) <= BAND);
  }
});

test('Step 2: with an asset address the page holds heart failure only; the other five come from the asset, drawn the same', () => {
  const { how } = data();
  const whole = swarmFigure({ how, n: 2, edition: 'FY2027' }).text;
  const lean = swarmFigure({ how, n: 2, edition: 'FY2027', restUrl: '/assets/hrrp-swarm.x.json' }).text;
  const rest = swarmRest({ how });
  assert.deepEqual(Object.keys(rest), SWARM_ORDER.slice(1));
  assert.equal((whole.match(/class="swarm__m"/g) ?? []).length, 6);
  assert.equal((lean.match(/class="swarm__m"/g) ?? []).length, 1);
  assert.match(lean, /<div class="swarm" data-cond="HF" data-src="\/assets\/hrrp-swarm\.x\.json">/);
  assert.match(lean, /<div class="swarm__controls" hidden>/);
  assert.ok(!/<div class="swarm__m"[^>]*data-cond="HF"[^>]*hidden/.test(lean), 'heart failure shows without the script');
  for (const k of SWARM_ORDER.slice(1)) {
    assert.match(rest[k], new RegExp(`^<div class="swarm__m" data-cond="${k}" data-takeaway="[^"]+" hidden>`));
    assert.ok(whole.includes(rest[k]), `${k}: the asset's markup is the page's own`);
    assert.ok(!lean.includes(rest[k]));
  }
  assert.ok(lean.includes('Hip/knee replacement') && /<th scope="row">Pneumonia/.test(lean), 'the switch and the table still name every condition');
});
