"""QC measures a caption theme by the band the renderer draws it in (captions/kit.ts REGIONS), not the word caption's
centred box: Tue 17's podcast captions were modelled 982 px wide under the channels' action rail while they drew
640 px from the left (18 Nov 2026)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib import qc  # noqa: E402


class ThemeBandTest(unittest.TestCase):
    def test_reads_the_renderers_bands(self):
        self.assertEqual(qc.theme_band('9:16', 'lower'), (70, 990, 800, 330))
        self.assertEqual(qc.theme_band('16:9', 'lower'), (192, 760, 1536, 266))

    def test_band_staging_has_its_own_caption_band(self):
        # Above his head on a tall cut, inside the graphics panel on a wide one (kit.ts STAGED_BAND).
        self.assertEqual(qc.theme_band('9:16', 'lower', staged=True), (70, 1010, 800, 160))
        self.assertEqual(qc.theme_band('16:9', 'lower', staged=True), (96, 850, 980, 190))

    def test_the_tall_lower_band_clears_every_action_rail(self):
        import channel_safe
        self.assertEqual(channel_safe.box_violations([('band', qc.theme_band('9:16', 'lower'))], 'tall'), [])


if __name__ == '__main__':
    unittest.main()
