// The pills (components.js pill): a word on a filled meaning ink, --on-mark on --pen or --rew. Small bold text, so WCAG
// AA's 4.5:1 applies, in both themes. Read from tokens.css: the light block (:root) and the dark one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';

const css = readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8');
const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const light = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
const token = (block, name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block);
  assert.ok(m, `--${name} in the block`);
  return m[1];
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('a pill\'s word stands 4.5:1 off its ink, a cut or a bonus, in the light and the dark theme', () => {
  assert.equal(contrast('#ffffff', '#00876f').toFixed(2), '4.47', 'the formula, on the green that failed');
  for (const [theme, block] of [['light', light], ['dark', dark]]) {
    for (const ink of ['pen', 'rew']) {
      const ratio = contrast(token(block, 'on-mark'), token(block, ink));
      assert.ok(ratio >= 4.5, `${theme} --on-mark on --${ink}: ${ratio.toFixed(2)}:1`);
    }
  }
});
