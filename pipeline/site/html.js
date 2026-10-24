// The one reader of built pages, for everything that reads them back (the CI checks, the browser checks' page list
// and the tests): the page list, a small tag reader and the page's text. Not an HTML parser: the build writes every
// attribute value double-quoted and escaped, and this reads exactly that, plus single-quoted and bare values so a
// hand-written page is not misread. A tag inside a comment, or inside a script's or style's text, is not a tag; the
// <script> element's own start tag still is.
import { filesUnder } from '../files.js';

const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// An attribute value as the browser reads it: character references replaced.
export function decode(value) {
  return value.replace(ENTITY, (match, ref) => {
    const lower = ref.toLowerCase();
    if (lower in NAMED) return NAMED[lower];
    const code = lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

const INERT = /<!--[\s\S]*?-->|(<(script|style)\b[^>]*>)[\s\S]*?<\/\2\s*>/gi;
// An attribute's value as written: double-quoted, single-quoted or bare.
const VALUE = `"[^"]*"|'[^']*'|[^\\s"'=<>\`]+`;
const NAME = `[^\\s"'<>/=]+`;
const ATTRIBUTE = `${NAME}(?:\\s*=\\s*(?:${VALUE}))?`;
// Each attribute's name and, when it has one, its value as written.
const ATTRIBUTES = new RegExp(`(${NAME})(?:\\s*=\\s*(${VALUE}))?`, 'g');
// A value as written, without its quotes (a bare value cannot start with one).
const unquoted = (raw) => (raw[0] === '"' || raw[0] === "'" ? raw.slice(1, -1) : raw);
const escaped = (words) => words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
// Each attribute after the tag's name: after whitespace, or straight after a quoted value's closing quote, which a
// browser reads as the start of the next attribute (<a href="/x"class="y"> has both).
const ATTRIBUTE_LIST = `((?:(?:\\s+|(?<=["']))${ATTRIBUTE})*)`;
// A start tag, of any name or of the names given.
const TAG = new RegExp(`<([a-zA-Z][^\\s/>]*)${ATTRIBUTE_LIST}\\s*/?>`, 'g');
const tagNamed = (names) => new RegExp(`<(${escaped(names)})(?=[\\s/>])${ATTRIBUTE_LIST}\\s*/?>`, 'gi');
// Whether a tag's attribute text may hold one of the names: a quick test before the attributes are read, which lets
// through a name inside another attribute's value too (tags drops that tag once read).
const mayHold = (names) => new RegExp(`(?:^|[\\s"'])(?:${escaped(names)})(?=\\s|=|$)`, 'i');

// Every start tag in the page, in order: { name (lowercase), attrs } where attrs maps each lowercase attribute name
// to its decoded value ('' when it has none). A repeated attribute keeps its first value, as browsers do. A reader
// that needs few tags says which, and is spared reading the rest: names, only the tags of these names (lowercase);
// having, only the tags that carry one of these attributes (lowercase).
export function* tags(html, { names = null, having = null } = {}) {
  const live = html.replace(INERT, (_, open) => open ?? '');
  const wanted = having && mayHold(having);
  for (const [, name, rest] of live.matchAll(names ? tagNamed(names) : TAG)) {
    if (wanted && !wanted.test(rest)) continue;
    const attrs = {};
    for (const [, key, raw = ''] of rest.matchAll(ATTRIBUTES)) {
      const k = key.toLowerCase();
      if (!(k in attrs)) attrs[k] = decode(unquoted(raw));
    }
    if (having && !having.some((a) => a in attrs)) continue;
    yield { name: name.toLowerCase(), attrs };
  }
}

// The words a reader sees in a page or a part of one: comments, scripts and styles dropped, each tag a space (a start
// tag read as tags reads it, so a ">" in a quoted value stays inside it), character references decoded, white space
// collapsed.
export const textOf = (html) => decode(html.replace(INERT, ' ').replace(TAG, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');

// Every page (.html file) under distDir, as a '/'-separated path from it, in name order; files: distDir's files, as
// filesUnder lists them, when the caller has them already. A folder with no pages throws: the site is not built.
export function htmlPages(distDir, files = filesUnder(distDir)) {
  const pages = files.filter((path) => path.endsWith('.html'));
  if (pages.length === 0) throw new Error(`no pages in ${distDir}: build the site first (make build)`);
  return pages;
}
