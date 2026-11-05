// The Readmissions site's page build: its manifest (pipeline/site/build.js lists it) and the generator that writes the
// program page and one page for each hospital in the file. Before it writes anything it checks that the formula
// (engine/js/hrrp/formula.js) gives CMS's payment adjustment factor for every hospital.
import { contrib } from '../../../engine/js/hrrp/formula.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { html } from '../../../web/render/html.js';
import { page } from '../../../web/render/layout.js';
import { programDek } from '../../../web/programs.js';
import { SITE } from '../../../web/site.js';
import { loadHrrp } from './data.js';
import { HOSPITALS_PATH, PROGRAM_PATH, hospitalPath } from './links.js';

// The first hospital whose factor the formula does not reproduce, or null.
export function firstMismatch(hospitals, meta) {
  return hospitals.find((h) => contrib(h, meta).paf !== h.paf) ?? null;
}

// The shell's fields for a Readmissions page (layout.js page()): the site's stylesheet and its program tab.
const SHELL = { sheets: ['hrrp'], program: 'hrrp' };

function programPage({ assets, robots }) {
  const { title } = SITE.sites.hrrp;
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${title}</h1>
<p class="dek">${programDek('hrrp')}</p>
</header>
</article>`;
  return page({ title: `${title} · ${SITE.name}`, description: programDek('hrrp'), path: PROGRAM_PATH, robots, body, assets, ...SHELL });
}

function hospitalPageOf({ hospital, assets, robots }) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${hospital.name}</h1>
<p class="dek">${hospital.city}, ${hospital.st}</p>
</header>
</article>`;
  return page({
    title: `${hospital.name} · ${SITE.sites.hrrp.title} · ${SITE.name}`,
    description: `${hospital.name}, ${hospital.city}, ${hospital.st}, in the Hospital Readmissions Reduction Program.`,
    path: hospitalPath(hospital.id),
    robots,
    body,
    assets,
    ...SHELL,
  });
}

// ctx: the build's context (pipeline/site/context.js). data: loadHrrp()'s result (tests pass their own); released:
// whether the site's pages may be indexed in a production build; log: where progress lines go. Returns the two dates the
// hub's corrections page lists.
export function generateHrrp(ctx, { data = loadHrrp(), released = SITE.sites.hrrp.released, log = console.log } = {}) {
  const { hospitals, meta } = data;
  const bad = firstMismatch(hospitals, meta);
  if (bad) throw new Error(`HRRP: the formula does not reproduce CMS's payment adjustment factor for ${bad.id} (CMS ${bad.paf}, formula ${contrib(bad, meta).paf})`);
  log(`HRRP: the formula reproduces CMS's factor for all ${hospitals.length} hospitals`);
  const robots = robotsFor({ env: ctx.env, released });
  const { assets } = ctx;
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ assets, robots }) });
  for (const hospital of hospitals) ctx.emit({ path: hospitalPath(hospital.id), robots, text: hospitalPageOf({ hospital, assets, robots }) });
  log(`HRRP: ${hospitals.length + 1} pages under ${HOSPITALS_PATH.slice(0, -'hospital/'.length)}`);
  return { updated: { cmsReleased: data.cmsReleased, changed: data.changedOn } };
}

// The Readmissions site's build manifest. No browser scripts yet.
export const HRRP = {
  id: 'hrrp',
  entries: {},
  styles: [...KIT_STYLES, 'sites/hrrp/web/styles.css'],
  generate: (ctx) => generateHrrp(ctx),
};
