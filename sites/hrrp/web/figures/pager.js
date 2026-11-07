// The markup of a paged table's controls, for every table that pages in the browser (the program page's "Every state", a hospital
// page's area table, a place page's child table): a pager of numbered buttons and, where the table says which rows show, the status line
// whose template the script fills. The table holds one tbody for each page (data-page) and the script (client/pager.js) reads these
// attributes. cls is the table's class prefix ("nb" gives nb__pager and nb__status); the words are the site's (web/copy.js).
import { html } from '../../../../web/render/html.js';
import { fill } from '../copy.js';

// "Showing {from} to {to} of {n}", the placeholders left for the script (or a script's row renderer) to fill.
export const statusTemplate = () => fill('pagerStatus', { from: '{from}', to: '{to}', n: '{n}' });

// label: the pager's accessible name; pages: the table's pages (only their count matters); status: whether a status line follows.
export function pagerNav({ cls, label, pages, status = true }) {
  const nav = html`<nav class="seg ${cls}__pager" aria-label="${label}" hidden>${pages.map((_, i) => html`<button type="button" class="btn" data-to-page="${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}">${fill('pagerPage', { n: String(i + 1) })}</button>`)}</nav>`;
  return status ? html`${nav}
<p class="small ${cls}__status" role="status" data-template="${statusTemplate()}" hidden></p>` : nav;
}
