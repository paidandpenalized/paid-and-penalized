// The data contract's envelope helpers, shared by every site's emitter: hashing the pinned inputs a file was
// built from, keeping built_at stable across no-op rebuilds, and a diff-friendly file layout.
import { createHash } from 'node:crypto';

// JSON with object keys sorted at every level; arrays keep their order.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// SHA-256 of the manifest entries a file was built from, independent of their order in the manifest.
export function sourceManifestHash(entries) {
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return createHash('sha256').update(canonicalJson(sorted)).digest('hex');
}

const withoutBuiltAt = (obj) => canonicalJson({ ...obj, built_at: null });

// A rebuild that changes nothing but the clock keeps the committed built_at, so git stays clean.
export function keepBuiltAt(previous, next) {
  if (previous && withoutBuiltAt(previous) === withoutBuiltAt(next)) return { ...next, built_at: previous.built_at };
  return next;
}

// One top-level key per line and one element of each top-level array per line, so a refresh's diff shows
// which records changed.
export function formatEmitted(obj) {
  const lines = Object.entries(obj).map(([key, value]) => {
    const name = JSON.stringify(key);
    if (Array.isArray(value) && value.length > 0) return `${name}: [\n${value.map((v) => JSON.stringify(v)).join(',\n')}\n]`;
    return `${name}: ${JSON.stringify(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}
