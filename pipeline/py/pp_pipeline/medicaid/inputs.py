"""The pinned state inputs (`inputs/`, listed with their SHA-256 in `inputs/sources.json`), each checked before it is
read."""
import csv
import hashlib
import io
import json
from pathlib import Path

INPUTS_DIR = Path(__file__).resolve().parent / "inputs"


class PinError(ValueError):
    """A pinned input that doesn't match its recorded size or SHA-256."""


def sources(root=INPUTS_DIR):
    return json.loads((Path(root) / "sources.json").read_text(encoding="utf-8"))["files"]


def entry(pin_id, root=INPUTS_DIR):
    found = [e for e in sources(root) if e["id"] == pin_id]
    if len(found) != 1:
        raise PinError(f"no single pinned input {pin_id!r}")
    return found[0]


def read_bytes(pin_id, root=INPUTS_DIR):
    e = entry(pin_id, root)
    data = (Path(root) / e["path"]).read_bytes()
    if len(data) != e["bytes"] or hashlib.sha256(data).hexdigest() != e["sha256"]:
        raise PinError(f"{e['path']}: size or SHA-256 differs from sources.json")
    return data


def read_csv(pin_id, root=INPUTS_DIR):
    """A pinned CSV's rows as dicts. Header cells are stripped of padding and stray quotes (CMS's VIII file quotes one
    header twice)."""
    text = read_bytes(pin_id, root).decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    header = [h.strip().strip('"').strip() for h in next(reader)]
    return [dict(zip(header, row)) for row in reader if row]


VIII = "cms64-viii-2026-02"
FMR = "cms64-fmr-fy2023-map"
URBAN = "urban-2026-a2-wr"
