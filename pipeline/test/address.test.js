// Where a page is written and the address it is served at (address.js): one rule for the build, the server and the checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, fileFor, filesAt, isServed, lookup } from '../site/address.js';

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

test('isServed: every file but _headers, in any letter case', () => {
  for (const file of ['index.html', '404.html', 'assets/site.0a1b2c3d.css', 'a/_headers', '_headers.txt']) assert.equal(isServed(file), true, file);
  for (const file of ['_headers', '_HEADERS', '_Headers']) assert.equal(isServed(file), false, file);
});

test('filesAt: lookup over a list of built files answers as it does over the folder, and never serves _headers', () => {
  const at = filesAt(['_headers', '404.html', 'a/index.html', 'a/x.css', 'empty/keep/index.html', 'index.html']);
  assert.deepEqual(lookup('/', at), { status: 200, file: 'index.html' });
  assert.deepEqual(lookup('/a/', at), { status: 200, file: 'a/index.html' });
  assert.deepEqual(lookup('/a', at), { status: 301 });
  assert.deepEqual(lookup('/a/x.css', at), { status: 200, file: 'a/x.css' });
  assert.deepEqual(lookup('/404.html', at), { status: 200, file: '404.html' });
  assert.deepEqual(lookup('/empty/', at), { status: 404 }, 'a folder with no index.html');
  assert.deepEqual(lookup('/a/x.css/', at), { status: 404 }, 'a file asked for as a folder');
  assert.deepEqual(lookup('/_headers', at), { status: 404 });
  assert.deepEqual(lookup('/nope/', at), { status: 404 });
});
