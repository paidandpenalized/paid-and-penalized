// The chart kit's build-time text measure (charts/text.js): widths that never fall short (a figure's characters cost
// the type face's 0.6em; a wide glyph costs more than a narrow one), lines that break after spaces and hyphen runs
// and fit their width, and a mark's label kept inside the drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitLabel, textWidth, wrapText } from '../charts/text.js';

test('textWidth: the type face at 0.6em a character; in the body face a wide glyph costs more than a narrow one', () => {
  assert.equal(textWidth('25% cut', 12, { mono: true }), 7 * 0.6 * 12);
  assert.ok(textWidth('WWW', 12) > textWidth('iii', 12) * 3);
  assert.ok(textWidth('Ab', 11) < textWidth('Ab', 12));
  assert.equal(textWidth('', 12), 0);
});

test('wrapText: lines fit the width, breaking after a space or a run of hyphens, and keep every character', () => {
  const name = 'Nashville-Davidson--Murfreesboro--Franklin, TN area';
  const lines = wrapText(name, 140, 12);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(textWidth(line, 12) <= 140, line);
  assert.equal(lines.join(' ').replace(/- /g, '-'), name, 'nothing lost or doubled');
  assert.ok(lines.every((line) => !line.startsWith('-')), 'a hyphen run stays on the line it ends');
  assert.deepEqual(wrapText('All hospitals', 300, 12), ['All hospitals']);
  assert.deepEqual(wrapText('Unbreakable', 10, 12), ['Unbreakable'], 'a piece wider than the width keeps its own line');
});

test('fitLabel: a label that fits keeps its place; one past an end is set against that end, or beside its mark', () => {
  const middle = { anchor: 'middle', dx: 0 };
  assert.deepEqual(fitLabel(150, 100, middle, [0, 300]), { x: 150, anchor: 'middle', dx: 0 });
  assert.deepEqual(fitLabel(40, 100, middle, [0, 300]), { x: 40, anchor: 'start', dx: -6 });
  assert.deepEqual(fitLabel(3, 100, { anchor: 'start', dx: -6 }, [0, 300]), { x: 0, anchor: 'start', dx: 0 });
  assert.deepEqual(fitLabel(270, 100, middle, [0, 300]), { x: 270, anchor: 'end', dx: 6 });
  assert.deepEqual(fitLabel(298, 100, { anchor: 'end', dx: 6 }, [0, 300]), { x: 300, anchor: 'end', dx: 0 });
});
