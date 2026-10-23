import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../site.js';
import { cmsText, count, decimal, isoDate, isoMonth, longDate, pct, shown, signed } from '../render/format.js';
import { fillAround, fillCopy, fillCopyKeep, footnoteLegend, keepWhole, lastCall, pill, typeset } from '../render/components.js';
import { Safe, escapeHtml, html, jsonScript, raw } from '../render/html.js';
import { page } from '../render/layout.js';

const ASSETS = { css: '/assets/site.aaaaaaaa.css', js: { theme: '/assets/theme.bbbbbbbb.js' } };
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
  assert.ok(out.includes('Not affiliated with or endorsed by CMS.'));
  assert.ok(out.includes('Uses public data from the Centers for Medicare &amp; Medicaid Services (CMS) and shows no patient information.'));
  assert.ok(out.includes('Built with Claude Code'));
  // The name and credentials never split; the byline may break after "Built by".
  assert.ok(out.includes('Built by <a href="https://www.linkedin.com/in/dalton-haslam" target="_blank" rel="noopener"><span class="nw">Dalton Haslam, MD, MBA</span><span class="vh"> (opens in a new tab)</span></a>'));
  assert.ok(out.includes(`href="${SITE.feedbackUrl}"`));
  assert.ok(out.includes('href="https://creativecommons.org/licenses/by/4.0/"'));
  assert.ok(out.includes('href="/methods/"'));
  assert.ok(out.includes('Paid &amp; <span class="wordmark__pen">Penalized</span>'));
  assert.match(out, /<button type="button" class="theme-toggle" aria-pressed="false" hidden>Dark mode<\/button>/);
});

test('page: the header runs wordmark, byline, theme toggle in the markup, and the CSS never reorders it', () => {
  const header = /<header[\s\S]*?<\/header>/.exec(page(PAGE))[0];
  const at = (s) => header.indexOf(s);
  assert.ok(at('class="wordmark"') < at('class="byline"') && at('class="byline"') < at('class="theme-toggle"'));
  // DOM order = visual order = tab order at every width: no flex `order` anywhere in the shared styles.
  const css = readFileSync(`${REPO_ROOT}/web/styles/components.css`, 'utf8');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /(^|[\s;{])order\s*:/);
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
  assert.throws(() => page({ ...PAGE, assets: { css: '/x.css', js: {} } }), TypeError);
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

test('theme.js flips data-theme from the device preference and keeps aria-pressed in step', async () => {
  const attrs = {};
  const clicks = [];
  const button = { hidden: true, setAttribute: (k, v) => { attrs[k] = v; }, addEventListener: (_, fn) => clicks.push(fn) };
  const root = { dataset: {} };
  const query = { matches: true, addEventListener() {} };
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = { documentElement: root, querySelector: (s) => (s === '.theme-toggle' ? button : null) };
  globalThis.window = { matchMedia: () => query };
  try {
    await import('../client/theme.js');
  } finally {
    Object.assign(globalThis, saved);
    if (saved.document === undefined) delete globalThis.document;
    if (saved.window === undefined) delete globalThis.window;
  }
  assert.equal(button.hidden, false);
  assert.equal(attrs['aria-pressed'], 'true');
  clicks[0]();
  assert.equal(root.dataset.theme, 'light');
  assert.equal(attrs['aria-pressed'], 'false');
  clicks[0]();
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(attrs['aria-pressed'], 'true');
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

test('programHeader: the small mark to /, the name and edition tag, the search slot, the toggle, then the numbered nav and the byline', async () => {
  const { programHeader } = await import('../render/layout.js');
  const nav = [{ id: 'how', label: 'How it works', href: '/x/#how' }, { id: 'list', label: 'Every <one>', href: '/x/#list' }];
  const header = String(programHeader({ name: 'A program', href: '/x/', tag: 'AP · FY2026', nav, current: 'list', search: html`<form id="s"></form>` }));
  const at = (s) => header.indexOf(s);
  assert.ok(at('class="pp-mark" href="/"') < at('class="program-mark" href="/x/"'));
  assert.ok(at('program-mark') < at('<form id="s">') && at('<form id="s">') < at('class="theme-toggle"'));
  assert.ok(at('class="theme-toggle"') < at('<nav class="nav" aria-label="Sections">') && at('<nav') < at('class="byline"'));
  assert.ok(header.includes('P&amp;<span class="pp-mark__pen">P</span><span class="vh"> Paid &amp; Penalized home</span>'), 'the last P in the penalty red, P& in ink');
  assert.ok(header.includes('<span class="wordmark__name">A program</span> <span class="wordmark__tag">AP · FY2026</span>'));
  assert.ok(header.includes('<li><a href="/x/#how" data-nav="how"><span class="nav__num">1</span>How it works</a></li>'));
  assert.ok(header.includes('<li><a href="/x/#list" data-nav="list" aria-current="true"><span class="nav__num">2</span>Every &lt;one&gt;</a></li>'));
  assert.ok(!/<h1/.test(header));
  assert.throws(() => programHeader({ name: 'A', href: '/x/', tag: 't', nav, current: 'nope' }), /nope/);
  assert.throws(() => programHeader({ name: 'A', href: '/x/', tag: 't', nav: [] }), TypeError);
  // In a page, it stands in for the family's masthead: still one header, the byline once.
  const out = page({ ...PAGE, topbar: programHeader({ name: 'A', href: '/x/', tag: 't', nav }) });
  assert.equal(out.match(/<header[ >]/g).length, 1);
  assert.ok(!out.includes('class="masthead"'));
  assert.equal(out.match(/class="byline"/g).length, 1);
});

test('topbar.js: the section in view is the last whose top has passed the line, else the first', async () => {
  const { sectionInView } = await import('../client/topbar.js');
  assert.equal(sectionInView([300, 900, 1500], 100), 0);
  assert.equal(sectionInView([-50, 90, 1500], 100), 1);
  assert.equal(sectionInView([-900, -400, -10], 100), 2);
});
