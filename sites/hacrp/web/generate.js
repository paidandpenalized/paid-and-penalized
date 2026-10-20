// The HACRP page generator: checks acceptance A1 on the emitted data (the build fails if it doesn't hold), then
// writes the program page and one page per hospital. Returns the page count and the paths that may be indexed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { SITE } from '../../../web/site.js';
import { CCN, loadHacrp } from './data.js';
import { programPage, PATH as PROGRAM_PATH } from './pages/program.js';
import { hospitalPage } from './pages/hospital.js';
import { boundaryText, hospitalView } from './view.js';

function writePage(outDir, path, text) {
  const dir = join(outDir, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), text);
}

export function a1Summary({ ok, a, b, info }) {
  return [
    `A1 ${ok ? 'ok' : 'FAILED'}`,
    `(a) ${a.within} of ${a.n} scored hospitals: mean published z equals the Total HAC Score; max error ${a.maxError}`,
    `(b) ${b.n} scored Yes/No hospitals: ${b.mismatches.length} decision mismatches`,
    `info: p75 of all scored totals ${info.pctAllScored}; of Yes/No totals ${info.pctDecided}`,
  ].join('\n  ');
}

// released defaults to web/site.js; tests pass it, and may pass data from loadHacrp() to read the files once.
export async function generateHacrp({ outDir, assets, env, released = SITE.sites.hacrp.released, data = loadHacrp(), log = console.log }) {
  const { fy, hospitals, model, estimate, footnotes, master, periods, source } = data;
  const a1 = checkA1(hospitals, model, estimate);
  log(a1Summary(a1));
  if (!a1.ok) throw new Error(`HACRP acceptance A1 failed; decision mismatches: ${a1.b.mismatches.join(', ') || 'none'}`);

  const production = env === 'production';
  const bt = boundaryText(hospitals, model.boundary);
  const indexable = [];
  const views = hospitals.map((hospital) => {
    if (!CCN.test(hospital.ccn)) throw new RangeError(`HACRP: bad CCN "${hospital.ccn}"`);
    return hospitalView({ hospital, model, estimate, footnotes, master: master.get(hospital.ccn), fy, periods, released, boundaryText: bt });
  });

  for (const view of views) {
    const robots = production && view.indexable ? null : 'noindex';
    writePage(outDir, view.path, hospitalPage({ view, source, robots, assets }));
    if (!robots) indexable.push(view.path);
  }

  const decided = hospitals.filter((h) => h.paymentReduction === 'Yes' || h.paymentReduction === 'No');
  const programRobots = production && released === true ? null : 'noindex';
  writePage(outDir, PROGRAM_PATH, programPage({
    fy,
    counts: {
      decided: decided.length,
      yes: decided.filter((h) => h.paymentReduction === 'Yes').length,
      scored: hospitals.filter((h) => h.total !== null).length,
    },
    boundaryText: bt,
    measures: views[0].measures.map(({ id, label, short }) => ({ id, label, short })),
    periods,
    search: views
      .map((v) => [v.ccn.toLowerCase(), v.name, v.city, v.state])
      .sort((x, y) => x[1].localeCompare(y[1], 'en') || x[3].localeCompare(y[3], 'en') || x[2].localeCompare(y[2], 'en')),
    source,
    robots: programRobots,
    assets,
  }));
  if (!programRobots) indexable.unshift(PROGRAM_PATH);

  return { pages: views.length + 1, indexable };
}
