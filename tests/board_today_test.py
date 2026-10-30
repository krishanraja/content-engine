"""The Today view (layout A): the model is checked before it is drawn, and every component keeps its fixed size."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_today as bt  # noqa: E402

FIX = [json.loads((ROOT / 'fixtures' / 'week-board' / f).read_text(encoding='utf-8'))
       for f in ('today-2026-10-26.json', 'today-2026-11-02.json')]


class TodayView(unittest.TestCase):
    def test_fixtures_draw(self):
        for m in FIX:
            page = bt.render(m)
            self.assertIn('Needs you', page)
            for d in bt.DAY_KEYS:
                self.assertIn(f'id="td-open-{d}"', page)
            self.assertNotIn('—', page)

    def test_one_button_per_ask_and_it_links_to_what_it_approves(self):
        m = FIX[1]
        page = bt.render(m)
        for a in m['asks']:
            self.assertIn(f'<a class="btn go" href="{a["href"]}">{a["cta"]}</a>', page)

    def test_a_label_too_long_for_its_button_is_refused(self):
        m = copy.deepcopy(FIX[1])
        m['asks'][0]['cta'] = 'Approve Substack post'
        with self.assertRaisesRegex(bt.ModelError, 'would not fit its button'):
            bt.render(m)

    def test_an_ask_without_a_link_is_refused(self):
        m = copy.deepcopy(FIX[1])
        m['asks'][0]['href'] = ''
        with self.assertRaisesRegex(bt.ModelError, 'href links to what it approves'):
            bt.render(m)

    def test_every_card_has_the_same_five_asset_cells_and_five_stages(self):
        page = bt.render(FIX[1])
        cards = page.count('<article class="card') - page.count('<article class="card empty"')
        self.assertEqual(page.count('<div class="assets">'), cards)
        self.assertEqual(page.count('<div class="lane"'), cards)
        self.assertEqual(page.count('class="as '), cards * len(bt.ASSET_SLOTS))

    def test_stage_counts(self):
        self.assertEqual(bt.stage_counts(FIX[1]), [0, 1, 4, 1, 0])

    def test_one_button_size(self):
        self.assertIn('width:var(--bw);height:var(--bh)', bt.CSS)
        self.assertIn('height:var(--card-h)', bt.CSS)


if __name__ == '__main__':
    unittest.main()
