// The corrections page: the policy (the hub's policy template) with the log as its last section. The log is the dated
// entries in corrections/ (YYYY-MM-DD-<slug>.md, newest first), each rendered from its Markdown; the folder is the
// append-only record tools/ci/change-gate.js guards, and an absent or empty folder is an empty log. Another section
// gives, per site, the date of the CMS file it uses and the date its numbers last changed (ctx.setUpdated).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { has } from '../engine/js/has.js';
import { CORRECTIONS, parseEntry } from '../pipeline/corrections.js';
import { COPY as SHARED } from '../web/copy.js';
import { isoDate } from '../web/render/format.js';
import { html } from '../web/render/html.js';
import { markdownSections } from '../web/render/markdown.js';
import { SITE } from '../web/site.js';
import { CORRECTIONS_EMAIL } from './constants.js';
import { COPY } from './copy.js';
import { para, section, sentence } from './parts.js';

// The dated entries in dir, newest first and by slug within a day: [{ date: 'YYYY-MM-DD', slug, body }]. A .md the
// change gate would not count as an entry (a name that is not corrections/YYYY-MM-DD-<slug>.md with a real date, or
// not a regular file) or one with a blank body stops the build and names the file, rather than show a wrong date or
// nothing. A README.md (which the gate allows), dotfiles and anything whose name does not end in .md (evidence such
// as a PDF or a folder of it, which the gate tolerates) are not entries.
export function readCorrections(dir) {
  let files;
  try {
    files = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const entries = [];
  for (const file of files) {
    const { name } = file;
    if (name.startsWith('.') || /^readme\.md$/i.test(name) || !/\.md$/i.test(name)) continue;
    const parsed = parseEntry(CORRECTIONS + name);
    if (!parsed) throw new RangeError(`${CORRECTIONS}${name} is not an entry: a name is YYYY-MM-DD-<slug>.md, a real date, then lowercase letters, digits and hyphens`);
    if (!file.isFile()) throw new RangeError(`${CORRECTIONS}${name} is not a regular file`);
    const body = readFileSync(join(dir, name), 'utf8').trim();
    if (!body) throw new RangeError(`${CORRECTIONS}${name} is blank`);
    entries.push({ ...parsed, body });
  }
  // Dates are ISO text of one length, so they order as text.
  return entries.sort((a, b) => b.date.localeCompare(a.date) || (a.slug < b.slug ? -1 : 1));
}

// A date (YYYY-MM-DD) as a reader says it, with the machine-readable one beside it.
const time = (iso) => html`<time datetime="${iso}">${isoDate(iso)}</time>`;

// One entry: its date (and its "# " title, if it has one) as the heading, then its Markdown body, escaped. A "## "
// heading in the body sits a level below the date and labels the table under it.
function entryBlock({ date, slug, body }) {
  const { title, sections } = markdownSections(body, { idPrefix: `h-${date}-${slug}`, label: `${CORRECTIONS}${date}-${slug}.md` });
  return html`<article class="pol__entry" id="e-${date}-${slug}">
<h3 class="pol__entry-h">${time(date)}${title ? html` <span class="pol__entry-title">${title}</span>` : ''}</h3>
${sections.map((s) => html`${s.heading ? html`<h4 class="pol__entry-sub" id="${s.id}">${s.heading}</h4>
` : ''}${s.body}
`)}</article>
`;
}

// One site's line: its name, the date of the CMS file it uses and the date its numbers last changed.
function siteLine([id, { cmsReleased, changed }]) {
  if (!has(SITE.sites, id)) throw new RangeError(`corrections: "${id}" is not a site in web/site.js`);
  return html`<li>${sentence('correctionsSite', { cms: time(cmsReleased), changed: time(changed) }, { site: SITE.sites[id].title })}</li>
`;
}

// The page's content for the policy template (pages.js lays it out with the other policy pages). feedback: the page's
// prefilled feedback link. entries: readCorrections' result. updated: ctx.updated (site id -> { cmsReleased,
// changed }); with none, the sites section is left out.
export function correctionsContent({ feedback, entries, updated }) {
  const email = html`<a href="mailto:${CORRECTIONS_EMAIL}">${CORRECTIONS_EMAIL}</a>`;
  const sites = [...updated].map(siteLine);
  return {
    title: SHARED.corrections,
    description: COPY.correctionsDescription,
    brief: [COPY.correctionsBrief1, COPY.correctionsBrief2, COPY.correctionsBrief3, COPY.correctionsBrief4],
    sections: [
      section('report', 'correctionsReportHeading', para('correctionsReport', { feedback, email })),
      section('counts', 'correctionsCountsHeading', para('correctionsCounts')),
      section('hospital', 'correctionsHospitalHeading', para('correctionsHospital')),
      section('process', 'correctionsProcessHeading', para('correctionsProcess'), para('correctionsProcess2')),
      section('cms', 'correctionsCmsHeading', para('correctionsCms')),
      ...(sites.length ? [section('sites', 'correctionsSitesHeading', html`<ul class="pol__list">${sites}</ul>
`)] : []),
      section('log', 'correctionsLogHeading', entries.length ? html`${entries.map(entryBlock)}` : html`<p>${COPY.correctionsLogEmpty}</p>
`),
    ],
  };
}
