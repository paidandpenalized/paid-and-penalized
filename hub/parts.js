// The sentence parts the hub's policy pages share: links (to another site in a new tab, to the feedback form, to the
// pages that define a word), a sentence or paragraph of copy with those links filled in, and a section from a heading's
// copy key. pages.js builds four pages from them and corrections.js the fifth; the layout is policy.js's.
import { fillAround, fillCopy } from '../web/render/components.js';
import { html } from '../web/render/html.js';
import { feedbackHref, newTab } from '../web/render/layout.js';
import { SITE } from '../web/site.js';
import { CORRECTIONS_PATH } from './constants.js';
import { COPY } from './copy.js';

// A link to another site that opens in a new tab, with the hidden words saying so.
export const outside = (href, text) => html`<a href="${href}" target="_blank" rel="noopener">${text}${newTab}</a>`;
// The feedback form, prefilled with the page it was opened from.
export const feedbackLink = (path) => outside(feedbackHref({ siteName: SITE.name, pageUrl: SITE.origin + path }), COPY.feedbackForm);
export const LINKS = {
  corrections: html`<a href="${CORRECTIONS_PATH}">${COPY.correctionsLink}</a>`,
  estimate: html`<a href="/methods/#estimate">${COPY.estimateLink}</a>`,
};

// A sentence of copy: parts maps a placeholder to the markup (a link) that stands there, values fills the plain ones.
export const sentence = (key, parts = {}, values = {}) => fillAround((marks) => fillCopy(COPY, key, { ...values, ...marks }), parts);
// A paragraph of copy.
export const para = (key, parts, values) => html`<p>${sentence(key, parts, values)}</p>
`;
// A section from a heading's copy key and its paragraphs.
export const section = (id, headingKey, ...paragraphs) => ({ id, heading: COPY[headingKey], body: html`${paragraphs}` });
