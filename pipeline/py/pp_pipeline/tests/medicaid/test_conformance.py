"""The JS port's shared cases (schemas/conformance/medicaid.vectors.json) equal a fresh generation, so they can't drift
from the Python engine, and cover every class and edge the port must match."""
import functools
import unittest

from pp_engine.medicaid import params, rollup
from pp_pipeline.files import read_json
from pp_pipeline.medicaid import build, conformance


@functools.lru_cache(maxsize=None)
def fresh():
    return conformance.cases()


class Vectors(unittest.TestCase):
    def test_the_committed_file_equals_a_fresh_generation(self):
        self.assertEqual(read_json(conformance.PATH), fresh())
        self.assertEqual(conformance.PATH.read_text(encoding="utf-8"), conformance.dumps(fresh()))

    def test_sizes(self):
        doc = fresh()
        self.assertGreaterEqual(len(doc["hospitals"]), conformance.HOSPITALS)
        n = len(doc["hospitals"])
        self.assertEqual(len(doc["cases"]), n * 3 * 4)  # 3 scenarios x (3 use rates + lines 2 + 5 at use 1)
        self.assertEqual(len(doc["rollups"]), 3 * 4)

    def test_every_class_and_edge_is_covered(self):
        hospitals = fresh()["hospitals"]
        bases = [h["base"] for h in hospitals]
        classes = {build.SCENARIO, build.NOT_EXPANSION, build.NO_VIII, build.ALL_PAYER, build.TERRITORY}
        self.assertEqual({h["cls"] for h in hospitals} & classes, classes)
        picked = conformance.pick_hospitals(self.records())
        # A refresh that drops these properties from the data must fail here, not quietly thin the vectors.
        for label, pick in (
                ("cost ratio at the cap", lambda r: r["base"]["cost_ratio"] == params.MAX_COST_RATIO),
                ("falls 1 point", conformance._falls_1pp), ("into the red", conformance._into_red)):
            with self.subTest(label):
                self.assertTrue(any(pick(r) for r in picked))
        self.assertGreater(rollup.roll_up([(r["base"], r["results"]["middle"]) for r in picked
                                           if r["cls"] == build.SCENARIO])["into_red"], 0)
        # The same three branches as the JS port sees them: the capped flag among the picks, the cap in a vector
        # hospital's base, and the vectors' own middle-case roll-up counting hospitals that fall 1 point and go into
        # the red, so the port's comparison runs through each.
        doc = fresh()
        self.assertTrue(any("cost_ratio_capped" in r["base"]["flags"] for r in picked), "cost_ratio_capped")
        self.assertTrue(any(h["base"]["cost_ratio"] == params.MAX_COST_RATIO for h in hospitals), "the cap in a vector")
        middle = next(c["expected"] for c in doc["rollups"]
                      if c["scenario"] == "middle" and c["use"] == params.USE_DEFAULT and not c["line2_5"])
        for key in ("falls_1pp", "into_red"):
            with self.subTest(f"the vectors' middle roll-up: {key}"):
                self.assertGreater(middle[key], 0)
                self.assertIsInstance(middle[key], int)
        for label, found in (
                ("unscored", any(not b["scored"] for b in bases)),
                ("scored but not lines 2 + 5", any(b["scored"] and not b["scored_line2_5"] for b in bases)),
                ("margin outlier", any(b["margin_outlier"] for b in bases)),
                ("no margin", any(not b["has_margin"] for b in bases)),
                ("lines 2 + 5 differ", any(b["revenue_line2_5"] != b["medicaid_net_revenue"] for b in bases)),
                ("no net income", any(b["has_margin"] and b["net_income"] is None for b in bases)),
                ("no share", any(h["share"] is None for h in hospitals))):
            with self.subTest(label):
                self.assertTrue(found)

    def test_both_sides_of_the_day_floor(self):
        """The floor shows in the stored share (a scenario hospital under it keeps its state's share)."""
        edges = conformance._floor_edges(self.records())
        days = sorted(r["base"]["medicaid_days"][0] for r in edges)
        self.assertLess(days[0], params.MIN_MEDICAID_DAYS)
        self.assertGreaterEqual(days[1], params.MIN_MEDICAID_DAYS)
        chosen = {r["ccn"] for r in conformance.pick_hospitals(self.records())}
        self.assertTrue({r["ccn"] for r in edges} <= chosen)
        below, above = sorted(edges, key=lambda r: r["base"]["medicaid_days"][0])
        self.assertEqual(below["share"], below["state_share"])  # under the floor: the state's share unchanged
        self.assertEqual(below["share_factor"], 1.0)
        self.assertNotEqual(above["share_factor"], 1.0)  # at the floor: its own factor applies

    def test_no_hospital_is_named(self):
        text = conformance.PATH.read_text(encoding="utf-8")
        for key in ('"ccn"', '"name"', '"city"', '"state"'):
            self.assertNotIn(key, text)

    _records = None

    @classmethod
    def records(cls):
        if cls._records is None:
            from pp_pipeline import emit_medicaid
            cls._records = emit_medicaid.records_from_pins()[-1]
        return cls._records


if __name__ == "__main__":
    unittest.main()
