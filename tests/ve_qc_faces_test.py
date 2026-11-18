"""captions.off_face (scripts/velib/qc_faces.py). Krish, 2026-11-03: "The subtitles just go straight over my face."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc_faces  # noqa: E402

BLANK = np.zeros((1920, 1080, 3), np.uint8)


def page(word, start=0, end=20):
    return {'fromFrame': start, 'toFrame': end, 'words': [{'text': word, 'atFrame': start}]}


def run(pages, face, style='word', region=None):
    return qc_faces.off_face('cut.mp4', pages, style=style, aspect='9:16', region=region,
                             detector=lambda _rgb: [face] if face else [], grab=lambda _f: BLANK)


class OffFace(unittest.TestCase):
    def test_word_geometry_is_read_from_the_renderer(self):
        g = qc_faces.word_geometry('9:16')
        # On the chest, its box ending above y 1320 where Instagram's handle starts (Krish, 2026-11-11).
        self.assertEqual((g['centerY'], g['size'], g['width']), (1250, 88, 1080))

    def test_a_word_at_chest_height_under_the_face_passes(self):
        report = run([page('training')], (390, 500, 300, 380))
        self.assertTrue(report['pass'], report)

    def test_a_caption_over_the_face_fails_and_names_the_page(self):
        report = run([page('mouth')], (390, 1250, 300, 380))
        self.assertFalse(report['pass'])
        self.assertEqual(report['value']['on_face'][0]['text'], 'mouth')

    def test_the_margin_catches_a_caption_grazing_the_chin(self):
        # Face ends at y=1440; the word box (1250 - 52.8 = 1197 to 1303) sits on it, so it fails.
        self.assertFalse(run([page('chin')], (390, 1060, 300, 380))['pass'])

    def test_house_pages_use_their_region(self):
        region = (72, 1180, 900, 217)
        self.assertFalse(run([page('words')], (390, 1100, 300, 300), style='house', region=region)['pass'])
        self.assertTrue(run([page('words')], (390, 300, 300, 300), style='house', region=region)['pass'])

    def test_a_split_page_uses_its_own_zone(self):
        split = {**page('split'), 'region': {'left': 0, 'top': 1700, 'width': 1080, 'height': 120}}
        self.assertTrue(run([split], (390, 1250, 300, 380), style='house', region=(72, 1180, 900, 217))['pass'])

    def test_word_split_region_uses_the_seam_and_clears_the_lower_face(self):
        split = {**page('split'), 'region': (60, 670, 800, 180)}  # SPLIT_CAPTION_ZONE, on the seam
        g = qc_faces.word_geometry('9:16', 'SPLIT')
        self.assertEqual(g['centerY'], 760)
        self.assertEqual(qc_faces.caption_box(split, 'word', '9:16', None)[1],
                         int(g['centerY'] - g['size'] * 0.6))
        self.assertTrue(run([split], (390, 1190, 300, 389))['pass'])

    def test_custom_word_region_does_not_imply_split(self):
        custom = {**page('mouth'), 'region': (72, 1180, 900, 217)}
        self.assertFalse(run([custom], (390, 1250, 300, 380))['pass'])

    def test_word_positions_follow_the_beat_at_the_sampled_frame(self):
        beats = [
            {'fromFrame': 0, 'toFrame': 10, 'layout': 'F1', 'plate': {'source': 'take'}},
            {'fromFrame': 10, 'toFrame': 30, 'layout': 'SPLIT', 'plate': {'source': 'take'}},
        ]
        report = qc_faces.off_face('cut.mp4', [page('split', 0, 24)], style='word',
                                   beats=beats, detector=lambda _: [(390, 1190, 300, 389)],
                                   grab=lambda _: BLANK)
        self.assertTrue(report['pass'], report)

    def test_graphics_and_wide_face_geometry(self):
        for aspect, height, face in [('9:16', 1920, 1250), ('16:9', 1080, 830)]:
            self.assertEqual(qc_faces.word_geometry(aspect)['centerY'], face)
            self.assertAlmostEqual(qc_faces.word_geometry(aspect, 'STAGE', 'none')['centerY'], height * 0.66)

    def test_no_face_passes(self):
        self.assertTrue(run([page('graphics')], None)['pass'])

    def test_no_detector_is_not_run_never_pass(self):
        report = qc_faces.off_face('cut.mp4', [page('x')], detector=None, grab=lambda _f: BLANK) \
            if qc_faces.default_detector() is None else {'pass': None, 'status': 'not_run'}
        self.assertIsNone(report['pass'])
        self.assertEqual(report['status'], 'not_run')


if __name__ == '__main__':
    unittest.main()


SEAM = 760


def beat(layout='SPLIT', source='take', start=0, end=90, name='face'):
    return {'id': name, 'layout': layout, 'plate': {'source': source}, 'fromFrame': start, 'toFrame': end}


def head(beats, faces, detector=True, aspect='9:16'):
    """faces: one box, or a list of boxes (one per sample, in order), or None for no face in the frame."""
    seq = iter(faces if isinstance(faces, list) and faces and isinstance(faces[0], list) else [faces] * 99)
    det = (lambda _rgb: next(seq) if isinstance(faces, list) and faces and isinstance(faces[0], list)
           else ([faces] if faces else [])) if detector else None
    with patch.object(qc_faces, 'default_detector', lambda: None):
        return qc_faces.head_in_band('cut.mp4', beats, seam=SEAM, aspect=aspect, detector=det, grab=lambda _f: BLANK)


class HeadInBand(unittest.TestCase):
    """Krish, 2026-11-18, of a video that cut the top of his head off: "should not really need a reference image"."""

    def test_a_whole_head_inside_the_band_passes(self):
        # Face box 300 x 380 at y 900: the crown (900 - 0.35 * 380 = 767) is under the seam, the chin (900 + 410) above 1920.
        report = head([beat()], (390, 900, 300, 380))
        self.assertTrue(report['pass'], report)
        self.assertEqual(report['value']['count'], 0)

    def test_a_crown_above_the_seam_fails_and_says_by_how_much(self):
        report = head([beat()], (390, 700, 300, 380))   # crown 567: 193 px up into the stage
        self.assertFalse(report['pass'])
        cut = report['value']['cut'][0]
        self.assertEqual((cut['edge'], cut['by_px'], cut['band_top'], cut['beat']), ('crown', 193, SEAM, 'face'))

    def test_a_chin_off_the_bottom_of_the_frame_fails(self):
        report = head([beat()], (390, 1700, 300, 380))   # chin 1700 + 410 = 2110
        self.assertFalse(report['pass'])
        self.assertEqual({c['edge'] for c in report['value']['cut']}, {'chin'})

    def test_a_head_that_moves_up_late_in_the_beat_is_caught(self):
        fits, rises = [(390, 900, 300, 380)], [(390, 650, 300, 380)]
        report = head([beat()], [fits, fits, rises])    # the third sample
        self.assertFalse(report['pass'])
        self.assertEqual(report['value']['count'], 1)

    def test_a_beat_where_no_face_is_found_fails(self):
        report = head([beat()], None)                   # the crop may have cut the face out entirely
        self.assertFalse(report['pass'])
        self.assertEqual(report['value']['no_face_in_beat'], ['face'])

    def test_the_largest_face_is_his(self):
        report = head([beat()], [[(40, 100, 60, 70), (390, 900, 300, 380)]] * 3)   # a face in a photo on a wall
        self.assertTrue(report['pass'], report)

    def test_without_a_detector_it_is_not_run_never_a_pass(self):
        report = head([beat()], (390, 900, 300, 380), detector=False)
        self.assertEqual((report['status'], report['pass']), ('not_run', None))

    def test_only_split_take_beats_in_a_tall_cut_are_measured(self):
        for beats, aspect in (([beat('STAGE')], '9:16'), ([beat(source='none')], '9:16'), ([beat()], '16:9'), ([], '9:16')):
            with self.subTest(beats=beats, aspect=aspect):
                self.assertEqual(head(beats, (390, 100, 300, 380), aspect=aspect)['status'], 'not applicable')
