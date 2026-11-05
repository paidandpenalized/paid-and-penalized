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
  section 1886(d) of the Social Security Act, the inpatient prospective payment system; the site's 404 line says that a
  hospital paid another way is not in the program, and names the kinds in HRRP-12 and HRRP-13.
- **HRRP-12** is the list of hospital classifications in 42 CFR 412.23 (the regulation's headings, in order: psychiatric,
  rehabilitation, children's, long-term care, cancer); each is excluded from the inpatient prospective payment system and
  paid under another system (the psychiatric, rehabilitation and long-term care paragraphs name theirs). The last fragment
  is the cancer paragraph's own words; the others say the same of their kind. Thirty Day Readmissions' list is the same five.
- **HRRP-13** is 42 CFR 413.70(a)(1) (a plus-one-percent-of-reasonable-cost payment); the text has a double space after
  "the" in "the  reasonable costs", which the quote runs past by splitting at the phrase.

- **HRRP-14** is the first note of CMS's "Hospital Readmissions Reduction Program Payment Reduction Methodology" sheet for
  FY2027 (CMS's infographic; it cites the FY2026 IPPS/LTCH PPS final rule, pages 36923 through 36929). The same note
  says "The payment adjustment factor (PAF) will continue to only be applied to all Medicare FFS base operating diagnosis-related
  group (DRG) payments during the FY. The PAF is not applied to MA payments," which is the second sentence of the program page's
  note and what HRRP-06 already says. The quote is the first sentence only, to stay within 25 words. The source is a PDF; it
  was read from a copy downloaded outside the repo, not stored. The program page's other two "New for" notes (two years of data
  instead of three; the pandemic-era exclusion ended) come from Thirty Day Readmissions' content file and have no row here yet:
  this sheet does not state them.
- **HRRP-15** is the same sheet's Step 1a: "ERR = predicted readmission rate / expected readmission rate", with the predicted
  and the expected rate defined as quoted (the two fragments are from the two definitions). The regulation's definition
  (42 CFR 412.152, "Excess readmissions ratio") says the same in other words: actual readmissions, risk-adjusted, to
  risk-adjusted expected readmissions.
- **Who is in the program** (the program page's callout) rests on HRRP-11 to HRRP-13, and on HRRP-01 for Maryland ("non-Maryland
  subsection (d) hospitals"). The Thirty Day Readmissions callout also said Maryland hospitals "run under their own payment model"
  and "Puerto Rico hospitals are not subject to the cut"; no source in this register or reached while building the page says
  either, so the page says neither.

## Link check (2026-11-04)

Each source above, fetched with redirects followed. The Federal Register addresses redirect once to the same
document's page; no source needed an archive copy.

| URL | status | via |
|---|---|---|
| https://www.federalregister.gov/documents/2026/08/04/2026-15833 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2018/08/17/2018-16766 | 200 | direct (one redirect) |
| https://www.federalregister.gov/documents/2012/08/31/2012-19079 | 200 | direct (one redirect) |
| https://www.govinfo.gov/content/pkg/FR-2026-08-04/pdf/2026-15833.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.152 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.23 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/413.70 | 200 | direct |
| https://www.cms.gov/files/document/r12622demo.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/files/document/fy-2027-hrrp-infographic-pdf.pdf | 200 (a PDF; read from a downloaded copy kept outside the repo; checked 2026-11-05) | direct |
