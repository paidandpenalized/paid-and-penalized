# HACRP claims register

Every sentence on the HACRP site that states a fact about CMS's program carries a claim id (`HACRP-NN`) in
`sites/hacrp/web/copy.js` or `sites/hacrp/web/constants.js`. Each id is a row here: the claim in this site's own
words, the primary source that supports it, a short quotation from that source, and the date it was last checked.
A claim marked `unverified` may not be used in copy.

| id | claim | primary source | quoted support | checked |
|---|---|---|---|---|
| HACRP-01 | A hospital in the program's highest-scoring quarter is paid 99% of its usual Medicare inpatient payment for each discharge in that fiscal year, a 1% cut; other hospitals get no cut from this program. | https://www.law.cornell.edu/uscode/text/42/1395ww | "for such discharges during the fiscal year shall be equal to 99 percent of the amount of payment that would otherwise apply to such discharges" | 2026-10-20 |
| HACRP-02 | CMS cuts payments to hospitals whose Total HAC Score is above the 75th percentile of all Total HAC Scores, so where the line falls depends on other hospitals' scores. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Hospitals with a Total HAC Score greater than the 75th percentile of all Total HAC Scores will receive a 1-percent payment reduction." | 2026-10-20 |
| HACRP-03 | Before scoring, CMS limits each measure's results to the range from the 5th to the 95th percentile, so every result past either bound scores the same as the bound. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-payment-reduction-methodology.pdf | "Limit the distribution of measure results at the 5th and 95th percentiles to reduce outliers." | 2026-10-20 |
| HACRP-04 | Each year CMS turns each measure result into a score relative to other hospitals and averages a hospital's measure scores with equal weights to get its Total HAC Score; higher means worse. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "CMS evaluates overall hospital performance by calculating Total HAC Scores as the equally weighted average of scores on measures included in the program." | 2026-10-20 |
| HACRP-05 | When a hospital's infection data are missing under the program's rules, CMS gives it the worst possible score on that measure instead of a measured result. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "Hospitals that do not submit data for an HAI measure will receive the maximum (worst) Winsorized z-score for the measure" | 2026-10-20 |
| HACRP-06 | The program's claims-based measure is CMS's patient safety and adverse events composite, PSI 90. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "CMS Patient Safety and Adverse Events Composite (CMS PSI 90)" | 2026-10-20 |
| HACRP-07 | One infection measure is central line–associated bloodstream infection (CLABSI). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Central Line-Associated Bloodstream Infection (CLABSI)" | 2026-10-20 |
| HACRP-08 | One infection measure is catheter-associated urinary tract infection (CAUTI). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Catheter-Associated Urinary Tract Infection (CAUTI)" | 2026-10-20 |
| HACRP-09 | One infection measure is surgical site infection after colon surgery or abdominal hysterectomy (SSI). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Colon and Abdominal Hysterectomy Surgical Site Infection (SSI)" | 2026-10-20 |
| HACRP-10 | One infection measure is Clostridioides difficile infection (CDI), the name used by CDC's NHSN, the measure's data source. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "Clostridioides difficile infections (CDI)" | 2026-10-20 |
| HACRP-11 | One infection measure is MRSA (methicillin-resistant Staphylococcus aureus) bloodstream infection, the name used by CDC's NHSN. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "methicillin-resistant Staphylococcus aureus bloodstream infections (MRSA)" | 2026-10-20 |
| HACRP-12 | CMS posts each year's hospital results on Data.cms.gov; it plans to post FY2027's in early 2027, so FY2026's are the newest public results until then. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | "CMS will post select information from the fiscal year 2027 HAC Reduction Program on the data catalog on Data.cms.gov in early 2027." | 2026-10-20 |
| HACRP-13 | Maryland's hospitals receive Total HAC Scores, but under Maryland's waiver the program's payment reduction does not apply to them. | https://data.cms.gov/provider-data/dataset/y9us-9xdf | "Maryland hospitals are waived from receiving payment adjustments under the Program." | 2026-10-20 |
| HACRP-14 | An infection measure's SIR compares a hospital's observed infections with the number NHSN's model predicted; an SIR of 1 means they are equal. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "If the SIR= 1.0, then the same number of HAIs were observed as predicted, based on the 2015 national aggregate data." | 2026-10-20 |
| HACRP-15 | CMS turns each limited measure result into a z-score: the result minus the mean across hospitals, divided by the standard deviation. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | "the difference between a hospital’s Winsorized measure result and the mean … divided by the standard deviation of Winsorized measure results" | 2026-10-20 |

## Notes on the sources

- **CMS file names.** CMS posts the HACRP methodology and fact-sheet PDFs (cited for HACRP-03, HACRP-12 and
  HACRP-15) from the HACRP program page under file names that begin `hospital-readmissions-reduction-program-`.
  The documents themselves are CMS's HAC Reduction Program documents; the file names are CMS's.
- **HACRP-05** cites CMS's FY2026 HACRP FAQ on QualityNet (question 33). QualityNet is a JavaScript application: an
  HTTP client without a browser receives the application shell for every address, so this source was read in a
  browser. CMS's FAQ also gives the validation case (question 32): hospitals that fail CMS's infection-data
  validation receive the maximum (worst) z-score for the validated measures.
- **HACRP-10 and HACRP-11** follow CDC's NHSN names. CMS's pages call these measures "Clostridium difficile
  Infection (CDI)" and "Methicillin-resistant Staphylococcus aureus (MRSA) bacteremia".
- **HACRP-12** is time-sensitive: re-check it when CMS posts the FY2027 results.
- **HACRP-13:** footnote `a` is quoted from the pinned copy of CMS's Footnote Crosswalk
  (`data/pinned/pdc-footnotes/Footnote_Crosswalk.csv`), whose SHA-256 matched the live file on 2026-10-20. That
  Maryland's hospitals are scored is CMS's own data: every Maryland row in the FY2026 file has a Total HAC Score.
- **HACRP-15** joins two parts of one sentence in CMS's FY2027 fact sheet; the ellipsis marks the omitted words
  ("of Winsorized measure results calculated across all subsection (d) hospitals,").
- **HACRP-01** cites the statute, 42 U.S.C. 1395ww(p)(1), at Cornell's Legal Information Institute. The CMS rule
  says the same at 42 CFR 412.172(b).

## Link check (2026-10-20)

Each URL the HACRP site links to (`sites/hacrp/web/links.js`), each dataset landing page in
`data/pinned/manifest.json` and each source above, fetched with redirects followed. No URL redirected and no archive
copy was needed.

| URL | status | via |
|---|---|---|
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | 200 | direct |
| https://www.medicare.gov/care-compare/ | 200 | direct |
| https://www.hospitalsafetygrade.org/ | 200 | direct |
| https://data.cms.gov/provider-data/dataset/yq43-i98g | 200 | direct |
| https://data.cms.gov/provider-data/dataset/y9us-9xdf | 200 | direct |
| https://www.law.cornell.edu/uscode/text/42/1395ww | 200 | direct |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-payment-reduction-methodology.pdf | 200 | direct |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | 200 | direct |
| https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | 200 (application shell without a browser); the PDF opened in a browser | browser |
| https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | 200 | direct |
