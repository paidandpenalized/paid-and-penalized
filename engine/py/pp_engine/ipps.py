"""Readers for the IPPS final-rule files behind the HACRP dollar estimates, over text (the caller reads the bytes and
decodes them as Windows-1252, as CMS writes them). Every reader goes through `parse.table` or `parse.rows`, so a
layout change raises SchemaError rather than producing wrong values.

Two final rules are read: FY2026's, for the estimates the pages show, and FY2024's, for the back-test against hospitals'
cost reports. `read_rates` takes the year (`fy`) and returns its settings (`IMPACT_YEARS`) with the rates; the impact
file is read by those rates (`read_payment_inputs`), so the two cannot be of different years, and `read_vbp_factors`
takes the year for the Table 16B factor heading. The year picks the impact file's column names and other settings.
Column names are the data files' own headers, which differ from the impact file's README in places (the README says
`Wage Index`, the file `FY 2026 Wage Index`; README `UCP and IHS/PR Supplemental Payment Per Claim Amount`, file `UCP
Per Claim Amount`; and so on). They are matched exactly, year stamps included, so another year's file fails instead of
being read as this one.
"""
import math
import re
from typing import NamedTuple, Optional

from pp_engine.parse import SchemaError, index_by_ccn, num, rows, squash, table, to_int

# --- Tables 1A-1E (standardized amounts) -------------------------------------------------------------------------------

# A rate pair is (labor, nonlabor) dollars. The four keys are the table's scenarios: quality data submitted or not,
# meaningful EHR user or not. `rate_key` maps a hospital's two flags to a key; `_scenario_key` reads a key off a
# table heading; these two functions are the only places the mapping is written.
RATE_KEYS = ("qe", "qn", "ne", "nn")  # q/n = quality data submitted / not; e/n = EHR user / not
TABLE_TITLE = re.compile(r"table (1[a-e])\b", re.I)
# A scenario heading's update: "(Update = 2.6 Percent)"; a heading may drop the word: "(Update = 3.1)".
UPDATE = re.compile(r"\(update\s*=\s*(-?\d+(?:\.\d+)?)(?:\s*percent)?\)")


def rate_key(quality, ehr):
    """The scenario key for a hospital's Proxy Quality Reduction and Proxy EHR Reduction flags (1 = the update is
    reduced: quality data not submitted, not a meaningful EHR user): (0, 0) -> "qe", (0, 1) -> "qn", (1, 0) -> "ne",
    (1, 1) -> "nn". A missing or other value raises, since the hospital could not be priced."""
    if quality not in (0, 1) or ehr not in (0, 1):
        raise SchemaError(f"rate key: quality flag {quality!r} and EHR flag {ehr!r} are not both 0 or 1")
    return ("n" if quality else "q") + ("n" if ehr else "e")


def _scenario_key(text, label):
    """The key a scenario header cell names."""
    t = squash(text).lower()
    if "did not submit quality data" in t:
        quality = "n"
    elif "submitted quality data" in t:
        quality = "q"
    else:
        quality = None
    if "not a meaningful ehr user" in t:
        ehr = "n"
    elif "a meaningful ehr user" in t:
        ehr = "e"
    else:
        ehr = None
    if quality is None or ehr is None:
        raise SchemaError(f"{label}: unrecognised scenario {squash(text)!r}")
    return quality + ehr


def _scenario_update(text, label):
    """The year's update, in percent, a scenario heading states: '(Update = 2.6 Percent)' -> 2.6, '(Update = -0.7
    Percent)' -> -0.7, '(Update = 3.1)' -> 3.1. The heading is the rate's own source for it, the one number the rule
    applies to a hospital-specific rate."""
    m = UPDATE.search(squash(text).lower())
    if not m:
        raise SchemaError(f"{label}: no update stated in the scenario heading {squash(text)!r}")
    return float(m.group(1))


def _is(cell, *words):
    return squash(cell).lower() in words


def _rate(cell, label):
    v = num(cell)
    if v is None or not v > 0:
        raise SchemaError(f"{label}: no rate in {cell!r}")
    return v


def _sections(grid):
    """{'1A': [rows of Table 1A], ...}: each table's rows, from its 'TABLE 1x' title row to the next title row."""
    out, current = {}, None
    for row in grid:
        title = TABLE_TITLE.match(squash(row[0])) if row else None
        if title:
            name = title.group(1).upper()
            if name in out:
                raise SchemaError(f"Tables 1A-1E: Table {name} appears twice")
            current = out[name] = []
        if current is not None:
            current.append(row)
    return out


def _operating(section, name):
    """(`{key: (labor, nonlabor)}`, `{key: update percent}`) from a Table 1A or 1B section: the row of labor/nonlabor
    headings, the scenario names (with their updates) on the row above it, the rates on the row below. A pair whose
    cells both say 'Not Applicable' is skipped."""
    label = f"Tables 1A-1E, Table {name}"
    heads = [i for i, row in enumerate(section) if any(_is(c, "labor-related", "labor") for c in row)]
    if len(heads) != 1 or heads[0] < 1 or heads[0] + 1 >= len(section):
        raise SchemaError(f"{label}: expected one row of labor/nonlabor headings with scenarios above and rates below")
    names, heads_row, values = section[heads[0] - 1], section[heads[0]], section[heads[0] + 1]
    out, updates = {}, {}
    for j, cell in enumerate(heads_row):
        if not _is(cell, "labor-related", "labor"):
            continue
        if j + 1 >= len(heads_row) or not _is(heads_row[j + 1], "nonlabor-related", "nonlabor"):
            raise SchemaError(f"{label}: a labor column without its nonlabor column")
        cells = [(values[k] if k < len(values) else "") for k in (j, j + 1)]
        if all(_is(c, "not applicable") for c in cells):
            continue
        heading = names[j] if j < len(names) else ""
        key = _scenario_key(heading, label)
        if key in out:
            raise SchemaError(f"{label}: scenario {key!r} appears twice")
        out[key] = (_rate(cells[0], label), _rate(cells[1], label))
        updates[key] = _scenario_update(heading, label)
    return out, updates


def _capital(section):
    label = "Tables 1A-1E, Table 1D"
    heads = [(i, j) for i, row in enumerate(section) for j, c in enumerate(row) if _is(c, "rate")]
    if len(heads) != 1 or heads[0][0] + 1 >= len(section):
        raise SchemaError(f"{label}: expected one 'Rate' heading with the rate on the row below")
    i, j = heads[0]
    row = section[i + 1]
    return _rate(row[j] if j < len(row) else "", label)


def read_rates(text, fy=2026):
    """Tables 1A-1E (tab-delimited, read as CSV: one scenario heading is a quoted cell with a line break) ->
    `{"operating": {"1A": {key: (labor, nonlabor)}, "1B": {...}}, "capital": rate, "mdh_factor": {key: multiplier},
    "uc_pool": dollars, "year": ImpactYear}`.
    1A is for a wage index above 1 (66% labor in FY2026), 1B for 1 or below (62%). Table 1C (Puerto Rico's) is not read:
    no program applies to a Puerto Rico hospital, so none is priced on it (`dollars.refuse_puerto_rico`). The keys
    (`RATE_KEYS`, chosen with `rate_key`) come from each scenario's heading text, not its position, so a reordered table
    still prices right. Capital is Table 1D's single federal rate. Each scenario's update for the year in percent
    ('Update = 2.6 Percent' -> 2.6) is read from the headings of Tables 1A and 1B, which state it alike: a table that
    states another update for the same scenario raises. `mdh_factor` is the
    multiplier that brings a Medicare-dependent hospital's hospital-specific rate, as the year's impact file gives it
    (`fy`), to the rule's year: where the file's rate is the year before's (`mdh_rate_prior_year`), 1 + the scenario's
    update times the rule's budget-neutrality factors for hospital-specific rates (`hsp_budget_neutrality`), else 1.
    `uc_pool` is the year's uncompensated care pool (`ImpactYear.uc_pool`), which the impact file's `UCP_ADJ` shares
    out; it and the budget-neutrality factors are stated in the rule's text, not in these tables.
    `year` is the `ImpactYear` record the rates were read for. It is the one place a year is named: the impact file is
    read by it (`read_payment_inputs` takes these rates, not a year of its own) and the national checks are read from it
    (`dollars.checks`), so the rates, the hospitals' inputs and the checks cannot be of different years.
    The layout is the same in FY2024's and FY2026's files; the labor shares are not (FY2024's Table 1A is 67.6% labor),
    and are not read."""
    sections = _sections(rows(text, "\t"))
    for name in ("1A", "1B", "1D"):
        if name not in sections:
            raise SchemaError(f"Tables 1A-1E: Table {name} not found")
    (rates_a, updates_a), (rates_b, updates_b) = _operating(sections["1A"], "1A"), _operating(sections["1B"], "1B")
    operating = {"1A": rates_a, "1B": rates_b}
    for name in ("1A", "1B"):
        if sorted(operating[name]) != sorted(RATE_KEYS):
            raise SchemaError(f"Tables 1A-1E, Table {name}: expected the four scenarios, found {sorted(operating[name])}")
    for key, percent in updates_b.items():
        if percent != updates_a[key]:
            raise SchemaError(f"Tables 1A-1E, Table 1B: update {percent} for scenario {key!r}, "
                              f"Table 1A states {updates_a[key]}")
    year = impact_year(fy)
    mdh_factor = {key: ((1.0 + percent / 100.0) * math.prod(year.hsp_budget_neutrality)
                        if year.mdh_rate_prior_year else 1.0) for key, percent in updates_a.items()}
    return {"operating": operating, "capital": _capital(sections["1D"]), "mdh_factor": mdh_factor,
            "uc_pool": year.uc_pool, "year": year}


# --- the impact file -------------------------------------------------------------------------------------------------

# Provider Type codes paid as sole community hospitals: 16 SCH, 17 SCH/RRC, and the essential access community
# hospitals, 21 EACH and 22 EACH/RRC. 42 CFR 412.109(a): "For payment purposes, CMS treats as a sole community
# hospital any hospital that is located in a rural area" and was designated an EACH; the impact file agrees (every
# row of type 22 carries an SCH hospital-specific rate, `HSP Rate`, which only SCHs have).
SCH_TYPES = frozenset({16, 17, 21, 22})
PUERTO_RICO = "40"  # state code, the CCN's first two digits (dollars.refuse_puerto_rico; the back-test's exclusions)
MARYLAND_CCN = "21"  # Maryland's, likewise (the back-test's exclusions)

# Provider Type codes of Medicare-dependent hospitals in FY2024's file (its README: "14= Medicare Dependent Hospital
# (MDH); 15=MDH/RRC"). FY2026's file marks them in a column of its own instead (`MDH Flag, CAA 2024`): the FY2026 rule
# modeled the status expiring, and the law reinstated it after.
MDH_TYPES = frozenset({14, 15})

class CheckTargets(NamedTuple):
    """The ranges a year's national sums must land in (`dollars.checks`). Each is a fact of the year's final rule, so it
    is kept with the year's other settings. None is fitted to the estimate: if a check fails, find the cause; a range is
    not widened to make it pass."""
    hrrp_share: tuple  # HRRP dollars lost over B of the penalized hospitals
    outlier_share: tuple  # operating outliers over the federal DRG payment plus operating outliers
    uc_pool_share: tuple  # uncompensated care over the year's pool (`ImpactYear.uc_pool`)


_FY2026_CHECKS = CheckTargets(
    # HRRP: CMS's published "penalty as a share of payments", 0.44%: the All Hospitals row of Table I.G.7.-01 in the
    # HRRP impact discussion of the FY2026 IPPS/LTCH PPS final rule (90 FR 37265-37266; the rule numbers its HACRP
    # impact table I.G.7.-01 too, so the program and row name the table). The row reads 2,797 eligible, 2,304 penalized,
    # 82.37% penalized, 0.44%. The pinned HRRP supplemental file lists 2,945 hospitals, more than the table's 2,797
    # eligible. Its 2,304 below a factor of 1 equal the table's penalized, so by count the 148 listed but not counted
    # are among the 641 listed at 1 (the table's 493 eligible and unpenalized are the rest). This check divides by the
    # penalized hospitals' B alone, so those 148 do not enter it. CMS's words say the share is over every eligible
    # hospital's payments: "The results in Table I.G.7.-01 include 2,797 non-Maryland hospitals estimated as eligible to
    # receive a penalty during the performance period.", and the column's footnote: "calculated as the sum of all
    # penalties for the group of hospitals with that characteristic divided by total base operating DRG payments for all
    # those hospitals". CMS's rows say otherwise. On the pinned FY2026 files the estimate's HRRP dollars over B are
    # 0.443% over the penalized hospitals and 0.387% over every hospital with an HRRP row; over the penalized hospitals
    # each of the table's nine census-division rows and its non-teaching row reproduces to within 0.01 percentage point,
    # and over all of them each runs 0.03 to 0.11 point low. So the check divides by the penalized hospitals' B
    # (`dollars.national`'s `hrrp_base`), the reading that reproduces CMS's published rows; docs/METHODS-LOG.md (dollars
    # methods_version 4) records that CMS's footnote reads the other way. The band is 0.04 percentage points each way.
    # Because the denominator was chosen to match CMS's figure, passing proves little: it rules out a gross error in B
    # or in the factor join. The test of the HRRP dollars is the back-test against cost-report HRRP dollars.
    hrrp_share=(0.0040, 0.0048),
    # Operating outliers: the FY2026 final rule sets the outlier threshold so "outlier payments ... would equal 5.1
    # percent of operating DRG payments" (90 FR 37228), the share CMS figures as "total outlier payments" over "total
    # operating Federal payments plus total outlier payments" (90 FR 37227). The check holds the same ratio of the
    # estimate's sums, operating outliers over the federal DRG payment plus operating outliers, to 5.1% and 0.5
    # percentage point either way: the impact file's factors are CMS's own, so the ratio should land near CMS's target,
    # and the half point allows for the estimate's hospitals (the HACRP file's) being fewer than CMS's (every IPPS
    # claim). The band stops short of the statute's 6% ceiling, which the misread base (the factor taken on IME and DSH
    # too) went past. Set before the ratio was computed on this base (2026-10-23).
    outlier_share=(0.046, 0.056),
    # Uncompensated care: the sum of the estimated hospitals' payments over the final rule's pool, Factor 1 x Factor 2
    # (`ImpactYear.uc_pool`: $7,713,127,500, 90 FR 36886-36889). The impact file's factors share out the whole pool, so
    # the sum falls short only by the hospitals outside the estimate: Puerto Rico's, those not in the HACRP file and
    # those without inputs. More than 5% short would mean DSH hospitals dropped in the join. It can pass 1 only by the
    # per-claim supplemental payments of IHS and Tribal hospitals (`dollars._uncompensated_care`), part of the roughly
    # $108 million of supplemental payments in the rule's $7.821 billion total (90 FR 37262), so 2% over is the most it
    # can be. Set before the sum was computed (2026-10-23).
    uc_pool_share=(0.95, 1.02))


# How each final rule's impact file is read, the figures the rule states in its text that the file's columns need, and
# the national checks held to the year's estimate. Both files share most column names; the year-stamped ones and the MDH
# and low-volume columns differ.
class ImpactYear(NamedTuple):
    fy: int  # the final rule's year
    columns: dict  # the keys of a hospital's inputs -> the file's own header texts
    # Whether the file flags Medicare-dependent hospitals in a column of its own (else they are the Provider Types of
    # MDH_TYPES, and `HSP Rate` is theirs).
    mdh_flag: bool
    # Whether the file's MDH hospital-specific rate is the year before the rule's, and so takes the year's update and
    # `hsp_budget_neutrality`: FY2026's column is the FY2025 rate ("HSP Rate updated to FY 2025 for MDH providers");
    # FY2024's README says its `HSP Rate` is "updated to FY 2024 for SCH & MDH providers", so it takes neither.
    mdh_rate_prior_year: bool
    # The factors the rule applies to a hospital-specific rate besides the update, where the file's MDH rate is the year
    # before's (else unused). FY2026 (90 FR 37232, Addendum II.D.3.b): "the hospital specific-rate for an SCH or MDH is
    # adjusted by the MS-DRG reclassification and recalibration budget neutrality factor", 0.998580, and an SCH's "by
    # the MS-DRG 10-percent cap budget neutrality factor", 0.999897 (both from the rule's "Summary of FY 2026 Budget
    # Neutrality Factors", 90 FR 37218); and (90 FR 37231) "if the MDH program were to be extended by law beyond
    # September 30, 2025, into FY 2026, the updates to the hospital-specific rates for SCHs as described in this section
    # would also apply to the hospital-specific rates for MDHs for FY 2026". The law extended it. CMS's own numbers
    # agree. Over the hospitals with the full update in both years, the median ratio of the pinned FY2027 impact file's
    # rates to this file's is 1.046405 for the MDHs (two years of updates, from FY2025) and 1.021444 for the SCHs (one);
    # their quotient, 1.0244375, is the FY2026 factor, and 1.026 x 0.998580 x 0.999897 = 1.0244376. No wage-index
    # factor: hospital-specific rates are not wage-adjusted.
    hsp_budget_neutrality: tuple
    # The year's uncompensated care pool in dollars, Factor 1 x Factor 2, which each hospital's Factor 3 (`UCP_ADJ`)
    # shares out: "Factor 3 is applied to the product of Factor 1 and Factor 2 to determine the amount of the
    # uncompensated care payment that each eligible hospital will receive" (FY2026 rule, 90 FR 36889-36890). FY2026:
    # "The final FY 2026 uncompensated care amount is $12,412,500,000 * 0.6214 = $ 7,713,127,500." (90 FR 36889).
    # FY2024: "$10,015,191,021.88 * 0.5929 = $5,938,006,756.87" (FY2024 rule, 88 FR 59001). In each pinned file the
    # factors add up to 1.
    uc_pool: float
    # The claims year of the file's volume (`cases`, `bills`, case-mix), two years before the rule's: FY2026's file uses
    # FY2024 MedPAR; FY2024's, "MARCH 2023 UPDATE OF FY 2022 MEDPAR".
    volume_fy: int
    # The national checks the year's estimate is held to; None for a year whose estimate is not published (FY2024's is
    # the back-test's, held to the cost reports instead).
    checks: Optional[CheckTargets]


_SHARED_COLUMNS = {
    "ccn": "Provider Number",
    "bills": "Bills",  # Medicare cases in the year's MedPAR (two years before the rule): per-stay and per-claim figures
    "cola": "Cost of Living Adjustment",  # operating
    "quality": "Proxy Quality Reduction",  # 1 = reduced update (failed quality reporting)
    "ehr": "Proxy EHR Reduction",  # 1 = reduced update (not a meaningful EHR user)
    "ptype": "Provider Type",
    "hsp": "HSP Rate",  # hospital-specific rate, $/case (SCH; in FY2024's file, MDH too)
    "ime_op": "TCHOP",  # fractions
    "ime_cap": "TCHCP",
    "dsh_op": "DSHOPP",
    "dsh_cap": "DSHCPP",
    "ucp_per_claim": "UCP Per Claim Amount",  # $/claim (README: and the IHS/PR supplemental amount)
    "ucp_factor": "UCP_ADJ",  # Factor 3: the hospital's share of `uc_pool`; blank for a hospital that has none
    "outlier_op": "OUTFACT_F",  # fractions of federal payments
    "outlier_cap": "COUTFACT_F",
    "gaf": "GAF",
    "beds": "Beds",  # README: "The number of total beds obtained from cost report data"; zero may mean unavailable
}
IMPACT_YEARS = {y.fy: y for y in (
    ImpactYear(2026, {
        **_SHARED_COLUMNS,
        "cases": "CASETA43",  # transfer-adjusted cases (grouper V43): these price B
        "cmi": "TACMIV43",  # transfer-adjusted case-mix index: prices B
        "cmi_hsp": "CMIV43",  # README: "generally applicable for SCH and MDH providers paid under their HSP rate"
        "ime_cases": "IME_CASETA43",  # Medicare Advantage cases of teaching hospitals paid IME on them; blank for none
        "ime_cmi": "IME_TACMIV43",  # their case-mix
        "wi": "FY 2026 Wage Index",
        "mdh": "MDH Flag, CAA 2024",  # Y or blank
        "hsp_mdh": "HSP Rate for MDHs, FY 2025 extension",  # $/case
        "low_volume": "Low-Volume Hospital Payment Adjustment, FY 2025 extension",  # multiplier; 1 = none
    }, mdh_flag=True, mdh_rate_prior_year=True, hsp_budget_neutrality=(0.998580, 0.999897), uc_pool=7_713_127_500.0,
       volume_fy=2024, checks=_FY2026_CHECKS),
    ImpactYear(2024, {
        **_SHARED_COLUMNS,
        "cases": "CASETA41",  # README: "Transfer Adjusted Cases under Grouper V41 and FY 2024 Post-Acute Transfer Policy"
        "cmi": "TACMIV41",
        "cmi_hsp": "CMIV41",  # README: "generally applicable for SCH & MDH providers paid under their HSP rate"
        "ime_cases": "IME_CASETA41",
        "ime_cmi": "IME_TACMIV41",
        "wi": "FY 2024 Wage Index",
        "low_volume": "Low Volume Hospital Adjustment",  # multiplier; 1 = none (the expanded tiers ran all of FY2024)
    }, mdh_flag=False, mdh_rate_prior_year=False, hsp_budget_neutrality=(), uc_pool=5_938_006_756.87,
       volume_fy=2022, checks=None),
)}
_NOT_FLOAT = ("ccn", "bills", "quality", "ehr", "ptype", "mdh", "beds")


def _finite(s):
    v = num(s)
    if v is not None and not math.isfinite(v):
        raise ValueError(f"{s!r} is not finite")
    return v


def _flag(s):
    """A proxy reduction flag: exactly "0", "1" or blank (None). The number reader would also take 1.0, "$1" or 1.4
    (which `to_int` rounds to 1); a flag that is not written as 0 or 1 is not read as one."""
    t = s.strip()
    if t not in ("", "0", "1"):
        raise ValueError(f"flag {s!r} is not 0, 1 or blank")
    return int(t) if t else None


def impact_year(fy):
    """The settings of the final rule of year `fy` (`IMPACT_YEARS`); another year raises."""
    if fy not in IMPACT_YEARS:
        raise SchemaError(f"no reader settings for the FY{fy} final rule (have {sorted(IMPACT_YEARS)})")
    return IMPACT_YEARS[fy]


def rates_year(rates):
    """The `ImpactYear` a rates table (`read_rates`) was read for. A table not from `read_rates` raises."""
    try:
        return rates["year"]
    except (KeyError, TypeError):
        raise SchemaError("the rates carry no year: they must be the table `read_rates` returned") from None


def read_payment_inputs(text, rates):
    """A final-rule IPPS impact file (tab-delimited) -> {ccn: inputs}, one dict per hospital with the keys of
    the year's `IMPACT_YEARS` columns (less `ccn`) plus the derived `sch`. `rates` is the table `read_rates` returned
    for the same rule: the year it was read for (`rates_year`) picks the column names, and there is no other way to
    name a year, so the inputs cannot be of another year than the rates they are priced with. Numbers are floats
    (`bills`, `ptype`, `quality`, `ehr` and `beds` ints); a blank cell is None, a zero stays 0. `quality` and `ehr` are
    the file's proxy flags, 1 = reduced update (`rate_key` turns them into a rate key).
    `sch` is `ptype in SCH_TYPES`. The file's Puerto Rico rows are read like the rest; no program applies to them
    (`dollars.refuse_puerto_rico`).

    FY2026: `mdh` is the 'MDH Flag, CAA 2024' column being 'Y'. The law reinstated MDH status and the expanded
    low-volume tiers for all of FY2026, so `mdh`, `hsp_mdh` and `low_volume` read the columns the file stamps 'CAA 2024'
    / 'FY 2025 extension'. The column named for FY2026 (`Low Volume Hospital Adjustment`) models the tiers' expiry and is
    1.0 for every hospital; it is not read.

    FY2024: `mdh` is `ptype in MDH_TYPES`, `hsp_mdh` the `HSP Rate` of those rows (None elsewhere), and `low_volume`
    the `Low Volume Hospital Adjustment` column; both programs were in force for the whole year."""
    year = rates_year(rates)
    columns = year.columns
    label = f"FY{year.fy} impact file"
    floats = tuple(k for k in columns if k not in _NOT_FLOAT)

    def build(r):
        def read(key, reader=_finite):
            try:
                return reader(r[key])
            except (ValueError, OverflowError) as e:  # int() of an infinite count raises OverflowError, not ValueError
                raise SchemaError(f"{label}: unreadable value for {r['ccn']} in {columns[key]!r}: {e}") from None
        out = {k: read(k) for k in floats}
        out["bills"] = read("bills", to_int)
        out["quality"], out["ehr"] = read("quality", _flag), read("ehr", _flag)
        out["ptype"] = read("ptype", to_int)
        out["beds"] = read("beds", to_int)
        out["sch"] = out["ptype"] in SCH_TYPES
        if year.mdh_flag:
            out["mdh"] = r["mdh"].upper() == "Y"
        else:
            out["mdh"] = out["ptype"] in MDH_TYPES
            out["hsp_mdh"] = out["hsp"] if out["mdh"] else None
        return out
    return index_by_ccn(table(rows(text, "\t"), columns["ccn"], columns, label), build, label)


# --- the HRRP and VBP factor files -----------------------------------------------------------------------------------

# What a program's payment adjustment factor can be, checked where it is read: a column misread (a percentage, a dollar
# figure, another year's file) stops the build instead of pricing a hospital on it. HRRP: the factor is the higher of
# the ratio or the floor adjustment factor, 0.97 from FY 2015 (42 CFR 412.154(c)), and a ratio is 1 minus a share, so
# at most 1. HVBP: the 2% withheld puts a hospital's factor at 0.98 or more and the incentive payment lifts it a little
# above 1; 0.9 to 1.1 is a sanity bound well outside what CMS publishes, not a rule.
HRRP_FACTOR_RANGE = (0.97, 1.0)
VBP_FACTOR_RANGE = (0.9, 1.1)


def _factors(text, ccn_header, factor_header, label, allowed):
    low, high = allowed

    def build(r):
        try:
            v = _finite(r["factor"])
        except ValueError:
            v = None
        if v is None or not v > 0:
            raise SchemaError(f"{label}: no usable factor for {r['ccn']} ({r['factor']!r})")
        if not low <= v <= high:
            raise SchemaError(f"{label}: factor {v} for {r['ccn']} is outside {low} to {high}")
        return v
    return index_by_ccn(table(rows(text, "\t"), ccn_header, {"ccn": ccn_header, "factor": factor_header}, label),
                        build, label)


def read_hrrp_factors(text):
    """An HRRP supplemental file's factor table (tab-delimited: FY2026's `FR FY 2026.txt`, FY2024's `... FR FY 2024 tab
    .txt`; the headers are the same) -> {ccn: the year's payment adjustment factor}, a multiplier of 1 or less (CMS's
    published figure: the reduction is 1 minus it), 0.97 to 1 (`HRRP_FACTOR_RANGE`). Footer rows are skipped."""
    return _factors(text, "Hospital CCN", "Payment adjustment factor", "HRRP supplemental file", HRRP_FACTOR_RANGE)


def read_vbp_factors(text, fy=2026):
    """Table 16B (tab-delimited) -> {ccn: the actual hospital VBP adjustment factor for `fy`}, a multiplier about 1
    (CMS's published figure; Table 16A's were proxies), 0.9 to 1.1 (`VBP_FACTOR_RANGE`). The factor's heading names the
    year ('Actual FY 2026 Hospital VBP Adjustment Factor'), so another year's table fails. The footnote rows are
    skipped."""
    return _factors(text, "CMS Certification Number (CCN)", f"Actual FY {fy} Hospital VBP Adjustment Factor",
                    f"FY{fy} Table 16B", VBP_FACTOR_RANGE)
