"""A one-word caption page measures as one line (Tue 17, 19 Nov 2026: "makeyourmindup.ai." errored captions.ocr)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib.qc_captions import page_lines  # noqa: E402


class OneWordPage(unittest.TestCase):
    def test_a_long_lone_word_is_one_line(self):
        self.assertEqual(page_lines({'words': [{'text': 'makeyourmindup.ai.'}]}, False), 1)

    def test_several_words_still_measure(self):
        self.assertGreaterEqual(page_lines({'words': [{'text': w} for w in 'the full story is at'.split()]}, False), 1)


if __name__ == '__main__':
    unittest.main()
