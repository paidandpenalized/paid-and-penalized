"""G-3 line 24, "Other (specify)": each entry sorted by the hospital's own label into operating, non-operating or
unclassified income (DATA-B-03, decided 2026-11-05). Pure: the pipeline reads the rules file and the pinned entries.

Line 24 and its subscripts 24.01 to 24.49 each carry a label the hospital writes (HCRIS's alphanumeric file, worksheet
G300000, column 0) and an amount (the numeric file, column 1). Lines 24.50 to 24.60 are COVID-19 funding and are not
read here; they stay outside the operating margin, as decided. A label is matched against the rules in their order,
first match wins, after `normalize` (capitals, digits, single spaces). The rules are a reviewable CSV of
`family,class,pattern,why`: each pattern is a regular expression matched as whole words; each family has one class;
`why` is filled on the family's first row.

Classes: `operating` counts in the operating margin (physician and professional income, pharmacy income with 340B and
contract pharmacy among it, grant income, the kinds of income lines 8 to 22 already hold, and labels the hospital
itself calls operating, "other operating revenue" among them); `non_operating` stays out (investment-type income,
contributions, appropriations and taxes, relief funding, labels the hospital calls non-operating); `unclassified`
stays out too: a label too generic to sort ("other revenue", "miscellaneous income"), a blank one, or a named kind the
decision doesn't place (Medicaid supplemental payments, capitation, services sold, transfers from affiliates).
"""
import re
from collections import namedtuple
from decimal import Decimal

CLASSES = ("operating", "non_operating", "unclassified")
# The layer's column for each class: the sum of a report's line-24 entries in it (dollars, a flow).
METRICS = {"operating": "line24_operating", "non_operating": "line24_non_operating",
           "unclassified": "line24_unclassified"}
RULE_COLUMNS = ["family", "class", "pattern", "why"]
PIN_COLUMNS = ["rpt_rec_num", "line", "label", "amount"]
# HCRIS line codes are the line number times 100: line 24 is 02400, 24.49 is 02449.
FIRST_LINE, LAST_LINE = 2400, 2449
LINE = re.compile(r"\d{5}")
NUMBER = re.compile(r"-?(\d+(\.\d*)?|\.\d+)")
UNLABELED, NO_RULE = "unlabeled", "other"  # the families of a blank label and of a label no rule matches

Rule = namedtuple("Rule", "family cls pattern")


class RulesError(ValueError):
    """A rules file the classifier refuses."""


class TableError(ValueError):
    """A pinned line-24 table the layer refuses."""


def is_line24(line):
    """Whether a numeric or alphanumeric file's line code is line 24 or one of its subscripts 24.01 to 24.49."""
    return bool(LINE.fullmatch(line)) and FIRST_LINE <= int(line) <= LAST_LINE


def normalize(label):
    """A label as the rules read it: capitals, each run of other characters one space ("340(B) CONTRACT-PHARM" is
    "340 B CONTRACT PHARM")."""
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", label.upper()).split())


def parse_rules(rows):
    """The rules (a tuple of Rule) from the rules file's CSV rows, header first. Refuses a wrong header, a row of the
    wrong width, an unknown class, a family with two classes or with `why` other than on its first row only, and a
    pattern that is blank or doesn't compile."""
    rows = iter(rows)
    if next(rows, None) != RULE_COLUMNS:
        raise RulesError(f"rules: the header is not {','.join(RULE_COLUMNS)}")
    rules, class_of, seen = [], {}, set()
    for n, r in enumerate(rows, start=2):
        if len(r) != len(RULE_COLUMNS):
            raise RulesError(f"rules line {n}: {len(r)} fields, not {len(RULE_COLUMNS)} (quote a pattern with a comma)")
        family, cls, pattern, why = r
        if cls not in CLASSES:
            raise RulesError(f"rules line {n}: class {cls!r} is not one of {CLASSES}")
        if class_of.setdefault(family, cls) != cls:
            raise RulesError(f"rules line {n}: family {family} has two classes")
        if bool(why.strip()) == (family in seen):
            raise RulesError(f"rules line {n}: `why` goes on family {family}'s first row, and only there")
        seen.add(family)
        if not pattern.strip():
            raise RulesError(f"rules line {n}: a blank pattern")
        try:
            rules.append(Rule(family, cls, re.compile(rf"\b(?:{pattern})\b")))
        except re.error as err:
            raise RulesError(f"rules line {n}: pattern {pattern!r}: {err}") from None
    if {UNLABELED, NO_RULE} & set(class_of):
        raise RulesError(f"rules: {UNLABELED!r} and {NO_RULE!r} are the classifier's own families")
    return tuple(rules)


def classify(label, rules):
    """(family, class) for one label: the first rule that matches it; a blank label is ("unlabeled", "unclassified"),
    a label no rule matches ("other", "unclassified")."""
    text = normalize(label)
    if not text:
        return UNLABELED, "unclassified"
    for rule in rules:
        if rule.pattern.search(text):
            return rule.family, rule.cls
    return NO_RULE, "unclassified"


def from_pin_rows(rows):
    """[(report number, line, label, amount Decimal)] from the pinned line-24 table's rows (header first), held to its
    rules: the header, line codes 02400 to 02449, a number in every amount, each (report, line) once."""
    rows = iter(rows)
    if next(rows, None) != PIN_COLUMNS:
        raise TableError("line-24 table: the header is not the layer's columns")
    out, seen = [], set()
    for r in rows:
        if len(r) != len(PIN_COLUMNS):
            raise TableError(f"line-24 table: a row of {len(r)} fields, not {len(PIN_COLUMNS)}")
        rpt, line, label, amount = r
        if not rpt.isdigit() or not is_line24(line) or not NUMBER.fullmatch(amount) or (rpt, line) in seen:
            raise TableError(f"line-24 table: report {rpt!r} line {line!r}: a bad or repeated row")
        seen.add((rpt, line))
        out.append((rpt, line, label, Decimal(amount)))
    return out


def report_sums(entries, rules):
    """{report number: {METRICS column: Decimal}}: each report's line-24 amounts summed by class. A class with no
    entry is absent (blank in the layer: zero or not reported). Each distinct label is classified once."""
    out, metric_of = {}, {}
    for rpt, _, label, amount in entries:
        if label not in metric_of:
            metric_of[label] = METRICS[classify(label, rules)[1]]
        metric = metric_of[label]
        row = out.setdefault(rpt, {})
        row[metric] = row.get(metric, Decimal(0)) + amount
    return out
