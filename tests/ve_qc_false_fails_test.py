"""The ve qc rows that failed a fine art-directed cut (Krish, 2026-11-19, the Tue 17 / Thu 19 habits voiceover short, piece
701a2c55): every gating row passed, words.lost was clean, but captions.ocr, captions.render, captions.clock and
composition failed, measured_pass was false and the library refused the cut. Each test here fails on the old behaviour.

Run: python3 -m unittest tests.ve_qc_false_fails_test
"""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import plainframes as pf, qc, qc_captions, qc_composition, qc_gates  # noqa: E402
from cutgates import captions as cg  # noqa: E402

FX = json.loads((ROOT / 'tests' / 'fixtures' / 've' / 'habits-qc-false-fails.json').read_text(encoding='utf-8'))
PAGES = FX['captions']


def lock():
    from velib import designlock
    return designlock.load()


class ArtPageRegion(unittest.TestCase):
    """The art-directed stack hangs above the house caption box by the cut's tallest page; it is read where it is drawn."""

    def test_the_read_region_is_the_measured_stack_not_the_house_box(self):
        view = qc_captions.art_view(PAGES, 0, '9:16', 30)
        x, y, w, h = view['region']
        stack_top = round(1320 - max(pf.art_layout([w['text'] for w in p['words']], p.get('swipeIndex'), '9:16')['height'] for p in PAGES))
        self.assertEqual(y, stack_top, 'read from the top of the drawn stack')
        self.assertLess(y, 1078, 'the house box (y 1078 on the habits short) cut the stack\'s upper rows off')
        own = pf.art_layout([w['text'] for w in PAGES[0]['words']], PAGES[0].get('swipeIndex'), '9:16')['height']
        self.assertGreaterEqual(y + h, round(stack_top + own) + 10, 'down to the page\'s own foot, with room for the word\'s rise')
        self.assertEqual(view['settle'], 4, '0.1 s at 30 fps is 3 frames, plus one')

    def test_qc_gives_every_art_page_its_own_stack_and_judge(self):
        props = {'aspect': '9:16', 'fps': 30, 'captionTheme': 'art-directed', 'captionStyle': 'house', 'captions': PAGES,
                 'beats': [{'id': 'b1', 'fromFrame': 0, 'toFrame': 400, 'layout': 'STAGE', 'plate': {'source': 'none'}}],
                 'objects': [], 'events': [], 'segments': [], 'audio': {'stem': {'src': 'stem.wav'}},
                 'brand': {'mark': {'src': 'mark.png'}}, 'durationFrames': 400}
        pages = qc.inputs_from_props(props)['pages']
        self.assertTrue(all('art' in p for p in pages))
        self.assertEqual(pages[0]['region'][1], qc_captions.art_view(PAGES, 0, '9:16', 30)['region'][1])
        house = {**props, 'captionTheme': None}
        self.assertTrue(all('art' not in p for p in qc.inputs_from_props(house)['pages']), 'the house style is unchanged')


class InOrder(unittest.TestCase):
    """A page is judged by its words in order; only the echo and ghost words the renderer draws there are forgiven."""

    def test_the_echo_word_is_forgiven_and_nothing_else(self):
        extras = qc_captions.art_view(PAGES, 0, '9:16', 30)['extras']
        read = ['firing', 'your', 'ai', 'firing']  # the page, and the huge faint echo of its key word behind it
        self.assertLess(qc_captions._agreement(['firing', 'your', 'ai'], read), 0.98, 'the old judge failed the echo')
        self.assertTrue(qc_captions.in_order(['firing', 'your', 'ai'], read, extras)['exact'])

    def test_a_missing_word_an_order_swap_or_a_stray_word_still_fails(self):
        extras = ['firing']
        self.assertFalse(qc_captions.in_order(['firing', 'your', 'ai'], ['firing', 'ai'], extras)['exact'])
        self.assertFalse(qc_captions.in_order(['firing', 'your', 'ai'], ['your', 'firing', 'ai'], extras)['exact'])
        bad = qc_captions.in_order(['firing', 'your', 'ai'], ['firing', 'your', 'ai', 'banana'], extras)
        self.assertFalse(bad['exact'])
        self.assertLess(bad['score'], 0.98)

    def test_the_previous_pages_ghost_is_forgiven_on_the_next_page(self):
        view = qc_captions.art_view(PAGES, 1, '9:16', 30)
        prev = [t for w in PAGES[0]['words'] for t in qc_captions._tokens(w['text'])]
        self.assertTrue(set(qc_captions.fold(t) for t in prev) <= set(view['extras']))


class OcrSamplesSettledPage(unittest.TestCase):
    def test_an_art_page_is_read_when_its_last_word_has_settled(self):
        page = dict(PAGES[0], art={'extras': [], 'settle': 4})
        with mock.patch('shutil.which', return_value=None):
            row = qc_captions.ocr('cut.mp4', [page], (58, 974, 824, 266))['value'][0]
        landed = max(int(w['atFrame']) for w in PAGES[0]['words'])
        self.assertEqual(row['frame'], landed + 4)
        with mock.patch('shutil.which', return_value=None):
            old = qc_captions.ocr('cut.mp4', [PAGES[0]], (58, 974, 824, 266))['value'][0]
        self.assertNotEqual(old['frame'], landed + 4, 'the old read took the middle of the window')


class RendererTruth(unittest.TestCase):
    def test_the_renderer_read_judges_an_art_page_in_order(self):
        page = dict(PAGES[0], art={'extras': qc_captions.art_view(PAGES, 0, '9:16', 30)['extras'], 'settle': 4})
        reader = lambda frame, want: {'text': 'FIRING\nYOUR AI\nFIRING', 'score': 0.75}  # noqa: E731
        start = int(page['fromFrame'])
        new = cg.renderer_truth('cut.mp4', [page], (58, 974, 824, 266), ocr=reader, changes=[start])
        old = cg.renderer_truth('cut.mp4', [PAGES[0]], (58, 974, 824, 266), ocr=reader, changes=[start])
        self.assertEqual(new['status'], 'pass')
        self.assertEqual(old['status'], 'fail', 'the old read wanted an exact match with no echo')
        missing = cg.renderer_truth('cut.mp4', [page], (58, 974, 824, 266), changes=[start],
                                    ocr=lambda f, w: {'text': 'FIRING AI', 'score': 1.0})
        self.assertEqual(missing['status'], 'fail', 'a word missing still fails')


class ClockPlaceholder(unittest.TestCase):
    def test_a_placeholder_tolerance_is_shown_never_counted(self):
        pages = [{'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'Firing'}]}, {'fromFrame': 35, 'toFrame': 60, 'words': [{'text': 'hard'}]}]
        heard = {'faster-whisper': [{'w': 'Firing', 's': 0.0, 'e': 0.4}, {'w': 'hard', 's': 1.0, 'e': 1.3}]}  # page 2 is 5 frames late
        row = qc_gates.captions_clock(pages, heard, 'faster-whisper', 30)
        self.assertIs(row['pass'], False, 'still measured and shown')
        self.assertEqual(row['status'], 'advisory', 'a placeholder tolerance never fails the cut')
        from cutgates import settings
        measured = {**settings.rule('captions'), 'clock_tolerance_status': 'measured on 26 Oct 2026'}
        with mock.patch.object(settings, 'rule', return_value=measured):
            self.assertEqual(qc_gates.captions_clock(pages, heard, 'faster-whisper', 30)['status'], 'measured')


class PhotoTexture(unittest.TestCase):
    """Words OCR finds on a generated picture count only with strong evidence; real type keeps the house rule."""

    def image(self):
        from PIL import Image
        return Image.new('RGB', (1080, 1920), (40, 40, 40))

    def test_photo_texture_is_not_a_word(self):
        jui = {'text': 'JUI', 'conf': 75.4, 'x': 502, 'y': 1099, 'w': 113, 'h': 80}   # b14, the stampers picture
        glyph = {'text': 'a»', 'conf': 93.0, 'x': 931, 'y': 892, 'w': 48, 'h': 24}  # b17, the boxes picture
        old = qc_composition.measure(self.image(), lock(), caption_words=set(), ocr_words=[jui, glyph])
        self.assertFalse(old['checks']['caption_zone']['pass'] and old['checks']['platform_zone']['pass'], 'the old rule failed it')
        new = qc_composition.measure(self.image(), lock(), caption_words=set(), ocr_words=[jui, glyph], photo=True)
        self.assertTrue(new['checks']['caption_zone']['pass'] and new['checks']['platform_zone']['pass'])

    def test_real_type_on_a_picture_still_counts(self):
        word = {'text': 'mistakes', 'conf': 96.8, 'x': 603, 'y': 1700, 'w': 201, 'h': 51}
        self.assertFalse(qc_composition.measure(self.image(), lock(), caption_words=set(), ocr_words=[word], photo=True)
                         ['checks']['platform_zone']['pass'])
        stamp = {'text': 'YOU', 'conf': 80.0, 'x': 603, 'y': 1700, 'w': 160, 'h': 51}  # a stamp the engine draws on the picture
        drawn = qc_composition.measure(self.image(), lock(), caption_words=set(), ocr_words=[stamp], photo=True,
                                       drawn=[(140, 1600, 800, 300)])
        self.assertFalse(drawn['checks']['platform_zone']['pass'], 'type the engine draws keeps the house rule')

    def test_only_a_generated_still_is_a_picture(self):
        props = {'objects': FX['objects']}
        self.assertTrue(qc_composition.generated_picture_at(props, 1591), 'b14 is the stampers picture')
        self.assertTrue(qc_composition.generated_picture_at(props, 1853), 'b17 is the boxes picture')
        self.assertFalse(qc_composition.generated_picture_at(props, 349), 'b3 is a screen recording: its text is real')


if __name__ == '__main__':
    unittest.main()
