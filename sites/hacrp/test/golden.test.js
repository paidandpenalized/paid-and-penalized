// Golden snapshot: the committed emitted file must equal a fresh build from the pinned inputs (built_at aside).
// A diff here means code or pins changed the published numbers: re-run `make emit` and log why (METHODS-LOG,
// corrections/, or a new CMS release).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../../../engine/js/csv.js';
import { keepBuiltAt } from '../../../pipeline/contract.js';
import { REPO_ROOT, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, buildHacrp, emittedPath } from '../pipeline/build.js';

const rows = parseCsv(readPinned(SOURCES[0]));
const committed = readJson(REPO_ROOT + emittedPath(Number(rows[0]['Fiscal Year'])));
const rebuild = (builtAt) => JSON.parse(JSON.stringify(buildHacrp({ rows, manifest: readManifest(), builtAt })));

test('golden: a fresh build from the pins equals the committed file', () => {
  assert.deepEqual(rebuild(committed.built_at), committed);
});

test('rebuilding with the same inputs keeps built_at', () => {
  assert.deepEqual(keepBuiltAt(committed, rebuild('2099-01-01T00:00:00Z')), committed);
});
