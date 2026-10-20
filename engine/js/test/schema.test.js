// The JSON Schema subset validator, and every shared conformance case in schemas/conformance/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { validate } from '../schema.js';
import { SCHEMAS_DIR, loadSchemas, readJson } from '../../../pipeline/files.js';

const schemas = loadSchemas();

const ok = (schema, data, opts) => assert.deepEqual(validate(schema, data, opts), []);
const bad = (schema, data, pattern, opts) => {
  const errors = validate(schema, data, opts);
  assert.ok(errors.length > 0, `expected errors for ${JSON.stringify(data)}`);
  if (pattern) assert.ok(errors.some((e) => pattern.test(e)), errors.join('\n'));
};

test('type: each JSON type, arrays and null are not objects, integer means a whole number', () => {
  ok({ type: 'object' }, {});
  bad({ type: 'object' }, []);
  bad({ type: 'object' }, null);
  ok({ type: 'array' }, []);
  ok({ type: 'string' }, '');
  ok({ type: 'number' }, 1.5);
  ok({ type: 'integer' }, 2);
  bad({ type: 'integer' }, 2.5);
  ok({ type: 'boolean' }, false);
  ok({ type: 'null' }, null);
  for (const v of [NaN, Infinity, -Infinity]) {
    bad({ type: ['number', 'null'] }, v, /non-finite/);
    bad({ type: 'integer' }, v);
  }
  ok({ type: ['number', 'null'] }, null);
  bad({ type: ['number', 'null'] }, '1');
});

test('properties, required and additionalProperties', () => {
  const s = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };
  ok(s, { a: 'x' });
  bad(s, {}, /^: missing required property "a"/);
  bad(s, { a: 'x', b: 1 }, /^: unexpected property "b"/);
  bad(s, { a: 1 }, /^\/a: /);
  ok({ type: 'object', additionalProperties: { type: 'integer' } }, { x: 1, y: 2 });
  ok({ type: 'array', items: false }, []);
  bad({ type: 'array', items: false }, [1], /^\/0: no value/);
  bad({ type: 'object', additionalProperties: { type: 'integer' } }, { x: 1.5 }, /^\/x: /);
});

test('items, minItems, enum, const, pattern, minimum, maximum, minLength', () => {
  ok({ type: 'array', items: { type: 'integer' }, minItems: 1 }, [1, 2]);
  bad({ type: 'array', items: { type: 'integer' } }, [1, 'x'], /^\/1: /);
  bad({ type: 'array', minItems: 1 }, []);
  ok({ enum: ['Yes', 'No'] }, 'No');
  bad({ enum: ['Yes', 'No'] }, 'Maybe');
  ok({ const: 1 }, 1);
  bad({ const: 1 }, 2);
  ok({ type: 'string', pattern: '^a+$' }, 'aaa');
  bad({ type: 'string', pattern: '^a+$' }, 'ab');
  ok({ type: 'number', minimum: 0, maximum: 1 }, 1);
  bad({ type: 'number', minimum: 0 }, -0.1);
  bad({ type: 'number', maximum: 1 }, 1.1);
  bad({ type: 'string', minLength: 1 }, '');
});

test('constraints for one type are skipped for another (a null passes a string pattern when null is allowed)', () => {
  ok({ type: ['string', 'null'], pattern: '^a$', minLength: 1 }, null);
  ok({ type: ['number', 'null'], minimum: 0 }, null);
});

test('$ref: local $defs and another file by $id', () => {
  const local = { $defs: { n: { type: 'integer' } }, type: 'object', properties: { x: { $ref: '#/$defs/n' } } };
  ok(local, { x: 1 });
  bad(local, { x: 'a' }, /^\/x: /);
  const s = { type: 'array', items: { $ref: 'common.schema.json#/$defs/ccn' } };
  ok(s, ['000001'], { schemas });
  bad(s, ['000001', 1], /^\/1: /, { schemas });
  assert.throws(() => validate({ $ref: 'missing.schema.json#/$defs/x' }, 1, { schemas }), RangeError);
  assert.throws(() => validate({ $ref: '#/$defs/nope' }, 1), RangeError);
});

test('error pointers name the failing path', () => {
  const s = { type: 'object', properties: { hospitals: { type: 'array', items: { type: 'object', properties: { ccn: { type: 'string' } } } } } };
  const data = { hospitals: [{ ccn: 'a' }, { ccn: 'b' }, { ccn: 'c' }, { ccn: 4 }] };
  bad(s, data, /^\/hospitals\/3\/ccn: /);
});

test('unsupported keyword throws, so a schema can never look stricter than it is', () => {
  for (const kw of ['format', 'oneOf', 'anyOf', 'allOf', 'not', 'patternProperties', 'if', 'exclusiveMinimum', 'uniqueItems']) {
    assert.throws(() => validate({ type: 'string', [kw]: {} }, 'x'), RangeError, kw);
  }
  // Nested schemas are checked even when the data never reaches them.
  assert.throws(() => validate({ type: 'object', properties: { a: { format: 'date' } } }, {}), RangeError);
  assert.throws(() => validate({ $defs: { a: { oneOf: [] } } }, 1), RangeError);
});

test('every schema file uses only supported keywords and has a matching $id', () => {
  for (const [file, schema] of Object.entries(schemas)) {
    assert.equal(schema.$id, file);
    assert.doesNotThrow(() => validate(schema, null, { schemas }), file);
  }
});

// A case is either { data } or { patch } against the suite's base: a list of { path: JSON Pointer, op, value }
// with op "replace" (the key must exist), "add" (it must not) or "remove" (it must). Anything else throws, so a
// stale case can't pass by accident after the schema changes.
function applyPatch(base, patch) {
  const doc = structuredClone(base);
  for (const op of patch) {
    const keys = op.path.split('/').slice(1).map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~'));
    const last = keys.pop();
    const parent = keys.reduce((node, k) => {
      if (node === null || typeof node !== 'object' || !Object.hasOwn(node, k)) throw new RangeError(`patch path ${op.path} not in base`);
      return node[k];
    }, doc);
    const has = parent !== null && typeof parent === 'object' && Object.hasOwn(parent, last);
    if (op.op === 'add' ? has : !has) throw new RangeError(`patch ${op.op} at ${op.path}: key ${has ? 'exists' : 'missing'}`);
    if (op.op === 'remove') delete parent[last];
    else if (op.op === 'replace' || op.op === 'add') parent[last] = op.value;
    else throw new RangeError(`patch op "${op.op}" unknown`);
  }
  return doc;
}

const conformanceDir = SCHEMAS_DIR + 'conformance/';
for (const file of readdirSync(conformanceDir).filter((f) => f.endsWith('.cases.json'))) {
  const suite = readJson(conformanceDir + file);
  const root = schemas[suite.schema];
  const target = suite.def ? { $ref: `${suite.schema}#/$defs/${suite.def}` } : root;
  for (const c of suite.cases) {
    test(`conformance ${file}: ${c.name} is ${c.valid ? 'valid' : 'invalid'}`, () => {
      assert.ok(root, `no schema ${suite.schema}`);
      const data = c.patch ? applyPatch(suite.base, c.patch) : c.data;
      assert.equal(validate(target, data, { schemas }).length === 0, c.valid);
    });
  }
}

test('applyPatch: sets, removes, and refuses paths the base lacks', () => {
  const base = { a: { b: 1 }, list: [{ x: 1 }] };
  const patched = applyPatch(base, [
    { path: '/a/b', op: 'replace', value: 2 },
    { path: '/a/c', op: 'add', value: 3 },
    { path: '/list/0/x', op: 'remove' },
  ]);
  assert.deepEqual(patched, { a: { b: 2, c: 3 }, list: [{}] });
  assert.deepEqual(base, { a: { b: 1 }, list: [{ x: 1 }] });
  for (const bad of [
    { path: '/missing/b', op: 'replace', value: 1 },
    { path: '/a/typo', op: 'replace', value: 1 },
    { path: '/a/b', op: 'add', value: 1 },
    { path: '/a/missing', op: 'remove' },
    { path: '/a/b', op: 'move' },
  ]) {
    assert.throws(() => applyPatch(base, [bad]), RangeError, JSON.stringify(bad));
  }
});
