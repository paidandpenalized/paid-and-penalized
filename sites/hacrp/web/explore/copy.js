// The words the program page's scripts draw with (client/explore.js and the panels explore-figures.js draws in the
// browser), kept apart from the page's own words (program/copy.js) so the browser carries only these. Same rules as
// copy.js: no digit characters, every number through a {placeholder}; `claim` names a row of sites/hacrp/CLAIMS.md
// (null for this site's own framing or arithmetic). fill, fillKeep and t read here, then copy.js.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../copy.js';

export const COPY = {
  ymapSay: { text: 'FY{fy}: {cut} cut that year; {ever} cut at least once so far', claim: null },
  ymapSayNone: { text: 'FY{fy}: CMS scored no hospital and cut none; {ever} cut at least once so far', claim: null },
  rollSay: { text: '{who}: cut in {cut} of {decided} years ({years})', claim: null },
  rollSayNone: { text: '{who}: never cut in {decided} years', claim: null },
  rollSayOneCut: { text: '{who}: cut in its one year with a decision ({years})', claim: null },
  rollSayOneNone: { text: '{who}: not cut in its one year with a decision', claim: null },
  rollTapAgain: { text: 'Tap again to open its page.', claim: null },
  rollClosed: { text: 'CCN {ccn}, no longer in CMS’s file', claim: null },
  rollStateSay: { text: '{state}: {ever} of {hospitals} hospitals ever cut ({share}), against {nation} nationally.', claim: null },
  rollStateAlt: { text: 'The grid for {state}: each of its {hospitals} hospitals with a payment decision in any year as a column, one row per fiscal year, red where CMS cut it.', claim: null },
  rollStateLink: { text: 'Open the {state} page', claim: null },
  setJoin: { text: '{a} + {b}', claim: null },
  fig2TakeSir: { text: '{zero} of the {n} hospitals with a {short} value reported zero infections; the middle hospital sits at {median}.', claim: null },
  fig2TakePsi: { text: '{short} values bunch near {one}; the middle hospital sits at {median}, and {above} of {n} are above {one}.', claim: null },
  fig2OneSir: { text: '{one} = as predicted', claim: null },
  fig2OnePsi: { text: '{one} = national composite', claim: null },
  fig2Median: { text: 'median {median}', claim: null },
  fig2Per: { text: 'Each dot: up to {per} hospitals', claim: null },
  fig2Zero: { text: '{zero} at zero', claim: null },
  fig2Over: { text: '{over} above {hi}', claim: null },
  fig2Tip: { text: '{from} to {to}: {count} hospitals', claim: null },
  fig2Alt: { text: "Stacked dots of every hospital's {short} value, with the value that means as expected and the national median marked.", claim: null },
  fig3TakeCap: { text: '{cap} hospitals at or above {capValue} on {short} all count as {capValue}.', claim: null },
  fig3TakeBoth: { text: '{cap} hospitals at or above {capValue} on {short} all count as {capValue}, and {floor} at or below {floorValue} count as {floorValue}.', claim: null },
  fig3Reported: { text: 'As reported', claim: null },
  fig3Scored: { text: 'As scored', claim: null },
  fig3Floor: { text: 'Floor {value}', claim: null },
  fig3Cap: { text: 'Cap {value}', claim: null },
  fig3Pulled: { text: '{n} pulled in', claim: null },
  fig3Beyond: { text: '{n} past {hi}, drawn at the edge →', claim: null },
  fig3Alt: { text: "Every hospital's {short} value as reported, and the same values after the floor and cap, with a line for each value that moves.", claim: null },
  fig4TakeOne: { text: 'On {short}, the average hospital ({mean}) reads zero, and one standard deviation is {sd}.', claim: null },
  fig4Value: { text: 'Value', claim: null },
  fig4Z: { text: 'z-score', claim: null },
  fig4Mean: { text: 'average', claim: null },
  fig4Alt: { text: 'A slide rule with {short} values on the top scale and their z-scores on the bottom one.', claim: null },
  swarmBelow: { text: 'Not cut · {n}', claim: null },
  swarmAbove: { text: 'Cut · {n}', claim: null },
  swarmLoupe: { text: 'Magnified: the scores either side of the line', claim: null },
  swarmLoupeShort: { text: 'Magnified: around the line', claim: null },
  swarmHighestNo: { text: '{score} highest not cut', claim: null },
  swarmLowestYes: { text: '{score} lowest cut', claim: null },
  swarmReadout: { text: '{group}: CMS cut {yes} of {decided} ({share}). All hospitals: {nation}.', claim: null },
  swarmTip: { text: '{name}, {state}: {score} · {decision}', claim: null },
  agreeScatterX: { text: '{short} →', claim: null },
  agreeScatterY: { text: '↑ {short}', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, SHARED);
