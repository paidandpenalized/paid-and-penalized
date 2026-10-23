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

## dollars methods_version 2 (2026-10-23)
- No estimate changes: every hospital's figures and the national and headline sums are as in methods_version 1. What
  is new is `bands`, the likely ranges on the figures, from a back-test, and `stratum` on each estimated hospital (the
  row of `bands` its ranges come from). `schema_version` is 2 (`bands` is an object, not null). The back-test's pins
  join `sources`: the FY2024 HACRP file, the FY2024 final rule's impact file, Tables 1A-1E, HRRP supplemental file and
  Table 16B, and an extract of CMS's HCRIS cost reports for FY2024.
- The back-test (`pipeline/py/pp_pipeline/backtest_dollars.py`, `run.py backtest`; statistics in `pp_engine/bands.py`)
  runs the same estimate (the same functions and assumptions: new-technology payments left out, the year's rates, the
  impact file's volume, which for FY2024 is FY2022 claims) on the FY2024 rule's files and the FY2024 HACRP decisions,
  and sets each hospital's figures beside its FY2024 Medicare cost report. The readers take the rule's year, which
  picks the impact file's column names (FY2024: `CASETA41`, `TACMIV41`, `CMIV41`, `FY 2024 Wage Index`; Medicare-
  dependent hospitals are provider types 14 and 15, their rate the `HSP Rate`, already updated to FY2024, so not
  updated again; the low-volume multiplier is `Low Volume Hospital Adjustment`) and Table 16B's factor heading. FY2024's
  Table 1C writes its updates without the word "Percent"; the rates reader takes both forms.
- The cost reports: CMS's HCRIS file `HOSP10FY2024.ZIP` (Form CMS-2552-10; reports beginning 2023-10-01 to
  2024-09-30), 136 MB, too large for the repo. The pin `hcris-fy2024-wse` is an extract
  (`pipeline/py/pp_pipeline/hcris_extract.py`, `run.py extract-hcris`): one row per report, its identity and status,
  whether it has Worksheet E Part A and the Pennsylvania Rural Health Model's worksheet, and the Part A lines read.
  CMS regenerates the HCRIS zips as reports are filed and settled (this copy's Last-Modified is 2026-10-05), so the
  manifest's SHA-256 is of the copy retrieved on 2026-10-23. No archive copy is published.
- Ground truth, Worksheet E Part A (Provider Reimbursement Manual, Part 2, chapter 40, Transmittal 25, 4030.1), each
  line summing its columns 1 and 1.01: the federal DRG payment, lines 1.01 + 1.02; HRRP, line 70.94 + 70.91 (the
  Medicare-dependent hospital's part); HVBP, 70.93 + 70.90; the HAC cut, 70.99 (positive; line 71 subtracts it); the
  net, 70.93 + 70.94 + 70.90 + 70.91 - 70.99. Over all 6,113 reports in the file, 70.94 is negative on 2,452 and
  positive on 10, 70.91 negative on all 74, 70.99 positive on 866 and negative on 3, and 70.93 and 70.90 go both ways,
  as the chapter's line 71 implies. The model's figures: `fed` (lines 1.01 and 1.02 do not hold a Medicare-dependent
  hospital's add-on, which B does), `hrrp`, `hvbp`, `atStake` for the hospitals CMS cut, and `net`.
- The comparison set (`bands.comparison`): reports covering exactly the federal year, 2023-10-01 to 2024-09-30, so the
  program lines hold FY2024's factors only; with Worksheet E Part A; not Maryland's or Puerto Rico's; without the
  Pennsylvania Rural Health Model's worksheet; for a hospital in the FY2024 HACRP file that the estimate prices. Each
  report left out is counted by the first rule it fails: of 6,113, 5,249 cover another period, 358 have no Part A,
  0 are Maryland's, 2 Puerto Rico's, 0 the model's, 3 are not in the HACRP file and 3 have no estimate; 498 hospitals
  remain, one report each (246 as submitted, 93 settled without audit, 159 amended), 134 of them cut by CMS.
- Per hospital and measure, the error is log(model / actual) where both are nonzero and of one sign. Opposite signs,
  a zero on the cost report, a zero in the model, and both zero are counted (`pairs`), not dropped silently. The HAC
  cut is tested on the cut hospitals only: 131 compared, 1 of opposite sign, 2 with no line 70.99. The net is tested
  on every hospital with a nonzero net on its cost report.
- Strata: the impact file's bed count (from cost reports) under 100, 100 to 299, 300 or more, crossed with whether the
  hospital is a sole community or Medicare-dependent hospital. A stratum with fewer than 30 hospitals for a measure
  takes the percentiles of its bed band (both kinds pooled), and a band with fewer than 30 takes every hospital's;
  `pool` records which, `poolN` how many.
- Bands: per stratum and measure, the 10th and 90th percentiles of the errors (linear interpolation between order
  statistics, as Excel's PERCENTILE.INC), rounded to 4 places, and the multipliers exp(-p90) and exp(-p10), also to 4
  places. A hospital's range is its estimate times the two: in the back-test, 8 in 10 hospitals' actual figures fell
  in such a range around the model's. Each stratum's own median error (its bias) and the overall median are reported
  beside the bands; the point estimates are not corrected for them. The net's band is back-tested directly, not
  built from the others.
- The national range: the sum of the cut hospitals' estimates times the 10th and 90th percentiles of sum(actual) /
  sum(model) over the 131 compared cut hospitals, resampled with replacement 10,000 times (a bootstrap of hospitals;
  Python's Mersenne Twister, seed 20261023). It reflects one year's back-test, not how the next year's will move.
- On the pages (the HACRP site): a hospital's range is its estimate times its stratum's multipliers, the HAC cut's for
  its dollars at stake and the net's for its net (no range on a net of $0); the nation's is the headline cut times the
  bootstrap's two percentiles; a state's or metro area's is its cut hospitals' ranges added up, low ends and high ends,
  as wide as if every hospital's estimate erred the same way (wider than the resampled national range). `bands.volumeFy`
  is the claims year of the back-test's volume (FY2022: the FY2024 impact file's README, "FY 2022 MEDPAR").
- Checks, set before any error was computed: the HAC cut's overall median error within -0.25 to 0.25 (a factor of
  1.28 either way would mean a structural mistake, not drift); at least 180 hospitals in the comparison set (six strata
  of 30) and at least 90 cut hospitals compared (three bed bands of 30). A failing check writes nothing, as the national
  checks do. On these pins: median 0.0233, 498 hospitals, 131 cut hospitals.
- Limits: one year; whole-year October reports only, so hospitals with other fiscal years are not tested; the FY2024
  impact file's wage index is the final rule's, before the correction notice (CMS-1785-CN, which corrected wage index
  tables for some hospitals and posted no corrected impact file); the cost reports are as CMS holds them today, many
  not yet settled.
