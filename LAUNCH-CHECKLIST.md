# Launch checklist

Run for every site launch. Copy the last column for the next launch, then tick its boxes as each item passes.

- **Tier 1** items protect readers, the hospitals the site names, and the site itself. A launch waits on every one.
- **Tier 2** items are reach and polish. They may follow the launch.

Anything that makes something public happens only on the owner's OK, one step at a time: a merge to `main` (it
deploys), the release flag, a change to the domain, making a repository public, a release tag, an announcement.

## The checklist

| # | Item | Tier | Work requirement | TEAM |
|---|---|---|---|---|
| | **Data and method** | | | |
| 1 | `make test` passes. Every value CMS publishes is reproduced exactly; a scenario's two engines (JavaScript and Python) agree, and its cases stay in order at every setting. | 1 | [ ] | [ ] |
| 2 | `data/emitted/` equals a fresh build from `data/pinned/`. Every new source is in `manifest.json` with its SHA-256, in `DATA-TERMS.md` with its terms and the date they were checked, and, if it is not a U.S. government work, in `NOTICE`. | 1 | [ ] | [ ] |
| 3 | Methods page: every step, parameter, limit and source. Each page closes on its sources' dates. | 1 | [ ] | [ ] |
| 4 | Claims register: each sentence that states a fact about the law or a program has a checked row with a quotation and a date. No row is marked unverified. | 1 | [ ] | [ ] |
| 5 | Labels follow `EDITORIAL-STANDARDS.md`: every number's kind is marked (scenario, measured, estimate, recomputed), and, on the pages that rule covers, every chart's caption says "all-payer" or "Medicare". | 1 | [ ] | [ ] |
| | **Words and named hospitals** | | | |
| 6 | A read of every new page's words against `EDITORIAL-STANDARDS.md`: named hospitals, neutral verbs, ranges, no promised reply, fix time or date. The house word test passes. | 1 | [ ] | [ ] |
| 7 | Default views, on the pages the named-hospital rules cover: no top or worst list of hospitals; a named table is sorted by share and collapsed; a hospital shown to explain the method is picked at random. | 1 | [ ] | [ ] |
| 8 | A hospital or state with no number shows its reason: no $0, no NaN, no empty bar, and no link to a page that doesn't exist. | 1 | [ ] | [ ] |
| 9 | Every page carries the not-affiliated line, the Terms line, the feedback link (its form warns against patient information), and the corrections page in the footer. | 1 | [ ] | [ ] |
| 10 | No new third-party request: fonts self-hosted, the security policy (CSP) unchanged or reviewed, no analytics beyond what the privacy page describes. | 1 | [ ] | [ ] |
| | **Build and browsers** | | | |
| 11 | CI green on the pull request: tests, page-weight budgets, the link check over the whole built site, the browser checks, the secrets scan. | 1 | [ ] | [ ] |
| 12 | The launch command (`npm run e2e:launch`) on a preview: every response header matches `dist/_headers`, and the browser checks pass in Chromium, Firefox and WebKit. | 1 | [ ] | [ ] |
| 13 | Accessibility: axe on every new page type in both themes at desktop and phone widths; one pass with the keyboard alone; one with scripts off. | 1 | [ ] | [ ] |
| 14 | By hand: every control clicked at laptop and phone widths, and once on a real phone. | 1 | [ ] | [ ] |
| 15 | Previews and unreleased sites are `noindex` and out of the sitemap. | 1 | [ ] | [ ] |
| 16 | The domain loads from a hospital network without a web-filter block (once per domain; again if it changes). | 1 | [ ] | [ ] |
| 17 | Before anything is pushed: the secrets scan and the private names check over the full history. | 1 | [ ] | [ ] |
| | **Release** | | | |
| 18 | Merge to `main`, on the owner's OK. | 1 | [ ] | [ ] |
| 19 | Release: `released: true` for the site in `web/site.js`, so its pages drop `noindex`, the sitemap lists them and `_headers` stops marking its data files `noindex`, on the owner's OK. | 1 | [ ] | [ ] |
| 20 | The live site serves the new build (a new hashed asset is live), then the launch command runs against it. | 1 | [ ] | [ ] |
| 21 | The uptime monitor watches the new site's page. | 1 | [ ] | [ ] |
| 22 | Rollback written down in one line: revert the release commit and redeploy. | 1 | [ ] | [ ] |
| | **Reach and polish** | | | |
| 23 | Share card (link-preview image) and page title checked in a link preview. | 2 | [ ] | [ ] |
| 24 | A speed run (Lighthouse) on the live page. | 2 | [ ] | [ ] |
| 25 | Print preview of any new hospital-page part. | 2 | [ ] | [ ] |
| 26 | The sitemap submitted to search engines. | 2 | [ ] | [ ] |
| 27 | A release tag, on the owner's OK. | 2 | [ ] | [ ] |
| 28 | Sites on contested policy: an outside expert's read is sought. It doesn't gate the launch, and no page says a review happened until one has. | 2 | [ ] | [ ] |
| 29 | Announcement drafted; the owner posts it. | 2 | [ ] | [ ] |
| 30 | The next data dates noted (when each source is due to be posted again), each on the owner's calendar. | 2 | [ ] | [ ] |

## This launch: the work requirement

Three pull requests, each merged on the owner's OK. PR 2 and PR 3 merge together.

- [ ] **PR 1, the HCRIS layer:** the Medicare cost-report data and its reader.
- [ ] **PR 2, the Medicaid data, the site and the band:** the scenario data, the work-requirement pages
      (`/work-requirement/` and its Methods page) and the band on each hospital's page, still `released: false`.
- [ ] **PR 3, the release flip:** `released: true`, the sitemap and `_headers`.

The cases to try by hand before PR 2 merges (items 8, 12 to 14):

- [ ] A hospital with no scenario (Maryland, a state that did not expand Medicaid, a state with no expansion group
      reported, or no cost report), picked by Find, by `?h=`, at random and by a click in a figure: its reason and its
      record card, no number.
- [ ] A critical access hospital with no page of its own: no link to one, from the site or the band.
- [ ] The use rate at both ends under each case: totals stay in order (low, middle, high).
- [ ] Scripts off: every step's figure drawn, the middle case shown, the controls hidden.
- [ ] Dark mode: the dots for the selected and the page's hospital stand out against the paper (3:1 or more).
