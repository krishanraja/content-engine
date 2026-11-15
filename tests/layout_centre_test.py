"""A tall meme is centred on the screen (scripts/layout_centre.py; Ruling, Krish, 2026-11-15: tall memes are centred).
His words: "The POV computer meme, it's not centralized on the screen." Synthetic frames only."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import layout_centre  # noqa: E402

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover
    Image = None


@unittest.skipIf(Image is None, 'Pillow is not installed')
class Centred(unittest.TestCase):
    def test_self_test(self):
        self.assertEqual(layout_centre.self_test(), 0)

    def test_the_palette_has_a_tall_meme_with_its_bars(self):
        meme = json.loads((ROOT / 'config/brand-palette.json').read_text(encoding='utf-8'))['formats']['meme_tall']
        self.assertEqual(meme['shape'], '9x16')
        self.assertEqual(meme['centre']['picture_dy_px'], 48)

    def test_a_tall_meme_off_centre_is_refused_before_filing(self):
        import send
        with tempfile.TemporaryDirectory() as tmp:
            im = Image.new('RGB', (1080, 1920), (10, 20, 17))
            d = ImageDraw.Draw(im)
            d.rectangle([122, 308, 867, 472], fill=(246, 240, 226))
            d.rectangle([114, 571, 885, 1135], fill=(120, 90, 200))
            path = Path(tmp) / 'pov meme - tall.png'
            im.save(path)
            found = ' | '.join(send.tall_meme_problems(path.name, path))
            self.assertIn('off the middle across', found)
            other = Path(tmp) / 'cover.png'
            im.save(other)
            self.assertEqual(send.tall_meme_problems(other.name, other), [])


if __name__ == '__main__':
    unittest.main()
