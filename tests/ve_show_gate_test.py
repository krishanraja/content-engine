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
        # qc_frames.rows is merged into every qc report (velib/qc.py run_qc), so its rows answer checklist rows too.
        qc = ''.join((ROOT / f'scripts/velib/{name}.py').read_text(encoding='utf-8') for name in ('qc', 'qc_faces', 'qc_frames'))
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
    """Ruling (Krish, 2026-11-19): rules and the engine freeze at Sign storyboard; a new rule binds from the next piece;
    bind_unshown goes."""

    def test_by_publish_day_as_always(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(showgate.binds({'publish_day': '2026-11-20'}, '2026-11-19', Path(tmp)))
            self.assertFalse(showgate.binds({'publish_day': '2026-11-17'}, '2026-11-19', Path(tmp)))
            self.assertIsNone(showgate.effective_day({'publish_day': '2026-11-17'}, Path(tmp)))

    def test_bind_unshown_is_retired(self):
        self.assertFalse(showgate.config()['bind_unshown']['enabled'])
        with tempfile.TemporaryDirectory() as tmp:
            # a piece never shown to him is no longer held to a rule dated after its publish day
            self.assertFalse(showgate.binds({'publish_day': '2026-11-17'}, '2026-11-19', Path(tmp)))

    def test_a_future_dated_rule_that_existed_at_the_freeze_still_binds_by_publish_day(self):
        # The freeze is the pin, not a date: a rule already in the frozen files with binds_from 24 Nov holds a piece frozen
        # on 22 Nov and published on 25 Nov, exactly as before.
        spec = {'publish_day': '2026-11-25', 'cuts': {'long': {'aspect': '16:9'}}}
        with tempfile.TemporaryDirectory() as tmp:
            guards.freeze(Path(tmp), now='2026-11-22T10:00:00Z')
            self.assertTrue(showgate.binds(spec, '2026-11-24', Path(tmp)))
            self.assertEqual(guards.bind_day(spec), '2026-11-25')

    def test_a_rule_landing_after_the_freeze_moves_the_piece_onto_its_pin(self):
        # Ruling (Krish, 2026-11-19): a new rule binds from the next piece. A rule file changed on main after ve expect
        # sends this piece's proof and render to the commit pinned there, lint included.
        spec = {'publish_day': '2026-11-25', 'cuts': {'long': {'aspect': '16:9'}}}
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(guards, 'head_commit', return_value='abc123'):
                lock = guards.freeze(Path(tmp))
            self.assertEqual(guards.engine_route(spec, Path(tmp))['route'], 'here')
            moved = {**lock['rules']['files'], 'config/ve/piece-guards.json': '0' * 64}
            with patch.object(guards, 'rules_files', return_value=moved):
                route = guards.engine_route(spec, Path(tmp), golden=lambda _sha: True)
                self.assertEqual(route['route'], 'pin')
                self.assertEqual(route['commit'], 'abc123')
                self.assertEqual(route['rules_sha256'], lock['rules']['sha256'])
                self.assertIn('config/ve/piece-guards.json', route['changed'])

    def test_a_piece_frozen_before_rules_were_recorded_is_never_moved_by_them(self):
        spec = {'publish_day': '2026-11-20', 'cuts': {'long': {'aspect': '16:9'}}}
        with tempfile.TemporaryDirectory() as tmp:
            lock = guards.freeze(Path(tmp))
            lock.pop('rules')
            guards.lock_path(Path(tmp)).write_text(json.dumps(lock))
            self.assertEqual(guards.rules_changed(Path(tmp)), [])
            self.assertEqual(guards.engine_route(spec, Path(tmp))['route'], 'here')

    def test_records_written_during_a_piece_are_not_rules(self):
        names = set(guards.rules_files())
        for name in ('config/ve/sign-offs.json', 'config/ve/style-samples.json', 'config/ve/lab.json'):
            self.assertNotIn(name, names)

    def test_the_freeze_records_the_rules_and_says_what_changed_since(self):
        with tempfile.TemporaryDirectory() as tmp:
            lock = guards.freeze(Path(tmp))
            names = set(lock['rules']['files'])
            for name in ('scripts/velib/lint.py', 'scripts/velib/piece_guards.py', 'config/ve/show-gate.json',
                         'config/ve/plain-frames.json', 'config/brand-palette.json'):
                self.assertIn(name, names)
            self.assertEqual(guards.rules_changed(Path(tmp)), [])
            moved = {**lock['rules']['files'], 'config/ve/piece-guards.json': '0' * 64}
            with patch.object(guards, 'rules_files', return_value=moved):
                self.assertEqual(guards.rules_changed(Path(tmp)), ['config/ve/piece-guards.json'])


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
                out = guards.engine_problems(spec, 'long', Path(tmp), golden=lambda _sha: True)
                self.assertTrue(out and 'pinned at ve expect' in out[0], out)                 # it runs on its pin
                self.assertNotIn('approv', out[0])                                            # never a question for Krish

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
