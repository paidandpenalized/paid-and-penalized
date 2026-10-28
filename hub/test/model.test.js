import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, peerKey } from '../../engine/js/peers.js';
import { netShare, programDollars } from '../../engine/js/dollars/whatif.js';
import { loadHub } from '../data.js';
import { EXAMPLE_CCN, exampleRule, hubHospitals, shellFacts, stateTotals, storyFacts } from '../model.js';

const hub = loadHub();
const hospitals = hubHospitals(hub);
const estimated = hospitals.filter((h) => h.est);
const facts = storyFacts(hospitals);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// A synthetic hospital: invented CCN, an estimated row unless `est: null`.
const fake = (ccn, state, est, extra = {}) => ({
  ccn, name: `Hospital ${ccn}`, city: 'Town', state, beds: 150, band: 1, teach: 'none', lat: 40, lon: -90,
  status: est ? 'estimated' : 'no-inputs', inTdr: true,
  est: est && {
    base: 0, total: 1000, hrrp: 0, hvbp: 0, hac: 0, net: 0, after: 1000, atStake: 10, hrrpFactor: 1, vbpFactor: 1,
    cut: false, hrrpListed: true, vbpListed: true, share: 0, ...est,
  },
  ...extra,
});

test('the hub lists every hospital of the dollar file, in its order, by status', () => {
  assert.equal(hospitals.length, 3055);
  assert.deepEqual(hospitals.map((h) => h.ccn), hub.dollars.hospitals.map((r) => r.ccn));
  const count = (status) => hospitals.filter((h) => h.status === status).length;
  assert.equal(count('estimated'), 2971);
  assert.equal(count('maryland'), 43);
  assert.equal(count('no-inputs'), hospitals.length - 2971 - 43);
  assert.deepEqual([count('estimated'), count('maryland'), count('no-inputs')],
    [hub.dollars.national.byStatus.estimated, hub.dollars.national.byStatus.maryland, hub.dollars.national.byStatus['no-inputs']]);
  for (const h of hospitals) assert.equal(h.est === null, h.status !== 'estimated', h.ccn);
});

test('a hub hospital joins the master record, the TDR file and the dollar row', () => {
  const rows = new Map(hub.dollars.hospitals.map((r) => [r.ccn, r]));
  for (const h of hospitals) {
    const m = hub.master.get(h.ccn);
    assert.deepEqual([h.name, h.city, h.state, h.beds, h.lat, h.lon, h.teach],
      [m.name, m.city, m.state, m.beds ?? null, m.lat ?? null, m.lon ?? null, m.teach ?? null]);
    assert.equal(h.inTdr, hub.tdr.hospitals.has(h.ccn));
    if (!h.est) continue;
    const row = rows.get(h.ccn);
    for (const key of ['base', 'total', 'hrrp', 'hvbp', 'hac', 'net', 'after', 'atStake', 'hrrpFactor', 'vbpFactor', 'cut', 'hrrpListed', 'vbpListed']) {
      assert.equal(h.est[key], row[key], `${h.ccn} ${key}`);
    }
    assert.equal(h.est.share, netShare(row.net, row.total));
    // The emitted net is what the shared what-if arithmetic reproduces.
    assert.equal(h.est.net, programDollars(row).net, h.ccn);
  }
  // The join is not all-or-nothing: some hospitals are in the TDR file and some are not.
  assert.ok(hospitals.some((h) => h.inTdr) && hospitals.some((h) => !h.inTdr));
});

test('a size band is set exactly when the hospital has beds, and a teaching key exactly when it has a teaching status', () => {
  for (const h of hospitals) {
    assert.equal(h.band === null, h.beds === null, h.ccn);
    assert.equal(peerKey(h, 'teach') === null, h.teach === null, h.ccn);
    assert.equal(peerKey(h, 'size') === null, h.beds === null, h.ccn);
  }
  // The real file has hospitals without a teaching status, so the toggle's disabled case is exercised.
  assert.ok(hospitals.some((h) => h.teach === null));
});

test('hubHospitals stops on a status no page has words for', () => {
  const master = new Map([['990001', { ccn: '990001', name: 'Hospital 990001', city: 'Town', state: 'ZZ', beds: 10, teach: 'none', lat: 1, lon: 2 }]]);
  const tdr = { hospitals: new Map() };
  const row = { ccn: '990001', status: 'parhm', cut: false, hrrpListed: false, vbpListed: false };
  assert.throws(() => hubHospitals({ dollars: { hospitals: [row] }, master, tdr }), /status "parhm"/);
  const [h] = hubHospitals({ dollars: { hospitals: [{ ...row, status: 'maryland' }] }, master, tdr });
  assert.deepEqual([h.status, h.est, h.inTdr, h.band], ['maryland', null, false, 0]);
});

test('storyFacts adds up to the dollar file', () => {
  const { national } = hub.dollars;
  assert.equal(facts.n, estimated.length);
  assert.equal(facts.netCut + facts.netBonus + facts.netZero, facts.n);
  assert.equal(-sum(estimated.map((h) => h.est.net)), facts.notPaid);
  assert.equal(facts.notPaid, -national.net);
  assert.equal(facts.net, national.net);
  assert.equal(facts.pay, national.total);
  assert.equal(facts.hrrpSum, national.hrrp);
  assert.equal(facts.hacSum, national.hac);
  assert.equal(facts.vbpNet, national.hvbp);
  assert.equal(facts.hacCut, national.cut);
  assert.ok(facts.vbpBonus > 0);
  assert.equal(facts.gross, facts.notPaid + facts.vbpBonus);
  assert.equal(facts.share, facts.gross / facts.pay);
  assert.ok(facts.share > 0 && facts.share < 0.01, `share ${facts.share}`);
});

test('storyFacts counts each program\'s hospitals so they partition the estimated ones', () => {
  assert.equal(facts.hrrpCut + facts.hrrpZero, facts.n);
  assert.equal(facts.vbpBonusN + facts.vbpCutN + facts.vbpZero, facts.n);
  assert.ok(facts.hacOnly > 0 && facts.hacOnly <= facts.hacCut);
  assert.equal(facts.hacOnly, estimated.filter((h) => h.est.hrrp === 0 && h.est.hac < 0).length);
  const listed = estimated.filter((h) => h.est.vbpListed);
  assert.ok(listed.length < facts.n, 'some hospitals are not in HVBP');
  assert.equal(facts.vbpMax, Math.max(...listed.map((h) => h.est.vbpFactor)));
  assert.ok(facts.vbpMax > 1);
});

test('storyFacts on invented hospitals: a bonus, a cut, a HAC-only hospital, one outside HVBP, and rows with no estimate', () => {
  const list = [
    fake('990001', 'ZZ', { total: 1000, hrrp: -30, hvbp: 20, hac: 0, net: -10, vbpFactor: 1.002 }),
    fake('990002', 'ZZ', { total: 3000, hrrp: 0, hvbp: -10, hac: -25, net: -35, cut: true, vbpFactor: 0.99 }),
    fake('990003', 'ZY', { total: 500, hrrp: -5, hvbp: 0, hac: 0, net: -5, vbpListed: false, vbpFactor: 1 }),
    fake('990004', 'ZY', { total: 500, hrrp: 0, hvbp: 15, hac: 0, net: 15, vbpFactor: 1.004 }),
    fake('990005', 'ZY', null),
  ];
  assert.deepEqual(storyFacts(list), {
    n: 4, pay: 5000, net: -35, notPaid: 35, vbpBonus: 35, gross: 70, share: 70 / 5000,
    hrrpCut: 2, hrrpZero: 2, hrrpSum: -35, hacCut: 1, hacOnly: 1, hacSum: -25,
    vbpBonusN: 2, vbpCutN: 1, vbpZero: 1, vbpNet: 25, netCut: 3, netBonus: 1, netZero: 0, vbpMax: 1.004,
  });
  // No hospital in HVBP: no highest factor.
  assert.equal(storyFacts([fake('990006', 'ZZ', { vbpListed: false })]).vbpMax, null);
});

test('stateTotals: fifty jurisdictions with estimates, Maryland flagged, and the totals add up', () => {
  const states = stateTotals(hospitals);
  const flagged = [...states.values()].filter((s) => s.notInPrograms);
  assert.deepEqual(flagged.map((s) => s.state), ['MD']);
  assert.equal(states.size, 51);
  assert.equal(flagged[0].n, hospitals.filter((h) => h.state === 'MD').length);
  assert.deepEqual(Object.keys(flagged[0]).sort(), ['n', 'notInPrograms', 'state']);
  const rest = [...states.values()].filter((s) => !s.notInPrograms);
  assert.equal(rest.length, 50);
  assert.equal(sum(rest.map((s) => s.net)), facts.net);
  assert.equal(sum(rest.map((s) => s.total)), facts.pay);
  assert.equal(sum(rest.map((s) => s.n)), facts.n);
  for (const s of rest) {
    assert.equal(s.share, s.net / s.total, s.state);
    assert.ok(s.cutN >= 0 && s.cutN <= s.n, s.state);
    const mine = estimated.filter((h) => h.state === s.state);
    assert.deepEqual([s.n, s.cutN], [mine.length, mine.filter((h) => h.est.net < 0).length], s.state);
  }
  assert.deepEqual([...states.keys()], [...states.keys()].sort(), 'in postal-code order');
});

test('stateTotals on invented hospitals; a Maryland hospital with an estimate stops the build', () => {
  const list = [
    fake('990001', 'ZZ', { total: 1000, net: -20 }),
    fake('990002', 'ZZ', { total: 3000, net: 30 }),
    fake('990003', 'ZY', null),
    fake('990004', 'MD', null, { status: 'maryland' }),
    fake('990005', 'MD', null, { status: 'maryland' }),
  ];
  const states = stateTotals(list);
  assert.deepEqual([...states.keys()], ['MD', 'ZZ']);
  assert.deepEqual(states.get('ZZ'), { state: 'ZZ', n: 2, total: 4000, net: 10, share: 10 / 4000, cutN: 1 });
  assert.deepEqual(states.get('MD'), { state: 'MD', notInPrograms: true, n: 2 });
  assert.throws(() => stateTotals([fake('990006', 'MD', { net: -1 })]), RangeError);
});

test('stateTotals stops on a Maryland-status hospital outside Maryland, and on an estimated hospital with no state, rather than drop or misfile it', () => {
  const isHub = (e) => e instanceof RangeError && /^hub: /.test(e.message);
  assert.throws(() => stateTotals([fake('990001', 'ZZ', null, { status: 'maryland' })]), (e) => isHub(e) && e.message.includes('990001'));
  assert.throws(() => stateTotals([fake('990001', null, null, { status: 'maryland' })]), isHub);
  for (const state of [null, undefined, '']) {
    assert.throws(() => stateTotals([fake('990002', state, { total: 1000, net: -20 })]), (e) => isHub(e) && e.message.includes('990002'), `state ${JSON.stringify(state)}`);
  }
  // A hospital without an estimate may have no state: it has no row to file.
  assert.deepEqual([...stateTotals([fake('990003', null, null)]).keys()], []);
  // Postal codes sort whatever order the hospitals come in.
  const list = ['ZB', 'ZA', 'MD', 'ZC'].map((s, i) => (s === 'MD' ? fake(`99010${i}`, 'MD', null, { status: 'maryland' }) : fake(`99010${i}`, s, {})));
  assert.deepEqual([...stateTotals(list).keys()], ['MD', 'ZA', 'ZB', 'ZC']);
});

test('EXAMPLE_CCN is the hospital the rule picks, and meets the rule\'s conditions', () => {
  const h = hospitals.find((x) => x.ccn === EXAMPLE_CCN);
  assert.ok(h, 'in the dollar file');
  assert.equal(h.status, 'estimated');
  assert.ok(h.beds >= 100 && h.beds <= 299);
  assert.equal(h.teach, 'none');
  assert.ok(h.est.hrrpListed && h.est.vbpListed);
  assert.equal(exampleRule(hospitals), EXAMPLE_CCN,
    'the data moved: choose the example again by the rule in exampleRule, and check the new hospital with the owner before changing EXAMPLE_CCN');
});

test('exampleRule on invented hospitals: the share nearest the median among the qualifying ones, the lower CCN on a tie', () => {
  const at = (ccn, share, over = {}, extra = {}) => fake(ccn, 'ZZ', { net: share * 1000, share, hrrp: -1, hvbp: 1, ...over }, extra);
  const list = [
    at('990001', -0.004), at('990002', -0.0025), at('990003', -0.002), at('990004', -0.0031),
    at('990005', -0.0030, { hrrpListed: false, vbpListed: false, hrrp: 0 }), // not in the programs: out
    at('990006', -0.0030, {}, { teach: 'minor' }), // teaching: out
    at('990007', -0.0030, {}, { beds: 400, band: 2 }), // too big: out
    at('990008', -0.0030, { hvbp: 0 }), // value-based dollars of $0: out
  ];
  // The median of the eight shares is -0.003 (the four that do not qualify sit on it); of the qualifying ones, -0.0031
  // (990004) is nearest, ahead of -0.0025, -0.002 and -0.004.
  assert.equal(median(list.map((h) => h.est.share)), -0.003);
  assert.equal(exampleRule(list), '990004');
  // The same distance from the median on either side: the lower CCN.
  assert.equal(exampleRule([at('990010', -0.003), at('990009', -0.003)]), '990009');
  assert.equal(exampleRule([fake('990011', 'ZZ', null)]), null);
});

test('shellFacts: numbers for the footer and the tabs, and the day the estimates changed', () => {
  const shell = shellFacts({ facts, builtAt: hub.builtAt, fy: hub.fy });
  assert.deepEqual(shell, {
    fy: hub.fy,
    hospitals: facts.n,
    changed: hub.builtAt.slice(0, 10),
    programs: {
      hrrp: { dollars: facts.hrrpSum, cutN: facts.hrrpCut },
      hacrp: { dollars: facts.hacSum, cutN: facts.hacCut },
      hvbp: { moved: facts.vbpBonus, net: facts.vbpNet },
    },
  });
  assert.match(shell.changed, /^\d{4}-\d{2}-\d{2}$/);
  for (const bad of ['2026-10-23', '2026-02-30T00:00:00Z', 'yesterday', null, undefined]) {
    assert.throws(() => shellFacts({ facts, builtAt: bad, fy: 2026 }), RangeError, String(bad));
  }
});
