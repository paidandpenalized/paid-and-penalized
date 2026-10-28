// The house word list, as a guard over every copy file: no word that labels a hospital as a wrongdoer (CMS's own rule
// words, such as "the worst score" CMS assigns, are fine); no word that promises a program, a page or a date to come; and,
// in the family's shared and policy words, no promised reply time, fix time or deletion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, repoFiles } from '../../pipeline/files.js';
import { FUTURE_WORDS, copyFiles } from '../../pipeline/test/helpers.js';

const LABELS = [
  /\b(caught|cheat(s|ed|ing)?|dodg(e|es|ed|ing))\b/i,
  /\bworst\s+hospitals?\b/i,
  /\bhospitals?\s+(that\s+)?fail(s|ed)?\b/i,
];
const PROMISES = [
  /\b(within|business days?|promptly|as soon as)\b/i,
  /\bwe will (reply|respond|fix|delete)\b/i,
  /\b(delete|remove) your\b/i,
];

const FUTURE = [FUTURE_WORDS];
// The future words' few uses that promise no program, page or date, each pinned to its file, key and exact phrase: the
// phrase is taken out before the check (the rest of the text is still checked), and a phrase no longer in its text fails,
// so a stale entry is removed rather than left to excuse a new use.
const FUTURE_OK = [
  // The accessibility page's testing practice: "launch" is a site going public, the moment the cross-browser check runs.
  ['hub/copy.js', 'a11yTested', 'Before each launch'],
  // HACRP's Methods: the site's own source code, which is published with the site (a statement about this repository,
  // not a program or a page to come). Reword it when the code is public.
  ['sites/hacrp/web/methods/copy.js', 'sourcesCode', 'will be public when the site launches'],
];

const texts = (COPY) => Object.entries(COPY).map(([key, v]) => [key, typeof v === 'string' ? v : v.text]);
const hits = (patterns, text) => patterns.filter((re) => re.test(text));

test('each pattern catches the phrasing it is for', () => {
  for (const s of ['CMS caught the hospital', 'hospitals that dodge the rule', 'the worst hospitals in the state', 'a hospital that failed'])
    assert.ok(hits(LABELS, s).length, s);
  for (const s of ['A reply within two days', 'Fixed in three business days', 'We will reply soon', 'We delete your message', 'answered promptly'])
    assert.ok(hits(PROMISES, s).length, s);
  for (const s of ['CMS assigned the worst score', "its data failed CMS's validation", 'the worst-performing quarter'])
    assert.equal(hits(LABELS, s).length, 0, s);
  for (const s of ['Coming soon', "This program's page is coming.", 'Want this one sooner?', 'More as each site launches.', 'Before the launch'])
    assert.ok(hits(FUTURE, s).length, s);
  for (const s of ['Under consideration', 'Not built yet', 'an upcoming CMS rule', 'becoming', 'the program launched in a year'])
    assert.equal(hits(FUTURE, s).length, 0, s);
});

// A file that exports COPY but is not named copy.js would sit outside every copy guard (digits, house words, promises).
test('every web, hub or sites file that exports COPY is one of the guarded copy files', () => {
  const guarded = new Set(copyFiles());
  const strays = repoFiles('', { untracked: true }).filter((p) => /^(web|hub|sites)\/.+\.js$/.test(p) && !/\/test\//.test(p)
    && /^export (const|let|function) COPY\b/m.test(readFileSync(REPO_ROOT + p, 'utf8')) && !guarded.has(p));
  assert.deepEqual(strays, []);
});

// Each text with its allowed future phrases taken out; throws when an allowed phrase is not in its text.
function withoutAllowed(file, key, text) {
  let rest = text;
  for (const [f, k, phrase] of FUTURE_OK.filter(([f, k]) => f === file && k === key)) {
    assert.ok(rest.includes(phrase), `${f} ${k}: the allowed phrase "${phrase}" is gone; remove its FUTURE_OK entry`);
    rest = rest.replace(phrase, '');
  }
  return rest;
}

test('every allowed future phrase names a copy file and a key it has', async () => {
  for (const [file, key] of FUTURE_OK) {
    assert.ok(copyFiles().includes(file), file);
    const { COPY } = await import(pathToFileURL(REPO_ROOT + file));
    assert.ok(Object.hasOwn(COPY, key), `${file} ${key}`);
  }
});

for (const file of copyFiles()) {
  // The family's shared and policy words also make no promises of a reply, fix or deletion.
  const family = /^(web|hub)\//.test(file);
  test(`${file}: no word labels a hospital or promises a program, page or date${family ? ', and nothing promises a reply, fix or deletion' : ''}`, async () => {
    const { COPY } = await import(pathToFileURL(REPO_ROOT + file));
    const patterns = family ? [...LABELS, ...PROMISES] : LABELS;
    for (const [key, text] of texts(COPY)) {
      assert.deepEqual(hits(patterns, text), [], `${key}: "${text}"`);
      assert.deepEqual(hits(FUTURE, withoutAllowed(file, key, text)), [], `${key}: "${text}"`);
    }
  });
}
