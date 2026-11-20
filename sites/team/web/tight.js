// A display figure's separators held close. The figures are set in the type face, a monospace, where a comma or a point
// takes a digit's whole cell and so stands apart in large type ("$19 , 518"); each separator goes in a span the
// stylesheet narrows (.tm-sep), so the figure reads as one number. Its text is unchanged for copying and for a screen
// reader. Shared by the build and the page's script.
import { keepSigned } from '../../../web/render/components.js';
import { html } from '../../../web/render/html.js';

const SEPARATOR = /([,.])/;
const separated = (text) => html`${text.split(SEPARATOR).map((part, i) => (i % 2 ? html`<span class="tm-sep">${part}</span>` : part))}`;
// A signed figure also stays whole, its sign never alone at a line's end (components.js keepSigned).
export const tight = (text) => keepSigned(text, separated);
