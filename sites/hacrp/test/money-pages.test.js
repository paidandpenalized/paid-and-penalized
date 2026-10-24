// The money on the program page, the place pages and Methods (money-data.js, money-part.js, pages/*.js), on the
// pinned data: the aggregates add up to the emitted file's own headline; every figure's takeaway is the data's; no
// hospital is named outside a tooltip (DES-25); the national total always says how many of CMS's cut hospitals it
// covers; Methods holds the dollars section every estimate tag links to; and every in-site anchor on the built pages
// lands on an element of its page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { build } from '../../../pipeline/site/build.js';
import { filesUnder, withTemp } from '../../../pipeline/test/helpers.js';
import { count, decimal, dollars, money, moneyRange, pct } from '../../../web/render/format.js';
import { HUB } from '../../../hub/pages.js';
import { ACROSS_WINDOW, acrossFigure, hacAxis, programsFigure, sharesFigure, statesFigure } from '../web/money-part.js';
import { cutFrom } from '../web/money-figures.js';
import { moneyData, nearLine, placeMoney, sum } from '../web/money-data.js';
import { isDecided } from '../../../engine/js/hacrp/hospital.js';
import { TYPE_KINDS, programData } from '../web/program-data.js';
import { BACKTEST_HREF, DOLLARS_HREF } from '../web/links.js';
import { cutCounts, nationalRange, rangeOf, rangeShare, sumRanges } from '../web/money.js';
import { HEADLINE_MIN, MAJOR_TEACHING_RATIO, PARHM_THROUGH_YEAR, REDUCTION_PCT } from '../web/constants.js';
import { furthestGroup, methodsPage } from '../web/pages/methods.js';
import { absLogPct, assumptionsTable, insideCounts, stratumLabel } from '../web/methods-figures.js';
import { DATA, HD, MD, PD, PLACES, renderPlace, renderProgram } from './pinned.js';
import { ASSETS, slicedSite, strippedText as strip } from './fixtures.js';

const PROGRAM = renderProgram();
const part = /<section class="part" id="money"[\s\S]*?<\/section>\n<section class="part" id="map"/.exec(PROGRAM)[0];
const captionText = (html) => strip(/<figcaption class="fig__cap"[^>]*>([\s\S]*?)<\/figcaption>/.exec(html)[1]);
const captionOf = (html, id) => captionText(new RegExp(`<section class="psec[^"]*" id="${id}"[\\s\\S]*?</section>`).exec(html)[0]);

test('the nation, each state and each place carry the hospitals this site estimates the cut of and those CMS cut', () => {
  const h = DATA.dollars.headline;
  assert.deepEqual([MD.headline.cut, MD.headline.cmsCut], [h.cut, h.yes], 'the nation: the file\'s headline, CMS\'s count under the groups\' name');
  // A kind's group says how many hospitals it cuts and their dollars, not CMS's count (no page reads it).
  for (const { groups } of MD.byKind) for (const g of groups) assert.deepEqual(Object.keys(g), ['key', 'cut', 'money', 'shareHospitals', 'shareMoney']);
  for (const s of MD.byState.values()) assert.ok(s.cut <= s.cmsCut, s.state);
  for (const place of PLACES.list) {
    const pm = placeMoney(MD, place.ccns);
    assert.equal(pm.cmsCut, place.counts.yes, `${place.id}: the hospitals CMS cut there`);
    assert.ok(pm.cut <= pm.cmsCut, place.id);
  }
  // The placeholders the copy\'s "{cut} of the {yes}" take, for any of them.
  assert.deepEqual(cutCounts({ cut: 1234, cmsCut: 1300 }), { cut: count(1234), yes: count(1300) });
  assert.deepEqual(cutCounts(MD.headline), { cut: count(h.cut), yes: count(h.yes) });
});

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
    assert.ok(listed.every((g) => g.cut > 0), kind);
    if (kind === 'status') {
      for (const g of listed) assert.ok(g.money <= MD.headline.money, `${kind} ${g.key}`);
      continue;
    }
    const outside = MD.cutRows.filter((r) => !groups.some(([, test]) => test(r.master)));
    assert.equal(listed.reduce((s, g) => s + g.money, 0) + sum(outside, 'cut'), MD.headline.money, `${kind}: dollars`);
    assert.equal(listed.reduce((s, g) => s + g.cut, 0) + outside.length, MD.headline.cut, `${kind}: hospitals`);
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
  assert.equal(captionOf(part, 'across').replace(/^Figure \d+\. /, ''), `Of the hospitals this site estimates within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line, CMS cut ${count(over.length)} hospitals, about ${money(overMoney)}; the ${count(under.length)} just under it had about ${money(underMoney)} at stake.`);
  // Shares: the group whose money most outruns its count, from the data.
  const all = MD.byKind.filter((k) => ['teach', 'beds', 'own', 'urban'].includes(k.kind)).flatMap((k) => k.groups);
  const top = all.reduce((a, b) => (b.shareMoney / b.shareHospitals > a.shareMoney / a.shareHospitals ? b : a));
  const shares = captionOf(part, 'shares');
  assert.ok(shares.includes(`are ${pct(top.shareHospitals, 0)} of the cut hospitals this site estimates, and ${pct(top.shareMoney, 0)} of the money it estimates`), shares);
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
    assert.ok(note.includes('too small to label'), note);
  }
  // What the groups are: this site's grouping of CMS's resident-to-bed ratio, its major cutoff from the constant.
  assert.ok(strip(/<p class="small muted fig__note">([^<]*)<\/p>/.exec(bill)[1]).startsWith(`Teaching status: this site’s grouping of the resident-to-bed ratio in CMS’s impact file: major at ${decimal(MAJOR_TEACHING_RATIO, 2)} or more, minor above zero, none at zero.`));
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

// A place page's children table: each child's link -> { dollars: the cell's text, from: the note under it ('' for none) }.
function kidCells(page) {
  const cell = /<td class="num kids__money">([^<]*)(?:<span class="kids__from">([^<]*)<\/span>)?<\/td>/;
  return new Map([...page.matchAll(/<tr><th scope="row"><a href="([^"]*)">[^<]*<\/a><\/th>(.*?)<\/tr>/g)].map((m) => {
    const [, dollars, from = ''] = cell.exec(m[2]);
    return [m[1], { dollars, from }];
  }));
}

test('the children table\'s dollars: a child place with no estimated hospital (Maryland\'s are exempt) says "no estimate", not $0; the others say their dollars', () => {
  const byId = new Map(PLACES.list.map((p) => [p.id, p]));
  // The division holding Maryland, and the state of Maryland (its metro areas): every child's cell, by its page.
  for (const place of PLACES.list.filter((p) => (p.kind === 'division' && p.children.includes('state:md')) || p.id === 'state:md')) {
    const cells = kidCells(renderPlace(place));
    assert.equal(cells.size, place.children.length, place.id);
    let none = 0;
    for (const id of place.children) {
      const kid = byId.get(id);
      const pm = placeMoney(MD, kid.ccns);
      if (!pm.rows.length) none++;
      assert.equal(cells.get(kid.path).dollars, pm.rows.length ? money(pm.money) : 'no estimate', `${place.id} > ${id}`);
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
  assert.ok(caption.includes(`from ${money(500)} to ${money(500)}; per traditional Medicare stay, from ${dollars(40)} to ${dollars(50)}`), caption);
});

test('counts of one read in the singular: a state of one cut hospital, a bin of one hospital, a place with one hospital near the line', () => {
  const one = [...MD.byState.values()].find((s) => s.cut === 1 && s.cmsCut === 1);
  assert.ok(one, 'some state has exactly one cut hospital, which CMS also cut');
  assert.ok(part.includes(`${money(one.money)} from 1 cut hospital</title>`), 'the states map\'s tooltip');
  assert.match(part, /<title>1 hospital at /, 'the three programs\' columns');
  assert.doesNotMatch(part, /\b1 (cut )?hospitals\b/);
  // A place with exactly one of its hospitals within the window says that one, in the singular (it is on one side of the line).
  const near = nearLine(MD, ACROSS_WINDOW);
  const nearCcns = new Set(near.rows.map((r) => r.ccn));
  const place = PLACES.list.find((p) => p.kind === 'state' && p.ccns.filter((c) => nearCcns.has(c)).length === 1);
  assert.ok(place, 'some state has exactly one hospital near the line');
  assert.match(captionOf(renderPlace(place), 'across'), /^Figure \d+\. Of the nation’s [\d,]+ hospitals within 0\.05 of CMS’s line that this site estimates, [^,]+ has 1 (cut hospital|hospital not cut), /);
  // Hospitals on both sides: "are", and both sides said.
  const sidesOf = (p) => new Set(near.rows.filter((r) => p.ccns.includes(r.ccn)).map((r) => r.yes));
  const many = PLACES.list.find((p) => p.kind === 'state' && sidesOf(p).size === 2);
  assert.match(captionOf(renderPlace(many), 'across'), /^Figure \d+\. \d+ of the nation’s [\d,]+ hospitals within 0\.05 of CMS’s line that this site estimates are .*\d+ cut, about .* \d+ not cut, where a cut would have been about /);
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
  const lead = `Of the nation’s ${count(near.rows.length)} hospitals within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line that this site estimates, the Test has`;
  const [few, one] = [near.over.slice(0, 3), near.over.slice(0, 1)];
  assert.equal(few.length, 3);
  assert.equal(say(few), `${lead} 3 cut hospitals, about ${money(sum(few, 'atStake'))} by this site’s estimate.`);
  assert.equal(say(one), `${lead} 1 cut hospital, about ${money(one[0].atStake)} by this site’s estimate.`);
  const [fewU, oneU] = [near.under.slice(0, 3), near.under.slice(0, 1)];
  assert.equal(say(fewU), `${lead} 3 hospitals not cut, where a cut would have been about ${money(sum(fewU, 'atStake'))}.`);
  assert.equal(say(oneU), `${lead} 1 hospital not cut, where a cut would have been about ${money(oneU[0].atStake)}.`);
  // Both sides: both are said (the words the page had).
  const both = [near.over[0], near.under[0]];
  assert.equal(say(both), `2 of the nation’s ${count(near.rows.length)} hospitals within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line that this site estimates are the Test’s: 1 cut, about ${money(both[0].atStake)} by this site’s estimate, and 1 not cut, where a cut would have been about ${money(both[1].atStake)}.`);
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
    newest: { rows: DATA.sourceRows, source: DATA.source, periods: DATA.periods, pin: DATA.manifest.find((e) => e.id === DATA.source.id), measures: 6, pages: 1, sourceLine: 'Source.' },
    pins: DATA.pinsUsed, changes: [], estimate: { tolerance: 0.001, tagged: null, maxError: null }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
    robots: null, assets: ASSETS, searchUrl: null, dollars: DATA.dollars, names: () => ({ name: 'INVENTED HOSPITAL', city: 'NOWHERE', state: 'ZZ' }),
  });
  const id = DOLLARS_HREF.split('#')[1];
  const sec = new RegExp(`<section class="doc__sec msec" id="${id}"[\\s\\S]*?</section>`).exec(page)[0];
  // The estimate section's sentence on the dollars' tag links to this section, which the page has.
  assert.match(page, new RegExp(`Every dollar figure carries the tag too: the dollars are this site’s estimate, explained under <a href="#${id}">`));
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
  // The group named as running highest (or lowest) is the one with the largest own median miss among the groups with at
  // least HEADLINE_MIN hospitals of their own, whatever range it uses: on these pins, the largest own median, a positive
  // one, and the sentence says which groups it chose among.
  const hac = b.measures.hac;
  const withOwn = hac.strata.filter((s) => s.n > 0);
  const named = withOwn.filter((s) => s.n >= HEADLINE_MIN);
  const largest = named.reduce((a, s) => (s.median > a.median ? s : a));
  assert.equal(furthestGroup(hac.strata), largest);
  assert.ok(largest.median > 0 && named.every((s) => Math.abs(s.median) <= largest.median));
  assert.ok(largest.pool !== 'stratum', 'on these pins the group runs on a borrowed range, which the old rule skipped');
  const words = stratumLabel(b.strata.find((s) => s.id === largest.stratum)).hospitals;
  assert.ok(text.includes(`Of the groups with at least ${count(HEADLINE_MIN)} hospitals, hospitals with ${words} ran highest: by ${absLogPct(largest.median, 1)} at the median, across ${count(largest.n)} hospitals.`));
  // Coverage, from the data: each group's own hospitals inside the range it uses, in the notes and the table, and
  // the spread across the groups in words; never a promise.
  const inside = insideCounts(b);
  for (const s of withOwn) {
    const k = inside.get(s.stratum);
    const lo = b.points.filter((p) => p.stratum === s.stratum && p.actual >= rangeOf(b, 'hac', s.stratum, p.model)[0] && p.actual <= rangeOf(b, 'hac', s.stratum, p.model)[1]).length;
    assert.equal(k, lo, s.stratum);
    assert.ok(strip(wide).includes(`${count(s.n)} hospitals, ${count(k)} inside`), s.stratum);
  }
  assert.ok(table.includes('Inside its range'));
  const held = withOwn.map((s) => inside.get(s.stratum) / s.n);
  assert.ok(text.includes(`from ${pct(Math.min(...held), 0)} to ${pct(Math.max(...held), 0)} of them`));
  assert.doesNotMatch(text, /8 in 10|eight in ten/i);
  // The cut hospitals the HAC statistics leave out, counted from the data and said to sit outside them.
  const left = b.comparison.cut - hac.pairs.compared;
  assert.equal(left, hac.pairs.signMismatch + hac.pairs.zeroActual + hac.pairs.zeroModel + hac.pairs.bothZero);
  assert.ok(left > 0 && text.includes(`Of the ${count(b.comparison.cut)} cut hospitals, ${count(left)} can’t be compared, and sit outside every statistic of the HAC cut below`));
  // The Medicare Advantage teaching change came after the first check, on the same hospitals: said once, in the limits.
  assert.match(text, /not an independent test of the teaching payments on Medicare Advantage stays/);
});

test('the across-the-line note says which hospitals within the window the figure leaves out: no estimate, Maryland\'s (exempt), each only when there are some', () => {
  // From the pinned data: the scored hospitals the money leaves out, within the window, counted straight from the file.
  const near = nearLine(MD, ACROSS_WINDOW);
  const left = PD.rows.filter((r) => Math.abs(r.total - MD.line) <= ACROSS_WINDOW && !MD.rows.some((m) => m.ccn === r.ccn));
  const status = (r) => DATA.dollars.byCcn.get(r.ccn).status;
  assert.equal(near.noEstimate, left.filter((r) => status(r) === 'no-inputs').length);
  assert.equal(near.exempt, left.filter((r) => status(r) === 'maryland').length);
  assert.equal(near.noEstimate + near.exempt, left.length, 'every hospital left out is one or the other');
  assert.ok(near.noEstimate > 0 && near.exempt > 0, 'on these pins both kinds sit near the line');
  const w = decimal(ACROSS_WINDOW, 2);
  const note = (md) => strip(/<p class="small muted fig__note">([^<]*)<\/p>/.exec(String(acrossFigure(md, { n: 1, source: 'S' })))?.[1] ?? '');
  assert.equal(note(MD), `${count(near.noEstimate)} more within ${w} have no estimate, and Maryland’s ${count(near.exempt)} are exempt.`);
  // Either clause goes when its count is zero; with neither, there is no note.
  const withLeft = (noEstimate, exempt) => {
    const synthetic = { ...MD, noEstimate: Array(noEstimate).fill(MD.line), exempt: Array(exempt).fill(MD.line) };
    return note(synthetic);
  };
  assert.equal(withLeft(3, 0), `3 more within ${w} have no estimate.`);
  assert.equal(withLeft(0, 2), `Maryland’s 2 within ${w} are exempt.`);
  assert.equal(withLeft(0, 0), '');
});

test('a state\'s tooltip on the states map says how many of the hospitals CMS cut its dollars come from, when some have no estimate', () => {
  for (const s of MD.byState.values()) {
    const cms = DATA.hospitals.filter((h) => h.state === s.state && h.paymentReduction === 'Yes' && h.total !== null).length;
    assert.equal(s.cmsCut, cms, `${s.state}: CMS's cut hospitals`);
  }
  const short = [...MD.byState.values()].find((s) => s.money > 0 && s.cut < s.cmsCut);
  assert.ok(short, 'on these pins some state has a cut hospital with no estimate');
  assert.ok(part.includes(`${money(short.money)} from ${short.cut} of its ${short.cmsCut} cut hospitals</title>`), 'n of m');
  // All of them estimated: the plain count (one in the singular).
  const same = [...MD.byState.values()].find((s) => s.money > 0 && s.cut === s.cmsCut && s.cut > 1);
  assert.ok(part.includes(`${money(same.money)} from ${same.cut} cut hospitals</title>`), 'n');
});

test('the group named as furthest from its cost reports has at least HEADLINE_MIN hospitals of its own: a few-hospital group with a large miss is never named', () => {
  const group = (stratum, n, median) => ({ stratum, n, median });
  const strata = [group('a', HEADLINE_MIN, 0.05), group('few', 3, 0.9), group('almost', HEADLINE_MIN - 1, -0.8), group('d', HEADLINE_MIN, -0.2)];
  assert.equal(furthestGroup(strata).stratum, 'd', 'the largest miss, in either direction, among the groups big enough');
  assert.equal(furthestGroup(strata.filter((s) => s.n < HEADLINE_MIN)), undefined, 'none big enough, none named');
  assert.equal(furthestGroup([group('none', 0, 0.9)]), undefined);
  assert.equal(furthestGroup([]), undefined);
  // On the page the sentence is left out when no group is big enough, and says the filter when one is.
  const page = (hac) => {
    const dollars = { ...DATA.dollars, bands: { ...DATA.dollars.bands, measures: { ...DATA.dollars.bands.measures, hac: { ...DATA.dollars.bands.measures.hac, strata: hac } } } };
    return strip(methodsPage({
      fy: DATA.fy, checks: HD.checks.map((c) => ({ fy: c.fy, rule: 'rule', check: c.check })), years: HD.years.map((y) => ({ fy: y.fy, periods: y.periods })),
      newest: { rows: DATA.sourceRows, source: DATA.source, periods: DATA.periods, pin: DATA.manifest.find((e) => e.id === DATA.source.id), measures: 6, pages: 1, sourceLine: 'Source.' },
      pins: DATA.pinsUsed, changes: [], estimate: { tolerance: 0.001, tagged: null, maxError: null }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
      robots: null, assets: ASSETS, searchUrl: null, dollars, names: () => null,
    }));
  };
  const real = DATA.dollars.bands.measures.hac.strata;
  const small = real.map((s) => ({ ...s, n: Math.min(s.n, HEADLINE_MIN - 1) }));
  assert.doesNotMatch(page(small), /ran (highest|lowest)/);
  assert.match(page(real), new RegExp(`Of the groups with at least ${HEADLINE_MIN} hospitals, hospitals with .* ran (highest|lowest): by `));
  // The "lowest" twin says it too.
  const lowest = real.map((s) => ({ ...s, median: -Math.abs(s.median) }));
  assert.match(page(lowest), new RegExp(`Of the groups with at least ${HEADLINE_MIN} hospitals, hospitals with .* ran lowest: by `));
});

test('the treemap writes its tiles by hospital name, then CCN, not by size, and draws every group\'s tiles, the group too small to label included', () => {
  const bill = /<section class="psec[^"]*" id="bill"[\s\S]*?<\/section>/.exec(part)[0];
  const wide = /<svg[^>]*data-fit="wide"[\s\S]*?<\/svg>/.exec(bill)[0];
  const groups = wide.split('<g class="chart-tree__g">').slice(1);
  assert.ok(groups.length >= 3);
  let drawn = 0;
  for (const g of groups) {
    const tips = [...g.matchAll(/<title>([^<]*)<\/title><\/rect>/g)].map((m) => m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
    drawn += tips.length;
    const names = tips.map((t) => t.split(', ')[0].toLowerCase());
    assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), 'alphabetical within the group');
  }
  assert.equal(drawn, MD.cutRows.length, 'a tile for every cut hospital this site estimates');
  // A tile's place is its size's, whatever order it is written in: the area of each tile is its dollars' share of its group's box.
  const areas = [...wide.matchAll(/<rect data-mark x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"><title>[^<]*: (\$[\d.,]+[KM]?)<\/title><\/rect>/g)];
  assert.equal(areas.length, MD.cutRows.length);
  assert.ok(areas.every((m) => Number(m[1]) > 0 && Number(m[2]) > 0), 'every tile has a size');
});

test('a place where CMS cut no hospital shows $0 with no estimate tag: it is CMS\'s decision; a place with a cut shows the tag', () => {
  const card = (place) => /<div class="place__card">[\s\S]*?<\/div>\n<p class="stamp/.exec(renderPlace(place))[0];
  const field = (html) => /<div class="field f-money">[\s\S]*?<\/div>\n/.exec(html)[0];
  const none = PLACES.list.find((p) => p.kind === 'state' && p.counts.yes === 0 && placeMoney(MD, p.ccns).rows.length > 0);
  assert.ok(none, 'some state has estimated hospitals and none cut');
  assert.equal(placeMoney(MD, none.ccns).money, 0);
  assert.doesNotMatch(field(card(none)), /est-tag/, `${none.name}: no tag on a $0 that is CMS's decision`);
  assert.match(field(card(none)), />\$0</);
  const some = PLACES.list.find((p) => p.kind === 'state' && p.counts.yes > 0 && placeMoney(MD, p.ccns).money > 0);
  assert.match(field(card(some)), /class="est-tag"/);
});

// The estimates with some hospitals' taken out, as if the impact file had no row for them: a place page reads its dollars
// from this (md.rows) and from the hospitals CMS cut (md.decided), which stay.
const withoutEstimates = (ccns) => ({ ...MD, rows: MD.rows.filter((r) => !ccns.includes(r.ccn)) });
const parentOf = (place) => PLACES.list.find((p) => p.children.includes(place.id));
const cardOf = (place, md) => /<div class="place__card">[\s\S]*?<\/div>\n<p class="stamp/.exec(renderPlace(place, { md }))[0];
// The estimated-dollars field of a place's card, its note too (up to the next field, or the card's end).
const moneyField = (card) => card.split('<div class="field f-money">')[1].split(/\n<div class="field[ "]/)[0];

test('a place\'s dollars follow its {cut, cmsCut}: none cut is $0 untagged; cut with no estimate says "no estimate"; some estimated says which of the cut hospitals', () => {
  // Where every cut hospital has an estimate, the dollars carry no note.
  const whole = PLACES.list.find((p) => p.kind === 'state' && p.counts.yes > 0 && placeMoney(MD, p.ccns).cut === p.counts.yes);
  assert.ok(whole, 'a state whose every cut hospital is estimated');
  assert.doesNotMatch(strip(moneyField(cardOf(whole, MD))), /cut hospitals/);
  assert.equal(cutFrom({ cut: 4, cmsCut: 4 }), '');
  assert.equal(cutFrom({ cut: 3, cmsCut: 4 }), `from ${count(3)} of its ${count(4)} cut hospitals`);

  // No estimate: a state whose cut hospitals (all of them) have none, though others do. Not $0 (CMS cut some), no tag, no per-stay figure.
  const none = PLACES.list.find((p) => p.kind === 'state' && parentOf(p) && p.counts.yes > 0 && placeMoney(MD, p.ccns).rows.some((r) => !r.yes));
  const noneMd = withoutEstimates(MD.rows.filter((r) => r.yes && none.ccns.includes(r.ccn)).map((r) => r.ccn));
  const nopm = placeMoney(noneMd, none.ccns);
  assert.deepEqual([nopm.cut, nopm.cmsCut > 0, nopm.rows.length > 0, nopm.estimate], [0, true, true, null]);
  const card = cardOf(none, noneMd);
  assert.match(strip(moneyField(card)).replace(/\s+/g, ' '), /^ ?\d+Estimated dollars no estimate /);
  assert.doesNotMatch(card, /est-tag|\$0/);
  assert.doesNotMatch(card, /Per traditional Medicare stay/);
  assert.deepEqual(kidCells(renderPlace(parentOf(none), { md: noneMd })).get(none.path), { dollars: 'no estimate', from: '' });

  // Some estimated: the dollars of the estimated cut hospitals, tagged, with which of the cut hospitals they come from.
  const some = PLACES.list.find((p) => p.kind === 'state' && parentOf(p) && placeMoney(MD, p.ccns).cut >= 2);
  const dropped = MD.rows.find((r) => r.yes && some.ccns.includes(r.ccn));
  const someMd = withoutEstimates([dropped.ccn]);
  const pm = placeMoney(someMd, some.ccns);
  const words = `from ${count(pm.cut)} of its ${count(pm.cmsCut)} cut hospitals`;
  assert.ok(pm.cut > 0 && pm.cut < pm.cmsCut);
  assert.equal(pm.estimate, pm.money);
  const field = moneyField(cardOf(some, someMd));
  assert.ok(strip(field).includes(money(pm.money)));
  assert.match(field, /class="est-tag"/);
  assert.ok(strip(field).includes(words), strip(field));
  assert.deepEqual(kidCells(renderPlace(parentOf(some), { md: someMd })).get(some.path), { dollars: money(pm.money), from: words });
});

test('the assumptions table names the month and the year the earlier of the two provisions ends, from the date, not from display text', () => {
  const ends = (mdhEnd, lowVolumeEnd) => strip(String(assumptionsTable({ fy: 2026, assumptions: { volumeFy: 2024, mdhEnd, lowVolumeEnd }, backtestFy: 2024 })))
    .match(/Both run through ([A-Z][a-z]+ \d{4}), after FY2026 ends, so they count for the whole year\./)?.[1];
  assert.equal(ends('2026-12-31', '2026-12-31'), 'December 2026');
  assert.equal(ends('2027-01-15', '2026-11-30'), 'November 2026', 'the earlier one, either way round');
  assert.equal(ends('2026-11-30', '2027-01-15'), 'November 2026');
  assert.equal(ends('2027-01-01', '2027-03-31'), 'January 2027', 'the year is the date\'s own');
  assert.throws(() => assumptionsTable({ fy: 2026, assumptions: { volumeFy: 2024, mdhEnd: '2026-09-30', lowVolumeEnd: '2026-12-31' }, backtestFy: 2024 }), RangeError);
});

test('Methods: the assumptions table, row by row (the rows the accuracy pass added and changed), the national ratio and the figures the check covers', () => {
  const page = methodsPage({
    fy: DATA.fy, checks: HD.checks.map((c) => ({ fy: c.fy, rule: 'rule', check: c.check })), years: HD.years.map((y) => ({ fy: y.fy, periods: y.periods })),
    newest: { rows: DATA.sourceRows, source: DATA.source, periods: DATA.periods, pin: DATA.manifest.find((e) => e.id === DATA.source.id), measures: 6, pages: 1, sourceLine: 'Source.' },
    pins: DATA.pinsUsed, changes: [], estimate: { tolerance: 0.001, tagged: null, maxError: null }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
    robots: null, assets: ASSETS, searchUrl: null, dollars: DATA.dollars, names: () => null,
  });
  const id = DOLLARS_HREF.split('#')[1];
  const sec = new RegExp(`<section class="doc__sec msec" id="${id}"[\\s\\S]*?</section>`).exec(page)[0];
  const table = /<table class="gb assume">[\s\S]*?<\/table>/.exec(sec)[0];
  const rows = [...table.matchAll(/<tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g)].map((m) => [strip(m[1]), strip(m[2])]);
  const row = (start) => rows.find(([a]) => a.startsWith(start)) ?? assert.fail(`no assumption "${start}"`);
  const a = DATA.dollars.assumptions;
  const [endYear, endMonth] = (a.mdhEnd < a.lowVolumeEnd ? a.mdhEnd : a.lowVolumeEnd).split('-');
  const month = new Date(Date.UTC(Number(endYear), Number(endMonth) - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  assert.equal(row('The Medicare-dependent hospital add-on')[1], `Both run through ${month} ${endYear}, after FY${DATA.fy} ends, so they count for the whole year.`);
  assert.ok(a.mdhEnd > `${DATA.fy}-09-30` && a.lowVolumeEnd > `${DATA.fy}-09-30`, 'both end after the fiscal year');
  assert.equal(row('The add-on for hospitals with many dialysis patients')[0], 'The add-on for hospitals with many dialysis patients (the ESRD adjustment) and credits for replaced devices, which reduce a payment, are left out, though the HAC cut counts both.');
  assert.equal(row('The add-on for hospitals with many dialysis patients')[1], 'Both are small: leaving out the add-on makes the cut a hair low, leaving out the credits a hair high.');
  assert.equal(row('Teaching payments leave out')[0], 'Teaching payments leave out the second teaching factor for resident-cap slots CMS awards under its redistribution programs, which CMS’s impact file doesn’t carry.');
  assert.equal(row('Teaching payments leave out')[1], 'Hospitals that received those slots run a little low.');
  assert.equal(row('Maryland’s hospitals')[0], `Maryland’s hospitals: no dollars from the HAC program, which exempts them, or the readmissions program, under which they aren’t eligible for a penalty, and none from the value-based program, whose FY${DATA.fy} factors list no Maryland hospital.`);
  assert.equal(row('Hospitals in Pennsylvania’s Rural Health Model')[0], `Hospitals in Pennsylvania’s Rural Health Model, which CMS extended through ${PARHM_THROUGH_YEAR}, are estimated like any other hospital. Under the model, CMS paid them global budgets, which its evaluator reported were adjusted for their results in the three programs.`);
  // The rows the fact-check changed: the SCH and MDH comparison is on the year's totals, as the rule does; the add-ons are figured on the federal DRG payment.
  assert.equal(row('A sole community or Medicare-dependent hospital is paid')[0], 'A sole community or Medicare-dependent hospital is paid on its own rate or the federal one, whichever gives the greater total for the year; this site compares the year’s totals, as the rule does.');
  assert.equal(row('A sole community or Medicare-dependent hospital is paid')[1], 'None beyond the volume and case mix those totals rest on.');
  assert.equal(row('Teaching and low-income-patient payments')[0], 'Teaching and low-income-patient payments are figured on the federal DRG payment. Outlier payments are taken as a share of that payment alone, the base CMS’s national outlier target uses.');
  assert.match(row('A Medicare-dependent hospital’s own rate')[0], /with the year’s update and the rule’s budget-neutrality factors for its DRG changes\.$/);
  assert.equal(row('Traditional Medicare stays')[0], 'Traditional Medicare stays, plus the teaching payments Medicare makes on Medicare Advantage stays.');
  assert.equal(row('Traditional Medicare stays')[1], 'What Medicare Advantage plans pay hospitals isn’t in any figure.');
  assert.match(row('Teaching payments on a hospital’s Medicare Advantage stays')[1], new RegExp(`^That volume is two years old, and in this site’s check against FY${DATA.dollars.bands.fy} cost reports these payments came out lower than hospitals recorded, for reasons the check can’t separate\\. So a large teaching hospital’s estimate can run a little low\\.$`));
  // Where they stand: the dialysis row after the new-technology row, the slots row after the Medicare Advantage teaching row.
  const names = rows.map(([x]) => x);
  assert.equal(names.findIndex((x) => x.startsWith('The add-on for hospitals with many dialysis')), names.findIndex((x) => x.startsWith('New-technology')) + 1);
  assert.equal(names.findIndex((x) => x.startsWith('Teaching payments leave out')), names.findIndex((x) => x.startsWith('Teaching payments on a hospital')) + 1);
  // The national ratio's range is the middle share of the resampled ratios; the table covers the figures the page counts.
  const b = DATA.dollars.bands;
  const text = strip(sec);
  assert.ok(text.includes(`resampling the hospitals puts the middle ${pct(rangeShare(b), 0)} of that between ${pct(b.national.p10, 1)} and ${pct(b.national.p90, 1)}.`));
  const figures = [...sec.match(/<table class="gb bt-measures">[\s\S]*?<\/table>/)[0].matchAll(/<tr><th scope="row">/g)].length;
  assert.equal(figures, 5);
  assert.ok(text.includes('The same check for five of the figures the method makes'), 'the count in words, from the rows the table has');
  // The tail of a stale date: provisions ending inside the year would make the row false, so the page does not build.
  const ends = (mdhEnd, lowVolumeEnd) => ({ volumeFy: 2024, mdhEnd, lowVolumeEnd });
  const inYear = `${DATA.fy}-09-30`;
  const after = `${DATA.fy}-12-31`;
  assert.doesNotThrow(() => assumptionsTable({ fy: DATA.fy, assumptions: ends(after, after), backtestFy: 2024 }));
  // The earlier of the two dates is the one held to the year, whichever provision it is.
  for (const assumptions of [ends(inYear, after), ends(after, inYear), ends(inYear, inYear)]) {
    assert.throws(() => assumptionsTable({ fy: DATA.fy, assumptions, backtestFy: 2024 }), { name: 'RangeError', message: /not after FY2026 ends/ });
  }
});

// Every in-site link with a fragment that names an element (#id), on every page the build writes, lands on an element
// with that id in its page. Fragments that carry state (#state=XX, a what-if's #whatif&…) are not ids and are skipped.
test('every in-site anchor on the built pages lands on an element of its page', () =>
  withTemp('pp-anchors-', async (dir) => {
    const slice = { ...DATA, hospitals: DATA.hospitals.filter((h, i) => i % 97 === 0 || (h.total === null && h.paymentReduction === 'Yes')) };
    const out = join(dir, 'dist');
    await build({ outDir: out, sites: [slicedSite(slice), HUB] });
    const pages = filesUnder(out).filter((f) => basename(f) === 'index.html').map((f) => join(out, f));
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
