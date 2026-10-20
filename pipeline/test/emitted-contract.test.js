// Every committed emitted file, for every site and year: it passes <site>.schema.json, and its methods_version
// is the newest heading for that site in the methods log. (Each site's golden test checks it equals a fresh
// build.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validate } from '../../engine/js/schema.js';
import { latestMethodsVersion, METHODS_LOG } from '../methods-log.js';
import { REPO_ROOT, loadSchemas, readJson } from '../files.js';

const EMITTED_DIR = REPO_ROOT + 'data/emitted/';
const schemas = loadSchemas();
const log = readFileSync(REPO_ROOT + METHODS_LOG, 'utf8');
const files = readdirSync(EMITTED_DIR, { recursive: true })
  .filter((p) => p.endsWith('.json'))
  .map((p) => ({ path: p, site: p.split('/')[0] }));

test('there is emitted data to check', () => assert.ok(files.length > 0));

for (const { path, site } of files) {
  const data = readJson(EMITTED_DIR + path);
  test(`${path}: passes ${site}.schema.json`, () => {
    const schema = schemas[`${site}.schema.json`];
    assert.ok(schema, `no schemas/${site}.schema.json`);
    assert.deepEqual(validate(schema, data, { schemas }), []);
  });
  test(`${path}: methods_version is the newest ${site} heading in the methods log`, () => {
    assert.equal(data.methods_version, latestMethodsVersion(log, site));
  });
}
