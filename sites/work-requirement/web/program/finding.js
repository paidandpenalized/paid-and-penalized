// Step 1, the finding: in the words column, the page's top (top.js), the group chips (a script shows them), and the three
// national ranges, low case to high, with the counts under them (ranges.js); beside it, the stage: its head (the scenario
// switch and the use-rate what-if, controls.js, hidden until the script shows them) and Figure 1, the three strips drawn
// at build time (strips.js), whole without a script. Dollars and counts come from the file's national roll-up
// (`national`, every counted hospital, Maryland out), through model.js's totals.
import { figure, num } from '../../../../web/charts/figure.js';
import { frame } from '../../../../web/charts/svg.js';
import { count, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { DEFAULT_SCENARIO, GROUPS, BEDS, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { stageHead } from './controls.js';
import { serverTotals } from './model.js';
import { byCase, ranges, scenWord } from './ranges.js';
import { pageTop } from './top.js';
import { DRAWINGS, binsOf, drawn, stripsAlt, stripsBody, stripsLayout } from './strips.js';

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
<p class="wr-chips__out small">${t('chipHint')}</p>
</div>`;
}

// ---------- Figure 1 ----------

// A share at the fewest places that show it (0.25%, 0.5%, 1%).
const shareText = (v) => pct(v, [0, 1, 2].find((dp) => Math.abs(Math.round(v * 10 ** (dp + 2)) - v * 10 ** (dp + 2)) < 1e-9) ?? 2);

// The table: each bin's count by case, then the medians. Each number cell carries data-bin ("<bin> <case index>", "m" for
// the median row), so the page's script rewrites it as the use rate moves (binsOf at that rate).
function tableOf(items, top) {
  const { edges, counts, medians } = binsOf(items, top);
  return {
    columns: [{ name: t('tableShare') }, ...SCENARIOS.map((s) => ({ name: scenWord(s), numeric: true }))],
    rows: [
      ...edges.slice(0, -1).map((from, b) => [fill('tableBin', { from: shareText(from), to: shareText(edges[b + 1]) }), ...counts.map((c, k) => ({ ...num(count(c[b]), c[b]), data: { bin: `${b} ${k}` } }))]),
      [t('tableMedian'), ...medians.map((m, k) => ({ ...num(pct(m, 2), m), data: { bin: `m ${k}` } }))],
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
  return figure({
    n: 1,
    takeaway: fill('figTakeaway', { placed: count(items.length), n: count(inScenario) }),
    svg: draw('narrow'),
    svgWide: draw('wide'),
    alt: stripsAlt(items),
    source: html`${fill('figSource', { fy: String(fy) })} ${scenarioTag(fy)}`,
    claimLevel: 'hypothetical',
    table: tableOf(items, top),
    csvName: 'work-requirement-strips',
  });
}

// The step. data: loadMedicaid()'s result; rows: hospitalRows(data); top: the axis's top (axisTop); label: the step's
// heading (its section-menu label); stripsUrl: the browser's copy of the rows (strips.js stripsAsset), which the page's
// script redraws the strips from (null: the figure stays as drawn); baseUrl: the what-if's copy of the scenario
// hospitals (model.js baseAsset), which the script reads once the use rate first moves.
export function findingStep({ data, rows, top, label, stripsUrl = null, baseUrl = null }) {
  const selected = DEFAULT_SCENARIO;
  const fy = data.meta.fy;
  const withDots = new Set(drawn(rows).map((r) => r.state));
  const states = Object.entries(data.states).filter(([code]) => withDots.has(code)).map(([code, s]) => [code, s.name]).sort((a, b) => a[1].localeCompare(b[1]));
  return html`<section class="step wr-step wr-finding" id="finding" aria-labelledby="finding-h">
<div class="wr-step__words">
${pageTop()}
<h2 class="wr-sec" id="finding-h">${label} ${scenarioTag(fy)}</h2>
<p class="wr-sec__sub small muted">${t('rangesSub')}</p>
${ranges(serverTotals(data), selected)}
${chips(states)}
<p class="small muted wr-notplaced">${fill('figNotPlaced', { n: count(rows.filter((r) => r.cls === 'scenario').length - drawn(rows).length) })}</p>
</div>
<div class="wr-step__stage"${stripsUrl ? html` data-strips="${stripsUrl}"` : ''}${baseUrl ? html` data-base="${baseUrl}"` : ''}>
${stageHead(data.params, selected)}
${stripsFigure({ rows, top, words: stripWords(data), selected })}
<p class="small muted wr-thread-none" hidden><a href="#hospital"></a></p>
</div>
</section>`;
}
