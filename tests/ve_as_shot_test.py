"""picture.as_shot (velib.qc_as_shot): his room looks as it was shot. Advisory, never counted (F14). Synthetic clips:
the same take passes, a darkened background is named, his take's offset is honoured, and STAGE or generated plates are
not his take and are not compared."""
from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc_as_shot  # noqa: E402
from velib.common import ffmpeg  # noqa: E402


def clip(path: Path, colours: list[str], darken: float = 0.0, box: str = '') -> Path:
    """One second per colour at 30 fps; `darken` lowers brightness like a background treatment would; `box` draws a
    caption-like box."""
    args = [ffmpeg(), '-v', 'error', '-y']
    for colour in colours:
        args += ['-f', 'lavfi', '-i', f'color=c={colour}:s=120x214:r=30:d=1']
    chain = ''.join(f'[{i}:v]' for i in range(len(colours))) + f'concat=n={len(colours)}:v=1:a=0'
    if darken:
        chain += f',eq=brightness=-{darken}'
    if box:
        chain += f',drawbox={box}'
    subprocess.run(args + ['-filter_complex', chain + '[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                           str(path)], check=True)
    return path


class AsShotTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-as-shot-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.beats = [{'id': 'b1', 'fromFrame': 0, 'toFrame': 30, 'plate': {'source': 'take'}}]

    def test_the_take_as_shot_passes_and_is_never_counted(self):
        take = clip(self.dir / 'take.mp4', ['0x8a7a66'])
        row = qc_as_shot.as_shot(str(take), str(take), self.beats)
        self.assertEqual(row['moved'], [])
        self.assertIsNone(row['pass'])
        self.assertEqual(row['status'], 'advisory')
        self.assertLessEqual(max(row['value']['b1'].values()), 0.5)

    def test_a_darkened_background_is_named(self):
        take = clip(self.dir / 'take.mp4', ['0x8a7a66'])
        cut = clip(self.dir / 'cut.mp4', ['0x8a7a66'], darken=0.15)
        row = qc_as_shot.as_shot(str(cut), str(take), self.beats)
        self.assertEqual(row['moved'], ['b1'])
        self.assertGreater(row['value']['b1']['L'], qc_as_shot.TOLERANCE['L'])
        self.assertIsNone(row['pass'])

    def test_the_cut_is_compared_with_the_take_at_its_offset(self):
        take = clip(self.dir / 'take.mp4', ['0x3050a0', '0x8a7a66'])
        cut = clip(self.dir / 'cut.mp4', ['0x8a7a66'])
        self.assertEqual(qc_as_shot.as_shot(str(cut), str(take), self.beats, plate_offset_frames=30)['moved'], [])
        self.assertEqual(qc_as_shot.as_shot(str(cut), str(take), self.beats, plate_offset_frames=0)['moved'], ['b1'])

    def test_a_split_beat_is_compared_with_the_rows_of_his_take_it_shows(self):
        import numpy as np
        take = np.repeat(np.arange(192, dtype=np.uint8)[:, None, None], 108, axis=1).repeat(3, axis=2)  # row index
        split = {'layout': 'SPLIT', 'plate': {'source': 'take', 'crop': '50% 88%'}}
        # Below the seam (760) his 1920-row take is cropped at 88%: the cut's rows 1440-1920 show take rows 1349-1829.
        self.assertEqual(qc_as_shot.shown_rows(split, 1080, 1920), (0.0, 1348.8, 1080.0, 1828.8))
        part = qc_as_shot.take_part(take, split)
        self.assertEqual((int(part[0, 0, 0]), int(part[-1, 0, 0])), (134, 182))
        self.assertEqual(qc_as_shot.shown_rows({'layout': 'SPLIT', 'plate': {'crop': 'top'}}, 1080, 1920)[1], 680.0)
        whole = qc_as_shot.take_part(take, {'layout': 'FACE'})
        self.assertEqual((int(whole[0, 0, 0]), int(whole[-1, 0, 0])), (144, 191))

    def test_a_caption_over_his_room_is_left_out_not_counted_as_a_treatment(self):
        take = clip(self.dir / 'take.mp4', ['0x8a7a66'])
        cut = clip(self.dir / 'cut.mp4', ['0x8a7a66'], box='x=0:y=170:w=120:h=30:color=black:t=fill')
        self.assertEqual(qc_as_shot.as_shot(str(cut), str(take), self.beats)['moved'], ['b1'])
        k = 120 / 1080
        page = {'fromFrame': 0, 'toFrame': 30, 'region': (0, round(170 / k), 1080, round(30 / k))}
        self.assertEqual(qc_as_shot.as_shot(str(cut), str(take), self.beats, pages=[page])['moved'], [])
        later = {**page, 'fromFrame': 30, 'toFrame': 60}
        self.assertEqual(qc_as_shot.as_shot(str(cut), str(take), self.beats, pages=[later])['moved'], ['b1'])

    def test_stage_and_generated_plates_are_not_his_take(self):
        take = clip(self.dir / 'take.mp4', ['0x8a7a66'])
        cut = clip(self.dir / 'cut.mp4', ['0x8a7a66'], darken=0.15)
        beats = [{'id': 'stage', 'fromFrame': 0, 'toFrame': 30, 'layout': 'STAGE'},
                 {'id': 'made', 'fromFrame': 0, 'toFrame': 30, 'plate': {'source': 'generated'}}]
        row = qc_as_shot.as_shot(str(cut), str(take), beats)
        self.assertEqual((row['value'], row['moved']), ({}, []))


if __name__ == '__main__':
    unittest.main()
