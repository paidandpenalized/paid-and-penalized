# HRRP site content

Three files copied from Thirty Day Readmissions (`pipeline/content/<file>` at commit `33d1959`, MIT license).

- `research.json`: the short list of published research on the Hospital Readmissions Reduction Program that the explainer cites.
- `timeline.json`: the program's dated milestones, from the law to the current rule year.
- `whats_new.json`: the plain-language notes on what changed this fiscal year (`fy` names the year). Its `items` are `meta.whatsNew` in the pinned Thirty Day Readmissions output (`data/pinned/tdr/hrrp.json`) less its note about a later year ("Coming in FY2030"): the site prints no sentence that promises a date to come, and the sources disagree on that year. `skipped` lists the pinned titles left out; an item that rewords a pinned one names it in `pin`. A test checks the match. The program page shows these notes only in the edition whose year `fy` names.

Their statements go through the site's claims register (`sites/hrrp/CLAIMS.md`, written with the pages) before a page prints them.
