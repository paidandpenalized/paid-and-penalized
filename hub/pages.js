// The hub: the family's front page (a stub until the hub is built), the methods stub, the policy pages (Terms, privacy,
// About, accessibility, and corrections with its log), the not-found page, and the two files crawlers read: robots.txt
// and sitemap.xml. It runs last, so the sitemap lists every indexable page the sites before it emitted. The hub's own
// pages stay noindex until the hub is built.
import { REPO_ROOT } from '../pipeline/files.js';
import { robotsFor } from '../pipeline/site/context.js';
import { COPY as SHARED } from '../web/copy.js';
import { fillAround, fillCopy } from '../web/render/components.js';
import { escapeHtml, html } from '../web/render/html.js';
import { LINKEDIN, page } from '../web/render/layout.js';
import { SITE } from '../web/site.js';
import { CLOUDFLARE_PRIVACY_URL, CODE_LICENSE, CONTENT_LICENSE, CORRECTIONS_PATH, GOOGLE_PRIVACY_URL, WCAG_VERSION } from './constants.js';
import { COPY } from './copy.js';
import { correctionsPage, readCorrections } from './corrections.js';
import { LINKS, feedbackLink, outside, para, section } from './parts.js';
import { policyPage } from './policy.js';

// The hub is not released: its pages are noindex in every build until it is built.
const RELEASED = false;
const PATH = /^\/[a-z0-9/-]*$/;

// A link to one family site, by its id in web/site.js.
function siteLink(id) {
  const { path, title, subtitle } = SITE.sites[id];
  return html`<a href="${path}">${title} <span class="short">(${subtitle})</span></a>`;
}
const SITE_IDS = Object.keys(SITE.sites);

function home(assets, robots) {
  const body = html`<article class="wrap page home">
<header class="page__head">
<h1 class="home__mark">${SHARED.wordmarkLead} <span class="wordmark__pen">${SHARED.wordmarkPen}</span></h1>
<p class="dek">${COPY.tagline}</p>
</header>
<section class="block" aria-labelledby="sites-h">
<h2 id="sites-h" class="h-sm">${COPY.sitesHeading}</h2>
<ul class="links" role="list">${SITE_IDS.map((id) => html`<li>${siteLink(id)}</li>`)}</ul>
</section>
</article>`;
  return page({ title: COPY.homeTitle, description: COPY.homeDescription, path: '/', robots, body, assets });
}

function methods(assets, robots) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${COPY.methodsTitle}</h1>
<p class="dek">${COPY.methodsIntro}</p>
</header>
<section class="block" id="estimate" aria-labelledby="estimate-h">
<h2 id="estimate-h">${COPY.estimateHeading}</h2>
<p>${COPY.estimateWhat}</p>
<p>${COPY.estimateHow}</p>
<p>${COPY.estimateNot}</p>
</section>
<p>${fillAround((marks) => fillCopy(COPY, 'methodsAiPointer', marks), { about: html`<a href="/about/#ai">${COPY.aboutLink}</a>` })}</p>
</article>`;
  return page({ title: `${COPY.methodsTitle} · ${SITE.name}`, description: COPY.methodsDescription, path: '/methods/', robots, body, assets });
}

// ---------- the policy pages: their words (copy.js) and the links they fill in (parts.js); the layout is policy.js's ----------
// Each page's content, given its feedback link: the title, description, brief lines and sections policyPage lays out.
const terms = (feedback) => ({
  title: COPY.termsTitle,
  description: COPY.termsDescription,
  brief: [COPY.termsBrief1, COPY.termsBrief2, COPY.termsBrief3, COPY.termsBrief4],
  sections: [
    section('what', 'termsWhatHeading', para('termsWhat')),
    section('independent', 'termsAffiliationHeading', para('termsAffiliation')),
    section('numbers', 'termsNumbersHeading', para('termsNumbers'), para('termsEstimate', { estimate: LINKS.estimate })),
    section('advice', 'termsAdviceHeading', para('termsAdvice')),
    section('current', 'termsAsOfHeading', para('termsAsOf')),
    section('reuse', 'termsReuseHeading', para('termsReuse', {}, { contentLicense: CONTENT_LICENSE, codeLicense: CODE_LICENSE })),
    section('warranty', 'termsWarrantyHeading', para('termsWarranty')),
    section('questions', 'termsContactHeading', para('termsContact', { feedback, corrections: LINKS.corrections })),
  ],
});

const privacy = () => ({
  title: COPY.privacyTitle,
  description: COPY.privacyDescription,
  brief: [COPY.privacyBrief1, COPY.privacyBrief2, COPY.privacyBrief3, COPY.privacyBrief4, COPY.privacyBrief5],
  sections: [
    section('reading', 'privacyReadingHeading', para('privacyReading', { cloudflarePolicy: outside(CLOUDFLARE_PRIVACY_URL, COPY.cloudflarePolicy) })),
    section('counting', 'privacyCountingHeading', para('privacyCounting')),
    section('search', 'privacySearchHeading', para('privacySearch')),
    section('feedback', 'privacyFeedbackHeading', para('privacyFeedback', { googlePolicy: outside(GOOGLE_PRIVACY_URL, COPY.googlePolicy) }), para('privacyFeedback2')),
    section('patient-info', 'privacyPhiHeading', para('privacyPhi')),
    section('other-sites', 'privacyLinksHeading', para('privacyLinks')),
  ],
});

const about = (feedback) => ({
  title: COPY.aboutTitle,
  description: COPY.aboutDescription,
  brief: [COPY.aboutBrief1, COPY.aboutBrief2, COPY.aboutBrief3, COPY.aboutBrief4],
  sections: [
    section('what', 'aboutWhatHeading', para('aboutWhat')),
    section('who', 'aboutWhoHeading', para('aboutWho', { linkedin: outside(LINKEDIN, COPY.linkedinLink) })),
    section('coi', 'aboutCoiHeading', para('aboutCoi')),
    section('ai', 'aboutAiHeading', para('aboutAi')),
    section('contact', 'aboutContactHeading', para('aboutContact', { feedback })),
  ],
});

const accessibility = (feedback) => ({
  title: COPY.a11yTitle,
  description: COPY.a11yDescription,
  brief: [fillCopy(COPY, 'a11yBrief1', { version: WCAG_VERSION }), COPY.a11yBrief2, COPY.a11yBrief3, COPY.a11yBrief4],
  sections: [
    section('standard', 'a11yTargetHeading', para('a11yTarget', {}, { version: WCAG_VERSION })),
    section('built-in', 'a11yBuiltHeading', para('a11yBuilt')),
    section('testing', 'a11yTestedHeading', para('a11yTested')),
    section('gaps', 'a11yGapsHeading', html`<ul class="pol__list"><li>${COPY.a11yGap1}</li></ul>
`),
    section('browsers', 'a11yBrowsersHeading', para('a11yBrowsers')),
    section('report', 'a11yReportHeading', para('a11yReport', { feedback })),
  ],
});

const POLICY_PAGES = { '/terms/': terms, '/privacy/': privacy, '/about/': about, '/accessibility/': accessibility };

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
  return page({ title: `${COPY.notFoundTitle} · ${SITE.name}`, description: COPY.notFoundBody, path: '/404.html', address: null, robots, body, assets });
}

// paths: site-relative paths that may be indexed ("/hacrp/", …); only these go in the sitemap.
export function sitemapXml(paths) {
  for (const p of paths) if (!PATH.test(p)) throw new RangeError(`sitemap: bad path "${p}"`);
  const urls = paths.map((p) => `  <url><loc>${escapeHtml(SITE.origin + p)}</loc></url>\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;

// correctionsDir: the folder of dated corrections entries (absent or empty is an empty log); tests pass their own.
export async function generateHub(ctx, { correctionsDir = REPO_ROOT + 'corrections/' } = {}) {
  const { assets } = ctx;
  const robots = robotsFor({ env: ctx.env, released: RELEASED });
  ctx.emit({ path: '/', robots, text: home(assets, robots) });
  ctx.emit({ path: '/methods/', robots, text: methods(assets, robots) });
  for (const [path, content] of Object.entries(POLICY_PAGES)) {
    ctx.emit({ path, robots, text: policyPage({ path, ...content(feedbackLink(path)), assets, robots }) });
  }
  ctx.emit({ path: CORRECTIONS_PATH, robots, text: correctionsPage({ entries: readCorrections(correctionsDir), updated: ctx.updated, assets, robots }) });
  // The not-found page is never indexed, released or not.
  const notFoundRobots = robotsFor({ env: ctx.env, released: RELEASED, eligible: false });
  ctx.emit({ path: '/404.html', robots: notFoundRobots, text: notFound(assets, notFoundRobots) });
  ctx.emit({ path: '/robots.txt', text: robotsTxt() });
  ctx.emit({ path: '/sitemap.xml', text: sitemapXml(ctx.indexable) });
}

export const HUB = { id: 'hub', entries: {}, styles: [], generate: generateHub };
