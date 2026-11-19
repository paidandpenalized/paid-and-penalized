// The TEAM words the calculator (sites/team/web/calc-view.js) and the hub's TEAM section on a participant's page
// (hub/hospital/team.js) both print: the note on a hospital Medicare's hospital list marks for Track 2. One sentence,
// said the same in both. For hospital staff: plain; TEAM is a payment model, never a penalty. No digit characters. A
// sentence that states a fact about the rules carries its claim id in sites/team/CLAIMS.md (shared copy may cite any
// register's rows).
import { copyOf } from '../render/components.js';
import { listText } from '../render/format.js';

export const COPY = {
  noteFlags: {
    text: "Medicare's hospital list marks it {kinds}, so it may be eligible for Track {tb}; safety-net status isn't public.",
    claim: 'TEAM-26',
  },
  noteFlagsMdh: {
    text: "Medicare's hospital list marks it {kinds}, so it may be eligible for Track {tb}; safety-net status isn't public, and the Medicare-dependent route holds only while that program hasn't expired when selections are due.",
    claim: 'TEAM-26',
  },
  flagSCH: { text: 'a sole community hospital', claim: null },
  flagMDH: { text: 'a Medicare-dependent hospital', claim: null },
  flagEACH: { text: 'an essential access community hospital', claim: null },
  flagRural: { text: 'rural', claim: null },
};

const { fill, t } = copyOf(COPY);

// The note for a hospital's public Track 2 flags (hospOf's flags: 'SCH', 'MDH', 'EACH', 'rural'), rural first; tb: the
// Track 2 number, as text. '' for none.
export function flagsNote(flags, tb) {
  if (!flags.length) return '';
  const words = [...flags].sort((a, b) => (a === 'rural' ? -1 : b === 'rural' ? 1 : 0)).map((f) => t(`flag${f === 'rural' ? 'Rural' : f}`));
  return fill(flags.includes('MDH') ? 'noteFlagsMdh' : 'noteFlags', { kinds: listText(words), tb });
}
