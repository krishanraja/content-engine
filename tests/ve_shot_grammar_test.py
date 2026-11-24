"""The shot grammar (Ruling, Krish, 2026-11-20): one staging per cut, generated imagery only as a metaphor, the grammar approved.

Each of the seven grammar.* lints is shown refusing what the rejected cuts did and passing what his good cuts do; the
planner (ve shots) writes a plan the lints pass; compile draws a grammar cut in one staging and caps the full-frame
title at 2 s; the retired variety rule is gone.
"""
from __future__ import annotations

import copy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib import compile as ve_compile, floor, grammar, shots  # noqa: E402
from velib.common import load_json, write_json  # noqa: E402

WPS = grammar.WORDS_PER_SECOND


def beat(bid, frm, to, shot=None, uses=(), events=(), layout='P1', role='anchor', **extra):
    b = {'id': bid, 'role': role, 'span': {'from_w': frm, 'to_w': to}, 'layout': layout, 'uses': list(uses),
         'events': list(events), 'plate': {'source': 'take'}, 'point': f'the point of beat {bid} in words', **extra}
    if shot:
        b['shot'] = shot
    return b


def enter(obj, at):
    return {'at_w': at, 'obj': obj, 'verb': 'enter', 'to_state': 'in'}


def change(obj, at):
    return {'at_w': at, 'obj': obj, 'verb': 'count_to', 'to_state': 'next'}


def words(seconds: float) -> int:
    """Words his read rate says in this many seconds."""
    return int(round(seconds * WPS))


def spec(beats, mode='band', aspect='9:16', objects=None, assets=None, cuts=None, captions=None):
    s = {'style': {'layout': {'mode': mode, 'reason': 'test'}},
         'brand': {'series': 'mind.the.gap', 'captions': 'house'},
         'objects': objects if objects is not None else [
             {'obj': 'stat', 'device': 'kinetic_stat', 'params': {}}, {'obj': 'bars', 'device': 'test_grid', 'params': {}},
             {'obj': 'shot1', 'device': 'evidence_card', 'params': {'src': 'img/receipt.png'}},
             {'obj': 'tag', 'device': 'stamp', 'params': {}}],
         'assets': assets if assets is not None else [
             {'id': 'receipt', 'kind': 'screenshot', 'origin': 'capture', 'path': 'img/receipt.png', 'sha256': 'a' * 64,
              'licence': 'fair dealing'}],
         'cuts': cuts or {'short': {'aspect': aspect, 'take': 'take-1', 'beats': beats}}}
    if captions:
        s['style']['captions'] = captions
    return s


def good_band():
    """Character.ai: one band, his face on screen the whole body, a device in the panel from the first second."""
    n = words(8)
    return spec([beat('hook', 0, n - 1, 'band', ['stat'], [enter('stat', 0)], role='hook'),
                 beat('proof', n, 2 * n - 1, 'band', ['shot1'], [enter('shot1', n)]),
                 beat('turn', 2 * n, 3 * n - 1, 'band', ['bars'], [enter('bars', 2 * n), change('bars', 2 * n + 5)], role='payoff')])


def good_anchor():
    """Eating its own jobs: face beats and plates of at least 4 s, face over 45% of the body, at most 4 switches a minute."""
    n = words(12)
    p = words(6)
    return spec([beat('hook', 0, n - 1, 'anchor', role='hook'),
                 beat('plate1', n, n + p - 1, 'plate', ['stat'], [enter('stat', n)], layout='STAGE', plate={'source': 'none'}),
                 beat('face', n + p, 2 * n + p - 1, 'anchor'),
                 beat('plate2', 2 * n + p, 2 * n + 2 * p - 1, 'plate', ['bars'], [enter('bars', 2 * n + p)], layout='STAGE',
                      plate={'source': 'none'}),
                 beat('close', 2 * n + 2 * p, 3 * n + 2 * p - 1, 'anchor', role='payoff')], mode='anchor')


def found(s, prefix):
    with patch.object(grammar, 'staging', side_effect=lambda sp, cut_id, d=None: ve_compile.cut_layout_mode(sp, cut_id, None)):
        return [f for f in grammar.check(s) if f.startswith(prefix)]


class StagingTest(unittest.TestCase):
    def test_his_good_cuts_pass_every_check(self):
        for name, s in (('band', good_band()), ('anchor', good_anchor())):
            with patch.object(grammar, 'staging', side_effect=lambda sp, cut_id, d=None: ve_compile.cut_layout_mode(sp, cut_id, None)):
                self.assertEqual(grammar.check(s), [], name)

    def test_a_cut_with_no_staging_or_a_mixed_body_is_refused(self):
        self.assertIn('one staging per cut', found(spec([beat('a', 0, 20, 'band')], mode='fill'), 'grammar.staging')[0])
        mixed = good_band()
        mixed['cuts']['short']['beats'][1]['shot'] = 'stage'
        self.assertTrue(any('the body keeps one staging, so it is band' in f for f in found(mixed, 'grammar.staging')))

    def test_a_plate_breaks_only_an_anchor_cut(self):
        s = good_band()
        s['cuts']['short']['beats'][1].update(shot='plate', layout='STAGE', plate={'source': 'none'})
        self.assertTrue(any('plates belong only to anchor cuts' in f for f in found(s, 'grammar.staging')))

    def test_anchor_is_refused_on_a_wide_cut(self):
        self.assertIn('anchor on 16:9 is refused', found(spec([beat('a', 0, 30, 'anchor')], mode='anchor', aspect='16:9'), 'grammar.staging')[0])

    def test_a_split_or_window_beat_and_a_missing_shot_are_refused(self):
        s = good_band()
        s['cuts']['short']['beats'][0]['layout'] = 'SPLIT'
        del s['cuts']['short']['beats'][2]['shot']
        got = found(s, 'grammar.staging')
        self.assertTrue(any('SPLIT beat switches the layout' in f for f in got))
        self.assertTrue(any('has no shot type' in f for f in got))

    def test_the_transition_matrix(self):
        s = good_anchor()
        s['cuts']['short']['beats'][2]['shot'] = 'chapter'   # plate -> chapter is not allowed
        self.assertTrue(any('plate may not hand to chapter' in f for f in found(s, 'grammar.staging')))

    def test_a_title_shot_needs_the_line_he_says(self):
        s = good_band()
        s['cuts']['short']['beats'][0]['shot'] = 'title'
        self.assertTrue(any('detached title card' in f for f in found(s, 'grammar.staging')))
        s['title_moment'] = {'title': 'Money or skeletons', 'line': 'money or skeletons we will see',
                             'spans': {'short': {'from_w': 2, 'to_w': 5}}}
        self.assertFalse(any('detached title card' in f for f in found(s, 'grammar.staging')))


class FaceRunsTest(unittest.TestCase):
    def test_tue_17_flicker_is_refused(self):
        """Tue 17: 1 s runs without his face, 9.9 switches a minute."""
        n, one = words(5), words(1)
        beats, at = [], 0
        for i in range(8):
            beats.append(beat(f'f{i}', at, at + n - 1, 'anchor'))
            at += n
            beats.append(beat(f'p{i}', at, at + one - 1, 'plate', ['stat'], [enter('stat', at)], layout='STAGE', plate={'source': 'none'}))
            at += one
        got = found(spec(beats, mode='anchor'), 'grammar.face_runs')
        self.assertTrue(any('run without his face lasts 1.2 s' in f for f in got), got)
        self.assertTrue(any('face switches' in f for f in got), got)

    def test_face_share_on_a_band_cut(self):
        s = good_band()
        s['cuts']['short']['beats'][1]['face'] = 'off'
        self.assertTrue(any('his face is on 67% of the body' in f for f in found(s, 'grammar.face_runs')))

    def test_anchor_with_plates_overall_floor(self):
        s = good_anchor()
        for b in s['cuts']['short']['beats']:
            if b['shot'] == 'plate':
                b['span']['to_w'] += 0   # keep spans; shrink the face beats instead
        s['cuts']['short']['beats'][0]['face'] = 'off'
        self.assertTrue(any('of the anchor beats' in f for f in found(s, 'grammar.face_runs')))

    def test_chapter_mark_and_end_card_lengths(self):
        s = good_band()
        b = s['cuts']['short']['beats']
        last = b[-1]['span']['to_w']
        b.append(beat('ch', last + 1, last + words(3), 'chapter'))
        b.append(beat('end', last + words(3) + 1, last + words(3) + words(1.5), 'end', role='call'))
        got = found(s, 'grammar.face_runs')
        self.assertTrue(any('a chapter mark holds' in f for f in got), got)
        self.assertTrue(any('the end card holds' in f for f in got), got)

    def test_aligned_words_give_real_seconds(self):
        cut = {'beats': [beat('a', 0, 1), beat('b', 2, 3)]}
        rows = {0: {'w': 0, 'onset_s': 0.0}, 1: {'w': 1, 'onset_s': 0.5}, 2: {'w': 2, 'onset_s': 5.0},
                3: {'w': 3, 'onset_s': 5.5, 'end_s': 6.0}}
        self.assertEqual(grammar.beat_seconds(cut, rows), [5.0, 1.0])


class RegionTest(unittest.TestCase):
    def test_wed_18_empty_panel_is_refused(self):
        s = good_band()
        s['cuts']['short']['beats'][1]['events'] = [enter('shot1', s['cuts']['short']['beats'][1]['span']['from_w'] + 6)]
        got = found(s, 'grammar.region')
        self.assertTrue(any('the panel holds nothing for about' in f for f in got), got)

    def test_a_full_frame_picture_in_his_place_is_refused(self):
        s = good_band()
        s['cuts']['short']['beats'][1]['plate'] = {'source': 'asset:receipt'}
        self.assertTrue(any('replaces his take' in f for f in found(s, 'grammar.region')))

    def test_a_device_that_does_not_fill_the_panel_is_refused(self):
        s = good_band()
        s['objects'][1]['device'] = 'quota_chart'
        self.assertTrue(any('does not grow to fill the band region' in f for f in found(s, 'grammar.region')))

    def test_a_device_that_places_itself_is_refused(self):
        s = good_band()
        s['objects'][0]['params'] = {'place': {'left': 0, 'top': 0, 'width': 10, 'height': 10}}
        self.assertTrue(any('sets its own place' in f for f in found(s, 'grammar.region')))


class EvidenceSizeTest(unittest.TestCase):
    def test_a_small_real_image_and_small_words_are_refused(self):
        s = good_band()
        s['objects'][2]['params'] = {'src': 'img/receipt.png', 'width': 0.2, 'fontSize': 28}
        got = found(s, 'grammar.evidence_size')
        self.assertTrue(any('0.20 of the frame wide' in f for f in got), got)
        self.assertTrue(any('fontSize is 28 px' in f for f in got), got)

    def test_a_real_image_sharing_its_region_is_refused(self):
        s = good_band()
        s['cuts']['short']['beats'][1]['uses'] = ['shot1', 'stat', 'tag']
        self.assertTrue(any('shares the region with 1 other' in f for f in found(s, 'grammar.evidence_size')))

    def test_a_stamp_beside_the_image_is_allowed(self):
        s = good_band()
        s['cuts']['short']['beats'][1]['uses'] = ['shot1', 'tag']
        self.assertEqual(found(s, 'grammar.evidence_size'), [])


class GeneratedTest(unittest.TestCase):
    """Ruling, Krish, 2026-11-20 (correcting the morning's "never"): generated imagery, photoreal included, is allowed when
    art-directed and clearly a metaphor; generated stand-ins for real documents, signs, places or people are refused."""

    def croc(self, **extra):
        return {'id': 'crocodile', 'kind': 'illustration', 'origin': 'generated', 'tool': 'higgsfield',
                'path': 'img/croc.png', 'sha256': 'b' * 64, 'licence': 'generated', **extra}

    def test_a_metaphor_is_allowed(self):
        s = good_band()
        s['assets'].append(self.croc(depicts='metaphor'))
        self.assertEqual(found(s, 'grammar.generated'), [])

    def test_a_stand_in_for_a_real_thing_is_refused(self):
        s = good_band()
        s['assets'].append(self.croc(id='town-sign', depicts='real'))
        out = found(s, 'grammar.generated')
        self.assertEqual(len(out), 1)
        self.assertIn('assets.town-sign', out[0])
        self.assertIn('stands in for a real document, sign, place or person', out[0])

    def test_an_undeclared_generated_picture_is_refused_until_declared(self):
        s = good_band()
        s['assets'].append(self.croc())
        self.assertIn('does not say what it depicts', found(s, 'grammar.generated')[0])

    def test_a_generated_picture_still_never_takes_his_place_on_a_staged_cut(self):
        s = good_band()
        s['assets'].append(self.croc(depicts='metaphor'))
        s['cuts']['short']['beats'][1]['plate'] = {'source': 'asset:crocodile'}
        self.assertTrue(any('full-frame picture (asset:crocodile)' in f for f in found(s, 'grammar.region')))

    def test_his_clone_voice_and_sound_are_not_pictures(self):
        s = good_band()
        s['assets'].append({'id': 'voice', 'kind': 'voice', 'origin': 'generated', 'tool': 'elevenlabs.voice_clone:krish',
                            'path': 'voice.wav', 'sha256': 'c' * 64, 'licence': 'own'})
        s['assets'].append({'id': 'whoosh', 'kind': 'sfx', 'origin': 'generated', 'tool': 'elevenlabs',
                            'path': 'w.wav', 'sha256': 'd' * 64, 'licence': 'own'})
        self.assertEqual(found(s, 'grammar.generated'), [])

    def test_ve_brief_asks_for_a_metaphor_for_a_bound_piece(self):
        directory = Path(tempfile.mkdtemp())
        undeclared = {'assets': [self.croc()]}
        write_json(directory / 'engine.json', {'at': '2026-11-19T09:00:00Z'})
        self.assertIsNone(grammar.generation_refusal(undeclared, directory))
        write_json(directory / 'engine.json', {'at': '2026-11-23T09:00:00Z'})
        self.assertIn('depicts: metaphor', grammar.generation_refusal(undeclared, directory))
        self.assertIn('stands in', grammar.generation_refusal({'assets': [self.croc(depicts='real')]}, directory))
        self.assertIsNone(grammar.generation_refusal({'assets': [self.croc(depicts='metaphor')]}, directory))
        self.assertIsNone(grammar.generation_refusal({}, directory))

    def test_every_recipe_names_the_generated_kinds_it_may_use(self):
        for path in sorted((ROOT / 'config' / 've' / 'recipes').glob('*.json')):
            r = load_json(path)
            self.assertTrue(r['generated_kinds'], path.name)
            self.assertTrue(set(r['generated_kinds']) <= {'illustration', 'broll'}, path.name)
        self.assertEqual(load_json(ROOT / 'config/ve/recipes/ai-music-slam.json')['generated_kinds'], ['illustration', 'broll'])


class RepeatTest(unittest.TestCase):
    def test_tue_17_box_five_times_is_refused(self):
        n = words(4)
        beats, at = [], 0
        for i in range(5):
            beats.append(beat(f'box{i}', at, at + n - 1, 'band', ['stat'], [enter('stat', at)]))
            at += n
            beats.append(beat(f'gap{i}', at, at + n - 1, 'band', ['bars'], [enter('bars', at), change('bars', at + 3)]))
            at += n
        got = found(spec(beats), 'grammar.repeat')
        self.assertTrue(any('kinetic_stat appears 5 times' in f for f in got), got)

    def test_twice_running_without_a_new_state_is_refused(self):
        s = good_band()
        b = s['cuts']['short']['beats']
        b[1]['uses'] = ['stat']
        b[1]['events'] = [{'at_w': b[1]['span']['from_w'], 'obj': 'stat', 'verb': 'carry', 'to_state': 'same'}]
        self.assertTrue(any('returns from the beat before with no new state' in f for f in found(s, 'grammar.repeat')))
        b[1]['events'] = [change('stat', b[1]['span']['from_w'])]
        self.assertEqual(found(s, 'grammar.repeat'), [])


class CaptionZoneTest(unittest.TestCase):
    def test_a_themed_caption_keeps_one_zone(self):
        s = good_band()
        s['style']['captions'] = {'theme': 'receipt-chip', 'placement': 'lower', 'reason': 'test'}
        self.assertEqual(found(s, 'grammar.caption_zone'), [])

    def test_word_captions_that_move_with_the_layout_are_refused(self):
        s = good_band()
        s['brand']['captions'] = 'word'
        s['cuts']['short']['beats'][1]['layout'] = 'SPLIT'
        got = found(s, 'grammar.caption_zone')
        self.assertTrue(got and 'one zone a cut' in got[0], got)


class BindsTest(unittest.TestCase):
    def test_ve_lint_asks_it_only_of_pieces_frozen_from_the_date(self):
        s = spec([beat('a', 0, 20)], mode='fill')
        directory = Path(tempfile.mkdtemp())
        write_json(directory / 'engine.json', {'at': '2026-11-20T09:00:00Z'})
        with patch('velib.verdict.ve_dir', return_value=directory):
            self.assertEqual(grammar.lints(s, directory / 'spec.json'), [])
            write_json(directory / 'engine.json', {'at': '2026-11-23T09:00:00Z'})
            self.assertTrue(grammar.lints(s, directory / 'spec.json'))
        self.assertEqual(floor.RECIPE_FROM, '2026-11-23')


class PlannerTest(unittest.TestCase):
    def test_ve_shots_writes_a_plan_the_lints_pass(self):
        s = good_anchor()
        for b in s['cuts']['short']['beats']:
            b.pop('shot')
        s['cuts']['short']['beats'][1]['layout'] = 'SPLIT'
        s['cuts']['short']['beats'][1]['face'] = 'off'
        with patch.object(grammar, 'staging', side_effect=lambda sp, cut_id, d=None: ve_compile.cut_layout_mode(sp, cut_id, None)):
            shots.plan(s)
            self.assertEqual([b['shot'] for b in s['cuts']['short']['beats']], ['anchor', 'plate', 'anchor', 'plate', 'anchor'])
            self.assertEqual(s['cuts']['short']['beats'][1]['plate'], {'source': 'none'})
            self.assertEqual(grammar.check(s), [])
            board = Path(tempfile.mkdtemp()) / 'storyboard.md'
            board.write_text('# Storyboard\n\nHis notes stay.\n', encoding='utf-8')
            shots.write_storyboard(board, shots.table_md(s))
            shots.write_storyboard(board, shots.table_md(s))
            text = board.read_text(encoding='utf-8')
        self.assertEqual(text.count(shots.START), 1)
        self.assertIn('His notes stay.', text)
        self.assertIn('one staging, **anchor**', text)
        self.assertIn('| plate1 | plate |', text)

    def test_a_band_cut_keeps_a_graphics_only_beat_in_the_panel(self):
        s = good_band()
        for b in s['cuts']['short']['beats']:
            b.pop('shot')
        s['cuts']['short']['beats'][1].update(layout='STAGE', plate={'source': 'none'})
        with patch.object(grammar, 'staging', side_effect=lambda sp, cut_id, d=None: ve_compile.cut_layout_mode(sp, cut_id, None)):
            shots.plan(s)
        self.assertEqual(s['cuts']['short']['beats'][1]['shot'], 'band')

    def test_the_planner_refuses_a_cut_with_no_staging(self):
        with self.assertRaises(ValueError):
            shots.plan_cut(spec([beat('a', 0, 20)], mode='fill'), 'short', 'fill')

    def test_per_cut_staging(self):
        s = spec([], cuts={'short': {'aspect': '9:16', 'take': 't', 'beats': []}, 'long': {'aspect': '16:9', 'take': 't', 'beats': []}})
        s['style']['layout'] = {'mode': 'band', 'cuts': {'short': 'anchor'}, 'reason': 'test'}
        self.assertEqual(ve_compile.cut_layout_mode(s, 'short'), 'anchor')
        self.assertEqual(ve_compile.cut_layout_mode(s, 'long'), 'band')


class PaceBodyTest(unittest.TestCase):
    """The pace floor measures the body only: the 6 s house close held every 16:9 recipe sample (20 Nov 2026)."""

    def test_the_end_card_and_the_title_are_left_out(self):
        directory = Path(tempfile.mkdtemp())
        write_json(directory / 'props.long.json', {'fps': 30, 'durationFrames': 900, 'ending': {'fromFrame': 720},
                                                   'titleMoment': {'fromFrame': 60, 'fullFrom': 120, 'toFrame': 180}})
        self.assertEqual(floor.fixed_moments(directory, 'long'), [(4.0, 6.0), (24.0, 30.0)])
        seen = {}

        def measure(_video, exclude=None):
            seen['exclude'] = exclude
            return {'events_per_s': 3.0}
        video = directory / 'long.mp4'
        video.write_bytes(b'x')
        floor._measure_cached(video, 'd' * 64, directory, 'long', measure)
        self.assertEqual(seen['exclude'], [(4.0, 6.0), (24.0, 30.0)])

    def test_a_still_close_no_longer_makes_the_longest_gap(self):
        import numpy as np
        from velib import pace
        rng = np.random.default_rng(1)
        body = []
        for i in range(10 * pace.SAMPLE_FPS):   # a picture change every half second
            body.append(rng.integers(0, 255, (pace.GRID_H, pace.GRID_W)).astype(np.float32) if i % (pace.SAMPLE_FPS // 2) == 0
                        else body[-1])
        close = [body[-1]] * (6 * pace.SAMPLE_FPS)
        clip = np.stack(body + close)
        with patch.object(pace, 'frames', return_value=clip):
            whole = pace.measure('cut.mp4')
            only_body = pace.measure('cut.mp4', exclude=[(10.0, 16.0)])
        self.assertGreater(whole['longest_gap_s'], 5)
        self.assertLess(only_body['longest_gap_s'], 1.5)


class TitleBarsTest(unittest.TestCase):
    def test_the_title_lockup_bars_are_not_a_smear_but_a_smear_elsewhere_still_fails(self):
        from velib import qc
        props = {'fps': 30, 'titleMoment': {'fromFrame': 555, 'toFrame': 620}}
        row = {'value': [{'from_s': 18.5, 'to_s': 20.75}], 'pass': False}
        self.assertTrue(qc.without_title_bars(row, props)['pass'])
        row = {'value': [{'from_s': 18.5, 'to_s': 20.75}, {'from_s': 30.0, 'to_s': 31.0}], 'pass': False}
        self.assertFalse(qc.without_title_bars(row, props)['pass'])
        self.assertEqual(qc.without_title_bars(row, None), row)


class RetiredTest(unittest.TestCase):
    def test_the_variety_rule_and_the_dead_face_cap_are_gone(self):
        for path in (ROOT / 'config' / 've' / 'formats').glob('*.json'):
            qc = load_json(path).get('qc') or {}
            self.assertNotIn('layout_types_per_min_tall', qc, path.name)
            self.assertNotIn('face_share_max', qc, path.name)
        self.assertNotIn('layout_variety', (ROOT / 'scripts' / 'velib' / 'lint.py').read_text(encoding='utf-8'))
        self.assertNotIn('pivot-split', (ROOT / 'config' / 've' / 'treatments.json').read_text(encoding='utf-8'))

    def test_the_title_holds_full_frame_at_most_two_seconds_under_the_grammar(self):
        cut = {'beats': [beat('a', 0, 10, 'band')]}
        moment = {'fromFrame': 10, 'toFrame': 400, 'words': [{'text': 'Money', 'atFrame': 10}, {'text': 'skeletons', 'atFrame': 40}]}
        got = ve_compile.grammar_title(cut, copy.deepcopy(moment))
        self.assertEqual(got, {'fullFrom': 40, 'toFrame': 100})
        self.assertEqual(ve_compile.grammar_title({'beats': [beat('a', 0, 10)]}, copy.deepcopy(moment)), {})


if __name__ == '__main__':
    unittest.main()
