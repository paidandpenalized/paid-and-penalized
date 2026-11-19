// The TEAM section on a participant's page across the programs (hub/hospital/page.js and outside.js, after the Medicaid
// band): the Medicaid band's twin, in its classes and rhythm. TEAM is a payment model, never a penalty, and this is a
// scenario of its reconciliation, not a payment, so it sits apart from the Medicare net, under the same dashed rule, and is
// never added to it (nor to the family's estimates, nor to the "Not in Medicare's penalty programs" stamp). Server-drawn,
// no script; the hospital's numbers are inlined in its own page, so the build writes no file per hospital.
//
// For a participant on CMS's TEAM list (one row of the TEAM file's participants, which holds only the list CCNs the
// hospital master has; any other hospital gets ''):
//   left   the kicker, the heading, the status line ("In TEAM since {start} · mandatory · {area} area", "from" for a
//          participant starting in performance year 2), the track it would be in, the calculator's Track 2 note when the
//          hospital list marks it for Track 2, the note keeping it out of the net and the list's date;
//   right  what its reconciliation would come to a year if its spending landed within the default band of target, on
//          Track 3: the label with the scenario tag, the range, its episodes and target amount (standardized dollars),
//          the range on its track's limits (web/charts/limitRuler.js, F1), the hatched walls' note, where the numbers come
//          from, and the link into the calculator (/team/?h=<ccn>#calc).
// A participant with no public episodes (a $0 target): the status and a sentence sending the reader to the calculator
// with the link, no range or ruler. One that left before performance year 2: the stamp and its end date, no dollars.
//
// The numbers are the calculator's opening ones for the hospital, to the cent, from the family's TEAM modules the
// calculator reads too: its row as the calculator reads it (web/team/calc-data.js calcRow then hospOf) and its opening
// view (web/team/opening.js openingOf: the opening state, the engine's input, bandOf at the state's band and reconcile's
// limits). The Track 2 note is the calculator's own sentence (web/team/copy.js flagsNote). The hub imports no site's code.
import { PY2_START, TRACKS } from '../../engine/js/team/params.js';
import { drawn, imagePair } from '../../web/charts/figure.js';
import { limitRuler } from '../../web/charts/limitRuler.js';
import { fillCopy, stamp } from '../../web/render/components.js';
import { count, isoMonth, money, pct, shortIsoDate } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { SITE } from '../../web/site.js';
import { calcMeta, calcRow, hospOf } from '../../web/team/calc-data.js';
import { flagsNote } from '../../web/team/copy.js';
import { openingOf } from '../../web/team/opening.js';
import { arrow } from '../parts.js';
import { COPY } from './copy.js';

const fill = (key, values) => fillCopy(COPY, key, values);
const signed = (x) => money(x, { sign: true });

// The calculator's opening view of a participant (openingOf's numbers) with its hospital as the calculator reads it and
// the year its episodes come from. team: loadHub().team.
export function teamScenario(p, team) {
  const hosp = hospOf(calcRow(p));
  return { hosp, ...openingOf(hosp), dataYear: calcMeta(team).dataYear };
}
// Track 2's number, as the calculator's note names it (the tracks' second).
const TRACK2 = Object.keys(TRACKS)[1];

// The range on its track's limits, drawn twice as a figure's two variants are (figure.js drawn: the kit's phone width, and
// the wide one shown from 560px, charts-map.css .chart[data-fit]; aria-hidden: the words around it give every number),
// each with its own hatch.
function ruler({ band, r, track, width }) {
  const n = String(track);
  const bandText = `±${pct(width, 0)}`;
  const words = {
    money: signed,
    stopGain: (v) => fill('tmStopGain', { amount: signed(v) }),
    stopLoss: (v) => fill('tmStopLoss', { amount: money(-v) }),
    noLoss: fill('tmNoLoss'),
    tip: (lo, hi) => fill('tmTip', { lo: signed(lo), hi: signed(hi), band: bandText }),
    wallTip: (side, v) => fill(side === 'gain' ? 'tmWallGain' : 'tmWallLoss', { n, amount: signed(v) }),
  };
  const pair = drawn((w) => limitRuler({ id: `hh-tm-${w}`, low: band.low, high: band.high, limits: r.limits, words, width: w }));
  return html`<div class="hh__tmr">${imagePair(pair, null)}</div>`;
}

const calcLink = (ccn) => html`<a class="hh__deep" href="${SITE.sites.team.path}?h=${ccn}#calc">${fill('tmLink')}${arrow}</a>`;

/**
 * The section for a hospital (h: the hub's, or an outside one; only its ccn is read), or '' when CMS's TEAM list (as the
 * TEAM file has it) does not name it, so the page is then exactly as it was without the section.
 * @param {{ccn: string}} h
 * @param {{meta: object, categoryAvgDerived: string[], participants: Map<string, object>}|null} team loadHub().team (null:
 *   no section on any page, for a caller with no TEAM file)
 * @param {{net: boolean}} opts whether the page shows a Medicare net above (the note says the section is never part of it)
 */
export function teamBand(h, team, { net }) {
  const p = team?.participants.get(h.ccn);
  if (!p) return '';
  const asOf = fill('tmAsOf', { date: shortIsoDate(team.meta.listAsOf) });
  const head = (kicker, lines) => html`<div class="hh__wbh">
<p class="cap kicker">${fill(kicker)}</p>
<h2 id="hh-tm-h">${fill('tmHeading')}</h2>
${lines}
</div>`;
  const section = (left, right) => html`<section class="hh__wb hh__wb--team" aria-labelledby="hh-tm-h" data-team>
<div class="wrap"><div class="hh__wbi">
${left}
<div class="hh__wbb">
${right}
</div>
</div></div>
</section>
`;

  // One that left before performance year 2: the stamp and its end date, no dollars and no calculator (it has none).
  if (!p.active) {
    return section(head('tmKickerEnded', html`<p class="hh__wbnote">${asOf}</p>`),
      html`<div class="hh__wbr">${stamp({ label: fill('tmEndedStamp'), ink: true })}<p class="hh__why">${fill('tmEnded', { date: shortIsoDate(p.end) })}</p></div>`);
  }

  const s = teamScenario(p, team);
  const status = fill(p.start < PY2_START ? 'tmSince' : 'tmFrom', {
    date: shortIsoDate(p.start), kind: fill(p.participation === 'voluntary' ? 'tmVoluntary' : 'tmMandatory'), area: p.cbsaName,
  });
  const track = fill('tmTrack', { date: shortIsoDate(PY2_START), n: String(s.track) });
  const flags = s.hosp.flags.length ? html` ${flagsNote(s.hosp.flags, TRACK2)}` : '';
  const left = head('tmKicker', html`<p class="hh__wbnote">${status}. ${track}${flags}</p>
<p class="hh__wbnote">${fill(net ? 'tmNote' : 'tmNoteAlone')} ${asOf}</p>`);

  // No public episodes: nothing to draw; the calculator takes the hospital's own counts.
  if (s.r.target === 0) return section(left, html`<p class="hh__why">${fill('tmNone')}</p>\n${calcLink(p.ccn)}`);

  const n = String(s.track);
  const right = html`<p class="hh__wblab">${fill('tmLabel', { year: isoMonth(PY2_START).year, band: `±${pct(s.width, 0)}` })} <span class="scen-tag">${fill('tmTag')}</span></p>
<p class="hh__wbv">${fill('tmRange', { lo: signed(s.band.low), hi: signed(s.band.high) })}</p>
<p class="hh__wbd">${fill('tmDollars', { n, episodes: count(s.episodes), target: money(s.r.target) })}</p>
${ruler(s)}
<p class="hh__wbscale">${fill('tmHatched', { n, loss: money(-s.r.limits.loss), gain: signed(s.r.limits.gain) })}</p>
<p class="hh__why">${fill('tmHow', { year: String(s.dataYear), py: isoMonth(PY2_START).year })}</p>
${calcLink(p.ccn)}`;
  return section(left, right);
}
