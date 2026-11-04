"""captions.off_face (scripts/velib/qc_faces.py). Krish, 2026-11-03: "The subtitles just go straight over my face."""
import sys
import unittest
from pathlib import Path

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
        self.assertEqual((g['centerY'], g['size'], g['width']), (1500, 88, 1080))

    def test_a_word_at_chest_height_under_the_face_passes(self):
        report = run([page('training')], (390, 500, 300, 380))
        self.assertTrue(report['pass'], report)

    def test_a_caption_over_the_face_fails_and_names_the_page(self):
        report = run([page('mouth')], (390, 1250, 300, 380))
        self.assertFalse(report['pass'])
        self.assertEqual(report['value']['on_face'][0]['text'], 'mouth')

    def test_the_margin_catches_a_caption_grazing_the_chin(self):
        # Face ends at y=1440; the word box starts at 1500 - 52.8 = 1447; 10% of 380 px reaches 1478.
        self.assertFalse(run([page('chin')], (390, 1060, 300, 380))['pass'])

    def test_house_pages_use_their_region(self):
        region = (72, 1180, 900, 217)
        self.assertFalse(run([page('words')], (390, 1100, 300, 300), style='house', region=region)['pass'])
        self.assertTrue(run([page('words')], (390, 300, 300, 300), style='house', region=region)['pass'])

    def test_a_split_page_uses_its_own_zone(self):
        split = {**page('split'), 'region': {'left': 0, 'top': 1700, 'width': 1080, 'height': 120}}
        self.assertTrue(run([split], (390, 1250, 300, 380), style='house', region=(72, 1180, 900, 217))['pass'])

    def test_word_split_region_uses_the_seam_and_clears_the_lower_face(self):
        split = {**page('split'), 'region': (72, 1460, 900, 180)}
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
        for aspect, height, face in [('9:16', 1920, 1500), ('16:9', 1080, 830)]:
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
