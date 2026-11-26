"""scripts/library/make_piece.py: a piece's facts become a Library carousel pack, covers and thumbnails are refused
in favour of scripts/covers/make_covers.py, and the retired cover drawer refuses without --legacy. No browser: the renderer itself is exercised by the Library's gates."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts' / 'library'), str(ROOT / 'scripts' / 'post-pack')]
import make_piece  # noqa: E402

FRIDAY = ROOT / 'docs' / 'plans' / '2026-11-13-friday'


class PackTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_covers_and_thumbnails_come_from_the_cover_systems(self):
        for retired in ('covers', 'video'):
            with self.subTest(set=retired), self.assertRaisesRegex(make_piece.PieceError, 'make_covers.py'):
                make_piece.build_pack(FRIDAY / 'cover-facts.json', retired, self.out)
        self.assertEqual(make_piece.main([str(FRIDAY), '--set', 'covers', '--out', str(self.out)]), 1)

    def test_refusals_in_plain_words(self):
        with self.assertRaisesRegex(make_piece.PieceError, 'no carousel set'):
            make_piece.build_pack(FRIDAY / 'cover-facts.json', 'nonsense', self.out)
        # A carousel set never borrows the template's words or another story's data.
        with self.assertRaisesRegex(make_piece.PieceError, 'needs its headline_1 from the piece'):
            make_piece.build_pack(FRIDAY / 'cover-facts.json', 'good-news', self.out)
        with self.assertRaisesRegex(make_piece.PieceError, "sample data"):
            make_piece.build_pack(FRIDAY / 'cover-facts.json', 'piece', self.out)
        with self.assertRaisesRegex(make_piece.PieceError, 'no cover facts'):
            make_piece.facts_path(self.out / 'missing')


class LibraryRecordTest(unittest.TestCase):
    def test_the_gate_refuses_an_incomplete_library_record(self):
        import visual_gate
        good = {'template': 'library', 'library_item': 'social-square', 'pack': 'abc', 'portrait': False,
                'proof': {'page': 'https://example.com/a'}, 'skin': None}
        self.assertIsNone(visual_gate.not_receipt(good))
        self.assertIn('proof', visual_gate.not_receipt(good | {'proof': {}}))
        self.assertIn('face', visual_gate.not_receipt(good | {'portrait': True}))
        self.assertIn('retired', visual_gate.not_receipt(good | {'skin': 'v5_feed'}))
        self.assertIn('Library template', visual_gate.not_receipt(good | {'library_item': None}))


class WordmarkGroundTest(unittest.TestCase):
    """STANDARD 6 as the ink gate reads it: cream or mint on ink, ink tone on a rung or answer field, never cream on colour."""

    def check(self, ground, mark):
        sys.path.insert(0, str(make_piece.LIBRARY))
        from PIL import Image
        from pixel_alignment import wordmark_ground_ok
        back = Image.new('RGB', (40, 20), ground)
        drawn = back.copy()
        drawn.paste(mark, (5, 5, 35, 15))
        return wordmark_ground_ok(back, drawn)

    def test_the_rule(self):
        ink, cream, mint, coral, lilac = (12, 21, 18), (244, 239, 228), (126, 240, 192), (255, 106, 77), (183, 166, 255)
        self.assertTrue(self.check(ink, cream))
        self.assertTrue(self.check(ink, mint))
        self.assertTrue(self.check(coral, ink))
        self.assertTrue(self.check(lilac, ink))
        self.assertTrue(self.check(mint, ink))
        self.assertFalse(self.check(coral, cream))
        self.assertFalse(self.check((90, 90, 90), cream))


class RetirementRefusalTest(unittest.TestCase):
    def test_the_old_drawer_refuses_without_legacy(self):
        with tempfile.TemporaryDirectory() as tmp:
            done = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'pages' / 'build.py'), str(FRIDAY / 'cover-facts.json'),
                                   '--cover', '--out', tmp], capture_output=True, text=True, encoding='utf-8')
        self.assertNotEqual(done.returncode, 0)
        self.assertIn('make_piece.py', done.stderr)
        self.assertIn('--legacy', done.stderr)

    def test_legacy_is_only_for_the_drawer(self):
        done = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'pages' / 'build.py'), str(FRIDAY / 'cover-facts.json'),
                               '--legacy'], capture_output=True, text=True, encoding='utf-8')
        self.assertNotEqual(done.returncode, 0)
        self.assertIn('--legacy only applies', done.stderr)

    def test_the_skins_refuse_in_code(self):
        sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
        import skins
        with patch.object(skins, 'LEGACY', False), self.assertRaisesRegex(SystemExit, 'retired'):
            skins.pick({}, {})
        retired = {(row['kind'], row['id']) for row in json.loads((ROOT / 'config' / 'retired-styles.json').read_text(encoding='utf-8'))}
        self.assertIn(('skin', 'v5_feed'), retired)
        self.assertIn(('cover_path', 'receipt'), retired)


if __name__ == '__main__':
    unittest.main()
