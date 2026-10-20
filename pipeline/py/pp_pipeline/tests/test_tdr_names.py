"""Until Thirty Day Readmissions folds into this repo, its hospital names must match the master's, CCN by CCN.

The pinned TDR file and the master are built from the same Care Compare and impact files, so any difference means
one side's name logic or inputs drifted: re-pin, or fix the port.
"""
import json
import unittest

from pp_engine.parse import impact_fy
from pp_pipeline.emit_hospital import IMPACT, IMPACT_MEMBER, TDR, emitted_path
from pp_pipeline.files import read_json, read_pinned_bytes, read_zip_member

MASTER = {h["ccn"]: h for h in read_json(emitted_path(impact_fy(read_zip_member(IMPACT, IMPACT_MEMBER).decode("cp1252"))))["hospitals"]}
TDR_HOSPITALS = json.loads(read_pinned_bytes(TDR))["hospitals"]


def show(diffs):
    return "\n".join(f"{c}: TDR {t!r} / master {m!r}" for c, t, m in diffs[:20]) + (f"\n... {len(diffs)} in all" if len(diffs) > 20 else "")


class TdrNames(unittest.TestCase):
    def test_every_tdr_hospital_is_in_the_master_and_in_hrrp(self):
        self.assertTrue(TDR_HOSPITALS)
        missing = [h["id"] for h in TDR_HOSPITALS if h["id"] not in MASTER]
        self.assertEqual(missing, [])
        self.assertEqual(sorted(c for c, h in MASTER.items() if h["programs"]["hrrp"]["inProgram"]),
                         sorted(h["id"] for h in TDR_HOSPITALS))

    def test_names_and_aliases_match(self):
        diffs = [(h["id"], (h["name"], h.get("alias")), (MASTER[h["id"]]["name"], MASTER[h["id"]]["alias"]))
                 for h in TDR_HOSPITALS if h["id"] in MASTER
                 and (h["name"], h.get("alias")) != (MASTER[h["id"]]["name"], MASTER[h["id"]]["alias"])]
        self.assertFalse(diffs, "\n" + show(diffs))


if __name__ == "__main__":
    unittest.main()
