"""QC module acceptance on lavfi media, with clean controls and report wiring."""
import json
import os
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
from velib import qc, qc_sync, qc_joins, qc_captions, qc_brand, qc_cues, qc_audio, qc_gates, qc_faces, qc_channel, qc_opening  # noqa: E402
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

    def test_vertical_cut_must_carry_no_mark(self):
        # Ruling, Krish, 2026-11-11: no mark on vertical video. A cut with the mark on any beat fails.
        beats = [{'id': 'first', 'fromFrame': 0, 'toFrame': 30},
                 {'id': 'second', 'fromFrame': 30, 'toFrame': 60}]
        aspect = {'mark_box': [8, 8, 38, 30], 'mark_width': 32}
        self.assertFalse(qc_brand.no_mark(self.brand['clean'], self.mark, beats, aspect)['pass'])
        partly = qc_brand.no_mark(self.brand['absent'], self.mark, beats, aspect)
        self.assertFalse(partly['pass'])
        self.assertTrue(partly['value'][1]['pass'])

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
                                     (qc_brand, 'mark_tile'), (qc_cues, 'cue_sync'), (qc_audio, 'bed'), (qc_audio, 'continuity'),
                                     (qc_gates, 'words_lost'), (qc_gates, 'joins_in_gaps'), (qc_gates, 'captions_clock'),
                                     (qc_gates, 'captions_render'), (qc_faces, 'off_face'), (qc_channel, 'safe_zones'),
                                     (qc_opening, 'opening')):
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
        gates = {'heard': {'faster-whisper': [{'w': 'hello', 's': 0.7, 'e': 0.9}]}, 'script': 'hello', 'take_words': []}
        with self.measurements() as mocks, patch.object(qc, 'run_qc', wraps=qc.run_qc) as run_qc, \
                patch.object(ve, 'load_json', return_value=props), patch.object(ve, '_gate_inputs', return_value=gates), \
                patch.object(ve, 'write_json') as write, redirect_stdout(io.StringIO()), \
                patch.object(sys, 'argv', ['ve', 'qc', 'cut.mp4', '--format', 'scoreboard-test', '--props', 'props.json']):
            self.assertEqual(ve.main(), 0)
        self.assertEqual(set(run_qc.call_args.kwargs),
                         {'pages', 'beats', 'aspect', 'events', 'slots', 'region', 'mark_png', 'dialogue_master', 'edl', 'joins',
                          'heard', 'script', 'take_words', 'caption_style', 'plate_video', 'plate_offset', 'opening'})
        mocks['opening'].assert_called_once_with('cut.mp4', qc.opening_view(props))
        report = write.call_args.args[1]
        self.assertTrue(report['complete'], report)
        self.assertTrue(report['measured_pass'], report)
        # Each page carries where it is drawn (ve-qc-2-captions-where-drawn): the caption box plus 12 px.
        mocks['ocr'].assert_called_once()
        path, pages, region = mocks['ocr'].call_args.args
        self.assertEqual((path, region), ('cut.mp4', (260, 773, 1400, 187)))
        self.assertEqual([{k: v for k, v in page.items() if k != 'region'} for page in pages], props['captions'])
        self.assertEqual(pages[0]['region'], (248, 761, 1424, 211))
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


    def test_a_stinged_cut_is_measured_on_the_files_clock(self):
        """The intro sting in front of a wide whole cut (Krish, 2026-11-05: "I think it should go at the start of the
        longer wide videos 100%,"): the props stay on the cut's own clock, and every frame QC reads in the file is the
        sting's 56 frames later. The stem starts on the file's frame 0, so the lip-sync EDL reads it at the moved frames."""
        plain = self.props()
        stinged = dict(plain, sting={'src': 'sting.mp4', 'series': 'mind_the_gap', 'frames': 56, 'sha256': 'a' * 64},
                       audio={'stem': {'src': 'master.wav', 'trimBeforeFrames': 0}})
        before, after = qc.inputs_from_props(dict(plain, audio=stinged['audio'])), qc.inputs_from_props(stinged)
        self.assertEqual(qc.lead_frames(stinged), 56)
        self.assertEqual([(b['fromFrame'], b['toFrame']) for b in after['beats']], [(56, 116), (116, 176)])
        self.assertEqual([e['atFrame'] for e in after['events']], [86, 146])
        self.assertEqual(after['slots'], before['slots'], 'a box is where it is drawn, whenever it is drawn')
        page = after['pages'][0]
        self.assertEqual((page['fromFrame'], page['toFrame'], page['words'][0]['atFrame']), (56, 176, 76))
        self.assertEqual(page['region'], before['pages'][0]['region'])
        self.assertEqual(after['edl'], [{'fromFrame': 56, 'toFrame': 116, 'trimBeforeFrames': 56},
                                        {'fromFrame': 116, 'toFrame': 176, 'trimBeforeFrames': 116}])
        # The sting to his face is not a take join; the join between takes is the sting's frames later.
        self.assertEqual(after['joins'], [(60 + 56) / 30])
        # The plate under each beat is read the beat's shift back: 56 frames for every beat behind a sting in front.
        self.assertEqual((after['plate_offset'], [b['shift'] for b in after['beats']]), (900, [56, 56]))
        self.assertEqual(after['opening'], qc.opening_view(stinged))
        self.assertEqual(stinged['beats'][0]['fromFrame'], 0, 'the props are never changed')
        # ve qc --edl: the EDL's joins are on the cut's own clock, so they move by the sting too.
        edl = {'joins': [{'at_s': 2.5}]}
        with self.measurements(), patch.object(qc, 'run_qc', wraps=qc.run_qc) as run_qc, \
                patch.object(ve, 'load_json', side_effect=lambda path: edl if str(path) == 'edl.json' else stinged), \
                patch.object(ve, '_gate_inputs', return_value={}), patch.object(ve, 'write_json'), redirect_stdout(io.StringIO()), \
                patch.object(sys, 'argv', ['ve', 'qc', 'cut.mp4', '--format', 'scoreboard-test', '--props', 'props.json',
                                           '--edl', 'edl.json']):
            ve.main()
        self.assertAlmostEqual(run_qc.call_args.kwargs['joins'][0], 2.5 + 56 / 30)


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg is not on PATH')
class OpeningRowTest(unittest.TestCase):
    """ve qc's opening row (velib.qc_opening) on synthetic media: stand-in sting clips (intro.stand_in, under .cache,
    where the stand-in config is honoured), never Krish's. Ruling (Krish, 2026-11-12): "Nothing before the hook, ever.
    Remove the sting exception for good." Props or a file with a sting in front fail, even the approved clip."""

    @classmethod
    def setUpClass(cls):
        from velib import compile as ve_compile  # noqa: PLC0415
        cls.intro = ve_compile._intro()
        (ROOT / '.cache').mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='ve-opening-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.work = Path(cls.temp.name)
        cls.approved, cls.clips = cls.intro.stand_in(cls.work / 'approved', shapes=('16x9', '9x16'))
        cls.candidate, _ = cls.intro.stand_in(cls.work / 'candidate', status='candidate', shapes=('16x9',))
        cls.cfg = cls.intro.load(cls.approved)
        cls.clip = {(shape, series): cls.clips / Path(entry['library']).name
                    for shape, per in cls.cfg['clips'].items() for series, entry in per.items()}
        cls.wide_cut = cls.work / 'cut-16x9.mp4'
        cls.tall_cut = cls.work / 'cut-9x16.mp4'
        for path, size in ((cls.wide_cut, '1920x1080'), (cls.tall_cut, '1080x1920')):
            ffmpeg('-f', 'lavfi', '-i', f'testsrc2=s={size}:r=30', '-frames:v', 120, '-c:v', 'libx264', '-preset', 'ultrafast',
                   '-pix_fmt', 'yuv420p', path)
        cls.stem = cls.work / 'stem.wav'
        cls.stem.with_suffix('.bed.json').write_text(json.dumps({'lead_frames': 56}), encoding='utf-8')

    def joined(self, name, first, cut, hold=0):
        """first's frames, its last held `hold` more frames, then the cut, keeping the cut's frame count."""
        out = self.work / name
        ffmpeg('-i', first, '-i', cut, '-filter_complex',
               f'[0:v]tpad=stop={hold}:stop_mode=clone,setpts=PTS-STARTPTS[s];[1:v]trim=end_frame={120 - hold},'
               'setpts=PTS-STARTPTS[c];[s][c]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-preset',
               'ultrafast', '-pix_fmt', 'yuv420p', out)
        return str(out)

    def view(self, aspect='16:9', sting=True, label='mind.the.gap', trim=0):
        entry = self.cfg['clips']['16x9']['mind_the_gap']
        return {'aspect': aspect, 'fps': 30, 'durationFrames': 120, 'ending': {'fromFrame': 90, 'url': 'makeyourmindup.ai'},
                'series': {'label': label}, 'audio': {'stem': {'src': str(self.stem), 'trimBeforeFrames': trim}},
                'sting': {'src': str(self.clip['16x9', 'mind_the_gap']), 'series': 'mind_the_gap', 'frames': 56,
                          'sha256': entry['sha256']} if sting else None}

    def row(self, path, view, config=None):
        env = {self.intro.CONFIG_ENV: str(config or self.approved), self.intro.CLIPS_ENV: str(self.clips)}
        with patch.dict('os.environ', env):
            return qc_opening.opening(path, view)

    def test_even_the_approved_sting_in_front_of_a_series_wide_cut_fails(self):
        path = self.joined('stinged.mp4', self.clip['16x9', 'mind_the_gap'], self.wide_cut)
        row = self.row(path, self.view())
        self.assertFalse(row['pass'], row)
        self.assertIn('Nothing before the hook, ever.', ' '.join(row['problems']))
        # Through run_qc, as ve qc runs it.
        with patch.dict('os.environ', {self.intro.CONFIG_ENV: str(self.approved), self.intro.CLIPS_ENV: str(self.clips)}):
            report = qc.run_qc(path, 'scoreboard-test', opening=self.view())
        self.assertFalse(report['checks']['opening']['pass'], report['checks']['opening'])

    def test_a_sting_the_props_carry_fails_on_any_cut(self):
        path = self.joined('stinged-tall-props.mp4', self.clip['16x9', 'mind_the_gap'], self.wide_cut)
        for why, view in (('a tall cut', self.view(aspect='9:16')), ('an off day', self.view(label='off.day')),
                          ('another series', self.view(label='under.the.hood')), ('a series wide cut', self.view())):
            with self.subTest(why):
                self.assertIn('Nothing before the hook, ever.', ' '.join(self.row(path, view)['problems']))

    def test_an_episode_card_in_front_fails(self):
        view = dict(self.view(sting=False), opening={'kind': 'episode_card', 'said': 'I want the episode card to come in.', 'on': '2026-11-09'})
        row = self.row(str(self.wide_cut), view)
        self.assertFalse(row['pass'], row)
        self.assertIn('episode card', ' '.join(row['problems']))

    def test_a_cut_that_opens_on_its_hook_shows_no_sting(self):
        for name, path, aspect in (('tall', self.tall_cut, '9:16'), ('wide, candidate', self.wide_cut, '16:9')):
            with self.subTest(name):
                row = self.row(str(path), self.view(aspect=aspect, sting=False), self.candidate if aspect == '16:9' else None)
                self.assertTrue(row['pass'], row)
                self.assertEqual((row['value']['opening'], row['value']['file_frames']), ('hook', 120))
        tall = self.row(str(self.tall_cut), self.view(aspect='9:16', sting=False))
        self.assertEqual(len(tall['value']['clips_compared']), 3, 'each series\' 9x16 stand-in clip was compared')

    def test_a_sting_in_front_of_a_hook_cut_fails_and_a_hook_cut_passes(self):
        tall = self.joined('tall-stinged.mp4', self.clip['9x16', 'under_the_hood'], self.tall_cut)
        found = ' '.join(self.row(tall, self.view(aspect='9:16', sting=False))['problems'])
        self.assertIn('opens on the under_the_hood 9x16 sting', found)
        self.assertIn('something is in front of it', found)
        # A wide whole series cut on its hook passes, even with an approved stand-in sting config: nothing goes before it.
        self.assertTrue(self.row(str(self.wide_cut), self.view(sting=False))['pass'])
        # A proof window keeps its ending and trims the stem: it is not a whole cut, and opens on no sting.
        self.assertTrue(self.row(str(self.wide_cut), self.view(sting=False, trim=200))['pass'])
        # An off-day wide cut opens on its hook.
        self.assertTrue(self.row(str(self.wide_cut), self.view(sting=False, label='off.day'))['pass'])


    def spliced(self, name, at=60):
        """The cut's frames to `at`, the mind_the_gap sting, then the cut on from `at`: the sting after the hook."""
        out = self.work / name
        ffmpeg('-i', self.wide_cut, '-i', self.clip['16x9', 'mind_the_gap'], '-filter_complex',
               f'[0:v]split[a][b];[a]trim=end_frame={at},setpts=PTS-STARTPTS[h];[b]trim=start_frame={at},setpts=PTS-STARTPTS[r];'
               '[1:v]setpts=PTS-STARTPTS[s];[h][s][r]concat=n=3:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-preset',
               'ultrafast', '-pix_fmt', 'yuv420p', out)
        return str(out)

    def test_the_hook_then_an_approved_sting_after_it_passes_frame_for_frame(self):
        # The sting after the hook (a new design; config/intro-sting.json is retired, so only a stand-in approves one here).
        stem = self.work / 'stem-after-hook.wav'
        stem.with_suffix('.bed.json').write_text(json.dumps({'lead_frames': 56, 'sting_at_frame': 60}), encoding='utf-8')
        view = self.view()
        view['sting'] = dict(view['sting'], atFrame=60)
        view['audio'] = {'stem': {'src': str(stem), 'trimBeforeFrames': 0}}
        row = self.row(self.spliced('after-hook.mp4'), view)
        self.assertTrue(row['pass'], row)
        self.assertEqual((row['value']['opening'], row['value']['lead_frames'], row['value']['sting_at_frame'],
                          row['value']['file_frames']), ('hook', 0, 60, 176))
        # A sting where the props do not put it fails frame for frame.
        self.assertIn('frame for frame', ' '.join(self.row(self.spliced('early.mp4', at=40), view)['problems']))
        # The real config is retired: the same file fails until he approves a sting.
        with patch.dict('os.environ', {}):
            os.environ.pop(self.intro.CONFIG_ENV, None)
            os.environ.pop(self.intro.CLIPS_ENV, None)
            self.assertIn('status retired', ' '.join(qc_opening.opening(self.spliced('after-hook-real.mp4'), view)['problems']))

@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not on PATH')
class StingContinuityTest(unittest.TestCase):
    """The bed under the sting (house rule HOOK_IS_THE_INTRO: "with no sound of its own and the music bed under it"): on a cut whose premix
    laid a lead (lead_frames), the render's floor holds from its first window, not from his first word."""

    def test_a_bare_sting_is_a_drop_out_and_a_hook_cut_is_measured_from_his_first_word(self):
        with tempfile.TemporaryDirectory(prefix='ve-sting-bed-') as tmp:
            render = Path(tmp) / 'render.wav'
            # 1 s with no music under the sting, then the bed: what a stem with the bed starting late would sound like.
            ffmpeg('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=1', '-f', 'lavfi', '-i', 'sine=f=220:r=48000:d=5',
                   '-filter_complex', '[1:a]volume=0.3[t];[0:a][t]concat=n=2:v=0:a=1[a]', '-map', '[a]', render)
            bed = {'bed_present': True, 'levels': {'bed_lufs': -31}, 'body_s': [2.0, 5.0]}
            sidecar = Path(tmp) / 'render.bed.json'
            for lead, holds in ((56, False), (0, True)):
                with self.subTest(lead=lead):
                    sidecar.write_text(json.dumps({'duration_s': 6.0, 'lead_frames': lead, 'bed': bed}), encoding='utf-8')
                    row = qc_audio.continuity(str(render), str(render), str(sidecar))
                    self.assertEqual(row['pass'], holds, row)
            self.assertTrue(row['target'].endswith('from 2.0 to 4.5 s'))


class RendererLayoutMirrorTest(unittest.TestCase):
    def test_qc_slots_come_from_the_renderer_table(self):
        from velib.qc import _renderer_layouts
        layouts = _renderer_layouts()
        self.assertEqual(layouts['9:16']['F1'][0], (60, 844, 700, 206))
        self.assertEqual(layouts['16:9']['F1'][0], (1176, 54, 648, 490))
        # SPLIT is tall only (no wide lock); its stage box reads the seam from the mocks file (FWP_SPLIT_SEAM_Y).
        self.assertEqual(set(layouts['9:16']), {'P1', 'P3', 'P6', 'F1', 'F3', 'STAGE', 'SPLIT', 'WINDOW'})
        self.assertEqual(set(layouts['16:9']), {'P1', 'P3', 'P6', 'F1', 'F3', 'STAGE', 'WINDOW'})
        self.assertEqual(layouts['9:16']['SPLIT'], [(60, 300, 960, 400)])
        for aspect in layouts.values():
            self.assertTrue(all(len(box) == 4 for boxes in aspect.values() for box in boxes))


if __name__ == '__main__':
    unittest.main()
