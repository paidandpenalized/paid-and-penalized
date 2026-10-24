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
const VALUE = '(?:"[^"]*"|\'[^\']*\'|[^\\s"\'=<>`]+)';
const ATTRIBUTE = `[^\\s"'<>/=]+(?:\\s*=\\s*${VALUE})?`;
const TAG = new RegExp(`<([a-zA-Z][^\\s/>]*)((?:\\s+${ATTRIBUTE})*)\\s*/?>`, 'g');
const ATTRIBUTES = new RegExp(`([^\\s"'<>/=]+)(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+)))?`, 'g');

// Every start tag in the page, in order: { name (lowercase), attrs } where attrs maps each lowercase attribute name
// to its decoded value ('' when it has none). A repeated attribute keeps its first value, as browsers do.
export function* tags(html) {
  const live = html.replace(INERT, (_, open) => open ?? '');
  for (const [, name, rest] of live.matchAll(TAG)) {
    const attrs = {};
    for (const [, key, double, single, bare] of rest.matchAll(ATTRIBUTES)) {
      const k = key.toLowerCase();
      if (!(k in attrs)) attrs[k] = decode(double ?? single ?? bare ?? '');
    }
    yield { name: name.toLowerCase(), attrs };
  }
}

// Every page (.html file) under distDir, as a '/'-separated path from it, in name order.
export const htmlPages = (distDir) => filesUnder(distDir).filter((path) => path.endsWith('.html'));
