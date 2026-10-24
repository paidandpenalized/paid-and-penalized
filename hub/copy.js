// The hub's words: the family's front page, the methods stub, the policy pages and the not-found page. No digit characters:
// numbers never live in copy files.
import { typesetCopy } from '../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  homeTitle: 'Paid & Penalized',
  tagline: 'Public Medicare data, made visible.',
  homeDescription: 'Plain-language explainers for Medicare hospital payment programs, built from public CMS data.',
  sitesHeading: 'Programs',

  methodsDescription: 'How this site turns CMS public data into its pages, and what it calls an estimate.',
  methodsIntro: "How this site works with CMS's public data.",
  estimateHeading: 'What “estimate” means here',
  estimateWhat: "A number labeled “estimate” applies CMS's published method to CMS's public data, in a case where an input CMS used is not public.",
  estimateHow: "The result is close to CMS's but not exact, and the page says how close: the largest difference this site found between its recomputation and the values CMS published.",
  estimateNot: "An estimate is never a made-up number, and it is never presented as CMS's own. CMS's published values are always shown as CMS published them.",

  // ---------- The policy pages (hub/policy.js, hub/corrections.js) ----------
  // Each page: a description, the "in brief" card's lines (*Brief1…), then its sections (*<Section>Heading and its
  // paragraphs); its title, and the Methods page's, is the footer's word for it (web/copy.js). {placeholders} are
  // links or values the page fills: {feedback} the feedback form, {email} the corrections address, {estimate}
  // /methods/#estimate, {corrections} /corrections/, {about} /about/, {linkedin} the byline's profile,
  // {cloudflarePolicy} and {googlePolicy} those companies' privacy pages, {contentLicense} and {codeLicense} from
  // web/site.js, {version} from hub/constants.js.
  briefTitle: 'In brief',
  indexLabel: 'On this page',
  feedbackForm: 'feedback form',
  estimateLink: 'estimate',
  linkedinLink: 'His profile is on LinkedIn',
  cloudflarePolicy: 'Cloudflare’s privacy policy',
  googlePolicy: 'Google’s privacy policy',

  // /terms/
  termsDescription: 'The plain-English terms for reading and reusing Paid & Penalized: what its numbers are, what they are not, and how to credit them.',
  termsBrief1: 'Free to read, and free to reuse with credit.',
  termsBrief2: 'Not affiliated with or endorsed by CMS, any hospital, health system or health plan.',
  termsBrief3: "CMS's values appear as CMS published them. This site's own calculations are labeled.",
  termsBrief4: 'Not medical, legal, financial or investment advice.',
  termsWhatHeading: 'What this site is',
  termsWhat: "Paid & Penalized explains Medicare's hospital payment programs with the public data CMS publishes. Each program's pages show what CMS decided for each hospital, how CMS's formula got there and, as an estimate, what the decision is worth in dollars.",
  termsAffiliationHeading: 'Independent',
  termsAffiliation: 'Paid & Penalized is not affiliated with or endorsed by the Centers for Medicare & Medicaid Services (CMS), the Department of Health and Human Services, or any hospital, health system or health plan.',
  termsNumbersHeading: 'What the numbers are',
  termsNumbers: "Where CMS publishes a value, these pages show it as CMS published it. Where this site recomputes CMS's arithmetic, or estimates something CMS doesn't publish, the page says so, and its Methods page shows how.",
  termsEstimate: "An {estimate} applies CMS's published method to public data when an input CMS used isn't public. It comes close to CMS's figure, and the page says how close.",
  termsAdviceHeading: 'What the numbers are not',
  termsAdvice: "Nothing here is medical, legal, financial or investment advice. A hospital's result in a CMS program comes from CMS's formula applied to the data hospitals report to CMS. It is not a quality grade, and it says nothing about any one patient's care. Don't use these pages on their own to choose a hospital or a treatment.",
  termsAsOfHeading: 'How current it is',
  termsAsOf: "Every page names the CMS file it uses and when CMS released it. CMS revises and replaces its files. When it does, this site is updated and its corrections log says so, or the site shows a notice that it hasn't been updated yet. Before relying on a number for a decision, check it against CMS's own release.",
  termsReuseHeading: 'Reusing this work',
  termsReuse: "This site's text, charts and derived data are licensed under {contentLicense}: reuse them, commercially or not, with credit to Paid & Penalized and a link to the page. The code is under the {codeLicense} license. CMS's data are works of the U.S. government. The typefaces are under the SIL Open Font License.",
  termsWarrantyHeading: 'No warranty',
  termsWarranty: 'The site is offered as is, without warranty of any kind. Its author is not responsible for decisions made with it.',
  termsContactHeading: 'Questions',
  termsContact: 'Send questions through the {feedback}. To report an error, see {corrections}.',

  // /privacy/
  privacyDescription: 'What Paid & Penalized, and the services it uses, can see when you read it or send feedback.',
  privacyBrief1: 'No cookies, no accounts, no ads.',
  privacyBrief2: 'The host sees IP addresses, as every web host does.',
  privacyBrief3: 'Visits are counted without cookies.',
  privacyBrief4: 'Searches stay in your browser.',
  privacyBrief5: 'Feedback goes through a Google Form. Leave out patient information.',
  privacyReadingHeading: 'When you read the site',
  privacyReading: "The site is a set of static pages. It sets no cookies, has no accounts and shows no ads. Cloudflare hosts it, and like any web host it receives your IP address, your browser's details and the addresses of the pages you open, which it keeps in its logs under {cloudflarePolicy}.",
  privacyCountingHeading: 'Counting visits',
  privacyCounting: 'This site uses Cloudflare Web Analytics to count page views. It sets no cookies. The counts show which pages are read, not who read them.',
  privacySearchHeading: 'Searching and sharing',
  privacySearch: "The hospital search downloads a list of hospitals and searches it in your browser. What you type isn't sent anywhere. A what-if you share is stored in the link after its # sign, a part of the address browsers don't send to servers.",
  privacyFeedbackHeading: 'Sending feedback',
  privacyFeedback: "The feedback link opens a Google Form owned by the project's Google account. Google receives what you submit, along with your IP address, under {googlePolicy}. The form doesn't collect email addresses and doesn't ask you to sign in.",
  privacyFeedback2: "The site and page you came from are filled in for you; you can change or clear them. One optional question asks how to reach you, if you'd like a reply, and another asks which role best describes you. Answers go to a private spreadsheet that only Dalton Haslam reads.",
  privacyPhiHeading: 'Leave out patient information',
  privacyPhi: "Don't include any patient information in feedback: no names, dates of birth, record numbers or details about anyone's care.",
  privacyLinksHeading: 'Other sites',
  privacyLinks: 'Links to CMS, LinkedIn and other sites take you off Paid & Penalized. Their own privacy policies apply there.',

  // /corrections/
  correctionsDescription: 'How Paid & Penalized handles errors, and every correction made to its sites, with dates.',
  correctionsBrief1: 'Errors are fixed, and each fix is logged here with its date.',
  correctionsBrief2: "Disagreeing with CMS's method is not an error on this site.",
  correctionsBrief3: 'When CMS revises its data, the site follows and says so.',
  correctionsBrief4: 'One person runs this project, and every report is read.',
  correctionsReportHeading: 'Reporting an error',
  correctionsReport: 'Use the {feedback} and choose “Something looks wrong,” or write to {email}. Say which page, which number or sentence, and what you think it should be. A link to the CMS file or rule behind your point helps most.',
  correctionsCountsHeading: 'What counts as an error',
  correctionsCounts: "A number that doesn't match CMS's file, a calculation done wrong, or a sentence its source doesn't support. Disagreeing with how CMS designed a program is a different matter: these pages explain CMS's method, and CMS sets it. CMS takes public comments on its payment rules each year.",
  correctionsHospitalHeading: "A hospital's own data",
  correctionsHospital: "If a hospital's data in CMS's file is wrong, the fix happens at CMS. Hospitals review their data with CMS before CMS publishes it, and this site can't change CMS's values; it shows what CMS published.",
  correctionsProcessHeading: 'What happens to a report',
  correctionsProcess: 'Each report is checked against the CMS source. If the site is wrong, the page is fixed and an entry goes in the log below: what changed, when, and which pages and numbers it affects. Numbers are not changed quietly, and a mistake in an entry is fixed with a new entry.',
  correctionsProcess2: "Paid & Penalized is one person's project, built in his own time, so there is no set time for a reply or a fix.",
  correctionsCmsHeading: 'When CMS revises its data',
  correctionsCms: "When CMS revises or replaces a file a site uses, the site is updated and the log says so. Until then, the site's pages show a notice that it hasn't been updated for the new release.",
  correctionsSitesHeading: "Each site's data",
  correctionsSite: "{site}: CMS's file released {cms}; this site's numbers last changed {changed}.",
  correctionsLogHeading: 'The log',
  correctionsLogEmpty: 'No corrections yet.',

  // /about/
  aboutDescription: 'Who builds Paid & Penalized, how it is paid for, and how it uses AI tools.',
  aboutBrief1: 'Built by Dalton Haslam, MD, MBA, a physician advisor.',
  aboutBrief2: 'Independent: no funding, no ads, no sponsors.',
  aboutBrief3: "Every number comes from CMS's public data and is checked against CMS.",
  aboutBrief4: 'AI tools help write the code and draft the text. A person reviews every sentence.',
  aboutWhatHeading: 'What this is',
  aboutWhat: "Paid & Penalized explains how Medicare's payment programs reward, penalize and adjust what hospitals are paid, one program at a time, from the data CMS publishes. Each site reproduces CMS's published results, shows the arithmetic, and lets you look up any hospital.",
  aboutWhoHeading: 'Who builds it',
  aboutWho: 'Dalton Haslam, MD, MBA, builds and maintains it in his own time. {linkedin}.',
  aboutCoiHeading: 'Conflicts of interest',
  aboutCoi: 'Dalton is a physician advisor employed by a hospital system. Hospitals where he works or has worked may appear on these sites. He receives no funding or compensation for this project and pays its costs himself. It carries no ads and has no sponsors.',
  aboutAiHeading: 'How AI tools are used',
  aboutAi: "AI tools help write this site's code and draft its text. Every number comes from deterministic, published code run on CMS's public data, and is checked against CMS's published values wherever CMS publishes them. Dalton reviews every sentence before it is published.",
  aboutContactHeading: 'Contact',
  aboutContact: 'Send questions, ideas or problems through the {feedback}.',

  // /accessibility/
  a11yDescription: 'The accessibility standard Paid & Penalized aims for, how it is tested, the gaps it knows of, and how to report a problem.',
  a11yBrief1: 'Aims for WCAG {version} at level AA.',
  a11yBrief2: 'Every chart has a table with the same numbers.',
  a11yBrief3: "Works with a keyboard alone, and follows your system's dark mode, high-contrast and reduced-motion settings.",
  a11yBrief4: 'Checked automatically each time the site changes. Known gaps are listed below.',
  a11yTargetHeading: 'The standard',
  a11yTarget: "This site aims to meet the Web Content Accessibility Guidelines (WCAG) {version} at level AA. It doesn't claim full conformance; the gaps it knows of are listed below.",
  a11yBuiltHeading: "What's built in",
  a11yBuilt: "Every chart has a text summary and a table of its numbers that you can show and sort. Pages work with a keyboard alone, and they follow your system's dark mode, high-contrast and reduced-motion settings.",
  a11yTestedHeading: 'How it is tested',
  a11yTested: "Automated checks (axe) run on every kind of page, in light and dark themes, at desktop and phone widths, each time the site changes. Keyboard paths are tested in Chrome. Before each launch the pages are also checked in Firefox and in Safari's engine.",
  a11yGapsHeading: 'Known gaps',
  a11yGap1: "The details that appear when you point at a chart's marks need a mouse or touch. Each chart's table holds the same numbers.",
  a11yBrowsersHeading: 'Browsers',
  a11yBrowsers: "Current versions of Chrome, Edge, Firefox and Safari. Internet Explorer, and Edge's Internet Explorer mode, are not supported.",
  a11yReportHeading: 'Reporting a problem',
  a11yReport: "If something here doesn't work with the way you browse, say so through the {feedback}: the page, what you were doing, and what you use (browser, screen reader, zoom).",

  // /methods/: the AI paragraph moved to /about/.
  methodsAiPointer: 'How this site uses AI tools is on the {about} page.',

  notFoundTitle: 'Page not found',
  notFoundBody: 'There is no page at this address.',
  notFoundHome: 'Go to the home page',
});
