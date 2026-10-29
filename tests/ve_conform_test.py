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


if __name__ == '__main__':
    unittest.main(verbosity=1)
