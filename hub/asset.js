// The browser asset: every hospital as one array of values in a fixed column order, with its place on the US map. The
// home story and the hospital pages fetch it as one file (written with ctx.asset) and decode it with
// web/client/hub-asset.js. Pure: hospitals in, a plain object out.
import { derivedDollars } from '../engine/js/dollars/whatif.js';
import { pointOf, usMapHeight, usProjected } from '../web/charts/geo.js';
import { HUB_COLS, STATUS_CODES } from '../web/client/hub-asset.js';

// The map's width in the asset's x and y; its height follows (the US map's own aspect).
export const MAP_WIDTH = 975;

// The asset: { fy, mapW, mapH, cols, rows }, one row per hospital in the order given, values in `cols` order. Status is
// 'e', 'm' or 'n'; flags are 0 or 1; a number the hospital does not have is null (a hospital without an estimate has no
// dollars, factors or flags; one without a location, no x and y). x and y are the hospital on the US map at MAP_WIDTH,
// to a tenth. `after` and `atStake` are left out because they follow from the rest; a row where they do not, or where
// `hac` and `net` do not follow from the cut flag and the other dollars, stops the build, since the browser could not
// derive them or trust the ones it is given.
export function hubAsset(hospitals, { shapes, fy }) {
  const places = usProjected(shapes, hospitals.map(pointOf), MAP_WIDTH);
  const rows = hospitals.map((h, i) => {
    const e = h.est;
    if (e) {
      const { after, atStake } = derivedDollars(e);
      if (e.after !== after || e.atStake !== atStake) {
        throw new RangeError(`hub: ${h.ccn}: the pay after Readmissions and value-based purchasing, or the dollars at stake, do not follow from the other dollars`);
      }
      // The browser carries hac and net as they are, so they must already be what the row's rule makes them: minus the
      // dollars at stake for a hospital with the cut, a plain zero for one without, and the three programs added.
      if (e.hac !== (e.cut ? -atStake : 0) || e.net !== e.hrrp + e.hvbp + e.hac) {
        throw new RangeError(`hub: ${h.ccn}: the HAC dollars do not follow from the cut flag and the dollars at stake, or the net is not the three programs added`);
      }
    }
    const [x, y] = places[i] ?? [null, null];
    const values = {
      ccn: h.ccn, name: h.name, city: h.city, state: h.state, status: STATUS_CODES[h.status], band: h.band, teach: h.teach, x, y,
      base: e ? e.base : null, total: e ? e.total : null, hrrp: e ? e.hrrp : null, hvbp: e ? e.hvbp : null, hac: e ? e.hac : null,
      net: e ? e.net : null, hrrpF: e ? e.hrrpFactor : null, vbpF: e ? e.vbpFactor : null, cut: e ? Number(e.cut) : null,
      hrrpL: e ? Number(e.hrrpListed) : null, vbpL: e ? Number(e.vbpListed) : null, tdr: Number(h.inTdr),
    };
    return HUB_COLS.map((col) => values[col]);
  });
  return { fy, mapW: MAP_WIDTH, mapH: usMapHeight(MAP_WIDTH), cols: [...HUB_COLS], rows };
}
