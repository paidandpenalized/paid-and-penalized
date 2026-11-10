// The work-requirement program page: step 1 (the page's top, the finding and Figure 1, web/program/finding.js), step 2
// (how the scenario works and Figure 2, web/program/how.js), then the other three steps the section menu opens, each an
// anchored section with its heading until its figures are drawn. The
// masthead's Find searches this page's hospitals (client/find.js): a pick becomes the page's hospital.
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { SECTIONS } from '../constants.js';
import { t } from '../copy.js';
import { PROGRAM_PATH } from '../links.js';
import { findingStep } from '../program/finding.js';
import { howStep } from '../program/how.js';
import { axisTop, hospitalRows } from '../program/strips.js';
import { labelOf, searchBox, shellOf } from './parts.js';

const TITLE = t('title');

// A step not drawn yet: its id (the section menu's anchor) and its heading.
const step = (id) => html`<section class="step" id="${id}" aria-labelledby="${id}-h">
<h2 id="${id}-h">${labelOf(id)}</h2>
</section>`;

// robots: null for an indexable page, else the meta robots value; assets: the build's paths; data: loadMedicaid()'s
// result; rows: its hospitals as the strips draw them (hospitalRows(data), which the generator has already); stripsUrl:
// the browser's copy of those rows (web/program/strips.js stripsAsset), which the page's script and the masthead's Find
// read (null: a page without them, as it is without JavaScript); baseUrl: the what-if's copy of the scenario hospitals
// (web/program/model.js baseAsset).
export function programPage({ data, rows = hospitalRows(data), robots, assets, stripsUrl = null, baseUrl = null }) {
  const body = html`<article class="wrap page wr">
<div class="wr-scrolly">
${findingStep({ data, rows, top: axisTop(rows, data.params.use_max), label: labelOf('finding'), stripsUrl, baseUrl })}
${howStep({ data, label: labelOf('how') })}
${SECTIONS.slice(2).map(step)}
</div>
</article>`;
  return page({
    title: `${TITLE} · ${SITE.name}`,
    description: t('description'),
    path: PROGRAM_PATH,
    robots,
    body,
    assets,
    scripts: stripsUrl ? [assets.js.figure, assets.js['wr-page']] : [assets.js.figure],
    ...shellOf(),
    search: stripsUrl ? searchBox(stripsUrl) : '',
  });
}
