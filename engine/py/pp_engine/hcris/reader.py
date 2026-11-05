"""How sites read the HCRIS layer: one parsed `data/emitted/hcris/fy<YYYY>/hcris.json` (a `Year`), or several (a
`Panel`). Pure: the caller reads the files (pp_pipeline.hcris.emit.load_years does).

Every value comes with what a page must show beside it: its period dates, "as filed" or "settled", and whether its
year is "early" for S-10 (uncompensated-care) figures. Column names are stable within a schema_version; `UNITS` says
what each one counts. Years are CMS's cost-report years: `label(2024)` is "cost reports beginning in FY2024".
"""
from collections import namedtuple

from pp_engine.hcris.cells import S10_METRICS, UNITS

Value = namedtuple("Value", "year value status_label period_begin period_end early")


def label(year):
    return f"cost reports beginning in FY{year}"


class Year:
    """One year's file. `rows` are dicts keyed by column name, `year` added; `row(ccn)` one hospital's, or None."""

    def __init__(self, doc):
        self.year = doc["fy"]
        self.columns = tuple(doc["columns"])
        self.early = doc["early"]
        self.settled_share = doc["settledShare"]
        self.still_filing = doc["stillFiling"]
        self.methods_version = doc["methods_version"]
        self.rows = [{"year": self.year, **dict(zip(self.columns, r))} for r in doc["hospitals"]]
        self._by_ccn = {r["ccn"]: r for r in self.rows}

    def row(self, ccn):
        return self._by_ccn.get(ccn)

    def value(self, ccn, metric):
        """A `Value` for one hospital's metric, or None when the hospital has no report this year. Its `value` is
        None when the cell is blank (zero or not reported: the cost report doesn't say which). `early` is set only
        for S-10 metrics in an early year."""
        if metric not in UNITS:
            raise KeyError(f"no HCRIS column {metric!r}")
        r = self.row(ccn)
        if r is None:
            return None
        return Value(self.year, r[metric], r["status_label"], r["period_begin"], r["period_end"],
                     self.early and metric in S10_METRICS)


class Panel:
    """Several years' files, oldest first. `series(ccn, metric)`: the hospital's `Value`s, one per year it filed."""

    def __init__(self, docs):
        self.years = sorted((Year(d) for d in docs), key=lambda y: y.year)
        self._by_year = {y.year: y for y in self.years}
        if len(self._by_year) != len(self.years):
            raise ValueError("two files for one HCRIS year")

    def year(self, year):
        return self._by_year.get(year)

    def series(self, ccn, metric):
        return [v for v in (y.value(ccn, metric) for y in self.years) if v is not None]
