"""Until Thirty Day Readmissions folds into this repo, its hospitals' names and locations must match the master's,
CCN by CCN, when the master is built on the Care Compare file that site used.

The pinned TDR file and that build share the Care Compare, impact and geography files and the street-address points,
so any difference means one side's logic or inputs drifted: re-pin, or fix the port. The master the pages use is built
on a newer Care Compare file; it may differ from that build only in the fields Care Compare feeds, and only for
hospitals whose Care Compare row changed (`tdr_inputs`).
"""
import unittest

from pp_pipeline.emit_hospital import committed_path, tdr_data
from pp_pipeline.files import read_json
from pp_pipeline.tests.tdr_inputs import CARE_COMPARE_FIELDS, july_master, unexplained


# (master field, TDR field) compared for every TDR hospital
LOCATION = (("state", "st"), ("county", "county"), ("lat", "lat"), ("lon", "lon"), ("geo", "geo"), ("cbsa", "cbsa"),
            ("cbsaName", "cbsaName"), ("region", "region"), ("division", "division"))


class TdrCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.master = {h["ccn"]: h for h in read_json(committed_path())["hospitals"]}
        cls.july = july_master()
        cls.tdr = {h["id"]: h for h in tdr_data()["hospitals"]}

    def test_the_masters_hrrp_hospitals_are_exactly_tdrs(self):
        self.assertTrue(self.tdr)
        for master in (self.master, self.july):
            self.assertEqual(sorted(c for c, h in master.items() if h["programs"]["hrrp"]["inProgram"]), sorted(self.tdr))

    def test_names_and_aliases_match(self):
        self.assertEqual({c: (h["name"], h.get("alias")) for c, h in self.tdr.items()},
                         {c: (self.july[c]["name"], self.july[c]["alias"]) for c in self.tdr if c in self.july})

    def test_location_matches(self):
        diffs = [f"{c} {m}: master {self.july[c][m]!r}, TDR {h.get(t)!r}" for c, h in sorted(self.tdr.items())
                 if c in self.july for m, t in LOCATION if self.july[c][m] != h.get(t)]
        self.assertEqual(diffs, [], f"{len(diffs)} location differences:\n" + "\n".join(diffs[:50]))

    def test_the_newer_care_compare_moves_only_its_own_fields_of_the_hospitals_it_changed(self):
        diffs = unexplained(self.master, self.july, CARE_COMPARE_FIELDS)
        self.assertEqual(diffs, [], f"{len(diffs)} differences Care Compare does not explain:\n" + "\n".join(diffs[:50]))


if __name__ == "__main__":
    unittest.main()
