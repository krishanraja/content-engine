"""The show gate (scripts/velib/showgate.py, config/ve/show-gate.json, config/ve/pre-show-checklist.json).
Krish, 2026-11-19: "Krish was the quality check. Cuts reached him before anyone had watched them."
Run: python3 tests/ve_show_gate_test.py"""
import hashlib
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import guards, showgate, verdict  # noqa: E402

ENFORCED = '2026-11-25'
SPEC = {'piece_id': 'p-1', 'publish_day': ENFORCED, 'cuts': {'short': {'aspect': '9:16', 'beats': []}}}
GOOD_ATTEST = {i['id']: {'pass': True, 'line': 'seen at 12.4 s: it holds on this frame'} for i in showgate.checklist()['items']}


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


class Piece:
    """A ve folder with a rendered proof clip, its qc, and (optionally) the Critic's verdict on it."""
    def __init__(self, tmp, qc_checks=None, complete=True, measured=True, verdict_ok=True):
        self.dir = Path(tmp)
        self.clip = self.dir / 'proof.short.mp4'
        self.clip.write_bytes(b'rendered-bytes')
        self.digest = sha(b'rendered-bytes')
        qc = {'sha256': self.digest, 'measured_pass': measured, 'complete': complete, 'duration_s': 60, 'checks': qc_checks or {}}
        self.clip.with_suffix('.qc.json').write_text(json.dumps(qc))
        if verdict_ok:
            lens = sha((ROOT / 'config/ve/crew/critic.lens.md').read_bytes())
            (self.dir / 'verdict.proof.short.json').write_text(json.dumps({
                'schema': 've-verdict/1', 'piece': 'p-1', 'cut': 'short', 'sha256': self.digest, 'reviewer': 've-critic',
                'reviewed_at': '2026-11-25T10:00:00+00:00', 'lens_sha256': lens, 'frames_viewed': [{'at_s': 1.0}], 'findings': [], 'blocking': False}))

    def watch(self, by='Krish-reviewer', frames=None, heard=60, script=True, attest=None):
        showgate.record(SPEC, 'short', self.dir, by, frames if frames is not None else list(range(14)), heard, script,
                        GOOD_ATTEST if attest is None else attest, self.clip, 'proof.short')

    def check(self):
        return showgate.evaluate(SPEC, 'short', self.dir, self.clip, 'proof.short')


class Checklist(unittest.TestCase):
    def test_every_row_is_his_words_and_unique(self):
        items = showgate.checklist()['items']
        self.assertGreaterEqual(len(items), 20)
        self.assertEqual(len({i['id'] for i in items}), len(items))
        for i in items:
            self.assertTrue(i['krish'].strip() and i['text'].strip() and i['source'], i['id'])

    def test_a_named_qc_row_exists_in_qc(self):
        qc = (ROOT / 'scripts/velib/qc.py').read_text(encoding='utf-8') + (ROOT / 'scripts/velib/qc_faces.py').read_text(encoding='utf-8')
        for i in showgate.checklist()['items']:
            for row in i['auto_rows']:
                self.assertIn(row, qc, f'{i["id"]} names qc row {row}, which no qc file draws')

    def test_a_failed_qc_row_fails_whatever_is_attested(self):
        report = {'checks': {'captions.off_face': {'pass': False}}}
        state, missing = showgate.checklist_state(report, {'checklist': GOOD_ATTEST})
        self.assertEqual(state['captions_off_his_face']['status'], 'failed')
        self.assertTrue(any('captions.off_face' in m for m in missing))

    def test_a_passing_qc_row_answers_its_row_and_the_rest_need_attestation(self):
        report = {'checks': {'captions.off_face': {'pass': True}}}
        state, missing = showgate.checklist_state(report, {})
        self.assertEqual(state['captions_off_his_face']['status'], 'auto')
        self.assertEqual(state['one_picture_per_beat']['status'], 'missing')
        self.assertTrue(any(m.startswith('one_picture_per_beat') for m in missing))

    def test_an_attestation_must_say_something(self):
        state, _ = showgate.checklist_state({'checks': {}}, {'checklist': {'one_picture_per_beat': {'pass': True, 'line': 'ok'}}})
        self.assertEqual(state['one_picture_per_beat']['status'], 'missing')


class Receipt(unittest.TestCase):
    def test_nothing_recorded_is_not_ready_and_says_what_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = Piece(tmp, verdict_ok=False).check()
            self.assertFalse(r['ok'])
            text = ' '.join(r['missing'])
            self.assertIn('no Critic verdict', text)
            self.assertIn('no recorded watch', text)
            self.assertIn('not attested', text)

    def test_a_complete_piece_is_ready_and_bound_to_the_exact_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Piece(tmp)
            p.watch()
            r = p.check()
            self.assertEqual(r['missing'], [])
            self.assertTrue(r['ok'])
            self.assertEqual(r['cut_sha256'], p.digest)

    def test_a_file_that_changed_after_the_watch_is_not_ready(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Piece(tmp)
            p.watch()
            p.clip.write_bytes(b'rendered-again')
            r = p.check()
            self.assertFalse(r['ok'])
            self.assertTrue(any('different file' in m for m in r['missing']))

    def test_qc_that_fails_or_is_incomplete_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Piece(tmp, measured=False, complete=False)
            p.watch()
            text = ' '.join(p.check()['missing'])
            self.assertIn('FAILS', text)
            self.assertIn('incomplete', text)

    def test_the_watch_needs_a_person_frames_the_whole_audio_and_the_script(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Piece(tmp)
            p.watch(frames=[1, 2], heard=10, script=False)
            text = ' '.join(p.check()['missing'])
            for part in ('frames', 'audio was heard', 'script was not compared'):
                self.assertIn(part, text)
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                Piece(tmp).watch(by='ve')

    def test_the_receipt_is_written_and_state_follows_enforce_from(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Piece(tmp)
            ok, missing = showgate.state(SPEC, 'short', p.dir, p.clip, 'proof.short')
            self.assertFalse(ok)
            self.assertTrue(missing)
            old = {**SPEC, 'publish_day': '2026-11-17'}
            self.assertEqual(showgate.state(old, 'short', p.dir, p.clip, 'proof.short'), (True, []))
            written = showgate.write(SPEC, 'short', p.dir, p.clip, 'proof.short')
            self.assertEqual(json.loads(showgate.receipt_path(p.dir, 'proof.short').read_text())['cut_sha256'], written['cut_sha256'])


class Binding(unittest.TestCase):
    def test_by_publish_day_as_before(self):
        self.assertTrue(showgate.binds({'publish_day': '2026-11-20'}, '2026-11-19'))
        self.assertFalse(showgate.binds({'publish_day': '2026-11-17'}, '2026-11-19', Path('.')))

    def test_an_unshown_piece_binds_at_render_time_only_when_the_flag_is_on(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = showgate.config()
            on = {**cfg, 'bind_unshown': {**cfg['bind_unshown'], 'enabled': True}}
            old = {'publish_day': '2026-11-17'}
            self.assertFalse(showgate.binds(old, '2026-11-19', Path(tmp)))
            with patch.object(showgate, 'config', return_value=on):
                self.assertTrue(showgate.binds(old, '2026-11-19', Path(tmp)))
                self.assertIsNotNone(showgate.effective_day(old, Path(tmp)))
                (Path(tmp) / 'show-receipt.long.json').write_text('{}')   # already shown to him: never changed mid-piece (F33)
                self.assertFalse(showgate.binds(old, '2026-11-19', Path(tmp)))
                self.assertIsNone(showgate.effective_day(old, Path(tmp)))

    def test_the_guards_read_the_bind_day(self):
        spec = {'publish_day': '2026-11-17', 'cuts': {'long': {'aspect': '16:9'}}}
        self.assertEqual(guards.bind_day(spec), '2026-11-17')
        guards.set_bind_day('2026-11-25')
        try:
            self.assertEqual(guards.bind_day(spec), '2026-11-25')
            self.assertTrue(guards.pre_critic_bound(spec))
        finally:
            guards.set_bind_day(None)
        self.assertFalse(guards.pre_critic_bound(spec))


class EnginePin(unittest.TestCase):
    def test_a_merge_that_touches_no_engine_file_changes_nothing(self):
        files = {'scripts/velib/compile.py': 'a' * 64, 'apps/renderer/src/x.ts': 'b' * 64}
        self.assertEqual(guards.engine_sha(dict(files)), guards.engine_sha(dict(reversed(list(files.items())))))
        with tempfile.TemporaryDirectory() as tmp:
            spec = {'cuts': {'long': {'aspect': '16:9'}}, 'publish_day': '2026-11-25'}
            lock = {'sha256': guards.engine_sha(files), 'files': files, 'commit': 'abc'}
            (Path(tmp) / 'engine.json').write_text(json.dumps(lock))
            with patch.object(guards, 'engine_files', return_value=dict(files)):
                self.assertEqual(guards.engine_problems(spec, 'long', Path(tmp)), [])        # nothing in the engine moved
            with patch.object(guards, 'engine_files', return_value={**files, 'scripts/velib/compile.py': 'c' * 64}):
                out = guards.engine_problems(spec, 'long', Path(tmp))
                self.assertTrue(out and 've pin' in out[0])                                   # an engine file moved: told how to keep it

    def test_freeze_records_the_commit(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(guards, 'head_commit', return_value='deadbeef'):
                self.assertEqual(guards.freeze(Path(tmp))['commit'], 'deadbeef')


class Defects(unittest.TestCase):
    def test_a_defect_is_his_words_counted_and_never_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(showgate.defect_count(Path(tmp)), 0)
            showgate.defect_add(Path(tmp), 'you cut my head off', 'board comment', 'head_whole_never_cropped')
            showgate.defect_add(Path(tmp), 'icons in the body', 'board comment')
            self.assertEqual(showgate.defect_count(Path(tmp)), 2)
            with self.assertRaises(ValueError):
                showgate.defect_add(Path(tmp), '  ', 'x')


if __name__ == '__main__':
    unittest.main()
