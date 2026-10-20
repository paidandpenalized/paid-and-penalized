"""Name casing rules (ported from Thirty Day Readmissions), on invented names."""
import unittest

from pp_engine.names import alias, display_name, smart_title


class Names(unittest.TestCase):
    def test_smart_title_rules(self):
        cases = {
            "ST MARY OF THE PLAINS MDL CTR": "St Mary of the Plains Mdl Ctr",
            "MC DONOUGH VALLEY HOSPITAL": "McDonough Valley Hospital",
            "O'BRIEN HLTH SVCS": "O'Brien Hlth Svcs",
            "UPMC NORTHERN PINES - EAST-WEST CAMPUS": "UPMC Northern Pines - East-West Campus",
            "LAKE VIEW REGIONAL A CAMPUS OF NWX": "Lake View Regional a Campus of NWX",
            "JOHN A DOE MEMORIAL HOSPITAL": "John A Doe Memorial Hospital",
            "PINE RIVER HEALTH, LLC, DBA": "Pine River Health, LLC, dba",
        }
        for raw, want in cases.items():
            self.assertEqual(smart_title(raw), want, raw)

    def test_display_name(self):
        self.assertEqual(display_name("INVENTED VALLEY HOSPITAL", "Invented Valley Hosp"), "Invented Valley Hospital")
        self.assertEqual(display_name("McInvented  Bay Region", None), "McInvented Bay Region")  # mixed case kept
        self.assertEqual(display_name(None, "Invented  Hospital"), "Invented Hospital")
        self.assertIsNone(display_name(None, None))

    def test_alias(self):
        self.assertIsNone(alias("Invented Valley Hospital", "Invented Valley Hosp"))
        self.assertIsNone(alias("Saint Ivo Medical Center", "St Ivo Med Ctr"))
        self.assertEqual(alias("Northwind Health", "Southbay Regional Lakeside Hospital"), "Southbay Regional Lakeside Hospital")
        self.assertIsNone(alias("Invented Hospital", None))
        self.assertIsNone(alias(None, "Invented Hospital"))


if __name__ == "__main__":
    unittest.main()
