// Page parts any site can use, in the site's own words: the decision pill, the as-of bar, the
// citation block, the printout table frame, CMS footnotes (one note, and the page's legend), and fillCopy, which
// fills the placeholders in a site's copy.
import { has } from '../../engine/js/has.js';
import { Safe, escapeHtml, html, raw } from './html.js';

const PLACEHOLDER = /\{(\w+)\}/g;

// Copy as a page sets it: a straight apostrophe becomes ’ (CMS’s, hospitals’), straight double quotes become
// “ and ”, and z-score takes a non-breaking hyphen. The copy files keep plain ASCII; only their words are typeset, never a value filled into them (CMS's text
// stays as CMS published it). Each copy string is typeset once and remembered: copy is a fixed set of strings, and
// fillCopy runs on every fill, in the build and in the browser.
const TYPESET = new Map();
export function typeset(text) {
  let out = TYPESET.get(text);
  if (out === undefined) {
    out = text
      .replace(/([\w})])'(?=[\w{])/g, '$1\u2019')
      .replace(/s'(?=[\s.,;:!?)]|$)/g, 's\u2019')
      .replace(/(^|[\s(\[{])"/g, '$1\u201c')
      .replace(/"/g, '\u201d')
      // "z-score" never splits at its hyphen: a non-breaking hyphen, the same glyph.
      .replace(/\bz-score/g, 'z\u2011score');
    TYPESET.set(text, out);
  }
  return out;
}

// fn remembering its last call: called again with arguments whose key (keyOf(...args), a list compared item by item,
// by identity) matches, it returns the last result. For a page part every page of a build fills alike (the same fiscal
// year, periods and source objects), which is then built once, not once per page.
export function lastCall(keyOf, fn) {
  let key = null;
  let value;
  return (...args) => {
    const next = keyOf(...args);
    if (!key || next.length !== key.length || next.some((k, i) => k !== key[i])) {
      value = fn(...args);
      key = next;
    }
    return value;
  };
}

// A copy object whose entries are plain strings, typeset once (for copy read directly, not through fillCopy).
export const typesetCopy = (copy) => Object.freeze(Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, typeset(v)])));

// copy[key] (a string, or { text, claim }), typeset, with each {placeholder} replaced. Values must be strings (format numbers
// first); a placeholder with no value, or a value with no placeholder, throws. plain: leave the text untypeset (a
// file that isn't page copy, such as the data dictionary's Markdown).
export function fillCopy(copy, key, values = {}, { plain = false } = {}) {
  if (!has(copy, key)) throw new RangeError(`no copy key "${key}"`);
  const entry = copy[key];
  const source = typeof entry === 'string' ? entry : entry.text;
  const text = plain ? source : typeset(source);
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

// Markup text with text.slice(start, end) kept on one line, in a .nw span.
const nw = (text, start, end) => `${text.slice(0, start)}<span class="nw">${text.slice(start, end)}</span>${text.slice(end)}`;

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
    const last = mark(list[list.length - 1]);
    const start = text.indexOf(mark(list[0]));
    const end = text.indexOf(last) + last.length;
    text = nw(text, start, end);
  }
  for (const n of names) text = text.split(mark(n)).join(escapeHtml(values[n]));
  return new Safe(text);
}

// text (escaped) with the first occurrence of each part kept on one line (a .nw span), e.g. a dataset id that would
// otherwise break at its hyphen. A part not in text throws.
export function keepWhole(text, parts) {
  let out = escapeHtml(text);
  for (const part of parts) {
    const at = out.indexOf(escapeHtml(part));
    if (at < 0) throw new RangeError(`keepWhole: "${part}" is not in the text`);
    out = nw(out, at, at + escapeHtml(part).length);
  }
  return new Safe(out);
}

// A word on a mark; the word carries the meaning, the ink repeats it. kind: 'pen' (a penalty), 'rew' (a reward),
// 'na' (hatched) or null (neutral).
export const pillClass = (kind) => (kind ? `pill pill--${kind}` : 'pill');
export const pill = ({ kind = null, label }) => html`<span class="${pillClass(kind)}">${label}</span>`;

// The as-of bar: what the data are and when they are from, one fact each, as a term and its value
// (items: [{ label, value }], text or Safe).
export const asofBar = ({ label, items }) => html`<aside class="asof" aria-label="${label}">
<dl class="asof__list">${items.map((item) => html`<div><dt>${item.label}</dt><dd>${item.value}</dd></div>`)}</dl>
</aside>`;

// The citation block: the text to cite, selectable without JavaScript, and a Copy button the script (web/client/cite.js)
// shows. The button's words and the two status messages are the site's; the script reads the messages from data-copied
// and data-failed. A page holding this block lists the script (assets.js.cite) in its scripts.
export const citation = ({ heading, text, button, copied, failed }) => html`<section class="block cite" aria-labelledby="cite-h" data-copied="${copied}" data-failed="${failed}">
<h2 id="cite-h" class="h-sm">${heading}</h2>
<p class="cite__text" data-cite-text>${text}</p>
<p class="cite__row"><button type="button" class="fig__btn" data-cite-copy hidden>${button}</button> <span class="small" data-cite-status aria-live="polite"></span></p>
</section>`;

// A table in the printout frame, which scrolls sideways inside its box on a narrow screen (components.css). fit: the
// frame (its rules) ends with a table narrower than the page, not at the page's edge.
export const printout = (table, { fit = false } = {}) => html`<div class="${fit ? 'printout printout--fit' : 'printout'}"><div class="printout__scroll">${table}</div></div>`;

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

// A boxed form field, Thirty Day Readmissions' signature device: a numbered label (no: its number or letter, or
// null), the value (text or Safe; `as` sets its element, e.g. 'h1' for a record's name) and an optional note under
// it. Fields sit in a .form grid, whose red rules box them. size: 'big' or 'sm' for the value; wide: the full row.
export function formField({ no = null, label, value, note = null, size = null, wide = false, as = 'p', cls = '', id = null }) {
  const valueClass = `field__value${size ? ` field__value--${size}` : ''}${cls ? ` ${cls}` : ''}`;
  const tag = /^(p|h1|div)$/.test(as) ? as : 'p';
  return html`<div class="field${wide ? ' field--wide' : ''}">
<p class="field__label">${no === null ? '' : html`<span class="field__no">${String(no)}</span>`}${label}</p>
${raw(`<${tag} class="${escapeHtml(valueClass)}"${id ? ` id="${escapeHtml(id)}"` : ''}>`)}${value}${raw(`</${tag}>`)}
${note && html`<div class="field__note">${note}</div>`}</div>`;
}

// The record's title bar across the top of a .form: two runs of words, left and right.
export const formTitle = (left, right) => html`<p class="form__title"><span>${left}</span><span>${right}</span></p>`;

// A rubber stamp (Thirty Day Readmissions): the decision in the display face, rotated and grain-masked. ink: the
// neutral variant (no cut, no score, not subject); otherwise it is in the penalty ink.
export const stamp = ({ label, ink = false }) => html`<p class="stamp${ink ? ' stamp--ink' : ''}">${label}</p>`;
