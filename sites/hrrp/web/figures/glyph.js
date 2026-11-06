// The six-condition glyph a hospital row ends with (the largest-penalties table, the hospital page's area table, the place page's
// hospitals table): the kit's miniCards, six boxes in program order. Its own file so the place page's script can draw rows too.
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { miniCards } from '../../../../web/charts/miniCards.js';
import { conditionShort } from '../derive.js';
import { fill } from '../program/copy.js';

// The glyph's drawing width in units: six boxes and their padding.
const GLYPH_WIDTH = 96;
// A condition's state in the glyph: counted fills the box, below hatches it, few and none leave it empty.
const CELL = { counted: 'm', below: 'a', few: '', none: '' };
const TIP = { counted: 'penTipCounted', below: 'penTipBelow', few: 'penTipNone', none: 'penTipNone' };

// One row's glyph: the six boxes in program order, a tooltip on the card naming each condition's state.
export function glyph(row, rank, conditions, prefix = 'pen') {
  const tip = CONDS.map((k, i) => fill(TIP[row.states[i]], { c: conditionShort(conditions, k) })).join('; ');
  return miniCards({ id: `${prefix}-${rank}`, width: GLYPH_WIDTH, cols: 1, cards: [{ cells: row.states.map((s) => CELL[s]), yes: row.h.red > 0, tip }] });
}

export const countedNames = (row, conditions) => CONDS.filter((_, i) => row.states[i] === 'counted').map((k) => conditionShort(conditions, k));
