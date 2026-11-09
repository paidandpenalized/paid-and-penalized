# Hub claims register

Every sentence on the hub's pages (the front page, the hospital pages across the programs, Methods, the policy pages, the
placeholder pages and the not-found page) and in what every page shares (the shell and footer, the program deks and the
rule constants they print, the registry's program names) that states a fact about CMS's programs, the law or Medicare's
payment system carries a claim id (`HUB-NN`), or a list of them when it states more than one, in its copy file
(`hub/copy.js`, `hub/home/copy.js`, `hub/hospital/copy.js`, `hub/client/story/copy.js`, `web/copy.js`) or, for a rule
constant (`web/programs.js`) or a program's name (`web/site.js` `long`), in the hub's claims map (`hub/claims.js`). The
copy gate (`pipeline/test/copy-gate.test.js`) holds this register to the same rules as the program sites'. Each id is a row here:
the claim in this site's own words, the primary source that supports it, a short quotation from that source, and the
date it was last checked. Shared copy also cites the program sites' rows (`HACRP-NN`, `HRRP-NN`) where one already
supports the sentence; those are listed under "Program rows the hub cites", not repeated here. Sentences that describe
only this site's own arithmetic or framing carry no id. Statements about the site itself (privacy, accessibility,
testing, licensing, the feedback form) are checked against the code and config, in the last section.
A claim marked `unverified` may not be used in copy.

| id | claim | primary source | quoted support | checked |
|---|---|---|---|---|
| HUB-01 | The value-based purchasing program reduces each hospital's base operating DRG payment for every discharge by a set percent, 2 percent since fiscal year 2017. | https://www.law.cornell.edu/uscode/text/42/1395ww | "reduce the base operating DRG payment amount" … "with respect to fiscal year 2017 and succeeding fiscal years, 2 percent" | 2026-11-08 |
| HUB-02 | Value-based purchasing is budget-neutral by design: the money available for its incentive payments equals the total of its reductions, as CMS estimates them. | https://www.law.cornell.edu/uscode/text/42/1395ww | "total amount available for value-based incentive payments" … "shall be equal to the total amount of reduced payments for all hospitals" | 2026-11-08 |
| HUB-03 | CMS pays the money it holds back out again as incentive payments based on each hospital's performance in the program. | https://www.cms.gov/medicare/quality/value-based-programs/hospital-purchasing | "Uses the estimated total amount of those reductions to fund value-based incentive payments to hospitals based on their performance in the program." | 2026-11-08 |
| HUB-04 | Medicare pays Maryland's hospitals under an all-payer model (a CMS Innovation Center model under section 1115A of the Social Security Act), not under the inpatient prospective payment system's rates. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "exclude hospitals in Maryland (because these hospitals are paid under an all payer model under section 1115A of the Act)" | 2026-11-08 |
| HUB-05 | Maryland's hospitals do not take part in the value-based purchasing program: CMS waived the program's provisions for the state's model. | https://www.govinfo.gov/content/pkg/FR-2014-08-22/html/2014-18545.htm | "Maryland hospitals will not be participating in the Hospital VBP Program because section 1886(o) of the Act and its implementing regulations have been waived" | 2026-11-08 |
| HUB-06 | A hospital that does not submit the quality data CMS requires has the market-basket increase in its yearly update cut by one-fourth. | https://www.law.cornell.edu/cfr/text/42/412.64 | "that does not submit quality data on a quarterly basis to CMS" … "the percentage increase in the market basket index" … "by one-fourth" | 2026-11-08 |
| HUB-07 | A hospital that is not a meaningful electronic health record user loses three-fourths of the market-basket increase in its yearly update (all of that three-fourths since fiscal year 2017). | https://www.law.cornell.edu/cfr/text/42/412.64 | "that is not a meaningful electronic health record (EHR) user" … "three-fourths of the percentage increase in the market basket index" … "by 100 percent" | 2026-11-08 |
| HUB-08 | The wage index adjusts the labor-related part of each payment rate (the share of hospitals' costs that goes to wages) for differences in local wage levels. | https://www.law.cornell.edu/uscode/text/42/1395ww | "adjust the proportion" … "of hospitals’ costs which are attributable to wages and wage-related costs" … "for area differences in hospital wage levels" | 2026-11-08 |
| HUB-09 | Medicare makes an additional payment to a hospital that serves a significantly disproportionate number of low-income patients (the disproportionate share hospital payment). | https://www.law.cornell.edu/uscode/text/42/1395ww | "an additional payment amount for each subsection (d) hospital which—" … "serves a significantly disproportionate number of low-income patients" | 2026-11-08 |
| HUB-10 | Medicare makes an additional payment for each discharge to a hospital with residents in an approved graduate medical education program. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/indirect-medical-education-ime | "prospective payment hospitals that have residents in an approved graduate medical education (GME) program receive an additional payment for a Medicare discharge" | 2026-11-08 |
| HUB-11 | In the Transforming Episode Accountability Model, hospitals in selected areas (core-based statistical areas) are accountable for the episodes around five surgical procedures. | https://www.cms.gov/priorities/innovation/innovation-models/team-model | "undergoing one of five surgical procedures" … "in selected Core-Based Statistical Areas nationwide" | 2026-11-08 |
| HUB-12 | A TEAM hospital may earn a payment from CMS when an episode's Medicare spending comes in below its target price, or owe CMS a repayment when it comes in above. | https://www.cms.gov/priorities/innovation/innovation-models/team-model | "may earn a payment from CMS" … "may owe CMS a repayment amount" … "above the target price" | 2026-11-08 |
| HUB-13 | Before CMS publishes a hospital's results in the readmissions, hospital-acquired conditions and value-based purchasing programs, the hospital can review them and submit corrections. | https://www.law.cornell.edu/uscode/text/42/1395ww | "has the opportunity to review, and submit corrections for, the information to be made public" … "prior to such information being made public" | 2026-11-08 |
| HUB-14 | CMS proposes its inpatient payment rules each year and takes public comments before it makes them final. | https://www.govinfo.gov/content/pkg/FR-2026-08-04/html/2026-15833.htm | "We received approximately 979 timely pieces of correspondence containing multiple comments on the proposed rule that appeared in the April 14, 2026 Federal Register" | 2026-11-08 |
| HUB-15 | Works of the U.S. government have no copyright protection under U.S. copyright law. | https://www.law.cornell.edu/uscode/text/17/105 | "Copyright protection under this title is not available for any work of the United States Government" | 2026-11-08 |
| HUB-16 | A hospital's CCN (CMS Certification Number) is the number once called its Medicare provider number. | https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/som107c02.pdf | "Effective in 2007, the CCN replaced the term Medicare Provider Number, Medicare Identification Number or OSCAR Number." | 2026-11-08 |
| HUB-17 | CMS's name for the readmissions program is the Hospital Readmissions Reduction Program. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | "Hospital Readmissions Reduction Program (HRRP)" | 2026-11-08 |
| HUB-18 | CMS's name for the hospital-acquired conditions program is the Hospital-Acquired Condition Reduction Program. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Hospital-Acquired Condition Reduction Program (HACRP)" | 2026-11-08 |
| HUB-19 | CMS's name for the value-based purchasing program is the Hospital Value-Based Purchasing Program. | https://www.cms.gov/medicare/quality/value-based-programs/hospital-purchasing | "The Hospital Value-Based Purchasing (VBP) Program" | 2026-11-08 |
| HUB-20 | CMS's inpatient payment rule calls the local-wage adjustment the hospital wage index. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "Changes to the Hospital Wage Index for Acute Care Hospitals" | 2026-11-08 |
| HUB-21 | CMS's inpatient payment rule names the low-income-patient payments the Medicare disproportionate share hospital (DSH) payment adjustment and uncompensated care payments. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "Payment Adjustment for Medicare Disproportionate Share Hospitals (DSHs) for FY 2026" … "Uncompensated Care Payments" | 2026-11-08 |
| HUB-22 | CMS calls the teaching payment the indirect medical education (IME) adjustment. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/indirect-medical-education-ime | "known as the indirect medical education (IME) adjustment" | 2026-11-08 |
| HUB-23 | CMS's name for the quality reporting program is the Hospital Inpatient Quality Reporting Program. | https://www.cms.gov/medicare/quality/initiatives/hospital-quality-initiative/inpatient-reporting-program | "The Hospital Inpatient Quality Reporting Program" | 2026-11-08 |
| HUB-24 | CMS's name for the electronic health records program is the Medicare Promoting Interoperability Program. | https://www.cms.gov/medicare/regulations-guidance/promoting-interoperability-programs | "The Medicare Promoting Interoperability Program" | 2026-11-08 |
| HUB-25 | CMS's name for the surgical episodes model is the Transforming Episode Accountability Model (TEAM). | https://www.cms.gov/priorities/innovation/innovation-models/team-model | "TEAM (Transforming Episode Accountability Model)" | 2026-11-08 |

## Program rows the hub cites

Shared copy (`web/`, `hub/`) may cite either program site's rows (`pipeline/test/copy-gate.test.js` `citeError`). These
already support hub sentences, so the hub cites them instead of repeating them:

- Readmissions: HRRP-04 (only the part above the peer-group median counts), HRRP-06 (the cut applies to base operating
  DRG payments), HRRP-09 (the 3 percent cap), HRRP-11, HRRP-12, HRRP-13, HRRP-16 (who is in the program, Puerto Rico's
  hospitals not; `notInHrrp`), HRRP-15 (the excess readmission ratio, a risk-adjusted one), HRRP-21 (the base operating
  DRG payment), HRRP-23 (unplanned readmissions within 30 days).
- Hospital-acquired conditions: HACRP-01 (paid 99 percent: the 1 percent cut), HACRP-02 (above the 75th percentile:
  the top quarter), HACRP-18 (the hospitals CMS scores, Maryland's included: the not-found line), HACRP-12 (FY2027 results not posted until early 2027), HACRP-13 (Maryland's hospitals are scored but
  not cut), HACRP-17 (the program scores hospital-acquired conditions), HACRP-26 (CMS exempts Maryland's hospitals from
  the cut), HACRP-68 (CCN stands for CMS Certification Number), HACRP-72 and HACRP-73 (the readmissions and value-based
  factors apply to the base operating DRG payment), HACRP-74 and HACRP-75 (the HAC cut is 1 percent of the whole payment
  after both), HACRP-83 (the uncompensated care payment is a share of a national amount), HACRP-86 and HACRP-87 (each
  factor multiplies the base; above 1 a bonus, below 1 a cut), HACRP-91 (Maryland's hospitals are not eligible for a
  readmissions penalty).

## Notes on the sources

- **HUB-01 and HUB-02** are 42 U.S.C. 1395ww(o)(7)(B)(i) and (o)(7)(C)(v), and (o)(7)(A); (o)(6)(C)(ii)(II) adds that the
  incentive payments must total the amount available "as estimated by the Secretary". 42 CFR 412.160 ("For FY 2017 and
  subsequent fiscal years, 2.0 percent") and 412.162(b)(1) say the same. The percent is of the **base operating DRG
  payment amount** (412.160: "the wage-adjusted DRG operating payment plus any applicable new technology add-on
  payments"), not of the whole inpatient payment. CMS's own program page simplifies the same way the deks do ("Withholds
  participating hospitals’ Medicare payments by a percentage specified by law (2%)") and then says the net is applied
  "to the base operating Medicare severity diagnosis-related group (MS-DRG) payment amount". Budget neutrality is CMS's
  estimate, not an identity: this site's own FY2026 estimate nets to about −$3.1M over the program's hospitals.
- **HUB-03** is CMS's program page (last modified 09/10/2024 per the page). That the result is a bonus or a net cut is
  HACRP-87's arithmetic.
- **HUB-04** is the FY2026 IPPS/LTCH PPS final rule's standardized-amount steps (90 FR 37214), the rule for the year the
  hub's dollars are. The same rule's impact section says "hospitals in Maryland are paid in accordance with the Maryland
  Total Cost of Care Model" (90 FR 37253), and the FY2027 rule says Maryland's hospitals "participate in the Maryland
  Total Cost of Care Model and are not paid under the IPPS" (91 FR 49818). CMS's Total Cost of Care page
  (https://www.cms.gov/priorities/innovation/innovation-models/md-tccm, checked 2026-11-08) says CMS ended that model
  "as of December 31, 2025" and that Maryland moved to the AHEAD model in January 2026, so FY2026 spans two CMS models;
  the copy names neither ("the state's own all-payer model"), which both rules' words support.
- **HUB-05** is the FY2015 IPPS/LTCH PPS final rule (79 FR 50086 to 50087; the same document as HACRP-60). From January 1,
  2014 Maryland's hospitals are no longer paid under section 1814(b)(3), so the statute's exemption for such hospitals
  (1886(o)(1)(C)(iv)) no longer applies; they stay out because 1886(o) is waived for the state's model. No later rule
  was found restating it (the FY2025, FY2026 and FY2027 final rules' text searched for Maryland with value-based
  purchasing, 2026-11-08); the pinned FY2026 Table 16B lists no Maryland hospital (state code 21), which is this site's
  own check, as HACRP-91's note already says. For the other two programs: HACRP-26 (the HAC cut: exempt; still scored,
  HACRP-13) and HACRP-91 (readmissions: not eligible for a penalty; their data still enter the calculations).
- **HUB-06 and HUB-07** are 42 CFR 412.64(d)(2)(i)(C) and (d)(3)(i)(C) (Cornell's copy matches the eCFR's, read
  2026-11-08). The statute is 42 U.S.C. 1395ww(b)(3)(B)(viii) ("by one-quarter of such applicable percentage increase
  (determined without regard to clause (ix), (xi), or (xii))") and (ix)(I). The reduction is a share of the market-basket
  increase **before** the productivity adjustment, not of the yearly update a hospital receives. FY2026 (90 FR 37251):
  the update is 2.6 percent ("a 3.3 percent market basket percentage increase with a reduction of 0.7 percentage point
  for the productivity adjustment"); a hospital that failed quality reporting got 1.775 percent, one that was not a
  meaningful EHR user 0.125 percent, and one that failed both −0.70 percent. CMS's IQR page words it "by one-quarter of
  such applicable annual payment rate update".
- **HUB-08** is 42 U.S.C. 1395ww(d)(3)(E)(i), which CMS's Wage Index page quotes. The FY2026 labor-related share is 66.0
  percent (90 FR 37251).
- **HUB-09** is 1395ww(d)(5)(F)(i). Since FY2014 a hospital gets 25 percent of the formula amount (1395ww(r)(1); CMS's
  DSH page: "hospitals will receive 25 percent of the amount they previously would have received"), and the rest funds
  the uncompensated care payments (HACRP-83; 1395ww(r)(2), "an additional amount equal to the product of the following
  factors"), paid to the hospitals that qualify for DSH.
- **HUB-10** is CMS's IME page; the statute is 1395ww(d)(5)(B) ("an additional payment amount for subsection (d) hospitals
  with indirect costs of medical education") and the regulation 42 CFR 412.105.
- **HUB-11 and HUB-12** are CMS's TEAM page (checked 2026-11-08). The regulation is 42 CFR part 512, subpart E
  (https://www.ecfr.gov/current/title-42/part-512/section-512.505, read through the eCFR's API): "Episode category means one
  of the five episodes tested in TEAM"; a TEAM participant is a hospital "paid under the IPPS and OPPS with a CCN primary
  address located in one of the mandatory CBSAs"; "Reconciliation payment amount means the amount that CMS may owe to a
  TEAM participant after reconciliation"; "Repayment amount means the amount that the TEAM participant may owe to
  Medicare after reconciliation". The model runs from January 1, 2026 to December 31, 2030. Track 1 carries no downside
  risk in the first year (up to three for safety-net hospitals), so "earn or owe" holds for the model, not every year
  for every hospital.
- **HUB-13** is 1395ww(p)(6)(B) (hospital-acquired conditions); (q)(6)(B) (readmissions) and (o)(10)(A)(ii) (value-based
  purchasing) say the same in the same words.
- **HUB-14** is the FY2027 IPPS/LTCH PPS final rule (91 FR 49578). The requirement is 42 U.S.C. 1395hh(b)(1): "a period of
  not less than 60 days for public comment thereon" (https://www.law.cornell.edu/uscode/text/42/1395hh).
- **HUB-15** is 17 U.S.C. 105. The copy's sentence ("CMS's data are works of the U.S. government") also rests on CMS being
  the author: some files CMS publishes, and this site pins, carry others' work (the HCRIS cost reports are hospitals'
  own filings; the infection ratios are CDC's, also a U.S. government agency). Facts in a filing carry no copyright of
  their own, so no finding was raised; if the sentence should be exact: "CMS's own data are works of the U.S.
  government."
- **HUB-16** is the State Operations Manual, chapter 2, section 2779A (Rev. 152), the document the FY2026 rule cites for
  CCN numbering (90 FR 37214). HACRP-68 gives "CMS certification number (CCN)".
- **HUB-17 to HUB-25** are the programs' names as `web/site.js` `long` gives them (the abbreviation's title on the front
  page's directory and the placeholder pages' Program field). Where CMS's own page is titled with a shorter name (its
  wage index page "Wage Index", its DSH page "Disproportionate Share Hospital (DSH)", its IME page "Indirect Medical
  Education (IME)"), the row quotes the IPPS rule's heading or the page's own sentence. "Medicare Disproportionate Share
  Hospital and Uncompensated Care Payments" joins two of the rule's headings; it is not one name CMS uses.
- **Fiscal years.** The hub's dollars, the front page and the hospital pages are FY2026 (`data/emitted/dollars/fy2026`);
  HUB-04 and the HUB-06/07 figures cite the FY2026 rule. The Readmissions site's pages are FY2027 (HRRP-14, HRRP-19); the
  deks name no year and the rules they state (the 3 percent cap, 30 days, 2 percent, a quarter and three-quarters, the
  top quarter) are the same in both years.
- **Federal Register addresses.** The rows cite govinfo's copy of each rule (the same text the Federal Register's
  full-text file serves, byte for byte: 4,810,703 and 5,900,182 bytes). federalregister.gov and ecfr.gov answered a
  plain `curl` with their bot check (a redirect to unblock.federalregister.gov), so their documents were read through
  their APIs.

## Link check (2026-11-08)

Each source above, fetched with `curl -sIL` (at most two requests a second per host); requests ran 2026-11-09 01:49 to
02:03 UTC. "direct": the address answered itself.

| URL | status | via |
|---|---|---|
| https://www.law.cornell.edu/uscode/text/42/1395ww | 200 (about 2.8 MB; read whole) | direct |
| https://www.law.cornell.edu/cfr/text/42/412.64 | 200 | direct |
| https://www.law.cornell.edu/uscode/text/17/105 | 200 | direct |
| https://www.law.cornell.edu/uscode/text/42/1395hh | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.160 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.162 | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2026-08-04/html/2026-15833.htm | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2014-08-22/html/2014-18545.htm | 200 | direct |
| https://www.cms.gov/medicare/quality/value-based-programs/hospital-purchasing | 200 | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/indirect-medical-education-ime | 200 | direct |
| https://www.cms.gov/priorities/innovation/innovation-models/team-model | 200 | direct |
| https://www.cms.gov/medicare/quality/initiatives/hospital-quality-initiative/inpatient-reporting-program | 200 | direct |
| https://www.cms.gov/medicare/regulations-guidance/promoting-interoperability-programs | 200 | direct |
| https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/som107c02.pdf | 200 (a PDF; read from the downloaded file with pdftotext) | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp | 200 | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | 200 | direct |
| https://www.cms.gov/priorities/innovation/innovation-models/md-tccm | 200 | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/wage-index | 200 | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/disproportionate-share-hospital-dsh | 200 | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.505 | 200 to a browser-like client (redirects to the section's full path); a plain `curl` gets the bot check | api (the eCFR renderer API, 200) |
| https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform | 200 (the form's public page, read only; nothing submitted) | direct |


## Where each claim is used

The copy entries and constants that carry ids, by file and key; `pipeline/test/copy-gate.test.js` checks that each id
resolves to a row and that every row here is used. Keys not listed carry no id (the site's own arithmetic, framing,
labels, or a statement about the site: the next section).

| file | key | ids |
|---|---|---|
| `web/copy.js` | dekHrrp | HRRP-06, HRRP-09, HRRP-15, HRRP-23, HRRP-04 |
| `web/copy.js` | dekHacrp | HACRP-01, HACRP-02, HACRP-17 |
| `web/copy.js` | dekHvbp | HUB-01, HUB-02, HUB-03, HACRP-87 |
| `web/copy.js` | dekWageIndex | HUB-08 |
| `web/copy.js` | dekDsh | HUB-09, HACRP-83 |
| `web/copy.js` | dekIme | HUB-10 |
| `web/copy.js` | dekIqr | HUB-06 |
| `web/copy.js` | dekPi | HUB-07 |
| `web/copy.js` | dekTeam | HUB-11, HUB-12 |
| `web/copy.js` | yearSplitHrrp, yearSplitCard | HACRP-12 |
| `web/copy.js` | notInHrrp | HRRP-11, HRRP-12, HRRP-13, HRRP-16 |
| `hub/claims.js` | HRRP_CAP_PCT, HAC_CUT_PCT, VBP_WITHHOLD_PCT, HRRP_WINDOW_DAYS, HAC_TOP_SHARE, IQR_REDUCTION_SHARE, PI_REDUCTION_SHARE, TEAM_SURGERIES (`web/programs.js`) | HRRP-09, HACRP-01, HUB-01, HRRP-23, HACRP-02, HUB-06, HUB-07, HUB-11 |
| `hub/claims.js` | the programs' names, `web/site.js` programs[].long: hrrp, hacrp, hvbp, wage-index, dsh, ime, iqr, pi, team | HUB-17, HUB-18, HUB-19, HUB-20, HUB-21, HUB-22, HUB-23, HUB-24, HUB-25 |
| `hub/home/copy.js` | hrrpText | HRRP-06, HRRP-09, HRRP-04 |
| `hub/home/copy.js` | hacHead | HACRP-01, HACRP-02 |
| `hub/home/copy.js` | hacText | HACRP-17, HACRP-02, HACRP-01, HACRP-75 |
| `hub/home/copy.js` | vbpText | HUB-01, HUB-02, HUB-03 |
| `hub/home/copy.js` | statesText, stateMaryland | HUB-04, HUB-05, HACRP-26, HACRP-91 |
| `hub/home/copy.js` | keyMaryland | HUB-05, HACRP-26, HACRP-91 |
| `hub/home/copy.js` | takeHac | HACRP-01, HACRP-02 |
| `hub/home/copy.js` | takeVbp | HUB-02 |
| `hub/home/copy.js` | estStepAdd | HACRP-72, HACRP-73, HACRP-74 |
| `hub/home/copy.js` | wsBase | HACRP-72, HACRP-73 |
| `hub/home/copy.js` | wsBaseNote | HRRP-21 |
| `hub/home/copy.js` | wsFactor | HACRP-86, HACRP-87 |
| `hub/home/copy.js` | wsCut | HACRP-74, HACRP-75 |
| `hub/client/story/copy.js` | ruleHrrp, ruleHrrpShort | HRRP-09, HRRP-06 |
| `hub/client/story/copy.js` | ruleHac | HACRP-01, HACRP-02 |
| `hub/client/story/copy.js` | ruleHacShort, hacOnly | HACRP-01 |
| `hub/client/story/copy.js` | ruleVbp | HUB-02, HACRP-87 |
| `hub/client/story/copy.js` | ruleVbpShort | HACRP-87 |
| `hub/copy.js` | countsEstimated | HUB-04 |
| `hub/copy.js` | ccnText | HACRP-68, HUB-16 |
| `hub/copy.js` | termsReuse | HUB-15 |
| `hub/copy.js` | correctionsCounts | HUB-14 |
| `hub/copy.js` | correctionsHospital | HUB-13 |
| `hub/copy.js` | notFoundHospitals | HACRP-18, HRRP-12, HRRP-13, HRRP-16 |
| `hub/hospital/copy.js` | descriptionMaryland | HUB-04, HUB-05, HACRP-26, HACRP-91 |
| `hub/hospital/copy.js` | statusMaryland | HUB-05, HACRP-26, HACRP-91 |
| `hub/hospital/copy.js` | statusMarylandText | HUB-04, HUB-05, HACRP-26, HACRP-91, HACRP-13 |
| `hub/hospital/copy.js` | fyNote, whyHrrpYear, whyHrrpYearOut | HACRP-12 |
| `hub/hospital/copy.js` | whyHacCut, statusHacCut, partHacCut, partUnscoredCut, wiIfHacOn | HACRP-01 |
| `hub/hospital/copy.js` | whatifStanding | HRRP-04, HACRP-02, HUB-02 |

## Statements about this site

Statements the hub's pages make about the site itself, checked against the code and config at the date above (no
primary source applies). "True" means the code does what the sentence says.

| statement | copy key | code evidence | verdict |
|---|---|---|---|
| No cookies, no accounts, no ads. | `hub/copy.js` privacyBrief1, privacyReading | No `document.cookie` or `Set-Cookie` in `web/`, `hub/`, `sites/`, `pipeline/site/`; `web/client/theme-store.js` is the only code that reaches storage | True of the site's code |
| The light/dark choice is remembered for the visit and not shared. | `hub/copy.js` privacyReading | `web/client/theme-store.js` (sessionStorage, the tab's own) | True |
| Visits are counted by Cloudflare Web Analytics, without cookies. | `hub/copy.js` privacyBrief3, privacyCounting | `pipeline/site/headers.js` (the beacon Cloudflare adds on the live domain; it reports to the site's own `/cdn-cgi/rum`, so `connect-src 'self'` holds) | True as configured; cookie-free rests on Cloudflare's documentation |
| The search downloads a list and searches in the browser; what you type isn't sent. | `hub/copy.js` privacyBrief4, privacySearch | `web/client/hub-asset.js` (the only fetch: the hashed list); `hub/client/search.js` (the index is built in memory) | True |
| A shared what-if is stored after the # sign. | `hub/copy.js` privacySearch | `hub/client/hospital/whatif.js` (history.replaceState with a fragment); `sites/hacrp/client/table.js` | True |
| The feedback form doesn't collect email addresses and doesn't require a sign-in. | `hub/copy.js` privacyFeedback | The form's public page: no email question, no sign-in redirect (Google offers an optional sign-in to save progress) | True |
| Site and page prefilled; an optional contact question; a role question; answers to a private spreadsheet. | `hub/copy.js` privacyFeedback2 | `web/site.js` feedback (the two prefilled entries); the form's optional "how can I reach you?" and "Which best describes you?" questions; the form says answers go to a private sheet | True (the sheet's sharing can't be checked from outside) |
| Choose "Something looks wrong." on the form. | `hub/copy.js` correctionsReport | The form's "What kind of message is this?" offers "Something looks wrong" | True |
| Text, charts and derived data CC BY 4.0; code MIT; typefaces OFL. | `hub/copy.js` termsReuse, `web/copy.js` licenseLead | `LICENSE`, `LICENSE-CONTENT`, `web/fonts/OFL-*.txt`, `web/site.js` license | True |
| CMS's published values are shown as CMS published them. | `hub/copy.js` estimateNot, termsNumbers, termsBrief3 | Factors print to as many places as CMS gives them (`web/render/format.js` factorText; hub hospital pages, the home worksheet) | True |
| Every build holds its national sums to ranges from CMS's figures and stops if one falls outside. | `hub/home/copy.js` estText | `engine/py/pp_engine/ipps.py` (CheckTargets), `engine/py/pp_engine/dollars.py` `checks`; the emitter writes nothing on a failed check | True of the family estimate |
| The back-test of the HAC cut against cost reports (count, year, middle miss, direction). | `hub/home/copy.js` estText | `hub/home/below.js` reads the dollar file's `bands.measures.hac.overall` | True |
| Aims for WCAG 2.2 AA. | `hub/copy.js` a11yBrief1, a11yTarget | `hub/constants.js` WCAG_VERSION | True (an aim) |
| axe on every kind of page, light and dark, desktop and phone, each time the site changes; keyboard paths in Chrome; Firefox and Safari's engine before each launch. | `hub/copy.js` a11yBrief4, a11yTested | `tools/e2e/lib.js` (light and dark), `tools/e2e/axe.js` (1280, 390, 320), `tools/e2e/site.js` sample pages, `.github/workflows/ci.yml` (push and pull request, Chromium); `npm run e2e:launch` runs all three engines by hand | True as built |
| Follows dark mode, reduced motion and Windows high contrast. | `hub/copy.js` a11yBrief3, a11yBuilt | `prefers-color-scheme`, `prefers-reduced-motion`, `forced-colors` rules in `web/styles/*.css`, `hub/styles.css` | Present |
| Uses public CMS data and shows no patient information. | `web/copy.js` affiliation | Inputs are `data/pinned/` public files (`manifest.json`) | True |
| Built from public data, CMS's above all; deterministic, published code. | `hub/copy.js` aboutBrief3, aboutAi | `data/pinned/manifest.json`; the repository is public | True |
| The formula has not been told which hospitals employ the author. | `hub/copy.js` aboutCoi | No CCN-specific branch in `engine/`; the one fixed CCN, `hub/model.js` EXAMPLE_CCN, is picked by a stated rule (`exampleRule`) | True of the code |
| These hospitals have no page here. | `web/copy.js` notInHrrp (the Readmissions Methods page); `hub/copy.js` notFoundHospitals (the not-found page) | `hospital/`, `hacrp/hospital/`, `hrrp/hospital/` in the build hold no critical access, IPPS-excluded or Puerto Rico CCN; Maryland's hospitals, in CMS's files, have hub and HACRP pages, and the not-found line names no rule that would exclude them | True |
| Each program's pages name the CMS file they use and when CMS released it. | `hub/copy.js` termsAsOf, correctionsCms | The HACRP pages and the Readmissions program, hospital and place pages each carry a source line with the file and its posting date; the data dictionaries point to Methods, which lists every file read | True |
| The site says how close an estimate is: for a value CMS publishes, the largest difference from it; for dollars, how the estimates compare with hospitals' cost reports. | `hub/copy.js` estimateHow | The recompute pages give the largest difference; the hub and HACRP dollar pages give the back-test's likely range (`hub/model.js` netRange, `engine/js/dollars/ranges.js`); the Readmissions Methods page gives its estimate's share within 15% of cost reports (`sites/hrrp/web/view.js` accuracy) | True |
| Each fix is logged with its date; numbers are not changed quietly. | `hub/copy.js` correctionsBrief1, correctionsProcess | `hub/corrections.js` reads `corrections/`; its first entry logs the whole-site review's corrections and the 2026-11-02 rewording | True |
