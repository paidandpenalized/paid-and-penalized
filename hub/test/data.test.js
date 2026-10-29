import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_ID } from '../../web/charts/geo.js';
import { nameText } from '../../web/render/format.js';
import { checkHubInputs, loadHub } from '../data.js';

test('the atlas id is exported from the map module and names a pinned input', async () => {
  assert.equal(ATLAS_ID, 'us-atlas-counties-3.0.1');
  const { readManifest } = await import('../../pipeline/files.js');
  assert.ok(readManifest().some((e) => e.id === ATLAS_ID));
});

test('loadHub reads the newest dollar file, the master, the pinned Thirty Day Readmissions file and the atlas, once', () => {
  const hub = loadHub();
  assert.equal(loadHub(), hub, 'memoized');
  assert.equal(hub.fy, hub.dollars.fy);
  assert.equal(hub.builtAt, hub.dollars.built_at);
  assert.match(hub.builtAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(hub.master instanceof Map && hub.master.size >= hub.dollars.hospitals.length);
  for (const row of hub.dollars.hospitals) assert.ok(hub.master.has(row.ccn));
  assert.ok(hub.tdr.hospitals instanceof Map && hub.tdr.hospitals.size > 0);
  assert.equal(typeof hub.tdr.fy, 'number');
  assert.ok(Array.isArray(hub.tdr.conditions) && hub.tdr.conditions.length > 0);
  // Each hospital's peer group has a median for each condition it has a ratio for.
  for (const r of hub.tdr.hospitals.values()) for (const key of Object.keys(r.c)) assert.equal(typeof hub.tdr.peerMedians[String(r.peer)]?.[key], 'number', 'a peer median for each condition');
  for (const [ccn, h] of hub.tdr.hospitals) assert.equal(h.id, ccn);
  assert.ok(hub.shapes instanceof Map && hub.shapes.has('DC'));
});

// Invented inputs: one dollar file, its master and a TDR file.
const inputs = (over = {}) => ({
  dollars: { fy: 2026, hospitals: [{ ccn: '990001' }, { ccn: '990002' }] },
  masterFile: { programYears: { hacrp: 2026, hrrp: 2027 }, hospitals: [{ ccn: '990001' }, { ccn: '990002' }, { ccn: '990003' }] },
  tdrFy: 2027,
  ...over,
});

test('checkHubInputs passes matching years and a master that holds every dollar CCN', () => {
  assert.doesNotThrow(() => checkHubInputs(inputs()));
});

test('checkHubInputs stops when the dollar file is not for the master\'s HACRP year', () => {
  assert.throws(() => checkHubInputs(inputs({ dollars: { fy: 2025, hospitals: [] } })), (e) => e instanceof RangeError && /^hub: /.test(e.message) && /2025/.test(e.message) && /2026/.test(e.message));
  // A master that names no program years cannot be matched either.
  assert.throws(() => checkHubInputs(inputs({ masterFile: { hospitals: [] } })), (e) => e instanceof RangeError && /^hub: /.test(e.message));
});

test('checkHubInputs names a master with no program years in a hub RangeError, whatever the other years are (never a TypeError)', () => {
  const isHub = (e) => e instanceof RangeError && /^hub: /.test(e.message) && /program years/.test(e.message);
  // Every year missing at once: undefined equals undefined, which once slipped past to a TypeError.
  assert.throws(() => checkHubInputs({ dollars: { hospitals: [] }, masterFile: { hospitals: [] } }), isHub);
  assert.throws(() => checkHubInputs(inputs({ masterFile: { programYears: null, hospitals: [] } })), isHub);
  assert.throws(() => checkHubInputs(inputs({ masterFile: { programYears: { hacrp: 2026 }, hospitals: [] } })), isHub);
  assert.throws(() => checkHubInputs(inputs({ masterFile: { programYears: { hrrp: 2027 }, hospitals: [] } })), isHub);
});

test('checkHubInputs stops when a dollar CCN has no master record', () => {
  const dollars = { fy: 2026, hospitals: [{ ccn: '990001' }, { ccn: '990009' }] };
  assert.throws(() => checkHubInputs(inputs({ dollars })), (e) => e instanceof RangeError && /^hub: /.test(e.message) && e.message.includes('990009'));
});

test('checkHubInputs stops when the Thirty Day Readmissions file is not for the master\'s HRRP year', () => {
  assert.throws(() => checkHubInputs(inputs({ tdrFy: 2026 })), (e) => e instanceof RangeError && /^hub: /.test(e.message) && /2026/.test(e.message) && /2027/.test(e.message));
});

// What every hub page, the chip, the search and the asset show: the master's names with each initialism in capitals.
test('loadHub\'s master holds each name as the pages print it: no initialism left as a word ("Ihs" for IHS)', () => {
  const { master } = loadHub();
  const left = [...master.values()].filter((r) => nameText(r.name) !== r.name).length;
  assert.equal(left, 0, `${left} names with an initialism left in lower case`);
});

// Three initialisms longer than most, each in one name in the pinned master, that the list once missed.
test('the hub\'s names print SEARHC, CHSLI and LTACH in capitals, never as words', () => {
  const left = [...loadHub().master.values()].filter((r) => /\b(Searhc|Chsli|Ltach)\b/.test(r.name)).length;
  assert.equal(left, 0, `${left} names with one of them as a word`);
});
