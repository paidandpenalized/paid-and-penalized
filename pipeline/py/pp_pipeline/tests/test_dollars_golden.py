"""The dollars dataset (data/emitted/dollars/fy2026/dollars.json): the committed file equals a fresh build from the
pins, covers every hospital in the HACRP file once, passes its checks, and its headline counts agree with the HACRP
site's own. Counts asserted here are facts of the pinned bytes (a re-pin moves them on purpose); no hospital is named."""
import contextlib
import csv
import io
import unittest
from unittest import mock

from pp_engine import bands, dollars
from pp_engine.contract import camel, format_emitted, source_manifest_hash
from pp_engine.schema import validate
from pp_engine.tests.fixtures import assert_adds_up
from pp_pipeline import emit_dollars
from pp_pipeline.emit_dollars import (HRRP_UNLISTED_MAX, SCHEMA, VBP_UNLISTED_MAX, build_from_pins, committed_path,
                                      enforce_caps, site_yes_count, unlisted_counts, yes_count)
from pp_pipeline.emit_hospital import HACRP
from pp_pipeline.files import EMITTED_DIR, load_schemas, read_json, read_pinned_bytes
from pp_pipeline import ipps_pins
from pp_pipeline.ipps_pins import payment_inputs

PARTS = tuple(camel(k) for k in dollars.PARTS)  # the JSON's names; the schema states them independently
DOLLARS = ("base", "total", "hrrp", "hvbp", "after", "atStake", "hac", "net")
SNAKE = {camel(k): k for k in (*dollars.PARTS, "at_stake")}  # the JSON names that are not their row keys


def flat(h):
    """A committed hospital as the engine's flat row (parts at the top level), for `assert_adds_up`."""
    return {**{SNAKE.get(k, k): v for k, v in h.items() if k != "parts"}, **{SNAKE[k]: v for k, v in h["parts"].items()}}


def added_up(hospitals):
    """The sums of the estimated hospitals' dollar fields, which a national or headline total must equal."""
    return {k: sum(h[k] for h in hospitals if h["status"] == "estimated") for k in dollars.SUMMED}


def hacrp_file():
    """The HACRP pin's rows as CMS wrote them (read here with the csv module, apart from the emitter's reader)."""
    return list(csv.DictReader(io.StringIO(read_pinned_bytes(HACRP).decode("utf-8"))))


def scored(row):
    try:
        float(row["Total HAC Score"])
    except ValueError:
        return False
    return True


class Committed(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = committed_path()
        cls.committed = read_json(cls.path)
        cls.hospitals = cls.committed["hospitals"]

    def test_rebuild_equals_committed(self):
        # The whole file, envelope included (sources, source_manifest, fy), and in the emitter's layout, so `make emit`
        # on a clean tree leaves git clean. A rebuild that changes nothing keeps the committed built_at.
        fresh = build_from_pins("2099-01-01T00:00:00Z")
        self.assertEqual(format_emitted({**fresh, "built_at": self.committed["built_at"]}),
                         self.path.read_text(encoding="utf-8"))

    def test_the_committed_file_passes_its_schema(self):
        schemas = load_schemas()
        self.assertEqual(validate(schemas[SCHEMA], self.committed, schemas), [])

    def test_the_schema_holds_the_bands_to_their_shape(self):
        schemas = load_schemas()
        b = self.committed["bands"]
        hac = b["measures"]["hac"]
        # A few hospitals stand in for the file: only the bands differ between the variants.
        few = {**self.committed, "hospitals": self.hospitals[:3]}
        self.assertEqual(validate(schemas[SCHEMA], few, schemas), [])
        broken = (
            None,  # methods_version 2 always has its ranges
            {**b, "extra": 1},
            {k: v for k, v in b.items() if k != "national"},
            {**b, "measures": {**b["measures"], "hac": {**hac, "strata": [{**hac["strata"][0], "pool": "nearby"}]}}},
            {**b, "points": [{**b["points"][0], "stratum": "tiny/other"}]},
            {**b, "comparison": {**b["comparison"], "excluded": {**b["comparison"]["excluded"], "other": 1}}},
            {**b, "measures": {**b["measures"], "hac": {**hac, "overall": {k: v for k, v in hac["overall"].items()
                                                                           if k != "low"}}}},
        )
        for bad in broken:
            with self.subTest(bad=None if bad is None else sorted(bad)):
                self.assertNotEqual(validate(schemas[SCHEMA], {**few, "bands": bad}, schemas), [])
        row = next(h for h in self.hospitals if h["status"] == "estimated")
        self.assertNotEqual(validate(schemas[SCHEMA], {**few, "hospitals": [{**row, "stratum": "x"}]}, schemas), [])

    def test_it_lives_at_the_family_level_for_the_files_fiscal_year(self):
        fy = self.committed["fy"]
        self.assertEqual(self.path, EMITTED_DIR / "dollars" / f"fy{fy}" / "dollars.json")
        self.assertEqual({r["Fiscal Year"] for r in hacrp_file()}, {str(fy)})
        self.assertEqual((self.committed["schema_version"], self.committed["methods_version"]), (3, 3))
        self.assertEqual(self.committed["assumptions"], {"ratesFy": 2026, "volumeFy": 2024, "mdhEnd": "2026-12-31",
                                                         "lowVolumeEnd": "2026-12-31", "ntap": "excluded"})
        self.assertEqual(self.committed["bands"]["fy"], 2024)  # the back-test's year, two before the estimate's

    def test_every_hacrp_ccn_has_one_row(self):
        expected = [r["Facility ID"] for r in hacrp_file()]
        self.assertEqual(len(expected), len(set(expected)))
        self.assertEqual([h["ccn"] for h in self.hospitals], expected)
        self.assertEqual(sum(self.committed["national"]["byStatus"].values()), len(expected))

    def test_every_check_passes(self):
        nat = self.committed["national"]
        for c in self.committed["checks"]:
            self.assertTrue(c["pass"], c)
            self.assertTrue(c["low"] <= c["value"] <= c["high"], c)
        self.assertEqual([c["id"] for c in self.committed["checks"]],
                         ["hrrp_share", "vbp_net", "hac_share", "hac_count", "yes_unestimated", "backtest_hac_median",
                          "backtest_hospitals", "backtest_cut"])
        # The vbp_net check passes on an empty Table 16B join; and a share over a zero base has no value.
        self.assertGreater(nat["vbpBase"], 0)
        self.assertGreater(nat["hrrpBase"], 0)
        self.assertEqual(next(c for c in self.committed["checks"] if c["id"] == "hac_count")["value"],
                         sum(r["Payment Reduction"] == "Yes" for r in hacrp_file()))

    def test_missing_factor_rows_counted_and_capped(self):
        # Hospitals with no HRRP row or no Table 16B row take factor 1; both counts are within the stated caps, and
        # the caps are the pinned counts (2026-10-22), so a file with more fails the build.
        estimated = [h for h in self.hospitals if h["status"] == "estimated"]
        no_hrrp = [h for h in estimated if not h["hrrpListed"]]
        no_vbp = [h for h in estimated if not h["vbpListed"]]
        self.assertEqual((len(no_hrrp), len(no_vbp)), (HRRP_UNLISTED_MAX, VBP_UNLISTED_MAX))
        self.assertTrue(all(h["hrrpFactor"] == 1 and h["hrrp"] == 0 for h in no_hrrp))
        self.assertTrue(all(h["vbpFactor"] == 1 and h["hvbp"] == 0 for h in no_vbp))
        self.assertEqual(unlisted_counts(self.fresh_rows()), (len(no_hrrp), len(no_vbp)))
        enforce_caps(self.fresh_rows())  # at the cap: no error

    def fresh_rows(self):
        return [{"status": h["status"], "hrrp_listed": h["hrrpListed"], "vbp_listed": h["vbpListed"]}
                for h in self.hospitals]

    def test_headline_matches_the_scored_yes_count(self):
        # The headline's population is the HACRP site's: hospitals CMS scored and marked Yes or No. Its count of
        # cut hospitals equals the site's headline count, counted here from the CSV and from the site's own emitted file.
        head, rows = self.committed["headline"], hacrp_file()
        decided = [r for r in rows if scored(r) and r["Payment Reduction"] in ("Yes", "No")]
        yes = sum(r["Payment Reduction"] == "Yes" for r in decided)
        self.assertEqual(head["yes"], yes)
        site = read_json(EMITTED_DIR / "hacrp" / f"fy{self.committed['fy']}" / "hacrp.json")["hospitals"]
        self.assertEqual(head["yes"], sum(h["total"] is not None and h["paymentReduction"] == "Yes" for h in site))
        # A Yes with no score is outside the headline though inside the file's Yes count.
        self.assertLess(yes, sum(r["Payment Reduction"] == "Yes" for r in rows))
        # Same population, same sums: the headline is the rows of exactly those hospitals, added up.
        by_ccn = {h["ccn"]: h for h in self.hospitals}
        picked = [by_ccn[r["Facility ID"]] for r in decided]
        self.assertEqual({k: head[k] for k in dollars.SUMMED}, added_up(picked))
        self.assertEqual(head["hospitals"], sum(h["status"] == "estimated" for h in picked))
        self.assertLess(head["hospitals"], self.committed["national"]["hospitals"])
        self.assertLessEqual(-head["hac"], -self.committed["national"]["hac"])

    def test_dollar_keys_exist_only_on_estimated_rows(self):
        bare = {"ccn", "status", "cut", "hrrpListed", "vbpListed"}
        full = bare | {"cases", "bills", "hrrpFactor", "vbpFactor", "parts", "stratum"} | set(DOLLARS)
        for h in self.hospitals:
            self.assertEqual(set(h), full if h["status"] == "estimated" else bare, h["ccn"][:2])
            self.assertIs(type(h["cut"]), bool)
            if h["status"] == "estimated":
                self.assertEqual(list(h["parts"]), list(PARTS))
        statuses = self.committed["national"]["byStatus"]
        self.assertEqual({s: sum(h["status"] == s for h in self.hospitals) for s in statuses}, statuses)
        self.assertEqual(statuses["no-inputs"], 41)  # 9 of them cut: yes_unestimated's cap

    def test_every_row_adds_up_in_whole_dollars(self):
        for h in (h for h in self.hospitals if h["status"] == "estimated"):
            assert_adds_up(self, flat(h), h["ccn"][:2])
            self.assertLessEqual(h["hrrpFactor"], 1)

    def test_national_is_the_rows_added_up(self):
        nat = self.committed["national"]
        estimated = [h for h in self.hospitals if h["status"] == "estimated"]
        self.assertEqual(nat["hospitals"], len(estimated))
        self.assertEqual({k: nat[k] for k in dollars.SUMMED}, added_up(self.hospitals))
        self.assertEqual(nat["parts"], {k: sum(h["parts"][k] for h in estimated) for k in PARTS})
        self.assertEqual(nat["yes"], sum(h["cut"] for h in self.hospitals))
        self.assertEqual(nat["cut"], sum(h["cut"] for h in estimated))


class Strata(unittest.TestCase):
    """Each estimated hospital's `stratum` is the back-test stratum of its FY2026 impact-file row (bed count, and sole
    community or Medicare-dependent), one of the strata `bands` lists; the estimates do not depend on the back-test."""

    @classmethod
    def setUpClass(cls):
        cls.committed = read_json(committed_path())

    def test_the_stratum_is_the_impact_files_beds_and_kind(self):
        ids = [s["id"] for s in self.committed["bands"]["strata"]]
        self.assertEqual(ids, list(bands.STRATA))
        inputs = payment_inputs()
        estimated = [h for h in self.committed["hospitals"] if h["status"] == "estimated"]
        self.assertEqual(len(estimated), self.committed["national"]["hospitals"])
        for h in estimated:
            inp = inputs[h["ccn"]]
            if h["stratum"] == bands.ALL:  # no bed count (none on these pins)
                self.assertIsNone(bands.bed_band(inp["beds"]), h["ccn"][:2])
                continue
            band = next(b for b in self.committed["bands"]["strata"] if b["id"] == h["stratum"])
            self.assertGreaterEqual(inp["beds"], band["bedsMin"], h["ccn"][:2])
            self.assertTrue(band["bedsMax"] is None or inp["beds"] <= band["bedsMax"], h["ccn"][:2])
            self.assertEqual(band["schMdh"], inp["sch"] or inp["mdh"], h["ccn"][:2])
        self.assertFalse(any("stratum" in h for h in self.committed["hospitals"] if h["status"] != "estimated"))

    def test_a_hospital_with_no_bed_count_is_priced_and_takes_the_whole_sets_band(self):
        # Synthetic: an impact-file row (picked by property: the first estimated, neither SCH nor MDH) under an invented
        # CCN, with its bed count blank and zero. Each is priced as with its beds, with the stratum ALL, and the schema
        # takes it.
        inputs = payment_inputs()
        base = next(inputs[h["ccn"]] for h in self.committed["hospitals"]
                    if h["status"] == "estimated" and not (inputs[h["ccn"]]["sch"] or inputs[h["ccn"]]["mdh"]))
        synthetic = {"990001": {**base, "beds": None}, "990002": {**base, "beds": 0}, "990003": base}
        records = [{"ccn": ccn, "state": "ZZ", "cut": True} for ccn in synthetic]
        with mock.patch.object(ipps_pins, "payment_inputs", return_value=synthetic):
            rows = ipps_pins.priced_rows(records)
        self.assertEqual([r["status"] for r in rows], ["estimated"] * 3)
        self.assertEqual([r["stratum"] for r in rows[:2]], [bands.ALL, bands.ALL])
        self.assertNotEqual(rows[2]["stratum"], bands.ALL)
        strip = lambda r: {k: v for k, v in r.items() if k not in ("ccn", "stratum")}  # noqa: E731
        self.assertEqual(strip(rows[0]), strip(rows[2]))  # the bed count moves no dollar
        schemas = load_schemas()
        row = next(h for h in self.committed["hospitals"] if h["status"] == "estimated")
        few = {**self.committed, "hospitals": [{**row, "stratum": bands.ALL}]}
        self.assertEqual(validate(schemas[SCHEMA], few, schemas), [])
        # its band: every hospital's, with multipliers
        for measure in ("hac", "net"):
            overall = self.committed["bands"]["measures"][measure]["overall"]
            self.assertEqual((overall["low"], overall["high"]), bands.multipliers(overall["p10"], overall["p90"]))

    def test_the_estimates_do_not_depend_on_the_back_test(self):
        # With the back-test replaced by nothing, the hospitals' figures and the sums are the committed ones: the ranges
        # are added beside the estimates, never folded into them.
        with mock.patch.object(emit_dollars.backtest_dollars, "bands_json", return_value={}), \
                mock.patch.object(emit_dollars.backtest_dollars, "checks", return_value=[]):
            bare = build_from_pins("2099-01-01T00:00:00Z")
        for key in ("national", "headline", "hospitals"):
            self.assertEqual(bare[key], self.committed[key], key)
        self.assertEqual(bare["checks"], self.committed["checks"][:len(bare["checks"])])


class PuertoRico(unittest.TestCase):
    """No program applies in Puerto Rico: a Puerto Rico hospital in any of the three program files stops the pricing,
    for the estimate and the back-test alike (synthetic records and factor files; the pinned files list none, which the
    emitted file and the back-test, built through the same function, show)."""

    def test_a_puerto_rico_hospital_in_any_program_file_stops_the_pricing_naming_the_file(self):
        records = [{"ccn": "990001", "state": "ZZ", "cut": False}]
        with self.assertRaisesRegex(ValueError, "HACRP file lists 1 Puerto Rico"):
            ipps_pins.priced_rows(records + [{"ccn": "40Z001", "state": "PR", "cut": False}])
        for reader, where in (("hrrp_factors", "HRRP supplemental file"), ("vbp_factors", "Table 16B")):
            with mock.patch.object(ipps_pins, reader, return_value={"990001": 0.99, "40Z001": 0.99}), \
                    self.assertRaisesRegex(ValueError, f"{where} lists 1 Puerto Rico"):
                ipps_pins.priced_rows(records)
        self.assertEqual(ipps_pins.priced_rows(records)[0]["status"], "no-inputs")  # the same rows without one price


class Caps(unittest.TestCase):
    """Review Focus 3, on synthetic rows: only estimated rows count; one past a cap fails, naming the program."""

    @staticmethod
    def rows(no_hrrp, no_vbp, other=()):
        base = [{"status": "estimated", "hrrp_listed": i >= no_hrrp, "vbp_listed": i >= no_vbp}
                for i in range(max(no_hrrp, no_vbp) + 5)]
        return base + [{"status": s, "hrrp_listed": False, "vbp_listed": False} for s in other]

    def test_counts_only_estimated_rows(self):
        self.assertEqual(unlisted_counts(self.rows(3, 7, other=("maryland", "no-inputs", "parhm"))), (3, 7))

    def test_at_the_cap_passes_and_one_over_fails(self):
        enforce_caps(self.rows(HRRP_UNLISTED_MAX, VBP_UNLISTED_MAX, other=("maryland",)))
        with self.assertRaisesRegex(ValueError, "HRRP"):
            enforce_caps(self.rows(HRRP_UNLISTED_MAX + 1, 0))
        with self.assertRaisesRegex(ValueError, "Table 16B"):
            enforce_caps(self.rows(0, VBP_UNLISTED_MAX + 1))


class SiteYesCount(unittest.TestCase):
    """The Yes count the `hac_count` check reads from the HACRP site's emitted file: refused when that file was built
    from an older HACRP pin than the current one (the rows here come from the current pin, so a stale count would
    compare two different files and pass or fail for the wrong reason). Synthetic files; the pin ids are the real ones."""

    @staticmethod
    def site(sha, sources=(HACRP,), yes=2):
        entries = [{"id": i, "sha256": sha, "bytes": 1} for i in sources]
        return {"sources": list(sources), "source_manifest": source_manifest_hash(entries),
                "hospitals": [{"paymentReduction": "Yes"}] * yes + [{"paymentReduction": "No"}]}

    @staticmethod
    def manifest(sha, pin=HACRP):
        return [{"id": pin, "sha256": sha, "bytes": 1}, {"id": "other-pin", "sha256": "ee" * 32, "bytes": 1}]

    def test_a_file_built_from_the_current_pin_gives_its_yes_count(self):
        self.assertEqual(yes_count(self.site("aa" * 32), self.manifest("aa" * 32)), 2)

    def test_a_file_built_from_another_version_of_the_pin_raises_and_says_how_to_fix_it(self):
        with self.assertRaisesRegex(ValueError, r"emit the HACRP site first \(`make emit`"):
            yes_count(self.site("aa" * 32), self.manifest("bb" * 32))

    def test_a_file_that_does_not_name_the_hacrp_pin_raises(self):
        site = self.site("aa" * 32, sources=("other-pin",))
        with self.assertRaisesRegex(ValueError, "emit the HACRP site first"):
            yes_count(site, self.manifest("aa" * 32))

    def test_the_committed_site_file_is_fresh_and_its_count_is_the_csv_s(self):
        fy = read_json(committed_path())["fy"]
        self.assertEqual(site_yes_count(fy), sum(r["Payment Reduction"] == "Yes" for r in hacrp_file()))


class MainWritesNothingWhenACheckFails(unittest.TestCase):
    """A failing check leaves the committed file as it was: nothing written, exit 1, the failures listed."""

    @staticmethod
    def fresh(*failing):
        checks = [{"id": i, "value": 0.5, "low": 0.1, "high": 0.2, "pass": i not in failing} for i in ("a", "b", "c")]
        return {"fy": 2099, "checks": checks, "hospitals": []}

    def run_main(self, fresh):
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(emit_dollars, "build_from_pins", return_value=fresh), \
                mock.patch.object(emit_dollars, "write_emitted", return_value={**fresh, "built_at": "t"}) as write, \
                contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = emit_dollars.main()
        return code, write, out.getvalue() + err.getvalue()

    def test_a_failing_check_writes_nothing_and_exits_1_naming_the_failures(self):
        code, write, said = self.run_main(self.fresh("a", "c"))
        self.assertEqual(code, 1)
        write.assert_not_called()
        listed = said.split("checks failing:")[-1]
        self.assertRegex(listed, r"\ba 0\.5 outside 0\.1 to 0\.2")
        self.assertRegex(listed, r"\bc 0\.5 outside 0\.1 to 0\.2")
        self.assertNotRegex(listed, r"\bb\b")  # b passed: not listed

    def test_all_checks_passing_writes_the_file_and_exits_0(self):
        fresh = self.fresh()
        code, write, said = self.run_main(fresh)
        self.assertEqual(code, 0)
        write.assert_called_once_with(emit_dollars.emitted_path(2099), fresh, SCHEMA)
        self.assertIn("none", said)


if __name__ == "__main__":
    unittest.main()
