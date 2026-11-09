"""The nine series skins, drawn (Krish, 2026-11-05: "keep all of them and rotate them all at will over the coming
weeks"; he chose one skin per week, rotating by itself; and the same day, "Skin the covers too"). Every skin is drawn
in Chromium through receipt.render on the Monday, Wednesday and Friday series pieces, on the two video thumbnails and
the five cover shapes, three times over: the short picked title alone; with logo rows and a strip, as a real series
piece carries them (the logo plate under the proof on the stacked shapes, in the column on the side ones); and with
those logos under a long picked title. All 162 thumbnails and all 405 covers are drawn (but for the long title on the
3:2 cover and Substack's 1200 x 630, which the plain Receipt itself cannot fit, and the skin is never blamed for), no
decoration touches the words or the logos and no decoration carries words (Krish, 2026-11-04: "Stuff can't just
randomly overlap on titles like that", and no stickers or badges). An off day wears none, on any shape.

When a piece's skin cannot be drawn on one of its shapes, the whole piece moves on to the next skin in the rotation
that draws on every shape, and its records say why; when none of the nine can, it wears the plain series Receipt
(Krish, 2026-11-05: "Yeah just move on automatically"). Those are proven with a placement forced to fail.

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

    def draw_every_skin(self, shapes):
        """Every skin on every series day in these shapes, on every fixture: (drawn, refused, beyond the house). A
        fixture the plain Receipt (an off day wears no skin) cannot draw on a shape is the house's own limit: there the
        skinned drawing must be refused by the house fit too, never by the skin."""
        drawn, refused, house = [], [], []
        for variant, headline, logos in VARIANTS:
            plain = {}
            for shape in shapes:
                shot, fit, small = self.draw(facts_for('follow.the.money', '2026-11-10', None, headline, logos), shape)
                plain[shape] = bool(shot and fit['ok'] and not small)
            for skin_id in skins.ORDER:
                for day, (subchannel, date) in DAYS.items():
                    for shape in shapes:
                        shot, fit, small = self.draw(facts_for(subchannel, date, skin_id, headline, logos), shape)
                        name = f'{skin_id} {day} {shape} ({variant})'
                        if fit.get('skin') != skin_id:
                            refused.append(f'{name}: the skin was not put on ({fit.get("skin")!r})')
                        elif fit.get('skin_error'):
                            refused.append(f'{name}: the placement failed ({fit["skin_error"]})')
                        elif fit.get('skin_over') or fit.get('worded'):
                            refused.append(f'{name}: on the words {fit.get("skin_over")}, words in a decoration {fit.get("worded")}')
                        elif not plain[shape]:
                            if shot or fit.get('fitted'):
                                refused.append(f'{name}: drawn although the plain Receipt cannot fit this fixture')
                            else:
                                house.append(name)
                        elif not (shot and fit['ok'] and not small):
                            refused.append(f'{name}: not drawn ({json.dumps({k: fit.get(k) for k in ("lines", "lone", "cut", "hit", "over", "spill", "small_proof")})}, small {len(small)})')
                        else:
                            drawn.append(name)
        return drawn, refused, house

    def test_every_skin_is_drawn_on_every_series_day_tall_and_wide_with_nothing_on_the_words(self):
        drawn, refused, house = self.draw_every_skin(('tall', 'wide'))
        self.assertEqual(refused, [])
        self.assertEqual(house, [], 'the plain Receipt draws every fixture on both thumbnails')
        self.assertEqual(len(drawn), 54 * len(VARIANTS))

    def test_every_skin_is_drawn_on_every_series_day_on_every_cover_shape_with_nothing_on_the_words(self):
        # Krish, 2026-11-05: "Skin the covers too". The five cover shapes, each in the closer thumbnail's design.
        covers = tuple(receipt.COVER_FILES)
        self.assertTrue(set(covers) <= set(skins.SHAPES), 'every cover shape wears the skin')
        drawn, refused, house = self.draw_every_skin(covers)
        self.assertEqual(refused, [])
        # The long title with logos does not fit the 3:2 cover or Substack's 1200 x 630 even in the plain Receipt
        # (its own lines and proof floor): the house's limit, the same with or without a skin.
        self.assertEqual(sorted({n.split()[2] for n in house}), ['cover', 'upload'])
        self.assertEqual(len(house), 27 * 2)
        self.assertEqual(len(drawn), 27 * len(covers) * len(VARIANTS) - len(house))

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

    def test_an_off_day_wears_no_skin_on_any_shape_and_a_series_cover_wears_the_weeks(self):
        for shape in receipt.SHAPES:
            shot, fit, small = self.draw(facts_for('follow.the.money', '2026-11-10', 'neon'), shape)
            self.assertTrue(shot and fit['ok'] and not small, (shape, fit))
            self.assertNotIn('skin', fit, f'a Tuesday asset is not the series piece, whatever it names ({shape})')
        shot, fit, small = self.draw(facts_for('follow.the.money', '2026-11-09'), 'cover')
        self.assertTrue(shot and fit['ok'] and not small, fit)
        self.assertEqual(fit.get('skin'), 'neon', 'the 3:2 cover wears the week\'s skin')



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
            self.assertIsNone(record['skin_note'], 'the week\'s skin drew: nothing moved it on')

    # ---- moving on (Krish, 2026-11-05, asked what the engine does when a week's skin cannot be drawn on a piece
    # without touching its words or logos: "Yeah just move on automatically") ----

    def draw_piece(self, facts, name):
        """The covers and the thumbnails as build.py --cover --thumbs draws them: (both written, what it printed,
        {shape: its record}, the folder)."""
        out = self.base / name
        said = io.StringIO()
        with contextlib.redirect_stdout(said):
            ok = build.draw_covers(facts, self.base, out) and build.draw_thumbs(facts, self.base, out)
        records = {s: json.loads((out / f'{f.rsplit(".", 1)[0]}.json').read_text()) for s, f in receipt.COVER_FILES.items()} if ok else {}
        if ok:
            records['thumbs'] = json.loads((out / 'thumbs.json').read_text())
        return ok, said.getvalue(), records, out

    def same_as(self, facts, out, skin):
        """Every cover file is byte for byte that shape drawn in this skin (None: the plain Receipt)."""
        with sync_playwright() as pw:
            b = brand.browser(pw)
            try:
                for s, f in receipt.COVER_FILES.items():
                    shot = receipt.render(b, facts, facts['cover'], self.base, s, skin=skin)[0]
                    self.assertEqual(hashlib.sha256((out / f).read_bytes()).hexdigest(), hashlib.sha256(shot).hexdigest(), f'{s} is not {skin}')
            finally:
                b.close()

    @staticmethod
    def gate():
        import importlib.util
        spec = importlib.util.spec_from_file_location('visual_gate_for_skins', ROOT / 'scripts' / 'post-pack' / 'visual_gate.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    @staticmethod
    def on_the_logos(shape):
        """A placement that drops a decoration on the logo plate on this one shape, and draws nothing elsewhere."""
        return ("([s, g]) => { if (!g || g.shape !== '" + shape + "') return; const l = document.querySelector('.logos').getBoundingClientRect(); "
                "const d = document.createElement('div'); d.className = 'deco'; Object.assign(d.style, {position: 'absolute', left: l.left + 'px', "
                "top: l.top + 'px', width: '40px', height: '40px'}); document.querySelector('#card').appendChild(d); }")

    def test_a_skin_refused_on_one_shape_moves_the_whole_piece_on_to_the_next(self):
        facts = facts_for(*DAYS['mon'], logos=LOGOS)
        with patch.object(skins.load('neon'), 'PLACE_JS', self.on_the_logos('square')):
            ok, said, records, out = self.draw_piece(facts, 'moved-on')
            self.assertTrue(ok, said)
            self.same_as(facts, out, 'sunburst')
        why = 'neon could not be drawn on the square cover without touching the logos; wore sunburst, next in the rotation'
        self.assertIn(f'series skin: {why}', said, 'the drawer says which skin it wore and why')
        gate = self.gate()
        for shape, record in records.items():
            self.assertEqual((record['skin'], record['skin_week'], record['skin_note']), ('sunburst', 'neon', why), shape)
            self.assertEqual(record['skin_tried'], [{'skin': 'neon', 'shape': 'square', 'why': 'touching the logos'}], shape)
            self.assertIsNone(gate.not_skinned(record, facts), f'the visual gate accepts the {shape} in the skin it moved on to')

    def test_a_named_skin_is_tried_first_and_moves_on_the_same_way_wrapping_round(self):
        facts = facts_for(*DAYS['fri'], skin='memphis', logos=LOGOS)
        with patch.object(skins.load('memphis'), 'PLACE_JS', self.on_the_logos('tall')):
            ok, said, records, _ = self.draw_piece(facts, 'named-moved-on')
        self.assertTrue(ok, said)
        why = ('the facts name memphis, which could not be drawn on the tall thumbnail without touching the logos; '
               'wore neon, next in the rotation')
        self.assertIn(why, said)
        self.assertEqual({r['skin'] for r in records.values()}, {'neon'}, 'every shape wears the one skin')
        self.assertEqual({r['skin_note'] for r in records.values()}, {why})
        self.assertTrue(all(r['skin_named'] for r in records.values()))

    def test_when_none_of_the_nine_can_be_drawn_the_piece_wears_the_plain_series_receipt(self):
        facts = facts_for(*DAYS['wed'], logos=LOGOS)
        throws = "() => { const best = null; const {xk} = best; }"
        with contextlib.ExitStack() as stack:
            for k in skins.ORDER:
                stack.enter_context(patch.object(skins.load(k), 'PLACE_JS', throws))
            ok, said, records, out = self.draw_piece(facts, 'none-drew')
        self.assertTrue(ok, 'the drawer never stops: ' + said)
        self.same_as(facts, out, None)
        gate = self.gate()
        for shape, record in records.items():
            self.assertIsNone(record['skin'], shape)
            self.assertTrue(record['series_look']['series'], 'the plain series Receipt keeps the series colour')
            self.assertEqual([t['skin'] for t in record['skin_tried']], list(skins.ORDER), shape)
            self.assertTrue(record['skin_note'].startswith('none of the nine series skins could be drawn on every shape (neon could not be drawn on '
                                                          'the 3:2 cover without its drawing failing to place'), record['skin_note'])
            self.assertTrue(record['skin_note'].endswith('; wore the plain series Receipt'), record['skin_note'])
            self.assertIsNone(gate.not_skinned(record, facts), f'the visual gate accepts the {shape} in the plain series Receipt')
        self.assertIn('wore the plain series Receipt', said)


if __name__ == '__main__':
    unittest.main()
