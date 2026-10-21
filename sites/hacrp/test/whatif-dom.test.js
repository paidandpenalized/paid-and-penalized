// The what-if's browser module without a browser: a fake root that hands out one stub element per selector, and a
// stub window that records every read of location and history. Synthetic hospital (CCN 990026) on the FY2026 model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelHospital } from '../../../engine/js/test/hacrp/synthetic.js';
import { mountWhatIf } from '../../../web/whatif/dom.js';
import { loadHacrp } from '../web/data.js';
import { whatIfTexts } from '../web/whatif-text.js';

const D = loadHacrp();
const { model, estimate } = D;
const PATH = '/hacrp/hospital/990026/';
const H = modelHospital(model, '990026', { values: { PSI90: 1.0, CLABSI: 0.8, CAUTI: 0.6, SSI: 0.9, CDI: 0.5, MRSA: 0.9 } });
const texts = whatIfTexts({ hospital: H, model, name: 'Example General Hospital', fy: D.fy, path: PATH, source: D.source, boundaryText: D.boundaryText });

function element(selector) {
  const listeners = new Map();
  const children = new Map();
  const attrs = new Map();
  const el = {
    selector, hidden: false, disabled: false, textContent: '', value: '', attrs, style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); } },
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    removeAttribute: (k) => attrs.delete(k),
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    fire: (type) => (listeners.get(type) ?? []).forEach((fn) => fn({ type, target: el, currentTarget: el })),
    querySelector: (sel) => children.get(sel) ?? children.set(sel, element(sel)).get(sel),
    focus() {}, select() { el.selected = true; }, scrollIntoView() { el.scrolled = true; },
  };
  return el;
}

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

const mount = (share, stub) => {
  const root = element('#whatif');
  mountWhatIf(root, { hospital: H, model, estimate, texts, share, env: stub.env });
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
  assert.equal(field(root, 'MRSA', 'number').value, (Math.round(model.params.MRSA.median * 1000) / 1000).toFixed(3));
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
