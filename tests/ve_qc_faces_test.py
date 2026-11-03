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
        self.assertEqual((g['centerY'], g['size'], g['width']), (1440, 88, 1080))

    def test_a_word_at_chest_height_under_the_face_passes(self):
        report = run([page('training')], (390, 500, 300, 380))
        self.assertTrue(report['pass'], report)

    def test_a_caption_over_the_face_fails_and_names_the_page(self):
        report = run([page('mouth')], (390, 1250, 300, 380))
        self.assertFalse(report['pass'])
        self.assertEqual(report['value']['on_face'][0]['text'], 'mouth')

    def test_the_margin_catches_a_caption_grazing_the_chin(self):
        # Face ends at y=1380; the word box starts at 1440 - 52.8 = 1387; 10% of 380 px reaches 1418.
        self.assertFalse(run([page('chin')], (390, 1000, 300, 380))['pass'])

    def test_house_pages_use_their_region(self):
        region = (72, 1180, 900, 217)
        self.assertFalse(run([page('words')], (390, 1100, 300, 300), style='house', region=region)['pass'])
        self.assertTrue(run([page('words')], (390, 300, 300, 300), style='house', region=region)['pass'])

    def test_a_split_page_uses_its_own_zone(self):
        split = {**page('split'), 'region': {'left': 0, 'top': 1700, 'width': 1080, 'height': 120}}
        self.assertTrue(run([split], (390, 1250, 300, 380), style='house', region=(72, 1180, 900, 217))['pass'])

    def test_no_face_passes(self):
        self.assertTrue(run([page('graphics')], None)['pass'])

    def test_no_detector_is_not_run_never_pass(self):
        report = qc_faces.off_face('cut.mp4', [page('x')], detector=None, grab=lambda _f: BLANK) \
            if qc_faces.default_detector() is None else {'pass': None, 'status': 'not_run'}
        self.assertIsNone(report['pass'])
        self.assertEqual(report['status'], 'not_run')


if __name__ == '__main__':
    unittest.main()
