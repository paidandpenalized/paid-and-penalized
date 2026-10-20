# Methods log

One heading per site methods version. A change that moves a site's emitted numbers for any reason other than
a new CMS release bumps that site's `methods_version` and adds an entry here (or a dated entry under
`corrections/`). CI checks both.

## hacrp methods_version 1 (2026-10-20)
- `data/emitted/hacrp/fy2026/hacrp.json` holds CMS's published FY2026 values for every hospital in the file,
  unchanged: numbers parsed from CMS's text, the text itself kept verbatim.
- It adds the model the what-if and solver use (measure parameters fit from CMS's own value and z pairs; the
  line between CMS's No and Yes decisions) and the per-measure estimate tag.
