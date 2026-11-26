"""Membership and archive refusal for the drawers present on this branch."""
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "scripts/pages"
sys.path.insert(0, str(PAGES))
import receipt
import skins


class RetirementTest(unittest.TestCase):
    def test_source_membership(self):
        sources = {"cover_path": {p.stem for p in PAGES.glob("*.py")
                                  if "def draw_covers(" in p.read_text(encoding="utf-8")},
                   "skin": {p.stem for p in (PAGES / "skins").glob("*.py")}}
        for row in json.loads((ROOT / "config/retired-styles.json").read_text(encoding="utf-8")):
            self.assertIn(row["id"], sources[row["kind"]])
            self.assertTrue((ROOT / row["path"]).is_file())

    def test_library_mirror(self):
        library = ROOT / "docs/ve/cards/library/library.json"
        registry = json.loads(library.read_text(encoding="utf-8"))
        embedded = library.with_suffix(".html").read_text(encoding="utf-8").split("const registry=", 1)[1].split(";\n", 1)[0]
        self.assertEqual(json.loads(embedded), registry)
        retired = [i for i in registry["items"] if i["id"].startswith(
            ("cover-receipt-", "cover-scene-", "cover-face-", "newsletter-substack-cover"))
            or i["id"] in ("web-og-card", "social-x-card", "social-share-card")]
        self.assertEqual(len(retired), 11)
        for item in retired:
            self.assertEqual(item["status"], "retired")
            self.assertIn("I approve the new cover thumbnail systems, go", item["ruling"])

    def test_drawer_refuses_before_accessing_assets(self):
        with self.assertRaisesRegex(SystemExit, "make_covers.py"):
            receipt.draw_covers({}, ROOT, ROOT, None)
        with self.assertRaisesRegex(SystemExit, "make_covers.py"):
            receipt.draw_thumbs({}, ROOT, ROOT, None, None)
        with self.assertRaisesRegex(SystemExit, "make_covers.py"):
            skins.load("v5_feed")
        with patch.object(skins, "LEGACY", True):
            self.assertIn("A &amp; B", skins.load("v5_feed").page((1280, 720), (50, 50, 1000, 600), "photo.jpg", "A & B", ""))

    def test_legacy_flag(self):
        for flags in (["--cover"], ["--thumbs"], ["--thumbs", "--options", "2"]):
            run = subprocess.run([sys.executable, str(PAGES / "build.py"), "absent.json", *flags], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn("--legacy", run.stderr)
        run = subprocess.run([sys.executable, str(PAGES / "build.py"), "absent.json", "--cover", "--legacy"], capture_output=True, text=True)
        self.assertIn("FileNotFoundError", run.stderr)


if __name__ == "__main__":
    unittest.main()
