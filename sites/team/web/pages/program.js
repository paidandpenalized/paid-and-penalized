// The TEAM program page: seven numbered Parts, each its words beside its figure (Part 1, who's in, program/who.js; Part 2,
// what changes, change.js; Part 3, how the money works, money.js; Part 4, the bar to beat, bar.js; Part 5, the
// calculator's mount; Part 6, what a hospital has to do, duties.js; Part 7, where the numbers are, reports.js), then the
// line on CJR-X and the close. Its scripts: the figures' (assets.js.figure) and its own (client/page.js: Part 1's lookup, Part 4's
// picker).
import { CATEGORIES } from '../../../../engine/js/team/params.js';
import { counter } from '../../../../web/charts/figure.js';
import { isoDate, spelled } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { PY2_START } from '../constants.js';
import { fill, t } from '../copy.js';
import { PROGRAM_PATH } from '../links.js';
import { barPart } from '../program/bar.js';
import { changePart } from '../program/change.js';
import { dutiesPart } from '../program/duties.js';
import { moneyPart } from '../program/money.js';
import { cjrxLine, close, reportsPart } from '../program/reports.js';
import { whoPart } from '../program/who.js';
import { partOf, shellOf } from './parts.js';

// Part 5: its words over the calculator's mount (#calc, which the page's top links), the page's width.
const yoursPart = (n) => partOf({
  id: 'yours', n, wide: true, heading: t('yoursHeading'), words: html`<p>${fill('yoursIntro', { n: spelled(CATEGORIES.length) })}</p>`,
  after: html`<section id="calc" class="tm-calc"><p class="tm-calc__nojs">${t('calcNoScript')}</p></section>
`,
});

// team: data.js loadTeam()'s file; master: loadMaster()'s places; atlas: the pinned us-atlas topology; robots: null for an
// indexable page, else the meta robots value; assets: the build's paths; lookupUrl: the lookup's codes file (generate.js).
export function programPage({ team, master, atlas, robots, assets, lookupUrl }) {
  const figureN = counter();
  const partN = counter();
  const body = html`<article class="wrap page tm">
${whoPart({ team, master, atlas, n: partN(), figureN, files: { searchUrl: assets.shell.searchUrl, lookupUrl } })}
${changePart({ n: partN(), figureN })}
${moneyPart({ n: partN(), figureN })}
${barPart({ team, atlas, n: partN(), figureN })}
${yoursPart(partN())}
${dutiesPart({ team, n: partN(), figureN })}
${reportsPart({ n: partN() })}
${cjrxLine(team)}
${close(team)}
</article>`;
  return page({
    title: `${t('title')} · ${SITE.name}`,
    description: fill('description', { date: isoDate(PY2_START) }),
    path: PROGRAM_PATH,
    robots,
    body,
    assets,
    scripts: [assets.js.figure, assets.js['team-page']],
    ...shellOf(),
  });
}
