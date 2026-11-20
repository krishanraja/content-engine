"""ve recipe rate writes Krish's rating into a recipe file, in his words, and refuses anything else.

    python tests/ve_recipe_rate_test.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import floor, recipes  # noqa: E402
from velib.common import write_json  # noqa: E402


class RecipeRateTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        write_json(self.root / 'depth.json', {'style': 'depth', 'rated': None, 'caption_themes': ['georgia-build']})

    def read(self):
        return json.loads((self.root / 'depth.json').read_text(encoding='utf-8'))

    def test_a_score_is_written_with_his_words_and_passes_the_floor_from_nine(self):
        block = recipes.rate('depth', 9, words='this one is a 9', on='2026-11-21', root=self.root)
        self.assertEqual(block, {'score': 9, 'by': 'Krish', 'on': '2026-11-21', 'words': 'this one is a 9'})
        self.assertEqual(self.read()['rated'], block)
        self.assertEqual(self.read()['caption_themes'], ['georgia-build'], 'the rest of the recipe is kept')
        self.assertTrue(floor.rated(self.read()))
        recipes.rate('depth', 8.5, words='close', on='2026-11-21', root=self.root)
        self.assertFalse(floor.rated(self.read()))

    def test_approved_records_no_score(self):
        block = recipes.rate('depth', approved=True, words="They're all approved.", on='2026-11-20', root=self.root)
        self.assertEqual(block, {'approved': True, 'by': 'Krish', 'on': '2026-11-20', 'words': "They're all approved."})
        self.assertNotIn('score', self.read()['rated'])
        self.assertTrue(floor.rated(self.read()))

    def test_refusals(self):
        for score in (-1, 10.5, 11, float('nan'), True):
            with self.assertRaises(ValueError):
                recipes.rate('depth', score, words='x', root=self.root)
        with self.assertRaises(ValueError):
            recipes.rate('depth', 9, words='  ', root=self.root)
        with self.assertRaises(ValueError):
            recipes.rate('depth', 9, approved=True, words='both', root=self.root)
        with self.assertRaises(ValueError):
            recipes.rate('depth', words='no score', root=self.root)
        with self.assertRaises(ValueError):
            recipes.rate('nope', 9, words='x', root=self.root)
        with self.assertRaises(ValueError):
            recipes.rate('depth', 9, words='x', on='21/11/2026', root=self.root)
        self.assertIsNone(self.read()['rated'], 'a refused rating changes nothing')

    def test_the_command_refuses_without_words_or_out_of_range(self):
        run = lambda *a: subprocess.run([sys.executable, str(ROOT / 'scripts' / 've.py'), 'recipe', 'rate', *a],
                                        capture_output=True, text=True)
        self.assertNotEqual(run('data-story', '9').returncode, 0)
        self.assertNotEqual(run('data-story', '12', '--words', 'x').returncode, 0)
        self.assertNotEqual(run('no-such-recipe', '9', '--words', 'x').returncode, 0)


if __name__ == '__main__':
    unittest.main()
