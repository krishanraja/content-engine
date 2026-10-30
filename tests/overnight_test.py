#!/usr/bin/env python3
"""The overnight run (plan Wave 2, W2.6), on synthetic fixtures only: Codex's tool profile, the Critic and its
calibration, the run's start, its repair rounds at reduced scale, and the Monday board's held cuts."""
import copy
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'overnight'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import codex_profile  # noqa: E402
import critic  # noqa: E402
import overnight  # noqa: E402
import board_materials  # noqa: E402

PIECE = '11111111-2222-4333-8444-555555555555'
SHA = 'a' * 64


class Proc:
    def __init__(self, code=0, out='', err=''):
        self.returncode, self.stdout, self.stderr = code, out, err


class CodexProfileTests(unittest.TestCase):
    def setUp(self):
        self.profile = codex_profile.load()

    def test_the_checked_in_profile_passes_its_audit(self):
        self.assertEqual(codex_profile.audit(self.profile), [])

    def test_a_planted_forbidden_tool_fails_the_audit(self):
        for planted in ('buffer_create_post', 'tiktok_publish', 'github_workflow_dispatch', 'vercel_deploy', 'drive_share',
                        'request_escalation'):
            bad = copy.deepcopy(self.profile)
            bad['allowed_tools'].append(planted)
            self.assertTrue(codex_profile.audit(bad), planted)

    def test_an_escalation_path_network_or_mcp_server_fails_the_audit(self):
        for key, value in (('approval_policy', 'on-request'), ('sandbox_mode', 'danger-full-access'), ('network_access', True),
                           ('allowed_mcp_servers', ['buffer'])):
            bad = copy.deepcopy(self.profile)
            bad[key] = value
            self.assertTrue(codex_profile.audit(bad), key)
        bad = copy.deepcopy(self.profile)
        bad['forbidden'].remove('tiktok')
        self.assertIn('the profile must forbid tiktok', codex_profile.audit(bad))

    def test_a_card_that_needs_a_forbidden_or_unknown_tool_is_held(self):
        self.assertEqual(codex_profile.admit(['shell', 'image_generation'], self.profile), [])
        self.assertTrue(codex_profile.admit(['publish_substack'], self.profile))
        self.assertTrue(codex_profile.admit(['browser'], self.profile))
        self.assertTrue(codex_profile.admit(['gh'], self.profile))

    def test_installed_mcp_servers_of_a_forbidden_kind_are_named(self):
        listing = [{'name': 'files', 'command': 'node', 'args': ['fs.js']},
                   {'name': 'social', 'transport': {'type': 'stdio', 'command': 'npx', 'args': ['buffer-mcp']}}]
        self.assertEqual(codex_profile.installed(listing, self.profile), ['social'])
        self.assertEqual(codex_profile.installed({'servers': [{'name': 'notes'}]}, self.profile), [])

    def test_the_powershell_launch_switch_is_not_a_forbidden_kind(self):
        # The Studio's own server, as SURFACE's Codex lists it (30 Oct): only -ExecutionPolicy Bypass carried "bypass".
        studio = {'name': 'mindmake-studio', 'command': 'pwsh', 'args': ['-NoProfile', '-NonInteractive',
                  '-ExecutionPolicy', 'Bypass', '-File', 'scripts/studio-mcp-credential-proxy.ps1']}
        short = {'name': 'notes', 'command': 'powershell', 'args': ['-ep', 'bypass', '-File', 'notes.ps1']}
        self.assertEqual(codex_profile.installed([studio, short], self.profile), [])
        # Bypass anywhere else is still read, and so is everything after the switch.
        sneaky = {'name': 'tools', 'command': 'node', 'args': ['bypass-guard.js']}
        poster = dict(studio, name='poster', args=studio['args'] + ['--publish'])
        self.assertEqual(codex_profile.installed([sneaky, poster], self.profile), ['tools', 'poster'])

    def test_the_cli_fails_on_a_planted_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = copy.deepcopy(self.profile)
            bad['allowed_tools'].append('tiktok_upload')
            path = Path(tmp) / 'p.json'
            path.write_text(json.dumps(bad))
            run = subprocess.run([sys.executable, str(ROOT / 'scripts/overnight/codex_profile.py'), '--profile', str(path), 'audit'],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 1, run.stdout)


def verdict(findings=(), critic_id='c1', round_no=1, sha=SHA, day='mon', cut='long'):
    return {'schema': 'overnight-critic/1', 'critic_id': critic_id, 'round': round_no, 'day': day, 'cut': cut,
            'file_sha256': sha, 'scale': 0.5, 'viewed': [0.0, 10.0], 'findings': list(findings), 'blocking': bool(findings)}


def finding(needs='spec', text='the chart sits in a corner and the lower half is empty', at=42.0, area='composition'):
    return {'failure': text, 'area': area, 'at_s': at, 'needs': needs}


class CriticTests(unittest.TestCase):
    def test_a_critic_only_names_a_failure_and_where(self):
        self.assertEqual(critic.validate(verdict([finding()])), [])
        with_fix = verdict([dict(finding(), fix='move it up')])
        self.assertTrue(critic.validate(with_fix))
        self.assertTrue(critic.validate(verdict([finding(text='you should move the chart up')])))
        self.assertTrue(critic.validate(dict(verdict(), suggestion='x')))

    def test_sound_goes_to_the_measured_gates(self):
        self.assertTrue(critic.validate(verdict([finding(area='sound')])))
        self.assertTrue(critic.validate(verdict([finding(text='the music is too loud')])))

    def test_blocking_matches_findings(self):
        bad = verdict([finding()])
        bad['blocking'] = False
        self.assertTrue(critic.validate(bad))

    def test_a_fresh_critic_each_round_and_never_the_repairer(self):
        self.assertTrue(critic.check_fresh(verdict(critic_id='c1'), ['c1']))
        self.assertTrue(critic.check_fresh(verdict(critic_id='r1'), [], ['r1']))
        self.assertEqual(critic.check_fresh(verdict(critic_id='c2'), ['c1'], ['r1']), [])

    def test_a_failure_that_needs_a_take_is_held(self):
        self.assertEqual(critic.decide(verdict()), 'pass')
        self.assertEqual(critic.decide(verdict([finding()])), 'repair')
        self.assertEqual(critic.decide(verdict([finding(), finding(needs='take')])), 'hold')


class CalibrationTests(unittest.TestCase):
    """The real manifest, judged on synthetic stand-ins: the Friday cuts are stand-in files in a media folder, the
    F19 frames are the repository's own, and Monday's are matched by the manifest's sha256."""

    def setUp(self):
        self.manifest = critic.load_manifest()
        self.tmp = tempfile.TemporaryDirectory()
        self.media = Path(self.tmp.name)
        for case in self.manifest['cases']:
            if case['media'].get('name'):
                (self.media / case['media']['name']).write_bytes(f'synthetic stand-in for {case["id"]}'.encode())

    def tearDown(self):
        self.tmp.cleanup()

    def judged(self, wrong=()):
        out = {}
        for i, case in enumerate(self.manifest['cases']):
            block = (case['expect'] == 'block') != (case['id'] in wrong)
            out[case['id']] = verdict([finding()] if block else [], critic_id=f'critic-{i}',
                                      sha=critic.case_sha(case, self.media), day='calibration', cut='still')
        return out

    def test_the_manifest_holds_every_case_the_brief_names(self):
        self.assertEqual(critic.manifest_problems(self.manifest), [])
        ids = [c['id'] for c in self.manifest['cases']]
        self.assertEqual(sum(i.startswith('F19') for i in ids), 4)
        self.assertEqual(sum(i.startswith('fri23') for i in ids), 4)
        self.assertEqual({i for i in ids if i.startswith('mon26')}, {'mon26-wide', 'mon26-tall'})

    def test_a_critic_that_blocks_and_passes_the_right_cases_is_calibrated(self):
        self.assertEqual(critic.calibrate(self.manifest, self.judged(), self.media), [])

    def test_a_critic_that_passes_f19_or_friday_or_blocks_monday_is_not(self):
        for wrong in ('F19-gate2-tall-2', 'fri23-long-camera-v11', 'mon26-tall'):
            problems = critic.calibrate(self.manifest, self.judged(wrong=[wrong]), self.media)
            self.assertTrue(any(p.startswith(wrong) for p in problems), (wrong, problems))

    def test_a_verdict_about_another_file_counts_for_nothing(self):
        judged = self.judged()
        judged['fri23-short-camera-v10']['file_sha256'] = 'b' * 64
        self.assertTrue(critic.calibrate(self.manifest, judged, self.media))
        del judged['fri23-short-camera-v10']
        self.assertIn('fri23-short-camera-v10: no verdict', critic.calibrate(self.manifest, judged, self.media))


class DueTests(unittest.TestCase):
    def test_due_once_every_picked_day_has_its_titles_press(self):
        picks = [{'id': 'mon', 'body': {'day': 'mon', 'pick': 'x'}}, {'id': 'wed', 'body': {'day': 'wed', 'pick': 'y'}},
                 {'id': 'mon-scripts', 'body': {'kind': 'approve_scripts'}}]
        press = lambda day: {'id': f'{day}-titles', 'body': {'kind': 'titles', 'day': day, 'piece_id': PIECE, 'picks': {'long_title': 'T'}}}
        self.assertEqual(overnight.due(picks, [press('mon')]), {'due': False, 'days': ['mon', 'wed'], 'waiting': ['wed'], 'pieces': {'mon': PIECE}})
        self.assertTrue(overnight.due(picks, [press('mon'), press('wed')])['due'])
        self.assertFalse(overnight.due([], [press('mon')])['due'])

    def test_the_week_is_eight_days_after_the_recording_sunday_and_monday_morning_reads_last_night(self):
        self.assertEqual(overnight.candidate_weeks(dt.date(2026, 11, 8)), ['2026-11-16'])
        self.assertEqual(overnight.candidate_weeks(dt.date(2026, 11, 9))[0], '2026-11-16')


class RunTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {'MINDMAKE_OVERNIGHT_ROOT': self.tmp.name})
        self.env.start()
        self.config = overnight.load_config()
        self.config['steps'] = {
            'produce': {'argv': ['produce', '{day}', '{cut}', '{scale}'], 'takes_scale': True, 'codex': False},
            'critic': {'argv': ['critic', '{round}'], 'codex': True},
            'repair': {'argv': ['repair', '{findings}'], 'codex': True},
            'final': {'argv': ['final', '{scale}'], 'codex': False},
            'gates': {'argv': ['gates'], 'codex': False},
        }
        self.calls = []

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def runner(self, verdicts, gates_ok=True):
        verdicts = list(verdicts)

        def run(argv):
            self.calls.append(argv)
            if argv[0] in ('produce', 'final'):
                return Proc(out=json.dumps({'file': f'/w/{argv[0]}-{len(self.calls)}.mp4',
                                            'url': 'https://drive.google.com/file/d/' + 'x' * 25 + '/view'}))
            if argv[0] == 'critic':
                return Proc(out=json.dumps(verdicts.pop(0)))
            if argv[0] == 'repair':
                return Proc(out=json.dumps({'repairer': 'repairer-1'}))
            if argv[0] == 'gates':
                return Proc(out=json.dumps({'ok': gates_ok, 'failed': [] if gates_ok else ['joins']}))
            raise AssertionError(argv)
        return run

    def cut(self, verdicts, calibrated=True, **kw):
        job = {'day': 'mon', 'cut': 'long', 'piece_id': PIECE, 'week': '2026-11-16', 'python': 'py', 'date': '2026-11-16'}
        return overnight.make_cut(job, self.config, self.runner(verdicts, **kw), True, calibrated)

    def test_repairs_render_at_reduced_scale_and_the_full_scale_render_runs_once_at_the_end(self):
        record = self.cut([verdict([finding()], 'c1'), verdict([], 'c2', 2)])
        self.assertEqual(record['status'], 'made')
        self.assertEqual([(r['step'], r['scale']) for r in record['renders']],
                         [('produce', 0.5), ('repair render', 0.5), ('final', 1.0)])
        self.assertEqual([c[0] for c in self.calls], ['produce', 'critic', 'repair', 'produce', 'critic', 'final', 'gates'])

    def test_a_failure_that_needs_a_different_take_is_held_not_repaired(self):
        record = self.cut([verdict([finding(needs='take', text='he looks away from the lens mid sentence', at=75)])])
        self.assertEqual((record['status'], record['reason_code']), ('held', 'needs_new_take'))
        self.assertIn('1:15', record['reason'])
        self.assertNotIn('repair', [c[0] for c in self.calls])
        self.assertNotIn('final', [c[0] for c in self.calls])

    def test_the_rounds_are_bounded_and_each_critic_is_fresh(self):
        record = self.cut([verdict([finding()], f'c{i}', i) for i in range(1, 4)])
        self.assertEqual(record['reason_code'], 'critic_still_blocks')
        self.assertEqual([c[0] for c in self.calls].count('repair'), self.config['repair']['max_rounds'])
        self.calls.clear()
        record = self.cut([verdict([finding()], 'c1'), verdict([], 'c1', 2)])
        self.assertEqual(record['reason_code'], 'critic_failed')
        self.assertNotIn('final', [c[0] for c in self.calls])

    def test_an_uncalibrated_critic_is_never_asked_and_the_cut_says_so(self):
        record = self.cut([], calibrated=False)
        self.assertEqual((record['status'], record['judged']), ('made', False))
        self.assertNotIn('critic', [c[0] for c in self.calls])

    def test_a_measured_gate_holds_a_cut(self):
        record = self.cut([verdict([], 'c1')], gates_ok=False)
        self.assertEqual((record['status'], record['reason_code']), ('held', 'gate_failed'))

    def test_codex_steps_never_run_when_the_profile_fails(self):
        job = {'day': 'mon', 'cut': 'long', 'piece_id': PIECE, 'week': '2026-11-16', 'python': 'py', 'date': '2026-11-16'}
        record = overnight.make_cut(job, self.config, self.runner([]), False, True)
        self.assertEqual(record['reason_code'], 'codex_profile')
        self.assertNotIn('critic', [c[0] for c in self.calls])

    def test_a_run_starts_once_and_keeps_its_record(self):
        self.config['steps']['critic'] = None
        self.config['steps']['repair'] = None
        with mock.patch.object(overnight, 'calibrated', return_value=False):
            record = overnight.run('standby', '2026-11-16', {'mon': PIECE, 'fri': PIECE}, self.config, self.runner([]))
        self.assertEqual([(c['day'], c['cut'], c['status']) for c in record['cuts']], [('mon', 'short', 'made'), ('fri', 'short', 'made')])
        self.assertEqual(overnight.read_json(overnight.run_path('2026-11-16', 'standby'))['state'], 'finished')
        with self.assertRaises(overnight.RunError):
            overnight.run('standby', '2026-11-16', {'mon': PIECE}, self.config, self.runner([]))
        block = overnight.lane_block(record)
        self.assertNotIn('file', block['cuts'][0])

    def test_the_monday_board_names_every_held_cut_through_week_boards_inputs(self):
        records = [{'critic_calibrated': True, 'cuts': [
            {'day': 'mon', 'cut': 'long', 'piece_id': PIECE, 'status': 'made', 'url': 'https://drive.google.com/file/d/' + 'y' * 25 + '/view'}]},
            overnight.unfinished({'state': 'running', 'cuts': []}, 'standby', '2026-11-16', {'mon': PIECE}, self.config)]
        seen = []

        def run(argv):
            seen.append(argv)
            if 'download' in argv:
                Path(argv[argv.index('--output') + 1]).write_text('<html></html>', encoding='utf-8')
            return Proc(out='{}')
        with mock.patch.object(overnight.shutil, 'which', return_value=None):
            result = overnight.board('2026-11-16', records, self.config, runner=run)
        build = next(a for a in seen if 'scripts/post-pack/week_board.py' in a)
        self.assertIn('--materials', build)
        self.assertIn('--previous', build)
        path = Path(build[build.index('--materials') + 1].split('=', 1)[1])
        data = json.loads(path.read_text())
        board_materials.validate(data, PIECE)
        self.assertEqual(data['status'], 'review')
        self.assertIn('Held: the short cut', data['note'])
        self.assertIn(overnight.REASONS['not_finished'], json.dumps(data))
        self.assertEqual(result['held'], [{'day': 'mon', 'cut': 'short', 'reason_code': 'not_finished'}])
        self.assertTrue(result['published'])
        self.assertIsNone(result['repair_round'])

    def test_a_held_cut_a_repair_could_mend_asks_for_one_repair_round(self):
        held = [{'day': 'wed', 'cut': 'long', 'reason_code': 'critic_still_blocks'}]
        with mock.patch.object(overnight.shutil, 'which', return_value=None):
            self.assertEqual(overnight.repair_round('2026-11-16', held, self.config, None), 'wanted')
        sent = []
        with mock.patch.object(overnight.shutil, 'which', return_value='/usr/bin/gh'):
            state = overnight.repair_round('2026-11-16', held, self.config, lambda argv: sent.append(argv) or Proc())
        self.assertEqual(state, 'dispatched')
        self.assertEqual(sent[0][:4], ['gh', 'workflow', 'run', 'repair-round.yml'])
        self.assertIsNone(overnight.repair_round('2026-11-16', [{'reason_code': 'needs_new_take'}], self.config, None))

    def test_earlier_materials_are_kept_beside_the_overnight_section(self):
        before = {'piece_id': PIECE, 'status': 'ready', 'note': 'Files prepared.', 'sections': [{'id': 'captions', 'title': 'Captions', 'copy': [{'label': 'a', 'text': 'b'}]}]}
        data = overnight.materials_for('mon', PIECE, [{'day': 'mon', 'cut': 'long', 'status': 'made', 'url': None}], before)
        self.assertEqual([s['id'] for s in data['sections']], ['captions', 'overnight'])
        self.assertEqual(data['status'], 'ready')
        again = overnight.materials_for('mon', PIECE, [{'day': 'mon', 'cut': 'long', 'status': 'made'}], data)
        self.assertEqual(again['note'].count('Overnight run:'), 1)
        self.assertTrue(again['note'].endswith('Files prepared.'))


if __name__ == '__main__':
    unittest.main()
