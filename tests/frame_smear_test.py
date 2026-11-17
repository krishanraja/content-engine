"""A picture smeared into stripes on a finished cut (scripts/frame_smear.py; config/failures.json,
plate-smeared-into-stripes: on 8 Nov a plate resized from a one-row crop turned the whole frame into vertical stripes).

Real frames from the repository's plates and approved design frames never read as smeared; the same frames with a
band, a column band or the whole picture stretched from one line always do; a flat card and a gradient never do. On
encoded video, a stretched plate held for two seconds fails the cut, a half-second smear (a whip pan's length) does
not, and the receipt holds only for the bytes it was written for.
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import frame_smear  # noqa: E402

REAL = sorted([*ROOT.glob('fixtures/ve/design-lock/approved/*.jpg'), *ROOT.glob('assets/plates/*/bg-*.jpg'),
               ROOT / 'assets/plates/two-passports/paper.jpg'])
PHOTO = ROOT / 'assets/plates/hand-held-screen/bg-hardware.jpg'


def grey(arr) -> np.ndarray:
    img = Image.fromarray(np.asarray(arr, np.uint8)).convert('L')
    w, h = img.size
    return np.asarray(img.resize((frame_smear.WIDTH, round(h * frame_smear.WIDTH / w)), Image.BILINEAR), np.float32)


def rgb(path) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGB'))


class FramesTest(unittest.TestCase):
    def test_real_frames_are_never_smeared(self):
        self.assertGreaterEqual(len(REAL), 8)
        for path in REAL:
            with self.subTest(path=path.name):
                self.assertEqual(frame_smear.bands(grey(rgb(path))), [])

    def test_a_picture_stretched_from_one_line_is_smeared(self):
        a = rgb(PHOTO)
        h, w, _ = a.shape
        whole = np.repeat(a[h // 2:h // 2 + 1], h, axis=0)        # 8 Nov: the breakfast plate from a one-row crop
        band = a.copy()
        band[int(h * .3):int(h * .6)] = a[int(h * .3)]
        cols = a.copy()
        cols[:, int(w * .4):int(w * .7)] = a[:, int(w * .4):int(w * .4) + 1]
        for name, arr, stripes in (('whole', whole, 'vertical'), ('band', band, 'vertical'), ('columns', cols, 'horizontal')):
            with self.subTest(name=name):
                found = frame_smear.bands(grey(arr))
                self.assertTrue(found, name)
                self.assertEqual(found[0]['stripes'], stripes)

    def test_flat_cards_and_gradients_are_not_smears(self):
        flat = np.full((1920, 1080, 3), 236, np.uint8)
        ramp = np.repeat(np.linspace(20, 230, 1920)[:, None, None], 1080, axis=1).repeat(3, axis=2)
        for name, arr in (('flat', flat), ('vertical ramp', ramp), ('horizontal ramp', ramp.transpose(1, 0, 2))):
            with self.subTest(name=name):
                self.assertEqual(frame_smear.bands(grey(arr)), [])


def encode(frames_rgb, fps, out):
    h, w, _ = frames_rgb[0].shape
    proc = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
                           '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', str(out)],
                          input=b''.join(np.ascontiguousarray(f).tobytes() for f in frames_rgb), capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode()[-500:])


class VideoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        d = Path(cls.tmp.name)
        img = Image.open(PHOTO).convert('RGB').resize((540, 960))
        a = np.asarray(img)
        stretched = np.repeat(a[480:481], 960, axis=0)
        fps = 12
        # A slow push on the real plate, so the frames move as a cut's would.
        clean = [np.asarray(img.crop((i, i, 540 - i, 960 - i)).resize((540, 960))) for i in range(36)]
        cls.clean, cls.held, cls.whip = d / 'clean.mp4', d / 'held.mp4', d / 'whip.mp4'
        encode(clean, fps, cls.clean)
        encode(clean[:12] + [stretched] * 24, fps, cls.held)
        encode(clean[:12] + [stretched] * 6 + clean[18:], fps, cls.whip)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_a_clean_cut_passes(self):
        self.assertEqual(frame_smear.measure(self.clean)['status'], 'pass')

    def test_a_stretched_plate_held_fails(self):
        result = frame_smear.measure(self.held)
        self.assertEqual(result['status'], 'fail')
        self.assertGreaterEqual(result['smears'][0]['to_s'] - result['smears'][0]['from_s'], frame_smear.PERSIST_S)

    def test_a_half_second_smear_is_not_a_failed_cut(self):
        self.assertEqual(frame_smear.measure(self.whip)['status'], 'pass')

    def test_the_receipt_is_for_these_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            cut = Path(tmp) / 'cut.mp4'
            cut.write_bytes(self.clean.read_bytes())
            self.assertTrue(frame_smear.receipt_problems(cut))
            self.assertEqual(frame_smear.main(['measure', str(cut), '--receipt']), 0)
            self.assertEqual(frame_smear.receipt_problems(cut), [])
            self.assertEqual(json.loads(frame_smear.receipt_path(cut).read_text())['status'], 'pass')
            cut.write_bytes(cut.read_bytes() + b'\0')
            self.assertTrue(any('different bytes' in p for p in frame_smear.receipt_problems(cut)))
            held = Path(tmp) / 'held.mp4'
            held.write_bytes(self.held.read_bytes())
            self.assertEqual(frame_smear.main(['measure', str(held), '--receipt']), 1)
            self.assertFalse(frame_smear.receipt_path(held).exists())

    def test_ve_qc_counts_the_row_from_its_date(self):
        from velib import qc
        bind = json.loads((ROOT / 'config/ve/onscreen-checks.json').read_text())['picture']['binds_from']
        counted = qc.picture_smeared(str(self.held), bind)
        self.assertIs(counted['pass'], False)
        self.assertNotIn('status', counted)
        before = qc.picture_smeared(str(self.held), '2026-11-01')
        self.assertEqual(before['status'], 'advisory')
        self.assertIs(qc.picture_smeared(str(self.clean), bind)['pass'], True)
        source = (ROOT / 'scripts/velib/qc.py').read_text(encoding='utf-8')
        self.assertIn("checks['picture.smeared'] = picture_smeared(path, publish_day)", source)


class FilingTest(unittest.TestCase):
    def test_making_refuses_a_hand_built_cut_without_its_smear_receipt(self):
        source = (ROOT / 'scripts/post-pack/making.py').read_text(encoding='utf-8')
        block = source[source.index('if approved:\n'):source.index("patch['video_assets'][0]['hand_built']")]
        self.assertIn('problems += frame_smear.receipt_problems(a.video_file)', block)
        self.assertLess(block.index('problems = av_sync'), block.index('problems += frame_smear'))


if __name__ == '__main__':
    unittest.main()
