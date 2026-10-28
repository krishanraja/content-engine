"""QC refinements found by the first whole-cut render (Friday two passports): confusable I/l, the caption box crop,
the call card taking the caption zone, and no caption page expected while the call card replaces it."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib import qc, qc_captions, qc_composition  # noqa: E402


class FoldTest(unittest.TestCase):
    def test_i_and_l_are_one_glyph_to_the_reader_of_the_pixels(self):
        self.assertEqual(qc_captions.fold('ai'), qc_captions.fold('al'))
        self.assertEqual(qc_captions.fold('i'), qc_captions.fold('l'))
        self.assertNotEqual(qc_captions.fold('claude'), qc_captions.fold('clause'))

    def test_misread_ai_still_passes_but_a_wrong_word_does_not(self):
        with patch.object(qc_captions, '_recognise', return_value='which is a Chinese Al.'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('which is a Chinese AI.'))
        self.assertEqual(row['agreement'], 1.0)
        with patch.object(qc_captions, '_recognise', return_value='which is a Chinese AG.'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('which is a Chinese AI.'))
        self.assertLess(row['agreement'], 0.98)

    def test_lone_misread_capital_i_is_kept_as_the_word_i(self):
        with patch.object(qc_captions, '_recognise', return_value='l asked Claude,'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('I asked Claude,'))
        self.assertEqual(row['agreement'], 1.0)


class CropTest(unittest.TestCase):
    def test_crops_at_the_box_bottom_when_paper_follows(self):
        pixels = np.full((217, 900), 18, np.uint8)
        pixels[150:, :] = 230            # cream paper below a one-line box
        self.assertEqual(qc_captions.crop_to_caption_box(pixels).shape, (150, 900))

    def test_dark_picture_leaves_the_region_alone(self):
        pixels = np.full((217, 900), 18, np.uint8)
        self.assertEqual(qc_captions.crop_to_caption_box(pixels).shape, (217, 900))

    def test_a_bright_row_at_the_top_is_not_a_box_end(self):
        pixels = np.full((217, 900), 230, np.uint8)
        self.assertEqual(qc_captions.crop_to_caption_box(pixels).shape, (217, 900))


class CallBeatTest(unittest.TestCase):
    props = {'beats': [{'id': 'a', 'role': 'anchor', 'fromFrame': 0, 'toFrame': 100},
                       {'id': 'call', 'role': 'call', 'fromFrame': 100, 'toFrame': 200}],
             'captions': [{'fromFrame': 80, 'toFrame': 110, 'words': []},
                          {'fromFrame': 100, 'toFrame': 150, 'words': []},
                          {'fromFrame': 150, 'toFrame': 200, 'words': []},
                          {'fromFrame': 190, 'toFrame': 260, 'words': []}],
             'call': {'statement': 'One more country will fund its own AI.', 'due': '2026-12-31', 'confidencePercent': 90}}

    def test_pages_inside_the_call_beat_are_not_expected(self):
        shown = qc.caption_pages_shown(self.props)
        # the page that starts in the card but runs on after it is sampled mostly outside it, so it is expected
        self.assertEqual([page['fromFrame'] for page in shown], [80, 190])
        without = {key: value for key, value in self.props.items() if key != 'call'}
        self.assertEqual(len(qc.caption_pages_shown(without)), 4)

    def test_call_card_text_is_allowed_in_the_caption_zone_of_the_call_beat_only(self):
        tokens = qc_composition.call_card_tokens(self.props, self.props['beats'][1])
        self.assertTrue({'our', 'call', 'country', '2026', '90', 'sure'} <= tokens)
        self.assertEqual(qc_composition.call_card_tokens(self.props, self.props['beats'][0]), set())


if __name__ == '__main__':
    unittest.main()
