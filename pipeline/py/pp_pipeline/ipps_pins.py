"""The pinned FY2026 IPPS files, read and parsed (pp_engine.ipps does the parsing; this does the file access).

CMS writes all four members in Windows-1252. Results are cached and shared: callers must not modify them.
"""
import functools

from pp_engine import ipps
from pp_pipeline.files import read_zip_text_cp1252

FY = 2026  # the final rule's year: in the pin ids and member names below, and the year the dollar emitter checks
IMPACT, RATES = f"ipps-impact-fy{FY}", f"ipps-rates-fy{FY}"
HRRP, VBP = f"hrrp-supplemental-fy{FY}", f"hvbp-table16b-fy{FY}"
MEMBERS = {IMPACT: f"FY {FY} IPPS Final Rule Impact File.txt", RATES: "CMS-1833-F Tables 1A - 1E.txt",
           HRRP: f"FR FY {FY}.txt", VBP: f"FY{FY}-Table-16B.txt"}


def pinned_text(pin_id):
    return read_zip_text_cp1252(pin_id, MEMBERS[pin_id])


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
