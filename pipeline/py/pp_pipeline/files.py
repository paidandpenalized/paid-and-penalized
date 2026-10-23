"""Repo file access for the Python pipeline and its tests. pp_engine itself never reads files."""
import functools
import hashlib
import io
import json
import zipfile
from pathlib import Path

from pp_engine.contract import format_emitted, keep_built_at
from pp_engine.parse import SchemaError
from pp_engine.schema import validate

REPO_ROOT = Path(__file__).resolve().parents[3]
PINNED_DIR = REPO_ROOT / "data" / "pinned"
SCHEMAS_DIR = REPO_ROOT / "schemas"
EMITTED_DIR = REPO_ROOT / "data" / "emitted"


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_manifest():
    return read_json(PINNED_DIR / "manifest.json")


def manifest_entry(pin_id, manifest=None):
    for entry in manifest if manifest is not None else read_manifest():
        if entry["id"] == pin_id:
            return entry
    raise KeyError(f'no pinned input "{pin_id}" in the manifest')


@functools.lru_cache(maxsize=None)
def read_pinned_bytes(pin_id):
    """A pinned file's bytes, refused unless its size and SHA-256 match the manifest."""
    entry = manifest_entry(pin_id)
    data = (PINNED_DIR / entry["path"]).read_bytes()
    if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError(f"pinned input {pin_id} does not match its manifest entry")
    return data


def write_derived_pin(entry, data, note="", root=PINNED_DIR):
    """Write a derived extract (`data`, its bytes) to the pinned path its manifest `entry` names, only when its size
    and SHA-256 are the entry's. A mismatch writes nothing, so the committed pin stays as it was, and prints both, so
    re-pinning a changed derivation is: update the entry's `bytes` and `sha256` to the printed ones, then run it again.
    `note` is added to the line that reports a write. `root` is the pinned directory (a test's own). Returns the exit
    code: 0 written, 1 refused."""
    sha = hashlib.sha256(data).hexdigest()
    if (len(data), sha) != (entry["bytes"], entry["sha256"]):
        print(f"derived {len(data)} bytes, sha256 {sha}; the manifest entry {entry['id']} records {entry['bytes']} "
              f"bytes, sha256 {entry['sha256']}: nothing written, {entry['path']} left as it was")
        return 1
    path = Path(root) / entry["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"wrote {entry['path']}: {len(data)} bytes, sha256 {sha}{note}")
    return 0


def read_zip_member(pin_id, member):
    with zipfile.ZipFile(io.BytesIO(read_pinned_bytes(pin_id))) as zf:
        return zf.read(member)


def read_zip_text_cp1252(pin_id, member):
    """A member of a pinned zip as text. CMS writes its text files in Windows-1252; a byte that encoding leaves
    undefined is a SchemaError, not a crash."""
    try:
        return read_zip_member(pin_id, member).decode("cp1252")
    except UnicodeDecodeError as e:
        raise SchemaError(f"{member}: not Windows-1252 text ({e.reason} at byte {e.start})") from None


def load_schemas():
    """Every schemas/*.schema.json, keyed by file name (which is also its $id)."""
    return {p.name: read_json(p) for p in sorted(SCHEMAS_DIR.glob("*.schema.json"))}


def write_emitted(path, fresh, schema_name):
    """Write a fresh build to its emitted file and return what was written: `fresh` with the committed built_at kept
    when nothing else changed (so git stays clean), validated against `schema_name`, in the emitters' layout. A build
    that fails its schema raises and writes nothing."""
    out = keep_built_at(read_json(path) if path.exists() else None, fresh)
    schemas = load_schemas()
    errors = validate(schemas[schema_name], out, schemas)
    if errors:
        raise ValueError(f"{path.name} fails {schema_name}:\n" + "\n".join(errors[:20]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(format_emitted(out), encoding="utf-8")
    return out
