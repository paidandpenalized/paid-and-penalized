// The family's shell, around every page (layout.js page()): the header (the family bar, the ledger of program tabs
// and, on a program's pages, its numbered section menu) and the footer, the back of the form. Markup only: the look
// is web/styles/shell.css; the shell's script is web/client/shell.js (the theme buttons, the followed hospital, the
// phone's search button, the tabs' scroll), the sticky offset and the section menu's scroll-spy web/client/topbar.js (on
// the header's .topbar class). Icons are CSS masks (tokens.css --icon-*), drawn on empty spans, so the shell holds no
// drawing and no inline style.
import { COPY } from '../copy.js';
import { LISTED_PROGRAMS, SITE, UNLISTED_PROGRAMS, hospitalPathOf, programOf } from '../site.js';
import { fillAround, fillCopy, fillCopyKeep } from './components.js';
import { count, isoDate, money } from './format.js';
import { html } from './html.js';

// A link to another site: it opens in a new tab, and hidden words tell a screen reader so. text: words or markup.
// rel: the link's relations, noopener among them.
const newTab = html`<span class="vh">${COPY.newTab}</span>`;
export const externalLink = (href, text, { rel = 'noopener' } = {}) => html`<a href="${href}" target="_blank" rel="${rel}">${text}${newTab}</a>`;

const icon = (name) => html`<span class="ico ico--${name}" aria-hidden="true"></span>`;
const fill = (key, values) => fillCopy(COPY, key, values);

// The theme toggle, twice on every page: in the bar from 641px, in the footer on a phone (shell.css shows one). Hidden
// in the markup, since it does nothing without its script, which shows it.
const themeToggle = html`<button type="button" class="theme-toggle" aria-pressed="false" hidden>${icon('theme')}<span class="vh">${COPY.themeToggle}</span></button>`;

// The followed hospital's page in a program (hospitalPathOf: 'hub' for its own page), or null when it has none there.
const pageFor = (hospital, id) => hospitalPathOf(id, hospital.ccn, { inTdr: hospital.inTdr, inHub: hospital.inHub });

// The program tabs, in the registry's order: All programs, then the listed programs, the ones with dollar estimates
// (web/site.js). The programs under consideration have no tab; the footer's first field and the front page's directory
// link their placeholder pages. program: the current program's id, or null on the family's own pages (All programs is
// current); on an unlisted program's placeholder page no tab is current. hospital: the followed hospital, or null; with
// one, every tab opens that program's page for it (pageFor), or the program's folder when it has none, and All programs
// opens the hospital's own page (the front page for a hospital without one).
export function programTabs({ program = null, hospital = null } = {}) {
  const hrefOf = (p) => (hospital && pageFor(hospital, p.id)) || p.path;
  const current = (id) => (id === program ? html` aria-current="page"` : '');
  return html`<nav class="wrap tabs" aria-label="${COPY.programs}"><div class="tabs__scroll"><a class="tab" href="${(hospital && pageFor(hospital, 'hub')) || '/'}"${current(null)}>${COPY.allPrograms}</a>${LISTED_PROGRAMS.map((p) => html`<a class="tab" href="${hrefOf(p)}"${current(p.id)}><span>${p.name}</span> <span class="tab__ab">${p.ab}</span></a>`)}</div></nav>`;
}

// The followed hospital's chip: its name to its own page (plain text for a hospital without one), its estimated net (none
// when it has no estimate) and a link that stops following it, to the same program's page without a hospital (its
// folder, or the family's front page on the hub's pages: a page that names a hospital is that hospital's page). Without
// a hospital the chip is empty and hidden, for the shell's script to fill from the link's ?h=.
function chip({ path, hospital, fy }) {
  if (!hospital) return html`<p class="chip" data-chip hidden></p>`;
  const { name, net } = hospital;
  const value = net === null ? '' : html` <span class="chip__v"><span class="vh">${fill('chipNet', { fy: String(fy) })} </span>${money(net, { sign: true })}</span>`;
  const own = pageFor(hospital, 'hub');
  const named = html`<span class="chip__t">${name}</span>${value}`;
  return html`<p class="chip" data-chip><span class="chip__k">${COPY.chipKey}</span>${own ? html`<a class="chip__n" href="${own}">${named}</a>` : html`<span class="chip__n">${named}</span>`}<a class="chip__x" href="${programOf(path)?.path ?? '/'}" aria-label="${fill('chipStop', { name })}">×</a></p>`;
}

// A program's numbered section menu, under the tabs: sections [{ id, label, href }], the current one (an id, or null)
// marked aria-current.
const sectionMenu = (sections, current) => html`<div class="wrap fam__sub"><nav class="nav" aria-label="${COPY.navLabel}"><ol>${sections.map((s, i) => html`<li><a href="${s.href}" data-nav="${s.id}"${s.id === current ? html` aria-current="true"` : ''}><span class="nav__num">${String(i + 1)}</span>${s.label}</a></li>`)}</ol></nav></div>`;

// The header every page wears. Row one, the family bar: the wordmark (to /), the tagline, the followed hospital's chip,
// then the phone's search button, the page's search (markup, or '' for none) and the theme toggle. Row two: the program
// tabs. Row three, on a program's pages: its section menu. Markup order is the visual and tab order at every width.
// The header carries the hub asset's address (the shell's script checks a followed hospital against it) and, on a
// hospital's page, its CCN.
//   path      the page's path
//   program   the current program's id (SITE.programs), or null on the family's own pages
//   hospital  { ccn, name, net: number|null, inTdr, inHub? } or null; inHub false (a hospital the dollar file lacks): it
//             has no hub or HACRP page, so the chip's name, All programs and the HACRP tab link to none
//   sections  [{ id, label, href }] or null; current: a section id or null
//   shell     the build's shell facts (assets.shell)
export function familyHeader({ path, program = null, hospital = null, sections = null, current = null, search = '', shell }) {
  if (program !== null && !SITE.programs.some((p) => p.id === program)) throw new RangeError(`familyHeader: no program "${program}"`);
  if (sections !== null && (!Array.isArray(sections) || !sections.length)) throw new TypeError('familyHeader: sections must be a non-empty list or null');
  if (current !== null && !sections?.some((s) => s.id === current)) throw new RangeError(`familyHeader: no section "${current}"`);
  return html`<header class="topbar fam" data-hub-src="${shell.hubUrl}"${hospital ? html` data-hospital="${hospital.ccn}"` : ''}>
<div class="wrap fam__bar"><a class="wordmark" href="/"><span class="wordmark__lead">${COPY.wordmarkLead}</span> <span class="wordmark__pen">${COPY.wordmarkPen}</span><span class="wordmark__short" aria-hidden="true">${COPY.markLead}<span class="wordmark__pen">${COPY.markPen}</span></span></a><p class="fam__tag">${COPY.tagline}</p>${chip({ path, hospital, fy: shell.fy })}<div class="fam__end"><button type="button" class="fam__find" aria-expanded="false" aria-controls="omni" hidden>${icon('search')}<span class="vh">${COPY.find}</span></button>${search}${themeToggle}</div></div>
${programTabs({ program, hospital })}
${sections ? sectionMenu(sections, current) : ''}</header>`;
}

// A search box: a combobox over a data asset (src) that a site's script mounts (web/client/omnibox.js) and shows; hidden
// without JavaScript. id: the box's own prefix and the form's id (the bar's box is "omni", which the phone's search
// button controls; a page's larger box in its hero is another); the visible find word begins the box's name, findRest
// goes on for screen readers; label names the form and its list; hero: the larger box's class; hub: the box searches the
// family's hospitals and states (data-hub, which hub/client/search.js mounts); only: the one kind of entry it lists
// (data-only, e.g. 'hospital'), or null for every kind.
export const searchForm = ({ id, src, label, find, findRest, placeholder, hero = false, hub = false, only = null }) => html`<form class="omni${hero ? ' omni--hero' : ''}" id="${id}" role="search" aria-label="${label}" data-src="${src}"${hub ? html` data-hub` : ''}${only ? html` data-only="${only}"` : ''} hidden>
<label class="omni__field" for="${id}-q"><span class="omni__label cap">${find}<span class="vh"> ${findRest}</span></span><input id="${id}-q" type="search" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${placeholder}"></label>
<ul class="omni__list" id="${id}-list" role="listbox" aria-label="${label}" hidden></ul>
<p class="vh" role="status" aria-live="polite"></p>
</form>`;

// Each listed program's figure in the footer, from the shell's facts: the estimated dollars, or for value-based
// purchasing the bonuses it moves.
const figureOf = ({ dollars, moved }) => (moved === undefined ? money(dollars) : fill('footMoved', { amount: money(moved) }));

// One field of the footer's form: its number and label (a heading, so a screen reader can jump to it), then its body.
const footField = (no, label, body, cls) => html`<div class="field ft__f ${cls}"><h2 class="field__label"><span class="field__no">${String(no)}</span>${label}</h2>${body}</div>`;

// The footer, the back of the form: one numbered form row, then the signature lines. 1, the programs with their figures
// and, on a line of their own, the ones under consideration; 2, the family's pages; 3, the data's fiscal year, the
// hospitals with an estimate and the day the estimates last changed, with the corrections page (which keeps each site's
// dates); 4, the feedback form. Then the byline and credit, what the data is and is not, the Terms line, the license, the
// form's number and, on a phone, the theme toggle. feedback: the form's address, prefilled for the page (layout.js
// feedbackFor); shell: the build's facts.
// No email address and no promise of a reply, a fix or a deletion.
export function familyFooter({ feedback, shell }) {
  const { fy, hospitals, changed, programs } = shell;
  // A listed program with no figure is a registry edit the facts (hub/model.js shellFacts) did not follow: say which.
  for (const p of LISTED_PROGRAMS) if (!Object.hasOwn(programs, p.id)) throw new RangeError(`familyFooter: the shell's facts have no figure for the listed program "${p.id}" (hub/model.js shellFacts)`);
  const fyText = String(fy);
  // Each figure is an estimate for the fiscal year, said to a screen reader beside it (field 3 says so on screen).
  const estimated = fill('footEstimated', { fy: fyText });
  // The programs under consideration: each separator stays with the program after it, so no line ends on a "·".
  const considered = UNLISTED_PROGRAMS.map((p, i) => {
    const link = html`<a href="${p.path}" title="${p.name}">${p.ab}</a>`;
    return i ? html` <span class="nw">· ${link}</span>` : link;
  });
  const listed = html`<ul class="ft__list" role="list">${LISTED_PROGRAMS.map((p) => html`<li><a href="${p.path}">${p.name} <span class="ft__ab">${p.ab}</span></a> <span class="ft__v"><span class="vh">${estimated} </span>${figureOf(programs[p.id])}</span></li>`)}</ul>
<p class="ft__soon">${COPY.footConsidered} ${considered}</p>`;
  const site = html`<ul class="ft__links" role="list">${Object.entries(SITE.pages).map(([name, href]) => html`<li><a href="${href}">${name === 'terms' ? COPY.termsLink : COPY[name]}</a></li>`)}</ul>`;
  const asOf = html`<p>${fillAround((marks) => fill('footEstimates', { ...marks, n: count(hospitals) }), { fy: html`<span class="ft__fy">${fill('footFy', { fy: fyText })}</span>` })}</p>
<p class="ft__note">${fillCopyKeep(COPY, 'footChanged', { date: isoDate(changed) }, ['date'])}<br><a href="${SITE.pages.corrections}">${COPY.footDates}</a></p>
<span class="stamp stamp--ink ft__stamp" aria-hidden="true">${COPY.footStamp}</span>`;
  const fb = html`${externalLink(feedback, html`${COPY.feedback}${icon('arrow')}`)}<p class="ft__note">${COPY.footFeedbackNote}</p>`;
  return html`<footer class="foot">
<div class="wrap">
<div class="form ft">
${footField(1, COPY.programs, listed, 'ft__progs')}
${footField(2, COPY.footSite, site, 'ft__site')}
${footField(3, COPY.footAsOf, asOf, 'ft__asof')}
${footField(4, COPY.footFeedback, fb, 'ft__fb')}
</div>
<div class="ft__base">
<p>${COPY.bylineLead} ${externalLink(SITE.linkedin, html`<span class="nw">${COPY.bylineName}</span>`)} · ${COPY.builtWith}</p>
<p>${COPY.affiliation}</p>
<p>${COPY.termsShort} <a href="${SITE.pages.terms}">${COPY.termsLink}</a></p>
<p>${COPY.licenseLead} ${externalLink(SITE.license.content.url, SITE.license.content.name, { rel: 'license noopener' })}</p>
<p class="ft__form">${fill('footForm', { yy: fyText.slice(-2), fy: fyText })}</p>
${themeToggle}
</div>
</div>
</footer>`;
}
