// The house word list, as a guard over every copy file: no word that labels a hospital as a wrongdoer (CMS's own rule
// words, such as "the worst score" CMS assigns, are fine), and, in the family's shared and policy words, no promised
// reply time, fix time or deletion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, repoFiles } from '../../pipeline/files.js';

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

const copyFiles = () => ['web/', 'sites/', 'hub/']
  .flatMap((dir) => repoFiles(dir, { untracked: true }))
  .filter((p) => p.split('/').at(-1) === 'copy.js');
const texts = (COPY) => Object.entries(COPY).map(([key, v]) => [key, typeof v === 'string' ? v : v.text]);
const hits = (patterns, text) => patterns.filter((re) => re.test(text));

test('each pattern catches the phrasing it is for', () => {
  for (const s of ['CMS caught the hospital', 'hospitals that dodge the rule', 'the worst hospitals in the state', 'a hospital that failed'])
    assert.ok(hits(LABELS, s).length, s);
  for (const s of ['A reply within two days', 'Fixed in three business days', 'We will reply soon', 'We delete your message', 'answered promptly'])
    assert.ok(hits(PROMISES, s).length, s);
  for (const s of ['CMS assigned the worst score', "its data failed CMS's validation", 'the worst-performing quarter'])
    assert.equal(hits(LABELS, s).length, 0, s);
});

for (const file of copyFiles()) {
  test(`${file}: no word labels a hospital${/^(web|hub)\//.test(file) ? ', and nothing promises a reply, fix or deletion' : ''}`, async () => {
    const { COPY } = await import(pathToFileURL(REPO_ROOT + file));
    const patterns = /^(web|hub)\//.test(file) ? [...LABELS, ...PROMISES] : LABELS;
    for (const [key, text] of texts(COPY)) assert.deepEqual(hits(patterns, text), [], `${key}: "${text}"`);
  });
}
