// The work requirement links every hospital with a page across the programs: the hub writes one for every hospital in the
// newest hospital master, so the link list is that master's CCNs, the file's hospitals among them link there, and the rest
// are away with a reason. Fixtures pick by property; no message prints a name, a CCN or a figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, masterPath, newestYear, readJson } from '../../../pipeline/files.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { hospitalPathOf } from '../../../web/site.js';
import { loadAway, loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import { hospChunks } from '../web/program/hospital.js';
import { hospitalRows } from '../web/program/strips.js';

const data = loadMedicaid();
const master = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
const masterCcns = new Set(master.hospitals.map((h) => h.ccn));
const hubCcns = loadHubCcns();

test('loadHubCcns: equals the newest master\'s CCNs', () => {
  assert.equal(hubCcns.size, masterCcns.size, 'same count');
  assert.deepEqual([...hubCcns].sort(), [...masterCcns].sort());
});

test('program page: every hospital row with a hub page links it; none links a CCN without one', () => {
  const rows = hospitalRows(data);
  const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', hubCcns });
  const linked = new Set([...page.matchAll(/href="\/hospital\/(\d{6})\/"/g)].map((m) => m[1]));
  assert.ok(linked.size > 0, 'the page links hospitals');
  assert.ok([...linked].every((ccn) => masterCcns.has(ccn)), 'a page link names a CCN with no hub page');
  assert.ok(![...linked].some((ccn) => !data.hospitals.has(ccn) && !hubCcns.has(ccn)));
  // The strips asset: every file hospital's hub flag is set, since each is in the master.
  const chunks = hospChunks(data, rows, hubCcns);
  const col = (c) => c.cols.indexOf('hub');
  let missing = 0;
  let total = 0;
  for (const c of chunks.values()) for (const r of c.rows) { total += 1; if (r[col(c)] !== 1) missing += 1; }
  assert.ok(total > 0);
  assert.equal(missing, 0, `${missing} file hospitals lack a hub flag`);
  assert.ok(hospitalPathOf('hub', [...hubCcns][0]).startsWith('/hospital/'));
});

test('loadAway: covers the master hospitals the scenario file leaves out, each with a why', () => {
  const away = loadAway(data, hubCcns);
  const expected = [...masterCcns].filter((ccn) => !data.hospitals.has(ccn));
  assert.equal(away.length, expected.length, 'one away row per master hospital the file leaves out');
  assert.deepEqual(away.map((r) => r[0]), [...expected].sort());
  assert.ok(away.every((r) => ['newer', 'inactive', 'kind'].includes(r[4])), 'every row has a known why');
  assert.ok(away.some((r) => r[4] === 'kind'), 'psychiatric, federal and the rest are away as kind');
});
