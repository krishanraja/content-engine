"""Nothing sits on the words of a Receipt (Krish, 2026-11-04: "Stuff can't just randomly overlap on titles like that
and I think these "screwdriver included" and "bring a calculator included" badges are really obnoxious."). Drawn in
Chromium: a decoration on the headline or on the logo plate is refused, the same decoration clear of every word is
drawn. The page carries a logo row, as every series piece that names a company does (the 2 Nov and 4 Nov pieces did).
Runs in CI's browser job; without Playwright it skips here and fails there."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import brand  # noqa: E402
import receipt  # noqa: E402

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None
    if os.environ.get('CI'):
        raise

FACTS = {'subchannel': 'under.the.hood', 'date': '2026-11-11', 'piece_id': None,
         'sources': {'s1': ['A chart', 'https://example.com']},
         'cover': {'headline': ['Claude is eating', 'the jobs of its own humans'],
                   'proof': {'image': 'proof.png', 'source': 's1', 'tag': 'WHOSE IT IS'},
                   'rows': [{'logo': 'logo.png', 'name': 'Anthropic'}]}}


def with_deco(style):
    """The Receipt page with one decoration added, placed by `style` (absolute, in the card)."""
    original = receipt.page

    def page(facts, c, base, shape, skin=...):
        html = original(facts, c, base, shape, skin)
        return html.replace('</div></body></html>', f'<div class="deco" style="position:absolute;{style}"></div></div></body></html>', 1)
    return page


@unittest.skipIf(sync_playwright is None, 'Playwright for Python is not installed (CI installs it)')
class ReceiptOverlapTest(unittest.TestCase):
    def draw(self, style):
        with tempfile.TemporaryDirectory(prefix='receipt-overlap-') as folder:
            base = Path(folder)
            from PIL import Image
            Image.new('RGB', (600, 400), 'white').save(base / 'proof.png')
            Image.new('RGB', (200, 40), 'black').save(base / 'wordmark.png')
            Image.new('RGB', (240, 60), (236, 236, 236)).save(base / 'logo.png')
            with patch.object(brand, 'fetch', return_value=base / 'wordmark.png'), \
                 patch.object(receipt, 'page', with_deco(style)), sync_playwright() as p:
                b = brand.browser(p)
                try:
                    return receipt.render(b, FACTS, FACTS['cover'], base, 'tall')
                finally:
                    b.close()

    def test_a_decoration_on_the_headline_is_refused(self):
        shot, fit, _ = self.draw('left:60px;top:300px;width:600px;height:500px;background:#000')
        self.assertIsNone(shot)
        self.assertFalse(fit['ok'])
        self.assertEqual(fit['over'], ['deco'])

    def test_a_decoration_on_the_logo_plate_is_refused(self):
        # The plate sits at the foot of the safe box on tall (y 1660 is the safe box's floor), on the column's left edge.
        shot, fit, _ = self.draw('left:60px;top:1610px;width:120px;height:40px;background:#000')
        self.assertIsNone(shot)
        self.assertFalse(fit['ok'])
        self.assertEqual(fit['over'], ['deco'])

    def test_the_same_decoration_clear_of_every_word_is_drawn(self):
        shot, fit, _ = self.draw('left:0;right:0;bottom:0;height:120px;background:#000')
        self.assertTrue(fit['ok'], fit)
        self.assertEqual(fit['over'], [])
        self.assertTrue(shot)


if __name__ == '__main__':
    unittest.main()
