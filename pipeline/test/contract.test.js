// Envelope helpers: canonical JSON, the source-manifest hash, built_at stability, the file layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, formatEmitted, keepBuiltAt, sourceManifestHash } from '../contract.js';

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
