"""The data contract's envelope helpers: the Python twin of pipeline/contract.js (same hashes, same file layout)."""
import hashlib
import json


def compact_json(value, **kw):
    """JSON with no whitespace and non-ASCII kept as UTF-8, as JavaScript's JSON.stringify writes it."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False, **kw)


def canonical_json(value):
    """JSON with object keys sorted at every level; arrays keep their order; non-ASCII kept as UTF-8."""
    return compact_json(value, sort_keys=True)


def source_manifest_hash(entries):
    """SHA-256 over the id and SHA-256 of each pinned input, in id order. Metadata is left out, so fixing it doesn't
    change emitted data."""
    pins = sorted(({"id": e["id"], "sha256": e["sha256"]} for e in entries), key=lambda e: e["id"])
    return hashlib.sha256(canonical_json(pins).encode("utf-8")).hexdigest()


def envelope(schema_version, methods_version, sources, manifest, built_at, fy):
    """The envelope every emitted file starts with; source_manifest hashes the manifest entries named in sources."""
    by_id = {e["id"]: e for e in manifest}
    missing = [s for s in sources if s not in by_id]
    if missing:
        raise KeyError(f'no manifest entry "{missing[0]}"')
    return {
        "schema_version": schema_version,
        "methods_version": methods_version,
        "source_manifest": source_manifest_hash([by_id[s] for s in sources]),
        "sources": list(sources),
        "built_at": built_at,
        "fy": fy,
    }


def _without_built_at(obj):
    return canonical_json({**obj, "built_at": None})


def keep_built_at(previous, nxt):
    """A rebuild that changes nothing but the clock keeps the committed built_at, so git stays clean."""
    if previous and _without_built_at(previous) == _without_built_at(nxt):
        return {**nxt, "built_at": previous["built_at"]}
    return nxt


def format_emitted(obj):
    """One top-level key per line and one element of each top-level array per line (formatEmitted's layout)."""
    lines = []
    for key, value in obj.items():
        name = compact_json(key)
        if isinstance(value, list) and value:
            lines.append(f"{name}: [\n" + ",\n".join(compact_json(v) for v in value) + "\n]")
        else:
            lines.append(f"{name}: {compact_json(value)}")
    return "{\n" + ",\n".join(lines) + "\n}\n"
