"""The weekly device sprint (W3.8): 1 to 2 references briefed through `ve brief` (a thin adapter until W2.7 lands), cards
written only from filled fields, a Gate 2 yes recorded only with his words for a built device, and the device count and
each yes fed to the Archive through week_board.py's existing --archive input. Synthetic fixtures; nothing dispatched."""
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import sprint  # noqa: E402

WEEK = '2026-11-16'


class Sandbox:
    def __init__(self, temp: Path):
        self.root = temp
        (temp / 'config/ve').mkdir(parents=True)
        shutil.copy(ROOT / 'config/ve/moves.json', temp / 'config/ve/moves.json')
        shutil.copy(ROOT / 'config/ve/devices.json', temp / 'config/ve/devices.json')
        self.patches = [mock.patch.object(sprint, 'ROOT', temp),
                        mock.patch.object(sprint, 'SPRINTS', temp / 'docs/ve/sprints'),
                        mock.patch.object(sprint, 'LEDGER', temp / 'docs/ve/sprints/ledger.json'),
                        mock.patch.object(sprint, 'MOVES', temp / 'config/ve/moves.json'),
                        mock.patch.object(sprint, 'DEVICES', temp / 'config/ve/devices.json'),
                        mock.patch.object(sprint, 'card_worktree', lambda card: f'/wt/content-engine/ve-card/{card}'),
                        mock.patch('velib.cards._require_design_lock', lambda meta: None)]

    def __enter__(self):
        for p in self.patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in reversed(self.patches):
            p.stop()

    def fill(self, n=1, device='split_screen_race', brief_status='ready'):
        path = self.root / f'docs/ve/sprints/{WEEK}/card-{n}.fields.json'
        fields = json.loads(path.read_text())
        brief_path = self.root / fields['brief']
        brief_path.write_text(json.dumps({'reference': fields['reference'], 'status': brief_status,
                                          'plates': [{'slot': 'race', 'brief': 'two lanes'}]}))
        fields.update({
            'device': device, 'aim': 'good motion',
            'meaning': 'two firms race side by side so the gap is seen, not said',
            'move': {'id': 'split-screen-race', 'name': 'two lanes race to a line', 'verbs': ['enter', 'move', 'exit'],
                     'signatures': ['split[ _-]?screen[ _-]?race'], 'example': 'def split_screen_race(a, b):'},
            'title': 'The split-screen race', 'goal': 'Port the reference move.', 'contract': '1. Two lanes.',
            'tests': ['lanes start level'], 'write_allow': f'[apps/renderer/src/engine/devices/{device}/*]', 'read': 'x'})
        path.write_text(json.dumps(fields))
        return fields


class Sprint(unittest.TestCase):
    def test_one_or_two_references_only(self):
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)):
            with self.assertRaises(SystemExit):
                sprint.start(WEEK, [])
            with self.assertRaises(SystemExit):
                sprint.start(WEEK, ['a', 'b', 'c'])
            with self.assertRaises(SystemExit):
                sprint.start('2026-11-17', ['a'])  # a Tuesday

    def test_without_ve_brief_the_brief_is_pending_and_no_card_is_written(self):
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)) as box, \
                mock.patch.object(sprint, 'has_ve_brief', return_value=False):
            written = sprint.start(WEEK, ['inspo://production/123'])
            self.assertEqual(len(written), 1)
            brief = json.loads((box.root / f'docs/ve/sprints/{WEEK}/brief-1.json').read_text())
            self.assertEqual(brief['status'], 'pending')
            with self.assertRaises(SystemExit) as stop:
                sprint.cards(WEEK)
            self.assertIn('TODO', str(stop.exception))
            box.fill(brief_status='pending')
            with self.assertRaises(SystemExit) as stop:
                sprint.cards(WEEK)
            self.assertIn('pending', str(stop.exception))

    def test_ve_brief_is_called_once_per_reference_through_the_adapter(self):
        calls = []

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            Path(cmd[cmd.index('--out') + 1]).write_text(json.dumps({'plates': [{'slot': 's'}]}))
            return mock.Mock(returncode=0, stdout='', stderr='')
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)), \
                mock.patch.object(sprint, 'has_ve_brief', return_value=True), mock.patch.object(sprint.subprocess, 'run', fake_run):
            sprint.start(WEEK, ['ref-a', 'ref-b'])
        self.assertEqual([c[2:4] for c in calls], [['brief', 'ref-a'], ['brief', 'ref-b']])

    def test_filled_fields_become_a_card_a_move_and_a_record(self):
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)) as box, \
                mock.patch.object(sprint, 'has_ve_brief', return_value=False):
            sprint.start(WEEK, ['inspo://production/123'])
            box.fill()
            [card] = sprint.cards(WEEK)
            text = card.read_text()
            self.assertIn('Aim: good motion', text)
            self.assertIn('python tests/ve_port_acceptance_test.py split_screen_race', text)
            self.assertIn('cwd: /wt/content-engine/ve-card/ve-s-2026-11-16-1', text)
            moves = json.loads((box.root / 'config/ve/moves.json').read_text())['moves']
            self.assertTrue(any(m['device'] == 'split_screen_race' for m in moves))
            s = sprint.status()
            self.assertEqual((s['sprint_devices'], s['proven']), (1, 0))
            self.assertFalse(s['entries'][0]['built'])

    def test_bad_fields_are_refused(self):
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)) as box, \
                mock.patch.object(sprint, 'has_ve_brief', return_value=False):
            sprint.start(WEEK, ['r'])
            fields = box.fill(device='stamp')  # already in the library
            fields['aim'] = 'pretty'
            fields['move']['example'] = 'nothing that matches'
            (box.root / f'docs/ve/sprints/{WEEK}/card-1.fields.json').write_text(json.dumps(fields))
            problems = sprint.problems_of(fields)
            self.assertTrue(any('aim' in p for p in problems))
            self.assertTrue(any('already in the library' in p for p in problems))
            self.assertTrue(any('example' in p for p in problems))

    def test_gate2_needs_his_words_and_a_built_device(self):
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)) as box, \
                mock.patch.object(sprint, 'has_ve_brief', return_value=False):
            sprint.start(WEEK, ['r'])
            box.fill()
            sprint.cards(WEEK)
            with self.assertRaises(SystemExit):
                sprint.gate2('split_screen_race', 'yes', 'board', '2026-11-20')  # not built yet
            devices = json.loads((box.root / 'config/ve/devices.json').read_text())
            devices['devices']['split_screen_race'] = {'verbs': ['enter', 'move', 'exit']}
            (box.root / 'config/ve/devices.json').write_text(json.dumps(devices))
            with self.assertRaises(SystemExit):
                sprint.gate2('split_screen_race', '', 'board', '2026-11-20')
            with self.assertRaises(SystemExit):
                sprint.gate2('unknown_device', 'yes', 'board', '2026-11-20')
            entry = sprint.gate2('split_screen_race', 'Yes, use it', 'publish board, Archive', '2026-11-20')
            self.assertEqual(entry['gate2']['words'], 'Yes, use it')
            self.assertEqual(sprint.status()['proven'], 1)

    def test_the_archive_feed_keeps_the_rows_and_adds_the_devices(self):
        with tempfile.TemporaryDirectory() as temp, Sandbox(Path(temp)) as box:
            rows = {'rows': [{'piece_id': None, 'date': '2026-10-06', 'series': None, 'title': 'The Launch', 'links': []}]}
            archive = box.root / 'archive.json'
            archive.write_text(json.dumps(rows))
            out = box.root / 'archive.fed.json'
            data = sprint.feed(archive, out)
            self.assertEqual(data['rows'], rows['rows'])
            self.assertEqual(data['devices']['count'], len(json.loads((ROOT / 'config/ve/devices.json').read_text())['devices']))
            not_a_feed = box.root / 'not-a-feed.json'
            not_a_feed.write_text('[]')
            with self.assertRaises(SystemExit):
                sprint.feed(not_a_feed, out)
        sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
        import week_board  # noqa: E402
        if hasattr(week_board, 'read_archive'):  # W2.1's --archive input reads the rows and ignores the devices block
            self.assertEqual(len(week_board.read_archive(data)), 1)


if __name__ == '__main__':
    unittest.main()
