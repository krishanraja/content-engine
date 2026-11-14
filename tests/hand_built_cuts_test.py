"""A hand-built cut is filed only with Krish's words on those exact bytes (Ruling, Krish, 2026-11-11)."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/post-pack'))
import making  # noqa: E402

PIECE = 'f3fcd5e1-573e-4692-a413-db7c5823a10e'


class HandBuiltTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.video = self.dir / 'cut.mp4'
        self.video.write_bytes(b'these exact bytes')
        self.sha = hashlib.sha256(b'these exact bytes').hexdigest()

    def config(self, **entry):
        row = {'piece_id': PIECE, 'cut': 'long', 'sha256': self.sha, 'krish': 'Krish, 2026-11-11: "yes"', **entry}
        path = self.dir / 'hand-built-cuts.json'
        path.write_text(json.dumps({'cuts': [row]}))
        return path

    def test_matches_only_the_exact_entry(self):
        self.assertIsNotNone(making.hand_built_approval(PIECE, 'long', str(self.video), self.config()))

    def test_other_bytes_are_refused(self):
        self.video.write_bytes(b'a different cut')
        self.assertIsNone(making.hand_built_approval(PIECE, 'long', str(self.video), self.config()))

    def test_other_cut_or_piece_is_refused(self):
        cfg = self.config()
        self.assertIsNone(making.hand_built_approval(PIECE, 'short', str(self.video), cfg))
        self.assertIsNone(making.hand_built_approval('00000000-0000-0000-0000-000000000000', 'long', str(self.video), cfg))

    def test_needs_his_words(self):
        self.assertIsNone(making.hand_built_approval(PIECE, 'long', str(self.video), self.config(krish='approved')))

    def test_repo_entries_carry_his_words(self):
        rows = json.loads((ROOT / 'config/hand-built-cuts.json').read_text())['cuts']
        self.assertTrue(rows and all(r['krish'].startswith('Krish') and len(r['sha256']) == 64 for r in rows))


if __name__ == '__main__':
    unittest.main()
