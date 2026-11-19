"""The TEAM file's goldens: a fresh build from the pins equals the committed file, which was built from the current
pins. Episode counts, prices and percentiles are estimates from public files, not CMS's own: a change here is a methods
change (docs/METHODS-LOG.md), not a fix."""
import unittest

from pp_pipeline import emit_team
from pp_pipeline.files import read_json, read_manifest, require_current
from pp_pipeline.tests.team.helpers import fresh

EMITTED = emit_team.emitted_path()


def with_built_at(doc):
    return {**doc, "built_at": None}


class Golden(unittest.TestCase):
    def test_a_fresh_build_equals_the_committed_file(self):
        self.assertEqual(with_built_at(fresh()), with_built_at(read_json(EMITTED)))

    def test_the_committed_file_was_built_from_the_current_pins(self):
        require_current(read_json(EMITTED), read_manifest(), "the TEAM file")

    def test_the_six_team_pins_and_the_crosswalk_are_sources(self):
        self.assertTrue({"team-participants", "team-prices", "cjrx-participants", "team-mup-dy2023", "team-mup-dy2024",
                         "team-quality", "county-cbsa-fy2027"} <= set(fresh()["sources"]))

    def test_the_file_is_small(self):
        from pp_engine.contract import format_emitted
        self.assertLess(len(format_emitted(fresh()).encode("utf-8")), 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
