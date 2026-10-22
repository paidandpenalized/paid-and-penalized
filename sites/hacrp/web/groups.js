// The names of the groups of hospitals the pages compare (compare.js on a hospital page; program-data.js on the
// program page): the nation, a region, a state, a metro area, and the kinds of hospital by teaching, size, ownership,
// location and special status. One place, so a group reads the same wherever it appears.
import { STATE_NAMES } from '../../../web/charts/geo.js';
import { count } from '../../../web/render/format.js';
import { BED_BANDS } from './constants.js';
import { fill, t } from './program/copy.js';

// A bed band's name: under the first edge, between two edges, or the last edge and up (band: 0 to BED_BANDS.length).
export function bedLabel(band) {
  if (band === 0) return fill('groupBedsUnder', { beds: count(BED_BANDS[0]) });
  if (band === BED_BANDS.length) return fill('groupBedsUp', { beds: count(BED_BANDS[BED_BANDS.length - 1]) });
  return fill('groupBedsRange', { low: count(BED_BANDS[band - 1]), high: count(BED_BANDS[band] - 1) });
}

// kind and key as compare.js and program-data.js name a group (a bed band's key may be its number or its text);
// metro: the metro area's name, for a metro group.
export function groupLabel(kind, key, { metro = null } = {}) {
  switch (kind) {
    case 'nation': return t('groupNation');
    case 'region': return fill('groupRegion', { region: key });
    case 'state': return fill('groupState', { state: STATE_NAMES[key] ?? key });
    case 'metro': return fill('groupMetro', { metro: metro ?? key });
    case 'teach': return t(`groupTeach${key}`);
    case 'beds': return bedLabel(Number(key));
    case 'own': return t(`groupOwn${key}`);
    case 'urban': return t(`groupUrban${key}`);
    case 'status': return t(`groupStatus${key}`);
    default: throw new RangeError(`groupLabel: unknown kind ${kind}`);
  }
}

// A kind's name, over its groups' buttons and in the share figure.
const KIND_WORDS = { teach: 'kindTeach', beds: 'kindBeds', own: 'kindOwn', urban: 'kindUrban', status: 'kindStatus', region: 'kindRegion' };
export const kindLabel = (kind) => t(KIND_WORDS[kind]);
