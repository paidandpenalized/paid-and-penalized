// The tag reader and page list the CI scripts share.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { withTemp } from '../../pipeline/test/helpers.js';
import { decode, htmlPages, tags } from '../ci/html.js';

test('decode: the references the build writes, numeric ones too; anything else is left as it is', () => {
  assert.equal(decode('a=1&amp;b=2&lt;&gt;&quot;&#39;&#x27;&#X41;'), 'a=1&b=2<>"\'\'A');
  assert.equal(decode('&nbsp;&amp;amp;&#0;&#x110000;&bogus;'), '&nbsp;&amp;&#0;&#x110000;&bogus;');
});

test('tags: names and attributes, quoted three ways, valueless ones as empty text, the first of a repeat', () => {
  const found = [...tags(`<A HREF="/x?a=1&amp;b=2" Class='k' data-n=5 hidden id=one id="two"><img src="/i.svg"/><use xlink:href="#s" />`)];
  assert.deepEqual(found, [
    { name: 'a', attrs: { href: '/x?a=1&b=2', class: 'k', 'data-n': '5', hidden: '', id: 'one' } },
    { name: 'img', attrs: { src: '/i.svg' } },
    { name: 'use', attrs: { 'xlink:href': '#s' } },
  ]);
});

test('tags: markup inside a comment or a script or style body is not read, but the script element itself is', () => {
  const found = [...tags(
    '<!-- <a href="/gone/"> --><script type="application/json" id="d">{"h":"<a href=\\"/no/\\">"}</script>'
    + '<style>a[href="/css/"]{}</style><script src="/s.js" type="module"></script><p id="p">',
  )].map(({ name, attrs }) => [name, attrs.id ?? attrs.src ?? null]);
  assert.deepEqual(found, [['script', 'd'], ['style', null], ['script', '/s.js'], ['p', 'p']]);
});

test('tags: a ">" inside a quoted value does not end the tag', () => {
  assert.deepEqual([...tags('<a title="a > b" href="/y/">')], [{ name: 'a', attrs: { title: 'a > b', href: '/y/' } }]);
});

test('htmlPages: every .html file under the folder, slash-separated, in name order', () =>
  withTemp('html-', (dir) => {
    for (const path of ['index.html', 'b/index.html', 'a/deep/index.html', '404.html', 'assets/site.css', 'a/data.json']) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), '');
    }
    assert.deepEqual(htmlPages(dir), ['404.html', 'a/deep/index.html', 'b/index.html', 'index.html']);
  }));
