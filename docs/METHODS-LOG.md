# Methods log

One heading per site methods version. A change that moves a site's emitted numbers for any reason other than
new source data bumps that site's `methods_version` and adds its heading here; a fix of an error gets a dated
entry under `corrections/` instead. CI's change gate looks for one of these (or a re-pin) whenever emitted data
changes, and a test requires the newest heading to match the emitted `methods_version`.

## hacrp methods_version 1 (2026-10-20)
- `data/emitted/hacrp/fy2026/hacrp.json` holds CMS's published FY2026 values for every hospital in the file,
  unchanged: numbers parsed from CMS's text, the text itself kept verbatim.
- It adds the model the what-if and solver use (measure parameters fit from CMS's own value and z pairs; the
  line between CMS's No and Yes decisions) and the per-measure estimate tag.

## hacrp methods_version 2 (2026-10-20)
- No number changes. `source_manifest` now hashes only each pinned input's id and SHA-256, so fixing a
  manifest entry's dates, title or URLs no longer changes the emitted file.

## hacrp-history methods_version 1 (2026-10-22)
- `data/emitted/hacrp-history/fy2026/hacrp_history.json` holds CMS's HACRP hospital file for every program year,
  FY2015 to FY2026, one row per hospital in one shape, CMS's text kept as written: CCN, state, Total HAC Score,
  payment reduction, each listed measure's part (a z-score from FY2018 on; a score in tenths before) and, for years
  scored in domains (FY2015 to FY2019), the two domain scores.
- Earlier years come from CMS's archives: the Provider Data Catalog's quarterly hospital snapshots (FY2019 to FY2025)
  and the Wayback Machine's copies of retired Hospital Compare zips (FY2015 to FY2018). For each year the pin is the
  last version CMS published (several years were reissued with corrections); each member is pinned byte for byte with
  the zip it came from recorded in the manifest (`memberOf`).
- FY2015 and FY2016 files have no payment column; their decisions come from CMS's cut lists (FY2015 IPPS final rule
  Table 17; the FY2016 HAC results file). Hospitals on a cut list that the year's hospital file leaves out are added
  with the list's own total and decision and no parts.
- Period dates are written MM/DD/YYYY whatever form the file used (DD-MON-YY in FY2015, MMDDYYYY in FY2016 and
  FY2017). FY2019's "Not Available" decision is written N/A, as in later years.
- `footnoted` lists, per year, the CCNs whose score or parts CMS footnoted or marked with asterisks. The self-check
  lets a recomputed score miss CMS's only on these rows, and only where CMS used a part its file withholds: a part
  missing from the file, footnoted in its own column, that the published total works out to a valid score for (in its
  year's published range and, in a year scored in tenths, a whole score from 1 to 10). FY2016 has 1 such row, FY2017
  44, most of them Maryland's; they are counted, and any other miss fails the build.
- FY2023 is the year CMS scored no hospital: every total is 0.0000 with no parts, and the pages read it as no score.
- `infections` sums Care Compare's per-hospital infection results for each calendar year with a full-year file
  (CY2017 to CY2019 and CY2021 to CY2024; extracts pinned by `pipeline/py/pp_pipeline/hai_extract.py`): per measure,
  the hospitals with an SIR and their median, and the observed and predicted infections over hospitals with both counts.

## hospital methods_version 1 (2026-10-20)
- `data/emitted/hospital/fy2027/hospital_master.json` holds one record per CCN listed in Care Compare's Hospital
  General Information, the FY2027 IPPS impact file, or a program file (HACRP FY2026; HRRP FY2027 from Thirty Day
  Readmissions). `fy` is the impact file's year. Name, address, ownership and kind come from Care Compare first,
  then the impact file and the Provider of Services file; IPPS statuses (MDH, SCH, RRC, EACH, IHS), teaching level
  and urban/rural from the impact file; certified beds from Provider of Services, else the impact file's beds.
- Each program gets `inProgram` (CMS's file for that year lists the CCN) and, when not, the first reason that
  applies: a hospital kind not paid under IPPS (`critical_access`, `psychiatric`, `childrens`, `long_term`,
  `rural_emergency`, `federal` for VA and Defense hospitals), `maryland`, `inactive` (Provider of Services shows
  Medicare participation ended), else `not_listed` (CMS's file leaves it out without saying why).
- No location fields yet (coordinates, county, CBSA, region); they come in methods_version 2.

## hospital methods_version 2 (2026-10-20)
- Every record gains a location: `lat`/`lon` (4 decimals), `geo` (where the point came from), `county`, `fips`,
  `cbsa`, `cbsaName`, `region`, `division`. The rules are Thirty Day Readmissions' (pipeline/build_data.py at
  80f3659), so its hospitals' values equal the master's (a test checks every one).
  - **Point:** a geocoded street address (U.S. Census Bureau Geocoder, benchmark Public_AR_Current: TDR's points,
    then one batch request on 2026-10-20 for the hospitals TDR doesn't cover, with the Care Compare address first and
    the Provider of Services address as a second try); else the 2024 ZCTA centroid of the hospital's ZIP; else the
    centroid of the county Care Compare names; else the centroid of the impact file's county (us-atlas 3.0.1).
  - **Stray check:** a street-address point more than 40 km outside the impact file's county is set aside; a ZIP or
    county point that far out is replaced by the impact-file county's centroid and name. Counties missing from the
    atlas aren't checked.
  - **County:** Care Compare's county in the atlas's spelling with its legal suffix (County, Parish, City for an
    independent city; none in AK, DC and the territories), or the impact file's county when Care Compare's name is
    unknown or a kept street address puts the hospital elsewhere. Counties the rules can't check are listed by the
    build, which fails above a set number.
  - **CBSA:** the impact file's geographic labor market area when it is a 5-digit CBSA, named from the FY2027
    county-to-CBSA crosswalk. **Region/division:** the Census Bureau's, from the state.
  - **State** falls back to the impact file's FIPS state when neither Care Compare nor Provider of Services gives one.
  - One change from TDR's rule: American Samoa, Guam, the Northern Mariana Islands and the Virgin Islands take no
    "County" suffix (TDR lists no hospital there).
- `inProgram` now means the hospital is subject to the program's payment adjustment for that file year. HACRP's
  FY2026 file lists Maryland's 43 hospitals with Payment Reduction "N/A"; they are now `inProgram: false` with reason
  `maryland`, as in HRRP (3,012 of 3,055 listed hospitals are in HACRP).
- `schema_version` 2 (the record's new fields are required).
