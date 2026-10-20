"""The location rules and readers against the pinned geography files (no hospital data)."""
import unittest

from pp_engine import geo, location
from pp_engine.tests.fixtures import CHECKED_COUNTIES
from pp_pipeline.emit_hospital import cbsa_names, counties, zcta


class RealAtlasCountyTest(unittest.TestCase):
    """CHECKED_COUNTIES against the pinned us-atlas, whose spellings Care Compare's must reach."""

    @classmethod
    def setUpClass(cls):
        cls.COUNTIES = counties()

    def county(self, st, name, fips):
        return location.county_label({"county": name}, st, fips, self.COUNTIES)

    def test_known_names_misspellings_and_collisions_are_checked(self):
        for st, cc, fips, want in CHECKED_COUNTIES:
            self.assertEqual(self.county(st, cc, fips), (want, None), (st, cc, fips))
        impact = "unknown county; the impact-file county's name"
        self.assertEqual(self.county("TX", "NARNIA", "48201"), ("Harris County", impact))
        self.assertEqual(self.county("IA", "SIOUX CITY", "19193"), ("Woodbury County", impact))
        self.assertEqual(self.county("MO", "JEFFERSON CITY", "29051"), ("Cole County", impact))

    def test_salt_lake_county_centroid(self):
        lat, lon = self.COUNTIES.centroid["49035"]
        self.assertEqual(self.COUNTIES.by_name[geo.county_key("UT", "SALT LAKE")], (lat, lon))
        self.assertEqual(self.COUNTIES.name["49035"], "Salt Lake")
        self.assertAlmostEqual(lat, 40.67, delta=0.3)
        self.assertAlmostEqual(lon, -111.92, delta=0.3)


class GeoPins(unittest.TestCase):
    def test_zcta_and_cbsa_files_parse(self):
        points, names = zcta(), cbsa_names()
        self.assertGreater(len(points), 30000)
        self.assertEqual(len(points["84101"]), 2)
        self.assertEqual(names["41620"], "Salt Lake City-Murray, UT")
        self.assertTrue(all(len(c) == 5 and c.isdigit() for c in names))


if __name__ == "__main__":
    unittest.main()
