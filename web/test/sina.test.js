// The sina chart (web/charts/sina.js): columns of dots, on synthetic numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE } from '../charts/figure.js';
import { sina } from '../charts/sina.js';

const columns = ['A', 'B', 'C', 'D', 'E', 'F'].map((k, i) => ({
  label: `Group ${k}`, short: k, sub: `sub-${k}`, sub2: `second-${k}`, scores: [0.1 * i, 0.2 * i + 0.1, 0.5], yes: [false, false, true], tip: `tip ${k}`,
}));
const draw = (width) => String(sina({ columns, line: 0.3, domain: [0, 1.5], labels: { line: 'Line' }, width, format: String }));

test('a phone\'s drawing names each column and leaves out its two lines of counts, which six columns have no room for', () => {
  const narrow = draw(360);
  for (const c of columns) {
    assert.ok(narrow.includes(`>${c.short}</text>`), `${c.short}: the short name`);
    assert.ok(!narrow.includes(c.sub) && !narrow.includes(c.sub2), `${c.short}: no counts under it`);
  }
});

test('a wide drawing keeps both lines of counts under each column\'s name', () => {
  const wide = draw(PAGE);
  for (const c of columns) assert.ok(wide.includes(c.label) && wide.includes(c.sub) && wide.includes(c.sub2), c.label);
});
