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

test('addressOf: a folder page is its folder, another page its name without .html, any other file keeps its name', () => {
  assert.equal(addressOf('index.html'), '/');
  assert.equal(addressOf('hacrp/index.html'), '/hacrp/');
  assert.equal(addressOf('hacrp/hospital/990001/index.html'), '/hacrp/hospital/990001/');
  assert.equal(addressOf('404.html'), '/404');
  assert.equal(addressOf('assets/site.0a1b2c3d.css'), '/assets/site.0a1b2c3d.css');
  for (const path of ['/', '/hacrp/', '/a/b/', '/robots.txt']) assert.equal(addressOf(fileFor(path)), path);
});

// A small built folder, and how lookup answers each request in it: the same over a set of paths (as serve.js asks the
// disk) and over filesAt's reading of its file list. The answers are the deployed Worker's (curl, 2026-10-25, on the
// same shapes of path in the real dist/).
const TREE = ['404.html', 'a/index.html', 'a/x.css', 'empty/keep/index.html', 'index.html'];
const ANSWERS = [
  ['/', { status: 200, file: 'index.html' }],
  ['/a/', { status: 200, file: 'a/index.html' }],
  ['/a', { status: 307, to: '/a/' }, 'a folder without its "/"'],
  ['/a/index.html', { status: 307, to: '/a/' }],
  ['/a/index', { status: 307, to: '/a/' }],
  ['/a/index/', { status: 307, to: '/a/index' }, 'one hop at a time, as Cloudflare sends it'],
  ['/index.html', { status: 307, to: '/' }],
  ['/index', { status: 307, to: '/' }],
  ['/a/x.css', { status: 200, file: 'a/x.css' }],
  ['/404', { status: 200, file: '404.html' }, 'the not-found page at its own address'],
  ['/404.html', { status: 307, to: '/404' }],
  ['/404/', { status: 307, to: '/404' }],
  ['/404/index.html', { status: 307, to: '/404' }],
  ['//a', { status: 307, to: '/a/' }, 'repeated slashes, to where the path with one goes'],
  ['/a//', { status: 307, to: '/a/' }],
  ['/empty/', { status: 404 }, 'a folder with no index.html'],
  ['/empty', { status: 404 }, 'nor is it redirected'],
  ['/nope/', { status: 404 }],
  ['/nope.html', { status: 404 }],
  ['/nope/index.html', { status: 404 }],
  ['/a/index.htm', { status: 404 }],
  ['/a/x.css/', { status: 404 }, 'a file asked for as a folder'],
  ['/A/', { status: 404 }, 'letter case counts'],
];

test('lookup: each page at its address, each other way of asking for one redirected there with a 307, else 404', () => {
  const files = new Set(TREE.map((file) => `/${file}`));
  const at = { isFile: (p) => files.has(p) };
  for (const [path, want, why] of ANSWERS) assert.deepEqual(lookup(path, at), want, why ?? path);
});

test('lookup serves each page at addressOf its file', () => {
  const at = filesAt(TREE);
  for (const file of TREE) assert.deepEqual(lookup(addressOf(file), at), { status: 200, file }, file);
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
