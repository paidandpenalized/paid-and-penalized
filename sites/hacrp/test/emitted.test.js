// The committed HACRP emitted file: contract, provenance, and CMS's values for every hospital.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../../engine/js/csv.js';
import { validate } from '../../../engine/js/schema.js';
import { whatIf } from '../../../engine/js/hacrp/whatif.js';
import { buildModel } from '../../../engine/js/hacrp/model.js';
import { sourceManifestHash } from '../../../pipeline/contract.js';
import { REPO_ROOT, loadSchemas, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, emittedPath } from '../pipeline/build.js';

const rows = parseCsv(readPinned(SOURCES[0]));
const fy = Number(rows[0]['Fiscal Year']);
const emitted = readJson(REPO_ROOT + emittedPath(fy));

test('the emitted file passes its schema', () => {
  const schemas = loadSchemas();
  assert.deepEqual(validate(schemas['hacrp.schema.json'], emitted, { schemas }), []);
});

test('provenance: source_manifest is the hash of the named pins, fy is the file\'s fiscal year', () => {
  const entries = readManifest().filter((e) => emitted.sources.includes(e.id));
  assert.equal(entries.length, emitted.sources.length);
  assert.equal(emitted.source_manifest, sourceManifestHash(entries));
  assert.equal(emitted.fy, fy);
});

test('methods_version has its heading in docs/METHODS-LOG.md', () => {
  const log = readFileSync(REPO_ROOT + 'docs/METHODS-LOG.md', 'utf8');
  assert.match(log, new RegExp(`^## hacrp methods_version ${emitted.methods_version} \\(\\d{4}-\\d{2}-\\d{2}\\)$`, 'm'));
});

test('the emitted file reproduces CMS for every row', () => {
  assert.equal(emitted.hospitals.length, rows.length);
  emitted.hospitals.forEach((h, i) => {
    const row = rows[i];
    assert.equal(h.ccn, row['Facility ID']);
    assert.equal(h.totalText, row['Total HAC Score']);
    assert.equal(h.paymentReduction, row['Payment Reduction']);
    const r = whatIf(h, emitted.model);
    if (h.total === null) return assert.equal(r.available, false);
    assert.equal(r.after.score, h.total, h.ccn);
    assert.equal(r.after.flag, h.paymentReduction, h.ccn);
    assert.equal(String(h.total), String(Number(row['Total HAC Score'])));
  });
});

test('the emitted model is the model of the emitted hospitals', () => {
  assert.deepEqual(buildModel(emitted.hospitals), emitted.model);
});
