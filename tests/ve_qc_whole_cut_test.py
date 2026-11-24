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


class LoneIglyphTest(unittest.TestCase):
    def test_only_i_like_glyph_runs_of_two_count_as_i_and_only_where_i_is_expected(self):
        expected = ['if', 'i', 'were', 'you']
        for reading in ('l', 'il', 'll', 'I', '1', '|l'):
            self.assertTrue(qc_captions.lone_capital_i(reading.casefold(), expected), reading)
        self.assertFalse(qc_captions.lone_capital_i('lll', expected))
        self.assertFalse(qc_captions.lone_capital_i('ai', expected))
        self.assertFalse(qc_captions.lone_capital_i('il', ['if', 'were', 'you']))

    def test_a_lone_pipe_is_the_word_i_only_where_i_is_expected(self):
        with patch.object(qc_captions, '_recognise', return_value='this information if | were'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('this information if I were'))
        self.assertEqual(row['agreement'], 1.0)
        with patch.object(qc_captions, '_recognise', return_value='this information if | were'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('this information if we were'))
        self.assertLess(row['agreement'], 1.0)

    def test_il_reading_of_i_passes_but_il_where_no_i_is_expected_does_not(self):
        with patch.object(qc_captions, '_recognise', return_value='Il were you.'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('I were you.'))
        self.assertEqual(row['agreement'], 1.0)
        with patch.object(qc_captions, '_recognise', return_value='Il were you.'):
            row = qc_captions._read_candidates('x', np.zeros((20, 20), np.uint8), qc_captions._tokens('we were you.'))
        self.assertLess(row['agreement'], 0.98)


class CropTest(unittest.TestCase):
    def test_box_height_follows_its_lines(self):
        self.assertEqual(qc_captions.caption_box_height(1, True), 72 + 57 + 6)
        self.assertEqual(qc_captions.caption_box_height(2, True), 72 + 114 + 6)
        self.assertEqual(qc_captions.caption_box_height(1, False), 72 + 72 + 6)

    def test_wide_box_sits_on_the_bottom_of_the_region(self):
        pixels = np.zeros((187, 1400), np.uint8)
        pixels[:50] = 255                      # the picture above a one-line box
        crop = qc_captions.crop_to_caption_box(pixels, 1, True)
        self.assertEqual(crop.shape[0], qc_captions.caption_box_height(1, True))
        self.assertTrue((crop == 0).all())

    def test_tall_box_hangs_from_the_top_and_a_full_box_is_not_cropped(self):
        pixels = np.zeros((217, 900), np.uint8)
        pixels[150:] = 255
        self.assertTrue((qc_captions.crop_to_caption_box(pixels, 1, False) == 0).all())
        self.assertEqual(qc_captions.crop_to_caption_box(pixels, 2, False).shape, (217, 900) if qc_captions.caption_box_height(2, False) >= 217 else (qc_captions.caption_box_height(2, False), 900))

    def test_page_lines_come_from_the_engine_geometry(self):
        page = {'words': [{'text': 'every'}, {'text': 'AI'}, {'text': 'has'}, {'text': 'two'}], 'swipeIndex': None}
        self.assertEqual(qc_captions.page_lines(page, True), 1)
        long = {'words': [{'text': 'passports,'}] * 5, 'swipeIndex': 2}
        self.assertEqual(qc_captions.page_lines(long, True), 2)


class LandingBeatTest(unittest.TestCase):
    """The landing card replaces the captions on the landing beat (Ruling, Krish, 2026-11-24: the signature format is
    the 5 Whys; no dated call card is drawn any more)."""
    props = {'beats': [{'id': 'a', 'role': 'why', 'fromFrame': 0, 'toFrame': 100,
                        'why': {'n': 1, 'question': 'Why did the country fund its own model?', 'strength': 'documented'}},
                       {'id': 'landing', 'role': 'landing', 'fromFrame': 100, 'toFrame': 200,
                        'landing': {'shows': 'Countries now fund their own models to keep control.', 'open_question': 'Who controls the model you use?'}}],
             'captions': [{'fromFrame': 80, 'toFrame': 110, 'words': []},
                          {'fromFrame': 100, 'toFrame': 150, 'words': []},
                          {'fromFrame': 150, 'toFrame': 200, 'words': []},
                          {'fromFrame': 190, 'toFrame': 260, 'words': [{'text': 'x', 'atFrame': 195}]}]}

    def test_pages_inside_the_landing_beat_are_not_expected(self):
        shown = qc.caption_pages_shown(self.props)
        # a page is judged at the frame OCR samples; the one that starts in the card but is sampled after it is expected
        self.assertEqual([page['fromFrame'] for page in shown], [80, 190])
        bare = dict(self.props, beats=[self.props['beats'][0], {k: v for k, v in self.props['beats'][1].items() if k != 'landing'}])
        self.assertEqual(len(qc.caption_pages_shown(bare)), 4)
        # An archived cut's dated call no longer hides any caption.
        archived = dict(bare, call={'statement': 'One more country will fund its own AI.', 'due': '2026-12-31', 'confidencePercent': 90})
        self.assertEqual(len(qc.caption_pages_shown(archived)), 4)

    def test_landing_and_why_text_is_allowed_only_on_their_own_beats(self):
        tokens = qc_composition.landing_card_tokens(self.props, self.props['beats'][1])
        self.assertTrue({'what', 'shows', 'countries', 'controls', 'model'} <= tokens)
        self.assertFalse({'sure', '2026', 'call'} & tokens)
        self.assertEqual(qc_composition.landing_card_tokens(self.props, self.props['beats'][0]), set())
        step = qc_composition.why_step_tokens(self.props, self.props['beats'][0])
        self.assertTrue({'why', '1', 'country', 'documented'} <= step)
        self.assertEqual(qc_composition.why_step_tokens(self.props, self.props['beats'][1]), set())


if __name__ == '__main__':
    unittest.main()
