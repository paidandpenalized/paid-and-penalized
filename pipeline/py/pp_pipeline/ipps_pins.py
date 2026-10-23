"""The pinned IPPS files, read and parsed (pp_engine.ipps does the parsing; this does the file access), and the
hospitals priced on them.

Two final rules are pinned: FY2026's, which the dollar estimates are built on (`FY`), and FY2024's, which the back-test
re-runs the estimate on (pp_pipeline.backtest_dollars). Each reader takes the rule's year (default `FY`); the year
picks the pins (`pin_ids`), their members and the readers' column maps. `priced_rows` runs the estimate over a HACRP
file with those readers, for the emitter and the back-test alike.

CMS writes all four members in Windows-1252. Results are cached and shared: callers must not modify them.
"""
import functools
from typing import NamedTuple

from pp_engine import bands, dollars, ipps
from pp_pipeline.files import read_zip_text_cp1252

FY = 2026  # the final rule's year the estimates are built on: the year the dollar emitter checks
BACKTEST_FY = 2024  # the final rule the back-test re-runs the estimate on


class Pins(NamedTuple):
    """One final rule's four files."""
    impact: str  # the impact file
    rates: str  # Tables 1A-1E
    hrrp: str  # the HRRP supplemental file
    vbp: str  # Table 16B


def pin_ids(fy):
    """The pin ids of one final rule's four files."""
    return Pins(f"ipps-impact-fy{fy}", f"ipps-rates-fy{fy}", f"hrrp-supplemental-fy{fy}", f"hvbp-table16b-fy{fy}")


IMPACT, RATES, HRRP, VBP = pin_ids(FY)
# Each pin's member, as CMS names it inside the zip, by the rule's year.
MEMBERS = {
    2026: Pins("FY 2026 IPPS Final Rule Impact File.txt", "CMS-1833-F Tables 1A - 1E.txt", "FR FY 2026.txt",
               "FY2026-Table-16B.txt"),
    2024: Pins("FY 2024 IPPS Final Rule Impact File.txt", "CMS-1785-F Tables 1A - 1E.txt",
               "508 version of FY2024_Final_Rule_Supplemental_File Variations FR FY 2024 tab .txt",
               "FY2024_Table16B.txt"),
}


def pinned_text(fy, name):
    """The text of one of a final rule's files: `name` is a field of `Pins`."""
    return read_zip_text_cp1252(getattr(pin_ids(fy), name), getattr(MEMBERS[fy], name))


@functools.lru_cache(maxsize=None)
def rates(fy=FY):
    return ipps.read_rates(pinned_text(fy, "rates"), fy)


@functools.lru_cache(maxsize=None)
def payment_inputs(fy=FY):
    return ipps.read_payment_inputs(pinned_text(fy, "impact"), rates(fy))  # read by the year of its rates


@functools.lru_cache(maxsize=None)
def hrrp_factors(fy=FY):
    return ipps.read_hrrp_factors(pinned_text(fy, "hrrp"))


@functools.lru_cache(maxsize=None)
def vbp_factors(fy=FY):
    return ipps.read_vbp_factors(pinned_text(fy, "vbp"), fy)


def priced_rows(records, fy=FY):
    """`dollars.hospital_row` for each of the HACRP file's `records` (`emit_hospital.read_hacrp`'s), in the file's order,
    priced on the final rule of year `fy`. An estimated row also carries its `stratum` (`bands.stratum_of`: the impact
    file's bed count, and whether the hospital is a sole community or Medicare-dependent one), the row of `bands` its
    likely ranges come from; a hospital the impact file gives no bed count is `bands.ALL` and takes the whole set's
    band. The emitter and the back-test both price through here, so the back-test prices a hospital as the pages do.
    A Puerto Rico hospital in any of the three program files stops the build (`dollars.refuse_puerto_rico`)."""
    inputs, table, hrrp, vbp = payment_inputs(fy), rates(fy), hrrp_factors(fy), vbp_factors(fy)
    for ccns, where in (((r["ccn"] for r in records), f"The FY{fy} HACRP file"),
                        (hrrp, f"The FY{fy} HRRP supplemental file"), (vbp, f"FY{fy} Table 16B")):
        dollars.refuse_puerto_rico(ccns, where)
    out = []
    for r in records:
        inp = inputs.get(r["ccn"])
        row = dollars.hospital_row(r["ccn"], r["state"], inp, table, hrrp=hrrp.get(r["ccn"]), vbp=vbp.get(r["ccn"]),
                                   cut=r["cut"])
        if row["status"] == "estimated":
            row = {**row, "stratum": bands.stratum_of(inp)}
        out.append(row)
    return out
