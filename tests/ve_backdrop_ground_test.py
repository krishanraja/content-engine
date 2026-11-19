"""A tall graphics-only beat frames its photo so the bottom of the frame reads (Tue 17, 19 Nov 2026: the pylons and
dusk plates' black foreground left a plain dark slab under the graphics; config/ve/plain-frames.json)."""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib.compile import _framed, ground_zoom  # noqa: E402


def photo(lit_to: float) -> str:
    """A 9:16 photo, textured down to lit_to of its height, black below."""
    rng = np.random.default_rng(1)
    a = (rng.random((1600, 900)) * 120 + 60).astype(np.uint8)
    a[int(1600 * lit_to):] = 6
    path = Path(tempfile.mkdtemp()) / 'p.png'
    Image.fromarray(a).save(path)
    return str(path)


class BackdropGround(unittest.TestCase):
    def test_a_black_foreground_is_framed_out(self):
        zoom = ground_zoom(photo(0.7))
        self.assertGreater(zoom, 1.0)
        self.assertLess(zoom, 1.8)

    def test_the_zoom_never_passes_1_8(self):
        self.assertEqual(ground_zoom(photo(0.4)), 1.8)

    def test_a_photo_lit_to_its_bottom_stays_whole(self):
        self.assertEqual(ground_zoom(photo(1.0)), 1.0)

    def test_only_a_tall_graphics_only_beat_is_framed(self):
        src = photo(0.7)
        self.assertIn('zoom', _framed({'src': src}, {'layout': 'STAGE'}, '9:16'))
        self.assertNotIn('zoom', _framed({'src': src}, {'layout': 'P1'}, '9:16'))
        self.assertNotIn('zoom', _framed({'src': src}, {'layout': 'STAGE'}, '16:9'))


if __name__ == '__main__':
    unittest.main()
