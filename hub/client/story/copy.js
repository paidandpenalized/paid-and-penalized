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
  netCut: '{n} net cut',
  netBonus: '{n} net bonus',

  // The map's key.
  mapCut: 'net cut',
  mapBonus: 'net bonus',

  // The last step: the hospital's group ({group}: its name) and everyone, and the group's median.
  groupOf: '{group}: {n} hospitals',
  everyone: 'All {n} hospitals',
  median: 'median {value}',
});
