// The HACRP page generator: checks acceptance A1 on the emitted data (the build fails if it doesn't hold), then
// emits the program page and one page per hospital through the build context.
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { decimal } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { loadHacrp } from './data.js';
import { programPage, PATH as PROGRAM_PATH } from './pages/program.js';
import { hospitalPage } from './pages/hospital.js';
import { hospitalView } from './view.js';

const dp5 = (x) => (x === null ? 'none' : decimal(x, 5));

export function a1Summary({ ok, a, b, info }) {
  return [
    `A1 ${ok ? 'ok' : 'FAILED'}`,
    `(a) ${a.within} of ${a.n} scored hospitals: mean published z equals the Total HAC Score; max error ${dp5(a.maxError)}`,
    `(b) ${b.n} scored Yes/No hospitals: ${b.mismatches.length} decision mismatches`,
    `info: p75 of all scored totals ${dp5(info.pctAllScored)}; of Yes/No totals ${dp5(info.pctDecided)}`,
  ].join('\n  ');
}

// ctx: the build context (pipeline/site/context.js). released defaults to web/site.js; tests pass it, and may pass
// data from loadHacrp() to read the files once.
export async function generateHacrp(ctx, { released = SITE.sites.hacrp.released, data = loadHacrp(), log = console.log } = {}) {
  const { env, assets } = ctx;
  const { fy, hospitals, model, estimate, footnotes, master, periods, source, boundaryText } = data;
  const a1 = checkA1(hospitals, model);
  log(a1Summary(a1));
  if (!a1.ok) throw new Error(`HACRP acceptance A1 failed; decision mismatches: ${a1.b.mismatches.join(', ') || 'none'}`);

  const views = hospitals.map((hospital) =>
    hospitalView({ hospital, model, estimate, footnotes, master: master.get(hospital.ccn), fy, periods, boundaryText }));

  const programRobots = robotsFor({ env, released });
  ctx.emit({
    path: PROGRAM_PATH,
    robots: programRobots,
    text: programPage({
      fy,
      // Penalty counts use A1(b)'s population (scored, decided Yes/No); the score count, every scored hospital.
      counts: { decided: a1.b.n, yes: a1.b.yes, scored: a1.a.n },
      boundaryText,
      measures: views[0].measures.map(({ id, label, short }) => ({ id, label, short })),
      periods,
      search: views
        .map((v) => [v.ccn.toLowerCase(), v.name, v.city, v.state])
        .sort((x, y) => x[1].localeCompare(y[1], 'en') || x[3].localeCompare(y[3], 'en') || x[2].localeCompare(y[2], 'en')),
      source,
      robots: programRobots,
      assets,
    }),
  });

  for (const view of views) {
    const robots = robotsFor({ env, released, eligible: view.scored });
    ctx.emit({ path: view.path, robots, text: hospitalPage({ view, source, robots, assets }) });
  }
}

// The HACRP site's build manifest (pipeline/site/build.js lists it).
export const HACRP = {
  id: 'hacrp',
  entries: { 'hacrp-program': 'sites/hacrp/client/program.js' },
  styles: ['sites/hacrp/web/styles.css'],
  generate: (ctx) => generateHacrp(ctx),
};
