"""The HRRP readers, on synthetic files (synthetic CCNs)."""
import unittest

from pp_engine.hrrp_read import CONDITIONS, SUPP_LABELS, read_hgi_stars, read_supplemental, read_table15
from pp_engine.parse import SchemaError, rows


def supp_header(extra=()):
    head = ["Hospital CCN", "Payment adjustment factor", "Dual proportion", "Peer group assignment",
            "Neutrality modifier"]
    for label in SUPP_LABELS.values():
        head += [f"Number of eligible discharges for {label}", f"ERR for {label}",
                 f"Peer group median ERR for {label}", f"Penalty indicator for {label}",
                 f"DRG payment ratio for {label}"]
    return head + list(extra)


def supp_row(ccn, flag="N", n="100", err="0.9", rounded=False):
    paf = "0.9876" if rounded else "0.98765432109876"
    row = [ccn, paf, "0.2", "3", "1.01"]
    for _ in SUPP_LABELS:
        row += [n, err, "1", flag, "0.04"]
    return row


class Supplemental(unittest.TestCase):
    def test_conditions_follow_the_labels(self):
        self.assertEqual(CONDITIONS, ("AMI", "COPD", "HF", "PN", "CABG", "THA_TKA"))

    def test_supplemental_full_precision_and_export_agree_on_shape(self):
        full = [["Title line"], supp_header(), supp_row("990001", rounded=False), ["Footnote text"]]
        export_text = "\n".join("\t".join(r) for r in [["Title line"], supp_header(),
                                                       supp_row("990001", rounded=True), ["Footnote text"]]) + "\n"
        a = read_supplemental(full, "w")
        b = read_supplemental(rows(export_text, "\t"), "e")
        self.assertEqual(set(a), {"990001"})
        self.assertEqual(set(a), set(b))
        self.assertEqual(set(a["990001"]), {"paf", "dual", "peer", "nm", "c"})
        self.assertEqual(a["990001"]["paf"], 0.98765432109876)
        self.assertEqual(b["990001"]["paf"], 0.9876)
        self.assertEqual(list(a["990001"]["c"]), list(CONDITIONS))
        self.assertEqual(set(a["990001"]["c"]["HF"]), {"n", "err", "med", "flag", "ratio"})
        self.assertEqual(a["990001"]["c"]["PN"], {"n": 100, "err": 0.9, "med": 1.0, "flag": 0, "ratio": 0.04})

    def test_supplemental_flag_and_missing_values(self):
        r = supp_row("990001", flag="Y", n=".", err=".")
        c = read_supplemental([supp_header(), r], "w")["990001"]["c"]["AMI"]
        self.assertEqual((c["flag"], c["n"], c["err"]), (1, None, None))
        r = supp_row("990002", flag="N")
        self.assertEqual(read_supplemental([supp_header(), r], "w")["990002"]["c"]["AMI"]["flag"], 0)

    def test_supplemental_duplicate_column_raises(self):
        with self.assertRaisesRegex(SchemaError, "found 2"):
            read_supplemental([supp_header(["Dual proportion"]), supp_row("990001") + ["0.1"]], "w")

    def test_supplemental_missing_column_raises(self):
        head = [h for h in supp_header() if h != "Neutrality modifier"]
        with self.assertRaises(SchemaError):
            read_supplemental([head], "w")


class Table15(unittest.TestCase):
    TEXT = ("Hospital CMS Certification Number (CCN)\tFY 2027 Payment Adjustment Factor\n"
            "990001\t0.9951\n990002\t1.0000\nFootnote\t\n")

    def test_table15_reads_the_fy_column(self):
        self.assertEqual(read_table15(self.TEXT, 2027), {"990001": 0.9951, "990002": 1.0})

    def test_table15_duplicate_column_raises(self):
        text = self.TEXT.replace("0.9951", "0.9951\t1").replace("\n", "\t\n", 1)
        text = text.replace("Factor\t\n", "Factor\tFY 2027 Payment Adjustment Factor\n")
        with self.assertRaisesRegex(SchemaError, "found 2"):
            read_table15(text, 2027)

    def test_table15_wrong_fy_raises(self):
        with self.assertRaises(SchemaError):
            read_table15(self.TEXT, 2026)


class HgiStars(unittest.TestCase):
    HEAD = '"Facility ID","Facility Name","Hospital overall rating"\n'

    def test_star_is_an_int_when_digits_else_none(self):
        text = "\ufeff" + self.HEAD + ('990001,A,Not Available\n990002,B,\n990003,C,5\n'
                                      'Footnote row,,\n')
        self.assertEqual(read_hgi_stars(text), {"990001": None, "990002": None, "990003": 5})

    def test_only_the_id_and_rating_columns_are_needed(self):
        self.assertEqual(read_hgi_stars(self.HEAD + "990001,A,3\n"), {"990001": 3})

    def test_a_missing_rating_column_raises(self):
        with self.assertRaisesRegex(SchemaError, "Hospital overall rating"):
            read_hgi_stars('"Facility ID","Facility Name"\n990001,A\n')


if __name__ == "__main__":
    unittest.main()
