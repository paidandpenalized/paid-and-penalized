"""make refresh's golden diff, on synthetic emitted files (invented CCNs)."""
import unittest

from pp_pipeline import golden_diff as gd

ENVELOPE = {"schema_version": 1, "methods_version": 2, "source_manifest": "a" * 64, "sources": ["x"],
            "built_at": "2026-10-20T00:00:00Z", "fy": 2026}


def emitted(hospitals, **extra):
    return {**ENVELOPE, "model": {"boundary": 0.3}, "hospitals": hospitals, **extra}


H1 = {"ccn": "990001", "total": 0.1, "paymentReduction": "No"}
H2 = {"ccn": "990002", "total": 0.9, "paymentReduction": "Yes"}


class DiffFile(unittest.TestCase):
    def test_built_at_alone_is_no_change(self):
        later = {**emitted([H1, H2]), "built_at": "2027-01-01T00:00:00Z"}
        self.assertEqual(gd.diff_file(emitted([H1, H2]), later)["status"], "unchanged")

    def test_records_are_matched_by_ccn_and_their_moved_fields_counted(self):
        moved = {**H1, "total": 0.5, "paymentReduction": "Yes"}
        new = {"ccn": "990003", "total": 0.2, "paymentReduction": "No"}
        after = {**emitted([H2, moved, new]), "source_manifest": "b" * 64}
        d = gd.diff_file(emitted([H1, H2]), after)
        self.assertEqual(d["status"], "changed")
        self.assertEqual(d["envelope"], ["source_manifest"])
        h = d["parts"]["hospitals"]
        self.assertEqual((h["before"], h["after"], h["added"], h["removed"], h["changed"]), (2, 3, ["990003"], [], 1))
        self.assertEqual(dict(h["fields"]), {"total": 1, "paymentReduction": 1})
        self.assertNotIn("model", d["parts"])

    def test_a_key_that_is_not_a_list_is_changed_whole(self):
        d = gd.diff_file(emitted([H1]), emitted([H1], model={"boundary": 0.4}))
        self.assertEqual(d["parts"], {"model": "changed"})

    def test_records_without_a_distinct_key_go_by_place(self):
        d = gd.diff_list([[1, 2], [3, 4]], [[1, 2], [3, 5], [6]])
        self.assertEqual((d["added"], d["changed"]), ([2], 1))
        dupes = [{"id": "a", "v": 1}, {"id": "a", "v": 2}]
        self.assertEqual(gd.diff_list(dupes, dupes[::-1])["changed"], 2)

    def test_added_and_removed_files(self):
        diffs = gd.diff_emitted({"old.json": emitted([H1])}, {"new.json": emitted([H1])})
        self.assertEqual({p: d["status"] for p, d in diffs.items()}, {"new.json": "added", "old.json": "removed"})


class Markdown(unittest.TestCase):
    def test_no_change_says_so(self):
        same = {"a.json": emitted([H1])}
        self.assertIn("No emitted file changed", gd.markdown(gd.diff_emitted(same, same)))

    def test_a_change_is_a_table_row_with_counts_and_fields(self):
        before = {"a.json": emitted([H1, H2]), "b.json": emitted([H1])}
        after = {"a.json": emitted([{**H1, "paymentReduction": "Yes"}, H2]), "b.json": emitted([H1]),
                 "c.json": emitted([H1])}
        text = gd.markdown(gd.diff_emitted(before, after))
        self.assertIn("| `a.json` | `hospitals` 2 → 2: 1 changed; fields: paymentReduction 1 |", text)
        self.assertIn("| `c.json` | added (a first emission) |", text)
        self.assertIn("1 other emitted files unchanged.", text)

    def test_long_lists_are_cut(self):
        many = [{"ccn": f"99{n:04d}"} for n in range(9)]
        text = gd.describe(gd.diff_file(emitted([]), emitted(many)))
        self.assertIn("9 added (990000, 990001, 990002, 990003, 990004 and 4 more)", text)


if __name__ == "__main__":
    unittest.main()
