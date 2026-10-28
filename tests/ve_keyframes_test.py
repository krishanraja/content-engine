"""Golden keyframe checks on synthetic designs and real ffmpeg decoding."""
from __future__ import annotations

import copy
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from argparse import Namespace
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import ve
from velib import designlock, qc, qc_keyframes as kf
from velib.common import ffmpeg
from velib.lint import crew_lints


def layout(seed, size=(540, 960)):
    rng = np.random.default_rng(seed)
    return Image.fromarray(rng.integers(0, 256, (96, 54), dtype=np.uint8)).resize(size, Image.Resampling.NEAREST)


class SimilarityTest(unittest.TestCase):
    def test_ssim(self):
        a = np.asarray(layout(1))
        rng = np.random.default_rng(4)
        self.assertAlmostEqual(kf.ssim(a, a), 1., delta=1e-9)
        noisy = np.clip(a.astype(float) + rng.normal(0, 0.5, a.shape), 0, 255)
        self.assertGreater(kf.ssim(a, noisy), .9)
        self.assertLess(kf.ssim(a, np.asarray(layout(2))), .5)
        self.assertLess(kf.ssim(a, np.roll(a, 40, axis=1)), .8)
        self.assertLess(kf.ssim(rng.integers(0, 256, a.shape), rng.integers(0, 256, a.shape)), .1)
        for bad in (a[:-1], a[:, :-1], np.zeros((5, 5)), np.zeros((960, 540, 3))):
            with self.assertRaises(ValueError):
                kf.ssim(a, bad)

    def test_compare_and_resize(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-keyframes-') as temp:
            golden = Path(temp) / 'golden.png'
            image = layout(1)
            image.save(golden)
            lock = {'thresholds': {'keyframe_compare_size': [540, 960], 'keyframe_ssim_min': .8}}
            self.assertTrue(kf.compare(image, golden, lock)['pass'])
            self.assertFalse(kf.compare(layout(2), golden, lock)['pass'])
            full = image.resize((1080, 1920), Image.Resampling.NEAREST)
            result = kf.compare(full, golden, lock)
            self.assertTrue(result['pass'], result)
            self.assertEqual(result['min'], .8)


class FrozenTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-keyframes-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.names = ['open', 'proof', 'close']
        cls.lock = {'thresholds': {'keyframe_compare_size': [540, 960], 'keyframe_ssim_min': .8},
                    'formats': {'synthetic': {'beats': cls.names, 'frames_dir': 'goldens'}}}
        path = cls.root / 'config/ve/design-lock.json'
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(cls.lock), encoding='utf-8')
        cls.images = [layout(i, (1080, 1920)).convert('RGB') for i in range(3)]
        mapping = {}
        for name, image in zip(cls.names, cls.images):
            image.save(cls.root / f'{name}.png')
            mapping[name] = f'{name}.png'
        cls.lock = designlock.freeze('synthetic', cls.root, mapping, lock_path=path)
        cls.props = {'beats': [{'id': name, 'fromFrame': i * 2, 'toFrame': i * 2 + 2}
                               for i, name in enumerate(cls.names)]}
        cls.props['beats'][1]['keyFrame'] = 2
        cls.video = cls.root / 'synthetic.mkv'
        cls.available = shutil.which('ffmpeg') is not None
        if not cls.available:
            print('SKIP synthetic video checks: pinned ffmpeg is missing from PATH')
            return
        data = b''.join(image.tobytes() * 2 for image in cls.images)
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                        '-s', '1080x1920', '-r', '30', '-i', '-', '-c:v', 'ffv1', str(cls.video)],
                       input=data, capture_output=True, check=True)

    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(designlock, 'ROOT', self.root))

    def checks(self, props=None):
        if not self.available:
            self.skipTest('pinned ffmpeg missing from PATH')
        return kf.keyframe_checks(self.video, props or self.props, self.lock, 'synthetic')

    def test_matching_video_and_explicit_frame(self):
        report = self.checks()
        self.assertTrue(report['pass'], report)
        self.assertEqual([row['frame'] for row in report['beats'].values()], [1, 2, 5])
        json.dumps(report, allow_nan=False)

    def test_swapped_frames_name_failed_beats(self):
        props = copy.deepcopy(self.props)
        props['beats'][0].update(fromFrame=2, toFrame=4)
        props['beats'][1].update(fromFrame=0, toFrame=2, keyFrame=0)
        report = self.checks(props)
        self.assertFalse(report['pass'])
        self.assertIn('open', ' '.join(report['findings']))
        self.assertIn('proof', ' '.join(report['findings']))
        self.assertTrue(report['beats']['close']['pass'])

    def test_names_missing_and_extra_fail(self):
        for change in ('rename', 'missing', 'extra'):
            props = copy.deepcopy(self.props)
            if change == 'rename':
                props['beats'][0]['id'] = 'renamed'
            elif change == 'missing':
                props['beats'].pop()
            else:
                props['beats'].append(dict(props['beats'][-1], id='extra'))
            report = self.checks(props)
            self.assertFalse(report['pass'], report)
            self.assertIn('beat id', ' '.join(report['findings']))

    def test_unfrozen_legacy_and_bad_video(self):
        lock = copy.deepcopy(self.lock)
        lock['formats']['synthetic'].pop('keyframes')
        self.assertIn('not frozen', kf.keyframe_checks('unused', {}, lock, 'synthetic')['note'])
        self.assertEqual(kf.keyframe_checks('unused', {}, lock, 'old')['note'], 'legacy format')
        if self.available:
            report = kf.keyframe_checks(self.root / 'missing.mkv', self.props, self.lock, 'synthetic')
            self.assertFalse(report['pass'])
            self.assertEqual(len(report['findings']), 3)

    def test_sheet(self):
        self.checks()
        target = self.root / 'sheet.jpg'
        kf.sheet(self.video, self.props, self.lock, 'synthetic', target)
        with Image.open(target) as image:
            self.assertEqual(image.format, 'JPEG')
            self.assertEqual(image.size, (540 * 3, 960 * 3))
            # Matching frames produce an almost black difference column.
            self.assertLess(np.asarray(image.crop((1080, 0, 1620, 960))).mean(), 10)

    def test_cli(self):
        self.checks()
        props_path = self.root / 'props.json'
        props_path.write_text(json.dumps(self.props), encoding='utf-8')
        args = Namespace(format='synthetic', video=str(self.video), props=str(props_path), sheet=None)
        with patch.object(designlock, 'load', return_value=self.lock), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(ve.cmd_keyframes(args), 0)
            self.assertIn('open ssim', output.getvalue())
            bad = copy.deepcopy(self.props)
            bad['beats'][0]['id'] = 'wrong'
            props_path.write_text(json.dumps(bad), encoding='utf-8')
            self.assertEqual(ve.cmd_keyframes(args), 1)

    def test_lint_beat_order(self):
        spec = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text(encoding='utf-8'))
        # Use the real fixture's valid format config, with only a synthetic lock.
        names = [b['id'] for b in next(iter(spec['cuts'].values()))['beats']]
        lock = {'formats': {spec['format']: {'beats': names}}}
        with patch.object(designlock, 'load', return_value=lock), patch.object(designlock, 'frozen', return_value=(True, [])):
            self.assertEqual(crew_lints(spec), [])
            for cut in spec['cuts'].values():
                cut['beats'][0]['id'] = 'renamed'
            findings = crew_lints(spec)
        self.assertIn(f'beat ids must be {", ".join(names)} for format {spec["format"]}', '\n'.join(findings))

    def test_qc_aggregation(self):
        with ExitStack() as stack:
            stack.enter_context(patch.object(qc, 'loudness', return_value={'integrated_lufs': -14, 'true_peak_dbtp': -1}))
            stack.enter_context(patch.object(qc, 'frame_diffs', return_value=np.full(150, 2.)))
            stack.enter_context(patch.object(qc, 'long_silences', return_value=[]))
            stack.enter_context(patch.object(qc, 'sha256_file', return_value='synthetic'))
            stack.enter_context(patch.object(qc, 'duration_s', return_value=5))
            for module, name in [('qc_sync', 'av_xcorr'), ('qc_joins', 'decoder'), ('qc_captions', 'ocr'),
                                 ('qc_brand', 'mark_tile'), ('qc_cues', 'cue_sync')]:
                stack.enter_context(patch(f'velib.{module}.{name}', return_value={'pass': True, 'status': 'measured'}))
            inputs = dict(dialogue_master='master', edl=[], joins=[], pages=[], region=[], mark_png='mark',
                          beats=self.props['beats'], aspect='9:16', events=[], slots={})
            with patch.object(kf, 'keyframe_checks', return_value={'applies': False, 'note': 'legacy format'}):
                report = qc.run_qc('unused', 'scoreboard-test', **inputs)
                self.assertTrue(report['complete'])
                self.assertTrue(report['measured_pass'])
                self.assertEqual(report['checks']['keyframe_match']['status'], 'not applicable')
            for passed in (True, False):
                detail = {'applies': True, 'pass': passed, 'beats': {}, 'findings': []}
                with patch.object(kf, 'keyframe_checks', return_value=detail):
                    report = qc.run_qc('unused', 'scoreboard-test', **inputs)
                self.assertTrue(report['complete'])
                self.assertEqual(report['measured_pass'], passed)
                self.assertEqual(report['keyframes'], detail)


if __name__ == '__main__':
    unittest.main()
