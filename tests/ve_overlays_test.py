"""Overlay capability ownership exercised through the real compiler."""
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.compile import compile_cut

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'
EXPECTED = {
    'headline': ['enter', 'exit'],
    'sticker': ['enter', 'exit'],
    'stamp': ['stamp', 'exit'],
    'stat_strip': ['enter', 'count_to', 'exit'],
    'marquee': ['enter', 'exit'],
}


class OverlayCapabilities(unittest.TestCase):
    def test_exact_registered_verbs_and_device_contract_files(self):
        registered = json.loads((ROOT / 'config/ve/devices.json').read_text())['devices']
        registry = (ROOT / 'apps/renderer/src/engine/devices/registry.ts').read_text()
        for device, verbs in EXPECTED.items():
            with self.subTest(device=device):
                self.assertEqual(registered[device]['verbs'], verbs)
                self.assertIn(f"from './{device}'", registry)
                for name in ('index.tsx', 'schema.ts', 'state.ts', 'fixture.json', 'device.test.ts'):
                    self.assertTrue((ROOT / 'apps/renderer/src/engine/devices' / device / name).is_file())

    def test_compile_checks_each_verb_for_each_overlay(self):
        words = [dict(w, end_s=w['onset_s'] + 0.2)
                 for w in json.loads((FIXTURE / 'words.frames.json').read_text())]
        all_verbs = {'enter', 'exit', 'stamp', 'count_to', 'move', 'mark', 'fill', 'highlight', 'carry', 'draw'}
        for device, supported in EXPECTED.items():
            for verb in sorted(all_verbs):
                with self.subTest(device=device, verb=verb):
                    spec = json.loads((FIXTURE / 'spec.json').read_text())
                    beats = spec['cuts']['proof-tall']['beats']
                    event = dict(beats[0]['events'][0], verb=verb)
                    for beat in beats:
                        beat['events'] = []
                    beats[0]['events'] = [event]
                    obj = next(o for o in spec['objects'] if o['obj'] == event['obj'])
                    obj['device'] = device
                    if verb in supported:
                        props = compile_cut(spec, 'proof-tall', words, FIXTURE)
                        self.assertEqual(props['events'][0]['verb'], verb)
                    else:
                        with self.assertRaisesRegex(ValueError, f'{device}.*does not draw verb {verb}'):
                            compile_cut(spec, 'proof-tall', words, FIXTURE)


if __name__ == '__main__':
    unittest.main()
