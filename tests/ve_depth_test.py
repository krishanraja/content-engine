"""Depth and the staging fixes (shot grammar step 5, 20 Nov 2026): each new check and device shown refusing and passing.

- the matte step (velib/matte.py): the halo clipped by confidence, the silhouette, the cache keyed by the take's sha256;
- compile's depth (velib/depth.py): props.matte, the in-world number and chapter marks with his head, the anchor title
  behind his head, the body keep-out on anchor and on a cut-out stage, and a refusal with no matte;
- ve lint grammar.depth: the in-world number's size, time and matte, a chapter mark's arrangement and matte, the anchor
  title's matte; grammar.title_timing: the title on his spoken words within 30 s;
- the keep-out reads FormatMaster's face lift; the after-render panel.fill row (velib/qc_fill.py).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib import compile as ve_compile, depth, grammar, keepout, matte, qc_fill  # noqa: E402
from velib.common import write_json  # noqa: E402

FFMPEG = shutil.which('ffmpeg') is not None


def beat(bid, frm, to, shot, uses=(), **extra):
    return {'id': bid, 'role': 'anchor', 'span': {'from_w': frm, 'to_w': to}, 'layout': 'P1', 'uses': list(uses), 'events': [],
            'plate': {'source': 'take'}, 'point': f'the point of beat {bid} in words', 'shot': shot, **extra}


def anchor_spec(beats, title=False):
    s = {'style': {'layout': {'mode': 'anchor', 'reason': 'test'}}, 'brand': {'series': 'mind.the.gap', 'captions': 'house'},
         'objects': [{'obj': 'stat', 'device': 'kinetic_stat', 'params': {}},
                     {'obj': 'photo', 'device': 'evidence_card', 'params': {'src': 'img/a.png'}}],
         'assets': [], 'cuts': {'short': {'aspect': '9:16', 'take': 'take-1', 'beats': beats}}}
    if title:
        s['title_moment'] = {'title': 'Find the money', 'line': 'So will it find the money', 'spans': {'short': {'from_w': 10, 'to_w': 15}}}
    return s


def lints(s, directory=None, prefix='grammar.'):
    with patch.object(grammar, 'staging', side_effect=lambda sp, cut_id, d=None: ve_compile.cut_layout_mode(sp, cut_id, None)):
        return [f for f in grammar.check(s, directory) if f.startswith(prefix)]


# ------------------------------------------------------------------------------------------------------------- matte

class MatteTest(unittest.TestCase):
    def test_the_halo_is_clipped_by_confidence_and_eroded(self):
        prob = np.zeros((9, 9), np.float32)
        prob[2:7, 2:7] = 0.95
        prob[0, :] = 0.40          # an unsure fringe (a fast hand's smear): not him
        alpha = matte.clip_alpha(prob)
        self.assertEqual(alpha[0].max(), 0)
        self.assertEqual(alpha[4, 4], 255)
        self.assertEqual(alpha[2, 2], 0)   # eroded one pixel at the edge
        self.assertEqual(matte.clip_alpha(np.full((3, 3), 0.6), erode=0)[1, 1], round(255 * (0.6 - 0.45) / 0.35))

    def test_the_silhouette_is_first_and_last_column_per_band(self):
        alpha = np.zeros((80, 10), np.uint8)
        alpha[45:60, 3:7] = 255
        self.assertEqual(matte.silhouette(alpha, 40), [None, [3, 6]])

    def test_the_cache_is_keyed_by_the_takes_bytes(self):
        root = Path(tempfile.mkdtemp())
        take = root / 'take.mov'
        take.write_bytes(b'take bytes')
        self.assertIsNone(matte.cached(take, root))
        sha = matte._sha(take)
        folder = matte.cache_dir(sha, root)
        folder.mkdir(parents=True)
        (folder / 'subject.mov').write_bytes(b's')
        (folder / 'matte.mp4').write_bytes(b'm')
        write_json(folder / 'matte.json', {'take_sha256': sha, 'version': matte.VERSION})
        self.assertEqual(matte.cached(take, root)['subject'], str(folder / 'subject.mov'))
        write_json(folder / 'matte.json', {'take_sha256': sha, 'version': matte.VERSION - 1})
        self.assertIsNone(matte.cached(take, root), 'a matte from an older recipe is made again')
        take.write_bytes(b'other bytes')
        self.assertIsNone(matte.cached(take, root), 'other bytes are another take')

    @unittest.skipUnless(FFMPEG, 'ffmpeg')
    def test_ensure_writes_the_subject_with_alpha_and_refuses_a_matte_of_other_bytes(self):
        root = Path(tempfile.mkdtemp())
        take = root / 'take.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=32x64:rate=30', '-frames:v', '3',
                        '-pix_fmt', 'yuv420p', str(take)], check=True)
        gray = root / 'take.matte.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:size=32x64:rate=30', '-frames:v', '3',
                        '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'gray', str(gray)], check=True)
        write_json(gray.with_suffix('.json'), {'take_sha256': '0' * 64, 'frames': 3})
        with self.assertRaisesRegex(ValueError, 'other bytes'):
            matte.ensure(take, root / 'cache', from_matte=gray)
        write_json(gray.with_suffix('.json'), {'take_sha256': matte._sha(take), 'frames': 3, 'width': 32, 'height': 64})
        record = matte.ensure(take, root / 'cache', from_matte=gray)
        self.assertEqual(len(record['profile']), 3)
        self.assertEqual(record['profile'][0][0], [0, 31])
        probe = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                         'stream=pix_fmt,codec_name', '-of', 'csv=p=0', record['subject']], text=True)
        self.assertIn('prores', probe)
        self.assertIn('yuva', probe)
        self.assertTrue(matte.ensure(take, root / 'cache')['cached'])


# ------------------------------------------------------------------------------------------------------------- depth

def record(head_top=640, body_cols=(300, 780), arms=None, frames=200):
    """A fake matte record of a 1080x1920 take: his head from head_top, his body below it; `arms` (y0, y1, x0, x1) adds
    raised hands."""
    step = 40
    rows = []
    for i in range(1920 // step):
        y = i * step
        if y < head_top:
            row = None
        elif y < head_top + 280:
            row = [430, 650]
        else:
            row = list(body_cols)
        if arms and arms[0] <= y < arms[1]:
            row = [min(arms[2], row[0]), max(arms[3], row[1])] if row else [arms[2], arms[3]]
        rows.append(row)
    return {'profile_step': step, 'profile': [rows] * frames, 'width': 1080, 'height': 1920,
            'take_sha256': 'a' * 64, 'subject_sha256': 'b' * 64, 'subject': __file__}


def props_for(spec, beats_frames, title=None):
    p = {'aspect': '9:16', 'layout': {'mode': 'anchor', 'grammar': True}, 'segments': [{'src': '', 'trimBeforeFrames': 0}],
         'beats': [{'id': b, 'fromFrame': a, 'toFrame': z} for b, a, z in beats_frames]}
    if title:
        p['titleMoment'] = title
    return p


class DepthCompileTest(unittest.TestCase):
    def setUp(self):
        self.assets = Path(tempfile.mkdtemp())
        (self.assets / 'take.mov').write_bytes(b'take')

    def apply(self, spec, props, rec):
        props['segments'][0]['src'] = str(self.assets / 'take.mov')
        rows = [{'w': i, 'atFrame': i * 10} for i in range(40)]
        return depth.apply(props, spec, 'short', rows, rec, self.assets)

    def test_no_matte_refuses_type_behind_him(self):
        spec = anchor_spec([beat('a', 0, 4, 'anchor'), beat('n', 5, 9, 'number', world={'text': 'NO', 'at_w': 6})])
        found = self.apply(spec, props_for(spec, [('a', 0, 50), ('n', 50, 100)]), None)
        self.assertIn('depth.matte beat n', found[0])
        spec = anchor_spec([beat('a', 0, 4, 'anchor')])
        self.assertEqual(self.apply(spec, props_for(spec, [('a', 0, 50)]), None), [])

    def test_the_in_world_number_chapter_and_title_get_his_head(self):
        spec = anchor_spec([beat('a', 0, 4, 'anchor'), beat('n', 5, 9, 'number', world={'text': 'NO', 'at_w': 6}),
                            beat('b', 10, 14, 'anchor'), beat('c', 15, 16, 'chapter', chapter={'mark': '1', 'arrangement': 'beside_right'})])
        title = {'fromFrame': 100, 'toFrame': 400, 'fullFrom': 140, 'words': [{'text': 'Find', 'atFrame': 100}, {'text': 'it', 'atFrame': 130}]}
        props = props_for(spec, [('a', 0, 50), ('n', 50, 100), ('b', 100, 150), ('c', 150, 165)], title)
        self.assertEqual(self.apply(spec, props, record()), [])
        self.assertEqual(props['matte']['sha256'], 'b' * 64)
        self.assertTrue(Path(props['matte']['src']).name.endswith('.subject.mov'))
        number, chapter = props['depth']
        self.assertEqual((number['kind'], number['text'], number['atFrame']), ('number', 'NO', 60))
        self.assertEqual((chapter['arrangement'], chapter['behind']), ('beside_right', True))
        head = number['head']
        self.assertEqual(head['top'], round(1920 - (1920 - 640) * depth.FACE_LIFT))   # the lift raises his head 64 px
        self.assertNotIn('fullFrom', props['titleMoment'])
        self.assertEqual(props['titleMoment']['toFrame'], 100 + 180, 'behind him the title holds at most 6 s')
        box = props['titleMoment']['behind']
        self.assertEqual(box['top'], 270)
        self.assertEqual(box['top'] + box['height'], round(head['top'] + 1920 * 0.12))

    def test_the_body_keep_out_refuses_a_card_on_his_hands_and_passes_a_clear_head(self):
        spec = anchor_spec([beat('a', 0, 9, 'anchor', ['stat'])])
        clear = self.apply(spec, props_for(spec, [('a', 0, 60)]), record())
        self.assertEqual(clear, [])
        raised = self.apply(spec, props_for(spec, [('a', 0, 60)]), record(arms=(200, 520, 100, 900)))
        self.assertIn('body.keep_out beat a', raised[0])
        self.assertIn('the space above his head', raised[0])

    def test_a_prop_beside_him_is_refused_where_his_arm_is(self):
        spec = anchor_spec([beat('a', 0, 9, 'anchor', ['photo'])])
        wide = self.apply(spec, props_for(spec, [('a', 0, 60)]), record(body_cols=(20, 1000)))
        self.assertTrue(any('the prop beside him' in f for f in wide))
        narrow = self.apply(spec, props_for(spec, [('a', 0, 60)]), record(body_cols=(400, 780)))
        self.assertFalse(any('the prop beside him' in f for f in narrow))

    def test_a_cut_out_stage_keeps_its_region_off_him(self):
        spec = anchor_spec([beat('a', 0, 9, 'stage', ['stat'])])
        spec['style']['layout']['mode'] = 'stage'
        props = props_for(spec, [('a', 0, 60)])
        props['layout']['mode'] = 'stage'
        self.assertEqual(self.apply(spec, props, record()), [])
        # His take sits bottom right in the stage box; a head this high crosses the region.
        found = self.apply(spec, props, record(head_top=0, body_cols=(0, 1079)))
        self.assertIn('the stage region', found[0])

    def test_the_mapper_follows_cover_and_the_face_lift(self):
        to_frame = depth.mapper((0, 0, 1080, 1920), 1080, 1920, '9:16')
        self.assertEqual(to_frame(540, 1920), (540, 1920))
        self.assertEqual(to_frame(540, 0), (540, 1920 - 1920 * 1.1))
        wide = depth.mapper((1360, 380, 560, 700), 1080, 1920, '16:9')
        x, y = wide(540, 960)
        self.assertAlmostEqual(x, 1360 + 280)
        self.assertAlmostEqual(y, 380 + 350)


class KeepOutLiftTest(unittest.TestCase):
    def test_the_face_box_is_lifted_like_the_render(self):
        flat = keepout.to_frame([0.4, 0.3, 0.2, 0.2], (0, 0, 1080, 1920), {'width': 1080, 'height': 1920})
        lifted = keepout.to_frame([0.4, 0.3, 0.2, 0.2], (0, 0, 1080, 1920), {'width': 1080, 'height': 1920}, keepout.FACE_LIFT)
        self.assertLess(lifted[1], flat[1])
        self.assertGreater(lifted[3], flat[3])


# -------------------------------------------------------------------------------------------------------------- lint

class DepthLintTest(unittest.TestCase):
    def matte_dir(self):
        directory = Path(tempfile.mkdtemp())
        root = directory / 'cache'
        folder = matte.cache_dir('c' * 64, root)
        folder.mkdir(parents=True)
        (folder / 'matte.json').write_text('{}')
        (folder / 'subject.mov').write_bytes(b's')
        write_json(directory / 'matte.short.json', {'picture_sha256': 'c' * 64, 'cache': str(root)})
        return directory

    def test_an_in_world_number_needs_the_matte_a_short_word_and_1_to_6_s(self):
        n = round(3 * grammar.WORDS_PER_SECOND)
        good = anchor_spec([beat('a', 0, 19, 'anchor'), beat('n', 20, 20 + n, 'number', world={'text': 'NO', 'at_w': 21}),
                            beat('b', 21 + n, 40 + n, 'anchor')])
        self.assertEqual(lints(good, self.matte_dir(), 'grammar.depth'), [])
        self.assertIn('no subject matte', lints(good, None, 'grammar.depth')[0])
        long = json.loads(json.dumps(good))
        long['cuts']['short']['beats'][1]['world']['text'] = '$195K'
        self.assertIn('of the frame tall', lints(long, self.matte_dir(), 'grammar.depth')[0])
        slow = json.loads(json.dumps(good))
        slow['cuts']['short']['beats'][1]['span']['to_w'] = 20 + round(8 * grammar.WORDS_PER_SECOND)
        slow['cuts']['short']['beats'][2]['span'] = {'from_w': 21 + round(8 * grammar.WORDS_PER_SECOND), 'to_w': 60 + n}
        self.assertTrue(any('holds' in f and '1 to 6 s' in f for f in lints(slow, self.matte_dir(), 'grammar.depth')))
        bare = json.loads(json.dumps(good))
        del bare['cuts']['short']['beats'][1]['world']
        self.assertIn('give it world.text', lints(bare, self.matte_dir(), 'grammar.depth')[0])

    def test_a_world_word_belongs_to_anchor(self):
        s = anchor_spec([beat('a', 0, 19, 'band'), beat('n', 20, 27, 'number', world={'text': 'NO'}), beat('b', 28, 47, 'band')])
        s['style']['layout']['mode'] = 'band'
        self.assertTrue(any("behind him is anchor's" in f for f in lints(s, None, 'grammar.depth')))

    def test_a_chapter_mark_moves_each_time_and_behind_needs_the_matte(self):
        def cut(second):
            return anchor_spec([beat('a', 0, 19, 'anchor'), beat('c1', 20, 22, 'chapter', chapter={'mark': '1', 'arrangement': 'beside_left'}),
                                beat('b', 23, 42, 'anchor'), beat('c2', 43, 45, 'chapter', chapter={'mark': '2', 'arrangement': second}),
                                beat('d', 46, 65, 'anchor')])
        self.assertEqual(lints(cut('rotated'), None, 'grammar.depth'), [])
        self.assertIn('beside_left again', lints(cut('beside_left'), None, 'grammar.depth')[0])
        self.assertIn('behind him, but', lints(cut('behind'), None, 'grammar.depth')[0])
        self.assertEqual(lints(cut('behind'), self.matte_dir(), 'grammar.depth'), [])

    def test_the_anchor_title_needs_the_matte(self):
        s = anchor_spec([beat('a', 0, 9, 'anchor'), beat('t', 10, 15, 'title'), beat('b', 16, 35, 'anchor')], title=True)
        self.assertTrue(any('anchor title builds behind his head' in f for f in lints(s, None, 'grammar.depth')))
        self.assertEqual(lints(s, self.matte_dir(), 'grammar.depth'), [])


class TitleTimingTest(unittest.TestCase):
    def spec(self, from_w=10, line='So will it find the money'):
        s = anchor_spec([beat('a', 0, 9, 'anchor'), beat('t', 10, 15, 'title'), beat('b', 16, 35, 'anchor')], title=True)
        s['title_moment']['line'] = line
        s['title_moment']['spans']['short']['from_w'] = from_w
        return s

    def words(self, onset_10=8.0, word_10='So'):
        directory = Path(tempfile.mkdtemp())
        rows = [{'w': i, 'word': 'word', 'onset_s': i * 0.5, 'end_s': i * 0.5 + 0.4} for i in range(40)]
        rows[10].update(word=word_10, onset_s=onset_10, end_s=onset_10 + 0.3)
        for r in rows[11:]:
            r['onset_s'] += onset_10
            r['end_s'] += onset_10
        write_json(directory / 'words.short.json', rows)
        return directory

    def test_the_title_lands_on_his_words_within_30_s(self):
        self.assertEqual(grammar.title_timing_lints(self.spec(), 'short', self.words()), [])

    def test_a_title_after_30_s_is_refused(self):
        found = grammar.title_timing_lints(self.spec(), 'short', self.words(onset_10=31.0))
        self.assertIn('31.0 s into the cut', found[0])

    def test_a_title_not_on_his_title_words_is_refused(self):
        found = grammar.title_timing_lints(self.spec(), 'short', self.words(word_10='Hospitals'))
        self.assertIn('not on the first word of his title line', found[0])

    def test_a_cut_with_no_title_span_is_refused(self):
        s = self.spec()
        s['title_moment']['spans'] = {}
        self.assertIn('names no span', grammar.title_timing_lints(s, 'short', None)[0])
        s['cuts']['short']['excerpt'] = True
        self.assertEqual(grammar.title_timing_lints(s, 'short', None), [])


# ----------------------------------------------------------------------------------------------------------- qc fill

class PanelFillTest(unittest.TestCase):
    INK = (12, 21, 18)

    def crop(self, share):
        img = np.zeros((40, 100, 3), np.uint8) + np.array(self.INK, np.uint8)
        img[10:30, 5:5 + int(90 * share)] = 240
        return img

    def test_fill_share_measures_what_is_drawn(self):
        self.assertAlmostEqual(qc_fill.fill_share(self.crop(1.0), self.INK), 0.90, places=2)
        self.assertAlmostEqual(qc_fill.fill_share(self.crop(0.5), self.INK), 0.45, places=2)
        self.assertEqual(qc_fill.fill_share(self.crop(0), self.INK), 0.0)

    def test_runs_under_the_share_longer_than_half_a_second_fail(self):
        samples = [(f * 3, 0.5) for f in range(4)] + [(f * 3, 0.95) for f in range(4, 10)] + [(f * 3, 0.4) for f in range(10, 17)]
        runs = qc_fill.runs_under(samples, 0.85, 10, 0.5)
        self.assertEqual(len(runs), 1, 'four samples (0.4 s) pass; seven (0.7 s) fail')
        self.assertEqual(runs[0]['from_frame'], 30)

    def props(self, mode='stage'):
        return {'aspect': '9:16', 'layout': {'mode': mode, 'grammar': True}, 'tokens': {'ink': '#0C1512'},
                'captionTheme': 'mint-word', 'captionPlacement': 'seam',
                'beats': [{'id': 'a', 'fromFrame': 0, 'toFrame': 60, 'shot': mode}, {'id': 't', 'fromFrame': 60, 'toFrame': 90, 'shot': 'title'}]}

    def test_the_row_fails_a_half_empty_panel_and_passes_a_full_one(self):
        props = self.props()
        self.assertEqual(qc_fill.region_for(props), (60, 280, 800, 765 - 24 - 280))
        self.assertEqual(qc_fill.region_for({**props, 'matte': {'src': 'x'}}), (60, 280, 800, 900 - 24 - 280))
        half = qc_fill.row(None, props, read=lambda f: self.crop(0.5))
        self.assertFalse(half['pass'])
        full = qc_fill.row(None, props, read=lambda f: self.crop(1.0))
        self.assertTrue(full['pass'])
        self.assertEqual(full['value']['samples'], len(range(12, 60, 3)), 'the entrance and the title are left out')

    def test_anchor_has_no_panel(self):
        self.assertEqual(qc_fill.row(None, self.props('anchor'))['status'], 'not applicable')


if __name__ == '__main__':
    unittest.main()
