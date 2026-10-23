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

## dollars methods_version 1 (2026-10-22)
- `data/emitted/dollars/fy2026/dollars.json` is the first emission of the dollar estimates. It is shared by the sites that
  show dollars, so it sits beside the sites' folders, not under one. For every hospital in the HACRP file it holds a
  model, not a bill, of what Medicare pays the hospital for the year's inpatient care (`base`, `total`, and `parts`:
  the federal DRG payment, the Medicare-dependent hospital add-on, indirect medical education, disproportionate share,
  operating outliers, the sole community hospital difference, the low-volume adjustment, capital and uncompensated care)
  and what the three programs move: HRRP and HVBP (each the base payment times its adjustment factor minus 1), then
  the HAC Reduction Program's 1% cut of the payment after both (`atStake` for every hospital; `hac` for a hospital CMS
  cuts), and their `net`. Dollars are whole dollars that add exactly: the parts are rounded and every sum is built from
  the rounded parts, so a reader adding up a row or a column gets the figure shown.
- Inputs: the FY2026 final rule's impact file (cases, case-mix, wage index and the add-on factors; the volume is FY2024
  claims), Tables 1A-1E (rates), the HRRP supplemental file (factors), Table 16B (HVBP factors) and the HACRP file
  (who is cut). The year of the HACRP file must equal the rates' year, or the build stops.
- `status`: `estimated`, or why there is no estimate and no dollar keys: `maryland` (the state's own payment model; no
  HRRP, HVBP or HAC adjustment), `parhm` (Pennsylvania Rural Health Model participants; CMS publishes no FY2026
  participant file with CCNs, so none yet), `no-inputs` (no usable row in the impact file). On the pinned files 41
  hospitals are `no-inputs`, 9 of them cut by CMS; the national dollars cover estimated hospitals only, and the 9 are
  counted (`yesUnestimated`).
- A hospital missing from the HRRP file or from Table 16B takes factor 1 (`hrrpListed`, `vbpListed` say which). Hospitals
  outside HVBP are common and legitimate. On the pinned files 43 estimated hospitals are not in the HRRP file and 524 are
  not in Table 16B; the build fails if a later file has more.
- `national` sums the estimated hospitals; `headline` sums the hospitals CMS scored and marked Yes or No, the population
  the HACRP site counts, so its `yes` equals the site's headline count (one Yes carries no score and is outside it).
  Cut hospitals with an estimate are `cut`; the rest of `yes` are `yesUnestimated`.
- `checks` hold the sums against what CMS publishes, with ranges none of which is fitted to the estimate:
  HRRP dollars over the base payment of the penalized hospitals within 0.40% to 0.48% (CMS's 0.44%; the denominator CMS
  uses is unconfirmed: its text says all hospitals, the pinned files reproduce the figure only over the penalized ones);
  the net HVBP dollars within a tenth of the 2% pool (the program is budget-neutral); HAC dollars over everyone's payment
  within 0.20% to 0.30% (a quarter of hospitals cut by 1%); the cut count equal to the HACRP file's Yes count; and at most
  9 cut hospitals without an estimate.
- `assumptions` states the years (rates FY2026, volume FY2024), the end of Medicare-dependent hospital status and of the
  expanded low-volume tiers (2026-12-31, from the Consolidated Appropriations Act, 2026), and that NTAP is excluded.
- `bands` is null; ranges from a back-test come in methods_version 2.
- Where the rule allows more than one reading, the model chooses; each choice, as marked ASSUMPTION in the engine
  (`pp_engine/dollars.py`):
  - New-technology add-on payments are in no figure: they are not published per hospital, so the base, the HRRP and HVBP
    dollars and `atStake` run slightly low for a hospital that receives them.
  - The IME and DSH add-on factors apply to the federal DRG payment, not to the Medicare-dependent add-on or the sole
    community difference; DSH is after the 75% reduction in section 1886(r).
  - The operating outlier factor applies to the federal payment plus IME plus DSH (the file does not say whether the DRG
    payment alone); a blank factor is no outliers.
  - A sole community hospital is paid the higher of its federal operating payment and its hospital-specific rate (FY2026
    final rule: "the higher of the applicable Federal rate, or the hospital-specific rate"). The federal operating
    payment is the federal DRG payment plus IME, DSH, operating outliers and uncompensated care, so the comparison is
    not against the bare DRG payment, and a hospital paid its hospital-specific rate is paid that amount in all, with
    nothing on top. The rule's text confirms DSH sits on the federal side; that IME, outliers and uncompensated care do is
    an assumption to verify. The difference is `schDiff`, not part of the base HRRP and HVBP adjust (42 CFR 412.152
    excludes it from the SCH base operating DRG payment amount; a Medicare-dependent hospital's includes its add-on).
    The comparison is made once, on the year's totals, not claim by claim, which can only understate the difference. A
    blank or zero hospital-specific rate is no usable rate; the comparison uses the case-mix the file gives for
    hospital-specific-rate hospitals and the same transfer-adjusted cases.
  - A Medicare-dependent hospital is paid its federal operating payment (the same terms) plus 75% of the amount by which
    its hospital-specific payment exceeds it ("the higher of the Federal rate, or the Federal rate plus 75 percent of the
    difference"). The impact file's rate for these hospitals is the FY2025 one (the FY2026 rule modeled the status
    expiring), so it is multiplied by 1 plus the FY2026 update for the hospital's quality and EHR scenario, the update
    Tables 1A and 1B state in their headings (2.6, 0.125, 1.775 or -0.7 percent). That hospital-specific rates are updated
    by that percentage is an assumption to verify. The file's sole community rates are already updated to FY2026.
  - The low-volume adjustment is a percentage add-on to total per-discharge payments, "including capital, DSH, IME, and
    outlier payments": the federal payment, the Medicare-dependent add-on, IME, DSH, operating outliers, the sole
    community difference and capital, not uncompensated care (the rule's list does not name it; to verify against 42 CFR
    412.101).
  - Uncompensated care is the per-claim amount times the file's Medicare bills (FY2024); the amount's own denominator is
    a three-year average of claims the file does not carry.
  - HRRP and HVBP each adjust the base operating payment only (not IME, DSH, capital or the rest); the HAC cut is 1% of
    everything the hospital is paid after both.
