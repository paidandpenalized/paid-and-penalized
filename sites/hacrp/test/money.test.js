// The hospital page's dollars (money.js, money-figures.js, pages/hospital.js), on pinned rows picked by property: the
// pages read the dollar estimates for the HACRP file's year; every figure's numbers come from the hospital's row and
// add up; every estimate carries its likely range from the back-test (dollars.json bands); a hospital without an
// estimate says why; the share sentence is the page's description; and dollars without their ranges are refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, dollarsPath, newestYear, readJson } from '../../../pipeline/files.js';
import { cmsText, count, decimal, dollars, money, moneyRange, pct } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { CLIFF_NEAR, MAJOR_TEACHING_RATIO, REDUCTION_TEXT } from '../web/constants.js';
import { fill as siteFill } from '../web/copy.js';
import { checkDollarsYear, dollarsData } from '../web/data.js';
import { ALL_STRATUM, BASE_PARTS, OTHER_PARTS, cutDollars, cutText, hasMaTeaching, hospitalMoney, maKey, nationalRange, rangeOf, rangeShare, sumRanges } from '../web/money.js';
import { cliffFigure, moneyField, moneyVerdict, moneyWorksheet, shareSentence, statementLines } from '../web/money-figures.js';
import { COPY as MONEY_COPY, fill as mfill, t as mt } from '../web/money/copy.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, esc } from './fixtures.js';
import { DATA, NAT, PAGE_CTX, RANGE } from './pinned.js';

const { model, estimate } = DATA;
const rows = [...DATA.dollars.byCcn.values()];
const cms = new Map(DATA.hospitals.map((h) => [h.ccn, h]));
const pick = (pred, what) => {
  const row = rows.find((r) => pred(r, cms.get(r.ccn)));
  assert.ok(row, `no pinned row: ${what}`);
  return row;
};
const viewOf = (ccn) => hospitalView({ hospital: cms.get(ccn), model, estimate, footnotes: DATA.footnotes, master: DATA.master.get(ccn), fy: DATA.fy, periods: DATA.periods, boundaryText: DATA.boundaryText });
const BANDS = DATA.dollars.bands;
const pageOf = (row) => {
  const h = cms.get(row.ccn);
  const m = hospitalMoney(row);
  return hospitalPage({ ...PAGE_CTX, view: viewOf(row.ccn), hospital: h, master: DATA.master.get(row.ccn), source: DATA.source, robots: null, assets: ASSETS, whatif: { hospital: m.estimated ? { ...h, atStake: m.atStake, atStakeRange: m.ranges.hac } : h, model, estimate, range: RANGE }, money: m });
};
const text = (safe) => String(safe).replace(/<[^>]+>/g, ' ').replace(/\u2060/g, '').replace(/\s+/g, ' ');

// One row of each kind the pages draw.
const CUT = pick((r, h) => r.status === 'estimated' && r.cut && h.total !== null, 'estimated, scored, cut');
const NEAR = pick((r, h) => r.status === 'estimated' && !r.cut && h.total === model.boundary.highestNo, 'estimated, not cut, at the highest No');
const MARYLAND = pick((r) => r.status === 'maryland', 'Maryland');
const NO_INPUTS = pick((r) => r.status === 'no-inputs' && r.cut, 'cut, with no usable impact-file row');
const YES_NO_SCORE = pick((r, h) => r.status === 'estimated' && r.cut && h.total === null, 'cut with no score');
const TEACHING = pick((r, h) => r.status === 'estimated' && r.cut && h.total !== null && r.parts.imeMa > 0, 'estimated, scored, cut, with teaching payments on Medicare Advantage stays');
const NO_TEACHING = pick((r, h) => r.status === 'estimated' && r.cut && h.total !== null && r.parts.ime === 0, 'estimated, scored, cut, not a teaching hospital');

test('the pages read the dollars for the HACRP file\'s year, a row for every hospital, and list the dollars\' pins', () => {
  assert.equal(DATA.dollars.fy, DATA.fy);
  assert.throws(() => checkDollarsYear({ fy: DATA.fy - 1 }, DATA.fy), /dollar estimates are FY/);
  const file = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  assert.throws(() => dollarsData({ ...file, hospitals: file.hospitals.slice(1) }, DATA.hospitals), /no row in the dollar estimates/);
  const pins = new Set(DATA.pinsUsed.map((e) => e.id));
  for (const id of file.sources) assert.ok(pins.has(id), id);
  assert.equal(DATA.dollars.byCcn.size, DATA.hospitals.length);
});

test('the stratum of a hospital with no bed count is the schema\'s "all", beside its six strata (bands.py\'s ALL is checked against the same schema in the Python tests)', () => {
  const { stratumId, rowStratum } = readJson(`${REPO_ROOT}schemas/dollars.schema.json`).$defs;
  assert.deepEqual(rowStratum.enum, [...stratumId.enum, ALL_STRATUM]);
});

test('the contract: an estimated hospital has dollars at stake above $0, since the cliff and the what-if plot a drop to them; a file that breaks it stops the build, naming the row', () => {
  const file = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  const estimated = file.hospitals.filter((r) => r.status === 'estimated');
  assert.ok(estimated.length > 0);
  assert.ok(estimated.every((r) => r.atStake > 0), 'on the committed file');
  // Zero, or anything but a number above zero, for one estimated row.
  for (const atStake of [0, null]) {
    const broken = { ...file, hospitals: file.hospitals.map((r) => (r === estimated[0] ? { ...r, atStake } : r)) };
    assert.throws(() => dollarsData(broken, DATA.hospitals), new RegExp(`${estimated[0].ccn} is estimated .* above \\$0`), String(atStake));
  }
  // A row without an estimate has no dollars at stake to plot.
  const other = file.hospitals.find((r) => r.status !== 'estimated');
  assert.doesNotThrow(() => dollarsData({ ...file, hospitals: file.hospitals.map((r) => (r === other ? { ...r, atStake: 0 } : r)) }, DATA.hospitals));
});

test('a hospital the impact file gives no bed count (stratum "all") takes every hospital\'s band, and its page shows its ranges', () => {
  // Synthetic: a pinned cut row (picked by property) with its stratum set to ALL_STRATUM, as the emitter writes one.
  const file = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  const raw = file.hospitals.find((r) => r.ccn === CUT.ccn);
  const data = dollarsData({ ...file, hospitals: file.hospitals.map((r) => (r === raw ? { ...r, stratum: ALL_STRATUM } : r)) }, DATA.hospitals);
  const row = data.byCcn.get(CUT.ccn);
  const { hac, net } = file.bands.measures;
  assert.deepEqual(row.ranges.hac, [Math.round(row.atStake * hac.overall.low), Math.round(row.atStake * hac.overall.high)]);
  assert.deepEqual(row.ranges.net, [Math.round(row.net * net.overall.high), Math.round(row.net * net.overall.low)]);
  const page = text(pageOf(row));
  assert.ok(page.includes(moneyRange(...row.ranges.hac)), 'the cut\'s range on the page');
  assert.ok(page.includes(moneyRange(...row.ranges.net)), 'the net\'s range on the page');
});

test('hospitalMoney: an estimated row carries its dollars, the dollars at stake per Medicare stay and its likely ranges; any other only its status', () => {
  for (const row of rows) {
    const m = hospitalMoney(row);
    assert.equal(m.status, row.status);
    assert.equal(m.cut, row.cut);
    if (row.status !== 'estimated') {
      assert.deepEqual(m, { status: row.status, cut: row.cut, estimated: false }, row.ccn);
      continue;
    }
    assert.equal(m.perStay, row.atStake / row.bills, row.ccn);
    // The ranges: the estimate times its stratum's two multipliers, low first, in whole dollars
    const band = BANDS.measures.hac.strata.find((s) => s.stratum === row.stratum);
    assert.deepEqual(m.ranges.hac, [Math.round(row.atStake * band.low), Math.round(row.atStake * band.high)], row.ccn);
    assert.ok(m.ranges.hac[0] < m.ranges.hac[1], row.ccn);
    if (row.net === 0) assert.equal(m.ranges.net, null, `${row.ccn}: a $0 net has no range`);
    else assert.ok(m.ranges.net[0] <= m.ranges.net[1], row.ccn);
    assert.ok(!('backtest' in m), 'what a range means is the data\'s, once, not every hospital\'s');
  }
  assert.throws(() => hospitalMoney(undefined), TypeError);
});

test('the likely ranges: by stratum and measure, low first whatever the sign; none for $0; the nation\'s from the resampled ratio; a place\'s the sum of its hospitals\'', () => {
  const band = BANDS.measures.net.strata[0];
  assert.deepEqual(rangeOf(BANDS, 'net', band.stratum, -1000), [Math.round(-1000 * band.high), Math.round(-1000 * band.low)]);
  assert.deepEqual(rangeOf(BANDS, 'net', band.stratum, 1000), [Math.round(1000 * band.low), Math.round(1000 * band.high)]);
  assert.equal(rangeOf(BANDS, 'net', band.stratum, 0), null);
  assert.throws(() => rangeOf(BANDS, 'hac', 'tiny/other', 1000), /no hac band/);
  // A hospital with no bed count (stratum ALL_STRATUM) takes every hospital's band, the measure's overall multipliers.
  for (const measure of ['hac', 'net']) {
    const { low, high } = BANDS.measures[measure].overall;
    assert.ok(low < 1 && high > 1, measure);
    assert.deepEqual(rangeOf(BANDS, measure, ALL_STRATUM, 1000), [Math.round(1000 * low), Math.round(1000 * high)], measure);
  }
  assert.throws(() => rangeOf(null, 'hac', band.stratum, 1000), /no hac band/);
  assert.throws(() => rangeOf(BANDS, 'hac', band.stratum, NaN), RangeError);
  assert.deepEqual(nationalRange(BANDS, 1_000_000), [Math.round(1_000_000 * BANDS.national.p10), Math.round(1_000_000 * BANDS.national.p90)]);
  assert.deepEqual(sumRanges([[1, 3], null, [10, 30]]), [11, 33]);
  assert.equal(sumRanges([null]), null);
  // Each stratum's multipliers bracket a range that sits around the estimate: below it at the low end, above at the high.
  for (const s of BANDS.measures.hac.strata) assert.ok(s.low < 1 && s.high > 1, s.stratum);
});

test('the statement adds up, in the payment\'s order: the parts make the total, the two programs adjust the base, the HAC cut takes 1% of everything after them', () => {
  for (const row of rows.filter((r) => r.status === 'estimated')) {
    const m = hospitalMoney(row);
    const { lines, none } = statementLines(m);
    const at = Object.fromEntries(lines.map((l) => [l.key, l]));
    const parts = lines.filter((l) => l.kind === 'part');
    assert.equal(parts.reduce((s, l) => s + l.amount, 0), row.total, `${row.ccn}: parts add to the total`);
    assert.ok(parts.every((l) => l.amount !== 0), 'zero parts are left out');
    // Every part is a line or named as not paid, but for teaching on Medicare Advantage stays where there is no teaching at all.
    assert.deepEqual(none.length + parts.length + (row.parts.ime === 0 ? 1 : 0), BASE_PARTS.length + OTHER_PARTS.length);
    assert.equal(at.total.amount + at.hrrp.amount + at.hvbp.amount, at.after.amount, `${row.ccn}: total and the two adjustments make after`);
    assert.equal(at.hac.amount, row.hac);
    assert.equal(at.net.amount, row.hrrp + row.hvbp + row.hac, `${row.ccn}: net`);
    // The HAC line of a cut and the net carry their likely ranges; a $0 net has none.
    if (row.cut) assert.ok(text(at.hac.sub).includes(moneyRange(...m.ranges.hac)), `${row.ccn}: the cut's range`);
    assert.equal(at.net.sub === null, row.net === 0, `${row.ccn}: a range on the net unless it is $0`);
    if (row.net !== 0) assert.ok(text(at.net.sub).includes(moneyRange(...m.ranges.net)), `${row.ccn}: the net's range`);
    assert.deepEqual(lines.slice(-6).map((l) => l.key), ['total', 'hrrp', 'hvbp', 'after', 'hac', 'net']);
    // What each program applies to: the base for the two, everything after them for the HAC cut.
    const scale = Math.max(row.total, row.after);
    assert.deepEqual(at.hrrp.bar.scope, [0, row.base / scale]);
    assert.deepEqual(at.hvbp.bar.scope, [0, row.base / scale]);
    assert.deepEqual(at.hac.bar.scope, [0, row.after / scale]);
    assert.equal(Boolean(at.hac.bar.cut), row.cut);
    if (row.parts.mdhAddon) assert.equal(at.base.amount, row.base);
  }
});

test('the verdict: a cut, big beside the stamp with what it is; no cut, $0 and what one would have taken; Maryland exempt; no estimate says why', () => {
  const cut = hospitalMoney(CUT);
  const v = moneyVerdict(viewOf(CUT.ccn), cut);
  assert.match(String(v.beside), /class="money money--cut"/);
  assert.ok(text(v.beside).includes(money(CUT.atStake)));
  assert.match(String(v.beside), /class="est-tag"/);
  for (const part of [REDUCTION_TEXT, money(CUT.after), money(cut.perStay), mt('rangeLikely'), moneyRange(...cut.ranges.hac)]) assert.ok(text(v.below).includes(part), part);
  assert.match(String(v.below), /class="money__range-bar" style="--lo: 0\.000; --hi: 1\.000; --at: 0\.\d{3}"/, 'the bar marks the estimate inside its range');
  assert.doesNotMatch(String(v.below), /\bpending\b/i);

  const near = hospitalMoney(NEAR);
  const nv = moneyVerdict(viewOf(NEAR.ccn), near);
  assert.ok(text(nv.beside).includes(money(0)));
  assert.doesNotMatch(String(nv.beside), /est-tag/, 'a $0 CMS decided is not an estimate');
  assert.ok(text(nv.below).includes(money(NEAR.atStake)));
  assert.ok(text(nv.below).includes(moneyRange(...near.ranges.hac)), 'what a cut would have been carries its range');
  assert.ok(text(nv.below).includes(cmsText(viewOf(NEAR.ccn).distance.text)));

  const md = moneyVerdict(viewOf(MARYLAND.ccn), hospitalMoney(MARYLAND));
  assert.ok(text(md.beside).includes(money(0)));
  assert.ok(text(md.beside).includes(mt('moneyMaryland').replace(/'/g, '’')));
  assert.doesNotMatch(String(md.beside), /est-tag/);

  const none = moneyVerdict(viewOf(NO_INPUTS.ccn), hospitalMoney(NO_INPUTS));
  assert.ok(text(none.beside).includes(mt('moneyNone')));
  assert.match(text(none.below), /impact file/);
});

test('the record card\'s field: the estimate for a cut, $0 and what a cut would have been, exempt, or none', () => {
  const f = moneyField(hospitalMoney(CUT));
  assert.ok(text(f.value).includes(money(CUT.atStake)));
  assert.ok(text(f.note).includes(moneyRange(...hospitalMoney(CUT).ranges.hac)));
  assert.equal(f.fieldCls, 'f-money');
  assert.ok(text(moneyField(hospitalMoney(NEAR)).note).includes(money(NEAR.atStake)));
  assert.ok(text(moneyField(hospitalMoney(NEAR)).note).includes(moneyRange(...hospitalMoney(NEAR).ranges.hac)));
  assert.equal(moneyField(hospitalMoney(MARYLAND)).value, money(0));
  assert.ok(text(moneyField(hospitalMoney(NO_INPUTS)).value).includes(mt('moneyNone')));
});

test('the cliff: the hospital\'s cut at any score, its numbers the hospital\'s', () => {
  const view = viewOf(CUT.ccn);
  const fig = String(cliffFigure(view, hospitalMoney(CUT), NAT, { n: 1, source: 'Source.' }));
  const highest = cmsText(decimal(NAT.domain[1], 4));
  for (const part of [money(CUT.atStake), cmsText(view.distance.text), highest, view.boundaryText.highestNo, view.boundaryText.lowestYes]) assert.ok(fig.includes(part), part);
  assert.ok(fig.includes(`data-value="${-CUT.atStake}"`), 'the floor plots the cut');
  assert.ok(fig.includes(dollars(-CUT.atStake)));
  const line = (model.boundary.highestNo + model.boundary.lowestYes) / 2;
  const near = NAT.scores.filter((x) => Math.abs(x - line) <= CLIFF_NEAR).length;
  assert.ok(fig.includes(`${count(near)} of the ${count(NAT.scores.length)} scored within ${decimal(CLIFF_NEAR, 1)} of CMS`), 'the strip\'s note counts from the data');
});

test('the major-teaching cutoff the pages state is the one the hospital master applies', () => {
  const master = readFileSync(join(REPO_ROOT, 'engine/py/pp_engine/master.py'), 'utf8');
  const cutoff = /^MAJOR_TEACHING = ([\d.]+)\b/m.exec(master);
  assert.ok(cutoff, 'master.py names the cutoff');
  assert.equal(MAJOR_TEACHING_RATIO, Number(cutoff[1]));
});

test('the share sentence names CMS\'s decision and the dollars as this site\'s estimate; the page\'s description is a neutral sentence instead', () => {
  const cases = [
    [CUT, [money(CUT.atStake), SITE.name, REDUCTION_TEXT, cmsText(viewOf(CUT.ccn).distance.text)]],
    [NEAR, [money(NEAR.atStake), SITE.name, cmsText(viewOf(NEAR.ccn).distance.text)]],
    [YES_NO_SCORE, [money(YES_NO_SCORE.atStake), SITE.name]],
    [MARYLAND, ['Maryland']],
    [NO_INPUTS, [REDUCTION_TEXT]],
  ];
  for (const [row, parts] of cases) {
    const view = viewOf(row.ccn);
    const sentence = shareSentence(view, hospitalMoney(row));
    for (const part of parts) assert.ok(sentence.includes(part), `${row.status}: ${part}`);
    if (!hospitalMoney(row).estimated) assert.ok(!sentence.includes('$'), `${row.status}: no dollars without an estimate`);
    const page = pageOf(row);
    // The description (and og:description) is the same neutral sentence whatever the verdict: no decision, no dollars.
    assert.ok(!page.includes(`<meta name="description" content="${esc(sentence)}">`), `${row.status}: the share sentence is not the description`);
    const key = hospitalMoney(row).estimated ? 'hospitalDescription' : 'hospitalDescriptionNone';
    assert.ok(page.includes(`<meta name="description" content="${esc(siteFill(key, { name: view.name, city: view.city, state: view.state, fy: String(view.fy) }))}">`), `${row.status}: description`);
    assert.ok(page.includes(esc(SITE.origin + view.path)), `${row.status}: the link to share`);
    assert.ok(page.includes(esc(sentence)), `${row.status}: the sentence to share`);
    assert.match(page, /<details class="share" data-share/);
  }
});

test('a hospital page: the cliff, then the statement, before the measures; the record\'s dollars field; the what-if\'s dollars at stake', () => {
  const page = pageOf(CUT);
  const at = (id) => page.indexOf(`id="${id}"`);
  assert.ok(at('cliff') > 0 && at('cliff') < at('money') && at('money') < at('measures'), 'order');
  assert.match(page, /<div class="field f-money">/);
  const data = JSON.parse(/<script type="application\/json" id="hacrp-hospital">(.*?)<\/script>/s.exec(page)[1]);
  assert.equal(data.hospital.atStake, CUT.atStake);
  assert.equal(data.hospital.atStakeRange.join(), hospitalMoney(CUT).ranges.hac.join(), 'the what-if gets the range of the dollars at stake');
  assert.ok(page.includes(mt('rangeLikely')), 'the ranges show');
  assert.doesNotMatch(page, /\bpending\b/i, 'nothing is pending');
  assert.match(page, /\/assets\/share\.test\.js/);
  // No estimate: no cliff, no statement, no dollars at stake in the what-if.
  const md = pageOf(MARYLAND);
  assert.equal(md.indexOf('id="cliff"'), -1);
  assert.equal(md.indexOf('id="money"'), -1);
  const none = pageOf(NO_INPUTS);
  assert.equal(none.indexOf('id="money"'), -1);
});

test('dollars without their ranges are refused, in every build; the data carries each estimated row\'s ranges and what a range means', () => {
  assert.ok(BANDS, 'the pinned file carries the back-test\'s ranges');
  const file = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  // Missing as well as null: a file without the field has no ranges, as one that says so.
  for (const bands of [undefined, null]) assert.throws(() => dollarsData({ ...file, bands }, DATA.hospitals), /no ranges/, String(bands));
  assert.deepEqual(DATA.dollars.backtest, { share: file.bands.highPct - file.bands.lowPct, fy: file.bands.fy });
  assert.equal(rangeShare(BANDS), DATA.dollars.backtest.share);
  for (const row of rows) assert.equal('ranges' in row, row.status === 'estimated', row.ccn);
  // What the statement says a range is: the middle of the misses, from a one-year check; not a promise of coverage.
  const note = text(pageOf(CUT));
  assert.ok(note.includes(`Each likely range spans the middle ${pct(DATA.dollars.backtest.share, 0)} of the misses this site’s estimate made for similar hospitals`));
  assert.ok(note.includes('not a promise of how often a hospital’s actual figure lands inside'));
  assert.doesNotMatch(note, /8 in 10|held \d+%/);
});

test('the cut\'s worksheet in the hospital\'s own numbers: (payment − readmissions ± value-based) × 1% = the cut; ÷ stays = per stay', () => {
  for (const row of [CUT, NEAR, TEACHING]) {
    const m = hospitalMoney(row);
    const ws = text(moneyWorksheet(m));
    // The payment, split where it includes teaching payments on Medicare Advantage stays.
    const payment = row.parts.imeMa ? [dollars(row.total - row.parts.imeMa), dollars(row.parts.imeMa), 'teaching, MA stays'] : [dollars(row.total)];
    for (const part of [...payment, dollars(Math.abs(row.hrrp)), dollars(Math.abs(row.hvbp)), REDUCTION_TEXT, dollars(row.atStake), count(row.bills), dollars(Math.round(m.perStay))]) assert.ok(ws.includes(part), `${row.ccn}: ${part}`);
    // The worksheet's arithmetic holds in whole dollars.
    assert.equal(Math.round((row.total + row.hrrp + row.hvbp) / 100), row.atStake);
  }
  assert.match(String(moneyWorksheet(hospitalMoney(CUT))), /ws--cut/);
  assert.doesNotMatch(String(moneyWorksheet(hospitalMoney(NEAR))), /ws--cut/);
});

test('the tables\' estimated cut: the dollars at stake for a cut, 0 for no cut and for Maryland, null with no estimate; the nearest hospitals carry it', () => {
  // Every estimated row: the cut is the dollars at stake for a hospital CMS cut and nothing for one it didn't (hac is its negative).
  for (const row of rows.filter((r) => r.status === 'estimated')) assert.equal(cutDollars(row), row.cut ? row.atStake : 0, row.ccn);
  assert.equal(cutDollars(CUT), CUT.atStake);
  assert.equal(cutDollars(NEAR), 0);
  assert.ok(Object.is(cutDollars(NEAR), 0), 'never -0');
  assert.equal(cutDollars(MARYLAND), 0);
  assert.equal(cutDollars(NO_INPUTS), null);
  assert.throws(() => cutDollars(undefined), RangeError);
  assert.equal(cutText(CUT.atStake), money(CUT.atStake));
  assert.equal(cutText(null), 'no estimate');
  const h = cms.get(CUT.ccn);
  const page = hospitalPage({ ...PAGE_CTX, view: viewOf(CUT.ccn), hospital: h, master: DATA.master.get(CUT.ccn), source: DATA.source, robots: null, assets: ASSETS, shapes: DATA.shapes, money: hospitalMoney(CUT) });
  const near = /<table class="gb gb--near"[\s\S]*?<\/table>/.exec(page)[0];
  assert.match(near, /<th scope="col" class="num">Est\. cut \(\$, modeled\)<\/th>/);
  const rowsOf = [...near.matchAll(/<tr class="near--[^"]*"><td class="num"><span class="near__n">\d+<\/span><\/td><th scope="row"><a href="[^"]*\/([0-9a-z]{6})\/">.*?<td class="num near__cut[^"]*">([^<]*)<\/td>/g)];
  assert.equal(rowsOf.length, (near.match(/<tr class="near--/g) ?? []).length, 'a cut cell on every row');
  for (const [, ccn, cell] of rowsOf) assert.equal(cell, cutText(cutDollars(DATA.dollars.byCcn.get(ccn.toUpperCase()))), ccn);
});

test('a likely range in the statement is plain in the lines and the figure\'s table, and never breaks on the page', () => {
  const JOIN = '\u2060';
  for (const row of [CUT, TEACHING, NEAR]) { // two cut, one not (a net with a range, a HAC line without)
    const m = hospitalMoney(row);
    const lines = statementLines(m).lines;
    for (const l of lines) assert.ok(!(l.sub ?? '').includes(JOIN), `${row.ccn} ${l.key}: the table's words are plain`);
    const ranged = lines.filter((l) => l.held);
    assert.deepEqual(ranged.map((l) => l.key), ['hac', 'net'].filter((k) => (k === 'hac' ? m.cut : m.ranges.net)), row.ccn);
    const subs = [...pageOf(row).matchAll(/<span class="stmt__sub">([^<]*)<\/span>/g)].map((x) => x[1]);
    for (const l of ranged) {
      const plain = moneyRange(...m.ranges[l.key]);
      assert.ok(l.sub.includes(plain), `${row.ccn} ${l.key}: the plain range`);
      // The page's words are the table's, with the range's dash held by a word joiner on each side
      assert.equal(l.held, l.sub.replace(plain, plain.replace('–', `${JOIN}–${JOIN}`)), `${row.ccn} ${l.key}`);
      assert.ok(subs.includes(esc(l.held)), `${row.ccn} ${l.key}: the page sets the held words`);
    }
    // No en dash in the statement's words can start a new line: each has a joiner on both sides.
    for (const x of subs) assert.doesNotMatch(x, new RegExp(`[^${JOIN}]–|–[^${JOIN}]`), `${row.ccn}: ${x}`);
  }
});

test('the Medicare Advantage wordings come in pairs: each `…Ma` key has its plain twin, and each key the pages ask maKey for has both', () => {
  const twins = Object.keys(MONEY_COPY).filter((k) => /^[A-Za-z]+Ma$/.test(k)).map((k) => k.slice(0, -2)).sort();
  assert.ok(twins.length > 0);
  const asked = new Set();
  for (const file of ['money-figures.js', 'pages/hospital.js']) {
    for (const [, key] of readFileSync(join(REPO_ROOT, 'sites/hacrp/web', file), 'utf8').matchAll(/maKey\(\w+, '(\w+)'\)/g)) asked.add(key);
  }
  assert.deepEqual([...asked].sort(), twins);
  for (const key of twins) {
    assert.ok(key in MONEY_COPY && `${key}Ma` in MONEY_COPY, key);
    assert.equal(maKey(hospitalMoney(TEACHING), key), `${key}Ma`);
    assert.equal(maKey(hospitalMoney(NO_TEACHING), key), key);
  }
});

test('teaching payments on Medicare Advantage stays: in the payment the cut is taken on, a line of the statement, and said in the words wherever a hospital has them', () => {
  const t = hospitalMoney(TEACHING);
  const n = hospitalMoney(NO_TEACHING);
  assert.ok(hasMaTeaching(t) && !hasMaTeaching(n));
  // In T and so in the cut; not in the base.
  assert.equal(t.total, t.base + OTHER_PARTS.reduce((sum, k) => sum + t.parts[k], 0));
  assert.equal(t.base, t.parts.fed + t.parts.mdhAddon);
  const at = Object.fromEntries(statementLines(t).lines.map((l) => [l.key, l]));
  assert.equal(at.imeMa.amount, t.parts.imeMa);
  assert.equal(at.imeMa.label, mt('stmt_imeMa'));
  assert.ok(!('imeMa' in Object.fromEntries(statementLines(n).lines.map((l) => [l.key, l]))));
  assert.ok(!statementLines(n).none.includes(mt('stmtOff_imeMa')), 'no teaching at all: not named as missing');
  // The words: the verdict and the pages' introductions say the base in full only where it holds these payments.
  const say = (row) => text(moneyVerdict(viewOf(row.ccn), hospitalMoney(row)).below);
  assert.match(say(TEACHING), /Medicare Advantage patients/);
  assert.doesNotMatch(say(NO_TEACHING), /Medicare Advantage/);
  const page = pageOf(TEACHING);
  assert.ok(page.includes(esc(mfill('stmtIntroMa', { fy: String(DATA.fy) }))) && page.includes(esc(mt('stmtGroupPayMa'))));
  const plain = pageOf(NO_TEACHING);
  assert.ok(plain.includes(esc(mfill('stmtIntro', { fy: String(DATA.fy) }))) && !plain.includes('Medicare Advantage stays'));
});
