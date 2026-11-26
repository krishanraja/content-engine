"""The drawn cards (python3 scripts/carousel_check.py --cards ...; scripts/carousel_layout.py), on synthetic PNGs.

Ruling (Krish, 2026-11-15): a carousel cover must look like a front cover, and body cards use the page centrally with
real visual effort. His words: "the front cover card does not look like a front cover. It looks like all the rest of
the cards"; "aren't using the page space centrally or correctly. They look too bland and too plain". A deck whose cover
is a body card and whose cards are left-set type on plain ground fails on each; a deck drawn to the bars passes."""
import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import carousel_check  # noqa: E402
import carousel_layout  # noqa: E402

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - CI installs Pillow
    Image = None

INK, CREAM, MINT = (10, 20, 17), (246, 240, 226), (126, 240, 192)


def font(size):
    return ImageFont.load_default(size=size)


def lines(d, texts, size, y, centred, colour=CREAM, x=100):
    for t in texts:
        f = font(size)
        w = d.textlength(t, font=f)
        d.text(((1080 - w) / 2 if centred else x, y), t, font=f, fill=colour)
        y += int(size * 1.25)
    return y


def scene(d, box):
    x0, y0, x1, y1 = box
    for i in range(0, x1 - x0, 24):  # a colourful, textured picture
        d.rectangle([x0 + i, y0, min(x0 + i + 20, x1), y1], fill=((i * 7) % 200 + 40, 90 + (i * 3) % 120, 160))


def card(path, kind):
    im = Image.new('RGB', (1080, 1350), INK)
    d = ImageDraw.Draw(im)
    if kind == 'cover':
        scene(d, (0, 0, 1080, 1350))
        d.rectangle([60, 860, 1020, 1240], fill=INK)
        lines(d, ['AI BROKE', 'THE TOOL'], 150, 880, True)
    elif kind == 'good':
        lines(d, ['TWELVE TIMES', 'MORE CODE'], 96, 110, True)
        scene(d, (180, 360, 900, 920))
        lines(d, ['because AI now writes', 'most of it, all day.'], 56, 960, True)
        lines(d, ['so the jam forms.'], 56, 1100, True)
    elif kind == 'plain':  # the 12 Nov look he called bland: left-set type on plain ground, the page unused
        lines(d, ['TWELVE TIMES MORE', 'CODE EACH DAY'], 96, 110, False)
        lines(d, ['because AI writes it.'], 30, 320, False)
    im.save(path)


@unittest.skipIf(Image is None, 'Pillow is not installed')
class DrawnCards(unittest.TestCase):
    def deck(self, kinds):
        tmp = tempfile.mkdtemp()
        paths = []
        for i, k in enumerate(kinds, 1):
            p = str(Path(tmp) / f'card-{i}.png')
            card(p, k)
            paths.append(p)
        return paths

    def test_a_deck_drawn_to_the_bars_passes(self):
        found, cards = carousel_layout.problems(self.deck(['cover', 'good', 'good', 'good']))
        self.assertEqual(found, [], cards)

    def test_the_v5_count_is_four_to_seven_slides(self):
        # Krish, 2026-11-26: enforce the carousel format (config/carousel-format.json): the cover, 3 to 5 inside, the close.
        self.assertIn('3 slides drawn: a carousel is 4 to 7', carousel_layout.problems(self.deck(['cover', 'good', 'good']))[0])
        self.assertIn('8 slides drawn: a carousel is 4 to 7', carousel_layout.problems(self.deck(['cover'] + ['good'] * 7))[0])

    def test_a_cover_like_the_cards_after_it_fails(self):
        found = ' | '.join(carousel_layout.problems(self.deck(['good', 'good', 'good', 'good']))[0])
        self.assertIn('card 1: the cover headline is 1.0x', found)
        self.assertIn('it looks like the rest of the cards', found)

    def test_plain_off_centre_cards_fail_on_each_bar(self):
        found = ' | '.join(carousel_layout.problems(self.deck(['cover', 'plain']))[0])
        self.assertIn('card 2: an empty band', found)
        self.assertIn('rows in the safe box are empty', found)
        self.assertIn('off centre', found)
        self.assertIn('too bland and plain', found)
        self.assertIn('body type', found)

    def test_the_deck_check_runs_the_cards_and_exits_one(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = carousel_check.main(['--cards', *self.deck(['good', 'plain'])])
        self.assertEqual(code, 1)
        self.assertIn('carousel_check: REFUSED card 1', out.getvalue())
        self.assertIn('2 slides drawn: a carousel is 4 to 7', out.getvalue())

    def test_the_safe_box_is_the_palettes(self):
        self.assertEqual(carousel_layout.safe_box(), (80, 80, 1000, 1270))


if __name__ == '__main__':
    unittest.main()
