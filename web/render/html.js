// HTML escaping for the page build. `html` is a tagged template that escapes every interpolation and returns a
// Safe, so already-built markup passes through once and never gets escaped twice.
export class Safe {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// For text and for quoted attribute values alike.
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

// Trusted markup only: the caller vouches for it.
export const raw = (text) => new Safe(String(text));

function render(value) {
  if (value instanceof Safe) return value.text;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Safe(out);
}

// JSON for a <script> element. `<` becomes the six characters \u003c so no value can close the tag or open a comment; the line
// separators U+2028/2029 are escaped too, for older parsers.
export function jsonText(value) {
  return JSON.stringify(value).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function jsonScript(id, value) {
  return new Safe(`<script type="application/json" id="${escapeHtml(id)}">${jsonText(value)}</script>`);
}
