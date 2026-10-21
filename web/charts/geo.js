// Build-time maps from us-atlas TopoJSON (its `states` object): one state's outline with a point on it (a page's
// locator map) and the US choropleth, each state filled by a step of the pen ramp (a figure's chart, like the tile
// map it replaces). d3-geo projects and draws them here, at build time, as inline SVG: no map code ships to browsers.
// Colors come from classes in web/styles/charts.css, never from here.
import { geoAlbersUsa, geoBounds, geoCentroid, geoConicEqualArea, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { escapeHtml, html, Safe } from '../render/html.js';
import { checkId, frame, hatchDefs, hatchFill, mark, plain, r2, WIDTH } from './svg.js';
import { DARK_FROM, checkLegend, stepLegend, stepScale } from './tileMap.js';

// The states, DC and Puerto Rico: postal code, Census FIPS code (us-atlas's geometry id) and name, as
// engine/py/pp_engine/geo.py lists them. A territory without a code here (AS, GU, MP, VI) is never drawn.
export const STATES = Object.freeze([
  ['AL', '01', 'Alabama'], ['AK', '02', 'Alaska'], ['AZ', '04', 'Arizona'], ['AR', '05', 'Arkansas'],
  ['CA', '06', 'California'], ['CO', '08', 'Colorado'], ['CT', '09', 'Connecticut'], ['DE', '10', 'Delaware'],
  ['DC', '11', 'District of Columbia'], ['FL', '12', 'Florida'], ['GA', '13', 'Georgia'], ['HI', '15', 'Hawaii'],
  ['ID', '16', 'Idaho'], ['IL', '17', 'Illinois'], ['IN', '18', 'Indiana'], ['IA', '19', 'Iowa'],
  ['KS', '20', 'Kansas'], ['KY', '21', 'Kentucky'], ['LA', '22', 'Louisiana'], ['ME', '23', 'Maine'],
  ['MD', '24', 'Maryland'], ['MA', '25', 'Massachusetts'], ['MI', '26', 'Michigan'], ['MN', '27', 'Minnesota'],
  ['MS', '28', 'Mississippi'], ['MO', '29', 'Missouri'], ['MT', '30', 'Montana'], ['NE', '31', 'Nebraska'],
  ['NV', '32', 'Nevada'], ['NH', '33', 'New Hampshire'], ['NJ', '34', 'New Jersey'], ['NM', '35', 'New Mexico'],
  ['NY', '36', 'New York'], ['NC', '37', 'North Carolina'], ['ND', '38', 'North Dakota'], ['OH', '39', 'Ohio'],
  ['OK', '40', 'Oklahoma'], ['OR', '41', 'Oregon'], ['PA', '42', 'Pennsylvania'], ['RI', '44', 'Rhode Island'],
  ['SC', '45', 'South Carolina'], ['SD', '46', 'South Dakota'], ['TN', '47', 'Tennessee'], ['TX', '48', 'Texas'],
  ['UT', '49', 'Utah'], ['VT', '50', 'Vermont'], ['VA', '51', 'Virginia'], ['WA', '53', 'Washington'],
  ['WV', '54', 'West Virginia'], ['WI', '55', 'Wisconsin'], ['WY', '56', 'Wyoming'], ['PR', '72', 'Puerto Rico'],
]);
export const STATE_NAMES = Object.freeze(Object.fromEntries(STATES.map(([code, , name]) => [code, name])));
const CODE_OF_FIPS = new Map(STATES.map(([code, fips]) => [fips, code]));

// The codes the US map draws: the states and DC (geoAlbersUsa has no place for Puerto Rico), in STATES order.
export const US_MAP_CODES = Object.freeze(STATES.map(([code]) => code).filter((code) => code !== 'PR'));
// The codes a locator map draws. A territory, Puerto Rico included, gets no map (pages say so by leaving it out).
const LOCATOR_CODES = new Set(US_MAP_CODES);

// Coordinates to 0.1 unit, and an outline's points thinned to one per THIN units: a map's outlines are its largest
// markup, and detail finer than about half a pixel never shows.
const DIGITS = 1;
const THIN = 1;
// The US map's fifty states are each drawn smaller than a locator map's one, so its outlines take a coarser thinning.
const THIN_US = 1.5;
// A locator map's margin inside its frame, and the tallest it may be as a share of its width (a tall state, such as
// California, fits the height and is centered across).
const PAD = 8;
const MAX_ASPECT = 1;
// The standard parallels of a state's conic projection: a sixth of its latitude span in from each edge, the usual
// choice for an equal-area conic, so a long state (Alaska, Florida) keeps its shape.
const PARALLEL_INSET = 1 / 6;
// The point's dot and its halo, in viewBox units.
const DOT_R = 4;
const HALO_R = 9;
// The US map's height as a share of its width (geoAlbersUsa's frame with Alaska and Hawaii inset).
const US_ASPECT = 0.62;

// Each state's GeoJSON feature by postal code, decoded once per topology.
const SHAPES = new WeakMap();
export function stateShapes(topo) {
  let shapes = SHAPES.get(topo);
  if (!shapes) {
    const object = topo?.objects?.states;
    if (!object) throw new TypeError('stateShapes: the topology has no "states" object (us-atlas counties-10m)');
    shapes = new Map();
    for (const f of feature(topo, object).features) {
      const code = CODE_OF_FIPS.get(String(f.id));
      if (code) shapes.set(code, f);
    }
    SHAPES.set(topo, shapes);
  }
  return shapes;
}

// A projection's stream with each ring thinned: a point closer than thin to the last one kept is dropped (a ring's
// last point is always kept, so it closes where it should), and a ring left with fewer than three points (an islet
// under a pixel across) is dropped whole. Points outside a ring pass through.
function thinned(projection, thin = THIN) {
  const min2 = thin * thin;
  return {
    stream(sink) {
      let ring = null;
      let skipped = null;
      const filter = {
        point(x, y) {
          if (!ring) return sink.point(x, y);
          const last = ring.at(-1);
          if (!last || (x - last[0]) ** 2 + (y - last[1]) ** 2 >= min2) {
            ring.push([x, y]);
            skipped = null;
          } else skipped = [x, y];
        },
        lineStart() { ring = []; skipped = null; },
        lineEnd() {
          if (skipped) ring.push(skipped);
          if (ring.length >= 3) {
            sink.lineStart();
            for (const [x, y] of ring) sink.point(x, y);
            sink.lineEnd();
          }
          ring = null;
        },
        polygonStart() { sink.polygonStart(); },
        polygonEnd() { sink.polygonEnd(); },
        sphere() { sink.sphere(); },
      };
      return projection.stream(filter);
    },
  };
}
const outlinePath = (projection, thin = THIN) => geoPath(thinned(projection, thin)).digits(DIGITS);

// One state's projection and outline at a width, fitted to its own shape; remembered, since every hospital in a state
// shares them.
const LOCATORS = new Map();
function locator(shapes, code, width) {
  const key = `${code}:${width}`;
  if (LOCATORS.get(key)?.shapes === shapes) return LOCATORS.get(key);
  const f = shapes.get(code);
  const [[, south], [, north]] = geoBounds(f);
  const inset = (north - south) * PARALLEL_INSET;
  const projection = geoConicEqualArea().rotate([-geoCentroid(f)[0], 0]).parallels([south + inset, north - inset]);
  // Fitted to the width first, for the height the shape takes there (capped), then into that frame, centered.
  projection.fitWidth(width - 2 * PAD, f);
  const [[, y0], [, y1]] = geoPath(projection).bounds(f);
  const height = Math.min(Math.ceil(y1 - y0 + 2 * PAD), Math.round(width * MAX_ASPECT));
  projection.fitExtent([[PAD, PAD], [width - PAD, height - PAD]], f);
  const entry = { shapes, projection, height, outline: outlinePath(projection)(f) };
  LOCATORS.set(key, entry);
  return entry;
}

// One state's outline with a dot (and its halo) at point [lon, lat], as an image named by label. null, so the page
// leaves the map out rather than draw a wrong one, for a code with no outline here (a territory, or one the
// topology lacks), a point that isn't a pair of finite numbers, or a point that would fall outside the frame (a
// location the outline doesn't hold).
//   shapes  stateShapes(topo); code: the postal code; label: the image's accessible name (text)
//   dot     the dot and halo's scale, for a map drawn small (a thumbnail needs a larger dot to stay visible)
export function stateMap({ shapes, code, point, label, width = WIDTH, dot = 1 }) {
  if (typeof label !== 'string' || !label) throw new TypeError('stateMap: label is required');
  if (!LOCATOR_CODES.has(code) || !shapes.has(code)) return null;
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) return null;
  const { projection, height, outline } = locator(shapes, code, width);
  const at = projection(point);
  if (!at || !(at[0] >= 0 && at[0] <= width && at[1] >= 0 && at[1] <= height)) return null;
  const [x, y] = at.map(r2);
  return new Safe(`<svg class="chart chart--state-map" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeHtml(label)}" focusable="false" style="--vb: ${width}">`
    + `<path class="chart-geo-state" d="${outline}"/>`
    + `<circle class="chart-geo-halo" cx="${x}" cy="${y}" r="${r2(HALO_R * dot)}"/><circle class="chart-geo-dot" cx="${x}" cy="${y}" r="${r2(DOT_R * dot)}"/></svg>`);
}

// The US map's projection and each state's path at a width; remembered for the build.
const US = new Map();
function usPaths(shapes, width) {
  const key = String(width);
  if (US.get(key)?.shapes === shapes) return US.get(key);
  const height = Math.round(width * US_ASPECT);
  const features = US_MAP_CODES.map((code) => shapes.get(code)).filter(Boolean);
  const projection = geoAlbersUsa().fitExtent([[2, 2], [width - 2, height - 2]], { type: 'FeatureCollection', features });
  const path = outlinePath(projection, THIN_US);
  // A state the thinning would leave with no ring (DC, on the phone variant) keeps its full outline.
  const full = geoPath(projection).digits(DIGITS);
  const paths = new Map(US_MAP_CODES.map((code) => [code, shapes.has(code) ? path(shapes.get(code)) || full(shapes.get(code)) : null]));
  const entry = { shapes, height, paths };
  US.set(key, entry);
  return entry;
}

function checkUsStates(states) {
  for (const code of Object.keys(states)) if (!US_MAP_CODES.includes(code)) throw new RangeError(`usMap: unknown code ${code}`);
  for (const code of US_MAP_CODES) {
    const s = states[code];
    if (!s) throw new RangeError(`usMap: no entry for ${code} (a code with no data is hatched or empty with a label, never left out)`);
    if (s.hatched && s.empty) throw new RangeError(`usMap: ${code} is either hatched or empty, not both`);
    if (!s.hatched && !s.empty && !Number.isFinite(s.value)) throw new RangeError(`usMap: ${code} has no value and is not hatched or empty`);
  }
}

// The US choropleth: each state and DC filled by a step of the pen ramp, as tileMap fills its tiles (the same
// states entries, ramp, format and legend, and the same stepped legend under the map), each state a mark with its
// tooltip and data-state, so web/client/figure.js steps through them by keyboard and a page script can act on one.
// A value of zero takes the neutral mark; hatched is not in the program; empty is nothing to show; few gets a dashed
// outline over the state. Every code in US_MAP_CODES must be given, and only those codes.
export function usMap({ id, shapes, states, ramp, legend: words = {}, width = WIDTH, format = plain }) {
  checkId(id, 'usMap');
  checkUsStates(states);
  checkLegend({ ramp, words, states, who: 'usMap' });
  const { stepOf } = stepScale(ramp);
  const { height, paths } = usPaths(shapes, width);
  const marks = US_MAP_CODES.filter((code) => paths.get(code)).map((code) => {
    const s = states[code];
    const d = paths.get(code);
    const none = s.hatched || s.empty;
    const zero = !none && s.value === 0;
    const step = none || zero ? null : stepOf(s.value);
    const shape = s.hatched ? html`<path class="chart-tile-na chart-geo-state" fill="${hatchFill(id)}" d="${d}"/>`
      : s.empty ? html`<path class="chart-tile-empty chart-geo-state" d="${d}"/>`
        : html`<path class="chart-tile chart-geo-state ${zero ? 'chart-tile-zero' : `chart-seq-${step}`}" d="${d}"/>${s.few ? html`<path class="chart-tile-few chart-geo-few${step >= DARK_FROM ? ' chart-tile-few--on' : ''}" d="${d}"/>` : ''}`;
    return html`${mark({ tip: `${STATE_NAMES[code]}: ${s.label}`, value: none ? null : s.value, data: { state: code }, hit: null, body: shape })}
`;
  });
  const legend = stepLegend({ id, top: height, ramp, format, words, states });
  return frame({
    kind: 'us-map', width, height: legend.height, body: html`${hatchDefs(id)}
${marks}${legend.body}`,
  });
}
