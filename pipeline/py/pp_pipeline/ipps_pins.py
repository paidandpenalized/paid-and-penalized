"""The pinned FY2026 IPPS files, read and parsed (pp_engine.ipps does the parsing; this does the file access).

CMS writes all four members in Windows-1252. Results are cached and shared: callers must not modify them.
"""
import functools

from pp_engine import ipps
from pp_pipeline.emit_hospital import cp1252
from pp_pipeline.files import read_zip_member

IMPACT, RATES, HRRP, VBP = "ipps-impact-fy2026", "ipps-rates-fy2026", "hrrp-supplemental-fy2026", "hvbp-table16b-fy2026"
MEMBERS = {IMPACT: "FY 2026 IPPS Final Rule Impact File.txt", RATES: "CMS-1833-F Tables 1A - 1E.txt",
           HRRP: "FR FY 2026.txt", VBP: "FY2026-Table-16B.txt"}


@functools.lru_cache(maxsize=None)
def pinned_text(pin_id):
    return cp1252(read_zip_member(pin_id, MEMBERS[pin_id]), MEMBERS[pin_id])


@functools.lru_cache(maxsize=None)
def rates():
    return ipps.read_rates(pinned_text(RATES))


@functools.lru_cache(maxsize=None)
def payment_inputs():
    return ipps.read_payment_inputs(pinned_text(IMPACT))


@functools.lru_cache(maxsize=None)
def hrrp_factors():
    return ipps.read_hrrp_factors(pinned_text(HRRP))


@functools.lru_cache(maxsize=None)
def vbp_factors():
    return ipps.read_vbp_factors(pinned_text(VBP))
