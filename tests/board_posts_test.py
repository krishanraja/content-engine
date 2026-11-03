"""A finished off-day post is not ready until it links its 3 Posts folder (scripts/post-pack/week_board.py).
Ruling, Krish, 2026-11-03: "everything ready for post goes in the posts folder, not the growth folder"."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import week_board as wb  # noqa: E402

FOLDER = 'https://drive.google.com/drive/folders/1iQV79HhSYABa4Wh6EM7i6-lQ-8rP5r8G'
DOWNLOAD = {'url': 'https://board.asset/tue-translator-video.mp4', 'label': 'the finished video'}


class FinishedMeansInPosts(unittest.TestCase):
    def test_a_finished_post_without_its_folder_is_not_ready(self):
        self.assertEqual(wb.posts_needs({'download': DOWNLOAD}), [wb.NOT_IN_POSTS])
        self.assertEqual(wb.posts_needs({'ready': True}), [wb.NOT_IN_POSTS])
        self.assertEqual(wb.posts_needs({'video': {'url': 'https://board.asset/v.mp4'}}), [wb.NOT_IN_POSTS])

    def test_its_3_posts_folder_clears_it(self):
        self.assertEqual(wb.posts_needs({'download': DOWNLOAD, 'drive': FOLDER}), [])

    def test_an_unfinished_idea_needs_nothing(self):
        self.assertEqual(wb.posts_needs({'draft': 'an idea'}), [])

    def test_a_link_that_is_not_a_drive_folder_does_not_count(self):
        self.assertEqual(wb.posts_needs({'download': DOWNLOAD, 'drive': 'https://example.com/x'}), [wb.NOT_IN_POSTS])

    def test_the_translator_card_links_its_3_posts_folder(self):
        data = json.loads((ROOT / 'docs/plans/2026-11-02-week/offdays-growth.json').read_text(encoding='utf-8'))
        card = next(o for o in data['days']['2026-11-03'] if o['concept_id'] == 'translator')
        self.assertEqual(wb.posts_needs(card), [])


if __name__ == '__main__':
    unittest.main()
