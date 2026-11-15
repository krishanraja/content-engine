"""Character compilation uses an isolated drawn library and PCM stem."""
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib.character_track import compile_track

class TrackTest(unittest.TestCase):
    def test_absent(self):
        self.assertIsNone(compile_track({}, 'short', [], {}, '/unused'))

    def test_track(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with wave.open(str(root / 'audio.short.wav'), 'wb') as wav:
                wav.setparams((1, 2, 3000, 0, 'NONE', ''))
                wav.writeframes(b'\x00\x20' * 24000)
            states = {s: dict(size=[1024, 1036], opaque_box=[300, 350, 700, 1036]) for s in ('closed', 'open', 'blink')}
            book = {'poses': {'neutral': {'states': states, 'eye_box': [1, 1, 2, 2]}}}
            spec = {'piece_id': 'test', 'character': {'id': 'krish', 'cuts': ['short'], 'cues': [{'at_w': 1, 'pose': 'neutral'}]},
                    'cuts': {'short': {'aspect': '9:16', 'beats': [{'id': 'hook', 'span': {'from_w': 0, 'to_w': 0}}]}}}
            props = {'beats': [{'toFrame': 30}], 'durationFrames': 240, 'captions': []}
            words = [{'w': 1, 'atFrame': 64, 'end_s': 2.5}]
            with patch('velib.character_library.library_dir', return_value=root), patch('velib.character_library.index', return_value=book), patch('velib.character_library.stage', return_value={'neutral': {s: str(root / f'{s}.png') for s in states}}):
                a = compile_track(spec, 'short', words, props, root)
                b = compile_track(spec, 'short', words, props, root)
                self.assertEqual(a, b)
                self.assertEqual(a['poses'][0]['fromFrame'], 60)
                self.assertTrue(a['mouth'][64])
                self.assertFalse(a['mouth'][80])
                self.assertTrue(all(90 <= y-x <= 135 for x, y in zip([60]+a['blinks'], a['blinks'])))
                spec['cuts']['short']['aspect'] = '16:9'
                with self.assertRaisesRegex(ValueError, 'character.aspect'):
                    compile_track(spec, 'short', words, props, root)

if __name__ == '__main__':
    unittest.main()
