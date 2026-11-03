"""The live overlay's hooks (docs/PUBLISH_BOARDS.md, "Always current: the live overlay"): week_board.py marks each day's
tab, its step chips and its Approve scripts with the attributes the page script redraws from op=state, and changes
nothing a reader sees. Run with python3 tests/board_live_hooks_test.py."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import making  # noqa: E402
import teleprompter_send  # noqa: E402
import week_board as wb  # noqa: E402

WED = wb.WED_ID
LONG = 'Said **long**,\r\nthe way he says it.  \n'
REVIEW = {'wed': [('article', 'Article draft', 'Words.'), ('five-minute-script', 'Five-minute script', LONG),
                  ('90-second-script', '90-second script', 'Said short.')]}
VIDEOS = {'wed': [{'cut': 'long', 'name': 'l.mp4', 'path': 'x/l.mp4', 'at': '2026-10-27T10:00:00Z', 'thumbnail': {'path': 'x/l.jpg'}},
                  {'cut': 'short', 'name': 's.mp4', 'path': 'x/s.mp4', 'at': '2026-10-27T10:00:00Z'}]}


def tag(page, start):
    i = page.index(start)
    return page[i:page.index('>', i) + 1]


def visible(page):
    """The page with every data-live-* attribute taken out: what was there before the hooks."""
    page = re.sub(r'sha256=[0-9a-f]{64}', 'sha256=', page, count=1)  # the engine's stamp names the page's own hash
    page = re.sub(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z', 'T', page)  # and each build says when it was made
    return re.sub(r' data-live-[a-z-]+="[^"]*"', '', page)


class LiveHooks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.week = wb.LAYOUT_FROM
        wb.use_layout(cls.week)
        cls.page, _, _ = wb.board(cls.week, pieces={'wed': WED}, review=REVIEW, draft={'wed'}, pending={'wed': 'Why so many AIs'},
                                  videos=VIDEOS)

    def test_each_day_tab_names_its_day_piece_cuts_and_thumbnails(self):
        wed = tag(self.page, '<div class="pm fixed" id="panel-wednesday"')
        self.assertIn('data-live-day="wed"', wed)
        self.assertIn(f'data-live-piece="{WED}"', wed)
        self.assertIn('data-live-cuts="long short"', wed)
        self.assertIn('data-live-thumbs="long"', wed)
        mon = tag(self.page, '<div class="pm fixed" id="panel-monday"')
        self.assertIn('data-live-day="mon"', mon)
        self.assertIn('data-live-piece=""', mon)

    def test_every_step_chip_names_its_step(self):
        for day in ('mon', 'wed', 'fri'):
            for step in wb.DAY_STEPS:
                self.assertIn(f'data-live-step="{step}"', tag(self.page, f'id="{day}-st-{step}"'))

    def test_approve_scripts_carries_the_hashes_of_the_words_it_shows(self):
        card = tag(self.page, '<div class="rec ap" id="wed-approve"')
        want = [making.script_hash(LONG), making.script_hash(teleprompter_send.spoken_text(LONG))]
        self.assertNotEqual(want[0], want[1])
        self.assertIn(f'data-live-sha-long="{want[0]} {want[1]}"', card)
        self.assertIn(f'data-live-sha-short="{making.script_hash("Said short.")}"', card)

    def test_the_hooks_change_nothing_a_reader_sees_and_the_board_still_verifies(self):
        self.assertEqual(wb.verify(self.page), [])
        # Built again with the two hook helpers giving nothing: the pages differ only in data-live-* attributes.
        from unittest.mock import patch
        with patch.object(wb, 'live_attrs', lambda *a: ''), patch.object(wb, 'live_sha_attrs', lambda *a: ''):
            plain, _, _ = wb.board(self.week, pieces={'wed': WED}, review=REVIEW, draft={'wed'}, pending={'wed': 'Why so many AIs'},
                                   videos=VIDEOS)
        self.assertNotEqual(plain, self.page)
        self.assertEqual(visible(plain), visible(self.page))


if __name__ == '__main__':
    unittest.main()
