# Work-requirement claims register

Every sentence on the work-requirement site that states a fact about the law or Medicaid carries a claim id (`WR-NN`),
or a list of them when it states more than one, in the site's copy files (`sites/work-requirement/web/copy.js` and the
`copy.js` beside each part's code) or in `sites/work-requirement/web/constants.js`. The family's shared copy may cite
these rows too (the scenario's dek, `web/copy.js` `dekWorkRequirement`). Each id is a row here: the claim in this site's
own words, the primary source that supports it, a short quotation from that source, and the date it was last checked.
Sentences that describe only this site's own arithmetic or framing (the scenario's numbers, which are modeled here) carry
no id. The gate is `pipeline/test/copy-gate.test.js`: a row no copy or constant uses fails it, so a row is added with
the sentence that needs it.
A claim marked `unverified` may not be used in copy.

| id | claim | primary source | quoted support | checked |
|---|---|---|---|---|
| WR-01 | The 2025 reconciliation law (Public Law 119-21, section 71119) requires each state to make demonstrating community engagement (work, community service, a work program or school) a condition of Medicaid eligibility for the people it applies to. | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | "a State shall provide, as a condition of eligibility for medical assistance for an applicable individual, that such individual is required to demonstrate community engagement" | 2026-11-10 |
| WR-02 | The requirement applies to adults in Medicaid's expansion group (eligible under section 1902(a)(10)(A)(i)(VIII) of the Social Security Act, or under a waiver giving equivalent coverage), other than the individuals the law excludes. | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | "an individual (other than a specified excluded individual" … "who is eligible to enroll (or is enrolled) under the State plan under subsection (a)(10)(A)(i)(VIII)" | 2026-11-10 |
| WR-03 | The Urban Institute and the Robert Wood Johnson Foundation project that the work requirement alone would cut average monthly Medicaid expansion enrollment in 2028 by 3.0 million under high state mitigation, 4.9 million under medium and 7.0 million under low. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "We project coverage losses of between 3.0 and 7.0 million expansion enrollees because of work requirements alone" … "4.9 million under the medium mitigation scenario" | 2026-11-10 |
| WR-04 | CMS's rule on the community engagement requirement projects that it will reduce Medicaid enrollment by 2.3 million in fiscal year 2027 and by 3.1 to 3.3 million in each later year. | https://www.federalregister.gov/documents/2026/06/03/2026-11094/medicaid-program-community-engagement-requirement-for-certain-individuals | "enrollment would be reduced by 2.3 million individuals in FY 2027" … "by between 3.1 to 3.3 million individuals in subsequent years" | 2026-11-10 |
| WR-05 | Urban Institute and RWJF's mitigation scenarios are sets of state implementation and policy choices meant to keep Medicaid coverage for people who meet the work requirement or are exempt from it. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "implementation and policy choices" … "to maintain Medicaid coverage among people who are meeting work requirements or exempt from them" | 2026-11-10 |
| WR-06 | Urban's high mitigation scenario assumes extensive automatic data matching for redeterminations and for checking compliance, the minimum work the law allows, and broader definitions of the exemptions. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "extensive automatic data-matching for eligibility redeterminations and for assessing compliance with work requirements" … "the minimum allowable work effort and broader definitions of exemptions" | 2026-11-10 |
| WR-07 | Urban's low mitigation scenario assumes less automatic data matching, so more enrollees must act to keep coverage, with more work required and narrower definitions of the exemptions. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "less automatic data-matching" … "require that more enrollees take action to maintain coverage" … "greater levels of work effort and narrower definitions of exemptions" | 2026-11-10 |
| WR-08 | In Urban's medium mitigation scenario, the scope and effectiveness of data matching and the exemptions fall between the high and low scenarios. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "the scope and effectiveness of automatic data-matching and definitions of exemptions are between the high and low mitigation scenarios" | 2026-11-10 |
| WR-09 | Urban assumes every state makes the same implementation choices within a scenario, so its state estimates differ only with the makeup of each state's expansion enrollees. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "uniform implementation choices across states within each scenario" … "differences in the composition of each state's Medicaid expansion enrollees" | 2026-11-10 |
| WR-10 | Maryland's hospitals are paid under an all-payer model, a model under section 1115A of the Social Security Act. | https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | "exclude hospitals in Maryland (because these hospitals are paid under an all payer model under section 1115A of the Act)" | 2026-11-10 |
| WR-11 | CBO estimates that under section 71119 about 2.9 million people will lose Medicaid coverage in 2034 for not meeting the requirement and about 2.8 million more because of its added application steps, and that the number of people without health insurance will rise by 5.3 million in 2034. | https://www.cbo.gov/system/files/2025-10/PL-119-21-Medicaid%20_0.pdf | "2.9 million in 2034, will lose coverage" … "2.8 million additional people" … "the number of people without health insurance will increase by 5.3 million" | 2026-11-10 |
| WR-12 | Dobson DaVanzo's technical appendix for the Commonwealth Fund (June 2017) estimates, by working back from earlier studies of the uninsured, that a newly uninsured population uses about 44 percent less hospital care. | https://www.commonwealthfund.org/sites/default/files/documents/___media_files_publications_fund_report_2017_jun_dobson_ahca_impact_safety_net_hosps_technical_appendix.pdf | "we reverse engineered the results of those studies" … "a newly uninsured population will reduce utilization of hospital services by about 44 percent" | 2026-11-10 |
| WR-13 | Urban Institute and RWJF expect the work requirements to apply to Medicaid waiver programs in some states that did not expand Medicaid, and their projections leave out Georgia's Pathways program. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "will also apply to Medicaid waiver programs in some nonexpansion states" … "do not assess potential changes in enrollment in Georgia’s Pathways program" | 2026-11-10 |
| WR-14 | Georgia Pathways to Coverage, a section 1115 demonstration, extends coverage to Georgians with incomes up to 100% of the federal poverty level. | https://www.medicaid.gov/medicaid/section-1115-demonstrations/downloads/ga-pathway-pa-04282025.pdf | "Under the Georgia Pathways to Coverage® Section 1115 Demonstration" … "extends healthcare coverage to individuals with incomes up to 100% of the Federal Poverty Level" | 2026-11-10 |
| WR-15 | Georgia is the only state that continues to operate a community engagement program as a condition of Medicaid eligibility for certain adults. | https://www.federalregister.gov/documents/2026/06/03/2026-11094/medicaid-program-community-engagement-requirement-for-certain-individuals | "Georgia is the only State that continues to operate a community engagement program as a condition of Medicaid eligibility for certain adults" | 2026-11-10 |
| WR-16 | CMS's CMS-64 new adult group dataset reports summary expenditure data for the Affordable Care Act's new adult group (the VIII group), which applies only to states that adopted the expansion. | https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/00505e90-f8ac-5921-b12f-5e23ba7ffcf3 | "summary level expenditure data associated with the new adult group established under the Affordable Care Act" … "applicable for states that have expanded" | 2026-11-10 |
| WR-17 | CMS's Financial Management Report gives each state's total Medicaid expenditures by program. | https://www.medicaid.gov/medicaid/financial-management/state-expenditure-reporting-for-medicaid-chip/expenditure-reports-mbescbes | "Summary state-by-state total expenditures by program for the Medicaid Program, Medicaid Administration and CHIP are available" | 2026-11-10 |
| WR-18 | Urban Institute and RWJF's Appendix Table A.2 gives, by state and mitigation scenario, the projected change in average monthly Medicaid expansion enrollment in 2028. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "Projected Changes in Average Monthly Medicaid Expansion Enrollment" … "in 2028" … "by State and Mitigation Scenario" | 2026-11-10 |
| WR-19 | All payers pay Maryland's hospitals at the rates Maryland's Health Services Cost Review Commission (HSCRC) sets. | https://hscrc.maryland.gov/Pages/About-Us.aspx | "all payers pay Maryland hospitals on the basis of the rates established by the HSCRC" | 2026-11-10 |
| WR-20 | Maryland's rate setting builds the cost of hospitals' uncompensated care into their rates. | https://hscrc.maryland.gov/Pages/UCC.aspx | "Maryland’s rate setting system factors the cost of UCC into the State’s hospital rate setting structure" | 2026-11-10 |
| WR-21 | HSCRC estimated the effect of H.R. 1's coverage losses on Maryland hospitals' uncompensated care in FY2027 and expects the inpatient part from the work requirement to be near zero, reasoning that an inpatient stay creates an exemption from it. | https://hscrc.maryland.gov/Documents/DanielaT%20Uploads/5%20-%20Payment%20Models%20Workgroup%20-PayMods/RY27%20(2026)/PMWG040126.pptx.pdf | "Estimated Impact of HR 1 on Medicaid Uncompensated Care in FY 2027" … "near-zero, as inpatient stays create an exemption from work requirements" | 2026-11-10 |
| WR-22 | Public Law 119-21 lets a state's plan (or waiver), at the person's request, count a month in which a person receives inpatient hospital services as a month of demonstrated community engagement: an optional exception for short-term hardship, not a requirement. | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | "may provide" … "upon the request of such individual" … "deem such individual to have demonstrated community engagement" … "receives inpatient hospital services" | 2026-11-10 |
| WR-23 | Urban Institute and RWJF's projections include waiver enrollment in one state that did not expand Medicaid, Wisconsin, whose section 1115 waiver program they project at about 166,000 enrollees; Appendix Table A.2 has a Wisconsin row. | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | "we only consider waiver enrollment in one nonexpansion state, Wisconsin" … "enrollment in Wisconsin’s Section 1115 waiver program will be about 166,000" | 2026-11-10 |

## Notes on the sources

- **The law's name.** The enrolled text of Public Law 119-21 (H.R. 1, July 4, 2025) has no short title: it is "An Act
  To provide for reconciliation pursuant to title II of H. Con. Res. 14". The site names it by its public law number
  and section. Section 71119, "Requirement for States to establish Medicaid community engagement requirements for
  certain individuals", adds subsection (xx), "Community Engagement Requirement for Applicable Individuals", to section
  1902 of the Social Security Act (139 Stat. 306-307); the family registry's `long` name is that heading (hub/CLAIMS.md
  HUB-26).
- **WR-01.** Paragraph (2) of the new subsection lists the ways to demonstrate community engagement for a month: at least
  80 hours of work, of community service or of a work program, half-time school, a mix of them totaling 80 hours, or
  a monthly income of at least the federal minimum wage times 80 hours (for a seasonal worker, averaged over six
  months). The requirement starts no later than the first day of the first quarter after December 31, 2026, or
  earlier at a state's option (paragraph (1)), except as paragraph (11) provides: the Secretary may exempt a state that
  shows a good faith effort to comply, and the exemption expires no later than December 31, 2028 (it may end earlier,
  and may not be renewed past that date).
- **WR-02.** Paragraph (9)(A) defines an applicable individual: one eligible for (or enrolled in) the group under
  section 1902(a)(10)(A)(i)(VIII), which CMS's reports call the new adult group (the Affordable Care Act's expansion
  group), or under a waiver with equivalent coverage (adults 19 to 64 not otherwise eligible under the plan); specified
  excluded individuals (paragraph (9)(A)(ii)) are out.
- **WR-03.** Urban Institute and RWJF, "Projected Reductions in Medicaid Expansion Enrollment Under OBBBA's Work
  Requirements and Six-Month Redeterminations: National and State Estimates for 2028" (March 2026), executive summary,
  page vii (the PDF's SHA-256 is the manifest's `urban-2026-a2-wr` `derivedFrom.sha256`). The three figures are the
  incremental effect of the work requirement after six-month redeterminations, in average monthly enrollment in 2028;
  the report's high, medium and low mitigation scenarios are this site's low, middle and high cases. The strips print
  them from the emitted file (`scenarios[].decline_enrollment`, Urban's Appendix Table A.2 national totals in thousands),
  which round to the report's 3.0, 4.9 and 7.0 million.

- **WR-04.** CMS, "Medicaid Program; Community Engagement Requirement for Certain Individuals", FR Doc 2026-11094,
  91 FR 33348 (June 3, 2026), regulatory impact analysis at 91 FR 33461. Its one correction (FR Doc C1-2026-11094,
  91 FR 39028, June 29, 2026) rewrites 42 CFR 435.557 and 435.558 and leaves the estimate as it was.
  FY2027 is a partial year (the requirement starts in its second quarter). The later years' 3.1 to 3.3 million sit at
  about the low case's 3.0 million (WR-03), which is why the strips' small note sits on the low strip; the page cites
  CMS's count only.

- **WR-05 to WR-09.** The same report (the PDF whose SHA-256 is the manifest's `urban-2026-a2-wr` `derivedFrom.sha256`,
  downloaded again 2026-11-10 and matched). WR-05 to WR-08: the executive summary's definitions of the three scenarios,
  page vi (repeated in the methods section, page 20). WR-09: the methods section, page 21, where the one exception is
  named: states' sharing of SNAP work-requirement data, which Urban models from each state's integration of the two
  systems. The page's step 2 paraphrases these; it quotes none.

- **WR-10.** CMS's FY2026 inpatient final rule (FR Doc 2025-14681, August 4, 2025), the steps that set the standardized
  amount (90 FR 37214), where CMS leaves Maryland's hospitals out because of the state's all-payer model; the family's
  hub/CLAIMS.md HUB-04 cites the same passage for Medicare. Fetched again 2026-11-10 (`curl -sL`, 200) and the quotation
  matched. Step 3 says only that the hospitals are paid under that model and that this scenario does not model it; it
  describes none of the model's mechanics.

- **WR-11.** CBO, "Public Law 119-21 ... Title VII, Finance, Subtitle B, Health, Chapter 1, Medicaid", supplemental cost
  estimate of October 28, 2025 (publication 61837; "as enacted on July 4, 2025"), page 6, "Community Engagement
  Requirements". The same page says CBO expects most people who lose Medicaid coverage under the section to become
  uninsured. The worksheet's line 9 and Methods' "become uninsured" share (the scenario file's `params.uninsured_share`,
  0.93) is this site's ratio of the two counts, 5.3 ÷ (2.9 + 2.8); CBO does not state the ratio. cbo.gov answers scripted
  requests with a 403, so the PDF was read in a browser on 2026-11-10 and its text extracted there; the quotation matched.
  The page links the publication page, which links the PDF. Re-read 2026-11-10 from a downloaded copy of the PDF
  (pdftotext, page 6), and the quotation narrowed so its last fragment names its subject. The full sentences: "the rest,
  about 2.9 million in 2034, will lose coverage"; "CBO anticipates that about 2.8 million additional people will lose
  Medicaid coverage in 2034 because the requirement will add steps to the application process" (the claim's "added
  application steps"); and, in the paragraph on section 71119's totals, "CBO also estimates that the number of people
  without health insurance will increase by 5.3 million in 2034." The 5.3 million is section 71119's alone: the next
  paragraph says the chapter's remaining Medicaid policies "result in no additional net effects on the number of people
  without health insurance in 2034."
- **WR-12.** Dobson DaVanzo & Associates (Allen Dobson, Joan DaVanzo, Randy Haught), "The Financial Impact of the American
  Health Care Act's Medicaid Provisions on Safety-Net Hospitals: Technical Appendix" (June 26, 2017), prepared for the
  Commonwealth Fund, PDF page 23, "Impact on revenues and costs for persons becoming uninsured" (the PDF's SHA-256 as
  downloaded 2026-11-10: `3dadaef77cf1debb817b633f450811748cbe3aa3ce6d223347b717f9fc419b23`). The worksheet's line 10 and
  Methods' "still given" share (`params.care_still_used`, 0.56) is one less the 44 percent. The appendix calls the figure
  an estimate worked back from earlier studies, and Methods says so: it is a modeling assumption with a named source,
  not a measured effect.
- **WR-13.** The Urban Institute and RWJF report (WR-03): the executive summary (page v) for the waiver programs, and
  page 8 for Georgia’s Pathways program, which Urban leaves out "where enrollment impacts would
  depend on the extent to which the state is required to align" its existing waiver's requirements with the law's.
  Methods does not say whether the law reaches Pathways; it says Urban expects the law to reach some waiver programs and
  leaves Pathways out, so Georgia's hospitals have no scenario.
- **WR-14.** Georgia Department of Community Health, "Georgia Section 1115 Demonstration Waiver Extension Request"
  (April 28, 2025), on medicaid.gov, pages 3 and 4 (the PDF's SHA-256 as downloaded 2026-11-10:
  `f092823fac2123313226de384b39a9f379b5c8914379584532582609da5c6209`). The state's own description of its program; CMS's
  rule (WR-15) cites the same document. Methods says "up to the poverty line" and names no percentage.
- **WR-15.** CMS's interim final rule (WR-04), section I (background), 91 FR 33348 and after; read in the rule's full
  text (federalregister.gov/documents/full_text/text/2026/06/03/2026-11094.txt, fetched 2026-11-10, 200).
- **WR-16.** CMS, "Medicaid CMS-64 New Adult Group Expenditures", the dataset's description in data.medicaid.gov's
  catalog (the metastore record the dataset page, data.medicaid.gov/dataset/00505e90-f8ac-5921-b12f-5e23ba7ffcf3, shows;
  the page itself is drawn by script). The pinned file is the manifest's `cms64-viii-2026-02`. The second quotation is
  from its note that the VIII group "is only applicable for states that have expanded their Medicaid programs by adopting
  the VIII Group".
- **WR-17.** medicaid.gov, "Expenditure Reports From MBES/CBES", the page that lists the Financial Management Report's
  yearly zips; the pinned extract is the manifest's `cms64-fmr-fy2023-map` (each state's MAP tab: its total net
  expenditures and the two DSH rows). Methods uses it only for the net-of-DSH sensitivity.
- **WR-18.** The Urban Institute and RWJF report (WR-03), Appendix Table A.2, page 45: its title. The site reads the
  table's three work-requirement columns ("Incremental Difference of Work Requirements After Six-Month
  Redetermination"), transcribed in the manifest's `urban-2026-a2-wr`. The as-of line prints the table's name from that
  pin's title and the day it was copied (the pin's `retrieved`), since the report carries a month, not a date.
- **WR-19 to WR-21.** Maryland's Health Services Cost Review Commission: "About Us" (WR-19) and "Uncompensated Care
  (UCC)" (WR-20), fetched 2026-11-10 (`curl -sL`, 200 each) and the quotations matched; and the Payment Models Workgroup
  deck of April 1, 2026 (WR-21), slides 19 and 20 (the PDF's SHA-256 as downloaded 2026-11-10:
  `adf27bd5b868ed5b67e31b2796c9f5f4b96381079cc26c7b178347078a3f3b87`). HSCRC's estimate covers all of H.R. 1's coverage
  losses (immigration-related ones too), states its assumptions as of March 17, 2026, and says FY2028 can't yet be
  estimated; its dollar figures are not in this site's data, so Methods prints none of them and links the deck. Methods
  says only that HSCRC made its own estimate and expects the inpatient part to be near zero, and gives the exemption as
  HSCRC's reasoning: under the law it is a state's option, at the person's request (WR-22).
- **WR-22.** The enrolled law (WR-01), section 71119, new subsection 1902(xx)(3)(B) of the Social Security Act, "Optional
  exception for short-term hardship events", fetched again 2026-11-10 (`curl -sL`, 200) and the quotation matched.
  Clause (i): "The State plan (or waiver of such plan) may provide" that the state shall, for a hardship event in clause
  (ii)(II) and, "upon the request of such individual", one in subclause (I) or (III), deem the individual to have
  demonstrated community engagement for the month. Subclause (ii)(I): the individual "receives inpatient hospital
  services, nursing facility services" (and other listed services of similar acuity) for part or all of the month.
  Methods' "What the method can't tell you" says the scenario doesn't model this choice, and its Maryland section calls
  the exemption a state's option at the person's request.
- **WR-23.** The Urban Institute and RWJF report (WR-03), page 8 (the PDF's SHA-256 equal to the manifest's
  `urban-2026-a2-wr` `derivedFrom.sha256`, downloaded again 2026-11-10), in the same passage as WR-13's Georgia fragment;
  the executive summary's figures note "Estimates include waiver enrollment in Wisconsin", and Appendix Table A.2 (page
  46, its second page) has a Wisconsin row. Wisconsin's CMS-64 reports show no new adult group (WR-16), so the
  method has no expansion share for it; Methods says Urban's table includes Wisconsin's waiver enrollees but its hospitals
  have no scenario.

## Link check (2026-11-10)

Each source above, fetched with `curl -sL`.

| URL | status | via |
|---|---|---|
| https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 200 (about 1.2 MB, the enrolled law's text; sections 71119 and 1902(xx) read in full; fetched again for WR-22, 200) | direct |
| https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | 200 (the report PDF, SHA-256 equal to the manifest's; executive summary read; fetched again for WR-23, 200, same SHA-256, page 8 read) | direct |
| https://www.federalregister.gov/documents/2026/06/03/2026-11094/medicaid-program-community-engagement-requirement-for-certain-individuals | 200 on the first fetch (the rule's page; its full text read at federalregister.gov/documents/full_text/text/2026/06/03/2026-11094.txt, page 33461); a later scripted fetch was sent to the site's bot check | direct |
| https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | 200 (about 4.8 MB, the rule's text; the WR-10 passage found, once) | direct |
| https://www.cbo.gov/system/files/2025-10/PL-119-21-Medicaid%20_0.pdf | 403 to `curl`; 200 in a browser on 2026-11-10 (the publication page, cbo.gov/publication/61837, and the PDF; text read there); re-read the same day from a downloaded copy (pdftotext, page 6) | browser |
| https://www.commonwealthfund.org/sites/default/files/documents/___media_files_publications_fund_report_2017_jun_dobson_ahca_impact_safety_net_hosps_technical_appendix.pdf | 200 (the appendix PDF, 34 pages; page 23 read) | direct |
| https://www.medicaid.gov/medicaid/section-1115-demonstrations/downloads/ga-pathway-pa-04282025.pdf | 200 (Georgia's extension request PDF; pages 3 and 4 read) | direct |
| https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/00505e90-f8ac-5921-b12f-5e23ba7ffcf3 | 200 (the dataset's catalog record, its description read) | direct |
| https://www.medicaid.gov/medicaid/financial-management/state-expenditure-reporting-for-medicaid-chip/expenditure-reports-mbescbes | 200 (the page; the quoted sentence found) | direct |
| https://hscrc.maryland.gov/Pages/About-Us.aspx | 200 | direct |
| https://hscrc.maryland.gov/Pages/UCC.aspx | 200 | direct |
| https://hscrc.maryland.gov/Documents/DanielaT%20Uploads/5%20-%20Payment%20Models%20Workgroup%20-PayMods/RY27%20(2026)/PMWG040126.pptx.pdf | 200 (the deck PDF; slides 19 to 22 read) | direct |
