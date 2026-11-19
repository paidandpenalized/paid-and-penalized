// The every-hospital lookup's data (sites/team/web/lookup.js) and words (lookup-copy.js): one row per master hospital,
// codes only; ended and 2027 participants resolve as such; every participant the master knows resolves (A4); and the
// words are digit-free, sourced and never call TEAM a penalty. Rows are picked by property, never by name; a failure
// message carries counts, never a hospital's name or CCN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { REPO_ROOT, masterPath, newestYear, pinnedEntry, readJson } from '../../../pipeline/files.js';
import { loadTeam } from '../web/data.js';
import { lookupAsset } from '../web/lookup.js';
import { COPY, lookupFile, reasonText } from '../web/lookup-copy.js';
import { COPY as SITE_COPY } from '../web/copy.js';
import { COPY as SEARCH } from '../../../hub/search/copy.js';
import { hospitalPathOf } from '../../../web/site.js';
import { copyOf } from '../../../web/render/components.js';
import { CJRX_START, PY2_START } from '../web/constants.js';

const team = loadTeam();
const master = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
const asset = lookupAsset(team);
const first = (code) => asset.rows.find((r) => r[1] === code);
const NEUTRAL = copyOf(COPY).fill('inAreaListed'); // the in-area sentence that makes no claim about the kind

test('lookupAsset: one row per master hospital, codes only', () => {
  assert.deepEqual(asset.cols, ['ccn', 'code', 'arg']);
  assert.equal(asset.rows.length, master.hospitals.length);
  assert.deepEqual(new Set(asset.rows.map((r) => r[0])), new Set(master.hospitals.map((h) => h.ccn)));
  for (const row of asset.rows) {
    assert.equal(row.length, 3);
    assert.match(row[0], /^[0-9A-Z]{6}$/);
    assert.ok(typeof row[1] === 'string' && row[1]);
  }
  assert.ok(!/"name"/.test(JSON.stringify(asset)), 'a name in the asset');
});

test('lookupAsset: arg is kept as emitted, the CJR-X inner pair included', () => {
  const row = first('cjrx');
  assert.ok(row, 'a CJR-X row');
  assert.ok(Array.isArray(row[2]) && row[2].length === 2);
  assert.deepEqual(row[2], team.status[row[0]][1]);
});

// A status with its CJR-X wrapper taken off: the TEAM reason inside.
const inner = ([code, arg]) => (code === 'cjrx' ? arg : [code, arg]);

test('ended participants never resolve to "in"; one on the CJR-X list keeps both', () => {
  const ended = team.participants.filter((p) => !p.active && team.status[p.ccn]);
  assert.ok(ended.length > 0, 'a participant who left');
  for (const p of ended) assert.deepEqual(inner(team.status[p.ccn]), ['ended', p.end]);
  assert.ok(!asset.rows.some((r) => r[1] === 'in' && ended.some((p) => p.ccn === r[0])));
});

test('a 2027 starter resolves to in27, with its start date', () => {
  const starters = team.participants.filter((p) => p.active && p.start >= PY2_START && team.status[p.ccn]);
  assert.ok(starters.length > 0, 'a participant starting in 2027');
  for (const p of starters) assert.deepEqual(team.status[p.ccn], ['in27', p.start]);
  assert.ok(!starters.some((p) => team.status[p.ccn][0] === 'in'));
});

test('A4: every TEAM participant except the recorded misses resolves in the master', () => {
  const unresolved = team.participants.filter((p) => !team.status[p.ccn]).length;
  assert.equal(unresolved, 0, `${unresolved} participants the master lacks that the file does not record`);
  // The recorded misses are left out of participants, so the list's rows are the two counts together.
  const listed = pinnedEntry('team-participants').counts.rows;
  assert.equal(team.participants.length + team.a4.teamMissing.length, listed, 'participants plus recorded misses are the list\'s rows');
  assert.ok(team.a4.teamMissing.every((ccn) => !team.status[ccn] && !team.participants.some((p) => p.ccn === ccn)));
  assert.ok(Number.isInteger(team.a4.cjrxMissing) && team.a4.cjrxMissing >= 0);
  assert.equal(asset.rows.filter((r) => ['in', 'in27', 'ended'].includes(inner([r[1], r[2]])[0])).length, team.participants.length);
});

test('asset gzip size printed', (t) => {
  const bytes = gzipSync(JSON.stringify(asset)).length;
  t.diagnostic(`lookup asset: ${asset.rows.length} rows, ${bytes} bytes gzipped`);
  assert.ok(bytes > 0);
});

test('every code the asset holds has words, with a tag and a link', () => {
  const seen = new Map();
  for (const [, code, arg] of asset.rows) seen.set(JSON.stringify([code, arg]), [code, arg]);
  for (const [code, arg] of seen.values()) {
    const r = reasonText(code, arg);
    assert.ok(['YES', 'NO'].includes(r.tag), code);
    assert.ok(['calc', 'hub'].includes(r.link), code);
    assert.ok(r.text.length >= 8, code);
    assert.equal(r.tag === 'YES', ['in', 'in27'].includes(code), code);
    assert.equal(r.link, r.tag === 'YES' ? 'calc' : 'hub', code);
    assert.doesNotMatch(r.text, /penalt|punish|\{|\}|undefined/i, `${code}: text`);
  }
});

test('reasonText: dates and kinds come from the args', () => {
  assert.match(reasonText('in27', '2027-01-01').text, /Jan 1, 2027/);
  assert.match(reasonText('ended', '2026-02-15').text, /Feb 15, 2026/);
  assert.match(reasonText('in', 'voluntary').text, /voluntar/i);
  assert.doesNotMatch(reasonText('in', 'mandatory').text, /voluntar/i);
  assert.match(reasonText('in_area_kind', 'psychiatric').text, /Psychiatric/);
  assert.match(reasonText('cjrx', ['outside', 'acute']).text, /Jan 1, 2028/);
  assert.match(reasonText('cjrx', ['outside', 'acute']).text, new RegExp(reasonText('outside', 'acute').text.slice(0, 20)));
  assert.equal(reasonText('cjrx', ['unlisted', null]).tag, 'NO');
  const left = reasonText('cjrx', ['ended', '2026-02-15']);
  assert.equal(left.tag, 'NO');
  assert.match(left.text, /^Left TEAM\..*Feb 15, 2026.* In CJR\u2011X from Jan 1, 2028\.$/);
  assert.equal(CJRX_START, '2028-01-01');
  assert.equal(PY2_START, '2027-01-01');
});

test('every distinct status in the emitted file renders; the emitter, not the words, decides which kinds get a kind reason', (t) => {
  const pairs = new Map();
  for (const [, code, arg] of asset.rows) pairs.set(JSON.stringify([code, arg]), [code, arg]);
  const seen = { in_area_kind: 0, in_area_other: 0 };
  for (const [code, arg] of pairs.values()) {
    const text = reasonText(code, arg).text;
    const [why, kind] = inner([code, arg]);
    if (why === 'in_area_other') {
      seen.in_area_other += 1;
      assert.ok(['acute', 'unknown'].includes(kind), 'in_area_other carries an acute or unknown kind');
      assert.ok(text.includes(NEUTRAL), 'in_area_other says only that it is not on the list');
      assert.doesNotMatch(text, /of this kind|isn.t paid/, 'a kind claim for an acute or unknown kind');
    }
    if (why === 'in_area_kind') {
      seen.in_area_kind += 1;
      assert.ok(!['acute', 'unknown'].includes(kind), 'in_area_kind carries a kind not paid under the inpatient system');
      assert.match(text, /of this kind isn.t paid/, 'in_area_kind gives the kind reason');
    }
  }
  assert.ok(seen.in_area_other > 0 && seen.in_area_kind > 0, 'both in-area codes seen');
  t.diagnostic(`${pairs.size} distinct statuses rendered; ${seen.in_area_kind} in_area_kind, ${seen.in_area_other} in_area_other`);
});

test('in_area_other takes the neutral sentence, alone or inside CJR-X', () => {
  assert.equal(reasonText('in_area_other', 'acute').text, NEUTRAL);
  assert.equal(reasonText('in_area_other', 'unknown').text, NEUTRAL);
  assert.ok(reasonText('cjrx', ['in_area_other', 'acute']).text.startsWith(NEUTRAL));
  assert.match(reasonText('in_area_kind', 'critical_access').text, /of this kind isn.t paid/);
});

test('area_unknown reads true under its NO tag: off the list, county not placed', () => {
  const r = reasonText('area_unknown', null);
  assert.equal(r.tag, 'NO');
  assert.match(r.text, /^Not on CMS.s list of TEAM participants\. /);
  assert.match(r.text, /couldn.t place its county in or out of a TEAM area/);
  assert.doesNotMatch(r.text, /can.t say/, 'says it cannot say under a NO tag');
  assert.deepEqual([COPY.areaUnknown.claim].flat(), ['TEAM-09']);
});

test('a CJR-X status whose inner code contradicts the rules is refused', () => {
  for (const code of ['in', 'in27', 'maryland', 'cjrx']) assert.throws(() => reasonText('cjrx', [code, null]), RangeError, code);
  assert.equal(reasonText('cjrx', ['in_area_kind', 'psychiatric']).tag, 'NO');
});

test('reasonText refuses a code or kind it has no words for', () => {
  assert.throws(() => reasonText('nonsense', null), RangeError);
  assert.throws(() => reasonText('in_area_kind', 'no-such-kind'), RangeError);
  assert.throws(() => reasonText('cjrx', ['cjrx', null]), RangeError);
  assert.throws(() => reasonText('in27', null), TypeError);
});

// The copy gate (pipeline/test/copy-gate.test.js) reads these words with the site's copy.js: their claims resolve and
// every register row is used. Here, the lookup's own rule: TEAM is never called a penalty.
test('lookup copy: never calls TEAM a penalty', () => {
  for (const [key, entry] of Object.entries(COPY)) assert.doesNotMatch(entry.text, /penalt/i, `${key}: calls TEAM a penalty`);
});

// The file the browser fetches (generate.js emits it hashed; client/lookup.js reads it): the codes as lookupAsset gives
// them, each distinct status's words once ([tag, text, link], keyed by its [code, arg] as JSON), the hub's folder for a
// hospital's page, and the box's own words. Its words are the copy's, so the page's script carries none of them.
test('lookupFile: the codes, each status\'s words once, the hub folder and the box\'s words', () => {
  const file = lookupFile(team);
  assert.deepEqual(file.cols, asset.cols);
  assert.deepEqual(file.rows, asset.rows);
  assert.equal(file.hub, hospitalPathOf('hub', 'x').slice(0, -'x/'.length));
  const keys = new Set(asset.rows.map(([, code, arg]) => JSON.stringify([code, arg])));
  assert.deepEqual(new Set(Object.keys(file.reasons)), keys, 'one entry per distinct status, and no other');
  for (const key of keys) {
    const { tag, text, link } = reasonText(...JSON.parse(key));
    assert.deepEqual(file.reasons[key], [tag, text, link]);
  }
  const words = Object.entries(file.words);
  assert.deepEqual(Object.keys(file.words).sort(), ['count', 'countMore', 'countOne', 'empty', 'no', 'toCalc', 'toHub', 'yes']);
  for (const [key, text] of words) {
    assert.ok(typeof text === 'string' && text.trim(), key);
    assert.doesNotMatch(text, /\d|penalt/i, key);
  }
  assert.match(file.words.count, /\{n\}/);
  assert.match(file.words.countMore, /\{n\}.*\{shown\}/);
  assert.ok(!/"name"/.test(JSON.stringify(file)), 'a name in the file');
});

// Outside the selected areas: an acute care hospital's reason names no kind (TEAM covers that kind; its area is the
// reason), and neither does one of unknown kind; every other kind the file sends there leads with the family's word for
// it, the same words the search shows.
test('outside: a kind other than acute leads with its kind; acute and unknown keep the area sentence', () => {
  const plain = reasonText('outside', 'acute').text;
  assert.equal(plain, copyOf(COPY).fill('outside'));
  assert.equal(reasonText('outside', 'unknown').text, plain);
  const kinds = new Set(asset.rows.map(([, code, arg]) => inner([code, arg])).filter(([why]) => why === 'outside').map(([, kind]) => kind));
  assert.ok(kinds.size > 3, `${kinds.size} kinds outside the areas`);
  for (const kind of kinds) {
    const r = reasonText('outside', kind);
    assert.equal(r.tag, 'NO', kind);
    if (kind === 'acute' || kind === 'unknown') continue;
    assert.ok(r.text.startsWith(`${SEARCH['hospitalKind.' + kind]}, outside the areas CMS selected for TEAM, so not in TEAM.`), kind);
  }
  assert.ok(reasonText('outside', 'critical_access').text.startsWith('Critical access hospital, '));
  assert.deepEqual(COPY.outsideKind.claim, COPY.outside.claim, 'the same claims as the area sentence');
  assert.throws(() => reasonText('outside', 'no-such-kind'), RangeError);
});

// "CJR-X" never breaks at its hyphen: every TEAM copy says it with a non-breaking one (U+2011).
test('every TEAM copy says CJR\u2011X with a non-breaking hyphen', () => {
  const all = Object.entries({ ...SITE_COPY, ...COPY });
  assert.ok(all.some(([, { text }]) => text.includes('CJR\u2011X')));
  for (const [key, { text }] of all) assert.doesNotMatch(text, /CJR-X/, `${key}: an ASCII hyphen in CJR-X`);
  assert.match(reasonText('cjrx', ['outside', 'acute']).text, /In CJR\u2011X from /);
});
