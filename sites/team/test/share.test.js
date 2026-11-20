// The calculator's share link (sites/team/client/share.js): public inputs only unless the reader asks, and a decoder
// that treats every link as untrusted and never throws. Every value here is made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTeam, decodeTeam, MAX_EPISODES, MAX_PRICE } from '../client/share.js';
import { isScenarioHash } from '../../../web/whatif/fragment.js';
import { mulberry32 } from '../../../engine/js/test/prng.js';

const PUBLIC = { ccn: '010001', track: 2, s: 5, sk: { LEJR: -3, CABG: 12.5 }, band: 5 };
const MINE = {
  ov: { n: { LEJR: 120, SPINAL: 40 }, p: { LEJR: 21000, SPINAL: 45500 } },
  lv: { LEJR: true, SPINAL: false }, q: { hybrid_hwr: 40, falls: 72.5 },
  mine: new Set(['n.LEJR']),
};
const FULL = { ...PUBLIC, ...MINE };

test('round trip public only', () => {
  const hash = encodeTeam(FULL, { includeMine: false });
  assert.equal(hash, '#team&h=010001&t=2&s=5&sk.LEJR=-3&sk.CABG=12.5&b=5');
  assert.ok(isScenarioHash(hash, 'team'));
  assert.ok(!isScenarioHash(hash));
  assert.deepEqual(decodeTeam(hash), {
    state: { ccn: '010001', track: 2, s: 5, sk: { LEJR: -3, CABG: 12.5 }, band: 5 }, rejected: [],
  });
});

test('own numbers absent unless includeMine', () => {
  const off = encodeTeam(FULL, { includeMine: false });
  assert.ok(!/(^|&)(n|p|q|lv)\./.test(off));
  assert.equal(encodeTeam(FULL), off);
  const on = encodeTeam(FULL, { includeMine: true });
  assert.ok(on.includes('&n.LEJR=120') && on.includes('&p.SPINAL=45500') && on.includes('&q.falls=72.5'));
  assert.ok(on.includes('&lv.LEJR=1') && on.includes('&lv.SPINAL=0'));
  const { state, rejected } = decodeTeam(on);
  assert.deepEqual(rejected, []);
  assert.deepEqual(state.ov, MINE.ov);
  assert.deepEqual(state.lv, MINE.lv);
  assert.deepEqual(state.q, MINE.q);
});

test('encode rounds percents to one decimal and dollars to whole numbers, never writes -0', () => {
  const h = encodeTeam({ ccn: '010001', track: 1, s: 4.96, sk: { LEJR: -0.04 }, band: 5.04, ov: { p: { LEJR: 20999.6 } } }, { includeMine: true });
  assert.equal(h, '#team&h=010001&t=1&s=5&sk.LEJR=0&b=5&p.LEJR=21000');
  assert.ok(!h.includes('-0'));
});

test('junk keys rejected, valid kept', () => {
  const r = decodeTeam('#team&h=010001&s=abc&sk.LEJR=−3&sk.CABG=1e9&p.LEJR=$1,2,3&n.LEJR=7&t=2&\u{1F4A5}=1&q.falls=\u{1F4A5}&x=1&b=');
  assert.deepEqual(r.state, { ccn: '010001', track: 2, ov: { n: { LEJR: 7 } } });
  assert.deepEqual(new Set(r.rejected), new Set(['s', 'sk.LEJR', 'sk.CABG', 'p.LEJR', '\u{1F4A5}', 'q.falls', 'x', 'b']));
  assert.ok(!JSON.stringify(r.rejected).includes('abc'));
});

// A rejected key is named as a reader typed it: percent-decoded where it decodes (the page sets it as text), as it came
// where it doesn't, and never longer than forty characters.
test('rejected keys are shown decoded, raw where they don\'t decode, and capped', () => {
  assert.deepEqual(decodeTeam('#team&%3Cimg%20src=1&s=2').rejected, ['<img src']);
  assert.deepEqual(decodeTeam('#team&%E0%A4%A=1').rejected, ['%E0%A4%A'], 'a broken escape: as it came');
  const long = `${'%41'.repeat(30)}`;
  assert.deepEqual(decodeTeam(`#team&${long}=1`).rejected, ['A'.repeat(30)], 'decoded before the cap');
  assert.equal(decodeTeam(`#team&${'b'.repeat(60)}=1`).rejected[0].length, 40);
});

test('rejected keys are shown without control or bidi characters', () => {
  const bad = ['%00', '%1B', '%7F', '%C2%85', '%C2%9F', '%E2%80%AE', '%E2%80%AA', '%E2%81%A6', '%E2%81%A9', '%E2%80%8E', '%E2%80%8F'].join('');
  assert.deepEqual(decodeTeam(`#team&a${bad}b=1`).rejected, ['ab']);
  assert.deepEqual(decodeTeam(`#team&${'%E2%80%AE'.repeat(50)}${'c'.repeat(50)}=1`).rejected, ['c'.repeat(40)], 'stripped before the cap');
});

test('grammar: no plus, blank, exponent, trailing dot or hex', () => {
  for (const v of ['+5', ' 5', '5 ', '1e3', '5.', '.5', '0x10', '--5', '', 'NaN', 'Infinity']) {
    assert.deepEqual(decodeTeam(`#team&s=${v}`), { state: {}, rejected: ['s'] }, JSON.stringify(v));
  }
});

test('out-of-range numbers are clamped; -0 becomes 0', () => {
  const r = decodeTeam(`#team&s=999&sk.LEJR=-999&b=0.1&q.falls=250&n.LEJR=99999999&p.LEJR=99999999999&sk.CABG=-0&q.prf=-0.0`);
  assert.deepEqual(r.state, {
    s: 60, sk: { LEJR: -60, CABG: 0 }, band: 1, q: { falls: 100, prf: 0 }, ov: { n: { LEJR: MAX_EPISODES }, p: { LEJR: MAX_PRICE } },
  });
  assert.ok(Object.is(r.state.sk.CABG, 0) && Object.is(r.state.q.prf, 0));
  assert.deepEqual(decodeTeam('#team&b=99').state, { band: 20 });
});

test('track, ccn, level flags and categories are checked exactly', () => {
  const r = decodeTeam('#team&t=4&h=01000&lv.LEJR=2&lv.CABG=1&sk.NOPE=1&n.lejr=1&q.nope=1&h=ABCDEF');
  assert.deepEqual(r.state, { lv: { CABG: true } });
  assert.deepEqual(new Set(r.rejected), new Set(['t', 'h', 'lv.LEJR', 'sk.NOPE', 'n.lejr', 'q.nope']));
  assert.deepEqual(decodeTeam('#team&t=3.0').rejected, ['t']);
  assert.deepEqual(decodeTeam('#team&h=0100a1').rejected, ['h']);
});

test('a duplicate key is rejected whole, as in the what-if', () => {
  assert.deepEqual(decodeTeam('#team&s=1&s=2&b=5'), { state: { band: 5 }, rejected: ['s'] });
});

test('prototype keys are plain unknown keys', () => {
  const r = decodeTeam('#team&__proto__=1&constructor=1&sk.__proto__=1');
  assert.deepEqual(r.state, {});
  assert.equal(({}).polluted, undefined);
});

test('oversized fragment ignored', () => {
  const big = `#team&h=010001&s=5&${'x'.repeat(2000)}=1`;
  const r = decodeTeam(big);
  assert.deepEqual(r.state, {});
  assert.equal(r.rejected.length, 1);
  assert.deepEqual(decodeTeam('#team&' + 'a'.repeat(1000)).rejected.length, 1); // 1,006 characters
  assert.deepEqual(decodeTeam('#team&s=5').state, { s: 5 });
});

test('not a team link, or not a string: empty, no throw', () => {
  for (const h of ['', '#team', '#whatif&s=1', '#main', undefined, null, 5, {}, []]) {
    assert.deepEqual(decodeTeam(h), { state: {}, rejected: [] });
  }
});

test('encode survives a hostile or partial state', () => {
  assert.equal(encodeTeam({}, {}), '');
  assert.equal(encodeTeam(null), '');
  assert.equal(encodeTeam({ ccn: 'bad', track: 9, s: NaN, band: Infinity, sk: { NOPE: 1, LEJR: 'x' } }), '');
  assert.equal(encodeTeam({ s: 1e9, band: 99 }), '#team&s=60&b=20');
});

test('seeded fuzz: decode never throws, state always inside its ranges, encode of it round-trips', () => {
  const rand = mulberry32(20261119);
  const pieces = ['#team', '&', '=', 's', 'sk.LEJR', 'p.CABG', 'n.SPINAL', 'q.falls', 'lv.BOWEL', 'h', 't', 'b', '-', '.', '0', '9', '1e9',
    '−', '$', ',', ' ', '\u{1F4A5}', '%', '__proto__', 'ABCDEF', '010001', '\0', '999999999999'];
  for (let i = 0; i < 3000; i++) {
    let hash = '';
    for (let k = Math.floor(rand() * 30); k > 0; k--) hash += pieces[Math.floor(rand() * pieces.length)];
    const { state, rejected } = decodeTeam(hash);
    assert.ok(Array.isArray(rejected));
    if (state.s !== undefined) assert.ok(Math.abs(state.s) <= 60);
    for (const v of Object.values(state.sk ?? {})) assert.ok(Math.abs(v) <= 60 && !Object.is(v, -0));
    if (state.band !== undefined) assert.ok(state.band >= 1 && state.band <= 20);
    const again = decodeTeam(encodeTeam(state, { includeMine: true }));
    assert.deepEqual(again.rejected, []);
  }
});

test('t accepts only a track key: no blank, zero-padded or decimal forms', () => {
  for (const v of [' 2', '02', '2.0', '2 ', '4', '0', '', '__proto__', 'constructor']) {
    assert.deepEqual(decodeTeam(`#team&t=${v}`), { state: {}, rejected: ['t'] }, JSON.stringify(v));
  }
  assert.deepEqual(decodeTeam('#team&t=3').state, { track: 3 });
});
