"""The voice pass on a conformed cut (velib.voice): sniffs turned down, never cut (Krish, 17 Oct 2026: "dampen that
out surgically"); the repair chain only with his approval, its delay taken out. Synthetic sound only."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import voice  # noqa: E402

RATE = 48000


def write_wav(path, samples):
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-',
                    '-c:a', 'pcm_s16le', str(path)], input=samples.astype('float32').tobytes(), check=True)


def read(path):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def take():
    """Two voiced words, a breathy burst in the pause between them (a sniff), room tone under everything."""
    import numpy as np
    rng = np.random.default_rng(7)
    t = np.arange(int(3.0 * RATE)) / RATE
    out = rng.normal(0, 0.0003, len(t))
    for a, b in ((0.2, 1.0), (1.9, 2.8)):
        m = (t >= a) & (t < b)
        out[m] += 0.2 * np.sin(2 * np.pi * 180 * t[m]) + 0.1 * np.sin(2 * np.pi * 360 * t[m])
    m = (t >= 1.3) & (t < 1.6)
    out[m] += 0.004 * np.diff(rng.normal(0, 1, m.sum() + 1))
    return out, [{'onset_s': 0.2, 'end_s': 1.0}, {'onset_s': 1.9, 'end_s': 2.8}]


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not on PATH')
class VoiceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-voice-test-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def test_a_sniff_between_words_is_turned_down_and_nothing_else_moves(self):
        import numpy as np
        samples, words = take()
        raw = self.dir / 'dialogue.short.raw.wav'
        write_wav(raw, samples)
        report = voice.prepare(raw, words, self.dir / 'dialogue.short.wav', self.dir / 'voice.short.json')
        self.assertFalse(report['repair'], 'the chain stays off without his approval')
        self.assertEqual(len(report['sniffs']), 1)
        sniff = report['sniffs'][0]
        self.assertTrue(1.0 < sniff['s'] < sniff['e'] < 1.9)
        before, after = read(raw), read(self.dir / 'dialogue.short.wav')
        self.assertEqual(len(before), len(after))
        span = slice(int(1.35 * RATE), int(1.55 * RATE))
        drop = 20 * np.log10(np.sqrt((after[span] ** 2).mean()) / np.sqrt((before[span] ** 2).mean()))
        self.assertLess(drop, -15)
        words_span = slice(int(0.3 * RATE), int(0.9 * RATE))
        self.assertTrue(np.allclose(before[words_span], after[words_span], atol=1e-3), 'his words are untouched')
        self.assertTrue(json.loads((self.dir / 'voice.short.json').read_text())['ruling'].startswith('Krish, 2026-10-17'))

    def test_the_chain_needs_his_name_date_and_words(self):
        config = self.dir / 'voice-chain.json'
        self.assertIsNone(voice.approved_chain(config))
        config.write_text(json.dumps({'chain': 'highpass=f=80', 'approved_by': 'Claude'}))
        with self.assertRaises(ValueError):
            voice.approved_chain(config)
        config.write_text(json.dumps({'chain': 'highpass=f=80', 'approved_by': 'Krish', 'approved_on': '2026-11-05',
                                      'approval_words': 'yes, the repaired one'}))
        self.assertEqual(voice.approved_chain(config), 'highpass=f=80')

    def test_the_ab_pair_is_the_same_seconds_with_the_chain_delay_taken_out(self):
        import numpy as np
        samples, _ = take()
        raw = self.dir / 'raw.wav'
        write_wav(raw, np.tile(samples, 4))
        pair = voice.ab(raw, self.dir / 'ab', 1.0, 10.0)
        self.assertEqual(len(read(pair['raw'])), len(read(pair['repaired'])))
        self.assertLessEqual(abs(voice.chain_latency(pair['raw'], pair['repaired'])), voice.MAX_LATENCY_LEFT_S)


if __name__ == '__main__':
    unittest.main(verbosity=1)
