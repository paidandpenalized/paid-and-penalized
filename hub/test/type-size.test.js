// The hub's text follows the reader's browser text size: hub/styles.css sizes its type in rem (the --fs-* tokens or rem
// values), never px, so a reader who raises the default size sees every line grow with the body text. The drawings that
// set their own type (the strips' SVG text, .st__*) are the exception. A box that holds text sets a minimum height, never
// a fixed one, so larger text is not clipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(import.meta.dirname, '..', 'styles.css'), 'utf8');
// Each rule's selector and declarations, comments dropped (one rule per line in this sheet; a rule in a media block too).
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }));
const svgText = (sel) => sel.split(',').every((s) => /^(\.st__|svg\.st\b)/.test(s.trim()));

test('the hub sizes its type in rem, not px, outside the strips\' SVG text', () => {
  const px = rules.filter((r) => !svgText(r.sel)).flatMap((r) => [...r.body.matchAll(/(?:^|;)\s*(font(?:-size)?\s*:[^;]*)/g)]
    .map((m) => m[1]).filter((d) => /\d(?:\.\d+)?px/.test(d)).map((d) => `${r.sel} { ${d.trim()} }`));
  assert.deepEqual(px, [], 'px font sizes');
});

test('the hub\'s boxes that hold text grow with it: a minimum height, never a fixed one', () => {
  for (const sel of ['.hh__ax', '.hh__out', '.hh__nextbox']) {
    const rule = rules.find((r) => r.sel === sel);
    assert.ok(rule, sel);
    assert.doesNotMatch(rule.body, /(?:^|;)\s*height\s*:/, `${sel}: no fixed height`);
    assert.match(rule.body, /min-height:\s*[\d.]+em\b/, `${sel}: a minimum in em`);
  }
});

test('the worksheet\'s amounts keep font-relative bounds and a rem term in their fluid size', () => {
  const clamps = [...css.matchAll(/\.wst[^{]*\{[^}]*clamp\(([^)]*\))\)/g)].map((m) => m[1]);
  assert.ok(clamps.length >= 2, 'the line amounts and the net');
  for (const c of clamps) {
    const [min, mid, max] = c.split(/,\s*(?![^(]*\))/);
    assert.match(min, /^[\d.]+rem$/, `${c}: a rem minimum`);
    assert.match(mid, /rem \+ [\d.]+vw/, `${c}: rem plus vw`);
    assert.match(max, /^var\(--fs-/, `${c}: a token maximum`);
  }
});
