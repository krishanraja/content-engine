"""The brand palette: one manifest every maker reads, and a guard that refuses a deviating cut.

Ruling (Krish, 2026-11-12): "I approve the brand palette sheet, but only if it falls in line with the attached."
config/brand-palette.json, scripts/brand_palette.py, docs/production/SOCIAL-BEST-PRACTICES-2026.md.
"""
import copy
import hashlib
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

    def test_the_marks_are_the_v5_files(self):
        # Krish locked v5 on 2026-11-25: the marks are this repository's v5 SVGs, pinned by sha256 (the v4 PNGs are gone).
        p = brand_palette.load()
        self.assertEqual(p['marks']['icon']['sha256'], 'ec9ca040a7c7f5862c6683df6b88adcf4cc62fc977bcfb46ebc9c0c68745661b')
        self.assertEqual(p['marks']['wordmark']['file'], 'assets/brand/makeyourmindup/v5/v4.svg')
        for key in ('icon', 'masthead', 'wordmark'):
            mark = p['marks'][key]
            self.assertTrue(mark['file'].startswith('assets/brand/makeyourmindup/v5/'), key)
            self.assertEqual(hashlib.sha256((ROOT / mark['file']).read_bytes()).hexdigest(), mark['sha256'], key)
            for sha in mark.get('same_drawing') or []:
                ink = ROOT / mark['file'].replace('.svg', '-ink.svg')
                self.assertEqual(hashlib.sha256(ink.read_bytes()).hexdigest(), sha, key)

    def test_the_studio_v5_pins_are_the_committed_bytes(self):
        # 26 Nov 2026: the v5 theme pinned d-face-off.svg by the hash of a CRLF checkout, so the Studio's own byte check
        # (packages/core/src/brand-assets.ts) would refuse the committed LF file. Every v5 mark pin is the file's own hash.
        studio = json.loads((ROOT / 'config' / 'studio.json').read_text(encoding='utf-8'))
        pins = [a for t in studio['brand_themes'] for a in (t.get('publication') or {}).values()
                if isinstance(a, dict) and str(a.get('source_path', '')).startswith('assets/brand/makeyourmindup/v5/')]
        self.assertGreaterEqual(len(pins), 3)
        for a in pins:
            self.assertNotIn(bytes([13, 10]), (ROOT / a['source_path']).read_bytes(), a['source_path'])
            self.assertEqual(hashlib.sha256((ROOT / a['source_path']).read_bytes()).hexdigest(), a['sha256'], a['source_path'])

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

    def test_the_long_cut_opens_on_the_hook_with_nothing_before_it(self):
        # Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good."
        long_cut = {'date': '2026-11-18', 'format': 'long_cut', 'opening': 'hook', 'sting': 'none',
                    'close': {'id': 'statement_card', 'seconds': 6.0}}
        self.assertEqual(brand_palette.check(long_cut), [])
        self.assertTrue(brand_palette.check(dict(long_cut, sting='before_hook')))
        p = brand_palette.load()
        self.assertEqual(p['formats']['long_cut']['series']['sting_when_built'], 'after_hook')
        self.assertEqual(p['formats']['long_cut']['series']['sting_retired']['words'], 'Nothing before the hook, ever. Remove the sting exception for good.')
        self.assertEqual(json.loads((ROOT / 'config' / 'intro-sting.json').read_text(encoding='utf-8'))['status'], 'retired')

    def test_every_series_cut_ends_on_the_plain_v5_outro_card_from_26_nov(self):
        # Ruling (Krish, 2026-11-26): "1 agreed", to retiring the sting close and ending on the plain v5 outro card.
        short = dict(copy.deepcopy(GOOD_SHORT), date='2026-11-27', series='mind_the_gap')
        self.assertEqual(brand_palette.check(short), [])
        refused = {
            'the sting close': {'id': 'sting_beat', 'seconds': 2.0, 'sting': True, 'days_row': False},
            'a sting on the plain card': dict(short['close'], sting=True),
            'the sting close by its file': dict(short['close'], file='close-sting-9x16-mind_the_gap.mp4'),
            'the wide sting clip by its file': dict(short['close'], file='makeyourmindup-sting-16x9-mind_the_gap.mp4'),
            'the 11 Nov held sting': {'id': 'statement_beat', 'seconds': 2.0, 'file': 'sting-9x16-held.mp4'},
            'a 2.5 s beat': dict(short['close'], seconds=2.5),
            'no days row': dict(short['close'], days_row=False),
        }
        for name, close in refused.items():
            with self.subTest(name):
                self.assertTrue(brand_palette.check(dict(short, close=close)), name)
        long_cut = {'date': '2026-11-30', 'format': 'long_cut', 'kind': 'series', 'series': 'follow_the_money', 'opening': 'hook',
                    'sting': 'none', 'close': {'id': 'statement_card', 'seconds': 6.0, 'days_row': True}}
        self.assertEqual(brand_palette.check(long_cut), [])
        self.assertTrue(brand_palette.check(dict(long_cut, close={'id': 'sting_card', 'seconds': 6.0, 'sting': True, 'days_row': True})))
        # Nothing at the start changes: a sting before the hook is still refused.
        self.assertTrue(brand_palette.check(dict(long_cut, sting='before_hook')))
        # A series piece of the week of 16 Nov keeps the ink close it was signed with (F33).
        self.assertEqual(brand_palette.check(GOOD_SHORT), [])
        # A series piece dated 23 to 25 Nov was signed with the retired sting close (F33): its close is not checked.
        signed = dict(copy.deepcopy(GOOD_SHORT), date='2026-11-23',
                      close={'id': 'sting_beat', 'seconds': 2.0, 'sting': True, 'days_row': False})
        self.assertEqual(brand_palette.check(signed), [])
        self.assertTrue(brand_palette.check(dict(signed, date='2026-11-30')))
        # An off day keeps the mint plain card with no series days, and a sting on it is refused.
        off = {'date': '2026-11-24', 'format': 'short_cut', 'kind': 'off', 'close': {'id': 'statement_beat', 'seconds': 2.0, 'days_row': False}}
        self.assertEqual(brand_palette.check(off), [])
        self.assertTrue(brand_palette.check(dict(off, close=dict(off['close'], sting=True))))

    def test_the_palette_names_no_sting_close(self):
        p = brand_palette.load()
        self.assertNotIn('sting_close', p)
        self.assertFalse({'sting_beat', 'sting_card'} & set(p['closes']))
        self.assertFalse(any('sting' in (close.get('sting') or '') for close in p['closes'].values()))
        for fmt in ('long_cut', 'short_cut'):
            self.assertEqual(p['formats'][fmt]['series']['close'], p['series_close']['close'][fmt])
        self.assertEqual(p['series_close']['close'], {'long_cut': 'statement_card', 'short_cut': 'statement_beat'})
        self.assertEqual(p['series_close']['words'], '1 agreed')
        self.assertEqual(p['series_close']['from'], '2026-11-26')
        self.assertEqual(p['series_close']['theme'], 'makeyourmindup-v5')
        self.assertEqual(p['close_copy']['tagline'], 'Built to help you decide.')
        self.assertEqual(p['closes']['statement_beat']['seconds_max'], 2.0)
        self.assertNotIn('sting_clip', dir(brand_palette))

    def test_the_close_config_records_the_retirement_and_the_window(self):
        p = brand_palette.load()
        cfg = json.loads((ROOT / 'config' / 'intro-sting.json').read_text(encoding='utf-8'))
        self.assertEqual(cfg['status'], 'retired')  # never an opening
        self.assertEqual(cfg['close']['status'], 'retired')
        last = cfg['close']['rulings'][-1]
        self.assertEqual((last['on'], last['by'], last['decision'], last['words']), ('2026-11-26', 'Krish', 'retired', '1 agreed'))
        window = p['series_close']['unchecked']
        self.assertEqual((cfg['close']['applies_from'], cfg['close']['applies_until']), (window['from'], window['until']))
        self.assertLess(window['until'], p['series_close']['from'])

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
        # Nothing goes before the hook (Ruling, Krish, 2026-11-12), so ve opens the long cut on its hook and it passes.
        self.assertFalse(any(p.startswith('brand.palette cuts.long') for p in problems), problems)
        self.assertEqual(lint.palette_lints(dict(spec, publish_day='2026-11-13', brand={'series': 'mind.the.gap'})), [])

    def test_make_refuses_the_retired_outro(self):
        import make
        cfg = {'name': 't', 'date': '2026-11-16', 'series': 'follow_the_money', 'endcard': {'9x16': 'outro-9x16.mp4'}}
        problems = make.palette_problems(cfg, '9x16', None, lambda f: Path(f), '.')
        self.assertTrue(any('retired close' in p for p in problems), problems)
        let = make.palette_problems(dict(cfg, palette_exception='Krish, 2026-11-16: a stand-in for this test only'),
                                    '9x16', None, lambda f: Path(f), '.')
        self.assertEqual(let, [])

    def test_the_retired_sting_opens_every_cut_on_the_hook(self):
        # Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good." No engine lays it.
        import intro
        from velib import compile as ve_compile
        self.assertFalse(intro.wanted('16x9', 'follow_the_money'))
        cut = {'aspect': '16:9', 'excerpt': False}
        report = {}
        self.assertIsNone(ve_compile.sting_props(cut, 'follow_the_money', False, report))
        self.assertEqual(report, {})

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
