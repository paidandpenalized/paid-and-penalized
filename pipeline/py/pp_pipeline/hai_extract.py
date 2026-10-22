"""Derive the committed HAI extracts from Care Compare's "Healthcare Associated Infections - Hospital" file.

One calendar year of the six hospital-onset infection measures (HAI_1 CLABSI, HAI_2 CAUTI, HAI_3 SSI colon, HAI_4 SSI
abdominal hysterectomy, HAI_5 MRSA bacteremia, HAI_6 C. difficile), one row per CCN: the standardized infection ratio
(SIR), the observed count and the predicted count, each exactly as CMS wrote the Score cell ("Not Available" stays
that text). The raw member is 38 to 48 MB, over the repo's 10 MiB limit, so the repo pins this subset. The manifest
entry's `derivedFrom` records the zip's size, SHA-256, member name and CMS URL; anyone with that zip can re-run this
and get the same bytes:

    python3 -I pipeline/py/run.py extract-hai <path to the zip> <pin id, e.g. hai-cy2024>

CMS changed the file between years, and `extract` accepts exactly the variants seen so far: the CCN column is
"Provider ID" (2017) or "Facility ID"; the dates are "Measure Start Date"/"Measure End Date" (2017) or "Start
Date"/"End Date"; the measure IDs are "HAI-1-SIR" (2017) or "HAI_1_SIR". Anything else fails loudly.
"""
import csv
import datetime
import hashlib
import io
import re
import zipfile
from pathlib import Path

from pp_pipeline.files import PINNED_DIR, manifest_entry

PIN_ID_PATTERN = re.compile(r"hai-cy(\d{4})")
MEASURES = ((1, "CLABSI"), (2, "CAUTI"), (3, "SSI colon"), (4, "SSI hysterectomy"), (5, "MRSA"), (6, "CDI"))
# CMS measure-ID suffix -> output field. Observed cases are the NUMERATOR rows, predicted cases the ELIGCASES rows.
FIELDS = (("SIR", "sir"), ("NUMERATOR", "observed"), ("ELIGCASES", "predicted"))
COLUMNS = ("ccn", "start", "end",
           *(f"hai_{n}_{field}" for n, _ in MEASURES for _, field in FIELDS))
NOT_AVAILABLE = "Not Available"

# Header name (lower-cased, spaces collapsed) variants by role. Exactly one of each role must be present.
HEADER_VARIANTS = {
    "ccn": ("facility id", "provider id"),
    "measure": ("measure id",),
    "score": ("score",),
    "start": ("start date", "measure start date"),
    "end": ("end date", "measure end date"),
}
# Measure ID, upper-cased with "-" read as "_" -> (measure number, field). Rows with other known IDs (confidence
# limits, device days / procedures / patient days) are checked for duplicates and dropped; unknown IDs raise.
USED_IDS = {f"HAI_{n}_{kind}": (n, field) for n, _ in MEASURES for kind, field in FIELDS}
DROPPED_IDS = {f"HAI_{n}_{suffix}" for n, _ in MEASURES
               for suffix in ("CILOWER", "CIUPPER", "DOPC", "CI_LOWER", "CI_UPPER", "DOPC_DAYS")}
CCN = re.compile(r"[0-9A-Z]{6}")
NUMBER = re.compile(r"[0-9]+(\.[0-9]+)?")
# (pattern, positions of year, month, day in its groups): CMS's MM/DD/YYYY, and ISO in case CMS switches
DATE_FORMS = ((re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})"), (2, 0, 1)),
              (re.compile(r"(\d{4})-(\d{2})-(\d{2})"), (0, 1, 2)))


def decode(data):
    """(text, encoding name) for the raw bytes: ASCII, UTF-8 (with or without a BOM), else Windows-1252.

    Windows-1252 is what CMS has used for other files; its five unassigned bytes raise rather than guess.
    """
    if data.isascii():
        return data.decode("ascii"), "ascii"
    try:
        return data.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        return data.decode("cp1252"), "cp1252"


def _parse_date(text, what):
    for pattern, (y, m, d) in DATE_FORMS:
        found = pattern.fullmatch(text.strip())
        if found:
            parts = found.groups()
            try:
                return datetime.date(int(parts[y]), int(parts[m]), int(parts[d]))
            except ValueError:
                break
    raise ValueError(f"HAI file: {what} {text!r} is not a MM/DD/YYYY or YYYY-MM-DD date")


def _column_indexes(header):
    names = [re.sub(r"\s+", " ", h.strip()).lower() for h in header]
    found = {}
    for role, variants in HEADER_VARIANTS.items():
        hits = [i for i, name in enumerate(names) if name in variants]
        if not hits:
            raise ValueError(f"HAI file: no {role} column (expected one of {', '.join(variants)}); header is {header}")
        if len(hits) > 1:
            raise ValueError(f"HAI file: more than one {role} column in the header: {header}")
        found[role] = hits[0]
    return found


def extract(raw_text, year=None):
    """The extract's text: COLUMNS for every CCN in the file, sorted by CCN, '\\n' line ends.

    Dates are written as YYYY-MM-DD; scores are CMS's text, untouched; a measure the CCN has no row for is ''.
    With `year`, the file's measure period must be January 1 through December 31 of that year.
    """
    reader = csv.reader(io.StringIO(raw_text))
    try:
        header = next(reader)
    except StopIteration:
        raise ValueError("HAI file: empty") from None
    col = _column_indexes(header)
    seen = set()  # (CCN, canonical measure ID) of every row, so a repeated row is caught whatever its measure
    periods = set()
    rows = {}
    for line, r in enumerate(reader, start=2):
        if not r:
            continue  # a blank line
        if len(r) != len(header):
            raise ValueError(f"HAI file: line {line} has {len(r)} cells, the header has {len(header)}")
        ccn = r[col["ccn"]].strip()
        if not CCN.fullmatch(ccn):
            raise ValueError(f"HAI file: line {line} has a malformed CCN {ccn!r}")
        measure = r[col["measure"]].strip().upper().replace("-", "_")
        if measure not in USED_IDS and measure not in DROPPED_IDS:
            raise ValueError(f"HAI file: line {line} has an unexpected measure ID {r[col['measure']]!r}")
        if (ccn, measure) in seen:
            raise ValueError(f"HAI file: CCN {ccn} has more than one {measure} row")
        seen.add((ccn, measure))
        periods.add((_parse_date(r[col["start"]], f"line {line} start date"),
                     _parse_date(r[col["end"]], f"line {line} end date")))
        if measure in DROPPED_IDS:
            continue
        score = r[col["score"]]
        if score != NOT_AVAILABLE and not NUMBER.fullmatch(score):
            raise ValueError(f"HAI file: line {line} ({ccn}, {measure}) has the unexpected score {score!r}")
        n, field = USED_IDS[measure]
        rows.setdefault(ccn, {})[f"hai_{n}_{field}"] = score
    if not periods:
        raise ValueError("HAI file: no data rows")
    if len(periods) > 1:
        raise ValueError(f"HAI file: more than one measure period: {sorted(periods)}")
    (start, end), = periods
    if year is not None and (start, end) != (datetime.date(year, 1, 1), datetime.date(year, 12, 31)):
        raise ValueError(f"HAI file: measure period {start} to {end}, not calendar year {year}")
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(COLUMNS)
    for ccn in sorted(rows):
        cells = rows[ccn]
        w.writerow([ccn, start.isoformat(), end.isoformat(), *(cells.get(c, "") for c in COLUMNS[3:])])
    return out.getvalue()


def derive(zip_bytes, source, year):
    """(extract bytes, raw encoding) from a zip's bytes and the manifest's derivedFrom record; checks the zip first."""
    if (len(zip_bytes), hashlib.sha256(zip_bytes).hexdigest()) != (source["bytes"], source["sha256"]):
        raise ValueError(f"not the zip the manifest names ({source['file']}, {source['sha256']})")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        raw = zf.read(source["member"])  # zipfile checks the member's CRC-32 as it reads
    text, encoding = decode(raw)
    return extract(text, year).encode("utf-8"), encoding


def main(zip_path, pin_id):
    found = PIN_ID_PATTERN.fullmatch(pin_id)
    if not found:
        print(f"{pin_id!r} is not a pin id like hai-cy2024")
        return 2
    entry = manifest_entry(pin_id)
    try:
        out, encoding = derive(Path(zip_path).read_bytes(), entry["derivedFrom"], int(found.group(1)))
    except (ValueError, KeyError, zipfile.BadZipFile) as err:
        print(f"{zip_path}: {err}")
        return 1
    path = PINNED_DIR / entry["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)
    sha = hashlib.sha256(out).hexdigest()
    print(f"wrote {entry['path']}: {len(out)} bytes, sha256 {sha} (raw text: {encoding})")
    if (len(out), sha) != (entry["bytes"], entry["sha256"]):
        print(f"the manifest entry {pin_id} records {entry['bytes']} bytes, sha256 {entry['sha256']}")
        return 1
    return 0
