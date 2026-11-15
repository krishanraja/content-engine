"""Two or three thumbnail options, drawn for real (docs/production/COVER-STANDARD.md, point 8: "Two or three options,
never one, each shown in a mock of his grid beside the last five posts"; Krish approved the standard on 2026-11-09).

Drawn in Chromium through scripts/pages/build.py's own --options path (thumb_options.draw), on stand-in pictures with no
network: every option is drawn in the one skin the piece wears, each option's folder carries a thumbs.json that
making.py and visual_gate.py accept for its own files, the set records every file's sha256, and the grid mock shows each
option in the first tile beside the past covers given. Runs in CI's browser job; without Playwright it skips here and
fails there."""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))   # first: scripts/pages/build.py, not the pack's build.py
import build  # noqa: E402
import thumb_options  # noqa: E402

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None
    if os.environ.get('CI'):
        raise

from series_skins_test import stub, unstub  # noqa: E402  the stand-in proof, wordmark, logos and stills, no network

PICKED = ['GOOGLE PAID', '$2.7B FIRST']   # a thumbnail line Krish picked (config/title-verdicts.json)
OPTIONS = [
    {'id': 'a', 'note': 'the whole chart, the proof wide', 'proof_width': '58%'},
    {'id': 'b', 'note': 'the last bar ringed, the proof narrow, picture first on the tall', 'proof_width': '44%',
     'proof_first': True, 'proof': {'ring': [0.62, 0.1, 0.95, 0.9]}},
]
BRIEF = {'promise': 'Google paid $2.7 billion before anyone else did', 'supported_by': ['the piece\'s checked source s1'],
         'avoid': ['that the deal was illegal'], 'words': PICKED, 'named': ['Google'], 'references': []}


def facts_for(date, skin=None):
    facts = {'subchannel': 'follow.the.money', 'date': date, 'piece_id': None,
             'sources': {'s1': ['A chart', 'https://example.com']},
             'cover': {'headline': PICKED, 'proof': {'image': 'proof.png', 'source': 's1', 'tag': 'WHOSE IT IS'},
                       'rows': [{'logo': 'logo-a.png', 'name': 'Google'}]},
             'thumb_options': json.loads(json.dumps(OPTIONS))}
    if skin:
        facts['skin'] = skin
    return facts


@unittest.skipIf(sync_playwright is None, 'Playwright for Python is not installed (CI installs it)')
class ThumbOptionsDrawTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        stub(cls)
        from PIL import Image
        cls.past = []
        for i in range(5):
            Image.new('RGB', (1080, 1920), (30 * i, 90, 120)).save(cls.base / f'past-{i}.jpg', 'JPEG')
            cls.past.append(str(cls.base / f'past-{i}.jpg'))
        (cls.base / 'brief.json').write_text(json.dumps(BRIEF), encoding='utf-8')

    @classmethod
    def tearDownClass(cls):
        unstub(cls)

    def draw(self, facts, past=()):
        out = Path(tempfile.mkdtemp(prefix='thumb-options-', dir=self.base))
        ok = thumb_options.draw(facts, self.base, out, build.thumb_facts, build.companies_of, 2, self.base / 'brief.json', past)
        return ok, out

    def test_two_options_on_an_off_day_are_drawn_with_their_receipts(self):
        ok, out = self.draw(facts_for('2026-11-17'), self.past)   # a Tuesday: no series skin
        self.assertTrue(ok)
        record = json.loads((out / thumb_options.OPTIONS_FILE).read_text(encoding='utf-8'))
        self.assertEqual([o['id'] for o in record['options']], ['a', 'b'])
        self.assertEqual(thumb_options.set_problems(out, record), [])
        sys.path.insert(1, str(ROOT / 'scripts' / 'post-pack'))
        import making
        for o in record['options']:
            receipt = json.loads((out / 'options' / o['id'] / 'thumbs.json').read_text(encoding='utf-8'))
            self.assertEqual((receipt['template'], receipt['portrait'], receipt['option']), ('receipt', False, o['id']))
            for f in o['files']:
                cut = 'long' if f['shape'] == 'wide' else 'short'
                self.assertIsNone(making.thumb_problem(cut, out / f['file']), f['file'])
        self.assertEqual(record['options'][1]['layout'], {'proof_width': '44%', 'proof_first': True, 'logos_under': False})
        self.assertEqual(record['grid_mock']['past_read'], 5)
        self.assertEqual(record['grid_mock']['sha256'], hashlib.sha256((out / 'grid-mock.png').read_bytes()).hexdigest())

    def test_every_option_wears_the_one_skin_of_a_series_piece(self):
        # A Monday series piece, its skin named. Option C asks for the picture above the words on the tall shape, which
        # puts neon's light on the logos there: it is refused in that skin, never drawn in a second one.
        facts = facts_for('2026-11-16', 'neon')
        facts['thumb_options'] = [OPTIONS[0], {'id': 'b', 'note': 'the last bar ringed, the proof narrow', 'proof_width': '44%',
                                               'proof': {'ring': [0.62, 0.1, 0.95, 0.9]}}, dict(OPTIONS[1], id='c')]
        out = Path(tempfile.mkdtemp(prefix='thumb-options-', dir=self.base))
        ok = thumb_options.draw(facts, self.base, out, build.thumb_facts, build.companies_of, 3, self.base / 'brief.json', ())
        self.assertTrue(ok)
        record = json.loads((out / thumb_options.OPTIONS_FILE).read_text(encoding='utf-8'))
        worn = {json.loads((out / 'options' / o['id'] / 'thumbs.json').read_text(encoding='utf-8'))['skin'] for o in record['options']}
        self.assertEqual(worn, {record['skin']})
        self.assertEqual(record['skin'], 'neon')
        self.assertEqual([o['id'] for o in record['options']], ['a', 'b'])
        self.assertEqual([r['id'] for r in record['refused']], ['c'])
        self.assertIn('could not be read', record['grid_mock']['note'])

    def test_one_option_is_never_enough(self):
        facts = facts_for('2026-11-17')
        facts['thumb_options'] = facts['thumb_options'][:1]
        with self.assertRaises(SystemExit):
            self.draw(facts)


if __name__ == '__main__':
    unittest.main()
