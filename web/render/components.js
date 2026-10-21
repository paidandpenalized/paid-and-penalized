// Page parts any site can use, in the site's own words: the decision pill, the as-of bar, the
// citation block, the printout table frame, CMS footnotes (one note, and the page's legend), and fillCopy, which
// fills the placeholders in a site's copy.
import { has } from '../../engine/js/has.js';
import { html } from './html.js';

const PLACEHOLDER = /\{(\w+)\}/g;

// copy[key] (a string, or { text, claim }) with each {placeholder} replaced. Values must be strings (format numbers
// first); a placeholder with no value, or a value with no placeholder, throws.
export function fillCopy(copy, key, values = {}) {
  if (!has(copy, key)) throw new RangeError(`no copy key "${key}"`);
  const entry = copy[key];
  const text = typeof entry === 'string' ? entry : entry.text;
  const used = new Set();
  const out = text.replace(PLACEHOLDER, (_, name) => {
    if (!has(values, name)) throw new RangeError(`copy "${key}": no value for {${name}}`);
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
export const pillClass = (kind) => (kind ? `pill pill--${kind}` : 'pill');
export const pill = ({ kind = null, label }) => html`<span class="${pillClass(kind)}">${label}</span>`;

// The as-of bar: what the data are and when they are from, one item each.
export const asofBar = ({ label, items }) => html`<aside class="asof" aria-label="${label}">
<ul class="asof__list" role="list">${items.map((item) => html`<li>${item}</li>`)}</ul>
</aside>`;

// The citation block: the text to cite, selectable without JavaScript, and a Copy button the script (web/client/cite.js)
// shows. The button's words and the two status messages are the site's; the script reads the messages from data-copied
// and data-failed. A page holding this block lists the script (assets.js.cite) in its scripts.
export const citation = ({ heading, text, button, copied, failed }) => html`<section class="block cite" aria-labelledby="cite-h" data-copied="${copied}" data-failed="${failed}">
<h2 id="cite-h" class="h-sm">${heading}</h2>
<p class="cite__text" data-cite-text>${text}</p>
<p class="cite__row"><button type="button" class="fig__btn" data-cite-copy hidden>${button}</button> <span class="small" data-cite-status aria-live="polite"></span></p>
</section>`;

// A table in the printout frame, which scrolls sideways inside its box on a narrow screen (components.css).
export const printout = (table) => html`<div class="printout"><div class="printout__scroll">${table}</div></div>`;

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
