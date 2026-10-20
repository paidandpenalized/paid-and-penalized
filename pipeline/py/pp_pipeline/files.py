"""Repo file access for the Python pipeline and its tests. pp_engine itself never reads files."""
import functools
import hashlib
import io
import json
import zipfile
from pathlib import Path

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


def read_zip_member(pin_id, member):
    with zipfile.ZipFile(io.BytesIO(read_pinned_bytes(pin_id))) as zf:
        return zf.read(member)


def load_schemas():
    """Every schemas/*.schema.json, keyed by file name (which is also its $id)."""
    return {p.name: read_json(p) for p in sorted(SCHEMAS_DIR.glob("*.schema.json"))}
