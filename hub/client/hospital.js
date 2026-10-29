// A hospital's page across the programs, live (entry hub-hospital; hub/hospital/page.js writes the page and its hooks).
// Once the hub's data arrives: the peer toggle shows and drives the whole page; the swarm draws this hospital among its
// group and among everyone; each program row gets its strip; the peer table fills when opened. Switching the group
// restates every sentence that names it (the headline, the row sentences, the result, the captions) with the build's own
// functions (hub/hospital/peers.js, text.js), so the page reads exactly as the build would have written it for that
// group, and moves the dollar rows' median ticks, the swarm's dots and the strips' dots. The factor what-if
// (hospital/whatif.js) owns the figures that a scenario changes (the headline, the net, the dollar rows, the result) and
// states them for the actual or the hypothetical figures. Without the data, or if any part fails to start, the page stays
// (or is put back) as the server wrote it, with one quiet line saying the chart couldn't load: no control is left that does
// nothing.
import { PEER_MODES } from '../../engine/js/peers.js';
import { count } from '../../web/client/format.js';
import { loadHubAsset } from '../../web/client/hub-asset.js';
import { fillCopy } from '../../web/render/components.js';
import { COPY } from '../hospital/copy.js';
import { ROWS, peerGroup, sumValues } from '../hospital/peers.js';
import { whyText } from '../hospital/text.js';
import { node } from './hospital/dom.js';
import { mountStrips, setGlide } from './hospital/strips.js';
import { mountSwarm } from './hospital/swarm.js';
import { fillPeerTable } from './hospital/table.js';
import { vbpMaxOf } from './hospital/whatif-state.js';
import { mountWhatIf } from './hospital/whatif.js';
import { shareDomain } from './scale.js';

const fill = (key, values) => fillCopy(COPY, key, values);

const root = document.querySelector('article.hh[data-ccn]');
if (root && root.querySelector('[data-peers]')) start(root);

function start(page) {
  const src = document.querySelector('[data-hub-src]')?.dataset.hubSrc;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  // The page as the server wrote it, put back if the live page fails part way (a part started before the failure would
  // leave controls with nothing behind them), and the observers the live page starts that write to the page's root, stopped
  // then (one left on the old page's detached rows would write their zero heights).
  const written = page.cloneNode(true);
  const observers = [];
  // The page as it stands: its one quiet line, its sticky row measured, no banner.
  const fail = () => {
    const shown = document.querySelector('article.hh[data-ccn]');
    const line = shown?.querySelector('[data-load-error]');
    if (line) line.hidden = false;
    document.documentElement.style.removeProperty('--scen-h');
    if (shown?.querySelector('[data-peers]')) trackPeerRow(shown);
  };
  if (!src) return fail();
  loadHubAsset(src).then(({ hospitals, byCcn, fy }) => {
    const h = byCcn.get(page.dataset.ccn);
    if (!h?.est) throw new Error(`hub hospital: ${page.dataset.ccn} has no estimate in the data`);
    try {
      live(page, { hospitals, h, fy: String(fy), still, observers });
    } catch (err) {
      for (const o of observers) o.disconnect();
      page.replaceWith(written);
      throw err;
    }
  }).catch(fail);
}

// The sticky peer row's height on the page's root (its content's and its border's: the row's own min-height is this
// value, so measuring the row would only ever grow it), so a jump to #whatif or a row clears it; kept as the row changes
// size. Returns the observer that keeps it, or null.
function trackPeerRow(page) {
  const bar = page.querySelector('[data-peers]');
  const pin = bar.firstElementChild ?? bar;
  const set = () => {
    const edge = parseFloat(getComputedStyle(bar).borderBottomWidth) || 0;
    document.documentElement.style.setProperty('--peers-h', `${Math.ceil(pin.getBoundingClientRect().height + edge)}px`);
  };
  set();
  if (!('ResizeObserver' in window)) return null;
  const observer = new ResizeObserver(set);
  observer.observe(pin);
  return observer;
}

function live(page, { hospitals, h, fy, still, observers }) {
  const $ = (selector) => page.querySelector(selector);
  setGlide(page);
  const all = count(hospitals.filter((x) => x.est).length);
  // Every way the hospital can be grouped, worked out once (peers.js peerGroup).
  const groups = new Map(PEER_MODES.map((mode) => [mode, peerGroup(fill, hospitals, h, mode)]));
  // The dollar rows' scale's values, as the build drew it: every group's medians are on it, so only the ticks move (the
  // what-if adds its own figures).
  const values = sumValues(h.est, [...groups.values()].filter(Boolean).map((g) => g.figures));
  const first = groups.get('state');

  const row = trackPeerRow(page);
  if (row) observers.push(row);
  const buttons = [...page.querySelectorAll('[data-peer]')];

  // The share axis: every hospital's actual figures (domain), the full width for the data. The strips and the swarm draw
  // it, and the what-if widens it only as far as a hypothetical figure past it needs, and back (whatif.js; while a drag
  // lasts it only grows).
  const domain = shareDomain(hospitals);
  const vbpMax = vbpMaxOf(hospitals);
  const swarmEl = $('[data-swarm]');
  const swarm = mountSwarm(swarmEl, { hospitals, h, peers: first.peers, domain, fill, fy, group: first.group, still });
  const note = $('[data-swarm-note]');
  if (note) note.hidden = false;
  const strips = mountStrips($('#whatif'), { h, peers: first.peers, figures: first.figures, domain, fill, still, handles: ROWS.map((r) => r.id) });
  const whatIf = mountWhatIf(page, { h, vbpMax, fy, still, domain, strips, swarm, values, group: first, observers });

  const details = $('[data-peer-table]');
  let current = first;
  let built = null;
  const table = () => {
    if (built === current) return;
    built = current;
    fillPeerTable(details, { peers: current.peers, h, fill, fy, group: current.group });
  };
  details?.addEventListener('toggle', () => {
    if (details.open) table();
  });

  // Every sentence and mark that names the group, restated for g (the headline, the result and the dollar rows' median
  // ticks are the what-if's, which states them for the actual or the hypothetical figures).
  function words(g) {
    const n = count(g.peers.length);
    const name = $('[data-peer-name]');
    name?.replaceChildren(node('b', {}, [n]), ` ${g.group}`);
    note?.replaceChildren(`${fill('swarmCaption', { fy, n, group: g.group, all })} `, node('span', { class: 'hh__hint' }, [fill('swarmHint')]));
    const lede = $('.hh__lede');
    if (lede) lede.textContent = fill('whatifLede', { fy, n, group: g.group });
    for (const { id } of ROWS) {
      const why = $(`[data-row="${id}"] .hh__why`);
      if (why) why.textContent = whyText(fill, h, id, g.figures[id], { fy, group: g.group }).join(' ');
    }
    const tally = details?.querySelector('summary span');
    if (tally) tally.textContent = fill('tableCount', { n, group: g.group });
  }

  function choose(mode) {
    const g = groups.get(mode);
    if (!g || g === current) return;
    current = g;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.peer === mode));
    words(g);
    swarm.setPeers(g.peers, g.group);
    strips.update(g.peers, g.figures);
    whatIf.setGroup(g);
    if (details?.open) table();
  }
  // The toggle and its notes show once every part has started, with the toggle's handlers.
  for (const b of buttons) {
    b.addEventListener('click', () => choose(b.dataset.peer));
    b.hidden = false;
  }
  for (const n of page.querySelectorAll('[data-peer-note]')) n.hidden = false;
  page.classList.add('hh--live');
}
