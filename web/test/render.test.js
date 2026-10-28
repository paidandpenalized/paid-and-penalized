import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../site.js';
import { cmsText, count, decimal, isoDate, isoMonth, longDate, pct, shown, signed } from '../render/format.js';
import { fillAround, fillCopy, fillCopyKeep, footnoteLegend, keepWhole, lastCall, pill, typeset } from '../render/components.js';
import { Safe, escapeHtml, html, jsonScript, raw } from '../render/html.js';
import { COPY } from '../copy.js';
import { externalLink, feedbackFor, feedbackHref, page } from '../render/layout.js';
import { searchForm } from '../render/shell.js';
import { textOf } from '../../pipeline/site/html.js';
import { testAssets } from '../../pipeline/test/helpers.js';

const ASSETS = testAssets({ css: '/assets/site.aaaaaaaa.css', js: { theme: '/assets/theme.bbbbbbbb.js' } });
const PAGE = { title: 'A title', description: 'A description', path: '/hacrp/', body: html`<h1>Hello</h1>`, assets: ASSETS };

test('html escapes every interpolation in text and in attributes', () => {
  assert.equal(String(html`<p>${'<a & "b">'}</p>`), '<p>&lt;a &amp; &quot;b&quot;&gt;</p>');
  assert.equal(String(html`<a title='${`x" onmouseover='y`}'>`), '<a title=\'x&quot; onmouseover=&#39;y\'>');
});

test('html returns a Safe that passes through once, never twice', () => {
  const inner = html`<b>${'&'}</b>`;
  assert.ok(inner instanceof Safe);
  assert.equal(String(html`<p>${inner}</p>`), '<p><b>&amp;</b></p>');
  assert.equal(String(html`<p>${raw('<i>ok</i>')}</p>`), '<p><i>ok</i></p>');
});

test('html joins arrays, renders null, undefined and false as nothing, and numbers as digits', () => {
  assert.equal(String(html`${[html`<li>${'<'}</li>`, '<x>', null, 3]}`), '<li>&lt;</li>&lt;x&gt;3');
  assert.equal(String(html`[${null}${undefined}${false}]`), '[]');
  assert.equal(String(html`${0}|${12.5}`), '0|12.5');
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('jsonScript never lets a value close the script element', () => {
  const out = String(jsonScript('data', { name: '</script><script>alert(1)</script>', note: '<!-- x', sep: ' ' }));
  assert.equal(out.match(/<\/script/g).length, 1);
  assert.ok(!out.includes('<!--'));
  const json = />(.*)<\/script>$/s.exec(out)[1];
  assert.deepEqual(JSON.parse(json), { name: '</script><script>alert(1)</script>', note: '<!-- x', sep: ' ' });
  assert.match(out, /^<script type="application\/json" id="data">/);
});

test('cmsText turns only a leading hyphen-minus on a number into a true minus', () => {
  assert.equal(cmsText('-0.2580'), '−0.2580');
  assert.equal(cmsText('0.2580'), '0.2580');
  assert.equal(cmsText('N/A'), 'N/A');
  assert.equal(cmsText('1-2'), '1-2');
  assert.equal(cmsText('-'), '-');
});

test('count, pct and signed', () => {
  assert.equal(count(1234567), '1,234,567');
  assert.equal(pct(0.1234, 1), '12.3%');
  assert.equal(pct(-0.05, 0), '−5%');
  assert.equal(signed(-0.5, 2), '−0.50');
  assert.equal(signed(1.234, 1), '+1.2');
  assert.equal(signed(0, 2), '0.00');
  assert.equal(signed(-0.0001, 2), '0.00');
  assert.equal(signed(-1234.5, 1), '−1,234.5');
});

test('shown is the number decimal and signed show, where toFixed rounds a tie the other way; never -0', () => {
  for (const x of [-0.24275, 0.29105, 0.19965, 1 / 6, -1234.56789, 0.00005]) {
    assert.equal(shown(x, 4), Number(decimal(x, 4).replace('−', '-').replaceAll(',', '')), String(x));
  }
  assert.equal(shown(-0.24275, 4), -0.2428);
  assert.notEqual(Number((-0.24275).toFixed(4)), -0.2428, 'toFixed splits this tie');
  assert.ok(Object.is(shown(-0.00001, 4), 0));
});

test('longDate and isoDate spell the month out and reject non-dates', () => {
  assert.equal(longDate('07/01/2022'), 'July 1, 2022');
  assert.equal(isoDate('2026-08-13'), 'August 13, 2026');
  assert.equal(isoDate('2024-02-29'), 'February 29, 2024');
  assert.throws(() => longDate('13/01/2022'), RangeError);
  assert.throws(() => longDate('2022-07-01'), RangeError);
  assert.throws(() => isoDate('2026-02-30'), RangeError);
  assert.throws(() => isoDate('August 13, 2026'), RangeError);
});

test('isoMonth gives the month and the year of a date as separate words, and rejects non-dates', () => {
  assert.deepEqual(isoMonth('2026-12-31'), { month: 'December', year: '2026' });
  assert.deepEqual(isoMonth('2027-01-01'), { month: 'January', year: '2027' });
  assert.deepEqual(isoMonth('2024-02-29'), { month: 'February', year: '2024' });
  assert.throws(() => isoMonth('2026-02-30'), RangeError);
  assert.throws(() => isoMonth('December 31, 2026'), RangeError);
});

test("page: og:type is website on the site's root and each program's hub page, article on every other page", () => {
  const type = (path) => /<meta property="og:type" content="(\w+)">/.exec(page({ ...PAGE, path }))[1];
  assert.equal(type('/'), 'website');
  for (const { path } of Object.values(SITE.sites)) assert.equal(type(path), 'website', path);
  for (const path of ['/hacrp/hospital/990001/', '/hacrp/data/', '/methods/', '/404.html']) assert.equal(type(path), 'article', path);
});

test('page: one header without an h1, one main, the body, canonical, skip link, byline and footer sentences', () => {
  const out = page(PAGE);
  assert.match(out, /^<!doctype html>\n<html lang="en">/);
  assert.equal(out.match(/<header[ >]/g).length, 1);
  assert.equal(out.match(/<main[ >]/g).length, 1);
  const header = /<header[\s\S]*?<\/header>/.exec(out)[0];
  assert.ok(!/<h1/.test(header));
  assert.equal(out.match(/<h1/g).length, 1);
  assert.ok(out.includes('<meta charset="utf-8">'));
  assert.ok(out.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
  assert.ok(out.includes(`<link rel="canonical" href="${SITE.origin}/hacrp/">`));
  assert.ok(out.includes('<title>A title</title>'));
  assert.ok(out.includes('<meta name="description" content="A description">'));
  // The share card: the same title, description and canonical URL, text only; a program's hub page is a website.
  for (const tag of ['<meta property="og:type" content="website">', `<meta property="og:site_name" content="${SITE.name.replace('&', '&amp;')}">`,
    '<meta property="og:title" content="A title">', '<meta property="og:description" content="A description">',
    `<meta property="og:url" content="${SITE.origin}/hacrp/">`, '<meta name="twitter:card" content="summary">']) assert.ok(out.includes(tag), tag);
  assert.doesNotMatch(out, /og:image|twitter:image/);
  assert.ok(out.includes('<link rel="icon" href="/favicon.svg"'));
  assert.ok(out.includes(`<link rel="stylesheet" href="${ASSETS.css}">`));
  assert.ok(out.indexOf('class="skip" href="#main"') < out.indexOf('<header'));
  assert.ok(out.includes('<main id="main">'));
  assert.ok(out.includes(escapeHtml(COPY.affiliation)));
  assert.ok(out.includes(COPY.builtWith));
  // The name and credentials never split; the byline may break after "Built by".
  assert.ok(out.includes(`Built by ${externalLink('https://www.linkedin.com/in/dalton-haslam', html`<span class="nw">Dalton Haslam, MD, MBA</span>`)}`));
  assert.ok(out.includes(`href="${SITE.feedback.url}?`));
  assert.ok(out.includes('href="https://creativecommons.org/licenses/by/4.0/"'));
  assert.ok(out.includes('href="/methods/"'));
  // No h1, no drawing and no inline style in the header or the footer: icons are CSS masks (tokens.css).
  for (const part of [header, /<footer[\s\S]*?<\/footer>/.exec(out)[0]]) assert.doesNotMatch(part, /<h1|<svg|\sstyle=/);
});

// ---------- the shell: the family bar, the program tabs, the section menu, the short footer (render/shell.js) ----------
const headerOf = (out) => /<header[\s\S]*?<\/header>/.exec(out)[0];
const footerOf = (out) => /<footer[\s\S]*?<\/footer>/.exec(out)[0];
// The tabs' links, in order: [href, its words (tags dropped), aria-current or null, the class].
const tabsOf = (out) => [...headerOf(out).matchAll(/<a class="(tab[^"]*)" href="([^"]*)"(?: title="[^"]*")?( aria-current="page")?>([\s\S]*?)<\/a>/g)]
  .map(([, cls, href, current, inner]) => [href, inner.replace(/<[^>]+>/g, ''), current ? 'page' : null, cls]);
// An invented hospital the shell follows (no real name or CCN).
const FOLLOWED = { ccn: '990001', name: 'Exampleton <General> & Sons', net: -58430, inTdr: true };
const SECTIONS = [{ id: 'how', label: 'How it works', href: '/hacrp/#how' }, { id: 'list', label: 'Every <one>', href: '/hacrp/#list' }];

test('shell: one header, the skip link before it; the family bar runs wordmark, tagline, chip, then search and the theme toggle', () => {
  const out = page(PAGE);
  assert.equal(out.match(/<header[ >]/g).length, 1);
  assert.ok(out.indexOf('<a class="skip" href="#main">') < out.indexOf('<header'));
  const header = headerOf(out);
  assert.match(header, /^<header class="topbar fam" data-hub-src="\/assets\/hub-hospitals\.test\.json">/);
  // The wordmark: its two words, and the compact mark a phone shows instead (hidden from screen readers, which read
  // the words at every width).
  assert.ok(header.includes('<a class="wordmark" href="/"><span class="wordmark__lead">Paid &amp;</span> <span class="wordmark__pen">Penalized</span><span class="wordmark__short" aria-hidden="true">P&amp;<span class="wordmark__pen">P</span></span></a>'));
  assert.ok(header.includes('<p class="fam__tag">Public Medicare data, made visible.</p>'));
  assert.ok(header.includes('<button type="button" class="fam__find" aria-expanded="false" aria-controls="omni" hidden><span class="ico ico--search" aria-hidden="true"></span><span class="vh">Find a hospital or state</span></button>'));
  assert.ok(header.includes('<button type="button" class="theme-toggle" aria-pressed="false" hidden><span class="ico ico--theme" aria-hidden="true"></span><span class="vh">Dark mode</span></button>'));
  const at = (s) => header.indexOf(s);
  const order = ['class="wordmark"', 'class="fam__tag"', 'class="chip"', 'class="fam__end"', 'class="fam__find"', 'class="theme-toggle"', 'class="wrap tabs"'].map(at);
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `bar order ${order}`);
  // The search slot holds the page's own search, between the find button and the toggle.
  const searched = headerOf(page({ ...PAGE, search: html`<form id="s"></form>` }));
  assert.ok(searched.indexOf('class="fam__find"') < searched.indexOf('<form id="s">') && searched.indexOf('<form id="s">') < searched.indexOf('class="theme-toggle"'));
  // DOM order = visual order = tab order at every width: no flex or grid `order` in the shared styles.
  for (const file of ['components.css', 'shell.css']) {
    const css = readFileSync(`${REPO_ROOT}/web/styles/${file}`, 'utf8');
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /(^|[\s;{])order\s*:/, file);
  }
});

test('shell: the program tabs in the registry\'s order, the coming ones after a "coming" gap, the current one marked', () => {
  const main = SITE.programs.filter((p) => p.stage !== 'soon' || p.inData);
  const soon = SITE.programs.filter((p) => !main.includes(p));
  assert.deepEqual(main.map((p) => p.id), ['hrrp', 'hacrp', 'hvbp']);
  const hub = tabsOf(page({ ...PAGE, path: '/' }));
  assert.deepEqual(hub, [
    ['/', 'All programs', 'page', 'tab'],
    ...main.map((p) => [p.path, `${p.name} ${p.ab}`, null, 'tab']),
    ...soon.map((p) => [p.path, p.ab, null, 'tab tab--soon']),
  ]);
  const header = headerOf(page(PAGE));
  assert.ok(header.includes('<nav class="wrap tabs" aria-label="Programs"><div class="tabs__scroll">'));
  assert.ok(header.includes('<a class="tab" href="/hrrp/"><span>Readmissions</span> <span class="tab__ab">HRRP</span></a>'));
  assert.ok(header.includes('<a class="tab tab--soon" href="/wage-index/" title="Local wages (Wage index): coming"><span class="tab__ab">Wage index</span></a>'));
  // The gap sits between the last full tab and the first coming one.
  const gap = header.indexOf('<span class="tabs__gap" aria-hidden="true">coming</span>');
  assert.ok(gap > header.indexOf(`href="${main.at(-1).path}"`) && gap < header.indexOf(`href="${soon[0].path}"`));
  // On a program's pages its tab is current, and only it.
  const hacrp = tabsOf(page({ ...PAGE, program: 'hacrp' }));
  assert.deepEqual(hacrp.filter(([, , current]) => current).map(([href]) => href), ['/hacrp/']);
  const coming = tabsOf(page({ ...PAGE, path: '/team/', program: 'team' }));
  assert.deepEqual(coming.filter(([, , current]) => current).map(([href]) => href), ['/team/']);
  assert.throws(() => page({ ...PAGE, program: 'nope' }), /nope/);
});

test('shell: with a followed hospital, each tab opens that program\'s page for it, or the program\'s folder when it has none', () => {
  const tabs = tabsOf(page({ ...PAGE, path: '/hacrp/hospital/990001/', program: 'hacrp', hospital: FOLLOWED }));
  const href = (ab) => tabs.find(([, words]) => words.endsWith(ab))[0];
  assert.equal(tabs[0][0], '/hospital/990001/', 'All programs is the hospital\'s own page');
  assert.equal(href('HRRP'), '/hrrp/hospital/990001/');
  assert.equal(href('HACRP'), '/hacrp/hospital/990001/');
  assert.equal(href('HVBP'), '/hvbp/');
  assert.equal(href('Wage index'), '/wage-index/');
  // Not in Thirty Day Readmissions: the Readmissions folder.
  const notTdr = tabsOf(page({ ...PAGE, program: 'hacrp', hospital: { ...FOLLOWED, inTdr: false } }));
  assert.equal(notTdr[1][0], '/hrrp/');
});

test('shell: the chip is empty and hidden without a hospital; with one it names it, signs its net and links to stop following', () => {
  const plain = headerOf(page(PAGE));
  assert.ok(plain.includes('<p class="chip" data-chip hidden></p>'));
  assert.doesNotMatch(plain, /data-hospital/);
  const followed = headerOf(page({ ...PAGE, path: '/hacrp/hospital/990001/', program: 'hacrp', hospital: FOLLOWED }));
  assert.match(followed, /^<header class="topbar fam" data-hub-src="[^"]+" data-hospital="990001">/);
  const chip = /<p class="chip" data-chip>[\s\S]*?<\/p>/.exec(followed)?.[0];
  assert.ok(chip, 'a chip, not hidden');
  assert.ok(chip.includes('<span class="chip__k">Hospital</span>'));
  assert.ok(chip.includes('<a class="chip__n" href="/hospital/990001/"><span class="chip__t">Exampleton &lt;General&gt; &amp; Sons</span>'));
  assert.match(chip, /<span class="chip__v"><span class="vh">Estimated FY2026 net: <\/span>−\$58K<\/span>/);
  // Stopping leaves the hospital's page for the same program's page without one (its folder; the family's front page
  // on the hub).
  assert.ok(chip.includes('<a class="chip__x" href="/hacrp/" aria-label="Stop following Exampleton &lt;General&gt; &amp; Sons">×</a>'));
  const hubChip = headerOf(page({ ...PAGE, path: '/hospital/990001/', hospital: FOLLOWED }));
  assert.match(hubChip, /<a class="chip__x" href="\/"/);
  // A positive net carries its plus; no estimate (null) shows no figure, never $0 or NaN.
  assert.match(headerOf(page({ ...PAGE, hospital: { ...FOLLOWED, net: 48000 } })), /<\/span>\+\$48K<\/span>/);
  const none = headerOf(page({ ...PAGE, hospital: { ...FOLLOWED, net: null } }));
  assert.doesNotMatch(none, /chip__v|NaN|\$0/);
});

test('shell: the numbered section menu only when the page gives sections, the current one marked', () => {
  assert.doesNotMatch(headerOf(page(PAGE)), /fam__sub|data-nav/);
  const header = headerOf(page({ ...PAGE, program: 'hacrp', sections: SECTIONS, current: 'list' }));
  assert.ok(header.includes('<div class="wrap fam__sub"><nav class="nav" aria-label="Sections"><ol>'));
  assert.ok(header.includes('<li><a href="/hacrp/#how" data-nav="how"><span class="nav__num">1</span>How it works</a></li>'));
  assert.ok(header.includes('<li><a href="/hacrp/#list" data-nav="list" aria-current="true"><span class="nav__num">2</span>Every &lt;one&gt;</a></li>'));
  assert.ok(header.indexOf('class="wrap tabs"') < header.indexOf('class="wrap fam__sub"'), 'under the tabs');
  assert.doesNotMatch(headerOf(page({ ...PAGE, sections: SECTIONS })), /aria-current="true"/, 'no current section given');
  assert.throws(() => page({ ...PAGE, sections: SECTIONS, current: 'nope' }), /nope/);
  assert.throws(() => page({ ...PAGE, sections: [] }), TypeError);
});

test('shell: two theme toggles, one in the bar and one in the footer (the CSS shows exactly one at any width)', () => {
  const out = page(PAGE);
  assert.equal(out.match(/<button type="button" class="theme-toggle" aria-pressed="false" hidden>/g).length, 2);
  assert.equal(headerOf(out).match(/class="theme-toggle"/g).length, 1);
  assert.equal(footerOf(out).match(/class="theme-toggle"/g).length, 1);
});

test('shell: the footer is one numbered form row (programs, the site, data as of, feedback), then the signature lines', () => {
  const foot = footerOf(page(PAGE));
  assert.match(foot, /^<footer class="foot">/);
  assert.ok(foot.includes('<div class="form ft">'));
  const labels = [...foot.matchAll(/<span class="field__no">(\d)<\/span>([^<]+)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(labels, [['1', 'Programs'], ['2', 'The site'], ['3', 'Data as of'], ['4', 'Feedback']]);
  // 1: the programs with dollar estimates, each with its figure (testAssets' invented facts), then the coming ones.
  for (const [href, name, figure] of [['/hrrp/', 'Readmissions', '−$2.0M'], ['/hacrp/', 'Hospital-acquired conditions', '−$1.0M'], ['/hvbp/', 'Value-based purchasing', '$500K moved']]) {
    assert.match(foot, new RegExp(`<a href="${href}">${name} <span class="ft__ab">[^<]+</span></a> <span class="ft__v"><span class="vh">Estimated FY2026: </span>${figure.replace('$', '\\$')}</span>`), name);
  }
  const coming = /<p class="ft__soon">([\s\S]*?)<\/p>/.exec(foot)[1];
  assert.ok(coming.startsWith('Coming: '));
  assert.deepEqual([...coming.matchAll(/<a href="([^"]+)" title="[^"]+">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]),
    SITE.programs.filter((p) => p.stage === 'soon' && !p.inData).map((p) => [p.path, p.ab]));
  // 2: the family's pages, Methods first, Terms last.
  const site = [...foot.matchAll(/<li><a href="(\/[a-z]+\/)">([^<]+)<\/a><\/li>/g)].map((m) => m[1]);
  assert.deepEqual(site, ['/methods/', '/about/', '/corrections/', '/accessibility/', '/privacy/', '/terms/']);
  // 3: the fiscal year, the hospitals with an estimate, and the day the estimates last changed, with the corrections page.
  const words = textOf(foot);
  assert.ok(words.includes('FY2026 estimates from public CMS files, 3 hospitals.'));
  assert.ok(words.includes('Estimates last changed October 22, 2026'));
  assert.match(foot, /<a href="\/corrections\/">Dates and corrections<\/a>/);
  // 4: the one feedback link, prefilled with the page, and what it opens.
  assert.equal(foot.match(new RegExp(`<a href="${SITE.feedback.url.replace(/[.?]/g, '\\$&')}`, 'g')).length, 1);
  assert.ok(words.includes('Opens a Google Form.'));
  assert.doesNotMatch(words, /patient information\. Don|include any patient/i, 'the patient-information line stays dropped');
  // The signature lines: the byline and the credit, the affiliation, the Terms line, the license, the form number.
  assert.ok(foot.includes(`<p>Built by ${externalLink(SITE.linkedin, html`<span class="nw">Dalton Haslam, MD, MBA</span>`)} · Built with Claude Code</p>`));
  assert.ok(foot.includes(`<p>${escapeHtml(COPY.affiliation)}</p>`));
  assert.ok(foot.includes('<p>Nothing here is medical, legal or financial advice. <a href="/terms/">Terms of use</a></p>'));
  assert.ok(foot.includes(`<p>Text licensed ${externalLink(SITE.license.content.url, 'CC BY 4.0', { rel: 'license noopener' })}</p>`));
  assert.ok(foot.includes('<p class="ft__form">Form P&amp;P-26 · FY2026</p>'));
  assert.ok(foot.indexOf('class="ft__base"') > foot.indexOf('class="form ft"'));
});

test('shell: header and footer show no email address and promise no reply, fix or deletion', () => {
  // The house words' promise patterns (web/test/house-words.test.js), over what the shell shows.
  const PROMISES = [/\b(within|business days?|promptly|as soon as)\b/i, /\bwe will (reply|respond|fix|delete)\b/i, /\b(delete|remove) your\b/i];
  const out = page({ ...PAGE, program: 'hacrp', hospital: FOLLOWED, sections: SECTIONS });
  for (const part of [headerOf(out), footerOf(out)]) {
    const words = textOf(part);
    assert.doesNotMatch(words, /@/, 'no email address');
    for (const re of PROMISES) assert.doesNotMatch(words, re);
  }
});

test('searchForm: a combobox over a data asset, hidden until its script shows it; the hero\'s larger box has its own ids', () => {
  const words = { src: '/assets/x.json', label: 'Find a <thing>', find: 'Find', findRest: 'a thing by name', placeholder: 'Thing or place' };
  const bar = String(searchForm({ id: 'omni', ...words }));
  assert.equal(bar, `<form class="omni" id="omni" role="search" aria-label="Find a &lt;thing&gt;" data-src="/assets/x.json" hidden>
<label class="omni__field" for="omni-q"><span class="omni__label cap">Find<span class="vh"> a thing by name</span></span><input id="omni-q" type="search" role="combobox" aria-expanded="false" aria-controls="omni-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Thing or place"></label>
<ul class="omni__list" id="omni-list" role="listbox" aria-label="Find a &lt;thing&gt;" hidden></ul>
<p class="vh" role="status" aria-live="polite"></p>
</form>`);
  const hero = String(searchForm({ id: 'hero', hero: true, ...words }));
  assert.match(hero, /^<form class="omni omni--hero" id="hero" role="search"/);
  assert.match(hero, /for="hero-q"[\s\S]*id="hero-list"/);
  // A search over the hub's hospitals and states is marked for the hub's search script; others are not.
  assert.match(String(searchForm({ id: 'find', hero: true, hub: true, ...words })), /^<form class="omni omni--hero" id="find" role="search" aria-label="[^"]*" data-src="\/assets\/x\.json" data-hub hidden>/);
  assert.doesNotMatch(bar + hero, /data-hub/);
});

// The feedback link's href as the browser reads it: the page's HTML attribute, unescaped, parsed as a URL.
const feedbackUrlIn = (out) => new URL(/<a href="([^"]*)"[^>]*>Send feedback/.exec(out)[1].replaceAll('&amp;', '&'));
const SITE_ENTRY = 'entry.2047320042';
const PAGE_ENTRY = 'entry.1326474028';

test('feedbackHref builds the form URL with the site and the page, each encoded, and the page exactly as given', () => {
  assert.equal(SITE.feedback.siteEntry, SITE_ENTRY);
  assert.equal(SITE.feedback.pageEntry, PAGE_ENTRY);
  assert.equal(feedbackHref({ siteName: 'Paid & Penalized', pageUrl: 'https://paidandpenalized.org/a/' }),
    `${SITE.feedback.url}?${SITE_ENTRY}=${encodeURIComponent('Paid & Penalized')}&${PAGE_ENTRY}=${encodeURIComponent('https://paidandpenalized.org/a/')}`);
  const pageUrl = 'https://paidandpenalized.org/a/?x=1&y=2#z';
  const url = new URL(feedbackHref({ siteName: 'A & B', pageUrl }));
  assert.equal(url.searchParams.get(PAGE_ENTRY), pageUrl);
  assert.equal(url.searchParams.get(SITE_ENTRY), 'A & B');
  // No page given: the site alone is prefilled.
  const siteOnly = new URL(feedbackHref({ siteName: 'A & B' }));
  assert.equal(siteOnly.searchParams.get(SITE_ENTRY), 'A & B');
  assert.ok(!siteOnly.searchParams.has(PAGE_ENTRY));
  assert.equal(feedbackHref({ siteName: 'A & B', pageUrl: null }), feedbackHref({ siteName: 'A & B' }));
  assert.throws(() => feedbackHref({ siteName: '' }), TypeError);
  assert.throws(() => feedbackHref({}), TypeError);
  assert.throws(() => feedbackHref({ siteName: 'A', pageUrl: '' }), TypeError);
});

test("page: the feedback link prefills the program's title and the page's canonical URL; the hub's says the family's name", () => {
  const program = feedbackUrlIn(page({ ...PAGE, path: '/hacrp/hospital/990001/' }));
  assert.equal(program.searchParams.get(SITE_ENTRY), SITE.sites.hacrp.title);
  assert.equal(program.searchParams.get(PAGE_ENTRY), `${SITE.origin}/hacrp/hospital/990001/`);
  const hub = feedbackUrlIn(page({ ...PAGE, path: '/methods/' }));
  assert.equal(hub.searchParams.get(SITE_ENTRY), SITE.name);
  assert.equal(hub.searchParams.get(PAGE_ENTRY), `${SITE.origin}/methods/`);
  // A page with no address of its own (the not-found page): no canonical link or og:url, and the site alone prefilled.
  const unaddressed = page({ ...PAGE, path: '/404.html', address: null });
  assert.doesNotMatch(unaddressed, /rel="canonical"|og:url/);
  const missing = feedbackUrlIn(unaddressed);
  assert.equal(missing.searchParams.get(SITE_ENTRY), SITE.name);
  assert.ok(!missing.searchParams.has(PAGE_ENTRY));
  // The link is built at page-build time, so it works without scripts, and opens in a new tab as it did. The one test
  // that spells out an external link's markup (externalLink); every other test compares with the helper's output.
  assert.match(page(PAGE), /<a href="[^"]*" target="_blank" rel="noopener">Send feedback<span class="ico ico--arrow" aria-hidden="true"><\/span><span class="vh"> \(opens in a new tab\)<\/span><\/a>/);
});

test('feedbackFor: the one prefill, the page\'s site (the family\'s on the hub\'s pages) and its canonical address or none; the footer uses it', () => {
  assert.equal(feedbackFor({ path: '/hacrp/x/' }), feedbackHref({ siteName: SITE.sites.hacrp.title, pageUrl: `${SITE.origin}/hacrp/x/` }));
  assert.equal(feedbackFor({ path: '/about/' }), feedbackHref({ siteName: SITE.name, pageUrl: `${SITE.origin}/about/` }));
  assert.equal(feedbackFor({ path: '/hacrp/x/', address: 'https://elsewhere.example/y' }), feedbackHref({ siteName: SITE.sites.hacrp.title, pageUrl: 'https://elsewhere.example/y' }));
  assert.equal(feedbackFor({ path: '/404.html', address: null }), feedbackHref({ siteName: SITE.name }));
  assert.ok(page(PAGE).includes(`href="${escapeHtml(feedbackFor({ path: PAGE.path }))}"`));
});

test('page: the footer uses no inline style (a strict CSP forbids it)', () => {
  assert.doesNotMatch(page(PAGE), /\sstyle=/);
});

test('page: the theme script always loads, extra scripts follow, and robots and JSON-LD appear only when given', () => {
  const plain = page(PAGE);
  assert.ok(!plain.includes('name="robots"'));
  assert.ok(!plain.includes('ld+json'));
  assert.equal(plain.match(/<script /g).length, 1);
  assert.ok(plain.includes('<script type="module" src="/assets/theme.bbbbbbbb.js"></script>'));

  const full = page({ ...PAGE, robots: 'noindex', scripts: ['/assets/hacrp.cccccccc.js'], jsonLd: { name: '</script>' } });
  assert.ok(full.includes('<meta name="robots" content="noindex">'));
  assert.ok(full.indexOf('theme.bbbbbbbb.js') < full.indexOf('hacrp.cccccccc.js'));
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(full)[1];
  assert.deepEqual(JSON.parse(ld), { name: '</script>' });
});

test('page: hostile title, description and path-free text render as text; a plain-string body is escaped', () => {
  const out = page({ ...PAGE, title: '<i>&"', description: '"><script>x</script>', body: '<script>y</script>' });
  assert.ok(out.includes('<title>&lt;i&gt;&amp;&quot;</title>'));
  assert.ok(!out.includes('<script>x'));
  assert.ok(!out.includes('<script>y'));
});

test('page rejects missing parts and a path without a leading slash', () => {
  assert.throws(() => page({ ...PAGE, path: 'hacrp/' }), RangeError);
  assert.throws(() => page({ ...PAGE, title: '' }), TypeError);
  assert.throws(() => page({ ...PAGE, assets: { ...ASSETS, js: {} } }), TypeError);
  for (const shell of [undefined, null]) {
    assert.throws(() => page({ ...PAGE, assets: { ...ASSETS, shell } }), (err) => err instanceof TypeError && /shell/.test(err.message));
  }
  assert.ok(page(PAGE).includes('<h1>Hello</h1>'), 'with the shell\'s facts it renders');
  assert.throws(() => page({ ...PAGE, scripts: [undefined] }), /script/, 'a script path the assets lack');
});

test('page preloads the default fonts unless the page names its own; a font name that is not a file name throws', () => {
  const preloads = (out) => [...out.matchAll(/<link rel="preload" href="\/assets\/fonts\/([\w-]+)\.woff2"/g)].map((m) => m[1]);
  assert.deepEqual(preloads(page(PAGE)), ['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400']);
  assert.deepEqual(preloads(page({ ...PAGE, preloadFonts: ['ibm-plex-mono-700'] })), ['ibm-plex-mono-700']);
  assert.throws(() => page({ ...PAGE, preloadFonts: ['../x'] }), TypeError);
});

test('theme.js stores nothing and sets only data-theme', () => {
  const src = readFileSync(REPO_ROOT + 'web/client/theme.js', 'utf8');
  for (const word of ['localStorage', 'sessionStorage', 'cookie', 'indexedDB']) assert.ok(!src.includes(word), word);
  assert.match(src, /dataset\.theme/);
});

test('theme.js wires every theme toggle (the bar\'s and the footer\'s): each flips data-theme and both keep aria-pressed in step', async () => {
  const toggle = () => {
    const button = { hidden: true, attrs: {}, clicks: [] };
    Object.assign(button, { setAttribute: (k, v) => { button.attrs[k] = v; }, addEventListener: (_, fn) => button.clicks.push(fn) });
    return button;
  };
  const buttons = [toggle(), toggle()];
  const root = { dataset: {} };
  const query = { matches: true, addEventListener() {} };
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = { documentElement: root, querySelectorAll: (s) => (s === '.theme-toggle' ? buttons : []) };
  globalThis.window = { matchMedia: () => query };
  try {
    await import('../client/theme.js');
  } finally {
    Object.assign(globalThis, saved);
    if (saved.document === undefined) delete globalThis.document;
    if (saved.window === undefined) delete globalThis.window;
  }
  const pressed = () => buttons.map((b) => b.attrs['aria-pressed']);
  assert.deepEqual(buttons.map((b) => b.hidden), [false, false]);
  assert.deepEqual(pressed(), ['true', 'true']);
  buttons[0].clicks[0]();
  assert.equal(root.dataset.theme, 'light');
  assert.deepEqual(pressed(), ['false', 'false']);
  buttons[1].clicks[0]();
  assert.equal(root.dataset.theme, 'dark');
  assert.deepEqual(pressed(), ['true', 'true']);
});

test('fillCopy fills plain-string and { text } entries and refuses a missing, unused or unformatted value', () => {
  const copy = { plain: 'Hello, {name}.', claimed: { text: 'Cut by {pct}.', claim: null } };
  assert.equal(fillCopy(copy, 'plain', { name: 'A & B' }), 'Hello, A & B.');
  assert.equal(fillCopy(copy, 'claimed', { pct: '1%' }), 'Cut by 1%.');
  assert.throws(() => fillCopy(copy, 'plain', {}), /name/);
  assert.throws(() => fillCopy(copy, 'plain', { name: 'x', extra: 'y' }), /extra/);
  assert.throws(() => fillCopy(copy, 'plain', { name: 3 }), TypeError);
  assert.throws(() => fillCopy(copy, 'toString'), RangeError);
});

test('pill and footnoteLegend: escaped text, each footnote once in first-seen order, nothing when empty', () => {
  assert.equal(String(pill({ kind: 'pen', label: '<b>' })), '<span class="pill pill--pen">&lt;b&gt;</span>');
  assert.equal(String(pill({ label: 'No' })), '<span class="pill">No</span>');
  assert.equal(footnoteLegend({ heading: 'Notes', lists: [[], []] }), '');
  const out = String(footnoteLegend({ heading: 'Notes', lists: [[{ code: '5', text: 'Five & <x>' }], [{ code: '1', text: 'One' }, { code: '5', text: 'Five & <x>' }]] }));
  assert.equal(out.match(/<dt>/g).length, 2);
  assert.ok(out.indexOf('<dt>5</dt>') < out.indexOf('<dt>1</dt>'));
  assert.ok(out.includes('<dd>Five &amp; &lt;x&gt;</dd>'));
});

test('fillCopyKeep keeps each value, or a run from one value to another, on one line, typesetting and escaping words and values', () => {
  const copy = { pair: { text: "CMS's line: between {a} and {b}", claim: null }, dates: 'From {start} to {end}' };
  assert.equal(String(fillCopyKeep(copy, 'pair', { a: '0.1', b: '<0.2>' }, [['a', 'b']])),
    'CMS’s line: between <span class="nw">0.1 and &lt;0.2&gt;</span>');
  assert.equal(String(fillCopyKeep(copy, 'dates', { start: 'May 1, 2024', end: 'June 2, 2024' }, ['start', 'end'])),
    'From <span class="nw">May 1, 2024</span> to <span class="nw">June 2, 2024</span>');
  assert.throws(() => fillCopyKeep(copy, 'dates', { start: 'a', end: 'b' }, ['nope']), /unknown placeholder/);
  assert.throws(() => fillCopyKeep(copy, 'dates', { start: 'a', end: 1 }, []), /formatted string/);
  assert.equal(String(fillCopyKeep({ twice: 'FY{next} expected early {next}' }, 'twice', { next: '2027' }, [])), 'FY2027 expected early 2027', 'a placeholder used twice is filled twice');
});

test('fillAround puts markup where placeholders stand, typesetting and escaping the words round it, and marks the parts in order', () => {
  const copy = { one: "CMS's {where} line", two: 'Try {state}, {metro} or {state}', plain: 'No {slot}' };
  const link = (href, label) => html`<a href="${href}">${label}</a>`;
  assert.equal(String(fillAround((marks) => fillCopy(copy, 'one', marks), { where: link('/x', 'top & bottom') })),
    'CMS’s <a href="/x">top &amp; bottom</a> line');
  assert.equal(String(fillAround((marks) => fillCopy(copy, 'two', marks), { state: link('/s', 'Ohio'), metro: link('/m', '<M>') })),
    'Try <a href="/s">Ohio</a>, <a href="/m">&lt;M&gt;</a> or <a href="/s">Ohio</a>', 'a placeholder used twice gets its markup twice');
  // any function that fills a sentence will do; the words it returns are escaped, the markup is not escaped again
  assert.equal(String(fillAround(({ slot }) => `a<b ${slot} c&d`, { slot: raw('<i>x</i>') })), 'a&lt;b <i>x</i> c&amp;d');
  assert.equal(String(fillAround((marks) => fillCopy(copy, 'plain', marks), { slot: 'text' })), 'No text', 'plain text is escaped');
  assert.equal(String(fillAround(() => 'a & b', {})), 'a &amp; b', 'no parts: the words, escaped');
});

test('fillAround keeps every part in its own place whatever the count, and a tab or a newline in the sentence stays what it is', () => {
  // Twelve parts, past the tenth (the newline's code) and the ninth (the tab's): the words hold both characters.
  const names = Array.from({ length: 12 }, (_, i) => `p${i}`);
  const parts = Object.fromEntries(names.map((n, i) => [n, html`<b>${String(i)}</b>`]));
  const copy = { all: `first\tcolumn\nsecond line: ${names.map((n) => `{${n}}`).join(' ')}\r\u000b\u0001 end` };
  const got = String(fillAround((marks) => fillCopy(copy, 'all', marks), parts));
  assert.equal(got, `first\tcolumn\nsecond line: ${names.map((_, i) => `<b>${i}</b>`).join(' ')}\r\u000b\u0001 end`);
  // In another order than the parts', and one part repeated, each mark still finds its own markup.
  const copy2 = { back: '{p11}\t{p9}\n{p10} {p0} {p9}' };
  const some = Object.fromEntries(['p10', 'p0', 'p9', 'p11'].map((n) => [n, parts[n]]));
  assert.equal(String(fillAround((marks) => fillCopy(copy2, 'back', marks), some)), '<b>11</b>\t<b>9</b>\n<b>10</b> <b>0</b> <b>9</b>');
});

test('lastCall returns its last result for the same key (by identity) and calls again for a new one', () => {
  let calls = 0;
  const source = { id: 'x' };
  const f = lastCall(({ fy, source: s }) => [fy, s], ({ fy }) => { calls += 1; return `fy${fy}`; });
  assert.equal(f({ fy: 1, source }), 'fy1');
  assert.equal(f({ fy: 1, source }), 'fy1');
  assert.equal(calls, 1, 'the same key: no second call');
  assert.equal(f({ fy: 2, source }), 'fy2');
  assert.equal(f({ fy: 2, source: { id: 'x' } }), 'fy2');
  assert.equal(calls, 3, 'a new value or a new object: called again');
});

test('keepWhole wraps a part of escaped text in one .nw span, and refuses a part that is not there', () => {
  assert.equal(String(keepWhole('A & B (ab-12)', ['(ab-12)'])), 'A &amp; B <span class="nw">(ab-12)</span>');
  assert.throws(() => keepWhole('text', ['missing']), /not in the text/);
});

test('copy is typeset: straight apostrophes and quotes become curly in the words, never in a value filled in', () => {
  const copy = { a: { text: "CMS's line and the hospitals' data, a \"quote\" ({name})", claim: null } };
  assert.equal(fillCopy(copy, 'a', { name: "O'Brien's" }), 'CMS\u2019s line and the hospitals\u2019 data, a \u201cquote\u201d (O\'Brien\'s)');
  assert.equal(typeset("{short}'s"), '{short}\u2019s');
  assert.equal(typeset('the z-scores; a Z-score head'), 'the z\u2011scores; a Z-score head', 'z-score in running text takes a non-breaking hyphen');
});

test('markdownSections: a title, an intro, sections with ids, lists, a labelled pipe table and code; everything escaped', async () => {
  const { markdownSections } = await import('../render/markdown.js');
  const md = '# Title <x>\n\nFirst `a&b` para\ncontinues.\n\n## Some Part\n\n- one `<i>`\n- two\n\n| Col | Meaning |\n|---|---|\n| `c1` | says <b> |\n';
  const { title, intro, sections } = markdownSections(md, { idPrefix: 'd', tableClass: 'gb x' });
  assert.equal(title, 'Title <x>');
  assert.equal(intro, 'First a&b para continues.');
  assert.deepEqual(sections.map((s) => [s.heading, s.id]), [[null, null], ['Some Part', 'd-some-part']]);
  assert.equal(String(sections[0].body), '<p>First <code>a&amp;b</code> para continues.</p>');
  const body = String(sections[1].body);
  assert.ok(body.includes('<ul><li>one <code>&lt;i&gt;</code></li><li>two</li></ul>'));
  assert.ok(body.includes('<table class="gb x" aria-labelledby="d-some-part">'));
  assert.ok(body.includes('<tr><th scope="row"><code>c1</code></th><td>says &lt;b&gt;</td></tr>'));
  assert.ok(body.includes('<div class="printout"><div class="printout__scroll">'));
});

test('markdownSections: a line outside the subset ("### x", a "|" line with no rule under it) is a paragraph', async () => {
  const { markdownSections } = await import('../render/markdown.js');
  const { sections } = markdownSections('### Not a heading\n\n| a | b\nnext line\n', { idPrefix: 'd' });
  assert.equal(String(sections[0].body), '<p>### Not a heading</p><p>| a | b next line</p>');
});

test('markdownSections: a second "# " title, two "## " headings with one id and a heading with no id stop it, naming the label', async () => {
  const { markdownSections } = await import('../render/markdown.js');
  const bad = [
    ['# One\n\ntext\n\n# Two\n', /more than one "# " title/],
    ['## Same\n\ntext\n\n## same!\n', /"same!" gives the id "d-same" that "Same" already has/],
    ['## !!!\n\ntext\n', /"!!!" has no letters or digits/],
  ];
  for (const [md, message] of bad) {
    assert.throws(() => markdownSections(md, { idPrefix: 'd', label: 'the-label' }), (err) => err instanceof RangeError && err.message.startsWith('the-label: ') && message.test(err.message), md);
    assert.throws(() => markdownSections(md, { idPrefix: 'd' }), /^RangeError: d: /, 'the label defaults to the id prefix');
  }
  // One title and headings that differ are fine.
  assert.deepEqual(markdownSections('# T\n\n## A b\n\n## A-c\n', { idPrefix: 'd' }).sections.map((x) => x.id), ['d-a-b', 'd-a-c']);
});

test('topbar.js: the section in view is the last whose top has passed the line, else the first', async () => {
  const { sectionInView } = await import('../client/topbar.js');
  assert.equal(sectionInView([300, 900, 1500], 100), 0);
  assert.equal(sectionInView([-50, 90, 1500], 100), 1);
  assert.equal(sectionInView([-900, -400, -10], 100), 2);
});
