// The tag reader and page list the CI scripts share.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTemp, writeTree } from '../../pipeline/test/helpers.js';
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

test('tags: an attribute straight after a quoted value, with no space between, is read as browsers read it', () => {
  const page = `<a href="/x"class="y"><img src='/i.svg'alt=''id=k><a id="z"href="/w/"hidden>`;
  const want = [
    { name: 'a', attrs: { href: '/x', class: 'y' } },
    { name: 'img', attrs: { src: '/i.svg', alt: '', id: 'k' } },
    { name: 'a', attrs: { id: 'z', href: '/w/', hidden: '' } },
  ];
  assert.deepEqual([...tags(page)], want);
  assert.deepEqual([...tags(page, { names: ['a'] })], want.filter((t) => t.name === 'a'));
  assert.deepEqual([...tags(page, { having: ['class', 'href'] })], [want[0], want[2]], 'a name right after a quote passes the having filter');
});

test('tags: a ">" inside a quoted value does not end the tag', () => {
  assert.deepEqual([...tags('<a title="a > b" href="/y/">')], [{ name: 'a', attrs: { title: 'a > b', href: '/y/' } }]);
});

test('tags: the names and having filters give exactly the tags the full read gives, filtered', () => {
  const page = `<!doctype html><HTML lang=en><head><LINK rel=stylesheet href="/a.css"><linker href="/b/"><script src="/a.js"></script>
<script type="application/json">{"x":"<link href='/no/'>"}</script></head><body><a href="/c/" id=top>c</a><p title="the href= here">p</p>
<svg><use xlink:href="#s"/></svg><input hidden><form data-src="/i.json"></form><!-- <link href="/gone/"> --><a hrefx="/d/">d</a></body></HTML>`;
  const all = [...tags(page)];
  const by = (pick) => all.filter(pick);
  assert.deepEqual([...tags(page, { names: ['link', 'script'] })], by((t) => ['link', 'script'].includes(t.name)));
  const having = ['id', 'href', 'src', 'xlink:href', 'data-src'];
  assert.deepEqual([...tags(page, { having })], by((t) => having.some((a) => a in t.attrs)), 'a tag with none of them is left out');
  assert.deepEqual([...tags(page, { having: ['hidden'] })], by((t) => 'hidden' in t.attrs), 'an attribute with no value counts');
});

test('htmlPages: every .html file under the folder, slash-separated, in name order', () =>
  withTemp('html-', (dir) => {
    writeTree(dir, Object.fromEntries(['index.html', 'b/index.html', 'a/deep/index.html', '404.html', 'assets/site.css', 'a/data.json'].map((path) => [path, ''])));
    assert.deepEqual(htmlPages(dir), ['404.html', 'a/deep/index.html', 'b/index.html', 'index.html']);
  }));
