"""The one voice check on the engine's words (Ruling, Krish, 2026-11-09).

Krish: "we need to make sure everything goes through the same voice system.
Absolutely everything." scripts/post-pack/voice_gate.py asks Control Center's
check through the engine's own route and keeps no list of its own. Synthetic
words and a stand-in engine only; no network.

Run: python3 tests/voice_gate_test.py (tests/control-plane/voice-check.test.ts runs it on every push).
"""
import json
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'scripts'))
import voice_gate  # noqa: E402


def stand_in(hard_on=()):
    calls = []

    def call(method, path, body, token, timeout=30):
        calls.append((method, path, body['channel']))
        hard = [{'rule': 'words', 'message': f'"{w}" is on the kill list.'} for w in hard_on if w in body['text']]
        return 200, json.dumps({'ok': True, 'checked': True, 'hard': hard})
    return call, calls


class VoiceGateTests(unittest.TestCase):
    def test_a_clean_file_passes_and_a_broken_one_is_named(self):
        call, calls = stand_in(['seamless'])
        lines = []
        self.assertEqual(voice_gate.run([('long.md', 'script', 'A plain line.')], call, 'k', lines.append), 0)
        self.assertEqual(voice_gate.run([('short.md', 'script', 'A seamless line.')], call, 'k', lines.append), 1)
        self.assertIn('"seamless" is on the kill list.', lines[-1])
        self.assertEqual(calls[0], ('POST', '/api/voice/check', 'script'))

    def test_not_checked_holds_and_is_never_a_pass(self):
        lines = []
        code = voice_gate.run([('a.md', 'article', 'Words.')], lambda *a, **k: (200, '{"ok": true, "checked": false}'), 'k', lines.append)
        self.assertEqual(code, 2)
        self.assertIn('NOT CHECKED', lines[0])
        self.assertEqual(voice_gate.run([('a.md', 'article', 'Words.')], lambda *a, **k: (502, 'bad'), 'k', lines.append), 2)

    def test_each_manifest_channel_is_checked_as_its_own_account(self):
        spec = {'channels': {'instagram': {'words': 'Cap.', 'alt_text': ['Alt.']}, 'linkedin': {'words': 'Post.'},
                             'substack-notes': {'words': 'Note.'}, 'tiktok': {'words': 'Tok.'}}}
        got = {label: ch for label, ch, _ in voice_gate.spec_texts(spec)}
        self.assertEqual(got, {'instagram': 'caption', 'linkedin': 'linkedin', 'substack-notes': 'substack_note', 'tiktok': 'instagram'})
        self.assertIn('Alt.', voice_gate.spec_texts(spec)[0][2], 'alt text is read too')


if __name__ == '__main__':
    unittest.main()
