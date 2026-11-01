"""The published-standard floor in the tools (Wave 2, W2.5), on synthetic media only.

Every picture and sound here is made by ffmpeg's lavfi sources (testsrc,
sine, anoisesrc), never a real take. They prove each tool's logic and each
measured line; calibration on his real footage is a home-computer step.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
sys.path.insert(0, str(ROOT / 'scripts/post-pack'))
import floor_lines  # noqa: E402
import lipsync_gate  # noqa: E402
import privacy_crop  # noqa: E402
import sfx  # noqa: E402
import logo_gate  # noqa: E402
import overnight_visuals  # noqa: E402
from share import share_copy  # noqa: E402


def ff(*args):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-nostdin', *args], check=True)


def has_filter(name):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-filters'], capture_output=True, text=True).stdout
    return any(line.split()[1:2] == [name] for line in out.splitlines() if line.strip())


class Media(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix='floor-'))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)


class Loudness(Media):
    def test_measured_after_the_encode(self):
        import music
        good, loud = self.tmp / 'good.mp4', self.tmp / 'loud.mp4'
        for path, gain in ((good, -14), (loud, -6)):
            ff('-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=24:duration=12', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12',
               '-af', f'loudnorm=I={gain}:TP=-2:LRA=7', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-b:a', '192k',
               '-ar', '48000', '-shortest', str(path))
        rows = []
        for path in (good, loud):
            m = music.ebur128(path)
            rows.append(floor_lines.loudness_line({'integrated': m['I'], 'true_peak': m['TP']}, None, path))
        self.assertEqual([r['status'] for r in rows], ['pass', 'fail'], rows)
        self.assertTrue(rows[0]['measured_after_encode'])
        self.assertIn('measured after the encode on good.mp4', rows[0]['line'])
        self.assertIn('-14', rows[0]['line'])

    def test_unmeasured_never_passes(self):
        self.assertEqual(floor_lines.loudness_line({'integrated': None, 'true_peak': -3})['status'], 'fail')


class Share(Media):
    def test_share_copy_under_the_cap_measured_on_disk(self):
        src = self.tmp / 'master.mp4'
        ff('-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24:duration=8', '-f', 'lavfi', '-i', 'sine=duration=8',
           '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', '-c:a', 'aac', '-shortest', str(src))
        cap = 1.0
        made = share_copy(src, self.tmp / 'share' / 'master.mp4', cap_mib=cap)
        line = floor_lines.share_line(made, cap)
        self.assertEqual(line['status'], 'pass', line)
        self.assertLess(line['mib'], cap)
        self.assertEqual(floor_lines.share_line(None)['status'], 'not_made')


class ChapterLifts(Media):
    def test_bed_lifts_in_each_chapter_window_on_the_wide_cut(self):
        bed = self.tmp / 'bed.wav'
        # A bed at a low level that rises 8 dB from 20 to 24 s and from 40 to 44 s, as the episode bed does at its cards.
        ff('-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.5:duration=50:seed=3', '-af',
           "volume='if(between(t,20,24)+between(t,40,44),0.08,0.032)':eval=frame", '-ar', '48000', str(bed))
        row = floor_lines.chapters_line('16x9', bed, [(20, 24), (40, 44)])
        self.assertEqual(row['status'], 'measured', row)
        self.assertTrue(all(w['lift_lu'] >= 6 for w in row['windows']), row)
        self.assertIn('levels: awaiting by-ear approval', row['line'])
        flat = floor_lines.chapters_line('16x9', bed, [(5, 9)])
        self.assertEqual(flat['status'], 'short', flat)
        self.assertIsNone(floor_lines.chapters_line('9x16', bed, [(20, 24)]))
        self.assertEqual(floor_lines.chapters_line('16x9', None, [(20, 24)])['status'], 'no_bed')


class Stability(Media):
    def test_shaky_footage_measures_more_shake_than_steady(self):
        steady, shaky = self.tmp / 'steady.mp4', self.tmp / 'shaky.mp4'
        for path, crop in ((steady, 'crop=640:360:40:22'), (shaky, "crop=640:360:'40+18*sin(n*1.7)':'22+12*cos(n*2.3)'")):
            ff('-f', 'lavfi', '-i', 'testsrc=size=720x404:rate=24:duration=4', '-vf', crop, '-c:v', 'libx264', '-preset',
               'ultrafast', '-crf', '12', str(path))
        a, b = floor_lines.stability(steady), floor_lines.stability(shaky)
        self.assertEqual((a['status'], b['status']), ('measured', 'measured'), (a, b))
        wall = floor_lines.stability(shaky, region=(0, 0, 0.5, 0.5))
        self.assertGreater(wall['rms_px'], 5.0, wall)
        self.assertFalse(b['blocking'])
        self.assertLess(a['rms_px'], 1.0, a)
        self.assertGreater(b['rms_px'], 5.0, b)
        self.assertIn('never blocking', b['line'])

    def test_unreadable_footage_is_reported_not_raised(self):
        bad = self.tmp / 'not-a-video.mp4'
        bad.write_text('nothing', encoding='utf-8')
        self.assertEqual(floor_lines.stability(bad)['status'], 'not_measured')


class Shake(unittest.TestCase):
    def test_a_steady_pan_is_not_shake_and_a_jitter_is(self):
        pan = floor_lines.shake([(2.0, 0.0)] * 60, 24)
        jitter = floor_lines.shake([((-1) ** k * 6.0, 0.0) for k in range(60)], 24)
        self.assertLess(pan['rms_px'], 1.0, pan)
        self.assertGreater(jitter['rms_px'], 2.0, jitter)


class Scorer:
    name = 'stand-in'

    def __init__(self, table):
        self.table, self.seen = table, []

    def score(self, video, windows):
        self.seen.append(list(windows))
        return [self.table(s, n) for s, n in windows]


def reading(offset=0, confidence=6.0, face=1.0):
    return {'offset_ms': offset, 'confidence': confidence, 'face_detection_rate': face}


class LipSync(unittest.TestCase):
    cfg = lipsync_gate.load_config()

    def test_every_segment_gets_a_window_and_a_long_one_several(self):
        spans = [(0.0, 10.0), (10.0, 14.0), (14.0, 150.0)]
        windows, short = lipsync_gate.plan_windows(spans, [], self.cfg)
        self.assertEqual(short, [])
        self.assertEqual(sorted({w[0] for w in windows}), [0, 1, 2])
        starts = [w[1] for w in windows if w[0] == 2]
        self.assertGreaterEqual(len(starts), 3)
        self.assertTrue(all(b - a <= self.cfg['max_gap_s'] for a, b in zip(starts, starts[1:])), starts)

    def test_all_in_sync_passes(self):
        result = lipsync_gate.gate('cut.mp4', [(0, 8), (8, 20)], [], Scorer(lambda s, n: reading(0)), self.cfg)
        self.assertEqual(result['status'], 'pass', result)
        self.assertEqual(result['counts']['pass'], 2)
        self.assertEqual(result['floor_never'], 3)

    def test_one_segment_out_of_sync_fails_the_cut(self):
        result = lipsync_gate.gate('cut.mp4', [(0, 8), (8, 20)], [],
                                   Scorer(lambda s, n: reading(120 if s >= 8 else 0)), self.cfg)
        self.assertEqual(result['status'], 'fail')
        self.assertEqual([s['status'] for s in result['segments']], ['pass', 'fail'])

    def test_drift_late_in_a_long_segment_is_caught(self):
        result = lipsync_gate.gate('cut.mp4', [(0, 300)], [], Scorer(lambda s, n: reading(0 if s < 200 else 80)), self.cfg)
        self.assertEqual(result['status'], 'fail')

    def test_low_confidence_is_never_a_pass(self):
        result = lipsync_gate.gate('cut.mp4', [(0, 8)], [], Scorer(lambda s, n: reading(0, confidence=1.0)), self.cfg)
        self.assertEqual(result['status'], 'inconclusive')

    def test_a_window_under_a_picture_is_placed_in_the_open_part(self):
        scorer = Scorer(lambda s, n: reading(0))
        lipsync_gate.gate('cut.mp4', [(0, 20)], [(0, 12)], scorer, self.cfg)
        self.assertTrue(all(s >= 12 for s, _ in scorer.seen[0]), scorer.seen)

    def test_a_segment_wholly_under_a_picture_with_no_face_is_covered(self):
        result = lipsync_gate.gate('cut.mp4', [(0, 8), (8, 20)], [(8, 20)],
                                   Scorer(lambda s, n: reading(0, face=0.0 if s >= 8 else 1.0)), self.cfg)
        self.assertEqual([s['status'] for s in result['segments']], ['pass', 'covered'])
        self.assertEqual(result['status'], 'pass')

    def test_no_face_where_nothing_covers_it_is_inconclusive(self):
        result = lipsync_gate.gate('cut.mp4', [(0, 8)], [], Scorer(lambda s, n: reading(0, face=0.2)), self.cfg)
        self.assertEqual(result['status'], 'inconclusive')

    def test_too_many_short_segments_cannot_pass(self):
        spans = [(0, 10)] + [(10 + k * 1.5, 11.5 + k * 1.5) for k in range(4)]
        result = lipsync_gate.gate('cut.mp4', spans, [], Scorer(lambda s, n: reading(0)), self.cfg)
        self.assertEqual(result['counts']['short'], 4)
        self.assertEqual(result['status'], 'inconclusive')

    def test_segments_land_on_the_cut_clock(self):
        segs = [{'a': 5.0, 'b': 9.0, 'off': 0.0}, {'a': 12.0, 'b': 15.5, 'off': 4.0}]
        self.assertEqual(lipsync_gate.segment_spans(segs, 2.0), [(2.0, 6.0), (6.0, 9.5)])

    def test_no_model_here_is_not_run_and_holds(self):
        cfg = {k: v for k, v in self.cfg.items() if k not in ('default_root', 'default_model', 'sources')}
        result = lipsync_gate.check_cut('cut.mp4', [(0, 8)], [], cfg, env={})
        self.assertEqual(result['status'], 'not_run')
        self.assertIn('MINDMAKE_SYNCNET_MODEL', result['reason'])

    def test_a_fetch_that_fails_is_not_run_and_holds(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            cfg = dict(self.cfg, default_root=f'{d}/src', default_model=f'{d}/m.model',
                       sources={'model': ['https://invalid.invalid/m'], 'detector': ['https://invalid.invalid/d']})
            import syncnet_fetch
            real = syncnet_fetch.ensure
            syncnet_fetch.ensure = lambda c: (_ for _ in ()).throw(syncnet_fetch.FetchError('no source answered'))
            try:
                result = lipsync_gate.check_cut('cut.mp4', [(0, 8)], [], cfg, env={})
            finally:
                syncnet_fetch.ensure = real
        self.assertEqual(result['status'], 'not_run')
        self.assertIn('fetching it failed', result['reason'])

    @unittest.skipUnless(__import__('importlib.util').util.find_spec('cv2'), 'OpenCV is not installed here (CI); the lip-sync scorer only runs where it is')
    def test_the_face_detector_is_s3fd_or_says_it_fell_back(self):
        import sync_check
        saved, sync_check._FINDER = sync_check._FINDER, None
        kept = [p for p in sys.path if (Path(p) / 'detectors/s3fd/__init__.py').is_file()]
        for p in kept:
            sys.path.remove(p)
        try:
            name, find = sync_check.face_detector()
            self.assertTrue(name.startswith('haar (S3FD did not load'))
            self.assertTrue(callable(find))
        finally:
            sys.path.extend(kept)
            sync_check._FINDER = saved

    def test_a_named_install_is_never_fetched_over(self):
        self.assertFalse(lipsync_gate.fetchable(self.cfg, env={'MINDMAKE_SYNCNET_ROOT': '/x'}))
        self.assertFalse(lipsync_gate.fetchable(self.cfg, env={'MINDMAKE_SYNCNET_NO_FETCH': '1'}))
        self.assertTrue(lipsync_gate.fetchable(self.cfg, env={}))

    def test_a_broken_scorer_is_never_a_pass(self):
        class Broken:
            def score(self, video, windows):
                raise RuntimeError('decoder died')
        self.assertEqual(lipsync_gate.check_cut('cut.mp4', [(0, 8)], [], self.cfg, scorer=Broken())['status'], 'not_run')


class Privacy(Media):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.src = cls.tmp / 'screen.mp4'
        # Grain over the test card stands in for the fine detail of text on a screen.
        ff('-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24:duration=2', '-vf', 'noise=alls=40:allf=t', '-c:v', 'libx264',
           '-preset', 'ultrafast', '-crf', '8', str(cls.src))
        cls.entry = {'file': 'screen.mp4', 'sha256': privacy_crop.sha256(cls.src), 'allowed': [0, 60, 640, 240],
                     'blur': [[200, 100, 240, 80]], 'why': 'a synthetic tab strip and inbox'}

    def test_apply_then_check_passes(self):
        dst = self.tmp / 'treated.mp4'
        privacy_crop.apply(self.entry, self.src, dst)
        result = privacy_crop.check(self.entry, self.src, dst)
        self.assertEqual(result['status'], 'pass', result)
        self.assertLess(result['samples'][0]['blur'][0]['kept'], privacy_crop.MAX_BLUR_DETAIL)

    def test_whole_frame_shows_more_than_allowed(self):
        result = privacy_crop.check(self.entry, self.src, self.src)
        self.assertEqual(result['status'], 'fail')
        self.assertIn('not the 640 x 240', result['problems'][0])

    def test_crop_in_the_wrong_place_fails(self):
        wrong = self.tmp / 'wrong.mp4'
        ff('-i', str(self.src), '-vf', 'crop=640:240:0:0', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '8', str(wrong))
        result = privacy_crop.check({**self.entry, 'blur': []}, self.src, wrong)
        self.assertEqual(result['status'], 'fail', result)

    def test_missing_blur_fails(self):
        plain = self.tmp / 'plain.mp4'
        privacy_crop.apply({**self.entry, 'blur': []}, self.src, plain)
        result = privacy_crop.check(self.entry, self.src, plain)
        self.assertEqual(result['status'], 'fail', result)
        self.assertTrue(any('not blurred' in p for p in result['problems']), result)

    def test_entry_problems(self):
        self.assertTrue(privacy_crop.validate({**self.entry, 'blur': [[600, 10, 100, 20]]}, (640, 360)))
        self.assertTrue(privacy_crop.validate({**self.entry, 'allowed': [0, 0, 700, 360]}, (640, 360)))
        with self.assertRaises(privacy_crop.PrivacyError):
            privacy_crop.apply({**self.entry, 'sha256': '0' * 64}, self.src, self.tmp / 'x.mp4')


class Sound(unittest.TestCase):
    def test_the_repository_set_starts_empty_and_refuses_every_sound(self):
        self.assertEqual(sfx.approved(), {})
        self.assertEqual(sfx.slot({})['sfx_used'], False)
        with self.assertRaises(sfx.SoundRefused):
            sfx.slot({'sfx': [{'id': 'epidemic-thud', 'at_s': 12.0}]})

    def test_only_one_sound(self):
        with self.assertRaises(sfx.SoundRefused):
            sfx.slot({'sfx': [{'id': 'a', 'at_s': 1}, {'id': 'b', 'at_s': 2}]})

    def test_an_entry_without_his_words_is_not_approved(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'set.json'
            path.write_text(json.dumps({'approved': [{'id': 'thud', 'sha256': 'a' * 64, 'approved_by': 'Krish'}]}), encoding='utf-8')
            self.assertEqual(sfx.approved(path), {})
            path.write_text(json.dumps({'approved': [{'id': 'thud', 'sha256': 'a' * 64, 'approved_by': 'Krish',
                                                      'approval_words': 'yes that one'}]}), encoding='utf-8')
            self.assertIn('thud', sfx.approved(path))
            with self.assertRaises(sfx.SoundRefused) as held:
                sfx.slot({'sfx': [{'id': 'thud', 'at_s': 3.0}]}, path)
            self.assertIn('not built yet', str(held.exception))


class Logos(unittest.TestCase):
    def test_self_test(self):
        self.assertEqual(logo_gate.self_test(), 0)

    def test_repository_registry_has_the_marks_list(self):
        data = logo_gate.load()
        self.assertIsInstance(data.get('marks'), list)


class Overnight(unittest.TestCase):
    def test_logo_gate_holds_before_any_drawing_then_draws_once_registered(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            reg = tmp / 'config' / 'logo-registry.json'
            reg.parent.mkdir()
            reg.write_text(json.dumps({'companies': [{'names': ['OpenAI']}], 'marks': []}), encoding='utf-8')
            (tmp / 'openai.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding='utf-8')
            facts = tmp / 'cover-facts.json'
            facts.write_text(json.dumps({'subchannel': 'follow.the.money', 'headline': 'x',
                                         'cover': {'rows': [{'name': 'OpenAI', 'logo': 'openai.svg', 'tag': 't'}]}}), encoding='utf-8')
            drawn = []

            def drawer(path, out, assets):
                drawn.append(path)
                (Path(out) / 'thumb-wide-1280x720.jpg').write_bytes(b'jpg')
                return True, 'drawn'
            held = overnight_visuals.run(facts, tmp / 'out', drawer=drawer, gate=lambda p: (True, ''), registry=reg)
            self.assertEqual((held['status'], held['held_by'], drawn), ('held', 'logo_gate', []))
            logo_gate.register(tmp / 'openai.svg', 'OpenAI', 'full_colour', 'https://openai.com/brand', reg)
            made = overnight_visuals.run(facts, tmp / 'out', post=tmp / 'post.json', drawer=drawer,
                                         gate=lambda p: (True, 'ready'), registry=reg)
            self.assertEqual(made['status'], 'made', made)
            self.assertFalse(made['paid_generation'])
            self.assertIn('thumb-wide-1280x720.jpg', made['drawn'])
            self.assertTrue((tmp / 'out' / 'overnight-visuals.json').is_file())
            failed = overnight_visuals.run(facts, tmp / 'out', post=tmp / 'post.json', drawer=drawer,
                                           gate=lambda p: (False, 'NOT READY'), registry=reg)
            self.assertEqual((failed['status'], failed['held_by']), ('held', 'visual_gate'))


if __name__ == '__main__':
    unittest.main(verbosity=1)
