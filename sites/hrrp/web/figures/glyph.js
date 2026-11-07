// The six-condition glyph a hospital row ends with (the largest-penalties table, the hospital page's area table, the place page's
// hospitals table): the kit's miniCards, six boxes in program order. Its own file so the place page's script can draw rows too, so it
// keeps its few words (the boxes' tooltips and the spoken list the area and place tables share) here rather than import a whole
// page's copy table into the script.
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { miniCards } from '../../../../web/charts/miniCards.js';
import { copyOf } from '../../../../web/render/components.js';
import { listText } from '../../../../web/render/format.js';
import { conditionShort } from '../derive.js';

const COPY = {
  tipCounted: { text: '{c}: adds to the cut', claim: null },
  tipBelow: { text: '{c}: measured, adds nothing', claim: null },
  tipNone: { text: '{c}: too few cases to be measured', claim: null },
  condsSpoken: { text: 'Counted toward the cut: {list}', claim: null },
  condsNone: { text: 'No condition counted', claim: null },
};
const { fill, t } = copyOf(COPY);

// The glyph's drawing width in units: six boxes and their padding.
const GLYPH_WIDTH = 96;
// A condition's state in the glyph: counted fills the box, below hatches it, few and none leave it empty.
const CELL = { counted: 'm', below: 'a', few: '', none: '' };
const TIP = { counted: 'tipCounted', below: 'tipBelow', few: 'tipNone', none: 'tipNone' };

// A condition's state in an asset row's conds string, one letter each (the program explorer's and the place rows' assets).
export const STATE_LETTER = Object.freeze({ counted: 'c', below: 'b', few: 'f', none: 'n' });
export const STATE_OF = Object.freeze(Object.fromEntries(Object.entries(STATE_LETTER).map(([state, letter]) => [letter, state])));

// One row's glyph: the six boxes in program order, a tooltip on the card naming each condition's state.
export function glyph(row, rank, conditions, prefix = 'pen') {
  const tip = CONDS.map((k, i) => fill(TIP[row.states[i]], { c: conditionShort(conditions, k) })).join('; ');
  return miniCards({ id: `${prefix}-${rank}`, width: GLYPH_WIDTH, cols: 1, cards: [{ cells: row.states.map((s) => CELL[s]), yes: row.h.red > 0, tip }] });
}

export const countedNames = (row, conditions) => CONDS.filter((_, i) => row.states[i] === 'counted').map((k) => conditionShort(conditions, k));

// The counted conditions in words, for a screen reader beside the glyph.
export function glyphSpoken(row, conditions) {
  const names = countedNames(row, conditions);
  return names.length ? fill('condsSpoken', { list: listText(names) }) : t('condsNone');
}
