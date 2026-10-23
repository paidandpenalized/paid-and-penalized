"""Build the dollars dataset from the pinned inputs and write data/emitted/dollars/fy<YYYY>/dollars.json.

`python3 -I pipeline/py/run.py emit` (or `make emit`) runs this after the hospital master. A rebuild that changes
nothing keeps the committed built_at, so git stays clean. The `hac_count` check reads the Yes count in the HACRP site's
emitted file, so `make emit`, which runs that site's emitter first, is the way to rebuild after a re-pin (a site
file built from an older pin is refused). A failing check writes nothing and exits 1.

The file holds, for every hospital in the HACRP file, the estimate pp_engine.dollars makes of what Medicare pays it for
the year and how much HRRP, HVBP and the HAC Reduction Program move that (a model, not a bill: see the engine's
docstring and docs/METHODS-LOG.md, `dollars`), then the national sums, the sums over the hospitals the HACRP site
counts in its headline, the checks that hold the sums against what CMS publishes, and `bands`: the likely ranges, from
the back-test of the same estimate on FY2024 against hospitals' cost reports (pp_pipeline.backtest_dollars), whose
checks join the others. Each estimated hospital carries its `stratum`, the row of `bands` its ranges come from. It
lives at the family level because more than one site reads it.
"""
import sys
from datetime import datetime, timezone

from pp_engine import bands, dollars
from pp_engine.contract import envelope, source_manifest_hash
from pp_pipeline import backtest_dollars
from pp_pipeline.emit_hospital import HACRP, read_hacrp
from pp_pipeline.files import EMITTED_DIR, REPO_ROOT, manifest_entry, read_json, read_manifest, write_emitted
from pp_pipeline.ipps_pins import FY, HRRP, IMPACT, RATES, VBP, hrrp_factors, payment_inputs, rates, vbp_factors

SCHEMA_VERSION, METHODS_VERSION = 2, 2
SOURCES = (HACRP, IMPACT, RATES, HRRP, VBP, *backtest_dollars.SOURCES)  # the estimate's inputs, then the back-test's
SCHEMA = "dollars.schema.json"

# The years the estimate is built on. The rates (Tables 1A-1E) and the impact file are the final rule's (`FY`, in
# ipps_pins), and the program year of the HACRP file must equal it; the impact file's cases and case-mix are FY2024
# MedPAR claims.
VOLUME_FY = 2024
# The last day of the extension of Medicare-dependent hospital status and of the expanded low-volume-hospital tiers
# (Consolidated Appropriations Act, 2026; CMS's MLN Matters MM14415). The impact file's FY2025-extension columns,
# which the estimate reads, model both in force for the whole year.
MDH_END = "2026-12-31"
LOW_VOLUME_END = "2026-12-31"
NTAP = "excluded"  # new-technology add-on payments are in no figure (dollars.py, the ASSUMPTION at the federal payment)

# Pennsylvania Rural Health Model participants. CMS publishes no FY2026 participant file with CCNs, so no hospital gets
# the `parhm` status yet; a published list would be a pinned input and replace this.
PARHM = frozenset()

# Hospitals that take adjustment factor 1 because a program file does not list them. Hospitals outside HVBP are common
# and legitimate (too few measures to score, new hospitals), so neither count is an error by itself; each is capped so a
# later file with more is looked at before it ships. Both counts are over estimated hospitals, on the pinned FY2026 files
# (2026-10-22): 43 with no row in the HRRP supplemental file (38 of them not cut, 5 cut) and 524 with no row in Table 16B.
HRRP_UNLISTED_MAX = 43
VBP_UNLISTED_MAX = 524


def camel(key):
    """`at_stake` -> `atStake`: the repo's JSON keys are camelCase."""
    head, *tail = key.split("_")
    return head + "".join(word.capitalize() for word in tail)


def _names(keys):
    """((row key, JSON key), ...): the camelCase names, worked out once rather than for every row."""
    return tuple((key, camel(key)) for key in keys)


# A row's fields in the JSON, in the order the file lists them; an estimated row also has `parts`.
BARE_FIELDS = _names(("ccn", "status", "cut", "hrrp_listed", "vbp_listed"))
ESTIMATED_FIELDS = _names(("ccn", "status", "cut", "cases", "bills", "base", "total", "hrrp_factor", "vbp_factor",
                           "hrrp_listed", "vbp_listed", "hrrp", "hvbp", "after", "at_stake", "hac", "net", "stratum"))
PART_FIELDS = _names(dollars.PARTS)


def with_stratum(row, inp):
    """An estimated `hospital_row` with its `stratum` (pp_engine.bands: the impact file's bed count, and whether it is a
    sole community or Medicare-dependent hospital), the row of `bands` its likely ranges come from; other rows as
    they are."""
    if row["status"] != "estimated":
        return row
    found = bands.stratum(inp["beds"], inp["sch"], inp["mdh"])
    if found is None:
        raise ValueError(f"an estimated hospital ({row['ccn'][:2]}xxxx) has no bed count in the impact file")
    return {**row, "stratum": found}


def unlisted_counts(hospital_rows):
    """(estimated hospitals with no HRRP row, estimated hospitals with no Table 16B row), over `hospital_row`s."""
    estimated = [r for r in hospital_rows if r["status"] == "estimated"]
    return (sum(not r["hrrp_listed"] for r in estimated), sum(not r["vbp_listed"] for r in estimated))


def enforce_caps(hospital_rows):
    """Raise unless both `unlisted_counts` are within their caps (HRRP_UNLISTED_MAX, VBP_UNLISTED_MAX)."""
    no_hrrp, no_vbp = unlisted_counts(hospital_rows)
    for count, cap, where in ((no_hrrp, HRRP_UNLISTED_MAX, "the HRRP supplemental file"),
                              (no_vbp, VBP_UNLISTED_MAX, "Table 16B")):
        if count > cap:
            raise ValueError(f"{count} estimated hospitals are not in {where} (at most {cap} on the pinned files): "
                             "look at the new ones before raising the cap")


def hospital_json(row):
    """One hospital's JSON, a camelCase projection of its `hospital_row`: `{ccn, status, cut, hrrpListed, vbpListed}`,
    and for an "estimated" row also its cases, Medicare bills, the two factors it took (1 where the program file does
    not list it), the whole-dollar figures, its `stratum` and `parts`."""
    if row["status"] != "estimated":
        return {name: row[key] for key, name in BARE_FIELDS}
    return {**{name: row[key] for key, name in ESTIMATED_FIELDS},
            "parts": {name: row[key] for key, name in PART_FIELDS}}


def totals_json(nat):
    """A `dollars.national` dict, camelCase (its `parts` too)."""
    return {**{camel(k): v for k, v in nat.items()}, "parts": {camel(k): v for k, v in nat["parts"].items()}}


def yes_count(site, manifest):
    """The number of hospitals the HACRP site's emitted file `site` marks Yes, refused unless the file was built from
    the HACRP pin as `manifest` now has it: its `source_manifest` must equal the hash of the current entries for the
    sources it names, and one of them must be the HACRP pin. Otherwise the count is of an older file than the rows it
    is held against."""
    stale = HACRP not in site["sources"] or site["source_manifest"] != source_manifest_hash(
        [manifest_entry(pin, manifest) for pin in site["sources"]])
    if stale:
        raise ValueError("the HACRP site's emitted file was not built from the current HACRP pin: "
                         "emit the HACRP site first (`make emit` does)")
    return sum(h["paymentReduction"] == "Yes" for h in site["hospitals"])


def site_yes_count(fy):
    """The number of hospitals the HACRP site's emitted file (built from the same pin by the site's own reader) marks
    Yes. The `hac_count` check holds the rows here against it, so the rows are not checked against themselves."""
    path = EMITTED_DIR / "hacrp" / f"fy{fy}" / "hacrp.json"
    if not path.exists():
        raise ValueError(f"{path.relative_to(REPO_ROOT)} is missing: emit the HACRP site first (`make emit` does)")
    return yes_count(read_json(path), read_manifest())


def build_from_pins(built_at):
    hacrp = read_hacrp()
    fy, records = hacrp["fy"], hacrp["records"]
    if fy != FY:
        raise ValueError(f"the HACRP file is for FY{fy}, the rates and impact file for FY{FY}")
    inputs, table_, hrrp, vbp = payment_inputs(), rates(), hrrp_factors(), vbp_factors()
    def built_row(r):
        inp = inputs.get(r["ccn"])
        return with_stratum(dollars.hospital_row(r["ccn"], r["state"], inp, table_, hrrp=hrrp.get(r["ccn"]),
                                                 vbp=vbp.get(r["ccn"]), cut=r["cut"], parhm=PARHM), inp)
    built = [built_row(r) for r in records]
    enforce_caps(built)
    ranges = backtest_dollars.bands_json()
    headline = [row for row, r in zip(built, records) if r["scored"] and r["decided"]]
    national = dollars.national(built)
    checks = dollars.checks(national, hacrp_yes=site_yes_count(fy)) + backtest_dollars.checks(ranges)
    return {
        **envelope(SCHEMA_VERSION, METHODS_VERSION, SOURCES, read_manifest(), built_at, fy),
        "assumptions": {"ratesFy": FY, "volumeFy": VOLUME_FY, "mdhEnd": MDH_END, "lowVolumeEnd": LOW_VOLUME_END,
                        "ntap": NTAP},
        "national": totals_json(national),
        "headline": totals_json(dollars.national(headline)),
        "checks": checks,
        "hospitals": [hospital_json(row) for row in built],
        "bands": ranges,
    }


def emitted_path(fy):
    return EMITTED_DIR / "dollars" / f"fy{fy}" / "dollars.json"


def committed_path():
    """Where the dollars for the HACRP file's year live."""
    return emitted_path(read_hacrp()["fy"])


def main():
    """Build, hold the national sums against the checks, and only then write. A failing check writes nothing (the
    committed file stays as it was), lists the failures and returns 1: a file that fails its own checks is not
    published, and nothing downstream reads it half-trusted."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = build_from_pins(now)
    path = emitted_path(fresh["fy"])
    failed = [c for c in fresh["checks"] if not c["pass"]]
    if failed:
        print(f"not written ({path.relative_to(REPO_ROOT)} left as it was); checks failing: "
              + "; ".join(f"{c['id']} {c['value']} outside {c['low']} to {c['high']}" for c in failed), file=sys.stderr)
        return 1
    out = write_emitted(path, fresh, SCHEMA)
    print(f"wrote {path.relative_to(REPO_ROOT)}: {len(out['hospitals'])} hospitals, built_at {out['built_at']}; "
          "checks failing: none")
    return 0
