"""floor_group --check (scripts/floor_group.py): every rejection-floor standard sits in exactly one group or operating.
Krish, 2026-11-04: "group the 215 floor standards for my approval". A floor that gains a standard fails until it is
grouped, so the page he decides at (/standards) always covers the whole floor."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import floor_group  # noqa: E402

SCRIPT = ROOT / 'scripts' / 'floor_group.py'


def run(floor, groups):
    with tempfile.TemporaryDirectory() as d:
        f, g = Path(d) / 'floor.json', Path(d) / 'groups.json'
        f.write_text(json.dumps(floor), encoding='utf-8')
        g.write_text(json.dumps(groups), encoding='utf-8')
        return subprocess.run([sys.executable, str(SCRIPT), '--check', '--floor', str(f), '--groups', str(g)],
                              capture_output=True, text=True)


FLOOR = {'standards': {'s0000000001': {}, 's0000000002': {}, 's0000000003': {}}}
GROUPS = {'groups': [{'key': 'one', 'title': 'One', 'never_beneath': 'Never less than one.', 'check': 'Count to one.',
                      'members': ['s0000000001', 's0000000002']}],
          'operating': {'title': 'How sessions work', 'members': ['s0000000003']}}


class Check(unittest.TestCase):
    def test_the_real_grouping_is_whole(self):
        out = subprocess.run([sys.executable, str(SCRIPT), '--check'], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        self.assertIn('sit in exactly one', out.stdout)

    def test_a_whole_grouping_passes(self):
        self.assertEqual(run(FLOOR, GROUPS).returncode, 0)

    def test_a_new_standard_fails_until_grouped(self):
        floor = json.loads(json.dumps(FLOOR))
        floor['standards']['s0000000004'] = {}
        out = run(floor, GROUPS)
        self.assertEqual(out.returncode, 1)
        self.assertIn('s0000000004: on the floor but in no group', out.stdout)

    def test_a_standard_in_two_places_fails(self):
        groups = json.loads(json.dumps(GROUPS))
        groups['operating']['members'].append('s0000000001')
        self.assertIn('in 2 places', run(FLOOR, groups).stdout)

    def test_an_empty_group_a_long_dash_and_a_gone_standard_fail(self):
        groups = json.loads(json.dumps(GROUPS))
        groups['groups'].append({'key': 'two', 'title': 'Two — more', 'never_beneath': 'Never two.', 'check': 'Count.', 'members': []})
        groups['groups'][0]['members'].append('s0000000009')
        out = run(FLOOR, groups).stdout
        self.assertIn('two: no members', out)
        self.assertIn('two: its title has a long dash', out)
        self.assertIn('s0000000009: not a standard on the floor', out)

    def test_the_self_test(self):
        self.assertEqual(floor_group.self_test(), 0)


if __name__ == '__main__':
    unittest.main()
