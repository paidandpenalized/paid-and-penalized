// Step 1's three ranges (revenue lost, added uncompensated care, the fall in operating income), each low case to high
// with the selected case's value and a small tick bar, and the counts line under them. Shared by the build (finding.js)
// and the browser (client/page.js redraws them when the case or the use rate moves). Pure. totals: model.js's.
import { count, money, moneyRange, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';

export const scenWord = (s) => t(`scen${s[0].toUpperCase()}${s.slice(1)}`);

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

export const byCase = (totals, key, sign = 1) => Object.fromEntries(SCENARIOS.map((s) => [s, sign * totals[s][key]]));

// The three ranges, the inside of the .wr-ranges block.
export const rangesInner = (totals, selected) => html`
${range('lost', t('rangeLost'), byCase(totals, 'lost'), selected)}
${range('added', t('rangeAdded'), byCase(totals, 'added_uncompensated'), selected)}
${range('income', t('rangeIncome'), byCase(totals, 'income_change', -1), selected)}
`;

// The counts line: hospitals losing a point or more of operating margin, and those going from a positive total margin
// to a negative one, low case to high, with the middle case's.
export const countsText = (totals) => fill('counts', {
  fallsLow: count(totals.low.falls_1pp), fallsHigh: count(totals.high.falls_1pp), falls: count(totals.middle.falls_1pp),
  redLow: count(totals.low.into_red), redHigh: count(totals.high.into_red), red: count(totals.middle.into_red),
});

// What the page's live line says (client/page.js) when the case or the use rate moves: the case's three numbers and its
// counts. use: the use rate's multiple.
export const statusText = (totals, selected, use) => {
  const c = totals[selected];
  return fill('rangesStatus', {
    scenario: scenWord(selected), use: pct(use, 0), lost: money(c.lost), added: money(c.added_uncompensated), income: money(-c.income_change),
    falls: count(c.falls_1pp), red: count(c.into_red),
  });
};

// The ranges, the counts line, and the page's one live line, empty until the script writes it: the ranges, the counts
// and the chips' readout are rewritten silently, and this line says what changed, once.
export const ranges = (totals, selected) => html`<div class="wr-ranges">${rangesInner(totals, selected)}</div>
<p class="wr-counts small">${countsText(totals)}</p>
<p class="vh wr-status" role="status"></p>`;
