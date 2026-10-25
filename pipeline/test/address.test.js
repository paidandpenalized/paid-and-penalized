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

// A small built folder, and how lookup answers each request in it: the same over any isFile and isDir (here, the folder
// as sets of paths, as serve.js asks the disk) and over filesAt's reading of its file list.
const TREE = ['404.html', 'a/index.html', 'a/x.css', 'empty/keep/index.html', 'index.html'];
const ANSWERS = [
  ['/', { status: 200, file: 'index.html' }],
  ['/a/', { status: 200, file: 'a/index.html' }],
  ['/a', { status: 301 }],
  ['/a/x.css', { status: 200, file: 'a/x.css' }],
  ['/404.html', { status: 200, file: '404.html' }],
  ['/empty/', { status: 404 }, 'a folder with no index.html'],
  ['/empty', { status: 301 }, 'redirected, then a 404'],
  ['/nope/', { status: 404 }],
  ['/a/x.css/', { status: 404 }, 'a file asked for as a folder'],
];

test('lookup: a file is served, a folder with its "/" serves its index.html, one without is redirected, else 404', () => {
  const files = new Set(TREE.map((file) => `/${file}`));
  const dirs = new Set(['/', '/a', '/a/', '/empty', '/empty/', '/empty/keep', '/empty/keep/']);
  const at = { isFile: (p) => files.has(p), isDir: (p) => dirs.has(p) };
  for (const [path, want, why] of ANSWERS) assert.deepEqual(lookup(path, at), want, why ?? path);
});

test('isServed: every file but _headers, in any letter case', () => {
  for (const file of ['index.html', '404.html', 'assets/site.0a1b2c3d.css', 'a/_headers', '_headers.txt']) assert.equal(isServed(file), true, file);
  for (const file of ['_headers', '_HEADERS', '_Headers']) assert.equal(isServed(file), false, file);
});

test('filesAt: lookup over a list of built files answers as it does over the folder, and never serves _headers', () => {
  const at = filesAt(['_headers', ...TREE]);
  for (const [path, want, why] of ANSWERS) assert.deepEqual(lookup(path, at), want, why ?? path);
  assert.deepEqual(lookup('/_headers', at), { status: 404 });
});
