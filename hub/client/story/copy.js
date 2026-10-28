// The words the home story's canvas paints (stage.js): the programs' gates, the share axis, the piles' counts and the
// last step's groups. No digit characters: every number arrives through a {placeholder} from the data (the programs'
// rules from web/programs.js), formatted as the page formats it (web/client/format.js).

export const COPY = Object.freeze({
  // The gates, by program: the name (and a phone's shorter one), the rule while it waits, and what it moved once passed
  // ({amount}: the estimated dollars).
  gateHrrp: 'Readmissions (HRRP)',
  gateHrrpShort: 'Readmissions',
  ruleHrrp: 'cut, up to {cap}',
  ruleHrrpShort: 'cut, up to {cap}',
  gateHac: 'Hospital-acquired conditions (HACRP)',
  gateHacShort: 'Hospital-acquired cond.',
  ruleHac: 'top-scoring quarter: flat {cut} cut',
  ruleHacShort: 'flat {cut} cut',
  gateVbp: 'Value-based purchasing (HVBP)',
  gateVbpShort: 'Value-based purchasing',
  ruleVbp: 'budget-neutral: bonus or cut',
  ruleVbpShort: 'bonus or cut',
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
  hacOnly: '{n} with only the {cut} HAC cut',
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
  // ({place}: "City, ST") and size ({size}: its size band's words; {teaching}: its teaching status), its net, the three
  // programs, its peers ({n} {group}: the group counted and named).
  cardPlace: '{place}. {size}, {teaching}.',
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
  // The groups the peer toggle picks ({state}: a state's name; {size}: a size band's words), and a size band in words
  // from its bed-count edges ({lo}, {hi}: the band's first and last bed counts).
  groupState: '{state} hospitals',
  groupSize: 'hospitals with {size}',
  groupTeachMajor: 'major teaching hospitals',
  groupTeachMinor: 'minor teaching hospitals',
  groupTeachNone: 'non-teaching hospitals',
  sizeUnder: 'under {hi} beds',
  sizeBand: '{lo} to {hi} beds',
  sizeOver: '{lo} or more beds',
});
