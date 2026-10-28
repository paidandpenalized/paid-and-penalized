// The hub: the family's front page (hub/home/: the masthead and the story, built from the dollar estimates), the methods
// stub, the policy pages (Terms, privacy, About, accessibility, and corrections with its log), a coming-soon page per program
// still to come (coming.js), every hospital's page across the programs (hospital/page.js), the interim Readmissions
// pages (hrrp/page.js: /hrrp/ and a page per hospital in the pinned Thirty Day Readmissions file), the not-found page, and
// the two files crawlers read: robots.txt and sitemap.xml. It runs last, so the sitemap lists every indexable page the
// sites before it emitted. The hub's own pages stay noindex until the hub is released.
import { REPO_ROOT } from '../pipeline/files.js';
import { NOT_FOUND_PATH } from '../pipeline/site/address.js';
import { robotsFor } from '../pipeline/site/context.js';
import { COPY as SHARED } from '../web/copy.js';
import { escapeHtml, html } from '../web/render/html.js';
import { externalLink } from '../web/render/layout.js';
import { PLACEHOLDER_PROGRAMS, SITE, hospitalPathOf } from '../web/site.js';
import { CLOUDFLARE_PRIVACY_URL, GOOGLE_PRIVACY_URL, WCAG_VERSION } from './constants.js';
import { COPY } from './copy.js';
import { correctionsContent, readCorrections } from './corrections.js';
import { comingPage } from './coming.js';
import { loadHub } from './data.js';
import { homePage } from './home/page.js';
import { hospitalPage } from './hospital/page.js';
import { hrrpHospitalPage, hrrpProgramPage } from './hrrp/page.js';
import { hubHospitals, masterRecord, stateTotals, storyFacts } from './model.js';
import { LINKS, feedbackLink, hubPage, para, section, sentence } from './parts.js';
import { policyPage } from './policy.js';

const PATH = /^\/[a-z0-9/-]*$/;

// A link to one family site, by its id in web/site.js.
function siteLink(id) {
  const { path, title, subtitle } = SITE.sites[id];
  return html`<a href="${path}">${title} <span class="short">(${subtitle})</span></a>`;
}
const SITE_IDS = Object.keys(SITE.sites);

// The front page (hub/home/page.js), from every hub hospital and the atlas's state shapes (data.js loadHub).
function home({ hospitals, shapes, assets, robots }) {
  return homePage({ hospitals, facts: storyFacts(hospitals), states: stateTotals(hospitals), shapes, assets, robots });
}

function methods(assets, robots) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${SHARED.methods}</h1>
<p class="dek">${COPY.methodsIntro}</p>
</header>
<section class="block" id="estimate" aria-labelledby="estimate-h">
<h2 id="estimate-h">${COPY.estimateHeading}</h2>
<p>${COPY.estimateWhat}</p>
<p>${COPY.estimateHow}</p>
<p>${COPY.estimateNot}</p>
</section>
${para('methodsAiPointer', { about: LINKS.ai })}</article>`;
  return hubPage({ title: `${SHARED.methods} · ${SITE.name}`, description: COPY.methodsDescription, path: SITE.pages.methods, robots, body, assets });
}

// ---------- the policy pages: their words (copy.js) and the links they fill in (parts.js); the layout is policy.js's ----------
// Each page's content: the title, description, brief lines and sections policyPage lays out, given what the build
// hands every page (deps): its feedback link, the corrections entries and the sites' dates.
const terms = ({ feedback }) => ({
  title: SHARED.termsLink,
  description: COPY.termsDescription,
  brief: [COPY.termsBrief1, COPY.termsBrief2, COPY.termsBrief3, COPY.termsBrief4],
  sections: [
    section('what', 'termsWhatHeading', para('termsWhat')),
    section('affiliation', 'termsAffiliationHeading', para('termsAffiliation')),
    section('numbers', 'termsNumbersHeading', para('termsNumbers'), para('termsEstimate', { estimate: LINKS.estimate })),
    section('advice', 'termsAdviceHeading', para('termsAdvice')),
    section('current', 'termsAsOfHeading', para('termsAsOf')),
    section('reuse', 'termsReuseHeading', para('termsReuse', {}, { contentLicense: SITE.license.content.name, codeLicense: SITE.license.code.name })),
    section('warranty', 'termsWarrantyHeading', para('termsWarranty')),
    section('questions', 'termsContactHeading', para('termsContact', { feedback, corrections: LINKS.corrections })),
  ],
});

const privacy = () => ({
  title: SHARED.privacy,
  description: COPY.privacyDescription,
  brief: [COPY.privacyBrief1, COPY.privacyBrief2, COPY.privacyBrief3, COPY.privacyBrief4, COPY.privacyBrief5],
  sections: [
    section('reading', 'privacyReadingHeading', para('privacyReading', { cloudflarePolicy: externalLink(CLOUDFLARE_PRIVACY_URL, COPY.cloudflarePolicy) })),
    section('counting', 'privacyCountingHeading', para('privacyCounting')),
    section('search', 'privacySearchHeading', para('privacySearch')),
    section('feedback', 'privacyFeedbackHeading', para('privacyFeedback', { googlePolicy: externalLink(GOOGLE_PRIVACY_URL, COPY.googlePolicy) }), para('privacyFeedback2')),
    section('patient-info', 'privacyPhiHeading', para('privacyPhi')),
    section('other-sites', 'privacyLinksHeading', para('privacyLinks')),
  ],
});

const about = ({ feedback }) => ({
  title: SHARED.about,
  description: COPY.aboutDescription,
  brief: [COPY.aboutBrief1, COPY.aboutBrief2, COPY.aboutBrief3, COPY.aboutBrief4],
  sections: [
    section('what', 'aboutWhatHeading', para('aboutWhat')),
    section('who', 'aboutWhoHeading', para('aboutWho', { linkedin: externalLink(SITE.linkedin, COPY.linkedinLink) })),
    section('coi', 'aboutCoiHeading', para('aboutCoi'), para('aboutCoi2'), para('aboutCoi3')),
    section('ai', 'aboutAiHeading', para('aboutAi')),
    section('contact', 'aboutContactHeading', para('aboutContact', { feedback })),
  ],
});

const accessibility = ({ feedback }) => ({
  title: SHARED.accessibility,
  description: COPY.a11yDescription,
  brief: [sentence('a11yBrief1', {}, { version: WCAG_VERSION }), COPY.a11yBrief2, COPY.a11yBrief3, COPY.a11yBrief4],
  sections: [
    section('standard', 'a11yTargetHeading', para('a11yTarget', {}, { version: WCAG_VERSION })),
    section('built-in', 'a11yBuiltHeading', para('a11yBuilt')),
    section('testing', 'a11yTestedHeading', para('a11yTested')),
    section('gaps', 'a11yGapsHeading', html`<ul class="pol__list">${['a11yGap1', 'a11yGap2', 'a11yGap3', 'a11yGap4'].map((key) => html`<li>${COPY[key]}</li>`)}</ul>
`),
    section('browsers', 'a11yBrowsersHeading', para('a11yBrowsers')),
    section('report', 'a11yReportHeading', para('a11yReport', { feedback })),
  ],
});

const POLICY_PAGES = [
  [SITE.pages.terms, terms], [SITE.pages.privacy, privacy], [SITE.pages.about, about],
  [SITE.pages.accessibility, accessibility], [SITE.pages.corrections, correctionsContent],
];

function notFound(assets, robots) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${COPY.notFoundTitle}</h1>
<p class="dek">${COPY.notFoundBody}</p>
</header>
<ul class="links" role="list">
<li><a href="/">${COPY.notFoundHome}</a></li>
${SITE_IDS.map((id) => html`<li>${siteLink(id)}</li>
`)}</ul>
</article>`;
  return hubPage({ title: `${COPY.notFoundTitle} · ${SITE.name}`, description: COPY.notFoundBody, path: NOT_FOUND_PATH, address: null, robots, body, assets });
}

// paths: site-relative paths that may be indexed ("/hacrp/", …); only these go in the sitemap.
export function sitemapXml(paths) {
  for (const p of paths) if (!PATH.test(p)) throw new RangeError(`sitemap: bad path "${p}"`);
  const urls = paths.map((p) => `  <url><loc>${escapeHtml(SITE.origin + p)}</loc></url>\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;

// Every hospital's page (hospital/page.js), at hospitalPathOf('hub', ccn). A hospital with an estimate has the hub's
// robots value; one without (Maryland's, or no inputs) is never indexed (never): its page holds no figures.
function hospitalPages(ctx, { hospitals, master, robots, never }) {
  if (!hospitals.length) return;
  const facts = storyFacts(hospitals);
  for (const h of hospitals) {
    const r = h.est ? robots : never;
    ctx.emit({ path: hospitalPathOf('hub', h.ccn), robots: r, text: hospitalPage({ h, hospitals, facts, assets: ctx.assets, robots: r, master: master.get(h.ccn) ?? null }) });
  }
}

// The interim Readmissions pages: /hrrp/ and a page for each hospital in the pinned Thirty Day Readmissions file, at
// hospitalPathOf('hrrp', ccn, { inTdr: true }). A hospital the dollar file has is joined to its hub hospital (hospitals: its
// estimate); one it lacks (the file has a few) is built from the master alone. With a list of hospitals given (a test's
// slice), only the pinned hospitals in it get a page. Never indexed, released or not: these slim pages stand in for the
// program's own site and say so, and the full explorer is the page to find. The sitemap leaves them out.
function hrrpPages(ctx, { tdr, hospitals, only, master, never }) {
  const { assets } = ctx;
  ctx.emit({ path: SITE.programs.find((p) => p.id === 'hrrp').path, robots: never, text: hrrpProgramPage({ tdr, assets, robots: never }) });
  const byCcn = new Map(hospitals.map((h) => [h.ccn, h]));
  for (const record of tdr.hospitals.values()) {
    if (only && !only.has(record.id)) continue;
    const text = hrrpHospitalPage({ record, tdr, master: masterRecord(master, record.id), h: byCcn.get(record.id) ?? null, assets, robots: never });
    ctx.emit({ path: hospitalPathOf('hrrp', record.id, { inTdr: true }), robots: never, text });
  }
}

// updated: each program site's two dates, by id (build.js collects them from the sites run before the hub); the
// corrections page lists them. correctionsDir: the folder of dated corrections entries (absent or empty is an empty
// log); tests pass their own. hospitals and master: the hospitals that get a page (model.js hubHospitals) and their master
// records by CCN, read once from the newest files (data.js loadHub) unless a test passes its own (no hospitals: no
// hospital pages and no interim Readmissions page for a hospital; /hrrp/ is always written). The front page always tells
// the newest files' whole story.
export async function generateHub(ctx, { updated = new Map(), correctionsDir = REPO_ROOT + 'corrections/', hospitals = null, master = null } = {}) {
  const { assets } = ctx;
  const robots = robotsFor({ env: ctx.env, released: SITE.hub.released });
  const hub = loadHub();
  const all = hubHospitals(hub);
  ctx.emit({ path: '/', robots, text: home({ hospitals: all, shapes: hub.shapes, assets, robots }) });
  ctx.emit({ path: SITE.pages.methods, robots, text: methods(assets, robots) });
  const deps = { entries: readCorrections(correctionsDir), updated };
  for (const [path, content] of POLICY_PAGES) {
    ctx.emit({ path, robots, text: policyPage({ path, ...content({ ...deps, feedback: feedbackLink(path) }), assets, robots }) });
  }
  // The not-found page and the programs' placeholders are never indexed, released or not.
  const never = robotsFor({ env: ctx.env, released: SITE.hub.released, eligible: false });
  const facts = storyFacts(all);
  for (const program of PLACEHOLDER_PROGRAMS) ctx.emit({ path: program.path, robots: never, text: comingPage({ program, facts, assets, robots: never }) });
  hospitalPages(ctx, { hospitals: hospitals ?? all, master: master ?? hub.master, robots, never });
  hrrpPages(ctx, { tdr: hub.tdr, hospitals: hospitals ?? all, only: hospitals && new Set(hospitals.map((h) => h.ccn)), master: master ?? hub.master, never });
  ctx.emit({ path: NOT_FOUND_PATH, robots: never, text: notFound(assets, never) });
  ctx.emit({ path: '/robots.txt', text: robotsTxt() });
  ctx.emit({ path: '/sitemap.xml', text: sitemapXml(ctx.indexable) });
}

// entries: the family search (hub/client/search.js), which a page lists in its scripts when it holds the search box
// (hubPage does, for every hub page), the home page's story (hub/client/home.js), and a hospital page's swarm, peer
// toggle, strips and peer table (hub/client/hospital.js; pages with an estimate only). styles: the hub's own pages'
// styles (each page's rules under its root class).
export const HUB = { id: 'hub', entries: { 'hub-search': 'hub/client/search.js', 'hub-home': 'hub/client/home.js', 'hub-hospital': 'hub/client/hospital.js' }, styles: ['hub/styles.css'], generate: generateHub };
