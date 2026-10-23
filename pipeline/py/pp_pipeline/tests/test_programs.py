"""Program listings: who each program's file lists, and who it adjusts (inProgram). The HACRP reader is shared with the
dollar estimates, so it is tested here once: what it reads from each row, and what it refuses."""
import unittest

from pp_engine.parse import SchemaError
from pp_pipeline.emit_hospital import committed_path, hacrp_program, read_hacrp
from pp_pipeline.files import read_json

HEADER = '"Facility Name","Facility ID","State","Fiscal Year","Total HAC Score","Payment Reduction"\n'


class Hacrp(unittest.TestCase):
    def test_the_pinned_file_adjusts_everyone_but_marylands_na_rows(self):
        p = hacrp_program()
        exempt = set(p["names"]) - p["subject"]
        self.assertEqual((len(p["names"]), len(p["subject"]), len(exempt)), (3055, 3012, 43))
        master = {h["ccn"]: h for h in read_json(committed_path())["hospitals"]}
        self.assertEqual({master[c]["programs"]["hacrp"]["reason"] for c in exempt}, {"maryland"})  # the master agrees

    def test_the_pinned_file_is_read_once_and_shared(self):
        self.assertIs(read_hacrp(), read_hacrp())

    def test_only_marylands_na_is_exempt(self):
        rows = ('"INVENTED A","990001","ZZ","2026","0.5","Yes"\n"INVENTED B","990002","ZZ","2026","0.5","No"\n'
                '"INVENTED C","990003","MD","2026","0.5","N/A"\n')
        p = hacrp_program(HEADER + rows)
        self.assertEqual(p["subject"], {"990001", "990002"})
        self.assertEqual(sorted(p["names"]), ["990001", "990002", "990003"])
        for bad in ('"INVENTED D","990004","ZZ","2026","0.5","N/A"\n', '"INVENTED E","990005","MD","2026","0.5","Maybe"\n'):
            with self.assertRaisesRegex(SchemaError, "Payment Reduction"):
                hacrp_program(HEADER + rows + bad)

    def test_each_record_says_whether_it_is_cut_scored_and_decided(self):
        text = HEADER + ('"INVENTED A","990001","ZZ","2026","0.5","Yes"\n"INVENTED B","990002","ZZ","2026","N/A","Yes"\n'
                         '"INVENTED C","990003","ZZ","2026","-1.25","No"\n"INVENTED D","990004","MD","2026","0.1","N/A"\n')
        hacrp = read_hacrp(text)
        self.assertEqual(hacrp["fy"], 2026)
        self.assertEqual([(r["ccn"], r["state"], r["pay"], r["cut"], r["scored"], r["decided"])
                          for r in hacrp["records"]],
                         [("990001", "ZZ", "Yes", True, True, True), ("990002", "ZZ", "Yes", True, False, True),
                          ("990003", "ZZ", "No", False, True, True), ("990004", "MD", "N/A", False, True, False)])

    def test_two_fiscal_years_raise(self):
        text = HEADER + '"INVENTED G","990007","ZZ","2026","0.1","No"\n"INVENTED H","990008","ZZ","2025","0.1","No"\n'
        with self.assertRaisesRegex(SchemaError, "fiscal year"):
            read_hacrp(text)

    def test_a_score_that_is_neither_a_number_nor_blank_raises(self):
        for score in ("N/A", ""):  # CMS leaves a score out of these two ways
            read_hacrp(HEADER + f'"INVENTED I","990009","ZZ","2026","{score}","Yes"\n')
        with self.assertRaisesRegex(SchemaError, "Total HAC Score"):
            read_hacrp(HEADER + '"INVENTED J","990010","ZZ","2026","1.2.3","Yes"\n')


if __name__ == "__main__":
    unittest.main()
