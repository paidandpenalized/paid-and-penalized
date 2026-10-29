// The home story's layouts (hub/client/story/layouts.js, geometry.js) on the real data, decoded as the browser decodes
// it, at the stage sizes a reader meets: phones 320 and 390 wide (the stage pinned in the lower 56% of the window) and
// desktops 1024 and 1440 (the stage beside the steps, under the header), each in a 640 and a 900 tall window, at the
// device pixel ratios those screens have. Every dot stays on the stage and visibly its own; each step puts each hospital
// where its numbers say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHub } from '../data.js';
import { EXAMPLE_CCN, hubHospitals, storyFacts } from '../model.js';
import { shareDomain } from '../client/scale.js';
import { BAR } from '../client/story/bar-frame.js';
import { INK, NEUTRAL, PEN, REW } from '../client/colors.js';
import { drawnDot } from '../client/pile.js';
import { fitBox, gateLines, stageGeometry } from '../client/story/geometry.js';
import { WIDE_MAX, createLayouts, storyRows } from '../client/story/layouts.js';
import { decodedHub } from './helpers.js';

const hub = loadHub();
const server = hubHospitals(hub);
const facts = storyFacts(server);
const asset = decodedHub(hub);
const rows = storyRows(asset.hospitals);
const N = rows.length;
const domain = shareDomain(asset.hospitals);
const example = asset.byCcn.get(EXAMPLE_CCN);
const statePeers = rows.map((r) => r.h).filter((h) => h.state === example.state);

// The header's height on a desktop (the stage sits under it), and the share of a phone's window the stage takes, as the
// page lays them out (measured in Chrome); on a short phone (740 px tall or less) the stage leaves the words SHORT_WORDS
// under the phone's header, but is never under SHORT_LEAST, the least in which every pile fits (hub/styles.css).
const HEADER = 101.4;
const PHONE_SHARE = 0.56;
const PHONE_HEADER = 100;
const SHORT_WORDS = 246;
const SHORT_LEAST = 290;
// The stage for a window: its size, whether the rail is hidden (its step's name then sits in the stage) and the device
// pixel ratios such a screen has. On a desktop the story's grid is the page's width (1,180 at most) less its gutters, the
// rail (wide windows only), the text column and the 24px between text and stage.
function stageFor(vw, vh) {
  if (vw <= 760) return { W: vw, H: vh <= 740 ? Math.max(SHORT_LEAST, vh - PHONE_HEADER - SHORT_WORDS) : vh * PHONE_SHARE, railHidden: true, dprs: [2, 3] };
  const content = Math.min(vw, 1180) - 32 - 24;
  return vw >= 1080 ? { W: content - 150 - 400, H: vh - HEADER, railHidden: false, dprs: [1, 2] } : { W: content - 360, H: vh - HEADER, railHidden: true, dprs: [1, 2] };
}

// The brief's windows (320, 390, 1024 and 1440 wide, 640 and 900 tall) and the common desktop windows whose short heights
// make the steepest pile tightest (a laptop's 1366×657 and 1280×720, a 1440 window with its browser's bars, 1024×768).
const WINDOWS = [[320, 640], [320, 900], [390, 640], [390, 900], [1024, 640], [1024, 900], [1440, 640], [1440, 900],
  [1366, 657], [1440, 790], [1280, 720], [1024, 768], [375, 667], [320, 568]];
const SIZES = [];
for (const [vw, vh] of WINDOWS) {
  const st = stageFor(vw, vh);
  for (const dpr of st.dprs) SIZES.push({ name: `${vw}×${vh} at ${dpr}x`, vw, vh, ...st, px: 1 / dpr, dpr });
}

// Every layout of the story at a size, in the order the stage builds them.
function all(size) {
  const g = stageGeometry({ W: size.W, H: size.H, railHidden: size.railHidden, px: size.px, domain });
  const L = createLayouts({ rows, g, mapW: asset.mapW, mapH: asset.mapH });
  const bar = L.layBar();
  const start = L.layStart();
  const g1 = L.layGate(1, start);
  const g2 = L.layGate(2, g1);
  const g3 = L.layGate(3, g2);
  const net = L.layNet(g3);
  return { g, layouts: { bar, start, g1, g2, g3, net, map: L.layMap(false), mapfill: L.layMap(true), you: L.layYou(example, statePeers) } };
}

// The visible dots of a layout among ids from..to, as the stage draws them on a screen of dpr (pile.js drawnDot): by
// column, a whole number of device pixels between neighbours where the dots are squares on the device's grid, and at
// least one device pixel of paper between two dots side by side or one above the other.
function assertSeparate(L, from, to, dpr, what) {
  const byX = new Map();
  let side = 0;
  let square = false;
  for (let i = from; i < to; i++) {
    if (L.A[i] <= 0) continue;
    const dot = drawnDot(L.R[i], dpr);
    side = Math.max(side, dot.side);
    square = square || dot.square;
    if (!byX.has(L.X[i])) byX.set(L.X[i], []);
    byX.get(L.X[i]).push(L.Y[i]);
  }
  const apart = (a, b, where) => {
    const dp = Math.abs(b - a) * dpr;
    if (square) assert.ok(Math.abs(dp - Math.round(dp)) < 1e-4, `${what}: ${where} ${dp} device pixels apart, not whole`);
    assert.ok(dp - side >= 1 - 1e-4, `${what}: ${where}: ${side} device-pixel dots ${dp} device pixels apart touch`);
  };
  const xs = [...byX.keys()].sort((a, b) => a - b);
  for (let k = 1; k < xs.length; k++) apart(xs[k - 1], xs[k], `columns at ${xs[k - 1]} and ${xs[k]}`);
  for (const col of byX.values()) {
    col.sort((a, b) => a - b);
    for (let k = 1; k < col.length; k++) apart(col[k - 1], col[k], 'two dots in a column');
  }
}

// A desktop zoomed out to 50% (the stage clamps the device pixel it lays out with to 1, so this is belt and braces): the
// layouts still build, every pile fits and stays separate as drawn.
SIZES.push({ ...SIZES.find((s) => s.vw === 1440 && s.vh === 900), name: '1440×900 at 0.5x', px: 2, dpr: 0.5 });

test('zoomed out to 33%, every layout still builds, every dot placed (nothing throws)', () => {
  // The stage never lays out below 1x; here the layouts get a 3px device pixel anyway, and must not throw or lose a dot.
  const { layouts } = all({ ...SIZES.find((s) => s.vw === 1440 && s.vh === 900), px: 3 });
  for (const [name, L] of Object.entries(layouts)) {
    for (let i = 0; i < 2 * N; i++) assert.ok(Number.isFinite(L.X[i]) && Number.isFinite(L.Y[i]) && L.R[i] > 0, `${name}: dot ${i} unplaced`);
  }
});

for (const size of SIZES) {
  test(`at ${size.name}: every dot on the stage, at least 0.4px across, each pile separate dots`, () => {
    const { g, layouts } = all(size);
    for (const [name, L] of Object.entries(layouts)) {
      assert.equal(L.X.length, 2 * N, `${name}: 2N targets`);
      for (let i = 0; i < 2 * N; i++) {
        if (L.A[i] <= 0) continue;
        assert.ok(L.R[i] >= 0.4, `${name}: r ${L.R[i]}`);
        assert.ok(L.X[i] - L.R[i] >= 0 && L.X[i] + L.R[i] <= g.W && L.Y[i] - L.R[i] >= 0 && L.Y[i] + L.R[i] <= g.H, `${name}: dot ${i} at ${L.X[i]}, ${L.Y[i]} off the ${g.W}×${g.H} stage`);
      }
      // Every hospital is drawn in every step (the copies only in the last).
      for (let i = 0; i < N; i++) assert.ok(L.A[i] > 0 || !Number.isFinite(rows[i].h.x), `${name}: hospital ${i} unseen`);
    }
    for (const name of ['g1', 'g2', 'g3', 'net']) {
      assert.equal(layouts[name].info.fits, true, `${name} fits its room`);
      assertSeparate(layouts[name], 0, N, size.dpr, name);
    }
    assert.equal(layouts.you.info.fits, true, 'everyone\'s swarm and the peers\' fit');
    assertSeparate(layouts.you, 0, N, size.dpr, 'you, everyone');
    assertSeparate(layouts.you, N, 2 * N, size.dpr, 'you, the peers');
    // The start block is one block of separate dots.
    assertSeparate(layouts.start, 0, N, size.dpr, 'start');
  });
}

// A 1x office monitor's piles must not read as hairline stipple: every dot of a step's pile is drawn at least two device
// pixels across (with a device pixel between), at every size and device pixel ratio; the too-tall bins widen instead
// (R24, adaptive). Only a pile whose widened bin would then stand more than WIDE_MAX of the axis across keeps the
// device's own floor: a 1x window far shorter than any here.
for (const size of SIZES.filter((s) => s.dpr >= 1)) {
  test(`at ${size.name}: the piles' dots are at least two device pixels across`, () => {
    const { layouts } = all(size);
    for (const name of ['start', 'g1', 'g2', 'g3', 'net', 'you']) {
      const L = layouts[name];
      let least = Infinity;
      for (let i = 0; i < 2 * N; i++) if (L.A[i] > 0) least = Math.min(least, drawnDot(L.R[i], size.dpr).side);
      assert.ok(least >= 2 - 1e-9, `${name}: a dot ${least} device pixels across`);
      assert.ok(!L.info.small, `${name}: no fallback`);
    }
  });
}

test('a 1x window far shorter than a laptop\'s keeps the device\'s floor where two-pixel dots would swallow a pile\'s shape', () => {
  const g = stageGeometry({ W: 320, H: 358, railHidden: true, px: 1, domain });
  const L = createLayouts({ rows, g, mapW: asset.mapW, mapH: asset.mapH });
  const you = L.layYou(example, statePeers);
  assert.equal(you.info.small, true);
  assert.equal(you.info.fits, true);
  assertSeparate(you, 0, N, 1, 'everyone at 320 px, 1x');
  // Its widest bin at the device's floor stands within WIDE_MAX of the axis.
  const xs = [...new Set(Array.from({ length: N }, (_, i) => you.X[i]))].sort((a, b) => a - b);
  assert.ok(xs.length > (g.x1 - g.x0) / 4, `${xs.length} dot columns: the swarm keeps its shape`);
  assert.ok(WIDE_MAX > 0 && WIDE_MAX < 0.25);
});

// The column step 3's words point at ("the tall column: 147 whose only cut is this one") stands a few dots wide, so it
// reads as a column, not a thread, at every size; its count's anchor is its top left.
for (const size of SIZES.filter((s) => s.dpr >= 1)) {
  test(`at ${size.name}: the hospital-acquired conditions column is a few dots wide`, () => {
    const { layouts } = all(size);
    const L = layouts.g2;
    const only = rows.flatMap((r, i) => (r.c[1] === 0 && r.c[2] < 0 ? [i] : []));
    const xs = new Set(only.map((i) => L.X[i]));
    assert.ok(xs.size >= 3, `${xs.size} dot columns`);
    const { block } = L.info.only;
    assert.ok(block.right - block.left >= 2 * Math.min(...only.map((i) => 2 * L.R[i])), 'the block spans its columns');
    assert.ok(L.info.only.x <= Math.min(...only.map((i) => L.X[i])), 'the count sits left of the column');
  });
}

const SIZE = SIZES.find((s) => s.vw === 390 && s.vh === 900 && s.dpr === 3);
const { g, layouts } = all(SIZE);
const { zL, zR } = g.scale;
const sideOf = (L, i) => (L.X[i] + L.R[i] <= zL + 1e-6 ? -1 : L.X[i] - L.R[i] >= zR - 1e-6 ? 1 : 0);

test('every step\'s values sit inside the share axis\'s domain, so none is clamped to its end', () => {
  for (const r of rows) for (const v of r.c) assert.ok(v >= domain[0] && v <= domain[1], `${v} outside ${domain}`);
});

test('layBar: each hospital at its dot of the scale bar (ordered by pay along it), in the bar\'s ink; no copy shows', () => {
  const L = layouts.bar;
  const byPay = rows.map((r, i) => i).sort((a, b) => rows[a].h.est.total - rows[b].h.est.total || rows[a].row - rows[b].row);
  for (let k = 1; k < byPay.length; k++) assert.ok(L.X[byPay[k]] >= L.X[byPay[k - 1]], 'the bar runs by pay');
  for (let i = 0; i < N; i++) assert.equal(L.C[i], INK);
  for (let i = N; i < 2 * N; i++) assert.equal(L.A[i], 0);
});

test('layStart: everyone in one block at $0, resting on the first gate, no program applied yet', () => {
  const L = layouts.start;
  const { block, lines } = L.info;
  assert.deepEqual(lines, gateLines(g, 0));
  for (let i = 0; i < N; i++) {
    assert.equal(L.C[i], NEUTRAL);
    assert.ok(L.Y[i] + L.R[i] <= lines[0] && L.Y[i] - L.R[i] >= block.top - 1e-6);
    assert.ok(L.X[i] >= block.left && L.X[i] <= block.right);
  }
  assert.ok(Math.abs((block.left + block.right) / 2 - g.scale.zM) < 1e-6, 'the block is centered on $0');
});

test('layGate(1) puts exactly the hospitals with a Readmissions cut left of $0, the rest in the $0 gutter', () => {
  const L = layouts.g1;
  let left = 0;
  for (let i = 0; i < N; i++) {
    const cut = rows[i].h.est.hrrp < 0;
    assert.equal(sideOf(L, i), cut ? -1 : 0, `hospital ${i}`);
    assert.equal(L.C[i], cut ? PEN : NEUTRAL);
    if (cut) left += 1;
  }
  assert.equal(left, facts.hrrpCut);
  // The $0 pile's count is the hospitals in the program at $0; those it does not list are counted apart, drawn fainter
  // and stacked at the pile's top, beside their count.
  assert.equal(L.info.zero.n, facts.hrrpZero);
  assert.equal(L.info.zero.out, facts.hrrpOut);
  // (Y grows downward: the top of the pile is the least Y.)
  let outLowest = -Infinity;
  let inHighest = Infinity;
  for (let i = 0; i < N; i++) {
    const { hrrpListed, hrrp } = rows[i].h.est;
    if (hrrp !== 0) continue;
    if (hrrpListed) {
      assert.equal(L.A[i], 1);
      inHighest = Math.min(inHighest, L.Y[i]);
    } else {
      assert.ok(L.A[i] > 0.2 && L.A[i] < 0.6, `not in the program: drawn fainter (${L.A[i]})`);
      outLowest = Math.max(outLowest, L.Y[i]);
    }
  }
  assert.ok(outLowest <= inHighest + 1e-6, 'the hospitals not in the program sit on top');
});

test('layGate(2) adds hospital-acquired conditions: cut hospitals left, the rest at $0, the HAC-only column labeled with its count', () => {
  const L = layouts.g2;
  let zero = 0;
  for (let i = 0; i < N; i++) {
    const { hrrp, hac } = rows[i].h.est;
    assert.equal(sideOf(L, i), hrrp + hac < 0 ? -1 : 0);
    if (hrrp + hac === 0) zero += 1;
  }
  assert.equal(L.info.zero.n, zero);
  assert.equal(L.info.only.n, facts.hacOnly);
  assert.ok(Number.isFinite(L.info.only.x) && L.info.only.x < zL);
});

test('layGate(3) and layNet: each hospital on the side of its net, the counts the story states (net cut, bonus, $0)', () => {
  for (const L of [layouts.g3, layouts.net]) {
    const n = { [-1]: 0, 0: 0, 1: 0 };
    for (let i = 0; i < N; i++) {
      const side = sideOf(L, i);
      assert.equal(side, Math.sign(rows[i].h.est.net));
      assert.equal(L.C[i], [PEN, NEUTRAL, REW][side + 1]);
      n[side] += 1;
    }
    assert.deepEqual([n[-1], n[1], n[0]], [facts.netCut, facts.netBonus, facts.netZero]);
  }
  assert.deepEqual([layouts.net.info.cut, layouts.net.info.bonus, layouts.net.info.zero.n], [facts.netCut, facts.netBonus, facts.netZero]);
});

test('the gates stand in order: passed ones at the top, the waiting ones above the axis; each pile rests on the next', () => {
  for (const [s, L] of [[1, layouts.g1], [2, layouts.g2], [3, layouts.g3]]) {
    const { lines } = L.info;
    assert.deepEqual(lines, gateLines(g, s));
    for (let k = 1; k < lines.length; k++) assert.ok(lines[k] > lines[k - 1]);
    for (let i = 0; i < N; i++) assert.ok(L.Y[i] + L.R[i] <= lines[s] && L.Y[i] - L.R[i] >= lines[s - 1], `gate ${s}: dot ${i} outside its room`);
  }
});

test('layMap puts every dot at its projected place inside the map box, by its net\'s sign; dimmed over the filled states', () => {
  const { m } = layouts.map.info;
  for (const [L, a] of [[layouts.map, 0.9], [layouts.mapfill, 0.3]]) {
    for (let i = 0; i < N; i++) {
      const { x, y, est } = rows[i].h;
      assert.ok(Math.abs(L.X[i] - (m.ox + x * m.k)) < 1e-3 && Math.abs(L.Y[i] - (m.oy + y * m.k)) < 1e-3);
      assert.ok(L.X[i] >= m.ox && L.X[i] <= m.ox + m.w && L.Y[i] >= m.oy && L.Y[i] <= m.oy + m.h);
      assert.equal(L.C[i], est.net < 0 ? PEN : est.net > 0 ? REW : NEUTRAL);
      assert.ok(Math.abs(L.A[i] - a) < 1e-6);
    }
  }
});

test('the drawings\' measured boxes register the dots: the map\'s SVG fitted as the browser fits it, the bar\'s at its scale', () => {
  // An SVG element box wider than its drawing: the drawing is centered at the height's scale.
  const box = fitBox({ x: 10, y: 20, w: 500, h: 200 }, asset.mapW, asset.mapH);
  assert.ok(Math.abs(box.h - 200) < 1e-9 && Math.abs(box.x - (10 + (500 - box.w) / 2)) < 1e-9);
  const measured = stageGeometry({ W: SIZE.W, H: SIZE.H, railHidden: true, px: SIZE.px, domain, boxes: { map: box, bar: { x: 30, y: 40, w: 300, h: 82 } } });
  const L = createLayouts({ rows, g: measured, mapW: asset.mapW, mapH: asset.mapH });
  const map = L.layMap(false);
  const i = rows.findIndex((r) => Number.isFinite(r.h.x));
  assert.ok(Math.abs(map.X[i] - (box.x + rows[i].h.x * (box.w / asset.mapW))) < 1e-3);
  const bar = L.layBar();
  const k = 300 / BAR.W;
  assert.ok(Math.abs(bar.R[0] - (BAR.DOT / 2) * k) < 1e-6);
  for (let j = 0; j < N; j++) assert.ok(bar.X[j] >= 30 && bar.X[j] <= 330 && bar.Y[j] >= 40 + BAR.Y * k && bar.Y[j] <= 40 + (BAR.Y + BAR.H) * k);
});

test('layYou: the hospital among its peers (the copies) above everyone; the peers\' swarm holds exactly the group, its median the group\'s', () => {
  const L = layouts.you;
  const ids = new Set(statePeers.map((h) => rows.findIndex((r) => r.h === h)));
  for (let i = 0; i < N; i++) {
    assert.ok(Math.abs(L.A[i] - 0.85) < 1e-6);
    assert.equal(L.A[N + i] > 0, ids.has(i));
  }
  assert.equal(L.info.n, statePeers.length);
  assert.ok(L.A[N + L.info.h] > 0 && L.info.h >= 0, 'the hospital is in its own group');
  assert.ok(L.info.peers[1] < L.info.all[0], 'the peers\' swarm sits above everyone\'s');
  const nets = statePeers.map((h) => h.est.pct.net).sort((a, b) => a - b);
  const mid = nets.length >> 1;
  assert.ok(Math.abs(L.info.median - (nets.length % 2 ? nets[mid] : (nets[mid - 1] + nets[mid]) / 2)) < 1e-9);
});

test('layYou with no hospital (one followed without an estimate): everyone alone, in a taller room, no copy shown', () => {
  for (const size of SIZES.filter((s) => s.dpr === 2 || s.dpr === 1)) {
    const sg = stageGeometry({ W: size.W, H: size.H, railHidden: size.railHidden, px: size.px, domain });
    const L = createLayouts({ rows, g: sg, mapW: asset.mapW, mapH: asset.mapH });
    const alone = L.layYou(null, []);
    const withGroup = L.layYou(example, statePeers);
    assert.equal(alone.info.h, -1);
    assert.equal(alone.info.n, 0);
    assert.equal(alone.info.fits, true, size.name);
    for (let i = 0; i < N; i++) assert.ok(alone.A[i] > 0, `${size.name}: hospital ${i} unseen`);
    for (let i = N; i < 2 * N; i++) assert.equal(alone.A[i], 0);
    assert.ok(alone.info.all[0] < withGroup.info.all[0] + 1e-6, `${size.name}: its room reaches at least as high`);
    assert.ok(alone.info.all[0] >= sg.top, `${size.name}: inside the plot`);
    assertSeparate(alone, 0, N, size.dpr, `${size.name}: everyone alone`);
  }
});

// On a phone the step's name ("3/9 Readmissions") sits in the stage's top left, over the gates the story has passed
// (hub/styles.css .nowstep: 9px under the stage's top, 12px type set solid). A passed gate's words stand 6px above its
// line in 11px type (stage.js gates), their capitals about three quarters of that tall. The first one's start at least
// 12px under the name, at both phone widths.
test('a phone: the step\'s name in the stage\'s top left clears the first passed gate\'s words', () => {
  const NAME_BOTTOM = 9 + 12;
  for (const W of [320, 390]) {
    const g = stageGeometry({ W, H: 480, railHidden: true, domain });
    const capTop = gateLines(g, 1)[0] - 6 - 11 * 0.75;
    assert.ok(capTop - NAME_BOTTOM >= 12, `${W} px: ${(capTop - NAME_BOTTOM).toFixed(1)} px between the step's name and the gate's words`);
  }
});
