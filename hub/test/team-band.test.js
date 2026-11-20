// The TEAM section on a participant's page across the programs (hub/hospital/team.js), on the emitted TEAM file. Rows are
// picked by property, never by name or CCN; failure messages print no hospital's name, CCN or dollar figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND_DEFAULT, CATEGORIES, MEASURES, PY2_START } from '../../engine/js/team/params.js';
import { compositeQuality } from '../../engine/js/team/quality.js';
import { bandOf, reconcile } from '../../engine/js/team/reconcile.js';
// The test reads the calculator itself (sites/team), to hold the hub's section to its opening view; the hub does not.
import { calcView } from '../../sites/team/web/calc-view.js';
import { calcMeta, calcRow, dataYearOf, hospOf } from '../../web/team/calc-data.js';
import { loadTeam } from '../../sites/team/web/data.js';
import { flagsNote } from '../../web/team/copy.js';
import { initialState } from '../../web/team/opening.js';
import { textOf } from '../../pipeline/site/html.js';
import { count, money, shortIsoDate } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { loadHub } from '../data.js';
import { COPY } from '../hospital/copy.js';
import { teamBand } from '../hospital/team.js';

const HUB = loadHub();
const TEAM = HUB.team;
// The calculator's meta, from the TEAM file itself (the hub's model carries only what its section reads).
const META = calcMeta(loadTeam());
const ALL = [...TEAM.participants.values()];
const signed = (x) => money(x, { sign: true });
// A signed amount as the section prints it: whole on one line, in a .nw span (an unsigned $0 needs none).
const whole = (text) => (/^[−+]/.test(text) ? `<span class="nw">${text}</span>` : text);
const esc = (text) => escapeHtml(text);
const pick = (pred, what) => {
  const p = ALL.find(pred);
  assert.ok(p, `the TEAM file has ${what}`);
  return p;
};
const band = (p, net = true) => String(teamBand({ ccn: p.ccn }, TEAM, { net }));
const episodes = (p) => CATEGORIES.reduce((n, c) => n + p.cats[c].n, 0);
// The ruler's range mark: the two ends in whole dollars (web/charts/limitRuler.js).
const plotted = (low, high) => `data-value="${Math.round(low) + 0} ${Math.round(high) + 0}"`;

const DRAWN = ALL.filter((p) => p.active && p.target > 0 && p.start < PY2_START);
// Five participants with a scenario to draw, spread through the file's order.
const FIVE = [0, 1, 2, 3, 4].map((i) => DRAWN[Math.floor((i * (DRAWN.length - 1)) / 4)]);
const ENDED = ALL.filter((p) => !p.active);
const ZERO = pick((p) => p.active && p.target === 0, 'an active participant with no public episodes');
const STARTER = pick((p) => p.active && p.start === PY2_START, 'a participant starting in performance year 2');
const FLAGGED = pick((p) => p.active && p.target > 0 && p.track2Flags.length > 0, 'a participant with a public Track 2 flag');
const PLAIN = pick((p) => p.active && p.target > 0 && p.track2Flags.length === 0 && p.participation === 'mandatory' && p.start < PY2_START, 'a mandatory participant with no Track 2 flag');
const VOLUNTARY = pick((p) => p.active && p.participation === 'voluntary', 'a voluntary participant');

// The band computed here from the rule, not the section's code: each category on target with its public episodes and
// prices (as the calculator's row carries them, unrounded), the quality percentiles the file has (missing: CMS's
// missing-data score, the engine's), Track 3 and the default band.
function ruleBand(p) {
  const hosp = hospOf(calcRow(p));
  const cats = CATEGORIES.map((key) => ({ key, target: hosp.cats[key].n * hosp.cats[key].price, spend: 0, lowVolume: hosp.cats[key].lowVolume }));
  const pcts = Object.fromEntries(Object.keys(MEASURES).map((m) => [m, hosp.quality[m]?.pct ?? null]));
  const { cqs } = compositeQuality(pcts, { inpatient: episodes(p), lejr: hosp.cats.LEJR.n });
  const input = { cats, cqs, track: 3 };
  return { ...bandOf({ ...input, width: BAND_DEFAULT }), r: reconcile(input), hosp };
}

test('band only on participants: a hospital the TEAM file has no participant row for gets nothing', () => {
  const outsider = [...HUB.master.keys()].find((ccn) => !TEAM.participants.has(ccn));
  assert.ok(outsider, 'a hospital not in TEAM');
  assert.equal(String(teamBand({ ccn: outsider }, TEAM, { net: true })), '', 'no section');
  for (const p of [...FIVE, ZERO, STARTER, ...ENDED]) assert.ok(band(p).includes('data-team'), 'a participant\'s section');
  assert.ok(ENDED.length > 0, 'the file has a participant that left');
});

test('ended → no dollars: the status and its end date only, no range, ruler or calculator link', () => {
  for (const p of ENDED) {
    const b = band(p);
    assert.ok(b.includes(esc(COPY.tmEndedStamp)), 'the "Left TEAM" stamp');
    assert.ok(textOf(b).includes(shortIsoDate(p.end)), 'its end date');
    assert.doesNotMatch(b, /\$|<svg|scen-tag|hh__wbv|\/team\/\?h=/, 'no dollars, drawing, tag, range or calculator link');
    assert.ok(!/NaN|undefined|Infinity/.test(b), 'no bad number');
  }
});

test('range equals bandOf at Track 3, BAND_DEFAULT, and the calculator\'s opening range, to the printed figure', () => {
  const meta = META;
  for (const p of FIVE) {
    const b = band(p);
    const { low, high, r, hosp } = ruleBand(p);
    assert.ok(low <= 0 && high > 0, 'a range from at most $0 to above it');
    assert.ok(b.includes(`<p class="hh__wbv">${whole(signed(low))} to ${whole(signed(high))}</p>`), 'the range, low to high, each amount whole');
    const calc = calcView({ hosp, state: initialState(hosp), team: meta });
    assert.equal(textOf(b).includes(calc.result.range), true, 'the calculator\'s opening range');
    assert.ok(b.includes(plotted(low, high)), 'the ruler\'s range is the same two numbers');
    assert.ok(textOf(b).includes(`a year, Track 3 · at least ${count(episodes(p))} Medicare episodes a year · target amount ${money(r.target)}, in standardized dollars`), 'the line under it');
    assert.ok(textOf(b).includes(`Hatched: past Track 3’s limits, ${money(-r.limits.loss)} and ${signed(r.limits.gain)}`), 'the limits named');
    assert.ok(b.includes('SCENARIO · PUBLIC DATA'), 'the scenario tag');
    assert.ok(b.includes(`href="/team/?h=${p.ccn}#calc"`), 'the link into the calculator');
    assert.ok(!/NaN|undefined|Infinity/.test(b), 'no bad number');
  }
});

test('the status line: since its start, its kind of participation, its area as CMS\'s list names it; the list\'s date', () => {
  const b = textOf(band(PLAIN));
  assert.ok(b.includes(`In TEAM since ${shortIsoDate(PLAIN.start)} · mandatory · ${PLAIN.cbsaName} area`), 'the status line');
  assert.ok(b.includes(`CMS’s TEAM list as of ${shortIsoDate(TEAM.meta.listAsOf)}`), 'the list\'s date');
  // A voluntary participant joined on its own: its place, never "area", which says CMS selected it.
  const vol = textOf(band(VOLUNTARY));
  assert.ok(vol.includes(` · voluntary · ${VOLUNTARY.cbsaName}`), 'a voluntary participant says so, with its place');
  assert.ok(!vol.includes(`${VOLUNTARY.cbsaName} area`), 'no "area" for a voluntary participant');
  assert.ok(!b.includes('may be eligible for Track'), 'no Track 2 note without a public flag');
});

test('a public Track 2 flag: the calculator\'s own note, at the default track', () => {
  const b = band(FLAGGED);
  const hosp = hospOf(calcRow(FLAGGED));
  const calc = calcView({ hosp, state: initialState(hosp), team: META });
  assert.equal(calc.note, flagsNote(hosp.flags, '2'), 'the calculator\'s note at its opening track is the flags\' sentence');
  assert.ok(b.includes(esc(calc.note)), 'the calculator\'s sentence');
});

test('a 2027 starter: "In TEAM from" its start, and its band (the file\'s starters have no public episodes, so one with them is made from another participant\'s row)', () => {
  const words = textOf(band(STARTER));
  assert.ok(words.includes(`In TEAM from ${shortIsoDate(STARTER.start)} · `), 'from, not since');
  assert.ok(!words.includes('In TEAM since'));
  assert.ok(STARTER.target > 0 || words.includes(COPY.tmNone), 'the file\'s starter: its band, or the sentence for no public episodes');
  const made = { ...PLAIN, start: PY2_START };
  const b = String(teamBand({ ccn: made.ccn }, { ...TEAM, participants: new Map([[made.ccn, made]]) }, { net: true }));
  assert.ok(textOf(b).includes(`In TEAM from ${shortIsoDate(PY2_START)} · `), 'from, not since');
  const { low, high } = ruleBand(made);
  assert.ok(b.includes(`<p class="hh__wbv">${whole(signed(low))} to ${whole(signed(high))}</p>`), 'the band');
  assert.ok(b.includes('<svg'), 'the ruler');
});

test('a participant with no public episodes: the status, the sentence sending the reader to the calculator, no range or ruler', () => {
  const b = band(ZERO);
  assert.ok(textOf(b).includes(`In TEAM since ${shortIsoDate(ZERO.start)}`), 'the status line');
  assert.ok(b.includes(esc(COPY.tmNone)), 'no public episode counts; enter its own');
  assert.doesNotMatch(b, /\$|<svg|hh__wbv|scen-tag/, 'no dollars, ruler or range');
  assert.ok(b.includes(`href="/team/?h=${ZERO.ccn}#calc"`), 'the link into the calculator');
  // No scenario to show, so its kicker doesn't promise one; a participant with episodes keeps "(a scenario)".
  const kicker = (markup) => textOf(/<p class="cap kicker">[\s\S]*?<\/p>/.exec(markup)[0]).trim();
  assert.equal(kicker(b), 'Surgical episodes');
  for (const p of FIVE) assert.equal(kicker(band(p)), 'Surgical episodes (a scenario)');
});

test('where the numbers come from: the counts a floor, for both reasons (hidden small counts, no outpatient cases)', () => {
  const words = textOf(band(FIVE[0]));
  assert.ok(words.includes('a floor (counts under 11 are hidden, and the public file has no outpatient cases)'), 'both reasons');
});

test('never a forecast or a penalty: "would" and "scenario", never "will", "loses", "should" or "penalty"; the note keeps it out of the net', () => {
  for (const p of [...FIVE, ZERO, STARTER, FLAGGED, ...ENDED]) {
    const words = textOf(band(p));
    assert.doesNotMatch(words, /\bwill\b|\bloses?\b|\bshould\b|penalt/i, 'no forecast or penalty');
  }
  const b = band(PLAIN);
  assert.ok(b.includes(esc(COPY.tmNote)) && esc(COPY.tmNote).includes('never added to the Medicare net above'), 'with a net on the page, never added to it');
  assert.ok(band(PLAIN, false).includes(esc(COPY.tmNoteAlone)), 'with none, no net named');
  assert.doesNotMatch(band(PLAIN, false), /Medicare net/, 'no net named on a page without one');
});

test('every participant with public episodes: the section\'s range is the calculator\'s opening range, and its ruler\'s ends are bandOf\'s', () => {
  const meta = META;
  let differ = 0;
  for (const p of DRAWN) {
    const b = band(p);
    const { low, high, hosp } = ruleBand(p);
    const calc = calcView({ hosp, state: initialState(hosp), team: meta });
    if (textOf(/<p class="hh__wbv">[\s\S]*?<\/p>/.exec(b)?.[0] ?? '').trim() !== calc.result.range || !b.includes(plotted(low, high))) differ += 1;
  }
  assert.equal(differ, 0, 'participants whose section and calculator disagree');
  assert.ok(DRAWN.length > 0);
});

test('the hub model carries the episodes\' data year once (dataYearOf), not the calculator\'s category list; the section needs no more', () => {
  assert.equal(TEAM.dataYear, dataYearOf(loadTeam().meta));
  assert.ok(!('categoryAvgDerived' in TEAM), 'only what the section reads');
  const lean = { meta: TEAM.meta, dataYear: TEAM.dataYear, participants: TEAM.participants };
  for (const p of FIVE) assert.equal(String(teamBand({ ccn: p.ccn }, lean, { net: true })), band(p), 'the same section from the lean model');
  assert.ok(band(FIVE[0]).includes(`inpatient discharges in ${TEAM.dataYear}`), 'the data year in its words');
});
