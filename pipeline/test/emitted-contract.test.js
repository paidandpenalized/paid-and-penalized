// Every committed emitted file, for every site and year: it passes <site>.schema.json, and its methods_version
// has a heading in the methods log. A site's newest year carries the site's newest methods_version; older years
// keep the version they were published under (they change only through a logged correction). Each site's
// golden test checks that its current year equals a fresh build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validate } from '../../engine/js/schema.js';
import { hasMethodsVersion, latestMethodsVersion, METHODS_LOG } from '../methods-log.js';
import { REPO_ROOT, loadSchemas, readJson } from '../files.js';

const EMITTED_DIR = REPO_ROOT + 'data/emitted/';
const schemas = loadSchemas();
const log = readFileSync(REPO_ROOT + METHODS_LOG, 'utf8');
const files = readdirSync(EMITTED_DIR, { recursive: true })
  .filter((p) => p.endsWith('.json'))
  .map((p) => ({ path: p, site: p.split('/')[0], fy: p.split('/')[1] }));
const newestYear = {};
for (const { site, fy } of files) if (!(newestYear[site] >= fy)) newestYear[site] = fy;

test('there is emitted data to check', () => assert.ok(files.length > 0));

for (const { path, site, fy } of files) {
  const data = readJson(EMITTED_DIR + path);
  test(`${path}: passes ${site}.schema.json`, () => {
    const schema = schemas[`${site}.schema.json`];
    assert.ok(schema, `no schemas/${site}.schema.json`);
    assert.deepEqual(validate(schema, data, { schemas }), []);
  });
  test(`${path}: methods_version has its ${site} heading in the methods log`, () => {
    assert.ok(hasMethodsVersion(log, site, data.methods_version));
  });
  if (fy === newestYear[site]) {
    test(`${path}: the newest ${site} year carries the newest methods_version`, () => {
      assert.equal(data.methods_version, latestMethodsVersion(log, site));
    });
  }
}
