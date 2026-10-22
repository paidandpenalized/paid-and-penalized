// The roll call: every hospital, every year. Hospitals are columns across the full width, years are rows, and a
// cell is filled in the penalty ink when CMS cut that hospital that year, in a pale ink when it didn't, and left
// empty when the hospital had no decision. Each row's cells are merged into runs, one path per ink, so thousands of
// hospitals stay a small drawing. Under the grid, brackets name the groups the caller picks out (e.g. ever cut,
// never cut), and ticks mark any highlighted hospitals.
//   records   one string per hospital in drawing order, one character per year: 'Y' cut, 'N' not cut, '.' none
//   years     the row labels, oldest first (rows are drawn oldest at the top)
//   brackets  [{ from, to, label, pen }]: column ranges to bracket under the grid (to exclusive)
//   highlight optional column indexes to tick under the grid
//   notes     optional text per row, printed at the right of its row (e.g. the row's share cut)
//   blank     optional text printed across a row with no hospital in it (a year with no decisions)
import { html } from '../render/html.js';
import { frame, r2, text } from './svg.js';

const TOP = 4;
const GAP = 2;
// A column at least this wide is drawn as its own cell.
const MIN_CELL = 4;

// The runs of one row: [{ a, b, c }] with b exclusive, consecutive columns sharing a character.
function rowRuns(records, i) {
  const out = [];
  records.forEach((rec, j) => {
    const c = rec[i];
    const last = out[out.length - 1];
    if (last && last.c === c && last.b === j) last.b = j + 1;
    else out.push({ a: j, b: j + 1, c });
  });
  return out;
}

// A bracket's label under its middle, kept inside the drawing: anchored at an end when it would run past one (its
// width estimated at the caps' 6.4 units a character).
function bracketLabel(b, { mid, label, width, y }) {
  const half = (String(b.label).length * 6.4) / 2;
  const cls = `chart-cap${b.pen ? ' chart-cap--pen' : ''}`;
  if (mid + half > width) return text({ x: width, y, anchor: 'end', cls, body: b.label });
  if (mid - half < label) return text({ x: label, y, anchor: 'start', cls, body: b.label });
  return text({ x: mid, y, cls, body: b.label });
}

export function rollCall({ records, years, brackets = [], highlight = null, notes = null, blank = null, width, rowH = 16, label = 54, right = 0 }) {
  const n = records.length;
  if (!n || !years.length || records.some((r) => r.length !== years.length)) throw new RangeError('rollCall: one record per hospital, one character per year');
  const x = (j) => label + (j * (width - label - right)) / n;
  const yOf = (i) => TOP + i * rowH;
  const gridBottom = yOf(years.length);
  const cut = [];
  const kept = [];
  years.forEach((_, i) => {
    const y = yOf(i);
    const h = rowH - GAP;
    // Wide enough columns are drawn one hospital each with a hairline between them; narrow ones merge into runs.
    const each = x(1) - x(0) >= MIN_CELL;
    for (const run of rowRuns(records, i)) {
      if (run.c === '.') continue;
      const d = each
        ? Array.from({ length: run.b - run.a }, (_, k) => `M${r2(x(run.a + k))} ${r2(y)}H${r2(x(run.a + k + 1) - 1)}v${h}H${r2(x(run.a + k))}Z`).join('')
        : `M${r2(x(run.a))} ${r2(y)}H${r2(x(run.b))}v${h}H${r2(x(run.a))}Z`;
      (run.c === 'Y' ? cut : kept).push(d);
    }
  });
  const bracketY = gridBottom + 10;
  const marks = brackets.map((b) => {
    const xa = x(b.from) + 0.5;
    const xb = x(b.to) - 0.5;
    const mid = (xa + xb) / 2;
    return html`<path class="chart-roll__bracket${b.pen ? ' chart-roll__bracket--pen' : ''}" d="M${r2(xa)} ${r2(bracketY - 5)}V${r2(bracketY)}H${r2(xb)}V${r2(bracketY - 5)}"/>
${bracketLabel(b, { mid, label, width, y: bracketY + 14 })}`;
  });
  const ticks = highlight && highlight.length
    ? html`<path class="chart-roll__hl" d="${highlight.map((j) => `M${r2((x(j) + x(j + 1)) / 2)} ${r2(TOP - 2)}V${r2(gridBottom + 2)}`).join('')}"/>`
    : '';
  const height = gridBottom + (brackets.length ? 30 : 6);
  return frame({
    kind: 'roll', width, height, body: html`${years.map((yr, i) => text({ x: 0, y: yOf(i) + rowH - GAP - 3, anchor: 'start', cls: 'chart-roll__year', body: yr }))}
<path class="chart-roll__no" d="${kept.join('')}"/>
<path class="chart-roll__yes" d="${cut.join('')}"/>
${ticks}
${blank ? years.map((_, i) => (records.every((r) => r[i] === '.') ? text({ x: (label + width - right) / 2, y: yOf(i) + rowH - GAP - 3, cls: 'chart-roll__blank', body: blank }) : '')) : ''}
${notes ? notes.map((note, i) => text({ x: width, y: yOf(i) + rowH - GAP - 3, anchor: 'end', cls: 'chart-roll__note', body: note })) : ''}
${marks}`,
  });
}
