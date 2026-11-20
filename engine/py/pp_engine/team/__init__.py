"""TEAM, the Transforming Episode Accountability Model (42 CFR 512 subpart E, §§ 512.500-598): Medicare's mandatory
episode-payment model for five surgical episode categories.

Pure functions only (no file, network or clock access): `episodes` turns public Medicare inpatient counts and CMS's
preliminary target prices into each participant's episode estimate and target amount, `quality` ranks public quality
values as percentiles, `status` says for every hospital whether it is in TEAM and, if not, the first rule that explains
why, and `build` assembles the emitted file's body. Every count here is an inpatient-only floor from public files, not
CMS's own episode attribution.
"""
