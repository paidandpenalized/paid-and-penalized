"""The pinned state inputs (`inputs/`, listed with their SHA-256 in `inputs/sources.json`), each checked before it is
read."""
import csv
import io
from pathlib import Path

from pp_pipeline import files

INPUTS_DIR = Path(__file__).resolve().parent / "inputs"


class PinError(ValueError):
    """A pinned input that doesn't match its recorded size or SHA-256."""


def sources(root=INPUTS_DIR):
    return files.read_json(Path(root) / "sources.json")["files"]


def entry(pin_id, root=INPUTS_DIR, pins=None):
    """The sources.json entry for `pin_id`; `pins`: the entries already read (sources), else read here."""
    found = [e for e in (sources(root) if pins is None else pins) if e["id"] == pin_id]
    if len(found) != 1:
        raise PinError(f"no single pinned input {pin_id!r}")
    return found[0]


def read_bytes(pin_id, root=INPUTS_DIR, pins=None):
    e = entry(pin_id, root, pins)
    data = (Path(root) / e["path"]).read_bytes()
    if not files.pin_matches(e, data):
        raise PinError(f"{e['path']}: size or SHA-256 differs from sources.json")
    return data


def read_csv(pin_id, root=INPUTS_DIR, pins=None):
    """A pinned CSV's rows as dicts (`pins` as for entry). Header cells are stripped of padding and stray quotes (CMS's
    VIII file quotes one header twice)."""
    text = read_bytes(pin_id, root, pins).decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    header = [h.strip().strip('"').strip() for h in next(reader)]
    return [dict(zip(header, row)) for row in reader if row]


VIII = "cms64-viii-2026-02"
FMR = "cms64-fmr-fy2023-map"
URBAN = "urban-2026-a2-wr"
STATE_MIUR = "hcris-fy2023-state-miur"
