import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../site.js';
import { cmsText, count, isoDate, longDate, pct, signed } from '../render/format.js';
import { fillCopy, footnoteLegend, pill } from '../render/components.js';
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

test('longDate and isoDate spell the month out and reject non-dates', () => {
  assert.equal(longDate('07/01/2022'), 'July 1, 2022');
  assert.equal(isoDate('2026-08-13'), 'August 13, 2026');
  assert.equal(isoDate('2024-02-29'), 'February 29, 2024');
  assert.throws(() => longDate('13/01/2022'), RangeError);
  assert.throws(() => longDate('2022-07-01'), RangeError);
  assert.throws(() => isoDate('2026-02-30'), RangeError);
  assert.throws(() => isoDate('August 13, 2026'), RangeError);
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
  assert.ok(out.includes('<link rel="icon" href="/favicon.svg"'));
  assert.ok(out.includes(`<link rel="stylesheet" href="${ASSETS.css}">`));
  assert.ok(out.indexOf('class="skip" href="#main"') < out.indexOf('<header'));
  assert.ok(out.includes('<main id="main">'));
  assert.ok(out.includes('Not affiliated with or endorsed by CMS.'));
  assert.ok(out.includes('Uses public data from the Centers for Medicare &amp; Medicaid Services (CMS) and shows no patient information.'));
  assert.ok(out.includes('Built with Claude Code'));
  assert.ok(out.includes('Built by <a href="https://www.linkedin.com/in/dalton-haslam" target="_blank" rel="noopener">Dalton Haslam, MD, MBA<span class="vh"> (opens in a new tab)</span></a>'));
  assert.ok(out.includes(`href="${SITE.feedbackUrl}"`));
  assert.ok(out.includes('href="https://creativecommons.org/licenses/by/4.0/"'));
  assert.ok(out.includes('href="/methods/"'));
  assert.ok(out.includes('Paid &amp; <span class="wordmark__pen">Penalized</span>'));
  assert.match(out, /<button type="button" class="theme-toggle" aria-pressed="false" hidden>Dark mode<\/button>/);
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
