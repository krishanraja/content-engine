"""channel_safe (scripts/channel_safe.py): nothing a viewer must read sits under a channel's buttons.
Krish, 2026-11-03: "It looks cramped. It looks like you almost didn't design this thoughtfully for the format or the
channel." Zones: config/channel-safe-zones.json, measured on his phone for Instagram."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
sys.path.insert(0, str(ROOT / 'scripts'))
import channel_safe  # noqa: E402


class Zones(unittest.TestCase):
    def test_the_zone_table_is_never_looser_than_studio_config(self):
        # config/studio.json is bound into the signed media standard's hash, so its numbers change only with Krish;
        # the measured table may be stricter, never looser.
        table = channel_safe.load()
        studio = json.loads((ROOT / 'config/studio.json').read_text(encoding='utf-8'))
        platforms = next(v['platforms'] for v in studio.values() if isinstance(v, dict) and 'platforms' in v)
        for channel, spec in table['channels'].items():
            if channel not in platforms:
                continue   # instagram_profile and instagram_grid add to Instagram's row; studio.json has no such rows
            safe = platforms[channel]['safe_zones']
            boxes = [z['box'] for z in spec['zones']]
            top = max(b[3] for b in boxes if b[1] == 0)
            rail = max(b[2] for b in boxes if b[0] + b[2] == 1080 and b[0] > 540)
            bottom = max(1920 - b[1] for b in boxes if b[1] + b[3] == 1920 and b[1] > 960)
            self.assertGreaterEqual(top, safe['top_px'], channel)
            self.assertGreaterEqual(rail, safe['right_px'], channel)
            self.assertGreaterEqual(bottom, safe['bottom_px'], channel)

    def test_mondays_layout_fails_where_his_phone_showed_it(self):
        # Boxes read off his 3 Nov screenshot, in video pixels.
        hits = channel_safe.box_violations([('headline slab', (56, 66, 885, 305)),
                                            ('ladder graphic', (56, 1355, 890, 190)),
                                            ('caption', (260, 1190, 490, 85))])
        what = {(h['what'], h['channel']) for h in hits}
        self.assertIn(('headline slab', 'instagram_reels'), what)
        self.assertIn(('ladder graphic', 'instagram_reels'), what)
        self.assertNotIn(('caption', 'instagram_reels'), what)

    def test_a_reference_style_card_in_the_upper_half_is_clear(self):
        # Below Instagram's account row (270 px, 7 Nov) and above the rails.
        self.assertEqual(channel_safe.box_violations([('card', (60, 300, 800, 240))]), [])

    def test_quick_edit_caption_bands_clear_every_channel(self):
        # Krish, 2026-11-11: captions never "underneath the social app UI features".
        import advisory_qc
        hits = channel_safe.box_violations([(b, tuple(v)) for b, v in advisory_qc.CAPTION_BANDS['9x16'].items()])
        self.assertEqual(hits, [])

    def test_quick_edit_tall_panel_picture_clears_every_channel(self):
        import kit
        g = kit.panel_geometry('9x16')
        x, y, w, h = g['area']
        hits = channel_safe.box_violations([('tall panel picture', (x, y, w + kit.SHADOW_PX, h + kit.SHADOW_PX))])
        self.assertEqual(hits, [])
        self.assertLessEqual(y, 340)  # the picture starts at the top of the safe area, not a third of the way down


class VeRow(unittest.TestCase):
    def test_ve_counts_the_row_and_skips_whole_stage_beats(self):
        from velib import qc_channel
        layouts = {'9:16': {'STAGE': [(0, 0, 1080, 1920)], 'P1': [(60, 1400, 960, 300)]}}
        row = qc_channel.safe_zones([], [{'id': 'a', 'layout': 'STAGE', 'uses': ['x']}], '9:16', None, 'house', layouts)
        self.assertTrue(row['pass'])
        self.assertNotIn('status', row)
        row = qc_channel.safe_zones([], [{'id': 'b', 'layout': 'P1', 'uses': ['y']}], '9:16', None, 'house', layouts)
        self.assertFalse(row['pass'])
        self.assertNotIn('status', row)

    def test_ve_real_tall_layouts_and_word_title_clear_every_channel(self):
        from velib import qc_channel
        beats = [{'id': l, 'layout': l, 'uses': ['a', 'b', 'c']} for l in ('P1', 'P3', 'P6', 'F1', 'F3')]
        row = qc_channel.safe_zones([], beats, '9:16', None, 'word')
        self.assertTrue(row['pass'], row['value'])


class Frames(unittest.TestCase):
    def frame(self, temp):
        png = Path(temp) / 'frame.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1080x1920', '-frames:v', '1',
                        str(png)], check=True)
        return png

    def test_words_under_a_zone_fail_and_words_in_the_clear_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            png = self.frame(temp)
            under = lambda _p: [('GOING', 95.0, (100, 100, 300, 120))]
            clear = lambda _p: [('GOING', 95.0, (100, 700, 300, 120)), ('x', 99.0, (0, 0, 10, 10))]
            self.assertFalse(channel_safe.frame_violations(png, read=under)['pass'])
            self.assertTrue(channel_safe.frame_violations(png, read=clear)['pass'])

    def test_a_failing_reader_is_not_run_never_a_crash(self):
        with tempfile.TemporaryDirectory() as temp:
            png = self.frame(temp)

            def broken(_p):
                raise subprocess.CalledProcessError(1, ['tesseract'])
            result = channel_safe.frame_violations(png, read=broken)
            self.assertIsNone(result['pass'])
            self.assertEqual(result['status'], 'not_run')

    @unittest.skipUnless(shutil.which('tesseract'), 'tesseract is not installed here')
    def test_real_ocr_finds_a_headline_under_the_top_bar(self):
        with tempfile.TemporaryDirectory() as temp:
            png = Path(temp) / 'frame.png'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=1080x1920', '-vf',
                            "drawtext=text='THE BOTTOM RUNG':fontsize=110:fontcolor=black:x=60:y=60",
                            '-frames:v', '1', str(png)], check=True)
            result = channel_safe.frame_violations(png)
            self.assertFalse(result['pass'], result)


if __name__ == '__main__':
    unittest.main()


class InstagramProfile(unittest.TestCase):
    """Post-mortem of 2 Nov, cause D (Bugs & Issues, 7 Nov): the 6 Nov reel's cover lost its top line "USING A" to the
    profile grid's 3:4 crop, and its title sat under Instagram's account row. Krish, 7 Nov: "the thumbnails need to be
    managed better... the Chinese AI thumbnail is not really at the top of its game." """

    # The stage headline draws from y 220 on a 9:16 frame (apps/renderer/src/engine/devices/headline/index.tsx), two
    # lines of the house display face; the 6 Nov hook headline read USING A / CHINESE AI?.
    USING_A = ('USING', 95.0, (60, 222, 420, 150))

    def test_the_6_nov_cover_line_is_cut_by_the_grid_and_the_account_row(self):
        hits = channel_safe.box_violations([('USING A', self.USING_A[2])], 'cover_tall')
        zones = {h['zone'] for h in hits}
        self.assertIn('profile grid crop (top)', zones)
        self.assertIn('account row (reel opened from the profile)', zones)

    def test_a_word_crossing_the_grid_line_counts_even_when_mostly_inside(self):
        with tempfile.TemporaryDirectory() as temp:
            png = Frames().frame(temp)
            read = lambda _p: [self.USING_A]
            result = channel_safe.frame_violations(png, 'cover_tall', read=read)
            self.assertFalse(result['pass'])
            self.assertIn('profile grid crop (top)', {h['zone'] for h in result['value']['in_zones']})

    def test_a_cover_inside_the_grid_tile_and_below_the_row_is_clear(self):
        with tempfile.TemporaryDirectory() as temp:
            png = Frames().frame(temp)
            read = lambda _p: [('USING', 95.0, (60, 300, 420, 150)), ('CHINESE', 95.0, (60, 460, 600, 150))]
            self.assertTrue(channel_safe.frame_violations(png, 'cover_tall', read=read)['pass'])

    def test_the_grid_crop_is_the_middle_three_by_four(self):
        crop = [z for z in channel_safe.zones('cover_tall') if z['cut']]
        kept = 1920 - sum(z['box'][3] for z in crop)
        self.assertEqual(kept * 3, 1080 * 4)
        self.assertNotIn('instagram_grid', channel_safe.load()['shapes']['tall'])
