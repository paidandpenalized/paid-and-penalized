// What the CI scripts that read the built site (dist/) share: the page list and a small tag reader. Not an HTML
// parser: the build writes every attribute value double-quoted and escaped, and this reads exactly that, plus
// single-quoted and bare values so a hand-written page is not misread. A tag inside a comment, or inside a
// script's or style's text, is not a tag; the <script> element's own start tag still is.
import { filesUnder } from '../../pipeline/files.js';

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
// An attribute's value, double-quoted, single-quoted or bare; group(text) wraps each form, to capture it or not.
const value = (group) => `"${group('[^"]*')}"|'${group("[^']*")}'|${group('[^\\s"\'=<>`]+')}`;
const NAME = `[^\\s"'<>/=]+`;
const ATTRIBUTE = `${NAME}(?:\\s*=\\s*(?:${value((x) => x)}))?`;
const ATTRIBUTES = new RegExp(`(${NAME})(?:\\s*=\\s*(?:${value((x) => `(${x})`)}))?`, 'g');
const escaped = (words) => words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const compiled = new Map();
const once = (key, make) => compiled.get(key) ?? compiled.set(key, make()).get(key);
// Each attribute after the tag's name: after whitespace, or straight after a quoted value's closing quote, which a
// browser reads as the start of the next attribute (<a href="/x"class="y"> has both).
const ATTRIBUTE_LIST = `((?:(?:\\s+|(?<=["']))${ATTRIBUTE})*)`;
// A start tag, of any name or of the names given.
const TAG = new RegExp(`<([a-zA-Z][^\\s/>]*)${ATTRIBUTE_LIST}\\s*/?>`, 'g');
const tagNamed = (names) => once(`t ${names}`, () => new RegExp(`<(${escaped(names)})(?=[\\s/>])${ATTRIBUTE_LIST}\\s*/?>`, 'gi'));
// Whether a tag's attribute text may hold one of the names: a quick test before the attributes are read, which lets
// through a name inside another attribute's value too (tags drops that tag once read).
const mayHold = (names) => once(`a ${names}`, () => new RegExp(`(?:^|[\\s"'])(?:${escaped(names)})(?=\\s|=|$)`, 'i'));

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
    for (const [, key, double, single, bare] of rest.matchAll(ATTRIBUTES)) {
      const k = key.toLowerCase();
      if (!(k in attrs)) attrs[k] = decode(double ?? single ?? bare ?? '');
    }
    if (having && !having.some((a) => a in attrs)) continue;
    yield { name: name.toLowerCase(), attrs };
  }
}

// Every page (.html file) under distDir, as a '/'-separated path from it, in name order.
export const htmlPages = (distDir) => filesUnder(distDir).filter((path) => path.endsWith('.html'));
