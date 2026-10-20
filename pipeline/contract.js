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

// SHA-256 over the id and SHA-256 of each pinned input a file was built from, in id order. Metadata (dates,
// titles, URLs) is left out, so fixing it doesn't change emitted data.
export function sourceManifestHash(entries) {
  const pins = entries.map(({ id, sha256 }) => ({ id, sha256 })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return createHash('sha256').update(canonicalJson(pins)).digest('hex');
}

// The data-contract envelope every emitted file starts with. source_manifest hashes the manifest entries named
// in sources, so re-pinning any of them changes the file.
export function envelope({ schemaVersion, methodsVersion, sources, manifest, builtAt, fy }) {
  const entries = sources.map((id) => {
    const entry = manifest.find((e) => e.id === id);
    if (!entry) throw new RangeError(`no manifest entry "${id}"`);
    return entry;
  });
  return {
    schema_version: schemaVersion,
    methods_version: methodsVersion,
    source_manifest: sourceManifestHash(entries),
    sources,
    built_at: builtAt,
    fy,
  };
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
