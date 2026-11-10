# HRRP claims register

Every sentence on the Readmissions site that states a fact about CMS's program carries a claim id (`HRRP-NN`), or a list
of them when it states more than one, in the site's copy files (`sites/hrrp/web/copy.js` and the `copy.js` beside each
page's code) or in `sites/hrrp/web/constants.js`. Each id is a row here: the claim in this site's own words, the
primary source that supports it, a short quotation from that source, and the date it was last checked. Sentences that
describe only this site's own arithmetic or framing carry no id. The gate is `pipeline/test/copy-gate.test.js`: a row
no copy or constant uses fails it, so a row is added with the sentence that needs it.
A claim marked `unverified` may not be used in copy.

| id | claim | primary source | quoted support | checked |
|---|---|---|---|---|
| HRRP-01 | A hospital's condition counts toward the cut only if the hospital had at least 25 eligible discharges for it in the data period; a hospital with fewer on every condition cannot be cut. | https://www.federalregister.gov/documents/2026/08/04/2026-15833 | "non-Maryland subsection (d) hospitals with 25 or more eligible discharges for at least one measure during the applicable period" | 2026-11-04 |
| HRRP-02 | Four of the program's six conditions are medical: heart attack (acute myocardial infarction), COPD, heart failure and pneumonia. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | "Acute myocardial infarction (AMI)" … "Chronic obstructive pulmonary disease (COPD)" … "Heart failure (HF)" … "Pneumonia" | 2026-11-04 |
| HRRP-03 | The other two of the program's six conditions are procedures: coronary artery bypass graft (CABG) surgery, and elective primary hip or knee replacement (THA/TKA). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | "Coronary artery bypass graft (CABG) surgery" … "Elective primary total hip arthroplasty and/or total knee arthroplasty (THA/TKA)" | 2026-11-04 |
| HRRP-04 | For each condition, CMS subtracts the median excess readmission ratio of the hospital's peer group from the hospital's own ratio; only the part above that median adds to the cut. | https://www.law.cornell.edu/cfr/text/42/412.152 | "The excess readmission ratio for the hospital for the applicable period minus the peer-group median excess readmission ratio (ERR)" | 2026-11-04 |
| HRRP-05 | CMS sorts hospitals into five peer groups (quintiles) by the share of their patients who are dually eligible for Medicare and full Medicaid, and compares each hospital with the others in its group. | https://www.federalregister.gov/documents/2018/08/17/2018-16766 | "we finalized our policy to stratify hospitals into quintiles, or five peer groups, based on their proportion of dual-eligible patients" | 2026-11-04 |
| HRRP-06 | The cut applies to every traditional Medicare (fee-for-service) base operating DRG payment in the fiscal year, which runs from October 1 through September 30. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | "Payment reductions are applied to all Medicare fee-for-service base operating diagnosis-related group payments during the FY (October 1 to September 30)." | 2026-11-04 |
| HRRP-07 | CMS estimates that new-technology add-on payments will total about $1.74 billion in fiscal year 2027, paid on top of the DRG payment. | https://www.federalregister.gov/documents/2026/08/04/2026-15833 | "Aggregate Estimated Total FY 2027 Impact" … "$1,739,715,745.72" | 2026-11-04 |
| HRRP-08 | CMS extended the Pennsylvania Rural Health Model's termination date to December 31, 2026. | https://www.cms.gov/files/document/r12622demo.pdf | "extend the existing termination date of the Pennsylvania Rural Health Model to 12/31/2026" | 2026-11-04 |
| HRRP-09 | The payment reduction is capped at 3 percent, a payment adjustment factor of 0.97. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | "The payment reduction is capped at 3 percent (that is, a payment adjustment factor of 0.97)." | 2026-11-05 |
| HRRP-10 | A single neutrality modifier, the same for every hospital in a year, keeps total savings under the peer-group method equal to those under the earlier method with no peer groups. | https://www.law.cornell.edu/cfr/text/42/412.152 | "The neutrality modifier, a multiplicative factor that equates total Medicare savings under the current stratified methodology to the previous non-stratified methodology." | 2026-11-05 |
| HRRP-11 | The program reduces payments to subsection (d) hospitals, the hospitals Medicare pays under its inpatient prospective payment system; a hospital paid another way is not in it. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | "reduce payments to subsection (d) hospitals for excess readmissions beginning October 1, 2012 (that is, fiscal year [FY] 2013)" | 2026-11-05 |
| HRRP-12 | Medicare pays children's, cancer, psychiatric, rehabilitation and long-term care hospitals outside the inpatient prospective payment system, so they are not subsection (d) hospitals in this program. | https://www.law.cornell.edu/cfr/text/42/412.23 | "Psychiatric hospitals" … "Rehabilitation hospitals" … "Children's hospitals" … "Long-term care hospitals" … "Cancer hospitals" … "excluded from the prospective payment systems" | 2026-11-05 |
| HRRP-13 | Critical access hospitals are paid on their reasonable costs, not under the inpatient prospective payment system's DRG rates. | https://www.law.cornell.edu/cfr/text/42/413.70 | "payment for inpatient services of a CAH" … "reasonable costs of the CAH in providing CAH services to its inpatients" | 2026-11-05 |
| HRRP-14 | Beginning in fiscal year 2027, CMS works out the excess readmission ratios from Medicare Advantage stays as well as fee-for-service stays; the payment cut still applies only to fee-for-service payments (HRRP-06). | https://www.cms.gov/files/document/fy-2027-hrrp-infographic-pdf.pdf | "Beginning in fiscal year (FY) 2027, CMS is calculating excess readmission ratios (ERRs) using both Medicare Advantage (MA) and fee-for-service (FFS) data" | 2026-11-05 |
| HRRP-15 | A hospital's excess readmission ratio for a condition is its predicted 30-day readmission rate divided by the rate expected at an average hospital with a similar mix of patients; above 1.0 is more readmissions than expected. | https://www.cms.gov/files/document/fy-2027-hrrp-infographic-pdf.pdf | "predicted 30-day readmission rate for a hospital" … "readmission rates at an average hospital with a similar patient case mix" | 2026-11-05 |
| HRRP-16 | A subsection (d) hospital, the kind the program cuts (HRRP-11), is a hospital in one of the fifty states or the District of Columbia, so a hospital in Puerto Rico is not in the program. | https://www.law.cornell.edu/uscode/text/42/1395ww | "located in one of the fifty States or the District of Columbia" | 2026-11-05 |
| HRRP-17 | CMS suppressed the pneumonia readmission measure for the FY2023 program year, so no pneumonia ratio counted toward the FY2023 cuts. | https://www.federalregister.gov/documents/2021/08/13/2021-16519 | "to suppress the Hospital 30-Day, All-Cause, Risk- Standardized Readmission Rate (RSRR) following Pneumonia Hospitalization measure (NQF #0506) for the FY 2023 program year" | 2026-11-05 |
| HRRP-18 | CMS left claims for services from January 1 to June 30, 2020 out of the program's calculations because of the COVID-19 public health emergency. | https://www.federalregister.gov/documents/2020/09/18/2020-19637 | "no claims data reflecting services provided January 1, 2020-June 30, 2020 will be used in calculations for the Hospital Readmissions Reduction Program" | 2026-11-05 |
| HRRP-19 | Beginning with fiscal year 2027, CMS works out the readmission ratios from two years of data instead of three; the FY2027 period is July 1, 2023 through June 30, 2025. | https://www.cms.gov/files/document/fy-2027-hrrp-fact-sheet-pdf.pdf | "CMS is reducing the performance period from 3-years to 2-years." … "The FY 2027 performance period is July 1, 2023, to June 30, 2025." | 2026-11-05 |
| HRRP-20 | CMS gave notice in the FY2026 final rule that it would stop excluding patients with a COVID-19 diagnosis from the readmission measures beginning with the FY2027 program year. | https://www.federalregister.gov/documents/2025/08/04/2025-14681 | "we intend to remove the COVID-19 exclusion from the readmission measures beginning with the FY 2027 program year" | 2026-11-05 |
| HRRP-21 | The base operating DRG payment the cut applies to is the wage-adjusted DRG operating payment plus new-technology add-on payments. | https://www.law.cornell.edu/cfr/text/42/412.152 | "plus any applicable new technology add-on payments under subpart F of this part" | 2026-11-05 |
| HRRP-24 | The base operating DRG payment leaves out additional payments for indirect medical education, disproportionate share, outliers and low volume of discharges. | https://www.law.cornell.edu/cfr/text/42/412.152 | "does not include any additional payments for indirect medical education" … "disproportionate share" … "outliers" … "low volume of discharges" | 2026-11-05 |
| HRRP-25 | For a Medicare-dependent, small rural hospital, the base operating DRG payment amount includes the difference between its hospital-specific payment rate and the Federal payment rate. | https://www.law.cornell.edu/cfr/text/42/412.152 | "includes the difference between the hospital-specific payment rate and the Federal payment rate" | 2026-11-05 |
| HRRP-26 | The FY2018 cut was worked out from discharges of July 1, 2013 through June 30, 2016; the FY2018 file does not state this window. | https://www.federalregister.gov/documents/2017/08/14/2017-16434 | "we are finalizing as proposed, without modification, the applicable period of the 3-year time period of July 1, 2013 through June 30, 2016" | 2026-11-06 |
| HRRP-27 | The FY2024 file states its data window in two pieces, July 1 to December 1, 2019 and July 1, 2020 to June 30, 2022, leaving out the discharges between; the FY2023 file does the same for its window. | https://www.cms.gov/files/zip/fy24-ipps-fr-hospital-readmissions-reduction-program-supplemental-data-file.zip | "based on discharges between July 1, 2019 to December 1, 2019 and July 1, 2020 to June 30, 2022" | 2026-11-06 |
| HRRP-28 | CMS shortened the FY2022 data window to end December 1, 2019, so that it uses no data from the COVID-19 public health emergency, whose first-half 2020 claims it left out. | https://www.federalregister.gov/documents/2021/08/13/2021-16519 | "would only be affected by a shortened performance period (July 1, 2017 through December 1, 2019) that does not use data from the COVID-19 PHE" | 2026-11-06 |
| HRRP-22 | Congress extended the Medicare-dependent hospital program through December 31, 2026, which falls inside fiscal year 2027. | https://www.cms.gov/files/document/mm-14415-low-volume-hospital-payment-adjustment-medicare-dependent-hospital-program-fy-2026.pdf | "extends the MDH program through December 31, 2026" | 2026-11-05 |
| HRRP-23 | The readmission measures count unplanned readmissions within 30 days of discharge. | https://www.federalregister.gov/documents/2026/08/04/2026-15833 | "assesses unplanned readmissions occurring within 30 days of discharge" | 2026-11-05 |
| HRRP-29 | A Medicare-dependent hospital is paid the federal rate plus 75 percent of the amount by which its hospital-specific rate exceeds the federal rate, for discharges in cost-reporting periods beginning on or after October 1, 2006 and before January 1, 2027. | https://www.law.cornell.edu/cfr/text/42/412.108 | "75 percent of the amount that the Federal rate determined under paragraph (c)(1) of this section is exceeded by the highest of the following" | 2026-11-09 |
| HRRP-30 | The IPPS impact file gives each hospital two case-mix indexes: a transfer-adjusted one, and one it calls generally applicable for sole community and Medicare-dependent hospitals paid under their hospital-specific rate. | https://www.cms.gov/files/zip/fy2027-ipps-fr-impact-file.zip | "Case Mix Index under Grouper V44 (generally applicable for SCH and MDH providers paid under their Hospital Specific Payment rate)." | 2026-11-09 |


## Notes on the sources

- **HRRP-01** quotes the FY2027 IPPS/LTCH PPS final rule's impact analysis (91 FR 49570, Aug. 4, 2026; Table V.I.-06's
  text). CMS adopted the 25-case threshold in the FY2012 rule and kept it in FY2013: "We are maintaining the minimum
  25-case threshold that we adopted through rulemaking last year" (https://www.federalregister.gov/documents/2012/08/31/2012-19079).
  The statute leaves the minimum to the Secretary (42 U.S.C. 1395ww(q)(4)(C)(ii)).
- **HRRP-02 and HRRP-03** split CMS's list of the program's six measures (the program page's list, in order) so each quote
  stays within 25 words. A copy sentence that names the six conditions cites both.
- **HRRP-04** quotes the regulation's definition of "aggregate payments for excess readmissions" (42 CFR 412.152, item (3)),
  which multiplies the base DRG payment, the number of admissions and that difference. This site's `peerMedian` and
  `contrib` (engine/js/hrrp/formula.js) carry it out; the sentence on the page says only that the median is the line.
- **HRRP-05** quotes the FY2019 final rule's recap of the policy adopted in the FY2018 rule (82 FR 38229 through 38231).
  The statute directs groups by the full-benefit dual-eligible share (42 U.S.C. 1395ww(q)(3)(D)); the five-group choice is CMS's.
  The proportion counts Medicare fee-for-service and Medicare Advantage stays (42 CFR 412.152, "Proportion of
  dual-eligibles").
- **HRRP-07** is a table in the Federal Register; the HTML page shows it as an image, so the figure was read from the
  govinfo PDF of the same document (page 50423, "FY 2027 Estimates for New Technology Add-on Payments", rows for
  technologies continuing, alternative pathway and traditional pathway, $840,505,708.21 + $417,734,075.01 + $481,475,962.50).
  It is CMS's upper bound: each estimate assumes every qualifying claim gets the maximum add-on. The total is the
  only figure the row supports; a share of the modeled base is computed from the data where a page needs it.
- **HRRP-08** is Pub. 100-19, Transmittal 12622 (change request 13595, May 2, 2024); the same source as HACRP-93. The
  constant drops out of later editions after the date passes.
- **HRRP-09** is the CMS program page's own sentence; the regulation is 42 CFR 412.154(c)(2)(iii). The site's `CAP`
  (engine/js/hrrp/formula.js) carries it out.
- **HRRP-10** is the regulation's definition of the neutrality modifier (42 CFR 412.152, item (4) of "aggregate payments
  for excess readmissions"). "The same for every hospital in a year" is how the formula uses it: one multiplier in
  every hospital's sum.
- **HRRP-11** quotes the CMS program page's account of the statute. A "subsection (d) hospital" is a hospital paid under
  section 1886(d) of the Social Security Act, the inpatient prospective payment system; the Methods page's line on who is
  not in the program (`web/copy.js` notInHrrp) says that a hospital paid another way is not in it, and names the kinds in
  HRRP-12 and HRRP-13. The family's not-found page cites HRRP-12, HRRP-13 and HRRP-16 for the kinds with no page.
- **HRRP-12** is the list of hospital classifications in 42 CFR 412.23 (the regulation's headings, in order: psychiatric,
  rehabilitation, children's, long-term care, cancer); each is excluded from the inpatient prospective payment system and
  paid under another system (the psychiatric, rehabilitation and long-term care paragraphs name theirs). The last fragment
  ("excluded from the prospective payment systems") is the rehabilitation (b) and cancer (f) paragraphs' words, and
  paragraph (g) uses it for hospitals outside the fifty States; the psychiatric and long-term care paragraphs say "excluded
  from the prospective payment system" (singular) and the children's paragraph (d) has no such sentence, being covered by
  the section's opening text. Checked against the page 2026-11-05; the earlier note that the fragment was the cancer
  paragraph's alone was wrong. Thirty Day Readmissions' list is the same five.
- **HRRP-13** is 42 CFR 413.70(a)(1) (a plus-one-percent-of-reasonable-cost payment); the text has a double space after
  "the" in "the  reasonable costs", which the quote runs past by splitting at the phrase.

- **HRRP-14** is the first note of CMS's "Hospital Readmissions Reduction Program Payment Reduction Methodology" sheet for
  FY2027 (CMS's infographic; it cites the FY2026 IPPS/LTCH PPS final rule, pages 36923 through 36929). The same note
  says "The payment adjustment factor (PAF) will continue to only be applied to all Medicare FFS base operating diagnosis-related
  group (DRG) payments during the FY. The PAF is not applied to MA payments," which is the second sentence of the program page's
  note and what HRRP-06 already says. The quote is the first sentence only, to stay within 25 words. The source is a PDF; it
  was read from a copy downloaded outside the repo, not stored. The program page's other two "New for" notes now have rows
  (HRRP-19, HRRP-20); this sheet does not state them.
- **HRRP-15** is the same sheet's Step 1a: "ERR = predicted readmission rate / expected readmission rate", with the predicted
  and the expected rate defined as quoted (the two fragments are from the two definitions). The regulation's definition
  (42 CFR 412.152, "Excess readmissions ratio") says the same in other words: actual readmissions, risk-adjusted, to
  risk-adjusted expected readmissions.
- **HRRP-16** is 42 U.S.C. 1395ww(d)(1)(B), the definition of "subsection (d) hospital" ("located in one of the fifty States or the
  District of Columbia other than" the listed psychiatric, rehabilitation, long-term care, children's and cancer hospitals).
  Puerto Rico is neither, so with HRRP-11 (the program reduces payments to subsection (d) hospitals) its hospitals are out. The
  inference is this register's; no CMS page found says it in so many words.
- **Who is in the program** (the program page's callout) rests on HRRP-11 to HRRP-13 and HRRP-16, and on HRRP-01 for Maryland
  ("non-Maryland subsection (d) hospitals"). The Thirty Day Readmissions callout also said Maryland hospitals "run under their
  own payment model"; no primary source reached says why (the CMS program page, 42 CFR 412.150 and 412.152 are silent on
  Maryland, and the federalregister.gov rule text would not load), so the page names Maryland as out without a reason. The
  Maryland Health Services Cost Review Commission's pages call its own readmissions program a separate one with "an all-payer
  focus", but do not say that Maryland is exempt from the federal program in words found.

- **HRRP-17** is the FY2022 IPPS/LTCH PPS final rule's summary of its policies (item 2), and the rule's section "Suppression of
  the CMS 30-Day Pneumonia Readmission Measure (NQF #0506) for the FY 2023 Program Year". The quote keeps the text file's line break
  after "Risk-". Read from the Federal Register's text file.
- **HRRP-18** is footnote 434 of the FY2021 IPPS/LTCH PPS final rule (85 FR 54832), quoting the August 25th COVID-19 interim
  final rule. The history's shaded years (FY2022 to FY2024, constants.js COVID_FYS) are the years whose data windows are
  cut short or run across those months; web/ tests check the windows in the data file. Read from the Federal Register's text file.

- **HRRP-19** is CMS's FY2027 HRRP fact sheet (a PDF, read from a copy downloaded outside the repo, 2026-11-05). The
  regulation says the same (42 CFR 412.152, "applicable period": from FY2027 the two-year period advanced one year), and the
  FY2026 final rule (90 FR 36931 to 36932) finalized it with the example "claims/encounter data with admission dates beginning
  from July 1, 2023, through June 30, 2025".
- **HRRP-20** is the FY2026 IPPS/LTCH PPS final rule, 90 FR 36930, which says CMS "intend[s]" the removal and calls it a
  technical update; no later confirmation was found, so the register states what CMS gave notice of. The "New for" note
  keeps Thirty Day Readmissions' words (a test matches them to the pinned file).
- **HRRP-21** is the regulation's definition of "base operating DRG payment amount" (42 CFR 412.152): the wage-adjusted DRG
  operating payment plus new-technology add-ons, determined without regard to the value-based program's adjustments, and
  not including indirect medical education, disproportionate share, outlier or low-volume payments.
- **HRRP-22** is the same MLN Matters article as HACRP-88 (MM14415). That the hospital-specific rate counts in the
  base payment is HRRP-25, the regulation's own sentence (42 CFR 412.152, "Base operating DRG payment amount", for a
  Medicare-dependent, small rural hospital paid under 412.108(c); a sole community hospital's does not include it).
- **HRRP-24** is the same definition's closing sentence (indirect medical education under 412.105, disproportionate share
  under 412.106, outliers under subpart F, low volume under 412.101).
- **HRRP-26** is the FY2018 IPPS/LTCH PPS final rule's section on the applicable period for FY2018 (82 FR 38224), read
  from the Federal Register's XML text. The FY2018 supplemental file names only the "FY 18 applicable period"
  (constants.js RULE_WINDOWS).
- **HRRP-27** is the "Payment adjustment factor" entry of the FY2024 supplemental file's variable descriptions (the pinned
  `hrrp-supplemental-fy2024` zip). The FY2023 file's two pieces (July 1, 2018 to December 1, 2019 and July 1, 2020 to June
  30, 2021) are as the pinned history's provenance notes record them (`hrrp-history-provenance`). constants.js WINDOW_GAP
  holds the days between.
- **HRRP-28** is the FY2022 IPPS/LTCH PPS final rule (86 FR 45254), in its section on the condition-specific measures for
  FY2022, read from the Federal Register's XML text: with the September 2020 interim final rule's exception for first- and
  second-quarter 2020 claims, the FY2022 window "would only be affected by a shortened performance period". The FY2023 and
  FY2024 files' first pieces end the same day (HRRP-27).
- **HRRP-20, checked again 2026-11-05 for an FY2027 confirmation:** the FY2027 final rule text (2026-15833), CMS's FY2027
  HRRP fact sheet and methodology infographic, and the CMS program page do not mention the COVID-19 exclusion; secondary
  summaries repeat the FY2026 notice. So the register and the "New for" note say what CMS gave notice of.
- **HRRP-23** is FR 2026-15833, 91 FR 49900 (a paragraph about the sepsis measure that says it is "consistent with other
  Hospital Readmissions Reduction Program measures").
- **HRRP-29** is 42 CFR 412.108(c)(2)(iii), read from the page 2026-11-09: for those discharges a Medicare-dependent hospital is
  paid the Federal rate ((c)(1)) plus 75 percent of the amount by which the highest of its hospital-specific rates (412.73,
  412.75, 412.79) exceeds it. `constants.js` MDH_ADDON_SHARE carries the share, and the engine's `dollars.MDH_SHARE` is the same
  value. Methods' dollar formula prints it with HRRP-25, which puts the difference in the base the cut applies to. When the
  date in the quote's paragraph passes, the row is checked again (HRRP-22 is the program's current end date).
- **HRRP-30** is the FY2027 impact file's variable descriptions (the pinned `ipps-impact-fy2027` zip, member "FY 2027 IPPS FR & CN
  Impact File - Variable Descriptions.txt"): `CMIV44` is the quoted row and `TACMIV44` the "Transfer adjusted Case Mix Index under
  Grouper V44" row. Methods' sentence on a Medicare-dependent hospital's second line rests on it; `ipps.py` reads `CMIV44` as
  `cmi_hsp` (methods_version 2, `docs/METHODS-LOG.md`).
- **42 CFR 412.152, "not less than 1.0"** (checked 2026-11-05): the definition of "excess readmissions ratio" reads "the ratio
  (but not less than 1.0) of risk-adjusted readmissions...", while CMS's published ratios run below 1.0 and only the part above
  the peer median counts. Methods says only what HRRP-04 and HRRP-09 support: a condition at or below its median adds nothing,
  and the factor is one minus the summed contributions, held to the 3% cap. It does not say the ratio is floored.

## Link check (2026-11-04)

Each source above, fetched with redirects followed. The Federal Register addresses redirect once to the same
document's page; no source needed an archive copy.

| URL | status | via |
|---|---|---|
| https://www.federalregister.gov/documents/2026/08/04/2026-15833 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2018/08/17/2018-16766 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2012/08/31/2012-19079 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2017/08/14/2017-16434 | 200 (2026-11-06; the page refuses scripted fetches, so the rule was read from the Federal Register API's XML text of the same document) | api |
| https://www.cms.gov/files/zip/fy24-ipps-fr-hospital-readmissions-reduction-program-supplemental-data-file.zip | 200 (2026-11-06) | direct |
| https://www.govinfo.gov/content/pkg/FR-2026-08-04/pdf/2026-15833.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.152 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.23 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/413.70 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.108 | 200 (2026-11-09) | direct |
| https://www.cms.gov/files/zip/fy2027-ipps-fr-impact-file.zip | 200 (2026-11-09; the quote read from the pinned copy) | direct |
| https://www.law.cornell.edu/uscode/text/42/1395ww | 200 (about 590,000 characters; the definition is in the second 100,000, read 2026-11-05) | direct |
| https://www.cms.gov/files/document/r12622demo.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/files/document/fy-2027-hrrp-infographic-pdf.pdf | 200 (a PDF; read from a downloaded copy kept outside the repo; checked 2026-11-05) | direct |
| https://www.federalregister.gov/documents/2021/08/13/2021-16519 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2020/09/18/2020-19637 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2025/08/04/2025-14681 | 200 (text file read, 2026-11-05) | direct (one redirect) |
| https://www.cms.gov/files/document/mm-14415-low-volume-hospital-payment-adjustment-medicare-dependent-hospital-program-fy-2026.pdf | 200 (a PDF; read from a downloaded copy kept outside the repo; checked 2026-11-05) | direct |
| https://www.cms.gov/files/document/fy-2027-hrrp-fact-sheet-pdf.pdf | 200 (a PDF; read from a downloaded copy kept outside the repo; checked 2026-11-05) | direct |
