// A bundle carries the licenses of the packages it holds code from (pipeline/site/assets.js licenseNotice): the d3
// packages' ISC license asks for its notice in every copy, and a page's script is one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { licenseNotice } from '../site/assets.js';

const meta = (inputs) => ({ outputs: { 'out.js': { inputs } } });

test('licenseNotice: each package with bytes in the output, by name, with its version, license and LICENSE text', () => {
  const notice = licenseNotice(meta({
    'node_modules/d3-format/src/format.js': { bytesInOutput: 120 },
    'node_modules/d3-array/src/ticks.js': { bytesInOutput: 40 },
    'node_modules/d3-array/src/max.js': { bytesInOutput: 0 },
    'node_modules/d3-scale/src/index.js': { bytesInOutput: 0 },
    'web/charts/svg.js': { bytesInOutput: 500 },
  }));
  assert.match(notice, /^\/\*! This file includes code from these packages, each under its license\.\n/);
  assert.ok(notice.endsWith('\n*/\n'));
  assert.ok(notice.indexOf('d3-array ') < notice.indexOf('d3-format '), 'in name order');
  assert.match(notice, /d3-format \d+\.\d+\.\d+ \(ISC\):\n\nCopyright [^\n]+Mike Bostock\n\nPermission to use, copy, modify/);
  assert.ok(!notice.includes('d3-scale'), 'a package tree-shaken away carries nothing');
  assert.equal(notice.match(/\*\//g).length, 1, 'one comment, closed once');
});

test('licenseNotice: a bundle of this repository\'s code only has none', () => {
  assert.equal(licenseNotice(meta({ 'web/client/shell.js': { bytesInOutput: 900 } })), '');
});
