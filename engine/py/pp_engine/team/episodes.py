"""Episode estimates and target amounts from public files.

A participant's episodes per category are its Medicare fee-for-service inpatient discharges under the category's
MS-DRGs, from CMS's Medicare Inpatient Hospitals by Provider and Service file. Each category's price is the
episode-weighted mean of CMS's preliminary target prices for those DRGs in the hospital's census division, and the
target amount is episodes times price, summed. These are estimates: the file omits any hospital-DRG cell under 11
discharges, has no outpatient cases (TEAM also covers outpatient joint replacement and spinal fusion), and counts
discharges, not CMS's attributed episodes.

Every float sum is math.fsum, which is correctly rounded on every Python version: the builtin sum() compensates
float rounding from Python 3.12 on and adds left to right before it, and half-episode counts put products on half
cents, where those last bits move a rounded target by a cent.
"""
from collections import defaultdict
from math import fsum

# Display order of the five episode categories (the price pin's codes).
CATEGORIES = ("LEJR", "SHFFT", "SPINAL", "CABG", "BOWEL")

# MS-DRGs the data years count cases under that the FY2027 grouper no longer has, each mapped to its FY2027
# successor DRG(s) with the share of cases sent there. The public file has no procedure codes, so these are
# DRG-level allocations, not CMS's exact regrouping.
REMAPS = {
    # FY2025 IPPS rule: combined anterior/posterior spinal fusion (453-455) folded into 426-428. Some of those
    # cases went to 402 or 429-430 instead, which the public file cannot split.
    "453": {"426": 1}, "454": {"427": 1}, "455": {"428": 1},
    # FY2027 IPPS rule: spinal fusion with curvature, malignancy or infection, or extensive fusion (456-458),
    # reassigned to the new DRGs 523-525.
    "456": {"523": 1}, "457": {"524": 1}, "458": {"525": 1},
    # FY2025 IPPS rule: the remaining spinal fusions (459-460) split between multi-level (447-448) and single-level
    # (450-451) fusion by procedure code; the public file has none, so an even split is assumed.
    "459": {"447": 0.5, "450": 0.5}, "460": {"448": 0.5, "451": 0.5},
}
# FY2027 DRGs created by the FY2027 rule: no data year counts cases under them, so their cells are not "hidden".
NEW_DRGS = frozenset({"523", "524", "525"})

# § 512.550(c)(9): a category with fewer than 31 episodes in the 3-year baseline period is low volume (its spending is
# capped at the target price). The public file has two data years, so their sum is scaled by 3/2 to stand in for
# three baseline years.
LOW_VOLUME_THRESHOLD = 31
BASELINE_SCALE = 1.5

PRICE_PLACES = 2  # target prices to the cent
CATEGORY_PRICE_PLACES = 6  # a weighted mean, kept fine enough that n x price sums to the target within a cent


def price_tables(rows):
    """(prices {drg: {division: price}}, category averages {category: {division: price}}, {drg: category}, derived)
    from the price pin's rows. CMS's per-division category-average rows (average_row 1) are the averages; a category
    without them gets the plain mean of its DRG prices in each division and is listed in `derived` (sorted)."""
    prices, avg, drg_category = defaultdict(dict), defaultdict(dict), {}
    for r in rows:
        price = round(float(r["price"]), PRICE_PLACES)
        if r["average_row"] == "1":
            avg[r["category"]][r["division"]] = price
            continue
        if drg_category.setdefault(r["drg"], r["category"]) != r["category"]:
            raise ValueError("price pin: a DRG sits in two categories")
        prices[r["drg"]][r["division"]] = price
    derived = sorted(set(drg_category.values()) - set(avg))
    for cat in derived:
        by_div = defaultdict(list)
        for drg, c in drg_category.items():
            if c == cat:
                for div, p in prices[drg].items():
                    by_div[div].append(p)
        avg[cat] = {div: round(fsum(ps) / len(ps), PRICE_PLACES) for div, ps in sorted(by_div.items())}
    return dict(prices), dict(avg), drg_category, derived


def source_drgs(drg_category):
    """{category: the DRGs a data year counts the category's cases under}: its FY2027 DRGs that existed before FY2027,
    plus the retired DRGs REMAPS sends into it."""
    out = defaultdict(set)
    for drg, cat in drg_category.items():
        if drg not in NEW_DRGS:
            out[cat].add(drg)
    for old, targets in REMAPS.items():
        cats = {drg_category[t] for t in targets if t in drg_category}
        for cat in cats:
            out[cat].add(old)
    return {cat: tuple(sorted(drgs)) for cat, drgs in out.items()}


def allocate(cells, drg_category):
    """{category: {FY2027 DRG: episodes}} from one hospital's {drg: discharges} in a data year: direct DRGs as they
    are, retired ones through REMAPS (fractional where a split is assumed). DRGs outside TEAM are ignored."""
    out = defaultdict(lambda: defaultdict(list))
    for drg, n in cells.items():
        for target, share in (REMAPS.get(drg) or {drg: 1}).items():
            cat = drg_category.get(target)
            if cat is not None:
                out[cat][target].append(n * share)
    return {cat: {d: _number(fsum(parts)) for d, parts in alloc.items()} for cat, alloc in out.items()}


def _number(x):
    """An episode count: whole counts as int, split ones (x.5) as float."""
    return int(x) if float(x).is_integer() else x


def episode_count(alloc):
    return _number(fsum(alloc.values()))


def hidden_cells(cells, sources):
    """{category: how many of its source DRG cells are absent from the file} (each absent cell is 0 to 10
    discharges)."""
    return {cat: sum(1 for d in drgs if d not in cells) for cat, drgs in sources.items()}


def is_low_volume(n_prior, n_latest):
    """§ 512.550(c)(9), approximated: the two data years' episodes, scaled to three years, under the threshold."""
    return (n_prior + n_latest) * BASELINE_SCALE < LOW_VOLUME_THRESHOLD


def category_price(alloc, prices, division, average):
    """The episode-weighted mean of the division's DRG prices over `alloc` ({drg: episodes}); `average` (the category
    average) when there are no episodes."""
    n = fsum(alloc.values())
    if not n:
        return average
    return round(fsum(k * prices[d][division] for d, k in alloc.items()) / n, CATEGORY_PRICE_PLACES)


def target_amount(allocs, prices, division):
    """Σ episodes x price over every category's DRGs ({category: {drg: episodes}}), to the cent."""
    return round(fsum(k * prices[d][division] for alloc in allocs.values() for d, k in alloc.items()), PRICE_PLACES)
