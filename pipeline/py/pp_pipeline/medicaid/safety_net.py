"""Derive the safety-net flag's pinned state pools from CMS's HCRIS hospital zip for the base year:

    python3 -I pipeline/py/pp_pipeline/medicaid/cli.py safety-net-pin <HOSP10FY2023.ZIP> <out.csv>

The flag's MIUR test compares a hospital with the mean of every hospital in its state (pp_engine.medicaid.safety_net),
and the HCRIS layer keeps only acute and critical access hospitals, so this reads the zip itself: every report in
the file, any facility type, made into hospital-years by the layer's own rules (pp_engine.hcris.tidy), grouped by
CMS's state code (a CCN's first two digits). One row per state code: hospitals with Medicaid days, the mean and sample
standard deviation of their MIUR, and the cut. The CSV goes in `inputs/` with a sources.json entry naming the zip.
"""
import csv
import io
from collections import defaultdict
from pathlib import Path

from pp_engine.hcris import tidy
from pp_engine.medicaid import params, safety_net
from pp_pipeline.hcris.extract import read_year

COLUMNS = ("state_code", "hospitals", "mean", "sd", "cut")
PLACES = 6


def state_rows(rows):
    """COLUMNS rows (header first) from hospital-year rows of every facility type."""
    pools = defaultdict(list)
    for r in rows:
        pools[r["ccn"][:2]].append(None if r["medicaid_day_share"] is None else float(r["medicaid_day_share"]))
    out = [list(COLUMNS)]
    for code in sorted(pools):
        stats = safety_net.state_stats(pools[code])
        if stats is not None:
            n, mean, sd, cut = stats
            out.append([code, str(n)] + [f"{v:.{PLACES}f}" for v in (mean, sd, cut)])
    return out


def derive(zip_path):
    year, reports, values = read_year(zip_path)
    if year != params.BASE_YEAR:
        raise tidy.HcrisError(f"{zip_path}: FY{year}, not the base year FY{params.BASE_YEAR}")
    out = io.StringIO()
    csv.writer(out, lineterminator="\n").writerows(state_rows(tidy.hospital_years(reports, values, year)))
    return out.getvalue().encode("ascii")


def read_cuts(rows):
    """{state code: cut} from the pinned rows (dicts)."""
    return {r["state_code"]: float(r["cut"]) for r in rows}


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    data = derive(argv[0])
    Path(argv[1]).write_bytes(data)
    states = len(data.splitlines()) - 1
    print(f"wrote {argv[1]}: {states} state codes, {len(data)} bytes")
    return 0
