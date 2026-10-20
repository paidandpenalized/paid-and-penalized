"""Until Thirty Day Readmissions folds into this repo, its hospitals' names and locations must match the master's,
CCN by CCN.

The pinned TDR file and the master are built from the same Care Compare, impact and geography files and the same
street-address points, so any difference means one side's logic or inputs drifted: re-pin, or fix the port.
"""
import unittest

from pp_pipeline.emit_hospital import committed_path, tdr_data
from pp_pipeline.files import read_json


# (master field, TDR field) compared for every TDR hospital
LOCATION = (("state", "st"), ("county", "county"), ("lat", "lat"), ("lon", "lon"), ("geo", "geo"), ("cbsa", "cbsa"),
            ("cbsaName", "cbsaName"), ("region", "region"), ("division", "division"))


class TdrCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.master = {h["ccn"]: h for h in read_json(committed_path())["hospitals"]}
        cls.tdr = {h["id"]: h for h in tdr_data()["hospitals"]}

    def test_the_masters_hrrp_hospitals_are_exactly_tdrs(self):
        self.assertTrue(self.tdr)
        self.assertEqual(sorted(c for c, h in self.master.items() if h["programs"]["hrrp"]["inProgram"]), sorted(self.tdr))

    def test_names_and_aliases_match(self):
        self.assertEqual({c: (h["name"], h.get("alias")) for c, h in self.tdr.items()},
                         {c: (self.master[c]["name"], self.master[c]["alias"]) for c in self.tdr if c in self.master})

    def test_location_matches(self):
        diffs = [f"{c} {m}: master {self.master[c][m]!r}, TDR {h.get(t)!r}" for c, h in sorted(self.tdr.items())
                 if c in self.master for m, t in LOCATION if self.master[c][m] != h.get(t)]
        self.assertEqual(diffs, [], f"{len(diffs)} location differences:\n" + "\n".join(diffs[:50]))


if __name__ == "__main__":
    unittest.main()
