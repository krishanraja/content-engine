"""QC module acceptance on lavfi media, with clean controls and report wiring."""
import json
import gzip
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from argparse import Namespace
from contextlib import ExitStack, redirect_stdout
import io
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc, qc_sync, qc_joins, qc_captions, qc_brand, qc_cues, qc_audio  # noqa: E402
import ve  # noqa: E402
import numpy as np  # noqa: E402


def ffmpeg(*args):
    result = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', *map(str, args)], capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))


class QCModules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Python 3.14's Windows mkdir(0700), used by TemporaryDirectory, makes
        # fixtures inaccessible to child decoders in the restricted runner.
        # Use an ordinary inherited-permission, uniquely named temp directory.
        cls.root = Path(tempfile.gettempdir()) / ('ve-qc-' + uuid.uuid4().hex)
        cls.root.mkdir()
        cls.addClassCleanup(shutil.rmtree, cls.root)
        cls.master = cls.root / 'master.wav'
        signal = ('aevalsrc=(0.22+0.09*sin(2*PI*0.73*t)+0.07*sin(2*PI*1.31*t)'
                  '+0.04*sin(2*PI*2.17*t))*sin(2*PI*440*t):s=48000:d=4')
        ffmpeg('-f', 'lavfi', '-i', signal, '-c:a', 'pcm_s16le', cls.master)
        cls.clean, cls.delayed = cls.root / 'clean.mkv', cls.root / 'delayed.mkv'
        for path, delay in ((cls.clean, 0), (cls.delayed, 500)):
            ffmpeg('-f', 'lavfi', '-i', 'color=black:s=160x90:r=30:d=4', '-i', cls.master,
                   '-af', f'adelay={delay}:all=1', '-t', '4', '-c:v', 'ffv1', '-c:a', 'pcm_s16le', path)
        cls.edl = {'fps': 30, 'segments': [
            {'id': 'one', 'fromFrame': 0, 'durationFrames': 60, 'trimBeforeFrames': 0},
            {'id': 'two', 'fromFrame': 60, 'durationFrames': 60, 'trimBeforeFrames': 60}]}
        cls.joins = {}
        for name, signal in {
            'clean': '0.08*sin(2*PI*440*t)',
            'click': '0.08*sin(2*PI*440*t)+0.8*between(t,1,1.002)',
            'step': 'if(lt(t,1),0.02,0.2)*sin(2*PI*440*t)',
            'flux': '0.08*sin(2*PI*if(lt(t,1),440,2500)*t)',
            'silence': '0',
            'loud': '0.8*sin(2*PI*440*t)',
            'click_loud_elsewhere': 'if(lt(t,0.5),0.8,0.08)*sin(2*PI*440*t)+0.8*between(t,1,1.002)',
        }.items():
            cls.joins[name] = cls.root / f'join-{name}.wav'
            ffmpeg('-f', 'lavfi', '-i', f"aevalsrc='{signal}':s=48000:d=2", '-c:a', 'pcm_s16le', cls.joins[name])
        cls.cues = {}
        for name, at in (('clean', 30), ('late', 35), ('edge', 1)):
            cls.cues[name] = cls.root / f'cue-{name}.mkv'
            ffmpeg('-f', 'lavfi', '-i', 'color=black:s=160x90:r=30:d=3',
                   '-vf', f"drawbox=x=20:y=20:w=40:h=30:c=white:t=fill:enable='gte(n,{at})'",
                   '-c:v', 'ffv1', cls.cues[name])
        cls.mark = cls.root / 'mark.png'
        ffmpeg('-f', 'lavfi', '-i', 'testsrc2=s=32x24:r=30', '-frames:v', '1', cls.mark)
        cls.brand = {}
        for name, enable in (('clean', '1'), ('absent', 'lt(t,1)')):
            cls.brand[name] = cls.root / f'brand-{name}.mkv'
            ffmpeg('-f', 'lavfi', '-i', 'color=black:s=160x90:r=30:d=2', '-loop', '1', '-i', cls.mark,
                   '-filter_complex', f"[0:v][1:v]overlay=10:10:enable='{enable}'",
                   '-t', '2', '-c:v', 'ffv1', cls.brand[name])

    def test_sync_detects_half_second_offset_in_every_segment(self):
        clean = qc_sync.av_xcorr(self.clean, self.master, self.edl)
        bad = qc_sync.av_xcorr(self.delayed, self.master, self.edl)
        self.assertTrue(clean['pass'], clean)
        self.assertFalse(bad['pass'], bad)
        self.assertEqual(len(bad['value']), 2)
        for row in bad['value']:
            self.assertAlmostEqual(row['lag_ms'], 500, delta=10)
            self.assertFalse(row['pass'])

    def test_source_master_span_is_used(self):
        trimmed = self.root / 'trimmed.wav'
        ffmpeg('-i', self.master, '-ss', '2', '-t', '2', '-c:a', 'pcm_s16le', trimmed)
        report = qc_sync.av_xcorr(trimmed, self.master,
                                 [{'fromFrame': 0, 'durationFrames': 60, 'trimBeforeFrames': 60}])
        self.assertTrue(report['pass'], report)

    def test_sync_flat_or_truncated_signal_cannot_pass(self):
        silence = self.joins['silence']
        report = qc_sync.av_xcorr(silence, silence, [{'fromFrame': 0, 'toFrame': 60}])
        self.assertFalse(report['pass'])
        report = qc_sync.av_xcorr(self.clean, self.master, [{'fromFrame': 0, 'toFrame': 150}])
        self.assertFalse(report['pass'])

    def test_two_ms_hard_join_click_and_reel_times(self):
        report = qc_joins.decoder(self.joins['click'], [1.0])
        self.assertFalse(report['pass'], report)
        self.assertGreater(report['value'][0]['click_ratio'], 6)
        self.assertEqual(report['join_times_s'], [1.0])
        self.assertEqual(report['failed_join_times_s'], [1.0])

    def test_click_reference_is_local_and_loud_clean_audio_passes(self):
        self.assertTrue(qc_joins.decoder(self.joins['loud'], [1.0])['pass'])
        report = qc_joins.decoder(self.joins['click_loud_elsewhere'], [1.0])
        self.assertFalse(report['pass'], report)
        self.assertGreater(report['value'][0]['click_ratio'], 6)

    def test_rms_and_flux_have_separate_measurements(self):
        for name, metric, threshold in (('step', 'rms_step_db', 6), ('flux', 'spectral_flux', 0.5)):
            report = qc_joins.decoder(self.joins[name], [{'atFrame': 30}])
            self.assertFalse(report['pass'], report)
            self.assertGreater(report['value'][0][metric], threshold)

    def test_clean_joins_silence_and_no_joins_pass(self):
        for name in ('clean', 'silence'):
            report = qc_joins.decoder(self.joins[name], [1.0])
            self.assertTrue(report['pass'], report)
        self.assertTrue(qc_joins.decoder(self.joins['clean'], [])['pass'])
        self.assertFalse(qc_joins.decoder(self.joins['clean'], [0])['pass'])

    def test_mark_absence_on_one_beat(self):
        beats = [{'id': 'first', 'fromFrame': 0, 'toFrame': 30},
                 {'id': 'second', 'fromFrame': 30, 'toFrame': 60}]
        aspect = {'mark_box': [8, 8, 38, 30], 'mark_width': 32}
        clean = qc_brand.mark_tile(self.brand['clean'], self.mark, beats, aspect)
        bad = qc_brand.mark_tile(self.brand['absent'], self.mark, beats, aspect)
        self.assertTrue(clean['pass'], clean)
        self.assertFalse(bad['pass'], bad)
        self.assertTrue(bad['value'][0]['pass'])
        self.assertFalse(bad['value'][1]['pass'])

    def test_mark_geometry_matches_wide_and_tall_renderer(self):
        self.assertEqual(qc_brand.MARK_GEOMETRY['16:9']['box'], (64, 56, 112, 112))
        self.assertEqual(qc_brand.MARK_GEOMETRY['16:9']['image'], 80)
        self.assertEqual(qc_brand.MARK_GEOMETRY['9:16']['box'], (72, 150, 136, 136))

    def test_cue_five_frames_late_and_clean_control(self):
        events, slots = [{'id': 'fill', 'obj': 'grid', 'atFrame': 30}], {'grid': [20, 20, 40, 30]}
        clean = qc_cues.cue_sync(self.cues['clean'], events, slots)
        bad = qc_cues.cue_sync(self.cues['late'], events, slots)
        self.assertTrue(clean['pass'], clean)
        self.assertFalse(bad['pass'], bad)
        self.assertEqual(bad['value'][0]['lag_frames'], 5)
        self.assertTrue(qc_cues.cue_sync(self.cues['edge'], [{'obj': 'grid', 'atFrame': 1}], slots)['pass'])
        self.assertFalse(qc_cues.cue_sync(self.clean, events, slots)['pass'])

    def test_ocr_missing_is_explicitly_not_run(self):
        with patch.object(qc_captions.shutil, 'which', return_value=None):
            report = qc_captions.ocr(self.clean, [], [0, 0, 160, 90])
        self.assertEqual(report['status'], 'not_run')
        self.assertIsNone(report['pass'])
        self.assertIn('tesseract', report['reason'])

    def test_ocr_page_sampling_and_token_scoring(self):
        pages = [{'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'Hello', 'atFrame': 0}, {'text': 'world', 'atFrame': 20}]},
                 {'fromFrame': 30, 'toFrame': 60, 'words': [{'text': 'Hello', 'atFrame': 30}, {'text': 'world', 'atFrame': 50}]}]
        real_run = subprocess.run
        real_which = shutil.which
        seen_images = []

        def fake_ocr(cmd, **kwargs):
            if cmd[0] == 'test-tesseract':
                seen_images.append(kwargs['input'])
                return subprocess.CompletedProcess(cmd, 0, stdout=b'HELLO, world!', stderr=b'')
            return real_run(cmd, **kwargs)

        with patch.object(qc_captions.shutil, 'which', side_effect=lambda name: 'test-tesseract' if name == 'tesseract' else real_which(name)), \
                patch.object(qc_captions.subprocess, 'run', side_effect=fake_ocr):
            report = qc_captions.ocr(self.brand['clean'], pages, [0, 0, 80, 60])
        self.assertTrue(report['pass'], report)
        self.assertEqual([r['frame'] for r in report['value']], [25, 55])
        for page, row in zip(pages, report['value']):
            self.assertGreaterEqual(row['frame'], page['words'][-1]['atFrame'] + 2)
            self.assertLessEqual(row['frame'], page['toFrame'] - 1)
        self.assertEqual(len(seen_images), 2)
        self.assertTrue(all(image.startswith(b'P5\n80 60\n') for image in seen_images))
        for actual in (['hello'], ['hello', 'world', 'extra'], ['world', 'hello']):
            self.assertLess(qc_captions._agreement(['hello', 'world'], actual), 0.98)

    def test_run_qc_optional_inputs_and_decode_errors(self):
        absent = qc.run_qc(str(self.clean), 'scoreboard-test')
        self.assertEqual(absent['checks']['sync.av_xcorr']['status'], 'not_run')
        self.assertFalse(absent['complete'])
        report = qc.run_qc(str(self.delayed), 'scoreboard-test', dialogue_master=str(self.master),
                           edl=self.edl, joins=[1.0], events=[{'obj': 'grid', 'atFrame': 30}],
                           slots={'grid': [20, 20, 40, 30]}, mark_png=str(self.mark),
                           beats=[{'fromFrame': 0, 'toFrame': 30}],
                           aspect={'mark_box': [8, 8, 38, 30], 'mark_width': 32})
        for key in ('sync.av_xcorr', 'joins.decoder', 'brand.mark_tile', 'motion.cue_sync'):
            self.assertEqual(report['checks'][key]['status'], 'measured', report)
        self.assertFalse(report['checks']['sync.av_xcorr']['pass'])
        self.assertFalse(report['measured_pass'])
        json.dumps(report, allow_nan=False)
        broken = qc.run_qc(str(self.clean), 'scoreboard-test', dialogue_master='missing-master.wav', edl=self.edl)
        self.assertEqual(broken['checks']['sync.av_xcorr']['status'], 'error')
        self.assertFalse(broken['checks']['sync.av_xcorr']['pass'])


class QCContracts(unittest.TestCase):
    @unittest.skipIf(shutil.which('tesseract') is None, 'tesseract is not on PATH')
    def test_real_highlighted_caption_crops(self):
        folder = ROOT / 'fixtures/ve/my-test-19s/ocr'
        for case in json.loads((folder / 'cases.json').read_text()):
            with self.subTest(case=case['file']):
                data = gzip.decompress((folder / case['file']).read_bytes())
                header = re.match(rb'P5\s+(\d+)\s+(\d+)\s+255\s', data)
                self.assertIsNotNone(header)
                width, height = int(header[1]), int(header[2])
                pixels = np.frombuffer(data[header.end():], dtype=np.uint8).reshape(height, width)
                page = {'fromFrame': case['frame'] - 2, 'toFrame': case['frame'] + 1,
                        'words': [{'text': word, 'atFrame': case['frame'] - 2}
                                  for word in case['expected'].split()]}
                with patch.object(qc_captions, 'gray_frames', return_value=pixels[None]), \
                        patch.object(qc_captions.subprocess, 'run', wraps=subprocess.run) as run:
                    report = qc_captions.ocr('fixture', [page], [0, 0, width, height])
                row = report['value'][0]
                self.assertGreaterEqual(row['agreement'], 0.98, row)
                self.assertTrue(report['pass'], report)
                self.assertIn(row['variant'], ('raw', 'normalised', 'raw_2x', 'normalised_2x'))
                self.assertLessEqual(run.call_count, 4)

    def test_short_fully_revealed_windows_are_sampled(self):
        pages = [{'fromFrame': first, 'toFrame': last,
                  'words': [{'text': 'hello', 'atFrame': word}]}
                 for first, last, word in [(311, 356, 352), (436, 479, 475), (0, 30, 27)]]
        with patch.object(qc_captions.shutil, 'which', return_value='tesseract'), \
                patch.object(qc_captions, 'gray_frames', return_value=np.zeros((1, 10, 10))), \
                patch.object(qc_captions.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout=b'hello')):
            report = qc_captions.ocr('unused', pages, [0, 0, 10, 10])
        self.assertTrue(report['pass'], report)
        self.assertEqual([row['frame'] for row in report['value']], [354, 477, 29])

    def test_page_without_fully_revealed_window_is_not_sampled(self):
        page = {'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'late', 'atFrame': 29}]}
        with patch.object(qc_captions.shutil, 'which', return_value='tesseract'), \
                patch.object(qc_captions, 'gray_frames') as decode:
            report = qc_captions.ocr('unused', [page], [0, 0, 10, 10])
        decode.assert_not_called()
        self.assertEqual(report['value'][0]['status'], 'not_sampled')
        self.assertIsNone(report['pass'])
        self.assertEqual(report['status'], 'incomplete')
        with patch.object(qc_captions.shutil, 'which', return_value=None):
            missing_ocr = qc_captions.ocr('unused', [page], [0, 0, 10, 10])
        self.assertEqual(missing_ocr['value'][0]['status'], 'not_sampled')
        self.assertIsNone(missing_ocr['pass'])

    def test_default_mark_matching_uses_renderer_boxes(self):
        for aspect, box, width, canvas in (
                ('16:9', (64, 56, 112, 112), 80, '1920x1080'),
                ('9:16', (72, 150, 136, 136), 96, '1080x1920')):
            template = (np.indices((width, width)).sum(axis=0) % 2 * 255).astype('uint8')
            pixels = np.zeros((1, box[3], box[2]), np.float32)
            pixels[0, :width, :width] = template
            image = f'P5\n{width} {width}\n255\n'.encode() + template.tobytes()
            with patch.object(qc_brand, 'ffmpeg', return_value='ffmpeg'), \
                    patch.object(qc_brand.subprocess, 'run', side_effect=[
                        subprocess.CompletedProcess([], 0, stderr=f'Video: rawvideo, gray, {canvas}'),
                        subprocess.CompletedProcess([], 0, stdout=image)]), \
                    patch.object(qc_brand, 'gray_frames', return_value=pixels) as decode:
                report = qc_brand.mark_tile('unused', 'mark.png', [{'fromFrame': 0, 'toFrame': 30}], aspect)
            decode.assert_called_once_with('unused', 14, 14, box)
            self.assertTrue(report['pass'], report)

    def test_unsampled_page_and_failed_page_remain_incomplete(self):
        pages = [{'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'late', 'atFrame': 29}]},
                 {'fromFrame': 30, 'toFrame': 60, 'words': [{'text': 'hello', 'atFrame': 30}]}]
        with patch.object(qc_captions.shutil, 'which', return_value='tesseract'), \
                patch.object(qc_captions, 'gray_frames', return_value=np.zeros((1, 10, 10))), \
                patch.object(qc_captions.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout=b'wrong')):
            report = qc_captions.ocr('unused', pages, [0, 0, 10, 10])
        self.assertFalse(report['pass'])
        with self.measurements() as mocks:
            mocks['ocr'].return_value = report
            result = qc.run_qc('unused', 'scoreboard-test', **qc.inputs_from_props(self.props()))
        self.assertFalse(result['complete'])
        self.assertFalse(result['measured_pass'])

    def test_cue_change_must_exceed_local_drift_and_exit_is_measured(self):
        slots = {'grid': [0, 0, 2, 2]}

        def frames(_render, first, last, _box):
            values = np.arange(first, last + 1, dtype=np.float32)
            return np.broadcast_to(values[:, None, None], (len(values), 2, 2)).copy()

        with patch.object(qc_cues, 'gray_frames', side_effect=frames):
            drift = qc_cues.cue_sync('unused', [{'obj': 'grid', 'atFrame': 30}], slots)
        self.assertFalse(drift['pass'], drift)
        self.assertEqual(drift['value'][0]['threshold'], 3)

        def changed(_render, first, last, _box):
            values = np.arange(first, last + 1)
            return np.broadcast_to((values < 30)[:, None, None] * 100., (len(values), 2, 2)).copy()

        event = {'obj': 'grid', 'atFrame': 30, 'verb': 'exit'}
        with patch.object(qc_cues, 'gray_frames', side_effect=changed) as decode:
            real = qc_cues.cue_sync('unused', [event], slots)
        decode.assert_called_once()
        self.assertTrue(real['pass'], real)
        with patch.object(qc_cues, 'gray_frames', side_effect=frames):
            self.assertFalse(qc_cues.cue_sync('unused', [event], slots)['pass'])
        empty = qc_cues.cue_sync('unused', [], slots)
        self.assertFalse(empty['pass'])
        self.assertEqual(empty['reason'], 'no cues to check')

    @staticmethod
    def props():
        return {'aspect': '16:9', 'fps': 30, 'durationFrames': 120,
                'captions': [{'fromFrame': 0, 'toFrame': 120, 'words': [{'text': 'hello', 'atFrame': 20}]}],
                'beats': [{'id': 'one', 'layout': 'P1', 'fromFrame': 0, 'toFrame': 60, 'uses': ['grid']},
                          {'id': 'two', 'layout': 'P3', 'fromFrame': 60, 'toFrame': 120, 'uses': ['grid']}],
                'segments': [{'fromFrame': 0, 'durationFrames': 60, 'trimBeforeFrames': 900},
                             {'fromFrame': 60, 'durationFrames': 60, 'trimBeforeFrames': 600}],
                'events': [{'id': 'enter', 'obj': 'grid', 'atFrame': 30, 'verb': 'enter'},
                           {'id': 'exit', 'obj': 'grid', 'atFrame': 90, 'verb': 'exit'}],
                'brand': {'mark': {'src': 'mark.png'}},
                'audio': {'stem': {'src': 'master.wav', 'trimBeforeFrames': 3}}}

    def measurements(self):
        class Measurements(ExitStack):
            def __enter__(stack):
                super().__enter__()
                passed = {'value': [], 'target': 'synthetic', 'pass': True, 'status': 'measured'}
                mocks = {}
                for module, name in ((qc_sync, 'av_xcorr'), (qc_joins, 'decoder'), (qc_captions, 'ocr'),
                                     (qc_brand, 'mark_tile'), (qc_cues, 'cue_sync'), (qc_audio, 'bed')):
                    mocks[name] = stack.enter_context(patch.object(module, name, return_value=passed))
                stack.enter_context(patch.object(qc, 'loudness', return_value={'integrated_lufs': -14, 'true_peak_dbtp': -1}))
                stack.enter_context(patch.object(qc, 'frame_diffs', return_value=np.full(150, 2.)))
                stack.enter_context(patch.object(qc, 'long_silences', return_value=[]))
                stack.enter_context(patch.object(qc, 'sha256_file', return_value='synthetic-sha'))
                stack.enter_context(patch.object(qc, 'duration_s', return_value=4.))
                return mocks
        return Measurements()

    def test_props_command_supplies_every_measurement_and_can_complete(self):
        props = self.props()
        with self.measurements() as mocks, patch.object(qc, 'run_qc', wraps=qc.run_qc) as run_qc, \
                patch.object(ve, 'load_json', return_value=props), \
                patch.object(ve, 'write_json') as write, redirect_stdout(io.StringIO()), \
                patch.object(sys, 'argv', ['ve', 'qc', 'cut.mp4', '--format', 'scoreboard-test', '--props', 'props.json']):
            self.assertEqual(ve.main(), 0)
        self.assertEqual(set(run_qc.call_args.kwargs),
                         {'pages', 'beats', 'aspect', 'events', 'slots', 'region', 'mark_png', 'dialogue_master', 'edl', 'joins'})
        report = write.call_args.args[1]
        self.assertTrue(report['complete'], report)
        self.assertTrue(report['measured_pass'], report)
        mocks['ocr'].assert_called_once_with('cut.mp4', props['captions'], (260, 773, 1400, 187))
        mocks['mark_tile'].assert_called_once_with('cut.mp4', 'mark.png', props['beats'], '16:9')
        mocks['decoder'].assert_called_once_with('cut.mp4', [2.0])
        mocks['av_xcorr'].assert_called_once_with('cut.mp4', 'master.wav', [
            {'fromFrame': 0, 'toFrame': 60, 'trimBeforeFrames': 3},
            {'fromFrame': 60, 'toFrame': 120, 'trimBeforeFrames': 63}])
        call = mocks['cue_sync'].call_args.args
        self.assertEqual(call[:2], ('cut.mp4', props['events']))
        self.assertEqual(call[2]['enter'], (96, 208, 1728, 572))
        self.assertEqual(call[2]['exit'], (96, 208, 1026, 420))
        with self.measurements(), patch.object(ve, 'write_json') as write, redirect_stdout(io.StringIO()):
            self.assertEqual(ve.cmd_qc(Namespace(cut='cut.mp4', format='scoreboard-test', out=None)), 0)
        self.assertFalse(write.call_args.args[1]['complete'])


class RendererLayoutMirrorTest(unittest.TestCase):
    def test_qc_slots_come_from_the_renderer_table(self):
        from velib.qc import _renderer_layouts
        layouts = _renderer_layouts()
        self.assertEqual(layouts['9:16']['F1'][0], (120, 852, 660, 290))
        self.assertEqual(layouts['16:9']['F1'][0], (1176, 54, 648, 490))
        for aspect in layouts.values():
            self.assertEqual(set(aspect), {'P1', 'P3', 'P6', 'F1', 'F3', 'STAGE'})
            self.assertTrue(all(len(box) == 4 for boxes in aspect.values() for box in boxes))


if __name__ == '__main__':
    unittest.main()
