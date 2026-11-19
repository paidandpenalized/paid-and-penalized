// Part 1, who's in: the page's top (the tag, the kicker, the title, the dek, the button to the calculator), the record
// card's four counts, the lookup box (client/lookup.js fills its mount), and beside them Figure 1, the map of the
// hospitals in TEAM (filled) among the other hospitals Medicare's inpatient system pays (hollow, never colored by any
// result: DES-25), with the note for patients under it. Every count is the emitted file's.
import { CATEGORIES, TRACKS } from '../../../../engine/js/team/params.js';
import { STATE_NAMES } from '../../../../engine/js/states.js';
import { figure, imageOf, num } from '../../../../web/charts/figure.js';
import { pointOf, stateShapes, usMap, usPaths, usPoints, US_MAP_CODES } from '../../../../web/charts/geo.js';
import { formField, formTitle } from '../../../../web/render/components.js';
import { count, isoDate, listText, pct, shortIsoDate, spelled } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { CITES, DEFAULT_TRACK, EPISODE_DAYS, MODEL_END, MODEL_START, PY2_START } from '../constants.js';
import { fill, t } from '../copy.js';
import { cite, partOf } from '../pages/parts.js';

// The map's drawn width (the figure column's, about, beside the words on a wide screen; it scales down on a phone), and
// its dots' diameters: a hospital in TEAM, and the ring and hole of a hollow one.
const MAP_WIDTH = 560;
const DOTS = Object.freeze({ 'chart-dots--team': 5, 'chart-dots--other': 4.4, 'chart-dots--hole': 2.4 });
const IN_TEAM = new Set(['in', 'in27']);
const yearOf = (iso) => iso.slice(0, 4);

// The counts the map and its words state, each from the emitted file: the hospitals on CMS's list (listed), in TEAM for
// performance year 2 (in: the codes in and in27), the other hospitals the map draws hollow (other: the file's otherIpps),
// the list's hospitals that left before then (ended) or the master lacks (missing), and each state's two counts
// (byState, by name: [{ code, name, in, other }]). master: data.js loadMaster's places.
export function mapCounts(team, master) {
  const inTeam = Object.entries(team.status).filter(([, [code]]) => IN_TEAM.has(code)).map(([ccn]) => ccn);
  const missing = team.a4.teamMissing.length;
  const listed = team.participants.length + missing;
  const states = new Map();
  const tally = (ccn, key) => {
    const { state } = master.get(ccn);
    if (!states.has(state)) states.set(state, { code: state, name: STATE_NAMES[state] ?? state, in: 0, other: 0 });
    states.get(state)[key] += 1;
  };
  inTeam.forEach((ccn) => tally(ccn, 'in'));
  team.otherIpps.forEach((ccn) => tally(ccn, 'other'));
  return {
    listed, in: inTeam.length, other: team.otherIpps.length, ended: team.participants.length - inTeam.length, missing,
    inTeam, byState: [...states.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// The map: every state plain (no state is shaded by anything), its tooltip the state's two counts, and the hospitals as
// dots over it: the hollow ones first (a ring, then a hole in the land's tone), the ones in TEAM on top.
function teamMap({ team, master, shapes, counts }) {
  const byCode = new Map(counts.byState.map((r) => [r.code, r]));
  const states = Object.fromEntries(US_MAP_CODES.map((code) => {
    const r = byCode.get(code) ?? { in: 0, other: 0 };
    return [code, { empty: true, label: fill('mapTip', { in: count(r.in), other: count(r.other) }) }];
  }));
  const at = (ccn) => pointOf(master.get(ccn));
  const others = team.otherIpps.map(at);
  const points = [
    ...others.map((point) => ({ point, cls: 'chart-dots--other' })),
    ...others.map((point) => ({ point, cls: 'chart-dots--hole' })),
    ...counts.inTeam.map((ccn) => ({ point: at(ccn), cls: 'chart-dots--team' })),
  ];
  return usMap({ id: 'team-map', shapes, states, ramp: [1], width: MAP_WIDTH, bare: true, overlay: usPoints({ shapes, points, sizes: DOTS, width: MAP_WIDTH }) });
}

// The states (and places) holding a hospital the map has no place for (Puerto Rico's, outside Albers USA's frame), by
// name; none: [].
function unplacedPlaces({ team, master, shapes, counts }) {
  const { projection } = usPaths(shapes, MAP_WIDTH);
  const off = new Set();
  for (const ccn of [...counts.inTeam, ...team.otherIpps]) {
    const h = master.get(ccn);
    const p = pointOf(h);
    if (!p || !projection(p)) off.add(STATE_NAMES[h.state] ?? h.state);
  }
  return [...off].sort();
}

function mapFigure({ team, master, atlas, n }) {
  const shapes = stateShapes(atlas);
  const counts = mapCounts(team, master);
  const places = unplacedPlaces({ team, master, shapes, counts });
  const year = yearOf(PY2_START);
  const key = html`<ul class="tm-key" role="list"><li><span class="tm-key__dot tm-key__dot--team" aria-hidden="true"></span>${fill('mapKeyIn', { n: count(counts.in) })}</li><li><span class="tm-key__dot tm-key__dot--other" aria-hidden="true"></span>${fill('mapKeyOther', { n: count(counts.other) })}</li></ul>`;
  const note = html`${fill('mapNote', { listed: count(counts.listed), year, ended: count(counts.ended), missing: count(counts.missing) })}${places.length ? html` ${fill('mapUnplaced', { places: listText(places) })}` : ''}`;
  const chart = html`<div class="tm-map">
${imageOf(teamMap({ team, master, shapes, counts }), t('mapAlt'), null)}
${key}
</div>`;
  return figure({
    n,
    takeaway: fill('mapTakeaway', { n: count(counts.in), year, other: count(counts.other) }),
    chart,
    note,
    source: fill('mapSource', { date: isoDate(team.meta.listAsOf) }),
    csvName: 'team-map',
    table: {
      columns: [{ name: t('mapColState') }, { name: t('mapColIn'), numeric: true }, { name: t('mapColOther'), numeric: true }],
      rows: counts.byState.map((r) => [r.name, num(count(r.in), r.in), num(count(r.other), r.other)]),
    },
  });
}

// The note for patients: TEAM doesn't limit their choice, what the hospital is held to, and the notice they get.
const patientNote = () => html`<aside class="tm-patient" aria-labelledby="patient-h">
<h2 class="tm-patient__h" id="patient-h">${t('patientHeading')}</h2>
<p>${t('patientChoice')}${cite(CITES.choice)} ${fill('patientHeld', { days: String(EPISODE_DAYS) })}${cite(CITES.episode)} ${t('patientNotice')}${cite(CITES.notice)}</p>
</aside>`;

// The record card: CMS's list, the selected areas, the kinds of surgery and Track 3's limit, each a numbered field.
function card(team, counts) {
  const fields = [
    { label: t('cardListed'), value: count(counts.listed), note: fill('cardListedNote', { date: shortIsoDate(team.meta.listAsOf) }) },
    { label: t('cardAreas'), value: count(team.counts.selectedAreas), note: t('cardAreasNote') },
    { label: t('cardKinds'), value: count(CATEGORIES.length), note: fill('cardKindsNote', { days: String(EPISODE_DAYS) }) },
    { label: fill('cardLimit', { track: String(DEFAULT_TRACK) }), value: `±${pct(TRACKS[DEFAULT_TRACK].gain, 0)}`, note: fill('cardLimitNote', { date: shortIsoDate(PY2_START) }) },
  ];
  const py = Number(yearOf(PY2_START)) - Number(yearOf(MODEL_START)) + 1;
  return html`<div class="form tm-card">
${formTitle(t('cardTitle'), fill('cardRight', { n: String(py), year: yearOf(PY2_START) }))}
${fields.map((f, i) => formField({ no: i + 1, label: f.label, value: f.value, note: f.note, size: 'big' }))}
</div>`;
}

// The lookup box: its heading, the mount client/lookup.js fills (it says the search needs JavaScript until then), and
// the list's date.
const lookupBox = (team) => html`<section class="tm-look" aria-labelledby="look-h">
<h2 class="tm-look__h" id="look-h">${t('lookupHeading')}</h2>
<div class="tm-look__mount" data-team-lookup><p class="tm-look__nojs">${t('lookupNoScript')}</p></div>
<p class="tm-look__note">${fill('lookupNote', { date: shortIsoDate(team.meta.listAsOf) })}</p>
</section>`;

// Part 1. n: the Part's number; figureN: the page's figure counter. atlas: the pinned us-atlas topology.
export function whoPart({ team, master, atlas, n, figureN }) {
  const counts = mapCounts(team, master);
  const words = html`<p class="tm-dek">${fill('dek', {
    n: spelled(CATEGORIES.length), days: String(EPISODE_DAYS), date: isoDate(PY2_START), track: String(DEFAULT_TRACK), limit: pct(TRACKS[DEFAULT_TRACK].gain, 0),
  })}</p>
<p><a class="tm-go" href="#calc">${t('toCalc')} <span aria-hidden="true">↓</span></a></p>
${card(team, counts)}
${lookupBox(team)}`;
  const fig = html`<div class="tm-sticky">
${mapFigure({ team, master, atlas, n: figureN() })}
${patientNote()}
</div>`;
  return partOf({
    id: 'who', n, h1: true, heading: t('title'), kicker: fill('kicker', { from: yearOf(MODEL_START), to: yearOf(MODEL_END) }), words, fig,
  });
}
