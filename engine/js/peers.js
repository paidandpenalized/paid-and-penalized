// Peer groups shared by the family: the size bands, the key a hospital has in each way of grouping, and the median a
// group's marker sits at. Pure. A hospital with no value for an attribute has no key in that mode, and so no group.
import { median as medianOf } from './stats.js';

// The size groups' bed-count edges: under the first, between each pair, the last and up.
export const BED_BAND_EDGES = Object.freeze([100, 300, 500]);

// A bed count's band: the index of the first edge above it (0 under the first edge), or null with no count.
export const bedBand = (beds) => (Number.isInteger(beds) ? BED_BAND_EDGES.filter((edge) => beds >= edge).length : null);

// The ways to group hospitals: by state, by size (bed band), by teaching status.
export const PEER_MODES = Object.freeze(['state', 'size', 'teach']);

const TEACHING = Object.freeze(['major', 'minor', 'none']);

// The group a hospital `h` (`{ state, beds, teach }`) is in under `mode`, or null when it lacks the attribute.
export function peerKey(h, mode) {
  switch (mode) {
    case 'state':
      return typeof h.state === 'string' && h.state !== '' ? h.state : null;
    case 'size': {
      const band = bedBand(h.beds);
      return band === null ? null : `b${band}`;
    }
    case 'teach':
      return TEACHING.includes(h.teach) ? h.teach : null;
    default:
      throw new RangeError(`unknown peer mode "${mode}"`);
  }
}

// The median of a list of numbers (the mean of the middle two when there is an even count), or null for none.
export const median = (values) => (values.length ? medianOf(values) : null);
