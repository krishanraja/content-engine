"""The brand palette: one manifest every maker reads, and a guard that refuses a deviating cut.

Ruling (Krish, 2026-11-12): "I approve the brand palette sheet, but only if it falls in line with the attached."
config/brand-palette.json, scripts/brand_palette.py, docs/production/SOCIAL-BEST-PRACTICES-2026.md.
"""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))

import brand_palette  # noqa: E402

GOOD_SHORT = {'date': '2026-11-16', 'format': 'short_cut', 'kind': 'series', 'series': 'follow_the_money', 'shape': '9x16',
              'opening': 'hook', 'sting': 'none', 'body': {'icon': False, 'wordmark': False, 'series_pill': False},
              'close': {'id': 'statement_beat', 'seconds': 2.0, 'file': 'endcard-9x16.mp4', 'days_row': True}}


class Manifest(unittest.TestCase):
    def test_every_day_and_format_is_named(self):
        p = brand_palette.load()
        self.assertEqual(p['status'], 'approved')
        self.assertEqual(sorted(p['days']), sorted(brand_palette.WEEKDAYS))
        self.assertEqual([p['days'][d].get('series') for d in ('monday', 'wednesday', 'friday')],
                         ['follow_the_money', 'under_the_hood', 'mind_the_gap'])
        for fmt in ('long_cut', 'short_cut', 'carousel', 'meme', 'notes_image', 'saturday_good_news', 'thumbnail_wide', 'cover_tall'):
            self.assertIn(fmt, p['formats'])

    def test_the_tall_close_is_a_compact_beat_inside_the_core_box(self):
        p = brand_palette.load()
        self.assertLessEqual(p['closes']['statement_beat']['seconds_max'], 2.0)
        self.assertEqual(p['safe']['tall_core'], [120, 330, 820, 1180])

    def test_the_marks_are_the_brand_repository_files(self):
        p = brand_palette.load()
        self.assertEqual(p['marks']['icon']['sha256'], '4a45152311ff552a1fd08307a78e8e49c0c699663d73c35687c52887f782fb4a')

    def test_the_attached_corpus_is_kept(self):
        self.assertTrue((ROOT / 'docs' / 'production' / 'SOCIAL-BEST-PRACTICES-2026.md').is_file())


class Guard(unittest.TestCase):
    def test_a_cut_built_to_the_palette_passes(self):
        self.assertEqual(brand_palette.check(GOOD_SHORT), [])

    def test_deviating_fixtures_are_refused(self):
        bad = {
            'the retired stand-off outro': {'close': {'file': 'outro-9x16.mp4', 'seconds': 6.0}},
            'a 6 s tall close': {'close': {'id': 'statement_beat', 'seconds': 6.0}},
            'a different close': {'close': {'id': 'statement_card', 'seconds': 2.0}},
            'no close': {'close': {}},
            'an intro card': {'opening': 'clip'},
            'the wordmark over the body': {'body': {'wordmark': True}},
            'the icon over the body': {'body': {'icon': True}},
            'a series pill over the body': {'body': {'series_pill': True}},
            'a sting on the short': {'sting': 'before_hook'},
            'another series\' colour': {'series': 'mind_the_gap'},
            'a series on an off day': {'date': '2026-11-17'},
        }
        for name, change in bad.items():
            with self.subTest(name):
                self.assertTrue(brand_palette.check(dict(copy.deepcopy(GOOD_SHORT), **change)), name)

    def test_the_long_cut_sting_follows_the_hook(self):
        long_cut = {'date': '2026-11-18', 'format': 'long_cut', 'opening': 'hook', 'sting': 'before_hook',
                    'close': {'id': 'statement_card', 'seconds': 6.0}}
        self.assertTrue(brand_palette.check(long_cut))
        self.assertEqual(brand_palette.check(dict(long_cut, sting='after_hook')), [])

    def test_an_off_day_close_has_no_series_days(self):
        off = dict(copy.deepcopy(GOOD_SHORT), date='2026-11-17', kind='off')
        off.pop('series')
        self.assertTrue(brand_palette.check(off))
        off['close'] = dict(off['close'], days_row=False)
        self.assertEqual(brand_palette.check(off), [])

    def test_pieces_before_the_palette_binds_are_not_checked(self):
        self.assertEqual(brand_palette.check(dict(GOOD_SHORT, date='2026-11-13', close={'file': 'outro-9x16.mp4'})), [])

    def test_a_record_with_no_date_is_refused(self):
        self.assertTrue(brand_palette.check({'format': 'short_cut'}))


class Makers(unittest.TestCase):
    def test_ve_lint_refuses_a_cut_that_deviates(self):
        from velib import lint, compile as ve_compile
        spec = {'publish_day': '2026-11-16', 'brand': {'series': 'follow.the.money'},
                'cuts': {'long': {'aspect': '16:9', 'excerpt': False}, 'short': {'aspect': '9:16', 'excerpt': False}}}
        problems = lint.palette_lints(spec)
        # ve's tall close is the palette's 2 s beat, so the short passes.
        self.assertFalse(any(p.startswith('brand.palette cuts.short') for p in problems), problems)
        if getattr(ve_compile, 'STING_POSITION', 'before_hook') == 'before_hook':
            self.assertTrue(any(p.startswith('brand.palette cuts.long') for p in problems), problems)
        self.assertEqual(lint.palette_lints(dict(spec, publish_day='2026-11-13', brand={'series': 'mind.the.gap'})), [])

    def test_make_refuses_the_retired_outro(self):
        import make
        cfg = {'name': 't', 'date': '2026-11-16', 'series': 'follow_the_money', 'endcard': {'9x16': 'outro-9x16.mp4'}}
        problems = make.palette_problems(cfg, '9x16', None, lambda f: Path(f), '.')
        self.assertTrue(any('retired close' in p for p in problems), problems)
        let = make.palette_problems(dict(cfg, palette_exception='Krish, 2026-11-16: a stand-in for this test only'),
                                    '9x16', None, lambda f: Path(f), '.')
        self.assertEqual(let, [])

    def test_the_day_runner_no_longer_swaps_in_the_stand_off_outro(self):
        src = (ROOT / 'scripts' / 'produce_day.py').read_text(encoding='utf-8')
        self.assertNotIn('clips = story_clips(post_path, work)', src)

    def test_kit_makes_the_tall_close_two_seconds(self):
        import kit
        self.assertEqual(kit.ENDCARD_SECONDS_BY_SHAPE, {'16x9': 6, '9x16': 2})
        html = (ROOT / 'scripts' / 'quick-edit' / 'kit' / 'endcard.html').read_text(encoding='utf-8')
        self.assertIn('left: 120px; width: 700px; top: 330px; height: 850px', html)


if __name__ == '__main__':
    unittest.main()
