"""config/asset-routes.json and scripts/post-pack/asset_routes.py: every asset kind Growth made maps to a v5 Library
command, and the make flow refuses plainly while the Library is not on the checkout (Ruling, Krish, 2026-11-26)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import asset_routes  # noqa: E402

# The Library's carousel sets as library/gates-and-wiring b0cf8943 registers them, cut to what the routes name.
SETS = {
    'piece': {'cover': 'carousel-cover', 'inside': ['carousel-chart', 'carousel-document', 'carousel-why-3', 'carousel-why-1'], 'close': 'carousel-close'},
    'good-news': {'cover': 'carousel-good-news-cover', 'inside': ['carousel-good-news-item', 'carousel-good-news-item-2', 'carousel-good-news-item-3', 'carousel-good-news-item-4'], 'close': 'carousel-good-news-close'},
    'simple-advice': {'cover': 'carousel-simple-advice-cover', 'inside': ['carousel-simple-advice-item'], 'close': 'carousel-simple-advice-close'},
    'how-to': {'cover': 'carousel-howto-cover', 'inside': ['carousel-howto-step'], 'close': 'carousel-simple-advice-close'},
    'explainer': {'cover': 'carousel-cover', 'inside': ['carousel-body', 'carousel-explainer-step', 'carousel-versus'], 'close': 'carousel-close'},
    'quiz': {'cover': 'carousel-simple-advice-cover', 'inside': ['carousel-quiz-question', 'carousel-quiz-answer'], 'close': 'carousel-simple-advice-close'},
    'meme': {'cover': 'carousel-cover', 'inside': ['carousel-meme'], 'close': 'carousel-close'},
}
SINGLES = ['social-meme', 'social-meme-tall', 'social-meme-video', 'social-note-image', 'social-versus', 'social-number',
           'social-receipt', 'video-wide-chapter', 'video-vertical-chapter', 'profile-ig-avatar', 'social-quote',
           'social-poll-question', 'social-poll-result', 'social-ig-story-hook']


def fake_library():
    items = {t for s in SETS.values() for t in [s['cover'], s['close'], *s['inside']]} | set(SINGLES)
    return {'carousel_sets': SETS, 'items': [{'id': i} for i in sorted(items)]}


class RoutesTest(unittest.TestCase):
    def setUp(self):
        self.routes = asset_routes.load()

    def test_the_routes_file_is_whole(self):
        self.assertEqual(asset_routes.problems(self.routes), [])
        self.assertEqual(asset_routes.problems(self.routes, fake_library()), [])

    def test_every_growth_template_and_kind_has_a_row(self):
        kinds = {r['kind'] for r in self.routes['kinds']}
        # Growth's render/templates.json at main e530161, its kits, the tall meme, the video cover and the Notes image.
        growth = {'quote-card', 'receipt-card', 'scorecard', 'poll-question', 'poll-result', 'carousel-cover', 'carousel-body',
                  'carousel-close', 'story-frame', 'meme-square', 'meme-vertical', 'profile-art', 'versus-card', 'versus-card-tall',
                  'number-card', 'number-card-tall', 'chapter-card', 'chapter-card-vertical', 'evidence-card',
                  'tall-meme-with-clip', 'video-cover', 'video-thumbnail', 'video-cover-in-cut', 'good-news-close',
                  'good-news-carousel', 'piece-carousel', 'notes-image', 'synthetic-kit'}
        self.assertEqual(growth - kinds, set())
        # Every carousel set the Library has is a kind's route.
        routed = {r['set'] for r in self.routes['kinds'] if r['status'] == 'route' and r['command'] == 'carousel'}
        self.assertEqual(routed, set(SETS))

    def test_the_commands_are_the_librarys_and_no_other_renderer(self):
        cmds = self.routes['commands']
        self.assertEqual(cmds['covers']['argv'][:2], ['python', 'scripts/covers/make_covers.py'])
        self.assertEqual(cmds['carousel']['argv'][:2], ['python', 'scripts/library/make_piece.py'])
        text = json.dumps(self.routes)
        for retired in ('render_mocks', '--set covers"', '--set video"', 'kits.py run', 'growth.py run kit'):
            self.assertNotIn(retired, text)

    def test_registry_problems_catch_a_wrong_set_and_an_unknown_template(self):
        bad = json.loads(json.dumps(self.routes))
        bad['kinds'][0]['templates'] = ['carousel-good-news-item']
        bad['kinds'].append({'kind': 'x', 'growth': 'y', 'status': 'gap', 'gap': 'z', 'library_template': 'social-nope'})
        found = asset_routes.problems(bad, fake_library())
        self.assertTrue(any('not in the Library set piece' in f for f in found), found)
        self.assertTrue(any('social-nope is not a Library template' in f for f in found), found)
        lib = fake_library()
        lib['carousel_sets'] = dict(SETS, extra={'cover': 'carousel-cover', 'inside': [], 'close': 'carousel-close'})
        self.assertTrue(any('the carousel sets are the Library' in f for f in asset_routes.problems(self.routes, lib)))

    def test_against_the_checkouts_registry_when_the_library_is_here(self):
        path = ROOT / self.routes['library']['registry']
        if not path.is_file():
            self.skipTest(self.routes['absent'])
        self.assertEqual(asset_routes.problems(self.routes, json.loads(path.read_text(encoding='utf-8'))), [])


class RefusalTest(unittest.TestCase):
    def setUp(self):
        self.routes = asset_routes.load()

    def test_refuses_clearly_when_the_library_is_absent(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(asset_routes.Refused) as r:
                asset_routes.command_for(self.routes, 'good-news-carousel', 'docs/plans/2026-11-28', 'out', root=root)
        self.assertEqual(r.exception.code, 2)
        self.assertIn('the v5 Library is not on this checkout yet', str(r.exception))
        self.assertIn('scripts/library/make_piece.py', str(r.exception))

    def test_names_the_command_when_the_library_is_here(self):
        with tempfile.TemporaryDirectory() as root:
            for script in ('scripts/library/make_piece.py', 'scripts/covers/make_covers.py'):
                (Path(root) / script).parent.mkdir(parents=True, exist_ok=True)
                (Path(root) / script).write_text('')
            # A carousel goes through carousel_make.py, which checks the deck before make_piece.py draws (Krish, 2026-11-26).
            self.assertEqual(asset_routes.command_for(self.routes, 'good-news-carousel', 'docs/plans/d', 'o', root=root, deck='d.json'),
                             ['python', 'scripts/carousel_make.py', 'docs/plans/d', '--set', 'good-news', '--deck', 'd.json', '--out', 'o'])
            self.assertEqual(asset_routes.command_for(self.routes, 'video-cover', 'docs/plans/d', 'o', root=root),
                             ['python', 'scripts/covers/make_covers.py', 'docs/plans/d', '--out', 'o'])

    def test_a_gap_or_a_retired_kind_is_never_made_another_way(self):
        for kind in ('notes-image', 'meme-square', 'tall-meme-with-clip', 'quote-card', 'profile-art'):
            with self.assertRaises(asset_routes.Refused) as r:
                asset_routes.command_for(self.routes, kind, 'p', 'o')
            self.assertEqual(r.exception.code, 3, kind)

    def test_cli_exit_codes(self):
        self.assertEqual(asset_routes.main(['check']), 0)
        if not (ROOT / 'scripts' / 'library' / 'make_piece.py').is_file():
            self.assertEqual(asset_routes.main(['command', 'meme-carousel', '--piece', 'p', '--out', 'o']), 2)
        self.assertEqual(asset_routes.main(['command', 'notes-image', '--piece', 'p', '--out', 'o']), 3)


class CycleSplitTest(unittest.TestCase):
    def test_growths_cycle_rows_only_receive_finished_assets_and_have_performance_read(self):
        cycle = json.loads((ROOT / 'config' / 'cycle.json').read_text(encoding='utf-8'))
        rows = [r for r in cycle['rows'] if r['system'] == 'growth-makeyourmindup']
        self.assertEqual(sorted({r['direction'] for r in rows}), ['inform', 'read'])
        for r in rows:
            if r['direction'] == 'inform':
                self.assertIn('finished, approved assets with their captions', r['what'])
            else:
                self.assertIn('performance', r['what'])
            self.assertNotRegex(r['what'], r'(?i)growth (?:makes|made)')


if __name__ == '__main__':
    unittest.main()
