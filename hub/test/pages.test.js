import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '../../pipeline/site/context.js';
import { ASSETS, withTemp } from '../../pipeline/test/helpers.js';
import { COPY as SHARED } from '../../web/copy.js';
import { fillCopy } from '../../web/render/components.js';
import { escapeHtml, html, raw } from '../../web/render/html.js';
import { feedbackHref } from '../../web/render/layout.js';
import { SITE } from '../../web/site.js';
import { CLOUDFLARE_PRIVACY_URL, GOOGLE_PRIVACY_URL, WCAG_VERSION } from '../constants.js';
import { COPY } from '../copy.js';
import { generateHub, sitemapXml } from '../pages.js';
import { policyPage } from '../policy.js';

const NOINDEX = '<meta name="robots" content="noindex">';

test('the hub writes the stub root, /methods/, the policy pages, the 404 page, robots.txt and a sitemap of the pages emitted indexable', () =>
  withTemp('pp-hub-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    ctx.emit({ path: '/hacrp/', robots: null, text: 'a' });
    ctx.emit({ path: '/hacrp/hospital/990001/', robots: null, text: 'b' });
    ctx.emit({ path: '/hacrp/hospital/990002/', robots: 'noindex', text: 'c' });
    await generateHub(ctx);
    assert.equal(ctx.pages, 3 + 3 + 5);
    assert.deepEqual(ctx.indexable, ['/hacrp/', '/hacrp/hospital/990001/']);
    const read = (f) => readFileSync(join(dir, f), 'utf8');

    const home = read('index.html');
    assert.ok(home.includes('Public Medicare data, made visible.'));
    assert.match(home, /href="\/hacrp\/">Hospital-Acquired Conditions <span class="short">\(HACRP\)<\/span>/);

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

    for (const text of [home, methods, notFound]) {
      assert.ok(text.includes(NOINDEX), 'hub pages stay noindex until the hub is built');
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1);
    }

    assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://paidandpenalized.org/sitemap.xml\n');
    const sitemap = read('sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/paidandpenalized\.org\/hacrp\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/paidandpenalized\.org\/hacrp\/hospital\/990001\/<\/loc>/);
    assert.equal(sitemap.match(/<url>/g).length, 2);
  }));

test('the hub stops, naming the site, when a site the build ran never gave its dates for /corrections/; the hub alone is fine', () =>
  withTemp('pp-hub-sites-', async (dir) => {
    const ran = (siteIds, give = []) => {
      const ctx = createContext({ outDir: join(dir, siteIds.join('-')), env: 'production', assets: ASSETS, siteIds });
      for (const id of give) ctx.setUpdated(id, { cmsReleased: '2026-08-13', changed: '2026-10-22' });
      return generateHub(ctx, { correctionsDir: join(dir, 'no-corrections') }).then(() => ctx);
    };
    await assert.rejects(ran(['hacrp', 'hub']), /"hacrp".*setUpdated/);
    await assert.rejects(ran(['hacrp', 'other', 'hub'], ['hacrp']), /"other".*setUpdated/);
    assert.ok((await ran(['hub'])).pages > 0);
    assert.ok((await ran(['hacrp', 'hub'], ['hacrp'])).pages > 0);
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
  ctx.setUpdated('hacrp', { cmsReleased: '2026-08-13', changed: '2026-10-22' });
  await generateHub(ctx, { correctionsDir: join(dir, 'no-corrections') });
  return fn((f) => readFileSync(join(dir, f, 'index.html'), 'utf8'));
});

// The words a reader sees: tags dropped, the five entities the build writes undone, whitespace collapsed.
const textOf = (page) => page.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const briefKeys = (prefix) => Object.keys(COPY).filter((k) => new RegExp(`^${prefix}\\d+$`).test(k));
const sectionIds = (page) => [...page.matchAll(/<section class="doc__sec" id="([^"]+)"/g)].map((m) => m[1]);
const indexLinks = (page) => [...page.match(/<nav class="doc__toc"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);

test('each policy page has one h1, the brief as a record card, an index of its sections and the hub\'s noindex', () =>
  withHub((read) => {
    for (const { path, title, stem } of POLICY) {
      const text = read(path);
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, path);
      assert.match(text, new RegExp(`<h1[^>]*>${escapeHtml(title)}</h1>`), path);
      assert.ok(text.includes(NOINDEX), `${path} stays noindex until the hub is built`);
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
      if (keys.some((k) => COPY[k].includes('{feedback}'))) assert.ok(text.includes(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${COPY.feedbackForm}<span class="vh">${SHARED.newTab}</span></a>`), `${path}: feedback link`);
    }
  }));

test('/about/ holds the AI and conflict-of-interest sections under the ids other pages link to', () =>
  withHub((read) => {
    const about = read('/about/');
    assert.match(about, new RegExp(`<section class="doc__sec" id="ai" aria-labelledby="ai-h">\\s*<h2 class="doc__h" id="ai-h">${COPY.aboutAiHeading}</h2>`));
    assert.match(about, /<section class="doc__sec" id="coi"/);
    assert.ok(about.includes(`<a href="${SITE.linkedin}" target="_blank" rel="noopener">${COPY.linkedinLink}`));
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
      assert.ok(privacy.includes(`<a href="${href}" target="_blank" rel="noopener">${name}`), name);
    }
    // The page's own words (its sections and brief lines, not the numbers that count them) say nothing of how long anything is kept.
    const words = textOf(privacy.match(/<div class="doc__main">[\s\S]*<\/article>/)[0]) + briefKeys('privacyBrief').map((k) => COPY[k]).join(' ');
    assert.doesNotMatch(words, /\d|\b(retain|retained|retention|delete|deleted|deletion|erase|erased)\b|\b(days?|weeks?|months?|years?)\b/i);
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
