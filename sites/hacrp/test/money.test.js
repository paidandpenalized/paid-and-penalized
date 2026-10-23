// The hospital page's dollars (money.js, money-figures.js, pages/hospital.js), on pinned rows picked by property: the
// pages read the dollar estimates for the HACRP file's year; every figure's numbers come from the hospital's row and
// add up; a hospital without an estimate says why; the share sentence is the page's description; and a production
// build refuses the pending ranges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, dollarsPath, newestYear, readJson } from '../../../pipeline/files.js';
import { cmsText, decimal, dollars, money } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { REDUCTION_TEXT } from '../web/constants.js';
import { checkDollarsYear, dollarsData } from '../web/data.js';
import { refusePendingRanges } from '../web/generate.js';
import { BASE_PARTS, OTHER_PARTS, hospitalMoney, rangeOf } from '../web/money.js';
import { cliffFigure, moneyField, moneyVerdict, shareSentence, statementLines } from '../web/money-figures.js';
import { t as mt } from '../web/money/copy.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, esc } from './fixtures.js';
import { DATA, NAT, PAGE_CTX, RANGE } from './pinned.js';

const { model, estimate } = DATA;
const BANDS = DATA.dollars.bands;
const rows = [...DATA.dollars.byCcn.values()];
const cms = new Map(DATA.hospitals.map((h) => [h.ccn, h]));
const pick = (pred, what) => {
  const row = rows.find((r) => pred(r, cms.get(r.ccn)));
  assert.ok(row, `no pinned row: ${what}`);
  return row;
};
const viewOf = (ccn) => hospitalView({ hospital: cms.get(ccn), model, estimate, footnotes: DATA.footnotes, master: DATA.master.get(ccn), fy: DATA.fy, periods: DATA.periods, boundaryText: DATA.boundaryText });
const moneyOf = (row) => hospitalMoney(row, BANDS);
const pageOf = (row) => {
  const h = cms.get(row.ccn);
  const m = moneyOf(row);
  return hospitalPage({ ...PAGE_CTX, view: viewOf(row.ccn), hospital: h, master: DATA.master.get(row.ccn), source: DATA.source, robots: null, assets: ASSETS, whatif: { hospital: h, model, estimate, range: RANGE, money: m }, money: m });
};
const text = (safe) => String(safe).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// One row of each kind the pages draw.
const CUT = pick((r, h) => r.status === 'estimated' && r.cut && h.total !== null, 'estimated, scored, cut');
const NEAR = pick((r, h) => r.status === 'estimated' && !r.cut && h.total === model.boundary.highestNo, 'estimated, not cut, at the highest No');
const MARYLAND = pick((r) => r.status === 'maryland', 'Maryland');
const NO_INPUTS = pick((r) => r.status === 'no-inputs' && r.cut, 'cut, with no usable impact-file row');
const YES_NO_SCORE = pick((r, h) => r.status === 'estimated' && r.cut && h.total === null, 'cut with no score');

test('the pages read the dollars for the HACRP file\'s year, a row for every hospital, and list the dollars\' pins', () => {
  assert.equal(DATA.dollars.fy, DATA.fy);
  assert.throws(() => checkDollarsYear({ fy: DATA.fy - 1 }, DATA.fy), /dollar estimates are FY/);
  const file = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  assert.throws(() => dollarsData({ ...file, hospitals: file.hospitals.slice(1) }, DATA.hospitals), /no row in the dollar estimates/);
  const pins = new Set(DATA.pinsUsed.map((e) => e.id));
  for (const id of file.sources) assert.ok(pins.has(id), id);
  assert.equal(DATA.dollars.byCcn.size, DATA.hospitals.length);
});

test('hospitalMoney: an estimated row carries its dollars and the dollars at stake per Medicare stay; any other only its status', () => {
  for (const row of rows) {
    const m = moneyOf(row);
    assert.equal(m.status, row.status);
    assert.equal(m.cut, row.cut);
    if (row.status !== 'estimated') {
      assert.deepEqual(m, { status: row.status, cut: row.cut, estimated: false }, row.ccn);
      continue;
    }
    assert.equal(m.perStay, row.atStake / row.bills, row.ccn);
    assert.equal(m.hac, row.cut ? -row.atStake : 0, row.ccn);
    assert.equal(m.range, null, 'ranges pending');
  }
  assert.equal(rangeOf(null), null);
  assert.throws(() => rangeOf({}), RangeError);
  assert.throws(() => hospitalMoney(undefined, null), TypeError);
});

test('the statement adds up, in the payment\'s order: the parts make the total, the two programs adjust the base, the HAC cut takes 1% of everything after them', () => {
  for (const row of rows.filter((r) => r.status === 'estimated')) {
    const m = moneyOf(row);
    const { lines, none } = statementLines(m);
    const at = Object.fromEntries(lines.map((l) => [l.key, l]));
    const parts = lines.filter((l) => l.kind === 'part');
    assert.equal(parts.reduce((s, l) => s + l.amount, 0), row.total, `${row.ccn}: parts add to the total`);
    assert.ok(parts.every((l) => l.amount !== 0), 'zero parts are left out');
    assert.deepEqual(none.length + parts.length, BASE_PARTS.length + OTHER_PARTS.length);
    assert.equal(at.total.amount + at.hrrp.amount + at.hvbp.amount, at.after.amount, `${row.ccn}: total and the two adjustments make after`);
    assert.equal(at.hac.amount, row.hac);
    assert.equal(at.net.amount, row.hrrp + row.hvbp + row.hac, `${row.ccn}: net`);
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
  const cut = moneyOf(CUT);
  const v = moneyVerdict(viewOf(CUT.ccn), cut);
  assert.match(String(v.beside), /class="money money--cut"/);
  assert.ok(text(v.beside).includes(money(CUT.atStake)));
  assert.match(String(v.beside), /class="est-tag"/);
  for (const part of [REDUCTION_TEXT, money(CUT.after), money(cut.perStay), mt('rangePending')]) assert.ok(text(v.below).includes(part), part);

  const near = moneyOf(NEAR);
  const nv = moneyVerdict(viewOf(NEAR.ccn), near);
  assert.ok(text(nv.beside).includes(money(0)));
  assert.doesNotMatch(String(nv.beside), /est-tag/, 'a $0 CMS decided is not an estimate');
  assert.ok(text(nv.below).includes(money(NEAR.atStake)));
  assert.ok(text(nv.below).includes(cmsText(viewOf(NEAR.ccn).distance.text)));

  const md = moneyVerdict(viewOf(MARYLAND.ccn), moneyOf(MARYLAND));
  assert.ok(text(md.beside).includes(money(0)));
  assert.ok(text(md.beside).includes(mt('moneyMaryland').replace(/'/g, '’')));
  assert.doesNotMatch(String(md.beside), /est-tag/);

  const none = moneyVerdict(viewOf(NO_INPUTS.ccn), moneyOf(NO_INPUTS));
  assert.ok(text(none.beside).includes(mt('moneyNone')));
  assert.match(text(none.below), /impact file/);
});

test('the record card\'s field: the estimate for a cut, $0 and what a cut would have been, exempt, or none', () => {
  const f = moneyField(moneyOf(CUT));
  assert.ok(text(f.value).includes(money(CUT.atStake)));
  assert.equal(f.fieldCls, 'f-money');
  assert.ok(text(moneyField(moneyOf(NEAR)).note).includes(money(NEAR.atStake)));
  assert.equal(moneyField(moneyOf(MARYLAND)).value, money(0));
  assert.ok(text(moneyField(moneyOf(NO_INPUTS)).value).includes(mt('moneyNone')));
});

test('the cliff: the hospital\'s cut at any score, its numbers the hospital\'s', () => {
  const view = viewOf(CUT.ccn);
  const fig = String(cliffFigure(view, moneyOf(CUT), NAT, { n: 1, source: 'Source.' }));
  const highest = cmsText(decimal(NAT.domain[1], 4));
  for (const part of [money(CUT.atStake), cmsText(view.distance.text), highest, view.boundaryText.highestNo, view.boundaryText.lowestYes]) assert.ok(fig.includes(part), part);
  assert.ok(fig.includes(`data-value="${-CUT.atStake}"`), 'the floor plots the cut');
  assert.ok(fig.includes(dollars(-CUT.atStake)));
  const nfig = String(cliffFigure(viewOf(NEAR.ccn), moneyOf(NEAR), NAT, { n: 1, source: 'Source.' }));
  assert.match(nfig, /chart-cliff__dot"/, 'not cut: the dot on the ledge');
  assert.match(fig, /chart-cliff__dot chart-cliff__dot--over"/, 'cut: the dot on the floor');
});

test('the share sentence names CMS\'s decision and the dollars as this site\'s estimate, and is the page\'s description', () => {
  const cases = [
    [CUT, [money(CUT.atStake), SITE.name, REDUCTION_TEXT, cmsText(viewOf(CUT.ccn).distance.text)]],
    [NEAR, [money(NEAR.atStake), SITE.name, cmsText(viewOf(NEAR.ccn).distance.text)]],
    [YES_NO_SCORE, [money(YES_NO_SCORE.atStake), SITE.name]],
    [MARYLAND, ['Maryland']],
    [NO_INPUTS, [REDUCTION_TEXT]],
  ];
  for (const [row, parts] of cases) {
    const view = viewOf(row.ccn);
    const sentence = shareSentence(view, moneyOf(row));
    for (const part of parts) assert.ok(sentence.includes(part), `${row.status}: ${part}`);
    if (!moneyOf(row).estimated) assert.ok(!sentence.includes('$'), `${row.status}: no dollars without an estimate`);
    const page = pageOf(row);
    assert.ok(page.includes(`<meta name="description" content="${esc(sentence)}">`), `${row.status}: description`);
    assert.ok(page.includes(esc(SITE.origin + view.path)), `${row.status}: the link to share`);
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
  assert.ok(page.includes(mt('rangePending')), 'the range shows as pending');
  assert.match(page, /\/assets\/share\.test\.js/);
  // No estimate: no cliff, no statement, no dollars at stake in the what-if.
  const md = pageOf(MARYLAND);
  assert.equal(md.indexOf('id="cliff"'), -1);
  assert.equal(md.indexOf('id="money"'), -1);
  const none = pageOf(NO_INPUTS);
  assert.equal(none.indexOf('id="money"'), -1);
});

test('a production build refuses dollars whose ranges are still pending; any other build goes on', () => {
  assert.throws(() => refusePendingRanges('production', { bands: null }), /no ranges yet/);
  assert.doesNotThrow(() => refusePendingRanges(undefined, { bands: null }));
  assert.doesNotThrow(() => refusePendingRanges('production', { bands: {} }));
});
