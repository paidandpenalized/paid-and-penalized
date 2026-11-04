"""The zip safety checks, on synthetic zips."""
import io
import unittest
import zipfile

from pp_engine import zipsafe
from pp_engine.parse import SchemaError


def make_zip(*names):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for n in names:
            zf.writestr(n, "x")
    return zipfile.ZipFile(io.BytesIO(buf.getvalue()))


class ZipSafeTest(unittest.TestCase):
    def test_unsafe_member_names(self):
        self.assertEqual(zipsafe.unsafe_member_names(["a/b.xml", "dir/file name (1).txt", "../x", "/x", "a/../../x",
                                                      "C:\\x", "a\\b"]),
                         ["../x", "/x", "a/../../x", "C:\\x", "a\\b"])

    def test_an_ordinary_zip_passes(self):
        with make_zip("dir/file name (1).txt", "b.xml") as zf:
            zipsafe.check_zip(zf, "z")

    def test_an_escaping_name_is_refused(self):
        with make_zip("ok.txt", "../x") as zf, self.assertRaisesRegex(SchemaError, "^z: unsafe zip member name '../x'$"):
            zipsafe.check_zip(zf, "z")

    def test_too_many_members_are_refused(self):
        with make_zip("a", "b", "c", "d", "e") as zf:
            with self.assertRaisesRegex(SchemaError, "z: zip has 5 members"):
                zipsafe.check_zip(zf, "z", max_members=4)
            zipsafe.check_zip(zf, "z", max_members=5)

    def test_a_member_over_the_size_limit_is_refused_from_the_directory_alone(self):
        with make_zip("a.txt") as zf, self.assertRaisesRegex(SchemaError, "z: member a.txt is 1 bytes"):
            zipsafe.check_zip(zf, "z", max_member_bytes=0)

    def test_the_default_limits_are_the_module_constants(self):
        self.assertEqual((zipsafe.MAX_MEMBER_BYTES, zipsafe.MAX_MEMBERS), (100_000_000, 1000))


if __name__ == "__main__":
    unittest.main()
