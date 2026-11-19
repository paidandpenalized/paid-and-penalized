// The TEAM Methods page: what the program page is built from (each pinned CMS file, its date and its address), how the
// map's hollow hospitals are chosen, the worked example's numbers, how the calculator's band was set (#band, which the
// calculator's "why?" links), and where the code and the claims register live.
import { BAND_DEFAULT, BAND_MAX, BAND_MIN } from '../../../../engine/js/team/params.js';
import { fractionWord, isoDate, money, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { externalLink, page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { BAND_ANCHOR, CITES, CJR_BAND, EXAMPLE, PY2_START } from '../constants.js';
import { fill, t } from '../copy.js';
import { METHODS_PATH } from '../links.js';
import { shellOf } from './parts.js';

// The TEAM file's own pins (the participant, price and CJR-X lists, the Medicare inpatient years, the quality measures),
// listed first and by name; the shared inputs (the hospital master's, the atlas) are the family Methods' to list.
const OWN = /^(team-|cjrx-)/;
// The date CMS gives a pin: the list's own as-of date, else a release or modified date, else the file's Last-Modified.
const dateOf = (e) => e.asOf ?? e.pdcReleased ?? e.pdcModified ?? e.derivedFrom?.lastModified ?? null;
const urlOf = (e) => e.downloadUrl ?? e.derivedFrom?.downloadUrl ?? null;

// team: data.js loadTeam()'s file; sources: loadSources(team), the manifest's entry for each of the file's pins.
export function methodsPage({ sources, robots, assets }) {
  const own = sources.filter((e) => OWN.test(e.id));
  const item = (e) => {
    const url = urlOf(e);
    const date = dateOf(e);
    return html`<li>${url ? externalLink(url, e.title) : e.title}${date ? html` · ${isoDate(date.slice(0, 10))}` : ''}</li>`;
  };
  const body = html`<article class="wrap page tm tm-methods-page">
<header class="page__head">
<h1>${t('methodsTitle')}</h1>
<p class="dek">${fill('methodsIntro', { cite: CITES.subpart })}</p>
</header>
<section class="tm-msec" aria-labelledby="sources-h">
<h2 id="sources-h">${t('methodsSources')}</h2>
<ul class="tm-sources">${own.map(item)}</ul>
</section>
<p>${fill('methodsMap', { year: PY2_START.slice(0, 4) })}</p>
<p>${fill('methodsExample', { target: money(EXAMPLE.target), spend: pct(-EXAMPLE.spend, 0), cqs: String(EXAMPLE.cqs), track: String(EXAMPLE.track) })} ${t('ledgerFoot')}</p>
<section class="tm-msec" id="${BAND_ANCHOR}" aria-labelledby="band-h">
<h2 id="band-h">${t('methodsBandHeading')}</h2>
<p>${fill('methodsBand', { band: `±${pct(BAND_DEFAULT, 0)}`, lo: pct(BAND_MIN, 0), hi: pct(BAND_MAX, 0), share: fractionWord(CJR_BAND.share, 'about'), within: pct(CJR_BAND.within, 0) })}</p>
</section>
<p>${t('methodsRepo')} ${externalLink(SITE.repo, SITE.repo.replace(/^https:\/\//, ''))}</p>
</article>`;
  return page({
    title: `${t('methodsTitle')} · ${SITE.name}`,
    description: t('methodsDescription'),
    path: METHODS_PATH,
    robots,
    body,
    assets,
    ...shellOf({ current: 'methods' }),
  });
}
