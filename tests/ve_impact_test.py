"""Impact zoom: the planner, its edge cases, its QC and its parity with the renderer and quick-edit.

Krish, 2026-11-26: "Can you make sure that on the most impactful words in any video, there's some form of camera zooming
to emulate a world-class professional? Zoom for impact. We should bake in all the obvious edge cases and have it be
classy and subtle rather than too aggressive." Every edge case below is one he named or one the motion floor names.

Run from the repository root: python -m pytest tests/ve_impact_test.py
"""
from __future__ import annotations

import copy
import re
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import impact, keepout, qc_faces  # noqa: E402
from velib.common import load_json  # noqa: E402

CFG = impact.load()
TEXT = ('Most people think the budget is safe, but nobody checks 40 percent of it. And that never shows up in the report '
        'until the money is gone for good. Then it is too late to fix anything at all, so we look again now.').split()
FACE = [0.45, 0.2, 0.1, 0.15]     # his face on a 4K wide take, a 9:16 cut's middle
TAKE_4K = {'width': 3840, 'height': 2160}
GAP_S = 0.5


def build(fps=30, aspect='9:16', texts=TEXT, emphasis=(), face=FACE, take_frame=TAKE_4K, **beat):
    """A cut of his take full frame, nothing over it, one word every GAP_S, the face track steady through it."""
    rows, words = [], []
    for i, text in enumerate(texts):
        onset = 0.5 + i * GAP_S
        words.append({'w': i, 'word': text, 'onset_s': onset, 'end_s': onset + 0.35, 'b_onset_s': onset, 'take': 't1'})
        rows.append({'w': i, 'text': text, 'atFrame': round(onset * fps), 'end_s': onset + 0.35})
    end = round((words[-1]['end_s'] + 0.4) * fps)
    pages = []
    for k in range(0, len(rows), 4):
        nxt = rows[k + 4]['atFrame'] if k + 4 < len(rows) else end
        pages.append({'fromFrame': rows[k]['atFrame'], 'toFrame': nxt, 'words': [{'text': r['text'], 'atFrame': r['atFrame']}
                                                                                    for r in rows[k:k + 4]], 'swipeIndex': None})
    b = {'id': 'b1', 'role': 'claim', 'layout': 'F1', 'fromFrame': 0, 'toFrame': end + 2 * fps, 'uses': [],
         'transitionOut': 'cut', 'plate': {'source': 'take'}, **beat}
    props = {'aspect': aspect, 'fps': fps, 'durationFrames': end + 2 * fps, 'beats': [b], 'captions': pages, 'events': [],
             'objects': [], 'segments': [{'src': 'take.mp4', 'trimBeforeFrames': 0, 'fromFrame': 0, 'durationFrames': end + 2 * fps}],
             'ending': {'fromFrame': end}}
    spec = {'cuts': {'c': {'take': 't1', 'captions': {'emphasis': list(emphasis)},
                           'beats': [{'id': 'b1', 'layout': b['layout'], 'span': {'from_w': 0, 'to_w': len(texts) - 1},
                                      'plate': b['plate']}]}},
            'assets': [{'id': 't1', 'kind': 'take'}], 'objects': []}
    faces = {'t1': [{'t': round(k * 0.2, 3), 'box': face} for k in range(int(end / fps / 0.2) + 2)]}
    return spec, rows, words, props, faces, take_frame


def plan(case, **kw):
    spec, rows, words, props, faces, take_frame = case
    args = dict(edl=None, faces=faces, take_frame=take_frame, fps=props['fps'])
    args.update(kw)
    report = {}
    out = impact.plan(spec, 'c', rows, words, props, report=report, **args)
    return out, report


class PicksTest(unittest.TestCase):
    def test_picks_the_impactful_words_rarely_and_within_every_cap(self):
        case = build()
        out, report = plan(case)
        self.assertTrue(out and out['hits'])
        stop = set(CFG['words']['stop'])
        props = dict(case[3], impact=out)
        self.assertEqual(impact.problems(props), [])
        starts = [h['fromFrame'] for h in out['hits']]
        self.assertTrue(all(b - a >= CFG['spacing']['min_gap_s'] * 30 for a, b in zip(starts, starts[1:])))
        self.assertTrue(all(impact.token(h['word']) not in stop for h in out['hits']))
        pages = [next(k for k, p in enumerate(case[3]['captions']) if p['fromFrame'] <= h['fromFrame'] < p['toFrame']) for h in out['hits']]
        self.assertEqual(len(pages), len(set(pages)))
        self.assertLessEqual(sum(h['strength'] == 'strong' for h in out['hits']), 1)
        self.assertTrue(all(h['scale'] <= CFG['scale']['strong_to']['9:16'] for h in out['hits']))
        # the number and the reversal are the cut's biggest words
        self.assertTrue({'40', 'nobody', 'never'} & {impact.token(h['word']) for h in out['hits']})
        self.assertEqual(report['impact']['hits'], len(out['hits']))

    def test_the_push_starts_on_the_word_and_holds_through_the_phrase(self):
        out, _ = plan(build())
        for h in out['hits']:
            self.assertEqual(h['peakFrame'] - h['fromFrame'], round(CFG['timing']['push_s'] * 30))
            self.assertGreaterEqual(h['holdTo'] - h['peakFrame'], round(CFG['timing']['hold_min_s'] * 30) - 1)
            self.assertTrue(h['release'] in ('ease', 'cut'))

    def test_a_cut_where_no_word_qualifies_gets_none(self):
        out, report = plan(build(texts=['the', 'a', 'of', 'to', 'and', 'it', 'is', 'so'] * 3))
        self.assertIsNone(out)
        self.assertEqual(report['impact']['hits'], 0)

    def test_frame_rate_independent(self):
        hits = {}
        for fps in (24, 30, 60):
            out, _ = plan(build(fps=fps))
            hits[fps] = [(h['word'], (h['peakFrame'] - h['fromFrame']) / fps, (h['toFrame'] - h['fromFrame']) / fps)
                         for h in out['hits']]
        for fps in (24, 60):
            self.assertEqual([w for w, *_ in hits[fps]], [w for w, *_ in hits[30]])
            for (_, push, length), (_, push30, length30) in zip(hits[fps], hits[30]):
                self.assertAlmostEqual(push, push30, delta=1 / 24)
                self.assertAlmostEqual(length, length30, delta=2 / 24)


class EdgesTest(unittest.TestCase):
    def assertNone(self, case, **kw):
        out, report = plan(case, **kw)
        self.assertIsNone(out, report)
        return report['impact']['skipped']

    def test_never_on_broll_window_split_stage_or_a_staged_beat(self):
        self.assertNone(build(backdrop={'src': 'b.jpg'}))
        self.assertNone(build(plate={'source': 'asset:broll'}))
        for layout in ('WINDOW', 'SPLIT', 'STAGE'):
            self.assertNone(build(layout=layout))
        case = build()
        case[3]['layout'] = {'mode': 'band'}
        self.assertNone(case)
        case = build()
        case[0]['cuts']['c']['beats'][0]['shot'] = 'plate'
        self.assertNone(case)

    def test_never_on_a_graphic_beat_or_a_screen_recording(self):
        for device in ('stamp', 'living_screen', 'hand_phone_stage'):
            case = build(uses=['obj'])
            case[3]['objects'] = [{'obj': 'obj', 'device': device}]
            self.assertNone(case)

    def test_never_with_an_ambient_camera_move_or_on_a_device_event(self):
        for camera in CFG['beats']['ambient_cameras_block']:
            case = build()
            case[3]['ingredients'] = {'camera': camera, 'transition': 'cut', 'energy': 'calm', 'hits': False}
            self.assertNone(case)
        case = build()
        base, _ = plan(case)
        first = base['hits'][0]
        case[3]['events'] = [{'id': 'e', 'obj': 'o', 'verb': 'enter', 'toState': 's', 'atFrame': first['fromFrame'] - 3}]
        out, _ = plan(case)
        self.assertNotIn(first['fromFrame'], [h['fromFrame'] for h in (out or {}).get('hits', [])])

    def test_never_across_a_picture_cut_and_a_reset_hides_under_one(self):
        case = build()
        base, _ = plan(case)
        first = base['hits'][0]
        fps = 30
        segs = [{'take': 't1', 'src_in_s': 0, 'src_out_s': 100, 'out_in_s': 0, 'out_out_s': 100}]
        # a join inside the push and its shortest hold: no push there
        join = (first['peakFrame'] + 5) / fps
        out, _ = plan(case, edl={'joins': [{'at_s': join}], 'segments': segs})
        self.assertNotIn(first['fromFrame'], [h['fromFrame'] for h in (out or {}).get('hits', [])])
        # a join after the shortest hold, before the release: the push resets under it
        join = (first['peakFrame'] + round(CFG['timing']['hold_min_s'] * fps) + 2) / fps
        out, _ = plan(case, edl={'joins': [{'at_s': join}], 'segments': segs})
        hit = next(h for h in out['hits'] if h['fromFrame'] == first['fromFrame'])
        self.assertEqual((hit['release'], hit['toFrame']), ('cut', round(join * fps)))
        self.assertEqual(impact.problems(dict(case[3], impact=out)), [])

    def test_release_completes_before_a_transition_and_the_end_card(self):
        case = build()
        fps = 30
        base, _ = plan(case)
        last = base['hits'][-1]
        # a second beat (a plate) entering by a transition just after the last push's shortest hold: it releases first
        boundary = last['peakFrame'] + round((CFG['timing']['hold_min_s'] + CFG['timing']['release_s']) * fps) + 6
        b1 = case[3]['beats'][0]
        b2 = dict(b1, id='b2', fromFrame=boundary, plate={'source': 'none'}, layout='STAGE')
        case[3]['beats'] = [dict(b1, toFrame=boundary, transitionOut='carry'), b2]
        out, _ = plan(case)
        for h in out['hits']:
            if h['fromFrame'] < boundary:
                self.assertLessEqual(h['toFrame'], boundary - round(CFG['edges']['transition_guard_s'] * fps))
                self.assertEqual(h['release'], 'ease')
        end = case[3]['ending']['fromFrame']
        self.assertTrue(all(h['toFrame'] <= end - round(CFG['edges']['cut_end_s'] * fps) for h in out['hits']))

    def test_first_and_last_moments_of_the_cut_are_left_alone(self):
        out, _ = plan(build(texts=['Nothing'] + TEXT, emphasis=[0]))
        self.assertTrue(all(h['fromFrame'] >= round(CFG['edges']['cut_start_s'] * 30) for h in out['hits']))
        case = build(texts=['Never'], emphasis=[0])
        case[3]['beats'][0]['fromFrame'] = 0
        self.assertNone(case)   # its only word is the cut's last half second

    def test_captions_stay_off_the_pushed_face(self):
        # a face low in the frame, just over the house caption band once pushed
        self.assertIn('the pushed face would meet a caption', self.assertNone(build(face=[0.45, 0.4953, 0.1, 0.1])))

    def test_only_the_active_speaker(self):
        case = build()
        case[0]['assets'] = [{'id': 't1', 'kind': 'take', 'speaker': 'guest'}]
        self.assertNone(case)
        case = build()
        for w in case[2]:
            w['take'] = 't2'   # the picture is on t1 while t2 speaks
        self.assertNone(case)

    def test_unsure_fumbled_or_retaken_words_are_skipped(self):
        case = build()
        for w in case[2]:
            w['b_onset_s'] = w['onset_s'] + 0.3
        self.assertNone(case)
        case = build()
        for w in case[2]:
            del w['b_onset_s']
        self.assertNone(case)   # unrated: never an automatic push
        case = build()
        base, _ = plan(case)
        first = base['hits'][0]
        segs = [{'take': 't1', 'src_in_s': 0, 'src_out_s': 100, 'out_in_s': 0, 'out_out_s': 100}]
        edl = {'joins': [], 'segments': segs, 'sounded_wrong': [{'take': 't1', 'src_s': first['fromFrame'] / 30, 'word': first['word']}]}
        out, _ = plan(case, edl=edl)
        self.assertNotIn(first['fromFrame'], [h['fromFrame'] for h in out['hits']])
        edl = {'joins': [], 'segments': segs, 'unscripted_kept': [{'take': 't1', 'src_s': first['fromFrame'] / 30 - 0.2}]}
        out, _ = plan(case, edl=edl)
        self.assertNotIn(first['fromFrame'], [h['fromFrame'] for h in out['hits']])

    def test_low_face_confidence_means_no_push(self):
        case = build()
        case[4]['t1'] = case[4]['t1'][::3]   # the track sees him a third of the time
        self.assertNone(case)
        case = build()
        case[4]['t1'] = [dict(s, box=[0.3 + (k % 2) * 0.1, 0.2, 0.1, 0.15]) for k, s in enumerate(case[4]['t1'])]
        self.assertNone(case)   # his face swings a whole face width
        self.assertNone(build(), faces={})

    def test_never_past_the_takes_resolution(self):
        self.assertNone(build(take_frame={'width': 1920, 'height': 1080}))   # a 1080p wide take cropped tall
        self.assertNone(build(take_frame=None))                               # unknown: cannot be proved sharp
        out, _ = plan(build(aspect='16:9', take_frame={'width': 1920, 'height': 1080}, face=[0.45, 0.25, 0.1, 0.2]))
        self.assertTrue(all(h['scale'] <= 1 / 0.9 + 1e-6 for h in out['hits']))
        self.assertAlmostEqual(impact.safe_zoom(TAKE_4K, (0, 0, 1080, 1920), 1.0, 0.9), 1.25, places=4)
        self.assertAlmostEqual(impact.safe_zoom({'width': 1920, 'height': 1080}, (0, 0, 1920, 1080), 1.0, 0.9), 1.1111, places=4)


class PinsTest(unittest.TestCase):
    def test_a_pin_chooses_the_word_and_its_strength(self):
        case = build()
        case[0]['cuts']['c']['impact'] = [{'at_w': 10, 'strength': 'strong'}]
        out, _ = plan(case)
        self.assertEqual([(h['w'], h['strength']) for h in out['hits']], [(10, 'strong')])
        self.assertLessEqual(out['hits'][0]['scale'], CFG['scale']['strong_to']['9:16'])

    def test_a_pin_on_an_unrated_word_is_his_call(self):
        case = build()
        for w in case[2]:
            del w['b_onset_s']
        case[0]['cuts']['c']['impact'] = [{'at_w': 10}]
        out, _ = plan(case)
        self.assertEqual(len(out['hits']), 1)

    def test_a_pin_that_breaks_a_hard_rule_is_refused(self):
        case = build(layout='SPLIT')
        case[0]['cuts']['c']['impact'] = [{'at_w': 10}]
        with self.assertRaisesRegex(ValueError, 'SPLIT'):
            plan(case)
        case = build()
        case[0]['cuts']['c']['impact'] = [{'at_w': 10}, {'at_w': 12}]
        with self.assertRaisesRegex(ValueError, 'closer than'):
            plan(case)

    def test_impact_off(self):
        case = build()
        case[0]['cuts']['c']['impact_off'] = True
        out, report = plan(case)
        self.assertIsNone(out)
        self.assertTrue(report['impact']['off'])

    def test_lint_names_a_pin_on_a_beat_that_never_carries_one(self):
        case = build(layout='WINDOW')
        case[0]['cuts']['c']['impact'] = [{'at_w': 3}]
        self.assertTrue(any('never carries an impact push' in line for line in impact.spec_lints(case[0])))
        case = build()
        case[0]['cuts']['c']['impact'] = [{'at_w': 3}]
        self.assertEqual(impact.spec_lints(case[0]), [])


class QcTest(unittest.TestCase):
    def setUp(self):
        case = build()
        out, _ = plan(case)
        self.props = dict(case[3], impact=out)

    def tamper(self, **change):
        props = copy.deepcopy(self.props)
        props['impact']['hits'][0].update(change)
        return impact.problems(props)

    def test_refuses_past_the_cap_or_too_fast(self):
        self.assertTrue(any('past the cap' in p for p in self.tamper(scale=1.2)))
        hit = self.props['impact']['hits'][0]
        self.assertTrue(any('a punch, not a push' in p for p in self.tamper(peakFrame=hit['fromFrame'] + 1)))

    def test_refuses_crowded_pushes_and_a_second_strong_one(self):
        props = copy.deepcopy(self.props)
        first = props['impact']['hits'][0]
        props['impact']['hits'].append(dict(first, fromFrame=first['fromFrame'] + 30, peakFrame=first['peakFrame'] + 30,
                                            holdTo=first['holdTo'] + 30, toFrame=first['toFrame'] + 30))
        found = impact.problems(props)
        self.assertTrue(any('closer than' in p for p in found) and any('has released' in p for p in found))
        props = copy.deepcopy(self.props)
        for h in props['impact']['hits']:
            h['strength'] = 'strong'
        if len(props['impact']['hits']) > 1:
            self.assertTrue(any('more than one strong' in p for p in impact.problems(props)))

    def test_refuses_a_push_on_a_banned_beat_or_event(self):
        props = copy.deepcopy(self.props)
        props['beats'][0]['layout'] = 'SPLIT'
        self.assertTrue(any('not his take full frame' in p for p in impact.problems(props)))
        props = copy.deepcopy(self.props)
        props['events'] = [{'atFrame': props['impact']['hits'][0]['fromFrame'] + 2}]
        self.assertTrue(any('device event' in p for p in impact.problems(props)))
        props = copy.deepcopy(self.props)
        props['ingredients'] = {'camera': 'drift'}
        self.assertTrue(any('F6' in p for p in impact.problems(props)))

    def test_the_qc_row(self):
        self.assertEqual(impact.qc_row(None)['status'], 'not applicable')
        row = impact.qc_row(self.props)
        self.assertTrue(row['pass'])
        self.assertLessEqual(row['value']['max_scale'], CFG['scale']['hard_cap'])

    def test_off_face_reads_every_pushed_frame(self):
        frames = qc_faces.impact_frames(self.props, self.props['captions'])
        hits = self.props['impact']['hits']
        self.assertEqual(len(frames), sum(h['toFrame'] - h['fromFrame'] for h in hits))
        seen = []
        result = qc_faces.off_face('video.mp4', self.props['captions'], aspect='9:16', props=self.props, region=keepout.HOUSE_BAND['9:16'],
                                   beats=self.props['beats'], detector=lambda rgb: [], grab=lambda f: seen.append(f) or None)
        self.assertTrue(result['pass'])
        self.assertEqual(result['value']['impact_frames'], len(frames))

    def test_the_keep_out_grows_with_the_pushed_face(self):
        props = copy.deepcopy(self.props)
        spec = build()[0]
        plain = copy.deepcopy(props)
        plain.pop('impact')
        tracks = build()[4]
        keepout.apply(plain, spec, 'c', edl=None, tracks=tracks, take_frame=TAKE_4K)
        keepout.apply(props, spec, 'c', edl=None, tracks=tracks, take_frame=TAKE_4K)
        a, b = plain['beats'][0]['faceKeepOut'], props['beats'][0]['faceKeepOut']
        self.assertGreater(b['width'] * b['height'], a['width'] * a['height'])


class ParityTest(unittest.TestCase):
    def test_every_number_is_a_config_row_citing_krish(self):
        self.assertIn('Krish, 2026-11-26', CFG['_about'])
        self.assertEqual(CFG['set'], '2026-11-26')
        self.assertLess(CFG['scale']['hard_cap'], CFG['scale']['library_cap'])
        self.assertLessEqual(max(CFG['scale']['strong_to'].values()), CFG['scale']['hard_cap'])
        source = (ROOT / 'scripts' / 'velib' / 'impact.py').read_text(encoding='utf-8')
        self.assertNotRegex(source, r'1\.0[5-9]\b|1\.1[05]\b')   # no scale in code

    def test_stop_words_and_reversals_are_the_caption_kits(self):
        kit = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'captions' / 'kit.ts').read_text(encoding='utf-8')
        stop = re.search(r"const STOP = new Set\(\((.*?)\)\.split", kit, re.S).group(1)
        words = ''.join(re.findall(r"'([^']*)'", stop)).split()
        self.assertEqual(sorted(words), sorted(CFG['words']['stop']))
        reversal = re.search(r"const REVERSAL = /n't\$\|\^\((.*?)\)\$/i", kit).group(1).split('|')
        self.assertEqual(sorted(reversal), sorted(CFG['words']['reversal']))

    def test_hero_score_matches_the_caption_kit(self):
        # kit.ts heroScore by hand: a number +5 +1, a reversal (content word) +2 +5 +1, a stop word +1 -3
        self.assertEqual(impact.hero_score('40', False, CFG), 6)
        self.assertEqual(impact.hero_score('never', False, CFG), 8)
        self.assertEqual(impact.hero_score('the', False, CFG), -2)
        self.assertEqual(impact.hero_score('budget,', True, CFG), 5)

    def test_quality_floor_is_the_virtual_cameras(self):
        camera = (ROOT / 'packages' / 'core' / 'src' / 'virtual-camera.ts').read_text(encoding='utf-8')
        self.assertEqual(float(re.search(r'qualityFloor: ([\d.]+)', camera).group(1)), CFG['face']['quality_floor'])
        self.assertEqual(float(re.search(r'eyeLine: ([\d.]+)', camera).group(1)), CFG['face']['eye_line'])
        self.assertEqual(float(re.search(r'absoluteMaxZoom: ([\d.]+)', camera).group(1)), CFG['scale']['library_cap'])

    def test_the_curve_is_the_renderers(self):
        hit = {'w': 3, 'word': 'never', 'fromFrame': 30, 'peakFrame': 41, 'holdTo': 70, 'toFrame': 91, 'scale': 1.06,
               'strength': 'normal', 'release': 'ease', 'originX': 540, 'originY': 700, 'eyeLine': 0.365}
        imp = {'pushEase': 'easeOutCubic', 'releaseEase': 'easeInOutCubic', 'joins': [], 'hits': [hit]}
        # the same numbers apps/renderer/src/engine/kit/impact.test.ts holds impactAt to
        self.assertAlmostEqual(impact.scale_at(imp, 35), 1.0502629601803155, places=9)
        self.assertEqual((impact.scale_at(imp, 29), impact.scale_at(imp, 91)), (1.0, 1.0))
        self.assertAlmostEqual(impact.scale_at(imp, 41), 1.06)
        renderer = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'kit' / 'impact.ts').read_text(encoding='utf-8')
        self.assertIn(f".max({CFG['scale']['hard_cap']})", renderer)

    def test_quick_edit_takes_the_same_push(self):
        sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
        import episode  # noqa: PLC0415
        self.assertAlmostEqual(1 / episode.CLOSE, CFG['scale']['push_to'][CFG['quick_edit']['aspect']], places=3)
        self.assertFalse(hasattr(episode, 'TIGHT'))
        self.assertIn(CFG['timing']['push_ease'], ('easeOutCubic',))
        expr = episode.impact_zoom_expr([(5.0, 7.0)], 1.0)
        self.assertIn(f"/{CFG['timing']['push_s']}", expr)
        self.assertIn(f"/{CFG['timing']['release_s']}", expr)


class CompileTest(unittest.TestCase):
    def test_compile_writes_measured_pushes_and_the_keep_out_models_them(self):
        from velib.compile import compile_cut  # noqa: PLC0415
        fixture = ROOT / 'fixtures' / 've' / 'my-test-19s'
        spec = load_json(fixture / 'spec.json')
        # The shared fixture still names a theme and look the v5 ruling retired (main's retirement); this test is about
        # the push, so it compiles on the live theme and no retired format look.
        spec['theme'] = load_json(ROOT / 'config' / 'studio.json')['default_brand_theme']
        spec['format'] = 'face-with-proof'
        spec['audio'] = dict(spec['audio'], master='dialogue')
        cut = spec['cuts']['proof-tall']
        for beat in cut['beats']:
            beat['uses'] = []
            beat.pop('events', None)
            beat['layout'] = 'F1'
        spec['assets'] = spec.get('assets', []) + [{'id': 'his-take', 'kind': 'take', 'path': 'take.mp4'}]
        cut['take'] = 'his-take'
        words = [dict(w, end_s=w['onset_s'] + 0.2, b_onset_s=w['onset_s']) for w in load_json(fixture / 'words.frames.json')]
        last = words[-1]['onset_s'] + 1
        faces = {'his-take': [{'t': round(k * 0.2, 3), 'box': FACE} for k in range(int(last / 0.2) + 2)]}
        report = {}
        props = compile_cut(spec, 'proof-tall', words, fixture, report=report, take_frame=TAKE_4K, faces=faces, matte=None)
        self.assertTrue(props['impact']['hits'])
        self.assertEqual(impact.problems(props), [])
        self.assertEqual(report['impact']['hits'], len(props['impact']['hits']))
        hit = props['impact']['hits'][0]
        self.assertNotIn(impact.token(hit['word']), set(CFG['words']['stop']))


if __name__ == '__main__':
    unittest.main()
