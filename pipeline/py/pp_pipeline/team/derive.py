"""Derive the TEAM source pins (data/pinned/team-py2/, data/pinned/omb-delineation-2023/) from CMS's and the Census
Bureau's raw files, and record them in the manifest.

Seven pins; raw downloads stay out of git (a pin is a small CSV derived from one):
  team-participants   CMS's TEAM participant list (xlsx)                      -> participants.csv
  team-prices         CMS's PY2 preliminary target price workbook (xlsx)       -> prices.csv
  cjrx-participants   CMS's CJR-X participant list (xlsx)                      -> cjrx.csv
  team-mup-dy2023/24  Medicare Inpatient Hospitals by Provider and Service     -> mup-dy2023.csv, mup-dy2024.csv
  team-quality        Provider Data Catalog Hybrid_HWR and ISCMR rows          -> quality.csv
  omb-delineation-2023  the Census Bureau's List 1 of OMB's July 2023 CBSA    -> list1-counties.csv
                      delineation (xlsx; the delineation the crosswalk's FY2025 CBSA column follows): every county in
                      a metropolitan or micropolitan CBSA, with its CBSA and metropolitan division

    python3 -I pipeline/py/run.py derive-team <directory holding the raw files, found by name> --retrieved YYYY-MM-DD
        [--repin]

`--retrieved` is the day the raw files were downloaded. CMS's Last-Modified dates come from a sidecar beside the
downloads, `source-dates.json` at the top of the raw directory (the way the HCRIS layer takes `--posted`), keyed by
raw file name:

    {"files": {"<raw file name>": "YYYY-MM-DD", ...one per raw file...},
     "pdcReleased": "YYYY-MM-DD", "pdcModified": "YYYY-MM-DD"}

`files` holds each file's Last-Modified date as CMS's server gave it; `pdcReleased` and `pdcModified` are the Provider
Data Catalog dataset's release and modification dates (the quality pin's). SOURCES below holds only what does not
change between downloads: each pin's title, path and URLs.

The manifest entry for each pin (derivedFrom: URL, size, SHA-256, CMS's Last-Modified date; plus asOf, counts and a
spot value recorded at derive time) is written here, then the CSV only when it is the bytes the entry names. A pin
whose derived bytes differ from the committed manifest entry's SHA-256 (a changed derivation or a new CMS file) is
refused, by name, and nothing is written; `--repin` writes the new pins and entries (`write_pins`).
"""
import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from pp_engine import xlsx
from pp_engine.parse import rows, table
from pp_engine.team.episodes import REMAPS
from pp_pipeline.files import PINNED_DIR, file_sha256, read_manifest, write_derived_pin, write_manifest

DERIVED_BY = "pipeline/py/pp_pipeline/team/derive.py"
SIDECAR = "source-dates.json"

# The participant list's header text for each CSV column, in the pin's column order.
PARTICIPANT_HEADERS = {
    "ccn": "Hospital CCN", "name": "Hospital Name", "cbsa": "CBSA", "cbsa_name": "CBSA Name", "cbsa_state": "CBSA State",
    "participation": "Mandatory or Voluntary Participant", "start": "Participation Start Date",
    "end": "Participation End Date", "newly_identified": "Newly Identified TEAM Participant Relative to Previous List"}
PARTICIPANT_COLUMNS = tuple(PARTICIPANT_HEADERS)
PRICE_COLUMNS = ("category", "drg", "division", "benchmark", "trend", "discount", "price", "average_row")
CJRX_COLUMNS = ("ccn", "state", "name")
MUP_COLUMNS = ("ccn", "drg", "discharges")
QUALITY_COLUMNS = ("ccn", "measure", "value", "start", "end")
DELINEATION = "omb-delineation-2023"
DELINEATION_COLUMNS = ("fips", "cbsa", "cbsa_title", "area", "division")
# List 1's header text for each column it is read from.
DELINEATION_HEADERS = {
    "cbsa": "CBSA Code", "division": "Metropolitan Division Code", "cbsa_title": "CBSA Title",
    "area": "Metropolitan/Micropolitan Statistical Area", "state": "FIPS State Code", "county": "FIPS County Code"}
DELINEATION_AREAS = {"Metropolitan Statistical Area": "metro", "Micropolitan Statistical Area": "micro"}

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
# Provider Data Catalog measure ids -> the pin's measure names.
QUALITY_MEASURES = {"Hybrid_HWR": "hybrid_hwr", "ISCMR": "iscmr"}

# Where each pin comes from: the static facts. The dates (`lastModified`, the catalog's) come from the sidecar.
TEAM_PAGE = "https://www.cms.gov/priorities/innovation/innovation-models/team-model"
MUP_PAGE = ("https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/"
            "medicare-inpatient-hospitals-by-provider-and-service")
SOURCES = {
    "team-participants": {
        "title": "TEAM participant list (CMS)", "path": "team-py2/participants.csv",
        "file": "team-participant-list.xlsx", "downloadUrl": "https://www.cms.gov/team-model-participant-list",
        "landingPage": TEAM_PAGE},
    "team-prices": {
        "title": "TEAM performance year 2 preliminary target prices (CMS)", "path": "team-py2/prices.csv",
        "file": "team-py2-prlim-target-prices.xlsx",
        "downloadUrl": "https://www.cms.gov/priorities/innovation/files/team-py2-prlim-target-prices.xlsx",
        "landingPage": TEAM_PAGE},
    "cjrx-participants": {
        "title": "CJR-X participant list (CMS)", "path": "team-py2/cjrx.csv", "file": "cjrx-participant-list.xlsx",
        "downloadUrl": "https://www.cms.gov/priorities/innovation/files/cjrx-participant-list.xlsx",
        "landingPage": "https://www.cms.gov/priorities/innovation/innovation-models/cjr-x"},
    "team-mup-dy2023": {
        "title": "Medicare Inpatient Hospitals by Provider and Service, data year 2023: episode and predecessor DRGs",
        "path": "team-py2/mup-dy2023.csv", "file": "MUP_INP_RY25_P03_V10_DY23_PrvSvc.CSV",
        "downloadUrl": "https://data.cms.gov/sites/default/files/2025-05/ca1c9013-8c7c-4560-a4a1-28cf7e43ccc8/"
                       "MUP_INP_RY25_P03_V10_DY23_PrvSvc.CSV",
        "landingPage": MUP_PAGE},
    "team-mup-dy2024": {
        "title": "Medicare Inpatient Hospitals by Provider and Service, data year 2024: episode and predecessor DRGs",
        "path": "team-py2/mup-dy2024.csv", "file": "MUP_INP_RY26_P03_V10_DY24_PrvSvc.CSV",
        "downloadUrl": "https://data.cms.gov/sites/default/files/2026-04/828defb5-c9e6-4442-8c1b-f27bc0799daf/"
                       "MUP_INP_RY26_P03_V10_DY24_PrvSvc.CSV",
        "landingPage": MUP_PAGE},
    "team-quality": {
        "title": "Hospital-wide readmission (Hybrid_HWR) and surgical complications mortality (ISCMR) scores, "
                 "Provider Data Catalog",
        "path": "team-py2/quality.csv", "landingPage": "https://data.cms.gov/provider-data/dataset/632h-zaca",
        "hwr": {"file": "Unplanned_Hospital_Visits-Hospital.csv",
                "downloadUrl": "https://data.cms.gov/provider-data/sites/default/files/resources/"
                               "30edc1d0417a34b58affcc2495a02b0a_1792599927/Unplanned_Hospital_Visits-Hospital.csv"},
        "iscmr": {"file": "Complications_and_Deaths-Hospital.csv",
                  "downloadUrl": "https://data.cms.gov/provider-data/sites/default/files/resources/"
                                 "6af7c44d77436e5a1caac3ce39a83fe9_1792599556/Complications_and_Deaths-Hospital.csv"}},
    DELINEATION: {
        "title": "OMB core-based statistical area delineation, July 2023 (Census Bureau List 1): counties by CBSA and "
                 "metropolitan division",
        "path": "omb-delineation-2023/list1-counties.csv", "file": "list1_2023.xlsx",
        "downloadUrl": "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/"
                       "delineation-files/list1_2023.xlsx",
        "landingPage": "https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/"
                       "delineation-files.html"},
}
MUP_PINS = ("team-mup-dy2023", "team-mup-dy2024")
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


def _as_of(text, what):
    m = re.search(r"as of ([A-Z][a-z]+ [0-9]{1,2}, [0-9]{4})", text)
    if not m:
        raise ValueError(f"{what}: no 'as of <date>' in its first line")
    return datetime.strptime(m.group(1), "%B %d, %Y").strftime("%Y-%m-%d")


def participants(data):
    """(csv text, counts, as-of date) from the participant list workbook's bytes (its first sheet)."""
    sheet = xlsx.sheet_rows(data, None, "participant list")
    as_of = _as_of(sheet[0][0], "participant list")
    out = {}
    for r in table(sheet, PARTICIPANT_HEADERS["participation"], PARTICIPANT_HEADERS, "participant list"):
        if r["participation"] not in ("Mandatory", "Voluntary"):
            continue
        if r["ccn"] in out:
            raise ValueError("participant list: a CCN appears twice")
        out[r["ccn"]] = [r["ccn"], r["name"], r["cbsa"], r["cbsa_name"], r["cbsa_state"], r["participation"].lower(),
                         _iso(r["start"], "participant start"), _iso(r["end"], "participant end"),
                         r["newly_identified"]]
    body = [out[k] for k in sorted(out)]
    counts = {"rows": len(body), "byParticipation": dict(sorted(Counter(r[5] for r in body).items())),
              "byStart": dict(sorted(Counter(r[6] for r in body).items()))}
    return _csv(PARTICIPANT_COLUMNS, body), counts, as_of


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
    sheet = xlsx.sheet_rows(data, None, "CJR-X list")
    as_of = _as_of(sheet[0][0], "CJR-X list")
    body = {}
    for r in table(sheet, "Provider ID", {"ccn": "Provider ID", "state": "State", "name": "Hospital Name"}, "CJR-X list"):
        if re.fullmatch(r"[0-9]{6}", r["ccn"]):
            if r["ccn"] in body:
                raise ValueError("CJR-X list: a CCN appears twice")
            body[r["ccn"]] = [r["ccn"], r["state"], r["name"]]
    return _csv(CJRX_COLUMNS, [body[k] for k in sorted(body)]), {"rows": len(body)}, as_of


def mup_drgs(price_rows):
    """The DRGs the Medicare inpatient pins keep: every priced episode DRG (the price pin's rows, average rows aside)
    and every retired DRG the build moves to a successor (pp_engine.team.episodes.REMAPS), since the data years still
    count cases under those."""
    return {r["drg"] for r in price_rows if r["average_row"] != "1"} | set(REMAPS)


def delineation(data):
    """(csv text, counts, the delineation's month as YYYY-MM) from List 1's bytes (its first sheet): one row per county
    in a CBSA, by 5-digit county FIPS code; `area` is metro or micro, `division` the metropolitan division code or
    blank. The notes under the table are skipped."""
    sheet = xlsx.sheet_rows(data, None, "delineation")
    month = next((m for r in sheet[:5] if r for m in [re.search(r"([A-Z]+) ([0-9]{4})$", r[0].strip())] if m), None)
    if month is None:
        raise ValueError("delineation: no 'MONTH YYYY' at the end of a title line")
    delineated = datetime.strptime(f"{month.group(1).title()} {month.group(2)}", "%B %Y").strftime("%Y-%m")
    body = {}
    for r in table(sheet, DELINEATION_HEADERS["cbsa"], DELINEATION_HEADERS, "delineation"):
        if not re.fullmatch(r"[0-9]{5}", r["cbsa"]):
            continue  # the notes under the table
        fips = r["state"] + r["county"]
        if not re.fullmatch(r"[0-9]{5}", fips) or fips in body:
            raise ValueError("delineation: a county FIPS code is malformed or appears twice")
        if r["area"] not in DELINEATION_AREAS:
            raise ValueError(f"delineation: unknown area type {r['area']!r}")
        body[fips] = [fips, r["cbsa"], r["cbsa_title"], DELINEATION_AREAS[r["area"]], r["division"]]
    rows_ = [body[k] for k in sorted(body)]
    counts = {"rows": len(rows_), "byArea": dict(sorted(Counter(r[3] for r in rows_).items()))}
    return _csv(DELINEATION_COLUMNS, rows_), counts, delineated


def _records(data, anchor, columns, label, encoding="utf-8-sig"):
    """Records from CSV bytes: parse.table on the header row starting `anchor`; `columns` maps key -> header text."""
    return table(rows(data.decode(encoding), ","), anchor, columns, label)


def mup(data, drgs):
    """(csv text, counts) from a Medicare Inpatient by Provider and Service file's bytes: the rows for `drgs`."""
    cells = {}
    for r in _records(data, "Rndrng_Prvdr_CCN", {"ccn": "Rndrng_Prvdr_CCN", "drg": "DRG_Cd", "n": "Tot_Dschrgs"},
                      "Medicare inpatient file", MUP_ENCODING):
        if r["drg"] in drgs:
            key = (r["ccn"], r["drg"])
            if key in cells:
                raise ValueError("Medicare inpatient file: a provider-DRG cell appears twice")
            cells[key] = int(float(r["n"]))
    return _csv(MUP_COLUMNS, [[c, d, n] for (c, d), n in sorted(cells.items())]), {"rows": len(cells)}


def quality(hwr_data, iscmr_data):
    """(csv text, counts) of the numeric Hybrid_HWR and ISCMR scores from the two Provider Data Catalog files."""
    columns = {"ccn": "Facility ID", "measure": "Measure ID", "score": "Score", "start": "Start Date", "end": "End Date"}
    body = []
    for data in (hwr_data, iscmr_data):
        for r in _records(data, "Facility ID", columns, "quality file"):
            name = QUALITY_MEASURES.get(r["measure"])
            try:
                float(r["score"])
            except ValueError:
                continue  # "Not Available" and the like
            if name:
                body.append([r["ccn"], name, r["score"], _iso(r["start"], "quality start"), _iso(r["end"], "quality end")])
    body.sort(key=lambda r: (r[1], r[0]))
    return _csv(QUALITY_COLUMNS, body), {"byMeasure": dict(sorted(Counter(r[1] for r in body).items()))}


def _find_raw(raw_dir, name):
    hits = sorted(Path(raw_dir).rglob(name))
    if len(hits) != 1:
        raise FileNotFoundError(f"expected exactly one {name} under {raw_dir}, found {len(hits)}")
    return hits[0]


def _read_dates(raw_dir):
    """The sidecar's {'files': {raw file name: date}, 'pdcReleased', 'pdcModified'}; every date must be YYYY-MM-DD."""
    path = Path(raw_dir) / SIDECAR
    try:
        dates = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise FileNotFoundError(f"{path}: the sidecar of CMS's Last-Modified dates is missing (see the module docstring)") from None
    for date in (*dates.get("files", {}).values(), dates.get("pdcReleased"), dates.get("pdcModified")):
        _check_date(date, SIDECAR)
    return dates


def _check_date(value, what):
    if not (isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value)):
        raise ValueError(f"{what}: {value!r} is not a YYYY-MM-DD date")
    datetime.strptime(value, "%Y-%m-%d")


def _source_record(path, info, dates):
    """The manifest's derivedFrom for one raw file: its name, size, SHA-256, URL and Last-Modified date."""
    sha, size = file_sha256(path)
    try:
        last_modified = dates["files"][info["file"]]
    except KeyError:
        raise ValueError(f"{SIDECAR}: no date for {info['file']}") from None
    return {"file": info["file"], "bytes": size, "sha256": sha, "downloadUrl": info["downloadUrl"],
            "lastModified": last_modified}


def build_all(raw_dir, retrieved):
    """{pin id: (CSV bytes, manifest entry)} for every TEAM pin, from the raw files in `raw_dir` (and its sidecar of
    Last-Modified dates); `retrieved` is the day they were downloaded."""
    _check_date(retrieved, "retrieved")
    dates = _read_dates(raw_dir)
    quality_src = SOURCES["team-quality"]
    raw = {info["file"]: _find_raw(raw_dir, info["file"])
           for info in (*(s for pin_id, s in SOURCES.items() if "file" in s), quality_src["hwr"], quality_src["iscmr"])}
    out = {}

    def entry(pin_id, text, derived_from, **extra):
        data, src = text.encode("utf-8"), SOURCES[pin_id]
        out[pin_id] = (data, {"id": pin_id, "title": src["title"], "path": src["path"], "bytes": len(data),
                              "sha256": hashlib.sha256(data).hexdigest(), "derivedFrom": derived_from,
                              "derivedBy": DERIVED_BY, "landingPage": src["landingPage"], "retrieved": retrieved,
                              **extra})

    def source(pin_id):
        info = SOURCES[pin_id]
        return _source_record(raw[info["file"]], info, dates)

    def read(pin_id):
        return raw[SOURCES[pin_id]["file"]].read_bytes()

    text, counts, as_of = participants(read("team-participants"))
    entry("team-participants", text, source("team-participants"), asOf=as_of, counts=counts)
    price_bytes = read("team-prices")
    text, counts = prices(price_bytes)
    cat, drg, div = SPOT_CHECK
    price_rows = list(csv.DictReader(io.StringIO(text)))
    spot = [r for r in price_rows if (r["category"], r["drg"], r["division"]) == SPOT_CHECK]
    if len(spot) != 1:
        raise ValueError("price workbook: the spot-check row is missing")
    entry("team-prices", text, source("team-prices"), asOf=price_as_of(price_bytes), counts=counts,
          spotCheck={"category": cat, "drg": drg, "division": div, "price": spot[0]["price"]})
    text, counts, as_of = cjrx(read("cjrx-participants"))
    entry("cjrx-participants", text, source("cjrx-participants"), asOf=as_of, counts=counts)
    wanted = mup_drgs(price_rows)
    for pin_id in MUP_PINS:
        text, counts = mup(read(pin_id), wanted)
        entry(pin_id, text, source(pin_id), counts=counts)
    text, counts = quality(raw[quality_src["hwr"]["file"]].read_bytes(), raw[quality_src["iscmr"]["file"]].read_bytes())
    first = _source_record(raw[quality_src["hwr"]["file"]], quality_src["hwr"], dates)
    first["alsoRead"] = _source_record(raw[quality_src["iscmr"]["file"]], quality_src["iscmr"], dates)
    entry("team-quality", text, first, counts=counts, pdcReleased=dates["pdcReleased"], pdcModified=dates["pdcModified"])
    text, counts, delineated = delineation(read(DELINEATION))
    entry(DELINEATION, text, source(DELINEATION), counts=counts, delineated=delineated)
    return out


def main(argv):
    parser = argparse.ArgumentParser(prog="run.py derive-team", description="Derive the TEAM source pins from CMS's raw files.")
    parser.add_argument("raw_dir", help=f"the directory holding the raw files and {SIDECAR}")
    parser.add_argument("--retrieved", required=True, help="the day the raw files were downloaded (YYYY-MM-DD)")
    parser.add_argument("--repin", action="store_true",
                        help="write pins whose derived bytes differ from the committed manifest entries")
    args = parser.parse_args(argv)
    return write_pins(build_all(args.raw_dir, args.retrieved), args.repin)


def write_pins(built, repin=False, root=PINNED_DIR):
    """Write `built` ({pin id: (CSV bytes, manifest entry)}) to the manifest and the pinned files under `root`. Each
    pin's new bytes are checked against the committed manifest entry's SHA-256 first: a pin that differs, or that the
    manifest lacks, is refused by name and nothing at all is written, unless `repin`. Entries are replaced in place
    (a new pin is appended). Returns the exit code: 0 written, 1 refused."""
    manifest = read_manifest(root)
    committed = {e["id"]: e.get("sha256") for e in manifest}
    changed = [pin_id for pin_id, (_, entry) in built.items() if committed.get(pin_id) != entry["sha256"]]
    if changed and not repin:
        print(f"derive-team: {', '.join(changed)}: the derived bytes differ from the committed manifest entry; nothing "
              "written. Check the change, then run again with --repin to re-pin.")
        return 1
    entries = {pin_id: entry for pin_id, (_, entry) in built.items()}
    manifest = [entries.pop(e["id"], e) for e in manifest] + list(entries.values())
    write_manifest(manifest, root)
    codes = 0
    for data, entry in built.values():
        codes |= write_derived_pin(entry, data, root=root)
    return codes
