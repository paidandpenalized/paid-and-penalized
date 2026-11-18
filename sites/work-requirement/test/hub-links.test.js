// The work requirement links every hospital with a page across the programs: the hub writes one for every hospital in the
// newest hospital master, so the link list is that master's CCNs, the file's hospitals among them link there, and the rest
// are away with a reason. Fixtures pick by property; no message prints a name, a CCN or a figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, dollarsPath, masterPath, newestYear, readJson } from '../../../pipeline/files.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { hospitalPathOf } from '../../../web/site.js';
import { SCENARIOS } from '../web/constants.js';
import { loadAway, loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { bothInput } from '../web/program/both.js';
import { awayRows, cardHtml, hospChunks, subjectOf } from '../web/program/hospital.js';
import { hospitalRows } from '../web/program/strips.js';

const data = loadMedicaid();
const master = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
const masterCcns = new Set(master.hospitals.map((h) => h.ccn));
const hubCcns = loadHubCcns();
const MIDDLE = SCENARIOS.indexOf('middle');
const linkedIn = (page) => new Set([...page.matchAll(/href="\/hospital\/([0-9a-z]{6})\/"/g)].map((m) => m[1].toUpperCase()));
const render = (ccns) => programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', hubCcns: ccns });

test('loadHubCcns: equals the newest master\'s CCNs', () => {
  assert.equal(hubCcns.size, masterCcns.size, 'same count');
  assert.deepEqual([...hubCcns].sort(), [...masterCcns].sort());
});

// The hub writes a page for each hospital in its newest dollar file and each master hospital outside it (hub/model.js
// hubHospitals, hub/outside.js outsideHospitals). Read as this site may read the hub's inputs: by path, not by importing hub/.
test('loadHubCcns: the CCNs the hub writes hospital pages for', () => {
  const dollars = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  const pages = new Set([...dollars.hospitals.map((r) => r.ccn), ...masterCcns]);
  assert.ok(dollars.hospitals.every((r) => masterCcns.has(r.ccn)), 'every dollar-file hospital is in the master (else the hub stops)');
  assert.deepEqual([...hubCcns].sort(), [...pages].sort(), 'a link for every hub hospital page, and none for a CCN without one');
});

test('program page: every file hospital links its hub page; a CCN the hub has no page for links nowhere', () => {
  const rows = hospitalRows(data);
  const linked = linkedIn(render(hubCcns));
  assert.ok(linked.size > 0, 'the page links hospitals');
  assert.ok([...linked].every((ccn) => masterCcns.has(ccn)), 'every link names a master hospital');
  // The strips asset: every file hospital's hub flag is set, since each is in the master.
  const flagged = (ccns) => {
    const out = new Map();
    for (const c of hospChunks(data, rows, ccns).values()) for (const r of c.rows) out.set(r[c.cols.indexOf('ccn')], r[c.cols.indexOf('hub')]);
    return out;
  };
  const flags = flagged(hubCcns);
  assert.ok(flags.size > 0);
  assert.ok([...flags.values()].every((f) => f === 1), 'every file hospital has a hub flag');
  // Take away one linked hospital's page, as if the master no longer held it: its link and its flags go, the rest stay.
  const plotted = new Set(bothInput(data, rows, hubCcns).rows.map((r) => r[0]));
  const gone = [...linked].find((ccn) => data.hospitals.has(ccn) && plotted.has(ccn));
  assert.ok(gone, 'the page links a file hospital the penalties step plots');
  const fewer = new Set([...hubCcns].filter((ccn) => ccn !== gone));
  const now = linkedIn(render(fewer));
  assert.ok(!now.has(gone), 'a CCN without a hub page is not linked');
  assert.equal(now.size, linked.size - 1, 'every other link stays');
  assert.equal(flagged(fewer).get(gone), 0, 'nor flagged in the strips asset');
  const both = bothInput(data, rows, fewer);
  const hubCol = both.cols.indexOf('hub');
  assert.ok(both.rows.some((r) => r[0] === gone), 'the penalties step still plots it');
  assert.ok(both.rows.every((r) => (r[0] === gone ? r[hubCol] === 0 : r[hubCol] === 1)), 'nor flagged in the penalties step');
});

test('loadAway: covers the master hospitals the scenario file leaves out, each with a why, and each links its hub page', () => {
  const away = loadAway(data, hubCcns);
  const expected = [...masterCcns].filter((ccn) => !data.hospitals.has(ccn));
  assert.equal(away.length, expected.length, 'one away row per master hospital the file leaves out');
  assert.deepEqual(away.map((r) => r[0]), [...expected].sort());
  assert.ok(away.every((r) => ['newer', 'inactive', 'kind'].includes(r[4])), 'every row has a known why');
  assert.ok(away.some((r) => r[4] === 'kind'), 'psychiatric, federal and the rest are away as kind');
  // An away hospital's record card (step 4, drawn in the browser) links its page across the programs.
  const [row] = awayRows(away.filter((r) => r[4] === 'kind').slice(0, 1));
  const card = String(cardHtml(subjectOf(row, null), { k: MIDDLE, use: 1 }));
  assert.ok(card.includes(`href="${hospitalPathOf('hub', row.ccn)}"`), 'an away hospital\'s card links its hub page');
});
