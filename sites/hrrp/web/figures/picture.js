// The program page's "The FY2027 picture" Part: its lede (the median cut, how many lose 1% or more, how many are at the cap), the
// size of the cuts (Step 2's swarm form on the cut), the table of the largest cuts (each row ending in the kit's six-cell glyph,
// web/charts/miniCards.js, with a CSV of the same hospitals, csv.js, written by the build as largest-penalties.csv), and four more
// figures: the share cut by number of conditions measured, the cuts by peer group (the old site's strip plot), the traits'
// ranges, and which conditions cost the most (the kit's paired bars). figures/picture-data.js holds their numbers and
// figures/picture-draw.js the drawings the kit has no chart for; the words are in program/copy.js.
import { CAP_PCT, CONDS } from '../../../../engine/js/hrrp/formula.js';
import { drawn, figure, imagePair, num } from '../../../../web/charts/figure.js';
import { isNarrow, r2 } from '../../../../web/charts/svg.js';
import { miniCards } from '../../../../web/charts/miniCards.js';
import { pairBars } from '../../../../web/charts/pairBars.js';
import { capitalize, count, listText, noun, numberWord, pct, placeText, spelled } from '../../../../web/render/format.js';
import { printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { conditionShort } from '../derive.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { hospitals, inSentence, plural } from '../wording.js';
import { countedNames, glyph } from './glyph.js';
import { CUT_BIN } from './picture-data.js';
import { drawCuts, drawMeasured, drawSpread, drawStrip } from './picture-draw.js';

// The Part's lede paragraph.
export function ledeText({ lede }) {
  if (!lede.nCut) return t('pictureLedeNone');
  const some = (n, many, one, extra) => fill(n === 1 ? one : many, { hospitals: noun(n, 'hospital'), ...extra });
  return [
    lede.nCut === 1 ? fill('pictureLedeOne', { median: fmtPct(lede.medianCut) }) : fill('pictureLede', { hospitals: noun(lede.nCut, 'hospital'), median: fmtPct(lede.medianCut) }),
    some(lede.nOnePlus, 'pictureOnePlus', 'pictureOnePlusOne', { one: String(lede.onePlus) }),
    some(lede.nCap, 'pictureCap', 'pictureCapOne', { cap: String(lede.cap) }),
  ].join(' ');
}

// The largest-penalties table as the figure's chart: a row for each hospital, its name linking to its page, then its cut, its
// modeled dollars and the glyph (with the conditions in words for a screen reader).
function penTable(rows, conditions) {
  return html`<div class="pen">${printout(html`<table class="gb pen__table">
<thead><tr><th scope="col">${t('penColHospital')}</th><th scope="col">${t('penColPlace')}</th><th scope="col" class="num">${t('penColCut')}</th><th scope="col" class="num">${t('penColDollars')}</th><th scope="col">${t('penColConds')}</th></tr></thead>
<tbody>${rows.map((r, i) => {
    const names = countedNames(r, conditions);
    return html`<tr><th scope="row"><a href="${hospitalPath(r.h.id)}">${r.h.name}</a></th><td>${placeText({ city: r.h.city, state: r.h.st })}</td><td class="num">${fmtPct(r.h.red)}</td><td class="num">${fmtMoney(r.h.pen)}</td><td><span class="pen__glyph">${glyph(r, i + 1, conditions)}</span><span class="vh">${names.length ? fill('penCondsSpoken', { list: listText(names) }) : t('penCondsNone')}</span></td></tr>`;
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

// The wide drawings' width: the figures keep their own size (styles.css .pic) instead of stretching across the page.
const PIC_WIDE = 720;
// A figure kept at its drawing's size, or nothing when it has none.
const pic = (fig) => (fig ? html`<div class="pic">${fig}</div>` : '');
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
    chart: imagePair(drawn(draw, PIC_WIDE), fill('cutsAlt', { cap: String(CAP_PCT) })), note: noteLines.join(' '),
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
    chart: imagePair(drawn(draw, PIC_WIDE), fill('measAlt', { ci: CI })), note: fill('measKey', { ci: CI }),
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

function peerFigure({ p, edition, n }) {
  if (!p.rows.some((r) => r.nMeasured > 0)) return '';
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
    chart: imagePair(drawn(draw, PIC_WIDE), fill('peerAlt', { cap: String(CAP_PCT) })), note: t('peerNote'),
    table: {
      columns: [{ name: t('peerColGroup') }, { name: t('peerColDual') }, { name: t('peerColAll'), numeric: true }, { name: t('peerColN'), numeric: true }, { name: t('peerColShare'), numeric: true }, { name: t('peerColMedian'), numeric: true }],
      rows: p.table.map((r) => [
        fill('peerLabel', { n: String(r.peer) }), r.lo === null ? '—' : fill('peerDualRange', { from: pct0(r.lo), to: pct0(r.hi) }), num(count(r.n), r.n), num(count(r.nMeasured), r.nMeasured),
        num(r.shareCut === null ? '—' : pct0(r.shareCut), r.shareCut), num(r.median === null ? '—' : fmtPct(r.median), r.median),
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
    chart: imagePair(drawn(draw, PIC_WIDE), t('typeAlt')), note: t('typeKey'),
    table: {
      columns: [{ name: t('typeColTrait') }, { name: t('typeColGroup') }, { name: t('typeColN'), numeric: true }, { name: t('typeColShare'), numeric: true }],
      rows: ty.table.map((r) => [traitName(r.block), groupName(r.block, r), num(count(r.nMeasured), r.nMeasured), num(fmtPct(r.share, 0), r.share)]),
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
    width, labels: { a: fill('barsKeyFlags', { flags: fmtInt(b.totalFlags) }), b: t('barsKeyDollars') },
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
    chart: imagePair(drawn(draw, PIC_WIDE), t('barsAlt')), note: t('barsNote'),
    table: {
      columns: [{ name: t('barsColCond') }, { name: t('barsColMeasured'), numeric: true }, { name: t('barsColFlags'), numeric: true }, { name: t('barsColFlagShare'), numeric: true }, { name: t('barsColDollars'), numeric: true }, { name: t('barsColDollarShare'), numeric: true }],
      rows: b.table.map((r) => [conditionShort(conditions, r.cond), num(fmtInt(r.measured), r.measured), num(fmtInt(r.flags), r.flags), num(pct0(r.shareOfFlags), r.shareOfFlags), num(fmtMoney(r.dollars), r.dollars), num(pct0(r.shareOfDollars), r.shareOfDollars)]),
    },
  });
}

// picture: view.picture (picture-data.js pictureData); figure: the page's figure counter; edition: the edition's label. The figures are
// numbered in page order: the size of the cuts, the largest cuts, then the share cut by conditions measured, by peer group, by trait,
// and the conditions' share of flags and dollars.
export function picturePart(picture, { figure: nextFigure, edition }) {
  const { largest, conditions } = picture;
  return html`<p class="part__intro">${ledeText(picture)}</p>
${pic(cutsFigure({ sw: picture.size(), edition, n: nextFigure }))}
${largest.length ? html`${penFigure({ rows: largest, conditions, edition, n: nextFigure() })}
<p class="small pen__csv"><a href="${picture.csvHref}" download>${t('penDownload')}</a></p>` : ''}
${pic(measuredFigure({ m: picture.measured(), edition, n: nextFigure }))}
${pic(peerFigure({ p: picture.peers(), edition, n: nextFigure }))}
${pic(typeFigure({ ty: picture.types(), edition, n: nextFigure }))}
${pic(barsFigure({ b: picture.bars(), conditions, edition, n: nextFigure }))}`;
}
