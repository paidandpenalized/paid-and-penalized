// A hospital's page across the programs, live (entry hub-hospital; hub/hospital/page.js writes the page and its hooks).
// Once the hub's data arrives: the peer toggle shows and drives the whole page; the swarm draws this hospital among its
// group and among everyone; each program row gets its strip; the peer table fills when opened. Switching the group
// restates every sentence that names it (the headline, the row sentences, the result, the captions) with the build's own
// functions (hub/hospital/peers.js, text.js), so the page reads exactly as the build would have written it for that
// group, and moves the dollar rows' median ticks, the swarm's dots and the strips' dots. Without the data the page stays
// as the server wrote it, with one quiet line saying the chart couldn't load.
import { PEER_MODES } from '../../engine/js/peers.js';
import { count, money } from '../../web/client/format.js';
import { loadHubAsset } from '../../web/client/hub-asset.js';
import { fillCopy } from '../../web/render/components.js';
import { COPY } from '../hospital/copy.js';
import { ROWS, groupName, peerFigures, peersOf, rowDollars, sumScale, sumValues } from '../hospital/peers.js';
import { comparison, whyText } from '../hospital/text.js';
import { mountStrips } from './hospital/strips.js';
import { mountSwarm } from './hospital/swarm.js';
import { fillPeerTable } from './hospital/table.js';
import { shareDomain } from './scale.js';

const fill = (key, values) => fillCopy(COPY, key, values);
// A number for a custom property: a fraction to four places (as the build writes the rows' bars and ticks).
const frac = (x) => String(Math.round(x * 1e4) / 1e4);

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
  // Every way the hospital can be grouped, worked out once: { mode, peers, figures, group } or null.
  const groups = new Map(PEER_MODES.map((mode) => {
    const peers = peersOf(hospitals, h, mode);
    return [mode, peers && peers.length ? { mode, peers, figures: peerFigures(peers), group: groupName(fill, h, mode) } : null];
  }));
  // The dollar rows' scale, as the build drew it: every group's medians are on it, so only the ticks move.
  const x = sumScale(sumValues(h.est, [...groups.values()].filter(Boolean).map((g) => g.figures)));
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
  const strips = mountStrips($('#whatif'), { h, peers: first.peers, domain, fill, still });

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

  // Every sentence and mark that names the group, restated for g.
  function words(g) {
    const n = count(g.peers.length);
    const name = $('[data-peer-name]');
    if (name) {
      const b = document.createElement('b');
      b.textContent = n;
      name.replaceChildren(b, ` ${g.group}`);
    }
    const head = $('[data-headline]');
    if (head) head.textContent = comparison(fill, 'head', { share: h.est.share, median: g.figures.net.median, n: g.peers.length, group: g.group });
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
    const result = $('[data-result] .hh__rs');
    if (result) result.textContent = comparison(fill, 'result', { share: h.est.share, median: g.figures.net.median, n: g.peers.length, group: g.group });
    const tally = details?.querySelector('summary span');
    if (tally) tally.textContent = fill('tableCount', { n, group: g.group });
    // The dollar rows' median ticks, and the words a screen reader has for them.
    for (const li of page.querySelectorAll('[data-sum]')) {
      const track = li.querySelector('.hh__track');
      if (!track) continue;
      const { median } = rowDollars(h.est, li.dataset.sum, g.figures);
      let tick = track.querySelector('.hh__tick');
      let said = li.querySelector('.hh__sw .vh');
      if (median === null) {
        tick?.remove();
        said?.remove();
        continue;
      }
      if (!tick) {
        tick = document.createElement('span');
        tick.className = 'hh__tick';
        track.append(tick);
      }
      tick.style.setProperty('--m', frac(x(median)));
      if (!said) {
        said = document.createElement('span');
        said.className = 'vh';
        li.querySelector('.hh__sw')?.append(said);
      }
      said.textContent = `; ${fill('sumMedian', { amount: money(median, { sign: true }) })}`;
    }
  }

  function choose(mode) {
    const g = groups.get(mode);
    if (!g || g === current) return;
    current = g;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.peer === mode));
    words(g);
    swarm.setPeers(g.peers, g.group);
    strips.update(g.peers);
    if (details?.open) table();
  }
  for (const b of buttons) b.addEventListener('click', () => choose(b.dataset.peer));
  page.classList.add('hh--live');
}
