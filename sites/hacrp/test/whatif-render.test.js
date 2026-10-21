// The what-if component on hospital pages: its build-time HTML (synthetic hospitals, CCNs 990021-990029, that agree
// with the real FY2026 model), the page it sits on (pinned rows picked by property), and the browser bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build as esbuild } from 'esbuild';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { modelHospital } from '../../../engine/js/test/hacrp/synthetic.js';
import { REPO_ROOT, repoFiles } from '../../../pipeline/files.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { toUnit } from '../../../engine/js/stats.js';
import { MAX_FACTOR, encode } from '../../../web/whatif/fragment.js';
import { NARROW_PX, labelSpan, rampAt, rampDomain, rampLabels, rampSide, rampX } from '../../../web/whatif/marks.js';
import { renderWhatIf } from '../../../web/whatif/render.js';
import { loadHacrp } from '../web/data.js';
import { HACRP, scoreRange } from '../web/generate.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalView } from '../web/view.js';
import { changesOf, initialState, reduce, solverOf, viewModel } from '../web/whatif-state.js';
import { whatIfTexts } from '../web/whatif-text.js';
import { master } from './fixtures.js';

const D = loadHacrp();
const { model, estimate } = D;
const RANGE = scoreRange(D.hospitals);
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
const render = (h, state = initialState(h, model), share = true, texts = textsFor(h)) =>
  String(renderWhatIf({ vm: viewModel(state, h, model, estimate), texts, share, range: RANGE, solver: solverOf(h, model) }));
const set = (h, changes) => Object.entries(changes).reduce((s, [id, value]) => reduce(s, { type: 'set', id, value }), initialState(h, model));
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
  const lev = vm.result.measures.MRSA.leverage.toFixed(4);
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
  assert.doesNotMatch(encode(changesOf(s), MEASURE_IDS), /12\.34/);
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
  source: D.source, robots: 'noindex', assets: ASSETS, whatif: { hospital: h, model, estimate, range: RANGE },
});

test('a scored page carries the what-if, both standing lines, its own record as page data, and the client module', () => {
  const h = pick((x) => x.total !== null && x.paymentReduction === 'Yes', 'scored Yes');
  const text = pageFor(h);
  assert.match(text, /<section[^>]*id="whatif"/);
  assert.ok(text.includes(esc(STANDING)));
  assert.ok(text.includes(esc(WHATIF_STANDING)));
  const json = /<script type="application\/json" id="hacrp-hospital">(.*?)<\/script>/s.exec(text)[1];
  const data = JSON.parse(json);
  assert.deepEqual(Object.keys(data).sort(), ['estimate', 'hospital', 'model', 'page', 'range']);
  assert.deepEqual(data.range, RANGE);
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
  const text = hospitalPage({ view, source: D.source, robots: 'noindex', assets: ASSETS, whatif: { hospital: h, model, estimate, range: RANGE } });
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
  // Only the site's rules run the solver, at build time: the browser never needs it.
  assert.ok(!js.includes('HACRP solver'), 'bundle: the solver');
});

test('the shared component imports no site and no program\'s engine: a site passes its rules and words in', () => {
  const files = repoFiles('web/whatif/', { untracked: true }).filter((f) => f.endsWith('.js'));
  assert.deepEqual(files.sort(), ['web/whatif/dom.js', 'web/whatif/fragment.js', 'web/whatif/marks.js', 'web/whatif/render.js']);
  for (const file of files) {
    const imports = [...readFileSync(REPO_ROOT + file, 'utf8').matchAll(/^import[^;]*?from '([^']+)'/gms)].map((m) => m[1]);
    for (const path of imports) assert.doesNotMatch(path, /\/sites\/|\/engine\/js\/hacrp\//, `${file} imports ${path}`);
  }
});

test('the ramp spans the national middle of published scores, widened for the starting score and the line', () => {
  const totals = D.hospitals.filter((h) => h.total !== null).map((h) => h.total).sort((a, b) => a - b);
  const share = (x) => totals.filter((t) => t >= x).length / totals.length;
  assert.ok(RANGE.low < RANGE.high);
  assert.ok(Math.abs(share(RANGE.low) - 0.95) < 0.01 && Math.abs(share(RANGE.high) - 0.05) < 0.01, 'p5 and p95');
  assert.ok(totals.includes(RANGE.low) && totals.includes(RANGE.high), 'published scores, not hand-typed');
  const { boundary } = model;
  for (const actual of [0.2734, RANGE.low - 0.5, RANGE.high + 0.5]) {
    const [lo, hi] = rampDomain(RANGE, { actual, ...boundary });
    for (const x of [RANGE.low, RANGE.high, actual, boundary.highestNo, boundary.lowestYes]) assert.ok(x > lo && x < hi, `${actual}: ${x} inside`);
  }
});

test('a hypothetical past the ramp sits at its edge with an arrow; inside, no arrow', () => {
  const edge = (text) => /data-wi="hyp-edge"[^>]*>([^<]*)</.exec(text)[1];
  assert.equal(edge(render(H.no)), '');
  const high = set(H.no, { PSI90: 1.6, CLABSI: 3, CAUTI: 3, SSI: 3, CDI: 3, MRSA: 3 });
  const vm = viewModel(high, H.no, model, estimate);
  assert.equal(rampSide(vm.result.after.score, rampDomain(RANGE, vm.ramp)), 1);
  const text = render(H.no, high);
  assert.equal(edge(text), '▶');
  assert.match(text, new RegExp(`data-wi="hyp" href="#wi-tri" x="${rampX(1).replace('.', '\\.')}"`));
  const zeros = set(H.yes, { PSI90: 0, CLABSI: 0, CAUTI: 0, SSI: 0, CDI: 0, MRSA: 0 });
  const low = viewModel(zeros, H.yes, model, estimate);
  assert.equal(rampSide(low.result.after.score, rampDomain(RANGE, low.ramp)), -1);
  const lowText = render(H.yes, zeros);
  assert.equal(edge(lowText), '◀');
  assert.match(lowText, new RegExp(`data-wi="hyp" href="#wi-tri" x="${rampX(0).replace('.', '\\.')}"`));
});

test('the two mark labels never overlap and stay inside the ramp, at any pair of places and widths', () => {
  for (const [a, b] of [['CMS reports', 'Hypothetical'], ['Starting point', 'Hypothetical']]) {
    for (let i = 0; i <= 100; i += 2) {
      for (let j = 0; j <= 100; j += 2) {
        const labels = rampLabels(i / 100, j / 100, a, b);
        for (const width of [NARROW_PX, 400, 700, 1000]) {
          const s = labelSpan(labels.start, a.length, width);
          const h = labelSpan(labels.hyp, b.length, width);
          const where = `${a} ${i} ${j} @${width}`;
          assert.ok(s[1] <= h[0] || h[1] <= s[0], `${where}: overlap`);
          for (const [l, r] of [s, h]) assert.ok(l >= 0 && r <= width, `${where}: outside`);
        }
      }
    }
  }
  // Close marks put the left mark's label on the left.
  const near = rampLabels(0.5, 0.52, 'CMS reports', 'Hypothetical');
  assert.ok(labelSpan(near.start, 11, NARROW_PX)[1] <= labelSpan(near.hyp, 12, NARROW_PX)[0]);
  const flipped = rampLabels(0.52, 0.5, 'CMS reports', 'Hypothetical');
  assert.ok(labelSpan(flipped.hyp, 12, NARROW_PX)[1] <= labelSpan(flipped.start, 11, NARROW_PX)[0]);
  assert.ok(rampAt(0, [0, 1]) === 0);
});

test('each number field has an error line naming its range, hidden until an entry is refused', () => {
  const text = render(H.no);
  const p = model.params.MRSA;
  const line = /<p class="small wi-error" id="wi-MRSA-e" data-wi="error" hidden>([^<]*)<\/p>/.exec(text);
  assert.ok(line, 'the MRSA error line');
  assert.equal(line[1], `Enter a number from 0.000 to ${toUnit(MAX_FACTOR * p.cap, p.decimals).toFixed(3)}.`);
  assert.equal(all(text, /data-wi="error"/g).length, 6);
});

test('a reader value on an assigned measure: its bar loses the hatch and the "assigned by CMS" note', () => {
  const before = render(H.assigned);
  assert.match(/<li data-bar="SSI"[^>]*>/.exec(before)[0], /--assigned/);
  assert.doesNotMatch(/data-wi="bar-assigned"[^>]*>/.exec(before)[0], /hidden/);
  const after = render(H.assigned, set(H.assigned, { SSI: 0.8 }));
  assert.doesNotMatch(/<li data-bar="SSI"[^>]*>/.exec(after)[0], /--assigned/);
  assert.match(/data-wi="bar-assigned"[^>]*>/.exec(after)[0], /hidden/);
});

test('share, range and solver are required; the slider label names the value, not the role; the solver sits under its button', () => {
  const vm = viewModel(initialState(H.no, model), H.no, model, estimate);
  const solver = solverOf(H.no, model);
  assert.throws(() => renderWhatIf({ vm, texts: textsFor(H.no), range: RANGE, solver }), /share/);
  assert.throws(() => renderWhatIf({ vm, texts: textsFor(H.no), share: true, solver }), /range/);
  assert.throws(() => renderWhatIf({ vm, texts: textsFor(H.no), share: true, range: RANGE }), /solver/);
  const text = render(H.no);
  assert.match(text, /<label class="vh" for="wi-MRSA-r">MRSA value<\/label>/);
  assert.doesNotMatch(text, /slider</);
  const at = (s) => text.indexOf(s);
  assert.ok(at('data-wi="solve"') < at('id="wi-solver"') && at('id="wi-solver"') < at('data-measure="PSI90"'));
});

test('the median hospital never gets NHSN fields, even with periods', () => {
  const m = medianHospital(model, { fiscalYear: String(D.fy), periods: D.periods });
  const texts = whatIfTexts({ hospital: m, model, name: null, fy: D.fy, path: '/hacrp/', source: D.source, boundaryText: D.boundaryText });
  assert.equal(texts.predicted, null);
  const text = render(m, initialState(m, model), false, texts);
  assert.doesNotMatch(text, /data-wi="predicted"|than at CMS/);
});
