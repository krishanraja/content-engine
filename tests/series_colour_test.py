"""Series colours on covers and thumbnails belong to each subchannel's one weekly piece (Ruling, Krish, 2026-11-04:
"Post random memes on a Monday but that doesn't mean it's Monday's colour and brand ... There is only one "follow the
money" piece, one "mind the gap" piece, and one "mind the gap" piece every week. Other stuff can be fluid, maybe
changeable." and "I should be allowed to post random stuff on any day but it doesn't take on the brand colours of
Follow the Money, Mind the Gap, or Under the Hood"). An asset made from that piece wears it only when its facts say
it "carries" the piece (Krish, 2026-11-04: "the character.ai carousel is going to be under Monday's "Follow the Money"
banner"). The Receipt is drawn as a page here with the wordmark fetch stubbed: no network, no browser."""
from __future__ import annotations

import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import brand  # noqa: E402
import receipt  # noqa: E402

# A week in which every day is named: Monday 9 November 2026 to Saturday 14 November 2026.
WEEK = {'Monday': '2026-11-09', 'Tuesday': '2026-11-10', 'Wednesday': '2026-11-11',
        'Thursday': '2026-11-12', 'Friday': '2026-11-13', 'Saturday': '2026-11-14'}
PICKED = ['Claude is eating', 'the jobs of its own humans']   # a cover title Krish picked (config/title-verdicts.json)


class SeriesColourTest(unittest.TestCase):
    def setUp(self):
        self.hs = brand.house()
        self.series = {c['name']: (c['day'], c['accent'].upper()) for c in self.hs['channels']}

    def test_only_the_weekly_piece_wears_its_series_and_every_other_asset_any_day_wears_none(self):
        self.assertEqual(sorted(d for d, _ in self.series.values()), ['Friday', 'Monday', 'Wednesday'])
        for name, (own_day, colour) in self.series.items():
            for day, date in WEEK.items():
                look = brand.series_look(self.hs, name, date)
                self.assertEqual(look['day'], day)
                if day == own_day:
                    self.assertEqual((look['series'], look['owner'], look['colour'].upper()), (True, name, colour))
                else:
                    # A random Monday meme is not Monday's piece: no series colour, no series name.
                    self.assertEqual((look['series'], look['owner']), (False, None), f'{name} on {day}')
                    self.assertEqual(look['colour'].upper(), self.hs['tokens']['cream'].upper())
            self.assertTrue(brand.series_look(self.hs, name)['series'], 'an undated asset of the piece is the piece')

    def test_an_asset_that_carries_the_weekly_piece_wears_it_on_any_day(self):
        look = brand.series_look(self.hs, 'follow.the.money', WEEK['Tuesday'], 'mon-09-nov-piece')
        self.assertEqual((look['series'], look['owner'], look['carries']), (True, 'follow.the.money', 'mon-09-nov-piece'))
        with self.assertRaises(SystemExit):
            brand.series_look(self.hs, 'follow.the.money', WEEK['Tuesday'], '  ')

    def test_a_drawn_cover_wears_its_series_only_when_it_is_the_piece(self):
        names = set(self.series)
        with tempfile.TemporaryDirectory(prefix='series-colour-') as folder:
            base = Path(folder)
            from PIL import Image
            Image.new('RGB', (600, 400), 'white').save(base / 'proof.png')
            Image.new('RGB', (200, 40), 'black').save(base / 'wordmark.png')
            for name, (own_day, colour) in self.series.items():
                for day, date in WEEK.items():
                    facts = {'subchannel': name, 'date': date, 'piece_id': None,
                             'sources': {'s1': ['A chart', 'https://example.com']},
                             'cover': {'headline': PICKED, 'proof': {'image': 'proof.png', 'source': 's1', 'tag': 'WHOSE IT IS'}}}
                    with patch.object(brand, 'fetch', return_value=base / 'wordmark.png'):
                        page = receipt.page(facts, facts['cover'], base, 'tall')
                    found = {h.upper() for h in re.findall(r'#[0-9A-Fa-f]{6}', page)}
                    shown = {n for n in names if n in page}
                    if day == own_day:
                        self.assertIn(colour, found, f'{name} wears its colour on its own day')
                        self.assertFalse(found & (brand.series_colours(self.hs) - {colour}), f'{name} wears another series colour')
                        self.assertEqual(shown, {name}, f'{name} names itself only')
                    else:
                        self.assertFalse(found & brand.series_colours(self.hs), f'{name} on {day} is not the piece and wears a series colour')
                        self.assertFalse(shown, f'{name} on {day} is not the piece and names {shown}')
                        self.assertIn(receipt.GROUND_STOPS[1].upper(), found, 'anything else keeps the house sage')
                    self.assertNotIn('#FF6B57', found, 'the old coral tag and ring are gone')

    def test_nothing_may_sit_on_the_words(self):
        # The fit refuses any decoration (.deco) that touches the headline, the wordmark, the logos, the pill or the
        # tag (Krish, 2026-11-04: "Stuff can't just randomly overlap on titles like that"); tests/receipt_overlap_test.py
        # proves it in a browser.
        self.assertIn("document.querySelectorAll('.deco')", receipt.FIT_JS)
        self.assertIn('!over.length', receipt.FIT_JS)


class SeriesSkinRotationTest(unittest.TestCase):
    """One series skin per week, moving on by itself through all nine, the week's three series pieces sharing it, and
    any piece naming another (Krish, 2026-11-05: "keep all of them and rotate them all at will over the coming weeks").
    tests/series_skins_test.py draws every skin in a browser."""

    def setUp(self):
        import skins
        self.skins = skins
        self.hs = brand.house()

    def look(self, subchannel, date):
        return brand.series_look(self.hs, subchannel, date)

    def test_nine_weeks_in_a_row_wear_all_nine_skins_once_in_order(self):
        import datetime as dt
        first = dt.date(2026, 11, 9)
        worn = [self.skins.pick({'date': str(first + dt.timedelta(weeks=k))}, self.look('follow.the.money', str(first + dt.timedelta(weeks=k))))
                for k in range(9)]
        self.assertEqual(worn, list(self.skins.ORDER))
        self.assertEqual(sorted(worn), sorted(set(worn)), 'each skin once')
        self.assertEqual(len(self.skins.ORDER), 9)
        self.assertEqual(worn[:2], ['neon', 'sunburst'], 'the week of 9 November wears neon, the week of 16 November sunburst')
        tenth = str(first + dt.timedelta(weeks=9))
        self.assertEqual(self.skins.pick({'date': tenth}, self.look('follow.the.money', tenth)), 'neon', 'the tenth week starts again')

    def test_the_weeks_monday_wednesday_and_friday_pieces_share_one_skin(self):
        import datetime as dt
        for monday, want in (('2026-11-09', 'neon'), ('2026-11-16', 'sunburst'), ('2026-12-28', 'brandbook'), ('2027-01-04', 'memphis')):
            m = dt.date.fromisoformat(monday)
            days = {'follow.the.money': m, 'under.the.hood': m + dt.timedelta(days=2), 'mind.the.gap': m + dt.timedelta(days=4)}
            worn = {name: self.skins.pick({'date': str(d)}, self.look(name, str(d))) for name, d in days.items()}
            self.assertEqual(set(worn.values()), {want}, worn)

    def test_the_weeks_before_9_november_wear_none_unless_a_piece_names_one(self):
        # The rotation starts in the week of 9 November. Before it the modulo would hand out a skin nobody chose
        # (Mon 2, Wed 4 and Fri 6 Nov all memphis, Mon 26 Oct brandbook): they wear none unless their facts name one.
        for name, date in (('follow.the.money', '2026-11-02'), ('under.the.hood', '2026-11-04'), ('mind.the.gap', '2026-11-06'),
                           ('follow.the.money', '2026-10-26')):
            look = self.look(name, date)
            self.assertTrue(look['series'], date)
            self.assertIsNone(self.skins.pick({'date': date}, look), date)
            self.assertIsNone(self.skins.for_shape({'date': date}, look, 'tall'), date)
            self.assertEqual(self.skins.pick({'date': date, 'skin': 'papercut'}, look), 'papercut', 'a skin a piece names is worn')
        self.assertEqual(self.skins.pick({'date': '2026-11-09'}, self.look('follow.the.money', '2026-11-09')), 'neon')

    def test_an_undated_series_piece_is_refused_never_given_the_days_skin(self):
        # brand.series_look counts an undated piece as the series piece; its week cannot be told, so the drawer
        # stops rather than reading the skin off the day it happens to be drawn.
        look = self.look('mind.the.gap', None)
        self.assertTrue(look['series'])
        with self.assertRaises(SystemExit) as stop:
            self.skins.pick({}, look)
        self.assertIn('needs its "date"', str(stop.exception))
        with self.assertRaises(SystemExit):
            self.skins.for_shape({'date': ''}, look, 'wide')
        with self.assertRaises(SystemExit):
            self.skins.for_shape({}, look, 'cover')   # a cover wears the skin too (Krish, 2026-11-05: "Skin the covers too"), so it needs its date
        self.assertEqual(self.skins.pick({'skin': 'bauhaus'}, look), 'bauhaus', 'one it names needs no date')

    def test_a_piece_may_name_another_skin_and_an_unknown_one_is_refused(self):
        look = self.look('under.the.hood', WEEK['Wednesday'])
        self.assertEqual(self.skins.pick({'date': WEEK['Wednesday'], 'skin': 'memphis'}, look), 'memphis')
        with self.assertRaises(SystemExit):
            self.skins.pick({'date': WEEK['Wednesday'], 'skin': 'glitter'}, look)

    def test_an_off_day_and_anything_that_is_not_the_piece_wear_no_skin(self):
        for name, (own_day, _) in {c['name']: (c['day'], c['accent']) for c in self.hs['channels']}.items():
            for day, date in WEEK.items():
                facts = {'date': date, 'skin': 'neon'}
                worn = self.skins.pick(facts, self.look(name, date))
                self.assertEqual(worn is not None, day == own_day, f'{name} on {day}')

    def test_every_shape_wears_the_skin_each_in_the_closer_thumbnails_design(self):
        # Krish, 2026-11-05: "Skin the covers too", so a series piece looks the same everywhere.
        self.assertEqual(sorted(self.skins.SHAPES), sorted(receipt.SHAPES))
        for shape, spec in receipt.SHAPES.items():
            self.assertEqual(self.skins.DESIGN[shape], 'wide' if spec['layout'] == 'side' else 'tall', shape)
            g = self.skins.geo(shape)
            self.assertEqual((g['shape'], g['design'], g['thumb']), (shape, self.skins.DESIGN[shape], shape in ('tall', 'wide')))
        # The thumbnails are handed the very numbers their skins were drawn to: the 3:4 grid window, YouTube's badge.
        self.assertEqual((self.skins.GEO['tall']['grid'], self.skins.GEO['wide']['badge']), ([0, 240, 1080, 1680], [968, 548, 1280, 720]))
        look = self.look('follow.the.money', WEEK['Monday'])
        for shape in receipt.SHAPES:
            self.assertEqual(self.skins.for_shape({'date': WEEK['Monday']}, look, shape), 'neon', shape)
        html = '<html><style></style><div id="card"></div></html>'
        off = self.look('follow.the.money', WEEK['Tuesday'])
        self.assertEqual(self.skins.apply(html, {'date': WEEK['Tuesday']}, 'tall', (1080, 1920), off), (html, None),
                         'an off-day page is left exactly as it is')

    def test_what_moved_a_piece_on_is_said_in_plain_words(self):
        # Krish, 2026-11-05: "Yeah just move on automatically"; the record and the drawer say which skin and why.
        self.assertEqual(receipt.refusal({'skin_over': ['deco on logos'], 'fitted': True}, []), 'touching the logos')
        self.assertEqual(receipt.refusal({'skin_over': ['deco bh on h1', 'deco bh on tag'], 'fitted': True}, []), 'touching the words and the tag')
        self.assertEqual(receipt.refusal({'skin_error': 'TypeError: x', 'fitted': True}, []), 'its drawing failing to place (TypeError: x)')
        self.assertEqual(receipt.refusal({'worded': ['deco: BADGE'], 'fitted': True}, []), 'words in a decoration')
        self.assertEqual(receipt.refusal({'fitted': False, 'ok': False}, []), 'crowding the headline out of its lines')
        one = [{'skin': 'neon', 'shape': 'square', 'why': 'touching the logos'}]
        self.assertEqual(receipt.skin_note('neon', False, one, 'sunburst'),
                         'neon could not be drawn on the square cover without touching the logos; wore sunburst, next in the rotation')
        two = one + [{'skin': 'sunburst', 'shape': 'tall', 'why': 'touching the words'}]
        self.assertEqual(receipt.skin_note('neon', True, two, 'painted_scene'),
                         'the facts name neon, which could not be drawn on the square cover without touching the logos; sunburst could not be '
                         'drawn on the tall thumbnail without touching the words; wore painted_scene, two on in the rotation')
        self.assertTrue(receipt.skin_note('neon', False, two, None).startswith('none of the nine series skins could be drawn on every shape (neon could'))
        self.assertTrue(receipt.skin_note('neon', False, two, None).endswith('); wore the plain series Receipt'))
        self.assertIsNone(receipt.skin_note('neon', False, [], 'neon'), 'nothing moved it on')

    def test_every_skin_is_a_module_with_the_contract(self):
        for skin_id in self.skins.ORDER:
            module = self.skins.load(skin_id)
            self.assertTrue(callable(getattr(module, 'skin', None)), skin_id)
            self.assertIsInstance(getattr(module, 'PLACE_JS', ''), str, skin_id)
        from skins import _kit
        t = self.hs['tokens']
        self.assertEqual((_kit.INK, _kit.CREAM, _kit.MINT, _kit.SAGE), (t['ink'], t['cream'], t['mint'], receipt.SAGE), 'the kit is the house')

    def test_the_painted_scene_stills_are_named_by_url_and_sha256_and_checked_closed(self):
        import hashlib
        import json
        from skins import _kit
        table = json.loads(_kit.ART.read_text(encoding='utf-8'))
        for day in ('mon', 'wed', 'fri'):
            for shape in ('tall', 'wide'):
                row = table[f'scene-{day}-{shape}']
                self.assertTrue(row['url'].startswith('https://') and row['job_id'] in row['url'], row)
                self.assertRegex(row['sha256'], r'^[0-9a-f]{64}$')
        body = b'\x89PNG a still'
        fake = {'scene-mon-tall': {'url': 'https://example.invalid/a.png', 'sha256': hashlib.sha256(body).hexdigest()}}

        class Reply:
            def __init__(self, data):
                self.data = data

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return self.data

        def offline(*a, **k):
            raise OSError('no network')
        with tempfile.TemporaryDirectory(prefix='series-art-') as folder:
            cache = Path(folder)
            with patch.object(_kit, 'ART_CACHE', cache):
                with patch('urllib.request.urlopen', offline), self.assertRaises(SystemExit):
                    _kit.fetch_art('scene-mon-tall', fake)                  # no network and no copy: refused
                with patch('urllib.request.urlopen', return_value=Reply(b'other bytes')), self.assertRaises(SystemExit):
                    _kit.fetch_art('scene-mon-tall', fake)                  # bytes that are not the recorded ones: refused
                self.assertFalse(list(cache.iterdir()), 'nothing unchecked is kept')
                with patch('urllib.request.urlopen', return_value=Reply(body)):
                    got = _kit.fetch_art('scene-mon-tall', fake)            # the recorded bytes: kept
                self.assertEqual(got.read_bytes(), body)
                with patch('urllib.request.urlopen', offline):
                    self.assertEqual(_kit.fetch_art('scene-mon-tall', fake), got)   # a checked copy needs no network
                got.write_bytes(b'tampered')
                with patch('urllib.request.urlopen', offline), self.assertRaises(SystemExit):
                    _kit.fetch_art('scene-mon-tall', fake)                  # a copy changed since: refused
                with self.assertRaises(SystemExit):
                    _kit.fetch_art('scene-sat-tall', fake)                  # a still nobody recorded: refused


if __name__ == '__main__':
    unittest.main()
