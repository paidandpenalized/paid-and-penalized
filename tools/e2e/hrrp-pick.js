// The Readmissions (HRRP) pages the browser checks visit, picked by property from the built data (sites/hrrp/web/data.js),
// never by name or CCN: a hospital with a cut and a condition over its peer median, one a hair over it, one in a large area,
// the places for the tables. Plus the small helpers the three hrrp-*.test.js files share. No browser here.
import { CONDS, isMeasured, peerMedian } from '../../engine/js/hrrp/formula.js';
import { loadHrrp } from '../../sites/hrrp/web/data.js';
import { PAGE_SIZE } from '../../sites/hrrp/web/constants.js';
import { PROGRAM_PATH as HRRP_PROGRAM_PATH, hospitalPath, placePath } from '../../sites/hrrp/web/links.js';
import { areaKeyOf, sizedRows } from '../../sites/hrrp/web/figures/neighbors-data.js';
import { buildPlaces } from '../../sites/hrrp/web/places.js';

export { HRRP_PROGRAM_PATH };

const data = loadHrrp();
export const { hospitals: HOSPITALS, meta: META } = data;
export const pathOf = (h) => hospitalPath(h.id);
const medianOf = (h, k) => peerMedian(META, h.peer, k);
const overMedian = (h, k) => isMeasured(h.c[k]) && medianOf(h, k) != null && h.c[k].err > medianOf(h, k);
const must = (found, what) => {
  if (!found) throw new Error(`hrrp-pick: no ${what} in the Readmissions data`);
  return found;
};

// A hospital with a cut and an estimate of its dollars, a condition over its peer median that a slider can reach, and the first such condition.
export function cutSample() {
  const h = must(HOSPITALS.find((x) => x.paf < 1 && x.pen != null && CONDS.some((k) => overMedian(x, k) && x.c[k].err - medianOf(x, k) > 0.02)), 'hospital with a cut, dollars and a condition well over its median');
  return { h, cond: CONDS.find((k) => overMedian(h, k)) };
}

// A hospital with a condition over its median by under half a slider step, so that "Bring all to median" must land on it exactly.
export function closeSample() {
  const h = must(HOSPITALS.find((x) => CONDS.some((k) => overMedian(x, k) && x.c[k].err - medianOf(x, k) < 0.0005)), 'hospital with a condition just over its median');
  return { h, cond: CONDS.find((k) => overMedian(h, k) && h.c[k].err - medianOf(h, k) < 0.0005) };
}

// A hospital with nothing measured to simulate has no what-if; one with no estimate shows a dash for dollars.
export const noEstimateSample = () => must(HOSPITALS.find((h) => h.pen == null && CONDS.some((k) => isMeasured(h.c[k]))), 'measured hospital with no estimate');

// Two ordinary hospitals for Worksheet R to swap to: the first with a cut and an estimate, the first with no cut, neither
// the hospital the page opens on (the caller drops that one by CCN).
export const swapSamples = (exceptId) => [
  must(HOSPITALS.find((h) => h.id !== exceptId && h.paf < 1 && h.pen != null), 'hospital to swap to with a cut'),
  must(HOSPITALS.find((h) => h.id !== exceptId && h.paf >= 1), 'hospital to swap to with no cut'),
];

// A hospital in an area of more than two pages (the area table pages by PAGE_SIZE) that ranks past the first page, with its rank and
// the area's size. The smallest such area (fewest pages), the hospital ranked first past page 1.
export function neighborsSample() {
  const areas = new Map();
  for (const h of HOSPITALS) areas.set(areaKeyOf(h), [...(areas.get(areaKeyOf(h)) ?? []), h]);
  const [, list] = must([...areas].filter(([, l]) => l.length > 2 * PAGE_SIZE).sort((a, b) => a[1].length - b[1].length)[0], 'area of more than two pages');
  const row = sizedRows(list, META)[PAGE_SIZE];
  return { h: row.h, rank: row.rank, n: list.length };
}

const PLACES = buildPlaces(HOSPITALS, META).list;
const placeSample = (what, test) => {
  const place = must(PLACES.find(test), what);
  return { ...place, url: placePath(place.kind, place.key) };
};
// A state with several pages of hospitals (and so a rows asset), a metro across states, a metro that fits one page, a region.
export const bigState = () => placeSample('state of more than two pages of hospitals', (p) => p.kind === 'state' && p.hospitals.length > 2 * PAGE_SIZE);
export const multiStateMetro = () => placeSample('metro across states with more than a page of hospitals', (p) => p.kind === 'metro' && p.states.length > 1 && p.hospitals.length > PAGE_SIZE);
export const smallMetro = () => placeSample('metro with fewer hospitals than a page', (p) => p.kind === 'metro' && p.hospitals.length > 1 && p.hospitals.length <= PAGE_SIZE);
export const statesCount = () => PLACES.filter((p) => p.kind === 'state').length;

// The page's what-if data, as the page embeds it for its script (whatif-data.js WHATIF_DATA_ID).
export const embeddedWhatIf = (page) => page.evaluate(() => JSON.parse(document.getElementById('hrrp-hospital').textContent));

// Makes navigator.clipboard.writeText keep what it is given in window.__clip, in any engine (no permission to grant or read back).
export const stubClipboard = (context) => context.addInitScript(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__clip = text; } } });
});

export const intOf = (text) => Number(text.replace(/[^\d]/g, ''));
