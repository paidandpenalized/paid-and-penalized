// The what-if in the browser: makes the component web/whatif/render.js wrote live. Each input goes through the site's
// rules: reduce() and viewModel(); the page changes by textContent and attributes only. The numbers move at once; the
// live sentence (and, with share, the URL fragment) follow 400 ms after the reader stops. With share, a link's
// fragment is read on load and the reader's changes are written back with history.replaceState; NHSN counts stay in
// memory. env is the window (a seam for tests): with share false, location and history are never touched. range: the
// ramp's national span of scores ({ low, high }, from the page data), as render.js drew it.
//
// rules, the site's (sites/<program>/web/whatif-state.js): { start, params, reduce(state, action),
// changesOf(state), viewModel(state) }. start.ids: the measures; params[id]: { decimals, cap }, for decoding a link.
// reduce() takes { type: 'set', id, value }, 'reset', 'median', { type: 'predicted', id, count } and
// { type: 'load', changes }, and returns the same state when it refuses an action.
import { pillClass } from '../render/components.js';
import { decode, encode, isScenarioHash, isWhatIfHash } from './fragment.js';
import {
  afterText, anyChanged, assignedNow, barClass, barSpan, cliffDotClass, cliffY, estimateNote, fieldText, fraction, headScore, isEither, levelOf, moneyClass, rampAt, rampDomain, rampEdge, sameDollars, sameMoney,
  rampLabels, RAMP_Y, rampHeight, rampSide, rampX, sliderValue, trackMarks, trackStart,
} from './marks.js';

// A live announcement waits this long after the reader stops typing (the program page's table count uses it too).
export const SETTLE_MS = 400;
// The phone layout (the program page's table uses it too).
export const NARROW = '(max-width: 640px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
// The head's dollars count to a new value over this long (never under reduced motion), about as long as the cliff's
// dot takes to fall.
const COUNT_MS = 650;

// A number field's entry: null when blank, NaN when it isn't a number.
function entry(el) {
  if (el.validity?.badInput) return NaN;
  const text = String(el.value).trim();
  return text === '' ? null : Number(text);
}

const setText = (el, text) => {
  if (el && el.textContent !== text) el.textContent = text;
};
// An attribute written only when it changes: a drag redraws many times a second.
const setAttr = (el, name, value) => {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
};

// An input with an error line: the line shows while the input's entry is refused. null without the input.
const checked = (el, error) => el && { el, error, described: el.getAttribute('aria-describedby') ?? '' };

export function mountWhatIf(root, { rules, texts, share, range, env = globalThis }) {
  if (typeof share !== 'boolean') throw new TypeError('mountWhatIf: share must be true or false');
  const q = (name, scope = root) => scope.querySelector(`[data-wi="${name}"]`);
  const { start, reduce, changesOf } = rules;
  if (!start.ids.length) return;
  const hasChanges = (state) => Object.keys(changesOf(state)).length > 0;

  const rows = Object.fromEntries(start.ids.map((id) => {
    const row = root.querySelector(`[data-measure="${id}"]`);
    const bar = root.querySelector(`[data-bar="${id}"]`);
    // The NHSN count's field sits in its own folded section, not in the measure's row.
    const extra = root.querySelector(`[data-predicted="${id}"]`);
    return [id, {
      number: q('number', row),
      slider: q('slider', row),
      deadLow: q('dead-low', row),
      deadHigh: q('dead-high', row),
      medianMark: q('median-mark', row),
      capMark: q('cap-mark', row),
      startMark: q('start-mark', row),
      predicted: extra && q('predicted', extra),
      count: extra && q('count', extra),
      echo: q('echo', row),
      numberCheck: checked(q('number', row), q('error', row)),
      predictedCheck: extra && checked(q('predicted', extra), q('predicted-error', extra)),
      barRow: bar,
      bar: q('bar', bar),
      barValue: q('bar-value', bar),
      // The bars' figure table, when a page frames the bars as a figure: this measure's hypothetical part.
      partCell: q(`part-${id}`),
      // CMS's bar, outlined behind the bar once it moves (framed bars only).
      barCms: q('bar-cms', bar),
      barAssigned: q('bar-assigned', bar),
    }];
  }));
  const el = Object.fromEntries(['detail', 'head-label', 'head-score', 'head-pill', 'score', 'flag', 'cut', 'sentence', 'sentence-est', 'estimate', 'hyp', 'hyp-label',
    'start-label', 'hyp-edge', 'ramp', 'banner', 'copy', 'bars-lead', 'head-money', 'head-money-was', 'head-money-words', 'money', 'cliff-dot', 'cliff-start',
    'copy-status', 'slide', 'solve', 'solver', 'fields', 'controls', 'nojs', 'reset', 'median'].map((name) => [name, q(name)]));

  const first = rules.viewModel(start);
  // Each measure's part of the score at the start, as the bars write it: the figure table's Hypothetical cell reads
  // "same" while the part equals it.
  const startPart = Object.fromEntries(first.inputs.map((input) => [input.id, texts.bars.value(first.result.measures[input.id].contribution)]));
  // Each measure's starting value, where a changed measure's track keeps a dotted tick (none for an assigned one).
  const startValue = Object.fromEntries(first.inputs.map((input) => [input.id, input.value]));
  // The start's decision and cut, as the result table writes them (CMS's, or the sandbox's: fixed for the page).
  const startFlag = texts.flag(first.result.before.flag);
  const startCut = texts.cut(first.result.before.flag);
  const domain = rampDomain(range, first.ramp);
  const startAt = rampAt(first.ramp.actual, domain);
  // The dollars, where the site has them: the start's, as the table writes them; the dollars as last drawn (the head's
  // figure counts from them, the cliff's dot moves from them; null before the first draw).
  const money = first.money && texts.money ? texts.money : null;
  const startMoney = money && money.amount(first.money.before);
  let shownMoney = null;
  let counting = null;
  let onScreen = null;
  const reducedMotion = env.matchMedia?.(REDUCED_MOTION);

  // A link's fragment: what decode() trusts goes through reduce(); the rest stays CMS's.
  const load = (state) => reduce(state, { type: 'load', changes: decode(env.location.hash, { ids: start.ids, params: rules.params }).changes });

  let state = share ? load(start) : start;
  let linked = share && hasChanges(state);
  let vm = first;
  let timer = null;
  // The print-only line naming the what-if's address; with share, draw() keeps the scenario's fragment on it.
  const printLine = root.querySelector('.print-only');

  function writeHash() {
    const next = encode(changesOf(state), start.ids);
    const { location, history } = env;
    // Leave a fragment that isn't the what-if's (a skip link's #main) alone while there is nothing to write.
    if (next === location.hash || (next === '' && !isWhatIfHash(location.hash))) return;
    try {
      history.replaceState(null, '', location.pathname + location.search + next);
    } catch {
      // Some browsers rate-limit replaceState; the next change writes the fragment again.
    }
  }

  // Now, and in place of a pending settle (draw() arms one).
  function settle() {
    env.clearTimeout(timer);
    setText(el.sentence, texts.sentence(vm));
    setText(el['sentence-est'], estimateNote(vm, texts));
    if (share) writeHash();
  }

  // A hypothetical cell: its value, or "same" (marked data-same) where it equals the start.
  function after(cell, before, value) {
    if (!cell) return;
    setText(cell, afterText(before, value, texts.same));
    cell.toggleAttribute('data-same', value === before);
  }

  // An SVG text at a ramp place { t, anchor, dx }.
  function place(text, { t, anchor, dx }) {
    text.setAttribute('x', rampX(t));
    text.setAttribute('text-anchor', anchor);
    text.setAttribute('dx', String(dx));
  }

  // The head's dollars, counted from the figure last drawn (from) to next (each frame's figure in the site's words), or
  // set at once: under reduced motion, without animation frames, or where either end is too close to call (two numbers).
  // A count started during another one starts from the figure on screen, not from where that count was heading.
  function countMoney(from, next) {
    const node = el['head-money'];
    if (!node) return;
    setText(el['head-money-words'], money.head(next));
    setAttr(node, 'class', `wi-money${moneyClass(next)}`);
    if (counting !== null) {
      env.cancelAnimationFrame?.(counting);
      from = onScreen ?? from;
    }
    counting = null;
    const show = (dollars) => {
      onScreen = dollars;
      setText(node, money.amount(dollars));
    };
    const still = reducedMotion?.matches || typeof env.requestAnimationFrame !== 'function';
    if (still || isEither(from) || isEither(next) || sameDollars(from, next)) {
      show(next);
      return;
    }
    let t0 = null;
    const step = (now) => {
      if (t0 === null) t0 = now;
      const k = Math.min(1, (now - t0) / COUNT_MS);
      const eased = 1 - (1 - k) ** 3;
      const cash = Math.round(from.lo + (next.lo - from.lo) * eased);
      show(k < 1 ? { lo: cash, hi: cash } : next);
      counting = k < 1 ? env.requestAnimationFrame(step) : null;
    };
    counting = env.requestAnimationFrame(step);
  }

  // The cliff: the dot rides it to the hypothetical score and falls (or climbs) from the level of the dollars last drawn
  // (from) to its new one when it crosses the line; the ring keeps the starting score once the two differ. The move
  // across is instant, the fall is CSS's.
  function drawCliff(vm, t, unchanged, from) {
    const dot = el['cliff-dot'];
    if (!dot) return;
    const [was, now] = [levelOf(from), levelOf(vm.money.after)];
    if (now !== was) setAttr(dot, 'data-motion', now > was ? 'fall' : 'rise');
    dot.style.setProperty('--at', fraction(t));
    dot.style.setProperty('--y', cliffY(vm.money.after));
    setAttr(dot, 'class', cliffDotClass(vm.money.after));
    if (el['cliff-start']) el['cliff-start'].hidden = unchanged;
  }

  // A field's error line shows while its entry is refused, and the field names it in aria-describedby.
  function markInvalid({ el: input, error, described }, invalid) {
    error.hidden = !invalid;
    input.setAttribute('aria-describedby', invalid ? `${described} ${error.id}`.trim() : described);
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  // Reset and a new link start every field over. A refused NHSN count is cleared with its error (the state holds no
  // count for it); number fields drop theirs when draw() rewrites them.
  function clearRefusedCounts() {
    for (const id of start.ids) {
      const c = rows[id].predictedCheck;
      if (!c || c.error.hidden) continue;
      c.el.value = '';
      markInvalid(c, false);
    }
  }

  function track(r, input) {
    const at = trackMarks(input);
    r.slider.setAttribute('max', String(input.max));
    r.deadLow?.style.setProperty('--to', at.floor);
    r.deadHigh.style.setProperty('--from', at.cap);
    r.medianMark.style.setProperty('--at', at.median);
    r.capMark.style.setProperty('--at', at.cap);
    r.startMark?.style.setProperty('--at', trackStart(startValue[input.id], input.max));
  }

  // source: the element the reader is using, left as they have it. holdMax: a slider mid-drag keeps its max, so
  // its thumb never runs from under the pointer; the drag's change event redraws it. id: the measure the reader is
  // editing, which echoes the result under itself (on a phone the result box sits far above it; CSS shows the echo
  // only there, and it is aria-hidden: the live region announces the result).
  function draw({ source = null, holdMax = false, id = null } = {}) {
    vm = rules.viewModel(state);
    const r = vm.result;
    const s = texts.scores(vm);
    const changed = anyChanged(r);
    const p = texts.pill(r.after.flag);
    // On a phone the edited measure echoes the result, its dollars too where the site has them.
    const echo = changed ? `${headScore(s)} · ${p.label}${money && vm.money ? ` · ${money.amount(vm.money.after)}` : ''}` : '';
    after(el.score, s.before, s.after);
    after(el.flag, startFlag, texts.flag(r.after.flag));
    after(el.cut, startCut, texts.cut(r.after.flag));
    setText(el['head-label'], changed ? texts.hypothetical : texts.start);
    // A changed what-if prints as a scenario; an unchanged one drops its instructions on paper (print.css).
    root.toggleAttribute('data-changed', changed);
    setText(el['head-score'], headScore(s));
    setText(el['head-pill'], p.label);
    setAttr(el['head-pill'], 'class', pillClass(p.kind));
    el.estimate.hidden = !vm.estimated;
    const t = rampAt(r.after.score, domain);
    el.hyp.setAttribute('x', rampX(t));
    const labels = rampLabels(startAt, t, texts.start, texts.hypothetical);
    place(el['start-label'], labels.start);
    place(el['hyp-label'], labels.hyp);
    // The hollow mark and its label only once the hypothetical differs from the start (SVG has no hidden property).
    const unchanged = r.after.score === r.before.score;
    const stacked = labels.stacked && !unchanged;
    setAttr(el['hyp-label'], 'y', String(stacked ? RAMP_Y.label2 : RAMP_Y.label));
    setAttr(el.ramp, 'height', String(rampHeight(stacked)));
    for (const node of [el.hyp, el['hyp-label']]) node.toggleAttribute('hidden', unchanged);
    const edge = rampEdge(rampSide(r.after.score, domain));
    place(el['hyp-edge'], edge);
    setText(el['hyp-edge'], edge.text);
    if (money && vm.money) {
      const was = shownMoney ?? vm.money.after;
      // The figures are written the first time and then only when the dollars change; the cliff's dot rides the score
      // either way.
      if (shownMoney === null || !sameDollars(was, vm.money.after)) {
        after(el.money, startMoney, money.amount(vm.money.after));
        if (el['head-money-was']) el['head-money-was'].hidden = sameMoney(vm.money);
        countMoney(was, vm.money.after);
      }
      shownMoney = vm.money.after;
      drawCliff(vm, t, unchanged, was);
    }

    for (const input of vm.inputs) {
      const row = rows[input.id];
      const m = r.measures[input.id];
      if (!(holdMax && source === row.slider)) track(row, input);
      if (row.startMark) row.startMark.hidden = input.value === startValue[input.id];
      if (source !== row.slider) row.slider.value = String(sliderValue(input));
      row.slider.setAttribute('aria-valuetext', input.valuetext);
      if (source !== row.number) {
        row.number.value = fieldText(input);
        // The field now shows the value the what-if uses, so no refused entry is left to flag.
        if (!row.numberCheck.error.hidden) markInvalid(row.numberCheck, false);
      }
      setAttr(row.barRow, 'class', barClass(input));
      if (row.barAssigned) row.barAssigned.hidden = !assignedNow(input);
      const span = barSpan(m.contribution, vm.extent);
      row.bar.style.setProperty('--at', fraction(span.at));
      row.bar.style.setProperty('--w', fraction(span.width));
      const part = texts.bars.value(m.contribution);
      setText(row.barValue, part);
      const same = part === startPart[input.id];
      if (row.barCms && row.barCms.hidden !== same) row.barCms.hidden = same;
      if (row.partCell) {
        setText(row.partCell, same ? texts.same : part);
        // The raw number for sorting and the CSV: the part as shown, with a hyphen-minus and no plus sign.
        row.partCell.setAttribute('data-value', part.replace('\u2212', '-').replace('+', ''));
        if (same) row.partCell.setAttribute('data-same', '');
        else row.partCell.removeAttribute('data-same');
      }
      if (row.echo) {
        row.echo.hidden = !(input.id === id && echo);
        setText(row.echo, input.id === id ? echo : '');
      }
      if (row.count) {
        const count = vm.counts[input.id];
        row.count.hidden = !count;
        setText(row.count, count ? texts.predicted.result(count.delta) : '');
      }
    }
    if (el['bars-lead']) {
      const lead = changed ? texts.bars.lead(vm) : '';
      setText(el['bars-lead'], lead);
      el['bars-lead'].hidden = !lead;
    }
    if (el.banner) el.banner.hidden = !(linked && hasChanges(state));
    // On paper, a shared what-if's link carries its changes (the fragment share writes); unchanged, the page's.
    if (share && printLine) setText(printLine, texts.printAt(encode(changesOf(state), start.ids)));
    // Reset reads as unavailable while there is nothing to reset (it stays focusable and harmless).
    const dirty = hasChanges(state) || Object.values(vm.counts).some(Boolean);
    setAttr(el.reset, 'aria-disabled', String(!dirty));
    setText(el['copy-status'], '');
    env.clearTimeout(timer);
    timer = env.setTimeout(settle, SETTLE_MS);
  }

  // On commit, for one measure: its slider's track catches up with its value (a drag held it) and its field shows the
  // value the what-if uses (a blank or refused entry shows it again). vm already holds the state, so nothing else
  // moves.
  function commit(id) {
    const input = vm.inputs.find((i) => i.id === id);
    track(rows[id], input);
    rows[id].number.value = fieldText(input);
    setText(el['copy-status'], '');
  }

  // Applies an action; false when reduce() refused it (the state is unchanged).
  function apply(action, options) {
    const next = reduce(state, action);
    if (next === state) return false;
    state = next;
    draw(options);
    return true;
  }

  const behavior = () => (reducedMotion?.matches ? 'auto' : 'smooth');
  const reveal = (event) => {
    if (!env.matchMedia?.(NARROW).matches) return;
    event.target.scrollIntoView({ block: 'center', behavior: behavior() });
  };
  // A link that changed something opens on the what-if, not the top of the page. Never animated: a smooth scroll
  // started on load does not run in a background tab.
  const showLinked = () => {
    if (linked) root.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  for (const id of start.ids) {
    const row = rows[id];
    row.number.addEventListener('input', () => {
      const value = entry(row.number);
      const ok = !Number.isNaN(value) && apply({ type: 'set', id, value }, { source: row.number, id });
      markInvalid(row.numberCheck, !ok);
    });
    row.number.addEventListener('change', () => {
      markInvalid(row.numberCheck, false);
      commit(id);
    });
    row.number.addEventListener('focus', reveal);
    row.slider.addEventListener('input', () => apply({ type: 'set', id, value: Number(row.slider.value) }, { source: row.slider, holdMax: true, id }));
    row.slider.addEventListener('change', () => commit(id));
    if (row.predicted) {
      // A refused count also clears the count held for the field, so the count line never shows a stale one.
      row.predicted.addEventListener('input', () => {
        const count = entry(row.predicted);
        const ok = !Number.isNaN(count) && apply({ type: 'predicted', id, count }, { source: row.predicted });
        if (!ok) apply({ type: 'predicted', id, count: null }, { source: row.predicted });
        markInvalid(row.predictedCheck, !ok);
      });
      row.predicted.addEventListener('focus', reveal);
    }
  }

  el.reset.addEventListener('click', () => {
    linked = false;
    clearRefusedCounts();
    apply({ type: 'reset' });
  });
  el.median.addEventListener('click', () => apply({ type: 'median' }));

  if (el.solve && el.solver) {
    el.solver.hidden = true;
    el.solve.setAttribute('aria-expanded', 'false');
    el.solve.addEventListener('click', () => {
      const open = el.solver.hidden;
      el.solver.hidden = !open;
      el.solve.setAttribute('aria-expanded', String(open));
    });
  }

  // The clipboard where the browser allows it; otherwise the text, selected, in a box the reader copies from.
  el.copy.addEventListener('click', async () => {
    const text = texts.slide(vm);
    try {
      await env.navigator.clipboard.writeText(text);
      el.slide.hidden = true;
      setText(el['copy-status'], texts.copied);
    } catch {
      el.slide.value = text;
      el.slide.hidden = false;
      el.slide.focus();
      el.slide.select();
      setText(el['copy-status'], texts.copyFallback);
    }
  });

  // A scenario link opened in this tab. Any other fragment (the skip link's #main, the section's own #whatif and
  // #whatif-h) leaves the scenario alone.
  if (share) {
    env.addEventListener('hashchange', () => {
      if (!isScenarioHash(env.location.hash)) return;
      clearRefusedCounts();
      state = load(state);
      linked = hasChanges(state);
      draw();
      settle();
      showLinked();
    });
  }

  // The result's table folds on a phone (its head already says before and after); wide screens and paper keep it
  // open.
  const narrow = env.matchMedia?.(NARROW);
  if (el.detail && narrow) {
    el.detail.open = !narrow.matches;
    narrow.addEventListener?.('change', (e) => { if (!e.matches) el.detail.open = true; });
    env.addEventListener('beforeprint', () => { el.detail.open = true; });
  }

  draw();
  settle();
  el.fields.disabled = false;
  el.controls.hidden = false;
  el.copy.hidden = false;
  el.nojs.hidden = true;
  showLinked();
}
