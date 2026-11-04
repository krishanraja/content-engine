"""QC crops follow the renderer geometry for each caption page's starting beat."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib import qc, qc_faces, qc_captions, qc_gates


def props():
    return {'aspect': '9:16', 'captionStyle': 'word', 'events': [],
            'audio': {'stem': {'src': 'audio.wav'}}, 'brand': {'mark': {'src': 'mark.png'}},
            'beats': [{'fromFrame': i * 30, 'toFrame': (i + 1) * 30, 'uses': [],
                       'layout': layout, 'plate': {'source': source}}
                      for i, (layout, source) in enumerate([('SPLIT', 'take'), ('F1', 'take'), ('STAGE', 'none')])],
            'captions': [{'fromFrame': i * 30, 'toFrame': i * 30 + 20,
                          'words': [{'text': 'hello', 'atFrame': i * 30}]} for i in range(3)]}


class CaptionRegions(unittest.TestCase):
    def test_both_ocr_paths_read_each_padded_box(self):
        original = props()
        inputs = qc.inputs_from_props(original)
        pages, region = inputs['pages'], inputs['region']
        boxes = [p['region'] for p in pages]
        self.assertEqual(len(set(boxes)), 3)
        self.assertTrue(all('region' not in p for p in original['captions']))
        for page, beat, box in zip(pages, original['beats'], boxes):
            x, y, w, h = qc_faces.caption_box(page, 'word', '9:16', region,
                                            layout=beat['layout'], plate=beat['plate']['source'])
            self.assertEqual(box, (x - 12, y - 12, w + 24, h + 24))
        with patch.object(qc_captions.shutil, 'which', return_value='tesseract'), \
             patch.object(qc_captions, 'gray_frames', side_effect=lambda v, a, b, r: np.zeros((1, r[3], r[2]))) as grab, \
             patch.object(qc_captions, '_read_candidates', return_value={'text': 'hello', 'agreement': 1}):
            self.assertTrue(qc_captions.ocr('cut.mp4', pages, region)['pass'])
            self.assertEqual([c.args[3] for c in grab.call_args_list], boxes)
        _, captions, *_ = qc_gates._cutgates()
        with patch.object(captions, 'tesseract_reader', return_value=lambda f, text: {'text': text, 'score': 1}) as reader, \
             patch.object(captions, 'page_changes', return_value=[0, 30, 60]):
            self.assertTrue(qc_gates.captions_render('cut.mp4', pages, region)['pass'])
            self.assertEqual([c.args[1] for c in reader.call_args_list], boxes)

    def test_region_uses_starting_beat_even_when_sample_is_in_next_beat(self):
        p = props()
        p['captions'] = [dict(p['captions'][0], toFrame=80)]
        box = qc.inputs_from_props(p)['pages'][0]['region']
        self.assertEqual(box, qc.inputs_from_props(props())['pages'][0]['region'])

    def test_plate_none_counts_as_checked_without_running_detector(self):
        p = props()
        detector = unittest.mock.Mock(return_value=[(0, 0, 1080, 1920)])
        report = qc_faces.off_face('cut.mp4', p['captions'][2:], style='word', beats=p['beats'], detector=detector)
        self.assertTrue(report['pass'])
        self.assertEqual(report['value'], {'pages': 1, 'on_face': [], 'count': 0})
        detector.assert_not_called()

    def test_take_still_detects_overlap(self):
        p = props()
        report = qc_faces.off_face('cut.mp4', p['captions'], style='word', beats=p['beats'],
                                   detector=lambda _: [(0, 0, 1080, 1920)], grab=lambda _: None)
        self.assertEqual(report['value']['count'], 2)
        self.assertEqual(report['value']['pages'], 3)


if __name__ == '__main__':
    unittest.main()
