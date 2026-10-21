// The what-if component on hospital pages: its build-time HTML (synthetic hospitals, CCNs 990021-990029, that agree
// with the real FY2026 model), the page it sits on (pinned rows picked by property), and the browser bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build as esbuild } from 'esbuild';
import { modelHospital } from '../../../engine/js/test/hacrp/synthetic.js';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { MAX_FACTOR, encode, toUnit } from '../../../web/whatif/fragment.js';
import { renderWhatIf } from '../../../web/whatif/render.js';
import { changesOf, initialState, reduce, viewModel } from '../../../web/whatif/state.js';
import { loadHacrp } from '../web/data.js';
import { HACRP } from '../web/generate.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalView } from '../web/view.js';
import { whatIfTexts } from '../web/whatif-text.js';
import { master } from './fixtures.js';

const D = loadHacrp();
const { model, estimate } = D;
const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js', 'hacrp-hospital': '/assets/hacrp-hospital.test.js' } };
const SIRS = ['CLABSI', 'CAUTI', 'SSI', 'CDI', 'MRSA'];
const V = { PSI90: 1.0, CLABSI: 0.8, CAUTI: 0.6, SSI: 0.9, CDI: 0.5, MRSA: 0.9 };
const H = {
  no: modelHospital(model, '990021', { values: V }),
  yes: modelHospital(model, '990022', { values: { PSI90: 1.05, CLABSI: 1.2, CAUTI: 0.8, SSI: 1.0, CDI: 0.6, MRSA: 1.2 } }),
  assigned: modelHospital(model, '990023', { values: { ...V, SSI: 'assigned' } }),
  maryland: modelHospital(model, '990024', { values: V, decision: 'N/A', state: 'MD' }),
  three: modelHospital(model, '990025', { values: { PSI90: 1.0, CLABSI: 0.8, MRSA: 0.9 } }),
};
const STANDING = "A penalty reflects how CMS's formula scored relative performance; it is not a verdict on the quality of care.";
const WHATIF_STANDING = "A what-if shows the formula's arithmetic, not what a hospital could realistically change or how. "
  + "CMS's real result also depends on other hospitals.";
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const textsFor = (h) => whatIfTexts({
  hospital: h, model, name: 'Example General Hospital', fy: D.fy, path: `/hacrp/hospital/${h.ccn.toLowerCase()}/`,
  source: D.source, boundaryText: D.boundaryText,
});
const render = (h, state = initialState(h, model), share = true) =>
  String(renderWhatIf({ vm: viewModel(state, h, model, estimate), hospital: h, model, texts: textsFor(h), share }));
const all = (text, re) => [...text.matchAll(re)];
const inputsOf = (text, type) => all(text, new RegExp(`<input[^>]*type="${type}"[^>]*>`, 'g')).map(([tag]) => tag);
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

test('one section, one polite live region, "Hypothetical" in the result, the what-if standing line under it', () => {
  const text = render(H.no);
  assert.equal(all(text, /<section[^>]*id="whatif"/g).length, 1);
  assert.equal(all(text, /aria-live=/g).length, 1);
  assert.match(text, /aria-live="polite"/);
  const result = /data-wi="result"[\s\S]*?data-wi="copy"/.exec(text)[0];
  assert.match(result, /Hypothetical/);
  assert.ok(text.includes(esc(WHATIF_STANDING)));
  assert.ok(text.lastIndexOf(esc(WHATIF_STANDING)) > text.lastIndexOf('data-wi="solver"'), 'standing line comes last');
  assert.ok(text.includes(esc("CMS reports a Total HAC Score of 0.2734 and a payment reduction decision of No.")), 'sentence from CMS values');
});

test('a slider and a number field per scored measure, with labels, valuetext, CMS values and the share range', () => {
  for (const h of [H.no, H.three]) {
    const state = initialState(h, model);
    const text = render(h, state);
    const sliders = inputsOf(text, 'range');
    const numbers = inputsOf(text, 'number').filter((tag) => tag.includes('data-wi="number"'));
    assert.equal(sliders.length, state.ids.length, h.ccn);
    assert.equal(numbers.length, state.ids.length, h.ccn);
    state.ids.forEach((id, i) => {
      const p = model.params[id];
      assert.ok(attr(sliders[i], 'aria-valuetext'), `${id} valuetext`);
      assert.equal(attr(numbers[i], 'value'), h.measures[id].value.toFixed(p.decimals), `${id} starts at CMS's value`);
      assert.equal(Number(attr(numbers[i], 'max')), toUnit(MAX_FACTOR * p.cap, p.decimals), `${id} number max`);
      assert.equal(Number(attr(sliders[i], 'step')), 1 / 10 ** p.decimals);
      for (const tag of [sliders[i], numbers[i]]) assert.match(text, new RegExp(`<label[^>]*for="${attr(tag, 'id')}"`), `${id} label`);
    });
  }
});

test('helper text, leverage, weight, marks and the dead zone', () => {
  const text = render(H.no);
  assert.equal(all(text, /SIR 1\.0 = as many infections as predicted/g).length, SIRS.length);
  assert.match(text, /lower is better/i);
  assert.ok(text.includes('Each measure weighs 1 ÷ 6 of the score.'));
  const vm = viewModel(initialState(H.no, model), H.no, model, estimate);
  const lev = vm.result.measures.MRSA.leveragePerTenth.toFixed(4);
  assert.ok(text.includes(`Each 0.1 moves the score by ${lev}`), 'leverage per 0.1');
  assert.equal(all(text, /data-wi="median-mark"/g).length, 6);
  assert.equal(all(text, /data-wi="cap-mark"/g).length, 6);
  assert.equal(all(text, /data-wi="dead-high"/g).length, 6);
  // PSI 90 has a floor above zero, so it is the one measure shaded below as well.
  assert.equal(all(text, /data-wi="dead-low"/g).length, model.params.PSI90.floor > 0 ? 1 : 0);
  assert.ok(text.includes(`CMS cap ${model.params.MRSA.cap.toFixed(3)}`));
});

test('the result box: before and after, the ramp with a solid and a hollow mark, the line, the cut', () => {
  const text = render(H.no, reduce(initialState(H.no, model), { type: 'set', id: 'MRSA', value: 1.4 }));
  const result = /data-wi="result"[\s\S]*?data-wi="copy"/.exec(text)[0];
  assert.match(result, /0\.2734/);
  assert.match(result, /data-wi="score"[^>]*>0\.4476</);
  assert.match(result, /data-wi="flag"[^>]*>Yes</);
  assert.match(result, /data-wi="cut"[^>]*>1%</);
  assert.match(result, /<svg[^>]*class="wi-ramp"/);
  assert.match(result, /class="wi-tri wi-tri--cms"/);
  assert.match(result, /class="wi-tri wi-tri--hyp"[^>]*data-wi="hyp"/);
  assert.match(result, /CMS(&#39;|')s line/);
  assert.ok(result.includes(esc(`Among hospitals with a Yes or No payment decision, CMS cut those with a published Total HAC Score of ${D.boundaryText.lowestYes} or higher`)));
  assert.doesNotMatch(result, /#[0-9a-f]{3,6}\b/i, 'colors come from tokens');
});

test('estimate tag: shown when a tagged measure changed, hidden otherwise', () => {
  const tagged = Object.keys(estimate).find((id) => estimate[id].tagged);
  const untagged = Object.keys(estimate).find((id) => !estimate[id].tagged);
  const shown = (state) => !/data-wi="estimate"[^>]*hidden/.test(render(H.no, state));
  const s = initialState(H.no, model);
  assert.equal(shown(s), false);
  assert.equal(shown(reduce(s, { type: 'set', id: untagged, value: 0.1 })), false);
  assert.equal(shown(reduce(s, { type: 'set', id: tagged, value: 0.3 })), true);
});

test('an assigned measure: blank field naming CMS\'s assigned score, slider at its max, no NHSN field', () => {
  const text = render(H.assigned);
  const field = inputsOf(text, 'number').find((tag) => tag.includes('id="wi-SSI-n"'));
  assert.equal(attr(field, 'value'), '');
  assert.ok(attr(field, 'placeholder').includes(H.assigned.measures.SSI.zText));
  const slider = inputsOf(text, 'range').find((tag) => tag.includes('id="wi-SSI-r"'));
  assert.equal(attr(slider, 'value'), attr(slider, 'max'));
  assert.equal(attr(slider, 'aria-valuetext'), 'no value: CMS assigned the worst score');
  assert.match(text, /had it been submitted/);
  assert.doesNotMatch(text, /id="wi-SSI-p"/);
});

test('NHSN predicted counts: one optional field per submitted SIR, naming the HAI period; no count in any attribute or URL', () => {
  const text = render(H.no);
  const fields = inputsOf(text, 'number').filter((tag) => tag.includes('data-wi="predicted"'));
  assert.equal(fields.length, SIRS.length);
  for (const tag of fields) {
    assert.equal(attr(tag, 'value'), undefined);
    assert.equal(attr(tag, 'name'), undefined, 'never submitted with a form');
    assert.equal(attr(tag, 'autocomplete'), 'off');
  }
  assert.match(text, /January 1, 2023 to December 31, 2024/);
  assert.match(text, /stays in your browser; never sent/i);
  assert.doesNotMatch(text, /id="wi-PSI90-p"/);

  let s = initialState(H.no, model);
  s = reduce(s, { type: 'set', id: 'CLABSI', value: 1.1 });
  s = reduce(s, { type: 'predicted', id: 'CLABSI', count: 12.3456 });
  const withCount = render(H.no, s);
  assert.doesNotMatch(withCount, /12\.34/);
  assert.doesNotMatch(encode(changesOf(s)), /12\.34/);
});

test('Maryland: the score moves, the decision reads N/A (not subject to the reduction), no cut and no solver', () => {
  const text = render(H.maryland, reduce(initialState(H.maryland, model), { type: 'set', id: 'MRSA', value: 1.4 }));
  assert.match(text, /data-wi="flag"[^>]*>N\/A \(not subject to the reduction\)</);
  assert.doesNotMatch(text, /data-wi="cut"/);
  assert.doesNotMatch(text, /data-wi="solve"|data-wi="solver"/);
  assert.equal(inputsOf(text, 'range').length, 6);
});

test('buttons and the solver: reset, median, the question by CMS\'s decision; rows from the starting values', () => {
  const no = render(H.no);
  const yes = render(H.yes);
  for (const text of [no, yes]) {
    assert.match(text, /<button type="button"[^>]*data-wi="reset"[^>]*>Reset</);
    assert.match(text, /data-wi="median"[^>]*>Bring all to the national median</);
    assert.match(text, /data-wi="solve"[^>]*aria-controls="wi-solver"/);
    assert.match(text, /id="wi-solver"/);
    assert.match(text, /From CMS(&#39;|')s values, one measure at a time/);
  }
  assert.match(no, /How much cushion\?/);
  assert.match(yes, /What would it take\?/);
  // The solver table answers from CMS's values whatever the reader has changed.
  const changed = render(H.no, reduce(initialState(H.no, model), { type: 'set', id: 'MRSA', value: 1.4 }));
  const table = (t) => /id="wi-solver"[\s\S]*?<\/table>/.exec(t)[0];
  assert.equal(table(changed), table(no));
});

test('contribution bars in fixed measure order; an assigned measure is marked', () => {
  const text = render(H.assigned);
  assert.deepEqual(all(text, /data-bar="(\w+)"/g).map((m) => m[1]), ['PSI90', 'CLABSI', 'CAUTI', 'SSI', 'CDI', 'MRSA']);
  assert.match(/data-bar="SSI"[^>]*>/.exec(text)[0], /wi-bars__row--assigned/);
});

test('share: the banner (hidden until a link changes something) links to the clean page; none without share', () => {
  const text = render(H.no);
  assert.match(text, /<p class="wi-banner"[^>]*data-wi="banner"[^>]*hidden>Reader-made scenario, not CMS data\. <a href="\/hacrp\/hospital\/990021\/">/);
  assert.doesNotMatch(render(H.no, undefined, false), /data-wi="banner"/);
});

test('without JavaScript: inputs are disabled and say so; buttons hidden', () => {
  const text = render(H.no);
  assert.match(text, /<fieldset[^>]*data-wi="fields"[^>]*disabled>/);
  assert.match(text, /data-wi="controls"[^>]*hidden/);
  assert.match(text, /data-wi="nojs"/);
});

// The pages, on pinned rows picked by property.
const pick = (pred, what) => {
  const h = D.hospitals.find(pred);
  assert.ok(h, `no pinned row: ${what}`);
  return h;
};
const pageFor = (h) => hospitalPage({
  view: hospitalView({ hospital: h, model, estimate, footnotes: D.footnotes, master: D.master.get(h.ccn), fy: D.fy, periods: D.periods, boundaryText: D.boundaryText }),
  source: D.source, robots: 'noindex', assets: ASSETS, whatif: { hospital: h, model, estimate },
});

test('a scored page carries the what-if, both standing lines, its own record as page data, and the client module', () => {
  const h = pick((x) => x.total !== null && x.paymentReduction === 'Yes', 'scored Yes');
  const text = pageFor(h);
  assert.match(text, /<section[^>]*id="whatif"/);
  assert.ok(text.includes(esc(STANDING)));
  assert.ok(text.includes(esc(WHATIF_STANDING)));
  const json = /<script type="application\/json" id="hacrp-hospital">(.*?)<\/script>/s.exec(text)[1];
  const data = JSON.parse(json);
  assert.deepEqual(Object.keys(data).sort(), ['estimate', 'hospital', 'model', 'page']);
  assert.deepEqual(data.hospital, h);
  assert.deepEqual(data.model, model);
  assert.equal(data.page.name, D.master.get(h.ccn).name);
  assert.match(text, /<script type="module" src="\/assets\/hacrp-hospital\.test\.js"><\/script>/);
});

test('no score, and the "Yes" row with no score: no what-if, no inputs, no page data, no client module', () => {
  for (const [pred, what] of [
    [(x) => x.total === null && x.paymentReduction === 'No', 'no score'],
    [(x) => x.total === null && x.paymentReduction === 'Yes', 'Yes with no score'],
  ]) {
    const text = pageFor(pick(pred, what));
    assert.doesNotMatch(text, /id="whatif"|<input|hacrp-hospital/, what);
  }
});

test('hostile text in a hospital name stays text in the page data', () => {
  const h = { ...H.no, name: '</script><script>alert(1)</script>' };
  const view = hospitalView({ hospital: h, model, estimate, footnotes: D.footnotes, master: master(h.ccn, { name: '<b>&"x"' }), fy: D.fy, periods: D.periods, boundaryText: D.boundaryText });
  const text = hospitalPage({ view, source: D.source, robots: 'noindex', assets: ASSETS, whatif: { hospital: h, model, estimate } });
  assert.ok(!text.includes('<script>alert'));
  const json = /<script type="application\/json" id="hacrp-hospital">(.*?)<\/script>/s.exec(text)[1];
  assert.equal(JSON.parse(json).hospital.name, h.name);
  assert.equal(JSON.parse(json).page.name, '<b>&"x"');
});

test('the browser bundle builds; dom.js and the client never write markup or reach storage or the network', async () => {
  assert.equal(HACRP.entries['hacrp-hospital'], 'sites/hacrp/client/hospital.js');
  const out = await esbuild({ entryPoints: [REPO_ROOT + 'sites/hacrp/client/hospital.js'], bundle: true, format: 'esm', minify: true, write: false, logLevel: 'silent' });
  const js = out.outputFiles[0].text;
  assert.ok(js.length > 0);
  assert.ok(js.length < 80_000, `client module is ${js.length} bytes`);
  for (const file of ['web/whatif/dom.js', 'web/whatif/marks.js', 'sites/hacrp/client/hospital.js']) {
    const src = readFileSync(REPO_ROOT + file, 'utf8');
    for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest', 'cookie', 'eval(', 'alert(', 'confirm(']) {
      assert.ok(!src.includes(banned), `${file}: ${banned}`);
    }
  }
  for (const banned of ['innerHTML', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'fetch(']) assert.ok(!js.includes(banned), `bundle: ${banned}`);
});
