"""The HRRP readers over the pinned CMS files, and the zip member guard over every pinned zip."""
import io
import unittest
import zipfile

from pp_engine import parse, xlsx
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
