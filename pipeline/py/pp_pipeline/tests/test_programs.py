"""Program listings: who each program's file lists, and who it adjusts (inProgram)."""
import unittest

from pp_engine.parse import SchemaError
from pp_pipeline.emit_hospital import hacrp_program, hrrp_program

HEADER = '"Facility Name","Facility ID","State","Fiscal Year","Payment Reduction"\n'


class Hacrp(unittest.TestCase):
    def test_the_pinned_file_adjusts_everyone_but_marylands_na_rows(self):
        p = hacrp_program()
        exempt = set(p["names"]) - p["subject"]
        self.assertEqual((len(p["names"]), len(p["subject"]), len(exempt)), (3055, 3012, 43))

    def test_only_marylands_na_is_exempt(self):
        rows = ('"INVENTED A","990001","ZZ","2026","Yes"\n"INVENTED B","990002","ZZ","2026","No"\n'
                '"INVENTED C","990003","MD","2026","N/A"\n')
        p = hacrp_program(HEADER + rows)
        self.assertEqual(p["subject"], {"990001", "990002"})
        self.assertEqual(sorted(p["names"]), ["990001", "990002", "990003"])
        for bad in ('"INVENTED D","990004","ZZ","2026","N/A"\n', '"INVENTED E","990005","MD","2026","Maybe"\n'):
            with self.assertRaisesRegex(SchemaError, "Payment Reduction"):
                hacrp_program(HEADER + rows + bad)


class Hrrp(unittest.TestCase):
    def test_tdr_lists_only_adjusted_hospitals(self):
        p = hrrp_program()
        self.assertEqual(p["subject"], set(p["names"]))


if __name__ == "__main__":
    unittest.main()
