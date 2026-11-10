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

## Link check (2026-11-10)

Each source above, fetched with `curl -sL`.

| URL | status | via |
|---|---|---|
| https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 200 (about 1.2 MB, the enrolled law's text; sections 71119 and 1902(xx) read in full) | direct |
