// The work-requirement program page: step 1 (the page's top, the finding and Figure 1, web/program/finding.js), step 2
// (how the scenario works and Figure 2, web/program/how.js), step 3 (state by state and Figure 3, web/program/states.js),
// step 4 (one hospital and Figure 4, web/program/hospital.js) and step 5 (exposed on both, Figure 5 and the named table,
// web/program/both.js). The masthead's Find searches this page's hospitals (client/find.js): a pick becomes the page's
// hospital.
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { t } from '../copy.js';
import { PROGRAM_PATH } from '../links.js';
import { bothStep } from '../program/both.js';
import { findingStep } from '../program/finding.js';
import { hospitalStep } from '../program/hospital.js';
import { howStep } from '../program/how.js';
import { statesStep } from '../program/states.js';
import { axisTop, hospitalRows } from '../program/strips.js';
import { asOf, labelOf, searchBox, shellOf } from './parts.js';

const TITLE = t('title');

// robots: null for an indexable page, else the meta robots value; assets: the build's paths; data: loadMedicaid()'s
// result; rows: its hospitals as the strips draw them (hospitalRows(data), which the generator has already); stripsUrl:
// the browser's copy of those rows (web/program/strips.js stripsAsset), which the page's script and the masthead's Find
// read (null: a page without them, as it is without JavaScript); baseUrl: the what-if's copy of the scenario hospitals
// (web/program/model.js baseAsset); hubCcns: the CCNs with a hospital page across the programs (data.js loadHubCcns; none:
// no hospital is linked); statesModel: step 3's model (states.js statesModel, which the generator has already; built here
// when not given); hospChunks: step 4's state assets (hospital.js hospChunks; the same); bothModel: step 5's model
// (both.js bothModel; the same).
export function programPage({ data, rows = hospitalRows(data), robots, assets, stripsUrl = null, baseUrl = null, hubCcns = new Set(), statesModel = undefined, hospChunks = undefined, bothModel = undefined }) {
  const body = html`<article class="wrap page wr">
<div class="wr-scrolly">
${findingStep({ data, rows, top: axisTop(rows, data.params.use_max), label: labelOf('finding'), stripsUrl, baseUrl })}
${howStep({ data, label: labelOf('how') })}
${statesStep({ data, rows, label: labelOf('states'), hubCcns, model: statesModel })}
${hospitalStep({ data, rows, label: labelOf('hospital'), hubCcns, chunks: hospChunks })}
${bothStep({ data, rows, label: labelOf('both'), hubCcns, model: bothModel })}
</div>
${asOf(data)}
</article>`;
  return page({
    title: `${TITLE} · ${SITE.name}`,
    description: t('description'),
    path: PROGRAM_PATH,
    robots,
    body,
    assets,
    scripts: stripsUrl ? [assets.js.figure, assets.js['wr-page']] : [assets.js.figure],
    // R29: the chip names the hospital only, so the family's Medicare net never sits beside this page's Medicaid scenario.
    ...shellOf(),
    chipNet: false,
    search: stripsUrl ? searchBox(stripsUrl) : '',
  });
}
