// The family's front page, server-rendered: the masthead hero, then the story. Nine steps of words on the left (a rail
// of their names beside them), every number from the data; on the right the stage, which holds the two charts drawn at
// build time (the scale bar for the first six steps, the shaded states map for the last three), the canvas slot the
// story's script draws in, and the parts only that script uses (hidden here). The last step finds a hospital among its
// peers: the search the script mounts, and the example hospital's card. Without scripts the page is complete: the
// charts stick beside the steps they belong to (hub/styles.css), or sit between them on a phone.
import { PEER_MODES, median } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../web/charts/geo.js';
import { COPY as SHARED } from '../../web/copy.js';
import { HAC_CUT_PCT, HRRP_CAP_PCT, VBP_WITHHOLD_PCT } from '../../web/programs.js';
import { fillAround, fillCopy } from '../../web/render/components.js';
import { capitalize, count, dollars, listText, money, noun, numberWord, pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { externalLink, page } from '../../web/render/layout.js';
import { searchForm } from '../../web/render/shell.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { EXAMPLE_CCN } from '../model.js';
import { barFigure } from './bar.js';
import { COPY } from './copy.js';
import { smallStates, stateLegend, statesMap } from './states.js';

// The story's steps, in order: each one's id (step-<slug>) and its name on the rail.
export const STEPS = Object.freeze([
  ['scale', 'railScale'], ['start', 'railStart'], ['readmissions', 'railHrrp'], ['hac', 'railHac'], ['vbp', 'railVbp'],
  ['net', 'railNet'], ['map', 'railMap'], ['states', 'railStates'], ['find', 'railFind'],
].map(([slug, rail]) => ({ slug, rail })));

// How near a simple fraction (a half to four fifths) must be to the share of hospitals with a net cut for the heading to
// say it in words ("Two of every three"); further off, it gives the share. And the share of states in which net cuts
// must outnumber net bonuses for the words "almost everywhere".
const FRACTION_NEAR = 0.02;
const ALMOST_ALL = 0.8;

const fill = (key, values) => fillCopy(COPY, key, values);
// A rule's percent as the page writes it: percent(3) is "3%".
const percent = (n) => pct(n / 100, 0);
// The programs the dollar estimates hold (the story's three), in words: "three".
const IN_DATA = SITE.programs.filter((p) => p.inData);

// A sentence of copy with its numbers set in bold (nums: placeholder -> formatted number; pen: the ones that are money
// taken, in the penalty ink) and its other placeholders (plain) filled as words.
function say(key, nums = {}, { plain = {}, pen = [] } = {}) {
  const bold = Object.fromEntries(Object.entries(nums).map(([name, v]) => [name, html`<b class="num${pen.includes(name) ? ' num--pen' : ''}">${v}</b>`]));
  return fillAround((marks) => fill(key, { ...plain, ...marks }), bold);
}

// A claim the words make about the data, checked on every build: the build stops rather than print a sentence the data
// no longer bears out.
function holds(ok, words) {
  if (!ok) throw new RangeError(`hub home: the data no longer bear out "${words}"`);
}

// The simple fraction nearest x, as { part, whole }, within FRACTION_NEAR; null when none is that near.
export function simpleFraction(x) {
  let best = null;
  for (let whole = 2; whole <= 5; whole++) {
    for (let part = 1; part < whole; part++) {
      const away = Math.abs(x - part / whole);
      if (!best || away < best.away - 1e-12) best = { part, whole, away };
    }
  }
  return best.away <= FRACTION_NEAR ? { part: best.part, whole: best.whole } : null;
}

// The masthead: the wordmark across the page (two spans, which the header's script later moves into the bar), the
// tagline and byline between rules, and a heavy rule before the story.
const hero = () => html`<section class="hero"><div class="wrap hero__in">
<h1 class="hero__mark"><span class="hero__m1">${SHARED.wordmarkLead}</span> <span class="hero__m2">${SHARED.wordmarkPen}</span></h1>
<div class="hero__strip"><p class="hero__tag">${SHARED.tagline}</p><p class="hero__by">${SHARED.bylineLead} ${externalLink(SITE.linkedin, SHARED.bylineName)}</p></div>
<hr class="hero__rule">
</div></section>`;

// Each step's words, from the facts and the states. Returns the nine steps' inner markup, in STEPS order.
function stepWords({ hospitals, facts, states, fy, search, card }) {
  const zero = money(0);
  const fyText = String(fy);
  const programs = numberWord(IN_DATA.length);
  holds(IN_DATA.every((p) => p.group === 'quality'), 'quality programs');

  const hrrpCuts = hospitals.filter((h) => h.est && h.est.hrrp < 0).map((h) => -h.est.hrrp / h.est.total);
  holds(facts.hrrpCut * 2 > facts.n, COPY.hrrpHead);
  holds(facts.vbpBonusN > 0, COPY.vbpHead);

  const fraction = simpleFraction(facts.netCut / facts.n);
  const netHead = fraction ? fill('netHead', { part: capitalize(numberWord(fraction.part)), whole: numberWord(fraction.whole) })
    : fill('netHeadShare', { share: pct(facts.netCut / facts.n, 0) });

  // The states with estimates: their net cuts and bonuses (the map's words), the lowest and highest by share, and those
  // that come out ahead, by name.
  const estimated = [...states.values()].filter((s) => !s.notInPrograms);
  const bonusN = new Map();
  for (const h of hospitals) if (h.est && h.est.net > 0) bonusN.set(h.state, (bonusN.get(h.state) ?? 0) + 1);
  holds(estimated.every((s) => s.cutN > 0), COPY.mapHead);
  holds(estimated.filter((s) => s.cutN > (bonusN.get(s.state) ?? 0)).length >= ALMOST_ALL * estimated.length, COPY.mapText);
  holds(states.get('MD')?.notInPrograms === true, COPY.statesText);
  const byShare = [...estimated].sort((a, b) => a.share - b.share);
  const [low, high] = [byShare[0], byShare[byShare.length - 1]];
  holds(low.share < 0, COPY.statesHead);
  const ahead = estimated.filter((s) => s.share > 0).map((s) => STATE_NAMES[s.state]).sort();
  const aheadLine = ahead.length ? fill(ahead.length === 1 ? 'aheadOne' : 'aheadMany', { states: listText(ahead) }) : COPY.aheadNone;
  const shares = { lowShare: pct(-low.share, 2), low: STATE_NAMES[low.state], highShare: pct(Math.abs(high.share), 2), high: STATE_NAMES[high.state] };

  return [
    html`<h2>${fill('scaleHead', { n: count(facts.n), pay: money(facts.pay), fy: fyText })}</h2>
<p>${say('scaleText', { gross: money(facts.gross), share: pct(facts.share, 2), notPaid: money(facts.notPaid), bonus: money(facts.vbpBonus) }, { plain: { programs: capitalize(programs) }, pen: ['notPaid'] })}</p>
<p class="cue"><span class="cue__line" aria-hidden="true"></span>${COPY.scaleCue}</p>
<p class="asof-line">${fill('scaleAsOf', { fy: fyText })}</p>`,
    html`<h2>${fill('startHead', { zero })}</h2>
<p>${fill('startText', { programs })}</p>`,
    html`<h2>${COPY.hrrpHead}</h2>
<p>${say('hrrpText', { cutN: count(facts.hrrpCut), median: pct(median(hrrpCuts), 2), zeroN: count(facts.hrrpZero) }, { plain: { cap: percent(HRRP_CAP_PCT), zero } })}</p>`,
    html`<h2>${fill('hacHead', { cut: percent(HAC_CUT_PCT) })}</h2>
<p>${say('hacText', { cutN: count(facts.hacCut), onlyN: count(facts.hacOnly) }, { plain: { cut: percent(HAC_CUT_PCT) } })}</p>`,
    html`<h2>${COPY.vbpHead}</h2>
<p>${say('vbpText', { bonusN: count(facts.vbpBonusN), cutN: count(facts.vbpCutN), bonus: money(facts.vbpBonus) }, { plain: { withhold: percent(VBP_WITHHOLD_PCT) } })}</p>`,
    html`<h2>${netHead}</h2>
<p>${say('netText', { cutN: count(facts.netCut), bonusN: count(facts.netBonus), zeroN: count(facts.netZero), notPaid: money(facts.notPaid) }, { plain: { programs, zero }, pen: ['cutN', 'notPaid'] })}</p>`,
    html`<h2>${COPY.mapHead}</h2>
<p>${COPY.mapText}</p>`,
    html`<h2>${fill(high.share > 0 ? 'statesHead' : 'statesHeadLess', shares)}</h2>
<p>${fill('statesText', { ahead: aheadLine })}</p>`,
    html`<h2>${COPY.findHead}</h2>
${search}
${card}`,
  ];
}

// Teaching status in words, by the master's value (null: not reported).
const TEACHING = { major: 'teachMajor', minor: 'teachMinor', none: 'teachNone' };
const teachingOf = (teach) => COPY[TEACHING[teach] ?? 'teachUnknown'];

// A program's dollars on the card: signed whole dollars and the word (cut, bonus, no change), or "Not in this program".
function programAmount(value, listed) {
  if (!listed) return html`<dd class="v v--na">${COPY.notInProgram}</dd>`;
  const word = value < 0 ? COPY.wordCut : value > 0 ? COPY.wordBonus : COPY.wordNone;
  return html`<dd class="v${value < 0 ? ' v--pen' : ''}">${dollars(value, { sign: true })} ${word}</dd>`;
}

// Where the example card's "Open its hospital page" goes: the hospital's page on the Hospital-Acquired Conditions site
// until the hub's own hospital pages are built, when this becomes hospitalPathOf('hub', ccn). The one place it is set.
export const exampleHref = (ccn) => hospitalPathOf('hacrp', ccn);

// The example hospital's card (EXAMPLE_CCN): its name, place, size and teaching status, its net as a share of its pay
// and in dollars, each program's dollars, how its state's hospitals fare, and the way to its own page. The script swaps
// in the reader's hospital and peer group.
function exampleCard({ hospitals, fy }) {
  const h = hospitals.find((x) => x.ccn === EXAMPLE_CCN);
  if (!h?.est) throw new RangeError(`hub home: the example hospital ${EXAMPLE_CCN} has no estimate`);
  const { est } = h;
  const fyText = String(fy);
  const teaching = teachingOf(h.teach);
  const place = h.beds === null ? fill('cardPlaceNoBeds', { city: h.city, state: h.state, teaching: capitalize(teaching) })
    : fill('cardPlace', { city: h.city, state: h.state, beds: noun(h.beds, COPY.bed, COPY.beds), teaching });
  const netWords = fill(est.net < 0 ? 'cardNetCut' : est.net > 0 ? 'cardNetBonus' : 'cardNetZero', { fy: fyText });
  const peers = hospitals.filter((x) => x.est && x.state === h.state);
  const peerLine = say('cardPeers', { cutN: count(peers.filter((x) => x.est.net < 0).length), median: pct(median(peers.map((x) => x.est.share)), 2) },
    { plain: { n: count(peers.length), group: STATE_NAMES[h.state] } });
  const row = (key, value, listed) => html`<div class="card__row"><dt>${COPY[key]}</dt>${programAmount(value, listed)}</div>`;
  return html`<div class="card" data-card aria-live="polite">
<p class="card__ex">${COPY.cardExample} <span class="card__hint">${COPY.cardHint}</span></p>
<p class="card__nm">${h.name}</p>
<p class="card__loc">${place}</p>
<p class="card__net"><span class="card__pct${est.net < 0 ? ' v--pen' : ''}">${pct(est.share, 2, { sign: true })}</span> <span class="card__usd">${dollars(est.net, { sign: true })}</span></p>
<p class="card__netl">${netWords}</p>
<dl class="card__rows" aria-label="${fill('cardRowsLabel', { fy: fyText })}">${row('programHrrp', est.hrrp, est.hrrpListed)}${row('programHac', est.hac, true)}${row('programVbp', est.hvbp, est.vbpListed)}</dl>
<p class="card__peer">${peerLine}</p>
<p class="card__next">${COPY.cardNext}</p>
<a class="card__go" href="${exampleHref(h.ccn)}">${COPY.cardGo}<span class="ico ico--arrow" aria-hidden="true"></span></a>
</div>`;
}

// The peer toggle the last step's chart wears (hidden: the script shows it and moves the dots).
const PEER_WORDS = { state: 'peerState', size: 'peerSize', teach: 'peerTeach' };
const peerToggle = () => html`<div class="peers" hidden><p class="peers__lbl" id="peers-l">${COPY.peersLabel}</p><div class="seg" role="group" aria-labelledby="peers-l">${PEER_MODES.map((mode, i) => html`<button type="button" data-peer="${mode}" aria-pressed="${i === 0 ? 'true' : 'false'}">${COPY[PEER_WORDS[mode]]}</button>`)}</div></div>`;

// The page. hospitals: hubHospitals; facts: storyFacts of them; states: stateTotals of them; shapes: the atlas's state
// shapes (loadHub); assets: the build's (assets.shell holds the fiscal year and the hub asset's address); robots: the
// page's robots value.
export function homePage({ hospitals, facts, states, shapes, assets, robots }) {
  const { fy, hubUrl } = assets.shell;
  const search = searchForm({ id: 'find', src: hubUrl, label: COPY.findLabel, find: COPY.findWord, findRest: COPY.findRest, placeholder: COPY.findPlaceholder, hero: true, hub: true });
  const words = stepWords({ hospitals, facts, states, fy, search, card: exampleCard({ hospitals, fy }) });
  const zero = money(0);
  const rail = html`<nav class="railbox" aria-label="${COPY.railLabel}"><ol class="rail">${STEPS.map((s) => html`<li><a href="#step-${s.slug}">${fill(s.rail, s.slug === 'start' ? { zero } : {})}</a></li>`)}</ol></nav>`;
  const steps = STEPS.map((s, i) => html`<section class="step" id="step-${s.slug}" data-step="${i}"><div class="step__in">
${words[i]}
</div></section>
`);
  const body = html`${hero()}
<div class="story" data-story>
${rail}
${steps}<div class="stage" data-stage>
<div class="stage__panel stage__panel--bar"><div class="stage__pin">${barFigure({ hospitals, facts, fy })}</div></div>
<canvas class="stage__cv" hidden></canvas>
<div class="stage__panel stage__panel--map"><div class="stage__pin smapfig">
<p class="readout" aria-live="polite">${COPY.readout}</p>
${statesMap({ shapes, states })}
<div class="mapfoot">${stateLegend({ states, fy })}${smallStates(states)}</div>
</div></div>
${peerToggle()}
</div>
</div>`;
  return page({ title: SITE.name, description: COPY.description, path: '/', robots, body, scripts: [assets.js.topbar], assets });
}
