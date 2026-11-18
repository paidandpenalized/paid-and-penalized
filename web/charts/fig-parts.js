// A figure's caption and key, for a figure a page lays out itself (the hub's maps, beside their words): the markup and
// classes figure.js figure() writes for its own (web/styles/charts.css styles both). figure() keeps its own copy inline:
// HRRP's program page script bundles figure(), and leaving its code as it was keeps that script's bytes.
import { COPY } from '../copy.js';
import { html } from '../render/html.js';

// "Figure N." and its sentence (text or Safe), in a figcaption, or in another element (tag: 'p') where it stands beside
// its figure rather than in it; id: the element's id, for a figure or table it names.
export const figCaption = (n, text, { id = null, tag = 'figcaption' } = {}) => html`<${tag} class="fig__cap"${id ? html` id="${id}"` : ''}><span class="fig__n">${COPY.figure} ${String(n)}.</span> ${text}</${tag}>`;

// A key: one line per item ({ swatch: the swatch's classes, drawn in CSS like the chart's own mark; label: its words });
// cls: a class of the caller's own for the list.
export const keyList = (items, { cls = null } = {}) => html`<ul class="fig__key${cls ? ` ${cls}` : ''}" role="list">${items.map(({ swatch, label }) => html`<li><span class="${swatch}" aria-hidden="true"></span>${label}</li>`)}</ul>`;
