// The program page's "The FY2027 picture" Part: its lede (the median cut, how many lose 1% or more, how many are at the cap), the
// size of the cuts (Step 2's swarm form on the cut), the share cut by number of conditions measured beside which conditions cost
// the most (the kit's paired bars), the cuts by peer group (the old site's strip plot), the traits' ranges, and the table of the
// largest cuts (each row ending in the kit's six-cell glyph, web/charts/miniCards.js, with a CSV of the same hospitals, csv.js,
// written by the build as largest-penalties.csv). figures/picture-data.js holds their numbers and
// figures/picture-draw.js the drawings the kit has no chart for; the words are in program/copy.js.
import { CAP_PCT, CONDS } from '../../../../engine/js/hrrp/formula.js';
import { drawn, figure, imagePair, num } from '../../../../web/charts/figure.js';
import { isNarrow, r2 } from '../../../../web/charts/svg.js';
import { pairBars } from '../../../../web/charts/pairBars.js';
import { capitalize, count, listText, noun, numberWord, pct, placeText, roundedDollars, signed, spelled } from '../../../../web/render/format.js';
import { printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { conditionShort } from '../derive.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct, gapText, ratio } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { hospitals, inSentence, plural } from '../wording.js';
import { countedNames, glyph } from './glyph.js';
import { CUT_BIN, MIN_BAND, drawsBands, drawsFlips, drawsPeers, drawsWorth } from './picture-data.js';
import { PER_STEP } from './hospital-data.js';
import { drawCuts, drawFlips, drawMeasured, drawSizeBands, drawSpread, drawStrip, drawWorth } from './picture-draw.js';
import { BESIDE, FULL, HALF, SIDE, pair, pic } from './layout.js';

// The Part's lede paragraph: how few hospitals carry half of the year's modeled dollars, a fact the size-of-cuts figure under it
// doesn't state (its takeaway gives the median cut, the 1%-or-more count and the cap count).
export function ledeText({ lede }) {
  if (!lede.nCut) return t('pictureLedeNone');
  if (lede.nCut === 1) return t('pictureLedeOne');
  if (lede.nHalf === null) return t('pictureLedeNoDollars');
  return fill('pictureLede', { n: fmtInt(lede.nHalf), hospitals: noun(lede.nCut, 'hospital'), share: fmtPct((100 * lede.nHalf) / lede.nCut, 0) });
}

// The largest-penalties table as the figure's chart: a row for each hospital, its name linking to its page with its place under
// it (as the explorer's rows have it), then its cut, its modeled dollars and the glyph (with the conditions in words for a screen reader).
// On a phone the three number columns give way to one line under the place (the cut and the dollars in words, then the glyph), so
// the table fits the screen; each width shows one copy (the other is display: none, out of the accessibility tree too).
function penTable(rows, conditions) {
  return html`<div class="pen">${printout(html`<table class="gb pen__table">
<thead><tr><th scope="col">${t('penColHospital')}</th><th scope="col" class="num">${t('penColCut')}</th><th scope="col" class="num">${t('penColDollars')}</th><th scope="col">${t('penColConds')}</th></tr></thead>
<tbody>${rows.map((r, i) => {
    const names = countedNames(r, conditions);
    const spoken = html`<span class="vh">${names.length ? fill('penCondsSpoken', { list: listText(names) }) : t('penCondsNone')}</span>`;
    const phone = html`<span class="pen__phone"><span class="pen__nums">${fill('penPhoneLine', { cut: fmtPct(r.h.red), dollars: fmtMoney(r.h.pen) })}</span><span class="pen__glyph">${glyph(r, i + 1, conditions, 'penp')}</span>${spoken}</span>`;
    return html`<tr><th scope="row"><a href="${hospitalPath(r.h.id)}">${r.h.name}</a><span class="nb__place">${placeText({ city: r.h.city, state: r.h.st })}</span>${phone}</th><td class="num">${fmtPct(r.h.red)}</td><td class="num">${fmtMoney(r.h.pen)}</td><td><span class="pen__glyph">${glyph(r, i + 1, conditions)}</span>${spoken}</td></tr>`;
  })}</tbody>
</table>`)}</div>`;
}

function penFigure({ rows, conditions, edition, n }) {
  const cuts = rows.map((r) => r.h.red);
  const [hi, lo] = [Math.max(...cuts), Math.min(...cuts)];
  const words = spelled(rows.length);
  const takeaway = rows.length === 1 ? fill('penTakeawayOne', { cut: fmtPct(hi) })
    : hi === lo
    ? fill('penTakeawayTie', { words, cut: fmtPct(hi) })
    : fill('penTakeaway', { words, hi: fmtPct(hi), lo: fmtPct(lo) });
  return figure({
    n, takeaway, source: fill('penSource', { edition }), claimLevel: 'estimate', csvName: 'hrrp-largest-penalties',
    chart: penTable(rows, conditions),
    note: fill('penKey', { names: listText(CONDS.map((k) => conditionShort(conditions, k))) }),
    table: {
      columns: [{ name: t('penColHospital') }, { name: t('penColPlace') }, { name: t('penColCut'), numeric: true }, { name: t('penColDollars'), numeric: true }, { name: t('penColConds') }],
      rows: rows.map((r) => [
        r.h.name, placeText({ city: r.h.city, state: r.h.st }), num(fmtPct(r.h.red), r.h.red), num(fmtMoney(r.h.pen), r.h.pen),
        listText(countedNames(r, conditions)),
      ]),
    },
  });
}

// ---------- the size of the cuts ----------

const pct0 = (fraction) => pct(fraction, 0);
const CUT_TICKS = [0, 0.5, 1, 1.5, 2, 2.5, CAP_PCT];
const cutTicks = (width) => (isNarrow(width) ? [0, 1, 2, CAP_PCT] : CUT_TICKS);
const percent = (v) => `${v}%`;

export function cutsTakeaway(sw) {
  const k = sw.takeaway;
  const base = { hospitals: hospitals(k.nMeasured), zero: fmtInt(k.zero), takes: k.zero === 1 ? 'takes' : 'take' };
  if (!k.nCut) return fill('cutsTakeawayNone', { hospitals: base.hospitals });
  if (k.nCut === 1) return fill('cutsTakeawayOne', { ...base, median: fmtPct(k.median) });
  return fill('cutsTakeaway', {
    ...base, nCut: fmtInt(k.nCut), median: fmtPct(k.median), nOnePlus: fmtInt(k.nOnePlus), loses: k.nOnePlus === 1 ? 'loses' : 'lose', one: String(k.onePlus),
    nCap: fmtInt(k.nCap), reaches: k.nCap === 1 ? 'reaches' : 'reach', cap: String(k.cap),
  });
}

function cutsFigure({ sw, edition, n }) {
  const measured = sw.items.filter((i) => i.measured);
  if (!measured.length) return '';
  // The pile has the bin just left of zero; empty bins before it leave room for its count's label (a phone's, a bin narrower, needs more).
  const edgesFor = (width) => {
    const empty = isNarrow(width) ? 4 : 2;
    return [
      ...Array.from({ length: empty }, (_, i) => -(empty - i) * CUT_BIN),
      ...Array.from({ length: Math.round(CAP_PCT / CUT_BIN) + 1 }, (_, i) => r2(i * CUT_BIN)),
    ];
  };
  const items = measured.map((i) => ({ score: i.cut ? i.red : -CUT_BIN / 2 }));
  const nCut = measured.length - sw.zeroMeasured;
  const draw = (width) => drawCuts({
    items, edges: edgesFor(width), cap: CAP_PCT, width, ticks: cutTicks(width), format: percent,
    labels: { below: fill(isNarrow(width) ? 'cutsNonePhone' : 'cutsNone', { n: fmtInt(sw.zeroMeasured) }), above: fill('cutsSome', { n: fmtInt(nCut) }) },
  });
  const range = (b) => fill(b.hi >= CAP_PCT ? 'cutsRangeLast' : 'cutsRange', { from: fmtPct(b.lo), to: fmtPct(b.hi) });
  const noteLines = [fill('cutsKey', { step: String(CUT_BIN), cap: String(CAP_PCT) })];
  if (sw.zeroUnmeasured) noteLines.push(fill('cutsUnmeasured', { hospitals: hospitals(sw.zeroUnmeasured), are: sw.zeroUnmeasured === 1 ? 'is' : 'are' }));
  return figure({
    n: n(), takeaway: cutsTakeaway(sw), source: fill('pictSource', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-size-of-cuts',
    chart: imagePair(drawn(draw, SIDE), fill('cutsAlt', { cap: String(CAP_PCT) })), note: noteLines.join(' '),
    table: {
      columns: [{ name: t('cutsColCut') }, { name: t('cutsColN'), numeric: true }],
      rows: sw.table.map((b) => [b.hi === 0 ? t(b.measured ? 'cutsRowNone' : 'cutsRowNoneUnmeasured') : range(b), num(count(b.n), b.n)]),
    },
  });
}

// ---------- more conditions measured ----------

const CI = '95%';
const conditionsOf = (k) => (k === CONDS.length ? t('measAll') : `${numberWord(k)} ${k === 1 ? 'condition' : 'conditions'}`);

export function measuredTakeaway(m) {
  const { first, last } = m.takeaway ?? {};
  if (!first) return t('measTakeawayNone');
  if (!last) return fill('measTakeawayOne', { first: conditionsOf(first.k), firstShare: pct0(first.share) });
  return fill('measTakeaway', { first: conditionsOf(first.k), firstShare: pct0(first.share), last: conditionsOf(last.k), lastShare: pct0(last.share) });
}

function measuredFigure({ m, edition, n }) {
  const rows = m.rows.filter((r) => r.n > 0);
  if (!rows.length) return '';
  const spec = rows.map((r) => ({
    label: plural(r.k, 'condition'), sub: hospitals(r.n), share: r.share, lo: r.interval[0], hi: r.interval[1], n: r.n, valueText: pct0(r.share),
    tip: fill('measTip', { measured: plural(r.k, 'condition'), share: pct0(r.share), ci: CI, from: pct0(r.interval[0]), to: pct0(r.interval[1]), hospitals: hospitals(r.n) }),
  }));
  const draw = (width) => drawMeasured({ rows: spec, width, axisFormat: (v) => `${Math.round(v * 100)}%` });
  return figure({
    n: n(), takeaway: measuredTakeaway(m), source: fill('pictSource', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-share-cut-by-conditions',
    chart: imagePair(drawn(draw, HALF), fill('measAlt', { ci: CI })), note: fill('measKey', { ci: CI }),
    table: {
      columns: [{ name: t('measColK'), numeric: true }, { name: t('measColN'), numeric: true }, { name: t('measColCut'), numeric: true }, { name: t('measColShare'), numeric: true }, { name: fill('measColInterval', { ci: CI }) }],
      rows: m.table.map((r) => [num(String(r.k), r.k), num(count(r.n), r.n), num(count(r.nCut), r.nCut), num(pct0(r.share), r.share), fill('measInterval', { from: pct0(r.interval[0]), to: pct0(r.interval[1]) })]),
    },
  });
}

// ---------- the cuts by peer group ----------

export function peerTakeaway(p) {
  const first = String(PEER_FIRST);
  const last = String(PEER_LAST);
  const k = p.takeaway;
  if (!k) return fill('peerTakeawayFew', { first, last });
  if (k.lowestDual && k.low.peer === PEER_FIRST && k.others) {
    const [a, b] = [pct0(k.others.min), pct0(k.others.max)];
    return fill('peerTakeaway', { first, last, low: pct0(k.low.shareCut), range: a === b ? a : fill('peerDualRange', { from: a, to: b }) });
  }
  return fill('peerTakeawayOther', { first, last, min: pct0(k.min), max: pct0(k.max), lowGroup: String(k.low.peer) });
}
const PEER_FIRST = 1;
const PEER_LAST = 5;

// wide: the drawing's width, SIDE beside what peer grouping changed, FULL when it stands alone.
function peerFigure({ p, edition, n, wide = SIDE }) {
  if (!drawsPeers(p)) return '';
  const spec = p.rows.map((r) => {
    const share = r.shareCut === null ? t('peerNoShare') : fill('peerShare', { share: pct0(r.shareCut) });
    return {
      reds: r.reds, median: r.median, shareText: share,
      label: fill('peerLabel', { n: String(r.peer) }),
      sub: r.lo === null ? '' : fill('peerSub', { from: pct0(r.lo), to: pct0(r.hi) }),
      tip: fill('peerTip', { n: String(r.peer), hospitals: hospitals(r.n), share: r.shareCut === null ? t('peerNoShare') : pct0(r.shareCut), median: r.median === null ? t('peerNoShare') : fmtPct(r.median) }),
    };
  });
  const draw = (width) => drawStrip({ rows: spec, cap: CAP_PCT, width, ticks: cutTicks(width), format: percent, labels: { median: t('peerKeyMedian'), shade: t('peerKeyShade') } });
  return figure({
    n: n(), takeaway: peerTakeaway(p), source: fill('pictSource', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-cuts-by-peer-group',
    chart: imagePair(drawn(draw, wide), fill('peerAlt', { cap: String(CAP_PCT) })), note: t('peerNote'),
    table: {
      columns: [{ name: t('peerColGroup') }, { name: t('peerColDual') }, { name: t('peerColAll'), numeric: true }, { name: t('peerColN'), numeric: true }, { name: t('peerColShare'), numeric: true }, { name: t('peerColMedian'), numeric: true }],
      rows: p.table.map((r) => [
        fill('peerLabel', { n: String(r.peer) }), r.lo === null ? '—' : fill('peerDualRange', { from: pct0(r.lo), to: pct0(r.hi) }), num(count(r.n), r.n), num(count(r.nMeasured), r.nMeasured),
        num(r.shareCut === null ? '—' : pct0(r.shareCut), r.shareCut), num(r.median === null ? '—' : fmtPct(r.median), r.median),
      ]),
    },
  });
}

// ---------- what did peer grouping change? ----------

// "About" a count: the single median is this file's, not CMS's, so a count of 20 or more is said to the nearest ten.
const about = (n) => fmtInt(n >= 20 ? Math.round(n / 10) * 10 : n);
// "group 5", "groups 1 to 4" (a run), or "groups 1, 3 and 5".
function groupsText(peers) {
  if (peers.length === 1) return fill('flipsGroup', { n: String(peers[0]) });
  const run = peers.every((p, i) => i === 0 || p === peers[i - 1] + 1);
  return run ? fill('flipsGroupsRun', { from: String(peers[0]), to: String(peers[peers.length - 1]) }) : fill('flipsGroups', { list: listText(peers.map(String)) });
}

export function flipsTakeaway(f) {
  if (!f.totals.flips) return t('flipsTakeawayNone');
  // Said from peer grouping's side, as the drawing has it: the groups it takes flags off on balance, with the flags their grey bars take
  // off, then the groups it puts flags on, with the flags their red bars put on (the numbers a reader adds up from the bars).
  const side = (keep, key) => {
    const rows = f.rows.filter(keep);
    return rows.length ? { groups: groupsText(rows.map((r) => r.peer)), n: about(rows.reduce((s, r) => s + r[key], 0)) } : null;
  };
  const [off, on] = [side((r) => r.net < 0, 'removed'), side((r) => r.net > 0, 'added')];
  if (off && on) return fill('flipsTakeaway', { off: off.groups, offN: off.n, on: on.groups, onN: on.n });
  if (off) return fill('flipsTakeawayOff', { off: off.groups, offN: off.n });
  if (on) return fill('flipsTakeawayOn', { on: on.groups, onN: on.n });
  return t('flipsTakeawayEven');
}

// wide: the drawing's width, BESIDE the peer-group strips, FULL when it stands alone.
function flipsFigure({ f, edition, n, wide = BESIDE }) {
  if (!drawsFlips(f)) return '';
  const spec = f.rows.map((r) => ({
    label: fill('peerLabel', { n: String(r.peer) }), sub: r.lo === null ? '' : fill('peerSub', { from: pct0(r.lo), to: pct0(r.hi) }), added: r.added, removed: r.removed,
    tip: fill('flipsTip', { n: String(r.peer), on: fmtInt(r.added), off: fmtInt(r.removed) }),
  }));
  const draw = (width) => drawFlips({ rows: spec, width, labels: { off: t('flipsHeadOff'), on: t('flipsHeadOn') } });
  return figure({
    n: n(), takeaway: flipsTakeaway(f), source: fill('swarmSource', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-flags-without-peer-groups',
    chart: imagePair(drawn(draw, wide), t('flipsAlt')), note: t('flipsNote'),
    table: {
      columns: [{ name: t('peerColGroup') }, { name: t('peerColDual') }, { name: t('flipsColMeasured'), numeric: true }, { name: t('flipsColNow'), numeric: true }, { name: t('flipsColAlone'), numeric: true }, { name: t('flipsColOn'), numeric: true }, { name: t('flipsColOff'), numeric: true }],
      rows: f.rows.map((r) => [
        fill('peerLabel', { n: String(r.peer) }), r.lo === null ? '—' : fill('peerDualRange', { from: pct0(r.lo), to: pct0(r.hi) }), num(fmtInt(r.measured), r.measured),
        num(fmtInt(r.now), r.now), num(fmtInt(r.alone), r.alone), num(fmtInt(r.added), r.added), num(fmtInt(r.removed), r.removed),
      ]),
    },
  });
}

// ---------- the traits' ranges ----------

const TRAIT_NAME = { teaching: 'typeNameTeaching', beds: 'typeNameBeds', setting: 'typeNameSetting', ownership: 'typeNameOwnership' };
const traitName = (block) => t(TRAIT_NAME[block]);
const groupName = (block, row) => (block === 'beds' ? fill('typeGroupBeds', { band: row.label }) : block === 'setting' ? t(row.key === 'urban' ? 'typeGroupUrban' : 'typeGroupRural') : row.label);
const points = (v) => noun(Math.round(v), 'point');

export function typeTakeaway(ty) {
  if (!ty.takeaway) return '';
  const { widest, narrowest } = ty.takeaway;
  const base = {
    widest: traitName(widest.block), spread: points(widest.spread),
    lo: groupName(widest.block, widest.lo), loShare: fmtPct(widest.lo.share, 0), hi: groupName(widest.block, widest.hi), hiShare: fmtPct(widest.hi.share, 0),
  };
  return narrowest ? fill('typeTakeaway', { ...base, narrowest: capitalize(traitName(narrowest.block)), narrowSpread: points(narrowest.spread) }) : fill('typeTakeawayOne', base);
}

function typeFigure({ ty, edition, n }) {
  if (!ty.traits.length) return '';
  const traits = ty.traits.map((tr) => ({
    name: traitName(tr.block), lo: tr.lo.share, hi: tr.hi.share, spreadText: points(tr.spread),
    groups: tr.groups.map((g) => ({ label: groupName(tr.block, g), share: g.share, tip: fill('typeTip', { group: groupName(tr.block, g), share: fmtPct(g.share, 0), hospitals: count(g.nMeasured) }) })),
  }));
  const nat = { share: ty.national.share, text: fill('typeNation', { share: fmtPct(ty.national.share, 0) }) };
  const draw = (width) => drawSpread({ traits, national: nat, width, format: percent, head: t('typeSpreadHead') });
  return figure({
    n: n(), takeaway: typeTakeaway(ty), source: fill('pictSourceTypes', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-share-cut-by-trait',
    chart: imagePair(drawn(draw, SIDE), t('typeAlt')), note: t('typeKey'),
    table: {
      columns: [{ name: t('typeColTrait') }, { name: t('typeColGroup') }, { name: t('typeColN'), numeric: true }, { name: t('typeColShare'), numeric: true }],
      rows: ty.table.map((r) => [traitName(r.block), groupName(r.block, r), num(count(r.nMeasured), r.nMeasured), num(fmtPct(r.share, 0), r.share)]),
    },
  });
}

// ---------- what is 0.01 of ratio worth? ----------

// Dollars to the nearest hundred (a typical value, not an exact one): $9,800.
const hundreds = (v) => roundedDollars(Math.round(v / 100) * 100);
const STEP_TEXT = ratio(PER_STEP, 2);

// The dearest and cheapest condition's typical price of 0.01 over the median; with one priced condition, that one alone.
export function worthTakeaway(w, conditions) {
  const name = (r) => inSentence(conditionShort(conditions, r.cond));
  if (!w.takeaway) {
    const only = w.rows.find((r) => r.median !== null);
    return only ? fill('worthTakeawayOne', { step: STEP_TEXT, hi: name(only), hiDollars: hundreds(only.median) }) : t('worthTakeawayNone');
  }
  const { hi, lo } = w.takeaway;
  if (hundreds(hi.median) === hundreds(lo.median)) return fill('worthTakeawayEven', { step: STEP_TEXT, hiDollars: hundreds(hi.median) });
  return fill('worthTakeaway', { step: STEP_TEXT, hi: name(hi), hiDollars: hundreds(hi.median), lo: name(lo), loDollars: hundreds(lo.median) });
}

// An axis tick in dollars: under $1K in whole dollars ($500), from $1K in thousands to a tenth ($5K, $1.5K; the kit's 1-2-5 steps
// stay exact).
const axisMoney = (v) => (v === 0 ? '$0' : v < 1000 ? `$${Math.round(v)}` : `$${Number((v / 1000).toFixed(1))}K`);

function worthFigure({ w, conditions, edition, n }) {
  if (!drawsWorth(w)) return '';
  const spec = (width) => w.rows.map((r) => ({
    label: conditionShort(conditions, r.cond, { narrow: isNarrow(width) }), median: r.median, p25: r.p25, p75: r.p75,
    valueText: r.median === null ? '—' : hundreds(r.median),
    tip: r.median === null ? fill('worthTipNone', { cond: conditionShort(conditions, r.cond) })
      : fill('worthTip', { cond: conditionShort(conditions, r.cond), step: STEP_TEXT, median: hundreds(r.median), from: hundreds(r.p25), to: hundreds(r.p75), hospitals: hospitals(r.priced) }),
  }));
  const draw = (width) => drawWorth({ rows: spec(width), width, labels: { dot: t('worthKeyDot'), bar: t('worthKeyBar'), barShort: t('worthKeyBarShort') }, format: axisMoney });
  const blank = w.rows.reduce((s, r) => s + r.blank, 0);
  return figure({
    n: n(), takeaway: worthTakeaway(w, conditions), source: fill('pictSourceDollars', { edition }), claimLevel: 'estimate', csvName: 'hrrp-dollars-per-step',
    chart: imagePair(drawn(draw, HALF), fill('worthAlt', { step: STEP_TEXT })), note: fill(blank ? 'worthNote' : 'worthNoteAll', { cap: String(CAP_PCT), zero: roundedDollars(0) }),
    table: {
      columns: [{ name: t('worthColCond') }, { name: t('worthColN'), numeric: true }, { name: t('worthColMedian'), numeric: true }, { name: t('worthColP25'), numeric: true }, { name: t('worthColP75'), numeric: true }, { name: t('worthColCapped'), numeric: true }, { name: t('worthColBlank'), numeric: true }],
      rows: w.rows.map((r) => [
        conditionShort(conditions, r.cond), num(fmtInt(r.priced), r.priced),
        ...[r.median, r.p25, r.p75].map((v) => (v === null ? num('—', null) : num(roundedDollars(v), v))),
        num(fmtInt(r.capped), r.capped), num(fmtInt(r.blank), r.blank),
      ]),
    },
  });
}

// ---------- are small hospitals let off? ----------

export function bandsTakeaway(b, conditions) {
  const names = (list) => listText(list.map((k) => inSentence(conditionShort(conditions, k))));
  const { lower, higher, compared } = b.takeaway;
  if (!compared) return t('bandsTakeawayNoCompare');
  if (!lower.length && !higher.length) return t('bandsTakeawayNone');
  if (lower.length && higher.length) return fill('bandsTakeaway', { lower: names(lower), higher: names(higher) });
  return lower.length ? fill('bandsTakeawayLower', { lower: names(lower) }) : fill('bandsTakeawayHigher', { higher: names(higher) });
}

const gap4 = (v) => (v === null ? '—' : gapText(v));

function bandsFigure({ b, conditions, edition, n }) {
  if (!drawsBands(b)) return '';
  const withAny = b.conditions.filter((c) => c.first);
  const panelsFor = (width) => withAny.map((c) => ({
    name: conditionShort(conditions, c.cond, { narrow: isNarrow(width) }),
    bands: c.bands.map((band) => ({
      ...band, tip: band.shown ? fill('bandsTip', { cond: conditionShort(conditions, c.cond), band: band.label, share: pct0(band.share), hospitals: hospitals(band.n), from: gap4(band.p25), to: gap4(band.p75) }) : '',
    })),
  }));
  const labels = { flagged: t('bandsFlagged'), half: t('bandsHalf'), middle: t('bandsMiddle'), median: t('bandsMedian'), cases: t('bandsCases'), headTop: t('bandsHeadTop'), headBottom: t('bandsHeadBottom') };
  const draw = (width) => drawSizeBands({ panels: panelsFor(width), width, labels, format: pct0, signed: (v) => signed(v, 1) });
  return figure({
    n: n(), takeaway: bandsTakeaway(b, conditions), source: fill('swarmSource', { edition }), claimLevel: 'recomputed', csvName: 'hrrp-flagged-by-cases',
    chart: imagePair(drawn(draw, FULL), withAny.length === 1 ? t('bandsAltOne') : fill('bandsAlt', { count: capitalize(spelled(withAny.length)) })), note: fill('bandsNote', { min: String(MIN_BAND) }),
    table: {
      columns: [{ name: t('bandsColCond') }, { name: t('bandsColBand') }, { name: t('bandsColN'), numeric: true }, { name: t('bandsColShare'), numeric: true }, { name: t('bandsColFrom'), numeric: true }, { name: t('bandsColTo'), numeric: true }],
      rows: b.table.filter((r) => r.n > 0).map((r) => [
        conditionShort(conditions, r.cond), r.label, num(fmtInt(r.n), r.n), num(pct0(r.share), r.share), num(gap4(r.p25), r.p25), num(gap4(r.p75), r.p75),
      ]),
    },
  });
}

// ---------- which conditions cost the most ----------

export function barsTakeaway(b, conditions) {
  if (!b.takeaway) return '';
  const { up, down } = b.takeaway;
  const name = (r, first) => (first ? capitalize(conditionShort(conditions, r.cond)) : inSentence(conditionShort(conditions, r.cond)));
  const part = (r, side, first) => ({ [side]: name(r, first), [`${side}Flags`]: pct0(r.shareOfFlags), [`${side}Dollars`]: pct0(r.shareOfDollars) });
  if (up && down) return fill('barsTakeaway', { ...part(up, 'up', true), ...part(down, 'down', false) });
  if (up) return fill('barsTakeawayUp', part(up, 'up', true));
  if (down) return fill('barsTakeawayDown', part(down, 'down', true));
  return t('barsTakeawayEven');
}

function barsFigure({ b, conditions, edition, n }) {
  if (!b.takeaway) return '';
  const draw = (width) => pairBars({
    width, labels: { a: fill('barsKeyFlags', { flags: fmtInt(b.totalFlags) }), b: t('barsKeyDollars') }, direct: { a: t('barsNameFlags'), b: t('barsNameDollars') },
    sections: [{
      heading: t('barsHead'),
      rows: b.rows.map((r) => {
        const name = conditionShort(conditions, r.cond);
        return {
          label: conditionShort(conditions, r.cond, { narrow: isNarrow(width) }), a: r.shareOfFlags, b: r.shareOfDollars, aText: pct0(r.shareOfFlags), bText: pct0(r.shareOfDollars),
          tipA: fill('barsTipFlags', { cond: name, flags: fmtInt(r.flags), all: fmtInt(b.totalFlags), share: pct0(r.shareOfFlags) }),
          tipB: fill('barsTipDollars', { cond: name, dollars: fmtMoney(r.dollars), share: pct0(r.shareOfDollars) }),
        };
      }),
    }],
  });
  return figure({
    n: n(), takeaway: barsTakeaway(b, conditions), source: fill('pictSourceDollars', { edition }), claimLevel: 'estimate', csvName: 'hrrp-flags-and-dollars-by-condition',
    chart: imagePair(drawn(draw, HALF), t('barsAlt')), note: t('barsNote'),
    table: {
      columns: [{ name: t('barsColCond') }, { name: t('barsColMeasured'), numeric: true }, { name: t('barsColFlags'), numeric: true }, { name: t('barsColFlagShare'), numeric: true }, { name: t('barsColDollars'), numeric: true }, { name: t('barsColDollarShare'), numeric: true }],
      rows: b.table.map((r) => [conditionShort(conditions, r.cond), num(fmtInt(r.measured), r.measured), num(fmtInt(r.flags), r.flags), num(pct0(r.shareOfFlags), r.shareOfFlags), num(fmtMoney(r.dollars), r.dollars), num(pct0(r.shareOfDollars), r.shareOfDollars)]),
    },
  });
}

// picture: view.picture (picture-data.js pictureData); figure: the page's figure counter; edition: the edition's label. The figures are
// numbered in page order, which follows Thirty Day Readmissions' Part: the size of the cuts (its words beside it), the share cut by
// conditions measured beside the conditions' share of flags and dollars, what 0.01 of ratio is worth (its words left, its chart under the
// flags and dollars), the cuts by peer group beside what peer grouping changed, the traits'
// ranges (words beside), the share flagged by size band across the page, then the table of the largest cuts across the page, a line to a hospital.
export function picturePart(picture, { figure: nextFigure, edition }) {
  const { largest, conditions } = picture;
  const cuts = pic(cutsFigure({ sw: picture.size(), edition, n: nextFigure }), 'side');
  const measured = pic(measuredFigure({ m: picture.measured(), edition, n: nextFigure }));
  const bars = pic(barsFigure({ b: picture.bars(), conditions, edition, n: nextFigure }));
  const worth = pic(worthFigure({ w: picture.worth(), conditions, edition, n: nextFigure }), 'rside');
  // The peer-group strips and what peer grouping changed share a 7:5 row; either one alone takes the row at full width.
  const [p, f] = [picture.peers(), picture.flips()];
  const both = drawsPeers(p) && drawsFlips(f);
  const peers = pic(peerFigure({ p, edition, n: nextFigure, wide: both ? SIDE : FULL }));
  const flips = pic(flipsFigure({ f, edition, n: nextFigure, wide: both ? BESIDE : FULL }));
  const types = pic(typeFigure({ ty: picture.types(), edition, n: nextFigure }), 'side');
  const bands = pic(bandsFigure({ b: picture.bands(), conditions, edition, n: nextFigure }));
  return html`<p class="part__intro">${ledeText(picture)}</p>
${cuts}
${pair(measured, bars)}
${worth}
${pair(peers, flips, { side: true })}
${types}
${bands}
${largest.length ? html`<div class="pic">${penFigure({ rows: largest, conditions, edition, n: nextFigure() })}</div>
<p class="small pen__csv"><a href="${picture.csvHref}" download>${t('penDownload')}</a></p>` : ''}`;
}
