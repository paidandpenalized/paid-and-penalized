// The what-if's words (hub/client/hospital/whatif-text.js): the result sentence for one change, several and the HAC
// toggle; the handle's aria-valuetext; the banner. Every dollar says estimated and its fiscal year; the words say
// "would" and "hypothetical", never "should", "failed" or "could have avoided". Synthetic hospitals (99xxxx).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money } from '../../web/render/format.js';
import { rowFigures } from '../hospital/peers.js';
import { signedShareText } from '../hospital/text.js';
import { initial, outcome, reduce } from '../client/hospital/whatif-state.js';
import { bannerText, sentence, valueText } from '../client/hospital/whatif-text.js';
import { TOTAL, makeHospital as make } from './helpers.js';

const H = make('990001', { hrrpFactor: 0.9988, vbpFactor: 1.0021821642 });
const peers = [H, make('990002', { hrrpFactor: 0.995, cut: true }), make('990003', { hrrpFactor: 0.99, vbpFactor: 0.999, cut: true })];
const ctx = { h: H, vbpMax: 1.04, peers };
const opts = { fy: '2026', group: 'Testland hospitals' };
const usd = (x) => money(x, { sign: true });
const median = signedShareText(rowFigures(peers, 'net').median);
const net = (s) => outcome(s, H).net;

test('one change: its factor, then the estimated net it would have and the group median', () => {
  const s = reduce(initial(H), { type: 'set', id: 'hrrp', value: 0.9978 }, ctx);
  assert.equal(sentence(s, H, peers, opts),
    `If its readmissions factor were 0.9978 instead of 0.9988, its estimated FY2026 net would be ${usd(net(s))} (${signedShareText(net(s) / TOTAL)} of Medicare inpatient pay) instead of ${usd(H.est.net)}. The group median is ${median}.`);
});

test('two changes join with "and"; three with commas and "and"', () => {
  let s = reduce(initial(H), { type: 'set', id: 'hrrp', value: 0.9978 }, ctx);
  s = reduce(s, { type: 'set', id: 'hvbp', value: 1.01 }, ctx);
  assert.match(sentence(s, H, peers, opts), /^If its readmissions factor were 0\.9978 instead of 0\.9988 and its value-based purchasing factor were 1\.0100 instead of 1\.0022, its estimated FY2026 net would be /);
  s = reduce(s, { type: 'hac', cut: true }, ctx);
  assert.match(sentence(s, H, peers, opts), /^If its readmissions factor were 0\.9978 instead of 0\.9988, it had the 1% hospital-acquired conditions cut and its value-based purchasing factor were 1\.0100 instead of 1\.0022, its estimated FY2026 net would be /);
});

test('the HAC toggle, either way', () => {
  const on = reduce(initial(H), { type: 'hac', cut: true }, ctx);
  assert.equal(sentence(on, H, peers, opts),
    `If it had the 1% hospital-acquired conditions cut, its estimated FY2026 net would be ${usd(net(on))} (${signedShareText(net(on) / TOTAL)} of Medicare inpatient pay) instead of ${usd(H.est.net)}. The group median is ${median}.`);
  const cutH = make('990004', { hrrpFactor: 0.99, cut: true });
  const off = reduce(initial(cutH), { type: 'hac', cut: false }, { ...ctx, h: cutH });
  assert.match(sentence(off, cutH, peers, opts), /^If it had no hospital-acquired conditions cut, its estimated FY2026 net would be /);
});

test('unchanged, the sentence is the page\'s own result sentence', () => {
  assert.match(sentence(initial(H), H, peers, opts), /^That is a [\d.]+% net bonus of Medicare inpatient pay; the median of the 3 Testland hospitals is /);
});

test('the handle\'s value text and the banner say estimated, the fiscal year and, once changed, hypothetical', () => {
  const s0 = initial(H);
  assert.equal(valueText('hrrp', s0, H, opts), `factor 0.9988: estimated FY2026 ${usd(H.est.hrrp)}, cut`);
  const s = reduce(s0, { type: 'set', id: 'hrrp', value: 1 }, ctx);
  assert.equal(valueText('hrrp', s, H, opts), 'factor 1.0000: estimated FY2026 $0, no cut, hypothetical');
  assert.equal(valueText('hacrp', s0, H, opts), 'no cut: estimated FY2026 $0');
  const c = reduce(s0, { type: 'hac', cut: true }, ctx);
  assert.equal(valueText('hacrp', c, H, opts), `1% cut: estimated FY2026 ${usd(outcome(c, H).hac)}, hypothetical`);
  assert.equal(valueText('hvbp', s0, H, opts), `factor 1.0022: estimated FY2026 ${usd(H.est.hvbp)}, bonus`);
  assert.equal(bannerText(s, H, opts), `Estimated FY2026 net ${usd(net(s))} instead of ${usd(H.est.net)}`);
});

test('no output says "should", "failed" or "could have avoided"', () => {
  const states = [initial(H)];
  for (const action of [{ type: 'set', id: 'hrrp', value: 0.97 }, { type: 'hac', cut: true }, { type: 'set', id: 'hvbp', value: 0.98 }, { type: 'medianAll' }]) {
    states.push(reduce(states[states.length - 1], action, ctx));
  }
  for (const s of states) {
    const words = [sentence(s, H, peers, opts), bannerText(s, H, opts), ...['hrrp', 'hacrp', 'hvbp'].map((id) => valueText(id, s, H, opts))].join(' ');
    assert.doesNotMatch(words, /\bshould\b|\bfailed\b|could have avoided|NaN|undefined|Infinity/i);
  }
});
