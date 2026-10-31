"""The Substack article keeps its pictures, and the publish page is refused when it would go out without them.

Krish, 2026-10-31: the Substack articles had lost their inline pictures. Monday 9 Nov's article (piece b358e788,
plan docs/plans/2026-10-26-monday/) showed six headings and no picture, and Download first listed only covers.

Run: python3 tests/publish_figures_test.py (tests/engine-gates.test.ts runs it on every push).
"""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import publish_manager as pm  # noqa: E402

MON9 = ROOT / 'docs' / 'plans' / '2026-10-26-monday'
MON9_BODY = ROOT / 'docs' / 'plans' / '2026-10-26-draft-body.md'
NOV2 = ROOT / 'docs' / 'plans' / '2026-11-02-monday' / 'pack'
COVERS = [{'id': r, 'file': f'{r}.png', 'alt': 'Cover', 'role': r} for r in ('cover', 'vertical-cover', 'square-cover', 'share-card-cover')]


def figures_in(html):
    return len(re.findall(r'<figure>', html))


class Monday9Nov(unittest.TestCase):
    """The cause, reproduced on the piece's own files."""

    def test_the_plan_holds_no_article_picture(self):
        cd = json.loads((MON9 / 'creative-direction.json').read_text(encoding='utf-8'))
        self.assertEqual(cd['article']['visuals'], [], 'the signed creative direction plans no article picture')
        # Krish, 2026-10-31: "Use it, rebuild Monday". The receipts figure is now planned in pack/page-facts.json,
        # under WHO IS LEFT WITH THE SHELL; the publish page still has to be rebuilt from it.
        facts = json.loads((MON9 / 'pack' / 'page-facts.json').read_text(encoding='utf-8'))
        self.assertEqual([f['after'] for f in facts], ['Everyone else gets the empty box.'])
        self.assertEqual(sorted(p.name for p in MON9.rglob('*manager*.json')), [], 'no publish manifest is filed')

    def test_a_covers_only_manifest_made_six_headings_and_no_picture_and_nothing_failed(self):
        md = MON9_BODY.read_text(encoding='utf-8')
        self.assertEqual(len(pm.headings(md)), 6)
        before = pm.article_html(md, COVERS)  # what the page builder did with the board's covers-only pictures
        self.assertEqual(before.count('<h2>'), 6)
        self.assertEqual(figures_in(before), 0)
        with self.assertRaisesRegex(pm.PublishCheckError, 'has no pictures'):
            pm.check_figures({}, md, COVERS, planned=0)

    def test_a_heading_that_matches_nothing_dropped_its_picture_silently(self):
        md = MON9_BODY.read_text(encoding='utf-8')
        stray = COVERS + [{'id': 'map', 'file': 'map.png', 'alt': 'Map', 'after_heading': 'THE MONEY MAP'}]
        self.assertEqual(figures_in(pm.article_html(md, [dict(i, data='data:,') for i in stray])), 0)
        with self.assertRaisesRegex(pm.PublishCheckError, 'THE MONEY MAP'):
            pm.check_figures({}, md, stray)

    def test_a_deliberately_picture_free_article_says_why(self):
        md = MON9_BODY.read_text(encoding='utf-8')
        self.assertEqual(pm.check_figures({'figures_none_reason': 'words only, by choice'}, md, COVERS, planned=0), 0)


class FedFromThePack(unittest.TestCase):
    def test_the_pack_figure_lands_under_the_heading_a_session_wrote_by_hand(self):
        m = json.loads((NOV2 / 'publish-manager.json').read_text(encoding='utf-8'))
        hand = next(i for i in m['images'] if i.get('after_heading'))
        md = (NOV2 / m['body']).read_text(encoding='utf-8')
        bare = dict(m, images=[i for i in m['images'] if not i.get('after_heading')])
        fed = pm.planned_figures(bare, NOV2, md)
        self.assertEqual(len(fed), 1)
        self.assertEqual(fed[0]['after_heading'], hand['after_heading'])
        self.assertEqual((NOV2 / fed[0]['file']).resolve(), (NOV2 / hand['file']).resolve())
        self.assertEqual(fed[0]['alt'], hand['alt'])
        self.assertEqual(pm.planned_figures(m, NOV2, md), [], 'a figure the manifest already carries is not added twice')

    def test_the_filed_manifests_pass_the_check(self):
        for rel in ('2026-11-02-monday/pack/publish-manager.json', '2026-11-04-wednesday/pack/publish-manager.json'):
            self.assertGreaterEqual(pm.check(ROOT / 'docs' / 'plans' / rel), 1, rel)

    def test_an_anchor_under_no_heading_is_refused(self):
        with self.assertRaisesRegex(pm.PublishCheckError, 'under no heading'):
            facts = NOV2 / 'page-facts.json'
            m = {'facts': facts.name, 'images': []}
            pm.planned_figures(m, NOV2, '## ONE\n\nNothing like the anchor.\n')


if __name__ == '__main__':
    unittest.main(verbosity=1)
