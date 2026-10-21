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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
    } else if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      sections.push({ heading, id: `${idPrefix}-${slug(heading)}`, blocks: [] });
    } else if (line.startsWith('- ')) {
      const items = [];
      for (; i < lines.length && lines[i].startsWith('- '); i++) items.push(lines[i].slice(2).trim());
      i--;
      section().blocks.push(html`<ul>${items.map((item) => html`<li>${inline(item)}</li>`)}</ul>`);
    } else if (line.startsWith('|') && RULE.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(cells(lines[i]));
      i--;
      const label = section().id;
      section().blocks.push(printout(html`<table class="${tableClass}"${label ? html` aria-labelledby="${label}"` : ''}>
<thead><tr>${head.map((c) => html`<th scope="col">${inline(c)}</th>`)}</tr></thead>
<tbody>${rows.map((row) => html`<tr>${row.map((c, j) => (j === 0 ? html`<th scope="row">${inline(c)}</th>` : html`<td>${inline(c)}</td>`))}</tr>`)}</tbody>
</table>`));
    } else {
      const para = [];
      for (; i < lines.length && lines[i].trim() && !/^(#|- |\|)/.test(lines[i]); i++) para.push(lines[i].trim());
      i--;
      const joined = para.join(' ');
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
