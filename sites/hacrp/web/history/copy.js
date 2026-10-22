// The history's words: the program page's Part 4, the place pages' history and the hospital page's record
// (history-figures.js, pages/*.js), built into the pages and never shipped to a browser. Same rules as copy.js: no
// digit characters, every number through a {placeholder}; `claim` names a row of sites/hacrp/CLAIMS.md (null for this
// site's own framing or arithmetic). fill, fillKeep and t read here, then program/copy.js, then copy.js.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as PROGRAM } from '../program/copy.js';
import { COPY as EXPLORE } from '../explore/copy.js';
import { COPY as SHARED } from '../copy.js';

export const COPY = {
  // ---------- Part 4 on the program page ----------
  part4Heading: { text: '{n} years, {k} rounds of cuts', claim: null },
  part4Intro: { text: 'Every year but one since fiscal year {first}, CMS has cut about a quarter of hospitals. Never the same quarter: {share} of hospitals have been cut at least once. And not at random either: a hospital cut one year is cut again the next far more often than chance would have it.', claim: null },
  histSource: { text: 'Source: CMS, HACRP hospital files for fiscal years {first} to {last} (Provider Data Catalog and its archives), and CMS’s cut lists for fiscal years {first} and {second}.', claim: null },
  rollNone: { text: 'No hospital scored or cut', claim: null },
  fyShort: { text: 'FY{fy}', claim: null },

  // The roll call.
  rollHeading: { text: 'Every hospital, every year', claim: null },
  rollText: { text: 'Each sliver is one hospital, each row one fiscal year. Red: CMS cut it that year; gray: it didn’t; blank: no decision that year (not yet open, closed, not scored, or in Maryland).', claim: null },
  rollText2: { text: 'Hospitals are lined up by the first year CMS cut them, so the red steps down and to the right as each year adds hospitals that had never been cut before. The gray block at the right is every hospital never cut at all.', claim: null },
  rollTakeaway: { text: '{ever} of the {hospitals} hospitals with a payment decision since fiscal year {first} have been cut at least once; {never} never have.', claim: null },
  rollEver: { text: 'Ever cut: {n}', claim: null },
  rollNever: { text: 'Never cut: {n}', claim: null },
  rollAlt: { text: 'A grid of every hospital with a payment decision in any year as a thin column, one row per fiscal year, red where CMS cut it; the red forms steps moving right as new hospitals are cut each year.', claim: null },
  rollColFy: { text: 'Fiscal year', claim: null },
  rollColDecided: { text: 'Hospitals with a decision', claim: null },
  rollColCut: { text: 'Cut', claim: null },
  rollColFirst: { text: 'Cut for the first time', claim: null },
  rollColEver: { text: 'Ever cut, by then', claim: null },
  rollPick: { text: 'Pick out a state', claim: null },
  rollHint: { text: 'Point at a sliver to name its hospital; click to open its page.', claim: null },
  rollAll: { text: 'Every state', claim: null },

  // The staircase: cut each year against ever cut.
  everHeading: { text: 'A quarter at a time', claim: null },
  everText: { text: 'The red is each year’s cut: about a quarter of hospitals, by design. The taller column behind it is every hospital cut at least once by that year. One grows; the other doesn’t.', claim: null },
  everTakeaway: { text: 'CMS cut about a quarter of hospitals each year, but by fiscal year {last}, {ever} different hospitals ({share} of all with a decision) had been cut at least once.', claim: null },
  everAlt: { text: 'Columns by fiscal year: the number cut that year in red, and behind it the number ever cut by then, rising each year.', claim: null },
  everCut: { text: 'Cut that year', claim: null },
  everEver: { text: 'Ever cut by then', claim: null },

  // The year map.
  ymapHeading: { text: 'Watch it spread', claim: null },
  ymapText: { text: 'Every hospital with a payment decision in any year, one dot each, where it stands. Pick a year, or press play: red is that year’s cut; pale red, a hospital cut in an earlier year; gray, one not cut so far.', claim: null },
  ymapText2: { text: 'Each year’s red is about the same size. The pale red is not: it spreads year after year until most of the map has been cut at least once.', claim: null },
  ymapTakeaway: { text: 'By fiscal year {last}, {ever} hospitals ({share} of all with a decision) had been cut at least once.', claim: null },
  ymapNow: { text: 'Cut that year', claim: null },
  ymapScar: { text: 'Cut in an earlier year', claim: null },
  ymapClear: { text: 'Not cut so far', claim: null },
  ymapPlay: { text: 'Play', claim: null },
  ymapStop: { text: 'Stop', claim: null },
  ymapYears: { text: 'Fiscal year', claim: null },
  ymapAlt: { text: 'A map of the United States with a dot for every hospital, colored by whether CMS cut it in the newest fiscal year, in an earlier year, or never.', claim: null },
  ymapUnplaced: { text: '{n} hospitals CMS no longer lists have no place on the map; the table counts them.', claim: null },

  // Infections against the cut.
  infHeading: { text: 'Fewer infections, the same quarter cut', claim: null },
  infText: { text: 'The lines are the nation’s infection rates, each calendar year Care Compare published one: every hospital’s infections added up, over the number CDC’s model predicted from national data. Below the dashed line, fewer infections than predicted.', claim: null },
  infText2: { text: 'Most fell, some by half, with a jump in {spike}, the pandemic’s second year. The cut did not shrink with them: the rule takes the quarter of hospitals with the highest scores every year, however much every hospital improves.', claim: null },
  infTakeaway: { text: 'From {first} to {last}, the nation’s {a} rate fell {aPct} and its {b} rate {bPct}; CMS cut about a quarter of hospitals every year all the same.', claim: null },
  infQuarter: { text: 'Share of hospitals CMS cut, each fiscal year', claim: null },
  infRates: { text: 'Infections ÷ predicted, the nation, by calendar year', claim: null },
  infRef: { text: 'as predicted', claim: null },
  infColYear: { text: 'Calendar year', claim: null },
  infAlt: { text: 'Six small line charts of the nation’s infection rate against prediction by calendar year, most falling.', claim: null },
  infNote: { text: 'No point for {gaps}: CMS excused hospitals from reporting infections for the first half of that year, so no full-year file covers it.', claim: null },
  hinfSource: { text: 'Source: CMS Care Compare, healthcare-associated infections by hospital, calendar years {first} to {last} (Provider Data Catalog archives).', claim: null },
  infSource: { text: 'Source: CMS Care Compare, healthcare-associated infections by hospital, calendar years {first} to {last} (Provider Data Catalog archives); CMS HACRP files for the shares cut.', claim: null },
  infCLABSI: { text: 'CLABSI', claim: null },
  infCAUTI: { text: 'CAUTI', claim: null },
  infSsiColon: { text: 'SSI, colon', claim: null },
  infSsiHyst: { text: 'SSI, hysterectomy', claim: null },
  infMRSA: { text: 'MRSA', claim: null },
  infCDI: { text: 'C. diff', claim: null },
  infCLABSIShort: { text: 'central line infection (CLABSI)', claim: null },
  infCAUTIShort: { text: 'catheter urinary infection (CAUTI)', claim: null },
  infSsiColonShort: { text: 'colon surgery infection', claim: null },
  infSsiHystShort: { text: 'hysterectomy infection', claim: null },
  infMRSAShort: { text: 'MRSA', claim: null },
  infCDIShort: { text: 'C. diff', claim: null },

  // How long a cut follows a hospital.
  gapHeading: { text: 'How long a cut follows a hospital', claim: null },
  gapText: { text: 'For every pair of years, how often a hospital cut in the first was cut again in the second (black), against how often one not cut was (gray), by how many years apart they are.', claim: null },
  gapText2: { text: 'One year apart, the gap is widest, but those two years share half their data: each year’s infections count in two program years in a row. Two years apart, with no data in common, a cut still more than doubles the odds. A decade on, it barely matters.', claim: null },
  gapTakeaway: { text: 'A hospital cut one year was cut the next {one} of the time ({oneFresh} for the rest); two years later {two} ({twoFresh}); {far} years later {farAgain} ({farFresh}).', claim: null },
  gapAgain: { text: 'Cut again, after a cut', claim: null },
  gapFresh: { text: 'Cut, after no cut', claim: null },
  gapTipAgain: { text: '{k} years apart: {share} cut again', claim: null },
  gapNote: { text: 'Pairs touching fiscal year {none}, when CMS cut no one, are left out.', claim: null },
  gapAlt: { text: 'Two lines by years apart: the share cut again after a cut, high at one year and falling, and the share cut after no cut, low and rising toward it.', claim: null },
  gapColK: { text: 'Years apart', claim: null },
  gapColPairs: { text: 'Hospital pairs of years', claim: null },

  // Who keeps getting cut.
  kindsHeading: { text: 'Who keeps getting cut', claim: null },
  kindsText: { text: 'Each panel is one kind of hospital: its share cut each year (black) against every hospital’s (gray). The corner counts the years it sat above.', claim: null },
  kindsText2: { text: 'Major teaching and government hospitals sat above the nation every year; for-profit hospitals, below. Rural and small hospitals flipped: spared in the program’s first years, cut more often than the rest since. Kinds are today’s; a hospital’s can change.', claim: null },
  kindsTakeaway: { text: 'Rural hospitals flipped: in fiscal year {first}, CMS cut {a} of them against {na} of all hospitals; in fiscal year {last}, {b} against {nb}.', claim: null },
  kindsAbove: { text: 'above in {k} of {n}', claim: null },
  kindsAlt: { text: 'Small line charts of the share cut each fiscal year for six kinds of hospital, each against the national share.', claim: null },
  typesHNation: { text: 'All hospitals', claim: null },

  // What CMS scores a hospital on.
  covHeading: { text: 'What CMS scores you on', claim: null },
  covText: { text: 'A hospital is scored on the measures it has enough data for. One scored on {short} alone is almost never cut; one with infections but no {short} score is cut about half the time.', claim: null },
  covText2: { text: 'A single infection measure, with its small counts, swings a score far more than six measures averaged; the year’s picture shows the same spread; here it is over every year.', claim: null },
  covTakeaway: { text: 'From fiscal year {first} to {last}, hospitals scored on {short} alone were cut {only} of the time; hospitals with no {short} score, {none}.', claim: null },
  covEvery: { text: 'Every hospital', claim: null },
  covAll: { text: 'Every measure', claim: null },
  covPsiOnly: { text: '{short} only', claim: null },
  covNoPsi: { text: 'Infections only', claim: null },
  covAlt: { text: 'Bars of the share cut by what a hospital was scored on.', claim: null },
  covColGroup: { text: 'Scored on', claim: null },
  covColYears: { text: 'Hospital-years', claim: null },
  covColShare: { text: 'Share cut', claim: null },

  // Chance.
  chanceHeading: { text: 'Stickier than chance', claim: null },
  chanceText: { text: 'Take the hospitals CMS made a decision on every year it cut anyone. If each year’s cut fell on them at random, at that year’s share, most would have been cut a few times and almost none every year: the hollow dots. The solid dots are what happened.', claim: null },
  chanceText2: { text: 'Chance makes a hill; the record makes a valley. More hospitals than chance were never cut, and far more were cut nearly every year. The middle, cut now and then, is thinner than chance.', claim: null },
  chanceTakeaway: { text: 'Of the {hospitals} hospitals with a decision in all {years} years CMS cut anyone, {never} were never cut (chance: about {chanceNever}) and {all} were cut every one of those years (chance: {chanceAll}).', claim: null },
  chanceTip: { text: 'Cut in {k} years: {observed} hospitals; chance: {chance}', claim: null },
  chanceKey: { text: '● What happened   ○ If each year’s cut fell at random. Up the side: hospitals.', claim: null },
  chanceOneIn: { text: 'one in {n}', claim: null },
  chanceAlt: { text: 'For each number of years cut, the hospitals that were cut that many times, beside the number chance alone would give.', claim: null },
  chanceObserved: { text: 'What happened', claim: null },
  chanceChance: { text: 'Chance', claim: null },
  chanceX: { text: 'Years cut', claim: null },
  chanceColK: { text: 'Years cut', claim: null },
  chanceColObs: { text: 'Hospitals', claim: null },
  chanceColChance: { text: 'By chance', claim: null },



  // By state.
  statesHHeading: { text: 'The map, year by year', claim: null },
  statesHText: { text: 'Each small map is one fiscal year, each square a state, shaded by the share of its hospitals CMS cut (key above the maps). Some states keep their shade year after year.', claim: null },
  keyRange: { text: '{from} to {to}', claim: null },
  keyUp: { text: '{from} and up', claim: null },
  keyNone: { text: 'None cut', claim: null },
  keyNoDecision: { text: 'No decision', claim: null },
  keyRing: { text: 'Outlined: {a} and {b}', claim: null },
  statesHTakeaway: { text: 'Among states with at least {few} hospitals every year, {state} was cut above the nation’s share in {k} of the {n} years CMS cut anyone; {low}, below it in {lowK}.', claim: null },
  statesHMapAlt: { text: 'Fiscal year {fy}: each state shaded by the share of its hospitals CMS cut.', claim: null },
  statesHAlt: { text: 'Small state maps, one per fiscal year, each state shaded by the share of its hospitals CMS cut.', claim: null },

  // The rule changes noted on the figures.
  breakZ: { text: 'z-scores', claim: null },
  breakEqual: { text: 'equal weights', claim: null },

  // ---------- the hospital page ----------
  recordHeading: { text: 'Its record, fiscal years {first} to {last}', claim: null },
  recordSummary: { text: 'Cut in {cut} of {decided} years', claim: null },
  recordSummaryNone: { text: 'Never cut in {decided} years', claim: null },
  recordSummaryOne: { text: 'Cut in {cut} of one year', claim: null },
  recordCut: { text: 'Cut', claim: null },
  recordNo: { text: 'No', claim: null },
  recordNone: { text: '—', claim: null },
  recordTip: { text: 'Fiscal year {fy}: {what}', claim: null },
  recordTipCut: { text: 'cut', claim: null },
  recordTipNo: { text: 'not cut', claim: null },
  recordTipNone: { text: 'no decision', claim: null },
  yearsHeading: { text: 'Year by year', claim: null },
  yearsIntro: { text: 'Where this hospital’s score fell among every hospital’s, each year CMS published one. A score near the top is among the highest; the shaded band is where CMS cut. Places compare across years even where CMS changed how it builds the score.', claim: null },
  yearsTakeaway: { text: 'CMS cut this hospital in {cut} of the {decided} years it made a decision.', claim: null },
  yearsTakeawayNone: { text: 'CMS made a decision on this hospital in {decided} years and never cut it.', claim: null },
  yearsAlt: { text: 'Where the hospital’s Total HAC Score fell among all published scores each fiscal year, with the cut zone shaded.', claim: null },
  yearsTop: { text: 'highest', claim: null },
  yearsMid: { text: 'middle', claim: null },
  yearsBottom: { text: 'lowest', claim: null },
  yearsNone: { text: 'no scores', claim: null },
  yearsKey: { text: '● Red: a year CMS cut it   ○ Hollow: a year it didn’t', claim: null },
  yearsTip: { text: 'FY{fy}: score {score}, higher than {share} of scores; {what}', claim: null },
  yearsColFy: { text: 'Fiscal year', claim: null },
  yearsColScore: { text: 'Total HAC Score', claim: null },
  yearsColShare: { text: 'Higher than this share of scores', claim: null },
  yearsColDecision: { text: 'Payment reduction', claim: null },
  yearsRun: { text: 'Its longest run: cut {run} years in a row.', claim: null },

  hinfHeading: { text: 'Its infections, year by year', claim: null },
  hinfIntro: { text: 'This hospital’s infection rate against prediction for each calendar year Care Compare published one, on each measure with at least two years of results (black), over the nation’s middle hospital (gray). Below the dashed line at one, fewer infections than predicted. These are absolute rates, so unlike the score they can all improve at once.', claim: null },
  hinfNation: { text: 'Nation’s middle', claim: null },
  hinfTakeaway: { text: '{down} of its {m} infection measures ended lower than they started, {first} to {last}.', claim: null },
  hinfTip: { text: '{measure}, {cy}: {sir}', claim: null },
  hinfAlt: { text: 'Small line charts of this hospital’s infection rates against prediction by calendar year, each over the nation’s median.', claim: null },
  hinfClip: { text: 'Rates above {max} are drawn at {max}; the table holds them.', claim: null },

  // ---------- the place pages ----------
  placeHistHeading: { text: '{name}, year by year', claim: null },
  placeHistText: { text: 'Every hospital in {name} with a payment decision in any year, one sliver each, one row per fiscal year; red where CMS cut it. At the right of each row: the share of {name}’s hospitals cut that year, then the nation’s.', claim: null },
  placeHistColShare: { text: 'Share cut', claim: null },
  placeHistColNation: { text: 'Nation', claim: null },
  placeHistTakeaway: { text: '{name}’s share cut was above the nation’s in {k} of the {n} years CMS cut anyone; {ever} of its {hospitals} hospitals have been cut at least once.', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, PROGRAM, EXPLORE, SHARED);
