"""The sites `make refresh SITE=<site>` knows: for each, the Provider Data Catalog datasets it pins (fetched and pinned by
pp_pipeline/refresh_sources.py), the command that prints its reproduction report, and what a person still does by hand
(pp_pipeline/refresh.py puts both lists in the pull request). A new site plugs in with one entry here.
"""
from typing import NamedTuple, Tuple

from pp_pipeline.refresh_sources import PdcSource


class Site(NamedTuple):
    sources: Tuple[PdcSource, ...]
    report: Tuple[str, ...]  # the reproduction report's command, run from the repo root after `make emit`
    always: Tuple[str, ...]  # what a person still does for every refresh
    new_year: Tuple[str, ...]  # and when a source moved to a new fiscal year


HACRP_FILE = PdcSource(
    dataset="yq43-i98g",
    file=r"FY_(?P<fy>[0-9]{4})_HAC_Reduction_Program_Hospital\.csv",
    folder="hacrp-fy{fy}",
    columns=("Facility Name", "Facility ID", "State", "Fiscal Year", "Payment Reduction", "Total HAC Score"),
    fy_column="Fiscal Year",
    title="Hospital-Acquired Condition (HAC) Reduction Program, FY{fy}",
    archive="hacrp-fy{fy}",
)
FOOTNOTES = PdcSource(dataset="y9us-9xdf", file=r"Footnote_Crosswalk\.csv", folder="pdc-footnotes",
                      columns=("Footnote", "Footnote Text"))

SITES = {
    "hacrp": Site(
        sources=(HACRP_FILE, FOOTNOTES),
        report=("node", "sites/hacrp/pipeline/reproduction.js"),
        always=(
            "Read the golden diff: every changed number should trace to CMS's new file.",
            "A corrected file for the same year is a CMS revision: add a corrections entry "
            "(`corrections/YYYY-MM-DD-<slug>.md`) saying what changed and for how many hospitals.",
            "Re-verify `sites/hacrp/CLAIMS.md` against the new file and CMS's FAQ for its year.",
            "If the share-card test fails, run `npm run og` and commit the cards and their stamp.",
            "Run `make build` and look at the program page, one hospital page and Methods before marking this ready.",
        ),
        new_year=(
            "Add the year to `HISTORY_PINS` (`sites/hacrp/pipeline/history.js`): the previous year under its archived "
            "id (this pull request renames its pin), the new year as `yq43-i98g`; move the history tests' year list.",
            "Find the previous year's file in CMS's Provider Data Catalog hospitals archive and record it as the archived "
            "entry's `memberOf`, as the earlier years have.",
            "Pin the new year's IPPS final-rule files (impact file, Tables 1A-1E, HRRP supplemental file, Table 16B) "
            "and move `FY` in `pipeline/py/pp_pipeline/ipps_pins.py`: the dollar estimates refuse a HACRP file of "
            "another year.",
            "Re-set `YES_UNESTIMATED_MAX` (`engine/py/pp_engine/dollars.py`) and the unlisted caps in "
            "`pipeline/py/pp_pipeline/emit_dollars.py` against the new year's counts, after looking at the hospitals "
            "behind them.",
            "Move the CMS FAQ citations (`sites/hacrp/CLAIMS.md`, the Methods copy) to the new year's FAQ: its question "
            "numbers can shift, and its wording can change.",
            "Check the year's measures, periods and scoring rule against `engine/js/hacrp/eras.js`, and the copy that "
            "names the year.",
            "Add the year to `sites/hacrp/CHANGELOG.md`.",
        ),
    ),
}
