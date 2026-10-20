// Envelope helpers: canonical JSON, the source-manifest hash, built_at stability, the file layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, envelope, formatEmitted, keepBuiltAt, sourceManifestHash } from '../contract.js';
import { SCHEMAS_DIR, readJson } from '../files.js';

test('canonicalJson ignores key order and keeps array order', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [2, 1], c: null } }), canonicalJson({ a: { c: null, d: [2, 1] }, b: 1 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test('sourceManifestHash ignores the order of entries and changes with any field', () => {
  const a = { id: 'a', sha256: '1' };
  const b = { id: 'b', sha256: '2' };
  assert.match(sourceManifestHash([a, b]), /^[0-9a-f]{64}$/);
  assert.equal(sourceManifestHash([a, b]), sourceManifestHash([b, a]));
  assert.notEqual(sourceManifestHash([a, b]), sourceManifestHash([a, { ...b, sha256: '3' }]));
});

test('keepBuiltAt keeps the old timestamp only when nothing else changed', () => {
  const old = { built_at: '2026-10-20T00:00:00Z', fy: 2026, rows: [1] };
  assert.equal(keepBuiltAt(old, { ...old, built_at: '2026-11-01T00:00:00Z' }).built_at, old.built_at);
  assert.equal(keepBuiltAt(old, { ...old, built_at: '2026-11-01T00:00:00Z', rows: [2] }).built_at, '2026-11-01T00:00:00Z');
  assert.equal(keepBuiltAt(null, { ...old, built_at: '2026-11-01T00:00:00Z' }).built_at, '2026-11-01T00:00:00Z');
});

test('formatEmitted: one record per line, and it parses back to the same object', () => {
  const obj = { schema_version: 1, empty: [], model: { a: 0.1 + 0.2 }, hospitals: [{ ccn: '010001', v: null }, { ccn: '010002', v: 1e-7 }] };
  const text = formatEmitted(obj);
  assert.deepEqual(JSON.parse(text), obj);
  assert.ok(text.endsWith('}\n'));
  assert.ok(text.split('\n').includes('{"ccn":"010001","v":null},'));
});

test('known-answer vectors shared with other languages (schemas/conformance/source-manifest.vectors.json)', () => {
  const { cases } = readJson(SCHEMAS_DIR + 'conformance/source-manifest.vectors.json');
  for (const c of cases) {
    const sorted = [...c.entries].sort((a, b) => (a.id < b.id ? -1 : 1));
    assert.equal(canonicalJson(sorted), c.canonical, c.name);
    assert.equal(sourceManifestHash(c.entries), c.sha256, c.name);
  }
});

test('envelope: contract fields in order, hashing only the named pins; an unknown id throws', () => {
  const manifest = [{ id: 'x', sha256: '1' }, { id: 'y', sha256: '2' }];
  const e = envelope({ schemaVersion: 1, methodsVersion: 3, sources: ['y'], manifest, builtAt: '2026-10-20T00:00:00Z', fy: 2026 });
  assert.deepEqual(Object.keys(e), ['schema_version', 'methods_version', 'source_manifest', 'sources', 'built_at', 'fy']);
  assert.equal(e.source_manifest, sourceManifestHash([manifest[1]]));
  assert.throws(() => envelope({ schemaVersion: 1, methodsVersion: 1, sources: ['z'], manifest, builtAt: '', fy: 2026 }), RangeError);
});
