import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { DIVISIONS, divisionOf } from '../divisions.js';
import { US_STATES } from '../states.js';

test('DIVISIONS is the Census Bureau\'s nine divisions in its order, the fifty states and DC each in one, as geo.py lists them', () => {
  const py = readFileSync(REPO_ROOT + 'engine/py/pp_engine/geo.py', 'utf8');
  const block = py.slice(py.indexOf('DIVISIONS = {'), py.indexOf('}', py.indexOf('DIVISIONS = {')));
  const fromPy = [...block.matchAll(/"([^"]+)": \("[^"]+", \[([^\]]+)\]\)/g)].map(([, name, codes]) => [name, codes.match(/[A-Z]{2}/g)]);
  assert.equal(fromPy.length, 9);
  assert.deepEqual(DIVISIONS.map(([name, codes]) => [name, [...codes]]), fromPy);
  const all = DIVISIONS.flatMap(([, codes]) => codes);
  assert.deepEqual([...all].sort(), US_STATES.map(([code]) => code).sort());
  assert.equal(divisionOf('KY'), 6);
  assert.equal(divisionOf('CT'), 1);
  assert.equal(divisionOf('PR'), null, 'a territory has no census division here (pages say how CMS prices it)');
  assert.ok(Object.isFrozen(DIVISIONS) && DIVISIONS.every((d) => Object.isFrozen(d) && Object.isFrozen(d[1])));
});
