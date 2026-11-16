// What a screen reader meets on a hospital page, on synthetic hospitals: a heading over each of the page's parts, so the
// figures' own h3s nest under an h2 (no level skipped); each what-if slider named by its visible label (no aria-label
// over it) and described by the sentence under it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalContext, hospitalView } from '../web/view.js';
import { ASSETS, CONDITIONS, CUT, HISTORY, META, NONE_MEASURED, OTHERS } from './fixtures.js';

const ctx = hospitalContext({ hospitals: [CUT, NONE_MEASURED, ...OTHERS], meta: META, history: HISTORY, conditions: CONDITIONS });
const page = String(hospitalPage({ view: hospitalView(CUT, ctx), robots: null, assets: ASSETS }));
const main = /<main[\s\S]*<\/main>/.exec(page)?.[0] ?? page;

test('a hospital page heads its parts with h2s, so no heading level is skipped', () => {
  const levels = [...main.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.equal(levels[0], 1, 'the hospital\'s name first');
  levels.forEach((level, i) => assert.ok(!i || level <= levels[i - 1] + 1, `h${levels[i - 1]} then h${level}`));
  assert.ok(levels.filter((l) => l === 2).length >= 3, 'the rulers, the what-if and the history at least');
});

test('each what-if slider is named by its label and described by the sentence under it', () => {
  const inputs = [...main.matchAll(/<input class="wi__range"[^>]*>/g)].map((m) => m[0]);
  assert.ok(inputs.length, 'a slider');
  for (const input of inputs) {
    assert.doesNotMatch(input, /aria-label=/);
    const id = /id="([^"]+)"/.exec(input)[1];
    assert.match(input, new RegExp(`aria-describedby="${id}-esc"`));
    assert.match(main, new RegExp(`<label class="wi__name" for="${id}"><span class="vh">`));
    assert.match(main, new RegExp(`<p class="small wi__escape" id="${id}-esc">`));
  }
});
