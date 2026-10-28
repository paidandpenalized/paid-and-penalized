// The story's states map, drawn at build time (step 7, "By state"): each state and DC shaded by its hospitals' combined
// net change as a share of their estimated Medicare inpatient pay, on a diverging key of opacity steps of the two meaning
// inks over the land's --paper-2 (a cut in --pen, a bonus in --rew; hub/styles.css), Maryland hatched (not in these
// programs). Each state is a path with data-st and its numbers as its title, drawn with the hub asset's projection and
// width (MAP_WIDTH), so the story's script can lay its dots on it and use the paths as its hit areas. Also the map's key
// and the small states' buttons the script shows.
import { MAP_WIDTH } from '../asset.js';
import { STATE_NAMES, US_MAP_CODES, usPaths } from '../../web/charts/geo.js';
import { fillCopy } from '../../web/render/components.js';
import { noun, pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { COPY } from './copy.js';

// The key's steps of ink on each side of zero, and what its end is rounded up to (a tenth of a percentage point of pay).
export const KEY_STEPS = 6;
const KEY_ROUND = 0.001;
// The states the map draws too small to point at, which the script lists as buttons beside it, north to south.
export const SMALL_STATES = Object.freeze(['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']);

const fill = (key, values) => fillCopy(COPY, key, values);
const hospitalsText = (n) => noun(n, COPY.hospital, COPY.hospitals);

// The key over the states (stateTotals): its end, the largest share any state has either side of zero rounded up, and
// each share's ink and step. ink: 'pen' for a cut, 'rew' for a bonus, null for none; t: the step's opacity, from one
// step (1 / KEY_STEPS) to 1, or null for a share of exactly zero.
export function stateKey(states) {
  const shares = [...states.values()].filter((s) => !s.notInPrograms).map((s) => Math.abs(s.share));
  const largest = Math.max(...shares);
  if (!(largest > 0)) throw new RangeError('hub home: no state has a net change to shade');
  const end = Math.ceil(largest / KEY_ROUND - 1e-9) * KEY_ROUND;
  const stepOf = (share) => Math.min(KEY_STEPS, Math.max(1, Math.ceil((Math.abs(share) / end) * KEY_STEPS - 1e-9)));
  return {
    end,
    shade: (share) => (share === 0 ? { ink: null, t: null } : { ink: share < 0 ? 'pen' : 'rew', t: stepOf(share) / KEY_STEPS }),
  };
}

// A step's opacity as a style property: the number only, to three places.
const tStyle = (t) => `--t:${Math.round(t * 1000) / 1000}`;

// One state's line (its title on the map, its button's name, the readout's words): its hospitals, its net as a share of
// their pay, the share of them with a net cut; Maryland's says it is outside these programs.
export function stateLine(code, s) {
  const name = STATE_NAMES[code];
  if (!s) return fill('stateNone', { name });
  if (s.notInPrograms) return fill('stateMaryland', { name, hospitals: hospitalsText(s.n) });
  return fill('stateLine', { name, hospitals: hospitalsText(s.n), share: pct(s.share, 2), cutShare: pct(s.cutN / s.n, 0) });
}

// A state's kind and style: 'md' (hatched) for Maryland, 'zero' (unshaded) with no estimate or a net of exactly zero,
// else its ink ('pen' or 'rew') with its step as the style.
function shading(s, key) {
  if (s?.notInPrograms) return { kind: 'md', style: null };
  const { ink, t } = s ? key.shade(s.share) : { ink: null, t: null };
  return ink ? { kind: ink, style: tStyle(t) } : { kind: 'zero', style: null };
}
const styleAttr = (style) => (style ? html` style="${style}"` : '');

// The map: the land under every state (one path, the states' outlines run together, in --paper-2), then each state and DC
// shaded over it, with its line as its title. shapes: stateShapes of the atlas; states: stateTotals.
export function statesMap({ shapes, states }) {
  const key = stateKey(states);
  const { height, paths } = usPaths(shapes, MAP_WIDTH);
  const drawn = US_MAP_CODES.filter((code) => paths.get(code));
  const land = drawn.map((code) => paths.get(code)).join('');
  const marks = drawn.map((code) => {
    const s = states.get(code);
    const { kind, style } = shading(s, key);
    return html`<path class="st st--${kind}" data-st="${code}"${styleAttr(style)} d="${paths.get(code)}"><title>${stateLine(code, s)}</title></path>`;
  });
  return html`<svg class="smap" viewBox="0 0 ${MAP_WIDTH} ${height}" role="group" aria-label="${COPY.mapLabel}" focusable="false"><defs><pattern id="smap-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect class="smap__hatch-bg" width="6" height="6"/><path class="smap__hatch" d="M1.5 0V6"/></pattern></defs><path class="smap__land" d="${land}"/>${marks}</svg>`;
}

// The map's key: its title, the steps from the deepest cut to the largest bonus with the signed ends and the words,
// and Maryland's hatch. fy: the fiscal year.
export function stateLegend({ states, fy }) {
  const { end } = stateKey(states);
  const sw = 20;
  // Left to right: the deepest cut to the lightest, then the lightest bonus to the largest.
  const swatches = Array.from({ length: 2 * KEY_STEPS }, (_, k) => ({
    ink: k < KEY_STEPS ? 'pen' : 'rew', t: (k < KEY_STEPS ? KEY_STEPS - k : k - KEY_STEPS + 1) / KEY_STEPS, x: k * sw,
  }));
  const width = 2 * KEY_STEPS * sw;
  return html`<div class="dkey">
<p class="dkey__t">${fill('keyTitle', { fy: String(fy) })}</p>
<svg class="dkey__g" viewBox="0 0 ${width} 10" aria-hidden="true" focusable="false"><rect class="smap__land" width="${width}" height="10"/>${swatches.map((s) => html`<rect class="st st--${s.ink}" style="${tStyle(s.t)}" x="${s.x}" width="${sw}" height="10"/>`)}</svg>
<p class="dkey__s"><span>${fill('keyCut', { end: pct(-end, 1) })}</span><span>${pct(0, 0)}</span><span>${fill('keyBonus', { end: pct(end, 1, { sign: true }) })}</span></p>
<p class="dkey__md"><span class="dkey__hatch" aria-hidden="true"></span>${COPY.keyMaryland}</p>
</div>`;
}

// The small states' buttons, each named by its line and marked with its ink and step, hidden: the story's script shows
// them and gives them their part (pointing at one reads its line out).
export function smallStates(states) {
  const key = stateKey(states);
  return html`<div class="smalls" hidden><p class="smalls__cap">${COPY.smallStates}</p>${SMALL_STATES.map((code) => {
    const s = states.get(code);
    const { kind, style } = shading(s, key);
    return html`<button type="button" class="sb sb--${kind}" data-st="${code}"${styleAttr(style)} aria-label="${stateLine(code, s)}">${code}</button>`;
  })}</div>`;
}
