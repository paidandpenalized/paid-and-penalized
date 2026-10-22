// The program page's and place pages' explorable figures, in the browser: the measure buttons (one pick shows that
// measure in every figure that has the buttons), the slide rule's cursor (drag it, or step it with the arrow keys),
// the halving button (the strip's dots move between their two places), and the score rule (the hospital under the
// pointer, named in a tooltip; a click opens its page). Without JavaScript each figure shows its first measure, its
// starting state and its table. Motion follows the reader's reduced-motion setting.
import { cmsText } from '../../../web/render/format.js';
import { decimal } from '../../../web/render/format.js';
import { ruleRank } from '../../../web/charts/scoreRule.js';
import { hospitalHref } from '../web/hospital-table.js';
import { imageOf } from '../../../web/charts/figure.js';
import { COL, inGroup, measureSummary } from '../web/program-data.js';
import { SCATTER_W, agreeScatterOf, pairPoints, pullPanel, slidePanel, stackPanel, swarmChart, swarmPositions } from '../web/explore-figures.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { count, pct } from '../../../web/render/format.js';
import { fill } from '../web/explore/copy.js';

// ---------- the explore asset ----------

// The explore asset (program-data.js exploreAsset), fetched once when a figure first needs it; a failure is let go
// so the next need tries again.
export function exploreLoader(src) {
  let pending = null;
  return () => (pending ??= fetch(src).then((res) => {
    if (!res.ok) throw new Error(`explore data: HTTP ${res.status}`);
    return res.json();
  }).catch((error) => {
    pending = null;
    throw error;
  }));
}

// One measure's summary from the asset, as the build makes it (measureSummary over the published values, sorted).
const summaries = new Map();
function summaryOf(data, id) {
  if (!summaries.has(id)) {
    const i = data.ids.indexOf(id);
    const values = data.rows.map((r) => r[3][i]).filter((v) => v !== null).sort((a, b) => a - b);
    summaries.set(id, measureSummary(id, values, data.params[id], data.assigned[id]));
  }
  return summaries.get(id);
}

// The builders for a lazy panel, by its figure's data-kind.
const BUILDERS = { stack: stackPanel, pull: pullPanel, slide: slidePanel };
async function drawPanel(panel, load) {
  const box = panel.closest('[data-kind]');
  const build = BUILDERS[box?.dataset.kind];
  if (!build || !panel.hasAttribute('data-lazy')) return;
  panel.removeAttribute('data-lazy');
  try {
    const data = await load();
    const settings = box.dataset.fig ? JSON.parse(box.dataset.fig) : {};
    const p = build(panel.dataset.measure, summaryOf(data, panel.dataset.measure), settings);
    panel.insertAdjacentHTML('beforeend', `${imageOf(p.narrow, p.alt, 'narrow')}${imageOf(p.wide, p.alt, 'wide')}`);
    if (p.data) {
      panel.dataset.slide = p.data;
      mountSlideRules(panel.parentElement, panel);
    }
  } catch (error) {
    panel.setAttribute('data-lazy', '');
    console.error(error);
  }
}

// ---------- the measure buttons ----------

export function mountMeasureToggles(root = document, load = null) {
  const toggles = [...root.querySelectorAll('.mtoggle')];
  const pick = (id) => {
    for (const group of toggles) {
      const fig = group.closest('.fig');
      if (!fig.querySelector(`.mpanel[data-measure="${id}"]`)) continue;
      for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.measure === id));
      for (const panel of fig.querySelectorAll('.mpanel')) {
        panel.hidden = panel.dataset.measure !== id;
        if (!panel.hidden && load) drawPanel(panel, load);
      }
    }
  };
  for (const group of toggles) {
    group.hidden = false;
    group.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-measure]');
      if (b) pick(b.dataset.measure);
    });
  }
}

// ---------- the slide rule ----------

// The rule's left and right ends in viewBox units (slideRule draws from 10 to width − 10).
const SLIDE_PAD = 10;

export function mountSlideRules(root = document, only = null) {
  for (const panel of only ? [only] : root.querySelectorAll('.mpanel[data-slide]')) {
    if (!panel.querySelector('svg.chart--slide')) continue;
    const s = JSON.parse(panel.dataset.slide);
    const step = 10 ** -s.dp * (s.dp > 3 ? 50 : 10);
    for (const svg of panel.querySelectorAll('svg.chart--slide')) {
      const cursor = svg.querySelector('[data-cursor]');
      const readValue = cursor.querySelector('[data-read="value"]');
      const readZ = cursor.querySelector('[data-read="z"]');
      const width = svg.viewBox.baseVal.width;
      const toX = (v) => SLIDE_PAD + ((v - s.lo) / (s.hi - s.lo)) * (width - 2 * SLIDE_PAD);
      let value = s.lo + ((Number(cursor.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]) - SLIDE_PAD) / (width - 2 * SLIDE_PAD)) * (s.hi - s.lo);
      const set = (v) => {
        value = Math.min(s.hi, Math.max(s.lo, v));
        const z = (Math.min(s.cap, Math.max(s.floor, value)) - s.mean) / s.sd;
        cursor.setAttribute('transform', `translate(${toX(value).toFixed(2)} 0)`);
        readValue.textContent = decimal(value, s.dp);
        readZ.textContent = cmsText(decimal(z, 2));
        svg.setAttribute('aria-valuenow', decimal(value, s.dp));
        svg.setAttribute('aria-valuetext', `${decimal(value, s.dp)}: z ${cmsText(decimal(z, 2))}`);
      };
      const fromEvent = (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const local = pt.matrixTransform(svg.getScreenCTM().inverse());
        set(s.lo + ((local.x - SLIDE_PAD) / (width - 2 * SLIDE_PAD)) * (s.hi - s.lo));
      };
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('role', 'slider');
      svg.setAttribute('aria-valuemin', decimal(s.lo, s.dp));
      svg.setAttribute('aria-valuemax', decimal(s.hi, s.dp));
      let dragging = false;
      svg.addEventListener('pointerdown', (e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromEvent(e); });
      svg.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
      svg.addEventListener('pointerup', () => { dragging = false; });
      svg.addEventListener('pointercancel', () => { dragging = false; });
      svg.addEventListener('keydown', (e) => {
        const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key];
        if (d === undefined && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        set(e.key === 'Home' ? s.lo : e.key === 'End' ? s.hi : value + d);
      });
      set(value);
    }
    panel.closest('.fig')?.querySelector('.slide__hint')?.removeAttribute('hidden');
  }
}

// ---------- the halving button ----------

// The values' silhouette squeezes to half its width toward zero (a CSS transform; charts.css times it, and drops the
// motion for a reader who asks for less); the z-scores' strip stays.
export function mountHalving(root = document) {
  for (const button of root.querySelectorAll('[data-halve]')) {
    const fig = button.closest('.fig');
    const shapes = [...fig.querySelectorAll('[data-shift]')];
    const labels = [...fig.querySelectorAll('[data-shift-label]')];
    let on = false;
    button.hidden = false;
    button.addEventListener('click', () => {
      on = !on;
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? button.dataset.on : button.dataset.off;
      for (const label of labels) label.textContent = on ? button.dataset.topOn : button.dataset.topOff;
      for (const shape of shapes) shape.classList.toggle('is-halved', on);
    });
  }
}

// ---------- the score rule ----------

// The decided hospitals in the rule's order (lowest score first, ties by CCN), from the hospitals asset's rows
// [ccn, name, city, state, total, decision]: the order ruleFigure draws.
export function ruleOrder(rows) {
  return rows.filter((r) => (r[5] === 'Yes' || r[5] === 'No') && r[4] !== 'N/A' && r[4] !== '')
    .map((r) => ({ ccn: r[0], name: r[1], city: r[2], state: r[3], total: Number(r[4]), text: r[4], decision: r[5] }))
    .sort((a, b) => a.total - b.total || (a.ccn < b.ccn ? -1 : 1));
}

export function mountRule(fig, load) {
  let order = null;
  const tip = document.createElement('div');
  tip.className = 'fig__tip rulefig__tip';
  tip.hidden = true;
  fig.style.position = 'relative';
  fig.append(tip);
  for (const svg of fig.querySelectorAll('svg.chart--score-rule')) {
    const width = svg.viewBox.baseVal.width;
    const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cursor.setAttribute('class', 'chart-rule__cursor');
    cursor.setAttribute('y1', '0');
    cursor.setAttribute('y2', String(svg.viewBox.baseVal.height));
    cursor.style.display = 'none';
    svg.append(cursor);
    const at = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
    };
    const hide = () => { tip.hidden = true; cursor.style.display = 'none'; };
    svg.addEventListener('pointerenter', () => { if (!order) load().then((data) => { order = ruleOrder(data.rows); order.path = data.hospitalPath; }, () => {}); });
    svg.addEventListener('pointermove', (e) => {
      if (!order) return;
      const x = at(e);
      const h = order[ruleRank(x, order.length, width)];
      cursor.setAttribute('x1', x.toFixed(1));
      cursor.setAttribute('x2', x.toFixed(1));
      cursor.style.display = '';
      tip.textContent = `${h.name}, ${h.state}: ${cmsText(h.text)} · ${h.decision === 'Yes' ? fig.dataset.cut : fig.dataset.notCut}`;
      const box = fig.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(e.clientX - box.left, 120), box.width - 120)}px`;
      tip.style.top = `${e.clientY - box.top - 8}px`;
      tip.hidden = false;
      svg.dataset.href = hospitalHref(order.path, h.ccn);
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('click', () => { if (svg.dataset.href) window.location.assign(svg.dataset.href); });
  }
}

// A point in an SVG's own units, from a pointer event.
const svgPoint = (svg, e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};

// A tooltip layer over a box (position: relative), shared by a figure's charts.
function tipLayer(box) {
  const tip = document.createElement('div');
  tip.className = 'fig__tip';
  tip.hidden = true;
  box.append(tip);
  return {
    show(text, e) {
      const r = box.getBoundingClientRect();
      tip.textContent = text;
      tip.style.left = `${Math.min(Math.max(e.clientX - r.left, 110), r.width - 110)}px`;
      tip.style.top = `${e.clientY - r.top - 10}px`;
      tip.hidden = false;
    },
    hide() { tip.hidden = true; },
  };
}

// ---------- the swarm ----------

// The swarm (program-figures.js swarmFigure): its group buttons lift a group out (the chart is drawn again, the group
// stacked first, the rest faded) and say its count; a pointer over a dot names the hospital, a click opens it.
// explore: the explore asset's loader; hospitals: the hospitals asset's (names and the page path).
export function mountSwarm(fig, { explore, hospitals, src }) {
  const box = fig.querySelector('.swarm');
  const art = box.querySelector('.swarm__art');
  const picker = box.querySelector('.swarm__pick');
  const readout = box.querySelector('.swarm__readout');
  const band = JSON.parse(box.dataset.band);
  const tip = tipLayer(art);
  let state = null;
  const ready = () => (state ??= Promise.all([explore(), hospitals(src)]).then(([data, list]) => {
    const rows = data.rows.filter((r) => r[COL.yes] !== null);
    const names = new Map(list.rows.map((r) => [r[0], r]));
    return { rows, names, path: list.hospitalPath, group: null };
  }).catch((error) => { state = null; throw error; }));
  const items = (s) => s.rows.map((r) => ({ score: r[COL.total], yes: r[COL.yes] === 1, hl: s.group ? inGroup(r, s.group.kind, s.group.key) : false, ccn: r[COL.ccn] }));
  const draw = (s) => {
    const list = items(s);
    const hlOn = Boolean(s.group);
    for (const svg of art.querySelectorAll('svg.chart--swarm')) {
      const width = svg.viewBox.baseVal.width;
      const next = swarmChart({ items: list, band, width, hlOn });
      const label = svg.getAttribute('aria-label');
      const fit = svg.dataset.fit;
      svg.outerHTML = imageOf(next, label, fit).text;
    }
    s.list = list;
    s.pos = new Map();
  };
  picker.hidden = false;
  picker.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-group]');
    if (!b) return;
    const s = await ready();
    for (const x of picker.querySelectorAll('button[data-group]')) x.setAttribute('aria-pressed', String(x === b));
    const [kind, key] = b.dataset.group ? b.dataset.group.split(':') : [null, null];
    s.group = kind ? { kind, key } : null;
    draw(s);
    if (s.group) {
      const members = s.list.filter((i) => i.hl);
      const yes = members.filter((i) => i.yes).length;
      readout.textContent = fill('swarmReadout', { group: b.textContent.trim(), yes: count(yes), decided: count(members.length), share: pct(members.length ? yes / members.length : 0, 1), nation: readout.dataset.nation });
    } else readout.textContent = '';
  });
  // The pointer: the dot nearest it, within a dot and a half.
  art.addEventListener('pointermove', async (e) => {
    const svg = e.target.closest?.('svg.chart--swarm');
    if (!svg) return;
    const s = await ready();
    if (!s.list) s.list = items(s);
    const width = svg.viewBox.baseVal.width;
    if (!s.pos?.get(width)) (s.pos ??= new Map()).set(width, swarmPositions({ items: s.list, band, width, hlOn: Boolean(s.group) }));
    const { at, pitch } = s.pos.get(width);
    const p = svgPoint(svg, e);
    let best = -1;
    let bestD = (pitch * 1.5) ** 2;
    at.forEach(([x, y], i) => {
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    let ring = svg.querySelector('.chart-swarm__ring');
    if (best < 0) { tip.hide(); ring?.remove(); svg.removeAttribute('data-href'); return; }
    if (!ring) {
      ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('class', 'chart-swarm__ring');
      svg.append(ring);
    }
    const [x, y] = at[best];
    ring.setAttribute('cx', x.toFixed(1));
    ring.setAttribute('cy', y.toFixed(1));
    ring.setAttribute('r', (pitch * 1.1).toFixed(1));
    const item = s.list[best];
    const h = s.names.get(item.ccn);
    tip.show(fill('swarmTip', { name: h?.[1] ?? item.ccn, state: h?.[3] ?? '', score: cmsText(h?.[4] ?? String(item.score)), decision: item.yes ? box.dataset.cut : box.dataset.notCut }), e);
    svg.dataset.href = hospitalHref(s.path, item.ccn);
  });
  art.addEventListener('pointerleave', () => { tip.hide(); art.querySelectorAll('.chart-swarm__ring').forEach((r) => r.remove()); });
  art.addEventListener('click', (e) => {
    const svg = e.target.closest?.('svg.chart--swarm');
    if (svg?.dataset.href) window.location.assign(svg.dataset.href);
  });
}

// ---------- the agreement grid ----------

// A pair picked on the grid (a click, or Enter on the cell the keyboard is on) draws that pair's scatter.
export function mountAgree(fig, explore) {
  const box = fig.querySelector('.agree');
  const grid = box.querySelector('.agree__grid svg');
  const scatter = box.querySelector('.agree__scatter');
  const pick = async (mark) => {
    const pair = mark?.dataset.pair;
    if (!pair) return;
    const data = await explore();
    const [a, b] = pair.split('|');
    for (const cell of grid.querySelectorAll('.chart-agree__cell')) cell.classList.toggle('is-picked', cell.closest('[data-pair]')?.dataset.pair === pair);
    const points = pairPoints(data.rows, a, b, (r) => r[COL.values]);
    const label = scatter.querySelector('svg')?.getAttribute('aria-label') ?? '';
    scatter.innerHTML = imageOf(agreeScatterOf(points, a, b, SCATTER_W), label, null).text;
  };
  grid.addEventListener('click', (e) => pick(e.target.closest?.('[data-pair]')));
  grid.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(grid.querySelector('.chart-mark.is-active[data-pair]')); });
}

// ---------- the US map ----------

// The map's two modes (shares, every hospital), and a state picked on it (a click, or Enter on the state the keyboard
// is on: web/client/figure.js marks it is-active) opens that state's page (statePath(code)).
export function mountUsMap(fig, statePath) {
  const modes = fig.querySelector('.usmap__modes');
  if (modes) {
    modes.hidden = false;
    modes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      for (const x of modes.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      fig.querySelector('.usmap').dataset.mode = b.dataset.mode;
    });
  }
  const open = (mark) => { if (mark?.dataset.state) window.location.assign(statePath(mark.dataset.state)); };
  for (const svg of fig.querySelectorAll('svg.chart--us-map')) {
    svg.addEventListener('click', (e) => open(e.target.closest?.('[data-state]')));
    svg.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(svg.querySelector('.chart-mark.is-active[data-state]')); });
  }
}

// A place map's dots open their hospital's page (data-href).
export function mountPlaceMaps(root = document) {
  for (const svg of root.querySelectorAll('svg.chart--place-map')) {
    svg.addEventListener('click', (e) => {
      const href = e.target.closest?.('[data-href]')?.dataset.href;
      if (href) window.location.assign(href);
    });
    svg.addEventListener('keydown', (e) => {
      const href = e.key === 'Enter' && svg.querySelector('.chart-mark.is-active[data-href]')?.dataset.href;
      if (href) window.location.assign(href);
    });
  }
}
