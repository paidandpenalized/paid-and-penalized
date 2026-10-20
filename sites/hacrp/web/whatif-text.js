// The what-if's words, built from its view model (web/whatif/state.js). Everything is conditional ("would"):
// this site's arithmetic on CMS's values, never a statement of what CMS did or what a hospital could do.
// A measure CMS assigned reads "had it been submitted"; Maryland's what-if moves the score only. The median
// hospital is this site's synthetic record, so its words never call its values or decision CMS's.
import { isMedianHospital } from '../../../engine/js/hacrp/median.js';
import { cmsText, decimal, isoDate, pct } from '../../../web/render/format.js';
import { REDUCTION_TEXT, SHORT_NAMES } from './constants.js';
import { fill } from './copy.js';

const LIST = new Intl.ListFormat('en-US', { type: 'conjunction' });
const FLAG_KEYS = { Yes: 'flagYes', No: 'flagNo', 'too-close': 'flagClose', 'N/A': 'flagNA' };

const decimalsOf = (text) => (text.includes('.') ? text.length - text.indexOf('.') - 1 : 0);
const value = (x, model, id) => decimal(x, model.params[id].decimals);

export function flagText(flag) {
  if (!Object.hasOwn(FLAG_KEYS, flag)) throw new RangeError(`no flag text for "${flag}"`);
  return fill(FLAG_KEYS[flag]);
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
function changes(result, model) {
  return Object.entries(result.measures).filter(([, m]) => m.changed).map(([id, m]) => {
    const p = model.params[id];
    const bound = m.afterValue >= p.cap ? 'cap' : p.floor > 0 && m.afterValue <= p.floor ? 'floor' : null;
    return { id, m, short: SHORT_NAMES[id], moved: m.afterZ !== m.beforeZ, bound };
  });
}

function item(c, model) {
  const after = value(c.m.afterValue, model, c.id);
  return c.m.assigned
    ? fill('whatifItemAssigned', { short: c.short, after })
    : fill('whatifItem', { short: c.short, after, before: value(c.m.beforeValue, model, c.id) });
}

// One change that doesn't move the score, named by its bound.
function deadZone(c, model) {
  const after = value(c.m.afterValue, model, c.id);
  const p = model.params[c.id];
  if (c.bound === 'cap' && c.m.assigned) return fill('whatifCapAssigned', { short: c.short, after, cap: value(p.cap, model, c.id) });
  const verb = c.m.afterValue < c.m.beforeValue ? 'Lower' : 'Raise';
  if (c.bound === 'cap') return fill(`whatifCap${verb}`, { short: c.short, after, cap: value(p.cap, model, c.id) });
  return fill(`whatifFloor${verb}`, { short: c.short, after, floor: value(p.floor, model, c.id) });
}

// For one change among several that didn't move the score, or any change that moved it into the dead zone.
function boundNote(c, model) {
  const p = model.params[c.id];
  const cap = { short: c.short, cap: value(p.cap, model, c.id) };
  const floor = { short: c.short, floor: value(p.floor, model, c.id) };
  if (c.bound === 'cap') return c.moved ? fill('whatifCapReached', cap) : fill('whatifCapNote', cap);
  return c.moved ? fill('whatifFloorReached', floor) : fill('whatifFloorNote', floor);
}

function flagSentences(result, median) {
  const { before, after } = result;
  if (before.flag === 'N/A') return [fill('whatifNA', { decision: flagText('N/A') })];
  const out = [after.flag === 'Yes' ? fill('whatifYes', { pct: REDUCTION_TEXT })
    : after.flag === 'No' ? fill('whatifNo')
      : fill('whatifClose', { cuts: cutText('too-close') })];
  if (after.flag !== before.flag) out.push(fill(median ? 'whatifMedianWas' : 'whatifCmsWas', { decision: flagText(before.flag) }));
  return out;
}

// One paragraph: what changed, where the score would go, and what that would mean for the decision.
export function scenarioSentence(vm, hospital, model) {
  const r = vm.result;
  if (!r.available) return null;
  const list = changes(r, model);
  const { before, after } = scores(r, hospital);
  const median = isMedianHospital(hospital);
  if (!list.length) return fill(median ? 'whatifNoneMedian' : 'whatifNone', { score: before, decision: flagText(r.before.flag) });
  if (list.length === 1 && list[0].bound && !list[0].moved) return deadZone(list[0], model);

  const items = LIST.format(list.map((c) => item(c, model)));
  const out = [];
  if (after === before) out.push(fill('whatifStay', { changes: items, score: before }));
  else out.push(fill(r.after.score > r.before.score ? 'whatifRise' : 'whatifFall', { changes: items, before, after }));
  if (list.some((c) => c.moved)) out.push(...flagSentences(r, median));
  for (const c of list) if (c.bound) out.push(boundNote(c, model));
  return out.join(' ');
}

// One row per scored measure: "What would it take?" (CMS flagged it) or "How much cushion?" (it didn't). Answers
// are for that measure alone, from CMS's values.
export function solverRows(vm, model) {
  return vm.solver.map((s) => {
    const row = { id: s.id, label: SHORT_NAMES[s.id], answer: null, note: null };
    if (s.note === 'not-applicable') return { ...row, note: fill('solverNANote') };
    if (s.note === 'assigned') return { ...row, note: fill('solverAssignedNote') };
    if (s.note === 'no-cushion') return { ...row, answer: fill('solverNoCushion'), note: fill('solverNoCushionNote') };
    if (s.kind === 'needed') {
      return { ...row, answer: s.possible ? fill('solverNeeded', { value: value(s.value, model, s.id) }) : fill('solverNotPossible') };
    }
    if (s.unlimited) return { ...row, answer: fill('solverUnlimited', { short: SHORT_NAMES[s.id], cap: value(model.params[s.id].cap, model, s.id) }) };
    return { ...row, answer: fill('solverCushion', { value: value(s.value, model, s.id) }) };
  });
}

// Plain text for "Copy for a slide". view: { name (null for the median hospital), fy, source } — the hospital
// view plus the dataset's manifest entry (id, pdcReleased).
export function slideText(vm, hospital, model, view) {
  const r = vm.result;
  if (!r.available) return null;
  if (!view?.source) throw new TypeError('slideText: view.source (id, pdcReleased) is required for the source line');
  const { before, after } = scores(r, hospital);
  const decision = r.before.flag === 'N/A'
    ? fill('slideDecisionOnly', { decision: flagText('N/A') })
    : fill('slideDecision', { before: flagText(r.before.flag), after: flagText(r.after.flag) });
  return [
    view.name,
    fill('slideScore', { before, after }),
    decision,
    scenarioSentence(vm, hospital, model),
    fill('source', { fy: String(view.fy), id: view.source.id, date: isoDate(view.source.pdcReleased) }),
    fill('whatifStanding'),
  ].filter((line) => line !== null && line !== undefined).join('\n');
}
