// The family search's own index (hub/client/search.js loads it): every hospital on Medicare's list, the dollar file's
// and those outside the penalty programs, as one row of values in a fixed column order, small enough for every hub
// page's search box to fetch on first focus. Pure: hospitals in, a plain object out. The hub's asset (hub/asset.js)
// stays the dollar file's alone: the shell and the story read it, and an outside hospital has no program page for
// them to link.
import { US_STATES } from '../../engine/js/states.js';
import { SEARCH_COLS, SEARCH_KINDS, decodeSearchAsset } from '../client/search.js';
import { shownName } from '../hospital/record.js';
import { countedOnMap } from '../model.js';

// The asset: { cols, rows, states }. hospitals: hubHospitals (the dollar file's, whose kind is the master's record's);
// outside: hubModel's outside hospitals (each with the master's kind); master: the hospital master by CCN
// (pipeline/master.js masterByCcn). A row is [ccn, name, city, state, kind]: name the one the hospital's page shows
// (record.js shownName: "Hospital <CCN>" for one no CMS file names), city text or null, kind the master's, `acute`
// included. states counts each of the fifty states' and DC's hospitals the map counts (countedOnMap over the dollar
// file's: the number its line on the map says), as the search did before it had an index of its own; a state with none
// is left out. A hospital twice, a dollar-file hospital the master lacks, or a kind the search has no word for stops the
// build, and so does a row the browser's decoder would refuse.
export function searchAsset({ hospitals, outside, master }) {
  const kindOf = (ccn) => {
    const record = master.get(ccn);
    if (!record) throw new RangeError(`search: ${ccn} is in the dollar file but not the hospital master`);
    return record.kind;
  };
  const all = [...hospitals.map((h) => ({ ...h, kind: kindOf(h.ccn) })), ...outside];
  const seen = new Set();
  const rows = all.map((h) => {
    if (seen.has(h.ccn)) throw new RangeError(`search: ${h.ccn} is listed twice`);
    seen.add(h.ccn);
    if (!SEARCH_KINDS.includes(h.kind)) throw new RangeError(`search: ${h.ccn} is of kind ${JSON.stringify(h.kind)}, which the search has no word for`);
    const values = { ccn: h.ccn, name: shownName(h), city: h.city ?? null, state: h.state, kind: h.kind };
    return SEARCH_COLS.map((col) => values[col]);
  });
  const counted = new Map();
  for (const h of hospitals) if (countedOnMap(h)) counted.set(h.state, (counted.get(h.state) ?? 0) + 1);
  const states = Object.fromEntries(US_STATES.filter(([code]) => counted.has(code)).map(([code]) => [code, counted.get(code)]));
  const asset = { cols: [...SEARCH_COLS], rows, states };
  decodeSearchAsset(asset);
  return asset;
}
