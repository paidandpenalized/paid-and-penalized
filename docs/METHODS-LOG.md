# Methods log

One heading per site methods version. A change that moves a site's emitted numbers for any reason other than
new source data bumps that site's `methods_version` and adds its heading here; a fix of an error gets a dated
entry under `corrections/` instead. CI's change gate looks for one of these (or a re-pin) whenever emitted data
changes, and a test requires the newest heading to match the emitted `methods_version`.

## hacrp methods_version 1 (2026-10-20)
- `data/emitted/hacrp/fy2026/hacrp.json` holds CMS's published FY2026 values for every hospital in the file,
  unchanged: numbers parsed from CMS's text, the text itself kept verbatim.
- It adds the model the what-if and solver use (measure parameters fit from CMS's own value and z pairs; the
  line between CMS's No and Yes decisions) and the per-measure estimate tag.

## hacrp methods_version 2 (2026-10-20)
- No number changes. `source_manifest` now hashes only each pinned input's id and SHA-256, so fixing a
  manifest entry's dates, title or URLs no longer changes the emitted file.

## hospital methods_version 1 (2026-10-20)
- `data/emitted/hospital/fy2027/hospital_master.json` holds one record per CCN listed in Care Compare's Hospital
  General Information, the FY2027 IPPS impact file, or a program file (HACRP FY2026; HRRP FY2027 from Thirty Day
  Readmissions). `fy` is the impact file's year. Name, address, ownership and kind come from Care Compare first,
  then the impact file and the Provider of Services file; IPPS statuses (MDH, SCH, RRC, EACH, IHS), teaching level
  and urban/rural from the impact file; certified beds from Provider of Services, else the impact file's beds.
- Each program gets `inProgram` (CMS's file for that year lists the CCN) and, when not, the first reason that
  applies: a hospital kind not paid under IPPS (`critical_access`, `psychiatric`, `childrens`, `long_term`,
  `rural_emergency`, `federal` for VA and Defense hospitals), `maryland`, `inactive` (Provider of Services shows
  Medicare participation ended), else `not_listed` (CMS's file leaves it out without saying why).
- No location fields yet (coordinates, county, CBSA, region); they come in methods_version 2.
