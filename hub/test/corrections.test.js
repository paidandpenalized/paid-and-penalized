import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ASSETS } from '../../pipeline/test/helpers.js';
import { fillCopy } from '../../web/render/components.js';
import { isoDate } from '../../web/render/format.js';
import { SITE } from '../../web/site.js';
import { CORRECTIONS_EMAIL } from '../constants.js';
import { COPY } from '../copy.js';
import { correctionsContent, readCorrections } from '../corrections.js';
import { feedbackLink } from '../parts.js';
import { policyPage } from '../policy.js';

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

test('an item whose name does not end in .md is skipped whatever it is: a folder of evidence, a link to a PDF', () => {
  const also = (dir) => {
    mkdirSync(join(dir, 'evidence'));
    writeFileSync(join(dir, 'evidence', '2026-11-02-inside.md'), 'Not an entry: it is inside a folder.');
    mkdirSync(join(dir, '2026-11-02-folder'));
    writeFileSync(join(dir, 'proof.pdf'), 'x');
    symlinkSync(join(dir, 'proof.pdf'), join(dir, '2026-11-02-proof.pdf'));
    symlinkSync(join(dir, 'missing.pdf'), join(dir, 'dangling.pdf'));
  };
  assert.deepEqual(readLog({ '2026-11-02-a.md': 'Body.' }, also), [{ date: '2026-11-02', slug: 'a', body: 'Body.' }]);
  assert.deepEqual(readLog({}, also), []);
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

// ---------- correctionsContent, laid out as the build lays it out ----------
const SITE_DATES = new Map([['hacrp', { cmsReleased: '2026-08-13', changed: '2026-10-22' }]]);
const PATH = SITE.pages.corrections;
const page = (over = {}) => policyPage({ path: PATH, ...correctionsContent({ feedback: feedbackLink(PATH), entries: [], updated: SITE_DATES, ...over }), assets: ASSETS, robots: 'noindex' });
const ENTRIES = [
  { date: '2026-11-02', slug: 'a', body: 'The first correction.' },
  { date: '2026-10-30', slug: 'b', body: 'The second correction.' },
];

test('with no entries the log says so, and is the last section', () => {
  const text = page();
  assert.match(text, /<h1[^>]*>Corrections<\/h1>/);
  assert.match(text, new RegExp(`<h2 class="doc__h" id="log-h">${COPY.correctionsLogHeading}</h2>\\s*<p>${COPY.correctionsLogEmpty}</p>`));
  assert.doesNotMatch(text, /pol__entry"/);
  assert.equal([...text.matchAll(/<section class="doc__sec" id="([^"]+)"/g)].at(-1)[1], 'log');
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

test('an entry with two titles, two headings with one id, or a heading with no id stops the build and names the entry', () => {
  for (const body of ['# One\n\n# Two\n\nText.', '## Same\n\nText.\n\n## same\n\nText.', '## ???\n\nText.']) {
    assert.throws(() => page({ entries: [ENTRIES[0], { date: '2026-11-02', slug: 'bad', body }] }), (err) => err instanceof RangeError && err.message.startsWith('corrections/2026-11-02-bad.md: '), body);
  }
});

test('the corrections address shows once, as a mailto link, and each site gives the date of CMS\'s file and the date its numbers last changed', () => {
  const text = page({ entries: ENTRIES });
  assert.equal(text.split(`href="mailto:${CORRECTIONS_EMAIL}"`).length - 1, 1);
  assert.ok(text.includes(`<a href="mailto:${CORRECTIONS_EMAIL}">${CORRECTIONS_EMAIL}</a>`));
  const time = (iso) => `<time datetime="${iso}">${isoDate(iso)}</time>`;
  assert.ok(text.includes(fillCopy(COPY, 'correctionsSite', { site: SITE.sites.hacrp.title, cms: time('2026-08-13'), changed: time('2026-10-22') })));
});

test('with no site dates the sites section is left out; a site the family does not have or a bad date stops the build', () => {
  assert.doesNotMatch(page({ updated: new Map() }), new RegExp(COPY.correctionsSitesHeading));
  for (const id of ['nowhere', 'toString']) {
    assert.throws(() => page({ updated: new Map([[id, { cmsReleased: '2026-08-13', changed: '2026-10-22' }]]) }), new RegExp(id));
  }
  assert.throws(() => page({ updated: new Map([['hacrp', { cmsReleased: '2026-08-13', changed: '2026-02-30' }]]) }), RangeError);
  assert.throws(() => page({ entries: [{ date: '2026-13-01', slug: 'x', body: 'b' }] }), RangeError);
});
