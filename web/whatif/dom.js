// The what-if in the browser: makes the component web/whatif/render.js wrote live. Each input goes through the state's
// reduce() and viewModel(); the page changes by textContent and attributes only. The numbers move at once; the live
// sentence (and, with share, the URL fragment) follow 400 ms after the reader stops. With share, a link's fragment
// is read on load and the reader's changes are written back with history.replaceState; NHSN counts stay in memory.
// env is the window (a seam for tests): with share false, location and history are never touched. range: the ramp's
// national span of scores ({ low, high }, from the page data), as render.js drew it.
import { decode, encode } from './fragment.js';
import { changesOf, initialState, reduce, viewModel } from './state.js';
import {
  assignedNow, barClass, barExtent, barSpan, fraction, rampAt, rampDomain, rampEdge, rampLabels, rampSide, rampX, trackAt,
} from './marks.js';

const SETTLE_MS = 400;
const NARROW = '(max-width: 640px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const hasChanges = (state) => Object.keys(changesOf(state)).length > 0;

// A number field's entry: null when blank, NaN when it isn't a number.
function entry(el) {
  if (el.validity?.badInput) return NaN;
  const text = String(el.value).trim();
  return text === '' ? null : Number(text);
}

const setText = (el, text) => {
  if (el && el.textContent !== text) el.textContent = text;
};

export function mountWhatIf(root, { hospital, model, estimate, texts, share, range, env = globalThis }) {
  if (typeof share !== 'boolean') throw new TypeError('mountWhatIf: share must be true or false');
  const q = (name, scope = root) => scope.querySelector(`[data-wi="${name}"]`);
  const start = initialState(hospital, model);
  if (!start.ids.length) return;

  const rows = Object.fromEntries(start.ids.map((id) => {
    const row = root.querySelector(`[data-measure="${id}"]`);
    const bar = root.querySelector(`[data-bar="${id}"]`);
    return [id, {
      number: q('number', row),
      slider: q('slider', row),
      deadLow: q('dead-low', row),
      deadHigh: q('dead-high', row),
      medianMark: q('median-mark', row),
      capMark: q('cap-mark', row),
      predicted: q('predicted', row),
      count: q('count', row),
      error: q('error', row),
      described: q('number', row).getAttribute('aria-describedby') ?? '',
      barRow: bar,
      bar: q('bar', bar),
      barValue: q('bar-value', bar),
      barAssigned: q('bar-assigned', bar),
    }];
  }));
  const el = Object.fromEntries(['score', 'flag', 'cut', 'sentence', 'sentence-est', 'estimate', 'hyp', 'hyp-label',
    'start-label', 'hyp-edge', 'banner', 'copy',
    'copy-status', 'slide', 'solve', 'solver', 'fields', 'controls', 'nojs', 'reset', 'median'].map((name) => [name, q(name)]));

  const first = viewModel(start, hospital, model, estimate);
  const domain = rampDomain(range, first.ramp);
  const startAt = rampAt(first.ramp.actual, domain);
  const extent = barExtent(first.result, model);

  // The state a link's fragment describes: what decode() trusts goes through reduce(); the rest stays CMS's.
  const fromHash = () => {
    const { changes } = decode(env.location.hash, { ids: start.ids, params: model.params });
    return Object.entries(changes).reduce((s, [id, value]) => reduce(s, { type: 'set', id, value }), start);
  };

  let state = share ? fromHash() : start;
  let linked = share && hasChanges(state);
  let vm = first;
  let timer = null;

  function writeHash() {
    const next = encode(changesOf(state));
    const { location, history } = env;
    // Leave a fragment that isn't the what-if's (a skip link's #main) alone while there is nothing to write.
    if (next === location.hash || (next === '' && !location.hash.startsWith('#whatif'))) return;
    try {
      history.replaceState(null, '', location.pathname + location.search + next);
    } catch {
      // Some browsers rate-limit replaceState; the next change writes the fragment again.
    }
  }

  const estimateShown = () => vm.inputs.some((i) => i.tagged && vm.result.measures[i.id].changed);

  function settle() {
    setText(el.sentence, texts.sentence(vm));
    setText(el['sentence-est'], estimateShown() ? ` ${texts.estimate.text}` : '');
    if (share) writeHash();
  }

  // An SVG text at a ramp place { t, anchor, dx }.
  function place(text, { t, anchor, dx }) {
    text.setAttribute('x', rampX(t));
    text.setAttribute('text-anchor', anchor);
    text.setAttribute('dx', String(dx));
  }

  // A field's error line shows while its entry is refused, and the field names it in aria-describedby.
  function markInvalid(row, invalid) {
    row.error.hidden = !invalid;
    row.number.setAttribute('aria-describedby', invalid ? `${row.described} ${row.error.id}`.trim() : row.described);
    if (invalid) row.number.setAttribute('aria-invalid', 'true');
    else row.number.removeAttribute('aria-invalid');
  }

  function track(r, input) {
    const at = (value) => fraction(trackAt(value, input.max));
    const p = model.params[input.id];
    r.slider.setAttribute('max', String(input.max));
    r.deadLow?.style.setProperty('--to', at(p.floor));
    r.deadHigh.style.setProperty('--from', at(p.cap));
    r.medianMark.style.setProperty('--at', at(input.median));
    r.capMark.style.setProperty('--at', at(p.cap));
  }

  // source: the element the reader is using, left as they have it. holdMax: a slider mid-drag keeps its max, so
  // its thumb never runs from under the pointer; the drag's change event redraws it.
  function draw({ source = null, holdMax = false } = {}) {
    vm = viewModel(state, hospital, model, estimate);
    const r = vm.result;
    setText(el.score, texts.scores(vm).after);
    setText(el.flag, texts.flag(r.after.flag));
    setText(el.cut, texts.cut(r.after.flag) ?? '');
    el.estimate.hidden = !estimateShown();
    const t = rampAt(r.after.score, domain);
    el.hyp.setAttribute('x', rampX(t));
    const labels = rampLabels(startAt, t, texts.start, texts.hypothetical);
    place(el['start-label'], labels.start);
    place(el['hyp-label'], labels.hyp);
    const edge = rampEdge(rampSide(r.after.score, domain));
    place(el['hyp-edge'], edge);
    setText(el['hyp-edge'], edge.text);

    for (const input of vm.inputs) {
      const row = rows[input.id];
      const m = r.measures[input.id];
      if (!(holdMax && source === row.slider)) track(row, input);
      if (source !== row.slider) row.slider.value = String(input.value ?? input.max);
      row.slider.setAttribute('aria-valuetext', input.valuetext);
      if (source !== row.number) row.number.value = input.value === null ? '' : input.value.toFixed(model.params[input.id].decimals);
      row.barRow.setAttribute('class', barClass(input));
      if (row.barAssigned) row.barAssigned.hidden = !assignedNow(input);
      const span = barSpan(m.contribution, extent);
      row.bar.style.setProperty('--at', fraction(span.at));
      row.bar.style.setProperty('--w', fraction(span.width));
      setText(row.barValue, texts.bars.value(m.contribution));
      if (row.count) {
        const count = vm.counts[input.id];
        row.count.hidden = !count;
        setText(row.count, count ? texts.predicted.result(count.delta) : '');
      }
    }
    if (el.banner) el.banner.hidden = !(linked && hasChanges(state));
    setText(el['copy-status'], '');
    env.clearTimeout(timer);
    timer = env.setTimeout(settle, SETTLE_MS);
  }

  // Applies an action; false when reduce() refused it (the state is unchanged).
  function apply(action, options) {
    const next = reduce(state, action);
    if (next === state) return false;
    state = next;
    draw(options);
    return true;
  }

  const behavior = () => (env.matchMedia?.(REDUCED_MOTION).matches ? 'auto' : 'smooth');
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
      markInvalid(row, !(!Number.isNaN(value) && apply({ type: 'set', id, value }, { source: row.number })));
    });
    // On commit the field shows the value the what-if uses (a blank or refused entry shows it again).
    row.number.addEventListener('change', () => {
      markInvalid(row, false);
      draw();
    });
    row.number.addEventListener('focus', reveal);
    row.slider.addEventListener('input', () => apply({ type: 'set', id, value: Number(row.slider.value) }, { source: row.slider, holdMax: true }));
    row.slider.addEventListener('change', () => draw({ source: row.slider }));
    if (row.predicted) {
      row.predicted.addEventListener('input', () => {
        const count = entry(row.predicted);
        if (!Number.isNaN(count)) apply({ type: 'predicted', id, count }, { source: row.predicted });
      });
      row.predicted.addEventListener('focus', reveal);
    }
  }

  el.reset.addEventListener('click', () => {
    linked = false;
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

  // A what-if link opened in this tab. Any other fragment (the skip link's #main) leaves the scenario alone.
  if (share) {
    env.addEventListener('hashchange', () => {
      if (!env.location.hash.startsWith('#whatif')) return;
      state = { ...fromHash(), predicted: state.predicted };
      linked = hasChanges(state);
      draw();
      settle();
      showLinked();
    });
  }

  draw();
  settle();
  el.fields.disabled = false;
  el.controls.hidden = false;
  el.copy.hidden = false;
  el.nojs.hidden = true;
  showLinked();
}
