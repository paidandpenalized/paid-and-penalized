// A hospital's page across the programs, live (entry hub-hospital; hub/hospital/page.js writes the page and its hooks).
// Once the hub's data arrives: the peer toggle shows and drives the whole page; the swarm draws this hospital among its
// group and among everyone; each program row gets its strip; the peer table fills when opened. Switching the group
// restates every sentence that names it (the headline, the row sentences, the result, the captions) with the build's own
// functions (hub/hospital/peers.js, text.js), so the page reads exactly as the build would have written it for that
// group, and moves the dollar rows' median ticks, the swarm's dots and the strips' dots. The factor what-if
// (hospital/whatif.js) owns the figures that a scenario changes (the headline, the net, the dollar rows, the result) and
// states them for the actual or the hypothetical figures. Without the data the page stays as the server wrote it, with one
// quiet line saying the chart couldn't load.
import { PEER_MODES } from '../../engine/js/peers.js';
import { count } from '../../web/client/format.js';
import { loadHubAsset } from '../../web/client/hub-asset.js';
import { fillCopy } from '../../web/render/components.js';
import { COPY } from '../hospital/copy.js';
import { ROWS, peerGroup, sumValues } from '../hospital/peers.js';
import { whyText } from '../hospital/text.js';
import { mountStrips } from './hospital/strips.js';
import { mountSwarm } from './hospital/swarm.js';
import { fillPeerTable } from './hospital/table.js';
import { mountWhatIf } from './hospital/whatif.js';
import { shareDomain } from './scale.js';

const fill = (key, values) => fillCopy(COPY, key, values);

const root = document.querySelector('article.hh[data-ccn]');
if (root && root.querySelector('[data-peers]')) start(root);

function start(page) {
  const $ = (selector) => page.querySelector(selector);
  const src = document.querySelector('[data-hub-src]')?.dataset.hubSrc;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fail = () => {
    const line = $('[data-load-error]');
    if (line) line.hidden = false;
  };
  if (!src) return fail();
  loadHubAsset(src).then(({ hospitals, byCcn, fy }) => {
    const h = byCcn.get(page.dataset.ccn);
    if (!h?.est) throw new Error(`hub hospital: ${page.dataset.ccn} has no estimate in the data`);
    live(page, { hospitals, h, fy: String(fy), still });
  }).catch(fail);
}

function live(page, { hospitals, h, fy, still }) {
  const $ = (selector) => page.querySelector(selector);
  const all = count(hospitals.filter((x) => x.est).length);
  // Every way the hospital can be grouped, worked out once (peers.js peerGroup).
  const groups = new Map(PEER_MODES.map((mode) => [mode, peerGroup(fill, hospitals, h, mode)]));
  // The dollar rows' scale's values, as the build drew it: every group's medians are on it, so only the ticks move (the
  // what-if adds its own figures).
  const values = sumValues(h.est, [...groups.values()].filter(Boolean).map((g) => g.figures));
  const first = groups.get('state');

  // The sticky row's height (its content's and its border's: the row's own min-height is this value, so measuring the row
  // would only ever grow it), so a jump to #whatif or a row clears it.
  const bar = $('[data-peers]');
  const pin = bar.firstElementChild ?? bar;
  const setBar = () => {
    const edge = parseFloat(getComputedStyle(bar).borderBottomWidth) || 0;
    document.documentElement.style.setProperty('--peers-h', `${Math.ceil(pin.getBoundingClientRect().height + edge)}px`);
  };
  if ('ResizeObserver' in window) new ResizeObserver(setBar).observe(pin);

  const buttons = [...page.querySelectorAll('[data-peer]')];
  for (const b of buttons) b.hidden = false;
  for (const note of page.querySelectorAll('[data-peer-note]')) note.hidden = false;
  setBar();

  const domain = shareDomain(hospitals);
  const swarmEl = $('[data-swarm]');
  const swarm = mountSwarm(swarmEl, { hospitals, h, peers: first.peers, domain, fill, fy, group: first.group, still });
  const note = $('[data-swarm-note]');
  if (note) note.hidden = false;
  const strips = mountStrips($('#whatif'), { h, peers: first.peers, figures: first.figures, domain, fill, still, handles: ROWS.map((r) => r.id) });
  const whatIf = mountWhatIf(page, { h, hospitals, fy, still, strips, swarm, values, group: first });

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
    if (name) {
      const b = document.createElement('b');
      b.textContent = n;
      name.replaceChildren(b, ` ${g.group}`);
    }
    if (note) {
      const hint = document.createElement('span');
      hint.className = 'hh__hint';
      hint.textContent = fill('swarmHint');
      note.replaceChildren(`${fill('swarmCaption', { fy, n, group: g.group, all })} `, hint);
    }
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
  for (const b of buttons) b.addEventListener('click', () => choose(b.dataset.peer));
  page.classList.add('hh--live');
}
