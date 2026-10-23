"""The dollars dataset (data/emitted/dollars/fy2026/dollars.json): the committed file equals a fresh build from the
pins, covers every hospital in the HACRP file once, passes its checks, and its headline counts agree with the HACRP
site's own. Counts asserted here are facts of the pinned bytes (a re-pin moves them on purpose); no hospital is named."""
import csv
import io
import unittest

from pp_engine import dollars
from pp_engine.contract import format_emitted
from pp_engine.schema import validate
from pp_engine.tests.fixtures import assert_adds_up
from pp_pipeline.emit_dollars import (HRRP_UNLISTED_MAX, SCHEMA, VBP_UNLISTED_MAX, build_from_pins, camel,
                                      committed_path, enforce_caps, unlisted_counts)
from pp_pipeline.emit_hospital import HACRP
from pp_pipeline.files import EMITTED_DIR, load_schemas, read_json, read_pinned_bytes

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

    def test_it_lives_at_the_family_level_for_the_files_fiscal_year(self):
        fy = self.committed["fy"]
        self.assertEqual(self.path, EMITTED_DIR / "dollars" / f"fy{fy}" / "dollars.json")
        self.assertEqual({r["Fiscal Year"] for r in hacrp_file()}, {str(fy)})
        self.assertEqual((self.committed["schema_version"], self.committed["methods_version"]), (1, 1))
        self.assertEqual(self.committed["assumptions"], {"ratesFy": 2026, "volumeFy": 2024, "mdhEnd": "2026-12-31",
                                                         "lowVolumeEnd": "2026-12-31", "ntap": "excluded"})
        self.assertIsNone(self.committed["bands"])

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
                         ["hrrp_share", "vbp_net", "hac_share", "hac_count", "yes_unestimated"])
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
        full = bare | {"cases", "bills", "hrrpFactor", "vbpFactor", "parts"} | set(DOLLARS)
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


if __name__ == "__main__":
    unittest.main()
