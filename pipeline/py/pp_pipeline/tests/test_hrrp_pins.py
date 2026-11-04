"""The HRRP readers over the pinned CMS files, and the zip safety check over every pinned zip."""
import functools
import io
import json
import unittest
import zipfile
from unittest import mock

from pp_engine import hrrp_history, hrrp_read, ipps, parse, xlsx, zipsafe
from pp_engine.parse import SchemaError
from pp_pipeline import files, ipps_pins

SUPP = "hrrp-supplemental-fy2027"
WORKBOOK = "FY2027_HRRP_Supplemental_File.xlsx"
EXPORT = "FY2027_HRRP_Supplemental_File - FR FY 2027 Tab.txt"
TABLE15 = ("hrrp-table15-fy2027", "Section 508 version of FY2027_HRRP_Table_15.txt")


@functools.lru_cache(maxsize=None)
def golden():
    """Thirty Day Readmissions' own FY2027 output, parsed once."""
    return json.loads(files.read_pinned_bytes("tdr-hrrp-fy2027"))


def tdr_ccns():
    return {h["id"] for h in golden()["hospitals"]}


class HrrpPins(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.book = hrrp_read.read_supplemental(
            xlsx.sheet_rows(files.read_zip_member(SUPP, WORKBOOK), "FR FY 2027", WORKBOOK), WORKBOOK)
        cls.export = hrrp_read.read_supplemental(
            parse.rows(files.read_zip_text_cp1252(SUPP, EXPORT), "\t"), EXPORT)
        cls.t15 = hrrp_read.read_table15(files.read_zip_text_cp1252(*TABLE15), 2027)

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
    def test_operating_rates_equal_the_golden(self):
        got = ipps.read_operating_rates(files.read_zip_text_cp1252("ipps-rates-fy2027", "CMS-1849-CN Tables 1A - 1E.txt"))
        norm = {t: {k: list(v) for k, v in d.items()} for t, d in got.items()}
        self.assertEqual(norm, golden()["meta"]["rates"])

    def test_fy2026_operating_rates_are_what_read_rates_gave(self):
        text = ipps_pins.pinned_text(2026, "rates")
        self.assertEqual(ipps.read_operating_rates(text), ipps.read_rates(text, 2026)["operating"])

    def test_estimate_inputs_cover_every_hospital_tdr_priced(self):
        got = ipps.read_estimate_inputs(files.read_zip_text_cp1252(
            "ipps-impact-fy2027", "FY 2027 IPPS Impact File - Correction Notice.txt"), 2027, 44)
        priced = {h["id"] for h in golden()["hospitals"] if h.get("base") is not None}
        self.assertTrue(priced)
        self.assertLessEqual(priced, set(got))


class HistoryPins(unittest.TestCase):
    def test_paf_history_is_the_golden(self):
        text = files.read_pinned_bytes("hrrp-history-fy2013-2026").decode("utf-8")
        years, paf = hrrp_history.load_paf_history(text, tdr_ccns(), 2013, 2026)
        self.assertEqual(years, golden()["history"]["years"])
        self.assertEqual(paf, golden()["history"]["paf"])

    def test_national_series_is_the_golden_before_the_totals_join(self):
        text = files.read_pinned_bytes("hrrp-history-summary-fy2013-2026").decode("utf-8")
        want = [{k: v for k, v in r.items() if k not in ("totalEst", "totalSrc")}
                for r in golden()["history"]["national"] if 2013 <= r["fy"] <= 2026]
        self.assertEqual(hrrp_history.load_national(text), want)


class ZipGuard(unittest.TestCase):
    def test_an_escaping_member_name_is_refused_when_a_pinned_zip_is_read(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("../x", "x")
        with mock.patch.object(files, "read_pinned_bytes", return_value=buf.getvalue()):
            with self.assertRaisesRegex(SchemaError, "unsafe zip member"):
                files.read_zip_member("z", "../x")

    def test_an_oversized_member_is_refused_before_reading(self):
        with mock.patch.object(zipsafe, "MAX_MEMBER_BYTES", 10), mock.patch.object(zipfile.ZipFile, "read") as read:
            with self.assertRaisesRegex(SchemaError, "bytes"):
                files.read_zip_member(SUPP, EXPORT)
        read.assert_not_called()

    def test_too_many_members_are_refused_when_a_pinned_zip_is_read(self):
        with mock.patch.object(zipsafe, "MAX_MEMBERS", 1):
            with self.assertRaisesRegex(SchemaError, "members"):
                files.read_zip_member(SUPP, EXPORT)

    def test_every_pinned_zip_passes_the_check(self):
        zips = [e["id"] for e in files.read_manifest() if e["path"].endswith(".zip")]
        self.assertTrue(zips)
        for pin_id in zips:
            with self.subTest(pin_id), zipfile.ZipFile(io.BytesIO(files.read_pinned_bytes(pin_id))) as zf:
                zipsafe.check_zip(zf, pin_id)


if __name__ == "__main__":
    unittest.main()
