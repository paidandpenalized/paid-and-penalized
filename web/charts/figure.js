// The frame every chart sits in (DES-31): "Figure N." and a one-sentence takeaway, the chart as an image named by
// alt, its claim level when its values are not CMS's own, the source line, and a "Show table" toggle holding every
// plotted value in a table (web/client/figure.js adds column sort, a CSV download and a tooltip layer). The build
// fails if a value the chart plots is missing from the table.
//   n            the figure's number on its page (a positive integer)
//   takeaway     the finding, in a sentence built from data; source: the source line (text or Safe)
//   svg          a chart from this kit (Safe, starting <svg)
//   claimLevel   'official' (CMS's values; nothing is said), 'recomputed', 'estimate' or 'hypothetical'
//   table        { columns: [{ name, numeric }], rows: [[cell]] }; the first cell of a row is its header. A cell is
//                text, or { text, value }; a numeric cell's value is its raw text (CMS's, with a hyphen-minus), shown
//                with a true minus, kept in data-value for sorting and the CSV (value null or absent: none)
//   csvName      the download's file name without .csv (default figure-N)
import { COPY } from '../copy.js';
import { cmsText } from '../render/format.js';
import { Safe, html } from '../render/html.js';

const CLAIMS = { official: null, recomputed: COPY.claimRecomputed, estimate: COPY.claimEstimate, hypothetical: COPY.claimHypothetical };
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function cellOf(cell, numeric) {
  if (cell !== null && typeof cell === 'object') return { text: String(cell.text), value: cell.value == null ? null : String(cell.value) };
  const s = String(cell);
  return numeric ? { text: cmsText(s), value: s } : { text: s, value: null };
}

function checkArgs({ n, takeaway, svg, source, claimLevel, table, alt, csvName }) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`figure: n must be a positive integer, got ${n}`);
  if (typeof takeaway !== 'string' || !takeaway) throw new TypeError(`figure ${n}: a takeaway is required`);
  if (typeof alt !== 'string' || !alt) throw new TypeError(`figure ${n}: alt text is required`);
  if (!(source instanceof Safe) && (typeof source !== 'string' || !source)) throw new TypeError(`figure ${n}: a source line is required`);
  if (!(svg instanceof Safe) || !svg.text.startsWith('<svg ')) throw new TypeError(`figure ${n}: svg must be a chart from web/charts`);
  if (!Object.hasOwn(CLAIMS, claimLevel)) throw new RangeError(`figure ${n}: unknown claimLevel "${claimLevel}"`);
  if (!NAME.test(csvName)) throw new RangeError(`figure ${n}: bad csvName "${csvName}"`);
  const { columns, rows } = table ?? {};
  if (!columns?.length || !rows?.length) throw new RangeError(`figure ${n}: a table with columns and rows is required`);
  rows.forEach((row, i) => {
    if (row.length !== columns.length) throw new RangeError(`figure ${n}: table row ${i + 1} has ${row.length} cells, not ${columns.length}`);
  });
}

// Every number the chart plots (its marks' data-value) must be some numeric cell's value.
function checkPlotted(n, svg, columns, cells) {
  const inTable = new Set(cells.flatMap((row) => row.filter((c, j) => columns[j].numeric && c.value !== null).map((c) => Number(c.value))));
  for (const [, list] of svg.text.matchAll(/data-value="([^"]*)"/g)) {
    for (const v of list.split(' ')) if (!inTable.has(Number(v))) throw new RangeError(`figure ${n}: plotted value ${v} is not in the table`);
  }
}

const tableCell = (cell, column, j) => {
  // No data-value without a raw value: the browser then sorts and writes the cell's text (and sorts it last).
  const value = column.numeric ? html` class="num"${cell.value === null ? '' : html` data-value="${cell.value}"`}` : '';
  return j === 0 ? html`<th scope="row"${value}>${cell.text}</th>` : html`<td${value}>${cell.text}</td>`;
};

export function figure({ n, takeaway, svg, source, claimLevel = 'official', table, alt, csvName = `figure-${n}` }) {
  checkArgs({ n, takeaway, svg, source, claimLevel, table, alt, csvName });
  const { columns, rows } = table;
  const cells = rows.map((row) => row.map((c, j) => cellOf(c, columns[j].numeric)));
  checkPlotted(n, svg, columns, cells);
  const claim = CLAIMS[claimLevel];
  const image = new Safe(html`<svg role="img" aria-label="${alt}" `.text + svg.text.slice('<svg '.length));
  return html`<figure class="fig" id="figure-${n}" data-figure>
<figcaption class="fig__cap"><span class="fig__n">${COPY.figure} ${n}.</span> ${takeaway}</figcaption>
${image}
${claim && html`<p class="fig__claim"><span class="pill">${claim}</span></p>
`}<p class="source fig__source">${source}</p>
<details class="fig__table"><summary>${COPY.showTable}</summary>
<div class="printout"><div class="printout__scroll"><table class="gb">
<thead><tr>${columns.map((c) => html`<th scope="col"${c.numeric ? html` data-numeric` : ''}>${c.name}</th>`)}</tr></thead>
<tbody>${cells.map((row) => html`<tr>${row.map((c, j) => tableCell(c, columns[j], j))}</tr>`)}</tbody>
</table></div></div>
<p class="fig__actions"><button type="button" class="fig__btn" data-figure-csv="${csvName}.csv" hidden>${COPY.downloadCsv}</button></p>
</details>
</figure>`;
}
