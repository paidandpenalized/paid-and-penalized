# TEAM claims register

Every sentence on the TEAM site that states a fact about the model's rules carries a claim id (`TEAM-NN`), or a list of
them when it states more than one, in the site's copy files (so far `sites/team/web/lookup-copy.js`) or in
`sites/team/web/constants.js`. Each id is a row here: the claim in this site's own words, the primary source that supports
it, a short quotation from that source, and the date it was last checked. TEAM is a payment model, not a penalty program;
copy never calls it one. Sentences that describe only this site's own arithmetic or framing carry no id. The family's copy
gate (`pipeline/test/copy-gate.test.js`) reads this register once the site is registered; until then
`sites/team/test/lookup.test.js` holds the lookup's words to the same rules. A claim marked `unverified` may not be used
in copy.

| id | claim | primary source | quoted support | checked |
|---|---|---|---|---|
| TEAM-01 | A TEAM participant is an acute care hospital that is paid under both the inpatient (IPPS) and outpatient (OPPS) payment systems and has its address in one of the mandatory areas CMS selected, or one that made a voluntary election that CMS accepted. | https://www.ecfr.gov/current/title-42/part-512/section-512.505 | "is paid under the IPPS and OPPS with a CCN primary address located in one of the mandatory CBSAs" … "voluntary opt-in participation election" | 2026-11-19 |
| TEAM-02 | CMS picked the mandatory TEAM areas (core-based statistical areas) by random sampling, so a hospital in an area it did not pick is not required to take part. | https://www.ecfr.gov/current/title-42/part-512/section-512.515 | "CMS uses stratified random sampling to select the mandatory CBSAs included in TEAM." | 2026-11-19 |
| TEAM-03 | Maryland's hospitals are not paid under the inpatient prospective payment system, under the state's total cost of care model. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "Maryland hospitals are not paid under the IPPS" | 2026-11-19 |
| TEAM-04 | CMS left out of TEAM's selection any area lying entirely in Maryland. | https://www.ecfr.gov/current/title-42/part-512/section-512.515 | "Are located entirely in the State of Maryland." | 2026-11-19 |
| TEAM-06 | Voluntary participation was a one-time choice open to hospitals outside the mandatory areas that had stayed in the CJR model to its end or in BPCI Advanced to its end. | https://www.ecfr.gov/current/title-42/part-512/section-512.510 | "must not be located in a mandatory CBSA" … "Be a participant hospital in the CJR model" … "BPCI Advanced model" | 2026-11-19 |
| TEAM-07 | Each TEAM performance year is a calendar year and the model began on January 1, 2026, so the second performance year starts January 1, 2027. | https://www.ecfr.gov/current/title-42/part-512/section-512.505 | "Performance year means a 12-month period beginning on January 1" … "Model start date means January 1, 2026" | 2026-11-19 |
| TEAM-08 | A new hospital in a mandatory area, or one that newly meets the participant definition, must take part from the start of the performance year after one full performance year. | https://www.ecfr.gov/current/title-42/part-512/section-512.508 | "must participate in TEAM at the beginning of the performance year that follows one full performance year" | 2026-11-19 |
| TEAM-09 | CMS's TEAM participant list gives each hospital's participation start and end dates and is updated quarterly. | https://www.cms.gov/team-model-participant-list | "Participation Start Date" … "Participation End Date" … "CMS updates this list on a quarterly basis" | 2026-11-19 |
| TEAM-11 | An acute care hospital, the only kind TEAM covers, is one paid under the inpatient prospective payment system; other kinds of hospital are not TEAM participants. | https://www.ecfr.gov/current/title-42/part-512/section-512.505 | "Acute care hospital means a provider subject to the prospective payment system specified in § 412.1(a)(1)" | 2026-11-19 |
| TEAM-12 | CJR-X, the nationwide expansion of the joint-replacement model, was finalized in the fiscal year 2027 inpatient rule and begins on January 1, 2028. | https://www.cms.gov/priorities/innovation/innovation-models/cjr-x | "will be mandatory nationwide and begin on January 1, 2028" | 2026-11-19 |
| TEAM-13 | CJR-X exempts hospitals in TEAM, hospitals in Maryland, and hospitals not eligible to be paid under both the inpatient and outpatient systems; the rest of the hospitals paid under the inpatient system must take part. | https://www.cms.gov/priorities/innovation/innovation-models/cjr-x | "Certain hospitals will be exempt, including those participating in the Transforming Episode Accountability Model (TEAM), those located in Maryland" | 2026-11-19 |
| TEAM-14 | Each track caps what a participant can gain or repay in a performance year as a share of its aggregated reconciliation target price: Track 1 gains up to 10%; Track 2 5% either way in performance years 2 to 5; Track 3 20% either way. | https://www.ecfr.gov/current/title-42/part-512/section-512.550 | "cannot exceed 10 percent" … "cannot exceed 5 percent" … "cannot exceed 20 percent" … "must not exceed 5 percent" | 2026-11-19 |
| TEAM-15 | CMS adjusts a reconciliation amount for quality by a percentage that reaches at most 10% of a gain in every track, and at most 15% of a loss in Track 2 and 10% in Track 3; Track 1 has no loss to adjust. | https://www.ecfr.gov/current/title-42/part-512/section-512.550 | "up to 10 percent for positive reconciliation amounts and up to 15 percent for negative reconciliation amounts" | 2026-11-19 |
| TEAM-16 | For an episode category where the hospital had fewer than 31 episodes in the three baseline years, CMS caps performance-year spending at the target price, so the category cannot add to a repayment. | https://www.ecfr.gov/current/title-42/part-512/section-512.550 | "did not meet the low volume threshold of at least 31 episodes during the 3-year baseline period" | 2026-11-19 |
| TEAM-17 | A measure for which the hospital has no raw score, or an incomplete one, is given a scaled quality score of 50. | https://www.ecfr.gov/current/title-42/part-512/section-512.547 | "CMS assigns a scaled quality measure of 50 if the TEAM participant has no or an incomplete raw quality measure score" | 2026-11-19 |
| TEAM-18 | The performance year 2 quality score uses five measures: hybrid hospital-wide readmission, falls with injury, postoperative respiratory failure and surgical-patient death (failure-to-rescue), each for all episode categories, and the hip and knee replacement patient-reported outcome measure for joint-replacement episodes. | https://www.ecfr.gov/current/title-42/part-512/section-512.547 | "For all episode categories: Hybrid Hospital-Wide All-Cause Readmission Measure" … "For LEJR episodes: Hospital-Level Total Hip and/or Total Knee Arthroplasty" | 2026-11-19 |
| TEAM-19 | A TEAM episode ends on the 30th day after the anchor discharge (or anchor procedure), counting the discharge day as day 1. | https://www.ecfr.gov/current/title-42/part-512/section-512.537 | "An episode ends on the 30th day following the date of the anchor procedure or the date of discharge from the anchor hospitalization" | 2026-11-19 |

## Notes on the sources

- **Citation home.** TEAM's rules are 42 CFR 512 subpart E (sections 512.500 to 512.598). Rows cite the eCFR page for the
  section; each was read from the eCFR's text at its newest issue date (2026-11-17).
- **TEAM-01, TEAM-11.** Both quotes are from the definitions in section 512.505: "TEAM participant" and "Acute care
  hospital". The first quote joins paragraph (1) and paragraph (2) of the first definition.
- **TEAM-03.** The fiscal year 2026 inpatient final rule, FR Doc 2025-14681 (published August 4, 2025), in its
  discussion of the Maryland Total Cost of Care Model, which the rule says concludes on December 31, 2026.
- **TEAM-06.** Section 512.510(b): the CJR condition is that the hospital participated until the model's last day,
  December 31, 2024; the BPCI Advanced one, until December 31, 2025. Section 512.510(c): the election period ran January 1
  to January 31, 2025.
- **TEAM-09.** The quote is from the header and column names of CMS's participant list workbook (the manifest's
  `team-participants` entry is cut from it; the list is as of 2026-08-18, the file modified 2026-09-22). The page address
  serves the workbook itself.
- **TEAM-12, TEAM-13.** CMS's CJR-X model page. The start date moved from the proposal's October 1, 2027 to January 1,
  2028 in the final rule (FR Doc 2026-15833, 91 FR 49570).
- **TEAM-14 to TEAM-19.** Sections 512.550, 512.547 and 512.537 (TEAM-19, paragraph (a)(1)), read from the eCFR's text at its newest issue date (2026-11-17).
  TEAM-14 joins the gain limit of each track (paragraph (e)(2)(i) to (iii)), Track 3's loss limit ((e)(1)) and Track 2's
  loss limit ((e)(3)). TEAM-15 is paragraph (d)(1)(ii); Track 1's and Track 3's caps are in (d)(1)(i) and (iii). TEAM-16 is
  the low-volume paragraph of (c), cited elsewhere as (c)(9). TEAM-17 is (b)(1)(i)(D). TEAM-18 is paragraph (a)(2) (the cited baseline
  periods differ by measure and year; the register states only the measure set). The calculator's band width (a
  few percent either side of the estimate) is this site's own choice, not a rule, and has no row.

## Link check (2026-11-19)

Each source above, fetched with `curl -sL --compressed` (the eCFR's API gives 200 only with compression and at or before
its newest issue date, 2026-11-17).

| URL | status | via |
|---|---|---|
| https://www.ecfr.gov/current/title-42/part-512/section-512.505 | 200 (the section's full text through the eCFR versioner API at 2026-11-17; both definitions found) | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.537 | 200 (the section's full text through the API at 2026-11-17, after 503 retries; paragraph (a)(1) found) | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.547 | 200 (the section's full text through the API at 2026-11-17, after one 503 retry; paragraphs (a)(2) and (b)(1)(i)(D) found) | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.550 | 200 (the section's full text through the API at 2026-11-17, after one 503 retry; paragraphs (c)(9), (d)(1) and (e) found) | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.508 | 200 (full text through the API; paragraphs (b) and (c) read) | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.510 | 200 (full text through the API; paragraphs (b) and (c) read) | direct |
| https://www.ecfr.gov/current/title-42/part-512/section-512.515 | 200 (full text through the API; paragraphs (a) and (b)(1) read) | direct |
| https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | 200 (about 4.8 MB, the rule's text; both passages found) | direct |
| https://www.cms.gov/priorities/innovation/innovation-models/cjr-x | 200 (the model page; both sentences found) | direct |
| https://www.cms.gov/team-model-participant-list | 200 (the participant list workbook, 61,430 bytes, sha256 equal to the manifest's `team-participants` derivedFrom; header and column names found) | direct |
