// The chart kit's build-time text measure (charts/text.js): widths that never fall short (a figure's characters cost
// the type face's 0.6em; a wide glyph costs more than a narrow one), lines that break after spaces and hyphen runs
// and fit their width, and a mark's label kept inside the drawing; and the faces its tables were measured in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { fitLabel, textWidth, wrapText } from '../charts/text.js';

// text.js's advance tables were measured in Chrome against the body face at the labels' weight (this file) and its
// metric fallback, Arial Bold at the fallback's size-adjust (web/styles/base.css). Either changing makes the tables stale
// without any width test failing, so a change fails here until the tables are measured again and these move with them.
test('text.js\'s tables match the faces they were measured in: Libre Franklin 600 and its fallback at 98.5%', () => {
  const face = createHash('sha256').update(readFileSync(`${REPO_ROOT}web/fonts/libre-franklin-600.woff2`)).digest('hex');
  assert.equal(face, 'aaa877781157fd03a54d6b0f27283e5b153a6d1b44a20c2d80c695f5e07d242b');
  const base = readFileSync(`${REPO_ROOT}web/styles/base.css`, 'utf8');
  assert.match(base, /@font-face \{ font-family: 'Libre Franklin Fallback'; src: local\('Arial Bold'\)[^}]*font-weight: 600; size-adjust: 98\.5%;/);
});

test('textWidth: the type face at 0.6em a character; in the body face a wide glyph costs more than a narrow one', () => {
  assert.ok(Math.abs(textWidth('25% cut', 12, { mono: true }) - 7 * 0.6 * 12) < 1e-9);
  assert.ok(textWidth('WWW', 12) > textWidth('iii', 12) * 3);
  assert.ok(textWidth('Ab', 11) < textWidth('Ab', 12));
  assert.equal(textWidth('', 12), 0);
  // Over by a few percent, not a fifth: Chrome draws this name 144.2 units wide at 12px in the site's face.
  const w = textWidth('Washington, DC-MD area', 12);
  assert.ok(w >= 144.2 && w <= 144.2 * 1.04, String(w));
  assert.ok(textWidth('¤', 12) >= textWidth('W', 12), 'a character not in the table counts as the widest');
});

test('wrapText: lines fit the width, breaking after a space or a run of hyphens, and joined are the text', () => {
  const name = 'Nashville-Davidson--Murfreesboro--Franklin, TN area';
  const lines = wrapText(name, 140, 12);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(textWidth(line.trimEnd(), 12) <= 140, line);
  assert.equal(lines.join(''), name, 'nothing lost or doubled; a line broken at a space keeps it, for copy and find');
  assert.ok(lines.every((line) => !line.startsWith('-') && !line.startsWith(' ')), 'a hyphen run stays on the line it ends');
  assert.deepEqual(wrapText('All hospitals', 300, 12), ['All hospitals']);
  assert.deepEqual(wrapText('Unbreakable', 10, 12), ['Unbreakable'], 'a piece wider than the width keeps its own line');
});

test('wrapText: a run of spaces stays on the line it ends, so no line is only spaces or starts with one', () => {
  for (const text of ['Unbreakable  next', 'Unbreakable  ', 'Long name  with  doubled  spaces', 'a  b']) {
    for (const max of [10, 40, 80]) {
      const lines = wrapText(text, max, 12);
      assert.equal(lines.join(''), text, `${JSON.stringify(text)} at ${max}: joined`);
      assert.ok(lines.every((line) => line.trim() !== '' && !line.startsWith(' ')), `${JSON.stringify(text)} at ${max}: ${JSON.stringify(lines)}`);
    }
  }
  assert.deepEqual(wrapText('a  b', 10, 12), ['a  ', 'b']);
});

test('wrapText: a last line of one word takes the word before it when the line above has more and the two fit', () => {
  // "Lake Charles, LA" fills the width and "area" would sit alone under it.
  const width = textWidth('Lake Charles, LA', 12) + 1;
  assert.deepEqual(wrapText('Lake Charles, LA area', width, 12), ['Lake Charles, ', 'LA area']);
  // Over every width a group name might be wrapped to, no last line is a lone word that could have had company.
  for (const name of ['Montgomery County-Bucks County-Chester County, PA area', 'West Palm Beach-Boca Raton-Delray Beach, FL area', 'Lake Charles, LA area']) {
    for (let max = 60; max <= 320; max += 2) {
      const lines = wrapText(name, max, 12);
      if (lines.length < 2) continue;
      const last = lines[lines.length - 1];
      const above = lines[lines.length - 2].split(/(?<=\s)|(?<=-)(?!-)/);
      const lone = !/[\s-]/.test(last.trim());
      assert.ok(!(lone && above.length > 1 && textWidth(`${above[above.length - 1]}${last}`, 12) <= max), `${name} at ${max}: ${JSON.stringify(lines)}`);
    }
  }
});

test('fitLabel: a label that fits keeps its place; one past an end is set against that end, or beside its mark', () => {
  const middle = { anchor: 'middle', dx: 0 };
  assert.deepEqual(fitLabel(150, 100, middle, [0, 300]), { x: 150, anchor: 'middle', dx: 0 });
  assert.deepEqual(fitLabel(40, 100, middle, [0, 300]), { x: 40, anchor: 'start', dx: -6 });
  assert.deepEqual(fitLabel(3, 100, { anchor: 'start', dx: -6 }, [0, 300]), { x: 0, anchor: 'start', dx: 0 });
  assert.deepEqual(fitLabel(270, 100, middle, [0, 300]), { x: 270, anchor: 'end', dx: 6 });
  assert.deepEqual(fitLabel(298, 100, { anchor: 'end', dx: 6 }, [0, 300]), { x: 300, anchor: 'end', dx: 0 });
});
