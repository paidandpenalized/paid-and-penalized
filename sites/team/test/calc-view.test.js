// Part 5's calculator (web/calc-view.js, web/calc-data.js, web/program/calc.js, client/calc-state.js): the build draws the
// default hospital exactly as the browser first draws it; typed numbers are the reader's own; a row's spending overrides
// the slider for that row alone; "What would it take?" says when an answer is not possible, and why; quality by measure
// starts collapsed and scores as the engine does; the opening hospital and "Show one at random" follow the rules; a
// hospital with no public episodes draws $0, never NaN; a junk link applies only its valid keys. Hospitals are picked by
// property; names are made up; failures print no name, CCN or dollar figure (compared in place).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, MEASURES, TRACKS } from '../../../engine/js/team/params.js';
import { compositeQuality } from '../../../engine/js/team/quality.js';
import { reconcile } from '../../../engine/js/team/reconcile.js';
import { mulberry32 } from '../../../engine/js/test/prng.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { parseMoney, parsePct } from '../../../web/client/parse-input.js';
import { DEFAULT_SKIP_STATE } from '../../../web/skip-state.js';
import { applyLink, fragmentOf, isScenario, randomPick, readLink, setSlider, setTrack, startCcn, typeInto } from '../client/calc-state.js';
import { calcAsset, calcMeta, calcRow, hospOf } from '../web/calc-data.js';
import { t } from '../web/calc-copy.js';
import { calcMarkup, calcView, initialState, inputsOf } from '../web/calc-view.js';
import { loadAtlas, loadMaster, loadTeam } from '../web/data.js';
import { programPage } from '../web/pages/program.js';

const team = loadTeam();
const meta = calcMeta(team);
const WHO = { name: 'Example Hospital', city: 'Springfield', state: 'KY' };
const searchOf = (ccns) => ({ cols: ['ccn', 'name', 'city', 'state', 'kind'], rows: ccns.map((ccn) => [ccn, WHO.name, WHO.city, WHO.state, 'acute']), states: {} });
const CALC_URL = '/assets/team-calc.test.json';
const program = programPage({ team, master: loadMaster(), atlas: loadAtlas(), robots: 'noindex', assets: testAssets(), lookupUrl: '/assets/team-lookup.test.json', calcUrl: CALC_URL, search: searchOf([team.defaultCcn]) });
const same = (a, b, words) => assert.ok(a === b, words);
const hospWhere = (pick) => hospOf(calcRow(team.participants.find(pick)), WHO);
const viewOf = (hosp, state = initialState(hosp)) => calcView({ hosp, state, team: meta });
const word = t;
const type = (state, hosp, key, text) => {
  const r = typeInto(state, hosp, key, text);
  assert.ok(r.ok, `${key} takes what was typed`);
  return r.state;
};

const deflt = hospOf(calcRow(team.participants.find((p) => p.ccn === team.defaultCcn)), WHO);

test('the default hospital\'s server render equals the client\'s first render', () => {
  const section = /<section id="calc"[\s\S]*?<\/script>\n<\/section>/.exec(program)?.[0];
  assert.ok(section, 'Part 5 holds the calculator\'s section');
  const body = /<div class="tc__body" data-calc-body>([\s\S]*)<\/div>\n<script type="application\/json" id="tc-data">/.exec(section);
  const data = /<script type="application\/json" id="tc-data">([\s\S]*?)<\/script>/.exec(section);
  assert.ok(body && data, 'the drawn calculator and its row');
  // The client: the row the page carries, through the same reader, view and markup.
  const { meta: m, row, who } = JSON.parse(data[1]);
  const hosp = hospOf(row, who);
  const client = calcMarkup(calcView({ hosp, state: initialState(hosp), team: m })).text;
  assert.ok(client === body[1], 'the same markup, byte for byte');
  assert.ok(section.includes(`data-src="${CALC_URL}"`), 'the participants\' file is named, not loaded');
  assert.doesNotMatch(section, /NaN|undefined|\[object/, 'no hole in the markup');
});

test('typing a number marks it "your number" and the tag reads "includes your numbers"', () => {
  const before = viewOf(deflt);
  assert.ok(!before.tags.mine && before.tags.text === word('tagPublic'));
  const state = type(initialState(deflt), deflt, 'n.LEJR', '$1.2K');
  const v = viewOf(deflt, state);
  same(v.rows[0].n.text, word('srcMine'), 'the box\'s tag says it is the reader\'s');
  assert.ok(v.rows[0].n.mine && !v.rows[0].p.mine && !v.rows[1].n.mine, 'only that box');
  assert.ok(v.tags.mine && v.tags.text === word('tagMine'), 'the scenario tag says so');
  const markup = calcMarkup(v, { fig: false }).text;
  assert.match(markup, /<input class="tc-in is-mine" id="tc-n-LEJR"/);
  assert.match(markup, /<span class="tc-tag tc-tag--mine" data-v="tag">includes your numbers<\/span>/);
  // Clearing the box goes back to the public number.
  const back = type(state, deflt, 'n.LEJR', '');
  assert.ok(!back.mine.size && !('LEJR' in back.ov.n), 'cleared: the public number again');
  // What a box can't take changes nothing.
  for (const junk of ['abc', '1e3', '−5', '1,2,3', '200000']) assert.ok(!typeInto(state, deflt, 'n.LEJR', junk).ok, JSON.stringify(junk));
});

test('a row\'s spending overrides the "all five" slider for that row only', () => {
  const state = type(setSlider(initialState(deflt), 5), deflt, 'sk.CABG', '−6%');
  const inputs = inputsOf(deflt, state);
  for (const c of inputs.cats) assert.equal(c.spend, c.key === 'CABG' ? -0.06 : 0.05, c.key);
  const v = viewOf(deflt, state);
  const cabg = v.rows.find((r) => r.key === 'CABG');
  assert.ok(cabg.s.mine && cabg.s.value === '−6%', 'the row\'s own, the reader\'s');
  assert.ok(v.rows.filter((r) => r.key !== 'CABG').every((r) => !r.s.mine && r.s.value === '+5%' && r.s.text === word('srcAllFive')), 'the rest follow the slider');
  const engine = reconcile({ cats: inputs.cats.map(({ key, target, spend, lowVolume }) => ({ key, target, spend, lowVolume })), cqs: inputs.cqs, track: 3 });
  same(v.ledger.result, (engine.result < 0 ? '−' : '+') + v.ledger.result.slice(1), 'line 8 is the engine\'s');
  // Moving the slider leaves the row's own alone.
  assert.equal(inputsOf(deflt, setSlider(state, -2)).cats.find((c) => c.key === 'CABG').spend, -0.06);
});

test('"What would it take?" says "Not possible" past the limit, and why on the repayment side', () => {
  const base = initialState(deflt);
  const v = viewOf(deflt, base);
  assert.doesNotMatch(v.wwit.earn.text, /Not possible/, 'the default ask is within reach');
  const far = viewOf(deflt, type(base, deflt, 'earn', '$999M'));
  assert.match(far.wwit.earn.text, /^Not possible: Track 3 stops gains at \+\$/);
  const owe = viewOf(deflt, type(base, deflt, 'owe', '$999M'));
  assert.match(owe.wwit.owe.text, /^Any spending: the Track 3 stop-loss holds a repayment to −\$/);
  // Every category low volume: no repayment at all, so the stop-loss can't be reached.
  const low = { ...base, lv: Object.fromEntries(CATEGORIES.map((c) => [c, true])) };
  const lv = viewOf(deflt, low);
  assert.match(lv.wwit.loss, /^Not possible: its low-volume episode types can[’'']t add to a repayment/);
  assert.match(lv.wwit.owe.text, /^Any spending: its low-volume episode types/);
  // Track 1 never owes.
  const t1 = viewOf(deflt, setTrack(base, 1));
  assert.match(t1.wwit.owe.text, /^Track 1 never owes a repayment$/);
  assert.match(t1.wwit.loss, /^Track 1 never owes a repayment$/);
  assert.match(t1.wwit.quality.text, /if spending lands 5% under$/, 'Track 1 prices quality under target');
  assert.match(v.wwit.quality.text, /if spending lands 5% over$/);
  // At the top of the scale, the step stops at 100; held at a limit, quality moves nothing and says so.
  let top = base;
  for (const m of Object.keys(MEASURES)) top = type(top, deflt, `q.${m}`, '95');
  assert.equal(viewOf(deflt, top).wwit.quality.label, 'Quality score to 100');
  const capped = viewOf(deflt, type(setSlider(base, -25), deflt, 'q.falls', '10'));
  assert.match(capped.wwit.quality.text, /held at the Track 3 limit|in this scenario/);
  const held = viewOf(deflt, setSlider(base, -25));
  if (held.ledger.capped) assert.match(held.wwit.quality.text, /^\$0: the result is held at the Track 3 limit$/);
});

test('quality by measure is collapsed by default, and its score is compositeQuality\'s', () => {
  const v = viewOf(deflt);
  const markup = calcMarkup(v, { fig: false }).text;
  assert.match(markup, /<details class="tc-more tc-q" id="tc-q">/, 'no open attribute');
  const pcts = Object.fromEntries(Object.keys(MEASURES).map((m) => [m, deflt.quality[m]?.pct ?? null]));
  const n = CATEGORIES.reduce((s, c) => s + deflt.cats[c].n, 0);
  const { cqs, weights } = compositeQuality(pcts, { inpatient: n, lejr: deflt.cats.LEJR.n });
  assert.equal(v.quality.cqs, cqs);
  assert.equal(v.quality.rows.length, Object.keys(MEASURES).length);
  for (const row of v.quality.rows) assert.equal(row.weight, `${Math.round(weights[row.key] * 100)}%`, row.key);
  // The two public measures carry Care Compare; the others start at CMS's missing-data score.
  for (const row of v.quality.rows) {
    if (MEASURES[row.key].public && deflt.quality[row.key]) assert.equal(row.pct.text, word('srcCare'), row.key);
    else assert.equal(row.pct.value, '50', row.key);
  }
  // A typed percentile is the reader's and moves the score.
  const typed = viewOf(deflt, type(initialState(deflt), deflt, 'q.falls', '90'));
  assert.ok(typed.quality.cqs > cqs && typed.quality.rows.find((r) => r.key === 'falls').pct.mine);
});

test('Show one at random picks a participant still in TEAM, outside the skipped state, never the one showing', () => {
  const asset = calcAsset(team);
  assert.ok(asset.rows.length > 0 && asset.rows.length < team.participants.length, 'the file leaves out participants that left');
  assert.ok(asset.rows.every((r) => team.participants.find((p) => p.ccn === r[0]).active), 'only active participants');
  const pool = asset.rows.map(([ccn], i) => ({ ccn, state: i % 3 === 0 ? DEFAULT_SKIP_STATE : 'KY' }));
  const rng = mulberry32(7);
  const active = new Set(asset.rows.map((r) => r[0]));
  for (let i = 0; i < 200; i++) {
    const ccn = randomPick(pool, rng, pool[1].ccn);
    assert.ok(active.has(ccn), 'an active participant');
    assert.ok(pool.find((r) => r.ccn === ccn).state !== DEFAULT_SKIP_STATE, 'never the skipped state');
    assert.ok(ccn !== pool[1].ccn, 'never the one showing');
  }
  assert.equal(randomPick([{ ccn: 'X', state: DEFAULT_SKIP_STATE }], rng), null);
  // The draw is the injected rng's: the same seed, the same pick.
  assert.ok(randomPick(pool, mulberry32(3)) === randomPick(pool, mulberry32(3)));
});

test('?h=<ccn> preselects; an unknown ccn is ignored; a link\'s h wins', () => {
  const ccns = calcAsset(team).rows.map((r) => r[0]);
  const known = (c) => ccns.includes(c);
  const [a, b] = ccns.filter((c) => c !== team.defaultCcn);
  const start = (search, hash = '') => startCcn({ search, hash, defaultCcn: team.defaultCcn, known });
  same(start(`?h=${a}`), a, 'a participant in the query');
  same(start(`?h=${a.toLowerCase()}`), a, 'in either case');
  same(start('?h=ZZZZZZ'), team.defaultCcn, 'unknown: the default');
  same(start('?h=<b>x</b>'), team.defaultCcn, 'not a CCN');
  same(start(''), team.defaultCcn, 'nothing: the default');
  same(start(`?h=${a}`, `#team&h=${b}&t=2`), b, 'the link\'s hospital');
  same(start(`?h=${a}`, '#team&h=ZZZZZZ'), a, 'an unknown link hospital falls back to the query');
  same(start('', '#calc'), team.defaultCcn, 'a bare anchor names none');
  const ended = team.participants.find((p) => !p.active);
  if (ended) same(start(`?h=${ended.ccn}`), team.defaultCcn, 'a participant that left is not offered');
});

test('a participant with no public episodes: $0 and no NaN, the region\'s prices, a sentence asking for its counts', () => {
  const zero = hospWhere((p) => p.active && CATEGORIES.every((c) => p.cats[c].n === 0));
  const v = viewOf(zero);
  assert.ok(v.result.none, 'says it has no public episodes');
  same(v.ledger.target, '$0', 'line 1');
  same(v.result.range, '$0 to $0', 'the band');
  for (const row of v.rows) {
    same(row.n.value, '0', `${row.key} episodes`);
    const avg = team.categoryAvg[row.key][String(zero.division)];
    same(row.p.value, `$${Math.round(avg).toLocaleString('en-US')}`, `${row.key}: the region's average`);
  }
  assert.equal(v.rows.find((r) => r.key === 'SPINAL').p.text, word('srcPriceMean'), 'spinal\'s average is this site\'s mean, said so');
  assert.equal(v.wwit.earn.text, word('wwNeed'));
  const markup = calcMarkup(v).text;
  assert.doesNotMatch(markup, /NaN|Infinity|undefined/);
  assert.match(markup, /<p class="tc-out__none" data-v="out.none">/, 'the sentence shows');
  // Typing its counts gives a result.
  const typed = viewOf(zero, type(initialState(zero), zero, 'n.CABG', '40'));
  assert.ok(!typed.result.none && typed.ledger.target !== '$0');
});

test('a junk link: bad keys ignored, valid ones applied, nothing thrown; a scenario only when something valid applied', () => {
  const junk = `#team&s=abc&sk.LEJR=1e9&n.NOPE=5&<img src=x onerror=alert(1)>=1&t=9&${'x'.repeat(200)}=1&q.falls=200&b=7`;
  const link = readLink(junk);
  const state = applyLink(initialState(deflt), link.values);
  assert.equal(state.band, 7, 'the valid band applied');
  assert.equal(state.q.falls, 100, 'a percentile held to 100');
  assert.ok(state.mine.has('q.falls'), 'a linked percentile is "your number"');
  assert.equal(state.s, 0);
  assert.ok(isScenario(state, deflt));
  assert.ok(link.rejected.includes('s') && link.rejected.includes('t') && link.rejected.every((k) => k.length <= 40));
  // A link of 2,000 characters is refused whole: nothing applies, so no banner.
  const long = `#team&b=7&${'k=v&'.repeat(500)}`.slice(0, 2000);
  const refused = readLink(long);
  assert.ok(!isScenario(applyLink(initialState(deflt), refused.values), deflt));
  // A link that names only the hospital, or carries the defaults, is not a scenario.
  assert.ok(!isScenario(applyLink(initialState(deflt), readLink(`#team&h=${deflt.ccn}&t=3&s=0&b=5`).values), deflt));
  // Linked own numbers are the reader's.
  const own = applyLink(initialState(deflt), readLink('#team&n.LEJR=7&p.CABG=50000&lv.BOWEL=1&sk.SHFFT=-3').values);
  for (const k of ['n.LEJR', 'p.CABG', 'lv.BOWEL', 'sk.SHFFT']) assert.ok(own.mine.has(k), k);
  assert.ok(own.moved, 'a linked spending counts as set');
});

test('the page\'s link: the hospital, then only what changed; own numbers only when asked', () => {
  const plain = fragmentOf(initialState(deflt));
  assert.ok(plain === `#team&h=${deflt.ccn}`, 'a plain pick names the hospital alone');
  const state = type(setTrack(setSlider(initialState(deflt), 2.5), 2), deflt, 'n.LEJR', '60');
  const off = fragmentOf(state);
  assert.ok(off.endsWith('&t=2&s=2.5') && !off.includes('n.LEJR'), 'public inputs only');
  assert.ok(fragmentOf(state, { includeMine: true }).endsWith('&n.LEJR=60'));
});

test('typed numbers are read as people write them', () => {
  assert.equal(parseMoney('$1.2M'), 1200000);
  assert.equal(parseMoney('1,200,000'), 1200000);
  assert.equal(parseMoney('−$5K'), -5000);
  assert.equal(parsePct('−5%'), -5);
  assert.equal(parsePct('-5'), -5);
  assert.equal(parsePct('+2.5 %'), 2.5);
  for (const bad of ['', 'abc', '1e3', '1,2,3', '5%%', 'NaN', '--5', '$']) {
    assert.equal(parseMoney(bad), null, JSON.stringify(bad));
    assert.equal(parsePct(bad), null, JSON.stringify(bad));
  }
  assert.ok(Object.is(parsePct('-0'), 0));
});

test('every track draws, each limit as TRACKS gives it', () => {
  for (const track of Object.keys(TRACKS).map(Number)) {
    const v = viewOf(deflt, setTrack(initialState(deflt), track));
    assert.equal(v.tracks.find((k) => k.checked).n, track);
    assert.doesNotMatch(calcMarkup(v).text, /NaN|undefined/, `Track ${track}`);
  }
});
