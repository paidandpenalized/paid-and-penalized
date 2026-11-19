// The TEAM pages' shared parts: the family shell's fields (the site's stylesheet, the TEAM tab and the section menu: the
// program page's seven Parts, then Methods), a Part's frame (its number, label and heading over its words, beside its
// figure) and the citation set after a sentence.
import { COPY as SHARED } from '../../../../web/copy.js';
import { shortIsoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { PY2_START, SECTIONS } from '../constants.js';
import { fill, t } from '../copy.js';
import { METHODS_PATH, PROGRAM_PATH } from '../links.js';

// A Part's label (its tag's words), by its id. Part 2's names the day it is about.
export const labelOf = (id) => (id === 'change' ? fill('navChange', { date: shortIsoDate(PY2_START) }) : t(`nav${id[0].toUpperCase()}${id.slice(1)}`));

// A Part's shorter label in the section menu.
const menuLabelOf = (id) => {
  const key = `menu${id[0].toUpperCase()}${id.slice(1)}`;
  return id === 'change' ? fill(key, { date: shortIsoDate(PY2_START) }) : t(key);
};

const SECTION_MENU = Object.freeze([
  ...SECTIONS.map((id) => ({ id, label: menuLabelOf(id), href: `${PROGRAM_PATH}#${id}` })),
  { id: 'methods', label: SHARED.methods, href: METHODS_PATH },
]);

// The family shell's fields for a TEAM page (layout.js page()). current: the section to mark (an id), or null.
export const shellOf = ({ current = null } = {}) => ({ sheets: ['team'], program: 'team', sections: SECTION_MENU, current });

// A rule's citation after the sentence it supports, in the small type the family sets references in.
export const cite = (text) => html` <span class="tm-cite">${text}</span>`;

// A sentence of the site's words with its citation: a paragraph (or the caller's tag).
export const cited = (words, ref, { tag = 'p', cls = '' } = {}) => (tag === 'p'
  ? html`<p${cls ? html` class="${cls}"` : ''}>${words}${cite(ref)}</p>`
  : html`<span${cls ? html` class="${cls}"` : ''}>${words}${cite(ref)}</span>`);

// A Part: its id (the section menu's anchor), its number and label as the tag, its heading (the page's h1 for Part 1,
// which passes `h1: true`), its words, and its figure column beside them (wide screens) or under them (phones). fig: the
// figure's markup; '' leaves the column empty (a slot a later figure fills: data-slot names it). wide: the words span the
// page above the figure, for a Part whose figure needs the width (the calculator).
export function partOf({ id, n, heading, h1 = false, kicker = null, words, fig = '', slot = null, wide = false, after = '' }) {
  const tag = html`<p class="tm-part__tag">${fill('partTag', { n: String(n) })} · ${labelOf(id)}</p>`;
  const head = h1
    ? html`${tag}${kicker ? html`<p class="cap tm-kicker">${kicker}</p>` : ''}<h1 class="tm-part__title tm-part__title--h1" id="${id}-h">${heading}</h1>`
    : html`${tag}<h2 class="tm-part__title" id="${id}-h">${heading}</h2>`;
  return html`<section class="tm-part" id="${id}" aria-labelledby="${id}-h">
<div class="tm-part__text${wide ? ' tm-part__text--wide' : ''}">
${head}
${words}
</div>
<div class="tm-part__fig"${slot ? html` data-slot="${slot}"` : ''}>${fig}</div>
${after}</section>`;
}
