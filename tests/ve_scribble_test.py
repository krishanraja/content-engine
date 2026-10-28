"""Scribble compile capabilities and locked-format annotation limits."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.compile import compile_cut
from velib.lint import crew_lints

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'


class ScribbleTest(unittest.TestCase):
    def setUp(self):
        self.spec = json.loads((FIXTURE / 'spec.json').read_text(encoding='utf-8'))
        self.words = [dict(w, end_s=w['onset_s'] + 0.2)
                      for w in json.loads((FIXTURE / 'words.frames.json').read_text(encoding='utf-8'))]

    def annotation(self, device='scribble', verb='draw'):
        beat = self.spec['cuts']['proof-tall']['beats'][0]
        event = beat['events'][0]
        obj = next(o for o in self.spec['objects'] if o['obj'] == event['obj'])
        obj['device'] = device
        obj['params'] = dict(shape='loop', target=dict(x=300, y=400, w=400, h=200), colour='mint', seed='proof')
        # Remove later verbs on this object, so this test isolates its first event.
        for b in self.spec['cuts']['proof-tall']['beats']:
            b['events'] = [e for e in b['events'] if e is event or e['obj'] != obj['obj']]
        event['verb'] = verb
        return obj

    def test_compile_draw(self):
        self.annotation()
        props = compile_cut(self.spec, 'proof-tall', self.words, FIXTURE)
        self.assertEqual(props['events'][0]['verb'], 'draw')
        self.assertTrue(any(o['device'] == 'scribble' for o in props['objects']))

    def test_compile_refuses_count_to_on_scribble(self):
        self.annotation(verb='count_to')
        with self.assertRaisesRegex(ValueError, 'scribble.*count_to'):
            compile_cut(self.spec, 'proof-tall', self.words, FIXTURE)

    def test_compile_refuses_draw_on_grid(self):
        self.annotation(device='test_grid')
        with self.assertRaisesRegex(ValueError, 'test_grid.*draw'):
            compile_cut(self.spec, 'proof-tall', self.words, FIXTURE)

    def test_first_draw_is_scribble_only(self):
        obj = self.annotation()
        self.assertFalse(any('motion.enters' in f and obj['obj'] in f for f in crew_lints(self.spec)))
        obj['device'] = 'test_grid'
        self.assertTrue(any('motion.enters' in f and obj['obj'] in f for f in crew_lints(self.spec)))

    def test_locked_format_scribble_limit(self):
        first = self.annotation()
        second = copy.deepcopy(first)
        second['obj'] = 'second-annotation'
        self.spec['objects'].append(second)
        self.spec['format'] = 'hand-held-screen'
        beat = self.spec['cuts']['proof-tall']['beats'][0]
        beat['uses'].append(second['obj'])
        self.assertTrue(any('uses 2 scribbles' in f for f in crew_lints(self.spec)))
        # Other pending devices are separate cards; do not suppress them in production.
        with patch('velib.lint.pending_devices_error', return_value=None):
            findings = crew_lints(self.spec)
            self.assertTrue(any(f'beat {beat["id"]} uses 2 scribbles, the design lock allows 1' in f for f in findings))
            beat['uses'].remove(second['obj'])
            self.assertFalse(any('scribbles_per_beat' in f for f in crew_lints(self.spec)))
            beat['uses'].remove(first['obj'])
            self.assertFalse(any('scribbles_per_beat' in f for f in crew_lints(self.spec)))


if __name__ == '__main__':
    unittest.main()
