"""The makeyourmindup Library's own static check, on every pull request that touches the Library.

It runs docs/ve/cards/library/verify_static.py from a clean checkout (no .scratch files) and compares its error
list with docs/ve/cards/library/verify-static-known.json. A new error fails, and so does a listed error that no
longer occurs, so the known list only shrinks. On 27 Nov 2026 main crashed in this check: grid_proof, the website
mock and the guide still named the cover templates retired by the approved cover systems.

verify:quick picks this test when a change names one of these files (scripts/verify-quick.mjs matches the paths):
docs/ve/cards/library/library.json, docs/ve/cards/library/library.html, docs/ve/cards/library/verify_static.py,
docs/ve/cards/library/check_static.cjs, docs/ve/cards/library/offline_art.cjs, docs/ve/cards/library/review.js,
docs/ve/cards/library/edition.js, docs/ve/cards/library/imagery.js, docs/ve/cards/library/alignment.js,
docs/ve/cards/library/motion.js, docs/ve/cards/library/house-stills.json, docs/ve/cards/library/make_samples.py,
docs/ve/cards/library/standard.py, docs/ve/cards/library/spacing.py, docs/ve/cards/library/font_metrics.py,
docs/ve/cards/library/pixel_alignment.py, docs/ve/cards/library/render_lock.py, docs/ve/cards/library/lock.json,
docs/ve/cards/library/verify-static-known.json.
"""
from collections import Counter
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "docs/ve/cards/library"
KNOWN = LIBRARY / "verify-static-known.json"


class LibraryStaticCheck(unittest.TestCase):
    def test_only_the_known_failures(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "errors.json"
            env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
            run = subprocess.run([sys.executable, "-B", "verify_static.py", "--errors-json", str(out)], cwd=LIBRARY,
                                 env=env, capture_output=True, text=True, encoding="utf-8")
            self.assertTrue(out.is_file(), "verify_static.py stopped before its report:\n"
                            + run.stdout[-4000:] + run.stderr[-4000:])
            actual = Counter(json.loads(out.read_text(encoding="utf-8")))
        known = Counter(json.loads(KNOWN.read_text(encoding="utf-8"))["errors"])
        new, fixed = actual - known, known - actual
        self.assertFalse(new, "New Library check failures:\n" + "\n".join(sorted(new.elements())))
        self.assertFalse(fixed, "These no longer fail; remove them from verify-static-known.json:\n"
                         + "\n".join(sorted(fixed.elements())))


if __name__ == "__main__":
    unittest.main()
