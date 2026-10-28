"""Thread device registration and actual compiler verb dispatch acceptance."""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.compile import compile_cut

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'
VERBS = ['enter', 'mark', 'stamp', 'exit']


class ThreadCompileTest(unittest.TestCase):
    def setUp(self):
        self.spec = json.loads((FIXTURE / 'spec.json').read_text(encoding='utf-8'))
        self.words = [dict(word, end_s=word['onset_s'] + 0.2)
                      for word in json.loads((FIXTURE / 'words.frames.json').read_text(encoding='utf-8'))]
        self.device_fixture = json.loads((ROOT / 'apps/renderer/src/engine/devices/thread_card/fixture.json').read_text(encoding='utf-8'))

    def with_event(self, verb, device='thread_card'):
        spec = copy.deepcopy(self.spec)
        cut = spec['cuts']['proof-tall']
        obj = spec['objects'][0]
        obj['device'] = device
        obj['params'] = self.device_fixture['objects'][0]['params']
        # Keep timing/media/caption contracts real, isolate the device dispatch.
        for beat in cut['beats']:
            beat['events'] = []
        beat = cut['beats'][0]
        beat['events'] = [{'obj': obj['obj'], 'verb': verb, 'at_w': beat['span']['from_w'],
                           'to_state': 'deepseek:second' if verb == 'mark' else 'deepseek:ANSWER DELETED'}]
        return spec

    def test_registration_has_exactly_four_verbs(self):
        registry = json.loads((ROOT / 'config/ve/devices.json').read_text(encoding='utf-8'))['devices']
        self.assertEqual(registry['thread_card']['verbs'], VERBS)
        source = (ROOT / 'apps/renderer/src/engine/devices/registry.ts').read_text(encoding='utf-8')
        self.assertIn("from './thread_card'", source)
        self.assertIn('thread_card: ThreadCard', source)

    def test_compiler_accepts_all_four_thread_verbs_and_preserves_params(self):
        for verb in VERBS:
            with self.subTest(verb=verb):
                props = compile_cut(self.with_event(verb), 'proof-tall', self.words, FIXTURE)
                self.assertEqual(props['events'][0]['verb'], verb)
                obj = next(obj for obj in props['objects'] if obj['device'] == 'thread_card')
                self.assertEqual(obj['params'], self.device_fixture['objects'][0]['params'])

    def test_thread_rejects_every_other_engine_verb(self):
        for verb in ['fill', 'count_to', 'highlight', 'carry']:
            with self.subTest(verb=verb), self.assertRaisesRegex(ValueError, f'thread_card.*{verb}'):
                compile_cut(self.with_event(verb), 'proof-tall', self.words, FIXTURE)

    def test_thread_registration_does_not_expand_other_devices(self):
        for device in ['query_chip', 'kinetic_stat']:
            for verb in ['mark', 'stamp']:
                with self.subTest(device=device, verb=verb), self.assertRaisesRegex(ValueError, f'{device}.*{verb}'):
                    compile_cut(self.with_event(verb, device), 'proof-tall', self.words, FIXTURE)


if __name__ == '__main__':
    unittest.main()
