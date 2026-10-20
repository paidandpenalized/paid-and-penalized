"""The data contract's envelope helpers: the Python twin of pipeline/contract.js (same hashes, same file layout).

JSON text is written the way JavaScript's JSON.stringify writes it, so both languages produce the same bytes and
hashes for the same value: numbers per ECMAScript's Number::toString (12.0 -> 12, 5e-05 -> 0.00005, 1e21 -> 1e+21),
sorted keys in UTF-16 code-unit order. schemas/conformance/canonical-json.vectors.json pins this for both.
"""
import hashlib
import json
import math
from decimal import Decimal


def _js_number(x):
    """A number as JavaScript prints it. Integral values print without a fraction; exponents outside 1e-7..1e21."""
    if isinstance(x, int) and abs(x) < 10**21:
        return str(x)
    x = float(x)
    if not math.isfinite(x):
        raise ValueError("JSON has no NaN or Infinity")
    if x == 0:
        return "0"
    if x < 0:
        return "-" + _js_number(-x)
    digits, exp = Decimal(repr(x)).normalize().as_tuple()[1:]  # repr is the shortest round-trip form, as in JS
    d = "".join(map(str, digits))
    k, n = len(d), exp + len(d)  # x = 0.d * 10**n
    if k <= n <= 21:
        return d + "0" * (n - k)
    if 0 < n <= 21:
        return d[:n] + "." + d[n:]
    if -6 < n <= 0:
        return "0." + "0" * -n + d
    e = n - 1
    return (d if k == 1 else d[0] + "." + d[1:]) + "e" + ("+" if e >= 0 else "-") + str(abs(e))


def _utf16(key):
    return key.encode("utf-16-be")  # JavaScript compares strings by UTF-16 code unit


def compact_json(value, sort_keys=False):
    """JSON with no whitespace and non-ASCII kept as UTF-8, byte for byte as JavaScript's JSON.stringify writes it."""
    if value is None or isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, (int, float)):
        return _js_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(compact_json(v, sort_keys) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=_utf16) if sort_keys else value
        return "{" + ",".join(f"{json.dumps(k, ensure_ascii=False)}:{compact_json(value[k], sort_keys)}" for k in keys) + "}"
    raise TypeError(f"not JSON: {type(value).__name__}")


def canonical_json(value):
    """JSON with object keys sorted at every level; arrays keep their order; non-ASCII kept as UTF-8."""
    return compact_json(value, sort_keys=True)


def source_manifest_hash(entries):
    """SHA-256 over the id and SHA-256 of each pinned input, in id order. Metadata is left out, so fixing it doesn't
    change emitted data."""
    pins = sorted(({"id": e["id"], "sha256": e["sha256"]} for e in entries), key=lambda e: _utf16(e["id"]))
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
    if previous is not None and _without_built_at(previous) == _without_built_at(nxt):
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
