"""The reference gate (scripts/velib/refgate.py): a cut is scored beside the inspiration-board cards its spec names,
and a cut that does not match its reference is never ready. Krish, 2026-11-03: "This video is a literal 1/10"."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import refgate, verdict  # noqa: E402
from velib.common import ffmpeg, sha256_file  # noqa: E402

JACK = {'card': 'instagram_DeZuQ7-lATg', 'for': ['look', 'motion'], 'drive_id': '1RgI6ypWidvR_0KbP0LM0igbUEbU-qkWe',
        'takeaway': 'product-UI cards at 80 to 90 percent width with glow'}
GEORGIA = {'card': 'instagram_DePHDr_jRed', 'for': ['captions'], 'drive_id': '1Fs7Mq2kiYyAMWgPkLApeMWcfSCBmGNH9',
           'takeaway': 'one word at a time, white, at chest height'}
SPEC = {'piece_id': 'p', 'publish_day': '2026-11-09', 'brand': {'references': [JACK, GEORGIA]}}


def clip(path: Path, colour: str, size: str) -> Path:
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={colour}:s={size}:d=2:r=30',
                    '-pix_fmt', 'yuv420p', str(path)], check=True)
    return path


def row(card, score, matches=True, note='matches the card width and glow closely'):
    return {'card': card, 'score': score, 'matches': matches, 'note': note}


class Required(unittest.TestCase):
    def test_new_pieces_are_held_and_in_flight_pieces_are_not(self):
        self.assertTrue(refgate.required({'brand': {}, 'publish_day': '2026-11-09'}))
        self.assertTrue(refgate.required({'brand': {}}))
        self.assertFalse(refgate.required({'brand': {}, 'publish_day': '2026-11-05'}))
        self.assertTrue(refgate.required({'brand': {'references': [JACK]}, 'publish_day': '2026-11-05'}))


class Scores(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        for ref in (JACK, GEORGIA):
            refgate.sheet_path(self.dir, 'short', ref['card']).write_bytes(b'x')
            refgate.stamp_path(self.dir, 'short', ref['card']).write_text('{"video_sha256": "%s"}' % ('c' * 64))
        real = refgate.scores_problems
        self.problems = lambda *a: real(*a, digest='c' * 64)
        refgate.scores_problems = self.problems
        self.addCleanup(setattr, refgate, 'scores_problems', real)

    def test_matching_scores_pass(self):
        self.assertEqual(refgate.scores_problems(SPEC, 'short', self.dir, [row(JACK['card'], 8), row(GEORGIA['card'], 9)]), [])

    def test_a_sheet_from_an_earlier_render_does_not_count(self):
        refgate.stamp_path(self.dir, 'short', JACK['card']).write_text('{"video_sha256": "%s"}' % ('d' * 64))
        found = refgate.scores_problems(SPEC, 'short', self.dir, [row(JACK['card'], 9), row(GEORGIA['card'], 9)])
        self.assertTrue(any('made from this file' in f for f in found), found)

    def test_a_low_score_fails_the_cut(self):
        found = refgate.scores_problems(SPEC, 'short', self.dir, [row(JACK['card'], 1, False, 'boxes in a corner, no glow'),
                                                                   row(GEORGIA['card'], 9)])
        self.assertEqual(len(found), 1)
        self.assertIn('does not match instagram_DeZuQ7-lATg (1/10', found[0])

    def test_matches_false_fails_even_with_a_high_score(self):
        self.assertTrue(refgate.scores_problems(SPEC, 'short', self.dir, [row(JACK['card'], 9, False), row(GEORGIA['card'], 9)]))

    def test_an_unscored_card_fails(self):
        found = refgate.scores_problems(SPEC, 'short', self.dir, [row(JACK['card'], 9)])
        self.assertEqual(found, ['Critic did not score the cut against instagram_DePHDr_jRed'])

    def test_no_sheet_fails(self):
        refgate.sheet_path(self.dir, 'short', JACK['card']).unlink()
        found = refgate.scores_problems(SPEC, 'short', self.dir, [row(JACK['card'], 9), row(GEORGIA['card'], 9)])
        self.assertTrue(any('no reference sheet' in f for f in found))

    def test_a_held_spec_without_references_fails(self):
        self.assertEqual(refgate.scores_problems({'brand': {}}, 'short', self.dir, None),
                         ['spec names no inspiration-board references (ve lint reference.required)'])

    def test_score_shape(self):
        self.assertEqual(refgate.score_errors([row('a', 8)]), [])
        self.assertTrue(refgate.score_errors([row('a', 11)]))
        self.assertTrue(refgate.score_errors([row('a', 8, note='ok')]))
        self.assertTrue(refgate.score_errors({'a': 1}))


class VerdictV2(unittest.TestCase):
    def base(self, **extra):
        value = {'schema': 've-verdict/2', 'piece': 'p', 'cut': 'short', 'sha256': 'a' * 64, 'reviewer': 'critic',
                 'reviewed_at': '2026-11-03T10:00:00+00:00', 'lens_sha256': 'b' * 64,
                 'frames_viewed': [{'at_s': 1.0}], 'findings': [], 'blocking': False,
                 'references': [row(JACK['card'], 8)]}
        value.update(extra)
        return value

    def test_v2_is_valid_and_v2_without_references_is_not(self):
        self.assertEqual(verdict.validate(self.base()), [])
        value = self.base()
        value.pop('references')
        self.assertEqual(verdict.validate(value), ['invalid verdict fields'])

    def test_v2_bad_score_is_invalid(self):
        self.assertTrue(verdict.validate(self.base(references=[row('a', -1)])))


class Sheets(unittest.TestCase):
    def test_cut_above_reference_at_the_same_fractions(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            cut = clip(temp / 'cut.mp4', 'red', '1080x1920')
            ref = clip(temp / f"{JACK['card']}.mp4", 'blue', '720x1280')
            spec = {'piece_id': 'p', 'brand': {'references': [JACK]}}
            with patch.dict('os.environ', {'MINDMAKE_REFERENCE_ROOT': str(temp)}):
                made = refgate.sheets(spec, 'short', temp, cut)
            self.assertEqual(made, [refgate.sheet_path(temp, 'short', JACK['card'])])
            try:
                from PIL import Image
            except ImportError:
                self.skipTest('Pillow is not installed here; the sheet was made')
            image = Image.open(made[0]).convert('RGB')
            w, h = refgate.TILE
            self.assertEqual(image.size, (w * len(refgate.FRACTIONS), h * 2))
            self.assertTrue(refgate.sheet_is_for(temp, 'short', JACK['card'], sha256_file(cut)))
            top, bottom = image.getpixel((w // 2, h // 2)), image.getpixel((w // 2, h + h // 2))
            self.assertGreater(top[0], 200)
            self.assertGreater(bottom[2], 200)

    def test_each_point_is_its_own_frame(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            clip_path = temp / 'ramp.mp4'
            subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x568:d=4:r=30', '-vf',
                            "format=yuv420p,geq=lum='min(255,64*T)':cb=128:cr=128", '-pix_fmt', 'yuv420p', str(clip_path)], check=True)
            row_png = temp / 'row.png'
            refgate._row(clip_path, 4.0, row_png)
            try:
                from PIL import Image
            except ImportError:
                self.skipTest('Pillow is not installed here')
            image = Image.open(row_png).convert('L')
            w, h = refgate.TILE
            levels = [image.getpixel((w * n + w // 2, h // 2)) for n in range(len(refgate.FRACTIONS))]
            self.assertEqual(levels, sorted(levels))
            self.assertEqual(len(set(levels)), len(levels), levels)

    def test_a_missing_reference_names_its_drive_id(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(refgate, 'CACHE', Path(temp)), \
                patch.dict('os.environ', {}, clear=False):
            with self.assertRaises(ValueError) as caught:
                refgate.resolve(JACK, fetch=lambda *_: None)
            self.assertIn(JACK['drive_id'], str(caught.exception))


if __name__ == '__main__':
    unittest.main()
