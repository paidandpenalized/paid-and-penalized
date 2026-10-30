// A hospital page's factor what-if, live (hub/client/hospital.js mounts it once the hub's data arrives). Each program row
// the hospital is in gets a capsule handle on its strip (strips.js draws it; this binds its drag and keys), a factor field
// with − and + steppers and "Use peer median" (the hospital-acquired conditions row: a "1% cut" / "No cut" pair); the net
// row's "Match the peer median on all three" and "Reset to actual" show. The state and its arithmetic are whatif-state.js's,
// the words whatif-text.js's.
//
// Once anything changes, the page says so everywhere it shows a figure: a dashed "Hypothetical" banner with the net and
// "Reset to actual" sticks under the peer row (on a phone, in its place: hub/styles.css); the stamp reads "What if"; every
// changed figure shows the new
// value with the actual struck through beside it, and each chart keeps the actual as a ghost (the dollar rows' bars, the
// strips' rings, the swarm's rings) beside a hollow "What if" mark; the headline states the comparison for the
// hypothetical net. The result box (a polite live region) updates SETTLE_MS after the last input, and so does the URL
// fragment (#whatif&hrrp=…, history.replaceState). A page opened from a link with a valid changed scenario loads it and
// says "Reader-made scenario, not CMS data.", with a link back to the actual figures. Keys on a handle: ← → (and ↑ ↓)
// step, Shift (or Page Up and Down) steps bigger, Home and End go to the ends it states; Escape anywhere in the what-if or
// the banner resets the page.
//
// The strips and the swarm draw the data's own axis; a hypothetical figure past it (a program's on its strip, the net on
// the net's strip and the swarm) widens it just enough to hold it, and it narrows again when no figure needs the room
// (scale.js holdingAxis), gliding each time. Opening the what-if changes nothing. While a pointer holds a handle the
// axes only grow; when they widen under a drag, the drag reads its strip again from where the handle now stands, so the
// value never jumps and the handle moves one for one with the pointer; a drag past a strip's end goes to that end of the
// factor's range. On release the axes settle to what the figures need, narrower again if the drag came back inside;
// a mouse that lets go while resting over the strip holds that until it leaves the strip (or the reader changes the
// what-if another way), so the settling never pulls the handle from under it. A link that opens on a scenario starts
// on the axis it needs, with no glide.
import { netShare, pctOf } from '../../../engine/js/dollars/whatif.js';
import { numberOrNaN } from '../../../engine/js/stats.js';
import { siteAddress } from '../../../web/client/follow.js';
import { factor } from '../../../web/client/format.js';
import { fillCopy, pillClass } from '../../../web/render/components.js';
import { programById } from '../../../web/site.js';
import { SETTLE_MS } from '../../../web/whatif/dom.js';
import { isScenarioHash } from '../../../web/whatif/fragment.js';
import { COPY } from '../../hospital/copy.js';
import { ROWS, ROW_IDS, ROW_KEY, barSpan, rowDollars, sumScale, trackAt } from '../../hospital/peers.js';
import { HAC_CUT_TEXT, comparison, inkOf, rowWord, signedMoney as usd } from '../../hospital/text.js';
import { holdingAxis, stripAxis } from '../scale.js';
import { changed, dragAction, extent, fromHash, initial, outcome, ranges, reduce, toHash } from './whatif-state.js';
import { node } from './dom.js';
import { bannerText, sentence, valueText } from './whatif-text.js';

const fill = (key, values) => fillCopy(COPY, key, values);
// The actual struck through beside a figure only where the two print differently (a cent of arithmetic is not news).
const struck = (now, actual) => (usd(now) === usd(actual) ? null : actual);
// How long the "What if? Adjust any program" button's jump takes before the first handle takes focus and wiggles.
const JUMP_MS = 450;
// The room kept between the sticky row and a focused control it would otherwise cover (CSS pixels).
const CLEAR = 8;

// Text with each dollar figure in a span that never wraps, so a minus never parts from its number.
const FIGURE = /([−+]?\$[\d.,]+[KMB]?)/;
const whole = (text) => text.split(FIGURE).map((part, i) => (i % 2 ? node('span', { class: 'hh__nw' }, [part]) : part));

// The struck-through actual beside a changed figure in parent (after `after`, or at its end), or none (amount null).
function was(parent, amount, after = null, cls = 'hh__was') {
  let s = parent.querySelector(':scope > .hh__was');
  if (amount === null) {
    s?.remove();
    return;
  }
  if (!s) {
    s = node('s', { class: cls });
    if (after) after.after(s);
    else parent.append(s);
  }
  s.replaceChildren(node('span', { class: 'vh' }, [`${fill('wiActual')} `]), usd(amount));
}

// A bar on a dollar row's track from its zero line (x: the rows' scale), or none for $0.
function paintBar(track, sel, cls, dollars, x) {
  let bar = track.querySelector(sel);
  if (dollars === null || dollars === 0) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = node('span');
    track.prepend(bar);
  }
  const { a, w } = barSpan(x, dollars);
  bar.className = `${cls} hh__bar--${inkOf(dollars)}`;
  bar.style.setProperty('--a', a);
  bar.style.setProperty('--w', w);
}

// mountWhatIf(page, options): page is the article. Options: h (this hospital, with an estimate), vbpMax (value-based
// purchasing's highest factor of any hospital: whatif-state.js vbpMaxOf), fy, still (reduced motion), domain (the share
// axis of the actual figures, the data's own: the strips' and the swarm's), strips (mountStrips' handle API), swarm
// (mountSwarm's), values (the dollar rows' scale values for every group:
// hub/hospital/peers.js sumValues), group ({ peers, figures, group }, the page's first), observers (an array the
// observers it starts that write to the page's root join, so the page can stop them). Returns { setGroup(group) } for
// the peer toggle.
export function mountWhatIf(page, { h, vbpMax, fy, still, domain, strips, swarm, values, group, observers = [] }) {
  const $ = (sel) => page.querySelector(sel);
  const rng = ranges(h, { vbpMax });
  const actual = initial(h);
  // A factor's ends as the field and the slider state them (whatif-state.js extent).
  const ends = (id) => extent(h, { vbpMax }, ROW_KEY[id]);
  let g = group;
  const ctx = () => ({ h, vbpMax, peers: g.peers });
  let state = actual;
  let linked = false;
  let timer = 0;
  // The strips' axis and the swarm's as the figures change and the reader drags (scale.js stripAxis): type 'values'
  // (want: the axis each needs now), 'press' or 'release'; animate false to move at once (a page opened on a scenario).
  const atRest = { held: 0, want: domain, axis: domain };
  let axes = { strips: atRest, swarm: atRest };
  // The pointers holding a handle now: each counts once, from its press to its own release (or, for a mouse that lets go
  // while resting over the strip, until it leaves the strip: resting).
  const holding = new Set();
  // Each drag under way: what re-reads its strip when the axis changes under it (bindHandle's regrip).
  const grips = new Set();
  const axisOn = (type, want = {}, animate = true) => {
    const next = { strips: stripAxis(axes.strips, { type, want: want.strips }), swarm: stripAxis(axes.swarm, { type, want: want.swarm }) };
    const moved = next.strips.axis !== axes.strips.axis;
    if (moved) strips.setAxis(next.strips.axis, animate);
    if (next.swarm.axis !== axes.swarm.axis) swarm.setAxis(next.swarm.axis, animate);
    axes = next;
    if (moved) for (const regrip of grips) regrip();
  };
  // A mouse that lets go of a handle while it rests over the handle's strip: the release waits until the pointer leaves
  // the strip (or the window), the page scrolls it away, or the reader changes the what-if another way, so the axis
  // settling never pulls the handle out from under a resting pointer. pointerId -> stop (the listeners' remover).
  const resting = new Map();
  const over = (box, x, y) => {
    const b = box.getBoundingClientRect();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  };
  function letGo(id) {
    resting.get(id)?.();
    resting.delete(id);
    if (holding.delete(id)) axisOn('release');
  }
  const letGoAll = () => {
    for (const id of [...resting.keys()]) letGo(id);
  };
  function rest(id, box, x, y) {
    resting.get(id)?.();
    let [px, py] = [x, y];
    const check = () => {
      if (!over(box, px, py)) letGo(id);
    };
    const move = (e) => {
      if (e.pointerId !== id) return;
      [px, py] = [e.clientX, e.clientY];
      check();
    };
    const out = (e) => {
      if (e.pointerId === id && !e.relatedTarget) letGo(id);
    };
    const away = () => letGo(id);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', out);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('blur', away);
    resting.set(id, () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', out);
      window.removeEventListener('scroll', check);
      window.removeEventListener('blur', away);
    });
  }

  // ---------- the controls ----------
  const lede = $('.hh__lede');
  lede?.after(node('p', { class: 'hh__how' }, [node('span', { class: 'ico ico--capsule', 'aria-hidden': 'true' }), fill('wiHow')]));

  const rows = {};
  for (const { id } of ROWS) {
    const row = $(`[data-row="${id}"]`);
    const adjustable = id === 'hacrp' || rng[id];
    if (!row || !adjustable) continue;
    const program = programById(id).name;
    const r = { rv: row.querySelector('.hh__rv'), num: row.querySelector('.hh__num'), pill: row.querySelector('.hh__rv .pill'), input: null, cuts: [], editing: false };
    const median = node('button', { type: 'button', class: 'hh__lnk', 'data-wi-median': ROW_KEY[id] }, [fill('wiMedian')]);
    let kids;
    if (id === 'hacrp') {
      r.cuts = [
        node('button', { type: 'button', class: 'hh__pb', 'data-cut': '1' }, [fill('wiHacCut', { rate: HAC_CUT_TEXT })]),
        node('button', { type: 'button', class: 'hh__pb', 'data-cut': '0' }, [fill('wiHacNone')]),
      ];
      kids = [node('div', { class: 'hh__seg', role: 'group', 'aria-label': fill('wiHacGroup') }, r.cuts), median];
    } else {
      const fid = `wi-f-${id}`;
      const [lo, hi] = ends(id);
      r.input = node('input', { id: fid, type: 'number', inputmode: 'decimal', min: factor(lo), max: factor(hi), step: '0.0005', class: 'hh__fin' });
      const step = (dir, label) => node('button', { type: 'button', class: 'hh__stp', 'data-step': dir, 'aria-label': fill(label, { program }), 'aria-controls': fid }, [dir < 0 ? '−' : '+']);
      kids = [
        node('label', { for: fid }, [fill('wiFactor'), node('span', { class: 'vh' }, [`, ${fill('wiFactorFor', { program })}`])]),
        step(-1, 'wiLower'), r.input, step(1, 'wiRaise'), median,
      ];
    }
    const ctl = node('div', { class: 'hh__ctl' }, kids);
    const deep = row.querySelector('.hh__deep');
    if (deep) deep.before(ctl);
    else row.querySelector('.hh__rt')?.append(ctl);
    rows[id] = r;

    for (const b of r.cuts) b.addEventListener('click', () => apply({ type: 'hac', cut: b.dataset.cut === '1' }));
    median.addEventListener('click', () => apply({ type: 'median', id: ROW_KEY[id] }));
    for (const b of ctl.querySelectorAll('[data-step]')) b.addEventListener('click', (e) => apply({ type: 'step', id: ROW_KEY[id], dir: Number(b.dataset.step), big: e.shiftKey }));
    // Mid-edit (typed, not yet committed) the field keeps what the reader typed; any other change to the page, a reset
    // included, writes the field again.
    r.input?.addEventListener('input', () => {
      r.editing = true;
    });
    r.input?.addEventListener('change', () => {
      r.editing = false;
      apply({ type: 'set', id: ROW_KEY[id], value: numberOrNaN(r.input.value) });
      r.input.value = factor(state[ROW_KEY[id]]);
    });
    r.input?.addEventListener('blur', () => {
      r.editing = false;
    });

    const handle = strips.handle(id);
    if (handle) bindHandle(id, handle, program);
  }

  // The handle: a slider over the factor's range (the cut's: 0, the cut, to 1, none), dragged along its strip.
  function bindHandle(id, el, program) {
    const key = ROW_KEY[id];
    el.setAttribute('aria-label', fill('wiHandle', { program }));
    el.setAttribute('aria-valuemin', id === 'hacrp' ? '0' : String(ends(id)[0]));
    el.setAttribute('aria-valuemax', id === 'hacrp' ? '1' : String(ends(id)[1]));
    el.addEventListener('keydown', (e) => {
      const k = e.key;
      const down = k === 'ArrowLeft' || k === 'ArrowDown' || k === 'PageDown';
      const up = k === 'ArrowRight' || k === 'ArrowUp' || k === 'PageUp';
      if (!down && !up && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      if (id === 'hacrp') apply({ type: 'hac', cut: down || k === 'Home' });
      else if (k === 'Home' || k === 'End') apply({ type: 'end', id: key, dir: k === 'Home' ? -1 : 1 });
      else apply({ type: 'step', id: key, dir: down ? -1 : 1, big: e.shiftKey || k.startsWith('Page') });
    });
    // A drag: the pointer's offset from the handle's middle is kept, so the handle never jumps under it, and the strip is
    // read on the axis drawn (grip). When the axis widens under the drag, the strip is read again on the new axis from
    // where the handle now stands (regrip): the value under the pointer stays the value it had, the handle moves one for
    // one with the pointer from there, and nothing feeds back. The page updates once a frame at most, to the last place
    // the pointer reached (at), and a release lands that place at once; keys and the field update at once.
    let offset = null;
    let read = null;
    let at = null;
    let frame = 0;
    let lastX = 0;
    const valueAt = (e) => (read ? read(e.clientX + offset) : null);
    const regrip = () => {
      if (offset === null) return;
      const b = el.querySelector('.st__hb').getBoundingClientRect();
      offset = b.left + b.width / 2 - lastX;
      read = strips.grip(id);
    };
    const drag = () => {
      frame = 0;
      const v = at;
      at = null;
      if (v === null) return;
      if (id === 'hacrp') {
        // The cut's place on the strip is its share of pay; past half way to it reads as the cut (past the strip's left
        // end, the cut; past its right, none).
        const cutAt = pctOf({ total: h.est.total, ...outcome({ ...state, hac: true }, h) }).hac;
        apply({ type: 'hac', cut: v.past ? v.past < 0 : v.share < cutAt / 2 }, { drag: true });
      } else if (h.est.base > 0) apply(dragAction(h, key, v), { drag: true });
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const b = el.querySelector('.st__hb').getBoundingClientRect();
      lastX = e.clientX;
      offset = b.left + b.width / 2 - e.clientX;
      read = strips.grip(id);
      grips.add(regrip);
      el.setPointerCapture?.(e.pointerId);
      // A pointer resting after a release presses again: it holds on, and its next release decides.
      resting.get(e.pointerId)?.();
      resting.delete(e.pointerId);
      if (!holding.has(e.pointerId)) {
        holding.add(e.pointerId);
        axisOn('press');
      }
      el.classList.add('st__h--held');
      el.focus({ preventScroll: true });
      page.classList.add('hh--used', 'hh--dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (offset === null) return;
      const v = valueAt(e);
      if (v === null) return;
      lastX = e.clientX;
      at = v;
      if (!frame) frame = requestAnimationFrame(drag);
    });
    const end = (e) => {
      if (frame) {
        cancelAnimationFrame(frame);
        drag();
      }
      offset = null;
      read = null;
      grips.delete(regrip);
      el.classList.remove('st__h--held');
      page.classList.remove('hh--dragging');
      if (!holding.has(e.pointerId)) return;
      const box = el.closest('[data-strip]');
      if (e.type === 'pointerup' && e.pointerType === 'mouse' && box && over(box, e.clientX, e.clientY)) rest(e.pointerId, box, e.clientX, e.clientY);
      else letGo(e.pointerId);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ---------- the banner, the stamp, the net and the result: what they say before any change, kept to restore ----------
  // The banner is a sticky row of its own after the peer row (and the notes under it); the "Reader-made scenario" line
  // follows it and scrolls with the page.
  const bar = $('[data-peers]');
  const scenText = node('span', { class: 'hh__scentext' });
  const topReset = node('button', { type: 'button', class: 'hh__reset' }, [fill('reset')]);
  const scen = node('div', { class: 'hh__scen', hidden: '' }, [node('div', { class: 'wrap hh__scenin' }, [node('span', { class: 'hh__htag' }, [fill('wiTag')]), scenText, topReset])]);
  // The page's own address without the scenario, as a link on this site (siteAddress folds a leading "//").
  const sharedLink = node('a', { href: siteAddress({ pathname: location.pathname, search: location.search, hash: '' }) }, [fill('wiSharedReset')]);
  const shared = node('p', { class: 'hh__shared', hidden: '' }, [`${fill('wiShared')} `, sharedLink]);
  const notes = bar?.nextElementSibling?.classList.contains('hh__pnotes') ? bar.nextElementSibling : bar;
  notes?.after(scen, node('div', { class: 'wrap hh__sharedrow' }, [shared]));

  const stampBox = $('.hh__stamp');
  const stamp = stampBox?.querySelector('.stamp');
  const stampText = stamp?.textContent;
  const big = $('.hh__big');
  const netlab = $('.hh__netlab');
  const netTag = node('span', { class: 'hh__htag hh__htag--sm', hidden: '' }, [fill('wiTag')]);
  netlab?.append(netTag);
  const result = $('[data-result]');
  const rhd = result?.querySelector('.hh__rhd');
  const rhdActual = rhd ? [...rhd.childNodes].map((n) => n.cloneNode(true)) : [];
  const rbig = result?.querySelector('.hh__rbig');
  const rs = result?.querySelector('.hh__rs');
  const match = $('[data-match]');
  const reset = $('[data-reset]');
  if (match) match.hidden = false;

  // ---------- drawing ----------

  // The dollar rows on one scale that holds the hypothetical figures too: each row's bar at its figure now, the actual's
  // bar as a ghost behind a changed one, the peers' median tick, the value and its word.
  function paintSum(out) {
    const now = (id) => (rowDollars(h.est, id, g.figures).own === null ? null : out[ROW_KEY[id]]);
    const x = sumScale([...values, ...ROW_IDS.map(now).filter((v) => v !== null)]);
    const list = $('.hh__sum');
    list?.style.setProperty('--z', trackAt(x(0)));
    $('.hh__ax')?.style.setProperty('--z', trackAt(x(0)));
    for (const li of page.querySelectorAll('[data-sum]')) {
      const id = li.dataset.sum;
      const track = li.querySelector('.hh__track');
      if (!track) continue;
      const { own, median } = rowDollars(h.est, id, g.figures);
      const v = now(id);
      const moved = v !== own;
      paintBar(track, '.hh__bar:not(.hh__bar--ghost)', 'hh__bar', v, x);
      paintBar(track, '.hh__bar--ghost', 'hh__bar hh__bar--ghost', moved ? own : null, x);
      let tick = track.querySelector('.hh__tick');
      let said = li.querySelector('.hh__sw .vh');
      if (median === null) {
        tick?.remove();
        said?.remove();
      } else {
        if (!tick) track.append((tick = node('span', { class: 'hh__tick' })));
        tick.style.setProperty('--m', trackAt(x(median)));
        if (!said) li.querySelector('.hh__sw')?.append((said = node('span', { class: 'vh' })));
        said.textContent = `; ${fill('sumMedian', { amount: usd(median) })}`;
      }
      const sv = li.querySelector('.hh__sv');
      if (sv) {
        sv.textContent = usd(v);
        was(sv, moved ? struck(v, own) : null);
      }
      const sw = li.querySelector('.hh__sw');
      if (sw?.firstChild?.nodeType === Node.TEXT_NODE) sw.firstChild.nodeValue = rowWord(fill, id, v);
    }
  }

  // Everything but the result box, at once; the axes the figures need, gliding there (animate) or at once.
  function draw(animate = true) {
    const on = changed(state, h);
    const out = outcome(state, h);
    for (const [id, r] of Object.entries(rows)) {
      const key = ROW_KEY[id];
      const v = out[key];
      if (r.num) r.num.textContent = usd(v);
      if (r.pill) {
        r.pill.className = pillClass(inkOf(v));
        r.pill.textContent = rowWord(fill, id, v);
      }
      if (r.rv) was(r.rv, struck(v, h.est[key]));
      if (r.input && !r.editing) r.input.value = factor(state[key]);
      for (const b of r.cuts) b.setAttribute('aria-pressed', String((b.dataset.cut === '1') === state.hac));
      const handle = strips.handle(id);
      if (handle) {
        handle.setAttribute('aria-valuenow', id === 'hacrp' ? (state.hac ? '0' : '1') : String(state[key]));
        handle.setAttribute('aria-valuetext', valueText(id, state, h, { fy }));
      }
    }
    // The charts: the figure of each row whose input moved or whose dollars print differently, and the net's, in percent
    // of pay (the engine's pctOf).
    const pct = pctOf({ total: h.est.total, ...out });
    const scenario = {};
    for (const { id, key } of ROWS) {
      if (struck(out[key], h.est[key]) !== null || state[key] !== actual[key]) scenario[id] = pct[key];
    }
    const netMoved = out.net !== h.est.net;
    if (netMoved) scenario.net = pct.net;
    strips.setScenario(on ? scenario : null);
    swarm.setHypothetical(on && netMoved ? pct.net : null);
    axisOn('values', { strips: holdingAxis(domain, on ? Object.values(scenario) : []), swarm: holdingAxis(domain, on && netMoved ? [pct.net] : []) }, animate);

    // The banner, the stamp, the net and its rows, the headline.
    bar?.classList.toggle('hh__peers--hyp', on);
    scen.hidden = !on;
    scenText.replaceChildren(...(on ? whole(bannerText(state, h, { fy })) : []));
    shared.hidden = !(linked && on);
    stampBox?.classList.toggle('hh__stamp--hyp', on);
    if (stamp) stamp.textContent = on ? fill('wiStamp') : stampText;
    if (big) {
      big.textContent = usd(out.net);
      was(big.parentElement, struck(out.net, h.est.net), big, 'hh__was hh__was--big');
    }
    netTag.hidden = !on;
    paintSum(out);
    const head = $('[data-headline]');
    const share = on ? netShare(out.net, h.est.total) : h.est.share;
    if (head) head.textContent = comparison(fill, on ? 'headHyp' : 'head', { share, median: g.figures.net.median, n: g.peers.length, group: g.group });
    if (reset) reset.hidden = !on;
  }

  // The result box (the live region) and the URL fragment, once the reader stops. The box is written only when what it
  // says changes, so a screen reader hears each result once.
  let shown = `false|${rs?.textContent ?? ''}`;
  function settle() {
    clearTimeout(timer);
    writeHash();
    const on = changed(state, h);
    const out = outcome(state, h);
    const text = sentence(state, h, g.peers, { fy, group: g.group });
    if (`${on}|${text}` === shown) return;
    shown = `${on}|${text}`;
    result?.classList.toggle('hh__result--hyp', on);
    if (rhd) rhd.replaceChildren(...(on ? [`${fill('resultHyp', { fy })} `, node('span', { class: 'hh__htag hh__htag--sm' }, [fill('wiTag')])] : rhdActual.map((n) => n.cloneNode(true))));
    if (rbig) {
      rbig.replaceChildren(usd(out.net));
      if (on && struck(out.net, h.est.net) !== null) rbig.prepend(node('s', { class: 'hh__was' }, [node('span', { class: 'vh' }, [`${fill('wiActual')} `]), usd(h.est.net)]), ' → ');
    }
    if (rs) rs.textContent = text;
  }

  function writeHash() {
    const next = toHash(state, h);
    // Leave a fragment that isn't a scenario (#whatif, the skip link's #main) alone while there is nothing to write.
    if (next === location.hash || (next === '' && !isScenarioHash(location.hash))) return;
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
    } catch {
      // Some browsers rate-limit replaceState; the next change writes the fragment again.
    }
  }

  // An action on the what-if; drag: from a drag (the only kind that leaves a resting mouse's hold alone).
  function apply(action, { drag = false } = {}) {
    const next = reduce(state, action, ctx());
    if (next !== state) {
      state = next;
      if (action.type !== 'set') for (const r of Object.values(rows)) r.editing = false;
      // Any change the reader makes, a reset included, makes the scenario theirs: no longer the link's "Reader-made".
      linked = false;
      page.classList.add('hh--used');
      draw();
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    }
    if (!drag) letGoAll();
  }

  // A scenario from the address: on load (animate false: the strips start on the axis the scenario needs), and when a
  // link opens in this tab.
  function load(animate = true) {
    letGoAll();
    const next = fromHash(location.hash, h, ctx()).state;
    linked = changed(next, h);
    state = next;
    draw(animate);
    settle();
  }

  // ---------- the rest of the controls ----------
  // A reset hides the banner and the row's Reset: focus on either moves to what stays beside it (the pressed peer toggle,
  // or Match the peer median), never to the page's start. from: the control used (a click's; Safari doesn't focus a
  // clicked button or link), else the focused one (Escape).
  const resetAll = (from = document.activeElement) => {
    apply({ type: 'reset' });
    if (from && (scen.contains(from) || shared.contains(from))) bar?.querySelector('[data-peer][aria-pressed="true"]')?.focus({ preventScroll: true });
    else if (from && from === reset) match?.focus({ preventScroll: true });
  };
  match?.addEventListener('click', () => apply({ type: 'medianAll' }));
  reset?.addEventListener('click', (e) => resetAll(e.currentTarget));
  topReset.addEventListener('click', (e) => resetAll(e.currentTarget));
  sharedLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetAll(e.currentTarget);
  });
  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !changed(state, h) || !e.target.closest?.('#whatif, [data-peers], .hh__scen')) return;
    e.preventDefault();
    resetAll();
  });
  window.addEventListener('hashchange', () => {
    if (isScenarioHash(location.hash) && location.hash !== toHash(state, h)) load();
  });

  // The banner adds to the sticky rows: the focused control it would cover scrolls back into view under it (WCAG 2.2
  // 2.4.11). Runs after the banner's height is laid out, which the page's scroll padding also takes (--scen-h:
  // hub/styles.css), so a jump clears it too.
  function keepInView() {
    const a = document.activeElement;
    if (!a || !bar || !page.contains(a) || bar.contains(a) || scen.contains(a) || shared.contains(a)) return;
    const box = (a.querySelector?.('.st__hb') ?? a).getBoundingClientRect();
    // The lowest sticky row: the banner under the peer row (on a phone, the banner alone), else the peer row.
    const edge = Math.max(bar.getBoundingClientRect().bottom, scen.hidden ? -Infinity : scen.getBoundingClientRect().bottom);
    if (box.top < edge + CLEAR) window.scrollBy(0, box.top - edge - CLEAR);
  }
  if (bar && 'ResizeObserver' in window) {
    const onBar = new ResizeObserver(keepInView);
    const onScen = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--scen-h', `${scen.hidden ? 0 : Math.ceil(scen.getBoundingClientRect().height)}px`);
      keepInView();
    });
    onBar.observe(bar);
    onScen.observe(scen);
    observers.push(onBar, onScen);
  }

  // The first handle: the button above jumps to it (it takes focus once the jump has landed, then wiggles), and it
  // wiggles once when the rows first come into view.
  const first = ROWS.map((r) => strips.handle(r.id)).find(Boolean);
  $('.hh__wbtn')?.addEventListener('click', () => {
    setTimeout(() => {
      // The jump's #whatif took the place of a scenario's fragment: put the scenario back.
      writeHash();
      first?.focus({ preventScroll: true });
      strips.nudge();
    }, still.matches ? 0 : JUMP_MS);
  });
  if (first && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      seen.disconnect();
      strips.nudge();
    }, { threshold: 0.5 });
    seen.observe(first.closest('[data-row]') ?? first);
  }

  load(false);

  return {
    setGroup(next) {
      g = next;
      draw();
      settle();
    },
  };
}
