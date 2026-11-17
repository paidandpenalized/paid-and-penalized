// The parts every hospital page across the programs shares (hub/hospital/page.js, and outside.js for a hospital outside
// the penalty programs): the record card at the top (the hospital, the page's h1; where it is; what it is, from the
// hospital master; its CCN, on the family's form), the links to its pages in the programs, the note on a hospital whose
// Medicare agreement has ended, and the source lines at the foot.
import { has } from '../../engine/js/has.js';
import { fillCopy, formField, formTitle } from '../../web/render/components.js';
import { closedNoteMarkup } from '../../web/render/closed.js';
import { count, dotList, placeText, unbroken } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { hospitalPathOf, programById, underConstruction } from '../../web/site.js';
import { arrow } from '../parts.js';
import { COPY } from './copy.js';

const fill = (key, values) => fillCopy(COPY, key, values);

const TEACH = { major: 'typeTeachMajor', minor: 'typeTeachMinor', none: 'typeTeachNone' };
// The kind's word, for a kind with one (typeKind.<kind>: not a short-term acute care hospital, nor one of unknown kind),
// else null.
const kindText = (kind) => (kind && has(COPY, `typeKind.${kind}`) ? fill(`typeKind.${kind}`) : null);

// The Type field: what the master knows (its kind where that isn't acute care, teaching, beds, ownership, urban or rural),
// or null when it knows none of it. An ownership the master calls Unknown says nothing, so it is left out.
function typeText(h, master) {
  const own = master?.own && master.own !== 'Unknown' ? master.own : null;
  const parts = [
    kindText(master?.kind),
    TEACH[h.teach] && fill(TEACH[h.teach]),
    Number.isInteger(h.beds) && unbroken(fill('typeBeds', { beds: count(h.beds) })),
    own,
    typeof master?.urban === 'boolean' ? fill(master.urban ? 'typeUrban' : 'typeRural') : null,
  ].filter(Boolean);
  return parts.length ? dotList(parts) : null;
}

// The record card's first fields: the hospital (the page's h1), where it is and what it is. h: { name, city, state, teach,
// beds } (the hub hospital, or the same fields from the master); master: its master record, or null.
function recordSpecs(h, master) {
  const type = typeText(h, master);
  return [
    { label: fill('fieldHospital'), value: h.name, as: 'h1', cls: 'hh__name', wide: true },
    { label: fill('fieldLocation'), value: placeText(h), wide: !type },
    type && { label: fill('fieldType'), value: type, size: 'sm' },
  ].filter(Boolean);
}

export function recordCard(h, master, fy) {
  return html`<div class="form hh__card">
${formTitle(fill('recordTitle', { fy }), fill('recordCcn', { ccn: h.ccn }))}
${recordSpecs(h, master).map((spec, i) => formField({ no: i + 1, ...spec }))}
</div>`;
}

// ---------- the links, the closed note and the notes ----------

// The hospital's page in a program, or null when it has none there. Every hospital in the dollar file has a
// hospital-acquired conditions page (the dollar file has a row for each hospital in that program's file), and one
// the Readmissions file lists (inHrrp) has a Readmissions page (sites/hrrp/). Not for a hospital outside the dollar file
// (outside.js), which has no hospital-acquired conditions page.
export const pageOf = (h, id) => hospitalPathOf(id, h.ccn, { inHrrp: h.inHrrp });

// A program row's link: to the hospital's page there; else to the program's folder, which holds its placeholder page (a
// program with no page here: hub/coming.js) or is the program's own page (one with pages for other hospitals but not this
// one).
export function deepLink(h, id) {
  const program = programById(id);
  const { name, path } = program;
  const own = pageOf(h, id);
  if (own) return html`<a class="hh__deep" href="${own}">${fill('deepHospital', { name })}${arrow}</a>`;
  return underConstruction(program)
    ? html`<a class="hh__deep hh__deep--soon" href="${path}">${fill('deepNotBuilt', { name })}</a>`
    : html`<a class="hh__deep" href="${path}">${fill('deepProgram', { name })}${arrow}</a>`;
}

// The note on a hospital whose Medicare agreement CMS lists as ended by the year's end (web/render/closed.js; its master
// record's `inactive`), on its net (none for a hospital with no estimate): '' for any other. Its tail, on what the net
// likely was, is a span of its own: the what-if hides it under a scenario that moves the net, as it hides the likely range.
// kept: whether the site's totals count the hospital (false outside the dollar file: the note then doesn't say they do).
export function closed(h, master, fy, { kept = true } = {}) {
  const note = closedNoteMarkup({ ccn: h.ccn, inactive: master?.inactive ?? null, fy: Number(fy), dollars: h.est?.net ?? 0, kept }, 'hh__closed-tail');
  return note ? html`<p class="hh__closed">${note}</p>` : '';
}

// The source line, and with dollars on the page, what they are and the fairness line.
export const notes = (fy, dollars) => html`<div class="wrap"><div class="hh__notes">
<p>${fill('source', { fy })}${dollars ? html` ${fill('sourceDollars', { fy })}` : ''}</p>
${dollars ? html`<p>${fill('fairness')}</p>` : ''}</div></div>`;
