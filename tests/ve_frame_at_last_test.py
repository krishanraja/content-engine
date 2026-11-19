"""The frame grabber reads a file's last frame (Tue 17, 19 Nov 2026: frame 239 of a 240-frame proof read nothing, and
the proof's frame guards could not run)."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib.qc_faces import ffmpeg, frame_at  # noqa: E402


class FrameAtLast(unittest.TestCase):
    def test_every_frame_of_a_30fps_file_reads(self):
        path = Path(tempfile.mkdtemp()) / 'clip.mp4'
        subprocess.run([ffmpeg(), '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=108x192:rate=30:duration=8',
                        '-pix_fmt', 'yuv420p', str(path)], check=True)
        for frame in (0, 1, 120, 238, 239):
            self.assertEqual(frame_at(str(path), frame, 30, (108, 192)).shape, (192, 108, 3), frame)


if __name__ == '__main__':
    unittest.main()
