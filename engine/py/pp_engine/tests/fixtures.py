"""Shared test data: places, not hospitals."""

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
