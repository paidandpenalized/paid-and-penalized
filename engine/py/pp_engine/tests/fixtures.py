"""Shared test data: places, not hospitals; and the one statement of how a whole-dollar hospital row adds up."""
from pp_engine.dollars import PARTS

# (state, Care Compare's county, impact-file FIPS, label) that the rules check (no doubt): the known cases, misspellings,
# and the collisions. test_location runs them on its synthetic fixture, test_geo_pins on the pinned atlas.
CHECKED_COUNTIES = [
    ("IL", "DE KALB", "17037", "DeKalb County"), ("IL", "DEKALB  ", "17037", "DeKalb County"), ("IL", "De-Kalb", "17037", "DeKalb County"),
    ("GA", "DE KALB", "13089", "DeKalb County"), ("IL", "DU PAGE", "17043", "DuPage County"),
    ("WI", "FOND DU LAC", "55039", "Fond du Lac County"), ("NM", "DONA ANA", "35013", "Doña Ana County"),
    ("IL", "LA SALLE", "17099", "LaSalle County"), ("IL", "LA  SALLE", "17099", "LaSalle County"),
    ("LA", "LA SALLE", "22059", "LaSalle Parish"), ("LA", "LA SALLE", "17099", "LaSalle Parish"),  # the state decides
    ("MO", "ST. LOUIS", "29189", "St. Louis County"), ("MO", "SAINT LOUIS", "29189", "St. Louis County"),
    ("MO", "ST. LOUIS COUNTY", "29189", "St. Louis County"), ("VA", "RICHMONDCITY", "51760", "Richmond City"),
    ("VA", "RICHMOND CITY.", "51760", "Richmond City"), ("VA", "RICHMOND-CITY", "51760", "Richmond City"),
    ("MO", "SAINT-LOUIS", "29189", "St. Louis County"), ("MO", "ST LOUIS", "29189", "St. Louis County"),
    ("MO", "ST. LOUIS CITY", "29510", "St. Louis City"),
    ("MO", "SAINT LOUIS CITY", "29510", "St. Louis City"), ("MO", "STE. GENEVIEVE", "29186", "Ste. Genevieve County"),
    ("MO", "SAINTE GENEVIEVE", "29186", "Ste. Genevieve County"), ("LA", "EAST BATON ROUGE", "22033", "East Baton Rouge Parish"),
    ("AK", "FAIRBANKS NORTH STAR BOROUGH", "02090", "Fairbanks North Star"), ("VA", "RICHMOND CITY", "51760", "Richmond City"),
    ("VA", "JAMES CITY", "51830", "James City County"), ("NV", "CARSON CITY", "32510", "Carson City"),
    ("VA", "FAIRFAX", "51059", "Fairfax County"), ("VA", "ROANOKE CITY", "51770", "Roanoke City"),
    ("UT", "SALT LAKE CITY", "49035", "Salt Lake County"), ("DC", "DISTRICT OF COLUMBIA", "11001", "District of Columbia"),
    ("CT", "HARTFORD", "09110", "Hartford County"),  # a planning-region FIPS the atlas lacks; Care Compare's county is known
    ("MO", "ST. LOUIS COUNTY.", "29189", "St. Louis County"), ("TX", "HARRIS-COUNTY", "48201", "Harris County"),
    ("MO", "ST. LOUIS COUNTY.", None, "St. Louis County"), ("TX", "HARRIS-COUNTY", None, "Harris County"),  # no FIPS
]


def assert_adds_up(case, r, who):
    """Every figure in a whole-dollar `hospital_row` is an integer, and every sum is exactly the sum of what is shown
    beside it. `who` is what a failure says about the row (a test on the pinned files gives the first two digits of the
    CCN, not the CCN). The 0.01 is written out: this is the independent statement of the HAC rate."""
    case.assertTrue(all(type(r[k]) is int for k in PARTS + ("base", "total", "hrrp", "hvbp", "after", "at_stake", "hac",
                                                             "net")), who)
    case.assertEqual(r["base"], r["fed"] + r["mdh_addon"], who)
    case.assertEqual(r["total"], r["base"] + sum(r[k] for k in PARTS[2:]), who)
    case.assertEqual(r["after"], r["total"] + r["hrrp"] + r["hvbp"], who)
    case.assertEqual(r["at_stake"], round(0.01 * r["after"]), who)
    case.assertEqual(r["hac"], -r["at_stake"] if r["cut"] else 0, who)
    case.assertEqual(r["net"], r["hrrp"] + r["hvbp"] + r["hac"], who)
