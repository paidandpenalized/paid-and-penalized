// A hospital page's factor what-if, live (hub/client/hospital.js mounts it once the hub's data arrives). Each program row
// the hospital is in gets a capsule handle on its strip (strips.js draws it; this binds its drag and keys), a factor field
// with − and + steppers and "Use peer median" (the hospital-acquired conditions row: a "1% cut" / "No cut" pair); the net
// row's "Match the peer median on all three" and "Reset to actual" show. The state and its arithmetic are whatif-state.js's,
// the words whatif-text.js's.
//
// Once anything changes, the page says so everywhere it shows a figure: the sticky peer row becomes a dashed
// "Hypothetical" banner with the net and "Reset to actual"; the stamp reads "What if"; every changed figure shows the new
// value with the actual struck through beside it, and each chart keeps the actual as a ghost (the dollar rows' bars, the
// strips' rings, the swarm's rings) beside a hollow "What if" mark; the headline states the comparison for the
// hypothetical net. The result box (a polite live region) updates SETTLE_MS after the last input, and so does the URL
// fragment (#whatif&hrrp=…, history.replaceState). A page opened from a link with a valid changed scenario loads it and
// says "Reader-made scenario, not CMS data.", with a link back to the actual figures. Keys on a handle: ← → (and ↑ ↓)
// step, Shift (or Page Up and Down) steps bigger, Home and End go to the ends it states; Escape anywhere in the what-if or
// the banner resets the page.
//
// The strips draw the actual figures' axis until the reader opens the what-if (the "What if?" button, a link to #whatif,
// a control's focus or input), then glide once to the wide one, and back on a reset; a drag keeps the axis it began on
// until it ends (scale.js stripAxis). A link that opens on the what-if starts wide, with no glide.
import { netShare, pctOf } from '../../../engine/js/dollars/whatif.js';
import { numberOrNaN } from '../../../engine/js/stats.js';
import { siteAddress } from '../../../web/client/follow.js';
import { factor } from '../../../web/client/format.js';
import { fillCopy, pillClass } from '../../../web/render/components.js';
import { programById } from '../../../web/site.js';
import { SETTLE_MS } from '../../../web/whatif/dom.js';
import { isScenarioHash, isWhatIfHash } from '../../../web/whatif/fragment.js';
import { COPY } from '../../hospital/copy.js';
import { ROWS, ROW_IDS, ROW_KEY, barSpan, rowDollars, sumScale, trackAt } from '../../hospital/peers.js';
import { HAC_CUT_TEXT, comparison, inkOf, rowWord, signedMoney as usd } from '../../hospital/text.js';
import { stripAxis } from '../scale.js';
import { changed, extent, factorAt, fromHash, initial, outcome, ranges, reduce, toHash, vbpMaxOf } from './whatif-state.js';
import { bannerText, sentence, valueText } from './whatif-text.js';

const fill = (key, values) => fillCopy(COPY, key, values);
// The actual struck through beside a figure only where the two print differently (a cent of arithmetic is not news).
const struck = (now, actual) => (usd(now) === usd(actual) ? null : actual);
// How long the "What if? Adjust any program" button's jump takes before the first handle takes focus and wiggles.
const JUMP_MS = 450;
// The room kept between the sticky row and a focused control it would otherwise cover (CSS pixels).
const CLEAR = 8;

function node(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  n.append(...kids);
  return n;
}

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

// mountWhatIf(page, options): page is the article. Options: h (this hospital, with an estimate), hospitals (every decoded
// row: value-based purchasing's highest factor is theirs), fy, still (reduced motion), strips (mountStrips' handle API),
// swarm (mountSwarm's), values (the dollar rows' scale values for every group: hub/hospital/peers.js sumValues), group
// ({ peers, figures, group }, the page's first). Returns { setGroup(group) } for the peer toggle.
export function mountWhatIf(page, { h, hospitals, fy, still, strips, swarm, values, group }) {
  const $ = (sel) => page.querySelector(sel);
  const vbpMax = vbpMaxOf(hospitals);
  const rng = ranges(h, { vbpMax });
  const actual = initial(h);
  // A factor's ends as the field and the slider state them (whatif-state.js extent).
  const ends = (id) => extent(h, { vbpMax }, ROW_KEY[id]);
  let g = group;
  const ctx = () => ({ h, vbpMax, peers: g.peers });
  let state = actual;
  let linked = false;
  let timer = 0;
  // The strips' axis as the reader opens, resets and drags (scale.js stripAxis): event 'open', 'reset', 'press' or
  // 'release'; animate false to move at once (a page opened on the what-if).
  let axis = { open: false, held: false, wide: false };
  const axisOn = (event, animate = true) => {
    const next = stripAxis(axis, event);
    if (next.wide !== axis.wide) strips.setWide(next.wide, animate);
    axis = next;
  };

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
    // A drag: the pointer's offset from the handle's middle is kept, so the handle never jumps under it. The page updates
    // once a frame at most, to the last place the pointer reached (at), and a release lands that place at once; keys and
    // the field update at once.
    let offset = null;
    let at = null;
    let frame = 0;
    const valueAt = (e) => strips.shareAt(id, e.clientX + offset);
    const drag = () => {
      frame = 0;
      const v = at;
      at = null;
      if (v === null) return;
      if (id === 'hacrp') {
        // The cut's place on the strip is its share of pay; past half way to it reads as the cut.
        const cutAt = pctOf({ total: h.est.total, ...outcome({ ...state, hac: true }, h) }).hac;
        apply({ type: 'hac', cut: v < cutAt / 2 });
      } else if (h.est.base > 0) apply({ type: 'set', id: key, value: factorAt(h, v) });
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const b = el.querySelector('.st__hb').getBoundingClientRect();
      offset = b.left + b.width / 2 - e.clientX;
      el.setPointerCapture?.(e.pointerId);
      axisOn('press');
      el.focus({ preventScroll: true });
      page.classList.add('hh--used', 'hh--dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (offset === null) return;
      const v = valueAt(e);
      if (v === null) return;
      at = v;
      if (!frame) frame = requestAnimationFrame(drag);
    });
    const end = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        drag();
      }
      offset = null;
      page.classList.remove('hh--dragging');
      axisOn('release');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ---------- the banner, the stamp, the net and the result: what they say before any change, kept to restore ----------
  const bar = $('[data-peers]');
  const pin = bar?.querySelector('.hh__pin');
  const scenText = node('span', { class: 'hh__scentext' });
  const topReset = node('button', { type: 'button', class: 'hh__reset' }, [fill('reset')]);
  const scen = node('div', { class: 'hh__scen', hidden: '' }, [node('span', { class: 'hh__htag' }, [fill('wiTag')]), scenText, topReset]);
  // The page's own address without the scenario, as a link on this site (siteAddress folds a leading "//").
  const sharedLink = node('a', { href: siteAddress({ pathname: location.pathname, search: location.search, hash: '' }) }, [fill('wiSharedReset')]);
  const shared = node('p', { class: 'hh__shared', hidden: '' }, [`${fill('wiShared')} `, sharedLink]);
  pin?.append(scen, shared);

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

  // Everything but the result box, at once.
  function draw() {
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

  function apply(action) {
    axisOn(action.type === 'reset' ? 'reset' : 'open');
    const next = reduce(state, action, ctx());
    if (next === state) return;
    state = next;
    if (action.type !== 'set') for (const r of Object.values(rows)) r.editing = false;
    if (action.type === 'reset') linked = false;
    page.classList.add('hh--used');
    draw();
    clearTimeout(timer);
    timer = setTimeout(settle, SETTLE_MS);
  }

  // A scenario from the address: on load (animate false: the strips start on the axis the link asks for), and when a
  // link opens in this tab.
  function load(animate = true) {
    if (isWhatIfHash(location.hash)) axisOn('open', animate);
    const next = fromHash(location.hash, h, ctx()).state;
    linked = changed(next, h);
    state = next;
    draw();
    settle();
  }

  // ---------- the rest of the controls ----------
  // A reset hides the banner and the row's Reset: focus on either moves to what stays beside it (the pressed peer toggle,
  // or Match the peer median), never to the page's start.
  const resetAll = () => {
    const a = document.activeElement;
    apply({ type: 'reset' });
    if (a && (scen.contains(a) || shared.contains(a))) bar?.querySelector('[data-peer][aria-pressed="true"]')?.focus({ preventScroll: true });
    else if (a && a === reset) match?.focus({ preventScroll: true });
  };
  match?.addEventListener('click', () => apply({ type: 'medianAll' }));
  reset?.addEventListener('click', resetAll);
  topReset.addEventListener('click', resetAll);
  sharedLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetAll();
  });
  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !changed(state, h) || !e.target.closest?.('#whatif, [data-peers]')) return;
    e.preventDefault();
    resetAll();
  });
  window.addEventListener('hashchange', () => {
    if (isScenarioHash(location.hash) && location.hash !== toHash(state, h)) load();
  });

  // The banner makes the sticky row taller: the focused control it would cover scrolls back into view under it (WCAG 2.2
  // 2.4.11). Runs after the row's new height is laid out.
  function keepInView() {
    const a = document.activeElement;
    if (!a || !bar || !page.contains(a) || bar.contains(a)) return;
    const box = (a.querySelector?.('.st__hb') ?? a).getBoundingClientRect();
    const edge = bar.getBoundingClientRect().bottom;
    if (box.top < edge + CLEAR) window.scrollBy(0, box.top - edge - CLEAR);
  }
  if (bar && 'ResizeObserver' in window) new ResizeObserver(keepInView).observe(bar);

  // A control taking focus opens the what-if (the drag's own focus waits for its end: stripAxis).
  page.addEventListener('focusin', (e) => {
    if (e.target.closest?.('.st__h, .hh__ctl')) axisOn('open');
  });

  // The first handle: the button above jumps to it (the strips widen once the jump has landed, then it wiggles), and it
  // wiggles once when the rows first come into view.
  const first = ROWS.map((r) => strips.handle(r.id)).find(Boolean);
  $('.hh__wbtn')?.addEventListener('click', () => {
    setTimeout(() => {
      // The jump's #whatif took the place of a scenario's fragment: put the scenario back.
      writeHash();
      axisOn('open');
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
