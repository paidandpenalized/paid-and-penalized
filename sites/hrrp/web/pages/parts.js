// The Readmissions pages' shared parts: the family shell's fields (the section menu to the program page's Parts and
// Methods), and the hospital the header follows.
import { html } from '../../../../web/render/html.js';
import { searchForm } from '../../../../web/render/shell.js';
import { formField, formTitle, lastCall } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { fill, t } from '../copy.js';
import { t as searchWord } from '../program/copy.js';
import { estimateTag } from '../estimate-tag.js';
import { METHODS_PATH, PROGRAM_PATH } from '../links.js';

// The program page's Parts the section menu links to, by id (the program page gives each Part its id), then Methods.
export const SECTIONS = Object.freeze(['how', 'picture', 'map', 'history', 'explore', 'research']);

export const labelOf = (id, edition) => (id === 'picture' ? fill('navPicture', { edition }) : t(`nav${id[0].toUpperCase()}${id.slice(1)}`));

// The family shell's fields for a Readmissions page (layout.js page(): sheets, program, sections, current, hospital):
// the site's stylesheet, the Readmissions tab and the numbered section menu, the "picture" Part labeled with the
// edition ("The FY2027 picture"). current: the id to mark, or null. The parts every page of a build shares are built
// once for each current item. edition: the edition's label.
// The bar's search box (render/shell.js searchForm) in Readmissions' words: the hospitals asset (searchUrl) that client/search.js mounts.
const searchBox = (searchUrl) => searchForm({
  id: 'omni', src: searchUrl, label: searchWord('searchHeading'), find: searchWord('searchFind'), findRest: searchWord('searchFindRest'), placeholder: searchWord('searchPlaceholder'),
});

const shellParts = lastCall(({ edition, current, searchUrl }) => [edition, current, searchUrl], ({ edition, current, searchUrl }) => ({
  sheets: ['hrrp'],
  program: 'hrrp',
  sections: [
    ...SECTIONS.map((id) => ({ id, label: labelOf(id, edition), href: `${PROGRAM_PATH}#${id}` })),
    { id: 'methods', label: SHARED.methods, href: METHODS_PATH },
  ],
  current,
  search: searchUrl ? searchBox(searchUrl) : '',
}));
export const shellOf = ({ edition, current = null, searchUrl = null, hospital = null }) => ({ ...shellParts({ edition, current, searchUrl }), hospital });

// The hospital a Readmissions hospital page's header follows (render/shell.js familyHeader): its CCN, name and
// estimated net across the programs (the hospital view's net, as HACRP's pages show it; null without an estimate). Every hospital with a page here is in
// Thirty Day Readmissions' file, so the Readmissions tab opens its page. inHub false: the hub and HACRP have no page for
// it, so the tabs and the chip link none.
export const followed = ({ ccn, name, net, inHub }) => ({ ccn, name, net, inTdr: true, inHub });

// A numbered record card of the program and place pages: the title bar, then each field (an estimated one carries the tag).
// card: { left, right, fields: [{ label, value, note, estimated }] }.
export const recordCard = (card) => html`<div class="form prog__summary">
${formTitle(card.left, card.right)}
${card.fields.map((f, i) => html`${formField({ no: i + 1, label: f.label, value: f.estimated ? html`${f.value}${estimateTag}` : f.value, note: f.note })}
`)}</div>`;

// The breadcrumb: the places above the page, then the page itself, marked as the current page and not a link.
export const breadcrumb = (crumbs, name) => html`<nav class="crumbs" aria-label="${t('crumbsLabel')}"><ol>
${crumbs.map((c) => html`<li><a href="${c.href}">${c.label}</a></li>
`)}<li aria-current="page">${name}</li>
</ol></nav>`;
