// The Readmissions pages' shared parts: the family shell's fields (the section menu to the program page's Parts and
// Methods), and the hospital the header follows.
import { html } from '../../../../web/render/html.js';
import { estTag, formField, formTitle, lastCall } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { fill, t } from '../copy.js';
import { DOLLARS_HREF, METHODS_PATH, PROGRAM_PATH } from '../links.js';

// The program page's Parts the section menu links to, by id (the program page gives each Part its id), then Methods.
export const SECTIONS = Object.freeze(['how', 'picture', 'map', 'history', 'explore', 'research']);

export const labelOf = (id, edition) => (id === 'picture' ? fill('navPicture', { edition }) : t(`nav${id[0].toUpperCase()}${id.slice(1)}`));

// The family shell's fields for a Readmissions page (layout.js page(): sheets, program, sections, current, hospital):
// the site's stylesheet, the Readmissions tab and the numbered section menu, the "picture" Part labeled with the
// edition ("The FY2027 picture"). current: the id to mark, or null. The parts every page of a build shares are built
// once for each current item. edition: the edition's label.
const shellParts = lastCall(({ edition, current }) => [edition, current], ({ edition, current }) => ({
  sheets: ['hrrp'],
  program: 'hrrp',
  sections: [
    ...SECTIONS.map((id) => ({ id, label: labelOf(id, edition), href: `${PROGRAM_PATH}#${id}` })),
    { id: 'methods', label: SHARED.methods, href: METHODS_PATH },
  ],
  current,
}));
export const shellOf = ({ edition, current = null, hospital = null }) => ({ ...shellParts({ edition, current }), hospital });

// The hospital a Readmissions hospital page's header follows (render/shell.js familyHeader): its CCN and name; no
// estimated net (the chip's figure is the family's dollars across programs). Every hospital with a page here is in
// Thirty Day Readmissions' file, so the Readmissions tab opens its page. inHub false: the hub and HACRP have no page for
// it, so the tabs and the chip link none.
export const followed = ({ ccn, name, inHub }) => ({ ccn, name, net: null, inTdr: true, inHub });

// The "estimate" tag after a modeled dollar figure, linked to how the estimate is made.
export const estimateTag = estTag({ href: DOLLARS_HREF, label: t('estimateLabel'), text: t('estimate') });

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
