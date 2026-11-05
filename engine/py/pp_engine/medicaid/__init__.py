"""Medicaid work-requirement exposure: a published state scenario applied to each hospital's own cost-report figures.

Pure functions only (no file, network or clock access): `params` holds the method's named constants, `shares` the
expansion (VIII) group's share of each state's Medicaid spending from CMS-64 rows, `exposure` the per-hospital
steps, and `rollup` the state and national sums. Every hospital number this package makes is scenario times a
measured base, never an estimate of a hospital's actual loss.
"""
