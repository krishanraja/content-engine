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

    def test_a_qc_record_for_another_file_is_refused(self):
        with self.assertRaises(ValueError):
            critic_inputs.write('short', self.dir, self.video, PROPS, {'sha256': '0' * 64, 'checks': {}})


if __name__ == '__main__':
    unittest.main(verbosity=1)
