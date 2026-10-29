// The story's last step, "Find yours": a hospital among its peers. The pure parts (the groups, the peer line, the card's
// words) serve the build too, so the example card the server writes and the card the script rewrites for a found hospital
// say the same thing the same way, in the hospital page's figures (hub/hospital/text.js, peers.js). mountFind wires the
// step on the page: the card, the peer toggle and the chart follow the found hospital (or, until one is found, the
// example), and a found hospital is announced to the page as a 'hub:select' event on the document ({ ccn }).
//
// Hospitals are the hub asset's rows (web/client/hub-asset.js) or hubHospitals': both carry state, beds (whose size band
// engine/js/peers.js bedBand works out) and teach; only hospitals with an estimate are anyone's peers.
import { PEER_MODES, median, peerKey } from '../../../engine/js/peers.js';
import { fillCopy } from '../../../web/render/components.js';
import { capitalize, count, placeText } from '../../../web/render/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { COPY } from './copy.js';
import { COPY as HOSPITAL_COPY } from '../../hospital/copy.js';
import { ROWS, groupName, inProgram, peersOf } from '../../hospital/peers.js';
import { signOf, signedMoney, signedShareText } from '../../hospital/text.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// h's group under mode, named in the hospital page's words (hub/hospital/peers.js groupName, group-copy.js): "Ohio
// hospitals", "hospitals with 100 to 299 beds", "major teaching hospitals".
const nameOf = (h, mode) => groupName(fill, h, mode);

// The card's line about the group: "Of 117 Ohio hospitals, 81 take a net cut; the median is −0.47%." peers: peersOf's.
export function peerLine(h, peers, mode) {
  const cut = peers.filter((x) => x.est.net < 0).length;
  return fill('cardPeers', { n: count(peers.length), group: nameOf(h, mode), cutN: count(cut), median: signedShareText(median(peers.map((x) => x.est.share))) });
}

// Teaching status in words (null: not reported), and each program's row on the card.
const TEACHING = { major: 'teachMajor', minor: 'teachMinor', none: 'teachNone' };
const LABELS = { hrrp: 'programHrrp', hacrp: 'programHac', hvbp: 'programVbp' };
function programRow(est, { id, key }) {
  const label = LABELS[id];
  if (!inProgram(est, id)) return { key: label, label: fill(label), text: fill('notInProgram'), kind: 'na' };
  const v = est[key];
  return { key: label, label: fill(label), text: `${signedMoney(v)} ${fill(v < 0 ? 'wordCut' : v > 0 ? 'wordBonus' : 'wordNone')}`, kind: v < 0 ? 'pen' : '' };
}

// The card's line under the name: the place, the bed count and the teaching status.
function placeOf(h) {
  const teaching = fill(TEACHING[h.teach] ?? 'teachUnknown');
  return Number.isInteger(h.beds) ? fill('cardPlace', { place: placeText(h), beds: count(h.beds), teaching })
    : fill('cardPlaceNoBeds', { place: placeText(h), teaching: capitalize(teaching) });
}

// What the card says about a hospital with an estimate, h, among peers (peersOf's, under mode), for fiscal year fy:
// { ccn, name, place, pct, usd, pen, netWords, rows: [{ key, label, text, kind }], peer, href }. pct is its net as a
// signed share of its pay, usd the net in dollars as its own page prints them (−$3.2M), pen whether it is a cut; a
// row's kind is 'pen' (a cut), 'na' (not in the program: "Not in this program", never $0) or ''.
export function cardModel(h, peers, mode, fy) {
  const { est } = h;
  const sign = capitalize(signOf(est.net));
  return {
    ccn: h.ccn, name: h.name, place: placeOf(h),
    pct: signedShareText(est.share), usd: signedMoney(est.net), pen: est.net < 0,
    netWords: fill(`cardNet${sign}`, { fy: String(fy) }),
    rows: ROWS.map((row) => programRow(est, row)),
    peer: peerLine(h, peers, mode),
    href: hospitalPathOf('hub', h.ccn),
  };
}

// What the card says about a hospital without an estimate, h (Maryland's all-payer model, or no inputs to estimate from),
// in its hospital page's words, for fiscal year fy: { ccn, name, place, status, why, href }. It has no net and no dot,
// so the card holds no figure and the chart stays as it was.
export function statusModel(h, fy) {
  const maryland = h.status === 'maryland';
  return {
    ccn: h.ccn, name: h.name, place: placeOf(h),
    status: HOSPITAL_COPY[maryland ? 'statusMaryland' : 'statusNoInputs'],
    why: maryland ? HOSPITAL_COPY.statusMarylandText : fillCopy(HOSPITAL_COPY, 'statusNoInputsText', { fy: String(fy) }),
    href: hospitalPathOf('hub', h.ccn),
  };
}

// ---------- on the page ----------

// Wires the last step in story (the .story element). hospitals: the asset's; fy: its year; example: the example's row;
// stage: the story's chart (stage.js), told when the hospital or its group changes. Returns { select(h), note(h),
// follow(href), groupOf(h), stop() }: follow a hospital with an estimate; show a hospital without one on the card, with
// its status and why (the chart, which has no dot for it, stays as it was); follow the hospital whose page href is, when
// it has an estimate (the hospital; null for any other, whose page the search then opens); the hospital's group as the
// chart draws it ({ peers, label }); and undo the wiring (the toggle hidden again, its buttons dead).
export function mountFind({ story, hospitals, fy, example, stage }) {
  const card = story.querySelector('[data-card]');
  const toggle = story.querySelector('.peers');
  const buttons = [...toggle.querySelectorAll('[data-peer]')];
  const reasons = new Map([...toggle.querySelectorAll('[data-why]')].map((p) => [p.dataset.why, p]));
  const part = (sel) => card.querySelector(sel);
  const estimated = hospitals.filter((h) => h.est);
  const byHref = new Map(hospitals.map((h) => [hospitalPathOf('hub', h.ccn), h]));
  let chosen = null;
  // A hospital without an estimate the card shows (note), until one with an estimate is chosen.
  let noted = null;
  let mode = PEER_MODES[0];

  const current = () => chosen ?? example;
  // The mode a hospital is shown in: the reader's, unless the hospital has no group there (then by state).
  const modeFor = (h) => (peerKey(h, mode) === null ? PEER_MODES[0] : mode);
  const groupOf = (h) => {
    const m = modeFor(h);
    return { peers: peersOf(estimated, h, m), label: nameOf(h, m) };
  };

  // The card's figures: a hospital with an estimate's (cardModel), or the status of one without (statusModel: its stamp
  // in the net's place and why under it; the stylesheet hides the rows, the peer line and the pointer, card--none).
  function paintCard(h, m) {
    const pct = part('.card__pct');
    if (noted) {
      const model = statusModel(noted, fy);
      card.dataset.ccn = model.ccn;
      card.classList.add('card--none');
      part('.card__nm').textContent = model.name;
      part('.card__loc').textContent = model.place;
      pct.textContent = model.status;
      pct.className = 'card__pct stamp stamp--ink';
      part('.card__usd').textContent = '';
      part('.card__netl').textContent = model.why;
      part('.card__go').setAttribute('href', model.href);
      return;
    }
    const model = cardModel(h, peersOf(estimated, h, m), m, fy);
    card.dataset.ccn = model.ccn;
    card.classList.remove('card--none');
    part('.card__nm').textContent = model.name;
    part('.card__loc').textContent = model.place;
    pct.textContent = model.pct;
    pct.className = model.pen ? 'card__pct v--pen' : 'card__pct';
    part('.card__usd').textContent = model.usd;
    part('.card__netl').textContent = model.netWords;
    [...card.querySelectorAll('.card__row')].forEach((row, i) => {
      const r = model.rows[i];
      row.querySelector('dt').textContent = r.label;
      const dd = row.querySelector('dd');
      dd.textContent = r.text;
      dd.className = r.kind ? `v v--${r.kind}` : 'v';
    });
    part('.card__peer').textContent = model.peer;
    part('.card__go').setAttribute('href', model.href);
  }

  // The card and the toggle, for the current hospital and mode. Text goes into the card's own elements.
  function paint() {
    const h = current();
    const m = modeFor(h);
    part('.card__ex').hidden = Boolean(chosen || noted);
    paintCard(h, m);
    for (const b of buttons) {
      const off = peerKey(h, b.dataset.peer) === null;
      b.setAttribute('aria-pressed', String(b.dataset.peer === m));
      if (off) {
        b.setAttribute('aria-disabled', 'true');
        b.setAttribute('aria-describedby', reasons.get(b.dataset.peer)?.id ?? '');
      } else {
        b.removeAttribute('aria-disabled');
        b.removeAttribute('aria-describedby');
      }
      const why = reasons.get(b.dataset.peer);
      if (why) why.hidden = !off;
    }
  }

  // The card first: a card the page is missing a part of stops here, before anything is wired.
  paint();
  const off = new AbortController();
  for (const b of buttons) {
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      // The reader's choice is remembered even when it is already what shows (a hospital with no group in the mode
      // chosen before shows by state), so the next hospital keeps it.
      const was = modeFor(current());
      mode = b.dataset.peer;
      if (mode === was) return;
      paint();
      stage.regroup();
    }, { signal: off.signal });
  }
  toggle.hidden = false;

  function select(h) {
    if (!h?.est || (h === chosen && !noted)) return;
    chosen = h;
    noted = null;
    toggle.hidden = false;
    paint();
    stage.select(h);
    document.dispatchEvent(new CustomEvent('hub:select', { detail: { ccn: h.ccn } }));
  }

  return {
    select,
    note(h) {
      if (!h || h.est) return;
      noted = h;
      // No dot, so no group: the chart shows everyone alone and the peer toggle has nothing to group.
      toggle.hidden = true;
      paint();
      stage.none();
    },
    groupOf,
    stop() {
      off.abort();
      toggle.hidden = true;
    },
    follow(href) {
      const h = byHref.get(href);
      if (!h?.est) return null;
      select(h);
      return h;
    },
  };
}
