"""A piece's music turned down by ear (Krish, 2026-11-18: "Aspire, but turn the volume down 15%."): the spec's
audio.bed.trim_db moves every house level the premix aims for, and never lifts one."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import ve  # noqa: E402

HOUSE = {'status': 'approved', 'intro_lufs': -16, 'bed_lufs': -31, 'outro_lufs': -18, 'final_integrated_lufs': -14}


class BedTrimTest(unittest.TestCase):
    def test_no_trim_keeps_the_house_levels(self):
        got = ve.bed_levels(HOUSE, {'ledger_id': 'aspire', 'mode': 'episode_bed'})
        self.assertEqual((got['intro_lufs'], got['bed_lufs'], got['outro_lufs'], got['chapter_lufs']), (-16, -31, -18, -22))
        self.assertEqual(got['final_integrated_lufs'], -14)

    def test_fifteen_percent_down_moves_every_music_level(self):
        got = ve.bed_levels(HOUSE, {'ledger_id': 'aspire', 'mode': 'episode_bed', 'trim_db': -1.41})
        self.assertEqual((got['intro_lufs'], got['bed_lufs'], got['outro_lufs'], got['chapter_lufs']),
                         (-17.41, -32.41, -19.41, -23.41))
        self.assertEqual(got['final_integrated_lufs'], -14, 'the master target is not the music')
        self.assertEqual(HOUSE['bed_lufs'], -31, 'the ledger itself is never changed')

    def test_a_bed_is_never_turned_up(self):
        with self.assertRaises(ValueError):
            ve.bed_levels(HOUSE, {'ledger_id': 'aspire', 'mode': 'episode_bed', 'trim_db': 1.0})


if __name__ == '__main__':
    unittest.main()
