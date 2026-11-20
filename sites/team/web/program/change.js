// Part 2, what changes on the first day of performance year 2: the first year's tracks, the second year's (Track 3 unless a
// hospital asks for another and qualifies), the Track 3 stamp with the limit's base beside it, and Figure 2, every track's
// limits (web/charts/trackLimits.js, from the engine's TRACKS).
import { figure, drawn } from '../../../../web/charts/figure.js';
import { trackLimits, trackRows } from '../../../../web/charts/trackLimits.js';
import { stamp } from '../../../../web/render/components.js';
import { isoDate, pct, shortIsoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { CITES, DEFAULT_TRACK, MODEL_START, PY2_START, TRACK1_LAST, TRACKS, yearOf } from '../constants.js';
import { fill, t } from '../copy.js';
import { cited, partOf } from '../pages/parts.js';

// The tracks by their names' numbers: the first two of TRACKS (Track 1, Track 2) and the default one (Track 3).
const [T1, T2] = Object.keys(TRACKS);
export const TRACK_NUMBERS = Object.freeze({ ta: T1, tb: T2, tc: String(DEFAULT_TRACK) });
const SUBS = Object.freeze(Object.fromEntries(Object.keys(TRACKS).map((k) => [k, t(`trackSub${k}`)])));
const pctOf = (x) => pct(x, 0);

function tracksFigure(n) {
  const words = {
    name: (k) => fill('trackName', { n: k }),
    sub: SUBS,
    gain: (x) => `+${pctOf(x)}`,
    loss: (x) => `−${pctOf(x)}`,
    none: t('trackNone'),
    tip: (k, side, x) => fill(side === 'gain' ? 'trackTipGain' : 'trackTipLoss', { n: k, pct: pctOf(x) }),
    axis: pctOf,
  };
  return figure({
    n,
    takeaway: fill('tracksTakeaway', { year: yearOf(PY2_START) }),
    ...drawn((width) => trackLimits({ tracks: TRACKS, words, width })),
    source: fill('tracksSource', { cite: CITES.limitsAll }),
    alt: t('tracksAlt'),
    csvName: 'team-tracks',
    table: {
      columns: [{ name: t('tracksColTrack') }, { name: t('tracksColWho') }, { name: t('tracksColGain'), numeric: true }, { name: t('tracksColLoss'), numeric: true }],
      rows: trackRows(TRACKS, { name: words.name, sub: SUBS, pct: pctOf, none: t('trackNone') }),
    },
  });
}

// Part 2. n: the Part's number; figureN: the page's figure counter.
export function changePart({ n, figureN }) {
  const limit = `±${pctOf(TRACKS[DEFAULT_TRACK].gain)}`;
  const words = html`${cited(fill('changeYearOne', { year: yearOf(MODEL_START), ta: TRACK_NUMBERS.ta, tc: TRACK_NUMBERS.tc }), CITES.track1)}
${cited(fill('changeYearTwo', { date: isoDate(PY2_START), ...TRACK_NUMBERS, last: yearOf(TRACK1_LAST) }), CITES.tracks)}
<div class="tm-hook">
${stamp({ label: html`${fill('changeStamp', { track: TRACK_NUMBERS.tc })}<span class="tm-stamp__sub">${fill('changeStampSub', { limit, date: shortIsoDate(PY2_START) })}</span>` })}
${cited(t('changeShare'), CITES.limits)}
</div>`;
  return partOf({ id: 'change', n, heading: t('changeHeading'), words, fig: tracksFigure(figureN()) });
}
