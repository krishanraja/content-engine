"""Acceptance for one W3.1 device port (docs/ve/cards/w3-1-ports/): written by Claude before the card is dispatched, so
the Codex card cannot weaken it. It fails until the device exists, so it is run by the card and by `ve verify-card`, not
in CI (like the other device cards' tests). The visual behaviour is in the device's own device.test.ts.

    python tests/ve_port_acceptance_test.py <device>     # e.g. receipt_print
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 've'))
from velib.compile import compile_cut  # noqa: E402
import check_route as route  # noqa: E402

PORTS = ('statement_wall', 'hazard_tape', 'receipt_print', 'chip_transfer', 'ringed_recording', 'logo_card')
ALL_VERBS = ('enter', 'move', 'mark', 'fill', 'stamp', 'count_to', 'highlight', 'carry', 'exit', 'draw')
KNOWN = {m['device'] for m in json.loads((ROOT / 'config/ve/moves.json').read_text())['moves']}
DEVICE = sys.argv.pop(1) if len(sys.argv) > 1 and sys.argv[1] in KNOWN else None
FIXTURE = ROOT / 'fixtures/ve/my-test-19s'
DEVICES_DIR = ROOT / 'apps/renderer/src/engine/devices'


def move_for(device):
    return next(m for m in json.loads((ROOT / route.MOVES).read_text())['moves'] if m['device'] == device)


class PortAcceptance(unittest.TestCase):
    def setUp(self):
        if DEVICE is None:
            self.fail(f'name the device: python tests/ve_port_acceptance_test.py <{"|".join(PORTS)}>')
        self.move = move_for(DEVICE)
        self.folder = DEVICES_DIR / DEVICE

    def test_registered_with_exactly_its_verbs(self):
        devices = json.loads((ROOT / 'config/ve/devices.json').read_text())['devices']
        self.assertIn(DEVICE, devices, 'config/ve/devices.json does not register the device')
        self.assertEqual(sorted(devices[DEVICE]['verbs']), sorted(self.move['verbs']))
        registry = (DEVICES_DIR / 'registry.ts').read_text()
        self.assertRegex(registry, rf"from './{DEVICE}'")
        self.assertRegex(registry, rf'\n\s*{DEVICE}: \w+,')

    def test_the_contract_files_exist(self):
        for name in ('index.tsx', 'schema.ts', 'fixture.json', 'device.test.ts'):
            self.assertTrue((self.folder / name).is_file(), f'{DEVICE}/{name} is missing')
        fixture = json.loads((self.folder / 'fixture.json').read_text())
        self.assertIn(DEVICE, json.dumps(fixture), 'fixture.json has no object of this device')

    def test_the_device_keeps_the_rules(self):
        for path in self.folder.glob('*.ts*'):
            if path.name.endswith('.test.ts'):
                continue
            code = path.read_text(encoding='utf-8')
            self.assertNotRegex(code, r'#[0-9a-fA-F]{3,8}\b', f'{path.name}: raw hex colour')
            self.assertNotIn('Math.random', code, f'{path.name}: Math.random')
            self.assertNotIn('useCurrentFrame', code, f'{path.name}: useCurrentFrame inside a device')
            self.assertNotRegex(code, r'Date\.now|performance\.now|new Date\(', f'{path.name}: wall clock')
            self.assertNotRegex(code, r'overflow\s*[:=]\s*["\']?visible', f'{path.name}: overflow visible')
            self.assertNotRegex(code, r'ILLUSTRATION|\bKRISH\b', f'{path.name}: a tag or his name on screen')

    def spec_with(self, verb):
        spec = json.loads((FIXTURE / 'spec.json').read_text(encoding='utf-8'))
        beat = spec['cuts']['proof-tall']['beats'][0]
        event = beat['events'][0]
        obj = next(o for o in spec['objects'] if o['obj'] == event['obj'])
        obj['device'] = DEVICE
        for b in spec['cuts']['proof-tall']['beats']:
            b['events'] = [e for e in b['events'] if e is event or e['obj'] != obj['obj']]
        event['verb'] = verb
        return spec

    def words(self):
        return [dict(w, end_s=w['onset_s'] + 0.2)
                for w in json.loads((FIXTURE / 'words.frames.json').read_text(encoding='utf-8'))]

    def test_compile_accepts_its_verbs_and_refuses_the_rest(self):
        for verb in self.move['verbs']:
            props = compile_cut(self.spec_with(verb), 'proof-tall', self.words(), FIXTURE)
            self.assertEqual(props['events'][0]['verb'], verb)
        other = next(v for v in ALL_VERBS if v not in self.move['verbs'])
        with self.assertRaisesRegex(ValueError, f'{DEVICE}.*{other}'):
            compile_cut(self.spec_with(other), 'proof-tall', self.words(), FIXTURE)

    def test_the_route_check_now_bans_the_move(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'config/ve').mkdir(parents=True)
            for rel in (route.MOVES, route.DEVICES):
                (root / rel).write_text((ROOT / rel).read_text())
            (root / route.BASELINE).write_text('{"files": {}}')
            planted = 'docs/plans/2099-01-05-monday/video/panels.py'
            (root / planted).parent.mkdir(parents=True)
            (root / planted).write_text(self.move['example'] + '\n')
            found = route.check(root, [planted])
            self.assertTrue(found, f'check_route does not ban per-piece code for {self.move["id"]}')
        self.assertEqual(route.check(ROOT), [], 'the repository has per-piece code for a move that now has a device')


if __name__ == '__main__':
    unittest.main()
