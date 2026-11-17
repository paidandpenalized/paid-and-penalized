"""The pinned state inputs (`data/pinned/medicaid/`, listed with their SHA-256 in the pinned manifest), read by manifest
id through `pp_pipeline.files`, which refuses a file whose size or SHA-256 differs from its entry."""
import csv
import io

from pp_pipeline import files

read_bytes = files.read_pinned_bytes


def parse_csv(data):
    """CSV bytes as rows of dicts. Header cells are stripped of padding and stray quotes (CMS's VIII file quotes one
    header twice)."""
    reader = csv.reader(io.StringIO(data.decode("utf-8-sig")))
    header = [h.strip().strip('"').strip() for h in next(reader)]
    return [dict(zip(header, row)) for row in reader if row]


def read_csv(pin_id):
    """A pinned CSV's rows as dicts."""
    return parse_csv(read_bytes(pin_id))


VIII = "cms64-viii-2026-02"
FMR = "cms64-fmr-fy2023-map"
URBAN = "urban-2026-a2-wr"
STATE_MIUR = "hcris-fy2023-state-miur"
