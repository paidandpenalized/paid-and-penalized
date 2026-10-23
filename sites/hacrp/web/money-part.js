// The program page's Part on the money, and the money on the place pages: this site's estimate of the cut, drawn so the
// cliff is felt. Every hospital CMS cut as a tile of its dollars; the hospitals nearest the line as dots sized by the
// cut taken or not; each kind of hospital's share of the cuts against its share of the money; the money by state; the
// three quality programs side by side. Names only in tooltips (DES-25): no list, no
// ranking. Every takeaway is filled from the data the figure draws (money-data.js).
import { acrossLine } from '../../../web/charts/acrossLine.js';
import { columns } from '../../../web/charts/columns.js';
import { drawn, figure, imageOf, imagePair, num } from '../../../web/charts/figure.js';
import { STATE_NAMES, usBubbles } from '../../../web/charts/geo.js';
import { pairBars } from '../../../web/charts/pairBars.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { treemap } from '../../../web/charts/treemap.js';
import { cmsText, count, decimal, dollars, money, noun, pct } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { REDUCTION_TEXT } from './constants.js';
import { groupLabel, kindLabel } from './groups.js';
import { estTag, rangeLine } from './money-figures.js';
import { nearLine, sides, sum } from './money-data.js';
import { fill, t } from './money/copy.js';
import { psec } from './program-figures.js';

// Display constants: the across-the-line figure's window either side of CMS's line, and its largest dot.
export const ACROSS_WINDOW = 0.05;
const ACROSS_R = { narrow: 11, wide: 18 };
// The bill's drawing on a phone and across the page.
const BILL = { narrow: [WIDTH, 420], wide: [1040, 520] };
const PAGE = 1040;

const pct0 = (x) => pct(x, 0);
const p = (key, values) => html`<p>${values ? fill(key, values) : t(key)}</p>`;
const tipOf = (r, extra) => fill('billTip', { name: r.name, city: r.city, state: r.state, money: money(r.cut), ...extra });

// ---------- the bill ----------

const TEACH = ['major', 'minor', 'none'];
export function billFigure(md, { n, source }) {
  const groupOf = (r) => (TEACH.includes(r.master.teach) ? r.master.teach : 'unknown');
  const groups = [...TEACH, 'unknown'].map((key) => {
    const rows = md.cutRows.filter((r) => groupOf(r) === key).sort((a, b) => b.cut - a.cut || (a.ccn < b.ccn ? -1 : 1));
    const value = sum(rows, 'cut');
    return { key, rows, value, label: key === 'unknown' ? t('billUnknown') : groupLabel('teach', key) };
  }).filter((g) => g.rows.length);
  const draw = (width, height, tips) => treemap({
    width, height,
    groups: groups.map((g) => ({ label: g.label, sub: fill('billGroupSub', { n: count(g.rows.length), money: money(g.value) }), value: g.value, tiles: g.rows.map((r) => ({ value: r.cut, tip: tips ? tipOf(r) : null })) })),
  });
  const total = md.headline.money;
  // The group of hospitals with no teaching status is a sliver too small to label: the note names it.
  const unknown = groups.find((g) => g.key === 'unknown');
  const note = !unknown ? t('billNote')
    : unknown.rows.length === 1 ? fill('billNoteUnknownOne', { money: money(unknown.value) })
      : fill('billNoteUnknown', { n: count(unknown.rows.length), money: money(unknown.value) });
  return figure({
    n, source, claimLevel: 'estimate', alt: t('billAlt'), csvName: 'hacrp-dollars-by-teaching', note,
    svg: draw(...BILL.narrow, false), svgWide: draw(...BILL.wide, true),
    takeaway: fill('billTakeaway', { hospitals: noun(md.tenth.n, 'hospital'), share: pct0(md.tenth.money / total), money: money(total) }),
    table: {
      columns: [{ name: t('billColGroup') }, { name: t('billColHospitals'), numeric: true }, { name: t('billColMoney'), numeric: true }, { name: t('billColShareHospitals'), numeric: true }, { name: t('billColShareMoney'), numeric: true }],
      rows: groups.map((g) => [g.label, num(count(g.rows.length), g.rows.length), num(dollars(g.value), g.value), num(pct(g.rows.length / md.cutRows.length, 1), g.rows.length / md.cutRows.length), num(pct(g.value / total, 1), g.value / total)]),
    },
  });
}

// ---------- across the line ----------

// mine: a place's hospitals (a Set of CCNs), drawn in full ink with the rest faint; null on the program page.
export function acrossFigure(md, { n, source, mine = null, name = null }) {
  const near = nearLine(md, ACROSS_WINDOW);
  const { over, under, overMoney, underMoney } = near;
  const window = decimal(ACROSS_WINDOW, 2);
  const dots = near.rows.map((r) => ({
    x: r.total, value: r.atStake, over: r.yes, mine: mine ? mine.has(r.ccn) : false,
    tip: fill('acrossTip', { name: r.name, city: r.city, state: r.state, score: cmsText(String(r.total)), what: t(r.yes ? 'acrossTipCut' : 'acrossTipNot'), money: money(r.atStake) }),
  }));
  const labels = {
    under: [fill('acrossUnder1', { n: count(under.length) }), fill('acrossUnder2', { money: money(underMoney) })],
    over: [fill('acrossOver1', { n: count(over.length) }), fill('acrossOver2', { money: money(overMoney) })],
    line: t('acrossLine'), axis: t('acrossAxis'),
  };
  // The phone's drawing has no tooltips: its dots are too small to point at one, and the page stays light.
  const draw = (width) => acrossLine({ dots: width < 400 ? dots.map((d) => ({ ...d, tip: null })) : dots, domain: [md.line - ACROSS_WINDOW, md.line + ACROSS_WINDOW], line: md.line, labels, values: { under: underMoney, over: overMoney }, width, rMax: width < 400 ? ACROSS_R.narrow : ACROSS_R.wide });
  return figure({
    n, source, claimLevel: 'estimate', alt: t('acrossAlt'), csvName: 'hacrp-dollars-across-the-line', ...drawn(draw, PAGE),
    takeaway: mine ? placeAcrossTakeaway(near, mine, { window, name }) : fill('acrossTakeaway', { window, over: noun(over.length, 'hospital'), overMoney: money(overMoney), under: count(under.length), underMoney: money(underMoney) }),
    table: {
      columns: [{ name: t('acrossColSide') }, { name: t('acrossColHospitals'), numeric: true }, { name: t('acrossColMoney'), numeric: true }],
      rows: [[t('acrossSideUnder'), num(count(under.length), under.length), num(dollars(underMoney), underMoney)], [t('acrossSideOver'), num(count(over.length), over.length), num(dollars(overMoney), overMoney)]],
    },
  });
}

// A place's own hospitals within the window: how many on each side and their dollars.
function placeAcrossTakeaway(near, mine, { window, name }) {
  const own = near.rows.filter((r) => mine.has(r.ccn));
  const { over, under, overMoney, underMoney } = sides(own);
  return fill(own.length === 1 ? 'placeAcrossTakeawayOne' : 'placeAcrossTakeaway', { k: count(own.length), n: count(near.rows.length), window, name, over: count(over.length), overMoney: money(overMoney), under: count(under.length), underMoney: money(underMoney) });
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
  const top = all.reduce((a, b) => (b.shareMoney / b.shareHospitals > a.shareMoney / a.shareHospitals ? b : a));
  const labels = { a: t('sharesKeyHospitals'), b: t('sharesKeyMoney') };
  return figure({
    n, source, claimLevel: 'estimate', alt: t('sharesAlt'), csvName: 'hacrp-dollars-share-by-kind', ...drawn((width) => pairBars({ sections, labels, width })),
    takeaway: fill('sharesTakeaway', { group: fill(`sharesNoun_${top.kind}`, { group: groupLabel(top.kind, top.key) }), shareHospitals: pct0(top.shareHospitals), shareMoney: pct0(top.shareMoney) }),
    table: {
      columns: [{ name: t('billColGroup') }, { name: t('billColHospitals'), numeric: true }, { name: t('billColMoney'), numeric: true }, { name: t('billColShareHospitals'), numeric: true }, { name: t('billColShareMoney'), numeric: true }],
      rows: all.map((g) => [`${kindLabel(g.kind)}: ${groupLabel(g.kind, g.key)}`, num(count(g.n), g.n), num(dollars(g.money), g.money), num(pct(g.shareHospitals, 1), g.shareHospitals), num(pct(g.shareMoney, 1), g.shareMoney)]),
    },
  });
}

// ---------- by state ----------

export function statesFigure(md, { n, source, shapes }) {
  const states = [...md.byState.values()].filter((s) => s.money > 0).sort((a, b) => (a.state < b.state ? -1 : 1));
  const byTotal = Object.fromEntries(states.map((s) => [s.state, { value: s.money, label: fill('statesTipTotal', { money: money(s.money), hospitals: noun(s.cut, 'cut hospital') }) }]));
  const byStay = Object.fromEntries(states.map((s) => [s.state, { value: s.perStay, label: fill('statesTipStay', { perStay: dollars(Math.round(s.perStay)) }) }]));
  const layers = [{ id: 'total', states: byTotal }, { id: 'stay', states: byStay }];
  const art = { svg: usBubbles({ shapes, layers, width: WIDTH, rMax: 22 }), svgWide: usBubbles({ shapes, layers, width: PAGE, rMax: 52 }) };
  // One drawing, two layers of circles: the buttons (shown by the page script) say which one shows; without the script,
  // the dollars.
  const chart = html`<div class="bubbles" data-view="total">
<p class="bubbles__pick" role="group" aria-label="${t('statesToggle')}" hidden><button type="button" class="mtoggle__b" data-view-pick="total" aria-pressed="true">${t('statesTotal')}</button><button type="button" class="mtoggle__b" data-view-pick="stay" aria-pressed="false">${t('statesPerStay')}</button></p>
${imagePair(art, t('statesAlt'))}</div>`;
  const lo = states.reduce((a, b) => (b.money < a.money ? b : a));
  const hi = states.reduce((a, b) => (b.money > a.money ? b : a));
  const loS = states.reduce((a, b) => (b.perStay < a.perStay ? b : a));
  const hiS = states.reduce((a, b) => (b.perStay > a.perStay ? b : a));
  return figure({
    n, source, claimLevel: 'estimate', chart, csvName: 'hacrp-dollars-by-state', note: t('statesNone'),
    takeaway: fill('statesTakeaway', { low: money(lo.money), high: money(hi.money), lowStay: dollars(Math.round(loS.perStay)), highStay: dollars(Math.round(hiS.perStay)) }),
    table: {
      columns: [{ name: t('statesColState') }, { name: t('statesColCut'), numeric: true }, { name: t('statesColMoney'), numeric: true }, { name: t('statesColStays'), numeric: true }, { name: t('statesColPerStay'), numeric: true }],
      rows: states.map((s) => [STATE_NAMES[s.state] ?? s.state, num(count(s.cut), s.cut), num(dollars(s.money), s.money), num(count(s.stays), s.stays), num(dollars(Math.round(s.perStay)), Math.round(s.perStay))]),
    },
  });
}

// ---------- three programs ----------

// Bins of a share of the base payment, BIN wide, from lo to hi (fractions); each hospital in the bin its adjustment
// falls in. sign: -1 for a cut (its bins in the penalty ink), +1 for a bonus.
const BIN = 0.001;
const binned = (values, lo, hi, cls, words) => {
  const k = Math.round((hi - lo) / BIN);
  const bins = Array.from({ length: k }, (_, i) => ({ x0: lo + i * BIN, x1: lo + (i + 1) * BIN, n: 0 }));
  for (const v of values) bins[Math.min(k - 1, Math.max(0, Math.floor((v - lo) / BIN + 1e-9)))].n++;
  return bins.map((b) => ({ ...b, cls: cls(b), tip: fill('threeTip', { hospitals: noun(b.n, 'hospital'), range: words(b) }) }));
};
const pctText = (x) => pct(x, 1);

export function programsFigure(md, { n, source }) {
  const rows = md.rows;
  const hrrpCuts = rows.filter((r) => r.hrrpListed).map((r) => 1 - r.hrrpFactor);
  const vbp = rows.filter((r) => r.vbpListed).map((r) => r.vbpFactor - 1);
  const hrrpHigh = Math.max(...hrrpCuts);
  const [vbpLow, vbpHigh] = [Math.min(...vbp), Math.max(...vbp)];
  const bonus = rows.reduce((s, r) => s + Math.max(0, r.hvbp), 0);
  const penalty = rows.reduce((s, r) => s + Math.min(0, r.hvbp), 0);
  const hrrpBins = binned(hrrpCuts, 0, Math.ceil(hrrpHigh / BIN) * BIN + BIN, (b) => (b.x0 === 0 ? 'chart-col' : 'chart-col chart-col--pen'), (b) => `${pctText(b.x0)}–${pctText(b.x1)}`);
  const vbpLo = Math.floor(vbpLow / BIN) * BIN;
  const vbpBins = binned(vbp, vbpLo, Math.ceil(vbpHigh / BIN) * BIN + BIN, (b) => (b.x0 >= 0 ? 'chart-col chart-col--rew' : 'chart-col chart-col--pen'), (b) => `${pctText(b.x0)}–${pctText(b.x1)}`);
  const cut = md.cutRows.length;
  const hacBins = [
    { x0: -0.0015, x1: 0.0015, n: rows.length - cut, cls: 'chart-col', tip: fill('threeTip', { hospitals: noun(rows.length - cut, 'hospital'), range: pct(0, 0) }) },
    { x0: 0.0085, x1: 0.0115, n: cut, cls: 'chart-col chart-col--pen', tip: fill('threeTip', { hospitals: noun(cut, 'hospital'), range: REDUCTION_TEXT }) },
  ];
  // A tick: whole percents as whole (1%), the rest to a tenth (1.5%).
  const fmt = (x) => pct(x, Math.abs(Math.round(x * 1000)) % 10 ? 1 : 0);
  const hrrpDomain = [0, Math.ceil(hrrpHigh * 100 - 1e-9) / 100];
  const panel = (key, total, shape, sub, bins, domain, axisKey, ticks) => {
    const draw = (width) => columns({ bins, domain, ticks, format: fmt, width, height: 150 });
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
${panel('threeHrrp', hh.hrrp, 'threeHrrpShape', null, hrrpBins, [0, Math.max(hrrpDomain[1], hrrpBins.at(-1).x1)], 'threeHrrpAxis', 4)}
${panel('threeHvbp', hh.hvbp, 'threeHvbpShape', fill('threeHvbpSplit', { bonus: money(bonus), penalty: money(-penalty) }), vbpBins, [vbpLo, Math.ceil(vbpHigh / BIN) * BIN + BIN], 'threeHvbpAxis', 4)}
${panel('threeHac', -hh.money, 'threeHacShape', null, hacBins, [-0.002, 0.012], 'threeHacAxis', [0, 0.01])}
</div>`;
  return figure({
    n, source, claimLevel: 'estimate', chart, csvName: 'hacrp-dollars-three-programs', note: t('threeNote'),
    takeaway: fill('threeTakeaway', { hrrpLow: pct(0, 0), hrrpHigh: pctText(hrrpHigh), hrrp: money(-hh.hrrp), vbpLow: pctText(vbpLow), vbpHigh: `+${pctText(vbpHigh)}`, hvbp: money(hh.hvbp), zero: pct(0, 0), pct: REDUCTION_TEXT, hac: money(hh.money) }),
    table: {
      columns: [{ name: t('threeColProgram') }, { name: t('threeColHospitals'), numeric: true }, { name: t('threeColMoney'), numeric: true }],
      rows: [
        [t('threeHrrp'), num(count(hrrpCuts.filter((x) => x > 0).length), hrrpCuts.filter((x) => x > 0).length), num(dollars(hh.hrrp), hh.hrrp)],
        [t('threeHvbp'), num(count(vbp.filter((x) => x !== 0).length), vbp.filter((x) => x !== 0).length), num(dollars(hh.hvbp), hh.hvbp)],
        [t('threeHac'), num(count(cut), cut), num(dollars(-hh.money), -hh.money)],
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

// The Part's intro: the national estimate, with the hospitals it leaves out named in the count.
export const moneyPartIntro = (md, fy) => fill('moneyPartIntro', { fy: String(fy), money: money(md.headline.money), cut: count(md.headline.cut), yes: count(md.headline.yes), missing: count(md.headline.yesUnestimated), pct: REDUCTION_TEXT });

// The summary form's field: the national estimate, its tag, the hospitals it covers and its range.
export const summaryMoneyField = (md) => ({
  label: t('summaryMoney'),
  value: html`<span class="money__field money__field--cut">${money(md.headline.money)}</span> ${estTag()}`,
  as: 'div', size: 'big', fieldCls: 'f-money',
  note: html`${fill('summaryMoneyNote', { cut: count(md.headline.cut), yes: count(md.headline.yes) })}${rangeLine()}`,
});
