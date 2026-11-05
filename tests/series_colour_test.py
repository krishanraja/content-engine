"""Series colours on covers and thumbnails belong to each subchannel's one weekly piece (Ruling, Krish, 2026-11-04:
"Post random memes on a Monday but that doesn't mean it's Monday's colour and brand ... There is only one "follow the
money" piece, one "mind the gap" piece, and one "mind the gap" piece every week. Other stuff can be fluid, maybe
changeable." and "I should be allowed to post random stuff on any day but it doesn't take on the brand colours of
Follow the Money, Mind the Gap, or Under the Hood"). An asset made from that piece wears it only when its facts say
it "carries" the piece (Krish, 2026-11-04: "the character.ai carousel is going to be under Monday's "Follow the Money"
banner"). The Receipt is drawn as a page here with the wordmark fetch stubbed: no network, no browser."""
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


class SeriesColourTest(unittest.TestCase):
    def setUp(self):
        self.hs = brand.house()
        self.series = {c['name']: (c['day'], c['accent'].upper()) for c in self.hs['channels']}

    def test_only_the_weekly_piece_wears_its_series_and_every_other_asset_any_day_wears_none(self):
        self.assertEqual(sorted(d for d, _ in self.series.values()), ['Friday', 'Monday', 'Wednesday'])
        for name, (own_day, colour) in self.series.items():
            for day, date in WEEK.items():
                look = brand.series_look(self.hs, name, date)
                self.assertEqual(look['day'], day)
                if day == own_day:
                    self.assertEqual((look['series'], look['owner'], look['colour'].upper()), (True, name, colour))
                else:
                    # A random Monday meme is not Monday's piece: no series colour, no series name.
                    self.assertEqual((look['series'], look['owner']), (False, None), f'{name} on {day}')
                    self.assertEqual(look['colour'].upper(), self.hs['tokens']['cream'].upper())
            self.assertTrue(brand.series_look(self.hs, name)['series'], 'an undated asset of the piece is the piece')

    def test_an_asset_that_carries_the_weekly_piece_wears_it_on_any_day(self):
        look = brand.series_look(self.hs, 'follow.the.money', WEEK['Tuesday'], 'mon-09-nov-piece')
        self.assertEqual((look['series'], look['owner'], look['carries']), (True, 'follow.the.money', 'mon-09-nov-piece'))
        with self.assertRaises(SystemExit):
            brand.series_look(self.hs, 'follow.the.money', WEEK['Tuesday'], '  ')

    def test_a_drawn_cover_wears_its_series_only_when_it_is_the_piece(self):
        names = set(self.series)
        with tempfile.TemporaryDirectory(prefix='series-colour-') as folder:
            base = Path(folder)
            from PIL import Image
            Image.new('RGB', (600, 400), 'white').save(base / 'proof.png')
            Image.new('RGB', (200, 40), 'black').save(base / 'wordmark.png')
            for name, (own_day, colour) in self.series.items():
                for day, date in WEEK.items():
                    facts = {'subchannel': name, 'date': date, 'piece_id': None,
                             'sources': {'s1': ['A chart', 'https://example.com']},
                             'cover': {'headline': PICKED, 'proof': {'image': 'proof.png', 'source': 's1', 'tag': 'WHOSE IT IS'}}}
                    with patch.object(brand, 'fetch', return_value=base / 'wordmark.png'):
                        page = receipt.page(facts, facts['cover'], base, 'tall')
                    found = {h.upper() for h in re.findall(r'#[0-9A-Fa-f]{6}', page)}
                    shown = {n for n in names if n in page}
                    if day == own_day:
                        self.assertIn(colour, found, f'{name} wears its colour on its own day')
                        self.assertFalse(found & (brand.series_colours(self.hs) - {colour}), f'{name} wears another series colour')
                        self.assertEqual(shown, {name}, f'{name} names itself only')
                    else:
                        self.assertFalse(found & brand.series_colours(self.hs), f'{name} on {day} is not the piece and wears a series colour')
                        self.assertFalse(shown, f'{name} on {day} is not the piece and names {shown}')
                        self.assertIn(receipt.GROUND_STOPS[1].upper(), found, 'anything else keeps the house sage')
                    self.assertNotIn('#FF6B57', found, 'the old coral tag and ring are gone')

    def test_nothing_may_sit_on_the_words(self):
        # The fit refuses any decoration (.deco) that touches the headline, the wordmark, the logos, the pill or the
        # tag (Krish, 2026-11-04: "Stuff can't just randomly overlap on titles like that"); tests/receipt_overlap_test.py
        # proves it in a browser.
        self.assertIn("document.querySelectorAll('.deco')", receipt.FIT_JS)
        self.assertIn('!over.length', receipt.FIT_JS)


if __name__ == '__main__':
    unittest.main()
