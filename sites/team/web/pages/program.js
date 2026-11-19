// The TEAM program page: seven numbered Parts, each its words beside its figure (Part 1, who's in, program/who.js; Part 2,
// what changes, change.js; Part 3, how the money works, money.js; Part 4, the bar to beat, bar.js; Part 5, the
// calculator, calc.js; Part 6, what a hospital has to do, duties.js; Part 7, where the numbers are, reports.js), then the
// line on CJR-X and the close. Its scripts: the figures' (assets.js.figure) and its own (client/page.js: Part 1's lookup,
// Part 4's picker, Part 5's calculator).
import { counter } from '../../../../web/charts/figure.js';
import { isoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { PY2_START } from '../constants.js';
import { fill, t } from '../copy.js';
import { PROGRAM_PATH } from '../links.js';
import { barPart } from '../program/bar.js';
import { yoursPart } from '../program/calc.js';
import { changePart } from '../program/change.js';
import { dutiesPart } from '../program/duties.js';
import { moneyPart } from '../program/money.js';
import { cjrxLine, close, reportsPart } from '../program/reports.js';
import { whoPart } from '../program/who.js';
import { partOf, shellOf } from './parts.js';

// team: data.js loadTeam()'s file; master: loadMaster()'s places; atlas: the pinned us-atlas topology; robots: null for an
// indexable page, else the meta robots value; assets: the build's paths; lookupUrl: the lookup's codes file and calcUrl
// the calculator's participants (generate.js); search: the family search's file (the default hospital's name).
export function programPage({ team, master, atlas, robots, assets, lookupUrl, calcUrl, search }) {
  const figureN = counter();
  const partN = counter();
  const body = html`<article class="wrap page tm">
${whoPart({ team, master, atlas, n: partN(), figureN, files: { searchUrl: assets.shell.searchUrl, lookupUrl } })}
${changePart({ n: partN(), figureN })}
${moneyPart({ n: partN(), figureN })}
${barPart({ team, atlas, n: partN(), figureN })}
${yoursPart({ n: partN(), team, search, files: { searchUrl: assets.shell.searchUrl, dataUrl: calcUrl } })}
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
