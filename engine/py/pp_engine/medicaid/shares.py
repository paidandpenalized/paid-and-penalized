"""The expansion (VIII) group's share of each state's Medicaid spending, from CMS-64 quarterly rows.

Input: data.medicaid.gov's "Medicaid CMS-64 New Adult Group Expenditures" rows (one per state and quarter), as dicts
keyed by the file's column names. Both the numerator (VIII group, total computable) and the denominator (all medical
assistance, total computable) come from the same row, so they share a vintage. States report by date of payment,
not date of service, and revise earlier quarters for about two years.
"""
import datetime
import re
from collections import namedtuple

STATE = "State"
QUARTER_END = "Quarter End Date"
TOTAL = "Total Computable All Medical Assistance Expenditures"
VIII = "Total Computable VIII Group Expenditures"

NOT_APPLICABLE = "N/A"  # the file's mark for a state (or quarter) without a VIII group
AMOUNT = re.compile(r"-?\d+(\.\d+)?")
DATE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")

# `basis`: `ffy<YYYY>` when all four quarters of the base federal fiscal year carry VIII spending; `latest4` when the
# state adopted the group during or after that year, so the four newest quarters stand in (a first partial year
# understates a new group's steady-state share).
Share = namedtuple("Share", "share viii total basis first last")


class SharesError(ValueError):
    """A CMS-64 row that can't be read as documented."""


def amount(text):
    """A dollar cell as a float: thousands separators and padding dropped; None for N/A or blank."""
    t = (text or "").strip().replace(",", "")
    if t in ("", NOT_APPLICABLE):
        return None
    if not AMOUNT.fullmatch(t):
        raise SharesError(f"CMS-64: unreadable amount {text!r}")
    return float(t)


def quarter_end(text):
    m = DATE.fullmatch((text or "").strip())
    if not m:
        raise SharesError(f"CMS-64: unreadable quarter end date {text!r}")
    month, day, year = (int(g) for g in m.groups())
    return datetime.date(year, month, day)


def federal_fy(day):
    """The federal fiscal year a date falls in (October through September)."""
    return day.year + 1 if day.month >= 10 else day.year


def fy_quarter_ends(fy):
    """The four quarter-end dates of a federal fiscal year, in order."""
    return (datetime.date(fy - 1, 12, 31), datetime.date(fy, 3, 31), datetime.date(fy, 6, 30), datetime.date(fy, 9, 30))


def by_state(rows):
    """{state name: {quarter end: (all medical assistance, VIII group or None)}}. A repeated state-quarter fails."""
    out = {}
    for r in rows:
        state, q = r[STATE].strip(), quarter_end(r[QUARTER_END])
        quarters = out.setdefault(state, {})
        if q in quarters:
            raise SharesError(f"CMS-64: {state} {q} appears twice")
        total = amount(r[TOTAL])
        if total is None:
            raise SharesError(f"CMS-64: {state} {q} has no all-medical-assistance total")
        quarters[q] = (total, amount(r[VIII]))
    return out


def _share(quarters, ends, basis):
    total = sum(quarters[q][0] for q in ends)
    viii = sum(quarters[q][1] for q in ends)
    if total <= 0:
        raise SharesError(f"CMS-64: total spending {total} over {ends[0]}..{ends[-1]}")
    return Share(viii / total, viii, total, basis, ends[0].isoformat(), ends[-1].isoformat())


def state_share(quarters, fy):
    """One state's Share for federal fiscal year `fy`, from its {quarter end: (total, viii)}; None when the state
    reports no VIII group at all (it did not expand). A state whose group starts during or after `fy` gets the four
    newest quarters with VIII spending (basis `latest4`)."""
    ends = fy_quarter_ends(fy)
    if all(q in quarters and quarters[q][1] is not None for q in ends):
        return _share(quarters, ends, f"ffy{fy}")
    reported = sorted(q for q, (_, viii) in quarters.items() if viii is not None)
    if not reported:
        return None
    latest = reported[-4:]
    if len(latest) < 4:
        raise SharesError(f"CMS-64: fewer than four quarters of VIII spending (newest {latest[-1]})")
    return _share(quarters, tuple(latest), "latest4")


def state_shares(rows, fy):
    """{state name: Share or None} for every state in the rows."""
    return {state: state_share(qs, fy) for state, qs in by_state(rows).items()}
