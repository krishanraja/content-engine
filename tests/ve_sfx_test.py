"""The one sound on the big moment (velib.sfx; THE_BAR ruling 11): audition the shortlist, approve only from Krish's
words, the kit built from approved rows only. Synthetic sound, renderer mocked."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import sfx  # noqa: E402
from velib.common import sha256_file  # noqa: E402


def tone(path, seconds, volume):
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=f=440:r=48000:d={seconds}',
                    '-af', f'volume={volume}', '-c:a', 'pcm_s16le', str(path)], check=True)


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not on PATH')
class SfxTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-sfx-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.music = self.dir / 'music'
        (self.music / 'sfx').mkdir(parents=True)
        tone(self.music / 'sfx' / 'thud.wav', 0.4, 0.5)
        self.old_env = os.environ.get(sfx.MUSIC_ENV)
        os.environ[sfx.MUSIC_ENV] = str(self.music)
        self.addCleanup(self._restore)
        self.candidates = self.dir / 'sfx-candidates.json'
        self.candidates.write_text(json.dumps({'candidates': [
            {'id': 'low-thud', 'title': 'Low thud', 'provider': 'Epidemic Sound', 'provider_id': 'ES-1',
             'file': 'sfx/thud.wav', 'sha256': sha256_file(self.music / 'sfx' / 'thud.wav'), 'gain_db': -8},
            {'id': 'ding', 'title': 'Ding', 'provider': 'Epidemic Sound', 'provider_id': 'ES-2'}]}))
        self.approved = self.dir / 'sfx-approved.json'
        self.approved.write_text(json.dumps({'about': ['kept'], 'approved': []}))
        self.kit = self.dir / 'kits' / 'house-v1.json'

    def _restore(self):
        if self.old_env is None:
            os.environ.pop(sfx.MUSIC_ENV, None)
        else:
            os.environ[sfx.MUSIC_ENV] = self.old_env

    def audition_record(self, sid='low-thud', clip=b'clip'):
        ve = self.dir / 've'
        (ve / 'sfx').mkdir(parents=True, exist_ok=True)
        (ve / 'sfx' / f'{sid}.mp4').write_bytes(clip)
        path = ve / 'sfx-audition.json'
        path.write_text(json.dumps({'piece': 'p1', 'cut': 'short', 'candidates': [
            {'id': sid, 'clip': f'{sid}.mp4', 'sha256': sha256_file(ve / 'sfx' / f'{sid}.mp4'), 'gain_db': -8,
             'sound_sha256': sha256_file(self.music / 'sfx' / 'thud.wav')}]}))
        return path

    def approve(self, sid, words, audition=None):
        return sfx.approve(sid, words, '2026-11-05', audition or self.audition_record(), candidates_path=self.candidates,
                           approved_path=self.approved, kit_path=self.kit)

    def test_nothing_is_approved_without_his_words_or_before_he_could_hear_it(self):
        with self.assertRaises(ValueError):
            self.approve('low-thud', '  ')
        with self.assertRaises(ValueError):
            self.approve('ding', 'yes that one')   # never downloaded
        with self.assertRaises(ValueError):          # never auditioned on his cut
            self.approve('low-thud', 'yes', self.dir / 'no-such-audition.json')
        changed = self.audition_record()
        (self.dir / 've' / 'sfx' / 'low-thud.mp4').write_bytes(b'another clip')
        with self.assertRaises(ValueError):          # the clip he heard has changed
            self.approve('low-thud', 'yes', changed)
        self.assertEqual(sfx.approved(self.approved), {})

    def test_his_yes_writes_the_row_and_the_kit_holds_only_approved_sounds(self):
        kit = self.approve('low-thud', 'Yes, the low thud')
        self.assertEqual(kit, {'low-thud': {'path': 'sfx/low-thud.wav', 'gain_db': -8.0}})
        doc = json.loads(self.approved.read_text())
        self.assertEqual(doc['about'], ['kept'])
        self.assertEqual(doc['approved'][0]['approval_words'], 'Yes, the low thud')
        self.assertEqual(sfx.kit_problems(self.kit, self.approved), [])
        self.kit.write_text(json.dumps({'low-thud': {}, 'whoosh': {}}))
        self.assertEqual(sfx.kit_problems(self.kit, self.approved), ['kit sound whoosh is not in the approved set'])

    def test_audition_renders_each_candidate_on_the_moment_and_measures_it_against_his_voice(self):
        assets = self.dir / 'assets'
        assets.mkdir()
        tone(assets / 'audio.short.wav', 6, 0.3)
        props = {'cutId': 'short', 'fps': 30, 'durationFrames': 180,
                 'audio': {'stem': {'src': str(assets / 'audio.short.wav'), 'trimBeforeFrames': 0}, 'sfx': []},
                 'beats': [{'id': 'drop', 'fromFrame': 0, 'toFrame': 180, 'uses': [], 'layout': 'STAGE'}],
                 'events': [{'obj': 'rung', 'verb': 'stamp', 'atFrame': 75}], 'segments': [],
                 'captions': [{'fromFrame': 0, 'toFrame': 180, 'words': [{'atFrame': 0, 'text': 'drop'}]}]}
        spec = {'piece_id': 'p1', 'cuts': {'short': {}}}
        rendered = []

        def fake_render(props_path, out):
            rendered.append(json.loads(Path(props_path).read_text()))
            Path(out).write_bytes(b'clip')
        rows = sfx.candidates(self.candidates)
        record = sfx.audition(spec, 'short', self.dir / 've', props, assets, ['low-thud'], fake_render, beat='drop', rows=rows)
        self.assertEqual(record['at_frame'], 75)
        self.assertEqual(len(rendered), 1)
        placed = rendered[0]['audio']['sfx']
        self.assertEqual(len(placed), 1, 'only the one sound, on the moment')
        self.assertEqual(placed[0]['atFrame'], 75 - 0)
        self.assertTrue((assets / 'sfx' / 'low-thud.wav').is_file())
        row = record['candidates'][0]
        self.assertIsNotNone(row['hit_vs_voice_db'])
        self.assertEqual(row['level'], 'within')
        with self.assertRaises(ValueError):
            sfx.audition(spec, 'short', self.dir / 've', props, assets, ['whoosh'], fake_render, beat='drop', rows=rows)

    def test_a_changed_file_is_refused(self):
        (self.music / 'sfx' / 'thud.wav').write_bytes(b'not the file he heard')
        with self.assertRaises(ValueError):
            sfx.local_file(sfx.candidates(self.candidates)['low-thud'])


if __name__ == '__main__':
    unittest.main(verbosity=1)
