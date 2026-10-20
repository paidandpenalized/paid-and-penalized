// Golden snapshot: the committed emitted file must equal a fresh build from the pinned inputs (built_at aside).
// A diff here means code or pins changed the published numbers: re-run `make emit` and log why (METHODS-LOG,
// corrections/, or a new CMS release).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../../../engine/js/csv.js';
import { keepBuiltAt } from '../../../pipeline/contract.js';
import { REPO_ROOT, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, buildHacrp, emittedPath, fiscalYear } from '../pipeline/build.js';

test('golden: a fresh build from the pins equals the committed file, keeping its built_at', () => {
  const rows = parseCsv(readPinned(SOURCES[0]));
  const committed = readJson(REPO_ROOT + emittedPath(fiscalYear(rows)));
  const fresh = JSON.parse(JSON.stringify(buildHacrp({ rows, manifest: readManifest(), builtAt: '2099-01-01T00:00:00Z' })));
  assert.deepEqual(keepBuiltAt(committed, fresh), committed);
});
