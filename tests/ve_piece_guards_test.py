"""The Build or buy piece's failures, carried forward as guards for every later piece (config/ve/piece-guards.json).

Ruling (Krish, 2026-11-19): every component that built a piece carries its failures forward as guards, so the next piece
cannot repeat them. Each test reads the piece's own spec (Wed 18 Nov 2026, piece db9f9f6a; records only, no media) and
fails on what went wrong there, then passes once the fault is fixed.

    python3 -m pytest -q tests/ve_piece_guards_test.py
"""
import copy
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
from velib import piece_guards as pg  # noqa: E402
import title_check  # noqa: E402

FIX = ROOT / 'tests' / 'fixtures' / 've' / 'build-or-buy'
SPEC = json.loads((FIX / 'spec.json').read_text(encoding='utf-8'))
CFG = pg.config()
DAY = CFG['binds_from']


def spec():
    return copy.deepcopy(SPEC)


def hits(problems, key):
    return [p for p in problems if p.startswith(f'piece.{key}')]


class TakeOrientation(unittest.TestCase):
    def test_a_vertical_take_on_16_9_layouts_is_refused_and_a_wide_take_passes(self):
        s = spec()
        take = next(a for a in s['assets'] if a['id'] == 'long-master')
        self.assertTrue(pg.take_orientation(s, CFG['take_orientation']), 'a take with no frame is refused')
        take['frame'] = {'width': 1080, 'height': 1920}
        bad = pg.take_orientation(s, CFG['take_orientation'])
        self.assertTrue(any('vertical (1080x1920)' in p for p in bad))
        take['frame'] = {'width': 1920, 'height': 1080}
        s['assets'] = [a if a['id'] != 'short-master' else {**a, 'frame': {'width': 1080, 'height': 1920}} for a in s['assets']]
        self.assertEqual(pg.take_orientation(s, CFG['take_orientation']), [])


    def test_the_pillar_staging_carries_a_vertical_take_on_16_9_but_never_a_window(self):
        # Krish, 19 Nov 2026: "Pillar: whole take on the right" (kit/staging.ts pillar draws the take whole).
        s = spec()
        take = next(a for a in s['assets'] if a['id'] == 'long-master')
        take['frame'] = {'width': 1080, 'height': 1920}
        s.setdefault('style', {})['layout'] = {'mode': 'pillar', 'reason': 'test'}
        for b in s['cuts']['long']['beats']:
            if b['layout'] == 'WINDOW':
                b['layout'] = 'F1'
        self.assertEqual(hits(pg.take_orientation(s, CFG['take_orientation']), 'take_orientation'), [])
        s['cuts']['long']['beats'][0]['layout'] = 'WINDOW'
        self.assertTrue(any('layout WINDOW' in p for p in pg.take_orientation(s, CFG['take_orientation'])))

class Logos(unittest.TestCase):
    def test_mixed_or_dark_marks_need_equal_tiles(self):
        s = spec()
        self.assertTrue(any('Salesforce, Fin, Workday' in p for p in pg.logos(s, CFG['logos'])))
        dark = {'obj': 'fin_alone', 'device': 'logo_card', 'params': {'logos': [{'id': 'Fin'}]}}
        s['objects'].append(dark)
        self.assertTrue(any('fin_alone' in p and 'dark mark' in p for p in pg.logos(s, CFG['logos'])))
        for o in s['objects']:
            if o.get('device') == 'logo_card':
                o['params']['tiles'] = True
        self.assertEqual(pg.logos(s, CFG['logos']), [])


class TallWindows(unittest.TestCase):
    def test_the_short_window_under_the_app_buttons_is_refused(self):
        s = spec()
        self.assertTrue(any('cuts.short.slack' in p for p in pg.tall_windows(s, CFG['tall_windows'])))
        for b in s['cuts']['short']['beats']:
            if b['layout'] == 'WINDOW':
                b['layout'] = 'STAGE'
        self.assertEqual(pg.tall_windows(s, CFG['tall_windows']), [])

    def test_the_window_box_is_the_renderer_s(self):
        src = (ROOT / 'apps/renderer/src/engine/layouts/index.ts').read_text(encoding='utf-8')
        x, y, w, h = CFG['tall_windows']['window_box']
        self.assertRegex(src, re.escape(f'{{ left: {x}, top: {y}, width: {w}, height: {h} }}'))


class ScreenshotCrop(unittest.TestCase):
    def test_an_uncropped_screenshot_is_refused(self):
        s = spec()
        self.assertEqual(pg.screenshot_crop(s, CFG['screenshot_crop']), [], 'every card on the piece chose a crop')
        card = next(o for o in s['objects'] if o['obj'] == 'hl_fullstack')
        del card['params']['crop']
        self.assertTrue(any('hl_fullstack' in p for p in pg.screenshot_crop(s, CFG['screenshot_crop'])))


class IdeaLock(unittest.TestCase):
    def test_his_picked_idea_is_written_down(self):
        s = spec()
        self.assertEqual(pg.idea_lock(s, CFG['idea_lock']), [])
        s['style']['idea'] = {}
        self.assertTrue(pg.idea_lock(s, CFG['idea_lock']))


class TalkingHead(unittest.TestCase):
    def test_long_bare_talking_head_and_pulsing_logos_are_refused(self):
        s = spec()
        bad = pg.talking_head(s, CFG['talking_head'])
        self.assertTrue(any('cuts.long.focus' in p for p in bad), bad)
        self.assertTrue(any(p.startswith('piece.talking_head cuts.long:') for p in bad))
        logo_objs = {o['obj'] for o in s['objects'] if o.get('device') == 'logo_card'}
        for cut in s['cuts'].values():
            for b in cut['beats']:
                if b.get('face') == 'full' and b['id'] != 'close':  # a picture on every talking-head beat
                    b['events'] = [{'at_w': b['span']['from_w'], 'obj': 'x', 'verb': 'enter'}]
                b['events'] = [{**e, 'verb': 'move'} if e.get('obj') in logo_objs else e for e in b.get('events', [])]  # logos that move, not pulse
        self.assertEqual(pg.talking_head(s, CFG['talking_head']), [])


class CaptionWords(unittest.TestCase):
    def test_the_address_wider_than_the_line_is_named_at_lint_and_a_split_address_is_refused(self):
        s = spec()
        bad = pg.caption_words(s, CFG['caption_words'], FIX)
        self.assertTrue(any('the site address' in p and 'cannot compile' in p for p in bad), bad)
        words = json.loads((FIX / 'words.short.json').read_text(encoding='utf-8'))
        tmp = Path(self.id().replace('.', '_'))
        try:
            tmp.mkdir(exist_ok=True)
            split = words[:-1] + [{**words[-1], 'word': 'makeyourmindup'}, {**words[-1], 'w': words[-1]['w'] + 1, 'word': 'dot'},
                                  {**words[-1], 'w': words[-1]['w'] + 2, 'word': 'ai'}]
            (tmp / 'words.short.json').write_text(json.dumps(split), encoding='utf-8')
            self.assertTrue(any('is split' in p for p in pg.caption_words(s, CFG['caption_words'], tmp)))
            (tmp / 'words.short.json').write_text(json.dumps(words[:-1]), encoding='utf-8')
            self.assertEqual([p for p in pg.caption_words(s, CFG['caption_words'], tmp) if 'cuts.short' in p], [])
        finally:
            for f in tmp.glob('*'):
                f.unlink()
            tmp.rmdir()

    def test_an_art_directed_cut_gives_the_address_a_page_of_its_own(self):
        # ArtDirectedCaption shrinks a lone word to its region, so the address is one word on one page, never split.
        s = spec()
        s.setdefault('style', {})['captions'] = {'theme': 'art-directed', 'placement': 'lower', 'reason': 'test'}
        self.assertFalse(any('cannot compile' in p for p in pg.caption_words(s, CFG['caption_words'], FIX)))
        from velib import compile as ve_compile
        rows = [{'text': t, 'w': i, 'atFrame': i * 10} for i, t in enumerate(['The', 'full', 'story', 'is', 'at', 'makeyourmindup.ai'])]
        with self.assertRaises(ValueError):
            ve_compile._caption_groups(rows, '9:16')
        groups = ve_compile._caption_groups(rows, '9:16', (), True)
        self.assertEqual([[r['text'] for r in g] for g in groups][-1], ['makeyourmindup.ai'])
        self.assertEqual(sum(len(g) for g in groups), len(rows))


class Binding(unittest.TestCase):
    def test_a_piece_before_the_rows_bind_is_not_changed_and_lint_calls_them(self):
        self.assertEqual(pg.lints(spec(), '2026-11-18', FIX), [])
        self.assertTrue(pg.lints(spec(), DAY, FIX))
        self.assertIn('piece_guards.lints(spec, guards.bind_day(spec)', (ROOT / 'scripts/velib/lint.py').read_text(encoding='utf-8'))


class ThumbnailWords(unittest.TestCase):
    def test_build_it_crazy_fails_the_title_rule_and_a_named_line_passes(self):
        src = (ROOT / 'docs/plans/2026-11-18-wednesday/script-short.txt').read_text(encoding='utf-8')
        self.assertTrue(title_check.problems('BUILD IT? CRAZY.', src))
        self.assertTrue(any('grades' in p for p in title_check.problems('Workday is crazy', src)))
        self.assertEqual(title_check.problems('Klarna dropped Salesforce and Workday', src), [])


if __name__ == '__main__':
    unittest.main()
