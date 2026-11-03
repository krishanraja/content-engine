"""Mark exclusion geometry and per-beat composition gate."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib import qc_composition as comp


class MarkClearanceTest(unittest.TestCase):
    def test_boundary_and_shadow_both_aspects(self):
        for aspect in ('9:16', '16:9'):
            x, y, w, h, shadow = comp.mark_box(aspect)
            self.assertGreater(comp.mark_clearance((x, y, w, h), aspect), 0)
            self.assertEqual(comp.mark_clearance((x, y + h + shadow + 24, w, 100), aspect), 0)
            self.assertEqual(comp.mark_clearance((x, y + h + shadow + 23, w, 100), aspect), 1)

    def test_overlapping_static_beat_fails(self):
        for aspect in ('9:16', '16:9'):
            props = {'aspect': aspect, 'beats': [dict(id='hit', layout='SPLIT' if aspect == '9:16' else 'P1',
                     fromFrame=0, toFrame=30, uses=['card'])],
                     'objects': [dict(obj='card', device='test', params={'place':
                                 dict(left=72, top=140, width=200, height=200)})]}
            # Wide has no explicit placement route; inject an overlapping resolved slot.
            with patch('velib.qc.inputs_from_props', return_value={'slots': {'mark-0': (72, 140, 200, 200)}}), \
                 patch.object(comp, '_frame', return_value=(None, 10)), \
                 patch.object(comp, 'measure', return_value={'pass': True, 'checks': {}, 'findings': []}):
                row = comp.composition_checks('unused', props, {'zones': {'caption': {}}})['beats']['hit']
            self.assertFalse(row['pass'])
            self.assertFalse(row['checks']['mark_clearance']['pass'])

    def test_real_slot_resolution(self):
        props = {'aspect': '9:16', 'beats': [dict(id='hit', layout='SPLIT', fromFrame=0, toFrame=30, uses=['card'])],
                 'objects': [dict(obj='card', device='test', params={'place':
                             dict(left=72, top=140, width=200, height=200)})]}
        self.assertFalse(comp.beat_mark_clearance(props, props['beats'][0])['pass'])
        props['objects'][0]['params']['place']['top'] = 400
        self.assertTrue(comp.beat_mark_clearance(props, props['beats'][0])['pass'])


if __name__ == '__main__':
    unittest.main()
