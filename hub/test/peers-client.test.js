// The hospital page's peer groups as its script makes them, from the browser asset (decoded rows carry a hospital's
// size band, not its bed count): each mode's group equals a direct filter of the decoded rows, and matches the build's
// group for the same hospital; a hospital with no teaching status has no teaching group. Then the pure words and
// scale the build and the script share (the group's name, the rows' one scale, the program row's sentence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BED_BAND_EDGES, PEER_MODES, peerKey } from '../../engine/js/peers.js';
import { fillCopy } from '../../web/render/components.js';
import { decodeRows } from '../../web/client/hub-asset.js';
import { hubAsset } from '../asset.js';
import { loadHub } from '../data.js';
import { COPY } from '../hospital/copy.js';
import { stripLayout } from '../client/hospital/strips.js';
import { shareDomain } from '../client/scale.js';
import { ROWS, groupName, peerFigures, peersOf, rowDollars, rowFigures, sumScale, sumValues } from '../hospital/peers.js';
import { whyText } from '../hospital/text.js';
import { hubHospitals } from '../model.js';

const fill = (key, values) => fillCopy(COPY, key, values);
const hub = loadHub();
const built = hubHospitals(hub);
const { hospitals } = decodeRows(JSON.parse(JSON.stringify(hubAsset(built, { shapes: hub.shapes, fy: hub.fy }))));
const builtBy = new Map(built.map((h) => [h.ccn, h]));
const estimated = hospitals.filter((h) => h.est);

// One hospital of each kind, picked by property.
const sample = [
  estimated.find((h) => h.teach === 'none' && h.band === 1),
  estimated.find((h) => h.teach === 'major'),
  estimated.find((h) => h.band === 3),
  estimated.find((h) => h.band === 0 && h.teach === 'minor'),
];

test('each mode\'s peers from the decoded asset equal a direct filter, and the build\'s group', () => {
  const direct = {
    state: (h) => estimated.filter((x) => x.state === h.state),
    size: (h) => estimated.filter((x) => x.band === h.band),
    teach: (h) => estimated.filter((x) => x.teach === h.teach),
  };
  for (const h of sample) {
    assert.ok(h, 'a sample hospital of each kind');
    for (const mode of PEER_MODES) {
      const peers = peersOf(hospitals, h, mode);
      assert.ok(peers.includes(h), `${mode}: the hospital is among its peers`);
      assert.deepEqual(peers.map((x) => x.ccn), direct[mode](h).map((x) => x.ccn), `${mode}: a direct filter`);
      assert.equal(peers.length, peersOf(built, builtBy.get(h.ccn), mode).length, `${mode}: the build's count`);
    }
  }
});

test('a hospital with no teaching status has no teaching group, and its other groups stand', () => {
  const h = estimated.find((x) => x.teach === null);
  assert.ok(h, 'a hospital with no teaching status');
  assert.equal(peersOf(hospitals, h, 'teach'), null);
  assert.ok(peersOf(hospitals, h, 'state').length > 0);
  assert.ok(peersOf(hospitals, h, 'size').length > 0);
});

test('every group has a name, with the band\'s edges from the constants', () => {
  const at = (band) => estimated.find((h) => h.band === band);
  assert.equal(groupName(fill, { state: 'ZZ' }, 'state'), 'ZZ hospitals');
  assert.equal(groupName(fill, at(0), 'size'), `hospitals with fewer than ${BED_BAND_EDGES[0]} beds`);
  assert.equal(groupName(fill, at(1), 'size'), `hospitals with ${BED_BAND_EDGES[0]} to ${BED_BAND_EDGES[1] - 1} beds`);
  assert.equal(groupName(fill, at(3), 'size'), `hospitals with ${BED_BAND_EDGES[2]} beds or more`);
  assert.equal(groupName(fill, { teach: 'major' }, 'teach'), 'major teaching hospitals');
  assert.equal(groupName(fill, { teach: 'none' }, 'teach'), 'non-teaching hospitals');
  assert.equal(groupName(fill, { teach: null }, 'teach'), null);
});

test('the dollar rows\' one scale holds every mode\'s medians, so a toggle moves only the ticks', () => {
  const h = sample[0];
  const sets = PEER_MODES.map((mode) => peerFigures(peersOf(hospitals, h, mode)));
  const x = sumScale(sumValues(h.est, sets));
  for (const f of sets) {
    for (const id of [...ROWS.map((r) => r.id), 'net']) {
      const { own, median } = rowDollars(h.est, id, f);
      for (const v of [own, median, 0]) if (v !== null) assert.ok(x(v) > 0 && x(v) < 1, `${id}: ${v} inside the track`);
    }
  }
  const zero = sumScale([0]);
  assert.ok(Number.isFinite(zero(0)), 'all zero is a scale too');
});

test('a program row\'s sentence names the peers and never prints NaN or undefined', () => {
  const h = sample[0];
  for (const mode of PEER_MODES) {
    const peers = peersOf(hospitals, h, mode);
    const figures = peerFigures(peers);
    for (const { id } of ROWS) {
      const text = whyText(fill, h, id, figures[id], { fy: '2026', group: groupName(fill, h, mode) }).join(' ');
      assert.ok(text.includes(`Of the ${peers.length.toLocaleString('en-US')} `), `${mode} ${id}: ${text}`);
      assert.ok(!/NaN|undefined|Infinity/.test(text), text);
    }
  }
});

// The strips (hub/client/hospital/strips.js stripLayout) for every group the page can show, at a 320, 390 and 1440 screen's
// strip width and one, two and three device pixels to a CSS pixel: every row's pile fits as separate dots (the $0 gutter
// widens as it must), and every hospital stands at its own value: within its bin's width of it, on the right side of its
// group's median whenever it is more than two pitches from it (exactly $0 anywhere in its gutter), and with bins at most three dots wide on any screen but a
// 1x phone's (where the two largest groups' Readmissions spike needs more).
test('every strip keeps separate dots, each at its own value', () => {
  const domain = shareDomain(hospitals);
  const groups = new Map();
  for (const mode of PEER_MODES) {
    for (const h of estimated) {
      const key = peerKey(h, mode);
      if (key === null) continue;
      if (!groups.has(`${mode}:${key}`)) groups.set(`${mode}:${key}`, peersOf(hospitals, h, mode));
    }
  }
  let checked = 0;
  for (const [name, group] of groups) {
    for (const W of [288, 358, 628]) {
      for (const dpr of [1, 2, 3]) {
        const { scale, rows } = stripLayout(group, { W, dpr, domain });
        for (const [id, { items, pile }] of Object.entries(rows)) {
          const where = `${name} ${id} at ${W}px, ${dpr}x`;
          assert.equal(pile.fits, true, `${where}: fits`);
          if (dpr > 1 || W >= 520) assert.ok(pile.m <= 3, `${where}: bins ${pile.m} dots wide`);
          const median = rowFigures(group, id).median;
          const mx = median === null ? null : scale.xs(median * 100);
          for (const it of items) {
            const x = pile.pos.get(it.id).x;
            const tx = scale.xs(it.v);
            // Exactly $0 stands anywhere in its own gutter; any other value within its bin's width of its place.
            if (it.v === 0) assert.ok(x > scale.zL && x < scale.zR, `${where}: a $0 dot outside the gutter`);
            else assert.ok(Math.abs(x - tx) <= pile.m * pile.d + 1e-6, `${where}: a dot ${Math.abs(x - tx)} px from its value`);
            if (mx !== null && Math.abs(tx - mx) > 2 * pile.d) assert.equal(Math.sign(x - mx), Math.sign(tx - mx), `${where}: a dot on the wrong side of the median`);
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 100000, `${checked} dots checked`);
});
