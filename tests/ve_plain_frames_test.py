"""The v10 guards (Krish, 2026-11-19, Proof v10 of the habits short, piece 701a2c55; config/failures.json F58).

Proof v10 reached him with an art-directed caption stack hanging to about y 986 over the bottom of a white screen
recording, and every screen beat leaving y 1340 to 1920 as near-bare ink. ve qc had measured those screens at 24 to 54%
fill; the caption was measured against the house box, never the stack the renderer draws. These tests build that frame (and
a fixed one) and hold each guard to failing the first and passing the second. A check that has never been seen to fail is a
comment, not a test.

Frames are synthetic: 1080 x 1920 arrays standing for the white IBM page, the ink below it and the cream caption stack.
No render is made; the two real clips are not needed to prove the rule.
"""
import copy
import json
import os
import re
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
os.environ['VE_GATES_OFFLINE'] = '1'

import ve  # noqa: E402
from velib import plainframes as pf, proof  # noqa: E402
from velib.common import ffmpeg  # noqa: E402

CFG = pf.config()
ART_TSX = (ROOT / 'apps/renderer/src/engine/chrome/ArtDirectedCaption.tsx').read_text(encoding='utf-8')
KIT_TS = (ROOT / 'apps/renderer/src/engine/captions/kit.ts').read_text(encoding='utf-8')
CREAM = (245, 235, 205)
W, H = 1080, 1920


def screen_frame(content_bottom=1340, below='ink', cream_box=None):
    """The white IBM page down to content_bottom, then what is under it. below: 'ink' (flat), 'faint' (ink with a faint
    texture), 'ui' (a dark interface with real detail). cream_box paints a cream caption stack (blocks of ink) inside it."""
    rng = np.random.default_rng(7)
    rgb = np.full((H, W, 3), 12, np.uint8)
    page = rng.integers(235, 256, (content_bottom, W, 1))  # white, with the page's own detail
    rgb[:content_bottom] = np.repeat(page, 3, axis=2).astype(np.uint8)
    if below == 'faint':
        rgb[content_bottom:] = np.clip(15 + rng.normal(0, 3, (H - content_bottom, W, 1)), 0, 255).astype(np.uint8).repeat(3, axis=2)
    elif below == 'ui':
        rgb[content_bottom:] = rng.integers(10, 130, (H - content_bottom, W, 1)).astype(np.uint8).repeat(3, axis=2)
    if cream_box:
        x, y, w, h = cream_box
        for row in range(y, y + h, 40):
            rgb[row:row + 22, x:x + int(w * 0.8)] = CREAM  # a line of cream type
    return rgb


def gray(rgb):
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)


class Mirror(unittest.TestCase):
    """The python copy of the renderer's caption geometry is held to the TypeScript source, number by number."""

    def test_art_region_and_sizes_are_the_renderers(self):
        a = CFG['caption_over_content']['art_directed']
        for aspect, key in (('9:16', "'9:16': { left: 70, top: 1095, width: 800, height: 225 }"), ('16:9', "'16:9': { left: 192, top: 700, width: 900, height: 300 }")):
            self.assertIn(key, ART_TSX)
            box = a['region'][aspect]
            self.assertEqual((box['left'], box['top'], box['width'], box['height']), tuple(int(n) for n in re.findall(r'\d+', key.split(':', 2)[2])))
        m = re.search(r'keySize: (\d+), supportSize: (\d+), ghostSize: (\d+), lineHeight: ([\d.]+), gap: (\d+), rowGap: (\d+)', ART_TSX)
        self.assertEqual((a['key_size'], a['support_size'], a['line_height'], a['gap'], a['row_gap']),
                         (int(m.group(1)), int(m.group(2)), float(m.group(4)), int(m.group(5)), int(m.group(6))))
        self.assertIn(f"anton: {{ upper: {a['char_em']}", KIT_TS)
        # The entry, ghost and echo numbers the caption read uses (qc_captions.art_view, 19 Nov 2026).
        self.assertIn(f"enterSeconds: {a['enter_seconds']}, enterRisePx: {a['enter_rise_px']},", ART_TSX)
        self.assertRegex(ART_TSX, rf"ghostGap: {a['ghost_gap']}\b")
        self.assertIn(f"top: props.aspect === '9:16' ? {a['echo']['9:16']['top']} : {a['echo']['16:9']['top']}", ART_TSX)
        self.assertIn(f"fontSize: {a['echo']['9:16']['size']}, lineHeight: 1", ART_TSX)

    def test_theme_regions_are_the_renderers(self):
        kit = (ROOT / 'apps/renderer/src/engine/captions/kit.ts').read_text(encoding='utf-8')
        for aspect, regions in CFG['caption_over_content']['theme_regions'].items():
            for name, box in regions.items():
                self.assertRegex(kit, rf"{name}: \{{ left: {box['left']}, top: {box['top']}, width: {box['width']}, height: {box['height']} \}}")

    def test_stack_hangs_from_the_foot_by_the_tallest_page(self):
        one = {'words': [{'text': 'DATA'}], 'swipeIndex': None}
        tall = {'words': [{'text': 'which'}, {'text': 'habits'}, {'text': 'automation'}, {'text': 'will'}, {'text': 'cost'}], 'swipeIndex': 2}
        x, y, w, h = pf.art_box([one, tall], one, '9:16')
        self.assertEqual((x, w), (70, 800))
        self.assertEqual(round(y + 0), round(1320 - pf.art_layout([t['text'] for t in tall['words']], 2, '9:16')['height']))
        self.assertLess(y, 1095, 'a tall page hangs above the region top, which the house box never measured')
        # a cut of one-word pages: one row, the foot of the region
        self.assertEqual(round(pf.art_box([one], one, '9:16')[1]), round(1320 - 168 * 0.96))


class RealProofV10(unittest.TestCase):
    """The captions of Proof v10 as the habits-short branch recorded them (tests/fixtures/ve/habits-v10-proof-captions.json)."""

    def test_the_stack_of_v10_hung_far_above_the_house_box(self):
        real = json.loads((ROOT / 'tests/fixtures/ve/habits-v10-proof-captions.json').read_text(encoding='utf-8'))
        pages = [{'words': c['words'], 'swipeIndex': c['swipeIndex']} for c in real['captions']]
        tops = {pf.art_box(pages, page, real['aspect'])[1] for page in pages}
        self.assertEqual(len(tops), 1, 'every page hangs from one point')
        top = tops.pop()
        # Krish's contact strip showed it hanging to "about y 986"; the renderer's own arithmetic puts the stack top at 974.
        self.assertTrue(960 <= top <= 1000, top)
        self.assertLess(top, 1090, 'the house box ve qc measured against starts at y 1090: the stack was never measured')


class PlainDark(unittest.TestCase):
    def test_v10_ink_under_the_screen_fails_naming_the_band(self):
        bad = pf.plain_dark_problems([('b3-screen', 220, gray(screen_frame()))])
        self.assertEqual(len(bad), 1)
        self.assertEqual((bad[0]['beat'], bad[0]['frame'], bad[0]['band'][0]), ('b3-screen', 220, 1340))
        self.assertGreaterEqual(bad[0]['band'][1] - bad[0]['band'][0], 580)
        self.assertIn('beat b3-screen, frame 220', bad[0]['says'])

    def test_ink_with_only_a_faint_texture_is_still_plain(self):
        self.assertEqual(len(pf.plain_dark_problems([('b', 1, gray(screen_frame(below='faint')))])), 1)

    def test_a_dark_interface_with_real_detail_passes(self):
        self.assertEqual(pf.plain_dark_problems([('b', 1, gray(screen_frame(below='ui')))]), [])

    def test_a_short_band_passes_and_the_limit_scales_with_the_frame(self):
        frame = screen_frame(content_bottom=1850, below='ink')  # 70 px of ink: under 120
        self.assertEqual(pf.plain_dark_problems([('b', 1, gray(frame))]), [])
        small = gray(frame)[::2, ::2]  # a half-height frame: 35 px of ink against a 60 px limit
        self.assertEqual(pf.plain_dark_problems([('b', 1, small)]), [])
        self.assertEqual(len(pf.plain_dark_problems([('b', 1, gray(screen_frame())[::2, ::2])])), 1)

    def test_a_caption_in_the_ink_breaks_the_run(self):
        frame = screen_frame()
        frame[1400:1900:20, 100:900] = CREAM  # type with detail every 20 px: no plain band is 120 px
        self.assertEqual(pf.plain_dark_problems([('b', 1, gray(frame))]), [])


class CaptionOverContent(unittest.TestCase):
    ONE = {'words': [{'text': 'which'}, {'text': 'habits'}, {'text': 'automation'}, {'text': 'will'}, {'text': 'cost'}], 'swipeIndex': 2}

    def items(self, rgb, scrim=False, background=None):
        props = {'aspect': '9:16', 'captionTheme': 'art-directed'}
        box = pf.caption_box_drawn(props, [self.ONE], self.ONE)
        return [{'page': 4, 'frame': 410, 'beat': 'b4-ibm', 'box': box, 'rgb': rgb, 'ink': CREAM, 'scrim': scrim, 'background': background}], box

    def test_v10_stack_over_the_white_page_fails_naming_page_and_frame(self):
        items, box = self.items(screen_frame(content_bottom=1500, cream_box=(70, 986, 800, 330)))
        self.assertLess(box[1], 1000)
        bad = pf.caption_over_content_problems(items)
        self.assertEqual(len(bad), 1)
        self.assertEqual((bad[0]['page'], bad[0]['frame'], bad[0]['beat']), (4, 410, 'b4-ibm'))
        self.assertIn('caption page 4, frame 410', bad[0]['says'])

    def test_the_stack_over_dark_content_passes(self):
        rgb = screen_frame(content_bottom=900, below='ui', cream_box=(70, 986, 800, 330))
        items, _ = self.items(rgb)
        self.assertEqual(pf.caption_over_content_problems(items), [])

    def test_the_old_house_box_would_have_missed_it(self):
        # ve qc's box for this page (qc_faces.caption_box, the house region y 1090 to 1307) with the same frame: the frame
        # is bright there too, so the measure was the stack's top, not the brightness. The stack's top is what moved.
        _, box = self.items(screen_frame())
        self.assertLess(box[1], 1090)

    def test_content_only_under_the_boxs_own_columns_is_seen_by_the_box_pixels(self):
        rgb = np.full((H, W, 3), 15, np.uint8)
        rgb[600:1500, 200:800] = 250  # a narrow screen recording inside the caption columns, dark margins either side
        items, _ = self.items(rgb)
        self.assertEqual(len(pf.caption_over_content_problems(items)), 1)

    def test_a_scrim_clears_it(self):
        items, _ = self.items(screen_frame(content_bottom=1500), scrim=True)
        self.assertEqual(pf.caption_over_content_problems(items), [])

    def test_a_captions_off_frame_is_read_when_given(self):
        dark_behind = np.full((H, W, 3), 20, np.uint8)
        items, _ = self.items(screen_frame(content_bottom=1500), background=dark_behind)
        self.assertEqual(pf.caption_over_content_problems(items), [], 'what is behind it is dark; the margins are not asked')

    def test_a_theme_without_the_stack_uses_its_region(self):
        props = {'aspect': '9:16', 'captionTheme': 'podcast', 'captionPlacement': 'upper'}
        self.assertEqual(pf.caption_box_drawn(props, [self.ONE], self.ONE), (70, 290, 940, 230))


def props_with(captions):
    sys.path.insert(0, str(ROOT / 'tests'))
    import ve_proof_test as t  # noqa: PLC0415
    spec = t.whole()
    props = t.props_for(spec)
    props['brand'] = {'mark': {'src': 'mark.png'}}
    props['tokens'] = {'cream': '#F5EBCD'}
    props['captionTheme'] = 'art-directed'
    props['captions'] = captions
    return props


class WholeFile(unittest.TestCase):
    """check_frames: the sampling, the pages and both checks, through the same frame reader ve qc uses, with frames faked."""

    def run_check(self, frame):
        pages = [{'fromFrame': 90, 'toFrame': 150, 'words': [{'text': 'which', 'atFrame': 90}, {'text': 'habits', 'atFrame': 100}], 'swipeIndex': 1}]
        props = props_with(pages)
        return pf.check_frames('x.mp4', props, grab=lambda path, f, fps, size: frame)

    def test_v10_frame_fails_both_checks_and_the_fixed_frame_passes(self):
        bad = self.run_check(screen_frame(content_bottom=1340, cream_box=(70, 986, 800, 330)))
        self.assertIs(bad['pass'], False)
        self.assertEqual({p['check'] for p in bad['problems']}, {'plain_dark', 'caption_over_content'})
        good = self.run_check(screen_frame(content_bottom=900, below='ui', cream_box=(70, 1100, 800, 200)))
        self.assertIs(good['pass'], True, good)
        self.assertGreater(good['frames'], 3)

    def test_an_unreadable_frame_is_not_run_never_a_pass(self):
        def broken(*_):
            raise OSError('no such file')
        result = pf.check_frames('x.mp4', props_with([{'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'a', 'atFrame': 0}]}]), grab=broken)
        self.assertEqual((result['pass'], result['status']), (None, 'not_run'))
        self.assertIn('not sendable', pf.refusal_lines(result)[0])

    def test_a_page_starting_on_the_files_last_frame_is_not_sampled(self):
        # Fri 20 Nov: a 240-frame proof ended exactly where the next caption page starts; reading frame 240 read nothing.
        props = props_with([{'fromFrame': 90, 'toFrame': 150, 'words': [{'text': 'which', 'atFrame': 90}, {'text': 'habits', 'atFrame': 100}], 'swipeIndex': 1}])
        end = props['durationFrames']
        props['captions'] = props['captions'] + [{'fromFrame': end, 'toFrame': end + 30, 'words': [{'text': 'next', 'atFrame': end}, {'text': 'page', 'atFrame': end + 5}], 'swipeIndex': 1}]
        asked = []
        def grab(path, f, fps, size):
            asked.append(f)
            if f >= end:
                raise ValueError('cannot reshape array of size 0')
            return screen_frame(content_bottom=900, below='ui', cream_box=(70, 1100, 800, 200))
        result = pf.check_frames('x.mp4', props, grab=grab)
        self.assertEqual(result['status'], 'ok', result)
        self.assertTrue(all(f < end for f in asked))

    def test_the_palettes_own_close_card_is_not_a_plain_band(self):
        # Fri 20 Nov: the guard refused the flat ink close the brand palette requires (config/brand-palette.json closes).
        props = props_with([{'fromFrame': 90, 'toFrame': 150, 'words': [{'text': 'which', 'atFrame': 90}, {'text': 'habits', 'atFrame': 100}], 'swipeIndex': 1}])
        end = props['durationFrames']
        close_from = end - 54
        props['beats'][-1]['toFrame'] = end
        good = screen_frame(content_bottom=900, below='ui', cream_box=(70, 1100, 800, 200))
        ink = np.full((H, W, 3), 12, np.uint8)
        asked = []
        def grab(path, f, fps, size):
            asked.append(f)
            return ink if f >= close_from else good
        props['ending'] = {'fromFrame': close_from}
        result = pf.check_frames('x.mp4', props, grab=grab)
        self.assertTrue(any(f >= close_from for f in asked), 'the close must be sampled for the test to mean anything')
        self.assertIs(result['pass'], True, result)
        # the same ink before the close is still refused
        props['ending'] = {'fromFrame': end}
        refused = pf.check_frames('x.mp4', props, grab=lambda path, f, fps, size: ink if f >= close_from else good)
        self.assertIs(refused['pass'], False)
        self.assertEqual({p['check'] for p in refused['problems']}, {'plain_dark'})


def real_clip(path, colour, seconds=10):
    subprocess.run([ffmpeg(), '-y', '-v', 'error', '-f', 'lavfi', '-i', f'color=c={colour}:s=1080x1920:d={seconds}:r=30', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', str(path)], check=True)


class CompareWithApproved(unittest.TestCase):
    """ve proof: the approved proof is kept, a sheet of the same moments is written when the engine or an asset changed, and
    the proof is not sendable until the session records what it compared."""

    def setUp(self):
        import ve_proof_test as t  # noqa: PLC0415
        self.t = t
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / 've'
        self.dir.mkdir()
        t.guards.freeze(self.dir, now=t.FROZEN_BEFORE_THE_FLOOR)  # the real lock, so ve proof stays on this engine
        self.spec = copy.deepcopy(t.FIXTURE)
        self.write_spec(self.spec)
        (self.dir / f'props.{t.CUT}.json').write_text(json.dumps(props_with(t.props_for(self.spec)['captions'])), encoding='utf-8')

    def tearDown(self):
        self.tmp.cleanup()

    def write_spec(self, spec):
        (self.dir / 'spec.json').write_text(json.dumps(spec), encoding='utf-8')

    def args(self, **extra):
        return types.SimpleNamespace(spec=str(self.dir / 'spec.json'), cut=self.t.CUT, beat='b2-key', props=None, assets_dir=None,
                                     scale=1.0, no_qc=True, **extra)

    def render(self, colour):
        def go(props_path, out):
            Path(out).parent.mkdir(parents=True, exist_ok=True)
            real_clip(out, colour)
        return go

    def run_proof(self, colour='black', frames_pass=True, **extra):
        found = {'pass': frames_pass, 'status': 'ok', 'frames': 9,
                 'problems': [] if frames_pass else [{'check': 'plain_dark', 'says': 'beat b3, frame 220: a plain dark band, rows 1340 to 1920 (580 px), no detail'}]}
        with mock.patch.object(pf, 'check_frames', return_value=found):
            return ve.cmd_proof(self.args(**extra), render_fn=self.render(colour))

    def record(self):
        return json.loads((self.dir / 'proof' / f'{self.t.CUT}.json').read_text(encoding='utf-8'))

    def test_failing_frames_make_it_not_sendable(self):
        self.assertEqual(self.run_proof(frames_pass=False), 1)
        self.assertIs(self.record()['sendable'], False)
        self.assertTrue(any('plain dark band' in r for r in proof.sendable_problems(self.record())))

    def test_nothing_changed_so_nothing_to_compare(self):
        self.assertEqual(self.run_proof('black'), 0)
        self.assertEqual(self.run_proof('gray'), 0)
        self.assertNotIn('compare', self.record())
        self.assertTrue((self.dir / 'proof' / 'history').is_dir(), 'the earlier proof is kept')

    def test_an_asset_changed_writes_the_sheet_and_blocks_until_compared(self):
        self.assertEqual(self.run_proof('black'), 0)
        changed = copy.deepcopy(self.spec)
        changed['assets'][0]['sha256'] = 'c' * 64  # a screen asset changed since the proof
        self.write_spec(changed)
        self.assertEqual(self.run_proof('gray'), 1, 'the new proof is not sendable')
        record = self.record()
        self.assertIsNone(record['compare']['compared'])
        self.assertIn('an asset changed', record['compare']['reasons'][0])
        sheet = self.dir / 'proof' / record['compare']['sheet']
        self.assertTrue(sheet.is_file() and sheet.stat().st_size > 2000)
        self.assertTrue(any('has not been compared' in r for r in proof.sendable_problems(record)))
        self.assertTrue(proof.problems(changed, self.t.CUT, self.dir, {}) , 've render waits too')
        # too few words: refused
        self.assertEqual(ve.cmd_proof(self.args(compared='looked fine')), 1)
        self.assertIsNone(self.record()['compare']['compared'])
        words = 'every beat change at full size beside the approved proof and his notes: captions clear of the screen, no plain black below'
        self.assertEqual(ve.cmd_proof(self.args(compared=words)), 0)
        record = self.record()
        self.assertEqual(record['compare']['compared']['text'], words)
        self.assertIs(record['sendable'], True)
        self.assertEqual(proof.sendable_problems(record), [])

    def test_the_engine_changing_also_asks_for_it(self):
        self.assertEqual(self.run_proof('black'), 0)
        with mock.patch('velib.guards.engine_sha', return_value='f' * 64):
            self.assertEqual(self.run_proof('gray'), 1)
        self.assertIn('the engine changed', self.record()['compare']['reasons'][0])

    def test_comparing_with_nothing_to_compare_is_refused(self):
        self.assertEqual(self.run_proof('black'), 0)
        self.assertEqual(ve.cmd_proof(self.args(compared='x ' * 20)), 1)

    def test_a_sheet_that_is_not_the_recorded_one_is_refused(self):
        self.assertEqual(self.run_proof('black'), 0)
        changed = copy.deepcopy(self.spec)
        changed['assets'][0]['sha256'] = 'd' * 64
        self.write_spec(changed)
        self.run_proof('gray')
        sheet = self.dir / 'proof' / self.record()['compare']['sheet']
        sheet.write_bytes(sheet.read_bytes() + b'0')
        self.assertEqual(ve.cmd_proof(self.args(compared='every beat at full size beside the approved proof and notes, all clear here')), 1)


class FrameSeekAtTheEnd(unittest.TestCase):
    """Tue 17 Nov: a seek at durationFrames - 1 read nothing, the empty read became not_run and held the show gate. The
    seek is clamped inside the clip, so the clip's last frame is read; a frame well past the end is still an error."""

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.clip = str(Path(cls.temp.name) / 'clip.mp4')
        subprocess.run([ffmpeg(), '-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=108x192:d=1:r=30', '-preset', 'ultrafast',
                        '-pix_fmt', 'yuv420p', cls.clip], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_the_last_frame_is_read(self):
        from velib.qc_faces import frame_at
        for frame in (29, 30):  # durationFrames - 1, and the frame a proof window ends on
            rgb = frame_at(self.clip, frame, 30, (108, 192))
            self.assertEqual(rgb.shape, (192, 108, 3))
            self.assertGreater(int(rgb[..., 0].mean()), 200)  # red: the clip's own frame, not a blank

    def test_a_frame_well_past_the_end_is_an_error(self):
        from velib.qc_faces import frame_at
        with self.assertRaises(ValueError):
            frame_at(self.clip, 300, 30, (108, 192))


if __name__ == '__main__':
    unittest.main()
