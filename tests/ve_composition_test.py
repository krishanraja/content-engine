"""Design-lock composition contracts, using real OCR plus injectable word boxes."""
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from contextlib import redirect_stdout
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from velib import designlock, qc, qc_captions, qc_composition as comp
import ve

PIN = ROOT.parents[1] / 'toolchain/ffmpeg-n8.1.2-53-g1005b294ff-win64-gpl-8.1/bin/ffmpeg.exe'
FONT = ROOT / 'assets/fonts/makeyourmindup/IBMPlexMono-Regular.ttf'


class Composition(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # The shipped lock no longer requires the tag (Krish, 28 Oct 2026). These tests exercise the tag rule
        # itself, which stays in the engine for a format that asks for it.
        cls.lock = __import__('copy').deepcopy(designlock.load())
        cls.lock['thresholds']['illustration_tag_required'] = True

    def image(self):
        return Image.new('RGB', (1080, 1920), comp._ink())

    def word(self, text='HELLO', x=100, y=500, h=22, w=100, conf=95):
        return dict(text=text, x=x, y=y, w=w, h=h, conf=conf)

    def measure(self, words=(), **kwargs):
        return comp.measure(self.image(), self.lock, ocr_words=words, **kwargs)

    def test_fixtures(self):
        base = ROOT / 'fixtures/ve/design-lock'
        files = [(base / 'approved' / f'{prefix}-f{i}.jpg', True)
                 for prefix in ('H', 'P') for i in range(1, 6)]
        files += [(base / 'rejected' / f'tall-{i}.jpg', False) for i in range(1, 5)]
        missing = [str(path.relative_to(ROOT)) for path, _ in files if not path.is_file()]
        self.assertFalse(missing, 'Missing calibration fixtures: ' + ', '.join(missing))
        for path, approved in files:
            with self.subTest(fixture=path.name):
                # H-f4 shows the real recording: its text is evidence, exempt by design.
                exempt = [(0, 440, 1080, 740)] if path.name == 'H-f4.jpg' else []
                report = comp.measure(path, self.lock, plate_on_screen=approved, exempt=exempt)
                fill = report['checks']['fill_pct']['value']
                print(f'{path.name}: fill_pct={fill:.2f}')
                self.assertEqual(report['pass'], approved, report['findings'])
                if approved:
                    self.assertGreaterEqual(fill, self.lock['thresholds']['fill_min_pct'] + 3)
                else:
                    self.assertLessEqual(fill, self.lock['thresholds']['fill_min_pct'] - 15)
                    self.assertTrue(report['findings'])

    def test_noise_and_corner_do_not_fill_screen(self):
        image = self.image()
        rng = np.random.default_rng(19)
        grain = np.asarray(image, dtype=float) * 0.93 + rng.uniform(0, 255, (1920, 1080, 1)) * 0.07
        report = comp.measure(Image.fromarray(grain.astype('uint8')), self.lock, ocr_words=[])
        self.assertFalse(report['checks']['fill_pct']['pass'])
        self.assertLess(report['checks']['fill_pct']['value'], 1)
        ImageDraw.Draw(image).rectangle((72, 72, 300, 280), fill='white')
        self.assertFalse(comp.measure(image, self.lock, ocr_words=[])['checks']['fill_pct']['pass'])
        full = Image.new('RGB', (1080, 1920), 'white')
        self.assertEqual(comp.measure(full, self.lock, ocr_words=[])['checks']['fill_pct']['value'], 100)

    def test_text_geometry(self):
        cases = [('small_text', self.word(h=14)), ('platform_zone', self.word(x=1000)),
                 ('edges', self.word(x=10)), ('caption_zone', self.word(y=1250))]
        for name, word in cases:
            with self.subTest(check=name):
                report = self.measure([word])
                self.assertFalse(report['checks'][name]['pass'])
                self.assertTrue(any(name in finding for finding in report['findings']))
        self.assertTrue(self.measure([self.word(y=1250)], caption_words=['hello'])['checks']['caption_zone']['pass'])
        self.assertTrue(self.measure([self.word(text='CAPTION', y=1250)])['checks']['caption_zone']['pass'])
        self.assertFalse(self.measure([self.word(y=1250)], caption_words=[])['checks']['caption_zone']['pass'])
        self.assertTrue(self.measure([self.word(h=21)])['checks']['small_text']['pass'])
        self.assertTrue(self.measure([self.word(y=1750)])['checks']['platform_zone']['pass'])
        self.assertTrue(self.measure([self.word(h=14, conf=59)])['checks']['small_text']['pass'])

    def test_shipped_lock_does_not_require_the_tag(self):
        self.assertIs(designlock.load()['thresholds']['illustration_tag_required'], False)

    def test_illustration_and_neighbours(self):
        self.assertFalse(self.measure(plate_on_screen=True)['checks']['illustration']['pass'])
        self.assertTrue(self.measure([self.word(text='ILLUSTRATION')], plate_on_screen=True)['checks']['illustration']['pass'])
        words = [self.word(text='ILLUS', w=60), self.word(text='TRATION', x=170, w=85)]
        self.assertTrue(self.measure(words, plate_on_screen=True)['checks']['illustration']['pass'])
        words[1]['y'] = 700
        self.assertFalse(self.measure(words, plate_on_screen=True)['checks']['illustration']['pass'])
        letters = [self.word(text=letter, x=100 + i * 22, w=16) for i, letter in enumerate('ILLUSTRATION')]
        self.assertTrue(self.measure(letters, plate_on_screen=True)['checks']['illustration']['pass'])

    def test_single_letters_still_obey_zones(self):
        self.assertTrue(self.measure([self.word(text='A', h=10)])['checks']['small_text']['pass'])
        for name, word in [('platform_zone', self.word(text='A', x=1000)),
                           ('edges', self.word(text='A', x=10)),
                           ('caption_zone', self.word(text='A', y=1250))]:
            self.assertFalse(self.measure([word])['checks'][name]['pass'])

    def test_shared_ocr_boxes_and_missing_reader_fail_closed(self):
        tsv = ('level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
               '1\t1\t0\t0\t0\t0\t0\t0\t1080\t1920\t-1\t\n'
               '5\t1\t1\t1\t1\t1\t100\t500\t101\t21\t96.5\tHELLO\n')
        with patch.object(qc_captions.subprocess, 'run', return_value=
                          subprocess.CompletedProcess([], 0, stdout=tsv.encode())) as run:
            words = qc_captions.read_words('test-tesseract', np.zeros((20, 40), np.uint8))
        self.assertEqual(words, [self.word(w=101, h=21, conf=96.5)])
        self.assertEqual(run.call_args.args[0][-3:], ['--psm', '11', 'tsv'])
        self.assertTrue(run.call_args.kwargs['input'].startswith(b'P5\n40 20\n255\n'))
        with patch.object(comp.shutil, 'which', return_value=None):
            with self.assertRaisesRegex(OSError, 'tesseract'):
                comp.measure(self.image(), self.lock)
        self.assertEqual(qc_captions.spaceless_match('ILLUSTRATION', 'ILLUS TRATION'), 1)

    def test_exempt_only_silences_its_own_text(self):
        words = [self.word(text='FIRST', x=10, h=14), self.word(text='SECOND', x=1000, h=14)]
        report = self.measure(words, exempt=[(0, 450, 200, 150)])
        self.assertEqual([w['text'] for w in report['checks']['small_text']['value']], ['SECOND'])
        self.assertFalse(report['checks']['platform_zone']['pass'])
        self.assertFalse(report['checks']['fill_pct']['pass'])
        self.assertFalse(self.measure([self.word(text='ILLUSTRATION')], plate_on_screen=True,
                                     exempt=[(90, 490, 200, 100)])['checks']['illustration']['pass'])

    @unittest.skipUnless(shutil.which('tesseract'), 'tesseract is missing')
    def test_real_font_ocr(self):
        for size, small in [(20, True), (30, False)]:
            image = self.image()
            ImageDraw.Draw(image).text((100, 500), 'HELLO WORLD', font=ImageFont.truetype(str(FONT), size), fill='white')
            report = comp.measure(image, self.lock)
            words = comp._words(image)
            self.assertTrue(any(w['conf'] >= 60 for w in words), words)
            self.assertEqual(not report['checks']['small_text']['pass'], small, report)
        image = self.image()
        ImageDraw.Draw(image).text((100, 100), 'ILLUSTRATION', font=ImageFont.truetype(str(FONT), 28), fill='white')
        report = comp.measure(image, self.lock, plate_on_screen=True)
        self.assertTrue(report['checks']['illustration']['pass'], report)
        self.assertTrue(report['checks']['small_text']['pass'], report)

    def test_canvas_and_wide(self):
        with self.assertRaises(ValueError):
            comp.measure(Image.new('RGB', (540, 960)), self.lock, ocr_words=[])
        self.assertEqual(comp.composition_checks('unused', {'aspect': '16:9'}, self.lock),
                         {'applies': False, 'note': 'the design lock is 9:16 only'})
        self.assertFalse(comp.composition_checks('unused', {'aspect': '9:16', 'beats': []}, self.lock)['pass'])
        with self.assertRaises(ValueError):
            comp.composition_checks('unused', {'beats': []}, self.lock)

    def test_two_beat_video(self):
        if not PIN.is_file():
            print(f'SKIP synthetic video: pinned ffmpeg missing: {PIN}')
            self.skipTest('pinned ffmpeg missing')
        folder = Path(tempfile.gettempdir()) / ('ve-comp-' + uuid.uuid4().hex)
        folder.mkdir()
        self.addCleanup(shutil.rmtree, folder)
        video = folder / 'two.mkv'
        subprocess.run([str(PIN), '-nostdin', '-v', 'error', '-f', 'lavfi', '-i',
                        'color=white:s=1080x1920:r=30:d=2', '-c:v', 'ffv1', str(video)],
                       capture_output=True, check=True)
        props = {'aspect': '9:16', 'beats': [dict(id='one', fromFrame=0, toFrame=30, keyFrame=7),
                                           dict(id='two', fromFrame=30, toFrame=60)],
                 'captions': [dict(fromFrame=0, toFrame=30, words=[dict(text='Hello')])],
                 'illustrationLabels': [dict(fromFrame=30, toFrame=60, text='ILLUSTRATION')]}
        original = comp.measure
        calls = []

        def measured(image, lock, **kwargs):
            calls.append(kwargs)
            return original(image, lock, ocr_words=[], **kwargs)

        with patch('velib.qc_keyframes.ffmpeg', return_value=str(PIN)), patch.object(comp, 'measure', side_effect=measured):
            report = comp.composition_checks(video, props, self.lock)
        self.assertEqual([row['frame'] for row in report['beats'].values()], [7, 54])
        self.assertEqual(calls[0]['caption_words'], {'hello'})
        self.assertFalse(calls[0]['plate_on_screen'])
        self.assertTrue(calls[1]['plate_on_screen'])
        self.assertTrue(report['beats']['one']['pass'])
        self.assertFalse(report['beats']['two']['pass'])

    def test_qc_wiring_and_cli(self):
        with patch.object(qc, 'loudness', return_value={'integrated_lufs': -14, 'true_peak_dbtp': -1}), \
                patch.object(qc, 'frame_diffs', return_value=np.full(150, 2.)), \
                patch.object(qc, 'long_silences', return_value=[]), \
                patch.object(qc, 'sha256_file', return_value='test'), patch.object(qc, 'duration_s', return_value=2), \
                patch.object(comp, 'composition_checks', return_value={'applies': True, 'pass': False, 'beats': {}}):
            report = qc.run_qc('unused', 'scoreboard-test', aspect='9:16')
        self.assertFalse(report['measured_pass'])
        self.assertFalse(report['checks']['composition']['pass'])
        self.assertIn('composition', report)
        with patch.object(comp, 'measure', return_value={'pass': False, 'checks': {}, 'findings': ['fill 0%, needs 80%.']}), \
                patch.object(sys, 'argv', ['ve', 'comp', 'one.png', '--plate', '--json']), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(ve.main(), 1)
        self.assertFalse(json.loads(output.getvalue())['one.png']['pass'])


if __name__ == '__main__':
    unittest.main()
