"""make refresh's golden diff: what changed between two sets of emitted files (data/emitted/ at the base and in the
working tree), as data and as Markdown for the pull request. Pure: parsed files in, summary out.

A file is added, removed, changed or unchanged; `built_at` alone is no change (`make emit` keeps it when nothing else
moved). For a changed file: which envelope fields moved, and for each other top-level key either "changed" or, for a
list of records, how many were added, removed or changed, keyed by the first of KEYS a record has (else its place), and
how often each field of a changed record moved (e.g. paymentReduction: 14 is fourteen hospitals whose decision moved).
"""
from collections import Counter

ENVELOPE = ("schema_version", "methods_version", "fy", "sources", "source_manifest")
KEYS = ("ccn", "id", "fy", "cy")
SHOWN_FIELDS = 8  # fields listed per list; the rest are counted
SHOWN_KEYS = 5  # added or removed record keys listed per list


def _keyed(records):
    """{key: record}, keyed by the first of KEYS every record has with a distinct value, else by place."""
    if not records:
        return {}
    for k in KEYS:
        if all(isinstance(r, dict) and isinstance(r.get(k), (str, int)) for r in records):
            keys = [r[k] for r in records]
            if len(set(keys)) == len(keys):
                return dict(zip(keys, records))
    return dict(enumerate(records))


def diff_list(before, after):
    """{before, after, added, removed, changed, fields}: record counts, the added and removed keys, how many records in
    both changed, and a Counter of the fields that moved in them (dict records only)."""
    b, a = _keyed(before), _keyed(after)
    both = [k for k in a if k in b and a[k] != b[k]]
    fields = Counter()
    for k in both:
        if isinstance(a[k], dict) and isinstance(b[k], dict):
            fields.update(f for f in {*a[k], *b[k]} if a[k].get(f) != b[k].get(f))
    return {"before": len(before), "after": len(after), "added": [k for k in a if k not in b],
            "removed": [k for k in b if k not in a], "changed": len(both), "fields": fields}


def diff_file(before, after):
    """One emitted file's change: {status, envelope, parts}. before/after: the parsed file, None when absent. envelope:
    the ENVELOPE fields that moved; parts: {key: diff_list(...) for a list, or "changed"} for the other keys."""
    if before is None or after is None:
        return {"status": "added" if before is None else "removed", "envelope": [], "parts": {}}
    envelope = [k for k in ENVELOPE if before.get(k) != after.get(k)]
    parts = {}
    for k in [*after, *(k for k in before if k not in after)]:
        if k in ENVELOPE or k == "built_at" or before.get(k) == after.get(k):
            continue
        both_lists = isinstance(before.get(k), list) and isinstance(after.get(k), list)
        parts[k] = diff_list(before[k], after[k]) if both_lists else "changed"
    return {"status": "changed" if envelope or parts else "unchanged", "envelope": envelope, "parts": parts}


def diff_emitted(before, after):
    """{path: diff_file(...)} over every path in either {path: parsed file} map, in path order."""
    return {p: diff_file(before.get(p), after.get(p)) for p in sorted({*before, *after})}


def moved(diffs):
    """{path: diff} of the files a diff_emitted result says were added, removed or changed."""
    return {p: d for p, d in diffs.items() if d["status"] != "unchanged"}


def _keys_text(keys):
    shown = ", ".join(str(k) for k in keys[:SHOWN_KEYS])
    return shown + (f" and {len(keys) - SHOWN_KEYS} more" if len(keys) > SHOWN_KEYS else "")


def _list_text(name, d):
    bits = [f"{d['changed']:,} changed"] if d["changed"] else []
    if d["added"]:
        bits.append(f"{len(d['added']):,} added ({_keys_text(d['added'])})")
    if d["removed"]:
        bits.append(f"{len(d['removed']):,} removed ({_keys_text(d['removed'])})")
    text = f"{name} {d['before']:,} → {d['after']:,}: {', '.join(bits)}"
    if d["fields"]:
        top = sorted(d["fields"].items(), key=lambda kv: (-kv[1], kv[0]))
        text += "; fields: " + ", ".join(f"{f} {n:,}" for f, n in top[:SHOWN_FIELDS])
        if len(top) > SHOWN_FIELDS:
            text += f" and {len(top) - SHOWN_FIELDS} more"
    return text


def describe(d):
    """One file's change in a line of Markdown."""
    if d["status"] != "changed":
        return {"added": "added (a first emission)", "removed": "removed", "unchanged": "unchanged"}[d["status"]]
    bits = [f"`{k}`" for k in d["envelope"]]
    bits += [_list_text(f"`{k}`", v) if isinstance(v, dict) else f"`{k}` changed" for k, v in d["parts"].items()]
    return "; ".join(bits)


def markdown(diffs):
    """The golden diff for the pull request: a table of the files that changed, and how many did not."""
    changed = moved(diffs)
    same = len(diffs) - len(changed)
    if not changed:
        return f"No emitted file changed: a rebuild from these pins equals the base's data ({same} files)."
    rows = "\n".join(f"| `{p}` | {describe(d)} |" for p, d in changed.items())
    return f"| File | Change |\n|---|---|\n{rows}\n\n{same} other emitted files unchanged."
