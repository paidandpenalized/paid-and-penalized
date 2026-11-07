// The scaffold of the two HRRP over-time charts (a hospital's cut by year, a place's average cut): the pandemic years shaded and
// tagged, the y ticks with their gridlines, the baseline, a rule where the cap stepped (its words only where the next rule leaves
// room) and the year labels below. Each chart draws its own marks between these parts; the program page's History figure keeps its
// own furniture (history-draw.js), which clips and wraps differently, and shares only `yy`.
import { capsWidth, mark, r2, text } from '../../../../web/charts/svg.js';
import { html } from '../../../../web/render/html.js';

export const yy = (fy) => `’${String(fy).slice(-2)}`;

// M { top, left, right, h }; years [{ fy }] in order; caps [{ fy, label, short }]; covid { fys, note, label }.
// y(v) and ticks place the y axis, tickText(v) words a tick; bandAt(c0, c1) gives the shaded band's { x, w, mid } from the first and last
// covid year's index; xAt(i) is the center of year i's label and ruleAt(i) where a rule for year i stands; every: label every nth year,
// counted back from the last. Returns { head, rules, yearLabels } as markup, in the order they go in the drawing (yearLabels, last, carries
// the pandemic years' tag too).
export function yearAxis({ M, width, narrow, years, caps, covid, y, ticks, tickText, bandAt, xAt, ruleAt, every }) {
  const [c0, c1] = [covid.fys[0], covid.fys[covid.fys.length - 1]].map((fy) => years.findIndex((yr) => yr.fy === fy));
  const shaded = covid.fys.length && c0 >= 0 ? bandAt(c0, c1) : null;
  const band = shaded
    ? mark({ tip: covid.note, hit: null, body: html`<rect class="hist-covid" x="${r2(shaded.x)}" y="${M.top}" width="${r2(shaded.w)}" height="${M.h}"/>` }) : '';
  // Drawn last, with the year labels, on a paper halo, so a tall bar in those years never crosses its letters.
  const tag = shaded && !narrow ? text({ x: shaded.mid, y: M.top + 12, cls: 'chart-cap chart-label--halo', body: covid.label }) : '';
  const capAt = caps.map((c) => ({ ...c, x: ruleAt(years.findIndex((yr) => yr.fy === c.fy)) })).filter((c) => c.x >= M.left);
  const rules = capAt.map((c, i) => {
    // The longer label only where the next rule leaves it room; a label the next rule leaves no room for is left off (the rule stays).
    const room = i < capAt.length - 1 ? capAt[i + 1].x - c.x : Infinity;
    const word = narrow || room < capsWidth(c.label) + 8 ? c.short : c.label;
    return html`<line class="chart-rank__break" x1="${r2(c.x)}" x2="${r2(c.x)}" y1="${M.top - 12}" y2="${M.top + M.h}"/>${room < capsWidth(word) + 6 ? '' : text({ x: c.x + 3, y: M.top - 4, anchor: 'start', cls: 'chart-cap', body: word })}`;
  });
  const head = html`${band}
${ticks.map((v) => html`${v === 0 ? '' : html`<line class="chart-grid" x1="${M.left}" x2="${width - M.right}" y1="${r2(y(v))}" y2="${r2(y(v))}"/>`}${text({ x: M.left - 6, y: y(v) + 4, anchor: 'end', cls: 'chart-tick', body: tickText(v) })}`)}
<line class="chart-axis__line" x1="${M.left}" x2="${width - M.right}" y1="${r2(y(0))}" y2="${r2(y(0))}"/>`;
  const last = years.length - 1;
  const yearLabels = [tag, ...years.map((yr, i) => ((last - i) % every === 0 ? text({ x: xAt(i), y: M.top + M.h + 16, cls: 'chart-tick', body: yy(yr.fy) }) : ''))];
  return { head, rules, yearLabels };
}
