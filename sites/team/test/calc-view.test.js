// Part 5's calculator (web/calc-view.js, the family's web/team/calc-data.js and opening.js, web/program/calc.js,
// client/calc-state.js): the build draws the
// default hospital exactly as the browser first draws it; typed numbers are the reader's own; a row's spending overrides
// the slider for that row alone; "What would it take?" says when an answer is not possible, and why; quality by measure
// starts collapsed and scores as the engine does; the opening hospital and "Show one at random" follow the rules; a
// hospital with no public episodes draws $0, never NaN; a junk link applies only its valid keys. Hospitals are picked by
// property; names are made up; failures print no name, CCN or dollar figure (compared in place).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND_DEFAULT, CATEGORIES, MEASURES, TRACKS } from '../../../engine/js/team/params.js';
import { compositeQuality } from '../../../engine/js/team/quality.js';
import { reconcile } from '../../../engine/js/team/reconcile.js';
import { mulberry32 } from '../../../engine/js/test/prng.js';
import { parseMoney, parsePct } from '../../../web/client/parse-input.js';
import { DEFAULT_SKIP_STATE } from '../../../web/skip-state.js';
import { addressOf, applyLink, arrival, carriesOwn, carryOver, commitBox, fragmentOf, isScenario, keepOwn, randomPick, rangeWords, readLink, setLowVolume, setSlider, setTrack, typeInto } from '../client/calc-state.js';
import { followedCcn } from '../../../web/client/follow-ccn.js';
import { bandEvidence } from '../web/band.js';
import { CALC } from '../web/constants.js';
import { isoDate, pct } from '../../../web/render/format.js';
import { activeCcns, calcAsset, calcMeta, calcRow, ccnSet, hospOf, whoByCcn, whoOf } from '../../../web/team/calc-data.js';
import { fill, t } from '../web/calc-copy.js';
import { calcMarkup, calcView } from '../web/calc-view.js';
import { flagsNote } from '../../../web/team/copy.js';
import { engineInput, initialState, inputsOf } from '../../../web/team/opening.js';
import { loadTeam } from '../web/data.js';
import { CALC_URL, programFor, searchFile } from './helpers.js';

const team = loadTeam();
const meta = calcMeta(team);
const WHO = { name: 'Example Hospital', city: 'Springfield', state: 'KY' };
const program = programFor(team, searchFile([[team.defaultCcn, WHO.name, WHO.city, WHO.state, 'acute']]));
const same = (a, b, words) => assert.ok(a === b, words);
const hospWhere = (pick) => hospOf(calcRow(team.participants.find(pick)), WHO);
const viewOf = (hosp, state = initialState(hosp)) => calcView({ hosp, state, team: meta });
const word = t;
const type = (state, hosp, key, text) => {
  const r = typeInto(state, hosp, key, text);
  assert.ok(r.ok, `${key} takes what was typed`);
  return r.state;
};

const engineInputOf = (hosp) => engineInput(inputsOf(hosp, initialState(hosp)));
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
  // The parts the same for every hospital are the build's alone (the browser keeps them): their boxes, emptied, aside.
  const statics = /<div class="tc-static" data-static="(\w+)">[\s\S]*?<\/(details|p)><\/div>/g;
  assert.equal([...body[1].matchAll(statics)].length, 3, 'the quality note, "How each line works" and the "why?"');
  assert.ok(client === body[1].replace(statics, '<div class="tc-static" data-static="$1"></div>'), 'the same markup, byte for byte');
  assert.ok(!/claim|How each line works/.test(client), 'the browser\'s markup holds none of the build-only words');
  assert.ok(section.includes(`data-src="${CALC_URL}"`), 'the participants\' file is named, not loaded');
  assert.ok(!/NaN|undefined|\[object/.test(section), 'no hole in the markup');
  assert.ok(section.includes('<a href="/team/methods/#band">Methods explains how it was counted</a>'), 'the "why?" links its method');
  assert.ok(section.includes('follows the spread of results hospitals had in Medicare’s joint-replacement bundle (CJR) and in BPCI Advanced'), 'the "why?" names CJR and BPCI Advanced');
  // CJR's figures are the file's (method.cjrSpread, through band.js), labeled as this site's approximate count.
  const e = bandEvidence(team);
  assert.ok(section.includes(`In CJR, ${pct(e.near.share, 0)} of hospitals’ yearly results in performance years ${e.years.slice(0, -1).join(', ')}, and ${e.years.at(-1)} ended within ±${pct(BAND_DEFAULT, 0)} of target and ${pct(e.far.share, 0)} within ±${pct(e.far.width, 0)}: this site’s count from CMS’s file, and approximate`), 'the "why?" gives CJR\'s shares and counted years from the file');
  assert.ok(!/full-risk|pandemic/.test(section), 'the "why?" names the years, not a label for them');
});

// A phone hides the table's head (styles.css), so each row's boxes and results carry their columns' names, from the
// same words as the head, hidden from screen readers (each box's own label names it). Five per row: three boxes, the
// low-volume box's words, and the results' line.
test('each row carries its columns\' names for a phone, from the head\'s words, hidden from screen readers', () => {
  const markup = calcMarkup(viewOf(deflt), { fig: false }).text;
  const rows = [...markup.matchAll(/<tr><th scope="row">[\s\S]*?<\/tr>/g)].map((m) => m[0]).filter((r) => r.includes('data-in="n.'));
  assert.equal(rows.length, CATEGORIES.length);
  for (const row of rows) {
    const labels = [...row.matchAll(/<span class="tc-cl[^"]*" aria-hidden="true">([^<]*)<\/span>/g)].map((m) => m[1].trim());
    assert.deepEqual(labels, [word('colYear'), word('colPrice'), word('colSpend'), labels[3], word('colTarget'), `· ${word('colResultPhone')}`]);
    assert.ok(/^Fewer than \d+ baseline episodes$/.test(labels[3]), 'the low-volume box\'s words');
  }
});

// On a wider screen the table's head names each result over its own column: the row's target and its result before
// quality each sit under a head of their own, never two figures under one.
test('the episode table heads each result\'s own column: target, then before quality', () => {
  const markup = calcMarkup(viewOf(deflt), { fig: false }).text;
  const table = /<table class="tc-ep"[\s\S]*?<\/table>/.exec(markup)[0];
  const heads = [...table.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(heads.slice(-2), [word('colTarget'), word('colResultPhone')]);
  const rows = [...table.matchAll(/<tr><th scope="row">[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  for (const row of rows) {
    const cells = [...row.matchAll(/<td class="num">([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    assert.equal(cells.length, 2, 'two result cells');
    assert.ok(cells[0].includes('data-v="target.') && cells[1].includes('data-v="result.'), 'the target, then the result before quality');
  }
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
  assert.ok(markup.includes('<input class="tc-in is-mine" id="tc-n-LEJR"'), 'the box is drawn as the reader\'s');
  assert.ok(markup.includes('<span class="tc-tag tc-tag--mine" data-v="tag">includes your numbers</span>'), 'the tag in red italic');
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
  assert.ok(cabg.s.own && cabg.s.value === '−6%' && cabg.s.text === word('srcThisRow'), 'the row\'s own spending');
  assert.ok(!cabg.s.mine && !v.tags.mine && !state.mine.size, 'a scenario input, as the slider is: never "your number"');
  assert.ok(v.rows.filter((r) => r.key !== 'CABG').every((r) => !r.s.mine && r.s.value === '+5%' && r.s.text === word('srcAllFive')), 'the rest follow the slider');
  const engine = reconcile({ cats: inputs.cats.map(({ key, target, spend, lowVolume }) => ({ key, target, spend, lowVolume })), cqs: inputs.cqs, track: 3 });
  same(v.ledger.result, (engine.result < 0 ? '−' : '+') + v.ledger.result.slice(1), 'line 8 is the engine\'s');
  // Moving the slider leaves the row's own alone.
  assert.equal(inputsOf(deflt, setSlider(state, -2)).cats.find((c) => c.key === 'CABG').spend, -0.06);
});

// Each computed answer's lead figure in bold, as the approved mockup sets them: the spending change with its direction,
// each 1%'s two amounts, the ten points' amount. An answer that is a sentence of words ("Not possible: …") has none.
test('"What would it take?" sets each answer\'s lead figure in bold', () => {
  const base = initialState(deflt);
  const cells = (state) => {
    const markup = calcMarkup(viewOf(deflt, state), { fig: false }).text;
    return Object.fromEntries([...markup.matchAll(/<td data-v="(ww\.\w+)">([\s\S]*?)<\/td>/g)].map((m) => [m[1], m[2]]));
  };
  const bold = (cell) => [...cell.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((m) => m[1].replace(/<[^>]*>/g, ''));
  const c = cells(base);
  for (const [key, re] of [['ww.earn', /^[\d.]+% under$/], ['ww.owe', /^[\d.]+% over$/], ['ww.gain', /^[\d.]+% under$/], ['ww.loss', /^[\d.]+% over$/]]) {
    const b = bold(c[key]);
    assert.ok(b.length === 1 && re.test(b[0]), `${key}: one lead figure, with its direction`);
  }
  assert.equal(bold(c['ww.pct']).length, 2, 'each 1%: both amounts');
  assert.ok(bold(c['ww.pct']).every((b) => /^[+−]\$/.test(b)), 'each 1%: the amounts');
  assert.ok(bold(c['ww.q']).length === 1 && /^[+−]?\$/.test(bold(c['ww.q'])[0]), 'ten points: the amount');
  assert.equal(bold(cells(type(base, deflt, 'earn', '$999M'))['ww.earn']).length, 0, '"Not possible" has no lead figure');
  // The cell's words are the view's, unchanged.
  same(c['ww.earn'].replace(/<\/?(?:strong|span[^>]*)>/g, ''), viewOf(deflt, base).wwit.earn.text.replace(/&/g, '&amp;'), 'the words unchanged');
  // A signed amount never breaks from its sign: each sits whole in a .nw span (the browser may break between − and $).
  for (const [key, cell] of Object.entries(c)) {
    const loose = cell.replace(/<span class="nw">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, '');
    assert.doesNotMatch(loose, /[−+]\$/, `${key}: a signed amount outside a .nw span`);
  }
});

test('"What would it take?" says "Not possible" past the limit, and why on the repayment side', () => {
  const base = initialState(deflt);
  const v = viewOf(deflt, base);
  const says = (text, re, words) => assert.ok(re.test(text), words);
  says(v.wwit.earn.text, /^Spend /, 'the default ask is within reach');
  says(viewOf(deflt, type(base, deflt, 'earn', '$999M')).wwit.earn.text, /^Not possible: Track 3 stops gains at \+\$/, 'past the stop-gain: not possible');
  says(viewOf(deflt, type(base, deflt, 'owe', '$999M')).wwit.owe.text, /^Any spending: the Track 3 stop-loss holds a repayment to −\$/, 'past the stop-loss: any spending');
  // Every category low volume: no repayment at all, so the stop-loss can't be reached.
  const lv = viewOf(deflt, { ...base, lv: Object.fromEntries(CATEGORIES.map((c) => [c, true])) });
  says(lv.wwit.loss, /^Not possible: its low-volume episode types can[’']t add to a repayment/, 'the stop-loss row names the low-volume cause');
  says(lv.wwit.owe.text, /^Any spending: its low-volume episode types/, 'the owe row too');
  // Track 1 never owes.
  const t1 = viewOf(deflt, setTrack(base, 1));
  assert.equal(t1.wwit.owe.text, 'Track 1 never owes a repayment');
  assert.equal(t1.wwit.loss, 'Track 1 never owes a repayment');
  says(t1.wwit.quality.text, /if spending lands 5% under$/, 'Track 1 prices quality under target');
  says(v.wwit.quality.text, /if spending lands 5% over$/, 'the other tracks over it');
  // At the top of the scale, the step stops at 100.
  let top = base;
  for (const m of Object.keys(MEASURES)) top = type(top, deflt, `q.${m}`, '95');
  assert.equal(viewOf(deflt, top).wwit.quality.label, 'Quality score to 100');
});

test('ten more quality points at $0 say why: held at a limit, no repayment on Track 1, low-volume types, on target', () => {
  const base = initialState(deflt);
  const says = (text, re, words) => assert.ok(re.test(text), words);
  // 25% under target on Track 3 is past the stop-gain at any score: capped by construction.
  const held = viewOf(deflt, setSlider(base, -CALC.slider));
  assert.ok(held.ledger.capped, 'at the stop-gain');
  says(held.wwit.quality.text, /^\$0: the result is held at the Track 3 limit$/, 'held at the limit');
  // Track 1 over target: nothing to repay, so nothing for quality to shrink.
  const t1 = viewOf(deflt, setSlider(setTrack(base, 1), 5));
  says(t1.wwit.quality.text, /^\$0: Track 1 has no repayment for quality to shrink$/, 'Track 1 over target');
  // Every type low volume, at the engine's reference 5% over target: the low-volume types hold the repayment at zero.
  const lowAll = { ...base, lv: Object.fromEntries(CATEGORIES.map((c) => [c, true])) };
  for (const track of [2, 3]) says(viewOf(deflt, setTrack(lowAll, track)).wwit.quality.text, /^\$0: its low-volume episode types can[’']t add to a repayment/, `Track ${track}, all low volume`);
  // The same case among the participants, as the page opens them.
  const opens = team.participants.filter((p) => p.active && CATEGORIES.every((c) => p.cats[c].lowVolume) && CATEGORIES.some((c) => p.cats[c].n > 0));
  assert.ok(opens.length > 0, 'the file has such participants');
  for (const p of opens.slice(0, 5)) says(viewOf(hospOf(calcRow(p), WHO)).wwit.quality.text, /low-volume episode types/, 'an all-low-volume participant on opening');
  // A scenario on target: there is nothing for quality to move.
  const on = viewOf(deflt, { ...setSlider(base, 0), moved: true });
  says(on.wwit.quality.text, /^\$0: on target there is no gain or repayment for quality to move$/, 'on target');
});

test('quality by measure is collapsed by default, and its score is compositeQuality\'s', () => {
  const v = viewOf(deflt);
  const markup = calcMarkup(v, { fig: false }).text;
  assert.ok(markup.includes('<details class="tc-more tc-q" id="tc-q">'), 'no open attribute');
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

test('?h=<ccn> preselects; an unknown ccn is ignored; a link applies only to the hospital it names', () => {
  const ccns = calcAsset(team).rows.map((r) => r[0]);
  const known = (c) => ccns.includes(c);
  const [a, b] = ccns.filter((c) => c !== team.defaultCcn);
  // The client's path (client/calc.js arrive): the address's ?h= through the family's reader, the link through readLink.
  const open = (search, hash = '', knows = known) => arrival({ link: hash.startsWith('#team') ? readLink(hash) : null, query: followedCcn(search), defaultCcn: team.defaultCcn, known: knows });
  same(open(`?h=${a}`).ccn, a, 'a participant in the query');
  same(open(`?h=${a.toLowerCase()}`).ccn, a, 'in either case');
  same(open('?h=ZZZZZZ').ccn, team.defaultCcn, 'unknown: the default');
  same(open('?h=<b>x</b>').ccn, team.defaultCcn, 'not a CCN');
  same(open('').ccn, team.defaultCcn, 'nothing: the default');
  same(open('', '#calc').ccn, team.defaultCcn, 'a bare anchor names none');
  const ended = team.participants.find((p) => !p.active);
  if (ended) same(open(`?h=${ended.ccn}`).ccn, team.defaultCcn, 'a participant that left is not offered');
  // A link's hospital wins, and its values come with it.
  const linked = open(`?h=${a}`, `#team&h=${b}&t=2`);
  assert.ok(linked.ccn === b && linked.values.track === 2 && !linked.dropped, 'the link\'s hospital, with its values');
  // A stale or unknown link hospital: the ?h=, then the default, and the link's values dropped, never applied elsewhere.
  const stale = open(`?h=${a}`, '#team&h=ZZZZZZ&t=2&n.LEJR=40');
  assert.ok(stale.ccn === a && stale.values === null && stale.dropped, 'the query\'s hospital; the link\'s values dropped');
  const lone = open('', '#team&h=ZZZZZZ&t=2');
  assert.ok(lone.ccn === team.defaultCcn && lone.values === null && lone.dropped, 'the default; dropped');
  // The participants' file didn't load: nothing is known, so a link to another hospital is dropped.
  const failed = open('', `#team&h=${b}&t=2`, () => false);
  assert.ok(failed.ccn === team.defaultCcn && failed.values === null && failed.dropped, 'a file that didn\'t load: dropped');
  // A link naming the default needs no file; one naming none applies to whichever opens.
  assert.ok(open('', `#team&h=${team.defaultCcn}&t=1`, () => false).values.track === 1);
  assert.ok(open(`?h=${a}`, '#team&t=1').ccn === a && open(`?h=${a}`, '#team&t=1').values.track === 1);
  // A link that names a hospital and nothing else drops nothing worth saying.
  assert.ok(!open('', '#team&h=ZZZZZZ').dropped);
});

test('a row of another shape is refused where it is read, quality percentiles included', () => {
  const row = calcRow(team.participants.find((p) => p.ccn === team.defaultCcn));
  assert.throws(() => hospOf(row.slice(1)), TypeError);
  for (const bad of [101, -1, NaN, '50']) {
    const r = [...row];
    r[r.length - 4] = bad;
    assert.throws(() => hospOf(r), TypeError, String(bad));
  }
  const none = [...row];
  none[none.length - 4] = null;
  assert.equal(hospOf(none).quality.hybrid_hwr, null);
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
  assert.ok(!/NaN|Infinity|undefined/.test(markup), 'no hole in the markup');
  assert.ok(markup.includes('<p class="tc-out__none" data-v="out.none">'), 'the sentence shows');
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
  // Linked own numbers are the reader's; a linked row spending is a scenario input, as the slider is.
  const own = applyLink(initialState(deflt), readLink('#team&n.LEJR=7&p.CABG=50000&lv.BOWEL=1&sk.SHFFT=-3').values);
  for (const k of ['n.LEJR', 'p.CABG', 'lv.BOWEL']) assert.ok(own.mine.has(k), k);
  assert.ok(!own.mine.has('sk.SHFFT') && own.sk.SHFFT === -3, 'the row\'s spending applied, not "your number"');
  assert.ok(own.moved, 'a linked spending counts as set');
  const rowOnly = applyLink(initialState(deflt), readLink('#team&sk.SHFFT=-3').values);
  assert.ok(isScenario(rowOnly, deflt) && !rowOnly.mine.size, 'a row\'s spending alone is a scenario');
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
    assert.ok(!/NaN|undefined/.test(calcMarkup(v).text), `Track ${track}: no hole in the markup`);
  }
});

// The review of Checkpoint M3: each fix's own check.
test('a box the reader can\'t fill goes back to its value before the edit, not to the last prefix the keys applied', () => {
  const start = initialState(deflt);
  // The keystrokes of "250000" in a box that takes up to 100,000: each in-range prefix applies as it is typed.
  let live = start;
  for (const prefix of ['2', '25', '250', '2500', '25000']) live = type(live, deflt, 'n.LEJR', prefix);
  assert.equal(live.ov.n.LEJR, 25000, 'the last prefix applied while typing');
  const r = commitBox(start, deflt, 'n.LEJR', '250000');
  assert.ok(!r.ok && r.state === start && !('LEJR' in r.state.ov.n), 'the commit goes back to the start of the edit');
  // A percentile: "1000" leaves no 100 behind.
  assert.ok(commitBox(start, deflt, 'q.falls', '1000').state === start);
  // A good commit is typeInto's from the start.
  assert.equal(commitBox(start, deflt, 'n.LEJR', '60').state.ov.n.LEJR, 60);
});

test('the public number typed back, or a low-volume box set back, is not the reader\'s', () => {
  const missing = Object.keys(MEASURES).find((m) => !deflt.quality[m]);
  let s = type(initialState(deflt), deflt, `q.${missing}`, '70');
  assert.ok(s.mine.has(`q.${missing}`));
  s = type(s, deflt, `q.${missing}`, '50');
  assert.ok(!s.mine.size && !(missing in s.q), 'the displayed 50 typed back: CMS\'s missing-data score again');
  const n = deflt.cats.LEJR.n;
  s = type(type(initialState(deflt), deflt, 'n.LEJR', String(n + 5)), deflt, 'n.LEJR', String(n));
  assert.ok(!s.mine.size && !('LEJR' in s.ov.n), 'the public count typed back');
  const lv = deflt.cats.CABG.lowVolume;
  const ticked = setLowVolume(initialState(deflt), deflt, 'CABG', !lv);
  assert.ok(ticked.mine.has('lv.CABG'));
  const back = setLowVolume(ticked, deflt, 'CABG', lv);
  assert.ok(!back.mine.size && !('CABG' in back.lv), 'tick then untick: the hospital\'s own flag again');
  // A row's spending typed equal to the slider follows the slider again.
  const row = type(type(setSlider(initialState(deflt), 3), deflt, 'sk.BOWEL', '7'), deflt, 'sk.BOWEL', '3');
  assert.ok(!('BOWEL' in row.sk));
});

test('another hospital carries the slider and the band, not the rows\' own spending; "set" follows what it carries', () => {
  const other = hospWhere((p) => p.active && p.ccn !== deflt.ccn);
  const rowsOnly = type(initialState(deflt), deflt, 'sk.CABG', '6');
  assert.ok(rowsOnly.moved);
  const next = carryOver(rowsOnly, other);
  assert.ok(!next.moved && !Object.keys(next.sk).length, 'only the rows were set: nothing set carries over');
  const slid = carryOver({ ...setSlider(initialState(deflt), -4), band: 8 }, other);
  assert.ok(slid.moved && slid.s === -4 && slid.band === 8 && slid.ccn === other.ccn);
  // The quality wording follows: the reference reading, not "in this scenario".
  assert.ok(!/in this scenario/.test(viewOf(other, next).wwit.quality.text), 'the reference wording');
});

test('the calculator never writes the family\'s ?h=; its hospital is the fragment\'s', () => {
  const state = setSlider(initialState(deflt), 2);
  const address = addressOf({ pathname: '/team/', search: '?h=999999&x=1' }, state);
  assert.ok(address.startsWith('/team/?h=999999&x=1#team&h='), 'the query exactly as it was');
  assert.ok(addressOf({ pathname: '/team/', search: '' }, state).startsWith('/team/#team&h='));
});

test('the page carries the participants\' CCNs, so an arrival outside them knows without fetching', () => {
  const text = activeCcns(team);
  const set = ccnSet(text);
  assert.equal(set.size, calcAsset(team).rows.length);
  assert.ok(calcAsset(team).rows.every((r) => set.has(r[0])));
  const outside = team.participants.find((p) => !p.active)?.ccn ?? 'ZZZZZZ';
  const to = arrival({ query: outside, defaultCcn: deflt.ccn, known: (c) => set.has(c) });
  assert.ok(to.ccn === deflt.ccn, 'a hospital outside them: the default');
});

test('a link with no hospital, arriving on a page already open, applies to the hospital showing', () => {
  const other = hospWhere((p) => p.active && p.ccn !== deflt.ccn).ccn;
  const to = arrival({ link: readLink('#team&s=5'), defaultCcn: deflt.ccn, known: () => true, current: other });
  assert.ok(to.ccn === other && to.values.s === 5 && !to.dropped);
  // On a fresh page (nothing showing yet) it goes to the ?h= or the default, as before.
  assert.ok(arrival({ link: readLink('#team&s=5'), defaultCcn: deflt.ccn, known: () => true }).ccn === deflt.ccn);
});

test('whoOf reads only as far as the hospital\'s row (no map of the whole search file); {} for one it lacks; whoByCcn maps them all', () => {
  const cols = ['ccn', 'name', 'city', 'state', 'other'];
  const rows = [['000001', 'A', 'Town A', 'AA', 1], ['000002', 'B', 'Town B', 'BB', 2]];
  // A third row that throws when read: a lookup that stops at its row never touches it.
  Object.defineProperty(rows, 2, { get() { throw new Error('read past the row'); }, enumerable: true });
  rows.length = 3;
  assert.deepEqual(whoOf({ cols, rows }, '000002'), { name: 'B', city: 'Town B', state: 'BB' });
  const two = { cols, rows: rows.slice(0, 2) };
  assert.deepEqual(whoOf(two, '999999'), {});
  assert.deepEqual([...whoByCcn(two).keys()], ['000001', '000002']);
  assert.throws(() => whoOf({ cols: ['ccn'], rows: [] }, '000001'), TypeError);
});

test('"Copy for a slide": the hospital, its track, the band\'s range, this scenario, "Hypothetical", the sources; "your numbers" only once typed', () => {
  const v = viewOf(deflt);
  const text = v.slide();
  const lines = text.split('\n');
  assert.ok(lines.length >= 6 && lines.every((l) => l.trim() !== ''), 'one fact a line, none blank');
  assert.ok(!/[{}]/.test(text), 'every placeholder filled');
  assert.ok(lines[0].includes(WHO.name) && lines[0].includes(v.hosp.where), 'the hospital, its CCN and place');
  assert.ok(text.includes(fill('trackName', { n: '3' })) && text.includes(v.ledger.limits), 'the track and its limits');
  assert.ok(text.includes(v.result.label) && text.includes(v.result.range), 'the band and its range');
  assert.ok(text.includes(v.ledger.result), 'this scenario\'s result');
  assert.ok(text.includes(t('slideHyp')), '"Hypothetical · standardized dollars"');
  for (const date of [team.meta.listAsOf, team.meta.pricesDated, team.meta.qualityReleased]) assert.ok(text.includes(isoDate(date)), 'each source\'s date');
  for (const year of team.meta.mupYears) assert.ok(text.includes(String(year)), 'the discharges\' years');
  assert.ok(!/your numbers/.test(text), 'nothing typed: no "your numbers"');

  // The slider is a scenario, not the reader's own number: still no label; the spending is said.
  const moved = viewOf(deflt, setSlider(initialState(deflt), 4));
  assert.ok(!/your numbers/.test(moved.slide()) && moved.slide().includes(moved.ledger.s.valuetext), 'the spending, no label');
  // A typed count: the result includes it, and the text says so.
  const typed = viewOf(deflt, type(initialState(deflt), deflt, 'n.LEJR', '120'));
  assert.ok(typed.slide().includes(t('tagMine')) && typed.slide().includes(typed.ledger.result), 'typed: "includes your numbers", with the result that has them');
});

// The calculator's target amount is the file's own: a row carries each category's price as the file has it (no rounding
// to the cent, which moved a target by up to dollars), so every participant's target reads back to the file's, to the cent.
test('every participant\'s target in the calculator is the file\'s target amount, to the cent', () => {
  let off = 0;
  for (const p of team.participants.filter((x) => x.active)) {
    const hosp = hospOf(calcRow(p));
    const target = reconcile(engineInputOf(hosp)).target;
    if (Math.abs(target - p.target) > 0.01) off += 1;
  }
  assert.equal(off, 0, 'participants whose calculator target is off the file\'s by more than a cent');
});

// Back to an older address on the same hospital (an in-page anchor, then a change, then Back): the older fragment is
// public inputs only, so it must not wipe the reader's own numbers. keepOwn carries them onto the state the link
// applies over; a link's own numbers, where it carries some, still win.
test('a link arriving for the hospital showing keeps the reader\'s own numbers; its own numbers win where it has them', () => {
  let state = type(initialState(deflt), deflt, 'n.LEJR', '120');
  state = type(state, deflt, 'q.falls', '90');
  state = setLowVolume(state, deflt, 'CABG', !deflt.cats.CABG.lowVolume);
  state = setSlider(state, 7);
  const older = readLink('#team&s=3');
  const next = applyLink(keepOwn(initialState(deflt), state), older.values);
  assert.equal(next.s, 3, 'the link\'s slider');
  assert.equal(next.ov.n.LEJR, 120);
  assert.equal(next.q.falls, 90);
  assert.equal(next.lv.CABG, !deflt.cats.CABG.lowVolume);
  assert.deepEqual([...next.mine].sort(), ['lv.CABG', 'n.LEJR', 'q.falls']);
  const theirs = applyLink(keepOwn(initialState(deflt), state), readLink('#team&n.LEJR=40').values);
  assert.equal(theirs.ov.n.LEJR, 40, 'the link\'s own number wins');
  // The arrival's choice: keep the reader's numbers only when the link carries none of its own.
  assert.equal(carriesOwn(older.values), false, 'a public-only link (Back): own numbers kept');
  for (const frag of ['#team&n.LEJR=40', '#team&p.LEJR=9000', '#team&q.falls=80', `#team&lv.CABG=1`]) assert.equal(carriesOwn(readLink(frag).values), true, frag);
  // keepOwn takes nothing that isn't the reader's: a row's spending and the slider stay the link's to set.
  const kept = keepOwn(initialState(deflt), type(state, deflt, 'sk.BOWEL', '-5'));
  assert.deepEqual(kept.sk, {});
  assert.equal(kept.s, 0);
});

// Once the reader has typed a number of their own, every place that restates the result's dollars says so as the result
// box does: the ledger's foot and "What would it take?"'s heading carry "includes your numbers" in its own style.
test('"includes your numbers" also on the ledger\'s foot and "What would it take?" once the reader typed one', () => {
  const tagOf = (markup, key) => new RegExp(`<span class="tc-tag tc-tag--mine" data-v="tag\\.${key}"( hidden)?>([^<]*)</span>`).exec(markup);
  const before = calcMarkup(viewOf(deflt), { fig: false }).text;
  for (const key of ['l', 'ww']) assert.ok(tagOf(before, key)?.[1], `${key}: hidden before anything is typed`);
  const after = calcMarkup(viewOf(deflt, type(initialState(deflt), deflt, 'n.LEJR', '120')), { fig: false }).text;
  for (const key of ['l', 'ww']) {
    const m = tagOf(after, key);
    assert.ok(m && !m[1] && m[2] === t('tagMine'), `${key}: shown, with the result box's words`);
  }
  assert.match(after, /<p class="tc-foot">A scenario, in standardized dollars\. <span class="tc-tag tc-tag--mine" data-v="tag\.l">/);
  assert.match(after, /<h3 class="tc-ww__h">[\s\S]*?data-v="tag\.ww">includes your numbers<\/span><\/h3>/);
});

test('a box\'s range in the line under it has a true minus; the Medicare-dependent note says when that route counts', () => {
  assert.deepEqual(rangeWords('sk.LEJR'), { lo: '−60', hi: '60' });
  assert.deepEqual(rangeWords('n.LEJR'), { lo: '0', hi: '100,000' });
  assert.ok(flagsNote(['MDH'], '2').includes('the Medicare-dependent route counts only if that program is still in effect when CMS asks hospitals to pick a track'));
  assert.ok(!flagsNote(['SCH'], '2').includes('Medicare-dependent'));
});

// The banner's lines, each its own (a link's scenario and reset, ended by a full stop; the keys it couldn't use; the
// followed hospital outside TEAM), drawn by the build, hidden until the page's script shows one.
test('the banner: the link\'s scenario line ends before the rejected keys\' line; the followed-hospital note is its own line', () => {
  const banner = /<div class="wi-banner tc__banner" data-calc-banner hidden>([\s\S]*?)<\/div>/.exec(program)?.[1];
  assert.ok(banner, 'the banner');
  assert.match(banner, /^<p data-calc-scen>[^<]*<a [^>]*data-calc-reset>Start from the public numbers<\/a>\.<\/p><p data-calc-rejected><\/p><p data-calc-away hidden>The hospital you’re following isn’t in TEAM, so the calculator shows one that is\. The lookup above says why\.<\/p>$/);
});
