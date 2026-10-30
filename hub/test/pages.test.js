import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '../../pipeline/site/context.js';
import { tags, textOf } from '../../pipeline/site/html.js';
import { ASSETS, headerOf, withTemp } from '../../pipeline/test/helpers.js';
import { COPY as SHARED } from '../../web/copy.js';
import { fillCopy } from '../../web/render/components.js';
import { escapeHtml, html, raw } from '../../web/render/html.js';
import { externalLink, feedbackHref } from '../../web/render/layout.js';
import { PLACEHOLDER_PROGRAMS, SITE } from '../../web/site.js';
import { CLOUDFLARE_PRIVACY_URL, GOOGLE_PRIVACY_URL, WCAG_VERSION } from '../constants.js';
import { loadHub } from '../data.js';
import { hubHospitals } from '../model.js';
import { COPY } from '../copy.js';
import { generateHub, sitemapXml } from '../pages.js';
import { policyPage } from '../policy.js';
import { hubSearchForm } from '../search/form.js';

const NOINDEX = '<meta name="robots" content="noindex">';

test('the hub writes the home page, /methods/, the policy pages, the 404 page, robots.txt and a sitemap of the pages emitted indexable', () =>
  withTemp('pp-hub-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    ctx.emit({ path: '/hacrp/', robots: null, text: 'a' });
    ctx.emit({ path: '/hacrp/hospital/990001/', robots: null, text: 'b' });
    ctx.emit({ path: '/hacrp/hospital/990002/', robots: 'noindex', text: 'c' });
    await generateHub(ctx, { released: true });
    // The three pages before, the home page, /methods/, the 404 page, the five policy pages, a placeholder per program
    // still to come, a page per hospital in the dollar file, and the interim Readmissions pages (/hrrp/ and one per hospital
    // in the pinned file). The hub released: its home page, Methods, policy pages and hospital pages with an estimate
    // (one without has no figures) are indexable; the 404 page, the placeholders and the interim pages never are.
    const hub = loadHub();
    assert.equal(ctx.pages, 3 + 3 + 5 + PLACEHOLDER_PROGRAMS.length + hub.dollars.hospitals.length + 1 + hub.tdr.hospitals.size);
    assert.deepEqual(ctx.indexable.filter((p) => p.startsWith('/hacrp/')), ['/hacrp/', '/hacrp/hospital/990001/']);
    const hubIndexable = ctx.indexable.filter((p) => !p.startsWith('/hacrp/'));
    assert.equal(hubIndexable.filter((p) => p.startsWith('/hospital/')).length, hubHospitals(hub).filter((h) => h.est).length);
    assert.deepEqual(hubIndexable.filter((p) => !p.startsWith('/hospital/')).sort(), ['/', ...Object.values(SITE.pages)].sort());
    const read = (f) => readFileSync(join(dir, f), 'utf8');

    // The home page is the story (hub/test/home.test.js has its parts): the masthead, then the story's steps and stage.
    const home = read('index.html');
    assert.ok(home.includes('Public Medicare data, made visible.'));
    assert.match(home, /<h1 class="hero__mark"/);
    assert.match(home, /<div class="story" data-story>[\s\S]*<div class="stage" data-stage>/);
    assert.ok(home.includes(`<title>${escapeHtml(SITE.name)}</title>`));

    const methods = read('methods/index.html');
    assert.match(methods, /id="estimate"/);
    // The AI paragraph lives on /about/; Methods points there.
    assert.doesNotMatch(methods, /id="ai"/);
    assert.doesNotMatch(methods, /deterministic code/);
    assert.match(methods, /href="\/about\/#ai"/);
    // Its description says what the page covers now that the AI paragraph is on /about/.
    assert.ok(methods.includes(`<meta name="description" content="${escapeHtml(COPY.methodsDescription)}">`));

    const notFound = read('404.html');
    assert.match(notFound, /href="\/"/);
    assert.match(notFound, /href="\/hacrp\/"/);
    // Served at every missing address, it has none of its own: no canonical link, no og:url, no page in the feedback link.
    assert.doesNotMatch(notFound, /rel="canonical"|og:url/);
    assert.ok(notFound.includes(`href="${escapeHtml(feedbackHref({ siteName: SITE.name }))}"`));

    assert.ok(notFound.includes(NOINDEX), 'the 404 page is never indexed');
    for (const text of [home, methods]) assert.ok(!text.includes(NOINDEX), 'a released hub\'s pages may be indexed');
    for (const text of [home, methods, notFound]) {
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1);
    }

    assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://paidandpenalized.org/sitemap.xml\n');
    const sitemap = read('sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/paidandpenalized\.org\/hacrp\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/paidandpenalized\.org\/hacrp\/hospital\/990001\/<\/loc>/);
    assert.equal(sitemap.match(/<url>/g).length, ctx.indexable.length);
  }));

test('released: false: no hub page is indexable in production, and the sitemap lists none', () =>
  withTemp('pp-hub-unreleased-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    await generateHub(ctx, { correctionsDir: join(dir, 'no-corrections'), released: false });
    assert.deepEqual(ctx.indexable, []);
    for (const f of ['index.html', 'methods/index.html', 'terms/index.html']) assert.ok(readFileSync(join(dir, f), 'utf8').includes(NOINDEX), f);
    assert.doesNotMatch(readFileSync(join(dir, 'sitemap.xml'), 'utf8'), /<url>/);
  }));

test('every hub page holds the family search in its bar, over the hub\'s asset, and loads its script', () =>
  withTemp('pp-hub-search-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    await generateHub(ctx, { correctionsDir: join(dir, 'no-corrections'), hospitals: [] });
    const paths = ['/', ...Object.values(SITE.pages), ...PLACEHOLDER_PROGRAMS.map((p) => p.path)];
    const files = [...paths.map((path) => [path, join(dir, path, 'index.html')]), ['not found', join(dir, '404.html')]];
    const box = String(hubSearchForm(ASSETS.shell.hubUrl));
    assert.match(box, /^<form class="omni" id="omni" role="search" aria-label="Search hospitals and states" data-src="\/assets\/hub-hospitals\.test\.json" data-hub hidden>/);
    for (const [path, file] of files) {
      const text = readFileSync(file, 'utf8');
      const header = headerOf(text);
      // In the bar's end, between the phone's find button and the theme toggle; the only search on the page but the front
      // page, whose story's last step holds a second over the same asset (hub/test/home.test.js).
      assert.ok(header.includes(box), `${path}: the family search in the bar`);
      assert.ok(header.indexOf('class="fam__find"') < header.indexOf(box) && header.indexOf(box) < header.indexOf('class="theme-toggle"'), `${path}: search between the find button and the toggle`);
      assert.equal(text.match(/role="search"/g).length, path === '/' ? 2 : 1, `${path}: its searches`);
      assert.ok(text.includes(`<script type="module" src="${ASSETS.js['hub-search']}"></script>`), `${path}: loads the family search's script`);
      assert.doesNotMatch(header, /data-hospital|<p class="chip" data-chip>/, `${path}: follows no hospital of its own`);
    }
  }));

test('an empty sitemap is a valid empty urlset; a path that is not a plain site path is refused', () => {
  assert.doesNotMatch(sitemapXml([]), /<url>/);
  assert.match(sitemapXml([]), /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n<\/urlset>\n$/);
  for (const bad of ['hacrp/', '/a b/', '/x?y', '/<x>/', 'https://elsewhere.example/']) assert.throws(() => sitemapXml([bad]), RangeError, bad);
});

// ---------- the policy pages ----------
// Each page's path, title, and the stem its copy keys start with (termsBrief1, termsWhatHeading, ...).
const POLICY = [
  { path: '/terms/', title: SHARED.termsLink, stem: 'terms' },
  { path: '/privacy/', title: SHARED.privacy, stem: 'privacy' },
  { path: '/about/', title: SHARED.about, stem: 'about' },
  { path: '/accessibility/', title: SHARED.accessibility, stem: 'a11y' },
  { path: '/corrections/', title: SHARED.corrections, stem: 'corrections' },
];

// Builds the hub once in production mode and hands fn a reader for its files. A site has given its dates (for
// /corrections/) and the corrections folder is one that does not exist, so the log is empty whatever the repo holds.
const withHub = (fn) => withTemp('pp-hub-policy-', async (dir) => {
  const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
  const updated = new Map([['hacrp', { cmsReleased: '2026-08-13', changed: '2026-10-22' }]]);
  await generateHub(ctx, { updated, correctionsDir: join(dir, 'no-corrections'), hospitals: [], released: true });
  return fn((f) => readFileSync(join(dir, f, 'index.html'), 'utf8'));
});

const briefKeys = (prefix) => Object.keys(COPY).filter((k) => new RegExp(`^${prefix}\\d+$`).test(k));
// The page's sections' ids, and the ids its index links to, in order.
const sectionIds = (page) => [...tags(page, { names: ['section'] })].filter(({ attrs }) => attrs.class === 'doc__sec').map(({ attrs }) => attrs.id);
const indexLinks = (page) => [...tags(page.match(/<nav class="doc__toc"[\s\S]*?<\/nav>/)[0], { names: ['a'] })].map(({ attrs }) => attrs.href.replace(/^#/, ''));

test('each policy page has one h1, the brief as a record card, an index of its sections and the hub\'s robots', () =>
  withHub((read) => {
    for (const { path, title, stem } of POLICY) {
      const text = read(path);
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, path);
      assert.match(text, new RegExp(`<h1[^>]*>${escapeHtml(title)}</h1>`), path);
      assert.ok(!text.includes(NOINDEX), `${path}: a released hub's policy page may be indexed`);
      assert.match(text, /<link rel="canonical" href="https:\/\/paidandpenalized\.org\/[a-z]+\/">/, path);
      // The card: the record's title bar, then one field per brief line, in order.
      const card = text.match(/<div class="form pol__brief"[^>]*>[\s\S]*?<\/div>\s*<\/header>/)?.[0];
      assert.ok(card, `${path} has the brief card`);
      assert.ok(card.includes(COPY.briefTitle), path);
      const lines = briefKeys(`${stem}Brief`);
      assert.ok(lines.length >= 3 && lines.length <= 5, `${path}: three to five brief lines`);
      assert.equal(card.match(/class="field /g)?.length, lines.length, path);
      // The index names the page's sections: its links are exactly their ids, in order, and each id is unique.
      const ids = sectionIds(text);
      assert.ok(ids.length >= 3, path);
      assert.equal(new Set(ids).size, ids.length, `${path}: section ids are unique`);
      assert.ok(ids.every((id) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)), `${path}: ids are short, lowercase, hyphenated`);
      assert.deepEqual(indexLinks(text), ids, path);
      assert.match(text, new RegExp(`<nav class="doc__toc" aria-label="${escapeHtml(COPY.indexLabel)}">`), path);
      for (const id of ids) assert.match(text, new RegExp(`<h2 class="doc__h" id="${id}-h">`), `${path}#${id} has its heading`);
      assert.doesNotMatch(text, /\sstyle=/, `${path}: no inline style (a strict CSP comes)`);
      assert.doesNotMatch(text, /<figure|<svg/, `${path}: no figures`);
    }
  }));

test('every word of the five pages\' copy shows on its page, and the feedback link in its words is prefilled with the page', () =>
  withHub((read) => {
    for (const { path, stem } of POLICY) {
      const text = read(path);
      const words = textOf(text);
      const keys = Object.keys(COPY).filter((k) => k.startsWith(stem));
      for (const key of keys) {
        if (key.endsWith('Description')) { assert.ok(text.includes(escapeHtml(COPY[key])), `${path}: ${key}`); continue; }
        // The longest stretch of the sentence between its placeholders is enough to know the key was used.
        const stretch = COPY[key].split(/\{\w+\}/).map((x) => x.trim()).reduce((a, b) => (b.length > a.length ? b : a), '');
        assert.ok(words.includes(stretch), `${path}: ${key} is not on the page`);
      }
      assert.doesNotMatch(words, /\{\w+\}/, `${path}: a placeholder left unfilled`);
      // Where its words call for the form (not privacy's, which describes the footer's link), the link is the prefilled one.
      const href = feedbackHref({ siteName: SITE.name, pageUrl: SITE.origin + path });
      if (keys.some((k) => COPY[k].includes('{feedback}'))) assert.ok(text.includes(String(externalLink(href, COPY.feedbackForm))), `${path}: feedback link`);
    }
  }));

test('/about/ links the byline\'s profile', () =>
  withHub((read) => {
    assert.ok(read('/about/').includes(String(externalLink(SITE.linkedin, COPY.linkedinLink))));
  }));

test('/terms/ links the definition of "estimate", the corrections page and the license values', () =>
  withHub((read) => {
    const terms = read('/terms/');
    assert.ok(terms.includes(`<a href="/methods/#estimate">${COPY.estimateLink}</a>`));
    assert.ok(terms.includes(`<a href="/corrections/">${SHARED.corrections}</a>`));
    assert.ok(textOf(terms).includes(fillCopy(COPY, 'termsReuse', { contentLicense: SITE.license.content.name, codeLicense: SITE.license.code.name })));
  }));

test('/privacy/ links the two services\' policies and names no retention period', () =>
  withHub((read) => {
    const privacy = read('/privacy/');
    for (const [href, name] of [[CLOUDFLARE_PRIVACY_URL, COPY.cloudflarePolicy], [GOOGLE_PRIVACY_URL, COPY.googlePolicy]]) {
      assert.ok(privacy.includes(String(externalLink(href, name))), name);
    }
    // The page's own words (its sections and brief lines, not the numbers that count them) say nothing of how long anything is kept.
    const words = textOf(privacy.match(/<div class="doc__main">[\s\S]*<\/article>/)[0]) + briefKeys('privacyBrief').map((k) => COPY[k]).join(' ');
    assert.doesNotMatch(words, /\d|\b(retain|retained|retention|delete|deleted|deletion|erase|erased)\b|\b(days?|weeks?|months?|years?)\b/i);
  }));

// The one thing a page keeps in the browser is the light/dark choice, for the visit (web/client/theme-store.js), and the
// privacy page says so, beside its words on cookies.
test('/privacy/ says the light/dark choice is the one thing kept in the browser, for the visit, and is sent nowhere', () =>
  withHub((read) => {
    const reading = textOf(read('/privacy/').match(/<section[^>]*id="reading"[\s\S]*?<\/section>/)[0]).replace(/’/g, "'").trim();
    assert.ok(reading.includes('It sets no cookies, has no accounts and shows no ads.'), reading);
    // The owner's own words.
    assert.ok(reading.endsWith('Your choice between light and dark mode is remembered by the browser for your visit; it is not shared beyond that visit.'), reading);
  }));

test('/accessibility/ names the WCAG version from its constant', () =>
  withHub((read) => {
    const a11y = textOf(read('/accessibility/'));
    assert.ok(a11y.includes(`WCAG ${WCAG_VERSION} at level AA`));
    assert.ok(a11y.includes(`(WCAG) ${WCAG_VERSION} at level AA`));
  }));

// ---------- the template ----------
const ARGS = (over = {}) => ({
  path: '/x/', title: 'T', description: 'D', brief: ['one', 'two', 'three'],
  sections: [{ id: 'a', heading: 'A', body: html`<p>a</p>` }, { id: 'b-c', heading: 'B', body: html`<p>b</p>` }],
  assets: ASSETS, robots: 'noindex', ...over,
});

test('policyPage lays out the title, the card and the sections, escaping every line it is given', () => {
  const text = policyPage(ARGS({ brief: ['a < b', raw('<em>safe</em>')] }));
  assert.match(text, /a &lt; b/);
  assert.match(text, /<em>safe<\/em>/);
  assert.match(text, /<title>T · Paid &amp; Penalized<\/title>/);
  assert.match(text, /<a href="#a">/);
  assert.match(text, /<a href="#b-c">/);
});

test('policyPage refuses an empty brief, no sections, a section id that is not a plain slug or repeats, and an unescaped body', () => {
  assert.throws(() => policyPage(ARGS({ brief: [] })), TypeError);
  assert.throws(() => policyPage(ARGS({ sections: [] })), TypeError);
  for (const id of ['', 'A', 'a b', '-a', 'a-', 'a--b', '1a', 'a_b', 'a"b']) {
    assert.throws(() => policyPage(ARGS({ sections: [{ id, heading: 'A', body: html`<p>a</p>` }] })), RangeError, JSON.stringify(id));
  }
  assert.throws(() => policyPage(ARGS({ sections: [{ id: 'a', heading: 'A', body: html`<p>a</p>` }, { id: 'a', heading: 'B', body: html`<p>b</p>` }] })), RangeError);
  assert.throws(() => policyPage(ARGS({ sections: [{ id: 'a', heading: 'A', body: '<p>a</p>' }] })), TypeError);
});
