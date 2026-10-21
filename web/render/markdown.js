// A small Markdown subset, for the site's own reference files shown as pages (a data dictionary): one "# " title,
// "## " section headings, paragraphs, "- " lists, pipe tables (a header row, its |---| rule, then rows) and `code`.
// Not a general Markdown parser: anything else is plain text. Everything is escaped; only the subset makes markup.
import { printout } from './components.js';
import { Safe, escapeHtml, html } from './html.js';

// A line's text with `code` spans; the text is escaped first, so a code span holds escaped text too.
const inline = (text) => new Safe(escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>'));
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const RULE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The run of lines from start while keep(line) holds: [the run, the index of the first line after it].
function take(lines, start, keep) {
  let end = start;
  while (end < lines.length && keep(lines[end])) end++;
  return [lines.slice(start, end), end];
}
const isItem = (line) => line.startsWith('- ');
const isRow = (line) => line.startsWith('|');
const inParagraph = (line) => line.trim() && !/^(#|- |\|)/.test(line);

// { title, intro, sections: [{ heading, id, body }] }: the "# " title's text, the first paragraph's plain text, and
// each "## " section with its body as markup (blocks before the first "## " form a section with no heading). idPrefix
// names each heading's id; a section's table is labelled by its heading and sits in the printout frame
// (tableClass: the table's classes; its first column is the row head).
export function markdownSections(text, { idPrefix, tableClass = 'gb' }) {
  const sections = [{ heading: null, id: null, blocks: [] }];
  let title = null;
  let intro = null;
  const section = () => sections[sections.length - 1];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
    } else if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      i += 1;
    } else if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      sections.push({ heading, id: `${idPrefix}-${slug(heading)}`, blocks: [] });
      i += 1;
    } else if (isItem(line)) {
      const [items, next] = take(lines, i, isItem);
      i = next;
      section().blocks.push(html`<ul>${items.map((item) => html`<li>${inline(item.slice(2).trim())}</li>`)}</ul>`);
    } else if (isRow(line) && RULE.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      const [rows, next] = take(lines, i + 2, isRow);
      i = next;
      const label = section().id;
      section().blocks.push(printout(html`<table class="${tableClass}"${label ? html` aria-labelledby="${label}"` : ''}>
<thead><tr>${head.map((c) => html`<th scope="col">${inline(c)}</th>`)}</tr></thead>
<tbody>${rows.map(cells).map((row) => html`<tr>${row.map((c, j) => (j === 0 ? html`<th scope="row">${inline(c)}</th>` : html`<td>${inline(c)}</td>`))}</tr>`)}</tbody>
</table>`));
    } else {
      // A paragraph: this line and the plain lines after it.
      const [rest, next] = take(lines, i + 1, inParagraph);
      i = next;
      const joined = [line, ...rest].map((l) => l.trim()).join(' ');
      intro ??= joined.replace(/`/g, '');
      section().blocks.push(html`<p>${inline(joined)}</p>`);
    }
  }
  return {
    title,
    intro,
    sections: sections.filter((s) => s.heading || s.blocks.length).map(({ heading, id, blocks }) => ({ heading, id, body: html`${blocks}` })),
  };
}
