"""The HCRIS layer on the pinned data: each committed data/emitted/hcris/fy<YYYY>/hcris.json equals a fresh build from
its pinned cells table, every file stays under the 10 MiB limit, and the cells tables reproduce CMS's public use file
(the pinned sample) on every report the two share. Counts are facts of the pinned bytes; no hospital is named."""
import unittest

from pp_engine.contract import format_emitted
from pp_pipeline.files import EMITTED_DIR, read_json, read_manifest
from pp_pipeline.hcris import emit, puf

MIN_SAME_REPORT = 20  # per PUF year in the sample, so the check can't pass on a handful of reports


def emitted_years():
    return {int(p.parent.name[2:]): p for p in (EMITTED_DIR / "hcris").glob("fy*/hcris.json")}


class Golden(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = read_manifest()
        cls.pinned = emit.pinned_years(cls.manifest)
        cls.emitted = emitted_years()
        if not cls.pinned and not cls.emitted:
            raise unittest.SkipTest("no HCRIS pins or emitted files yet")

    def test_every_pinned_year_is_emitted_and_nothing_else(self):
        self.assertEqual(sorted(self.emitted), sorted(self.pinned))

    def test_rebuild_equals_committed(self):
        for year, path in sorted(self.emitted.items()):
            with self.subTest(year=year):
                committed = read_json(path)
                fresh = emit.build(year, self.manifest, committed["built_at"])
                self.assertEqual(format_emitted(fresh), path.read_text(encoding="utf-8"))
                self.assertEqual(emit.check(fresh), [])

    def test_sizes(self):
        for year, path in self.emitted.items():
            with self.subTest(year=year):
                self.assertLess(path.stat().st_size, emit.MAX_BYTES)

    def test_the_pins_reproduce_cms_public_use_file(self):
        if puf.SAMPLE_PIN not in {e["id"] for e in self.manifest}:
            self.fail(f"no {puf.SAMPLE_PIN} pin: the PUF check has nothing to read")
        sample = puf.pinned_sample()
        self.assertTrue(sample)
        for year, records in sorted(sample.items()):
            with self.subTest(year=year):
                reports, values = puf.pinned_reports(year)
                out = puf.compare(reports, values, records)
                self.assertEqual(out["differences"], [])
                self.assertGreaterEqual(out["same_report"], MIN_SAME_REPORT)


if __name__ == "__main__":
    unittest.main()
