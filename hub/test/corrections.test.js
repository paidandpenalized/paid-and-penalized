import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { escapeHtml } from '../../web/render/html.js';
import { CORRECTIONS_EMAIL } from '../constants.js';
import { COPY } from '../copy.js';
import { correctionsPage, readCorrections } from '../corrections.js';

const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js' } };
const textOf = (page) => page.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

// Reads a fresh folder holding these files ({ name: text }); `also` can add more to it (a folder, a link) first.
function readLog(files, also = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pp-corrections-'));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    also(dir);
    return readCorrections(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- readCorrections ----------
test('readCorrections returns the entries newest first, then by slug, each with its date, slug and body', () => {
  assert.deepEqual(readLog({
    '2026-11-02-a.md': 'First body.\n',
    '2026-10-30-b.md': 'Second body.\n',
    '2026-11-02-0-first.md': 'Same day.\n',
  }), [
    { date: '2026-11-02', slug: '0-first', body: 'Same day.' },
    { date: '2026-11-02', slug: 'a', body: 'First body.' },
    { date: '2026-10-30', slug: 'b', body: 'Second body.' },
  ]);
});

test('an absent, empty or readme-only corrections folder is an empty log; evidence beside the entries is not an entry', () => {
  assert.deepEqual(readLog({}), []);
  assert.deepEqual(readLog({ 'README.md': 'How to write an entry.\n', '.DS_Store': 'x' }), []);
  assert.deepEqual(readLog({ 'notes.txt': 'x', '2026-11-02-a.pdf': 'x', '2026-11-02-a.md.txt': 'x', '2026-11-02-a.md': 'Body.' }),
    [{ date: '2026-11-02', slug: 'a', body: 'Body.' }]);
  assert.deepEqual(readCorrections(join(tmpdir(), 'pp-corrections-does-not-exist')), []);
});

test('a malformed entry stops the read with its file name: a date not on the calendar, no slug, a capital, a blank body', () => {
  const bad = {
    '2026-02-30-x.md': 'Body.',
    '2026-13-01-x.md': 'Body.',
    '1999-12-31-x.md': 'Body.',
    'notes.md': 'Body.',
    '2026-11-02-.md': 'Body.',
    '2026-11-02-Upper.md': 'Body.',
    '2026-11-02.md': 'Body.',
    '2026-11-02-x.MD': 'Body.',
    '2026-11-02-blank.md': ' \n\t\n',
    '2026-11-02-empty.md': '',
  };
  for (const [name, text] of Object.entries(bad)) {
    assert.throws(() => readLog({ [name]: text }), (err) => err instanceof Error && err.message.includes(name), name);
  }
  // A folder or a link named like an entry is not a file the change gate would count either.
  assert.throws(() => readLog({}, (dir) => mkdirSync(join(dir, '2026-11-02-dir.md'))), /2026-11-02-dir\.md/);
  assert.throws(() => readLog({}, (dir) => symlinkSync(join(dir, 'target'), join(dir, '2026-11-02-link.md'))), /2026-11-02-link\.md/);
  // One bad file among good ones still stops the build.
  assert.throws(() => readLog({ '2026-11-02-a.md': 'Body.', 'notes.md': 'x' }), /notes\.md/);
});

// ---------- correctionsPage ----------
const SITE_DATES = new Map([['hacrp', { cmsReleased: '2026-08-13', changed: '2026-10-22' }]]);
const page = (over = {}) => correctionsPage({ entries: [], updated: SITE_DATES, assets: ASSETS, robots: 'noindex', ...over });
const ENTRIES = [
  { date: '2026-11-02', slug: 'a', body: 'The first correction.' },
  { date: '2026-10-30', slug: 'b', body: 'The second correction.' },
];

test('with no entries the log says so, and is the last section', () => {
  const text = page();
  assert.match(text, /<h1[^>]*>Corrections<\/h1>/);
  assert.match(text, new RegExp(`<h2 class="pol__h" id="log-h">${COPY.correctionsLogHeading}</h2>\\s*<p>${COPY.correctionsLogEmpty}</p>`));
  assert.doesNotMatch(text, /pol__entry"/);
  const ids = [...text.matchAll(/<section class="pol__sec" id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.at(-1), 'log');
  assert.deepEqual([...text.match(/<nav class="pol__toc"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]), ids);
});

test('each entry shows its date from the file name in a <time>, then its body, in the order given', () => {
  const text = page({ entries: ENTRIES });
  assert.doesNotMatch(text, new RegExp(COPY.correctionsLogEmpty));
  assert.equal(text.match(/<article class="pol__entry"/g).length, 2);
  assert.ok(text.includes('<time datetime="2026-11-02">November 2, 2026</time>'));
  assert.ok(text.includes('<time datetime="2026-10-30">October 30, 2026</time>'));
  assert.ok(text.indexOf('The first correction.') < text.indexOf('The second correction.'));
  assert.match(text, /<article class="pol__entry" id="e-2026-11-02-a">/);
  assert.match(text, /<p>The first correction\.<\/p>/);
});

test('an entry body renders through the Markdown subset, escaped: paragraphs, lists, code, a table, headings under the date', () => {
  const body = [
    '# A title',
    '',
    'Hostile <script>alert(1)</script> & "quoted" text with `code <b>`.',
    '',
    '- one',
    '- two',
    '',
    '## What changed',
    '',
    '| Page | Before | After |',
    '|---|---|---|',
    '| A | 1 | 2 |',
  ].join('\n');
  const text = page({ entries: [{ date: '2026-11-02', slug: 'rich', body }] });
  assert.doesNotMatch(text, /<script>alert/);
  assert.match(text, /Hostile &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quoted&quot; text with <code>code &lt;b&gt;<\/code>\./);
  assert.match(text, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  // The title is shown with the date, never dropped; a "## " heading is a level below the date.
  assert.match(text, /<h3 class="pol__entry-h"><time datetime="2026-11-02">November 2, 2026<\/time> <span class="pol__entry-title">A title<\/span><\/h3>/);
  const h4 = text.match(/<h4 class="pol__entry-sub" id="([^"]+)">What changed<\/h4>/);
  assert.ok(h4, 'the heading');
  assert.ok(text.includes(`aria-labelledby="${h4[1]}"`), 'the table is labelled by it');
  // Every id on the page is unique.
  const ids = [...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotMatch(text, /\sstyle=/);
});

test('the corrections address shows once, as a mailto link, and each site gives the date of CMS\'s file and the date its numbers last changed', () => {
  const text = page({ entries: ENTRIES });
  assert.equal(textOf(text).split(CORRECTIONS_EMAIL).length - 1, 1);
  assert.equal(text.split(`href="mailto:${CORRECTIONS_EMAIL}"`).length - 1, 1);
  assert.ok(text.includes(`<a href="mailto:${CORRECTIONS_EMAIL}">${CORRECTIONS_EMAIL}</a>`));
  assert.ok(textOf(text).includes('Hospital-Acquired Conditions: CMS’s file released August 13, 2026 ; this site’s numbers last changed October 22, 2026 .'));
  assert.ok(text.includes('<time datetime="2026-08-13">August 13, 2026</time>'));
  assert.ok(text.includes('<time datetime="2026-10-22">October 22, 2026</time>'));
});

test('the report sentence links the feedback form, prefilled with this page', () => {
  const text = page();
  assert.match(text, /<a href="https:\/\/docs\.google\.com\/forms\/[^"]*corrections[^"]*" target="_blank" rel="noopener">feedback form<span class="vh">/);
});

test('every word of the page\'s copy shows on it, with the address and the sites\' dates filled in', () => {
  const withEntries = page({ entries: ENTRIES });
  const words = textOf(withEntries);
  for (const key of Object.keys(COPY).filter((k) => k.startsWith('corrections'))) {
    if (key === 'correctionsLogEmpty') {
      assert.ok(textOf(page()).includes(COPY[key]), key); // shown while the log is empty
      continue;
    }
    if (key.endsWith('Description')) { assert.ok(withEntries.includes(escapeHtml(COPY[key])), key); continue; }
    const stretch = COPY[key].split(/\{\w+\}/).map((x) => x.trim()).reduce((a, b) => (b.length > a.length ? b : a), '');
    assert.ok(words.includes(stretch), `${key} is not on the page`);
  }
  assert.doesNotMatch(words, /\{\w+\}/);
});

test('with no site dates the sites section is left out; a site the family does not have or a bad date stops the build', () => {
  assert.doesNotMatch(page({ updated: new Map() }), new RegExp(COPY.correctionsSitesHeading));
  assert.throws(() => page({ updated: new Map([['nowhere', { cmsReleased: '2026-08-13', changed: '2026-10-22' }]]) }), /nowhere/);
  assert.throws(() => page({ updated: new Map([['hacrp', { cmsReleased: '2026-08-13', changed: '2026-02-30' }]]) }), RangeError);
  assert.throws(() => page({ entries: [{ date: '2026-13-01', slug: 'x', body: 'b' }] }), RangeError);
});

test('the page is noindex when asked, has one h1, no figure and no inline style, and its canonical address is /corrections/', () => {
  const text = page({ entries: ENTRIES });
  assert.ok(text.includes('<meta name="robots" content="noindex">'));
  assert.equal(text.match(/<h1[\s>]/g)?.length, 1);
  assert.doesNotMatch(text, /\sstyle=|<figure|<svg/);
  assert.match(text, /<link rel="canonical" href="https:\/\/paidandpenalized\.org\/corrections\/">/);
});
