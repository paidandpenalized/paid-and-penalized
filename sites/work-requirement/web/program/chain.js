// Step 2's figure, H3's chain: four links on one dollar scale, from the Medicaid revenue at risk to the change in
// operating income, for every scenario hospital together; and the worksheet each link opens (W1's twelve lines, by
// link). Shared by the build (how.js) and the browser (client/how.js redraws the links' drawings and the worksheets'
// lines when the case or the use rate moves), so both draw from the same arithmetic. Pure: no DOM, file or clock.
//
// A view: { totals (model.js's, by case), scenario (the case shown), use (the use rate, a multiple), how (how.js
// howModel: { fy, params: { uninsured_share, care_still_used, use_max }, declines: { case: [low, high] } }) }.
import { r2 } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { fillCopy } from '../../../../web/render/components.js';
import { count, decimal, money, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { scenWord } from './ranges.js';

// The worksheet's twelve lines, in order: a line's number is its place here. Each link holds a run of them.
const LINE = Object.fromEntries(['revenue', 'share', 'atRisk', 'decline', 'use', 'lost', 'ratio', 'cost', 'uninsured', 'stillUsed', 'still', 'income'].map((k, i) => [k, i + 1]));

// The four links: the totals key each draws (its value), and the worksheet lines it opens.
export const LINKS = Object.freeze([
  { n: 1, key: 'at_risk', lines: [LINE.revenue, LINE.atRisk] },
  { n: 2, key: 'lost', lines: [LINE.decline, LINE.lost] },
  { n: 3, key: 'lost_cost', lines: [LINE.ratio, LINE.stillUsed] },
  { n: 4, key: 'income_change', lines: [LINE.still, LINE.income] },
]);

const linkOf = (n) => LINKS[n - 1];

// Figure 2's table rows: the label's copy key, the totals key and its sign as the table prints it (revenue lost as a loss).
export const TABLE_ROWS = Object.freeze([['rowAtRisk', 'at_risk', 1], ['rowLost', 'lost', -1], ['rowCost', 'lost_cost', 1], ['rowStill', 'added_uncompensated', 1],
  ['rowNotGiven', 'care_avoided', 1], ['rowOther', 'other_coverage', 1], ['rowIncome', 'income_change', 1]]);
export const statusText = ({ scenario, use }) => fill('chainStatus', { scenario: scenWord(scenario), use: pct(use, 0) });
export const linkValue = (n, { totals, scenario }) => totals[scenario][linkOf(n).key];

// ---------- the drawings ----------

// The two drawings of each link: the phone's (the kit's 300 across) and the wide one, about the stage's figure column at
// 1280 and 1440. L, R: the margins (styles.css sizes each drawing's type).
const DRAW = { narrow: { width: 300, L: 2, R: 4 }, wide: { width: 400, L: 2, R: 4 } };
// The bars' heights: a link's bar, link 4's three steps and its result.
const BAR = 28;
const STEP = 11;
// How far link 4's band runs past its result bar, above and below.
const BAND_OUT = 4;

// The dollar scale every link shares: zero at the left margin, the revenue at risk (the largest amount any link draws,
// in any case at any use rate) at the right.
const scaleOf = (geo, top) => (v) => geo.L + (Math.min(Math.abs(v), top) / top) * (geo.width - geo.L - geo.R);
const topOf = (totals) => Math.max(...SCENARIOS.map((s) => totals[s].at_risk));

// Round ticks under the top: a step of 1, 2 or 5 times a power of ten, about five of them.
function ticksOf(top) {
  const raw = top / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v <= top + 1e-6 * top; v += step) out.push(v);
  return out;
}
const tickText = (v) => (v === 0 ? '$0' : money(v).replace(/\.0(?=[KMB]$)/, ''));

const grid = (x, ticks, h) => ticks.map((v) => html`<line class="chart-grid" x1="${r2(x(v))}" x2="${r2(x(v))}" y1="0" y2="${h}"/>`);
const rect = (cls, x0, x1, y, h) => html`<rect class="${cls}" x="${r2(Math.min(x0, x1))}" y="${y}" width="${r2(Math.max(0, Math.abs(x1 - x0)))}" height="${h}"/>`;
const svg = (drawing, h, alt, body) => html`<svg class="chart chart--chain" role="img" aria-label="${alt}" data-fit="${drawing}" viewBox="0 0 ${DRAW[drawing].width} ${h}" width="100%" focusable="false" style="--vb: ${DRAW[drawing].width}">${body}</svg>`;

const vals = (totals, key) => SCENARIOS.map((s) => totals[s][key]);
const hatchDefs = (id) => html`<defs><pattern id="${id}" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>`;

// The axis over the links: the tick labels at the shared scale.
function axisDrawing(drawing, view) {
  const geo = DRAW[drawing];
  const top = topOf(view.totals);
  const x = scaleOf(geo, top);
  const ticks = ticksOf(top);
  return html`<svg class="chart chart--chain" aria-hidden="true" data-fit="${drawing}" viewBox="0 0 ${geo.width} 18" width="100%" focusable="false" style="--vb: ${geo.width}">${ticks.map((v, i) => html`<text class="chart-axis__label" x="${r2(x(v))}" y="12" text-anchor="${i === 0 ? 'start' : i === ticks.length - 1 && x(v) > geo.width - 20 ? 'end' : 'middle'}">${tickText(v)}</text><line class="chart-axis__tick" x1="${r2(x(v))}" x2="${r2(x(v))}" y1="14" y2="18"/>`)}</svg>`;
}

// Link 1: the revenue at risk, one ink bar, its amount inside it.
function link1(drawing, view) {
  const geo = DRAW[drawing];
  const x = scaleOf(geo, topOf(view.totals));
  const v = linkValue(1, view);
  const h = 50;
  return svg(drawing, h, fill('link1Alt', { v: money(v) }), html`${grid(x, ticksOf(topOf(view.totals)), h)}${rect('wr-bar wr-bar--ink', geo.L, x(v), 4, BAR)}
<text class="wr-val wr-val--in" x="${r2(x(v) - 8)}" y="${4 + BAR / 2}" dy="0.35em" text-anchor="end">${money(v)}</text>
<text class="chart-note" x="${geo.L}" y="${4 + BAR + 14}">${t('link1Note')}</text>`);
}

// ---------- labels that stay inside the drawing ----------

// The labels' type sizes (styles.css): notes and key words at the kit's label size (12: drawn about 11 px at the least
// zoom), a link's big value by drawing.
export const NOTE = 12;
export const VAL = Object.freeze({ narrow: 18, wide: 22 });
const noteW = (text) => textWidth(text, NOTE);
const valW = (text, drawing) => textWidth(text, VAL[drawing], { mono: true });
// A key item: its swatch, its amount (the type face, bold) and its words.
const SWATCH = 9;
const keyW = ({ value, words }) => SWATCH + 5 + textWidth(value, NOTE, { mono: true }) + noteW(` ${words}`);
// Room left for a label's change in length as the numbers move (a digit or two).
const SLACK = 14;

// The largest amount a link could draw at any use rate: key's largest case, as a multiple of the use shown, at the
// what-if's top. A layout that fits this fits every case at every use rate, so a link's shape holds as the reader moves.
const worst = ({ totals, use, how }, key) => (Math.max(...vals(totals, key).map(Math.abs)) / use) * how.params.use_max;

// Key items flowed left to right from x0 in rows of rowH, each kept inside maxX. items: { cls, fill, value, words }.
// Returns { body, bottom } (bottom: the last row's baseline).
function keyRows(items, { x0, y0, maxX, rowH = 16 }) {
  let x = x0;
  let y = y0;
  const out = items.map((item) => {
    const w = keyW(item);
    if (x > x0 && x + w > maxX) {
      x = x0;
      y += rowH;
    }
    const at = x;
    x += w + 14;
    return html`<rect class="wr-bar ${item.cls}" x="${r2(at)}" y="${y - 8}" width="${SWATCH}" height="${SWATCH}"${item.fill ? html` fill="${item.fill}"` : ''}/><text class="chart-note" x="${r2(at + SWATCH + 5)}" y="${y}"><tspan class="wr-val--sm">${item.value}</tspan> ${item.words}</text>`;
  });
  return { body: out, bottom: y };
}

// Link 2: revenue lost, the case's bar in the pen over the band from the low case to the high, a tick at each. Its value
// sits right of the band; its share of the revenue at risk beside the value where that fits at the worst case, else
// under the bar with the range.
function link2(drawing, view) {
  const { totals, scenario } = view;
  const geo = DRAW[drawing];
  const right = geo.width - geo.R;
  const top = topOf(totals);
  const x = scaleOf(geo, top);
  const v = linkValue(2, view);
  const lost = vals(totals, 'lost');
  const xv = x(Math.max(...lost)) + 10;
  const xWorst = x(worst(view, 'lost')) + 10;
  const share = pct(v / totals[scenario].at_risk, 0);
  const range = { low: money(totals.low.lost), high: money(totals.high.lost) };
  const shareText = fill('link2Share', { share });
  const side = xWorst + noteW(shareText) + SLACK <= right;
  const h = side ? 60 : 74;
  const ticks = SCENARIOS.map((s) => html`<line class="wr-case-tick${s === scenario ? ' wr-case-tick--on' : ''}" x1="${r2(x(totals[s].lost))}" x2="${r2(x(totals[s].lost))}" y1="0" y2="${4 + BAR + 4}"/>`);
  return svg(drawing, h, fill('link2Alt', { scenario: scenWord(scenario).toLowerCase(), v: money(-v), share, ...range }), html`${grid(x, ticksOf(top), h)}${rect('wr-band', x(Math.min(...lost)), x(Math.max(...lost)), 0, BAR + 8)}${rect('wr-bar wr-bar--pen', geo.L, x(v), 4, BAR)}${ticks}
<text class="wr-val" x="${r2(xv)}" y="${4 + BAR / 2 - (side ? 2 : 0)}" dy="0.35em">${money(-v)}</text>
${side
    ? html`<text class="chart-note" x="${r2(xv)}" y="${4 + BAR + 4}">${shareText}</text>
<text class="chart-note" x="${geo.L}" y="${h - 4}">${fill('link2Range', range)}</text>`
    : html`<text class="chart-note" x="${geo.L}" y="${4 + BAR + 20}">${shareText}</text>
<text class="chart-note" x="${geo.L}" y="${4 + BAR + 34}">${fill('link2Range', range)}</text>`}`);
}

// Link 3: the lost patients' care at cost under a bracket named above it, split three ways: still given unpaid (the
// pen), not given (the hatch) and paid by other coverage (the paid ink), named in a key under the bar.
function link3(drawing, view) {
  const { totals, scenario } = view;
  const geo = DRAW[drawing];
  const top = topOf(totals);
  const x = scaleOf(geo, top);
  const c = totals[scenario];
  const v = c.lost_cost;
  const still = x(c.added_uncompensated);
  const notGiven = x(c.added_uncompensated + c.care_avoided);
  const end = x(v);
  const hatch = `wr-hatch-${drawing}`;
  const yb = 21;
  const bar = 24;
  const key = keyRows([
    { cls: 'wr-bar--pen', value: money(c.added_uncompensated), words: t('link3Still') },
    { cls: 'wr-bar--hatch', fill: `url(#${hatch})`, value: money(c.care_avoided), words: t('link3NotGiven') },
    { cls: 'wr-bar--rew', value: money(c.other_coverage), words: t('link3Other') },
  ], { x0: geo.L, y0: yb + bar + 15, maxX: geo.width - geo.R - SLACK });
  const h = key.bottom + 5;
  return svg(drawing, h, fill('link3Alt', { v: money(v), still: money(c.added_uncompensated), notGiven: money(c.care_avoided), other: money(c.other_coverage) }), html`${hatchDefs(hatch)}${grid(x, ticksOf(top), h)}
<text class="chart-note" x="${geo.L}" y="9">${fill('link3Bracket', { cost: money(v), lost: money(c.lost), ratio: decimal(v / c.lost, 2) })}</text><path class="wr-bracket" d="M${r2(geo.L)} 18V13H${r2(end)}V18"/>
${rect('wr-bar wr-bar--pen', geo.L, still - 0.5, yb, bar)}<rect class="wr-bar wr-bar--hatch" x="${r2(still + 0.5)}" y="${yb}" width="${r2(Math.max(0, notGiven - still - 1))}" height="${bar}" fill="url(#${hatch})"/>${rect('wr-bar wr-bar--rew', notGiven + 0.5, end, yb, bar)}
${key.body}`);
}

// Link 4: the change in operating income as a waterfall from zero: the revenue lost runs left from zero, what other
// coverage pays and the cost of the care not given come back right, and the result sits over the band from the low case
// to the high. The steps are named right of zero where that fits at the worst case, else in a key under the result.
function link4(drawing, view) {
  const { totals, scenario } = view;
  const geo = DRAW[drawing];
  const right = geo.width - geo.R;
  const top = topOf(totals);
  const x = scaleOf(geo, top);
  const w = (v) => x(v) - geo.L;
  const c = totals[scenario];
  const v = c.income_change;
  const zero = x(c.lost);
  const zeroWorst = x(worst(view, 'lost'));
  const y = [13, 13 + STEP + 2, 13 + 2 * (STEP + 2)];
  const yr = y[2] + STEP + 5;
  const net = vals(totals, 'income_change').map(Math.abs);
  const hatch = `wr-hatch4-${drawing}`;
  const range = { low: money(totals.low.income_change), high: money(totals.high.income_change) };
  const labels = [
    fill('link4Lost', { v: money(-c.lost) }),
    fill('link4Other', { v: money(c.other_coverage, { sign: true }) }),
    fill('link4NotGiven', { v: money(c.care_avoided, { sign: true }) }),
  ];
  const note = fill('link4Note', range);
  const side = zeroWorst + 8 + Math.max(...labels.map(noteW), noteW(note)) + SLACK <= right;
  const bars = [
    rect('wr-bar wr-bar--scar', geo.L, zero, y[0], STEP),
    rect('wr-bar wr-bar--rew', geo.L, geo.L + w(c.other_coverage), y[1], STEP),
    html`<rect class="wr-bar wr-bar--hatch" x="${r2(geo.L + w(c.other_coverage))}" y="${y[2]}" width="${r2(w(c.care_avoided))}" height="${STEP}" fill="url(#${hatch})"/>`,
  ];
  let words;
  let h;
  // The words under the result clear the band from the low case to the high (it runs BAND_OUT past the bar).
  const under = yr + BAR + BAND_OUT + 13;
  if (side) {
    h = under + 4;
    words = html`${labels.map((label, i) => html`<text class="chart-note" x="${r2(zero + 6)}" y="${y[i] + STEP - 2}">${label}</text>`)}
<text class="chart-note" x="${r2(zero + 8)}" y="${under}">${note}</text>`;
  } else {
    const key = keyRows([
      { cls: 'wr-bar--scar', value: money(-c.lost), words: t('link4KeyLost') },
      { cls: 'wr-bar--rew', value: money(c.other_coverage, { sign: true }), words: t('link4KeyOther') },
      { cls: 'wr-bar--hatch', fill: `url(#${hatch})`, value: money(c.care_avoided, { sign: true }), words: t('link4KeyNotGiven') },
    ], { x0: geo.L, y0: under + 16, maxX: right - SLACK });
    h = key.bottom + 5;
    words = html`<text class="chart-note" x="${geo.L}" y="${under}">${note}</text>${key.body}`;
  }
  // "Less income" under the result, where it clears the left edge.
  const less = t('link4Less');
  const lessFits = side && zero - 4 - noteW(less) >= 0;
  return svg(drawing, h, fill('link4Alt', { scenario: scenWord(scenario).toLowerCase(), v: money(v), ...range }), html`${hatchDefs(hatch)}${grid(x, ticksOf(top), h)}
${bars}
${rect('wr-band', zero - w(Math.max(...net)), zero - w(Math.min(...net)), yr - BAND_OUT, BAR + 2 * BAND_OUT)}${rect('wr-bar wr-bar--net', zero - w(Math.abs(v)), zero, yr, BAR)}
<line class="chart-zero" x1="${r2(zero)}" x2="${r2(zero)}" y1="4" y2="${yr + BAR + 4}"/><text class="chart-axis__label" x="${r2(zero)}" y="9" text-anchor="middle">${tickText(0)}</text>
<text class="wr-val" x="${r2(zero + 8)}" y="${yr + BAR / 2 - 2}" dy="0.35em">${money(v)}</text>
${words}${lessFits ? html`<text class="chart-note" x="${r2(zero - 4)}" y="${under}" text-anchor="end">${less}</text>` : ''}`);
}

const DRAWERS = [link1, link2, link3, link4];

// A link's two drawings (the inside of its .wr-link__fig).
export const linkFigure = (n, view) => html`${DRAWERS[n - 1]('narrow', view)}${DRAWERS[n - 1]('wide', view)}`;
// The axis row's two drawings.
export const axisFigure = (view) => html`${axisDrawing('narrow', view)}${axisDrawing('wide', view)}`;

// The chain: the status line (the case and the use rate shown, and what the bands mean), the axis, then each link: its number, label and basis, the button that opens its
// worksheet (popover wr-ws-n), and its drawings.
export const chainHtml = (view) => html`<div class="wr-chain">
<p class="wr-chain__top"><span class="wr-chain__status" data-how-status>${statusText(view)}</span> <span class="wr-chain__key">${t('howNote')}</span></p>
<div class="wr-chain__axis" data-how-axis>${axisFigure(view)}</div>
<ol class="wr-chain__links" role="list">${LINKS.map(({ n, lines: [from, to] }) => html`
<li class="wr-link" data-link="${n}" data-v="${linkValue(n, view)}"><div class="wr-link__head"><p class="wr-link__lab"><span class="wr-link__n">${count(n)}</span> ${t(`link${n}Lab`)}</p><p class="wr-link__basis">${t(`link${n}Basis`)}</p><button type="button" class="wr-lines" popovertarget="wr-ws-${n}">${fill('linesBtn', { from: count(from), to: count(to) })}</button></div>
<div class="wr-link__fig" data-fig="${n}">${linkFigure(n, view)}</div><!-- /fig -->
</li>`)}
</ol>
</div>`;

// ---------- the worksheets ----------

// One line: its number, operator and words, its note(s), its tags, and its amount or factor; data-v holds the raw value.
// inline: the tags beside the words rather than under the notes (step 3's card, where a line should stay short).
export const lineRow = ({ n, op = '', key, note = null, range = null, tags = '', value, raw, cls = '', inline = false }) => html`<tr class="wr-wl${cls}" data-line="${n}" data-v="${raw}"><td class="wr-wl__n"><span class="field__no">${count(n)}</span></td><th scope="row" class="wr-wl__d">${op ? html`<span class="wr-wl__op">${op}</span> ` : ''}${t(key)}${inline ? tags : ''}${note ? html`<small>${note}</small>` : ''}${range ? html`<small class="wr-wl__rg">${range}</small>` : ''}${inline ? '' : tags}</th><td class="wr-wl__v">${value}</td></tr>`;
// A part of a line (link 3's split, link 4's steps): no number; data-<kind> names it.
const partRow = ({ kind, name, label, value, raw }) => html`<tr class="wr-wl wr-wl--part" data-${kind}="${name}" data-v="${raw}"><td class="wr-wl__n"></td><th scope="row" class="wr-wl__d">${label}</th><td class="wr-wl__v">${value}</td></tr>`;
const headRow = (text) => html`<tr class="wr-wl wr-wl--head"><td class="wr-wl__n"></td><th scope="row" colspan="2" class="wr-wl__d">${text}</th></tr>`;

export const scenTag = (fy) => html`<span class="scen-tag">${fillCopy(SHARED, 'scenarioTag', { year: String(fy) })}</span>`;
const rangeOf = (totals, key, sign = 1) => fill('wsRange', { low: money(sign * totals.low[key]), high: money(sign * totals.high[key]) });

// The lines of link n's worksheet (the inside of its tbody), for a view. The worksheet's head carries its one scenario
// tag (how.js); line 1, from the cost reports, carries its own measured tag.
export function worksheetBody(n, { totals, scenario, use, how }) {
  const c = totals[scenario];
  const { params, fy, declines } = how;
  const decline = c.lost / (c.at_risk * use);
  const ratio = c.lost_cost / c.lost;
  const lines = {
    1: () => html`${lineRow({ n: LINE.revenue, key: 'ws1', note: fill('ws1Note', { fy: String(fy) }), tags: html` <span class="wr-tag">${t('wsMeasured')}</span>`, value: money(c.medicaid_revenue), raw: c.medicaid_revenue, cls: ' wr-wl--eq' })}
${lineRow({ n: LINE.share, op: '×', key: 'ws2', note: t('ws2Note'), value: pct(c.at_risk / c.medicaid_revenue, 1), raw: c.at_risk / c.medicaid_revenue })}
${lineRow({ n: LINE.atRisk, op: '=', key: 'ws3', note: fill('ws3Note', { a: count(LINE.revenue) }), value: money(c.at_risk), raw: c.at_risk, cls: ' wr-wl--eq wr-wl--res' })}`,
    2: () => html`${lineRow({ n: LINE.decline, op: '×', key: 'ws4', note: fill('ws4Note', { lo: pct(declines[scenario][0], 0), hi: pct(declines[scenario][1], 0), scenario: scenWord(scenario).toLowerCase() }), value: pct(decline, 1), raw: decline })}
${lineRow({ n: LINE.use, op: '×', key: 'ws5', note: fill('ws5Note', { pct: pct(1, 0) }), value: pct(use, 0), raw: use })}
${lineRow({ n: LINE.lost, op: '=', key: 'ws6', note: fill('ws6Note', { a: count(LINE.atRisk), b: count(LINE.decline), c: count(LINE.use) }), range: rangeOf(totals, 'lost', -1), value: money(-c.lost), raw: c.lost, cls: ' wr-wl--eq wr-wl--res' })}`,
    3: () => html`${lineRow({ n: LINE.ratio, op: '×', key: 'ws7', note: t('ws7Note'), value: decimal(ratio, 2), raw: ratio })}
${lineRow({ n: LINE.cost, op: '=', key: 'ws8', note: fill('ws8Note', { a: count(LINE.lost), b: count(LINE.ratio) }), value: money(c.lost_cost), raw: c.lost_cost, cls: ' wr-wl--eq' })}
${lineRow({ n: LINE.uninsured, op: '×', key: 'ws9', note: fill('ws9Note', { v: money(c.other_coverage) }), value: decimal(params.uninsured_share, 2), raw: params.uninsured_share })}
${lineRow({ n: LINE.stillUsed, op: '×', key: 'ws10', note: fill('ws10Note', { v: money(c.care_avoided) }), value: decimal(params.care_still_used, 2), raw: params.care_still_used })}
${headRow(fill('wsSplit', { n: count(LINE.cost) }))}
${partRow({ kind: 'part', name: 'still', label: fill('wsSplitStill', { n: count(LINE.still) }), value: money(c.added_uncompensated), raw: c.added_uncompensated })}
${partRow({ kind: 'part', name: 'not-given', label: t('wsSplitNotGiven'), value: money(c.care_avoided), raw: c.care_avoided })}
${partRow({ kind: 'part', name: 'other', label: t('wsSplitOther'), value: money(c.other_coverage), raw: c.other_coverage })}`,
    4: () => html`${lineRow({ n: LINE.still, op: '=', key: 'ws11', note: fill('ws11Note', { a: count(LINE.cost), b: count(LINE.uninsured), c: count(LINE.stillUsed) }), range: rangeOf(totals, 'added_uncompensated'), value: money(c.added_uncompensated), raw: c.added_uncompensated, cls: ' wr-wl--eq wr-wl--res' })}
${partRow({ kind: 'step', name: 'lost', label: html`<span class="wr-wl__op">−</span> ${fill('wsStepLost', { n: count(LINE.lost) })}`, value: money(-c.lost), raw: -c.lost })}
${partRow({ kind: 'step', name: 'other', label: html`<span class="wr-wl__op">+</span> ${t('wsStepOther')}`, value: money(c.other_coverage, { sign: true }), raw: c.other_coverage })}
${partRow({ kind: 'step', name: 'not-given', label: html`<span class="wr-wl__op">+</span> ${t('wsStepNotGiven')}`, value: money(c.care_avoided, { sign: true }), raw: c.care_avoided })}
${lineRow({ n: LINE.income, op: '=', key: 'ws12', note: t('ws12Note'), range: rangeOf(totals, 'income_change'), value: money(c.income_change), raw: c.income_change, cls: ' wr-wl--eq wr-wl--res' })}`,
  };
  return lines[n]();
}
