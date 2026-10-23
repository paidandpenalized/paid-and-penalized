// The money on the program page, the place pages and Methods (money-data.js, money-part.js, pages/*.js), on the
// pinned data: the aggregates add up to the emitted file's own headline; every figure's takeaway is the data's; no
// hospital is named outside a tooltip (DES-25); the national total always says how many of CMS's cut hospitals it
// covers; Methods holds the dollars section every estimate tag links to; and every in-site anchor on the built pages
// lands on an element of its page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { build } from '../../../pipeline/site/build.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { count, decimal, dollars, money, moneyRange, pct } from '../../../web/render/format.js';
import { HUB } from '../../../hub/pages.js';
import { HACRP, generateHacrp } from '../web/generate.js';
import { ACROSS_WINDOW, acrossFigure, hacAxis, programsFigure, sharesFigure, statesFigure } from '../web/money-part.js';
import { moneyData, nearLine, placeMoney, sum } from '../web/money-data.js';
import { isDecided } from '../../../engine/js/hacrp/hospital.js';
import { TYPE_KINDS, programData } from '../web/program-data.js';
import { BACKTEST_HREF, DOLLARS_HREF } from '../web/links.js';
import { nationalRange, sumRanges } from '../web/money.js';
import { REDUCTION_PCT } from '../web/constants.js';
import { methodsPage } from '../web/pages/methods.js';
import { DATA, HD, MD, PLACES, renderPlace, renderProgram } from './pinned.js';
import { ASSETS } from './fixtures.js';

const PROGRAM = renderProgram();
const part = /<section class="part" id="money"[\s\S]*?<\/section>\n<section class="part" id="map"/.exec(PROGRAM)[0];
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const captionText = (html) => strip(/<figcaption class="fig__cap"[^>]*>([\s\S]*?)<\/figcaption>/.exec(html)[1]);
const captionOf = (html, id) => captionText(new RegExp(`<section class="psec[^"]*" id="${id}"[\\s\\S]*?</section>`).exec(html)[0]);

test('the money\'s aggregates add up to the emitted file\'s own headline: CMS\'s cut count, the hospitals estimated, the dollars', () => {
  const h = DATA.dollars.headline;
  // The rows the breakdowns sum over are the file's own: its counts and its dollars.
  assert.equal(MD.rows.length, h.hospitals);
  assert.equal(MD.cutRows.length, h.cut);
  assert.equal(h.yes - MD.cutRows.length, h.yesUnestimated);
  assert.equal(MD.cutRows.reduce((s, r) => s + r.cut, 0), -h.hac);
  for (const key of ['hrrp', 'hvbp']) assert.equal(MD.rows.reduce((s, r) => s + DATA.dollars.byCcn.get(r.ccn)[key], 0), h[key], key);
  // Each breakdown adds back to the whole: the kinds that split hospitals into groups (a cut hospital the master has no fact for
  // is in none of a kind's groups) plus the cut hospitals outside every group; the special statuses overlap, so each stays within it.
  for (const [kind, groups] of TYPE_KINDS) {
    const listed = MD.byKind.find((k) => k.kind === kind).groups;
    assert.ok(listed.every((g) => g.n > 0), kind);
    if (kind === 'status') {
      for (const g of listed) assert.ok(g.money <= MD.headline.money, `${kind} ${g.key}`);
      continue;
    }
    const outside = MD.cutRows.filter((r) => !groups.some(([, test]) => test(r.master)));
    assert.equal(listed.reduce((s, g) => s + g.money, 0) + sum(outside, 'cut'), MD.headline.money, `${kind}: dollars`);
    assert.equal(listed.reduce((s, g) => s + g.n, 0) + outside.length, MD.headline.cut, `${kind}: hospitals`);
  }
  assert.equal([...MD.byState.values()].reduce((s, st) => s + st.money, 0), MD.headline.money, 'the states add to the nation');
  assert.equal([...MD.byState.values()].reduce((s, st) => s + st.cut, 0), MD.headline.cut);
  const sorted = MD.cutRows.map((r) => r.cut).sort((a, b) => b - a);
  assert.equal(MD.tenth.n, Math.ceil(sorted.length / 10));
  assert.equal(MD.tenth.money, sorted.slice(0, MD.tenth.n).reduce((a, b) => a + b, 0));
  // A slice of the hospitals sums over itself (the build's tests pass slices).
  const slice = moneyData({ pd: programData({ hospitals: DATA.hospitals.slice(0, 50), master: DATA.master, model: DATA.model }), dollars: DATA.dollars, model: DATA.model });
  assert.ok(slice.cutRows.length <= h.yes);
  // A place's money: its share of the nation's, and per stay over its hospitals' stays.
  const state = PLACES.list.find((p) => p.kind === 'state' && p.counts.yes > 5);
  const pm = placeMoney(MD, state.ccns);
  assert.equal(pm.money, MD.byState.get(state.key.toUpperCase()).money, 'the state\'s page and the states map say the same dollars');
  // Straight from the dollar estimates and CMS's rows: the cut hospitals' dollars, the stays of every decided hospital with an estimate.
  const cms = new Map(DATA.hospitals.map((h) => [h.ccn, h]));
  const decided = state.ccns.filter((c) => isDecided(cms.get(c)) && DATA.dollars.byCcn.get(c).status === 'estimated');
  const cutDollars = decided.filter((c) => cms.get(c).paymentReduction === 'Yes').reduce((s, c) => s - DATA.dollars.byCcn.get(c).hac, 0);
  const stays = decided.reduce((s, c) => s + DATA.dollars.byCcn.get(c).bills, 0);
  assert.equal(pm.money, cutDollars);
  assert.equal(pm.share, cutDollars / -DATA.dollars.headline.hac);
  assert.equal(pm.perStay, cutDollars / stays);
});

test('the program page\'s summary and the Part on the money say how many of CMS\'s cut hospitals the national total covers, the file\'s own headline', () => {
  const h = DATA.dollars.headline;
  const words = `${count(h.cut)} of the ${count(h.yes)} hospitals CMS cut`;
  const summary = /<div class="form prog__summary">[\s\S]*?<p class="stamp">/.exec(PROGRAM)[0];
  assert.ok(strip(summary).includes(money(-h.hac)));
  assert.ok(strip(summary).includes(words), 'the summary field');
  const intro = strip(/<header class="part__head">[\s\S]*?<\/header>/.exec(part)[0]);
  assert.ok(intro.includes(money(-h.hac)));
  assert.ok(intro.includes(words));
  assert.ok(intro.includes(`no usable row for the other ${count(h.yesUnestimated)}`));
  // Every dollar figure says it is an estimate and carries its likely range: the nation's, from the back-test's resampled
  // ratio, in the summary and the Part's intro, its words linking to the back-test.
  const range = moneyRange(...nationalRange(DATA.dollars.bands, -h.hac));
  assert.match(summary, /class="est-tag" href="\/hacrp\/methods\/#dollars"/);
  assert.ok(strip(summary).includes(`Likely range ${range}`), range);
  assert.ok(summary.includes(`href="${BACKTEST_HREF}"`));
  assert.ok(intro.includes(`(likely ${range})`), 'the intro');
  assert.doesNotMatch(PROGRAM, /\bpending\b/i);
});

test('the Part on the money: at least five figures, each beside its words, each takeaway the data\'s', () => {
  const figs = [...part.matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>/g)];
  assert.ok(figs.length >= 5, `${figs.length} figures`);
  assert.equal(captionOf(part, 'bill').replace(/^Figure \d+\. /, ''), `The largest tenth of the cuts, ${count(MD.tenth.n)} hospitals, are ${pct(MD.tenth.money / MD.headline.money, 0)} of the ${money(MD.headline.money)} this site estimates the program took.`);
  const { over, under, overMoney, underMoney } = nearLine(MD, ACROSS_WINDOW);
  assert.equal(captionOf(part, 'across').replace(/^Figure \d+\. /, ''), `Within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line, CMS cut ${count(over.length)} hospitals, about ${money(overMoney)} by this site’s estimate; the ${count(under.length)} just under it kept about ${money(underMoney)}.`);
  // Shares: the group whose money most outruns its count, from the data.
  const all = MD.byKind.filter((k) => ['teach', 'beds', 'own', 'urban'].includes(k.kind)).flatMap((k) => k.groups);
  const top = all.reduce((a, b) => (b.shareMoney / b.shareHospitals > a.shareMoney / a.shareHospitals ? b : a));
  const shares = captionOf(part, 'shares');
  assert.ok(shares.includes(`are ${pct(top.shareHospitals, 0)} of the hospitals CMS cut and ${pct(top.shareMoney, 0)} of the money`), shares);
  // States: the range of the states' dollars.
  const states = [...MD.byState.values()].filter((s) => s.money > 0);
  const st = captionOf(part, 'states');
  assert.ok(st.includes(`from ${money(Math.min(...states.map((s) => s.money)))} to ${money(Math.max(...states.map((s) => s.money)))}`), st);
  // Three programs: each total.
  const three = captionOf(part, 'three');
  for (const x of [money(-MD.headline.hrrp), money(MD.headline.hvbp), money(MD.headline.money)]) assert.ok(three.includes(x), `${x} in "${three}"`);
  // Every figure's words sit beside it (or over it).
  for (const id of ['bill', 'across', 'shares', 'states', 'three']) assert.match(part, new RegExp(`<section class="psec[^"]*" id="${id}"[\\s\\S]*?<div class="psec__text">[\\s\\S]*?<div class="psec__fig">\\n<figure`), id);
});

test('DES-25: no hospital is named on the money\'s Part outside a tooltip, and no figure table lists hospitals', () => {
  const words = part.replace(/<svg[\s\S]*?<\/svg>/g, '');
  const names = new Set(MD.cutRows.map((r) => r.name).filter((n) => n.length > 14));
  const named = [...names].filter((n) => words.includes(n) || words.includes(n.replace(/&/g, '&amp;').replace(/'/g, '&#39;')));
  assert.deepEqual(named, [], 'names only in the drawings\' tooltips');
  // Inside the drawings, a name appears only in a <title>.
  const drawings = [...part.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0].replace(/<title>[^<]*<\/title>/g, '')).join('');
  assert.deepEqual([...names].filter((n) => drawings.includes(n)), []);
  // The figures' tables are aggregates: each row is a group, a side of the line, a state or a program.
  const rows = [...part.matchAll(/<details class="fig__table">[\s\S]*?<\/details>/g)].flatMap((m) => [...m[0].matchAll(/<tr><th scope="row"[^>]*>([^<]*)</g)].map((r) => r[1]));
  assert.ok(rows.length > 0);
  assert.ok(rows.length < 120, `${rows.length} rows: no list of hospitals`);
});

test('the treemap\'s groups add to the headline: every cut hospital this site estimates, every dollar; a group too small to label is named in the note', () => {
  const bill = /<section class="psec[^"]*" id="bill"[\s\S]*?<\/section>/.exec(part)[0];
  const table = /<details class="fig__table">[\s\S]*?<\/details>/.exec(bill)[0];
  const rows = [...table.matchAll(/<tr><th scope="row">([^<]*)<\/th><td class="num" data-value="([^"]*)">[^<]*<\/td><td class="num" data-value="([^"]*)">/g)];
  assert.ok(rows.length >= 3);
  assert.equal(rows.reduce((s, r) => s + Number(r[2]), 0), MD.headline.cut, 'the groups\' hospitals');
  assert.equal(rows.reduce((s, r) => s + Number(r[3]), 0), MD.headline.money, 'the groups\' dollars');
  // Each group's header mark plots its dollars, so the drawing holds every group, labeled or not.
  const wide = /<svg[^>]*data-fit="wide"[\s\S]*?<\/svg>/.exec(bill)[0];
  const plotted = [...wide.matchAll(/<g class="chart-mark" data-mark data-value="(\d+)"><title>[^<]*<\/title><rect class="chart-tree__group"/g)].map((m) => Number(m[1]));
  assert.equal(plotted.reduce((a, b) => a + b, 0), MD.headline.money);
  const unknown = MD.cutRows.filter((r) => !['major', 'minor', 'none'].includes(r.master.teach));
  if (unknown.length) {
    const note = strip(/<p class="small muted fig__note">([^<]*)<\/p>/.exec(bill)[1]);
    assert.ok(note.includes(unknown.length === 1 ? 'one of the cut hospitals' : `${count(unknown.length)} of the cut hospitals`), note);
    assert.ok(note.includes(money(unknown.reduce((s, r) => s + r.cut, 0))), note);
  }
});

test('a place page: its estimate against the nation\'s, its children\'s dollars, its hospitals across the line', () => {
  const state = PLACES.list.find((p) => p.kind === 'state' && p.children.length > 1 && nearLine(MD, ACROSS_WINDOW).rows.some((r) => p.ccns.includes(r.ccn)));
  const page = renderPlace(state);
  const pm = placeMoney(MD, state.ccns);
  const card = strip(/<div class="place__card">[\s\S]*?<\/div>\n<p class="stamp/.exec(page)[0]);
  assert.ok(card.includes(money(pm.money)));
  assert.ok(card.includes(`${pct(pm.share, 1)} of the nation’s ${money(MD.headline.money)}`));
  // The place's likely range: its cut hospitals' ranges added up.
  assert.deepEqual(pm.range, sumRanges(pm.rows.filter((r) => r.yes).map((r) => r.range)));
  assert.ok(pm.range[0] < pm.money && pm.money < pm.range[1]);
  assert.ok(card.includes(`Likely range ${moneyRange(...pm.range)}`));
  assert.ok(card.includes(dollars(Math.round(pm.perStay))) && card.includes(`The nation: ${dollars(Math.round(MD.perStay))}`));
  assert.match(page, /<th scope="col" class="num">Est\. cut \(\$, modeled\)<\/th>/);
  assert.match(page, /<section class="psec psec--wide" id="across"/);
  assert.match(page, /chart-across__dot--faint/, 'the nation\'s other hospitals faint');
  // Only the place's own hospitals name themselves (a tooltip each, and a keyboard stop): the two side labels, then them.
  const wide = /<svg[^>]*data-fit="wide"[^>]*>[\s\S]*?<\/svg>/.exec(/<section class="psec psec--wide" id="across"[\s\S]*?<\/section>/.exec(page)[0])[0];
  const own = nearLine(MD, ACROSS_WINDOW).rows.filter((r) => state.ccns.includes(r.ccn)).length;
  assert.equal([...wide.matchAll(/<g class="chart-mark" data-mark/g)].length, 2 + own);
  assert.equal([...wide.matchAll(/<circle class="chart-across__dot/g)].length, nearLine(MD, ACROSS_WINDOW).rows.length, 'every near-line hospital still has its dot');
});

test('the children table\'s dollars: a child place with no estimated hospital (Maryland\'s are exempt) says "no estimate", not $0; the others say their dollars', () => {
  const byId = new Map(PLACES.list.map((p) => [p.id, p]));
  // The division holding Maryland, and the state of Maryland (its metro areas): every child's cell, by its page.
  for (const place of PLACES.list.filter((p) => (p.kind === 'division' && p.children.includes('state:md')) || p.id === 'state:md')) {
    const cells = new Map([...renderPlace(place).matchAll(/<tr><th scope="row"><a href="([^"]*)">[^<]*<\/a><\/th>.*?<td class="num kids__money">([^<]*)<\/td><\/tr>/g)].map((m) => [m[1], m[2]]));
    assert.equal(cells.size, place.children.length, place.id);
    let none = 0;
    for (const id of place.children) {
      const kid = byId.get(id);
      const pm = placeMoney(MD, kid.ccns);
      if (!pm.rows.length) none++;
      assert.equal(cells.get(kid.path), pm.rows.length ? money(pm.money) : 'no estimate', `${place.id} > ${id}`);
    }
    assert.ok(none > 0, `${place.id}: some child has no estimate`);
  }
  assert.equal(placeMoney(MD, byId.get('state:md').ccns).rows.length, 0, 'Maryland has no estimated hospital');
});

test('the states figure names a place with money but no circle on the map (Puerto Rico\'s hospitals have no place on it); with none, its note is the one it had', () => {
  const note = (md) => strip(/<p class="small muted fig__note">([^<]*)<\/p>/.exec(String(statesFigure(md, { n: 1, source: 'S', shapes: DATA.shapes })))[1]);
  const none = 'States whose hospitals CMS didn’t cut, and Maryland, have no circle.';
  assert.equal(note(MD), none);
  // A synthetic Puerto Rico row with money: the table lists it, the drawing has no circle for it, and the note says so.
  const pr = { state: 'PR', n: 4, cut: 1, money: 123456, stays: 900, perStay: 137.2 };
  const md = { byState: new Map([...MD.byState, ['PR', pr]]) };
  assert.equal(note(md), `${none} The map has no place for Puerto Rico, which the table lists.`);
  const figure = String(statesFigure(md, { n: 1, source: 'S', shapes: DATA.shapes }));
  assert.ok(figure.includes('<th scope="row">Puerto Rico</th>'), 'in the table');
  assert.equal([...figure.matchAll(/data-state="PR"/g)].length, 0, 'no circle');
  // Two such places are listed as a list.
  const guam = { ...pr, state: 'ZZ' };
  assert.match(note({ byState: new Map([...md.byState, ['ZZ', guam]]) }), /no place for Puerto Rico and ZZ, which the table lists\.$/);
});

test('the shares and states figures, with nothing to draw (no group, no state with money), stop with a clear error; the states\' takeaway reads their least and greatest, ties included', () => {
  assert.throws(() => sharesFigure({ byKind: [] }, { n: 1, source: 'S' }), { name: 'RangeError', message: /sharesFigure: no group/ });
  assert.throws(() => statesFigure({ byState: new Map([['TX', { state: 'TX', n: 2, cut: 0, money: 0, stays: 10, perStay: 0 }]]) }, { n: 1, source: 'S', shapes: DATA.shapes }), { name: 'RangeError', message: /statesFigure: no state/ });
  // Two states with the same money: the low and the high are that one figure.
  const same = { n: 2, cut: 1, money: 500, stays: 10, perStay: 50 };
  const md = { byState: new Map([['TX', { state: 'TX', ...same }], ['OH', { state: 'OH', ...same, perStay: 40 }]]) };
  const caption = captionText(String(statesFigure(md, { n: 1, source: 'S', shapes: DATA.shapes })));
  assert.ok(caption.includes(`from ${money(500)} to ${money(500)}; per Medicare stay, from ${dollars(40)} to ${dollars(50)}`), caption);
});

test('counts of one read in the singular: a state of one cut hospital, a bin of one hospital, a place with one hospital near the line', () => {
  const one = [...MD.byState.values()].find((s) => s.cut === 1);
  assert.ok(one, 'some state has exactly one cut hospital');
  assert.ok(part.includes(`${money(one.money)} from 1 cut hospital</title>`), 'the states map\'s tooltip');
  assert.match(part, /<title>1 hospital at /, 'the three programs\' columns');
  assert.doesNotMatch(part, /\b1 (cut )?hospitals\b/);
  // A place with exactly one of its hospitals within the window says that one, in the singular (it is on one side of the line).
  const near = nearLine(MD, ACROSS_WINDOW);
  const nearCcns = new Set(near.rows.map((r) => r.ccn));
  const place = PLACES.list.find((p) => p.kind === 'state' && p.ccns.filter((c) => nearCcns.has(c)).length === 1);
  assert.ok(place, 'some state has exactly one hospital near the line');
  assert.match(captionOf(renderPlace(place), 'across'), /^Figure \d+\. Of the nation’s [\d,]+ hospitals within 0\.05 of CMS’s line, [^,]+ has 1 (cut hospital|hospital not cut), /);
  // Hospitals on both sides: "are", and both sides said.
  const sidesOf = (p) => new Set(near.rows.filter((r) => p.ccns.includes(r.ccn)).map((r) => r.yes));
  const many = PLACES.list.find((p) => p.kind === 'state' && sidesOf(p).size === 2);
  assert.match(captionOf(renderPlace(many), 'across'), /^Figure \d+\. \d+ of the nation’s [\d,]+ hospitals within 0\.05 of CMS’s line are .*\d+ cut, about .* \d+ not cut, where a cut would have been about /);
});

// The three programs' panels: each column of a panel, as { n, tip, cls }, and the table's hospital counts.
function threePanels(figure) {
  const html = String(figure);
  const panels = html.split('<div class="three__p">').slice(1).map((p) => [...p.matchAll(/<g class="chart-mark" data-mark data-value="(\d+)"><title>([^<]*)<\/title><path class="([^"]*)"/g)].map(([, n, tip, cls]) => ({ n: Number(n), tip, cls })));
  const table = [...html.matchAll(/<tr><th scope="row">[^<]*<\/th><td class="num" data-value="(\d+)">/g)].map((m) => Number(m[1]));
  return { panels, table };
}
const total = (cols, cls) => cols.filter((c) => (cls ? c.cls === cls : true)).reduce((s, c) => s + c.n, 0);

test('the three programs\' columns: exactly zero is a column of its own, no cut or bonus bin holds a zero, and the columns add to the table and to the hospitals each file lists', () => {
  // Synthetic factors: exact 1 (no adjustment), a hair off 1 on each side, an edge of a bin (0.999), and bigger moves; a hospital a file doesn't list.
  const hrrp = [1, 1, 1, 0.9995, 0.9995, 0.999, 0.98, null];
  const vbp = [1, 1, 0.9995, 1.0003, 1.0003, 1.02, 0.98, null];
  const rows = hrrp.map((h, i) => ({ hrrpListed: h !== null, hrrpFactor: h ?? 1, vbpListed: vbp[i] !== null, vbpFactor: vbp[i] ?? 1, hvbp: 0 }));
  const { panels: [readm, value, hac], table } = threePanels(programsFigure({ rows, cutRows: rows.slice(0, 2), headline: { hrrp: -100, hvbp: 50, money: 20 } }, { n: 1, source: 'S' }));
  // Readmissions: "no cut" holds the three factor-1 hospitals and no other; the four cuts sit in cut columns.
  assert.deepEqual(readm.filter((c) => c.cls === 'chart-col').map((c) => [c.n, c.tip]), [[3, '3 hospitals at 0%']]);
  assert.equal(total(readm, 'chart-col chart-col--pen'), 4);
  assert.equal(total(readm), 7, 'every hospital the file lists');
  // Value-based: "no adjustment" holds the two factor-1 hospitals; bonuses (above 0) and cuts (below) in their own columns.
  assert.deepEqual(value.filter((c) => c.cls === 'chart-col').map((c) => [c.n, c.tip]), [[2, '2 hospitals at 0%']]);
  assert.equal(total(value, 'chart-col chart-col--rew'), 3);
  assert.equal(total(value, 'chart-col chart-col--pen'), 2);
  assert.equal(total(value), 7);
  // A bin that touches zero says it stops short of it, beside zero's own column.
  assert.ok(readm.some((c) => c.tip === '2 hospitals at over 0% to 0.1%'), readm.map((c) => c.tip).join(' | '));
  assert.ok(value.some((c) => /^1 hospital at \S0\.1% to under 0%$/.test(c.tip)), value.map((c) => c.tip).join(' | '));
  // The table counts the hospitals each program adjusted; the columns that aren't "none" add to it.
  assert.deepEqual(table.slice(0, 2), [total(readm) - 3, total(value) - 2]);
  assert.equal(total(hac), rows.length);
});

test('the three programs\' columns on the pinned data: the cut and bonus columns add to the table\'s counts, the "none" columns to the rest', () => {
  const { panels: [readm, value, hac], table } = threePanels(/<section class="psec[^"]*" id="three"[\s\S]*?<\/section>/.exec(part)[0]);
  const none = (cols) => total(cols, 'chart-col');
  const listed = (key) => MD.rows.filter((r) => r[key]).length;
  assert.equal(total(readm) - none(readm), table[0]);
  assert.equal(total(value) - none(value), table[1]);
  assert.equal(total(readm), listed('hrrpListed'));
  assert.equal(total(value), listed('vbpListed'));
  assert.equal(none(readm), MD.rows.filter((r) => r.hrrpListed && r.hrrpFactor === 1).length, 'no cut: only factor 1');
  assert.equal(none(value), MD.rows.filter((r) => r.vbpListed && r.vbpFactor === 1).length, 'no adjustment: only factor 1');
  assert.equal(total(hac), MD.rows.length);
  assert.equal(total(hac, 'chart-col chart-col--pen'), MD.cutRows.length);
});

test('the HAC panel stands on the reduction: its cut column, its tick and the room around them come from the reduction, not typed in', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  // At 2% the cut column is centered on 0.02, the axis runs a little past it, and the tick is there.
  const two = hacAxis(2);
  assert.deepEqual(two.ticks, [0, 0.02]);
  near((two.columns[1][0] + two.columns[1][1]) / 2, 0.02);
  near((two.columns[0][0] + two.columns[0][1]) / 2, 0);
  assert.ok(two.columns[0][1] < two.columns[1][0], 'the columns do not touch');
  assert.ok(two.domain[0] < two.columns[0][0] && two.columns[1][1] < two.domain[1], 'room around the columns');
  near(two.domain[1] - two.columns[1][1], two.columns[0][0] - two.domain[0]);
  // At the program's own reduction: the drawing the page had.
  const one = hacAxis(REDUCTION_PCT);
  assert.equal(REDUCTION_PCT, 1);
  one.columns.flat().concat(one.domain, one.ticks).forEach((x, i) => near(x, [-0.0015, 0.0015, 0.0085, 0.0115, -0.002, 0.012, 0, 0.01][i]));
});

test('a place whose hospitals near the line are all on one side says only that side, in the singular for one', () => {
  const near = nearLine(MD, ACROSS_WINDOW);
  const say = (rows) => captionText(String(acrossFigure(MD, { n: 1, source: 'S', mine: new Set(rows.map((r) => r.ccn)), name: 'the Test' }))).replace(/^Figure 1\. /, '');
  const lead = `Of the nation’s ${count(near.rows.length)} hospitals within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line, the Test has`;
  const [few, one] = [near.over.slice(0, 3), near.over.slice(0, 1)];
  assert.equal(few.length, 3);
  assert.equal(say(few), `${lead} 3 cut hospitals, about ${money(sum(few, 'atStake'))} by this site’s estimate.`);
  assert.equal(say(one), `${lead} 1 cut hospital, about ${money(one[0].atStake)} by this site’s estimate.`);
  const [fewU, oneU] = [near.under.slice(0, 3), near.under.slice(0, 1)];
  assert.equal(say(fewU), `${lead} 3 hospitals not cut, where a cut would have been about ${money(sum(fewU, 'atStake'))}.`);
  assert.equal(say(oneU), `${lead} 1 hospital not cut, where a cut would have been about ${money(oneU[0].atStake)}.`);
  // Both sides: both are said (the words the page had).
  const both = [near.over[0], near.under[0]];
  assert.equal(say(both), `2 of the nation’s ${count(near.rows.length)} hospitals within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line are the Test’s: 1 cut, about ${money(both[0].atStake)} by this site’s estimate, and 1 not cut, where a cut would have been about ${money(both[1].atStake)}.`);
  assert.doesNotMatch(say(few), /\b0 not cut|about \$0/);
});

test('the hospitals near the line: both sides, lowest score first, worked out once per estimate and window', () => {
  const near = nearLine(MD, ACROSS_WINDOW);
  assert.equal(nearLine(MD, ACROSS_WINDOW), near, 'remembered');
  assert.notEqual(nearLine(MD, ACROSS_WINDOW * 2), near);
  assert.ok(near.rows.every((r) => Math.abs(r.total - MD.line) <= ACROSS_WINDOW));
  assert.deepEqual(near.rows.map((r) => r.total), near.rows.map((r) => r.total).sort((a, b) => a - b));
  assert.equal(near.over.length + near.under.length, near.rows.length);
  assert.ok(near.over.every((r) => r.yes) && near.under.every((r) => !r.yes));
  assert.equal(near.overMoney + near.underMoney, sum(near.rows, 'atStake'));
  assert.ok(MD.rows.every((r) => Math.abs(r.total - MD.line) > ACROSS_WINDOW || near.rows.includes(r)), 'every hospital within the window is listed');
});

test('Methods: how this site estimates the dollars, at the anchor every estimate tag links to; the back-test drawn where every range links', () => {
  const page = methodsPage({
    fy: DATA.fy, checks: HD.checks.map((c) => ({ fy: c.fy, rule: 'rule', check: c.check })), years: HD.years.map((y) => ({ fy: y.fy, periods: y.periods })),
    newest: { rows: DATA.sourceRows, source: DATA.source, pin: DATA.manifest.find((e) => e.id === DATA.source.id), measures: 6, pages: 1, sourceLine: 'Source.' },
    pins: DATA.pinsUsed, changes: [], estimate: { tolerance: 0.001, tagged: null, maxError: null }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
    robots: null, assets: ASSETS, searchUrl: null, dollars: DATA.dollars, names: () => ({ name: 'INVENTED HOSPITAL', city: 'NOWHERE', state: 'ZZ' }),
  });
  const id = DOLLARS_HREF.split('#')[1];
  const sec = new RegExp(`<section class="msec" id="${id}"[\\s\\S]*?</section>`).exec(page)[0];
  const h = DATA.dollars.headline;
  const pipe = /<ol class="pipe pipe--dollars"[\s\S]*?<\/ol>/.exec(sec)[0];
  for (const x of [money(h.base), money(h.hrrp), money(h.hvbp), money(h.after), money(h.hac)]) assert.ok(strip(pipe).includes(x), x);
  assert.ok(strip(pipe).includes(`for ${count(h.cut)} of the ${count(h.yes)} hospitals CMS cut`));
  // The tape: one line per check, its result.
  const tape = /<div class="receipt receipt--dollars">[\s\S]*?<\/div>/.exec(sec)[0];
  assert.equal([...tape.matchAll(/<tr><th scope="row">/g)].length, DATA.dollars.checks.length);
  assert.equal([...tape.matchAll(/class="receipt__ok">pass</g)].length, DATA.dollars.checks.filter((c) => c.pass).length);
  // The assumptions: two columns, NTAP among them.
  assert.match(sec, /<th scope="col">Assumption<\/th><th scope="col">Effect on the estimate<\/th>/);
  assert.match(strip(sec), /New-technology add-on payments are left out/);
  assert.match(strip(sec), new RegExp(`add the ${count(h.cut)} of CMS’s ${count(h.yes)} cut hospitals`));
  // The back-test: no placeholder; at the anchor every range links to; the comparison set and every exclusion in words;
  // one strip per stratum, a dot per compared cut hospital, its name only in its tooltip.
  const b = DATA.dollars.bands;
  assert.doesNotMatch(sec, /\bpending\b/i);
  assert.ok(sec.includes(`id="${BACKTEST_HREF.split('#')[1]}"`));
  const text = strip(sec);
  assert.ok(text.includes(`${count(b.comparison.hospitals)} hospitals, ${count(b.comparison.cut)} of them cut by CMS`));
  assert.ok(text.includes(`Of the ${count(b.comparison.reports)} reports`));
  for (const [key, n] of Object.entries(b.comparison.excluded)) if (n > 0) assert.ok(text.includes(count(n)), key);
  const fig = /<figure class="fig" id="figure-\d+" data-figure>(?:(?!<\/figure>)[\s\S])*?chart--bt[\s\S]*?<\/figure>/.exec(sec)[0];
  const wide = /<svg[^>]*data-fit="wide"[^>]*>[\s\S]*?<\/svg>/.exec(fig)[0];
  assert.equal([...wide.matchAll(/<circle class="chart-bt__dot"/g)].length, b.points.length);
  assert.equal([...wide.matchAll(/<rect class="chart-bt__band/g)].length, b.measures.hac.strata.length);
  assert.equal([...wide.matchAll(/<title>INVENTED HOSPITAL, NOWHERE, ZZ: estimate /g)].length, b.points.length);
  assert.equal(strip(fig.replace(/<title>[\s\S]*?<\/title>/g, '')).includes('INVENTED HOSPITAL'), false, 'names only in tooltips');
  // The table: one row per stratum, no hospital in it.
  const table = /<table class="gb"[\s\S]*?<\/table>/.exec(fig)[0];
  assert.equal([...table.matchAll(/<tr><th scope="row"/g)].length, b.measures.hac.strata.length);
  // Every figure the back-test checks, in the summary table.
  assert.equal([...sec.matchAll(/<table class="gb bt-measures">[\s\S]*?<\/table>/g)].length, 1);
});

// Every in-site link with a fragment that names an element (#id), on every page the build writes, lands on an element
// with that id in its page. Fragments that carry state (#state=XX, a what-if's #whatif&…) are not ids and are skipped.
test('every in-site anchor on the built pages lands on an element of its page', () =>
  withTemp('pp-anchors-', async (dir) => {
    const slice = { ...DATA, hospitals: DATA.hospitals.filter((h, i) => i % 97 === 0 || (h.total === null && h.paymentReduction === 'Yes')) };
    const hacrp = { ...HACRP, generate: (ctx) => generateHacrp(ctx, { data: slice, log: () => {} }) };
    const out = join(dir, 'dist');
    await build({ outDir: out, sites: [hacrp, HUB] });
    const pages = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'index.html') pages.push(p); } };
    walk(out);
    const ids = new Map();
    const idsOf = (file) => {
      if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
      return ids.get(file);
    };
    let checked = 0;
    for (const file of pages) {
      const text = readFileSync(file, 'utf8');
      for (const [, path, frag] of text.matchAll(/href="(\/[^"#]*)?#([^"]+)"/g)) {
        if (/[=&]/.test(frag)) continue;
        const target = path ? join(out, path, 'index.html') : file;
        assert.ok(existsSync(target), `${file}: ${path} is not a page`);
        assert.ok(idsOf(target).has(frag), `${file.slice(out.length)}: #${frag} is not on ${path ?? 'its page'}`);
        checked++;
      }
    }
    assert.ok(checked > 100, `${checked} anchors checked`);
    assert.ok(idsOf(join(out, 'hacrp', 'methods', 'index.html')).has(DOLLARS_HREF.split('#')[1]), 'Methods holds #dollars');
  }));
