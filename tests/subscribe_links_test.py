"""scripts/post-pack/subscribe_links.py builds the links content-engine writes into finished words exactly as Growth's
engine/route.py builds them (subscribe_url, item_content; edition_url from growth PR 144). The expected links below
are growth 144's own test values (tests/test_subscribe_route_spec.py)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import subscribe_links as sl  # noqa: E402

SATURDAY = '2026-11-14'
PIECE = 'https://home.makeyourmindup.ai/p/who-gets-paid'


class LinksTest(unittest.TestCase):
    def test_subscribe_url_and_item_content(self):
        self.assertEqual(sl.subscribe_url('substack-notes', 'slot-1'),
                         'https://home.makeyourmindup.ai/subscribe?utm_source=substack-notes&utm_medium=social&utm_campaign=growth&utm_content=slot-1')
        self.assertEqual(sl.item_content('engine:2026-11-09:gitbroke', 'threads'), 'engine-2026-11-09-gitbroke-threads')
        with self.assertRaises(ValueError):
            sl.subscribe_url('myspace', 'x')
        with self.assertRaises(ValueError):
            sl.item_content('x' * 70, 'threads')

    def test_edition_url_as_growth_144_builds_it(self):
        self.assertEqual(sl.edition_url(SATURDAY, 'note'),
                         'https://home.makeyourmindup.ai/subscribe?utm_source=newsletter&utm_medium=email&utm_campaign=weekly&utm_content=edition-2026-11-14-note')
        self.assertEqual(sl.edition_url(SATURDAY, 'piece-mon', PIECE + '?r=1#top'),
                         PIECE + '?r=1&utm_source=newsletter&utm_medium=email&utm_campaign=weekly&utm_content=edition-' + SATURDAY + '-piece-mon#top')
        bad = ((('2026-11-13', 'forward', None), 'Saturday'), (('2026-11-31', 'forward', None), 'real date'),
               (('14/11/2026', 'forward', None), 'YYYY-MM-DD'), ((SATURDAY, 'footer', None), 'edition places'),
               ((SATURDAY, 'piece-mon', None), 'own address'), ((SATURDAY, 'forward', PIECE), 'one subscribe page'),
               ((SATURDAY, 'piece-mon', 'http://home.makeyourmindup.ai/p/x'), 'own https address'),
               ((SATURDAY, 'piece-mon', 'https://example.com/p/x'), 'own https address'),
               ((SATURDAY, 'piece-mon', PIECE + '?utm_source=x'), 'utm_ tag'))
        for args, message in bad:
            with self.assertRaisesRegex(ValueError, message, msg=str(args)):
                sl.edition_url(*args)

    def test_route_lines_by_channel(self):
        self.assertEqual(sl.route_line('instagram', 'x'), 'Subscribe: link in bio.')
        self.assertIsNone(sl.route_line('linkedin', 'x'))
        self.assertTrue(sl.route_line('x', 'slot-1').startswith('Subscribe: https://home.makeyourmindup.ai/subscribe?utm_source=x&'))

    def test_the_vendored_copy_wins_and_the_contract_agrees_with_it(self):
        contract = sl.config()
        with tempfile.TemporaryDirectory() as d:
            v = Path(d) / 'subscribe-route.json'
            v.write_text(json.dumps({**{k: contract[k] for k in ('page', 'medium', 'campaign', 'sources', 'edition')}, 'page': 'https://home.makeyourmindup.ai/join'}))
            s = sl.spec(v)
            self.assertEqual(s['from'], 'vendor/makeyourmindup/subscribe-route.json')
            self.assertTrue(sl.subscribe_url('x', 'a', s).startswith('https://home.makeyourmindup.ai/join?'))
        self.assertEqual(sl.spec(Path(d) / 'absent.json')['from'], 'config/subscribe-links.json')
        if sl.VENDORED.is_file():
            grown = json.loads(sl.VENDORED.read_text(encoding='utf-8'))
            for key in ('page', 'medium', 'campaign', 'utm_content_pattern', 'sources', 'profile_link_channels'):
                self.assertEqual(grown[key], contract[key], key)
            # PR 979 brings the edition block into the vendored copy; until then the contract's edition block is used.
            if 'edition' in grown:
                self.assertEqual({k: grown['edition'][k] for k in contract['edition']}, contract['edition'])
            else:
                self.assertEqual(sl.spec()['edition'], contract['edition'])


if __name__ == '__main__':
    unittest.main()
