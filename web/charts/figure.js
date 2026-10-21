// The frame every chart sits in (DES-31): "Figure N." and a one-sentence takeaway, the chart as an image named by
// alt, the source line (led by the claim level, as words, when the values are not CMS's own), and a "Show table" toggle holding every
// plotted value in a table (web/client/figure.js adds column sort, a CSV download and a tooltip layer). The build
// fails if a value the chart plots is missing from the table.
//   n            the figure's number on its page (a positive integer)
//   takeaway     the finding, in a sentence built from data; source: the source line (text or Safe)
//   svg          a chart from this kit (Safe, starting <svg), drawn about phone wide
//   svgWide      optional: the same chart drawn on a wider viewBox for screens 560px and up (charts.css shows one
//                of the two), so its text keeps its size instead of growing with the chart
//   chart        in place of svg: a chart that is not a kit SVG (Safe HTML, e.g. the what-if's live bars, which
//                name their own parts); alt is then not used, and its marks carry no data-value to check
//   note         optional: a short line under the chart (text), e.g. what the chart leaves out that the table holds
//   key          optional: [{ swatch, label }], a one-line key above the chart naming marks it doesn't label itself;
//                swatch is one of KEY_SWATCHES (drawn in CSS like the chart's own mark), label the caller's words
//   claimLevel   'official' (CMS's values; nothing is said), 'recomputed', 'estimate' or 'hypothetical'
//   table        { columns: [{ name, numeric }], rows: [[cell]] }; the first cell of a row is its header. A cell is
//                text, or { text, value, data }; a numeric cell's value is its raw text (CMS's, with a hyphen-minus),
//                shown with a true minus, kept in data-value for sorting and the CSV (value null or absent: none);
//                data: optional { name: text } data-* attributes, hooks for a script that updates the cell
//   csvName      the download's file name without .csv (default figure-N)
import { numberOrNaN } from '../../engine/js/stats.js';
import { COPY } from '../copy.js';
import { printout } from '../render/components.js';
import { cmsText } from '../render/format.js';
import { Safe, html } from '../render/html.js';

const CLAIMS = { official: null, recomputed: COPY.claimRecomputed, estimate: COPY.claimEstimate, hypothetical: COPY.claimHypothetical };
const NAME = /^[a-z0-9][a-z0-9-]*$/;
export const KEY_SWATCHES = ['this', 'median', 'same'];

function cellOf(cell, numeric) {
  if (cell !== null && typeof cell === 'object') return { text: String(cell.text), value: cell.value == null ? null : String(cell.value), data: cell.data ?? {} };
  const s = String(cell);
  return numeric ? { text: cmsText(s), value: s, data: {} } : { text: s, value: null, data: {} };
}

const isChart = (svg) => svg instanceof Safe && svg.text.startsWith('<svg ');

function checkArgs({ n, takeaway, svg, svgWide, chart, source, claimLevel, table, alt, csvName, note, key }) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`figure: n must be a positive integer, got ${n}`);
  if (typeof takeaway !== 'string' || !takeaway) throw new TypeError(`figure ${n}: a takeaway is required`);
  if (chart !== null) {
    if (!(chart instanceof Safe) || svg !== undefined) throw new TypeError(`figure ${n}: chart must be Safe markup, given in place of svg`);
  } else if (typeof alt !== 'string' || !alt) throw new TypeError(`figure ${n}: alt text is required`);
  if (!(source instanceof Safe) && (typeof source !== 'string' || !source)) throw new TypeError(`figure ${n}: a source line is required`);
  if (chart === null && !isChart(svg)) throw new TypeError(`figure ${n}: svg must be a chart from web/charts`);
  if (svgWide !== null && !isChart(svgWide)) throw new TypeError(`figure ${n}: svgWide must be a chart from web/charts`);
  if (!Object.hasOwn(CLAIMS, claimLevel)) throw new RangeError(`figure ${n}: unknown claimLevel "${claimLevel}"`);
  if (note !== null && (typeof note !== 'string' || !note)) throw new TypeError(`figure ${n}: a note must be text`);
  if (key !== null && !(Array.isArray(key) && key.length && key.every((k) => KEY_SWATCHES.includes(k?.swatch) && typeof k.label === 'string' && k.label))) {
    throw new TypeError(`figure ${n}: a key is a list of { swatch, label } with swatch one of ${KEY_SWATCHES.join(', ')}`);
  }
  if (!NAME.test(csvName)) throw new RangeError(`figure ${n}: bad csvName "${csvName}"`);
  const { columns, rows } = table ?? {};
  if (!columns?.length || !rows?.length) throw new RangeError(`figure ${n}: a table with columns and rows is required`);
  rows.forEach((row, i) => {
    if (row.length !== columns.length) throw new RangeError(`figure ${n}: table row ${i + 1} has ${row.length} cells, not ${columns.length}`);
  });
}

// Every number the chart plots (its marks' data-value) must be finite and some numeric cell's value. A cell counts only
// when its raw value is a finite number written as non-empty text (Number('') is 0, and NaN would match NaN).
function checkPlotted(n, svg, columns, cells) {
  const inTable = new Set(cells.flatMap((row) => row.filter((c, j) => columns[j].numeric && c.value !== null)
    .map((c) => numberOrNaN(c.value)).filter(Number.isFinite)));
  for (const [, list] of svg.text.matchAll(/data-value="([^"]*)"/g)) {
    for (const v of list.split(' ')) {
      const x = numberOrNaN(v);
      if (!Number.isFinite(x) || !inTable.has(x)) throw new RangeError(`figure ${n}: plotted value "${v}" is not in the table`);
    }
  }
}

const NAME_DATA = /^[a-z][a-z0-9-]*$/;
const tableCell = (cell, column, j) => {
  // No data-value without a raw value: the browser then sorts and writes the cell's text (and sorts it last).
  const data = Object.entries(cell.data).map(([k, v]) => {
    if (!NAME_DATA.test(k) || k === 'value') throw new RangeError(`figure: bad data attribute name "${k}"`);
    return html` data-${k}="${v}"`;
  });
  const value = html`${column.numeric ? html` class="num"${cell.value === null ? '' : html` data-value="${cell.value}"`}` : ''}${data}`;
  return j === 0 ? html`<th scope="row"${value}>${cell.text}</th>` : html`<td${value}>${cell.text}</td>`;
};

// The chart as an image named by alt; fit: 'narrow' or 'wide' when the figure carries both variants.
const imageOf = (svg, alt, fit) => new Safe(html`<svg role="img" aria-label="${alt}"${fit ? html` data-fit="${fit}"` : ''} `.text + svg.text.slice('<svg '.length));

export function figure({ n, takeaway, svg, svgWide = null, chart = null, source, claimLevel = 'official', table, alt, csvName = `figure-${n}`, note = null, key = null }) {
  checkArgs({ n, takeaway, svg, svgWide, chart, source, claimLevel, table, alt, csvName, note, key });
  const { columns, rows } = table;
  const cells = rows.map((row) => row.map((c, j) => cellOf(c, columns[j].numeric)));
  if (chart === null) checkPlotted(n, svg, columns, cells);
  if (svgWide) checkPlotted(n, svgWide, columns, cells);
  const claim = CLAIMS[claimLevel];
  const image = chart ?? (svgWide ? html`${imageOf(svg, alt, 'narrow')}
${imageOf(svgWide, alt, 'wide')}` : imageOf(svg, alt, null));
  return html`<figure class="fig" id="figure-${n}" data-figure>
<figcaption class="fig__cap" id="figure-${n}-cap"><span class="fig__n">${COPY.figure} ${n}.</span> ${takeaway}</figcaption>
${key && html`<ul class="fig__key" role="list">${key.map((k) => html`<li><span class="fig__swatch fig__swatch--${k.swatch}" aria-hidden="true"></span>${k.label}</li>`)}</ul>
`}${image}
${note && html`<p class="small muted fig__note">${note}</p>
`}<p class="source fig__source">${claim && html`<span class="fig__claim">${claim}</span> · `}${source}</p>
<details class="fig__table"><summary>${COPY.showTable}</summary>
${printout(html`<table class="gb" aria-labelledby="figure-${n}-cap">
<thead><tr>${columns.map((c) => html`<th scope="col"${c.numeric ? html` data-numeric` : ''}>${c.name}</th>`)}</tr></thead>
<tbody>${cells.map((row) => html`<tr>${row.map((c, j) => tableCell(c, columns[j], j))}</tr>`)}</tbody>
</table>`)}
<p class="fig__actions"><button type="button" class="fig__btn" data-figure-csv="${csvName}.csv" hidden>${COPY.downloadCsv}</button></p>
</details>
</figure>`;
}
