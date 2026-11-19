"""Derive the TEAM source pins (data/pinned/team-py2/) from CMS's raw files, and record them in the manifest.

Six sources, seven pins; raw downloads stay out of git (a pin is a small CSV derived from one):
  team-participants   CMS's TEAM participant list (xlsx)                      -> participants.csv
  team-prices         CMS's PY2 preliminary target price workbook (xlsx)       -> prices.csv
  cjrx-participants   CMS's CJR-X participant list (xlsx)                      -> cjrx.csv
  team-mup-dy2023/24  Medicare Inpatient Hospitals by Provider and Service     -> mup-dy2023.csv, mup-dy2024.csv
  team-quality        Provider Data Catalog Hybrid_HWR and ISCMR rows          -> quality.csv

    python3 -I pipeline/py/run.py derive-team <directory holding the raw files, found by name>

The manifest entry for each pin (derivedFrom: URL, size, SHA-256, CMS's Last-Modified date; plus asOf, counts and a
spot value recorded at derive time) is written here, then the CSV only when it is the bytes the entry names.
"""
import csv
import hashlib
import io
import re
from datetime import datetime
from pathlib import Path

from pp_engine import xlsx
from pp_pipeline.files import read_manifest, write_derived_pin, write_manifest

DERIVED_BY = "pipeline/py/pp_pipeline/team/derive.py"
RETRIEVED = "2026-11-19"  # the day these files were downloaded

PARTICIPANT_COLUMNS = ("ccn", "name", "cbsa", "cbsa_name", "cbsa_state", "participation", "start", "end", "newly_identified")
PRICE_COLUMNS = ("category", "drg", "division", "benchmark", "trend", "discount", "price", "average_row")
CJRX_COLUMNS = ("ccn", "state", "name")
MUP_COLUMNS = ("ccn", "drg", "discharges")
QUALITY_COLUMNS = ("ccn", "measure", "value", "start", "end")

MUP_ENCODING = "cp1252"  # CMS writes the Medicare inpatient files in Windows-1252 (0x96 is an en dash in a DRG title)
PRICE_SHEET = "Prelim_TP_DRG_Reg"
ALL_ROWS = "All"  # the workbook's DRG label on a category-average row (one per division)
# The workbook's episode category label -> the code the build uses.
CATEGORY_CODES = {
    "MS-Lower extremity joint replacement": "LEJR",
    "IP-Surgical hip/femur fracture treatment": "SHFFT",
    "MS-Spinal fusion": "SPINAL",
    "IP-Coronary artery bypass graft": "CABG",
    "IP-Major bowel procedure": "BOWEL",
}
# Spinal fusion DRGs that CMS regrouped (FY2025 453-455 -> 426-428; 456-458 -> 523-525; 459-460 -> 447-448/450-451), kept
# beside the episode DRGs because the Medicare files for data years 2023 and 2024 still count cases under them.
PREDECESSOR_DRGS = tuple(str(d) for d in range(453, 461))
# Provider Data Catalog measure ids -> the pin's measure names.
QUALITY_MEASURES = {"Hybrid_HWR": "hybrid_hwr", "ISCMR": "iscmr"}

PARTICIPANTS_FILE = "team-participant-list.xlsx"
PRICES_FILE = "team-py2-prlim-target-prices.xlsx"
CJRX_FILE = "cjrx-participant-list.xlsx"
MUP_FILES = {"team-mup-dy2023": "MUP_INP_RY25_P03_V10_DY23_PrvSvc.CSV", "team-mup-dy2024": "MUP_INP_RY26_P03_V10_DY24_PrvSvc.CSV"}
QUALITY_FILES = ("Unplanned_Hospital_Visits-Hospital.csv", "Complications_and_Deaths-Hospital.csv")

# Where each raw file came from. `lastModified` is the date CMS's server gave for the file when it was retrieved.
SOURCES = {
    "team-participants": {
        "title": "TEAM participant list (CMS)", "file": PARTICIPANTS_FILE, "lastModified": "2026-09-22",
        "downloadUrl": "https://www.cms.gov/team-model-participant-list",
        "landingPage": "https://www.cms.gov/priorities/innovation/innovation-models/team-model"},
    "team-prices": {
        "title": "TEAM performance year 2 preliminary target prices (CMS)", "file": PRICES_FILE, "lastModified": "2026-11-06",
        "downloadUrl": "https://www.cms.gov/priorities/innovation/files/team-py2-prlim-target-prices.xlsx",
        "landingPage": "https://www.cms.gov/priorities/innovation/innovation-models/team-model"},
    "cjrx-participants": {
        "title": "CJR-X participant list (CMS)", "file": CJRX_FILE, "lastModified": "2026-10-05",
        "downloadUrl": "https://www.cms.gov/priorities/innovation/files/cjrx-participant-list.xlsx",
        "landingPage": "https://www.cms.gov/priorities/innovation/innovation-models/cjr-x"},
    "team-mup-dy2023": {
        "title": "Medicare Inpatient Hospitals by Provider and Service, data year 2023: episode and predecessor DRGs",
        "file": MUP_FILES["team-mup-dy2023"], "lastModified": "2025-05-14",
        "downloadUrl": "https://data.cms.gov/sites/default/files/2025-05/ca1c9013-8c7c-4560-a4a1-28cf7e43ccc8/"
                       "MUP_INP_RY25_P03_V10_DY23_PrvSvc.CSV",
        "landingPage": "https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/"
                       "medicare-inpatient-hospitals-by-provider-and-service"},
    "team-mup-dy2024": {
        "title": "Medicare Inpatient Hospitals by Provider and Service, data year 2024: episode and predecessor DRGs",
        "file": MUP_FILES["team-mup-dy2024"], "lastModified": "2026-04-10",
        "downloadUrl": "https://data.cms.gov/sites/default/files/2026-04/828defb5-c9e6-4442-8c1b-f27bc0799daf/"
                       "MUP_INP_RY26_P03_V10_DY24_PrvSvc.CSV",
        "landingPage": "https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/"
                       "medicare-inpatient-hospitals-by-provider-and-service"},
}
QUALITY_SOURCE = {
    "title": "Hospital-wide readmission (Hybrid_HWR) and surgical complications mortality (ISCMR) scores, Provider Data Catalog",
    "pdcReleased": "2026-11-12", "pdcModified": "2026-10-20",
    "landingPage": "https://data.cms.gov/provider-data/dataset/632h-zaca",
    "hwr": {"file": QUALITY_FILES[0], "lastModified": "2026-10-21",
            "downloadUrl": "https://data.cms.gov/provider-data/sites/default/files/resources/"
                           "30edc1d0417a34b58affcc2495a02b0a_1792599927/Unplanned_Hospital_Visits-Hospital.csv"},
    "iscmr": {"file": QUALITY_FILES[1], "lastModified": "2026-10-21",
              "downloadUrl": "https://data.cms.gov/provider-data/sites/default/files/resources/"
                             "6af7c44d77436e5a1caac3ce39a83fe9_1792599556/Complications_and_Deaths-Hospital.csv"},
}
PIN_PATHS = {"team-participants": "team-py2/participants.csv", "team-prices": "team-py2/prices.csv",
             "cjrx-participants": "team-py2/cjrx.csv", "team-mup-dy2023": "team-py2/mup-dy2023.csv",
             "team-mup-dy2024": "team-py2/mup-dy2024.csv", "team-quality": "team-py2/quality.csv"}
SPOT_CHECK = ("CABG", "231", "1")  # a price cell the pin test compares with the workbook: category, DRG, division


def _csv(columns, rows):
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(columns)
    w.writerows(rows)
    return out.getvalue()


def _iso(us_date, what):
    try:
        return datetime.strptime(us_date.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError(f"{what}: {us_date!r} is not a MM/DD/YYYY date") from None


def _find(rows, first_cell_prefix, what):
    for i, r in enumerate(rows):
        if r and r[0].startswith(first_cell_prefix):
            return i
    raise ValueError(f"{what}: no header row starting {first_cell_prefix!r}")


def _as_of(text, what):
    m = re.search(r"as of ([A-Z][a-z]+ [0-9]{1,2}, [0-9]{4})", text)
    if not m:
        raise ValueError(f"{what}: no 'as of <date>' in its first line")
    return datetime.strptime(m.group(1), "%B %d, %Y").strftime("%Y-%m-%d")


def participants(data):
    """(csv text, counts, as-of date) from the participant list workbook's bytes (its first sheet)."""
    rows = xlsx.sheet_rows(data, None, "participant list")
    as_of = _as_of(rows[0][0], "participant list")
    head = _find(rows, "Mandatory or Voluntary", "participant list")
    out = {}
    for r in rows[head + 1:]:
        if not r or r[0] not in ("Mandatory", "Voluntary"):
            continue
        r = r + [""] * (9 - len(r))
        ccn = r[1].strip()
        if ccn in out:
            raise ValueError("participant list: a CCN appears twice")
        out[ccn] = [ccn, r[2].strip(), r[3].strip(), r[4].strip(), r[5].strip(), r[0].lower(),
                    _iso(r[6], "participant start"), _iso(r[7], "participant end"), r[8].strip()]
    body = [out[k] for k in sorted(out)]
    counts = {"rows": len(body),
              "byParticipation": _tally(r[5] for r in body), "byStart": _tally(r[6] for r in body)}
    return _csv(PARTICIPANT_COLUMNS, body), counts, as_of


def _tally(values):
    t = {}
    for v in values:
        t[v] = t.get(v, 0) + 1
    return dict(sorted(t.items()))


def prices(data):
    """(csv text, counts) from the price workbook's bytes. Category-average rows (DRG 'All') are kept, flagged."""
    rows = xlsx.sheet_rows(data, PRICE_SHEET, "price workbook")
    body = []
    for r in rows:
        if len(r) < 9 or not r[0].isdigit():
            continue
        if r[1] not in CATEGORY_CODES:
            raise ValueError(f"price workbook: unknown episode category {r[1]!r}")
        m = re.fullmatch(r"CENS_DIV_([1-9])", r[3])
        if not m:
            raise ValueError(f"price workbook: unknown region {r[3]!r}")
        # float repr is the shortest text that reads back as the workbook's stored double
        body.append([CATEGORY_CODES[r[1]], r[2], m.group(1), *(repr(float(v)) for v in r[5:9]),
                     "1" if r[2] == ALL_ROWS else "0"])
    if not body:
        raise ValueError("price workbook: no price rows")
    return _csv(PRICE_COLUMNS, body), {"rows": len(body), "averageRows": sum(r[7] == "1" for r in body)}


def price_as_of(data):
    """The workbook's date, from the file name its Overview sheet gives (it starts with YYYY-MM-DD)."""
    for r in xlsx.sheet_rows(data, "Overview", "price workbook"):
        for cell in r:
            m = re.match(r"([0-9]{4}-[0-9]{2}-[0-9]{2})-TEAM.*\.xlsx$", cell)
            if m:
                return m.group(1)
    raise ValueError("price workbook: its Overview sheet names no dated file")


def cjrx(data):
    """(csv text, counts, as-of date) from the CJR-X participant list workbook's bytes (its first sheet)."""
    rows = xlsx.sheet_rows(data, None, "CJR-X list")
    as_of = _as_of(rows[0][0], "CJR-X list")
    head = _find(rows, "Provider ID", "CJR-X list")
    body = {}
    for r in rows[head + 1:]:
        if r and re.fullmatch(r"[0-9]{6}", r[0].strip()):
            if r[0].strip() in body:
                raise ValueError("CJR-X list: a CCN appears twice")
            body[r[0].strip()] = [r[0].strip(), r[1].strip(), r[2].strip()]
    return _csv(CJRX_COLUMNS, [body[k] for k in sorted(body)]), {"rows": len(body)}, as_of


def _dict_rows(data, needed, what, encoding="utf-8-sig"):
    reader = csv.DictReader(io.StringIO(data.decode(encoding)))
    missing = [c for c in needed if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"{what}: expected column(s) {', '.join(missing)} not found")
    return reader


def mup(data, drgs):
    """(csv text, counts) from a Medicare Inpatient by Provider and Service file's bytes: the rows for `drgs`."""
    cells = {}
    for r in _dict_rows(data, ("Rndrng_Prvdr_CCN", "DRG_Cd", "Tot_Dschrgs"), "Medicare inpatient file",
                           MUP_ENCODING):
        if r["DRG_Cd"] in drgs:
            key = (r["Rndrng_Prvdr_CCN"], r["DRG_Cd"])
            if key in cells:
                raise ValueError("Medicare inpatient file: a provider-DRG cell appears twice")
            cells[key] = int(float(r["Tot_Dschrgs"]))
    return _csv(MUP_COLUMNS, [[c, d, n] for (c, d), n in sorted(cells.items())]), {"rows": len(cells)}


def quality(hwr_data, iscmr_data):
    """(csv text, counts) of the numeric Hybrid_HWR and ISCMR scores from the two Provider Data Catalog files."""
    body = []
    for data in (hwr_data, iscmr_data):
        for r in _dict_rows(data, ("Facility ID", "Measure ID", "Score", "Start Date", "End Date"), "quality file"):
            name = QUALITY_MEASURES.get(r["Measure ID"])
            try:
                float(r["Score"])
            except ValueError:
                continue  # "Not Available" and the like
            if name:
                body.append([r["Facility ID"], name, r["Score"], _iso(r["Start Date"], "quality start"),
                             _iso(r["End Date"], "quality end")])
    body.sort(key=lambda r: (r[1], r[0]))
    return _csv(QUALITY_COLUMNS, body), {"byMeasure": _tally(r[1] for r in body)}


def _source_record(path, info):
    data = path.read_bytes()
    return {"file": info["file"], "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "downloadUrl": info["downloadUrl"], "lastModified": info["lastModified"]}


def _find_raw(raw_dir, name):
    hits = sorted(Path(raw_dir).rglob(name))
    if len(hits) != 1:
        raise FileNotFoundError(f"expected exactly one {name} under {raw_dir}, found {len(hits)}")
    return hits[0]


def build_all(raw_dir):
    """{pin id: (csv text, manifest entry without bytes/sha256)} for every TEAM pin, from the raw files in `raw_dir`."""
    raw = {name: _find_raw(raw_dir, name) for name in
           (PARTICIPANTS_FILE, PRICES_FILE, CJRX_FILE, *MUP_FILES.values(), *QUALITY_FILES)}
    out = {}

    def entry(pin_id, derived_from, **extra):
        src = SOURCES.get(pin_id, QUALITY_SOURCE)
        return {"id": pin_id, "title": src["title"], "path": PIN_PATHS[pin_id], "derivedFrom": derived_from,
                "derivedBy": DERIVED_BY, "landingPage": src["landingPage"], "retrieved": RETRIEVED,
                **extra}

    text, counts, as_of = participants(raw[PARTICIPANTS_FILE].read_bytes())
    out["team-participants"] = (text, entry("team-participants", _source_record(raw[PARTICIPANTS_FILE], SOURCES["team-participants"]),
                                            asOf=as_of, counts=counts))
    price_bytes = raw[PRICES_FILE].read_bytes()
    text, counts = prices(price_bytes)
    cat, drg, div = SPOT_CHECK
    spot = [r for r in csv.DictReader(io.StringIO(text)) if (r["category"], r["drg"], r["division"]) == SPOT_CHECK]
    if len(spot) != 1:
        raise ValueError("price workbook: the spot-check row is missing")
    out["team-prices"] = (text, entry("team-prices", _source_record(raw[PRICES_FILE], SOURCES["team-prices"]),
                                      asOf=price_as_of(price_bytes), counts=counts,
                                      spotCheck={"category": cat, "drg": drg, "division": div, "price": spot[0]["price"]}))
    text, counts, as_of = cjrx(raw[CJRX_FILE].read_bytes())
    out["cjrx-participants"] = (text, entry("cjrx-participants", _source_record(raw[CJRX_FILE], SOURCES["cjrx-participants"]),
                                            asOf=as_of, counts=counts))
    wanted = {r["drg"] for r in csv.DictReader(io.StringIO(out["team-prices"][0])) if r["drg"] != ALL_ROWS} | set(PREDECESSOR_DRGS)
    for pin_id, name in MUP_FILES.items():
        text, counts = mup(raw[name].read_bytes(), wanted)
        out[pin_id] = (text, entry(pin_id, _source_record(raw[name], SOURCES[pin_id]), counts=counts))
    q = QUALITY_SOURCE
    text, counts = quality(raw[QUALITY_FILES[0]].read_bytes(), raw[QUALITY_FILES[1]].read_bytes())
    first = _source_record(raw[QUALITY_FILES[0]], q["hwr"])
    first["alsoRead"] = _source_record(raw[QUALITY_FILES[1]], q["iscmr"])
    out["team-quality"] = (text, entry("team-quality", first, counts=counts,
                                       pdcReleased=q["pdcReleased"], pdcModified=q["pdcModified"]))
    return out


def main(raw_dir):
    built = build_all(raw_dir)
    manifest = [e for e in read_manifest() if e["id"] not in built]
    codes = 0
    for pin_id, (text, entry) in built.items():
        data = text.encode("utf-8")
        entry = {**{k: entry[k] for k in ("id", "title", "path")}, "bytes": len(data),
                 "sha256": hashlib.sha256(data).hexdigest(), **{k: v for k, v in entry.items() if k not in ("id", "title", "path")}}
        manifest.append(entry)
        built[pin_id] = (data, entry)
    write_manifest(manifest)
    for data, entry in built.values():
        codes |= write_derived_pin(entry, data)
    return codes
