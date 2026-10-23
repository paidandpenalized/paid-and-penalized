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
  places. A hospital's range is its estimate times the two: as wide as the middle 80% of its stratum's errors (or its
  pool's) in the back-test. The ranges are fitted on the same hospitals, so how many of a stratum's own a range holds
  measures the fit, not how often a later actual lands inside; the Methods page gives each stratum's count (the
  points' cost-report figures inside their ranges, as the pages work them out). Each stratum's own median error (its
  bias) and the overall median are reported beside the bands; the point estimates are not corrected for them. The
  net's band is back-tested directly, not built from the others.
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

## dollars methods_version 3 (2026-10-23)
- The payment the HAC cut is taken on (`total`, so `after`, `atStake`, `hac` and `net`) now includes the indirect medical
  education (IME) Medicare pays a teaching hospital on its Medicare Advantage stays, a new part, `imeMa`
  (`schema_version` 3). Methods_version 2's model left it out, and its back-test showed the cost. Among the compared
  cut hospitals that are neither sole community nor Medicare-dependent, the HAC cut's error less the error of the
  model's total payment against lines 47 + 50 (operating without line 29.01, and capital) was -0.069 at the median
  for the 42 whose cost report has line 29.01 and -0.0002 for the 56 without: line 70.99's base holds something line
  47 does not. (These two figures come from a one-off run of methods_version 2's model, made before the pinned extract
  held line 29.01; `run.py backtest` prints only the current model's figures, so it does not reproduce them.) And the
  national range sat entirely above the national estimate.
- Why it is in the base: the cost report's HAC worksheet (Provider Reimbursement Manual, Part 2, chapter 40, Exhibit 5)
  lists "Operating IME payments for Medicare Advantage patients" among the payments "required to calculate the HAC
  reduction adjustment"; its line 15 is Worksheet E, Part A, line 49, which adds line 29.01 ("Total IME Payment -
  Managed Care") to the federal operating payment.
- How it is modeled: the hospital's operating IME factor (`TCHOP`) times the impact file's Medicare Advantage cases and
  case-mix for teaching hospitals paid IME on them (`IME_CASETA43` and `IME_TACMIV43`; FY2024's `IME_CASETA41` and
  `IME_TACMIV41`) times the same wage-adjusted rate pair as the hospital's own stays (Worksheet E, Part A, line 22.01:
  the IME factor "times line 3", the managed care simulated payments). Blank columns, as for every non-teaching hospital,
  are none.
- It enters `total` only: not the base the readmissions and value-based programs adjust, not the federal payment an
  SCH's or MDH's hospital-specific payment is compared with (line 49 adds line 29.01 after the comparison), and not the
  low-volume adjustment's base (a percentage of payments per traditional Medicare discharge). Assumed: the section 422
  IME add-on for these stays (line 28.01) is in `TCHOP` as it is for the hospital's own stays. The back-test does not
  contradict it: the 39 comparison-set hospitals whose line 29.01 includes line 28.01 run at 0.74 of their line 29.01
  at the median, the 140 without at 0.72.
- On the pinned FY2024 files the modeled IME on Medicare Advantage stays is 0.70 of what the cost reports record on
  line 29.01, dollar-weighted (0.72 at the median), over the 179 comparison-set hospitals with both; 22 have the line
  and no modeled amount, 5 the reverse. The model's figure comes from the impact file's Medicare Advantage counts, two
  years before the payment year; growth in Medicare Advantage stays since then is one likely cause, which this
  back-test cannot separate from others. The HAC back-test carries the gap in its errors. Every other rule of
  methods_version 2 stands.
- The back-test with it: the HAC cut's median error is 0.0384 (p10 -0.123, p90 0.2694) over the same 131 cut hospitals;
  the national ratio of the cut hospitals' cost reports to the estimate is 0.9981, resampled 0.9785 to 1.0175, so the
  national range holds the national estimate. The checks pass as set (median within 0.25; 498 hospitals; 131 cut).
- What matched to 0.06%, and what did not: for the same 42 hospitals with line 29.01, the HAC cut's error less the
  error of the model's total payment against lines 49 + 50 (both now with the Medicare Advantage teaching payments) is
  -0.0006 at the median (-0.0002 for the 56 without). That says the cut is now figured on the cost report's base:
  1% of the same parts. It does not say those parts are the right size. Less the DRG payments' error instead (the
  volume drift alone), the 42 run -0.039 at the median against -0.009 for the 56, in line with the short Medicare
  Advantage teaching payments above. The FY2026 estimate models them the same way, from the FY2026 impact file's
  counts two years back, so teaching hospitals' FY2026 estimates can still run a little low; their ranges come from
  errors that include this gap. `run.py backtest` prints each of these figures; `test_backtest_dollars` pins them.
- The HCRIS extract (`hcris-fy2024-wse`) now also holds lines 28.01 and 29.01, read only for those figures; it was
  re-derived from the same zip and re-pinned (576,678 bytes), and nothing the back-test computes changed.
- A hospital the impact file gives no bed count (blank or 0) is still estimated: its stratum is `all`, and its ranges
  take each measure's `overall` band, which now carries its multipliers (`low`, `high`) beside its percentiles. The
  back-test's comparison set still needs a bed count; a report for such a hospital is left out and counted
  (`comparison.excluded.noBeds`). Neither pinned impact file has such a row, so no figure changed.
- The pages: a hospital page says "plus the teaching payments Medicare makes on its Medicare Advantage patients' stays"
  wherever the hospital's payment includes them, and its statement and worksheet show them as a line of their own. The
  CSV gains the HAC cut's likely range (`hac_dollars_low_modeled`, `hac_dollars_high_modeled`; CSV schema_version 3).

## dollars methods_version 4 (2026-10-23)
- An accuracy pass held each term of the estimate against primary sources: the FY2026 IPPS/LTCH PPS final rule (90 FR
  36536), the Provider Reimbursement Manual, Part 2, chapter 40 (Form CMS-2552-10, section 4030.1, Transmittal 25) and
  42 CFR part 412. Five corrections move the figures and two changes do not. None is a correction toward the back-test:
  point estimates are still never scaled to it. Each effect below is over the 2,971 estimated hospitals, applied in this
  order, each against the step before. The readmissions and value-based dollars move only through the
  Medicare-dependent hospital add-on, the one part of the base these corrections touch.
  1. **Operating outliers are a share of the federal DRG payment alone.** Methods_versions 1 to 3 applied the impact
     file's `OUTFACT_F` to the DRG payment plus IME and DSH. The rule sets outliers at 5.1 percent of "total “operating
     DRG payments,” which does not include IME and DSH payments" (90 FR 37214) and divides "total outlier payments by
     total operating Federal payments plus total outlier payments" (90 FR 37227); on the wider base the file's factors
     came to 6.05%, past the statute's 6% ceiling. Effect: outliers -$995.3 million, the sole community difference
     +$20.2 million (a smaller federal side), total -$974.9 million; the HAC cut $2.79 million smaller; readmissions
     -$1,837, value-based +$414; net +$2.78 million.
  2. **Capital outliers are a share of the capital federal payment alone**, beside capital IME and DSH rather than on top
     of them: the rule's capital outlier share is 3.84 percent "of capital payments based on the Federal rate" (90 FR
     37228). Effect: capital -$53.5 million, total the same; the HAC cut $148,722 smaller; net +$148,722.
  3. **A Medicare-dependent hospital's rate takes the rule's budget-neutrality factors as well as the update.** The
     FY2026 impact file gives the FY2025 rate. The rule adjusts a hospital-specific rate "by the MS-DRG reclassification
     and recalibration budget neutrality factor" (0.998580) and, for an SCH, by the 10-percent cap factor (0.999897)
     (90 FR 37218, 37232), and applies the same updates to MDHs if the law extended the program (90 FR 37231), which it
     did. CMS's FY2027 impact file implies 1.0244375 for the full-update scenario against 1.026 x 0.998580 x 0.999897 =
     1.0244376. Effect: the MDH add-on -$1.01 million, total -$1.03 million; the HAC cut $3,040 smaller; readmissions
     +$3,871, value-based -$2,956; net +$3,955. FY2024's file gives the MDH rate "updated to FY 2024 for SCH & MDH
     providers", so the back-test takes no factor, as before.
  4. **The low-volume adjustment is a percentage of every other part of the payment.** The cost report's low-volume
     worksheet (Exhibit 4) multiplies the federal and hospital-specific payments, outliers, IME, "Operating IME payments
     for Medicare Advantage patients", DSH, "Uncompensated care payments", ESRD, capital and new-technology payments by
     the percentage. Methods_version 1 left uncompensated care out of the base, and methods_version 3 the IME on
     Medicare Advantage stays ("not the low-volume adjustment's base"); both are in it now. Effect: low volume +$36.9
     million, total the same; the HAC cut $85,915 larger; net -$85,915.
  5. **Uncompensated care is each hospital's full-year payment as CMS sets it**: its Factor 3 (the impact file's
     `UCP_ADJ`) times the year's pool, Factor 1 x Factor 2, "$12,412,500,000 * 0.6214 = $ 7,713,127,500" (90 FR 36889).
     "Factor 3 is applied to the product of Factor 1 and Factor 2 to determine the amount of the uncompensated care
     payment that each eligible hospital will receive" (90 FR 36889-36890), and the cost report carries that amount
     (Worksheet E, Part A, line 35.02, "multiplying line 35 by line 35.01"). Methods_version 1 multiplied the per-claim
     amount by the file's FY2024 Medicare cases, but CMS divided that amount by a three-year claims average the file
     does not carry, and claims are falling. A hospital with no Factor 3 whose per-claim amount is not zero is paid the
     IHS or Tribal supplemental payment alone; it keeps the per-claim reading (26 estimated hospitals, $15.0 million).
     FY2024's pool for the back-test is "$10,015,191,021.88 * 0.5929 = $5,938,006,756.87" (88 FR 59001). Effect:
     uncompensated care +$328.1 million ($7.394 billion to $7.722 billion), total +$328.7 million; the HAC cut $727,285
     larger; readmissions +$9,142, value-based -$3,447; net -$721,590.
  6. **No program applies in Puerto Rico, and a program file that lists a Puerto Rico hospital stops the build**: each
     program is for "subsection (d) hospitals", which SSA 1886(d)(1)(B) limits to the fifty states and the District of
     Columbia. Neither year's HACRP file, HRRP supplemental file or Table 16B lists one, so the engine's Table 1C branch
     was dead and is gone (Table 1C's rates equal Table 1B's for the scenarios it lists). No figure moves.
  7. **Labels and citations.** HRRP and HVBP adjusting the base, each on its own, is the regulation (42 CFR
     412.154(b)(1), 412.162(b)(2)), not an assumption; only what the base leaves out (new-technology payments) is. The
     readmissions check cites Table I.G.7.-01 at 90 FR 37265-37266; CMS's footnote describes its denominator as all the
     eligible hospitals' payments, while its rows reproduce on the penalized hospitals' payments, which the check keeps.
     The section 422 IME add-on is in no figure: `TCHOP` equals the base formula, 1.35 x ((1 + resident-to-bed
     ratio)^0.405 - 1), on every teaching row of both impact files, so methods_version 3's "Assumed: the section 422 IME
     add-on for these stays (line 28.01) is in `TCHOP`" does not hold, for Medicare Advantage stays or a hospital's own.
     No figure moves.
- Together, nationally: total payment $129,772,818,726 to $129,108,924,630 (-0.51%); the HAC cut -$308,317,722 to
  -$306,193,136; readmissions -$336,618,373 to -$336,607,197; value-based -$3,141,656 to -$3,147,645; net
  -$648,077,751 to -$645,947,978. The headline (the hospitals CMS scored and marked Yes or No): the HAC cut
  -$308,230,282 to -$306,105,696, net -$647,860,213 to -$645,730,440, total $129,650,847,418 to $128,982,544,363.
- Two checks join `checks` (their ranges set before either was computed on the new base): `outlier_share`, operating
  outliers over the federal DRG payment plus operating outliers, within 4.6% to 5.6% (the rule's 5.1%, half a point
  either way, short of the 6% ceiling), 5.03% on these pins; and `uc_pool`, uncompensated care over the rule's pool,
  within 95% to 102% (short only by the hospitals outside the estimate, over only by the per-claim supplemental
  payments), 100.12%. `schema_version` stays 3: the file's shape is unchanged, and the schema's list of check ids gains
  the two.
- The back-test, re-run with the same rules, checks and thresholds: the HAC cut's median error is 0.0509 (p10 -0.1226,
  p90 0.2949) over the same 131 cut hospitals, from 0.0384; the national ratio of the cut hospitals' cost reports to
  the estimate is 0.9988, resampled 0.9779 to 1.0192 (from 0.9981), so the national range still holds the estimate.
  By item, the median moved -0.0020 (outliers), -0.0004 (capital), 0 (the MDH rate), +0.0085 (low volume, all of it in
  the under-100-bed sole community and Medicare-dependent group, 0.119 to 0.138) and +0.0064 (uncompensated care,
  FY2024's $5.55 billion by the old reading against $5.93 billion as CMS sets it). The cost reports carry the full
  Factor 3 amount, so the model's uncompensated care now matches what they record, and the estimate's remaining run
  above them is the volume of claims two years older than the payment year (the DRG payments alone run 7.6% above
  lines 1.01 and 1.02 at the median), which the old reading had partly offset. The ranges carry it; the estimates are
  not corrected for it. For the compared cut hospitals neither SCH nor MDH, the HAC error less the total payment's
  error is -0.0006 with line 29.01 and -0.0001 without, and less the DRG payments' error -0.0388 and -0.0038.
- Not changed: new-technology add-on payments, ESRD payments and credits for replaced devices stay unpriced (no file
  gives them by hospital). The federal DRG payment summed over the impact file's hospitals outside Maryland,
  $87.24 billion, is 6.1% above the "total operating Federal payments" in the rule's outlier simulation
  ($82,262,071,135, 90 FR 37227); FY2024's is 6.8% above (FY2024 rule, $79,484,223,474, 88 FR 59353). The cause is
  not established, so nothing is changed for it; the readmissions share and the value-based pool checks, which test
  the base's relative sizes, pass.
- Corrected: the v1 entry says comparing a sole community or Medicare-dependent hospital's rates on the year's totals
  "can only understate the difference". The FY2026 rule pays whichever rate yields "the greatest aggregate payment"
  (90 FR 37231; HACRP-92), and the cost report settles it on the period's totals, so the year's totals are the rule's
  own comparison, not an understatement. The code was already making that comparison; only the description changes.
