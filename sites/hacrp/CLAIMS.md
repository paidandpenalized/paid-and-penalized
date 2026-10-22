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
| HACRP-04 | CMS weighs equally every measure a hospital has a score for: the Total HAC Score is the average of those z-scores, so each adds its z-score divided by the number of measures scored, and one measure alone sets the score. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-payment-reduction-methodology.pdf | "The Equal Measure Weights approach applies an equal weight to each measure for which a hospital has a measure score." | 2026-10-20 |
| HACRP-05 | When a hospital's infection data are missing or, under the program's validation rules, not accepted, CMS gives it the worst possible score on that measure instead of a measured result. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "Hospitals that do not submit data for an HAI measure will receive the maximum (worst) Winsorized z-score for the measure" | 2026-10-20 |
| HACRP-06 | The program's claims-based measure is CMS's patient safety and adverse events composite, PSI 90. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "CMS Patient Safety and Adverse Events Composite (CMS PSI 90)" | 2026-10-20 |
| HACRP-07 | One infection measure is central line–associated bloodstream infection (CLABSI). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Central Line-Associated Bloodstream Infection (CLABSI)" | 2026-10-20 |
| HACRP-08 | One infection measure is catheter-associated urinary tract infection (CAUTI). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Catheter-Associated Urinary Tract Infection (CAUTI)" | 2026-10-20 |
| HACRP-09 | One infection measure is surgical site infection after colon surgery or abdominal hysterectomy (SSI). | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Colon and Abdominal Hysterectomy Surgical Site Infection (SSI)" | 2026-10-20 |
| HACRP-10 | One infection measure is Clostridioides difficile infection (CDI), the name used by CDC's NHSN, the measure's data source. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "Clostridioides difficile infections (CDI)" | 2026-10-20 |
| HACRP-11 | One infection measure is MRSA (methicillin-resistant Staphylococcus aureus) bloodstream infection, the name used by CDC's NHSN. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "methicillin-resistant Staphylococcus aureus bloodstream infections (MRSA)" | 2026-10-20 |
| HACRP-12 | CMS posts each year's hospital results on Data.cms.gov; it plans to post FY2027's in early 2027, so FY2026's are the newest public results until then. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | "CMS will post select information from the fiscal year 2027 HAC Reduction Program on the data catalog on Data.cms.gov in early 2027." | 2026-10-20 |
| HACRP-13 | Maryland's hospitals receive Total HAC Scores, but under Maryland's waiver the program's payment reduction does not apply to them. | https://data.cms.gov/provider-data/sites/default/files/resources/f29bb7c812e242f6edfef0a4b7d0eaca_1760630713/Footnote_Crosswalk.csv | "Maryland hospitals are waived from receiving payment adjustments under the Program." | 2026-10-20 |
| HACRP-14 | An infection measure's SIR compares a hospital's observed infections with the number NHSN's model predicted; an SIR of 1 means they are equal. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "If the SIR= 1.0, then the same number of HAIs were observed as predicted, based on the 2015 national aggregate data." | 2026-10-20 |
| HACRP-15 | CMS turns each limited measure result into a z-score: its difference from the mean across hospitals, divided by the standard deviation, so each measure compares a hospital with the other hospitals scored on it. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | "difference between a hospital’s Winsorized measure result and the mean of Winsorized measure results calculated across all subsection (d) hospitals, divided by the standard deviation" | 2026-10-20 |
| HACRP-16 | A z-score above zero means worse performance than the average and one below zero better, so a lower measure result is better. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | "Negative Winsorized z-scores indicate better performance. Positive Winsorized z-scores indicate worse performance." | 2026-10-20 |
| HACRP-17 | Every year CMS scores hospitals on measures of hospital-acquired conditions (infections and complications patients develop in the hospital) and combines them into a Total HAC Score. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "on measures of hospital-acquired conditions. On an annual basis, CMS evaluates overall hospital performance by calculating Total HAC Scores" | 2026-10-20 |
| HACRP-18 | The hospitals CMS scores are subsection (d) hospitals: general acute care hospitals paid under Medicare's inpatient prospective payment system, with Maryland's included. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-payment-reduction-methodology.pdf | "CMS includes all subsection (d) hospitals (that is, general acute care hospitals paid under the Inpatient Prospective Payment System), including Maryland hospitals" | 2026-10-20 |
| HACRP-19 | CMS calculates every hospital's Total HAC Score by one set of steps: measure results, winsorized z-scores, the equal-weight average, then the line. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CMS follows these steps to calculate Total HAC Scores and the worst-performing quartile" | 2026-10-20 |
| HACRP-20 | CDC predicts each hospital's infections from national data for a baseline year, 2015 for this year's SIRs, adjusted for factors that predict infections at that hospital. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "calculated based on the 2015 national HAI aggregate data and is adjusted for each facility using variables found to be significant predictors" | 2026-10-22 |
| HACRP-21 | CDC is moving the SIR baseline from 2015 to 2022 data, a change that first affects the HAC Reduction Program in fiscal year 2028. | https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-key-dates.pdf | "CDC is updating the baseline to CY 2022 data" … "which will affect the HAC Reduction Program beginning in FY 2028." | 2026-10-22 |
| HACRP-22 | Maryland has its own payment arrangement with Medicare: the state sets hospital prices for every payer, Medicare included, and is held to a limit on the growth of Medicare's total spending in the state. | https://www.cms.gov/priorities/innovation/innovation-models/md-tccm | "to establish pricing of medical services provided by hospitals, primary care doctors and specialists across all payers" | 2026-10-22 |

## Notes on the sources

- **CMS file names.** CMS posts the HACRP methodology and fact-sheet PDFs (cited for HACRP-03, HACRP-04, HACRP-12,
  HACRP-15, HACRP-16 and HACRP-18) from the HACRP program page under file names that begin `hospital-readmissions-reduction-program-`.
  The documents themselves are CMS's HAC Reduction Program documents; the file names are CMS's.
- **HACRP-05** cites CMS's FY2026 HACRP FAQ on QualityNet (question 33); so does HACRP-19. QualityNet is a JavaScript application: an
  HTTP client without a browser receives the application shell for every address, so this source was read in a
  browser. CMS's FAQ also gives the validation case (question 32): hospitals that "failed HAI validation for the
  measure" receive "the maximum (worst) Winsorized z-score for the set of HAI measures validated."
- **HACRP-10 and HACRP-11** follow CDC's NHSN names. CMS's pages call these measures "Clostridium difficile
  Infection (CDI)" and "Methicillin-resistant Staphylococcus aureus (MRSA) bacteremia".
- **HACRP-12** is time-sensitive: re-check it when CMS posts the FY2027 results.
- **HACRP-13** cites footnote `a` in CMS's Footnote Crosswalk file, the file CMS's dataset page
  (https://data.cms.gov/provider-data/dataset/y9us-9xdf) links to. This repo pins a copy
  (`data/pinned/pdc-footnotes/Footnote_Crosswalk.csv`) whose SHA-256 matched the live file on 2026-10-20. CMS's
  FY2027 fact sheet gives the "scored" half: "CMS includes Maryland hospitals in the measure results determination,
  measure score calculation, and Total HAC Score calculation (Steps 1-3)".
- **HACRP-03:** the methodology PDF's footnote gives both bounds: "Hospitals with a measure result between the
  minimum and the 5th percentile will receive the 5th percentile value for the measure." and "Hospitals with a
  measure result between the 95th percentile and the maximum will receive the 95th percentile value for the
  measure." CMS's FY2026 FAQ (question 30) describes the same step for FY2026.
- **Editions.** The methodology PDF cited is CMS's current edition, dated August 2026; it names no fiscal year. It
  says CMS "finalized the adoption of the Equal Measure Weights approach starting in fiscal year 2020" (HACRP-04).
- **HACRP-19** cites question 25 of CMS's FY2026 FAQ, which lists the steps (measure results, Winsorized z-scores,
  the Total HAC Score, the worst-performing quartile). Its step 2 calculates z-scores "for each hospital", and CMS's
  FY2027 fact sheet says of step 3: "For each hospital, calculate the Total HAC Score as the equally weighted average
  of the hospital’s measure scores."
- **HACRP-20** cites page 5 of CDC's SIR guide (June 2025 edition), which also gives the arithmetic: "The SIR is
  calculated by dividing the number of observed infections by the number of predicted infections." Its Table 1 (the
  SSI model for abdominal hysterectomy) lists the patient's age, diabetes, ASA score and BMI among the predictors; the
  device-associated models adjust by location type (the guide's example: "CLABSIs in a Medical ICU").
- **HACRP-21** cites footnote e of CMS's HAC Reduction Program FY2027 key dates (August 2026), which begins "Since
  2016, CDC has used CY 2015 data as the baseline to calculate the SIR for its HAI measures." and cites the FY 2026
  IPPS/LTCH PPS final rule, pages 36963–36965. The same table puts the FY2026 program's HAI period at 1/1/23 to
  12/31/24, inside the 2015-baseline years.
- **HACRP-22** cites CMS's Maryland Total Cost of Care Model page, which also says the model committed "the State to a
  sustainable growth rate in per capita total cost of care spending for Medicare beneficiaries". The page says that
  model ran from January 1, 2019, to December 31, 2025, and "transitioned to the AHEAD model and began its
  implementation period in January 2026"; the site's copy names no model, so it holds across the change. Re-check it
  at each fiscal year's release.
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
| https://data.cms.gov/provider-data/sites/default/files/resources/f29bb7c812e242f6edfef0a4b7d0eaca_1760630713/Footnote_Crosswalk.csv | 200 | direct |
| https://www.law.cornell.edu/uscode/text/42/1395ww | 200 | direct |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-payment-reduction-methodology.pdf | 200 | direct |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | 200 | direct |
| https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | 200 (application shell without a browser); the PDF opened in a browser | browser |
| https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | 200 | direct |
