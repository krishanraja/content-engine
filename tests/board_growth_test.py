"""A finished off-day post is not ready until it is in the 4 Growth folder Krish opens (scripts/post-pack/week_board.py).
Krish, 2026-11-03: "The translator video isn't in the drive... Why is it not in there?"."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import week_board as wb  # noqa: E402

GROWTH = {'file_id': '1ox6jRwrX0TUlSTclbV1_zbD6zD8-ILum', 'folder_id': '1EKDa-jCN1UWs0KQAZNCVTghUHejUWZYX'}
DOWNLOAD = {'url': 'https://board.asset/tue-translator-video.mp4', 'label': 'the finished video'}


class FinishedMeansInGrowth(unittest.TestCase):
    def test_a_download_without_its_growth_file_is_not_ready(self):
        self.assertEqual(wb.growth_needs({'download': DOWNLOAD}), [wb.NOT_IN_GROWTH])
        self.assertEqual(wb.growth_needs({'ready': True}), [wb.NOT_IN_GROWTH])

    def test_the_recorded_growth_file_clears_it(self):
        self.assertEqual(wb.growth_needs({'download': DOWNLOAD, 'growth_drive': GROWTH}), [])

    def test_an_unfinished_idea_needs_nothing_from_growth(self):
        self.assertEqual(wb.growth_needs({'draft': 'an idea'}), [])

    def test_a_malformed_record_does_not_count(self):
        self.assertTrue(wb.growth_drive_problem({'file_id': 'short'}))
        self.assertEqual(wb.growth_needs({'download': DOWNLOAD, 'growth_drive': {'file_id': 'x', 'folder_id': 'y'}}),
                         [wb.NOT_IN_GROWTH])

    def test_the_rich_row_keeps_it_and_reports_a_bad_one(self):
        problems = []
        row = wb.off_rich({'growth_drive': GROWTH}, problems, 'Tue')
        self.assertEqual(row.get('growth_drive'), GROWTH)
        wb.off_rich({'growth_drive': {'file_id': 'x'}}, problems, 'Tue')
        self.assertTrue(any('growth_drive' in p for p in problems))

    def test_the_translator_card_now_names_its_growth_file(self):
        import json
        data = json.loads((ROOT / 'docs/plans/2026-11-02-week/offdays-growth.json').read_text(encoding='utf-8'))
        card = next(o for o in data['days']['2026-11-03'] if o['concept_id'] == 'translator')
        self.assertEqual(wb.growth_needs(card), [])


if __name__ == '__main__':
    unittest.main()
