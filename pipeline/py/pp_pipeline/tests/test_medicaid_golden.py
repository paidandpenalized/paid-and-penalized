"""The Medicaid work-requirement scenario file's goldens: a fresh build from the pins equals the committed file, and the
middle scenario's headline numbers (research note, 2026-11-06 changes, Maryland out) hold. The FY2023 numbers are
modeled, not reported: a change here is a methods change (docs/METHODS-LOG.md), not a fix."""
import functools
import unittest

from pp_pipeline import emit_medicaid
from pp_pipeline.files import read_json, read_manifest, require_current

EMITTED = emit_medicaid.emitted_path(2023)


@functools.lru_cache(maxsize=None)
def fresh():
    return emit_medicaid.build_from_pins("2000-01-01T00:00:00Z")


def with_built_at(doc):
    return {**doc, "built_at": None}


class Golden(unittest.TestCase):
    def test_a_fresh_build_equals_the_committed_file(self):
        self.assertEqual(with_built_at(fresh()), with_built_at(read_json(EMITTED)))

    def test_the_committed_file_was_built_from_the_current_pins(self):
        require_current(read_json(EMITTED), read_manifest(), "the Medicaid scenario file")

    def test_the_four_state_inputs_are_sources(self):
        self.assertTrue({"cms64-viii-2026-02", "cms64-fmr-fy2023-map", "urban-2026-a2-wr",
                         "hcris-fy2023-state-miur"} <= set(fresh()["sources"]))

    def test_the_middle_scenario_headlines(self):
        mid = fresh()["national"]["middle"]
        self.assertAlmostEqual(mid["lost"] / 1e9, 7.93, places=2)
        self.assertAlmostEqual(mid["added_uncompensated"] / 1e9, 5.51, places=2)
        self.assertEqual(mid["falls_1pp"], 234)
        self.assertEqual(mid["into_red"], 36)

    def test_scenario_hospitals(self):
        doc = fresh()
        cls = doc["columns"].index("cls")
        self.assertEqual(sum(1 for r in doc["hospitals"] if r[cls] == "scenario"), 3044)

    def test_scenarios_are_ordered_low_to_high(self):
        doc = fresh()
        self.assertEqual([s["id"] for s in doc["scenarios"]], ["low", "middle", "high"])
        n = doc["national"]
        self.assertLess(n["low"]["lost"], n["middle"]["lost"])
        self.assertLess(n["middle"]["lost"], n["high"]["lost"])

    def test_maryland_is_starred_and_out_of_the_totals(self):
        doc = fresh()
        self.assertEqual(doc["states"]["MD"]["cls"], "all_payer")
        self.assertEqual(doc["states"]["MD"]["rollup"]["middle"]["lost"], 0)
        cols = doc["columns"]
        state, cls, base = cols.index("state"), cols.index("cls"), cols.index("status")
        in_totals = sum(1 for r in doc["hospitals"] if r[base] is not None and r[cls] != "all_payer")
        self.assertEqual(doc["national"]["middle"]["hospitals"], in_totals)
        self.assertTrue(any(r[state] == "MD" for r in doc["hospitals"]))
        for group in doc["groups"].values():
            self.assertLessEqual(group["middle"]["hospitals"], in_totals)

    def test_every_group_and_row_is_whole(self):
        doc = fresh()
        self.assertEqual(set(doc["groups"]), {"critical_access", "acute", "rural", "urban", "expansion_states",
                                              "safety_net", "public", "nonprofit", "forprofit", "beds_lt50",
                                              "beds_300plus"})
        for g in doc["groups"].values():
            self.assertEqual(set(g), {"low", "middle", "high"})
        self.assertEqual({len(r) for r in doc["hospitals"]}, {len(doc["columns"])})

    def test_the_file_is_small(self):
        from pp_engine.contract import format_emitted
        self.assertLess(len(format_emitted(fresh()).encode("utf-8")), 3 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
