import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import music  # noqa: E402


class MusicUseTest(unittest.TestCase):
    """Ruling (Krish, 2026-11-04): Goodie Bags is the off-day track; "Do not change Monday, Wednesday, or Friday music"."""

    def ledger(self):
        data = json.loads((ROOT / 'config/music-library.json').read_text(encoding='utf-8'))
        series = next(t for t in data['tracks'] if t['id'] == 'no-curves-instrumental')
        off = copy.deepcopy(series)
        off.update({'id': 'goodie-bags', 'for': 'off-day', 'file': 'ES_Goodie Bags - Dylan Sitts.mp3', 'sha256': 'x' * 64})
        data['tracks'] = [series, off]
        return data

    def test_series_pieces_never_rotate_onto_the_off_day_track(self):
        data = self.ledger()
        for piece in ('mon-1', 'wed-2', 'fri-3', '9a0c97af-f0d6-4d12-a7ce-773c622d4b67', 'anything'):
            track, _, _ = music.pick_for_piece(piece, data=data)
            self.assertEqual(track['id'], 'no-curves-instrumental', piece)

    def test_off_day_pieces_get_the_off_day_track(self):
        track, _, _ = music.pick_for_piece('thu-5', data=self.ledger(), use='off-day')
        self.assertEqual(track['id'], 'goodie-bags')

    def test_the_live_ledger_rotates_each_series_day_and_keeps_the_off_day_track(self):
        # Ruling (Krish, 2026-11-17): Monday, Wednesday and Friday music rotates week by week, replacing "Do not change
        # Monday, Wednesday, or Friday music" (2026-11-04). Each day has its own approved pool; no carousel or off-day
        # track is ever in a series day's rotation.
        data = json.loads((ROOT / 'config/music-library.json').read_text(encoding='utf-8'))
        pools = {day: sorted(t['id'] for t in data['tracks'] if t.get('status') == 'approved' and day in (t.get('days') or []))
                 for day in music.SERIES_DAYS}
        self.assertEqual(pools, {'mon': ['liberty-city', 'no-curves-instrumental'], 'wed': ['mind-bender', 'seize-it'],
                                 'fri': ['conclusion', 'drifting-valleys', 'just-got-real']})
        for t in data['tracks']:
            if t.get('days'):
                self.assertNotIn(t.get('for'), ('off-day', 'carousel'), t['id'])
        self.assertEqual({t['id'] for t in music.day_pool(data, '2026-11-23')}, set(pools['mon']))
        goodie = next(t for t in data['tracks'] if t['id'] == 'goodie-bags')
        self.assertEqual(goodie['for'], 'off-day')



class FetchBehindMain(unittest.TestCase):
    """Audit ve-11: a checkout behind main stops the music fetch with a plain "pull main", before any download."""

    def test_a_checkout_behind_main_is_told_to_pull(self):
        import tempfile  # noqa: PLC0415
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(music.MusicError, r'3 commits behind main on the music ledger.*pull main'):
                music.cmd_fetch({'tracks': []}, tmp, out=lambda _l: None, behind=lambda: 3)

    def test_behind_main_reads_git_and_says_none_when_it_cannot(self):
        class Done:
            stdout = '2\n'
        self.assertEqual(music.behind_main(run=lambda *a, **k: Done()), 2)

        def broken(*_a, **_k):
            raise OSError('no git')
        self.assertIsNone(music.behind_main(run=broken))


if __name__ == '__main__':
    unittest.main()
