"""The TEAM source pins: each derived CSV matches the counts and spot values the manifest recorded when it was derived,
and the derivation functions behave on small synthetic inputs (no hospital names; the raw files are never in git).

To check the price pin against the raw workbook too, set PP_TEAM_PRICES_XLSX to the workbook's path."""
import contextlib
import csv
import hashlib
import io
import os
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

from pp_engine import xlsx
from pp_engine.parse import SchemaError
from pp_engine.team import episodes
from pp_engine.tests.test_xlsx import make_xlsx
from pp_pipeline.files import manifest_entry, read_manifest, read_pinned_csv as pin_rows, write_manifest
from pp_pipeline.tests.team.helpers import pins
from pp_pipeline.refresh_sources import MAX_PIN
from pp_pipeline.team import derive

TEAM_IDS = ("team-participants", "team-prices", "cjrx-participants", "team-mup-dy2023", "team-mup-dy2024", "team-quality")


class PinRecords(unittest.TestCase):
    def test_each_pin_records_its_source_and_stays_under_the_size_limit(self):
        for pin_id in TEAM_IDS:
            with self.subTest(pin_id):
                entry = manifest_entry(pin_id)
                self.assertTrue(entry["path"].startswith("team-py2/"))
                self.assertLess(entry["bytes"], MAX_PIN)
                src = entry["derivedFrom"]
                for key in ("file", "bytes", "sha256", "downloadUrl", "lastModified"):
                    self.assertIn(key, src)
                self.assertEqual(entry["derivedBy"], "pipeline/py/pp_pipeline/team/derive.py")
                self.assertTrue(src["downloadUrl"].startswith("https://"))
                self.assertNotIn("archive", src)  # no archive copy is claimed

    def test_the_lists_record_their_as_of_dates_and_quality_its_release(self):
        for pin_id in ("team-participants", "cjrx-participants"):
            self.assertRegex(manifest_entry(pin_id)["asOf"], r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
        self.assertRegex(manifest_entry("team-prices")["asOf"], r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
        self.assertRegex(manifest_entry("team-quality")["pdcReleased"], r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


class ParticipantsPin(unittest.TestCase):
    def test_participants_pin(self):
        counts = manifest_entry("team-participants")["counts"]
        rows = pin_rows("team-participants")
        self.assertEqual(list(rows[0]), list(derive.PARTICIPANT_COLUMNS))
        self.assertEqual(len(rows), counts["rows"])
        self.assertEqual(len({r["ccn"] for r in rows}), len(rows))
        by_kind = Counter(r["participation"] for r in rows)
        self.assertEqual(dict(by_kind), counts["byParticipation"])
        self.assertEqual(dict(Counter(r["start"] for r in rows)), counts["byStart"])
        self.assertEqual(sum(counts["byStart"].values()), len(rows))
        self.assertTrue(all(len(r["ccn"]) == 6 for r in rows))


class PricesPin(unittest.TestCase):
    def test_prices_pin(self):
        entry = manifest_entry("team-prices")
        spot = entry["spotCheck"]
        rows = [r for r in pin_rows("team-prices")
                if (r["category"], r["drg"], r["division"]) == (spot["category"], spot["drg"], spot["division"])]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["price"], spot["price"])
        self.assertEqual(len(pin_rows("team-prices")), entry["counts"]["rows"])

    @unittest.skipUnless(os.environ.get("PP_TEAM_PRICES_XLSX"),
                         "set PP_TEAM_PRICES_XLSX to the raw price workbook to compare a cell")
    def test_the_spot_price_equals_the_workbooks_cell(self):
        spot = manifest_entry("team-prices")["spotCheck"]
        table = xlsx.sheet_rows(Path(os.environ["PP_TEAM_PRICES_XLSX"]).read_bytes(), derive.PRICE_SHEET, "prices")
        cell = [float(r[8]) for r in table
                if len(r) > 8 and r[0].isdigit() and derive.CATEGORY_CODES.get(r[1]) == spot["category"]
                and r[2] == spot["drg"] and r[3] == f"CENS_DIV_{spot['division']}"]
        self.assertEqual(cell, [float(spot["price"])])


class OtherPins(unittest.TestCase):
    def test_cjrx_pin_counts(self):
        entry = manifest_entry("cjrx-participants")
        rows = pin_rows("cjrx-participants")
        self.assertEqual(list(rows[0]), list(derive.CJRX_COLUMNS))
        self.assertEqual(len(rows), entry["counts"]["rows"])
        self.assertEqual(len({r["ccn"] for r in rows}), len(rows))

    def test_mup_pins_hold_only_the_episode_and_predecessor_drgs(self):
        team = {r["drg"] for r in pin_rows("team-prices") if r["drg"] != derive.ALL_ROWS}
        allowed = derive.mup_drgs(pin_rows("team-prices"))
        self.assertLessEqual(team, allowed)
        for pin_id in ("team-mup-dy2023", "team-mup-dy2024"):
            with self.subTest(pin_id):
                rows = pin_rows(pin_id)
                self.assertEqual(list(rows[0]), list(derive.MUP_COLUMNS))
                self.assertEqual(len(rows), manifest_entry(pin_id)["counts"]["rows"])
                self.assertLessEqual({r["drg"] for r in rows}, allowed)
                self.assertTrue(all(int(r["discharges"]) >= 11 for r in rows))  # CMS omits smaller cells
                self.assertEqual(len({(r["ccn"], r["drg"]) for r in rows}), len(rows))

    def test_quality_pin_counts(self):
        entry = manifest_entry("team-quality")
        rows = pin_rows("team-quality")
        self.assertEqual(list(rows[0]), list(derive.QUALITY_COLUMNS))
        self.assertEqual(dict(Counter(r["measure"] for r in rows)), entry["counts"]["byMeasure"])
        self.assertEqual(set(entry["counts"]["byMeasure"]), {"hybrid_hwr", "iscmr"})
        for r in rows:
            float(r["value"])


class DelineationPin(unittest.TestCase):
    def test_delineation_pin(self):
        entry = manifest_entry(derive.DELINEATION)
        rows = pin_rows(derive.DELINEATION)
        self.assertEqual(list(rows[0]), list(derive.DELINEATION_COLUMNS))
        self.assertEqual(len(rows), entry["counts"]["rows"])
        self.assertEqual(dict(Counter(r["area"] for r in rows)), entry["counts"]["byArea"])
        self.assertRegex(entry["delineated"], r"^[0-9]{4}-[0-9]{2}$")
        self.assertEqual(entry["derivedBy"], derive.DERIVED_BY)
        self.assertTrue(entry["derivedFrom"]["downloadUrl"].startswith("https://www2.census.gov/"))
        self.assertEqual(len({r["fips"] for r in rows}), len(rows))
        for r in rows:
            self.assertRegex(r["fips"] + r["cbsa"], r"^[0-9]{10}$")
            self.assertIn(r["area"], ("metro", "micro"))
            self.assertTrue(r["division"] == "" or (r["area"] == "metro" and r["division"].isdigit()))

    def test_every_delineated_county_is_one_the_crosswalk_has(self):
        # Placement draws counties from CMS's crosswalk; a delineated county it lacked could never be placed.
        crosswalk = {r["fips"] for r in pins().crosswalk}
        missing = sum(r["fips"] not in crosswalk for r in pin_rows(derive.DELINEATION))
        self.assertEqual(missing, 0, f"{missing} delineated counties not in the crosswalk")


class Derivations(unittest.TestCase):
    def test_participants_from_a_workbook(self):
        wb = make_xlsx({"List": [
            ["A note as of August 18, 2026"],
            ["Mandatory or Voluntary Participant", "Hospital CCN", "Hospital Name", "CBSA", "CBSA Name", "CBSA State",
             "Participation Start Date", "Participation End Date", "Newly Identified TEAM Participant Relative to Previous List"],
            ["Voluntary", "990002", "Test Two", "11111", "Town, ZZ", "ZZ", "01/01/2027", "12/31/2030", "Y"],
            ["Mandatory", "990001", "Test One", "11111", "Town, ZZ", "ZZ", "01/01/2026", "12/31/2030", "N"],
            ["End of Worksheet"]]})
        text, counts, as_of = derive.participants(wb)
        rows = list(csv.DictReader(io.StringIO(text)))
        self.assertEqual([r["ccn"] for r in rows], ["990001", "990002"])  # sorted
        self.assertEqual((rows[1]["start"], rows[1]["end"], rows[1]["newly_identified"]), ("2027-01-01", "2030-12-31", "Y"))
        self.assertEqual(counts["byParticipation"], {"mandatory": 1, "voluntary": 1})
        self.assertEqual(as_of, "2026-08-18")

    def test_delineation_from_a_workbook(self):
        hdr = ["CBSA Code", "Metropolitan Division Code", "CSA Code", "CBSA Title", "Metropolitan/Micropolitan Statistical Area",
               "Metropolitan Division Title", "CSA Title", "County/County Equivalent", "State Name", "FIPS State Code",
               "FIPS County Code", "Central/Outlying County"]
        wb = make_xlsx({"List 1": [
            ["A table"], ["List 1. CORE BASED STATISTICAL AREAS (CBSAs), JULY 2023"], hdr,
            ["99990", "", "", "Small, ZZ", "Micropolitan Statistical Area", "", "", "A County", "Z", "99", "003", "Central"],
            ["99980", "99984", "", "Big, ZZ-YY", "Metropolitan Statistical Area", "Part", "", "B County", "Z", "99", "001", "Central"],
            [""], ["Note: a note under the table."]]})
        text, counts, delineated = derive.delineation(wb)
        self.assertEqual(text.splitlines(), ["fips,cbsa,cbsa_title,area,division", '99001,99980,"Big, ZZ-YY",metro,99984',
                                             '99003,99990,"Small, ZZ",micro,'])
        self.assertEqual(counts, {"rows": 2, "byArea": {"metro": 1, "micro": 1}})
        self.assertEqual(delineated, "2023-07")
        bad = make_xlsx({"List 1": [["List 1, JULY 2023"], hdr,
                                    ["99990", "", "", "T, ZZ", "Some Other Area", "", "", "A", "Z", "99", "003", "Central"]]})
        with self.assertRaises(ValueError):
            derive.delineation(bad)

    def test_prices_keep_category_average_rows_flagged(self):
        hdr = ["Initial Sort Order", "Episode Category", "MS-DRG", "Region", "Desc", "Benchmark", "Trend", "Discount", "Price"]
        wb = make_xlsx({"Overview": [["x"]], derive.PRICE_SHEET: [
            ["Title"], hdr,
            ["1", "IP-Coronary artery bypass graft", "231", "CENS_DIV_1", "d", "100.5", "1.05", "0.015", "103.9"],
            ["2", "IP-Coronary artery bypass graft", "All", "CENS_DIV_1", "d", "50.25", "1.03", "0.015", "51"]]})
        rows = list(csv.DictReader(io.StringIO(derive.prices(wb)[0])))
        self.assertEqual([(r["category"], r["drg"], r["division"], r["average_row"]) for r in rows],
                         [("CABG", "231", "1", "0"), ("CABG", "All", "1", "1")])
        self.assertEqual(rows[0]["discount"], "0.015")

    def test_mup_keeps_only_the_wanted_drgs(self):
        raw = ("Rndrng_Prvdr_CCN,Rndrng_Prvdr_Org_Name,DRG_Cd,Tot_Dschrgs\n"
               "990001,x,231,12\n990001,x,003,40\n990002,x,456,11.0\n")
        text, counts = derive.mup(raw.encode("utf-8"), {"231", "456"})
        self.assertEqual(text.splitlines(), ["ccn,drg,discharges", "990001,231,12", "990002,456,11"])
        self.assertEqual(counts["rows"], 2)

    def test_quality_keeps_numeric_scores_for_the_two_measures(self):
        hdr = '"Facility ID","Measure ID","Score","Start Date","End Date"\n'
        raw = (hdr + '990002,Hybrid_HWR,15.5,07/01/2024,06/30/2025\n990001,Hybrid_HWR,Not Available,07/01/2024,06/30/2025\n'
               '990001,Other,3,07/01/2024,06/30/2025\n')
        iscmr = hdr + '990001,ISCMR,50.1,07/01/2023,06/30/2025\n'
        text, counts = derive.quality(raw.encode("utf-8"), iscmr.encode("utf-8"))
        self.assertEqual(text.splitlines()[1:], ["990002,hybrid_hwr,15.5,2024-07-01,2025-06-30",  # by measure, then CCN
                                                 "990001,iscmr,50.1,2023-07-01,2025-06-30"])
        self.assertEqual(counts["byMeasure"], {"iscmr": 1, "hybrid_hwr": 1})

    def test_the_kept_drgs_are_the_priced_ones_and_every_retired_one_the_build_remaps(self):
        rows = [{"drg": "469", "average_row": "0"}, {"drg": derive.ALL_ROWS, "average_row": "1"}]
        self.assertEqual(derive.mup_drgs(rows), {"469"} | set(episodes.REMAPS))
        with mock.patch.dict(episodes.REMAPS, {"999": {"469": 1}}):  # a new remap is kept without a second list
            self.assertIn("999", derive.mup_drgs(rows))

    def test_a_missing_column_is_refused(self):
        with self.assertRaises(SchemaError):
            derive.mup(b"Rndrng_Prvdr_CCN,x\n1,2\n", {"231"})


class Repin(unittest.TestCase):
    """derive-team writes a pin only when its new bytes are the committed manifest entry's, unless --repin."""
    OLD, NEW = b"ccn\n990001\n", b"ccn\n990002\n"

    def entry(self, data, **extra):
        return {"id": "synthetic-team", "path": "team-py2/synthetic.csv", "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(), **extra}

    def run_write(self, root, data, repin, **extra):
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            code = derive.write_pins({"synthetic-team": (data, self.entry(data, **extra))}, repin, root)
        return code, printed.getvalue()

    def committed(self, root):
        write_manifest([{"id": "other", "path": "o.csv"}, self.entry(self.OLD, retrieved="2026-01-01")], root)
        (Path(root) / "team-py2").mkdir()
        (Path(root) / "team-py2" / "synthetic.csv").write_bytes(self.OLD)

    def test_a_changed_derivation_is_refused_and_named(self):
        with tempfile.TemporaryDirectory() as root:
            self.committed(root)
            before = read_manifest(root)
            code, printed = self.run_write(root, self.NEW, repin=False)
            self.assertEqual(code, 1)
            self.assertIn("synthetic-team", printed)
            self.assertIn("--repin", printed)
            self.assertEqual(read_manifest(root), before)
            self.assertEqual((Path(root) / "team-py2" / "synthetic.csv").read_bytes(), self.OLD)

    def test_repin_writes_the_new_bytes_and_entry_in_place(self):
        with tempfile.TemporaryDirectory() as root:
            self.committed(root)
            code, _ = self.run_write(root, self.NEW, repin=True)
            self.assertEqual(code, 0)
            manifest = read_manifest(root)
            self.assertEqual([e["id"] for e in manifest], ["other", "synthetic-team"])
            self.assertEqual(manifest[1]["sha256"], hashlib.sha256(self.NEW).hexdigest())
            self.assertEqual((Path(root) / "team-py2" / "synthetic.csv").read_bytes(), self.NEW)

    def test_the_same_bytes_need_no_flag(self):
        with tempfile.TemporaryDirectory() as root:
            self.committed(root)
            code, _ = self.run_write(root, self.OLD, repin=False, retrieved="2026-02-01")
            self.assertEqual(code, 0)
            self.assertEqual(read_manifest(root)[1]["retrieved"], "2026-02-01")

    def test_a_pin_the_manifest_lacks_needs_the_flag(self):
        with tempfile.TemporaryDirectory() as root:
            write_manifest([], root)
            self.assertEqual(self.run_write(root, self.NEW, repin=False)[0], 1)
            self.assertEqual(read_manifest(root), [])
            self.assertEqual(self.run_write(root, self.NEW, repin=True)[0], 0)


if __name__ == "__main__":
    unittest.main()
