# HACRP claims register

Every sentence on the HACRP site that states a fact about CMS's program carries a claim id (`HACRP-NN`), or a list of
them when it states more than one, in the site's copy files (`sites/hacrp/web/copy.js` and the `copy.js` beside each
page's code) or in `sites/hacrp/web/constants.js`. Each id is a row here: the claim in this site's own words, the
primary source that supports it, a short quotation from that source, and the date it was last checked. Sentences that
describe only this site's own arithmetic or framing carry no id.
A claim marked `unverified` may not be used in copy.

| id | claim | primary source | quoted support | checked |
|---|---|---|---|---|
| HACRP-01 | A hospital in the program's highest-scoring quarter is paid 99% of its usual Medicare inpatient payment for each discharge in that fiscal year, a 1% cut; other hospitals get no cut from this program. | https://www.law.cornell.edu/uscode/text/42/1395ww | "for such discharges during the fiscal year shall be equal to 99 percent of the amount of payment that would otherwise apply to such discharges" | 2026-10-20 |
| HACRP-02 | CMS cuts payments to hospitals whose Total HAC Score is above the 75th percentile of Total HAC Scores, so where the line falls depends on other hospitals' scores. | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | "Hospitals with a Total HAC Score greater than the 75th percentile of all Total HAC Scores will receive a 1-percent payment reduction." | 2026-10-20 |
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
| HACRP-22 | Maryland sets what its hospitals are paid, by Medicare as well as other payers; its authority over Medicare's hospital rates runs until January 1, 2028. | https://www.cms.gov/priorities/innovation/files/ahead-fin-specs-ffs-hgb-md-add-v3-2.pdf | "Because of MD’s existing global budget policies and Medicare rate-setting authority (until January 1, 2028)" | 2026-10-22 |
| HACRP-23 | CMS cuts the hospitals above the 75th percentile of the Total HAC Scores of hospitals outside Maryland: Maryland's scores are left out of the distribution that sets the line. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CMS calculates the 75th percentile across all non-Maryland subsection (d) hospitals (that is, general acute care hospitals paid under IPPS) with Total HAC Scores." | 2026-10-22 |
| HACRP-24 | The cut applies to every traditional Medicare (fee-for-service) inpatient discharge in the fiscal year, which runs from October 1 of the year before through September 30. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "applies to all Medicare FFS Part A discharges in the corresponding FY (October 1 of the prior year through September 30 of the program year)" | 2026-10-22 |
| HACRP-26 | CMS exempts Maryland's hospitals from the cut under an agreement between CMS and the state. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "According to an agreement between CMS and Maryland, CMS exempts Maryland hospitals from payment reductions under the HAC Reduction Program." | 2026-10-22 |
| HACRP-27 | Each state in CMS's AHEAD model, Maryland among them, is held to a target for the growth of traditional Medicare (fee-for-service) spending in the state. | https://www.cms.gov/priorities/innovation/ahead/faqs | "Each participating state will be assessed and held accountable for state-specific Medicare FFS and all-payer cost growth and primary care investment targets." | 2026-10-22 |
| HACRP-28 | PSI 90 is one number built from a set of patient-safety measures (ten components) found in hospitals' claims. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "The CMS PSI 90 measure is a claims-based composite measure of a hospital’s performance that is based on 10 component measures of patient safety." | 2026-10-22 |
| HACRP-29 | PSI 90 counts traditional Medicare (fee-for-service) patients only. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "The CMS PSI 90 software includes only data from the Medicare FFS population." | 2026-10-22 |
| HACRP-30 | PSI 90's components include serious pressure ulcers (bedsores), falls in the hospital that break a bone, and blood clots after surgery. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "PSI 03—Pressure Ulcer Rate” … “PSI 08—In-Hospital Fall-Associated Fracture Rate” … “PSI 12—Perioperative Pulmonary Embolism or Deep Vein Thrombosis Rate" | 2026-10-22 |
| HACRP-31 | A PSI 90 value of one equals the national composite value; higher is worse. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "A CMS PSI 90 composite value of 1 indicates performance that is equal to the national composite value." | 2026-10-22 |
| HACRP-32 | The program uses CMS's version of PSI 90, which shares its component definitions with AHRQ's version. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "Although the CMS PSI 90 and AHRQ PSI 90 measures share the same component PSI definitions" | 2026-10-22 |
| HACRP-33 | The infection measures are data hospitals report to CDC's National Healthcare Safety Network (NHSN). | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "Five chart-abstracted or laboratory-identified HAI measures submitted to the Centers for Disease Control and Prevention’s (CDC’s) National Healthcare Safety Network (NHSN)" | 2026-10-22 |
| HACRP-34 | The infection measures count patients of every insurer, not only Medicare's. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "The HAI measures are calculated using data from an all-payer patient population, which is not limited to Medicare FFS patients." | 2026-10-22 |
| HACRP-35 | When fewer than one infection is predicted, CDC calculates no SIR, so the hospital gets no result on that measure. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CDC does not calculate an SIR for a hospital on a given measure if the hospital’s predicted number of HAIs is less than one." | 2026-10-22 |
| HACRP-36 | An SIR above one means more infections than predicted (worse); below one, fewer (better). | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "An SIR greater than 1.0 indicates that more HAIs were observed than predicted (worse performance)" | 2026-10-22 |
| HACRP-37 | A central line is a tube placed in a large vein in the neck, chest or groin. | https://www.cdc.gov/clabsi/about/index.html | "a catheter (tube) that healthcare providers often place in a large vein in the neck, chest or groin" | 2026-10-22 |
| HACRP-38 | An indwelling urinary catheter is a tube left in the bladder to drain urine; a CAUTI starts when germs enter through a urinary catheter. | https://www.cdc.gov/uti/about/cauti-basics.html | "A drainage tube is inserted into the bladder through the urethra, left in place and connected to a closed collection system." | 2026-10-22 |
| HACRP-39 | A surgical site infection is an infection where surgery was done. | https://www.cdc.gov/surgical-site-infections/about/index.html | "A surgical site infection (SSI) is an infection in the part of the body where a surgery took place." | 2026-10-22 |
| HACRP-40 | The program's SSI measure pools infections after colon surgery and after abdominal hysterectomy. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "The SSI measure is a pooled measure based on the number of SSIs following abdominal hysterectomy and colon procedures." | 2026-10-22 |
| HACRP-41 | C. diff is a germ that causes diarrhea and inflammation of the colon. | https://www.cdc.gov/c-diff/about/index.html | "C. diff is a bacterium (germ) that causes diarrhea and inflammation of the colon." | 2026-10-22 |
| HACRP-42 | The C. diff measure counts infections found by a lab test that began in the hospital. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "The FacWideIN SIRs for CDI include only incident, healthcare facility-onset (HO), non-duplicate C. difficile LabID events in the numerator." | 2026-10-22 |
| HACRP-43 | MRSA is a germ that resists several antibiotics. | https://www.cdc.gov/mrsa/about/index.html | "MRSA is a type of bacteria that is resistant to several antibiotics." | 2026-10-22 |
| HACRP-44 | The MRSA measure counts bloodstream infections found by a lab test that began in the hospital. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "The SIRs for MRSA bacteremia include only healthcare facility-onset (HO), non-duplicate MRSA blood LabID events in the numerator." | 2026-10-22 |
| HACRP-45 | CDC adjusts the central line and catheter infection predictions for the kind of unit a patient is in. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CLABSI and CAUTI are risk adjusted at the hospital and the patient-care-unit levels." | 2026-10-22 |
| HACRP-46 | Care Compare shows one year of infection results, where this program uses two, and lists hospitals outside the program, such as critical access hospitals, so their numbers can differ. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "may differ slightly from the results reported in the HAC Reduction Program dataset reported on the data catalog on Data.cms.gov" | 2026-10-22 |
| HACRP-47 | CDC has calculated SIRs against its 2015 baseline since 2016, so the Care Compare results this site draws for calendar years 2017 to 2024 share one baseline. | https://qualitynet.cms.gov/inpatient/measures/hai | "Since 2016, CDC has been using data collected in calendar year (CY) 2015 to determine the standard population." | 2026-10-22 |
| HACRP-48 | Care Compare is moving its infection results to SIRs on the 2022 baseline. | https://mp.qualityreportingcenter.com/globalassets/listserves/2026/iqr/2026-74-ip.pdf | "standardized infection ratios calculated using the 2022 baseline for healthcare-associated infection (HAI) measures that will publicly appear on the Compare tool on Medicare.gov" | 2026-10-22 |
| HACRP-49 | Each measure normally covers two years of care, and the window moves forward a year each program year. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "uses a standard two-year performance period for the CMS PSI 90 and CDC’s NHSN HAI measures, advanced by one year every subsequent program year" | 2026-10-22 |
| HACRP-50 | Early in the COVID-19 pandemic, CMS excused hospitals from reporting their infection data for the first half of 2020. | https://www.federalregister.gov/documents/2020/09/02/2020-19150/medicare-and-medicaid-programs-clinical-laboratory-improvement-amendments-clia-and-patient | "we excepted hospitals from the requirement to report first and second quarter of CY 2020 HAC Reduction Program chart-abstracted measures" | 2026-10-22 |
| HACRP-51 | CMS did not publish hospitals' infection data from the first half of 2020. | https://www.qualityreportingcenter.com/globalassets/2020/12/pch/hospital-compare_care-compare-refresh-and-overall-hospital-quality-star-rating-2021-updates.pdf | "CMS will not publicly report data collected during 1st and 2nd quarter 2020." | 2026-10-22 |
| HACRP-52 | For fiscal year 2023, CMS gave no hospital a Total HAC Score and cut no hospital's payments. | https://www.federalregister.gov/documents/2022/08/10/2022-16472/medicare-program-hospital-inpatient-prospective-payment-systems-for-acute-care-hospitals-and-the | "hospitals participating in the HAC Reduction Program will not be given a Total HAC score, nor will hospitals receive a payment penalty" | 2026-10-22 |
| HACRP-53 | The program's SSI measure counts only deep infections (at the incision's deeper layers or in the organ or space operated on) within 30 days of surgery. | https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | "Includes only Deep Incisional Primary SSIs and Organ/Space SSIs with an event date within 30 days of the procedure" | 2026-10-22 |
| HACRP-54 | For fiscal year 2015, CMS weighted Domain 1 (PSI 90) at 35 percent and Domain 2 (infections) at 65 percent. | https://www.govinfo.gov/content/pkg/FR-2013-08-19/html/2013-18956.htm | "we will calculate the Total HAC score by weighing Domain 1 at 35 percent plus Domain 2 at 65 percent" | 2026-10-22 |
| HACRP-55 | For fiscal year 2016, CMS weighted Domain 1 at 25 percent and Domain 2 at 75 percent. | https://www.cms.gov/newsroom/fact-sheets/fiscal-year-fy-2016-results-cms-hospital-acquired-conditions-hac-reduction-program | "Domain 1 is weighted at 25 percent, and Domain 2 is weighted at 75 percent" | 2026-10-22 |
| HACRP-56 | From fiscal year 2017 until the equal-weight method, CMS weighted Domain 1 at 15 percent and Domain 2 at 85 percent. | https://www.govinfo.gov/content/pkg/FR-2018-08-17/html/2018-16766.htm | "hospitals' Total HAC Scores are calculated as a weighted average of Domain 1 (15 percent) and Domain 2 (85 percent)" | 2026-10-22 |
| HACRP-57 | Before fiscal year 2018, CMS gave each measure 1 to 10 points by decile: the best tenth of hospitals 1 point, the worst tenth 10. | https://www.govinfo.gov/content/pkg/FR-2013-08-19/html/2013-18956.htm | "For each SIR, we will assign 1 to 10 points to the hospital for each measure" | 2026-10-22 |
| HACRP-58 | From fiscal year 2018, CMS scored each measure as a winsorized z-score instead of by decile. | https://www.govinfo.gov/content/pkg/FR-2017-08-14/html/2017-16434.htm | "calculated using the Winsorized z-score methodology finalized in the FY 2017 IPPS/LTCH PPS final rule" | 2026-10-22 |
| HACRP-59 | CMS dropped the two domains and weighted every measure equally starting in fiscal year 2020. | https://www.govinfo.gov/content/pkg/FR-2018-08-17/html/2018-16766.htm | "we are finalizing our policy to adopt an Equal Measure Weights scoring methodology beginning in FY 2020" | 2026-10-22 |
| HACRP-60 | Since fiscal year 2015, CMS has left Maryland's Total HAC Scores out when finding the top quartile. | https://www.govinfo.gov/content/pkg/FR-2014-08-22/html/2014-18545.htm | "we are finalizing our proposal to exclude the Total HAC Scores for Maryland hospitals when identifying the top quartile of all hospitals" | 2026-10-22 |
| HACRP-61 | Each measure's floor and cap, mean and standard deviation come from every scored hospital's results, Maryland's included. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CMS includes all subsection (d) hospitals (… as well as Maryland hospitals) that have measure results in calculations of measure means and standard deviations" | 2026-10-22 |
| HACRP-62 | Critical access, children's, psychiatric, rehabilitation and long-term care hospitals, PPS-exempt cancer hospitals, VA hospitals and hospitals in U.S. territories are not in the program. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CMS does not include the following non-subsection (d) hospitals and units in the HAC Reduction Program:" | 2026-10-22 |
| HACRP-63 | CMS calculates no PSI 90 result for a hospital with too few eligible discharges on its components. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "CMS will not calculate a CMS PSI 90 measure result for a hospital if it does not meet both of the following criteria:" | 2026-10-22 |
| HACRP-64 | The floor and cap keep a few extreme results from moving the mean. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "The goal is to reduce the impact of outlier measure results on mean performance and preserve hospitals’ relative results." | 2026-10-22 |
| HACRP-65 | A standard deviation measures how spread out results are. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "A standard deviation is a statistic that measures the degree of variation in a distribution of results, or how spread out the numbers are." | 2026-10-22 |
| HACRP-66 | A hospital-acquired condition is one a patient develops in the hospital while being treated for something else. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "A condition that a patient develops while in the hospital being treated for a different condition." | 2026-10-22 |
| HACRP-67 | A healthcare-associated infection is one a patient develops as a result of medical care. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "An infection that a patient develops as a result of medical care." | 2026-10-22 |
| HACRP-68 | CCN stands for CMS Certification Number. | https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | "Each IPPS Measure Exception is awarded at the CMS certification number (CCN) level" | 2026-10-22 |
| HACRP-70 | PSI 90's pressure-ulcer component counts only serious bedsores: stage 3 or 4, or unstageable, and not present when the patient arrived. | https://qualityindicators.ahrq.gov/Downloads/Modules/PSI/V2024/TechSpecs/PSI_03_Pressure_Ulcer_Rate.pdf | "Stage 3 or 4 (or unstageable) pressure ulcers (secondary diagnosis not present on admission)" | 2026-10-22 |
| HACRP-71 | CMS's results fact sheet for fiscal year 2016 put 758 hospitals in the worst-performing quartile. | https://www.cms.gov/newsroom/fact-sheets/fiscal-year-fy-2016-results-cms-hospital-acquired-conditions-hac-reduction-program | "In FY 2016, 758 out of 3,308 hospitals subject to the HAC Reduction Program are in the worst performing quartile" | 2026-10-22 |

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
- **HACRP-01** cites the statute, 42 U.S.C. 1395ww(p)(1), at Cornell's Legal Information Institute. The CMS rule
  says the same at 42 CFR 412.172(b).

- **HACRP-22 and HACRP-27** describe Maryland under CMS's AHEAD model, which replaced the Maryland Total Cost of Care
  Model in January 2026 (CMS's page for that model: https://www.cms.gov/priorities/innovation/innovation-models/md-tccm).
  HACRP-22 cites CMS's Maryland addendum to the AHEAD hospital global budget method (version 3.2, September 2026):
  the state keeps Medicare rate-setting authority "until January 1, 2028", after which Medicare's Maryland hospital
  budgets follow CMS's own method. **Re-check HACRP-22 before the FY2028 pages** (FY2028 runs from October 2027). The
  same addendum says the state must pay at least 85 percent of in-state all-payer hospital revenue through its global
  budgets, so the copy says "what its hospitals are paid", not "every payer". HACRP-27 cites CMS's AHEAD FAQ, which
  speaks of each participating state; CMS's AHEAD page lists Maryland as the model's first state ("Cohort 1:
  Maryland"). AHEAD's Medicare commitment is a growth target for Medicare fee-for-service (Parts A and B) spending;
  "limit" was the ended model's word.
- **HACRP-23 and HACRP-60** are CMS's rule for the line's population. The FY2026 FAQ (question 36, footnote 10) adds:
  "Total HAC Scores for Maryland hospitals are not included in the distribution of Total HAC Scores that CMS uses to
  determine the worst-performing quartile." HACRP-60 is the FY2015 final rule (79 FR 50089) that set it; the FY2016
  final rule (80 FR 49826) and the FY2018 final rule (82 FR 38568) say the same. Recomputed from the public files, the
  rule reproduces CMS's cut exactly in FY2015 and FY2016; in later years CMS's line sits a few hospitals above the
  percentile (32 to 44 hospitals in FY2017 and FY2018). The Methods page reports this and says the public files can't
  explain it. The regulation, 42 CFR 412.172(e), says "the 25 percent of hospitals with the highest total scores" and
  doesn't mention Maryland: the exclusion is CMS policy.
- **HACRP-24:** the FAQ's question 37 also gives the example: "for the FY 2026 program year, the payment reduction
  applies to all Medicare FFS discharges from October 1, 2025, to September 30, 2026." CMS writes "Medicare FFS"; the
  site writes "traditional Medicare". HACRP-26 is FAQ question 5. **HACRP-25 was withdrawn on 2026-10-22:** it said
  Medicare pays Maryland's hospitals under the section 1814(b)(3) waiver, which 42 CFR 412.170 still names, but the
  FY2015 final rule says that "effective January 1, 2014, Maryland elected to no longer have Medicare reimburse Maryland
  hospitals in accordance with section 1814(b)(3)". The copy now rests on CMS's agreement with Maryland (HACRP-26) and
  the state's arrangement (HACRP-22).
- **HACRP-28 to HACRP-32** cite FAQ questions 8 to 10. PSI 03 counts only stage 3 or 4 (or unstageable) pressure ulcers
  not present on admission, so the copy says "serious bedsores". The FAQ also says the program "includes the CMS PSI 90
  measure, not the Agency for Healthcare Research and Quality (AHRQ) version of PSI 90" (question 10).
- **HACRP-33 to HACRP-36** cite FAQ questions 6, 15 and 14. **HACRP-35:** the test is over the two-year performance
  period (questions 28 and 35, footnote f).
- **HACRP-37 to HACRP-44** cite CDC's topic pages (checked 2026-10-22) and CDC's SIR guide (pages 37 and 39). CDC's
  terms are "healthcare facility-onset" and "LabID"; the copy says "found by a lab test" and "starting in the hospital".
  **HACRP-53** cites page 33 of the SIR guide ("Complex 30-Day SSI model (used for CMS IPPS)"): adults only, deep
  incisional and organ/space infections.
- **HACRP-45:** FAQ question 14 also says "SSI is risk adjusted at the procedure level" and "MRSA bacteremia and CDI are
  risk adjusted at the hospital level." HACRP-20's notes give the SSI model's patient factors.
- **HACRP-46** cites FAQ question 54 and its Table 6: the program's file has two years of infection data, updated
  yearly; Care Compare has one year (four quarters), updated quarterly.
- **HACRP-47** cites QualityNet's HAI overview, which also says the 2015-baselined SIRs were shared for the last time in
  the summer 2026 preview. That Care Compare's calendar-year 2017 to 2024 results all used the 2015 baseline rests on
  these statements: no CMS sentence names those years. **HACRP-48** (CMS listserv 2026-74-IP, August 20, 2026): on
  2026-10-22 the Care Compare HAI dataset (77hc-ibv8) still held the last 2015-baseline release (October 2024 to
  September 2025). Re-check when it changes.
- **HACRP-49:** the FAQ's sentence ends "unless otherwise specified". The exceptions: FY2018's and FY2019's PSI 90
  periods (15 and 21 months, the ICD-10 change; 81 FR 57020), and the COVID-19 years: FY2022 (PSI 90 18 months,
  infections calendar 2019 only), FY2023 (no scores) and FY2024 (PSI 90 18 months, infections calendar 2022 only)
  (86 FR 45305; 87 FR 49131-49132).
- **HACRP-50 and HACRP-51:** CMS's March 27, 2020 memo excepted reporting for October 2019 to June 2020; CMS used the
  October to December 2019 data because nearly all hospitals reported it (85 FR 54831), and excluded January to June
  2020 data from scoring (85 FR 54832; 86 FR 45304). HACRP-51 is CMS's November 2020 Care Compare notice. No Care
  Compare infection file covers calendar 2020.
- **HACRP-52:** the FY2023 rule suppressed the measures' scores, the Total HAC Scores and the cut; CMS still calculated
  measure results (87 FR 48782). CMS's FY2023 file lists every hospital with a Total HAC Score of 0.0000 and footnote 5,
  "Results are not available for this reporting period."
- **HACRP-56:** the FY2019 rule's quote describes FY2018 and FY2019; the same rule gives the FY2017 start: "we increased
  the weight of Domain 2 to 75 percent and 85 percent, respectively" (FY2016 and FY2017; 83 FR 41488).
- **HACRP-54 to HACRP-59** are the scoring rules by year, each from the rule or CMS document for that year: 78 FR 50721
  and 50723 (FY2015, deciles), 80 FR 49576 (FY2017's weights, adopted), 83 FR 41485 (FY2019, still 15/85), 81 FR
  57022-57025 (z-scores, adopted for FY2018), 83 FR 41489 (equal weights from FY2020). HACRP-55 is CMS's FY2016 results
  fact sheet.
- **HACRP-61** is FAQ question 25, footnote 5; question 30 says the same for the 5th and 95th percentiles. HACRP-62 is
  question 4 (its list also names religious nonmedical health care institutions and rural emergency hospitals);
  HACRP-63 question 27 (since FY2023, at least 25 eligible discharges on one component and at least 3 on each of seven);
  HACRP-64 question 30; HACRP-65 question 32; HACRP-66 and HACRP-67 the FAQ's glossary; HACRP-68 its answer on measure exceptions (its acronym list also reads "CCN CMS certification number").
- **HACRP-69 was withdrawn on 2026-10-22:** it cited the closing note of CMS's methodology infographic ("Replication of
  some results might not be possible because of rounding"), which is about the infographic's worked example, not CMS's
  published figures. CMS states only that its measure weights are unrounded (FAQ question 34, footnote 9). The copy
  now says the published figures are rounded (true of every file this site pins) and that the small differences are
  rounding (the self-check's largest miss is 0.00009), as this site's own findings.
- **HACRP-71:** the fact sheet is dated December 10, 2015. This site's FY2016 decisions come from CMS's updated cut list,
  `HAC_Results_FY16_Feb 2016.txt` in `FY2016-HAC-Reduction-Program-Information.zip` (pinned as
  `hacrp-fy2016-cut-list`), which names 750 hospitals. The same fact sheet's FY2015 count ("In FY 2015, 724 hospitals
  were subject to a payment reduction") matches the FY2015 list (Table 17).
- **HACRP-02** quotes CMS's program page, which says "all Total HAC Scores"; CMS's FAQ and scoring infographic narrow
  that to hospitals outside Maryland (HACRP-23). **HACRP-27:** CMS's Maryland addendum (HACRP-22's source) says
  "CY2026 is the first AHEAD HGB performance year (PY1) for MD." **HACRP-38:** the CDC page's key points add that a
  CAUTI "occurs when germs enter the urinary tract through a urinary catheter and cause infection". **HACRP-46:** FAQ
  Table 6 also says the Compare tool lists critical access, VA and territory hospitals.

- **Second halves in the same FAQ.** HACRP-05's validation case: question 28, item 5, and question 35, footnote e.
  HACRP-31's "higher is worse": question 9, the sentence before the quote ("A higher CMS PSI 90 composite value
  indicates worse performance"). HACRP-36's "below one, fewer (better)": question 14, the clause after the quote.
  HACRP-46's one year against two: question 54, Table 6. HACRP-61's floor and cap: question 30.
- **HACRP-70** cites AHRQ's PSI 03 specification (v2024): CMS's PSI 90 shares AHRQ's component definitions (HACRP-32).

## Link check (2026-10-22)

Each URL the HACRP site links to (`sites/hacrp/web/links.js`), each dataset landing page in
`data/pinned/manifest.json` and each source above, fetched with redirects followed. The Federal Register addresses redirect to the same document's
page; no source needed an archive copy. CDC's site now refuses plain HTTP clients (403) but serves the same pages to a
browser.

| URL | status | via |
|---|---|---|
| https://www.medicare.gov/care-compare/ | 200 | direct |
| https://www.hospitalsafetygrade.org/ | 200 | direct |
| https://data.cms.gov/provider-data/dataset/yq43-i98g | 200 | direct |
| https://data.cms.gov/provider-data/dataset/y9us-9xdf | 200 | direct |
| https://data.cms.gov/provider-data/sites/default/files/resources/f29bb7c812e242f6edfef0a4b7d0eaca_1760630713/Footnote_Crosswalk.csv | 200 | direct |
| https://mp.qualityreportingcenter.com/globalassets/listserves/2026/iqr/2026-74-ip.pdf | 200 | direct |
| https://qualityindicators.ahrq.gov/Downloads/Modules/PSI/V2024/TechSpecs/PSI_03_Pressure_Ulcer_Rate.pdf | 200 | direct |
| https://qualitynet.cms.gov/files/6890d895ab2b357912aca798?filename=FY-2026-HACRP-FAQ.pdf | 200 (a download; read from the identical file) | direct |
| https://qualitynet.cms.gov/inpatient/measures/hai | 200 (application shell; read in a browser) | browser |
| https://www.cdc.gov/c-diff/about/index.html | 403 to a plain HTTP client; the page loaded in a browser-like fetch | browser-like fetch |
| https://www.cdc.gov/clabsi/about/index.html | 403 to a plain HTTP client; the page loaded in a browser-like fetch | browser-like fetch |
| https://www.cdc.gov/mrsa/about/index.html | 403 to a plain HTTP client; the page loaded in a browser-like fetch | browser-like fetch |
| https://www.cdc.gov/nhsn/pdfs/ps-analysis-resources/nhsn-sir-guide.pdf | 403 to a plain HTTP client; the page loaded in a browser-like fetch | browser-like fetch |
| https://www.cdc.gov/surgical-site-infections/about/index.html | 403 to a plain HTTP client; the page loaded in a browser-like fetch | browser-like fetch |
| https://www.cdc.gov/uti/about/cauti-basics.html | 403 to a plain HTTP client; the page loaded in a browser-like fetch | browser-like fetch |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-fact-sheet.pdf | 200 | direct |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-fiscal-year-2027-key-dates.pdf | 200 | direct |
| https://www.cms.gov/files/document/hospital-readmissions-reduction-program-payment-reduction-methodology.pdf | 200 | direct |
| https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp | 200 | direct |
| https://www.cms.gov/newsroom/fact-sheets/fiscal-year-fy-2016-results-cms-hospital-acquired-conditions-hac-reduction-program | 200 | direct |
| https://www.cms.gov/priorities/innovation/ahead/faqs | 200 | direct |
| https://www.cms.gov/priorities/innovation/files/ahead-fin-specs-ffs-hgb-md-add-v3-2.pdf | 200 | direct |
| https://www.federalregister.gov/documents/2020/09/02/2020-19150/medicare-and-medicaid-programs-clinical-laboratory-improvement-amendments-clia-and-patient | 200 | direct |
| https://www.federalregister.gov/documents/2022/08/10/2022-16472/medicare-program-hospital-inpatient-prospective-payment-systems-for-acute-care-hospitals-and-the | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2013-08-19/html/2013-18956.htm | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2014-08-22/html/2014-18545.htm | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2017-08-14/html/2017-16434.htm | 200 | direct |
| https://www.govinfo.gov/content/pkg/FR-2018-08-17/html/2018-16766.htm | 200 | direct |
| https://www.law.cornell.edu/uscode/text/42/1395ww | 200 | direct |
| https://www.qualityreportingcenter.com/globalassets/2020/12/pch/hospital-compare_care-compare-refresh-and-overall-hospital-quality-star-rating-2021-updates.pdf | 200 | direct |
