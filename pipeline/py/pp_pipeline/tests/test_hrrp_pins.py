"""The HRRP readers over the pinned CMS files, and the zip member guard over every pinned zip."""
import io
import unittest
import zipfile

from pp_engine import hrrp_history, ipps, parse, xlsx
from pp_engine.parse import SchemaError
from pp_pipeline import files

SUPP = "hrrp-supplemental-fy2027"
WORKBOOK = "FY2027_HRRP_Supplemental_File.xlsx"
EXPORT = "FY2027_HRRP_Supplemental_File - FR FY 2027 Tab.txt"
TABLE15 = ("hrrp-table15-fy2027", "Section 508 version of FY2027_HRRP_Table_15.txt")


def tdr_ccns():
    import json
    return {h["id"] for h in json.loads(files.read_pinned_bytes("tdr-hrrp-fy2027"))["hospitals"]}


class HrrpPins(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.book = parse.read_supplemental(
            xlsx.sheet_rows(files.read_zip_member(SUPP, WORKBOOK), "FR FY 2027", WORKBOOK), WORKBOOK)
        cls.export = parse.read_supplemental(
            parse.rows(files.read_zip_text_cp1252(SUPP, EXPORT), "\t"), EXPORT)
        cls.t15 = parse.read_table15(files.read_zip_text_cp1252(*TABLE15), 2027)

    def test_workbook_and_export_cover_the_same_hospitals_as_the_golden(self):
        self.assertEqual(set(self.book), tdr_ccns())
        self.assertEqual(set(self.export), set(self.book))

    def test_workbook_is_the_export_at_full_precision(self):
        for ccn, b in self.book.items():
            e = self.export[ccn]
            self.assertEqual(b["peer"], e["peer"])
            self.assertEqual({k: v["flag"] for k, v in b["c"].items()}, {k: v["flag"] for k, v in e["c"].items()})
            self.assertAlmostEqual(b["paf"], e["paf"], delta=0.00005)

    def test_table15_matches_the_supplemental_factors(self):
        self.assertEqual(set(self.t15), set(self.book))
        for ccn, paf in self.t15.items():
            self.assertAlmostEqual(paf, self.book[ccn]["paf"], delta=0.00005)


class RatesAndInputs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import json
        cls.golden = json.loads(files.read_pinned_bytes("tdr-hrrp-fy2027"))

    def test_operating_rates_equal_the_golden(self):
        got = ipps.read_operating_rates(files.read_zip_text_cp1252("ipps-rates-fy2027", "CMS-1849-CN Tables 1A - 1E.txt"))
        norm = {t: {k: list(v) for k, v in d.items()} for t, d in got.items()}
        self.assertEqual(norm, self.golden["meta"]["rates"])

    def test_fy2026_operating_rates_are_what_read_rates_gave(self):
        from pp_pipeline import ipps_pins
        text = ipps_pins.pinned_text(2026, "rates")
        self.assertEqual(ipps.read_operating_rates(text), ipps.read_rates(text, 2026)["operating"])

    def test_estimate_inputs_cover_every_hospital_tdr_priced(self):
        got = ipps.read_estimate_inputs(files.read_zip_text_cp1252(
            "ipps-impact-fy2027", "FY 2027 IPPS Impact File - Correction Notice.txt"), 2027, 44)
        priced = {h["id"] for h in self.golden["hospitals"] if h.get("base") is not None}
        self.assertTrue(priced)
        self.assertLessEqual(priced, set(got))


class HistoryPins(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import json
        cls.golden = json.loads(files.read_pinned_bytes("tdr-hrrp-fy2027"))
        cls.hist = cls.golden["history"]

    def test_paf_history_is_the_golden(self):
        text = files.read_pinned_bytes("hrrp-history-fy2013-2026").decode("utf-8")
        years, paf = hrrp_history.load_paf_history(text, tdr_ccns(), 2013, 2026)
        self.assertEqual(years, self.hist["years"])
        self.assertEqual(paf, self.hist["paf"])

    def test_national_series_is_the_golden_before_the_totals_join(self):
        text = files.read_pinned_bytes("hrrp-history-summary-fy2013-2026").decode("utf-8")
        want = [{k: v for k, v in r.items() if k not in ("totalEst", "totalSrc")}
                for r in self.hist["national"] if 2013 <= r["fy"] <= 2026]
        self.assertEqual(hrrp_history.load_national(text), want)


class ZipGuard(unittest.TestCase):
    def test_zip_member_escaping_refused(self):
        for name in ("../x", "/x", "a/../../x", "C:\\x", "a\\b"):
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w") as zf:
                zf.writestr(name, "x")
            with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as zf:
                with self.assertRaises(SchemaError, msg=name):
                    files.check_zip_members(zf, "z")

    def test_oversized_member_refused_before_reading(self):
        from unittest import mock
        with mock.patch.object(files, "MAX_ZIP_MEMBER", 10), mock.patch.object(zipfile.ZipFile, "read") as read:
            with self.assertRaisesRegex(SchemaError, "bytes"):
                files.read_zip_member(SUPP, EXPORT)
        read.assert_not_called()

    def test_ordinary_members_pass(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("dir/file name (1).txt", "x")
        with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as zf:
            files.check_zip_members(zf, "z")

    def test_every_pinned_zip_passes_the_member_check(self):
        zips = [e["id"] for e in files.read_manifest() if e["path"].endswith(".zip")]
        self.assertTrue(zips)
        for pin_id in zips:
            with self.subTest(pin_id):
                with zipfile.ZipFile(io.BytesIO(files.read_pinned_bytes(pin_id))) as zf:
                    files.check_zip_members(zf, pin_id)
                    member = zf.namelist()[0]
                files.read_zip_member(pin_id, member)  # the guard runs on every open


if __name__ == "__main__":
    unittest.main()
