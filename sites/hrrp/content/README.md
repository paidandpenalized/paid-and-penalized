# HRRP site content

Three files copied unedited from Thirty Day Readmissions (`pipeline/content/<file>` at commit `33d1959`, MIT license).

- `research.json`: the short list of published research on the Hospital Readmissions Reduction Program that the explainer cites.
- `timeline.json`: the program's dated milestones, from the law to the current rule year.
- `whats_new.json`: the plain-language notes on what changed this fiscal year (`fy` names the year). Its `items` match `meta.whatsNew` in the pinned Thirty Day Readmissions output (`data/pinned/tdr/hrrp.json`), and a test checks that.

Their statements go through the site's claims register (`sites/hrrp/CLAIMS.md`, written with the pages) before a page prints them.
