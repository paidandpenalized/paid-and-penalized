// The calculator's words that the page's script draws (Part 5), and the payoff figure's and the categories' words it
// shares with Part 3 and Part 4: a copy file of its own, so the page's script carries these and no other page words. The
// calculator's words only the build writes (its frame, the quality note, "How each line works", the band's "why?") are
// copy.js's. For hospital staff: plain; TEAM is
// a payment model, never a penalty; results say "would" and "scenario", never "will". No digit characters: every number
// arrives through a {placeholder}, formatted. A sentence that states a fact about the rules carries its claim id (or ids)
// in sites/team/CLAIMS.md; sentences about this site's own arithmetic or framing carry none.
import { copyOf } from '../../../web/render/components.js';

export const COPY = {
  // The five episode categories (engine/js/team/params.js CATEGORIES), as a sentence names them, and as a row's short name.
  catLEJR: { text: 'lower extremity joint replacement', claim: 'TEAM-21' },
  catSHFFT: { text: 'surgical hip and femur fracture treatment', claim: 'TEAM-21' },
  catSPINAL: { text: 'spinal fusion', claim: 'TEAM-21' },
  catCABG: { text: 'coronary artery bypass graft surgery', claim: 'TEAM-21' },
  catBOWEL: { text: 'major bowel procedure', claim: 'TEAM-21' },
  rowLEJR: { text: 'LEJR', claim: null },
  rowSHFFT: { text: 'SHFFT', claim: null },
  rowSPINAL: { text: 'Spinal fusion', claim: null },
  rowCABG: { text: 'CABG', claim: null },
  rowBOWEL: { text: 'Major bowel', claim: null },

  // The payoff figure (web/charts/payoff.js): Part 3's worked example and the calculator's hospital.
  payoffUnder: { text: '← spending under target', claim: null },
  payoffOver: { text: 'over target →', claim: null },
  payoffOn: { text: 'on target', claim: null },
  payoffStopGain: { text: 'stop-gain {pct} · {amount}', claim: 'TEAM-14' },
  payoffStopLoss: { text: 'stop-loss {pct} · {amount}', claim: 'TEAM-14' },
  payoffBand: { text: '{band} band', claim: null },
  payoffTip: { text: '{s}: {amount}', claim: null },

  // The frame: the worksheet's title bar, the hospital, the picker and the button beside it.
  calcWhere: { text: 'CCN {ccn} · {place}', claim: null },
  calcWhereNone: { text: 'CCN {ccn}', claim: null },
  calcNameNone: { text: 'Hospital {ccn}', claim: null },
  calcPickKind: { text: 'TEAM', claim: null },
  calcPickCount: { text: '{n} TEAM hospitals match.', claim: null },
  calcPickCountOne: { text: 'One TEAM hospital matches.', claim: null },
  calcPickEmpty: { text: 'No TEAM hospital matches.', claim: null },
  calcFailed: { text: "The list of TEAM hospitals didn't load. Try again.", claim: null },
  calcRejected: { text: 'Parts of the link this page doesn\'t use were left out: {keys}.', claim: null },
  calcDropped: { text: "The link names a hospital the calculator doesn't have, so its numbers were left out.", claim: null },
  calcLoaded: { text: 'The calculator now shows {name}.', claim: null },

  // The track control and the note under it (a hospital's public Track 2 flags are web/team/copy.js's note, which the
  // hub's TEAM section prints too).
  trackLegend: { text: 'The track for this scenario', claim: null },
  trackName: { text: 'Track {n}', claim: null },
  trackUp: { text: 'upside only', claim: null },
  trackBoth: { text: '±{pct}', claim: null },
  noteTrack1: { text: 'Track {ta} is open only to safety-net hospitals, and only through {year}: a scenario, not advice.', claim: 'TEAM-25' },
  noteTrack2: {
    text: "Track {tb} is open to rural, safety-net, sole community and essential access community hospitals, and to Medicare-dependent hospitals while that program lasts; nothing public marks this one, and safety-net status isn't public.",
    claim: 'TEAM-26',
  },

  // The episode table: its heads, each row's notes, the source under each box and the boxes' names.
  colEpisode: { text: 'Episode', claim: null },
  colYear: { text: 'A year', claim: null },
  colPrice: { text: 'Avg. target', claim: null },
  colSpend: { text: 'Spending', claim: null },
  colLv: { text: '<{lv}', claim: null },
  colLvFull: { text: 'Fewer than {lv} episodes in the baseline years: the type can\'t add to a repayment', claim: 'TEAM-16' },
  colTarget: { text: 'Target', claim: null },
  // A phone's labels for a row's low-volume box and its two results, where the table's head is hidden.
  colLvPhone: { text: 'Fewer than {lv} baseline episodes', claim: 'TEAM-16' },
  colResultPhone: { text: 'Before quality', claim: null },
  hiddenCells: { text: '{n} hidden cells', claim: null },
  hiddenCellsOne: { text: 'one hidden cell', claim: null },
  inpatientOnly: { text: 'inpatient only', claim: null },
  srcEpisodes: { text: 'Medicare {year}', claim: null },
  srcPrice: { text: 'CMS {year} regional', claim: null },
  srcPriceMean: { text: "This site's mean", claim: null },
  srcAllFive: { text: 'All five', claim: null },
  srcThisRow: { text: 'This row', claim: null },
  srcMine: { text: 'your number', claim: null },
  srcCare: { text: 'Care Compare', claim: null },
  srcNotPublic: { text: 'Not public: {n}', claim: 'TEAM-17' },
  srcNoValue: { text: 'No public value: {n}', claim: 'TEAM-17' },
  lblEpisodes: { text: '{cat}: episodes a year', claim: null },
  lblPrice: { text: '{cat}: average target price', claim: null },
  lblSpend: { text: '{cat}: spending against target, in percent', claim: null },
  lblLv: { text: '{cat}: fewer than {lv} episodes in the baseline years', claim: 'TEAM-16' },

  // The ledger, lines one to eight.
  ledgerCalc: { text: 'The reconciliation, line by line', claim: null },
  l1: { text: 'Target amount', claim: null },
  l2: { text: 'Spending vs target, all five', claim: null },
  l2Value: { text: '{pct} {side}', claim: null },
  l2Over: { text: 'over target', claim: null },
  l2Under: { text: 'under target', claim: null },
  l2On: { text: 'on target', claim: null },
  l3: { text: 'Before quality', claim: null },
  l4: { text: 'Quality score', claim: null },
  l4Open: { text: 'by measure', claim: null },
  l5: { text: 'Quality adjustment', claim: null },
  l6: { text: 'Track {n} limits', claim: null },
  l7: { text: 'Post-episode adjustment', claim: null },
  l7Tag: { text: 'Not public', claim: null },
  l8: { text: 'Reconciliation, this scenario', claim: null },
  atLimit: { text: 'At the limit', claim: null },
  limitsBoth: { text: '{loss} / {gain}', claim: null },
  limitsUp: { text: '{gain}, no repayment', claim: 'TEAM-28' },
  ledgerCalcFoot: { text: 'A scenario, in standardized dollars.', claim: null },

  // Quality by measure (collapsed).
  qSummary: { text: 'Quality score {cqs}: the {n} measures for {year}', claim: 'TEAM-18' },
  qColMeasure: { text: 'Measure', claim: null },
  qColValue: { text: 'Public value', claim: null },
  qColPct: { text: 'Percentile', claim: null },
  qColWeight: { text: 'Weight', claim: null },
  q_hybrid_hwr: { text: 'Hybrid hospital-wide readmission', claim: 'TEAM-18' },
  q_iscmr: { text: 'Failure to rescue', claim: 'TEAM-18' },
  q_falls: { text: 'Falls with injury', claim: 'TEAM-18' },
  q_prf: { text: 'Postoperative respiratory failure', claim: 'TEAM-18' },
  q_thatka_prom: { text: 'Hip and knee replacement PRO-PM', claim: 'TEAM-18' },
  qInpatient: { text: 'every episode type', claim: 'TEAM-18' },
  qLejr: { text: 'joint replacement episodes only', claim: 'TEAM-18' },
  lblPct: { text: '{measure}: percentile, {lo} to {hi}', claim: null },

  // How each line works (collapsed).

  // The result box (the stamp on a phone) and the band.
  outBand: { text: 'Within {band} of target', claim: null },
  tagPublic: { text: 'Scenario · public data', claim: null },
  tagMine: { text: 'includes your numbers', claim: null },
  outRange: { text: '{lo} to {hi}', claim: null },
  outYear: { text: 'a year', claim: null },
  outAt: { text: 'This scenario would come to {result} · Track {n} limits {limits}', claim: null },
  outHyp: { text: "Hypothetical, in standardized dollars, before CMS's risk adjustment.", claim: 'TEAM-59' },
  outNone: { text: 'No public episodes for this hospital: enter its counts from its CMS reports and the result follows.', claim: null },
  bandLabel: { text: 'Band ±', claim: null },
  bandFull: { text: 'Band: how far spending lands from target either way, in percent', claim: null },

  // Figure: the hospital's year at any spending level.
  figAlt: {
    text: "Line chart: what this hospital's year would come to at each spending level from {lo} under target to {hi} over, the same on all five episode types, flat where Track {n}'s limits hold it. Standardized dollars.",
    claim: null,
  },
  figNote: { text: 'The same spending on all five; shaded, the band. A scenario, in standardized dollars.', claim: null },

  // What would it take?
  wwHeading: { text: 'What would it take?', claim: null },
  wwTag: { text: 'Same % on all five · quality {cqs}', claim: null },
  wwEarn: { text: 'Earn', claim: null },
  wwOwe: { text: 'Owe no more than', claim: null },
  wwEarnFull: { text: 'Amount to earn, in dollars', claim: null },
  wwOweFull: { text: 'Most to repay, in dollars', claim: null },
  wwGain: { text: 'Reach the stop-gain', claim: null },
  wwLoss: { text: 'Reach the stop-loss', claim: null },
  wwPct: { text: 'Each {one} of spending', claim: null },
  wwQuality: { text: '{n} more quality points', claim: null },
  wwQualityTop: { text: 'Quality score to {top}', claim: null },
  wwUnder: { text: 'Spend {pct} under target, about {per} less per episode', claim: null },
  wwOver: { text: 'Stay within {pct} over target, about {per} more per episode', claim: null },
  wwNoGain: { text: 'Not possible: Track {n} stops gains at {amount}', claim: 'TEAM-14' },
  wwAnyStop: { text: 'Any spending: the Track {n} stop-loss holds a repayment to {amount}', claim: 'TEAM-14' },
  wwAnyLow: { text: "Any spending: its low-volume episode types can't add to a repayment, so it would owe at most {amount}", claim: 'TEAM-16' },
  wwNever: { text: 'Track {n} never owes a repayment', claim: 'TEAM-28' },
  wwGainAt: { text: 'Spend {pct} under target ({amount})', claim: null },
  wwLossAt: { text: 'Spend {pct} over target ({amount})', claim: null },
  wwLossNot: { text: "Not possible: its low-volume episode types can't add to a repayment, so it would owe at most {amount}", claim: 'TEAM-16' },
  wwPctValue: { text: '{under} under target · {over} over', claim: null },
  wwQHere: { text: '{amount} in this scenario', claim: null },
  wwQOver: { text: '{amount} if spending lands {pct} over', claim: null },
  wwQUnder: { text: '{amount} if spending lands {pct} under', claim: null },
  wwQCapped: { text: '{amount}: the result is held at the Track {n} limit', claim: 'TEAM-14' },
  wwQNoRepay: { text: '{amount}: Track {n} has no repayment for quality to shrink', claim: 'TEAM-28' },
  wwQLowVolume: { text: "{amount}: its low-volume episode types can't add to a repayment, so there is none for quality to shrink", claim: 'TEAM-16' },
  wwQOnTarget: { text: '{amount}: on target there is no gain or repayment for quality to move', claim: null },
  wwQTop: { text: '{amount}: the score is already at the top', claim: null },
  wwNeed: { text: "Needs episodes: enter the hospital's counts", claim: null },

  // Share and privacy.
  copyLink: { text: 'Copy a link', claim: null },
  includeMine: { text: 'include my numbers', claim: null },
  copied: { text: 'Link copied.', claim: null },
  copyFailed: { text: "Your browser didn't allow copying; the link is selected to copy by hand.", claim: null },
  private: { text: 'Runs in your browser; nothing is sent.', claim: null },
  // "Copy for a slide": plain text, one fact a line (calc-view.js slideOf), its button and what it says.
  copySlide: { text: 'Copy for a slide', claim: null },
  slideCopied: { text: 'Text for a slide copied.', claim: null },
  slideFailed: { text: "Your browser didn't allow copying; the text is selected to copy by hand.", claim: null },
  slideHosp: { text: '{name} · {where}', claim: null },
  slideTrack: { text: 'TEAM, {year} · {track} · limits {limits}', claim: null },
  slideRange: { text: '{band}: {range} a year', claim: null },
  slideResult: { text: 'This scenario, spending {spend}, would come to {result}', claim: null },
  slideRows: { text: 'set by episode type', claim: null },
  slideHyp: { text: 'Hypothetical · standardized dollars', claim: null },
  slideHypMine: { text: '{hyp} · {mine}', claim: null },
  slideSource: {
    text: "Sources: CMS's TEAM participant list, as of {list}; CMS's TEAM preliminary regional target prices, {prices}; Medicare inpatient discharges, {from} and {to}; Care Compare quality measures, {quality}; this site's arithmetic.",
    claim: null,
  },

  // The polite line a screen reader hears once the reader pauses, and the line when a box can't take what was typed.
  say: {
    text: 'Scenario: within {band} of target, {lo} to {hi} a year; this scenario would come to {result}. Standardized dollars.',
    claim: null,
  },
  sayNone: { text: 'No public episodes for this hospital: enter its counts and the result follows.', claim: null },
  kept: { text: 'That isn\'t a number from {lo} to {hi}, so it stays {value}.', claim: null },
};

export const { fill, t } = copyOf(COPY);
