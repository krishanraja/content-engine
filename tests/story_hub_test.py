"""The Sunday gather reads the week's stories from the daily news hub (content-engine #982), so a thin pool is never an
empty board (Ruling, Krish, 2026-11-26). Read by HTTP like the other gather reads; unreachable is skipped with its
reason, never a failed gather. Every story here is invented and every read is a fake: nothing leaves this machine."""
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402

WEEK = '2026-11-30'
ON_THE_DAY = date(2026, 11, 30)  # the old tests read as on the week's own Monday


def item(n, day, sub='music', url=None, coverage=1):
    return {'id': f'h{n}', 'subsector': sub, 'date': day, 'source': 'Music Week', 'url': url or f'https://musicweek.example/{n}',
            'headline': f'A label licenses its catalogue {n}', 'dek': 'd', 'why': 'w', 'companies': ['Warner Music'], 'tickers': [],
            'coverage': coverage, 'image': {'kind': None, 'url': None}}


class Hub(unittest.TestCase):
    def test_a_week_and_today_are_read_once_each_story(self):
        week = {'ok': True, 'days': [{'edition_date': '2026-11-24', 'items': [item(1, '2026-11-24'), item(2, '2026-11-25', 'sport', coverage=3)]},
                                     {'edition_date': '2026-11-20', 'items': [item(3, '2026-11-20')]}]}
        today = {'ok': True, 'version': 1, 'edition_date': '2026-11-29', 'items': [item(1, '2026-11-24'), item(4, '2026-11-29', 'film')]}
        reads = []

        def read(path):
            reads.append(path)
            return week if 'edition/news' in path else today
        got = board_feed.hub_source(WEEK, read, today=ON_THE_DAY)
        self.assertEqual(reads, [f'/api/board/{WEEK}/edition/news', '/api/hub/today'])
        self.assertIsNone(got['skipped'])
        self.assertEqual(sorted(i['id'] for i in got['items']), ['h1', 'h2', 'h4'], 'the same story once, the week before only')
        self.assertNotIn('image', got['items'][0], 'only what the session reads')

    def test_unreachable_is_skipped_with_its_reason(self):
        def read(path):
            raise ValueError(f'Board request failed: HTTP 404 (GET {path})')
        got = board_feed.hub_source(WEEK, read, today=ON_THE_DAY)
        self.assertEqual(got['items'], [])
        self.assertIn('the hub could not be read', got['skipped'])
        self.assertIn('HTTP 404', got['skipped'])

    def test_one_route_is_enough(self):
        def read(path):
            if 'edition/news' in path:
                raise ValueError('Board request failed: HTTP 404')
            return {'ok': True, 'items': [item(5, '2026-11-27')]}
        got = board_feed.hub_source(WEEK, read, today=ON_THE_DAY)
        self.assertEqual([i['id'] for i in got['items']], ['h5'])
        self.assertIsNone(got['skipped'])

    def test_an_empty_week_says_so(self):
        got = board_feed.hub_source(WEEK, lambda p: {'ok': True, 'items': [item(6, '2026-11-01')]}, today=ON_THE_DAY)
        self.assertEqual(got['items'], [])
        self.assertIn('no stories dated', got['skipped'])

    def test_a_plan_run_days_ahead_reads_the_latest_news_not_the_future(self):
        # 27 Nov 2026: the 7 Dec board asked the hub for 30 Nov to 7 Dec, which had not happened yet, so it was always empty.
        today = {'ok': True, 'items': [item(7, '2026-11-26'), item(8, '2026-11-22'), item(9, '2026-11-12')]}
        got = board_feed.hub_source('2026-12-07', lambda p: today, today=date(2026, 11, 27))
        self.assertEqual(sorted(i['id'] for i in got['items']), ['h7', 'h8'], 'the seven days up to the run, not the week ahead')
        self.assertIsNone(got['skipped'])


if __name__ == '__main__':
    unittest.main()
