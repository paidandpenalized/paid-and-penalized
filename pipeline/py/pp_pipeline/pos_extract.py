"""Derive the committed POS extract from CMS's Provider of Services file (hospital & non-hospital facilities).

The raw file is 30 MB, over the repo's 10 MiB limit, so the repo pins a subset: hospital rows (category 01) and the
columns the hospital master reads, sorted by CCN. The manifest entry's `derivedFrom` records the raw file's size,
SHA-256, CMS URL and archive copy; anyone with that file can re-run this and get the same bytes:

    python3 -I pipeline/py/run.py extract-pos <path to Hospital_and_other.DATA.Q2_2026.csv>
"""
import csv
import hashlib
import io
from pathlib import Path

from pp_pipeline.files import PINNED_DIR, manifest_entry

PIN_ID = "pos-q2-2026"
HOSPITAL = "01"  # PRVDR_CTGRY_CD for hospitals (short-term, critical access, psychiatric, children's and others)
COLUMNS = ("PRVDR_NUM", "PRVDR_CTGRY_SBTYP_CD", "FAC_NAME", "ST_ADR", "CITY_NAME", "STATE_CD", "ZIP_CD",
           "CRTFD_BED_CNT", "PGM_TRMNTN_CD", "TRMNTN_EXPRTN_DT")


def extract(raw_text):
    """The extract's text: COLUMNS for every hospital row, cells stripped, sorted by CCN, '\\n' line ends."""
    reader = csv.reader(io.StringIO(raw_text))
    header = [h.strip() for h in next(reader)]
    missing = [c for c in (*COLUMNS, "PRVDR_CTGRY_CD") if c not in header]
    if missing:
        raise ValueError(f"POS file: expected column(s) {', '.join(missing)} not found")
    idx = [header.index(c) for c in COLUMNS]
    cat = header.index("PRVDR_CTGRY_CD")
    rows = {}
    for r in reader:
        if len(r) <= cat or r[cat].strip() != HOSPITAL:
            continue
        row = [r[i].strip() if i < len(r) else "" for i in idx]
        if row[0] in rows:
            raise ValueError(f"POS file: duplicate CCN {row[0]}")
        rows[row[0]] = row
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(COLUMNS)
    w.writerows(rows[k] for k in sorted(rows))
    return out.getvalue()


def main(raw_path):
    data = Path(raw_path).read_bytes()
    entry = manifest_entry(PIN_ID)
    source = entry["derivedFrom"]
    if (len(data), hashlib.sha256(data).hexdigest()) != (source["bytes"], source["sha256"]):
        print(f"{raw_path} is not the raw file the manifest names ({source['file']}, {source['sha256']})")
        return 1
    out = extract(data.decode("latin-1")).encode("utf-8")  # read as latin-1, as Thirty Day Readmissions does
    (PINNED_DIR / entry["path"]).parent.mkdir(parents=True, exist_ok=True)
    (PINNED_DIR / entry["path"]).write_bytes(out)
    print(f"wrote {entry['path']}: {len(out)} bytes, sha256 {hashlib.sha256(out).hexdigest()}")
    return 0
