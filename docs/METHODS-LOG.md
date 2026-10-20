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
