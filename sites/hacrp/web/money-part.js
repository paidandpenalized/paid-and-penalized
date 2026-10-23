// The program page's Part on the money, and the money on the place pages: this site's estimate of the cut, drawn so the
// cliff is felt. Every hospital CMS cut as a tile of its dollars; the hospitals nearest the line as dots sized by the
// cut taken or not; each kind of hospital's share of the cuts against its share of the money; the money by state; the
// three quality programs side by side. Names only in tooltips (DES-25): no list, no ranking. Every takeaway is filled from
// the data the figure draws (money-data.js).
import { acrossLine } from '../../../web/charts/acrossLine.js';
import { greatest, least } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { columns } from '../../../web/charts/columns.js';
import { PAGE, drawn, figure, imageOf, imagePair, num } from '../../../web/charts/figure.js';
import { STATE_NAMES, hasBubble, usBubbles } from '../../../web/charts/geo.js';
import { pairBars } from '../../../web/charts/pairBars.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { treemap } from '../../../web/charts/treemap.js';
import { paraOf } from '../../../web/render/components.js';
import { cmsText, count, decimal, dollars, listText, money, moneyRange, noun, pct } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { REDUCTION_PCT, REDUCTION_TEXT } from './constants.js';
import { groupLabel, kindLabel } from './groups.js';
import { estTag, rangeLine } from './money-figures.js';
import { countBins } from './compare.js';
import { nearLine, sides, sum } from './money-data.js';
import { fill, t } from './money/copy.js';
import { psec } from './program-figures.js';

// Display constant: the across-the-line figure's window either side of CMS's line.
export const ACROSS_WINDOW = 0.05;

const pct0 = (x) => pct(x, 0);
const p = paraOf(fill, t);
const tipOf = (r) => fill('billTip', { name: r.name, city: r.city, state: r.state, money: money(r.cut) });

// A figure's table cells: the text shown and the raw value kept (a count, whole dollars, a share to a tenth of a percent).
const cnt = (n) => num(count(n), n);
const usd = (x) => num(dollars(x), x);
const share = (x) => num(pct(x, 1), x);
// The columns and a row of the two tables that list groups of cut hospitals (the teaching groups, each kind of hospital).
const GROUP_COLUMNS = [{ name: t('groupColGroup') }, { name: t('groupColHospitals'), numeric: true }, { name: t('groupColMoney'), numeric: true }, { name: t('groupColShareHospitals'), numeric: true }, { name: t('groupColShareMoney'), numeric: true }];
const groupRow = (label, hospitals, cut, shareHospitals, shareMoney) => [label, cnt(hospitals), usd(cut), share(shareHospitals), share(shareMoney)];

// ---------- the bill ----------

const TEACH = ['major', 'minor', 'none'];
export function billFigure(md, { n, source }) {
  const groupOf = (r) => (TEACH.includes(r.master.teach) ? r.master.teach : 'unknown');
  const groups = [...TEACH, 'unknown'].map((key) => {
    const rows = md.cutRows.filter((r) => groupOf(r) === key).sort((a, b) => b.cut - a.cut || (a.ccn < b.ccn ? -1 : 1));
    const value = sum(rows, 'cut');
    return { key, rows, value, label: key === 'unknown' ? t('billUnknown') : groupLabel('teach', key) };
  }).filter((g) => g.rows.length);
  const tree = groups.map((g) => ({ label: g.label, sub: fill('billGroupSub', { n: count(g.rows.length), money: money(g.value) }), value: g.value, tiles: g.rows.map((r) => ({ value: r.cut, tip: tipOf(r) })) }));
  const draw = (width) => treemap({ width, groups: tree });
  const total = md.headline.money;
  // The group of hospitals with no teaching status is a sliver too small to label: the note names it.
  const unknown = groups.find((g) => g.key === 'unknown');
  const note = !unknown ? t('billNote')
    : unknown.rows.length === 1 ? fill('billNoteUnknownOne', { money: money(unknown.value) })
      : fill('billNoteUnknown', { n: count(unknown.rows.length), money: money(unknown.value) });
  return figure({
    n, source, claimLevel: 'estimate', alt: t('billAlt'), csvName: 'hacrp-dollars-by-teaching', note,
    ...drawn(draw, PAGE),
    takeaway: fill('billTakeaway', { hospitals: noun(md.tenth.n, 'hospital'), share: pct0(md.tenth.money / total), money: money(total) }),
    table: {
      columns: GROUP_COLUMNS,
      rows: groups.map((g) => groupRow(g.label, g.rows.length, g.value, g.rows.length / md.cutRows.length, g.value / total)),
    },
  });
}

// ---------- across the line ----------

// mine: a place's hospitals (a Set of CCNs), drawn in full ink with the rest faint; null on the program page.
export function acrossFigure(md, { n, source, mine = null, name = null }) {
  const near = nearLine(md, ACROSS_WINDOW);
  const { over, under, overMoney, underMoney } = near;
  const window = decimal(ACROSS_WINDOW, 2);
  // On a place's page only its own hospitals name themselves (a tooltip and a keyboard stop each); the nation's others are
  // faint dots. A phone's drawing names none (acrossLine).
  const dots = near.rows.map((r) => ({
    x: r.total, value: r.atStake, over: r.yes, mine: mine ? mine.has(r.ccn) : false,
    tip: mine && !mine.has(r.ccn) ? null : fill('acrossTip', { name: r.name, city: r.city, state: r.state, score: cmsText(String(r.total)), what: t(r.yes ? 'acrossTipCut' : 'acrossTipNot'), money: money(r.atStake) }),
  }));
  const labels = {
    under: [fill('acrossUnder1', { n: count(under.length) }), fill('acrossUnder2', { money: money(underMoney) })],
    over: [fill('acrossOver1', { n: count(over.length) }), fill('acrossOver2', { money: money(overMoney) })],
    line: t('acrossLine'), axis: t('acrossAxis'),
  };
  const draw = (width) => acrossLine({ dots, domain: [md.line - ACROSS_WINDOW, md.line + ACROSS_WINDOW], line: md.line, labels, values: { under: underMoney, over: overMoney }, width });
  return figure({
    n, source, claimLevel: 'estimate', alt: t('acrossAlt'), csvName: 'hacrp-dollars-across-the-line', ...drawn(draw, PAGE),
    takeaway: mine ? placeAcrossTakeaway(near, mine, { window, name }) : fill('acrossTakeaway', { window, over: noun(over.length, 'hospital'), overMoney: money(overMoney), under: count(under.length), underMoney: money(underMoney) }),
    table: {
      columns: [{ name: t('acrossColSide') }, { name: t('acrossColHospitals'), numeric: true }, { name: t('acrossColMoney'), numeric: true }],
      rows: [[t('acrossSideUnder'), cnt(under.length), usd(underMoney)], [t('acrossSideOver'), cnt(over.length), usd(overMoney)]],
    },
  });
}

// A place's own hospitals within the window: how many on each side and their dollars. All on one side, only that side.
function placeAcrossTakeaway(near, mine, { window, name }) {
  const own = near.rows.filter((r) => mine.has(r.ccn));
  const { over, under, overMoney, underMoney } = sides(own);
  const [n, k] = [count(near.rows.length), count(own.length)];
  if (!under.length) return fill('placeAcrossTakeawayOver', { n, window, name, over: noun(over.length, 'cut hospital'), overMoney: money(overMoney) });
  if (!over.length) return fill('placeAcrossTakeawayUnder', { n, window, name, under: noun(under.length, 'hospital not cut', 'hospitals not cut'), underMoney: money(underMoney) });
  return fill('placeAcrossTakeaway', { k, n, window, name, over: count(over.length), overMoney: money(overMoney), under: count(under.length), underMoney: money(underMoney) });
}

// ---------- shares ----------

const SHARE_KINDS = ['teach', 'beds', 'own', 'urban'];
export function sharesFigure(md, { n, source }) {
  const kinds = md.byKind.filter((k) => SHARE_KINDS.includes(k.kind));
  const sections = kinds.map((k) => ({
    heading: kindLabel(k.kind),
    rows: k.groups.map((g) => {
      const label = groupLabel(k.kind, g.key);
      return {
        label, a: g.shareHospitals, b: g.shareMoney, aText: pct0(g.shareHospitals), bText: pct0(g.shareMoney),
        tipA: fill('sharesTipHospitals', { group: label, n: count(g.n), share: pct0(g.shareHospitals) }),
        tipB: fill('sharesTipMoney', { group: label, money: money(g.money), share: pct0(g.shareMoney) }),
      };
    }),
  }));
  // The takeaway: the group whose share of the money most outruns its share of the hospitals.
  const all = kinds.flatMap((k) => k.groups.map((g) => ({ kind: k.kind, ...g })));
  if (!all.length) throw new RangeError('sharesFigure: no group of cut hospitals to draw');
  const top = greatest(all, (g) => g.shareMoney / g.shareHospitals);
  const labels = { a: t('sharesKeyHospitals'), b: t('sharesKeyMoney') };
  return figure({
    n, source, claimLevel: 'estimate', alt: t('sharesAlt'), csvName: 'hacrp-dollars-share-by-kind', ...drawn((width) => pairBars({ sections, labels, width })),
    takeaway: fill('sharesTakeaway', { group: fill(`sharesNoun_${top.kind}`, { group: groupLabel(top.kind, top.key) }), shareHospitals: pct0(top.shareHospitals), shareMoney: pct0(top.shareMoney) }),
    table: {
      columns: GROUP_COLUMNS,
      rows: all.map((g) => groupRow(`${kindLabel(g.kind)}: ${groupLabel(g.kind, g.key)}`, g.n, g.money, g.shareHospitals, g.shareMoney)),
    },
  });
}

// ---------- by state ----------

export function statesFigure(md, { n, source, shapes }) {
  // Each state's cut per Medicare stay, to the whole dollar, once (the drawing's tooltips, the takeaway and the table say it).
  const states = [...md.byState.values()].filter((s) => s.money > 0).sort((a, b) => (a.state < b.state ? -1 : 1)).map((s) => ({ ...s, stay: Math.round(s.perStay) }));
  const byTotal = Object.fromEntries(states.map((s) => [s.state, { value: s.money, label: fill('statesTipTotal', { money: money(s.money), hospitals: noun(s.cut, 'cut hospital') }) }]));
  const byStay = Object.fromEntries(states.map((s) => [s.state, { value: s.perStay, label: fill('statesTipStay', { perStay: dollars(s.stay) }) }]));
  const layers = [{ id: 'total', states: byTotal }, { id: 'stay', states: byStay }];
  const art = drawn((width) => usBubbles({ shapes, layers, width }), PAGE);
  // One drawing, two layers of circles: the buttons (shown by the page script) say which one shows; without the script,
  // the dollars.
  const chart = html`<div class="bubbles" data-view="total">
<div class="mtoggle bubbles__pick" role="group" aria-label="${t('statesToggle')}" hidden><button type="button" class="mtoggle__b" data-view="total" aria-pressed="true">${t('statesTotal')}</button><button type="button" class="mtoggle__b" data-view="stay" aria-pressed="false">${t('statesPerStay')}</button></div>
${imagePair(art, t('statesAlt'))}</div>`;
  if (!states.length) throw new RangeError('statesFigure: no state with estimated money to draw');
  // A place with money the map has no circle for (Puerto Rico, if its hospitals were cut) is in the table; the note says so.
  const offMap = states.filter((s) => !hasBubble(shapes, s.state)).map((s) => STATE_NAMES[s.state] ?? s.state);
  const note = offMap.length ? `${t('statesNone')} ${fill('statesOffMap', { places: listText(offMap) })}` : t('statesNone');
  const [lo, hi] = [least(states, (s) => s.money), greatest(states, (s) => s.money)];
  const [loS, hiS] = [least(states, (s) => s.perStay), greatest(states, (s) => s.perStay)];
  return figure({
    n, source, claimLevel: 'estimate', chart, csvName: 'hacrp-dollars-by-state', note,
    takeaway: fill('statesTakeaway', { low: money(lo.money), high: money(hi.money), lowStay: dollars(loS.stay), highStay: dollars(hiS.stay) }),
    table: {
      columns: [{ name: t('statesColState') }, { name: t('statesColCut'), numeric: true }, { name: t('statesColMoney'), numeric: true }, { name: t('statesColStays'), numeric: true }, { name: t('statesColPerStay'), numeric: true }],
      rows: states.map((s) => [STATE_NAMES[s.state] ?? s.state, cnt(s.cut), usd(s.money), cnt(s.stays), usd(s.stay)]),
    },
  });
}

// ---------- three programs ----------

// A panel's columns, over shares of the base payment. Exactly zero (no cut, no adjustment) is a column of its own, one bin
// wide and centered on 0; every other share goes in a bin BIN wide, the bins of cuts below 0 and of bonuses above it,
// so no cut or bonus is counted as none. Each hospital is in the bin its share falls in (a value a hair under an edge
// by float error, such as 1.003 − 1, counts in the bin above it). The zero column takes room on the axis: every other
// value stands half a bin out from 0, and the ticks name the shares they stand for. cls: a bin's class; reach: the
// share the axis runs to at least.
const BIN = 0.001;
const GAP = BIN / 2;
const EDGE_SLACK = 1e-12;
const pctText = (x) => pct(x, 1);
// A column of n hospitals at a range of shares, drawn from x0 to x1 on the axis.
const column = (x0, x1, n, cls, range) => ({ x0, x1, n, cls, tip: fill('threeTip', { hospitals: noun(n, 'hospital'), range }) });
const seat = (x, side = Math.sign(x)) => x + side * GAP;
// A tick: whole percents as whole (1%), the rest to a tenth (1.5%).
const tickText = (x) => pct(x, Math.abs(Math.round(x * 1000)) % 10 ? 1 : 0);
function binned(values, cls, reach = 0) {
  const nonzero = values.filter((x) => x !== 0);
  // Edges at whole multiples of BIN, so 0 is an edge exactly; one bin past the largest value.
  const first = Math.min(0, Math.floor(Math.min(...nonzero) / BIN));
  const last = Math.max(0, Math.ceil(Math.max(...nonzero) / BIN)) + 1;
  const edges = Array.from({ length: last - first + 1 }, (_, i) => (first + i) * BIN);
  const counts = countBins(nonzero, edges.map((e) => e - EDGE_SLACK));
  const columns = counts.map((n, i) => {
    const [x0, x1] = [edges[i], edges[i + 1]];
    const side = x0 >= 0 ? 1 : -1;
    // Zero is its own column, so a bin that touches it says it stops short of it.
    const range = x0 === 0 ? fill('threeRangeOverZero', { lo: pct(0, 0), hi: pctText(x1) })
      : x1 === 0 ? fill('threeRangeUnderZero', { lo: pctText(x0), hi: pct(0, 0) })
        : `${pctText(x0)}–${pctText(x1)}`;
    return column(seat(x0, side), seat(x1, side), n, cls(x0), range);
  });
  const none = values.length - nonzero.length;
  // In axis order, so the keyboard and a screen reader meet the columns left to right.
  columns.push(column(-GAP, GAP, none, 'chart-col', pct(0, 0)));
  columns.sort((a, b) => a.x0 - b.x0);
  const top = Math.max(reach, edges.at(-1));
  const ticks = scaleLinear().domain([edges[0], top]).ticks(4);
  const labels = new Map(ticks.map((x) => [seat(x), tickText(x)]));
  return { columns, domain: [Math.min(-GAP, seat(edges[0])), seat(top)], ticks: [...labels.keys()], format: (x) => labels.get(x) };
}

// The HAC panel: a column at 0 (no cut) and one at the reduction, a share of the whole payment, each three bins wide, with
// a half bin of room around them.
export function hacAxis(reductionPct) {
  const cutAt = reductionPct / 100;
  const half = 1.5 * BIN;
  return { columns: [[-half, half], [cutAt - half, cutAt + half]], domain: [-half - GAP, cutAt + half + GAP], ticks: [0, cutAt] };
}

export function programsFigure(md, { n, source }) {
  const rows = md.rows;
  const hrrpCuts = rows.filter((r) => r.hrrpListed).map((r) => 1 - r.hrrpFactor);
  const vbp = rows.filter((r) => r.vbpListed).map((r) => r.vbpFactor - 1);
  const hrrpHigh = Math.max(...hrrpCuts);
  const [vbpLow, vbpHigh] = [Math.min(...vbp), Math.max(...vbp)];
  const [hrrpN, vbpN] = [hrrpCuts.filter((x) => x > 0).length, vbp.filter((x) => x !== 0).length];
  const bonus = rows.reduce((s, r) => s + Math.max(0, r.hvbp), 0);
  const penalty = rows.reduce((s, r) => s + Math.min(0, r.hvbp), 0);
  // Readmissions only cuts (the axis runs to a whole percent); value-based cuts below 0 and pays above it.
  const hrrp = binned(hrrpCuts, () => 'chart-col chart-col--pen', Math.ceil(hrrpHigh * 100 - 1e-9) / 100);
  const vbpBins = binned(vbp, (x0) => (x0 >= 0 ? 'chart-col chart-col--rew' : 'chart-col chart-col--pen'));
  const cut = md.cutRows.length;
  const hac = hacAxis(REDUCTION_PCT);
  const [hacNone, hacCut] = hac.columns;
  const hacBins = [column(...hacNone, rows.length - cut, 'chart-col', pct(0, 0)), column(...hacCut, cut, 'chart-col chart-col--pen', REDUCTION_TEXT)];
  const panel = ({ key, total, shape, sub = null, bins, domain, axisKey, ticks, format = tickText }) => {
    const draw = (width) => columns({ bins, domain, ticks, format, width, height: 150 });
    return html`<div class="three__p">
<p class="three__name">${t(key)}</p>
<p class="three__money${total < 0 ? ' three__money--pen' : ''}">${money(total)}</p>
<p class="three__shape">${t(shape)}${sub ? html` · <span>${sub}</span>` : ''}</p>
${imageOf(draw(WIDTH), null, null)}
<p class="three__axis">${t(axisKey)}</p>
</div>`;
  };
  const hh = md.headline;
  const chart = html`<div class="three">
${panel({ key: 'threeHrrp', total: hh.hrrp, shape: 'threeHrrpShape', bins: hrrp.columns, domain: hrrp.domain, axisKey: 'threeHrrpAxis', ticks: hrrp.ticks, format: hrrp.format })}
${panel({ key: 'threeHvbp', total: hh.hvbp, shape: 'threeHvbpShape', sub: fill('threeHvbpSplit', { bonus: money(bonus), penalty: money(-penalty) }), bins: vbpBins.columns, domain: vbpBins.domain, axisKey: 'threeHvbpAxis', ticks: vbpBins.ticks, format: vbpBins.format })}
${panel({ key: 'threeHac', total: -hh.money, shape: 'threeHacShape', bins: hacBins, domain: hac.domain, axisKey: 'threeHacAxis', ticks: hac.ticks })}
</div>`;
  return figure({
    n, source, claimLevel: 'estimate', chart, csvName: 'hacrp-dollars-three-programs', note: t('threeNote'),
    takeaway: fill('threeTakeaway', { hrrpLow: pct(0, 0), hrrpHigh: pctText(hrrpHigh), hrrp: money(-hh.hrrp), vbpLow: pctText(vbpLow), vbpHigh: pct(vbpHigh, 1, { sign: true }), hvbp: money(hh.hvbp), zero: pct(0, 0), pct: REDUCTION_TEXT, hac: money(hh.money) }),
    table: {
      columns: [{ name: t('threeColProgram') }, { name: t('threeColHospitals'), numeric: true }, { name: t('threeColMoney'), numeric: true }],
      rows: [
        [t('threeHrrp'), cnt(hrrpN), usd(hh.hrrp)],
        [t('threeHvbp'), cnt(vbpN), usd(hh.hvbp)],
        [t('threeHac'), cnt(cut), usd(-hh.money)],
      ],
    },
  });
}

// ---------- the Part ----------

// The Part's sections, each beside (or over) its figure. md: moneyData() with at least one cut hospital estimated
// (programPage leaves the Part out without one; a test's slice of the file may have none).
export function moneyPart({ md, source, shapes, figure: fig }) {
  const window = decimal(ACROSS_WINDOW, 2);
  const near = nearLine(md, ACROSS_WINDOW);
  const bill = billFigure(md, { n: fig(), source });
  const across = near.over.length && near.under.length ? acrossFigure(md, { n: fig(), source }) : null;
  const shares = sharesFigure(md, { n: fig(), source });
  const states = shapes ? statesFigure(md, { n: fig(), source, shapes }) : null;
  const three = programsFigure(md, { n: fig(), source });
  return html`${psec({ id: 'bill', wide: true, heading: t('billHeading'), text: html`${p('billText')}${p('billText2')}`, figure: bill })}
${across ? psec({ id: 'across', wide: true, heading: t('acrossHeading'), text: html`${p('acrossText', { window })}${p('acrossText2')}`, figure: across }) : ''}
${psec({ id: 'shares', heading: t('sharesHeading'), text: p('sharesText'), figure: shares })}
${states ? psec({ id: 'states', wide: true, heading: t('statesHeading'), text: p('statesText'), figure: states }) : ''}
${psec({ id: 'three', wide: true, heading: t('threeHeading'), text: p('threeText'), figure: three })}`;
}

// The Part's intro: the national estimate and its likely range, with the hospitals it leaves out named in the count.
export const moneyPartIntro = (md, fy) => fill('moneyPartIntro', { fy: String(fy), money: money(md.headline.money), range: moneyRange(...md.headline.range), cut: count(md.headline.cut), yes: count(md.headline.yes), missing: count(md.headline.yesUnestimated), pct: REDUCTION_TEXT });

// The summary form's field: the national estimate, its tag, the hospitals it covers and its range.
export const summaryMoneyField = (md) => ({
  label: t('summaryMoney'),
  value: html`<span class="money__field money__field--cut">${money(md.headline.money)}</span> ${estTag()}`,
  as: 'div', size: 'big', fieldCls: 'f-money',
  note: html`${fill('summaryMoneyNote', { cut: count(md.headline.cut), yes: count(md.headline.yes) })}${rangeLine(md.headline.range, { estimate: md.headline.money })}`,
});
