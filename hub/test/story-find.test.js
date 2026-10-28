// The home story's last two steps (hub/client/story/find.js, map.js): the peer line and the card a found hospital gets,
// in each way of grouping, on the data as the browser decodes it; the states' readout lines (normal and Maryland); and
// the state an address's #state= names. No hospital is named: rows are picked by property, or the example by its CCN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BED_BAND_EDGES, PEER_MODES, median, peerKey } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { fillCopy } from '../../web/render/components.js';
import { count, dollars } from '../../web/render/format.js';
import { hospitalPathOf } from '../../web/site.js';
import { COPY as STORY_COPY } from '../client/story/copy.js';
import { cardModel, peerLine, sizeWords } from '../client/story/find.js';
import { lineOf, stateFromHash } from '../client/story/map.js';
import { loadHub } from '../data.js';
import { stateLine, statesMap } from '../home/states.js';
import { groupName, peersOf } from '../hospital/peers.js';
import { signedShareText } from '../hospital/text.js';
import { EXAMPLE_CCN, hubHospitals, stateTotals } from '../model.js';
import { decodedHub } from './helpers.js';

const hub = loadHub();
const server = hubHospitals(hub);
const { hospitals, byCcn, fy } = decodedHub(hub);
const example = byCcn.get(EXAMPLE_CCN);
const estimated = hospitals.filter((h) => h.est);

// The peer line as the hospital's peers in `mode` make it, worked out here the long way.
function expectedLine(h, mode, group) {
  const key = mode === 'state' ? h.state : mode === 'size' ? h.band : h.teach;
  const of = mode === 'state' ? (x) => x.state : mode === 'size' ? (x) => x.band : (x) => x.teach;
  const peers = estimated.filter((x) => of(x) === key);
  const cut = peers.filter((x) => x.est.net < 0).length;
  return `Of ${count(peers.length)} ${group}, ${count(cut)} take a net cut; the median is ${signedShareText(median(peers.map((x) => x.est.share)))}.`;
}

test('peerLine: the hospital\'s group in each way of grouping, counted, with its net cuts and median, in the hospital page\'s figures', () => {
  const sizeOf = (band) => (band === 0 ? `under ${count(BED_BAND_EDGES[0])} beds`
    : band === BED_BAND_EDGES.length ? `${count(BED_BAND_EDGES[band - 1])} or more beds`
      : `${count(BED_BAND_EDGES[band - 1])} to ${count(BED_BAND_EDGES[band] - 1)} beds`);
  const teachOf = { major: 'major teaching hospitals', minor: 'minor teaching hospitals', none: 'non-teaching hospitals' };
  // The example, and a hospital of each band and teaching status (picked by property).
  const picks = [example, ...[0, 1, 2, 3].map((b) => estimated.find((h) => h.band === b)), ...['major', 'minor'].map((t) => estimated.find((h) => h.teach === t))];
  for (const h of picks) {
    assert.ok(h, 'a hospital with that property');
    assert.equal(peerLine(h, peersOf(estimated, h, 'state'), 'state'), expectedLine(h, 'state', `${STATE_NAMES[h.state]} hospitals`));
    assert.equal(peerLine(h, peersOf(estimated, h, 'size'), 'size'), expectedLine(h, 'size', `hospitals with ${sizeOf(h.band)}`));
    assert.equal(peerLine(h, peersOf(estimated, h, 'teach'), 'teach'), expectedLine(h, 'teach', teachOf[h.teach]));
  }
  // The brief's shape: "Of 117 Ohio hospitals, 81 take a net cut; the median is −0.47%."
  assert.match(peerLine(example, peersOf(estimated, example, 'state'), 'state'), /^Of [\d,]+ [A-Z][A-Za-z ]+ hospitals, [\d,]+ take a net cut; the median is [−+]?\d+\.\d+%\.$/);
});

test('groups: a hospital without a bed count or teaching status has no group there; every group holds the hospital', () => {
  const noTeach = { ...example, teach: null };
  const noBeds = { ...example, band: null };
  assert.equal(peerKey(noTeach, 'teach'), null);
  assert.equal(peerKey(noBeds, 'size'), null);
  assert.equal(peersOf(estimated, noTeach, 'teach'), null);
  assert.equal(peersOf(estimated, noBeds, 'size'), null);
  assert.ok(peerKey(noBeds, 'state'));
  for (const mode of PEER_MODES) {
    const peers = peersOf(estimated, example, mode);
    assert.ok(peers.includes(example), mode);
    assert.ok(peers.every((x) => x.est), `${mode}: only hospitals with an estimate`);
  }
  assert.equal(groupName((key, values) => fillCopy(STORY_COPY, key, values), example, 'state'), `${STATE_NAMES[example.state]} hospitals`);
  assert.deepEqual([0, 1, 2, 3].map(sizeWords), [`under ${count(BED_BAND_EDGES[0])} beds`, `${count(BED_BAND_EDGES[0])} to ${count(BED_BAND_EDGES[1] - 1)} beds`,
    `${count(BED_BAND_EDGES[1])} to ${count(BED_BAND_EDGES[2] - 1)} beds`, `${count(BED_BAND_EDGES[2])} or more beds`]);
});

test('cardModel: the hospital\'s place, net, programs and peers; a hospital outside value-based purchasing reads "Not in this program", never $0', () => {
  const out = estimated.find((h) => !h.est.vbpListed && h.est.hrrpListed);
  assert.ok(out, 'a hospital not in value-based purchasing');
  const m = cardModel(out, peersOf(estimated, out, 'state'), 'state', fy);
  assert.equal(m.ccn, out.ccn);
  assert.equal(m.name, out.name);
  assert.equal(m.href, hospitalPathOf('hub', out.ccn));
  const vbp = m.rows.find((r) => r.key === 'programVbp');
  assert.deepEqual(vbp, { key: 'programVbp', label: 'Value-based purchasing', text: 'Not in this program', kind: 'na' });
  const hrrp = m.rows.find((r) => r.key === 'programHrrp');
  assert.equal(hrrp.text, `${dollars(out.est.hrrp, { sign: true })} ${out.est.hrrp < 0 ? 'cut' : out.est.hrrp > 0 ? 'bonus' : 'no change'}`);
  assert.equal(m.usd, dollars(out.est.net, { sign: true }));
  assert.equal(m.pct, signedShareText(out.est.share));
  assert.equal(m.pen, out.est.net < 0);
  assert.match(m.netWords, new RegExp(`^Estimated FY${fy} net `));
  assert.equal(m.peer, peerLine(out, peersOf(estimated, out, 'state'), 'state'));
  assert.match(m.place, new RegExp(`^${out.city}, ${out.state}\\. `));
  const said = JSON.stringify(m);
  for (const bad of ['NaN', 'undefined', 'Infinity', 'null']) assert.ok(!said.includes(bad), bad);
  // The example: in both programs, a size and a teaching status.
  const ex = cardModel(example, peersOf(estimated, example, 'size'), 'size', fy);
  assert.ok(ex.rows.every((r) => r.kind !== 'na'));
  assert.equal(ex.place, `${example.city}, ${example.state}. ${sizeWords(example.band)}, non-teaching.`);
  assert.match(ex.peer, /^Of [\d,]+ hospitals with /);
  // A size band starts its sentence with a capital.
  const small = estimated.find((h) => h.band === 0);
  assert.match(cardModel(small, [small], 'state', fy).place, new RegExp(`^${small.city}, ${small.state}\\. Under [\\d,]+ beds, `));
  // No bed count, no teaching status: the place says so without a gap.
  assert.equal(cardModel({ ...example, band: null, teach: null }, [example], 'state', fy).place, `${example.city}, ${example.state}. Teaching status not reported.`);
  // A record without a city still has a place.
  assert.match(cardModel({ ...example, city: null }, [example], 'state', fy).place, new RegExp(`^${example.state}\\. `));
});

test('the states\' readout: each state\'s line as its title on the map (a normal state, and Maryland outside these programs)', () => {
  const states = stateTotals(server);
  const map = statesMap({ shapes: hub.shapes, states });
  const titleOf = (code) => new RegExp(`<path class="st[^"]*" data-st="${code}"[^>]*><title>([^<]*)</title>`).exec(map)?.[1];
  const normal = [...states.values()].find((s) => !s.notInPrograms && s.n > 10).state;
  // A stand-in path as the page has it (its title's text), and a small state's button (its name).
  const path = (code) => ({ querySelector: (sel) => (sel === 'title' ? { textContent: titleOf(code) } : null), getAttribute: () => null });
  const button = (label) => ({ querySelector: () => null, getAttribute: (k) => (k === 'aria-label' ? label : null) });
  assert.equal(lineOf(path(normal)), stateLine(normal, states.get(normal)));
  assert.match(lineOf(path(normal)), new RegExp(`^${STATE_NAMES[normal]}: [\\d,]+ hospitals, net [−+]?\\d\\.\\d\\d% of pay, \\d+% take a net cut$`));
  assert.match(lineOf(path('MD')), /^Maryland: not in these programs\. Its [\d,]+ hospitals are paid under the state’s all-payer model\.$/);
  assert.equal(lineOf(button('Delaware: 6 hospitals')), 'Delaware: 6 hospitals');
  assert.equal(lineOf({ querySelector: () => null, getAttribute: () => null }), null);
});

test('stateFromHash: a fifty-state or DC code in #state=, in either case, else nothing', () => {
  assert.equal(stateFromHash('#state=OH'), 'OH');
  assert.equal(stateFromHash('#state=oh'), 'OH');
  assert.equal(stateFromHash('#state=MD'), 'MD');
  assert.equal(stateFromHash('#state=DC'), 'DC');
  for (const bad of ['', '#', '#state=', '#state=PR', '#state=XX', '#state=OHI', '#state=O', '#state=<img src=x>', '#state=OH&state=TX', '#step-states', '#STATE=OH', '#state=%4F%48', null, undefined]) {
    assert.equal(stateFromHash(bad), null, String(bad));
  }
});
