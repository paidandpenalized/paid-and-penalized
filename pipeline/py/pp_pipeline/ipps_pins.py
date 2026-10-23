"""The pinned IPPS files, read and parsed (pp_engine.ipps does the parsing; this does the file access).

Two final rules are pinned: FY2026's, which the dollar estimates are built on (`FY`), and FY2024's, which the back-test
re-runs the estimate on (pp_pipeline.backtest_dollars). Each reader takes the rule's year (default `FY`); the year
picks the pins (`pin_ids`), their members and the readers' column maps.

CMS writes all four members in Windows-1252. Results are cached and shared: callers must not modify them.
"""
import functools

from pp_engine import ipps
from pp_pipeline.files import read_zip_text_cp1252

FY = 2026  # the final rule's year the estimates are built on: the year the dollar emitter checks
BACKTEST_FY = 2024  # the final rule the back-test re-runs the estimate on


def pin_ids(fy):
    """(impact file, Tables 1A-1E, HRRP supplemental file, Table 16B): the pin ids of one final rule's four files."""
    return f"ipps-impact-fy{fy}", f"ipps-rates-fy{fy}", f"hrrp-supplemental-fy{fy}", f"hvbp-table16b-fy{fy}"


IMPACT, RATES, HRRP, VBP = pin_ids(FY)
# Each pin's member, as CMS names it inside the zip.
MEMBERS = {
    **dict(zip(pin_ids(2026), ("FY 2026 IPPS Final Rule Impact File.txt", "CMS-1833-F Tables 1A - 1E.txt",
                               "FR FY 2026.txt", "FY2026-Table-16B.txt"))),
    **dict(zip(pin_ids(2024), ("FY 2024 IPPS Final Rule Impact File.txt", "CMS-1785-F Tables 1A - 1E.txt",
                               "508 version of FY2024_Final_Rule_Supplemental_File Variations FR FY 2024 tab .txt",
                               "FY2024_Table16B.txt"))),
}


def pinned_text(pin_id):
    return read_zip_text_cp1252(pin_id, MEMBERS[pin_id])


@functools.lru_cache(maxsize=None)
def rates(fy=FY):
    return ipps.read_rates(pinned_text(pin_ids(fy)[1]))


@functools.lru_cache(maxsize=None)
def payment_inputs(fy=FY):
    return ipps.read_payment_inputs(pinned_text(pin_ids(fy)[0]), fy)


@functools.lru_cache(maxsize=None)
def hrrp_factors(fy=FY):
    return ipps.read_hrrp_factors(pinned_text(pin_ids(fy)[2]))


@functools.lru_cache(maxsize=None)
def vbp_factors(fy=FY):
    return ipps.read_vbp_factors(pinned_text(pin_ids(fy)[3]), fy)
