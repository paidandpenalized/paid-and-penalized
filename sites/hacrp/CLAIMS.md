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
| HACRP-72 | The readmissions program adjusts each discharge's base operating DRG payment: the DRG payment at Medicare's rates (with new-technology add-ons), not the teaching, low-income-patient, outlier or low-volume payments. | https://www.law.cornell.edu/cfr/text/42/412.154 | "an applicable hospital's base operating DRG payment amount is adjusted for each discharge occurring during the fiscal year." | 2026-10-22 |
| HACRP-73 | The value-based purchasing program multiplies each discharge's base operating DRG payment by the hospital's adjustment factor. | https://www.law.cornell.edu/cfr/text/42/412.160 | "the number that will be multiplied by the base operating DRG payment amount for each discharge from a hospital" | 2026-10-22 |
| HACRP-74 | The HAC Reduction Program's payment is figured after the readmissions and value-based adjustments: 99% of the payment left once both are applied. | https://www.law.cornell.edu/cfr/text/42/412.172 | "determined after the application of the payment adjustment under the Hospital Readmissions Reduction Program … and the adjustment made under the Hospital Value-Based Purchasing Program" | 2026-10-22 |
| HACRP-75 | The HAC cut is taken from the whole inpatient payment: teaching, low-income-patient (including uncompensated care), outlier, low-volume and capital payments as well as the base. | https://www.cms.gov/Regulations-and-Guidance/Guidance/Transmittals/Downloads/R3138CP.pdf | "calculated after all other IPPS per discharge payments, which includes adjustments for DSH (including the uncompensated care payment), IME, outliers … and capital payments" | 2026-10-22 |
| HACRP-76 | A hospital's Medicare cost report records the HAC Reduction Program's payment reduction on a line of its own. | https://www.cms.gov/files/document/r25p240i.pdf | "Enter the HAC program payment reduction adjustment amount effective for discharges occurring on or after October 1, 2014." | 2026-10-23 |
| HACRP-77 | A hospital's Medicare cost report records the readmissions program's adjustment on a line of its own. | https://www.cms.gov/files/document/r25p240i.pdf | "Enter the adjustment amount resulting from the HRR program in accordance with ACA 2010, §3025" | 2026-10-23 |
| HACRP-78 | A hospital's Medicare cost report records the value-based purchasing program's adjustment on a line of its own. | https://www.cms.gov/files/document/r25p240i.pdf | "Enter the payment adjustment amount for the HVBP program in accordance with ACA 2010, §3001" | 2026-10-23 |
| HACRP-79 | The HAC cut is also taken on the teaching (IME) payments Medicare makes on a hospital's Medicare Advantage patients' stays. | https://www.cms.gov/files/document/r25p240i.pdf | "The following payment amounts are required to calculate the HAC reduction adjustment by FFY: … Operating IME payments for Medicare Advantage patients" | 2026-10-23 |
| HACRP-80 | CMS sets its outlier threshold so projected operating outlier payments are 5 to 6 percent (5.1 percent for FY2026) of operating DRG payments plus outlier payments, a total that leaves out teaching and low-income-patient payments. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "5 percent nor more than 6 percent of total operating DRG payments (which does not include IME and DSH payments) plus outlier payments" | 2026-10-23 |
| HACRP-81 | The low-volume adjustment is a percentage of every part of the hospital's inpatient payment, uncompensated care and teaching payments on Medicare Advantage stays included. | https://www.cms.gov/files/document/r25p240i.pdf | "The following payment amounts are multiplied by the low-volume payment adjustment percentage … Operating IME payments for Medicare Advantage patients; … Uncompensated care payments" | 2026-10-23 |
| HACRP-82 | CMS brings a sole community or Medicare-dependent hospital's own (hospital-specific) rate to the new year with the year's update and the budget-neutrality factors for its DRG changes (the reclassification and recalibration factor and the 10-percent cap factor). | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "the hospital specific-rate for an SCH or MDH is adjusted by the MS-DRG reclassification and recalibration budget neutrality factor" | 2026-10-23 |
| HACRP-83 | Each hospital's uncompensated care payment is its share (Factor 3) of a national amount CMS sets for the year (Factor 1 times Factor 2). | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "Factor 3 is applied to the product of Factor 1 and Factor 2 to determine the amount of the uncompensated care payment" | 2026-10-23 |
| HACRP-84 | The base the readmissions and value-based programs adjust includes new-technology add-on payments. | https://www.law.cornell.edu/cfr/text/42/412.152 | "Base operating DRG payment amount is the wage-adjusted DRG operating payment plus any applicable new technology add-on payments under subpart F of this part" | 2026-10-23 |
| HACRP-85 | In Pennsylvania's Rural Health Model, hospitals were paid global budgets, which the model's evaluator reported (in 2022) were adjusted for their results in the value-based purchasing, readmissions and HAC programs. | https://www.cms.gov/priorities/innovation/data-and-reports/2022/parhm-ar2 | "Global budgets continue to be adjusted based on each hospital’s performance under applicable Medicare quality programs (i.e., … Hospital-Acquired Condition Reduction Program" | 2026-10-23 |
| HACRP-86 | The readmissions program's payment adjustment factor is 1 minus a share of the hospital's payments, so it never exceeds 1: the program only reduces payments. | https://www.ecfr.gov/current/title-42/part-412/subpart-I/section-412.154 | "The ratio is equal to 1 minus the ratio of the aggregate payments for excess readmissions … and the aggregate payments for all discharges" | 2026-10-23 |
| HACRP-87 | A hospital's value-based purchasing adjustment factor is 1 plus the difference between its incentive payment percentage and the percent held back from every hospital, so it is above 1 for a hospital that earns more than was held back and below 1 for one that earns less. | https://www.ecfr.gov/current/title-42/part-412/subpart-I/section-412.162 | "determined by subtracting the applicable percent … from the value-based incentive payment percentage and then adding that difference to one" | 2026-10-23 |
| HACRP-88 | Congress extended the Medicare-dependent hospital program and the enhanced low-volume hospital adjustment through December 31, 2026, after FY2026 ends. | https://www.cms.gov/files/document/mm-14415-low-volume-hospital-payment-adjustment-medicare-dependent-hospital-program-fy-2026.pdf | "extends the MDH program through December 31, 2026" … "extended through December 31, 2026" | 2026-10-23 |
| HACRP-89 | The HAC cut's calculation also counts ESRD adjustment payments and credits for replaced devices (which reduce the payment). | https://www.cms.gov/files/document/r25p240i.pdf | "The following payment amounts are required to calculate the HAC reduction adjustment by FFY: … ESRD adjustment payments; … Credits for replaced devices" | 2026-10-23 |
| HACRP-90 | A teaching hospital that counts residents from certain increases in its resident cap (the slots CMS awards under 42 CFR 413.79(c)(4), (n), (p) and (q)) is paid teaching (indirect medical education) payments on the sum of two adjustment factors, its usual one and a second for the added residents. | https://www.ecfr.gov/current/title-42/section-412.105 | "an increase in its FTE resident cap under paragraph (f)(1)(iv)(C) of this section … the sum of the following two indirect medical education adjustment factors" | 2026-10-23 |
| HACRP-91 | Maryland's hospitals are not eligible for a penalty under the readmissions program; CMS uses their data in its calculations but leaves them out of the penalty. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "data from all subsection (d) and Maryland hospitals are used in calculations" … "Maryland hospitals … because these hospitals are not eligible for a penalty" | 2026-10-23 |
| HACRP-92 | A sole community hospital is paid whichever of its rates (the federal rate or a hospital-specific one) yields the greatest aggregate payment; a Medicare-dependent hospital is paid the federal rate plus 75 percent of the amount by which its hospital-specific rate exceeds it. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "SCHs are paid based on whichever of the following rates yields the greatest aggregate payment" … "Federal national rate plus 75 percent of the difference" | 2026-10-23 |
| HACRP-93 | CMS extended the Pennsylvania Rural Health Model's termination date to December 31, 2026. | https://www.cms.gov/files/document/r12622demo.pdf | "extend the existing termination date of the Pennsylvania Rural Health Model to 12/31/2026" | 2026-10-23 |
| HACRP-94 | In the base the readmissions and value-based programs adjust, a Medicare-dependent hospital's gain from its hospital-specific rate (the difference from the federal rate) is included and a sole community hospital's is left out. | https://www.law.cornell.edu/cfr/text/42/412.152 | "sole community hospital … this amount also does not include the difference" … "Medicare-dependent, small rural hospital … this amount includes the difference" | 2026-10-23 |
| HACRP-95 | CMS adds an eligible Indian Health Service or Tribal hospital's supplemental payment to each claim's payment, along with the uncompensated care payment. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "we add the uncompensated care payment and supplemental payment for eligible IHS/Tribal hospitals and Puerto Rico hospitals to the total claim payment amount" | 2026-10-23 |
| HACRP-96 | CMS figures the teaching (IME) and low-income-patient (DSH) payments as percentage add-ons to the federal DRG payment: a claim's operating payment is the DRG payment times one plus the IME adjustment plus a quarter of the DSH adjustment. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "Federal Payment Rate for Operating Costs = MS-DRG Relative Weight x [ … ] x (1 + IME + (DSH * 0.25))" | 2026-10-23 |

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

- **HACRP-22 and HACRP-27** describe Maryland under CMS's AHEAD model. CMS's Maryland addendum says "CY2026 is the first
  AHEAD HGB performance year (PY1) for MD". The FY2026 IPPS final rule (August 2025) says of the earlier Maryland Total
  Cost of Care Model, which began on January 1, 2019, that it "concludes on December 31, 2026". The two sources name
  different events (a model's agreement ending, AHEAD's first performance year), and neither claim above depends on
  the other: no copy says which model replaced which, or in which month (CMS's page for the Total Cost of Care Model:
  https://www.cms.gov/priorities/innovation/innovation-models/md-tccm). Checked 2026-10-23 against the FY2026 rule's
  sentence; an earlier version of this note said AHEAD "replaced" that model "in January 2026", which the rule does not
  say. HACRP-22 cites CMS's Maryland addendum to the AHEAD hospital global budget method (version 3.2, September 2026):
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
- **HACRP-72 to HACRP-75** are the order of the three programs' adjustments, which the dollar estimates follow.
  HACRP-72 cites 42 CFR 412.154(b)(1); 412.152 defines the base operating DRG payment amount as "the wage-adjusted DRG
  operating payment plus any applicable new technology add-on payments" and says it "does not include any additional
  payments for indirect medical education under § 412.105, the treatment of a disproportionate share of low-income
  patients under § 412.106, outliers under subpart F of this part, and a low volume of discharges under § 412.101"; for
  a Medicare-dependent hospital it includes the hospital-specific-rate difference, for a sole community hospital it
  doesn't. HACRP-73 cites 412.160's definition of the value-based incentive payment adjustment factor; the same section
  defines the base operating DRG payment amount in the same words as 412.152. HACRP-74 is 42 CFR 412.172(b), which carries
  out 42 U.S.C. 1395ww(p)(1) (HACRP-01's source). HACRP-75 is CMS's
  change request 8900 (Pub. 100-04, Transmittal 3138, November 26, 2014), which also says: "For SCHs and MDHs, the HAC
  Reduction Program adjustment amount applies to either the Federal rate payment amount or the hospital-specific rate
  payment amount, whichever results in a greater operating IPPS payment."
- **HACRP-76 to HACRP-78** cite the Provider Reimbursement Manual, Part 2, chapter 40 (Form CMS-2552-10), Transmittal
  25 (February 27, 2026), section 4030.1, Worksheet E, Part A: lines 70.99 (HAC), 70.94 (readmissions) and 70.93
  (value-based purchasing). Line 71 adds 70.93 and 70.94 and subtracts 70.99 ("Enter the result of line 67 plus the sum
  of lines 69, 70 through 70.86, 70.88, 70.90, 70.91, 70.92, 70.93, 70.94, and lines 70.96 through 70.98; minus the sum
  of lines 68, 70.87, 70.89, 70.95, and 70.99"). The back-test that reads them is described in docs/METHODS-LOG.md
  (dollars methods_version 2).
- **HACRP-79** cites the same chapter's instructions for Exhibit 5, the HAC reduction calculation schedule (section
  4030.1). Its line 15 is Worksheet E, Part A, line 49, which for every hospital is the federal operating payment (or the
  SCH or MDH payment) "plus the amount from line 29.01", line 29.01 being "Total IME Payment - Managed Care"; line 32,
  the HAC reduction (Worksheet E, Part A, line 70.99), is 1 percent of a subtotal that includes line 15. Worksheet E,
  Part A, line 22.01 computes the managed care IME as the IME adjustment factor "times line 3", the managed care
  simulated payments.
- **HACRP-80 to HACRP-85** back the dollar estimates' methods_version 4 (`docs/METHODS-LOG.md`). HACRP-80 is the
  FY2026 IPPS/LTCH PPS final rule at 90 FR 37219 ("outlier payments for any year are projected to be not less than 5
  percent nor more than 6 percent of total operating DRG payments (which does not include IME and DSH payments) plus
  outlier payments"; 90 FR 37214 says the same of the statute). The threshold's own calculation (90 FR 37227) divides
  "total outlier payments by total operating Federal payments plus total outlier payments", and the FY2026 target there
  is "targeting an outlier threshold at 5.14 percent [5.1 percent-(-.04 percent)]": the 5.1 percent target, moved by an
  estimate of outlier reconciliation. HACRP-81 cites the same chapter as
  HACRP-76 to HACRP-79, the instructions for Exhibit 4, the low-volume adjustment calculation schedule; its list also
  names the operating federal and hospital-specific payments, outliers, IME, DSH, ESRD payments, capital, new-technology
  payments and credits for replaced devices. HACRP-82 is the rule's Addendum II.D.3.b (90 FR 37232), which also applies
  the 10-percent cap budget neutrality factor to SCHs' rates ("the hospital specific-rate for an SCH would be adjusted
  by the MS-DRG 10-percent cap budget neutrality factor"); 90 FR 37231 applies the same updates to MDHs' rates if the
  law extended the program into FY 2026, which it did. HACRP-83 is 90 FR 36889-36890; the year's amount is
  "$12,412,500,000 * 0.6214 = $ 7,713,127,500" (90 FR 36889). HACRP-84 is 42 CFR 412.152 (read on the eCFR); 412.160
  defines the value-based program's base in the same words. HACRP-85 is the model's second annual evaluation report,
  written for CMS by NORC at the University of Chicago (June 2022), which says its contents are the authors'
  responsibility, so the claim is worded as the evaluation's, not as a CMS rule, and in the past tense: CMS's model page
  gives the performance period's end as December 31, 2024, while change request 13595 (HACRP-93) moved the termination
  date to December 31, 2026, and the evaluation (June 2022) predates both. This site's participant list is empty
  (CMS publishes none with CCNs), so Methods estimates the model's hospitals like any other.
- **HACRP-86 to HACRP-91** back the dollar pages' wording (the M4 accuracy pass).
  - **HACRP-86 and HACRP-87** are 42 CFR 412.154(c) and 412.162(c), read on the eCFR (version dated 2026-10-20).
    412.154(c) makes the readmissions factor "the higher of the ratio … or the floor adjustment factor", the floor being
    0.97 from FY 2015; the ratio is 1 minus a share, so the factor is at most 1. The floor on the
    share is the statute's: 42 U.S.C. 1395ww(q)(4)(C)(i) (HACRP-01's source) defines the excess readmissions ratio as "the
    ratio (but not less than 1.0)" of risk-adjusted actual to expected readmissions, so a hospital's payments for excess
    readmissions are never negative and the program never adds to a payment. (412.152's stratified definition, the ratio
    "minus the peer-group median excess readmission ratio (ERR)", does not repeat the floor in its text.) 412.162(b)(1) says the total available
    for value-based incentive payments "is equal to the total amount of base-operating DRG payment reductions for that
    fiscal year, as estimated by the Secretary", and 412.162(a) that CMS "will make value-based incentive payments" to a
    hospital that meets or exceeds the performance standards: bonuses are paid for by other hospitals' cuts.
  - **HACRP-88** is CMS's MLN Matters article MM14415 (transmittals R13703OTN and R13735OTN), which carries out
    Pub. L. 119-75, sections 6201 (the low-volume adjustment, "through 2026 and the portion of fiscal year 2027
    beginning on October 1, 2026, and ending on December 31, 2026") and 6202 (the Medicare-dependent hospital
    program, "January 31, 2026" struck and "January 1, 2027" inserted). The Provider Reimbursement Manual text cited at
    HACRP-76 to HACRP-79 says "The MDH program ends on September 30, 2025", and the FY2026 impact-file README gives MDH
    status "through September 30, 2025"; both were written before the extensions. Both lapses inside FY2026 (October 1 to November 12, 2025, and January 31 to February 3,
    2026) were closed retroactively by statute (Pub. L. 119-37, then Pub. L. 119-75), so no day of FY2026 is
    uncovered. From January 1, 2027 CMS pays former MDHs at the federal rate (FY2027 IPPS final rule, 91 FR 49570).
    MM14415 says a hospital that cancelled its rural classification, or applied for SCH status on or after
    January 1, 2026, is not reinstated automatically; the estimate counts every hospital the impact file flags as MDH.
  - **HACRP-89** is the same PRM section as HACRP-79 (4030.1, Exhibit 5): its list of the payment amounts "required to
    calculate the HAC reduction adjustment" also names the low-volume adjustment, capital outlier reconciliation
    amounts and new-technology payments. The estimate prices none of the ESRD payments and replaced-device credits;
    its Methods table says so. A credit reduces the payment: Worksheet E, Part A, line 68 is "the partial or full credits
    received from manufacturers for replaced" devices, and line 71 subtracts it (the quotation at HACRP-76 to HACRP-78),
    so leaving credits out lifts the estimated HAC cut a hair, and leaving the ESRD add-on out lowers it.
  - **HACRP-90** is 42 CFR 412.105(e)(2), read on the eCFR (2026-10-20). The second factor applies only to
    increases "under paragraph (f)(1)(iv)(C)", which lists the extra slots CMS awards under 42 CFR 413.79(c)(4), (n), (p)
    and (q) (other cap changes, such as a new program's, get no second factor), and
    412.105(d)(4) multiplies the second factor, the one for the added residents, by 0.66. CMS's impact-file teaching
    factor (TCHOP) equals the first factor alone on every teaching row of both years' files, so the estimate leaves
    the second out. That check is this site's own.
  - **HACRP-91** is the FY2026 IPPS/LTCH final rule's note to the readmissions penalty table (90 FR 37266), the same
    document as HACRP-80, HACRP-82 and HACRP-83. CMS's MLN Matters article MM14203 says the same of the Pricer: "Hospitals
    not subject to a reduction under the HRRP in FY 2026 (such as Maryland hospitals and non-subsection (d) hospitals)
    have an HRRP payment adjustment factor of 1." No CMS FY2026 text found names Maryland and the value-based program;
    the pinned Table 16B lists no Maryland hospital, which the Methods table gives as this site's own reading. The
    note's first sentence says the table is built on "the data used to calculate the FY 2026 payment adjustment factors of
    open, non-Maryland, subsection (d) hospitals only", and the quotation in the row says Maryland's data still go into
    each hospital's excess readmissions ratio.

- **HACRP-92 to HACRP-96** back the Assumptions rows revised after the independent fact-check of HACRP-72 to HACRP-91
  (the same accuracy pass).
  - **HACRP-92** is the FY2026 final rule's Addendum (90 FR 37231). Its sole-community-hospital sentence is 42 CFR
    412.92(d)(1) ("a sole community hospital is paid based on whichever of the following amounts yields the greatest
    aggregate payment for the cost reporting period"). The Medicare-dependent sentence in full reads "currently MDHs are
    paid based on the Federal national rate or, if higher, the Federal national rate plus 75 percent of the difference
    between the Federal national rate and the greater of the updated hospital-specific rates"; 42 CFR 412.108(c)(2)(iii)
    says "75 percent of the amount that the Federal rate … is exceeded by the highest of the following" for cost reporting
    periods before January 1, 2027 (eCFR, 2026-10-01). The rule's text was written before the extensions (HACRP-88). CMS
    compares the year's totals: PRM 4030.1, Exhibit 5, line 15 reads "if line 13, column 1 is greater than line 14,
    column 1" for an SCH (line 13 the federal payment, line 14 the hospital-specific payment), and CR 8900 (HACRP-75's
    source) says the HAC adjustment applies "to either the Federal rate payment amount or the hospital-specific rate
    payment amount, whichever results in a greater operating IPPS payment".
  - **HACRP-93** is Pub. 100-19, Transmittal 12622 (change request 13595, May 2, 2024; effective October 1, 2024):
    "The purpose of this Change Request (CR) is to extend the existing termination date of the Pennsylvania Rural Health
    Model to 12/31/2026." CMS's model page still gives December 31, 2024 as the performance period's end (HACRP-85).
  - **HACRP-94** is the same definition as HACRP-72's notes, read on Cornell's copy and the eCFR (identical): "With respect
    to a sole community hospital that receives payments under § 412.92(d) this amount also does not include the
    difference between the hospital-specific payment rate and the Federal payment rate determined under subpart D of this
    part. With respect to a Medicare-dependent, small rural hospital that receives payments under § 412.108(c), this
    amount includes the difference between the hospital-specific payment rate and the Federal payment rate determined
    under subpart D of this part." 412.160's definition of the base excludes the difference for a Medicare-dependent
    hospital only "for discharges occurring in FY 2013", so the value-based base's inclusion of the add-on in later years
    is read from that date.
  - **HACRP-95** is the payment-formula steps of the same Addendum (90 FR 37231). The rule's outlier threshold also takes
    "the estimated per-discharge supplemental payments to hospitals eligible for the supplemental payment" (90 FR 37227).
    42 CFR 412.106(h) sets the amount for a fiscal year as the difference between a base-year amount and the year's
    uncompensated care payment; the impact file's per-claim uncompensated care amount includes it.
  - **HACRP-96** is Step 3 of the payment-formula steps in the same Addendum (90 FR 37231). The Provider Reimbursement
    Manual's Exhibit 5 (4030.1) builds the same way: its line 6 (the IME payment) multiplies the adjustment factor by "the
    sum of lines 1.01, 1.02, 1.03, 1.04 and line 4", the DRG payment lines, and its line 11 (the DSH payment) is
    "(line 10 times the sum of lines 1.01, 1.02 1.03, and 1.04) times 25 percent".

## Link check (2026-10-22; extended 2026-10-23)

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
| https://www.law.cornell.edu/cfr/text/42/412.154 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.160 | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.172 | 200 | direct |
| https://www.cms.gov/Regulations-and-Guidance/Guidance/Transmittals/Downloads/R3138CP.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.qualityreportingcenter.com/globalassets/2020/12/pch/hospital-compare_care-compare-refresh-and-overall-hospital-quality-star-rating-2021-updates.pdf | 200 | direct |
| https://www.cms.gov/files/document/r25p240i.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/files/document/mm-14415-low-volume-hospital-payment-adjustment-medicare-dependent-hospital-program-fy-2026.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/files/document/r12622demo.pdf | 200 (a PDF; read from the downloaded file) | direct |
| https://www.cms.gov/priorities/innovation/data-and-reports/2022/parhm-ar2 | 200 (a PDF; read from the downloaded file) | direct |
| https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | 200 | direct |
| https://www.law.cornell.edu/cfr/text/42/412.152 | 200 | direct |
| https://www.ecfr.gov/current/title-42/part-412/subpart-I/section-412.154 | 200 | direct (one redirect) |
| https://www.ecfr.gov/current/title-42/part-412/subpart-I/section-412.162 | 200 | direct (one redirect) |
| https://www.ecfr.gov/current/title-42/section-412.105 | 200 | direct (one redirect) |
