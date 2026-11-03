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
        self.assertEqual(channel_safe.box_violations([('card', (60, 260, 800, 240))]), [])

    def test_quick_edit_caption_bands_are_measured(self):
        import advisory_qc
        hits = channel_safe.box_violations([(b, tuple(v)) for b, v in advisory_qc.CAPTION_BANDS['9x16'].items()])
        self.assertTrue(all(h['zone'].startswith('action rail') for h in hits), hits)


class VeRow(unittest.TestCase):
    def test_ve_lists_but_does_not_yet_count_the_row_and_skips_whole_stage_beats(self):
        from velib import qc_channel
        layouts = {'9:16': {'STAGE': [(0, 0, 1080, 1920)], 'P1': [(60, 1400, 960, 300)]}}
        row = qc_channel.safe_zones([], [{'id': 'a', 'layout': 'STAGE', 'uses': ['x']}], '9:16', None, 'house', layouts)
        self.assertEqual((row['pass'], row['status']), (True, 'advisory'))
        row = qc_channel.safe_zones([], [{'id': 'b', 'layout': 'P1', 'uses': ['y']}], '9:16', None, 'house', layouts)
        self.assertFalse(row['pass'])
        self.assertEqual(row['status'], 'advisory')


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
