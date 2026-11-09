"""The Critic's view of a cut in motion (velib.critic_inputs): strips per beat, per move and per cut, and QC's numbers
labelled as measured, not heard. Synthetic media only."""
from __future__ import annotations

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
from velib import critic_inputs  # noqa: E402
from velib.common import sha256_file  # noqa: E402

BITS, STRIPE, HEIGHT = 8, 20, 64


def make_cut(path: Path, frames: int) -> None:
    """A 30 fps cut whose every frame shows its own index as eight black or white stripes."""
    import numpy as np
    data = np.zeros((frames, HEIGHT, BITS * STRIPE), np.uint8)
    for n in range(frames):
        for bit in range(BITS):
            if n >> bit & 1:
                data[n, :, bit * STRIPE:(bit + 1) * STRIPE] = 255
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s',
                    f'{BITS * STRIPE}x{HEIGHT}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p',
                    str(path)], input=data.tobytes(), check=True)


def index_of(frame) -> int:
    grey = frame.mean(axis=2)
    stripe = grey.shape[1] // BITS
    return sum(1 << bit for bit in range(BITS) if grey[:, bit * stripe + 2:(bit + 1) * stripe - 2].mean() > 128)


PROPS = {'fps': 30, 'durationFrames': 120,
         'beats': [{'id': 'hook', 'layout': 'STAGE', 'fromFrame': 0, 'toFrame': 60},
                   {'id': 'proof', 'layout': 'SPLIT', 'fromFrame': 60, 'toFrame': 120}],
         'events': [{'obj': 'card', 'verb': 'enter', 'atFrame': 10}, {'obj': 'stamp', 'verb': 'stamp', 'atFrame': 10},
                    {'obj': 'chip', 'verb': 'type', 'atFrame': 70}]}


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not on PATH')
class CriticInputsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-critic-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.video = self.dir / 'cut.mp4'
        make_cut(self.video, 120)

    def test_frames_are_the_ones_asked_for_even_twice(self):
        frames = critic_inputs.frames_at(self.video, [0, 10, 12, 10, 59, 60, 119])
        self.assertEqual(sorted(frames), [0, 10, 12, 59, 60, 119])
        self.assertEqual({n: index_of(f) for n, f in frames.items()}, {n: n for n in frames})

    def test_rows_cover_every_beat_every_move_and_every_cut(self):
        beats = critic_inputs.beat_rows(PROPS)
        self.assertEqual([r[1][:3] for r in beats], [[0, 15, 30], [60, 75, 90]])
        events = critic_inputs.event_rows(PROPS)
        self.assertEqual(len(events), 2, 'two moves on one frame share a row')
        self.assertEqual(events[0][1], [8, 12, 15, 18, 22])
        edl = {'joins': [{'at_frame': 90, 'from': {'take': 'a'}, 'to': {'take': 'b'}}]}
        cuts = critic_inputs.cut_rows(PROPS, edl)
        self.assertEqual([r[1] for r in cuts], [[57, 59, 60, 61, 64], [87, 89, 90, 91, 94]])

    def test_write_makes_the_strips_and_copies_qc_numbers_labelled_not_heard(self):
        qc = {'sha256': sha256_file(self.video), 'measured_pass': True, 'complete': False,
              'checks': {'motion.longest_still': {'value': 2, 'pass': True, 'runs': [[2.2, 2]]},
                         'loudness.integrated': {'value': -14.0, 'pass': True}, 'something.else': {'value': 1}}}
        paths = critic_inputs.write('short', self.dir, self.video, PROPS, qc)
        names = sorted(p.name for p in paths)
        self.assertEqual(names, ['beats.short.jpg', 'cuts.short.jpg', 'events.short.jpg', 'numbers.short.json'])
        numbers = json.loads((self.dir / 'numbers.short.json').read_text())
        self.assertEqual(numbers['label'], 'measured; not heard')
        self.assertIn('loudness.integrated', numbers['checks'])
        self.assertNotIn('something.else', numbers['checks'])
        self.assertEqual(numbers['beats'][1]['longest_still_s'], 2)

    def test_a_cut_that_opens_on_the_sting_is_shown_on_the_files_clock(self):
        # Krish, 2026-11-05: "I think it should go at the start of the longer wide videos 100%,". The props stay on the
        # cut's own clock; the Critic sees the file, so every frame is the sting's 56 later, and the sting has its rows.
        stung = dict(PROPS, sting={'src': 'sting.mp4', 'series': 'mind_the_gap', 'frames': 56, 'sha256': 'a' * 64})
        beats = critic_inputs.beat_rows(stung)
        self.assertEqual(beats[0], ('intro sting (mind_the_gap) f0-f55', [0, 15, 30, 45, 55]))
        self.assertEqual([r[1][:3] for r in beats[1:]], [[56, 71, 86], [116, 131, 146]])
        self.assertEqual(critic_inputs.event_rows(stung)[0][1], [64, 68, 71, 74, 78])
        edl = {'joins': [{'at_frame': 90, 'from': {'take': 'a'}, 'to': {'take': 'b'}}]}
        cuts = critic_inputs.cut_rows(stung, edl)
        self.assertEqual(cuts[0], ('cut at f56: intro sting > his face', [53, 55, 56, 57, 60]))
        self.assertEqual([r[1] for r in cuts[1:]], [[113, 115, 116, 117, 120], [143, 145, 146, 147, 150]])
        self.assertEqual(critic_inputs.last_frame(stung), 175)
        video = self.dir / 'stung.mp4'
        make_cut(video, 176)
        qc = {'sha256': sha256_file(video), 'checks': {'motion.longest_still': {'value': 2, 'pass': True, 'runs': [[2.2, 2]]},
                                                       'opening': {'value': {'opening': 'sting'}, 'pass': True}}}
        critic_inputs.write('long', self.dir, video, stung, qc, edl)
        numbers = json.loads((self.dir / 'numbers.long.json').read_text())
        self.assertEqual([(b['from_s'], b['to_s']) for b in numbers['beats']], [(1.87, 3.87), (3.87, 5.87)])
        self.assertEqual(numbers['beats'][0]['longest_still_s'], 2, 'a still run QC found at 2.2 s in the file is in the first beat')
        self.assertIn('opening', numbers['checks'])
        self.assertEqual(critic_inputs.frames_at(video, [56])[56].shape[0], HEIGHT)

    def test_a_qc_record_for_another_file_is_refused(self):
        with self.assertRaises(ValueError):
            critic_inputs.write('short', self.dir, self.video, PROPS, {'sha256': '0' * 64, 'checks': {}})


if __name__ == '__main__':
    unittest.main(verbosity=1)
