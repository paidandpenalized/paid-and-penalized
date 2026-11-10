// The note on a hub or HACRP hospital page for a hospital whose Medicare agreement CMS lists as ended
// (web/render/closed.js). Synthetic records only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedNote, closedNoteMarkup } from '../render/closed.js';

const at = (date) => ({ ccn: '990001', inactive: { date, reason: 'merger or closure' }, fy: 2026 });

test('ended before the year began: not paid under the ID that year, so a cut is unlikely to have been collected', () => {
  const text = closedNote({ ...at('2025-02-11'), dollars: -1000 });
  assert.equal(text, 'CMS lists this hospital’s Medicare agreement under CCN 990001 as ended on February 11, 2025 (merger or closure), before FY2026 began. It was not paid under this ID in FY2026, so its estimated cut is unlikely to have been collected. This site keeps it in its totals.');
  assert.match(closedNote({ ...at('2025-09-30'), dollars: 25 }), /before FY2026 began\. .*, so its estimated bonus is unlikely to have been paid\./);
});

test('ended during the year: only part of its dollars is likely to have changed hands; $0 says nothing of them', () => {
  assert.match(closedNote({ ...at('2025-10-01'), dollars: -1000 }), /on October 1, 2025 \(merger or closure\), during FY2026\. It was not paid under this ID after that, so only part of its estimated cut is likely to have been collected\./);
  assert.match(closedNote({ ...at('2026-09-30'), dollars: 1000 }), /only part of its estimated bonus is likely to have been paid\./);
  assert.match(closedNote({ ...at('2026-03-30'), dollars: 0 }), /during FY2026\. It was not paid under this ID after that\. This site keeps it in its totals\.$/);
});

test('no note for a hospital still in Medicare, or one whose agreement ended after the year; an undated end says so without a time', () => {
  assert.equal(closedNote({ ccn: '990001', inactive: null, fy: 2026, dollars: -1000 }), '');
  assert.equal(closedNote({ ...at('2026-10-01'), dollars: -1000 }), '');
  assert.equal(closedNote({ ...at(null), dollars: -1000 }), 'CMS lists this hospital’s Medicare agreement under CCN 990001 as ended (merger or closure). This site keeps it in its totals.');
});

test('as markup: the same words, the tail alone in its span, so a page can hide what the dollars likely were and keep when the agreement ended', () => {
  const tagless = (markup) => String(markup).replace(/<[^>]*>/g, '');
  const cut = { ...at('2025-02-11'), dollars: -1000 };
  const markup = String(closedNoteMarkup(cut, 'x-tail'));
  assert.equal(tagless(markup), closedNote(cut));
  assert.match(markup, /in FY2026<span class="x-tail">, so its estimated cut is unlikely to have been collected<\/span>\. This site keeps it in its totals\.$/);
  // No tail ($0, or an undated end), no span; no note, nothing.
  for (const args of [{ ...at('2026-03-30'), dollars: 0 }, { ...at(null), dollars: -1000 }]) {
    assert.doesNotMatch(String(closedNoteMarkup(args, 'x-tail')), /<span/);
    assert.equal(tagless(closedNoteMarkup(args, 'x-tail')), closedNote(args));
  }
  assert.equal(closedNoteMarkup({ ...at('2026-10-01'), dollars: -1000 }, 'x-tail'), '');
});
