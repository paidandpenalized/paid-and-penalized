// Build-time maps from us-atlas TopoJSON (its `states` object): one state's outline with a point on it (a page's
// locator map) and the US choropleth, each state filled by a step of the pen ramp (a figure's chart, like the tile
// map it replaces). d3-geo projects and draws them here, at build time, as inline SVG: no map code ships to browsers.
// Colors come from classes in web/styles/charts.css, never from here.
import { geoAlbersUsa, geoBounds, geoCentroid, geoCircle, geoConicEqualArea, geoDistance, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { escapeHtml, html, Safe } from '../render/html.js';
import { checkId, frame, hatchDefs, hatchFill, isNarrow, mark, plain, r2, WIDTH } from './svg.js';
import { dotsPath } from './dots.js';
import { DARK_FROM, checkLegend, stepLegend, stepScale } from './tileMap.js';

// The pinned us-atlas topology (its `states` and `counties` objects) every map here is drawn from; a site reads it with
// readPinned(ATLAS_ID) and hands it to stateShapes.
export const ATLAS_ID = 'us-atlas-counties-3.0.1';

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
// A state's counties (us-atlas county ids begin with the state's FIPS code).
export const countiesOf = (counties, code) => {
  const fips = STATES.find(([c]) => c === code)?.[1];
  return fips ? counties.filter((f) => String(f.id).startsWith(fips)) : [];
};

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
const US_THIN_WIDTH = 560;
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

// The US map's height at a width: the frame usProjected and the US map's paths share.
export const usMapHeight = (width) => Math.round(width * US_ASPECT);

// Where a record with `lat` and `lon` (a hospital in the master) goes in usProjected's points: [lon, lat], longitude
// first as the projection takes it, or null without both.
export const pointOf = ({ lat, lon }) => (Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null);

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

// Every county's GeoJSON feature, decoded once per topology (us-atlas counties-10m's `counties` object): the area
// map's faint inner lines.
const COUNTIES = new WeakMap();
export function countyShapes(topo) {
  let list = COUNTIES.get(topo);
  if (!list) {
    const object = topo?.objects?.counties;
    if (!object) throw new TypeError('countyShapes: the topology has no "counties" object (us-atlas counties-10m)');
    list = feature(topo, object).features;
    COUNTIES.set(topo, list);
  }
  return list;
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
          const last = ring[ring.length - 1];
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
const outlinePath = (projection, thin = THIN, digits = DIGITS) => geoPath(thinned(projection, thin)).digits(digits);

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

// The US map at a width, remembered for the build: { height, paths (each state's d by postal code, null where the shapes
// have none), projection }. The hub's home map draws these at the hub asset's width, so its hospitals' x and y
// (usProjected) land on the states.
const US = new Map();
export function usPaths(shapes, width) {
  const key = String(width);
  if (US.get(key)?.shapes === shapes) return US.get(key);
  const height = usMapHeight(width);
  const features = US_MAP_CODES.map((code) => shapes.get(code)).filter(Boolean);
  const projection = geoAlbersUsa().fitExtent([[2, 2], [width - 2, height - 2]], { type: 'FeatureCollection', features });
  // Wider than the wide variant, the outlines thin in proportion, so a map drawn across a page keeps the wide one's
  // detail per state, not twice its markup.
  const path = outlinePath(projection, THIN_US * Math.max(1, width / US_THIN_WIDTH));
  // A state the thinning would leave with no ring (DC, on the phone variant) keeps its full outline.
  const full = geoPath(projection).digits(DIGITS);
  const paths = new Map(US_MAP_CODES.map((code) => [code, shapes.has(code) ? path(shapes.get(code)) || full(shapes.get(code)) : null]));
  const entry = { shapes, height, paths, projection };
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
export function usMap({ id, shapes, states, ramp, legend: words = {}, width = WIDTH, format = plain, overlay = '' }) {
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
${marks}${overlay}${legend.body}`,
  });
}

// The area around a place: every state's outline clipped to a frame fitted around the given points (with room), a
// numbered dot at each, and the place itself as a ▲. Each dot is a mark (its tooltip, its number) so the keyboard
// steps through them. A point that isn't a pair of finite numbers is left out; with fewer than two, no map (null).
//   center   { point, tip }; points [{ point, n, cls, tip }] (n: the number printed on the dot; cls: its class)
//   label    the image's accessible name
const AREA_PAD = 22;
const BOUNDS = new WeakMap();
const boundsOf = (f) => { if (!BOUNDS.has(f)) BOUNDS.set(f, geoBounds(f)); return BOUNDS.get(f); };
const AREA_ASPECT = 0.8;
// Whether a feature's bounds meet a projected frame (with a degree of slack): the frame's corners and edge midpoints
// taken back to longitude and latitude. A feature that crosses the antimeridian (its west bound east of its east
// bound: Alaska) always counts, as does a frame a point of which has no place in the projection. Shapes the frame
// misses are never projected, which is most of the country on a state's or a metro's map.
function framed(projection, width, height) {
  const at = [[0, 0], [width / 2, 0], [width, 0], [0, height / 2], [width, height / 2], [0, height], [width / 2, height], [width, height]].map((c) => projection.invert(c));
  if (at.some((c) => !c || !c.every(Number.isFinite))) return () => true;
  const [w, e] = [Math.min(...at.map((c) => c[0])) - 1, Math.max(...at.map((c) => c[0])) + 1];
  const [s, n] = [Math.min(...at.map((c) => c[1])) - 1, Math.max(...at.map((c) => c[1])) + 1];
  return (f) => {
    const [[fw, fs], [fe, fn]] = boundsOf(f);
    return fw > fe || (fe >= w && fw <= e && fn >= s && fs <= n);
  };
}
// The Earth's mean radius in statute miles (IUGG), and the great-circle distance in miles between two [lon, lat] points.
export const EARTH_MILES = 3958.8;
export const miles = (a, b) => geoDistance(a, b) * EARTH_MILES;
const MILES_PER_DEGREE = (EARTH_MILES * Math.PI) / 180;
export function areaMap({ shapes, counties = [], center, points, rings = [], label, width = WIDTH }) {
  if (typeof label !== 'string' || !label) throw new TypeError('areaMap: label is required');
  const ok = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const placed = points.filter((p) => ok(p.point));
  if (!ok(center.point) || placed.length < 2) return null;
  const height = Math.round(width * AREA_ASPECT);
  // Fitted around the points and a small square about the center (a quarter degree each way), so a lone near pair
  // keeps some country around it.
  const [lon, lat] = center.point;
  const span = [[lon - 0.25, lat - 0.25], [lon + 0.25, lat + 0.25]];
  const all = { type: 'MultiPoint', coordinates: [center.point, ...span, ...placed.map((p) => p.point)] };
  const projection = geoConicEqualArea().rotate([-lon, 0]).parallels([lat - 2, lat + 2])
    .fitExtent([[AREA_PAD, AREA_PAD], [width - AREA_PAD, height - AREA_PAD]], all);
  // Clipped to the frame, and no adaptive resampling: at a few hundred miles across, straight segments are exact enough.
  projection.clipExtent([[0, 0], [width, height]]).precision(0);
  // Only the shapes whose bounds meet the frame's (a degree of slack) are drawn.
  const meets = framed(projection, width, height);
  const path = outlinePath(projection);
  const land = [...shapes.values()].filter(meets).map((f) => path(f)).filter(Boolean);
  const inner = counties.filter(meets).map((f) => path(f)).filter(Boolean);
  // Distance rings about the center: each { miles, label }, a circle of that great-circle radius.
  const ringPath = geoPath(projection).digits(DIGITS);
  const ringsDrawn = rings.map((r) => {
    const d = ringPath(geoCircle().center(center.point).radius(r.miles / MILES_PER_DEGREE).precision(3)());
    if (!d) return '';
    const [rx, ry] = projection([lon, lat + r.miles / MILES_PER_DEGREE]).map(r2);
    return html`<path class="chart-ring" d="${d}"/><text class="chart-ring__label" x="${rx}" y="${ry}" dy="-3" text-anchor="middle">${r.label}</text>`;
  });
  const at = (p) => projection(p).map(r2);
  const [cx, cy] = at(center.point);
  const dots = placed.map((p) => {
    const [x, y] = at(p.point);
    return mark({
      tip: p.tip, value: null, hit: null,
      body: html`<circle class="chart-pin ${p.cls}" cx="${x}" cy="${y}" r="9"/><text class="chart-pin__n" x="${x}" y="${y}" dy="0.35em" text-anchor="middle">${String(p.n)}</text>`,
    });
  });
  return new Safe(html`<svg class="chart chart--area-map" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${label}" focusable="false" style="--vb: ${width}">`.text
    + `<rect class="chart-sea" width="${width}" height="${height}"/>${land.map((d) => `<path class="chart-geo-land" d="${d}"/>`).join('')}`
    + `<g class="chart-geo-counties">${inner.map((d) => `<path d="${d}"/>`).join('')}</g>`
    + `${land.map((d) => `<path class="chart-geo-state" d="${d}"/>`).join('')}`
    + html`${ringsDrawn}${dots.reverse()}${mark({ tip: center.tip, value: null, hit: null, body: html`<path class="chart-this chart-this--map" d="M${cx} ${r2(cy - 12)}l10 18h-20z"/>` })}`.text
    + '</svg>');
}

// ---------- hospitals as dots ----------

// A dot for each hospital at its place on the US map (Albers USA, the choropleth's projection and frame at the same
// width: Alaska and Hawaii inset), as one path per class (web/charts/dots.js), each class's diameter its own: an
// overlay for usMap. points [{ point, cls }]; sizes { [cls]: diameter }. A point the projection has no place for is
// left out.
export function usPoints({ shapes, points, sizes, width }) {
  const { projection } = usPaths(shapes, width);
  const byCls = new Map(Object.keys(sizes).map((cls) => [cls, []]));
  for (const p of points) {
    const at = Array.isArray(p.point) ? projection(p.point) : null;
    if (at) byCls.get(p.cls)?.push(at);
  }
  return html`<g class="chart-us__points">${[...byCls].map(([cls, pts]) => dotsPath(pts, cls, sizes[cls]))}</g>`;
}

// A place's map: the states it holds (or a metro's area, fitted around its hospitals) in the panel tone with their
// neighbors faint around them, counties as hairlines, and each hospital a dot that is a mark (its tooltip; data-href
// opens its page). fit: 'states' (codes: the place's states; Alaska and Hawaii inset by Albers USA when the place
// holds more than one state) or 'points' (a metro). points [{ point, cls, tip, href }]; label: the image's name.
// dense: { [cls]: diameter } to draw the dots as one path per class instead (a region's thousand hospitals), with no
// tooltips. ownCounties: county ids (FIPS) shaded as the place's own (a metro's). variant: 'narrow' or 'wide' when a
// figure carries both drawings (charts.css shows one).
const PLACE_PAD = 14;
export function placeMap({ shapes, counties = [], codes, fit = 'states', points, label, width, aspect = 0.68, dense = null, ownCounties = null, variant = null }) {
  if (typeof label !== 'string' || !label) throw new TypeError('placeMap: label is required');
  const ok = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const placed = points.filter((p) => ok(p.point));
  const mine = codes.map((c) => shapes.get(c)).filter(Boolean);
  if (!mine.length && !placed.length) return null;
  const height = Math.round(width * aspect);
  const extent = [[PLACE_PAD, PLACE_PAD], [width - PLACE_PAD, height - PLACE_PAD]];
  let projection;
  if (fit === 'points') {
    if (placed.length < 1) return null;
    const lons = placed.map((p) => p.point[0]);
    const lats = placed.map((p) => p.point[1]);
    const [w, e, s, n] = [Math.min(...lons) - 0.3, Math.max(...lons) + 0.3, Math.min(...lats) - 0.25, Math.max(...lats) + 0.25];
    const lon = (w + e) / 2;
    const lat = (s + n) / 2;
    projection = geoConicEqualArea().rotate([-lon, 0]).parallels([lat - 2, lat + 2])
      .fitExtent(extent, { type: 'MultiPoint', coordinates: [[w, s], [e, n], [w, n], [e, s]] });
  } else if (mine.length > 1) {
    projection = geoAlbersUsa().fitExtent(extent, { type: 'FeatureCollection', features: mine });
  } else {
    const f = mine[0];
    const [[, south], [, north]] = geoBounds(f);
    const inset = (north - south) * PARALLEL_INSET;
    projection = geoConicEqualArea().rotate([-geoCentroid(f)[0], 0]).parallels([south + inset, north - inset]).fitExtent(extent, f);
  }
  if (fit !== 'states' || mine.length === 1) projection.clipExtent([[0, 0], [width, height]]).precision(0);
  const path = outlinePath(projection);
  const inPlace = new Set(codes);
  const clipped = fit === 'points' || mine.length === 1;
  const meets = clipped ? framed(projection, width, height) : null;
  const others = clipped
    ? [...shapes].filter(([code, f]) => !inPlace.has(code) && LOCATOR_CODES.has(code) && meets(f)).map(([, f]) => path(f)).filter(Boolean)
    : [];
  const inside = mine.map((f) => path(f)).filter(Boolean);
  // Counties only for a single state or a metro (a region's would be thousands of hairlines).
  const countyLines = clipped
    ? counties.filter(meets).map((f) => ({ d: path(f), own: Boolean(ownCounties?.has(String(f.id))) })).filter((c) => c.d)
    : [];
  const dots = dense ? Object.entries(dense).map(([cls, d]) => dotsPath(placed.filter((p) => p.cls === cls).map((p) => projection(p.point)).filter(Boolean), cls, d).text).join('') : placed.map((p) => {
    const at = projection(p.point);
    if (!at) return '';
    const [x, y] = at.map(r2);
    return mark({ tip: p.tip, value: null, data: p.href ? { href: p.href } : {}, hit: null, body: html`<circle class="chart-place__dot ${p.cls}" cx="${x}" cy="${y}" r="${p.r ?? 4}"/>` }).text;
  }).join('');
  return new Safe(html`<svg class="chart chart--place-map"${variant ? html` data-fit="${variant}"` : ''} viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${label}" focusable="false" style="--vb: ${width}">`.text
    + `<rect class="chart-sea" width="${width}" height="${height}"/>`
    + others.map((d) => `<path class="chart-geo-land chart-geo-near" d="${d}"/>`).join('')
    + inside.map((d) => `<path class="chart-geo-land chart-geo-mine" d="${d}"/>`).join('')
    + countyLines.filter((c) => c.own).map((c) => `<path class="chart-geo-land chart-geo-mine" d="${c.d}"/>`).join('')
    + `<g class="chart-geo-counties">${countyLines.map((c) => `<path d="${c.d}"/>`).join('')}</g>`
    + inside.map((d) => `<path class="chart-geo-state" d="${d}"/>`).join('')
    + dots + '</svg>');
}

// Hospitals projected onto the US map at a width (Albers USA, the choropleth's frame): [x, y] to a tenth of a unit for
// each point, or null where the projection has no place for it. A page script redraws dots from these.
export function usProjected(shapes, points, width) {
  const { projection } = usPaths(shapes, width);
  return points.map((p) => {
    const at = Array.isArray(p) ? projection(p) : null;
    return at ? at.map((v) => Math.round(v * 10) / 10) : null;
  });
}

// The year map: every state's outline as a faint land, and the hospitals as dots, one path per class (drawn in the
// order given, so the last class sits on top). groups [{ cls, points: [[x, y]] }] already projected (usProjected) at
// this width; size: the dots' diameter.
export function usYearMap({ shapes, groups, size, width }) {
  const { height, paths } = usPaths(shapes, width);
  const land = US_MAP_CODES.map((code) => paths.get(code)).filter(Boolean);
  return frame({
    kind: 'us-years', width, height, body: html`<g class="chart-land">${land.map((d) => html`<path d="${d}"/>`)}</g>
<g class="chart-years__dots" data-size="${size}">${groups.map((g) => dotsPath(g.points, g.cls, size))}</g>`,
  });
}

// Proportional circles on the US map: every state's outline as a faint land, drawn once, and over it one layer of
// circles per view (a page script or CSS shows one layer at a time: the land is the drawing's weight, so the views
// share it). In each layer, a circle at each state's center (the projected centroid of its outline; Alaska and Hawaii
// in their insets), its area the state's value on that layer's own scale; the largest drawn first, so a small state's
// circle shows on top of a big neighbor's. Each circle is a mark with its tooltip, value and data-state.
//   layers   [{ id, states: { [code]: { value (> 0), label } } }] (codes from US_MAP_CODES; a state left out gets no
//            circle, as is a place the map has no room for: hasBubble); rMax: the largest circle's radius in each layer, in viewBox units (default: larger across a page than
//            on a phone)
// The land is background, drawn thinner than the choropleth's outlines (BUBBLE_THIN times as thinned) and to whole units.
const BUBBLE_THIN = 3;
// Whether the map can hold a circle for a state: it is one the map draws (not Puerto Rico) and the shapes outline it.
export const hasBubble = (shapes, code) => US_MAP_CODES.includes(code) && Boolean(shapes.get(code));
export function usBubbles({ shapes, layers, width, rMax = isNarrow(width) ? 22 : 52 }) {
  const { height, projection } = usPaths(shapes, width);
  const centroid = geoPath(projection);
  const coarse = outlinePath(projection, THIN_US * BUBBLE_THIN * Math.max(1, width / US_THIN_WIDTH), 0);
  const land = US_MAP_CODES.map((code) => (shapes.has(code) ? coarse(shapes.get(code)) : null)).filter(Boolean);
  const layer = ({ id, states }) => {
    const entries = Object.entries(states).filter(([code, s]) => hasBubble(shapes, code) && s.value > 0);
    const max = Math.max(...entries.map(([, s]) => s.value), 1);
    const circles = entries.map(([code, s]) => {
      const [cx, cy] = centroid.centroid(shapes.get(code));
      return { code, s, cx, cy, r: Math.sqrt(s.value / max) * rMax };
    }).filter((c) => Number.isFinite(c.cx) && Number.isFinite(c.cy)).sort((a, b) => b.r - a.r || (a.code < b.code ? -1 : 1));
    return html`<g class="chart-bubbles__layer chart-bubbles__layer--${id}">${circles.map((c) => mark({ tip: `${STATE_NAMES[c.code]}: ${c.s.label}`, value: c.s.value, data: { state: c.code }, hit: null, body: html`<circle class="chart-bubble" cx="${r2(c.cx)}" cy="${r2(c.cy)}" r="${r2(Math.max(0.8, c.r))}"/>` }))}</g>`;
  };
  return frame({
    kind: 'us-bubbles', width, height, body: html`<path class="chart-land" d="${land.join('')}"/>
${layers.map(layer)}`,
  });
}
