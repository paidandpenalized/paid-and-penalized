// Step 1, the finding: in the words column, the page's top (top.js), the group chips (a script shows them), and the three
// national ranges, low case to high, with the counts under them; beside it, the stage: its head (empty until the scenario
// switch and the what-if arrive) and Figure 1, the three strips drawn at build time (strips.js), whole without a script.
// Dollars and counts come from the file's national roll-up (`national`, every counted hospital, Maryland out).
import { figure, num } from '../../../../web/charts/figure.js';
import { frame } from '../../../../web/charts/svg.js';
import { count, money, moneyRange, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { DEFAULT_SCENARIO, GROUPS, BEDS, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { pageTop } from './top.js';
import { DRAWINGS, drawn, median, stripsBody, stripsLayout } from './strips.js';

const scenWord = (s) => t(`scen${s[0].toUpperCase()}${s.slice(1)}`);

// ---------- the ranges ----------

// A range's little scale: a hairline with a tick at each case and the selected case's dot (a reading aid beside the words).
function rangeBar(values, selected) {
  const max = Math.max(...SCENARIOS.map((s) => values[s])) * 1.06;
  const x = (v) => Math.round(4 + (v / max) * 232);
  return html`<svg class="wr-range__bar" viewBox="0 0 240 14" aria-hidden="true" focusable="false"><line class="wr-range__track" x1="4" x2="236" y1="7" y2="7"/>${SCENARIOS.map((s) => html`<line class="wr-range__tick" x1="${x(values[s])}" x2="${x(values[s])}" y1="2" y2="12"/>`)}<circle class="wr-range__dot" cx="${x(values[selected])}" cy="7" r="4.5"/></svg>`;
}

// One range: its label, low to high, the selected case's value, and the bar. values: by case, as positive dollars.
const range = (key, label, values, selected) => html`<div class="wr-range" data-range="${key}">
<p class="wr-range__lab">${label}</p>
<p class="wr-range__v">${moneyRange(values.low, values.high)}</p>
<p class="wr-range__mid">${fill('rangeMid', { scenario: scenWord(selected), value: money(values[selected]) })}</p>
${rangeBar(values, selected)}
</div>`;

const byCase = (national, key, sign = 1) => Object.fromEntries(SCENARIOS.map((s) => [s, sign * national[s][key]]));

function ranges(national, selected) {
  return html`<div class="wr-ranges">
${range('lost', t('rangeLost'), byCase(national, 'lost'), selected)}
${range('added', t('rangeAdded'), byCase(national, 'added_uncompensated'), selected)}
${range('income', t('rangeIncome'), byCase(national, 'income_change', -1), selected)}
</div>
<p class="wr-counts small">${fill('counts', {
    fallsLow: count(national.low.falls_1pp), fallsHigh: count(national.high.falls_1pp), falls: count(national.middle.falls_1pp),
    redLow: count(national.low.into_red), redHigh: count(national.high.into_red), red: count(national.middle.into_red),
  })}</p>`;
}

// ---------- the chips ----------

// A group's words: its chip's label (prefix 'chip_') or its name in the readout and on the strips (prefix 'group_'); the
// bed-size groups' cuts come from BEDS.
const BED_CUTS = { beds_lt50: BEDS.small, beds_300plus: BEDS.large };
const groupWords = (prefix, key) => (key in BED_CUTS ? fill(`${prefix}${key}`, { n: count(BED_CUTS[key]) }) : t(`${prefix}${key}`));

// The chips: one button per group (data-name: the group as the readout names it), a picker of the states with hospitals
// drawn, a clear button and the readout. Hidden in the markup: they do nothing without the script (client/chips.js),
// which shows them.
function chips(states) {
  return html`<div class="wr-chips" role="group" aria-labelledby="wr-chips-h" hidden>
<p class="wr-chips__head"><span class="cap" id="wr-chips-h">${t('chipsHeading')}</span> <button type="button" class="wr-chips__clear" hidden>${t('chipsClear')}</button></p>
<div class="wr-chips__row">${GROUPS.map((key) => html`<button type="button" class="wr-chip" data-group="${key}" data-name="${groupWords('group_', key)}" aria-pressed="false">${groupWords('chip_', key)}</button>`)}<select class="wr-chip wr-chips__state" aria-label="${t('chipStateLabel')}"><option value="">${t('chipState')}</option>${states.map(([code, name]) => html`<option value="${code}">${name}</option>`)}</select></div>
<p class="wr-chips__out small" aria-live="polite">${t('chipHint')}</p>
</div>`;
}

// ---------- Figure 1 ----------

// The table's bins of share lost, up to the axis's top: each bin holds [from, to), the last [from, top].
const BIN_EDGES = [0, 0.0025, 0.005, 0.01, 0.02, 0.04, 0.08];
// A share at the fewest places that show it (0.25%, 0.5%, 1%).
const shareText = (v) => pct(v, [0, 1, 2].find((dp) => Math.abs(Math.round(v * 10 ** (dp + 2)) - v * 10 ** (dp + 2)) < 1e-9) ?? 2);

function tableOf(items, top) {
  const edges = [...BIN_EDGES.filter((e) => e < top), top];
  const binOf = (v) => Math.min(edges.length - 2, edges.findLastIndex((e) => v >= e));
  const counts = SCENARIOS.map((_, k) => {
    const c = new Array(edges.length - 1).fill(0);
    for (const r of items) c[binOf(r.share[k])] += 1;
    return c;
  });
  const medians = SCENARIOS.map((_, k) => median(items.map((r) => r.share[k])));
  return {
    columns: [{ name: t('tableShare') }, ...SCENARIOS.map((s) => ({ name: scenWord(s), numeric: true }))],
    rows: [
      ...edges.slice(0, -1).map((from, b) => [fill('tableBin', { from: shareText(from), to: shareText(edges[b + 1]) }), ...counts.map((c) => num(count(c[b]), c[b]))]),
      [t('tableMedian'), ...medians.map((m) => num(pct(m, 2), m))],
    ],
  };
}

// The words the strips' headers print, from the data: the cost reports' year, and by case the national dollars lost and
// Urban's national enrollment decline (thousands). The browser's copy carries the same (strips.js stripsAsset).
export const stripWords = (data) => ({
  fy: data.meta.fy,
  lost: byCase(data.national, 'lost'),
  enrollees: Object.fromEntries(data.scenarios.map((s) => [s.id, s.decline_enrollment])),
});

// The figure: every drawn hospital in each case, the selected case tall. rows: hospitalRows; top: the axis's top; words:
// stripWords.
function stripsFigure({ rows, top, words, selected }) {
  const { fy } = words;
  const items = drawn(rows);
  const inScenario = rows.filter((r) => r.cls === 'scenario').length;
  const draw = (drawing) => {
    const layout = stripsLayout({ items, drawing, top, selected });
    return frame({ kind: 'strips', width: DRAWINGS[drawing].width, height: layout.height, body: stripsBody(layout, { words }) });
  };
  const medians = SCENARIOS.map((_, k) => pct(median(items.map((r) => r.share[k])), 2));
  return figure({
    n: 1,
    takeaway: fill('figTakeaway', { placed: count(items.length), n: count(inScenario) }),
    svg: draw('narrow'),
    svgWide: draw('wide'),
    alt: fill('figAlt', { low: medians[0], middle: medians[1], high: medians[2] }),
    note: fill('figNotPlaced', { n: count(inScenario - items.length) }),
    source: html`${fill('figSource', { fy: String(fy) })} ${scenarioTag(fy)}`,
    claimLevel: 'hypothetical',
    table: tableOf(items, top),
    csvName: 'work-requirement-strips',
  });
}

// The step. data: loadMedicaid()'s result; rows: hospitalRows(data); top: the axis's top (axisTop); label: the step's
// heading (its section-menu label); stripsUrl: the browser's copy of the rows (strips.js stripsAsset), which the page's
// script redraws the strips from (null: the figure stays as drawn).
export function findingStep({ data, rows, top, label, stripsUrl = null }) {
  const selected = DEFAULT_SCENARIO;
  const fy = data.meta.fy;
  const { national } = data;
  const withDots = new Set(drawn(rows).map((r) => r.state));
  const states = Object.entries(data.states).filter(([code]) => withDots.has(code)).map(([code, s]) => [code, s.name]).sort((a, b) => a[1].localeCompare(b[1]));
  return html`<section class="step wr-step wr-finding" id="finding" aria-labelledby="finding-h">
<div class="wr-step__words">
${pageTop()}
<h2 class="wr-sec" id="finding-h">${label} ${scenarioTag(fy)}</h2>
<p class="wr-sec__sub small muted">${t('rangesSub')}</p>
${ranges(national, selected)}
${chips(states)}
</div>
<div class="wr-step__stage"${stripsUrl ? html` data-strips="${stripsUrl}"` : ''}>
<div class="wr-stage__head" data-stage-head></div>
${stripsFigure({ rows, top, words: stripWords(data), selected })}
</div>
</section>`;
}
