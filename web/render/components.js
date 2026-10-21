// Page parts any site can use, in the site's own words: the decision pill, the as-of bar, the
// citation block, the printout table frame, CMS footnotes (one note, and the page's legend), and fillCopy, which
// fills the placeholders in a site's copy.
import { has } from '../../engine/js/has.js';
import { Safe, escapeHtml, html } from './html.js';

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

// fillCopy as markup, with stretches kept on one line: each group in `keep` is a placeholder name, or a list of
// names whose values are kept together with the copy's words between them (a number pair: "0.3792 and 0.3799"),
// wrapped in a .nw span from the first value's start to the last value's end. Values and words are escaped.
export function fillCopyKeep(copy, key, values, keep) {
  const names = Object.keys(values);
  const mark = (name) => `\u0001${names.indexOf(name)}\u0002`;
  let text = escapeHtml(fillCopy(copy, key, Object.fromEntries(names.map((n) => {
    if (typeof values[n] !== 'string') throw new TypeError(`copy "${key}": {${n}} must be a formatted string`);
    return [n, mark(n)];
  }))));
  for (const group of keep) {
    const list = [group].flat();
    if (!list.every((n) => names.includes(n))) throw new RangeError(`copy "${key}": keep names an unknown placeholder`);
    const start = text.indexOf(mark(list[0]));
    const end = text.indexOf(mark(list.at(-1))) + mark(list.at(-1)).length;
    text = `${text.slice(0, start)}<span class="nw">${text.slice(start, end)}</span>${text.slice(end)}`;
  }
  for (const n of names) text = text.replace(mark(n), escapeHtml(values[n]));
  return new Safe(text);
}

// text (escaped) with the first occurrence of each part kept on one line (a .nw span), e.g. a dataset id that would
// otherwise break at its hyphen. A part not in text throws.
export function keepWhole(text, parts) {
  let out = escapeHtml(text);
  for (const part of parts) {
    const at = out.indexOf(escapeHtml(part));
    if (at < 0) throw new RangeError(`keepWhole: "${part}" is not in the text`);
    const end = at + escapeHtml(part).length;
    out = `${out.slice(0, at)}<span class="nw">${out.slice(at, end)}</span>${out.slice(end)}`;
  }
  return new Safe(out);
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
