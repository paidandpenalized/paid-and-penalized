// The what-if's browser module without a browser. The fake DOM is read from the component render.js writes for the
// same hospital: an element exists only if the markup has it (querySelector returns null otherwise), with the
// markup's attributes. The stub window records every read of location and history. Synthetic hospitals (CCNs
// 990026-990028) on the FY2026 model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { toUnit } from '../../../engine/js/stats.js';
import { SYNTH_VALUES, modelHospital } from '../../../engine/js/test/hacrp/synthetic.js';
import { mountWhatIf } from '../../../web/whatif/dom.js';
import { NARROW_PX, labelSpan, rampX } from '../../../web/whatif/marks.js';
import { renderWhatIf } from '../../../web/whatif/render.js';
import { loadHacrp } from '../web/data.js';
import { scoreRange } from '../web/generate.js';
import { initialState, solverOf, viewModel, whatIfRules } from '../web/whatif-state.js';
import { textsFor as fixtureTexts } from './fixtures.js';

const D = loadHacrp();
const { model, estimate } = D;
const RANGE = scoreRange(D.hospitals);
const PATH = '/hacrp/hospital/990026/';
const V = SYNTH_VALUES.no;
const H = modelHospital(model, '990026', { values: V });
const ASSIGNED = modelHospital(model, '990027', { values: SYNTH_VALUES.assigned });
const MARYLAND = modelHospital(model, '990028', { values: V, decision: 'N/A', state: 'MD' });
// Every hospital's texts on the one page the stub window is at.
const textsFor = (h) => fixtureTexts(D, h, { path: PATH });
const texts = textsFor(H);

const ATTR = /\s([\w:-]+)(?:="([^"]*)")?/g;
// One element: its opening tag's attributes, and the markup inside it (chunk) to look its children up in.
function node(tag, chunk) {
  const attrs = new Map([...tag.replace(/^<\w+/, '').matchAll(ATTR)].map(([, k, v]) => [k, v ?? '']));
  const listeners = new Map();
  const kids = new Map();
  const el = {
    id: attrs.get('id') ?? '', hidden: attrs.has('hidden'), disabled: attrs.has('disabled'), value: attrs.get('value') ?? '',
    textContent: '', attrs, style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); } },
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    removeAttribute: (k) => attrs.delete(k),
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    fire: (type) => (listeners.get(type) ?? []).forEach((fn) => fn({ type, target: el, currentTarget: el })),
    querySelector(sel) {
      if (!kids.has(sel)) kids.set(sel, find(chunk, sel));
      return kids.get(sel);
    },
    focus() {}, select() { el.selected = true; }, scrollIntoView(options) { el.scrolled = true; el.scrollOptions = options; },
  };
  return el;
}

// The selectors dom.js uses: [data-wi="…"], [data-measure="…"], [data-bar="…"]. null when the markup lacks it.
function find(chunk, sel) {
  const [, kind, name] = /^\[data-(wi|measure|bar)="([^"]+)"\]$/.exec(sel);
  const at = chunk.indexOf(` data-${kind}="${name}"`);
  if (at === -1) return null;
  const open = chunk.lastIndexOf('<', at);
  const tag = chunk.slice(open, chunk.indexOf('>', at) + 1);
  const ends = { wi: [], measure: ['data-measure="', '</fieldset>'], bar: ['</li>'] }[kind];
  const end = Math.min(...ends.map((e) => chunk.indexOf(e, at + 2)).filter((i) => i !== -1), chunk.length);
  return node(tag, chunk.slice(open, end));
}

const rootFor = (h, share, t = textsFor(h)) => {
  const html = String(renderWhatIf({ vm: viewModel(initialState(h, model), h, model, estimate), texts: t, share, range: RANGE, solver: solverOf(h, model) }));
  return node(/^<section[^>]*>/.exec(html)[0], html);
};

function windowStub({ hash = '', clipboard } = {}) {
  const touched = [];
  const urls = [];
  const listeners = {};
  let timers = [];
  const location = { hash, pathname: PATH, search: '' };
  const history = { replaceState(_state, _title, url) { urls.push(url); location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } };
  const base = {
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
    navigator: clipboard ? { clipboard } : {},
    addEventListener: (type, fn) => { touched.push(`listen:${type}`); listeners[type] = fn; },
  };
  const env = new Proxy(base, {
    get(target, key) {
      if (key === 'location' || key === 'history') touched.push(key);
      if (key === 'location') return location;
      if (key === 'history') return history;
      return target[key];
    },
  });
  const flush = () => { const run = timers; timers = []; run.forEach((fn) => fn()); };
  const navigate = (next) => { location.hash = next; listeners.hashchange?.(); };
  return { env, touched, urls, flush, navigate };
}

const mount = (share, stub, h = H) => {
  const root = rootFor(h, share);
  mountWhatIf(root, { rules: whatIfRules(h, model, estimate), texts: textsFor(h), share, range: RANGE, env: stub.env });
  return root;
};
const q = (root, name) => root.querySelector(`[data-wi="${name}"]`);
const field = (root, id, name) => root.querySelector(`[data-measure="${id}"]`).querySelector(`[data-wi="${name}"]`);
const type = (el, text) => { el.value = text; el.fire('input'); };

test('mounting enables the fields, shows the buttons, hides the no-script note and folds the solver', () => {
  const root = mount(false, windowStub());
  assert.equal(q(root, 'fields').disabled, false);
  assert.equal(q(root, 'controls').hidden, false);
  assert.equal(q(root, 'nojs').hidden, true);
  assert.equal(q(root, 'solver').hidden, true);
  assert.equal(q(root, 'solve').getAttribute('aria-expanded'), 'false');
  q(root, 'solve').fire('click');
  assert.equal(q(root, 'solver').hidden, false);
  assert.equal(q(root, 'solve').getAttribute('aria-expanded'), 'true');
});

test('share: false never reads or writes location or history, and does not listen for hash changes', () => {
  const stub = windowStub({ hash: '#whatif&MRSA=1.4' });
  const root = mount(false, stub);
  assert.equal(q(root, 'score').textContent, '0.2734', 'a fragment is ignored without share');
  type(field(root, 'MRSA', 'number'), '1.4');
  type(field(root, 'CLABSI', 'predicted'), '3');
  q(root, 'median').fire('click');
  q(root, 'reset').fire('click');
  stub.flush();
  assert.deepEqual(stub.touched.filter((t) => t === 'location' || t === 'history' || t === 'listen:hashchange'), []);
});

test('typing updates the numbers at once and the live sentence after the delay', () => {
  const stub = windowStub();
  const root = mount(true, stub);
  type(field(root, 'MRSA', 'number'), '1.4');
  assert.equal(q(root, 'score').textContent, '0.4476');
  assert.equal(q(root, 'flag').textContent, 'Yes');
  assert.equal(q(root, 'cut').textContent, '1%');
  assert.match(q(root, 'sentence').textContent, /^CMS reports a Total HAC Score/, 'live region waits');
  stub.flush();
  assert.match(q(root, 'sentence').textContent, /^With MRSA at 1\.400 instead of 0\.900/);
  assert.deepEqual(stub.urls, [`${PATH}#whatif&MRSA=1.4`]);
  assert.equal(field(root, 'MRSA', 'slider').value, '1.4');
  assert.match(field(root, 'MRSA', 'slider').getAttribute('aria-valuetext'), /^1\.400/);
});

test('a slider drag leaves its max alone until the change is committed', () => {
  const root = mount(false, windowStub());
  const slider = field(root, 'MRSA', 'slider');
  const before = slider.getAttribute('max');
  type(slider, '2.1');
  assert.equal(slider.getAttribute('max'), before);
  slider.fire('change');
  assert.equal(slider.getAttribute('max'), '2.52');
  assert.equal(field(root, 'MRSA', 'number').value, '2.100');
});

test('a commit redraws its own row from the current view model, computing no new one', () => {
  const rules = whatIfRules(H, model, estimate);
  let computed = 0;
  const counted = { ...rules, viewModel: (state) => { computed++; return rules.viewModel(state); } };
  const root = rootFor(H, false);
  mountWhatIf(root, { rules: counted, texts, share: false, range: RANGE, env: windowStub().env });
  const slider = field(root, 'MRSA', 'slider');
  type(slider, '2.1');
  const before = computed;
  slider.fire('change');
  field(root, 'MRSA', 'number').fire('change');
  assert.equal(computed, before);
  assert.equal(slider.getAttribute('max'), '2.52');
  assert.equal(field(root, 'MRSA', 'number').value, '2.100');
});

test('a bad or blank entry: blank restores the starting value; out of range is ignored and flagged', () => {
  const root = mount(false, windowStub());
  const n = field(root, 'MRSA', 'number');
  type(n, '99999');
  assert.equal(n.getAttribute('aria-invalid'), 'true');
  assert.equal(q(root, 'score').textContent, '0.2734');
  type(n, '1.4');
  assert.equal(n.getAttribute('aria-invalid'), null);
  type(n, '');
  assert.equal(q(root, 'score').textContent, '0.2734');
  n.fire('change');
  assert.equal(n.value, '0.900');
});

test('a shared link: the decoded changes apply, bad parts are ignored, the banner shows; reset clears both', () => {
  const stub = windowStub({ hash: '#whatif&MRSA=1.4&CLABSI=abc&MRSA2=1' });
  const root = mount(true, stub);
  assert.equal(q(root, 'banner').hidden, false);
  assert.equal(field(root, 'MRSA', 'number').value, '1.400');
  assert.equal(field(root, 'CLABSI', 'number').value, '0.800');
  assert.equal(q(root, 'score').textContent, '0.4476');
  assert.match(q(root, 'sentence').textContent, /^With MRSA at 1\.400/, 'the opening sentence needs no wait');
  assert.ok(stub.touched.includes('listen:hashchange'));
  q(root, 'reset').fire('click');
  stub.flush();
  assert.equal(q(root, 'banner').hidden, true);
  assert.equal(stub.urls.at(-1), PATH);
});

test('a new what-if fragment in the open page applies; another anchor (the skip link) leaves the scenario alone', () => {
  const stub = windowStub();
  const root = mount(true, stub);
  stub.navigate('#whatif&MRSA=1.4');
  assert.equal(q(root, 'score').textContent, '0.4476');
  assert.equal(q(root, 'banner').hidden, false);
  stub.navigate('#main');
  assert.equal(q(root, 'score').textContent, '0.4476');
  assert.equal(field(root, 'MRSA', 'number').value, '1.400');
});

test('a link that changes nothing (all parts bad, or not a what-if fragment) shows no banner', () => {
  for (const hash of ['#whatif&MRSA=abc&PSI90=-1', '#main', '#whatif&MRSA=0.9']) {
    const root = mount(true, windowStub({ hash }));
    assert.equal(q(root, 'banner').hidden, true, hash);
    assert.equal(q(root, 'score').textContent, '0.2734', hash);
  }
});

test('NHSN predicted counts reach the count line and never the fragment', () => {
  const stub = windowStub();
  const root = mount(true, stub);
  type(field(root, 'CLABSI', 'predicted'), '12.3456');
  type(field(root, 'CLABSI', 'number'), '1.8');
  stub.flush();
  assert.match(field(root, 'CLABSI', 'count').textContent, /more infections/);
  assert.equal(field(root, 'CLABSI', 'count').hidden, false);
  for (const url of stub.urls) assert.doesNotMatch(url, /12\.3|predicted/);
  assert.equal(field(root, 'CLABSI', 'predicted').getAttribute('value'), null, 'the count is never written to an attribute');
});

test('median and reset buttons', () => {
  const root = mount(false, windowStub());
  q(root, 'median').fire('click');
  const p = model.params.MRSA;
  assert.equal(field(root, 'MRSA', 'number').value, toUnit(p.median, p.decimals).toFixed(p.decimals));
  q(root, 'reset').fire('click');
  assert.equal(field(root, 'MRSA', 'number').value, '0.900');
});

test('copy for a slide: the clipboard when it works, else the text selected in a box', async () => {
  let copied = null;
  const ok = windowStub({ clipboard: { writeText: async (text) => { copied = text; } } });
  const root = mount(false, ok);
  type(field(root, 'MRSA', 'number'), '1.4');
  q(root, 'copy').fire('click');
  await new Promise((r) => setImmediate(r));
  assert.match(copied, /Hypothetical/);
  assert.match(copied, /A what-if shows the formula/);
  assert.equal(q(root, 'copy-status').textContent, texts.copied);

  const none = windowStub();
  const root2 = mount(false, none);
  q(root2, 'copy').fire('click');
  await new Promise((r) => setImmediate(r));
  const box = q(root2, 'slide');
  assert.equal(box.hidden, false);
  assert.ok(box.selected);
  assert.match(box.value, /Total HAC Score/);
  assert.equal(q(root2, 'copy-status').textContent, texts.copyFallback);
});

test('a refused entry shows its error line, named by the field; a valid entry or a commit hides it', () => {
  const root = mount(false, windowStub());
  const n = field(root, 'MRSA', 'number');
  const error = field(root, 'MRSA', 'error');
  const base = n.getAttribute('aria-describedby');
  assert.equal(error.hidden, true);
  type(n, '99999');
  assert.equal(error.hidden, false);
  assert.equal(n.getAttribute('aria-describedby'), `${base} wi-MRSA-e`);
  type(n, '1.4');
  assert.equal(error.hidden, true);
  assert.equal(n.getAttribute('aria-describedby'), base);
  type(n, '99999');
  n.fire('change');
  assert.equal(error.hidden, true);
  assert.equal(n.getAttribute('aria-invalid'), null);
  assert.equal(n.value, '1.400');
});

test('the ramp: a hypothetical past the range clamps to the edge with an arrow; labels never overlap', () => {
  const root = mount(false, windowStub());
  const labelsApart = () => {
    const span = (name, chars) => {
      const el = q(root, name);
      return labelSpan({ t: (parseFloat(el.getAttribute('x')) - 5) / 90, anchor: el.getAttribute('text-anchor'), dx: Number(el.getAttribute('dx')) }, chars, NARROW_PX);
    };
    const [s, h] = [span('start-label', texts.start.length), span('hyp-label', texts.hypothetical.length)];
    return s[1] <= h[0] || h[1] <= s[0];
  };
  type(field(root, 'MRSA', 'number'), '1.4');
  assert.equal(q(root, 'hyp-edge').textContent, '');
  assert.ok(labelsApart());
  for (const id of Object.keys(V)) type(field(root, id, 'number'), '5');
  assert.equal(q(root, 'hyp').getAttribute('x'), rampX(1));
  assert.equal(q(root, 'hyp-edge').textContent, '▶');
  assert.ok(labelsApart());
  q(root, 'reset').fire('click');
  assert.equal(q(root, 'hyp-edge').textContent, '');
  assert.ok(labelsApart(), 'no change: both marks at one place, labels side by side');
});

test('the live region carries the estimate note when a tagged measure changed', () => {
  const tagged = Object.keys(estimate).find((id) => estimate[id].tagged);
  const untagged = Object.keys(estimate).find((id) => !estimate[id].tagged);
  const stub = windowStub();
  const root = mount(false, stub);
  type(field(root, untagged, 'number'), '0.3');
  stub.flush();
  assert.equal(q(root, 'sentence-est').textContent, '');
  type(field(root, tagged, 'number'), '0.3');
  stub.flush();
  assert.equal(q(root, 'sentence-est').textContent, ` ${texts.estimate.text}`);
});

test('a link that changed something scrolls the what-if into view; a clean page does not', () => {
  assert.equal(mount(true, windowStub({ hash: '#whatif&MRSA=1.4' })).scrolled, true);
  assert.equal(mount(true, windowStub()).scrolled, undefined);
  assert.equal(mount(true, windowStub({ hash: '#whatif&MRSA=abc' })).scrolled, undefined);
});

test('the scroll on load never animates: a smooth scroll does not run in a background tab', () => {
  const smooth = windowStub({ hash: '#whatif&MRSA=1.4' });
  smooth.matchMedia = () => ({ matches: false });
  assert.equal(mount(true, smooth).scrollOptions.behavior, 'auto');
  const reduced = windowStub({ hash: '#whatif&MRSA=1.4' });
  reduced.matchMedia = (q) => ({ matches: q.includes('reduce') });
  assert.equal(mount(true, reduced).scrollOptions.behavior, 'auto');
});

test('an assigned measure\'s bar follows the state: hatched and noted until the reader enters a value', () => {
  const root = mount(false, windowStub(), ASSIGNED);
  const bar = root.querySelector('[data-bar="SSI"]');
  const note = bar.querySelector('[data-wi="bar-assigned"]');
  assert.match(bar.getAttribute('class'), /--assigned/);
  type(field(root, 'SSI', 'number'), '0.8');
  assert.doesNotMatch(bar.getAttribute('class'), /--assigned/);
  assert.equal(note.hidden, true);
  type(field(root, 'SSI', 'number'), '');
  assert.match(bar.getAttribute('class'), /--assigned/);
  assert.equal(note.hidden, false);
});

test('mounting on markup that lacks parts never throws: Maryland, share false, an assigned measure, the median hospital', () => {
  assert.equal(rootFor(MARYLAND, true).querySelector('[data-wi="solve"]'), null, 'the fake returns null for absent parts');
  assert.equal(rootFor(H, false).querySelector('[data-wi="banner"]'), null);
  for (const [h, share] of [[MARYLAND, true], [MARYLAND, false], [H, false], [ASSIGNED, true]]) {
    const stub = windowStub({ hash: '#whatif&MRSA=1.4' });
    const root = mount(share, stub, h);
    type(field(root, 'MRSA', 'number'), '1.2');
    q(root, 'median').fire('click');
    q(root, 'reset').fire('click');
    stub.flush();
  }
  const m = medianHospital(model, { fiscalYear: String(D.fy), periods: D.periods });
  const t = fixtureTexts(D, m, { name: null, path: '/hacrp/', baseline: 'sandbox' });
  const root = rootFor(m, false, t);
  mountWhatIf(root, { rules: whatIfRules(m, model, estimate), texts: t, share: false, range: RANGE, env: windowStub().env });
  type(field(root, 'MRSA', 'number'), '1.2');
});

test('share is required', () => {
  assert.throws(() => mountWhatIf(rootFor(H, false), { rules: whatIfRules(H, model, estimate), texts, range: RANGE, env: windowStub().env }), /share/);
});

test('the section\'s own anchors (#whatif, #whatif-h) never reset the reader\'s scenario, and are not stripped on load', () => {
  const stub = windowStub();
  const root = mount(true, stub);
  type(field(root, 'MRSA', 'number'), '1.4');
  for (const anchor of ['#whatif', '#whatif-h']) {
    stub.navigate(anchor);
    assert.equal(q(root, 'score').textContent, '0.4476', anchor);
    assert.equal(field(root, 'MRSA', 'slider').value, '1.4', anchor);
  }
  const heading = windowStub({ hash: '#whatif-h' });
  mount(true, heading);
  heading.flush();
  assert.deepEqual(heading.urls, [], 'a heading anchor is left in the URL');
});

test('a refused NHSN count shows its error line, named by the field, and hides the count line until a good count', () => {
  const stub = windowStub();
  const root = mount(true, stub);
  const p = field(root, 'CLABSI', 'predicted');
  const error = field(root, 'CLABSI', 'predicted-error');
  const count = field(root, 'CLABSI', 'count');
  const base = p.getAttribute('aria-describedby');
  assert.equal(error.hidden, true);
  assert.equal(error.id, 'wi-CLABSI-pe');
  type(p, '12');
  type(field(root, 'CLABSI', 'number'), '1.8');
  assert.equal(count.hidden, false);
  for (const bad of ['-3', 'abc']) {
    type(p, bad);
    assert.equal(error.hidden, false, bad);
    assert.equal(p.getAttribute('aria-invalid'), 'true', bad);
    assert.equal(p.getAttribute('aria-describedby'), `${base} wi-CLABSI-pe`, bad);
    assert.equal(count.hidden, true, bad);
  }
  type(field(root, 'MRSA', 'number'), '1.2');
  assert.equal(count.hidden, true, 'another field\'s redraw never brings back the old count');
  type(p, '5');
  assert.equal(error.hidden, true);
  assert.equal(p.getAttribute('aria-invalid'), null);
  assert.equal(p.getAttribute('aria-describedby'), base);
  assert.equal(count.hidden, false);
  type(p, '');
  assert.equal(error.hidden, true, 'blank clears the count, with no error');
  assert.equal(count.hidden, true);
});

test('reset and a new scenario link clear every field\'s error state', () => {
  for (const clear of [(root) => q(root, 'reset').fire('click'), (root, stub) => stub.navigate('#whatif&MRSA=1.4')]) {
    const stub = windowStub();
    const root = mount(true, stub);
    const n = field(root, 'MRSA', 'number');
    const p = field(root, 'CLABSI', 'predicted');
    type(p, '-3');
    type(n, '99999');
    assert.equal(field(root, 'MRSA', 'error').hidden, false);
    assert.equal(field(root, 'CLABSI', 'predicted-error').hidden, false);
    clear(root, stub);
    assert.equal(field(root, 'MRSA', 'error').hidden, true);
    assert.equal(n.getAttribute('aria-invalid'), null);
    assert.equal(field(root, 'CLABSI', 'predicted-error').hidden, true);
    assert.equal(p.getAttribute('aria-invalid'), null);
    assert.equal(p.value, '', 'the refused count is cleared with its error');
  }
});

test('a field rewritten by another action shows the what-if\'s value and drops its error', () => {
  const root = mount(false, windowStub());
  const n = field(root, 'MRSA', 'number');
  type(n, '99999');
  q(root, 'median').fire('click');
  assert.equal(field(root, 'MRSA', 'error').hidden, true);
  assert.equal(n.getAttribute('aria-invalid'), null);
});
