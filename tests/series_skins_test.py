"""The series skins, after the v5 lock. The nine weekly skins (Krish, 2026-11-05: "keep all of them and rotate them all
at will over the coming weeks") were retired by the v5 lock-out, and the v5_feed skin that replaced them is retired for
new pieces by the Library (scripts/library/make_piece.py). This file keeps the stubs other tests draw with (stub,
unstub: the stand-in proof, wordmark, logos and stills, no network) and proves the retirement: the nine are refused by
name, the archive drawer knows only v5_feed, and nothing is drawn without the legacy flag. The rotation itself is
checked without a browser in tests/series_colour_test.py."""
from __future__ import annotations

import contextlib
import hashlib
import io
import json
import os
import random
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import brand  # noqa: E402
import build  # noqa: E402  (before any page is drawn: receipt.page puts scripts/post-pack, which has a build.py, first)
import receipt  # noqa: E402
import skins  # noqa: E402
from skins import _kit  # noqa: E402

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None
    if os.environ.get('CI'):
        raise

# The week of Monday 9 November 2026: each series piece on its own day, and an off day.
DAYS = {'mon': ('follow.the.money', '2026-11-09'), 'wed': ('under.the.hood', '2026-11-11'), 'fri': ('mind.the.gap', '2026-11-13')}
PICKED = ['Claude is eating', 'the jobs of its own humans']   # a cover title Krish picked (config/title-verdicts.json)
LONG = ['Why Claude and ChatGPT launches keep speeding up,', 'and who will decide how hard your AI thinks']   # a long one he picked
# The logos a real series piece carries (visual_gate wants rows whenever a piece names a company): two rows and a
# strip of stand-in plates of three widths, so the logo plate takes the room it takes on a real piece.
LOGOS = {'rows': [{'logo': 'logo-a.png', 'name': 'Claude'}, {'logo': 'logo-b.png', 'name': 'Anthropic'}],
         'strip': [{'logo': 'logo-c.png', 'name': 'OpenAI'}]}
# The three fixtures every skin is drawn on: (name, headline, logos).
VARIANTS = (('short title', PICKED, {}), ('logos', PICKED, LOGOS), ('logos, long title', LONG, LOGOS))


def facts_for(subchannel, date, skin=None, headline=PICKED, logos=None):
    facts = {'subchannel': subchannel, 'date': date, 'piece_id': None,
             'sources': {'s1': ['A chart', 'https://example.com']},
             'cover': {'headline': headline, 'proof': {'image': 'proof.png', 'source': 's1', 'tag': 'WHOSE IT IS', 'ring': [0.62, 0.1, 0.95, 0.9]},
                       **json.loads(json.dumps(logos or {}))}}
    if skin:
        facts['skin'] = skin
    return facts


def stand_in(size, seed):
    """A still of the real stills' size: a lit gradient with grain, so the grade has light and detail to work on."""
    from PIL import Image, ImageDraw, ImageFilter
    w, h = size
    im = Image.new('RGB', size, (20, 20, 24))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(60):
        x, y, r = rnd.randrange(w), rnd.randrange(h), rnd.randrange(20, max(w, h) // 4)
        v = rnd.randrange(40, 255)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(v, round(v * .8), round(v * .6)))
    return im.filter(ImageFilter.GaussianBlur(radius=6))


def stub(cls):
    """A folder with the proof, the wordmark and the stills, and the fetches pointed at it (started on cls)."""
    cls.tmp = tempfile.TemporaryDirectory(prefix='series-skins-')
    base = cls.base = Path(cls.tmp.name)
    from PIL import Image, ImageDraw
    proof = Image.new('RGB', (600, 400), 'white')
    d = ImageDraw.Draw(proof)
    for i, v in enumerate((120, 180, 150, 260, 330)):
        d.rectangle((60 + i * 100, 360 - v, 120 + i * 100, 360), fill=(40, 60, 50))
    proof.save(base / 'proof.png')
    Image.new('RGB', (200, 40), 'black').save(base / 'wordmark.png')
    for name, size in (('logo-a.png', (180, 60)), ('logo-b.png', (240, 60)), ('logo-c.png', (120, 60))):
        Image.new('RGB', size, (236, 236, 236)).save(base / name)
    # The stills, in a cache folder of their own, under a sha table of their own: no network, nothing shared.
    art = base / 'series-art'
    art.mkdir()
    real = Path(os.environ['SERIES_ART_DIR']) if os.environ.get('SERIES_ART_DIR') else None
    table = {}
    for day in ('mon', 'wed', 'fri'):
        for shape, size in (('tall', (752, 1344)), ('wide', (1344, 752))):
            key = f'scene-{day}-{shape}'
            path = art / f'{key}.png'
            if real:
                path.write_bytes((real / f'{key}.png').read_bytes())
            else:
                stand_in(size, key).save(path)
            table[key] = {'url': f'https://example.invalid/{key}.png', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                          'job_id': 'test', 'model': 'test'}
    cls.patches = [patch.object(brand, 'fetch', return_value=base / 'wordmark.png'),
                   patch.object(_kit, 'art_table', return_value=table),
                   patch.object(_kit, 'ART_CACHE', art)]
    if 'painted_scene' in skins.ORDER:   # retired by the v5 lock: only an archive that still lists it grades its stills
        cls.patches.append(patch.object(skins.load('painted_scene'), 'CACHE', base / 'graded'))
    for p in cls.patches:
        p.start()


def unstub(cls):
    for p in cls.patches:
        p.stop()
    cls.tmp.cleanup()


# The Receipt drawer and its skins are retired for new pieces (config/retired-styles.json, scripts/library/make_piece.py);
# these tests keep the archive path, which build.py reaches only with --legacy.
_LEGACY = None


def setUpModule():
    global _LEGACY
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'pages'))
    import skins
    _LEGACY = patch.object(skins, 'LEGACY', True)
    _LEGACY.start()


def tearDownModule():
    _LEGACY.stop()


class RetiredSkinsTest(unittest.TestCase):
    """The nine weekly skins were retired by the v5 lock (Ruling (Krish, 2026-11-25): "s3h is great, lock v5"), and the
    v5_feed skin that replaced them is retired for new pieces by the Library (config/retired-styles.json). The archive
    drawer (build.py --legacy) knows only v5_feed, and refuses any of the nine by name."""

    def test_the_nine_are_retired_and_refused_by_name(self):
        rows = json.loads((ROOT / 'config' / 'retired-styles.json').read_text(encoding='utf-8'))
        nine = {row['id'] for row in rows if row['kind'] == 'skin'} - {'v5_feed'}
        self.assertEqual(len(nine), 9)
        self.assertEqual(skins.ORDER, ('v5_feed',))
        for skin_id in sorted(nine):
            with self.subTest(skin=skin_id), self.assertRaisesRegex(SystemExit, 'no series skin'):
                skins.load(skin_id)
            with self.subTest(skin=skin_id), self.assertRaisesRegex(SystemExit, 'unavailable under v5'):
                skins.pick({'skin': skin_id}, {'series': True})

    def test_every_shape_of_a_series_piece_wears_v5_feed_on_the_archive_path(self):
        for day, (subchannel, date) in DAYS.items():
            facts = facts_for(subchannel, date)
            for shape in skins.SHAPES:
                with self.subTest(day=day, shape=shape):
                    self.assertEqual(skins.for_shape(facts, {'series': True}, shape), 'v5_feed')

    def test_without_the_legacy_flag_nothing_is_drawn(self):
        with patch.object(skins, 'LEGACY', False), self.assertRaisesRegex(SystemExit, 'make_piece.py'):
            skins.load('v5_feed')


if __name__ == '__main__':
    unittest.main()
