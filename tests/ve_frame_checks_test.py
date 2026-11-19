"""The Tue 17 and Wed 18 Nov 2026 frame and spec checks (scripts/velib/qc_frames.py, config/ve/frame-checks.json).
Each rule has the bad case that must fail and the good case that must pass, on made-up props: nothing here is a piece."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))

from velib import qc_frames as F  # noqa: E402
from velib import guards  # noqa: E402


def beat(id, a, b, *, layout='STAGE', plate='none', face=None, uses=None, **more):
    return {'id': id, 'role': 'bridge', 'layout': layout, 'plate': {'source': plate}, 'fromFrame': a, 'toFrame': b,
            'uses': uses or [], 'transitionOut': 'cut', **({'face': face} if face else {}), **more}


def obj(name, device, meaning='x', params=None):
    return {'obj': name, 'device': device, 'meaning': meaning, 'params': params or {}, 'fromFrame': 0, 'toFrame': 300}


def props(**more):
    base = {'aspect': '9:16', 'fps': 30, 'durationFrames': 300, 'bodyLogo': False, 'series': {'label': 'mind.the.gap'},
            'beats': [beat('b1', 0, 100), beat('b2', 100, 200, plate='take', layout='P1'), beat('b3', 200, 300)],
            'objects': [], 'events': [], 'captions': []}
    base.update(more)
    return base


class OneCarrier(unittest.TestCase):
    def test_two_pictures_on_one_beat_fail(self):
        p = props(objects=[obj('p1', 'photo_plate'), obj('p2', 'scene_plate')])
        p['beats'][0]['uses'] = ['p1', 'p2']
        self.assertTrue(F.one_carrier_problems(p))

    def test_a_graphic_saying_what_the_picture_says_fails(self):
        p = props(objects=[obj('p1', 'photo_plate', 'a robot boot kicks the laptop out of the office'),
                           obj('g1', 'quote_card', 'the robot boot kicks the laptop out of the office')])
        p['beats'][0]['uses'] = ['p1', 'g1']
        found = F.one_carrier_problems(p)
        self.assertTrue(found and 'repeats the point' in found[0]['why'], found)

    def test_a_picture_and_a_graphic_with_their_own_points_pass(self):
        p = props(objects=[obj('p1', 'photo_plate', 'a satnav map on a dashboard'), obj('g1', 'kinetic_stat', 'forty one jobs lost')])
        p['beats'][0]['uses'] = ['p1', 'g1']
        self.assertEqual(F.one_carrier_problems(p), [])


class Figures(unittest.TestCase):
    def test_a_ghosted_or_blurred_figure_fails(self):
        for params in ({'ghost': True}, {'blur': 4}, {'dim': 0.5}, {'opacity': 0.4}):
            p = props(objects=[obj('k', 'kinetic_stat', params=params)])
            self.assertTrue(F.figure_problems(p), params)

    def test_a_clean_figure_passes(self):
        self.assertEqual(F.figure_problems(props(objects=[obj('k', 'kinetic_stat')])), [])

    def test_a_narrow_strip_fails_and_a_wide_one_passes(self):
        narrow = props(objects=[obj('s', 'stat_strip', params={'label': 'a', 'numeral': '41', 'at': {'x': 0, 'y': 0, 'w': 400}})])
        wide = props(objects=[obj('s', 'stat_strip', params={'label': 'a', 'numeral': '41', 'at': {'x': 0, 'y': 0, 'w': 900}})])
        self.assertTrue(F.figure_problems(narrow))
        self.assertEqual(F.figure_problems(wide), [])

    def test_a_figure_in_a_small_slot_fails(self):
        p = props(objects=[obj('k', 'kinetic_stat')], beats=[beat('b1', 0, 100, layout='F1', plate='take', uses=['x', 'k'])])
        # F1's second slot (800 x 400) is 15% of the tall frame: under the 20% a figure needs.
        self.assertTrue(F.figure_problems(p))


class Ghost(unittest.TestCase):
    def test_a_dissolve_between_a_face_beat_and_a_full_screen_beat_fails(self):
        p = props(ingredients={'transition': 'crossfade'})
        self.assertTrue(F.ghost_props_problems(p))

    def test_a_cut_passes_and_no_face_change_passes(self):
        self.assertEqual(F.ghost_props_problems(props(ingredients={'transition': 'cut'})), [])
        p = props(ingredients={'transition': 'crossfade'}, beats=[beat('a', 0, 100), beat('b', 100, 200)])
        self.assertEqual(F.ghost_props_problems(p), [])

    def test_two_faces_in_a_frame_at_the_change_fail(self):
        p = props()
        grab = lambda frame: np.zeros((1920, 1080, 3), np.uint8)
        two = lambda rgb: [(0, 0, 100, 100), (500, 500, 100, 100)]
        one = lambda rgb: [(0, 0, 100, 100)]
        self.assertTrue(F.ghost_frame_problems('x.mp4', p, p['beats'], 30, '9:16', two, grab))
        self.assertEqual(F.ghost_frame_problems('x.mp4', p, p['beats'], 30, '9:16', one, grab), [])


class Backdrop(unittest.TestCase):
    def frames(self, level, noise=0):
        rng = np.random.default_rng(3)
        return lambda frame: np.clip(level + rng.normal(0, noise, (54, 96, 3)), 0, 255).astype(np.uint8)

    def test_flat_black_after_a_picture_fails(self):
        p = props()
        b = [beat('a', 0, 100, plate='take', layout='P1'), beat('b', 100, 200)]
        self.assertTrue(F.backdrop_problems('x.mp4', p, b, 30, self.frames(5)))

    def test_a_graded_backdrop_passes_and_a_picture_beat_is_not_judged(self):
        p = props()
        b = [beat('a', 0, 100, plate='take', layout='P1'), beat('b', 100, 200)]
        self.assertEqual(F.backdrop_problems('x.mp4', p, b, 30, self.frames(90, 40)), [])
        b2 = [beat('a', 0, 100), beat('b', 100, 200)]   # graphics after graphics: no picture before it
        self.assertEqual(F.backdrop_problems('x.mp4', p, b2, 30, self.frames(5)), [])


class RenderCurrent(unittest.TestCase):
    def test_a_render_that_never_heard_of_the_rule_is_refused(self):
        p = props()
        del p['bodyLogo']
        self.assertTrue(F.render_current_problems(p, '2026-11-18'))

    def test_a_body_logo_after_the_rule_date_is_refused(self):
        self.assertTrue(F.render_current_problems(props(bodyLogo=True), '2026-11-18'))

    def test_the_rule_followed_passes(self):
        self.assertEqual(F.render_current_problems(props(bodyLogo=False), '2026-11-18'), [])


class OffDay(unittest.TestCase):
    def test_off_day_in_any_drawn_text_fails_but_the_series_label_is_not_drawn_text(self):
        bad = props(objects=[obj('h', 'headline', params={'text': 'This is off.day content'})])
        self.assertTrue(F.off_day_text_problems(bad))
        ok = props(series={'label': 'off.day'}, objects=[obj('h', 'headline', params={'text': 'A normal headline'})])
        self.assertEqual(F.off_day_text_problems(ok), [])

    def test_a_caption_word_counts(self):
        p = props(captions=[{'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'off.day', 'atFrame': 0}], 'swipeIndex': None}])
        self.assertTrue(F.off_day_text_problems(p))

    def test_the_frames_are_read_and_a_missing_reader_is_never_a_pass(self):
        p = props()
        read_bad = lambda png: [('off.day', 90.0, (0, 0, 10, 10))]
        read_ok = lambda png: [('hello', 90.0, (0, 0, 10, 10))]
        import velib.qc_onscreen as qo
        original = qo.frame_png
        qo.frame_png = lambda path, frame, out: Path(out) / 'x.png'
        try:
            self.assertTrue(F.off_day_frame_problems('x.mp4', p, 30, read_bad))
            self.assertEqual(F.off_day_frame_problems('x.mp4', p, 30, read_ok), [])
            row = F.rows('x.mp4', p, '2026-11-18', read=lambda png: (_ for _ in ()).throw(OSError('no tesseract')), diffs=None)
            self.assertEqual(row['text.no_off_day_frames']['status'], 'not_run')
            self.assertIsNone(row['text.no_off_day_frames']['pass'])
        finally:
            qo.frame_png = original

    def test_the_spec_lint_refuses_the_string_in_the_spec(self):
        spec = {'publish_day': '2026-11-18', 'cuts': {}, 'brand': {'series': 'mind.the.gap', 'title': 'Why off.day matters'}}
        self.assertTrue(any('text.no_off_day' in line for line in F.lints(spec)))
        self.assertEqual(F.lints({'publish_day': '2026-11-18', 'cuts': {}, 'brand': {'title': 'Fine'}}), [])
        self.assertEqual(F.lints({'publish_day': '2026-11-10', 'cuts': {}, 'brand': {'title': 'off.day'}}), [])   # before binds_from


class Title(unittest.TestCase):
    def moment(self, **more):
        base = {'fromFrame': 60, 'toFrame': 120, 'release': 'captions', 'card': True,
                'words': [{'text': 'Where', 'atFrame': 60}, {'text': 'does', 'atFrame': 70}, {'text': 'AI', 'atFrame': 80}, {'text': 'get', 'atFrame': 90}, {'text': 'built', 'atFrame': 100}]}
        base.update(more)
        return base

    def test_a_good_title_card_passes(self):
        self.assertEqual(F.title_problems(props(title='Where does AI get built', titleMoment=self.moment())), [])

    def test_bare_words_fail_and_the_spec_lint_asks_for_the_card(self):
        self.assertTrue(F.title_problems(props(title='Where does AI get built', titleMoment=self.moment(card=False))))
        spec = {'publish_day': '2026-11-18', 'cuts': {}, 'title_moment': {'title': 'x', 'line': 'x'}}
        self.assertTrue(any('title.card' in line for line in F.lints(spec)))
        self.assertEqual([l for l in F.lints({**spec, 'title_moment': {**spec['title_moment'], 'card': True}}) if 'title.card' in l], [])

    def test_a_caption_while_the_title_holds_fails(self):
        page = {'fromFrame': 100, 'toFrame': 140, 'words': [{'text': 'find', 'atFrame': 100}], 'swipeIndex': None}
        found = F.title_problems(props(title='Where does AI get built', titleMoment=self.moment(), captions=[page]))
        self.assertTrue(any('caption page' in p['why'] for p in found))

    def test_a_title_not_in_his_spoken_line_fails(self):
        found = F.title_problems(props(title='Which habits will cost you your job', titleMoment=self.moment()))
        self.assertTrue(any('not built from his spoken line' in p['why'] for p in found))

    def test_words_out_of_order_or_outside_the_hold_fail(self):
        bad = self.moment(words=[{'text': 'Where', 'atFrame': 90}, {'text': 'does', 'atFrame': 70}])
        self.assertTrue(F.title_problems(props(title='Where does', titleMoment=bad)))

    def test_the_width_is_measured_on_the_frame(self):
        import velib.qc_onscreen as qo
        original = qo.frame_png
        qo.frame_png = lambda path, frame, out: Path(out) / 'x.png'
        try:
            p = props(title='Where does AI get built', titleMoment=self.moment())
            wide = lambda png: [('Where', 90.0, (100, 800, 300, 120)), ('built', 90.0, (700, 800, 280, 120))]
            narrow = lambda png: [('Where', 90.0, (400, 800, 100, 60)), ('built', 90.0, (520, 800, 100, 60))]
            self.assertEqual(F.title_width_problems('x.mp4', p, 30, '9:16', wide), [])
            self.assertTrue(F.title_width_problems('x.mp4', p, 30, '9:16', narrow))
        finally:
            qo.frame_png = original


class Restarts(unittest.TestCase):
    words = [{'w': t, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, t in enumerate('so what happens so what happens when the laptop fails'.split())]

    def test_a_phrase_said_twice_fails(self):
        found = F.restart_problems({'a': self.words}, [])
        self.assertTrue(found and found[0]['text'] == 'so what happens')

    def test_a_listed_restart_passes_and_clean_words_pass(self):
        self.assertEqual(F.restart_problems({'a': self.words}, [{'at_s': 0.0, 'why': 'kept: the joke is the stumble'}]), [])
        clean = [{'w': t, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, t in enumerate('a b c d e f'.split())]
        self.assertEqual(F.restart_problems({'a': clean}, []), [])

    def test_no_words_heard_is_not_run_never_a_pass(self):
        row = F.rows(None, props(), '2026-11-18')['takes.restarts']
        self.assertIsNone(row['pass'])
        self.assertEqual(row['status'], 'not_run')

    def test_a_kept_restart_must_say_why(self):
        spec = {'publish_day': '2026-11-18', 'cuts': {'long': {'kept_restarts': [{'at_s': 3}]}}}
        self.assertTrue(any('takes.restarts' in line for line in F.lints(spec)))


class FirstSeconds(unittest.TestCase):
    def test_a_still_opening_fails_and_a_moving_one_passes(self):
        still = np.zeros(40)
        moving = np.concatenate([np.full(15, 6.0), np.zeros(25)])
        self.assertTrue(F.first_seconds_problems(still, props()))
        self.assertEqual(F.first_seconds_problems(moving, props()), [])

    def test_only_one_moving_second_is_not_enough(self):
        one = np.concatenate([np.full(5, 6.0), np.zeros(35)])
        self.assertTrue(F.first_seconds_problems(one, props()))


class Head(unittest.TestCase):
    def run_head(self, face, aspect='9:16'):
        size = (1080, 1920) if aspect == '9:16' else (1920, 1080)
        b = [beat('t', 0, 90, plate='take', layout='P1')]
        return F.head_problems('x.mp4', b, 30, aspect, lambda rgb: [face], lambda frame: np.zeros((size[1], size[0], 3), np.uint8))

    def test_a_head_with_its_crown_off_the_top_fails(self):
        self.assertTrue(self.run_head((400, 20, 300, 380))['cut'])

    def test_a_whole_head_passes(self):
        self.assertEqual(self.run_head((400, 600, 300, 380))['cut'], [])

    def test_on_a_wide_cut_the_face_must_sit_bottom_right(self):
        self.assertTrue(self.run_head((200, 100, 300, 300), '16:9')['outside'])
        self.assertEqual(self.run_head((1400, 600, 300, 300), '16:9')['outside'], [])

    def test_a_full_frame_clip_is_exempt(self):
        b = [beat('c', 0, 90, plate='none', layout='STAGE')]
        found = F.head_problems('x.mp4', b, 30, '16:9', lambda rgb: [(200, 100, 300, 300)], lambda f: np.zeros((1080, 1920, 3), np.uint8))
        self.assertEqual((found['cut'], found['outside'], found['no_face']), ([], [], []))


class Rows(unittest.TestCase):
    def test_a_piece_before_binds_from_is_advisory_and_after_is_counted(self):
        bad = props(ingredients={'transition': 'crossfade'})
        old = F.rows(None, bad, '2026-11-10')['transition.ghost_cut']
        new = F.rows(None, bad, '2026-11-18')['transition.ghost_cut']
        self.assertEqual(old['status'], 'advisory')
        self.assertNotIn('status', new)
        self.assertFalse(new['pass'])

    def test_no_detector_and_no_render_are_not_run_never_a_pass(self):
        r = F.rows(None, props(), '2026-11-18')
        for name in ('backdrop.not_flat_black', 'text.no_off_day_frames', 'title.stage_width'):
            self.assertEqual(r[name]['status'], 'not_run', name)
            self.assertIsNone(r[name]['pass'])

    def test_every_row_is_in_the_config_and_the_config_has_the_numbers(self):
        rules = F.config()
        for key in ('one_carrier', 'backdrop', 'figures', 'ghost_face', 'render_current', 'off_day_text', 'title', 'restarts', 'first_seconds', 'head'):
            self.assertIn('enforces', rules[key], key)
        self.assertRegex(rules['binds_from'], r'^\d{4}-\d{2}-\d{2}$')

    def test_the_spec_lints_are_part_of_ve_lint(self):
        spec = {'publish_day': '2026-11-18', 'cuts': {}, 'title_moment': {'title': 'x', 'line': 'x'}}
        self.assertTrue(any('title.card' in line for line in guards.spec_lints(spec)))


class MusicCertificate(unittest.TestCase):
    """Krish, Tue 17: a track he approved (Aspire, "100% licensed") was blocked by a certificate gate. The only licence gate in
    this repo is scripts/quick-edit/music.py; an approved track passes it with its licence file absent from the music folder
    ("A track Krish approved has had its licence checked once; a session never asks again", 2026-10-18)."""

    def test_the_approved_aspire_row_has_no_problem_and_the_live_ledger_has_no_error(self):
        import music  # noqa: PLC0415
        data = json.loads((ROOT / 'config' / 'music-library.json').read_text(encoding='utf-8'))
        aspire = next(t for t in data['tracks'] if t['id'] == 'aspire')
        self.assertEqual(music.problems(aspire, ('youtube', 'reels', 'tiktok')), [])
        errors, _ = music.check(data)
        self.assertEqual(errors, [])

    def test_an_approved_track_whose_licence_file_is_not_in_the_folder_still_passes_check(self):
        import tempfile  # noqa: PLC0415
        import music  # noqa: PLC0415
        data = copy.deepcopy(json.loads((ROOT / 'config' / 'music-library.json').read_text(encoding='utf-8')))
        track = next(t for t in data['tracks'] if t['id'] == 'aspire')
        track['licence_file'] = 'licences/not-in-this-folder.jpg'
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / track['file']).write_bytes(b'x')   # the track is there; its licence image is not
            data['root_default_windows'] = folder
            original = music.music_root
            music.music_root = lambda d: Path(folder)
            try:
                errors, _ = music.check(data)
            finally:
                music.music_root = original
        self.assertFalse([e for e in errors if 'aspire' in e and 'licence file' in e], errors)


if __name__ == '__main__':
    unittest.main()
