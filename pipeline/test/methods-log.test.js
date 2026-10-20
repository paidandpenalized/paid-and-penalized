import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMethodsVersion, latestMethodsVersion } from '../methods-log.js';

const LOG = '# Methods log\n\n## hacrp methods_version 1 (2026-10-20)\n- a\n\n## hacrp methods_version 3 (2026-12-01)\n\n## hvbp methods_version 2 (2026-11-01)\n';

test('latestMethodsVersion: the highest version per site; null when the site has none', () => {
  assert.equal(latestMethodsVersion(LOG, 'hacrp'), 3);
  assert.equal(latestMethodsVersion(LOG, 'hvbp'), 2);
  assert.equal(latestMethodsVersion(LOG, 'tdr'), null);
  assert.equal(latestMethodsVersion('## hacrp methods_version 4 (no date)\n', 'hacrp'), null);
});

test('hasMethodsVersion: an exact heading for that site and version', () => {
  assert.equal(hasMethodsVersion(LOG, 'hacrp', 1), true);
  assert.equal(hasMethodsVersion(LOG, 'hacrp', 2), false);
  assert.equal(hasMethodsVersion(LOG, 'hvbp', 1), false);
});
