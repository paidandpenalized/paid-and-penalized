// The page body of a hospital outside Medicare's penalty programs (hub/outside.js outsideHospitals: a hospital in the
// hospital master that the dollar file does not estimate), at /hospital/<ccn>/ like every hub hospital page (page.js
// dispatches to it). Server-drawn, in this order: the hero (the record card; the stamp, unless a program file lists the
// hospital; why the programs don't adjust its pay, from the master's reason code for each program; the program pages it
// has; the note on a hospital whose Medicare agreement has ended), the Medicaid band where the scenario file has a row,
// the nearest hospitals in the programs and the hospitals like this one (each a figure block its own module draws, '' for
// none), and the source line (the dollar model in it only beside the nearest hospitals' dollars).
import { fillCopy } from '../../web/render/components.js';
import { endedBy } from '../../web/render/closed.js';
import { html } from '../../web/render/html.js';
import { COPY } from './copy.js';
import { medicaidBand } from './medicaid.js';
import { fillOutside, hasOutside } from './outside-copy.js';
import { closed, deepLink, recordCard } from './record.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// The groups of federal hospitals, which Medicare doesn't pay: their reason says so and no "instead" follows.
const FEDERAL = new Set(['va', 'dod']);

// The stamp's markup, with a line break (hidden on a phone, styles.css .hh__br-wide) before "penalty", so the box fits two
// short lines on a wide screen. The same on every page, so drawn once, when first needed.
let stampMarkup = null;
function stampText() {
  if (!stampMarkup) {
    const text = fillOutside('stamp');
    const at = text.indexOf(' penalty');
    if (at < 0) throw new RangeError('outside: the stamp has no "penalty" to break before');
    stampMarkup = html`${text.slice(0, at)} <br class="hh__br-wide">${text.slice(at + 1)}`;
  }
  return stampMarkup;
}

// The line for a program's file not listing the hospital. Readmissions, in Puerto Rico: the program's own reason (it covers
// the fifty states and DC); elsewhere, the file that leaves it out.
function notListedLine(h, id, years) {
  if (id === 'hacrp') return fillOutside('notListedHacrp', { hacrpFy: years.hacrpFy });
  return h.state === 'PR' ? fillOutside('notInHrrpPuertoRico') : fillOutside('notListedHrrp', { hrrpFy: years.hrrpFy });
}

// Why the programs don't adjust the hospital's pay, a paragraph each, from the master's reason code for each program
// (h.reasons). The same code for both: one paragraph (its group's reason, then how Medicare pays it instead where there's
// a line for that), except "not listed", which names each file and its year, and "inactive", which leaves it to the closed
// note. Codes that differ: a line for each program that gives one. years: { hacrpFy, hrrpFy }, as text.
export function reasonLines(h, years) {
  const { hacrp, hrrp } = h.reasons;
  if (hacrp === hrrp) {
    if (hacrp === 'inactive') return [];
    if (hacrp === 'not_listed') return h.state === 'PR' ? ['hacrp', 'hrrp'].map((id) => notListedLine(h, id, years)) : [fillOutside('notListedBoth', years)];
    return [[`reason.${h.group}`, `reasonInstead.${h.group}`].filter(hasOutside).map((key) => fillOutside(key)).join(' ')];
  }
  // Codes that differ: only "not listed" has a line of its own per program; any other pair of codes stops the build rather
  // than guess at a reason.
  return [['hacrp', hacrp], ['hrrp', hrrp]].filter(([, code]) => code !== null).map(([id, code]) => {
    if (code !== 'not_listed') throw new RangeError(`outside: ${h.ccn}: no wording for a ${id} reason of ${JSON.stringify(code)} that differs from the other program's`);
    return notListedLine(h, id, years);
  });
}

// The source line: the hospital master's files and the program files that place it, and the dollar model only where the
// page shows dollars (the nearest hospitals' figure, near). years: { hacrpFy, hrrpFy }, as text.
const sourceNote = (years, dollars) => html`<div class="wrap"><div class="hh__notes">
<p>${fillOutside('sourceOutside', years)}${dollars ? html` ${fillOutside('sourceOutsideDollars')}` : ''}</p></div></div>`;

// The page's description: why the programs don't adjust its pay (and how Medicare pays it instead, for a group with a
// line for that), or, for a federal, an unlisted or a closed hospital, what the page holds. place: { name, place }; fy: the
// shell's fiscal year (text). "Closed" exactly when the body shows the closed note (endedBy, as record.js closed tests).
export function outsideDescription(h, place, fy) {
  if (endedBy(h.inactive, Number(fy))) return fillOutside('descriptionOutsideClosed', place);
  if (FEDERAL.has(h.group)) return fillOutside('descriptionOutsideFederal', place);
  if (h.group === 'not_listed') return fillOutside('descriptionOutsideNotListed', place);
  if (!hasOutside(`reasonInstead.${h.group}`)) throw new RangeError(`outside: no description for group ${h.group}`);
  return fillOutside('descriptionOutside', place);
}

// The body. h: an OutsideHospital; master: its master record; fy: the shell's fiscal year (text); programYears: the
// master's { hacrp, hrrp } (loadHub().programYears), the years its reason codes are for; medicaid: loadHub().medicaid;
// near, like: the figure blocks of the nearest hospitals in the programs and of the hospitals like this one ('' for none).
export function outsideBody(h, { master, fy, programYears, medicaid, near = '', like = '' }) {
  if (!Number.isInteger(programYears?.hacrp) || !Number.isInteger(programYears?.hrrp)) throw new TypeError('outside: programYears needs the master\'s HACRP and HRRP years');
  const years = { hacrpFy: String(programYears.hacrp), hrrpFy: String(programYears.hrrp) };
  // The Medicaid band, where the scenario file has a row. Its dek says Medicare's penalty programs don't touch the hospital,
  // so a hospital a program file lists keeps the default.
  const band = medicaidBand(h, medicaid, { net: false, note: h.listed ? null : fillOutside('wbNoteOutside') });
  // Its program pages: Readmissions where that site has one (never a hospital-acquired conditions page: the HACRP site has
  // pages only for the dollar file's hospitals). The work-requirement page is linked by the band alone, which shows for
  // every hospital the scenario file has a row for. No pages: no list.
  const links = [h.inHrrp && deepLink(h, 'hrrp')].filter(Boolean);
  const stamped = !h.listed;
  // An inactive-group hospital has no reason line: the closed note is its explanation. Its wording holds only for an end
  // by the year's end (web/render/closed.js endedBy), so a later end stops the build rather than leave a bare stamp.
  const note = closed(h, master, fy, { kept: false });
  if (h.group === 'inactive' && !note) throw new RangeError(`outside: ${h.ccn}: an inactive-group hospital whose Medicare agreement did not end by the end of FY${fy} has no closed note to explain its page`);
  return html`<article class="hh hh--none hh--out" data-ccn="${h.ccn}">
<div class="wrap hh__hero">
${recordCard(h, master, fy)}
<div class="hh__none${stamped ? '' : ' hh__none--plain'}">
<section class="hh__status"${stamped ? html` aria-labelledby="hh-status-h"` : ''}>
${stamped ? html`<h2 class="stamp stamp--ink hh__sh hh__sh--fit" id="hh-status-h">${stampText()}</h2>` : ''}
${reasonLines(h, years).map((line) => html`<p class="hh__st">${line}</p>`)}
</section>
${links.length ? html`<section class="hh__pages" aria-labelledby="hh-pages-h">
<h2 class="h-sm" id="hh-pages-h">${fill('pagesHeading')}</h2>
<ul class="hh__plist" role="list">${links.map((link) => html`<li>${link}</li>`)}</ul>
</section>` : ''}
${note}
</div>
</div>
${band}${near}${like}${sourceNote(years, near !== '')}
</article>`;
}
