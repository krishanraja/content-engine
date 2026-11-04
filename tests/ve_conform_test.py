"""ve ingest and ve conform on synthetic clocks and synthetic media (F09, F10). No real take, no model, no network."""
from __future__ import annotations

import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import conform, gaps, takes  # noqa: E402

SCRIPT = 'We tested three models. The answer surprised us. Here is why.'.split()


def clock(words, *, start=0.5, word_s=0.30, joint_s=0.04, pause_s=0.40, extra_pause=None):
    """Words read one after another: joint_s between words inside a sentence, pause_s after a full stop."""
    out, t = [], start
    for index, text in enumerate(words):
        out.append({'word': text, 'onset_s': round(t, 4), 'end_s': round(t + word_s, 4)})
        t += word_s + (pause_s if text.endswith(('.', ',')) else joint_s) + (extra_pause or {}).get(index, 0)
    return out, round(t + 0.5, 4)


def spec(edit=None):
    return {'piece_id': 'w27-fixture', 'format': 'face-with-proof',
            'cuts': {'short': {'aspect': '9:16', 'take': 'take-1', 'edit': edit or {'remove': [], 'speed': 1}}}}


def have_ffmpeg() -> bool:
    return shutil.which('ffmpeg') is not None


class ConformTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-conform-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.ve = self.dir / 've'
        self.script = [{'w': i, 'word': w} for i, w in enumerate(SCRIPT)]

    def ingest(self, take, words_a, duration, words_b=None, media=None):
        a = self.dir / f'{take}.a.json'
        b = self.dir / f'{take}.b.json'
        a.write_text(json.dumps(words_a))
        b.write_text(json.dumps({'words': [{'text': w['word'], 'start': w['onset_s'], 'end': w['end_s']}
                                           for w in (words_b if words_b is not None else words_a)]}))
        if media is None:
            media = self.dir / f'{take}.bin'
            media.write_bytes(take.encode())
        return takes.ingest(self.ve, 'w27-fixture', take, media, clock_a=a, clock_b=b,
                            aligner_a='faster-whisper:small.en', aligner_b='faster-whisper:medium.en', duration_s=duration)

    # ingest -----------------------------------------------------------------
    def test_ingest_refuses_one_aligner_and_the_same_aligner_twice(self):
        words, duration = clock(SCRIPT)
        a = self.dir / 'a.json'
        a.write_text(json.dumps(words))
        media = self.dir / 'm.bin'
        media.write_bytes(b'x')
        for second in ('', 'faster-whisper:small.en'):
            with self.assertRaises(ValueError):
                takes.ingest(self.ve, 'p', 'take-1', media, clock_a=a, clock_b=a, aligner_a='faster-whisper:small.en',
                             aligner_b=second, duration_s=duration)
        with self.assertRaises(ValueError):
            gaps.agreed_gaps(words, [])

    def test_ingest_reads_both_clock_shapes_and_binds_the_media_hash(self):
        words, duration = clock(SCRIPT)
        path = self.ingest('take-1', words, duration)
        record = takes.load_take(self.ve, 'take-1')
        self.assertEqual(path.name, 'take-1.json')
        self.assertEqual(len(record['aligners']['b']['words']), len(SCRIPT))
        self.assertEqual(record['aligners']['a']['words'][0]['text'], 'We')
        self.assertIsNone(takes.check_media(record))
        Path(record['media']['path']).write_bytes(b'changed')
        self.assertIn('changed since ingest', takes.check_media(record))

    def test_ingest_refuses_a_paid_aligner(self):
        words, duration = clock(SCRIPT)
        a = self.dir / 'pa.json'
        a.write_text(json.dumps(words))
        media = self.dir / 'paid.bin'
        media.write_bytes(b'paid')
        with self.assertRaises(ValueError):
            takes.ingest(self.ve, 'w27-fixture', 'take-paid', media, clock_a=a, clock_b=a,
                         aligner_a='faster-whisper:small.en', aligner_b='elevenlabs:scribe_v1', duration_s=duration)

    def test_ingest_refuses_words_after_the_media_ends(self):
        words, duration = clock(SCRIPT)
        with self.assertRaises(ValueError):
            self.ingest('take-1', words, duration - 2)

    # conform ----------------------------------------------------------------
    def test_one_clean_take_plays_through_with_no_join(self):
        words, duration = clock(SCRIPT)
        self.ingest('take-1', words, duration)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual(len(edl['segments']), 1)
        self.assertEqual(edl['joins'], [])
        self.assertEqual([w['w'] for w in edl['words']], list(range(len(SCRIPT))))
        self.assertEqual(conform.lint_edl(edl, conform.records_for(edl, self.ve), spec()), [])

    def test_silent_spans_find_a_pause_and_ignore_a_breath(self):
        loud, quiet = [-18.0] * 30, [-55.0] * 12
        self.assertEqual(takes.silent_spans(loud + quiet + loud), [[1.0, 1.4]])
        self.assertEqual(takes.silent_spans(loud + [-55.0] * 3 + loud), [])

    def test_a_pause_folded_into_a_word_moves_its_onset_to_the_voice(self):
        # Thursday 5 Nov: the aligner ran "connected" edge to edge into "Muse", so Muse's caption showed in his pause.
        self.assertEqual(takes.voiced_onset(11.73, 12.48, [[11.80, 12.20]]), 12.20)
        self.assertEqual(takes.voiced_onset(11.73, 12.48, [[12.30, 12.40]]), 11.73)  # a pause late in the word stays
        self.assertEqual(takes.voiced_onset(11.73, 12.48, []), 11.73)

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not installed')
    def test_conform_starts_a_word_when_the_take_speaks_not_in_the_pause_before(self):
        words, duration = clock(SCRIPT)
        second = SCRIPT.index('The')
        # The aligner gives "The" a start 0.4 s early, inside the silence after "models."
        words[second]['onset_s'] = round(words[second]['onset_s'] - 0.4, 4)
        tones = '+'.join(f"between(t,{w['onset_s'] + (0.4 if i == second else 0)},{w['end_s']})"
                         for i, w in enumerate(words))
        media = self.dir / 'take-1.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=f=220:d={duration}',
                        '-af', f"volume='if({tones},1,0.001)':eval=frame", str(media)], check=True)
        self.ingest('take-1', words, duration, media=media)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        row = next(w for w in edl['words'] if w['w'] == second)
        self.assertIn('heard_onset_s', row)
        self.assertAlmostEqual(row['onset_s'] - row['heard_onset_s'], 0.4, delta=1 / 30 + 0.01)

    def test_a_restart_is_removed_with_a_join_in_an_agreed_gap(self):
        flubbed = SCRIPT[:4] + ['The', 'answer,'] + SCRIPT[4:]
        words, duration = clock(flubbed, extra_pause={5: 0.10})
        self.ingest('take-1', words, duration)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual(len(edl['joins']), 1)
        self.assertEqual(edl['flubs_removed'][0]['words'], 'The answer,')
        self.assertEqual(edl['unscripted_kept'], [])
        self.assertEqual(conform.lint_edl(edl, conform.records_for(edl, self.ve), spec()), [])
        for join in edl['joins']:
            self.assertEqual(join['crossfade_ms'], 30.0)

    def test_lines_are_chosen_across_takes_and_the_later_clean_take_wins_a_tie(self):
        bad = SCRIPT[:4] + ['The', 'um', 'answer', 'surprised', 'us.'] + SCRIPT[8:]
        words, duration = clock(bad, joint_s=0.02)  # no gap lets the filler go: it would be kept through
        self.ingest('take-1', words, duration)
        line2, duration2 = clock(SCRIPT[4:8])
        self.ingest('take-2', line2, duration2)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual([line['take'] for line in edl['lines']], ['take-1', 'take-2', 'take-1'])
        self.assertEqual(edl['unscripted_kept'], [])
        self.assertEqual(len(edl['joins']), 2)
        self.assertEqual(conform.lint_edl(edl, conform.records_for(edl, self.ve), spec()), [])

    def test_a_filler_no_gap_can_remove_is_kept_and_reported_not_hidden(self):
        bad = SCRIPT[:4] + ['The', 'um', 'answer', 'surprised', 'us.'] + SCRIPT[8:]
        words, duration = clock(bad, joint_s=0.02)
        self.ingest('take-1', words, duration)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual([k['word'] for k in edl['unscripted_kept']], ['um'])

    def test_a_gap_only_one_aligner_hears_is_never_cut(self):
        flubbed = SCRIPT[:4] + ['The', 'answer,'] + SCRIPT[4:]
        words, duration = clock(flubbed, extra_pause={5: 0.10})
        # Aligner B hears a breath word filling the gap after the restart, and before line 1's end.
        b = copy.deepcopy(words)
        restart_end = words[5]['end_s']
        b.append({'word': 'uh', 'onset_s': restart_end + 0.02, 'end_s': words[6]['onset_s'] - 0.02})
        b.append({'word': 'mm', 'onset_s': words[3]['end_s'] + 0.02, 'end_s': words[4]['onset_s'] - 0.02})
        b.sort(key=lambda w: w['onset_s'])
        self.ingest('take-1', words, duration, words_b=b)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        # No cut is possible where B hears breath, so the restart plays through and is reported for his ear.
        self.assertEqual(edl['joins'], [])
        self.assertEqual([conform.token(k['word']) for k in edl['unscripted_kept']], ['the', 'answer'])
        self.assertEqual(conform.lint_edl(edl, conform.records_for(edl, self.ve), spec()), [])

    def test_a_line_never_read_is_refused_by_name(self):
        words, duration = clock(SCRIPT[:4] + SCRIPT[8:])
        self.ingest('take-1', words, duration)
        with self.assertRaises(ValueError) as caught:
            conform.conform(spec(), 'short', self.script, self.ve)
        self.assertIn('The answer surprised us.', str(caught.exception))

    def test_removed_words_leave_the_cut_and_speed_scales_the_whole_clock(self):
        words, duration = clock(SCRIPT)
        self.ingest('take-1', words, duration)
        edit = {'remove': [{'from_w': 4, 'to_w': 7, 'why': 'cut for length'}], 'speed': 1.2, 'speed_said': 'Yes, 1.2x'}
        edl = conform.conform(spec(edit), 'short', self.script, self.ve)
        self.assertNotIn(5, [w['w'] for w in edl['words']])
        self.assertEqual(len(edl['joins']), 1)
        plain = conform.conform(spec({'remove': edit['remove'], 'speed': 1}), 'short', self.script, self.ve)
        self.assertAlmostEqual(edl['duration_s'] * 1.2, plain['duration_s'], places=2)
        self.assertEqual(conform.lint_edl(edl, conform.records_for(edl, self.ve), spec(edit)), [])
        with self.assertRaises(ValueError):
            conform.conform(spec({'remove': [], 'speed': 1.2}), 'short', self.script, self.ve)

    # the F09 lint: mutations must fail ----------------------------------------
    def _edl_with_join(self):
        flubbed = SCRIPT[:4] + ['The', 'answer,'] + SCRIPT[4:]
        words, duration = clock(flubbed, extra_pause={5: 0.10})
        self.ingest('take-1', words, duration)
        return conform.conform(spec(), 'short', self.script, self.ve), words

    def test_lint_fails_a_join_moved_into_speech(self):
        edl, words = self._edl_with_join()
        bad = copy.deepcopy(edl)
        bad['segments'][1]['src_in_s'] = words[6]['onset_s'] + 0.05
        findings = conform.lint_edl(bad, conform.records_for(bad, self.ve))
        self.assertTrue(any('not in a gap' in f for f in findings), findings)

    def test_lint_fails_a_join_that_hugs_a_word_tail(self):
        edl, words = self._edl_with_join()
        bad = copy.deepcopy(edl)
        bad['segments'][0]['src_out_s'] = words[3]['end_s'] + 0.010
        findings = conform.lint_edl(bad, conform.records_for(bad, self.ve))
        self.assertTrue(any('keeps 10 ms from a word' in f for f in findings), findings)

    def test_lint_fails_two_millisecond_fades_and_a_second_speed(self):
        edl, _ = self._edl_with_join()
        bad = copy.deepcopy(edl)
        bad['crossfade_ms'] = 2
        self.assertTrue(any('crossfade' in f for f in conform.lint_edl(bad, conform.records_for(bad, self.ve))))
        bad = copy.deepcopy(edl)
        bad['speed'] = 1.1
        self.assertTrue(any('dialogue.speed' in f for f in conform.lint_edl(bad, conform.records_for(bad, self.ve))))
        with self.assertRaises(ValueError):
            conform.conform(spec(), 'short', self.script, self.ve, crossfade_s=0.002)

    def test_lint_fails_a_changed_take_and_a_stale_edit(self):
        edl, _ = self._edl_with_join()
        changed = {'remove': [{'from_w': 0, 'to_w': 0, 'why': 'later change'}], 'speed': 1}
        self.assertTrue(any('approved edit' in f for f in conform.lint_edl(edl, conform.records_for(edl, self.ve), spec(changed))))
        bad = copy.deepcopy(edl)
        bad['takes']['take-1']['media']['sha256'] = '0' * 64
        self.assertTrue(any('changed since conform' in f for f in conform.lint_edl(bad, conform.records_for(bad, self.ve))))

    # one graph: picture and sound together ------------------------------------
    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not on PATH')
    def test_render_keeps_picture_and_sound_the_same_length_and_writes_a_joins_reel(self):
        flubbed = SCRIPT[:4] + ['The', 'answer,'] + SCRIPT[4:]
        words, duration = clock(flubbed, extra_pause={5: 0.10})
        media = self.dir / 'take-1.mp4'
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'testsrc2=s=320x568:r=30:d={duration}',
                        '-f', 'lavfi', '-i', f'sine=f=220:r=48000:d={duration}', '-shortest', '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(media)], check=True)
        self.ingest('take-1', words, duration, media=media)
        edit = {'remove': [], 'speed': 1.2, 'speed_said': 'Yes, 1.2x'}
        edl = conform.conform(spec(edit), 'short', self.script, self.ve)
        out = conform.render(edl, conform.records_for(edl, self.ve), self.dir / 'assets')
        from velib.qc import duration_s
        picture = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
                                  'stream=nb_read_frames', '-of', 'csv=p=0', out['picture']], capture_output=True, text=True)
        self.assertEqual(int(picture.stdout.strip()), edl['duration_frames'])
        self.assertAlmostEqual(duration_s(out['dialogue']), edl['duration_s'], delta=1 / 30)
        reel = conform.joins_reel(edl, out['dialogue'], self.dir / 'joins.short.wav')
        self.assertEqual(len(reel['joins']), 1)
        self.assertTrue(Path(reel['reel']).is_file())


    # numbers said his own way (D1, velib.words) ------------------------------------------------------------
    def test_a_number_said_as_words_reads_the_script_digits(self):
        script_text = 'We tested 15 models. Then 206 more ran at 2.7 times the cost.'.split()
        heard = ('We tested fifteen models. Then two hundred and six more ran at two point seven times the cost.').split()
        self.script = [{'w': i, 'word': w} for i, w in enumerate(script_text)]
        words, duration = clock(heard)
        self.ingest('take-1', words, duration)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual(len(edl['segments']), 1)
        self.assertEqual(edl['unscripted_kept'], [])
        by_word = {w['word']: w for w in edl['words']}
        fifteen = next(w for w in words if w['word'] == 'fifteen')
        self.assertAlmostEqual(by_word['15']['onset_s'] - edl['segments'][0]['out_in_s'],
                               fifteen['onset_s'] - edl['segments'][0]['src_in_s'], places=3)
        two, six = words[heard.index('two')], words[heard.index('six')]
        span = by_word['206']['end_s'] - by_word['206']['onset_s']
        self.assertAlmostEqual(span, six['end_s'] - two['onset_s'], places=3)
        self.assertEqual([w['w'] for w in edl['words']], list(range(len(script_text))))

    def test_number_keys_follow_the_words_gate(self):
        from velib import words as wordrule
        self.assertEqual(wordrule.number_key('15'), '15')
        self.assertEqual(wordrule.number_key('2.7'), '2 7')
        self.assertEqual(wordrule.number_key('$40'), '40 dollars')
        self.assertIsNone(wordrule.number_key('models'))
        spans = wordrule.number_spans('we tested two hundred and six of them for forty dollars'.split())
        self.assertIn((2, 5), spans['206'])
        self.assertIn((9, 10), spans['40 dollars'])
        self.assertNotIn('of', spans)

    # a teleprompter take's uneven stamps (A1, quick-edit's conform_filter) --------------------------------------
    BITS, STRIPE, HEIGHT = 10, 16, 96
    MEDIA_S = 40.0   # long enough that the fitted rate is the camera's, as on a real take

    def _jittered_take(self, duration, *, rate='24.0005', hdr=False):
        """A 24.0005 fps take whose frames are stamped unevenly (17 to 66 ms apart, as teleprompter.com stamps them),
        each frame carrying its own index as ten black or white stripes, with a tone for the voice."""
        import numpy as np  # noqa: PLC0415
        count = int(float(rate) * duration)
        frames = np.zeros((count, self.HEIGHT, self.BITS * self.STRIPE), np.uint8)
        for n in range(count):
            for bit in range(self.BITS):
                if n >> bit & 1:
                    frames[n, :, bit * self.STRIPE:(bit + 1) * self.STRIPE] = 255
        media = self.dir / ('take-hdr.mp4' if hdr else 'take-1.mp4')
        # The HLG tags go on the frames (setparams): ffmpeg 8's output flags alone leave the stream's transfer "unknown"
        # (reproduced on CI's pinned n8.1.2, 4 Nov 2026), while 6.x wrote them either way.
        tag = ',setparams=color_trc=arib-std-b67:color_primaries=bt2020:colorspace=bt2020nc' if hdr else ''
        colour = (['-pix_fmt', 'yuv420p10le', '-color_trc', 'arib-std-b67', '-color_primaries', 'bt2020', '-colorspace', 'bt2020nc']
                  if hdr else ['-pix_fmt', 'yuv420p'])
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray',
                        '-s', f'{self.BITS * self.STRIPE}x{self.HEIGHT}', '-r', rate, '-i', '-',
                        '-f', 'lavfi', '-i', f'sine=f=220:r=48000:d={duration}',
                        '-vf', f'settb=1/90000,setpts=(N/{rate}+0.012*sin(2.1*N))/TB{tag}', '-fps_mode', 'passthrough', '-enc_time_base', '1/90000',
                        '-c:v', 'libx264', '-qp', '0', *colour, '-video_track_timescale', '90000',
                        '-c:a', 'aac', '-shortest', str(media)], input=frames.tobytes(), check=True)
        return media

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not on PATH')
    def test_a_take_whose_camera_stalled_keeps_its_stamps(self):
        """A 24 fps take that lost four frames mid-way: laying it evenly would move frames two frames off his voice
        around the stall, so it is resampled by its stamps instead (the reviewer's case, 4 Nov 2026)."""
        import numpy as np  # noqa: PLC0415
        frames = np.zeros((int(24 * self.MEDIA_S), 32, 32), np.uint8)
        media = self.dir / 'stalled.mp4'
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', '32x32', '-r', '24',
                        '-i', '-', '-vf', 'settb=1/90000,setpts=(N/24+if(gte(N\\,480)\\,4/24\\,0))/TB', '-fps_mode', 'passthrough',
                        '-enc_time_base', '1/90000', '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p',
                        '-video_track_timescale', '90000', str(media)], input=frames.tobytes(), check=True)
        picture = takes.video_probe(media)
        self.assertEqual(picture['house_rate'], 24)
        self.assertGreater(picture['max_offset_ms'], 1000 / 24)
        self.assertEqual(picture['laid'], 'resampled')
        self.assertEqual(conform.lay_filter(picture), '')

    def test_unscripted_words_the_cut_keeps_are_protected_on_the_cut_clock(self):
        edl = {'speed': 1.2, 'unscripted_kept': [{'take': 't', 'src_s': 2.0}],
               'segments': [{'take': 't', 'src_in_s': 1.0, 'src_out_s': 3.0, 'out_in_s': 0.5}]}
        records = {'t': {'aligners': {'a': {'words': [{'onset_s': 2.0, 'end_s': 2.3}]}}}}
        self.assertEqual(conform.kept_words(edl, records), [{'onset_s': round(0.5 + 1.0 / 1.2, 4),
                                                              'end_s': round(0.5 + 1.3 / 1.2, 4)}])

    def test_ingest_records_no_picture_when_ffmpeg_is_missing(self):
        import os  # noqa: PLC0415
        old = os.environ.get('PATH', '')
        os.environ['PATH'] = str(self.dir)
        self.addCleanup(os.environ.__setitem__, 'PATH', old)
        self.assertIsNone(takes.video_probe(self.dir / 'anything.mp4'))

    def _indices(self, picture):
        import numpy as np  # noqa: PLC0415
        width = self.BITS * self.STRIPE
        raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(picture), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                             capture_output=True, check=True).stdout
        frames = np.frombuffer(raw, np.uint8).reshape(-1, self.HEIGHT, width)
        middle = frames[:, self.HEIGHT // 4: 3 * self.HEIGHT // 4, :].reshape(len(frames), -1, self.BITS, self.STRIPE)
        bright = middle[:, :, :, 4:-4].mean(axis=(1, 3)) > 128
        return [int(sum(1 << bit for bit in range(self.BITS) if row[bit])) for row in bright]

    def _conform_jittered(self, media, words, duration):
        self.ingest('take-1', words, self.MEDIA_S, media=media)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        return edl, conform.render(edl, conform.records_for(edl, self.ve), self.dir / 'assets')

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not on PATH')
    def test_ingest_measures_the_picture_and_marks_a_jittered_24_fps_take_to_be_laid_evenly(self):
        words, duration = clock(SCRIPT)
        media = self._jittered_take(self.MEDIA_S)
        picture = takes.video_probe(media)
        self.assertEqual(picture['house_rate'], 24)
        self.assertAlmostEqual(picture['avg_rate'], 24.0005, delta=0.05)
        self.assertEqual(picture['laid'], 'even')
        self.assertGreater(picture['jitter_p95_ms'], 5)
        self.assertIsNone(picture['hdr'])
        self.ingest('take-1', words, self.MEDIA_S, media=media)
        self.assertEqual(takes.load_take(self.ve, 'take-1')['media']['video']['laid'], 'even')
        stub = self.dir / 'voice-only.bin'
        stub.write_bytes(b'not a video')
        self.assertIsNone(takes.video_probe(stub))

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not on PATH')
    def test_a_jittered_24_fps_take_loses_no_frame_and_repeats_one_in_every_five_at_30(self):
        words, duration = clock(SCRIPT)
        edl, out = self._conform_jittered(self._jittered_take(self.MEDIA_S), words, duration)
        self.assertEqual(out['laid']['take-1']['laid'], 'even')
        self.assertEqual(edl['takes']['take-1']['media']['video']['laid'], 'even')
        seen = self._indices(out['picture'])
        steps = [b - a for a, b in zip(seen, seen[1:])]
        self.assertEqual([s for s in steps if s > 1], [], 'a source frame was dropped')
        self.assertEqual([s for s in steps if s < 0], [], 'frames came out of order')
        repeats = [i for i, s in enumerate(steps) if s == 0]
        self.assertGreaterEqual(len(repeats), len(seen) // 5 - 1)
        spacing = [b - a for a, b in zip(repeats, repeats[1:])]
        # one in every five, the same frame each time; the segment's first hold may fall one frame late (its start phase)
        self.assertLessEqual(sum(1 for gap in spacing if gap != 5), 1, f'the held frame is not one in every five: {spacing}')

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not on PATH')
    def test_resampling_the_same_take_by_its_stamps_drops_frames(self):
        """The fixture really holds the defect: the old graph, which resamples by stamps, loses frames on it."""
        words, duration = clock(SCRIPT)
        media = self._jittered_take(self.MEDIA_S)
        original = conform.lay_filter
        conform.lay_filter = lambda picture: ''
        self.addCleanup(setattr, conform, 'lay_filter', original)
        _, out = self._conform_jittered(media, words, duration)
        seen = self._indices(out['picture'])
        self.assertGreater(sum(1 for a, b in zip(seen, seen[1:]) if b - a > 1), 0)

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not on PATH')
    def test_an_hlg_take_is_tone_mapped_to_bt709(self):
        words, duration = clock(SCRIPT)
        media = self._jittered_take(self.MEDIA_S, hdr=True)
        picture = takes.video_probe(media)
        self.assertEqual(picture['hdr'], 'hlg')
        self.assertEqual(picture['bit_depth'], 10)
        self.assertIn('tonemap=tonemap=hable', conform.tone_filter(picture))
        _, out = self._conform_jittered(media, words, duration)
        self.assertEqual(out['laid']['take-1']['hdr'], 'hlg')
        tags = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt',
                               '-of', 'csv=p=0', out['picture']], capture_output=True, text=True).stdout.strip()
        self.assertEqual(tags, 'yuv420p')


if __name__ == '__main__':
    unittest.main(verbosity=1)
