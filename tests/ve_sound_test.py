"""Approved sound ingredients follow the renderer's picture clock."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import sfx  # noqa: E402
from velib.compile import compile_cut, sound_props  # noqa: E402
from velib.lint import crew_lints  # noqa: E402

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'


class SoundTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.assets = Path(self.temp.name)
        (self.assets / 'sfx').mkdir()
        rows = []
        for sid in ('whoosh', 'impact'):
            data = sid.encode()
            (self.assets / 'sfx' / f'{sid}.wav').write_bytes(data)
            rows.append({'id': sid, 'file': f'sfx/{sid}.wav', 'sha256': hashlib.sha256(data).hexdigest(),
                         'approved_by': 'Krish', 'approval_words': 'Approved test fixture'})
        approved = self.assets / 'approved.json'
        approved.write_text(json.dumps({'approved': rows}))
        self.patch = patch.object(sfx, 'APPROVED', approved)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.spec = {'style': {'sound': {'handover': 'whoosh', 'hit': 'impact', 'reason': 'Mark picture changes'},
                               'camera': {'move': 'phased', 'hits': True, 'reason': 'Mark hits'}}}

    def place(self, beats=(0, 30, 60), events=(15, 45), existing=()):
        props = {'beats': [{'fromFrame': f} for f in beats],
                 'events': [{'atFrame': f} for f in events], 'audio': {'sfx': list(existing)}}
        before = copy.deepcopy(props)
        result = sound_props(self.spec, props, self.assets)
        self.assertEqual(props, before)
        return result

    def test_placement_lead_paths_and_default_gains(self):
        cues = self.place()
        self.assertEqual([(c['atFrame'], c['gainDb']) for c in cues], [(14, -12), (29, -14), (44, -12), (59, -14)])
        self.assertEqual([c['src'] for c in cues],
                         [str(self.assets / 'sfx' / f'{sid}.wav') for sid in ('impact', 'whoosh', 'impact', 'whoosh')])

    def test_zero_clamp_and_no_handover_on_first_beat(self):
        self.assertEqual([c['atFrame'] for c in self.place(beats=(0,), events=(0,))], [0])
        self.assertEqual(self.place(beats=(0,), events=()), [])

    def test_spacing_drops_later_cues_and_allows_six_frames(self):
        cues = self.place(beats=(0, 10, 15, 16, 40), events=(10, 13, 16, 21, 22, 27))
        self.assertEqual([c['atFrame'] for c in cues], [9, 15, 26, 39])
        self.assertTrue(cues[0]['src'].endswith('whoosh.wav'))
        self.assertTrue(cues[1]['src'].endswith('whoosh.wav'))

    def test_hit_frames_deduplicate_before_sound_spacing(self):
        # Renderer picks 10 and 15, so 16 cannot sneak through sound spacing.
        cues = self.place(beats=(0,), events=(16, 10, 12, 15, 10))
        self.assertEqual([c['atFrame'] for c in cues], [9])

    def test_camera_hit_switch_and_individual_roles(self):
        self.spec['style']['camera']['hits'] = False
        self.assertEqual([c['atFrame'] for c in self.place()], [29, 59])
        self.spec['style']['camera']['hits'] = True
        del self.spec['style']['sound']['handover']
        self.assertEqual([c['atFrame'] for c in self.place(events=(30,))], [29])
        del self.spec['style']['camera']['hits']
        self.assertEqual([c['atFrame'] for c in self.place(events=(30,))], [29])
        self.spec['style'].pop('camera')
        self.assertEqual(self.place(), [])

    def test_explicit_gain_and_existing_cues_obey_spacing(self):
        self.spec['style']['sound']['gainDb'] = -20
        cues = self.place(beats=(0, 30), events=(15,),
                          existing=({'src': 'explicit.wav', 'atFrame': 12, 'gainDb': -8},))
        self.assertEqual([(c['atFrame'], c['gainDb']) for c in cues], [(12, -8), (29, -20)])

    def test_bad_gain_and_unknown_ids_are_refused(self):
        for gain in (1, True, float('inf'), float('nan')):
            self.spec['style']['sound']['gainDb'] = gain
            with self.assertRaisesRegex(ValueError, 'gainDb'):
                self.place()
        del self.spec['style']['sound']['gainDb']
        self.spec['style']['sound']['hit'] = 'unapproved-impact'
        with self.assertRaisesRegex(ValueError, 'unapproved-impact'):
            self.place(events=())

    def test_compile_and_lint_refuse_unknown_id_by_name(self):
        spec = json.loads((FIXTURE / 'spec.json').read_text())
        spec.setdefault('style', {})['sound'] = {'hit': 'not-approved', 'reason': 'test'}
        self.assertTrue(any('not-approved' in p for p in crew_lints(spec)))
        words = [dict(w, end_s=w['onset_s'] + .2)
                 for w in json.loads((FIXTURE / 'words.frames.json').read_text())]
        with self.assertRaisesRegex(ValueError, 'not-approved'):
            compile_cut(spec, 'proof-tall', words, self.assets)

    def test_compile_places_on_compiled_beat_and_event_frames(self):
        spec = json.loads((FIXTURE / 'spec.json').read_text())
        spec.setdefault('style', {}).update(self.spec['style'])
        words = [dict(w, end_s=w['onset_s'] + .2)
                 for w in json.loads((FIXTURE / 'words.frames.json').read_text())]
        props = compile_cut(spec, 'proof-tall', words, self.assets)
        self.assertTrue(props['audio']['sfx'])
        picture = {b['fromFrame'] for b in props['beats'][1:]} | {e['atFrame'] for e in props['events']}
        expected = {max(0, f - 1) for f in picture}
        self.assertTrue(all(c['atFrame'] in expected for c in props['audio']['sfx']))

    def test_changed_approved_bytes_are_refused(self):
        (self.assets / 'sfx/whoosh.wav').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'sha256 differs'):
            self.place()


if __name__ == '__main__':
    unittest.main()
