"""Derive the safety-net flag's pinned state pools from CMS's HCRIS hospital zip for the base year:

    python3 -I pipeline/py/pp_pipeline/medicaid/cli.py safety-net-pin <HOSP10FY2023.ZIP> <hosp10-reports.zip> <out.csv>

The flag's MIUR test compares a hospital with the mean of every hospital in its state (pp_engine.medicaid.safety_net),
and the HCRIS layer keeps only acute and critical access hospitals, so this reads the zip itself: every report in
the file, any facility type, made into hospital-years by the layer's own rules (pp_engine.hcris.tidy), grouped by
state: each CCN's state in CMS's provider file (HOSP10_PRVDR_ID_INFO.CSV, in the HCRIS reports zip), so a state with
two CMS state codes (Texas: 45, 67, 74) is one pool. One row per state: hospitals with Medicaid days, the mean and
sample standard deviation of their MIUR, and the cut. The CSV goes in `data/pinned/medicaid/` with a manifest entry naming both
zips.
"""
import csv
import io
import zipfile
from collections import defaultdict
from pathlib import Path

from pp_engine.hcris import tidy
from pp_engine.medicaid import params, safety_net
from pp_pipeline.hcris.extract import read_year
from pp_pipeline.hcris.pins import _csv_bytes

COLUMNS = ("state", "hospitals", "mean", "sd", "cut")
PROVIDERS = "HOSP10_PRVDR_ID_INFO.CSV"
PLACES = 6


def state_rows(rows, state_of):
    """COLUMNS rows (header first) from hospital-year rows of every facility type; `state_of`: {ccn: postal state}
    (a CCN it lacks is left out)."""
    pools = defaultdict(list)
    for r in rows:
        state = state_of.get(r["ccn"])
        if state:
            pools[state].append(None if r["medicaid_day_share"] is None else float(r["medicaid_day_share"]))
    out = [list(COLUMNS)]
    for code in sorted(pools):
        stats = safety_net.state_stats(pools[code])
        if stats is not None:
            n, mean, sd, cut = stats
            out.append([code, str(n)] + [f"{v:.{PLACES}f}" for v in (mean, sd, cut)])
    return out


def provider_states(reports_zip):
    """{ccn: postal state} from CMS's HCRIS provider file."""
    with zipfile.ZipFile(reports_zip) as zf, zf.open(PROVIDERS) as raw:
        return {r["PROVIDER_NUMBER"].strip(): r["STATE"].strip()
                for r in csv.DictReader(io.TextIOWrapper(raw, encoding="latin-1"))}


def derive(zip_path, reports_zip):
    year, reports, values = read_year(zip_path)
    if year != params.BASE_YEAR:
        raise tidy.HcrisError(f"{zip_path}: FY{year}, not the base year FY{params.BASE_YEAR}")
    rows = tidy.hospital_years(reports, values, year)
    return _csv_bytes(state_rows(rows, provider_states(reports_zip)))


def read_cuts(rows):
    """{postal state: cut} from the pinned rows (dicts)."""
    return {r["state"]: float(r["cut"]) for r in rows}


def main(argv):
    if len(argv) != 3:
        print(__doc__.strip())
        return 2
    data = derive(argv[0], argv[1])
    Path(argv[2]).write_bytes(data)
    print(f"wrote {argv[2]}: {len(data.splitlines()) - 1} states, {len(data)} bytes")
    return 0
