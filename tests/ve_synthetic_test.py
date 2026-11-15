"""ve lint's voice.synthetic row (INV-SYNTHETIC-OFF): no synthetic Krish voice or likeness in a spec without his approval
in krish-clone's registry, read live from krish-clone main; an unreadable registry refuses, never passes. The registry
read is stubbed in every test (no network), and every name, word and hash here is invented."""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
from velib import lint as ve_lint  # noqa: E402

FIXTURE = ROOT / 'fixtures/ve/my-test-19s/spec.json'
VOICE = {'name': 'krish-voice-1', 'kind': 'voice', 'platform': 'elevenlabs', 'approved_sha256': 'c' * 64,
         'approved_words': "test words, not Krish's", 'approved_on': '2026-11-20'}
LIKENESS = {**VOICE, 'name': 'krish-twin-1', 'kind': 'likeness', 'platform': 'heygen', 'approved_sha256': 'd' * 64}
VOICE_ASSET = {'id': 'cloned-vo', 'kind': 'recording', 'origin': 'generated', 'path': 'cloned-vo.wav', 'sha256': 'e' * 64,
               'licence': 'generated', 'tool': 'elevenlabs.voice_clone:krish-voice-1'}
LIKENESS_ASSET = {'id': 'twin-open', 'kind': 'broll', 'origin': 'generated', 'path': 'twin-open.mp4', 'sha256': 'f' * 64,
                  'licence': 'generated', 'tool': 'heygen.avatar:krish-twin-1'}


def registry(*entries) -> str:
    return json.dumps({'format': ve_lint.SYNTHETIC_FORMAT, 'approvals': list(entries)})


def approval(entry: dict) -> dict:
    return {'gate': 'synthetic', 'by': 'Krish', 'said': entry['approved_words'], 'on': entry['approved_on'],
            'artifact_hash': entry['approved_sha256']}


def served(text: str):
    return patch.object(ve_lint, 'fetch_synthetic_registry', return_value=text)


def unreachable():
    return patch.object(ve_lint, 'fetch_synthetic_registry', side_effect=RuntimeError('curl exited 6'))


class SyntheticVoiceOnTheFixture(unittest.TestCase):
    """The crew lints on the normalized fixture spec. The spec schema refuses a generated recording before any crew lint
    runs (see SyntheticThroughVeLint), so an honestly marked cloned voice is held to this row here."""

    @classmethod
    def setUpClass(cls):
        spec, problems = ve_lint.schema(FIXTURE)
        assert spec is not None, problems
        cls.spec = spec

    def spec_with(self, assets=(), approvals=()):
        spec = copy.deepcopy(self.spec)
        spec['assets'] += list(assets)
        spec['approvals'] += list(approvals)
        return spec

    def codes(self, spec):
        return [line.split(' ', 1)[0] for line in ve_lint.crew_lints(spec)]

    def test_the_fixture_is_clean_and_never_reads_the_registry(self):
        with unreachable() as fetch:
            self.assertEqual(ve_lint.crew_lints(self.spec), [])
        fetch.assert_not_called()

    def test_an_unregistered_synthetic_voice_is_refused(self):
        with served(registry()):
            self.assertEqual(self.codes(self.spec_with([VOICE_ASSET])), ['voice.synthetic'])
        with served(registry(VOICE)):  # registered, but the spec carries no approval of it
            self.assertEqual(self.codes(self.spec_with([VOICE_ASSET])), ['voice.synthetic'])

    def test_a_registered_synthetic_voice_passes(self):
        with served(registry(VOICE)):
            self.assertEqual(ve_lint.crew_lints(self.spec_with([VOICE_ASSET], [approval(VOICE)])), [])

    def test_an_unreadable_registry_refuses_never_passes(self):
        spec = self.spec_with([VOICE_ASSET], [approval(VOICE)])
        cases = {'unreachable': unreachable(), 'not JSON': served('<html>'),
                 'another format': served(json.dumps({'format': 'x/1', 'approvals': [VOICE]})),
                 'an incomplete entry': served(registry({**VOICE, 'approved_words': ''})),
                 'a short hash': served(registry({**VOICE, 'approved_sha256': 'c' * 63}))}
        for why, patcher in cases.items():
            with self.subTest(why), patcher:
                lines = ve_lint.crew_lints(spec)
                self.assertEqual([line.split(' ', 1)[0] for line in lines], ['voice.synthetic', 'voice.synthetic'], lines)

    def test_a_match_is_exact_and_current(self):
        cases = {
            'his words changed': (registry(VOICE), {**approval(VOICE), 'said': 'yes'}),
            'another date': (registry(VOICE), {**approval(VOICE), 'on': '2026-11-21'}),
            'another record': (registry(VOICE), {**approval(VOICE), 'artifact_hash': 'b' * 64}),
            'not by Krish': (registry(VOICE), {**approval(VOICE), 'by': 'Claude'}),
            'withdrawn': (registry({**VOICE, 'withdrawn': {'words': 'test: take it back', 'on': '2026-11-22'}}),
                          approval(VOICE)),
            'a likeness entry under the voice name': (registry({**VOICE, 'kind': 'likeness', 'platform': 'heygen'}),
                                                       approval(VOICE)),
        }
        for why, (text, given) in cases.items():
            with self.subTest(why), served(text):
                self.assertIn('voice.synthetic', self.codes(self.spec_with([VOICE_ASSET], [given])))

    def test_every_way_of_using_a_clone_is_caught(self):
        variants = {
            'no clone name': {**VOICE_ASSET, 'tool': 'elevenlabs.voice_clone'},
            'spaced words': {**VOICE_ASSET, 'tool': 'ElevenLabs voice clone:krish-voice-1'},
            'a lipsync': {**LIKENESS_ASSET, 'tool': 'heygen.lipsync:krish-twin-1'},
            'HeyGen footage with no capability named': {**LIKENESS_ASSET, 'tool': 'heygen'},
            'a generated recording from any tool': {**VOICE_ASSET, 'tool': 'some-speech-tool'},
            'a capability inside a clone name only': {**VOICE_ASSET, 'tool': 'elevenlabs.voice_clone:krish-avatar-1'},
        }
        with served(registry()):
            for why, asset in variants.items():
                with self.subTest(why):
                    self.assertEqual(self.codes(self.spec_with([asset])), ['voice.synthetic'])
        uses = ve_lint.synthetic_uses({'assets': [variants['a capability inside a clone name only']]})
        self.assertEqual((uses[0]['kind'], uses[0]['name']), ('voice', 'krish-avatar-1'))

    def test_a_clone_marked_as_a_capture_is_refused_even_when_approved(self):
        with served(registry(VOICE)):
            lines = ve_lint.crew_lints(self.spec_with([{**VOICE_ASSET, 'origin': 'capture'}], [approval(VOICE)]))
        self.assertEqual(len(lines), 1, lines)
        self.assertIn('never evidence', lines[0])

    def test_the_tools_allowed_slots_are_not_synthetic(self):
        sfx = {'id': 'whoosh', 'kind': 'sfx', 'origin': 'generated', 'path': 'whoosh.wav', 'sha256': '1' * 64,
               'licence': 'generated', 'tool': 'elevenlabs'}
        isolated = {'id': 'clean-take', 'kind': 'recording', 'origin': 'capture', 'path': 'take.wav', 'sha256': '2' * 64,
                    'licence': "Krish's own recording", 'tool': 'elevenlabs voice isolator'}
        with unreachable() as fetch:
            self.assertEqual(ve_lint.crew_lints(self.spec_with([sfx, isolated])), [])
        fetch.assert_not_called()

    def test_a_synthetic_approval_the_registry_does_not_hold_is_refused(self):
        with served(registry()):
            self.assertEqual(self.codes(self.spec_with([], [approval(VOICE)])), ['voice.synthetic'])


class SyntheticThroughVeLint(unittest.TestCase):
    """The whole ve lint, schema first, on the fixture spec written to disk."""

    def lint_codes(self, assets=(), approvals=()):
        spec = json.loads(FIXTURE.read_text(encoding='utf-8'))
        spec['assets'] += list(assets)
        spec['approvals'] += list(approvals)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'spec.json'
            path.write_text(json.dumps(spec), encoding='utf-8')
            _, problems = ve_lint.lint(path)
        return [p.split(' ', 1)[0] for p in problems]

    def test_a_likeness_is_refused_until_registered_then_passes(self):
        with served(registry()):
            self.assertEqual(self.lint_codes([LIKENESS_ASSET]), ['voice.synthetic'])
        with served(registry(LIKENESS)):
            self.assertEqual(self.lint_codes([LIKENESS_ASSET], [approval(LIKENESS)]), [])

    def test_an_unregistered_voice_marked_as_a_capture_is_refused(self):
        with served(registry()):
            self.assertEqual(self.lint_codes([{**VOICE_ASSET, 'origin': 'capture'}]), ['voice.synthetic'])

    def test_the_schema_still_refuses_a_generated_recording(self):
        """A cloned voice clip marked as a generated recording stops at the schema (generated media is never evidence),
        even when registered. His clone enters a spec only as an asset of kind voice, on an off-day voiceover short
        (Ruling, Krish, 2026-11-15; tests/ve_clone_voice_test.py)."""
        with served(registry(VOICE)):
            codes = self.lint_codes([VOICE_ASSET], [approval(VOICE)])
        self.assertIn('SCHEMA', codes)
        self.assertNotIn('voice.synthetic', codes)


class TheRegistryIsReadLive(unittest.TestCase):
    def test_the_address_is_krish_clone_main(self):
        self.assertEqual(ve_lint.SYNTHETIC_REGISTRY,
                         'https://raw.githubusercontent.com/krishanraja/krish-clone/main/config/synthetic-approvals.json')

    def test_the_read_is_curl_on_that_address_and_a_failure_raises(self):
        ok = subprocess.CompletedProcess(args=[], returncode=0, stdout=registry(VOICE), stderr='')
        with patch.object(ve_lint, 'run', return_value=ok) as run:
            self.assertEqual([e['name'] for e in ve_lint.read_synthetic_registry()], ['krish-voice-1'])
        self.assertEqual(run.call_args[0][0][0], 'curl')
        self.assertEqual(run.call_args[0][0][-1], ve_lint.SYNTHETIC_REGISTRY)
        failed = subprocess.CompletedProcess(args=[], returncode=22, stdout='', stderr='404')
        with patch.object(ve_lint, 'run', return_value=failed), self.assertRaises(RuntimeError):
            ve_lint.read_synthetic_registry()

    def test_the_lint_is_outside_the_engine_hash(self):
        """lint.py and the spec schema never change a cut's picture or sound, so the row lands without moving any piece's
        engine (config/ve/production-guards.json engine.paths)."""
        from velib import guards
        files = guards.engine_files()
        self.assertNotIn('scripts/velib/lint.py', files)
        self.assertFalse(any(name.startswith('packages/contracts/') for name in files))


if __name__ == '__main__':
    unittest.main()
