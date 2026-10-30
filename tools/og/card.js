// The share cards' HTML (web/share-card.js): cardHtml is pure, so a test can hash it and tell when a committed card is
// stale; cardInputs reads what it is drawn from (the light tokens, the fonts, the hub's hospitals, and HACRP's emitted
// file for the hub's year, whose payment-reduction flags color the HACRP card). render.js (npm run
// og) draws each card in Chrome and writes web/og/<id>.png and the stamp.
//
// Every card: the paper and its grain, a double rule across the top and its mirror at the bottom, words on the left
// and, on the right, every hospital in the hub's data asset as a dot at its place on the US map (the asset's x and y
// on its mapW by mapH projection). The family's card: the wordmark, the tagline and the address; its dots red for a
// net cut, green for a net bonus, gray for no net change or no estimate. HACRP's card: the family and the program as a
// kicker, the program's title, its address; its dots red where CMS's HACRP file says it cut the hospital (payment
// reduction "Yes", the newest emitted year), gray otherwise. No numbers and no byline on any card.
import { readFileSync } from 'node:fs';
import { hubAsset } from '../../hub/asset.js';
import { hubModel } from '../../hub/data.js';
import { REPO_ROOT, readJson } from '../../pipeline/files.js';
import { LIGHT_BLOCK, declarations } from '../../pipeline/site/assets.js';
import { emittedPath } from '../../sites/hacrp/pipeline/build.js';
import { COPY } from '../../web/copy.js';
import { html, raw } from '../../web/render/html.js';
import { CARD_SIZE, SHARE_CARDS } from '../../web/share-card.js';
import { SITE } from '../../web/site.js';

// The faces the cards use, by font file (web/fonts/<file>.woff2): [family, weight]. render.js refuses to write a card
// if any of them fails to load.
export const CARD_FONTS = Object.freeze({
  'alfa-slab-one-400': ['Alfa Slab One', '400'],
  'libre-franklin-700': ['Libre Franklin', '700'],
  'ibm-plex-mono-400': ['IBM Plex Mono', '400'],
});

// How render.js draws a card: the page's viewport, one device pixel per CSS pixel, the light scheme, and the card's
// box. cardHtml writes these into each card's HTML, so the stamp (a hash of the HTML) goes stale when they change.
export const RENDER = Object.freeze({
  viewport: CARD_SIZE,
  deviceScaleFactor: 1,
  colorScheme: 'light',
  clip: Object.freeze({ x: 0, y: 0, ...CARD_SIZE }),
});

// The map's box on the card (right of the words) and a dot's radius at the map's scale.
const MAP_BOX = Object.freeze({ width: 450, height: 420 });
const dotRadius = (scale) => Math.max(2.6, 4.2 * scale);

const host = new URL(SITE.origin).host;
// A title as the program's page sets it: a line per word, a hyphenated word broken after its hyphen.
const titleLines = (title) => title.split(' ').flatMap((word) => word.split(/(?<=-)/));

// Each card's words and its dots' rule. lines: the big type, a line each, the last in the penalty red; size its font
// size and top the words' top edge, in px. tone({ ccn, net }, { cut }): a dot's ink, 'pen', 'rew' or null (gray), from
// the hospital's net dollars in the hub asset or its CCN among HACRP's cut hospitals (cut, a Set).
const CARDS = {
  family: {
    kicker: null,
    lines: [COPY.wordmarkLead, COPY.wordmarkPen],
    size: 112,
    top: 118,
    tagline: COPY.tagline,
    address: host,
    tone: ({ net }) => (net === null || net === 0 ? null : net < 0 ? 'pen' : 'rew'),
  },
  hacrp: {
    kicker: `${SITE.name} · ${SITE.sites.hacrp.subtitle}`,
    lines: titleLines(SITE.sites.hacrp.title),
    size: 96,
    top: 92,
    tagline: null,
    address: host + SITE.sites.hacrp.path.replace(/\/$/, ''),
    // CMS's own flag, not the dollar estimates: a hospital CMS cut but the hub has no estimate for is still red.
    tone: ({ ccn }, { cut }) => (cut.has(ccn) ? 'pen' : null),
  },
};
for (const id of Object.keys(SHARE_CARDS)) if (!Object.hasOwn(CARDS, id)) throw new Error(`tools/og/card.js: no card design for "${id}"`);

// A card's dots from the hub asset (hub: { mapW, mapH, cols, rows }) and HACRP's cut hospitals (cut: a Set of CCNs):
// [x, y, tone] on the map, the gray ones first so the colored ones sit on top; a hospital with no place on the map is
// left out.
export function cardDots(id, { hub: { cols, rows }, cut }) {
  const at = (name) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new RangeError(`share card: the hub asset has no "${name}" column`);
    return i;
  };
  const [ccn, x, y, net] = [at('ccn'), at('x'), at('y'), at('net')];
  const dots = rows.filter((r) => r[x] !== null && r[y] !== null).map((r) => [r[x], r[y], CARDS[id].tone({ ccn: r[ccn], net: r[net] }, { cut })]);
  return [...dots.filter((d) => d[2] === null), ...dots.filter((d) => d[2] !== null)];
}

// The custom properties a stylesheet reads (var(--name)), with those their values read in turn, from tokens (a Map of
// name to value); the declarations, in tokens' order. A property tokens lacks throws.
function tokensFor(css, tokens) {
  const used = new Set();
  const read = (text) => {
    for (const [, name] of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (used.has(name)) continue;
      if (!tokens.has(name)) throw new RangeError(`share card: no token ${name} in tokens.css's light block`);
      used.add(name);
      read(tokens.get(name));
    }
  };
  read(css);
  return [...tokens].filter(([name]) => used.has(name)).map(([name, value]) => `  ${name}: ${value};`).join('\n');
}

// The dots as an SVG filling the map's box, the map centered in it at the largest scale that fits.
function mapSvg(dots, { mapW, mapH }) {
  const { width: w, height: h } = MAP_BOX;
  const s = Math.min(w / mapW, h / mapH);
  const [ox, oy] = [(w - mapW * s) / 2, (h - mapH * s) / 2];
  const r = dotRadius(s).toFixed(2);
  const circles = dots.map(([x, y, tone]) => `<circle class="${tone ?? 'none'}" cx="${(ox + x * s).toFixed(1)}" cy="${(oy + y * s).toFixed(1)}" r="${r}"/>`);
  return raw(`<svg class="map" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${circles.join('')}</svg>`);
}

// A card's HTML. tokens: the light block's custom properties (a Map of name to value), of which the card carries only
// those it reads, so an edit to another token leaves it current; fonts: each CARD_FONTS file as base64; hub: the hub's
// data asset (hub/asset.js hubAsset); cut: HACRP's cut hospitals (a Set of CCNs). Everything is inline, so the HTML
// alone decides the picture, with RENDER in a comment.
export function cardHtml(id, { tokens, fonts, hub, cut }) {
  if (!Object.hasOwn(CARDS, id)) throw new RangeError(`share card: no card "${id}"`);
  const card = CARDS[id];
  const faces = Object.entries(CARD_FONTS).map(([file, [family, weight]]) => {
    if (!fonts[file]) throw new RangeError(`share card: no font file "${file}"`);
    return `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: normal; src: url(data:font/woff2;base64,${fonts[file]}) format('woff2'); }`;
  });
  const last = card.lines.length - 1;
  const css = `* { box-sizing: border-box; margin: 0; }
html, body { width: ${CARD_SIZE.width}px; height: ${CARD_SIZE.height}px; overflow: hidden; }
body { position: relative; background: var(--grain) repeat, var(--paper); color: var(--ink); font-family: var(--font-body); }
.dbl { position: absolute; left: 56px; right: 56px; border-top: 6px solid var(--ink); }
.dbl::after { content: ''; position: absolute; left: 0; right: 0; top: 4px; border-top: 1.5px solid var(--ink); }
.dbl--top { top: 40px; }
.dbl--bottom { bottom: 40px; transform: scaleY(-1); }
.words { position: absolute; left: 70px; top: ${card.top}px; width: 560px; }
.big { font: 400 ${card.size}px/.92 var(--font-display); }
.big span { display: block; width: fit-content; white-space: nowrap; }
.big .pen { color: var(--pen); }
.kick { width: fit-content; font: 700 22px var(--font-body); letter-spacing: .09em; text-transform: uppercase; color: var(--pen-ink); white-space: nowrap; }
.words > .kick { margin-bottom: 18px; }
.rule { border-top: 1.5px solid var(--ink); margin-top: 30px; padding-top: 16px; }
.addr { width: fit-content; font: 400 26px var(--font-type); white-space: nowrap; }
.kick + .addr { margin-top: 14px; }
.mapbox { position: absolute; right: 70px; top: 96px; width: ${MAP_BOX.width}px; height: ${MAP_BOX.height}px; }
.map circle { fill-opacity: .85; }
.map .pen { fill: var(--pen); } .map .rew { fill: var(--rew); } .map .none { fill: var(--ink-3); }`;
  return html`<!doctype html>
<!-- drawn with ${raw(JSON.stringify(RENDER))} -->
<html lang="en"><head><meta charset="utf-8">
<style>
${raw(faces.join('\n'))}
:root {
${raw(tokensFor(css, tokens))}
}
${raw(css)}
</style></head>
<body>
<div class="dbl dbl--top"></div>
<div class="words">
${card.kicker ? html`<div class="kick" data-fit>${card.kicker}</div>
` : ''}<div class="big">${card.lines.map((line, i) => html`<span${i === last ? raw(' class="pen"') : ''} data-fit>${line}</span>`)}</div>
<div class="rule">${card.tagline ? html`<div class="kick" data-fit>${card.tagline}</div>` : ''}<div class="addr" data-fit>${card.address}</div></div>
</div>
<div class="mapbox">${mapSvg(cardDots(id, { hub, cut }), hub)}</div>
<div class="dbl dbl--bottom"></div>
</body></html>
`.toString();
}

// What the cards are drawn from, read from the repo: the light tokens, the fonts, the hub's data asset as the build
// writes it (hub/data.js hubModel, hub/asset.js hubAsset), and the hospitals CMS's HACRP file for the hub's year cut.
export function cardInputs() {
  const block = LIGHT_BLOCK.exec(readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8'))?.[1];
  if (!block) throw new Error('web/styles/tokens.css: the light block not found');
  const fonts = Object.fromEntries(Object.keys(CARD_FONTS).map((f) => [f, readFileSync(`${REPO_ROOT}web/fonts/${f}.woff2`).toString('base64')]));
  const { hub, hospitals } = hubModel();
  const hacrp = readJson(REPO_ROOT + emittedPath(hub.fy));
  const cut = new Set(hacrp.hospitals.filter((h) => h.paymentReduction === 'Yes').map((h) => h.ccn));
  return { tokens: new Map(declarations(block)), fonts, hub: hubAsset(hospitals, hub), cut };
}
