"""County geometry and names (ported from Thirty Day Readmissions' tests), on synthetic shapes."""
import unittest

from pp_engine import geo


class GeoTest(unittest.TestCase):
    def test_region_and_division(self):
        self.assertEqual(geo.region_of("UT"), ("West", "Mountain"))
        self.assertEqual(geo.region_of("DC"), ("South", "South Atlantic"))
        self.assertEqual(geo.region_of("ZZ"), (None, None))


class CountyKeyTest(unittest.TestCase):
    def test_spacing_punctuation_saint_and_accents_do_not_matter(self):
        for a, b in [("DE KALB", "DeKalb"), ("  DE   KALB  ", "DeKalb"), ("DE-KALB", "DeKalb"), ("LA SALLE", "LaSalle"),
                     ("SAINT LOUIS", "St. Louis"), ("SAINT-LOUIS COUNTY", "St. Louis"), ("ST.LOUIS", "St. Louis"),
                     ("SAINTE GENEVIEVE", "Ste. Genevieve"), ("DONA ANA", "Doña Ana"), ("FOND DU LAC ", "Fond du Lac")]:
            self.assertEqual(geo.county_key("ZZ", a), geo.county_key("ZZ", b), a)

    def test_a_legal_suffix_after_a_hyphen_or_before_punctuation_is_dropped(self):
        for raw, want in [("ST. LOUIS COUNTY.", "stlouis"), ("HARRIS-COUNTY", "harris"), ("HARRIS COUNTY,", "harris"),
                          ("HARRIS - COUNTY", "harris"), ("HARRIS_COUNTY", "harris"), ("ORLEANS PARISH.", "orleans"),
                          ("JUNEAU CITY-AND-BOROUGH", "juneau"), ("BETHEL CENSUS-AREA.", "bethel"),
                          ("NORTH SLOPE BOROUGH;", "northslope"), ("ANCHORAGE-MUNICIPALITY", "anchorage"),
                          ("COUNTY", "county"), ("HARRISCOUNTY", "harriscounty"), ("MIAMI-DADE", "miamidade")]:
            self.assertEqual(geo.county_key("ZZ", raw), ("ZZ", want), raw)

    def test_city_stem_drops_the_city_a_key_ends_in(self):
        for raw, want in [("RICHMOND CITY", "richmond"), ("RICHMOND-CITY.", "richmond"), ("CARSON CITY", "carson"),
                          ("RICHMOND", "richmond"), ("CITY", ""), ("ELLICOTT CITY COUNTY", "ellicott")]:
            self.assertEqual(geo.city_stem(geo.county_key("VA", raw)), ("VA", want), raw)

    def test_saint_is_only_a_whole_word(self):
        self.assertEqual(geo.county_key("ZZ", "TOUSSAINT"), ("ZZ", "toussaint"))
        self.assertEqual(geo.county_key("ZZ", None), ("ZZ", ""))


# (state, Care Compare's county, impact-file FIPS, label) that the rules check (no doubt): the known cases, misspellings,
# and the collisions. CountyDoubtTest runs them on CountyLabelTest's fixture, RealAtlasCountyTest on the pinned atlas.


class ReadCountiesTest(unittest.TestCase):
    """geo.read_counties on a hand-made topology: quantized, delta-encoded arcs; a county's centroid is its largest
    polygon's."""
    TOPO = {
        "type": "Topology",
        "transform": {"scale": [0.5, 0.5], "translate": [10.0, 20.0]},
        # arc 0: the unit square (2x2 quantized units); arc 1: a small square; arc 2: a big square
        "arcs": [[[0, 0], [0, 2], [2, 0], [0, -2], [-2, 0]],
                 [[20, 20], [0, 1], [1, 0], [0, -1], [-1, 0]],
                 [[40, 0], [0, 6], [6, 0], [0, -6], [-6, 0]]],
        "objects": {"counties": {"type": "GeometryCollection", "geometries": [
            {"type": "Polygon", "id": "99001", "arcs": [[0]], "properties": {"name": "Squareville"}},
            {"type": "MultiPolygon", "id": 99002, "arcs": [[[1]], [[~2]]], "properties": {"name": "Two Isles"}},
            {"type": None, "id": "99003", "properties": {"name": "No Shape"}},
        ]}},
    }

    def test_decodes_shapes_centroids_and_names(self):
        c = geo.read_counties(self.TOPO)
        self.assertEqual(sorted(c.shape), ["99001", "99002"])  # a null geometry is skipped
        self.assertEqual(c.shape["99001"], [[[(10.0, 20.0), (10.0, 21.0), (11.0, 21.0), (11.0, 20.0), (10.0, 20.0)]]])
        self.assertEqual(c.centroid["99001"], (20.5, 10.5))  # (lat, lon)
        self.assertEqual(c.centroid["99002"], (21.5, 31.5))  # the larger polygon wins, whatever its winding
        self.assertEqual(c.name["99002"], "Two Isles")  # a numeric id is zero-filled to 5 digits
        self.assertEqual(c.by_name, {})  # FIPS state 99 is no state, so no name key
        named = geo.read_counties({**self.TOPO, "objects": {"counties": {"type": "GeometryCollection", "geometries": [
            {"type": "Polygon", "id": "49001", "arcs": [[0]], "properties": {"name": "De Kalb"}}]}}})
        self.assertEqual(named.by_name, {("UT", "dekalb"): (20.5, 10.5)})
        self.assertEqual(named.named, {("UT", "dekalb"): "De Kalb"})


if __name__ == "__main__":
    unittest.main()
