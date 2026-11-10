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

## Link check (2026-11-10)

Each source above, fetched with `curl -sL`.

| URL | status | via |
|---|---|---|
| https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 200 (about 1.2 MB, the enrolled law's text; sections 71119 and 1902(xx) read in full) | direct |
| https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | 200 (the report PDF, SHA-256 equal to the manifest's; executive summary read) | direct |
| https://www.federalregister.gov/documents/2026/06/03/2026-11094/medicaid-program-community-engagement-requirement-for-certain-individuals | 200 on the first fetch (the rule's page; its full text read at federalregister.gov/documents/full_text/text/2026/06/03/2026-11094.txt, page 33461); a later scripted fetch was sent to the site's bot check | direct |
| https://www.govinfo.gov/content/pkg/FR-2025-08-04/html/2025-14681.htm | 200 (about 4.8 MB, the rule's text; the WR-10 passage found, once) | direct |
