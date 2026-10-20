// Page parts any site can use, in the site's own words: the decision pill, the as-of bar, the source line, CMS
// footnotes (one note, and the page's legend), and fillCopy, which fills the placeholders in a site's copy.
import { html } from './html.js';

const PLACEHOLDER = /\{(\w+)\}/g;

// copy[key] (a string, or { text, claim }) with each {placeholder} replaced. Values must be strings (format numbers
// first); a placeholder with no value, or a value with no placeholder, throws.
export function fillCopy(copy, key, values = {}) {
  if (!Object.hasOwn(copy, key)) throw new RangeError(`no copy key "${key}"`);
  const entry = copy[key];
  const text = typeof entry === 'string' ? entry : entry.text;
  const used = new Set();
  const out = text.replace(PLACEHOLDER, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new RangeError(`copy "${key}": no value for {${name}}`);
    if (typeof values[name] !== 'string') throw new TypeError(`copy "${key}": {${name}} must be a formatted string`);
    used.add(name);
    return values[name];
  });
  const unused = Object.keys(values).filter((name) => !used.has(name));
  if (unused.length) throw new RangeError(`copy "${key}": unused value(s) ${unused.join(', ')}`);
  return out;
}

// A word on a mark; the word carries the meaning, the ink repeats it. kind: 'pen' (a penalty), 'rew' (a reward),
// 'na' (hatched) or null (neutral).
export const pill = ({ kind = null, label }) => html`<span class="${kind ? `pill pill--${kind}` : 'pill'}">${label}</span>`;

// The as-of bar: what the data are and when they are from, one item each.
export const asofBar = ({ label, items }) => html`<aside class="asof" aria-label="${label}">
<ul class="asof__list" role="list">${items.map((item) => html`<li>${item}</li>`)}</ul>
</aside>`;

export const sourceLine = ({ text, href, linkText }) => html`<p class="source">${text} <a href="${href}">${linkText}</a></p>`;

// One CMS footnote beside a value: lead ("CMS footnote 5:") and CMS's text.
export const footnoteNote = ({ lead, text }) => html`<p><span class="fn">${lead}</span> ${text}</p>`;

// Every footnote ({ code, text }) in lists, once, in the order it first appears; '' when there are none.
export function footnoteLegend({ heading, lists }) {
  const seen = new Map();
  for (const f of lists.flat()) if (!seen.has(f.code)) seen.set(f.code, f.text);
  if (!seen.size) return '';
  return html`<section class="block" aria-labelledby="fn-h">
<h2 id="fn-h" class="h-sm">${heading}</h2>
<dl class="fnlist">${[...seen].map(([code, text]) => html`<div><dt>${code}</dt><dd>${text}</dd></div>`)}</dl>
</section>`;
}
