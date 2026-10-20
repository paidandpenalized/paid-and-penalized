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
// Emitted files live at <site>/fy<YYYY>/<name>.json; anything else under data/emitted/ fails the layout test.
const all = readdirSync(EMITTED_DIR, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name !== '.DS_Store') // Finder's files are gitignored; any other file must fit the layout
  .map((e) => `${e.parentPath}/${e.name}`.slice(EMITTED_DIR.length).replace(/^\/+/, ''));
const files = all
  .map((p) => /^([a-z0-9-]+)\/fy(\d{4})\/[^/]+\.json$/.exec(p))
  .filter(Boolean)
  .map(([path, site, fy]) => ({ path, site, fy: Number(fy), data: readJson(EMITTED_DIR + path) }));
const newestYear = {};
for (const { site, fy } of files) newestYear[site] = Math.max(newestYear[site] ?? 0, fy);

test('every file under data/emitted/ sits at <site>/fy<YYYY>/<name>.json', () => {
  assert.deepEqual(all.filter((p) => !files.some((f) => f.path === p)), []);
});

test('there is emitted data to check', () => assert.ok(files.length > 0));

for (const { path, site, fy, data } of files) {
  test(`${path}: its fy field matches its folder`, () => assert.equal(data.fy, fy));
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
