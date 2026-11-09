// The words the home story's canvas paints (stage.js): the programs' gates, the share axis, the piles' counts and the
// last step's groups. No digit characters: every number arrives through a {placeholder} from the data (the programs'
// rules from web/programs.js), formatted as the page formats it (web/client/format.js). The peer groups' names are the
// hospital page's own (hub/hospital/group-copy.js), so a group reads the same on both.
import { GROUPS } from '../../hospital/group-copy.js';

export const COPY = Object.freeze({
  // The gates, by program: the name (and a phone's shorter one), the rule while it waits, and what it moved once passed
  // ({amount}: the estimated dollars).
  gateHrrp: 'Readmissions (HRRP)',
  gateHrrpShort: 'Readmissions',
  // The cap is a share of base payments, not of the inpatient pay the axis measures, so the rule says so.
  ruleHrrp: { text: 'cut, up to {cap} of base', claim: ['HRRP-09', 'HRRP-06'] },
  ruleHrrpShort: { text: 'cut, up to {cap} of base', claim: ['HRRP-09', 'HRRP-06'] },
  gateHac: 'Hospital-acquired conditions (HACRP)',
  gateHacShort: 'Hospital-acquired cond.',
  // "Highest scores", as step 3 says it (a higher HAC score is worse; never "top", which reads as the best hospitals). Short
  // enough that the gate's name and rule fit side by side on the narrowest wide stage (520px).
  ruleHac: { text: 'highest scores: flat {cut} cut', claim: ['HACRP-01', 'HACRP-02'] },
  ruleHacShort: { text: 'flat {cut} cut', claim: 'HACRP-01' },
  gateVbp: 'Value-based purchasing (HVBP)',
  gateVbpShort: 'Value-based purchasing',
  ruleVbp: { text: 'budget-neutral: bonus or cut', claim: ['HUB-02', 'HACRP-87'] },
  ruleVbpShort: { text: 'bonus or cut', claim: 'HACRP-87' },
  pastCut: '{amount} est.',
  pastMoved: '{amount} moved, est.',

  // The share axis: its words, and the two sides.
  axis: 'Estimated change, % of FY{fy} Medicare inpatient pay',
  axisCut: '← cut',
  axisBonus: 'bonus →',

  // The piles' counts ({n}), at {zero}.
  startN: '{n} hospitals',
  startZero: 'all at {zero}',
  startOne: '{n} hospitals, all at {zero}',
  atZero: '{n} at {zero}',
  // At Readmissions' gate, the hospitals the program does not list ({n}): beside the $0 pile, and in the key.
  outHrrp: '{n} not in HRRP',
  keyOutHrrp: 'not in HRRP',
  hacOnly: { text: '{n} with only the {cut} HAC cut', claim: 'HACRP-01' },
  // What each ink means after a gate.
  keyCut: 'cut',
  keyNone: 'no change',
  keyBonus: 'bonus',
  netCut: '{n} net cut',
  netBonus: '{n} net bonus',

  // The map's key.
  mapCut: 'net cut',
  mapBonus: 'net bonus',

  // The last step: the hospital's group ({n} {group}: counted and named, "Ohio hospitals") and everyone, and the group's
  // median.
  groupOf: '{n} {group}',
  everyone: 'All {n} hospitals',
  median: 'median {value}',

  // The last step's card (find.js cardModel; the server's example card and the found hospital's): the hospital's place
  // ({place}: "City, ST"), its bed count ({beds}) and its teaching status ({teaching}), its net, the three programs, its
  // peers ({n} {group}: the group counted and named; picking size names the size group there).
  cardPlace: '{place}. {beds} beds, {teaching}.',
  cardPlaceNoBeds: '{place}. {teaching}.',
  teachMajor: 'major teaching',
  teachMinor: 'minor teaching',
  teachNone: 'non-teaching',
  teachUnknown: 'teaching status not reported',
  cardNetCut: 'Estimated FY{fy} net cut, share of Medicare inpatient pay',
  cardNetBonus: 'Estimated FY{fy} net bonus, share of Medicare inpatient pay',
  cardNetZero: 'Estimated FY{fy} net: no change',
  programHrrp: 'Readmissions',
  programHac: 'Hospital-acquired conditions',
  programVbp: 'Value-based purchasing',
  wordCut: 'cut',
  wordBonus: 'bonus',
  wordNone: 'no change',
  notInProgram: 'Not in this program',
  cardPeers: 'Of {n} {group}, {cutN} take a net cut; the median is {median}.',
  // The groups the peer toggle picks (hub/hospital/peers.js groupName), in the hospital page's words.
  ...GROUPS,
});
