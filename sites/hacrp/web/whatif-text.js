// The what-if's words, built from its view model (whatif-state.js). Everything is conditional ("would"):
// this site's arithmetic on CMS's values, never a statement of what CMS did or what a hospital could do.
// A measure CMS assigned reads "had it been submitted"; Maryland's what-if moves the score only. The page says where
// the starting values come from (baseline): CMS's, or this site's own for the sandbox's synthetic median hospital,
// whose words never call its values or decision CMS's.
import { has } from '../../../engine/js/has.js';
import { isSir } from '../../../engine/js/hacrp/measures.js';
import { decimalsOf } from '../../../engine/js/hacrp/params.js';
import { SCORE_DECIMALS as PART_DP } from '../../../engine/js/hacrp/score.js';
import { cmsText, decimal, longDate, pct, signed } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { assignedNow } from '../../../web/whatif/marks.js';
import { LEVERAGE_STEP, REDUCTION_TEXT, SHORT_NAMES, SIR_EXPECTED_TEXT } from './constants.js';
import { fill, heroLineText, measureLabel, sourcePlain } from './copy.js';

const LIST = new Intl.ListFormat('en-US', { type: 'conjunction' });
const FLAG_KEYS = { Yes: 'flagYes', No: 'flagNo', 'too-close': 'flagClose', 'N/A': 'flagNA' };

// The words that depend on the starting values. counts: the NHSN fields, whose words compare with CMS's value.
// label: a line under the heading naming the starting point (the sandbox's), or none.
const BASELINES = {
  cms: {
    intro: 'whatifIntro', start: 'whatifStartCms', none: 'whatifNone', was: 'whatifCmsWas', solverCaption: 'solverCaption', counts: true,
    label: null,
  },
  sandbox: {
    intro: 'whatifIntroMedian', start: 'whatifStartMedian', none: 'whatifNoneMedian', was: 'whatifMedianWas',
    solverCaption: 'solverCaptionMedian', counts: false, label: 'sandboxLabel',
  },
};

function wordsFor(baseline) {
  if (!has(BASELINES, baseline)) throw new TypeError(`what-if: baseline must be "cms" or "sandbox", got "${baseline}"`);
  return BASELINES[baseline];
}

const value = (x, model, id) => decimal(x, model.params[id].decimals);

// The measure that adds the most to the score, among those with a measured result: [{ assigned, contribution }, …]
// in measure order -> the entry with the largest positive contribution (the first, on a tie), or null when none is
// positive. Never one whose score CMS assigned. The page's takeaway (view.js) and the what-if's line for the
// reader's hypothetical (bars.lead) use this one rule.
export function largestPart(parts) {
  let largest = null;
  for (const m of parts) {
    if (m.assigned || m.contribution === null || m.contribution <= 0) continue;
    if (!largest || m.contribution > largest.contribution) largest = m;
  }
  return largest;
}

// The framed bars' line for a changed what-if: the hypothetical part that adds the most, by largestPart; a measure
// CMS assigned counts once the reader gives it a value ("had it been submitted").
function barsLead(vm) {
  const parts = vm.inputs.map((input) => ({ id: input.id, assigned: assignedNow(input), contribution: vm.result.measures[input.id].contribution }));
  const top = largestPart(parts);
  return top ? fill('figPartsHyp', { short: SHORT_NAMES[top.id], contribution: signed(top.contribution, PART_DP) }) : fill('figPartsHypNone');
}

export function flagText(flag) {
  if (!has(FLAG_KEYS, flag)) throw new RangeError(`no flag text for "${flag}"`);
  return fill(FLAG_KEYS[flag]);
}

// The decision as a pill, in the hero's words: { kind, label } for components.js pill(). Too close to call is neutral.
const PILLS = {
  Yes: () => ({ kind: 'pen', label: fill('pillYes', { pct: REDUCTION_TEXT }) }),
  No: () => ({ kind: null, label: fill('pillNo') }),
  'too-close': () => ({ kind: null, label: fill('flagClose') }),
  'N/A': () => ({ kind: 'na', label: fill('pillNA') }),
};
export function pillOf(flag) {
  if (!has(PILLS, flag)) throw new RangeError(`no pill for "${flag}"`);
  return PILLS[flag]();
}

// The cut as a percentage (dollars come later); null for Maryland, which is not subject to it.
export function cutText(flag) {
  if (flag === 'Yes') return REDUCTION_TEXT;
  if (flag === 'No') return pct(0, 0);
  if (flag === 'too-close') return fill('cutEither', { none: pct(0, 0), pct: REDUCTION_TEXT });
  return null;
}

// The score before (CMS's text) and after (this site's, at CMS's decimals).
function scores(result, hospital) {
  const before = cmsText(hospital.totalText);
  const after = result.after.score === result.before.score ? before : decimal(result.after.score, decimalsOf(hospital.totalText));
  return { before, after };
}

// The changed measures: whether each moved the score, and the bound its new value sits on, if any: at or past
// CMS's cap, or at or below a floor above zero (an SIR can't go below a floor of zero, so that one isn't named).
// bound: 'cap', 'floor' or null; limit: that bound's value, formatted.
function changes(result, model) {
  return Object.entries(result.measures).filter(([, m]) => m.changed).map(([id, m]) => {
    const p = model.params[id];
    const bound = m.afterValue >= p.cap ? 'cap' : p.floor > 0 && m.afterValue <= p.floor ? 'floor' : null;
    return { id, m, short: SHORT_NAMES[id], moved: m.afterZ !== m.beforeZ, bound, limit: bound && value(p[bound], model, id) };
  });
}

function item(c, model) {
  const after = value(c.m.afterValue, model, c.id);
  return c.m.assigned
    ? fill('whatifItemAssigned', { short: c.short, after })
    : fill('whatifItem', { short: c.short, after, before: value(c.m.beforeValue, model, c.id) });
}

// One change that doesn't move the score, named by its bound (copy keys whatifCap… and whatifFloor…).
function deadZone(c, model) {
  const values = { short: c.short, after: value(c.m.afterValue, model, c.id), [c.bound]: c.limit };
  if (c.bound === 'cap' && c.m.assigned) return fill('whatifCapAssigned', values);
  const verb = c.m.afterValue < c.m.beforeValue ? 'Lower' : 'Raise';
  return fill(`${c.bound === 'cap' ? 'whatifCap' : 'whatifFloor'}${verb}`, values);
}

// For one change among several that didn't move the score, or any change that moved it into the dead zone.
const BOUND_NOTES = {
  cap: { moved: 'whatifCapReached', still: 'whatifCapNote' },
  floor: { moved: 'whatifFloorReached', still: 'whatifFloorNote' },
};
const boundNote = (c) => fill(BOUND_NOTES[c.bound][c.moved ? 'moved' : 'still'], { short: c.short, [c.bound]: c.limit });

// What the hypothetical decision would mean, by its flag.
const AFTER_SENTENCES = {
  Yes: () => fill('whatifYes', { pct: REDUCTION_TEXT }),
  No: () => fill('whatifNo'),
  'too-close': () => fill('whatifClose', { cuts: cutText('too-close') }),
};

function flagSentences(result, words) {
  const { before, after } = result;
  if (before.flag === 'N/A') return [fill('whatifNA', { decision: flagText('N/A') })];
  const out = [AFTER_SENTENCES[after.flag]()];
  if (after.flag !== before.flag) out.push(fill(words.was, { decision: flagText(before.flag) }));
  return out;
}

// One paragraph: what changed, where the score would go, and what that would mean for the decision. baseline:
// 'cms' or 'sandbox', where the starting values come from.
export function scenarioSentence(vm, hospital, model, baseline) {
  const words = wordsFor(baseline);
  const r = vm.result;
  if (!r.available) return null;
  const list = changes(r, model);
  const { before, after } = scores(r, hospital);
  if (!list.length) return fill(words.none, { score: before, decision: flagText(r.before.flag) });
  if (list.length === 1 && list[0].bound && !list[0].moved) return deadZone(list[0], model);

  const items = LIST.format(list.map((c) => item(c, model)));
  const out = [];
  if (after === before) out.push(fill('whatifStay', { changes: items, score: before }));
  else out.push(fill(r.after.score > r.before.score ? 'whatifRise' : 'whatifFall', { changes: items, before, after }));
  if (list.some((c) => c.moved)) out.push(...flagSentences(r, words));
  for (const c of list) if (c.bound) out.push(boundNote(c));
  return out.join(' ');
}

// One row per scored measure: "What would it take?" (CMS flagged it) or "How much cushion?" (it didn't). Answers
// are for that measure alone, from CMS's values. answers: solverOf() (whatif-state.js), never null here.
export function solverRows(answers, model) {
  return answers.map((s) => {
    const row = { id: s.id, label: SHORT_NAMES[s.id], answer: null, note: null };
    if (s.note === 'assigned') return { ...row, note: fill('solverAssignedNote') };
    if (s.note === 'no-cushion') return { ...row, answer: fill('solverNoCushion'), note: fill('solverNoCushionNote') };
    if (s.kind === 'needed') {
      return { ...row, answer: s.possible ? fill('solverNeeded', { value: value(s.value, model, s.id) }) : fill('solverNotPossible') };
    }
    if (s.unlimited) return { ...row, answer: fill('solverUnlimited', { short: SHORT_NAMES[s.id], cap: value(model.params[s.id].cap, model, s.id) }) };
    return { ...row, answer: fill('solverCushion', { value: value(s.value, model, s.id) }) };
  });
}

// Plain text for "Copy for a slide". name: the hospital's (null for the median hospital, which gets no name line);
// fy; source: the dataset's manifest entry (id, pdcReleased); baseline: as for scenarioSentence.
export function slideText(vm, hospital, model, { name, fy, source, baseline }) {
  const r = vm.result;
  if (!r.available) return null;
  if (!source) throw new TypeError('slideText: source (id, pdcReleased) is required for the source line');
  const { before, after } = scores(r, hospital);
  const decision = r.before.flag === 'N/A'
    ? fill('slideDecisionOnly', { decision: flagText('N/A') })
    : fill('slideDecision', { before: flagText(r.before.flag), after: flagText(r.after.flag) });
  return [
    name,
    fill('slideScore', { before, after }),
    decision,
    scenarioSentence(vm, hospital, model, baseline),
    sourcePlain({ fy, source }),
    fill('whatifStanding'),
  ].filter((line) => line !== null && line !== undefined).join('\n');
}

const METHODS_ESTIMATE = '/methods/#estimate';

// A measure's facts line as its parts ("median 0.559", "cap 1.572", …), each kept whole on the page; led, on a
// hospital page, by CMS's own value in CMS's text (so it stays beside the control once the reader changes it).
// cms: the hospital's record for the measure, or null (the sandbox, whose start is not CMS's).
function factsOf(input, values, cms) {
  const line = input.floor > 0 ? fill('whatifFactsFloor', { ...values, floor: decimal(input.floor, input.decimals) }) : fill('whatifFacts', values);
  // CMS's text where the record carries it (the build); the value at its decimals otherwise (the browser's slim record).
  const value = cms?.valueText ? cmsText(cms.valueText) : cms && cms.value !== null && decimal(cms.value, input.decimals);
  const lead = cms && cms.value !== null ? [fill('whatifFactsCms', { value })] : [];
  return [...lead, ...line.split(' · ')];
}

// CMS's HAI period as long dates; null where CMS gives none ('' or 'N/A') or either end does not read as a date.
function haiPeriod({ start, end }) {
  try {
    return { start: longDate(start), end: longDate(end) };
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
}

function countText(delta) {
  const count = decimal(Math.abs(delta), 1);
  if (Number(count) === 0) return fill('whatifCountSame');
  return fill(delta > 0 ? 'whatifCountMore' : 'whatifCountFewer', { count });
}

// The words the what-if component (web/whatif/render.js and dom.js) takes for one hospital: strings for the fixed
// parts, functions of the view model for the parts that move. The page passes the hospital view's name, fy and path,
// the dataset's manifest entry (source), CMS's text for the line's two scores (boundaryText) and where the starting
// values come from (baseline: 'cms', or 'sandbox' for the median hospital). Other page fields are ignored.
export function whatIfTexts({ hospital, model, name, fy, path, source, boundaryText, baseline }) {
  const words = wordsFor(baseline);
  // A start that does not read No (Yes, or a recompute too close to call) asks what it would take to read No.
  const needed = hospital.paymentReduction === 'Yes' || hospital.paymentReduction === 'too-close';
  const hai = words.counts ? haiPeriod(hospital.periods.hai) : null;
  const slide = { name, fy, source, baseline };
  const printAt = (fragment) => fill('whatifPrint', { url: SITE.origin + path + fragment });
  return {
    heading: fill('whatifHeading'),
    label: words.label && fill(words.label),
    intro: fill(words.intro),
    noScript: fill('whatifNoScript'),
    banner: { text: fill('whatifBanner'), linkText: fill('whatifBannerLink'), href: path },
    resultLabel: fill('whatifResultLabel'),
    start: fill(words.start),
    hypothetical: fill('whatifHypothetical'),
    same: fill('whatifSame'),
    pill: pillOf,
    rows: { score: fill('whatifRowScore'), decision: fill('whatifRowDecision'), cut: fill('whatifRowCut') },
    rampLine: fill('whatifRampLine'),
    // The shaded side is the cut; Maryland's hospitals are not subject to it, so their ramp names no cut.
    rampZone: hospital.paymentReduction === 'N/A' ? null : pillOf('Yes').label,
    // Under the ramp, the hero's short form of the line (not for Maryland, whose ramp names no cut); the sentence
    // itself is said once, under the what-if.
    rampRef: hospital.paymentReduction === 'N/A' ? null : heroLineText(boundaryText),
    rampLegend: `${fill('line', boundaryText)} ${fill('lineMaryland')}`,
    scores: (vm) => scores(vm.result, hospital),
    flag: flagText,
    cut: cutText,
    sentence: (vm) => scenarioSentence(vm, hospital, model, baseline),
    slide: (vm) => slideText(vm, hospital, model, slide),
    estimate: { text: fill('whatifEstimate'), linkText: fill('estimateMore'), href: METHODS_ESTIMATE },
    copy: fill('whatifCopy'),
    copied: fill('whatifCopied'),
    copyFallback: fill('whatifCopyFallback'),
    slideLabel: fill('whatifSlideLabel'),
    reset: fill('whatifReset'),
    median: fill('whatifMedian'),
    medianHelp: fill('whatifMedianHelp', { button: fill('whatifMedian') }),
    // Shown only where there are answers (Maryland, not subject to the reduction, has none).
    solver: {
      question: fill(needed ? 'whatifSolveYes' : 'whatifSolveNo'),
      caption: fill(words.solverCaption),
      columns: [fill('solverColMeasure'), fill(needed ? 'solverColNeeded' : 'solverColCushion'), fill('solverColNote')],
      rows: (answers) => solverRows(answers, model),
    },
    fieldsLegend: fill('whatifFieldsLegend'),
    fieldsHelp: [`${fill('whatifSirHelp', { one: SIR_EXPECTED_TEXT })} · ${fill('whatifPsiHelp')}`, fill('whatifTrackKey')],
    weight: (n) => fill('whatifWeight', { one: decimal(1, 0), n: String(n) }),
    // input: one of vm.inputs; m: its vm.result.measures entry.
    measure(input, m) {
      const { id } = input;
      const short = SHORT_NAMES[id];
      const at = (x) => decimal(x, input.decimals);
      const values = {
        median: at(input.median), cap: at(input.cap),
        tenth: decimal(LEVERAGE_STEP, decimalsOf(String(LEVERAGE_STEP))), leverage: decimal(LEVERAGE_STEP * m.leverage, PART_DP),
      };
      return {
        label: `${measureLabel(id)} (${short})`,
        short,
        facts: factsOf(input, values, baseline === 'cms' ? hospital.measures[id] : null),
        slider: fill('whatifSliderLabel', { short }),
        placeholder: input.assigned ? fill('whatifAssignedPlaceholder', { z: cmsText(hospital.measures[id].zText) }) : null,
        assignedHelp: input.assigned ? fill('whatifAssignedHelp') : null,
        invalid: fill('whatifInvalid', { min: at(0), max: at(input.limit) }),
      };
    },
    bars: {
      heading: fill('whatifBarsHeading'),
      caption: (n) => fill('whatifBarsCaption', { n: String(n) }),
      value: (contribution) => signed(contribution, PART_DP),
      assigned: fill('whatifBarAssigned'),
      lead: barsLead,
    },
    // NHSN predicted counts: SIRs only, from CMS's values (the words compare with CMS's value), with an HAI period.
    predicted: hai === null ? null : {
      summary: fill('whatifPredictedSummary'),
      label: (id) => (isSir(id) ? fill('whatifPredictedLabel', { short: SHORT_NAMES[id], ...hai }) : null),
      help: fill('whatifPredictedHelp'),
      invalid: fill('whatifPredictedInvalid', { min: decimal(0, 0) }),
      result: countText,
    },
    held: fill('whatifHeld'),
    // The printed link: the page's, or with a changed what-if's fragment (#whatif&…, as share writes it) after it.
    print: printAt(''),
    printAt,
    standing: fill('whatifStanding'),
  };
}
