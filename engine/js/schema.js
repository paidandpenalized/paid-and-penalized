// A small JSON Schema (2020-12) validator for the data contract. It supports only the keywords below and throws
// on any other, so a schema can never look stricter than what is actually checked.

const ANNOTATIONS = new Set(['$schema', '$id', '$defs', 'title', 'description']);
const ASSERTIONS = new Set([
  '$ref', 'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const',
  'pattern', 'minimum', 'maximum', 'minItems', 'minLength',
]);
const MAX_REF_DEPTH = 64;

function checkKeywords(schema, where) {
  if (typeof schema === 'boolean') return;
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new RangeError(`schema ${where}: not a schema object`);
  }
  for (const kw of Object.keys(schema)) {
    if (!ANNOTATIONS.has(kw) && !ASSERTIONS.has(kw)) throw new RangeError(`schema ${where}: unsupported keyword "${kw}"`);
  }
  for (const [name, sub] of Object.entries(schema.$defs ?? {})) checkKeywords(sub, `${where}/$defs/${name}`);
  for (const [name, sub] of Object.entries(schema.properties ?? {})) checkKeywords(sub, `${where}/properties/${name}`);
  if (schema.items !== undefined) checkKeywords(schema.items, `${where}/items`);
  if (schema.additionalProperties !== undefined) checkKeywords(schema.additionalProperties, `${where}/additionalProperties`);
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'non-finite number'; // JSON would write null
  return typeof value; // 'object' | 'string' | 'number' | 'boolean'
}

function hasType(value, type) {
  const t = typeOf(value);
  if (type === 'integer') return t === 'number' && Number.isInteger(value);
  return t === type;
}

function equal(a, b) {
  if (a === b) return true;
  const ta = typeOf(a);
  if (ta !== typeOf(b) || (ta !== 'array' && ta !== 'object')) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
}

const pointer = (path) => path.map((p) => '/' + String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('');

// validate(schema, data, { schemas }) → error messages ("<json-pointer>: <problem>"); empty means valid.
// `schemas` maps each $id to its schema, for $refs into other files ("common.schema.json#/$defs/ccn").
export function validate(schema, data, { schemas = {} } = {}) {
  const checked = new Set();
  const ensureChecked = (doc, where) => {
    if (!checked.has(doc)) {
      checkKeywords(doc, where);
      checked.add(doc);
    }
  };
  ensureChecked(schema, '#');

  function resolve(ref, root) {
    const hash = ref.indexOf('#');
    const file = hash === -1 ? ref : ref.slice(0, hash);
    const frag = hash === -1 ? '' : ref.slice(hash + 1);
    const doc = file === '' ? root : schemas[file];
    if (!doc) throw new RangeError(`schema: $ref to unknown schema "${file}"`);
    ensureChecked(doc, file || '#');
    if (frag === '') return { target: doc, root: doc };
    const m = /^\/\$defs\/([^/]+)$/.exec(frag);
    if (!m || !doc.$defs || !Object.hasOwn(doc.$defs, m[1])) throw new RangeError(`schema: cannot resolve $ref "${ref}"`);
    return { target: doc.$defs[m[1]], root: doc };
  }

  const errors = [];
  function walk(s, value, path, root, depth) {
    if (s === true) return;
    const at = pointer(path);
    if (s === false) return void errors.push(`${at}: no value is allowed here`);
    if (s.$ref !== undefined) {
      if (depth > MAX_REF_DEPTH) throw new RangeError(`schema: $ref chain deeper than ${MAX_REF_DEPTH} at "${s.$ref}"`);
      const { target, root: next } = resolve(s.$ref, root);
      walk(target, value, path, next, depth + 1);
    }
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      if (!types.some((t) => hasType(value, t))) {
        return void errors.push(`${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`);
      }
    }
    if (s.enum !== undefined && !s.enum.some((e) => equal(e, value))) errors.push(`${at}: not one of ${JSON.stringify(s.enum)}`);
    if (s.const !== undefined && !equal(s.const, value)) errors.push(`${at}: must equal ${JSON.stringify(s.const)}`);

    const t = typeOf(value);
    if (t === 'string') {
      if (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(value)) errors.push(`${at}: does not match ${s.pattern}`);
      if (s.minLength !== undefined && [...value].length < s.minLength) errors.push(`${at}: shorter than ${s.minLength}`);
    } else if (t === 'number') {
      if (s.minimum !== undefined && value < s.minimum) errors.push(`${at}: below the minimum ${s.minimum}`);
      if (s.maximum !== undefined && value > s.maximum) errors.push(`${at}: above the maximum ${s.maximum}`);
    } else if (t === 'array') {
      if (s.minItems !== undefined && value.length < s.minItems) errors.push(`${at}: fewer than ${s.minItems} items`);
      if (s.items !== undefined) value.forEach((v, i) => walk(s.items, v, [...path, i], root, depth));
    } else if (t === 'object') {
      for (const key of s.required ?? []) {
        if (!Object.hasOwn(value, key)) errors.push(`${at}: missing required property "${key}"`);
      }
      for (const [key, v] of Object.entries(value)) {
        if (s.properties && Object.hasOwn(s.properties, key)) walk(s.properties[key], v, [...path, key], root, depth);
        else if (s.additionalProperties === false) errors.push(`${at}: unexpected property "${key}"`);
        else if (s.additionalProperties !== undefined) walk(s.additionalProperties, v, [...path, key], root, depth);
      }
    }
  }
  walk(schema, data, [], schema, 0);
  return errors;
}
