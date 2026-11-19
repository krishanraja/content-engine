"""A proof window's frame guards read it whole (Tue 17, 19 Nov 2026: every beat proof was refused with "Cue dc-0 has
no unique beat slot", because the window carries the block's earlier states onto frame 0 under a beat that does not
use it)."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib import proof, qc  # noqa: E402

PROPS = ROOT / 'docs/plans/b019dbf8-8051-4cab-9b5e-2ad77b3f5118/ve/props.short.json'


class ProofWindowFrames(unittest.TestCase):
    def test_carried_states_are_not_drawn_moments(self):
        props = json.loads(PROPS.read_text(encoding='utf-8'))
        beat = next(b for b in props['beats'] if b['id'] == 'meta')
        start, end = proof.window(props, beat['id'])
        windowed = proof.window_props(props, start, end)
        carried = [e for e in windowed['events'] if e['atFrame'] == 0 and e['obj'] == 'block']
        self.assertTrue(carried, 'the window carries the block in at frame 0')
        view = qc.inputs_from_props(windowed)
        self.assertNotIn('dc-0', view['slots'])

    def test_a_cue_with_no_beat_still_fails(self):
        props = json.loads(PROPS.read_text(encoding='utf-8'))
        props['events'] = [*props['events'], {'id': 'stray-0', 'obj': 'nobody', 'verb': 'enter', 'toState': 'pin',
                                               'atFrame': 10}]
        with self.assertRaises(ValueError):
            qc.inputs_from_props(props)


if __name__ == '__main__':
    unittest.main()
