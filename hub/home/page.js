// The family's front page, server-rendered: the masthead hero, then the story. Nine steps of words on the left (a rail
// of their names beside them), every number from the data; on the right the stage, which holds the two charts drawn at
// build time (the scale bar for the first six steps, the shaded states map for the last three), the canvas slot the
// story's script draws in, and the parts only that script uses (hidden here). The last step finds a hospital among its
// peers: a family search over the hospitals (hub/client/search.js mounts it; the story's script follows the hospital
// found in place), and the example hospital's card. The page renders through hubPage (hub/parts.js), so its bar holds the family search too. Without scripts the page is
// complete: the charts stick beside the steps they belong to (hub/styles.css), or sit between them on a phone. With
// them (hub/client/home.js) the stage is one sticky chart whose canvas moves the dots from step to step. Below the story
// (below.js): the program directory, the methods in brief with the example's worksheet, and the invitation.
import { PEER_MODES, median } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { COPY as SHARED } from '../../web/copy.js';
import { HAC_CUT_PCT, HRRP_CAP_PCT, VBP_WITHHOLD_PCT, rulePercent } from '../../web/programs.js';
import { fillAround, fillCopy } from '../../web/render/components.js';
import { capitalize, count, listText, money, numberWord, pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { externalLink, feedbackFor } from '../../web/render/layout.js';
import { searchForm } from '../../web/render/shell.js';
import { SITE } from '../../web/site.js';
import { cardModel } from '../client/story/find.js';
import { COPY as HOSPITAL_COPY } from '../hospital/copy.js';
import { peersOf } from '../hospital/peers.js';
import { EXAMPLE_CCN } from '../model.js';
import { arrow, hubPage } from '../parts.js';
import { barFigure } from './bar.js';
import { directory, methodsBrief, yourTurn } from './below.js';
import { holds, simpleFraction } from './claims.js';
import { COPY } from './copy.js';
import { smallStates, stateLegend, statesMap } from './states.js';

// The story's steps, in order: each one's id (step-<slug>) and its name on the rail.
export const STEPS = Object.freeze([
  ['scale', 'railScale'], ['start', 'railStart'], ['readmissions', 'railHrrp'], ['hac', 'railHac'], ['vbp', 'railVbp'],
  ['net', 'railNet'], ['map', 'railMap'], ['states', 'railStates'], ['find', 'railFind'],
].map(([slug, rail]) => ({ slug, rail })));

// The share of states in which net cuts must outnumber net bonuses for the words "almost everywhere".
const ALMOST_ALL = 0.8;

const fill = (key, values) => fillCopy(COPY, key, values);
// The programs the dollar estimates hold (the story's three), in words: "three".
const IN_DATA = SITE.programs.filter((p) => p.inData);

// A sentence of copy with its numbers set in bold (nums: placeholder -> formatted number; pen: the ones that are money
// taken, in the penalty ink) and its other placeholders (plain) filled as words.
function say(key, nums = {}, { plain = {}, pen = [] } = {}) {
  const bold = Object.fromEntries(Object.entries(nums).map(([name, v]) => [name, html`<b class="num${pen.includes(name) ? ' num--pen' : ''}">${v}</b>`]));
  return fillAround((marks) => fill(key, { ...plain, ...marks }), bold);
}

// The masthead: the wordmark across the page (two spans, which the page's script moves into the bar as it scrolls), the
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
<p>${say('hrrpText', { cutN: count(facts.hrrpCut), median: pct(median(hrrpCuts), 2), zeroN: count(facts.hrrpZero) }, { plain: { cap: rulePercent(HRRP_CAP_PCT), zero } })}</p>`,
    html`<h2>${fill('hacHead', { cut: rulePercent(HAC_CUT_PCT) })}</h2>
<p>${say('hacText', { cutN: count(facts.hacCut), onlyN: count(facts.hacOnly) }, { plain: { cut: rulePercent(HAC_CUT_PCT) } })}</p>`,
    html`<h2>${COPY.vbpHead}</h2>
<p>${say('vbpText', { bonusN: count(facts.vbpBonusN), cutN: count(facts.vbpCutN), bonus: money(facts.vbpBonus) }, { plain: { withhold: rulePercent(VBP_WITHHOLD_PCT), fy: fyText } })}</p>`,
    html`<h2>${netHead}</h2>
<p>${say('netText', { cutN: count(facts.netCut), bonusN: count(facts.netBonus), zeroN: count(facts.netZero), notPaid: money(facts.notPaid) }, { plain: { programs, zero, fy: fyText }, pen: ['cutN', 'notPaid'] })}</p>`,
    html`<h2>${COPY.mapHead}</h2>
<p>${COPY.mapText}</p>`,
    html`<h2>${fill(high.share > 0 ? 'statesHead' : 'statesHeadLess', shares)}</h2>
<p>${fill('statesText', { ahead: aheadLine })}</p>`,
    html`<h2>${COPY.findHead}</h2>
${search}
${card}`,
  ];
}

// The example hospital's card (EXAMPLE_CCN): its name, place, size band and teaching status, its net as a share of its pay
// and in dollars, each program's dollars, how its state's hospitals fare, and the way to its own page. Its words are
// cardModel's (hub/client/story/find.js), which the story's script uses to rewrite it for the reader's hospital and peer
// group, so the two never differ.
function exampleCard({ h, hospitals, fy }) {
  const mode = PEER_MODES[0];
  const m = cardModel(h, peersOf(hospitals, h, mode), mode, fy);
  const row = (r) => html`<div class="card__row"><dt>${r.label}</dt><dd class="v${r.kind ? ` v--${r.kind}` : ''}">${r.text}</dd></div>`;
  return html`<div class="card" data-card data-ccn="${m.ccn}" aria-live="polite">
<p class="card__ex">${COPY.cardExample} <span class="card__hint">${COPY.cardHint}</span></p>
<p class="card__nm">${m.name}</p>
<p class="card__loc">${m.place}</p>
<p class="card__net"><span class="card__pct${m.pen ? ' v--pen' : ''}">${m.pct}</span> <span class="card__usd">${m.usd}</span></p>
<p class="card__netl">${m.netWords}</p>
<dl class="card__rows" aria-label="${fill('cardRowsLabel', { fy: String(fy) })}">${m.rows.map(row)}</dl>
<p class="card__peer">${m.peer}</p>
<p class="card__next">${COPY.cardNext}</p>
<a class="card__go" href="${m.href}">${COPY.cardGo}${arrow}</a>
</div>`;
}

// The peer toggle the last step's chart wears (hidden: the script shows it and moves the dots), in the hospital page's
// words, with its notes for a toggle the hospital has no group for (hidden: the script shows the one that applies). The
// groups' names are the story's (hub/client/story/copy.js).
const PEER_WORDS = { state: 'peerState', size: 'peerSize', teach: 'peerTeach' };
const PEER_WHY = { size: 'peerNoSize', teach: 'peerNoTeach' };
const peerToggle = () => html`<div class="peers" hidden><p class="peers__lbl" id="peers-l">${HOSPITAL_COPY.peersLabel}</p><div class="seg" role="group" aria-labelledby="peers-l">${PEER_MODES.map((mode, i) => html`<button type="button" data-peer="${mode}" aria-pressed="${i === 0 ? 'true' : 'false'}">${HOSPITAL_COPY[PEER_WORDS[mode]]}</button>`)}</div>${Object.entries(PEER_WHY).map(([mode, key]) => html`<p class="peers__why" id="peers-no-${mode}" data-why="${mode}" hidden>${HOSPITAL_COPY[key]}</p>`)}</div>`;

// The page. hospitals: hubHospitals; facts: storyFacts of them; states: stateTotals of them; shapes: the atlas's state
// shapes (loadHub); assets: the build's (assets.shell holds the fiscal year and the hub asset's address); robots: the
// page's robots value.
export function homePage({ hospitals, facts, states, shapes, assets, robots }) {
  const { fy, hubUrl } = assets.shell;
  // The last step's search: a family search box (hub/client/search.js mounts it) over the hospitals only, whose pick the
  // story's script takes and follows in place.
  const search = searchForm({ id: 'find', src: hubUrl, label: COPY.findLabel, find: COPY.findWord, findRest: COPY.findRest, placeholder: COPY.findPlaceholder, hero: true, hub: true, only: 'hospital' });
  // The example hospital: the last step's card and the worksheet below the story.
  const example = hospitals.find((x) => x.ccn === EXAMPLE_CCN);
  if (!example?.est) throw new RangeError(`hub home: the example hospital ${EXAMPLE_CCN} has no estimate`);
  const words = stepWords({ hospitals, facts, states, fy, search, card: exampleCard({ h: example, hospitals, fy }) });
  const zero = money(0);
  const railWords = STEPS.map((s) => fill(s.rail, s.slug === 'start' ? { zero } : {}));
  const rail = html`<nav class="railbox" aria-label="${COPY.railLabel}"><ol class="rail">${STEPS.map((s, i) => html`<li><a href="#step-${s.slug}">${railWords[i]}</a></li>`)}</ol></nav>`;
  // Where the rail is hidden, the stage names the step being read ("3/9 Readmissions"); the script shows the current one.
  const now = html`<ol class="nowstep" aria-hidden="true" hidden>${railWords.map((words, i) => html`<li data-now="${i}"><span class="nowstep__n">${count(i + 1)}/${count(STEPS.length)}</span> <b>${words}</b></li>`)}</ol>`;
  const steps = STEPS.map((s, i) => html`<section class="step" id="step-${s.slug}" data-step="${i}"><div class="step__in">
${words[i]}
</div></section>
`);
  const body = html`${hero()}
<div class="story" data-story>
${rail}
${steps}<div class="story__progress" aria-hidden="true"></div>
<div class="stage" data-stage>
${now}
<div class="stage__panel stage__panel--bar"><div class="stage__pin">${barFigure({ hospitals, facts, fy })}</div></div>
<canvas class="stage__cv" aria-hidden="true" hidden></canvas>
<div class="stage__panel stage__panel--map"><div class="stage__pin smapfig">
<p class="readout" aria-live="polite" hidden>${COPY.readout}</p>
${statesMap({ shapes, states })}
<div class="mapfoot">${stateLegend({ states, fy })}${smallStates(states)}</div>
</div></div>
${peerToggle()}
</div>
</div>
<div class="wrap below">
${directory({ programs: SITE.programs, facts, hospitals, fy })}
${methodsBrief({ h: example, fy, src: hubUrl })}
${yourTurn({ feedback: feedbackFor({ path: '/' }) })}
</div>`;
  return hubPage({ title: SITE.name, description: COPY.description, path: '/', robots, body, scripts: [assets.js['hub-home']], assets });
}
