// Where a page is written and the address it is served at (address.js): one rule for the build, the server and the checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, fileFor, lookup } from '../site/address.js';

test('fileFor: a folder path is its index.html, a file path its own file, both from the built folder', () => {
  assert.equal(fileFor('/'), 'index.html');
  assert.equal(fileFor('/hacrp/'), 'hacrp/index.html');
  assert.equal(fileFor('/hacrp/hospital/990001/'), 'hacrp/hospital/990001/index.html');
  assert.equal(fileFor('/404.html'), '404.html');
  assert.equal(fileFor('/hacrp/DATA-DICTIONARY.md'), 'hacrp/DATA-DICTIONARY.md');
});

test('addressOf: a folder page is its folder, any other file keeps its name; it undoes fileFor', () => {
  assert.equal(addressOf('index.html'), '/');
  assert.equal(addressOf('hacrp/index.html'), '/hacrp/');
  assert.equal(addressOf('hacrp/hospital/990001/index.html'), '/hacrp/hospital/990001/');
  assert.equal(addressOf('404.html'), '/404.html');
  assert.equal(addressOf('assets/site.0a1b2c3d.css'), '/assets/site.0a1b2c3d.css');
  for (const path of ['/', '/hacrp/', '/a/b/', '/404.html', '/robots.txt']) assert.equal(addressOf(fileFor(path)), path);
});

test('lookup: a file is served, a folder with its "/" serves its index.html, one without is redirected, else 404', () => {
  const files = new Set(['/index.html', '/a/index.html', '/a/x.css', '/empty/keep/index.html']);
  const dirs = new Set(['/', '/a', '/a/', '/empty', '/empty/', '/empty/keep', '/empty/keep/']);
  const at = { isFile: (p) => files.has(p), isDir: (p) => dirs.has(p) };
  assert.deepEqual(lookup('/', at), { status: 200, file: 'index.html' });
  assert.deepEqual(lookup('/a/', at), { status: 200, file: 'a/index.html' });
  assert.deepEqual(lookup('/a', at), { status: 301 });
  assert.deepEqual(lookup('/a/x.css', at), { status: 200, file: 'a/x.css' });
  assert.deepEqual(lookup('/empty/', at), { status: 404 }, 'a folder with no index.html');
  assert.deepEqual(lookup('/empty', at), { status: 301 }, 'redirected, then a 404');
  assert.deepEqual(lookup('/nope/', at), { status: 404 });
  assert.deepEqual(lookup('/a/x.css/', at), { status: 404 }, 'a file asked for as a folder');
});
