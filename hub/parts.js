// The sentence parts the hub's pages share: links (to the feedback form, to the pages that define a word), a sentence
// or paragraph of copy with those links filled in, and a section from a heading's copy key. pages.js builds the
// policy pages' content from them and corrections.js the corrections page's; the layout is policy.js's.
import { COPY as SHARED } from '../web/copy.js';
import { fillCopy, sentenceOf } from '../web/render/components.js';
import { html } from '../web/render/html.js';
import { externalLink, feedbackHref } from '../web/render/layout.js';
import { SITE } from '../web/site.js';
import { COPY } from './copy.js';

// The feedback form, prefilled with the page it was opened from.
export const feedbackLink = (path) => externalLink(feedbackHref({ siteName: SITE.name, pageUrl: SITE.origin + path }), COPY.feedbackForm);
export const LINKS = {
  corrections: html`<a href="${SITE.pages.corrections}">${SHARED.corrections}</a>`,
  estimate: html`<a href="${SITE.pages.methods}#estimate">${COPY.estimateLink}</a>`,
  ai: html`<a href="${SITE.pages.about}#ai">${SHARED.about}</a>`,
};

// A sentence of copy: parts maps a placeholder to the markup (a link) that stands there, values fills the plain ones.
export const sentence = sentenceOf((key, values) => fillCopy(COPY, key, values));
// A paragraph of copy.
export const para = (key, parts, values) => html`<p>${sentence(key, parts, values)}</p>
`;
// A section from a heading's copy key and its paragraphs.
export const section = (id, headingKey, ...paragraphs) => ({ id, heading: COPY[headingKey], body: html`${paragraphs}` });
