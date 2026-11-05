// Step 5's figure on the program page's "How it works" Part [WF-12]: the parts of the example hospital's cut against the cap,
// under Worksheet R. Focus and context: the worksheet's six lines as rows of a waterfall on a zoomed scale that names itself (every
// part of zero says why), then the sum redrawn on the cap's own scale, 0 to 3%, against the cap, with beams showing where the zoom
// sits. Two scales, each labeled; no broken axis. A phone stacks the rows, each label over its bar. Drawn by the same code on the
// server and in the browser (client/worksheet.js redraws it when the hospital box swaps the sheet), from worksheetRows' output.
import { CAP, CAP_PCT, MIN_DISCHARGES } from '../../../../engine/js/hrrp/formula.js';
import { drawn, figure, num } from '../../../../web/charts/figure.js';
import { textWidth } from '../../../../web/charts/text.js';
import { waterfall } from '../../../../web/charts/waterfall.js';
import { capitalize, pct, spelled } from '../../../../web/render/format.js';
import { factor4, fmtPct, points, ratio } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { inSentence } from '../wording.js';
import { waterfallData } from '../worksheet.js';

// The wide drawing's width: the figure sits under the sheet at about this width, not the page's.
export const WF_WIDE = 720;
const LABEL_PX = 12;
// The wide label column's room past the longest label.
const LABEL_PAD = 12;
// A phone's zoomed axis labels at most this many ticks.
const PHONE_TICKS = 4;

// The sum's share of the cap: whole percents, one decimal under ten percent (a small sum is "0.5%", not "0%"), "under 0.1%" for a
// share that would still print as zero.
export const capShare = (share) => {
  if (share > 0 && share < 0.001) return fill('wfShareTiny', { tiny: '0.1%' });
  return pct(share, share < 0.1 ? 1 : 0);
};

// A part or a sum in percent of base payments to three decimals, as Worksheet R prints line 6: 0.00126 is "0.126%".
const pointsText = (v) => `${points(v)}%`;

// Why a part of zero is zero, in words, for a row's note (short: a phone, where the note shares the label's line).
function reasonOf(p, short) {
  if (p.zero === 'none') return t('wfRowNone');
  if (p.zero === 'few') return fill(short ? 'wfRowFewShort' : 'wfRowFew', { n: String(p.n), min: String(MIN_DISCHARGES) });
  if (p.zero === 'below') return short ? t('wfRowBelowShort') : fill('wfRowBelow', { err: ratio(p.err), med: ratio(p.med) });
  return p.why;
}

// The takeaway: how many conditions add and how much, the share of the cap, the largest part's share of the sum. wf: waterfallData().
export function waterfallTakeaway(wf) {
  const { counted, biggest, sum, binds } = wf;
  if (counted === 0) return fill('wfTakeawayNone', { sum: pointsText(sum), factor: factor4(wf.factor) });
  const [name, cap, share] = [inSentence(biggest.label), String(CAP_PCT), capShare(wf.ofCap)];
  const count = capitalize(spelled(counted));
  const big = pct(biggest.part / sum, 0);
  if (counted === 1) return binds ? fill('wfTakeawayCappedOne', { biggest: name, sum: pointsText(sum), cap }) : fill('wfTakeawayOne', { biggest: name, sum: pointsText(sum), share, cap });
  return binds ? fill('wfTakeawayCapped', { count, sum: pointsText(sum), cap, biggest: name, big }) : fill('wfTakeaway', { count, sum: pointsText(sum), share, cap, biggest: name, big });
}

// The zoomed scale's tick values: every step up to the top, or every few steps so a phone's axis is not crowded.
function zoomTicks({ step, top }, narrow) {
  const every = narrow ? Math.ceil(top / step / PHONE_TICKS) : 1;
  const out = [];
  for (let i = 0; i * step <= top + 1e-9; i += every) out.push(Number((i * step).toFixed(6)));
  return out;
}

// One drawing of the waterfall at a width. wf: waterfallData().
function draw({ wf, width, id }) {
  const narrow = width < 400;
  const { zoom } = wf;
  const rows = wf.parts.map((p) => ({
    label: p.label, value: p.part, valueText: p.part > 0 ? pointsText(p.part) : '0', pen: p.part > 0,
    note: p.part > 0 ? null : reasonOf(p, narrow),
    tip: p.part > 0 ? fill('wfTipPart', { cond: p.label, part: pointsText(p.part), running: pointsText(p.running) }) : fill('wfTipZero', { cond: p.label, reason: reasonOf(p, false) }),
  }));
  const shareText = capShare(wf.ofCap);
  const max = Math.max(CAP, wf.sum);
  const capTicks = Array.from({ length: Math.floor(max * 100 + 1e-9) + 1 }, (_, i) => i / 100);
  const names = [...rows.map((r) => r.label), t('wfCapTitle')];
  return waterfall({
    id, width, domain: [0, zoom.top], stacked: narrow, ticks: zoomTicks(zoom, narrow), format: (v) => fmtPct(v * 100, 1),
    labelW: Math.ceil(Math.max(...names.map((n) => textWidth(n, LABEL_PX))) + LABEL_PAD), rows,
    total: { label: fill('wfSum', { n: '7' }), value: wf.sum, valueText: pointsText(wf.sum), pen: true, tip: fill('wfTipSum', { sum: pointsText(wf.sum), share: shareText, cap: String(CAP_PCT) }) },
    caption: fill('wfCaption', { min: fmtPct(0, 1), max: fmtPct(zoom.top * 100, 1) }),
    cap: {
      value: CAP, max, title: t(narrow ? 'wfCapTitlePhone' : 'wfCapTitle'), label: fill('wfCapLabel', { cap: String(CAP_PCT) }), share: shareText,
      tip: fill('wfTipCap', { sum: pointsText(wf.sum), share: shareText, cap: String(CAP_PCT) }), ticks: capTicks, format: (v) => fmtPct(v * 100, 0),
    },
  });
}

// The figure: rows: worksheetRows(); conditions: { key, short }; n: its number; edition: the edition's label.
export function waterfallFigure({ rows, conditions, n, edition }) {
  const wf = waterfallData(rows, conditions);
  const none = (text) => num(text, null);
  const tableRows = [
    ...wf.parts.map((p) => [p.label, num(points(p.part), p.part), num(points(p.running), p.running), p.part > 0 ? '' : reasonOf(p, false)]),
    [fill('wfSum', { n: '7' }), none(''), num(points(wf.sum), wf.sum), ''],
    [fill('wfCap', { cap: String(CAP_PCT) }), none(''), num(points(CAP), CAP), ''],
    [fill('wfFactor', { n: '9' }), none(''), num(factor4(wf.factor), wf.factor), ''],
  ];
  return figure({
    n, source: fill('wfSource', { edition, n: '6' }), alt: t('wfAlt'), claimLevel: 'recomputed', csvName: 'hrrp-worksheet-parts',
    takeaway: waterfallTakeaway(wf),
    note: wf.binds ? fill('wfCapNoteOver', { cap: String(CAP_PCT), factor: factor4(wf.factor) }) : fill('wfCapNote', { share: capShare(wf.ofCap), factor: factor4(wf.factor) }),
    ...drawn((width) => draw({ wf, width, id: width === WF_WIDE ? 'wf-wide' : 'wf' }), WF_WIDE),
    table: { columns: [{ name: t('wfColCond') }, { name: t('wfColPart'), numeric: true }, { name: t('wfColRunning'), numeric: true }, { name: t('wfColWhy') }], rows: tableRows },
  });
}
