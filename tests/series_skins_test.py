"""The nine series skins, drawn (Krish, 2026-11-05: "keep all of them and rotate them all at will over the coming
weeks"; he chose one skin per week, rotating by itself). Every skin is drawn in Chromium through receipt.render on
the Monday, Wednesday and Friday series pieces, tall and wide, three times over: the short picked title alone; with
logo rows and a strip, as a real series piece carries them (the logo plate under the proof on tall, in the column
on wide); and with those logos under a long picked title. All 162 are drawn, no decoration touches the words or the
logos and no decoration carries words (Krish, 2026-11-04: "Stuff can't just randomly overlap on titles like that",
and no stickers or badges). An off day and the cover shapes wear none.

The wordmark fetch is stubbed, and so are the painted scene's stills: stand-ins of the real stills' sizes under a sha
table of their own (or, with SERIES_ART_DIR naming a folder of the real scene-<day>-<shape>.png, copies of those).
Runs in CI's browser job; without Playwright it skips here and fails there. The rotation itself is checked without a
browser in tests/series_colour_test.py."""
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
    painted = skins.load('painted_scene')
    cls.patches = [patch.object(brand, 'fetch', return_value=base / 'wordmark.png'),
                   patch.object(_kit, 'art_table', return_value=table),
                   patch.object(_kit, 'ART_CACHE', art),
                   patch.object(painted, 'CACHE', base / 'graded')]
    for p in cls.patches:
        p.start()


def unstub(cls):
    for p in cls.patches:
        p.stop()
    cls.tmp.cleanup()


@unittest.skipIf(sync_playwright is None, 'Playwright for Python is not installed (CI installs it)')
class SeriesSkinsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        stub(cls)
        cls.pw = sync_playwright().start()
        cls.browser = brand.browser(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        unstub(cls)

    def draw(self, facts, shape):
        return receipt.render(self.browser, facts, facts['cover'], self.base, shape)

    def test_every_skin_is_drawn_on_every_series_day_tall_and_wide_with_nothing_on_the_words(self):
        drawn, refused = [], []
        for variant, headline, logos in VARIANTS:
            # The fixture itself first: the plain Receipt (an off day wears no skin) draws it, so a refusal below is the skin's.
            for shape in skins.SHAPES:
                shot, fit, small = self.draw(facts_for('follow.the.money', '2026-11-10', None, headline, logos), shape)
                self.assertTrue(shot and fit['ok'] and not small, f'the plain Receipt cannot draw the {variant} fixture {shape}: {fit}')
            for skin_id in skins.ORDER:
                for day, (subchannel, date) in DAYS.items():
                    for shape in skins.SHAPES:
                        shot, fit, small = self.draw(facts_for(subchannel, date, skin_id, headline, logos), shape)
                        name = f'{skin_id} {day} {shape} ({variant})'
                        if fit.get('skin') != skin_id:
                            refused.append(f'{name}: the skin was not put on ({fit.get("skin")!r})')
                        elif fit.get('skin_error'):
                            refused.append(f'{name}: the placement failed ({fit["skin_error"]})')
                        elif fit.get('skin_over') or fit.get('worded'):
                            refused.append(f'{name}: on the words {fit.get("skin_over")}, words in a decoration {fit.get("worded")}')
                        elif not (shot and fit['ok'] and not small):
                            refused.append(f'{name}: not drawn ({json.dumps({k: fit.get(k) for k in ("lines", "lone", "cut", "hit", "over", "spill", "small_proof")})}, small {len(small)})')
                        else:
                            drawn.append(name)
        self.assertEqual(refused, [])
        self.assertEqual(len(drawn), 54 * len(VARIANTS))

    def test_a_placement_that_fails_or_moves_a_part_out_refuses_the_shape_in_plain_words(self):
        # A skin's placement that throws is a refusal the drawer explains, never a traceback; one that moves the tag
        # out of the safe box after the fit passed it is refused by the check run after it (RECHECK_JS).
        neon = skins.load('neon')
        throws = "() => { const best = null; const {xk} = best; }"
        moves = "() => { document.querySelector('.pin .tag').style.transform = 'translateY(-1400px)'; }"
        for js, key, said in ((throws, 'skin_error', 'could not place its drawing'), (moves, 'cut', 'falls outside the safe box')):
            with patch.object(neon, 'PLACE_JS', js):
                shot, fit, _ = self.draw(facts_for('follow.the.money', '2026-11-09'), 'tall')
            self.assertIsNone(shot, key)
            self.assertFalse(fit['ok'], key)
            self.assertTrue(fit[key], key)
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                receipt.explain('thumb-tall-1080x1920.jpg', fit, [])
            self.assertIn(said, out.getvalue())
            self.assertNotIn('smallest headline tried', out.getvalue(), 'the headline fitted: only the skin refused')

    def test_a_decoration_a_skin_puts_on_the_words_refuses_the_shape(self):
        # The same check, proven to bite: a skin whose placement drops a decoration on the headline is refused.
        neon = skins.load('neon')
        on_words = "() => { const d = document.createElement('div'); d.className = 'deco'; const h = document.querySelector('h1').getBoundingClientRect(); " \
                   "Object.assign(d.style, {position: 'absolute', left: h.left + 'px', top: h.top + 'px', width: '80px', height: '80px'}); document.body.appendChild(d); }"
        worded = "() => { const d = document.createElement('div'); d.className = 'deco'; d.textContent = 'SCREWDRIVER INCLUDED'; " \
                 "Object.assign(d.style, {position: 'absolute', left: '0px', top: '1880px'}); document.body.appendChild(d); }"
        for js, key in ((on_words, 'skin_over'), (worded, 'worded')):
            with patch.object(neon, 'PLACE_JS', js):
                shot, fit, _ = self.draw(facts_for('follow.the.money', '2026-11-09'), 'tall')
            self.assertIsNone(shot, key)
            self.assertFalse(fit['ok'], key)
            self.assertTrue(fit[key], key)
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                receipt.explain('thumb-tall-1080x1920.jpg', fit, [])
            self.assertIn('the neon series skin', out.getvalue())

    def test_an_off_day_and_the_cover_shapes_wear_no_skin(self):
        shot, fit, small = self.draw(facts_for('follow.the.money', '2026-11-10', 'neon'), 'tall')
        self.assertTrue(shot and fit['ok'] and not small, fit)
        self.assertNotIn('skin', fit, 'a Tuesday asset is not the series piece, whatever it names')
        shot, fit, small = self.draw(facts_for('follow.the.money', '2026-11-09'), 'cover')
        self.assertTrue(shot and fit['ok'] and not small, fit)
        self.assertNotIn('skin', fit, 'no skin is made for the 3:2 cover yet')



@unittest.skipIf(sync_playwright is None, 'Playwright for Python is not installed (CI installs it)')
class SeriesSkinRecordTest(unittest.TestCase):
    """The thumbnails drawn the way build.py --thumbs draws them (it opens its own browser)."""
    @classmethod
    def setUpClass(cls):
        stub(cls)

    @classmethod
    def tearDownClass(cls):
        unstub(cls)

    def test_an_undated_series_piece_stops_before_its_old_thumbnails_are_removed(self):
        out = self.base / 'thumbs-undated'
        out.mkdir()
        (out / 'thumbs.json').write_text('{}')
        facts = facts_for('follow.the.money', None)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
            build.draw_thumbs(facts, self.base, out)
        self.assertTrue((out / 'thumbs.json').is_file(), 'nothing is removed before the drawer knows the skin')

    def test_the_thumbnail_record_names_the_skin_it_wears(self):
        for (subchannel, date), want in (((DAYS['mon']), 'neon'), (('follow.the.money', '2026-11-10'), None)):
            out = self.base / f'thumbs-{date}'
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertTrue(build.draw_thumbs(facts_for(subchannel, date), self.base, out))
            record = json.loads((out / 'thumbs.json').read_text())
            self.assertEqual(record['skin'], want)
            self.assertEqual(record['series_look']['series'], want is not None)


if __name__ == '__main__':
    unittest.main()
