// Ported from Thirty Day Readmissions (web/src/js/views/methods.js at 33d1959).
// The Readmissions Methods page's words: the kicker and heading, About, the formula and the replication sentence, the
// dollar estimate's method with its accuracy line and assumptions, how to read a penalty, places, history, feedback and
// privacy, accessibility, the pinned sources, the glossary and reuse. No digit characters: every number arrives through a {placeholder}. A sentence that states a program rule carries the
// claim id of its row in sites/hrrp/CLAIMS.md.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';
import { COPY as PROGRAM } from '../program/copy.js';

export const COPY = {
  pageTitle: { text: 'Methods and sources: Readmissions, {edition}', claim: null },
  pageDescription: {
    text: 'How the Readmissions pages are made: the formula behind each hospital’s cut, how the dollars are estimated, and the sources.',
    claim: null,
  },
  kicker: { text: 'Methods & sources', claim: null },
  heading: { text: 'How this was made', claim: null },

  aboutHeading: { text: 'About', claim: null },
  aboutIntro: {
    text: 'This site explains Medicare’s Hospital Readmissions Reduction Program and shows the {edition} penalty for every hospital in it. It is built entirely from public federal files and is meant for anyone: patients and families, reporters, and the hospital teams who work with these numbers every day.',
    claim: null,
  },
  aboutBy: {
    text: 'Built by Dalton Haslam, MD, MBA, a physician advisor, with Claude Code. It is an independent project, not affiliated with or endorsed by the Centers for Medicare & Medicaid Services. To report an error or suggest a change, use the {feedback}.',
    claim: null,
  },
  feedbackLink: { text: 'feedback form', claim: null },

  formulaHeading: { text: 'The formula', claim: null },
  formulaIntro: {
    text: 'For each of the {conditions} conditions with at least {minCases} cases, CMS compares the hospital’s excess readmission ratio with its peer group’s median. Each condition above the median contributes:',
    claim: ['HRRP-01', 'HRRP-02', 'HRRP-03', 'HRRP-04'],
  },
  formulaCut: { text: 'neutrality modifier × payment weight × (ratio − peer median)', claim: null },
  formulaBelow: { text: 'A condition at or below its peer group’s median adds nothing.', claim: 'HRRP-04' },
  formulaCap: {
    text: 'The contributions are added, capped at {cap}%, and subtracted from one to give the payment adjustment factor. This year the neutrality modifier is {nm}. The cut applies to every traditional-Medicare base inpatient payment the hospital receives from {pay}.',
    claim: ['HRRP-06', 'HRRP-09', 'HRRP-10'],
  },
  replicationAll: {
    text: 'Recomputing every hospital from the values CMS publishes, read at full precision from the Excel version of its file, reproduces its factor exactly for all {total} hospitals.',
    claim: null,
  },
  replicationSome: {
    text: 'Recomputing every hospital from the values CMS publishes, read at full precision from the Excel version of its file, reproduces its factor exactly for {exact} of {total} hospitals.',
    claim: null,
  },

  dollarsHeading: { text: 'Estimated dollars', claim: null },
  dollarsIntro: {
    text: 'CMS publishes each hospital’s percentage, not a dollar amount. This site estimates the base payments the cut applies to, then multiplies by the cut:',
    claim: null,
  },
  dollarsFormula: { text: 'cases × case-mix index × (labor amount × wage index + non-labor amount × cost-of-living adjustment)', claim: null },
  dollarsInputs: {
    text: 'Cases and case-mix index are each hospital’s transfer-adjusted traditional-Medicare figures from the {edition} IPPS impact file, which uses claims from two years earlier. The standardized amounts come from the final rule’s standardized-amount tables (correction notice), choosing the column that matches each hospital’s quality-reporting and EHR status as CMS flags it in the impact file.',
    claim: null,
  },

  dollarsTotals: {
    text: 'Across all hospitals this gives about {base} in base payments and {pen} in penalties. CMS’s own estimate of the penalties was {cms} ({source}). It is a ballpark, not a check of these figures.',
    claim: null,
  },
  cmsSourceLink: { text: 'CMS’s table', claim: null },
  historyNone: { text: 'none found', claim: null },
  cmsSourceNone: { text: 'source not listed', claim: null },
  accuracyHeading: { text: 'Accuracy', claim: null },
  accuracyText: {
    text: 'In {check} against hospitals’ {costFy} Medicare cost reports, {share} of estimates land within {band} after allowing for payment-rate growth from {costFy} to {fy}{small}.',
    claim: null,
  },
  accuracySmall: { text: ' ({share} for hospitals under {beds} beds)', claim: null },
  assumeHeading: { text: 'Assumptions', claim: null },
  assumeIntro: { text: 'Where the files leave a choice, this site makes one. Each choice and what it does to the estimate:', claim: null },
  assumeColA: { text: 'Assumption', claim: null },
  assumeColE: { text: 'Effect on the estimate', claim: null },
  assumeBase: { text: 'The penalty is the {edition} cut (one minus the adjustment factor) times the hospital’s base DRG payments.', claim: 'HRRP-21' },
  assumeBaseE: { text: 'This mirrors how CMS applies the cut; the cut itself is CMS’s exact value.', claim: null },
  assumeRates: { text: 'Payments are priced at {edition} rates.', claim: null },
  assumeRatesE: { text: 'They run about {drift} {direction} {costFy} cost reports, by design.', claim: null },
  assumeRatesENone: { text: 'Rates change from year to year, so older cost reports differ, by design.', claim: null },
  directionAbove: { text: 'above', claim: null },
  directionBelow: { text: 'below', claim: null },
  assumeVolume: { text: 'Medicare volume is taken from {volumeFy}.', claim: null },
  assumeVolumeE: { text: 'Off in proportion if a hospital’s {edition} volume differs.', claim: null },
  assumeFfs: { text: 'Traditional Medicare only.', claim: ['HRRP-06', 'HRRP-14'] },
  assumeFfsE: { text: 'Medicare Advantage stays enter the ratios, but the cut does not apply to them.', claim: null },
  assumeMdh: {
    text: 'The Medicare-dependent hospital-specific rate counts for {months} only, assuming that status ends {date}, as current law says ({hospitals}).',
    claim: ['HRRP-22', 'HRRP-25'],
  },
  assumeMdhE: { text: 'If Congress extends it, estimates for these hospitals run low, by up to about {max} for some.', claim: null },
  assumeMdhYear: {
    text: 'The Medicare-dependent hospital-specific rate counts for the whole year, because current law runs the program through {date} ({hospitals}).',
    claim: ['HRRP-22', 'HRRP-25'],
  },
  assumeMdhYearE: { text: 'No effect on the year’s estimate.', claim: null },
  assumeNtap: { text: 'New-technology add-on payments are left out.', claim: 'HRRP-21' },
  assumeNtapE: {
    text: 'The real cut includes them, so estimates run about {share} low overall, more for hospitals that use new technologies. CMS’s upper-bound estimate of these payments for {ntapFy} was about {total}.',
    claim: 'HRRP-07',
  },
  assumeParhm: { text: 'Pennsylvania Rural Health Model hospitals are shown as if paid per stay.', claim: 'HRRP-08' },
  assumeParhmE: {
    text: 'Medicare pays them a global budget until the model ends {date}, so {months} is lower confidence; they are paid per stay after that.',
    claim: 'HRRP-08',
  },
  assumeParhmYearE: {
    text: 'Medicare pays them a global budget until the model ends {date}, which makes the whole year lower confidence.',
    claim: 'HRRP-08',
  },
  assumeNew: { text: 'New hospitals use partial-year volume.', claim: null },
  assumeNewE: { text: 'Likely understated.', claim: null },
  assumeInactiveOne: { text: '{hospitals} that CMS lists as no longer active is still shown.', claim: null },
  assumeInactiveMany: { text: '{hospitals} that CMS lists as no longer active are still shown.', claim: null },
  assumeInactiveOneE: { text: 'CMS will not pay it under this ID, so any cut it has is unlikely to be collected.', claim: null },
  assumeInactiveManyE: { text: 'CMS will not pay them under these IDs, so any cut they have is unlikely to be collected.', claim: null },
  assumeNoEstOne: { text: '{hospitals} missing from the impact file gets no estimate.', claim: null },
  assumeNoEstMany: { text: '{hospitals} missing from the impact file get no estimate.', claim: null },
  assumeNoEstE: { text: 'Totals note the count instead of adding zero dollars.', claim: null },
  assumeClosing: {
    text: 'Teaching, low-income-patient, low-volume and outlier payments are left out because the cut does not apply to them.',
    claim: 'HRRP-24',
  },
  readHeading: { text: 'How to read a penalty', claim: null },
  readRelative: {
    text: 'It is relative. CMS sets each median over every hospital in the peer group, so about half of the hospitals measured on a condition sit above it, and most hospitals measured on several conditions get some cut.',
    claim: 'HRRP-04',
  },
  readSmall: { text: 'A condition with fewer than {minCases} cases does not count toward a hospital’s cut.', claim: 'HRRP-01' },
  readReadmission: {
    text: 'A readmission here is an unplanned return to a hospital within thirty days of discharge, for any reason. Not every readmission is preventable.',
    claim: 'HRRP-23',
  },
  readMa: {
    text: 'Medicare Advantage patients are in the ratios starting with {edition}, but the cut applies only to traditional Medicare payments.',
    claim: ['HRRP-14', 'HRRP-06'],
  },
  readWindow: { text: 'The data window is {window}, so the cut reflects care from roughly one to three years before it takes effect.', claim: null },

  figuresHeading: { text: 'Reading the figures', claim: null },
  figuresRoundedOne: {
    text: '{hospitals} comes in above a peer-group median on at least one condition yet takes no cut: the condition’s share of its Medicare payments is small enough that the reduction rounds to zero. The share cut by number of conditions measured counts it as not cut.',
    claim: 'HRRP-04',
  },
  figuresFlips: {
    text: 'What peer grouping changed: each condition’s flags are drawn again against one median over every hospital measured on it in this file, so only the grouping changes. CMS sets its peer medians itself, so the medians here differ slightly from any CMS would set, and the counts are approximate. Only flags move; no dollars are modeled for a world without peer groups.',
    claim: 'HRRP-05',
  },
  figuresWorth: {
    text: 'What {step} of ratio is worth: what each {step} over the peer median costs, modeled, as on each hospital’s page, as the hospital’s base payments × the condition’s payment weight × the neutrality modifier × {step}; a hospital under its median loses nothing from {step} more until it crosses it. A hospital already at the {cap}% cap loses nothing more, so it counts as {zero}; a condition with no payment weight in the file, or a hospital with no base payment, is left out{blank}.',
    claim: 'HRRP-09',
  },
  figuresWorthBlank: { text: ' ({blank} hospital-conditions in all)', claim: null },
  figuresBands: {
    text: 'Flagged by number of cases: a ratio is CMS’s predicted readmission rate over the rate expected at an average hospital with similar patients, not a raw rate, and the file gives no interval around it. The middle half shown is the spread of the hospitals observed in a band, not an interval; a band of fewer than {min} hospitals is left out.',
    claim: 'HRRP-15',
  },
  figuresEscapes: {
    text: 'Years cut: the counts are of today’s hospitals, so a hospital that has left the program is missing and the shares can run above CMS’s for a year. A year a hospital was not in the file is left out, never counted as not cut, which is why {inFile} hospitals were cut in every year they appear but {all} in all {years} years.',
    claim: null,
  },
  figuresRounded: {
    text: '{hospitals} come in above a peer-group median on at least one condition yet take no cut: the condition’s share of the hospital’s Medicare payments is small enough that the reduction rounds to zero. The share cut by number of conditions measured counts them as not cut.',
    claim: 'HRRP-04',
  },

  placesHeading: { text: 'Places', claim: null },
  placesGeocode: {
    text: 'Map dots come from each hospital’s street address, geocoded with the U.S. Census Bureau Geocoder ({address} hospitals). When an address does not match, or its point falls far outside the hospital’s county, the dot goes to the center of its ZIP code ({zip}) or, failing that, its county ({county}).',
    claim: null,
  },
  placesNone: { text: ' {none} have no dot.', claim: null },
  placesNoneOne: { text: ' {none} has no dot.', claim: null },
  placesText: {
    text: 'Metro areas are the core-based statistical area where each hospital sits, from the IPPS impact file. Regions and divisions follow the Census Bureau.',
    claim: null,
  },

  historyHeading: { text: 'History', claim: null },
  historyText: { text: 'Penalties for {first} through {last} come from CMS’s archived final-rule supplemental files.', claim: null },

  historyListed: {
    text: 'The history’s share penalized counts every hospital in each year’s file, except that for {first} through {last} it leaves out Maryland, Puerto Rico, and hospitals with no data for any condition, which those early files also listed.',
    claim: null,
  },
  historyTotals: {
    text: 'Annual dollar totals come from CMS, as a payment-rule estimate, or from KFF Health News reporting. The table gives each year’s total and its source.',
    claim: null,
  },
  historyTotalsSim: {
    text: 'Annual dollar totals come from CMS, as a payment-rule estimate or, for {simulated}, a later simulation of that year under the earlier method, or from KFF Health News reporting. The table gives each year’s total and its source.',
    claim: null,
  },
  historyColYear: { text: 'Fiscal year', claim: null },
  historyColTotal: { text: 'Estimated total', claim: null },
  historyColSource: { text: 'Source', claim: null },
  moreHeading: { text: 'Feedback, privacy and accessibility', claim: null },
  feedbackText: {
    text: 'The feedback link opens a Google Form, so Google sees what you send and your IP address. The link fills in only the site and the page you were on. Please leave out any patient information.',
    claim: null,
  },
  moreText: { text: 'How the family of sites handles privacy, including how visits are counted, is on the {privacy} page, and its accessibility standard is on the {accessibility} page.', claim: null },
  morePrivacy: { text: 'privacy', claim: null },
  moreAccessibility: { text: 'accessibility', claim: null },

  accessHeading: { text: 'Accessibility', claim: null },
  accessText: {
    text: 'Every chart has a text description, and its numbers are also in a table on the same page. Selecting individual dots or map areas needs a mouse or touch; the tables, search and links reach the same pages by keyboard.',
    claim: null,
  },
  pinsHeading: { text: 'Pinned files', claim: null },
  pinsText: {
    text: 'Every input is a public file or an extract of one, pinned byte for byte: the build reads only these copies. Each file’s size and the start of its checksum (a fingerprint of its exact bytes) are below.',
    claim: null,
  },
  pinColFile: { text: 'File', claim: null },
  pinColBytes: { text: 'Bytes', claim: null },
  pinColHash: { text: 'Checksum (start)', claim: null },
  pinColGot: { text: 'Retrieved', claim: null },
  reuseHeading: { text: 'Reuse', claim: null },
  reuseText: {
    text: 'This site’s text, charts and derived data may be reused with credit to Paid & Penalized (CC BY); its code is MIT-licensed. CMS’s data are U.S. government works. Every table with a download is a CSV file. In those files the CCN is plain text, so open its column as text in a spreadsheet to keep the leading zero; headers name their units; and a condition’s penalized column is blank when the hospital was not measured on it (fewer than {minCases} cases, or no ratio published).',
    claim: null,
  },
  reuseDictionary: { text: 'Every column of these files, and the files themselves, are on the {link} page.', claim: null },
  reuseDictionaryLink: { text: 'data dictionary', claim: null },
  sourcesHeading: { text: 'Sources', claim: null },
  sourceSupplemental: { text: 'CMS archived HRRP supplemental data files, {first} through {last}', claim: null },
  sourceRules: { text: 'Federal Register IPPS final rules, {span}', claim: null },

  glossaryHeading: { text: 'Glossary', claim: null },
  termPeer: { text: 'Peer group', claim: null },
  defPeer: {
    text: 'One of five groups of hospitals, sorted by the share of their patients who are dually eligible for Medicare and full Medicaid.',
    claim: 'HRRP-05',
  },
  termDual: { text: 'Dual-eligible', claim: null },
  defDual: { text: 'A person enrolled in both Medicare and full Medicaid benefits, a common marker of low income.', claim: null },
  termNeutrality: { text: 'Neutrality modifier', claim: null },
  defNeutrality: {
    text: 'A single factor, the same for every hospital in a year, that keeps total savings under peer grouping equal to what the earlier method with no peer groups would have produced.',
    claim: 'HRRP-10',
  },
  termFfs: { text: 'Traditional Medicare (FFS)', claim: null },
  defFfs: {
    text: 'Fee-for-service Medicare, paid directly by CMS. Medicare Advantage plans are private plans paid separately; the cut applies to the traditional payments.',
    claim: 'HRRP-06',
  },
  termCcn: { text: 'CCN', claim: null },
  defCcn: { text: 'CMS Certification Number, the six-digit ID CMS assigns each hospital.', claim: null },
  termReadmission: { text: 'Readmission', claim: null },
  defReadmission: { text: 'An unplanned return to a hospital within thirty days of discharge. Planned returns are not counted.', claim: 'HRRP-23' },
  termErr: { text: 'Excess readmission ratio (ERR)', claim: null },
  defErr: {
    text: 'A hospital’s predicted readmission rate for a condition divided by the rate expected at an average hospital with similar patients. Above one means more than expected.',
    claim: 'HRRP-15',
  },
  termWeight: { text: 'Payment weight (DRG payment ratio)', claim: null },
  defWeight: {
    text: 'The share of a hospital’s traditional Medicare base payments that come from stays for a given condition. Conditions that bring in more payments weigh more.',
    claim: 'HRRP-04',
  },
  termPaf: { text: 'Payment adjustment factor (PAF)', claim: null },
  defPaf: {
    text: 'What CMS multiplies each base payment by: one minus the reduction. A factor of exactly one means no cut, and the lowest it goes is the cap’s {floor}.',
    claim: 'HRRP-09',
  },
  termBase: { text: 'Base operating DRG payment', claim: null },
  defBase: {
    text: 'The standard Medicare inpatient payment for a stay, plus any new-technology add-on, before teaching, low-income-patient, low-volume and outlier payments. The cut applies only to this amount.',
    claim: ['HRRP-21', 'HRRP-24'],
  },
  termIpps: { text: 'IPPS', claim: null },
  defIpps: {
    text: 'The Inpatient Prospective Payment System, which sets Medicare payments to general acute-care hospitals each fiscal year. The hospitals it pays are the ones in the program.',
    claim: 'HRRP-11',
  },
  termTeach: { text: 'Teaching level', claim: null },
  defTeach: {
    text: 'Major teaching means a resident-to-bed ratio of {major} or more; minor teaching is any lower ratio above zero. The ratio comes from the IPPS impact file, which draws on Medicare cost reports.',
    claim: null,
  },
  termBeds: { text: 'Beds', claim: null },
  defBeds: {
    text: 'Certified beds from CMS’s Provider of Services file; for the few hospitals without one, the bed count from the Medicare cost report (in the IPPS impact file), marked “cost report”. Either can differ from licensed beds.',
    claim: null,
  },
  termCbsa: { text: 'Metro area (CBSA)', claim: null },
  defCbsa: { text: 'A core-based statistical area defined by the Office of Management and Budget: a city and the counties tied to it by commuting.', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, PROGRAM, SITE);
