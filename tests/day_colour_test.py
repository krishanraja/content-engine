"""Day colours on covers and thumbnails (Ruling, Krish, 2026-11-04: "lightly colour-code the thumbnail and cover asset
templates for Monday, Wednesday, and Friday ... The off days are neutral colours or the colours we have planned, but
not under the Monday, Wednesday, or Friday panels or colours ... a hard rule across Monday to Saturday assets").
The Receipt is drawn as a page here with the wordmark fetch stubbed: no network, no browser."""
from __future__ import annotations

import re
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

# A week in which every day is named: Monday 9 November 2026 to Saturday 14 November 2026.
WEEK = {'Monday': '2026-11-09', 'Tuesday': '2026-11-10', 'Wednesday': '2026-11-11',
        'Thursday': '2026-11-12', 'Friday': '2026-11-13', 'Saturday': '2026-11-14'}
PICKED = ['Claude is eating', 'the jobs of its own humans']   # a cover title Krish picked (config/title-verdicts.json)


class DayColourTest(unittest.TestCase):
    def setUp(self):
        self.hs = brand.house()
        self.colour = {c['day']: c['accent'].upper() for c in self.hs['channels']}

    def test_each_series_day_wears_its_subchannel_and_every_other_day_the_house_mint(self):
        self.assertEqual(sorted(self.colour), ['Friday', 'Monday', 'Wednesday'])
        for day, date in WEEK.items():
            look = brand.day_look(self.hs, date)
            self.assertEqual(look['day'], day)
            if day in self.colour:
                self.assertEqual((look['colour'].upper(), look['series_day']), (self.colour[day], True))
                self.assertGreater(look['tint'], 0)
                self.assertLessEqual(look['tint'], 0.15, 'a light tint, never a flood')
            else:
                self.assertEqual(look['colour'].upper(), self.hs['tokens']['mint'].upper())
                self.assertNotIn(look['colour'].upper(), brand.series_colours(self.hs))
                self.assertEqual((look['series_day'], look['tint']), (False, 0.0))

    def test_the_day_decides_not_the_subchannel(self):
        # Thursday 5 Nov's off-day short wore under.the.hood's colour: an off day never takes its piece's series colour.
        self.assertEqual(brand.day_look(self.hs, WEEK['Thursday'], 'under.the.hood')['colour'], self.hs['tokens']['mint'])
        # With no date, the subchannel's own day.
        self.assertEqual(brand.day_look(self.hs, None, 'mind.the.gap')['day'], 'Friday')

    def test_a_drawn_cover_carries_its_day_and_an_off_day_cover_no_series_colour(self):
        with tempfile.TemporaryDirectory(prefix='day-colour-') as folder:
            base = Path(folder)
            from PIL import Image
            Image.new('RGB', (600, 400), 'white').save(base / 'proof.png')
            Image.new('RGB', (200, 40), 'black').save(base / 'wordmark.png')
            for day, date in WEEK.items():
                facts = {'subchannel': 'mind.the.gap', 'date': date, 'piece_id': None,
                         'sources': {'s1': ['A chart', 'https://example.com']},
                         'cover': {'headline': PICKED, 'proof': {'image': 'proof.png', 'source': 's1', 'tag': 'WHOSE IT IS'}}}
                with patch.object(brand, 'fetch', return_value=base / 'wordmark.png'):
                    page = receipt.page(facts, facts['cover'], base, 'tall')
                found = {h.upper() for h in re.findall(r'#[0-9A-Fa-f]{6}', page)}
                if day in self.colour:
                    self.assertIn(self.colour[day], found, f'{day} wears its colour')
                    others = brand.series_colours(self.hs) - {self.colour[day]}
                    self.assertFalse(found & others, f'{day} wears another day\'s colour: {found & others}')
                else:
                    self.assertFalse(found & brand.series_colours(self.hs), f'{day} is an off day and wears {found & brand.series_colours(self.hs)}')
                    self.assertIn(self.hs['tokens']['mint'].upper(), found)
                self.assertNotIn('#FF6B57', found, 'the old coral tag and ring are gone from every day')


if __name__ == '__main__':
    unittest.main()
