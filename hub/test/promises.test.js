// The hub's pages promise no program, page or date to come (pipeline/test/helpers.js FUTURE_WORDS): a program without a
// page here is "under consideration" and its page "not built yet". The copy files are guarded word by word
// (web/test/house-words.test.js); this reads what the rendered pages show and say, shell included: each placeholder page,
// the front page, a hospital's page (with an estimate, and each variant) and the Readmissions summary pages. Rows are
// picked by property. The data's own words (a hospital's or a place's name, which may hold such a word as a proper name)
// are taken out first. A failure names the page by its kind and the word, never a hospital.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, FUTURE_WORDS, readerWords } from '../../pipeline/test/helpers.js';
import { PLACEHOLDER_PROGRAMS } from '../../web/site.js';
import { comingPage } from '../coming.js';
import { loadHub } from '../data.js';
import { homePage } from '../home/page.js';
import { hospitalPage } from '../hospital/page.js';
import { hrrpHospitalPage, hrrpProgramPage } from '../hrrp/page.js';
import { hubHospitals, stateTotals, storyFacts } from '../model.js';

const HUB = loadHub();
const HOSPITALS = hubHospitals(HUB);
const FACTS = storyFacts(HOSPITALS);
const assets = { ...ASSETS, shell: { ...ASSETS.shell, fy: HUB.fy } };

// The master's names (hospitals, their other names, cities, counties, metro areas) that hold a future word, longest first.
const NAMES = [...new Set([...HUB.master.values()].flatMap((r) => [r.name, r.alias, r.city, r.county, r.cbsaName]))]
  .filter((n) => typeof n === 'string' && FUTURE_WORDS.test(n)).sort((a, b) => b.length - a.length);

const pick = (pred, what) => {
  const h = HOSPITALS.find(pred);
  assert.ok(h, `the data has ${what}`);
  return h;
};
const hospital = (h) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets, robots: 'noindex', master: HUB.master.get(h.ccn) ?? null });

// The page's words, the data's names taken out, hold no future word; a hit names the page's kind and the word only.
function assertNoPromise(page, what) {
  let words = readerWords(page);
  for (const name of NAMES) words = words.split(name).join(' ');
  const m = FUTURE_WORDS.exec(words);
  assert.equal(m?.[0] ?? null, null, `${what}: a word that promises a program, page or date`);
}

test('each placeholder page says "under consideration" or "not built yet" and promises nothing', () => {
  for (const program of PLACEHOLDER_PROGRAMS) assertNoPromise(comingPage({ program, facts: FACTS, assets, robots: 'noindex' }), `placeholder page ${program.id}`);
});

test('the front page, its directory\'s slips and its footer promise nothing', () => {
  assertNoPromise(homePage({ hospitals: HOSPITALS, facts: FACTS, states: stateTotals(HOSPITALS), shapes: HUB.shapes, assets, robots: 'noindex' }), 'front page');
});

test('a hospital\'s page, with an estimate and in each variant, promises nothing (its empty row for another program included)', () => {
  const kinds = [
    [(h) => h.est && h.est.vbpListed, 'a hospital with an estimate'],
    [(h) => h.status === 'maryland', 'a Maryland hospital'],
    [(h) => !h.est && h.status !== 'maryland', 'a hospital without an estimate'],
  ];
  for (const [pred, what] of kinds) assertNoPromise(hospital(pick(pred, what)), what);
  // A hospital whose own name holds such a word as a proper name (when the data has one): its name is data, not a promise.
  const named = HOSPITALS.find((h) => h.est && FUTURE_WORDS.test(h.name));
  if (named) assertNoPromise(hospital(named), 'a hospital whose name holds such a word');
});

test('the Readmissions summary pages, the program\'s and a hospital\'s, promise nothing and call themselves no stand-in', () => {
  assertNoPromise(hrrpProgramPage({ tdr: HUB.tdr, assets, robots: 'noindex' }), 'Readmissions summary page');
  const record = [...HUB.tdr.hospitals.values()][0];
  const h = HOSPITALS.find((x) => x.ccn === record.id) ?? null;
  assertNoPromise(hrrpHospitalPage({ record, tdr: HUB.tdr, master: HUB.master.get(record.id), h, assets, robots: 'noindex' }), 'a hospital\'s Readmissions summary page');
});
