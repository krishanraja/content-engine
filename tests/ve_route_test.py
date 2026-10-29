"""The ve route check at parity (W3.1): per-piece code is banned only for a move that already has a library device.
A planted per-piece composition for a move with a device fails; one for a move without a device passes."""
import hashlib
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 've'))
import check_route as route  # noqa: E402

PORTS = ['statement_wall', 'hazard_tape', 'receipt_print', 'chip_transfer', 'ringed_recording', 'logo_card']
RECEIPT = 'def receipt_lines(header, lines):\n    return f\'<div class="receipt m">{header}</div>\'\n'
SCRIBBLE = 'def scribble_loop(cx, cy):\n    return "M 0 0"\n'


class Repo:
    """A synthetic repository: the real moves.json, a device registry we choose, an empty baseline."""

    def __init__(self, temp: Path, devices: list[str]):
        self.root = temp
        (temp / 'config/ve').mkdir(parents=True)
        shutil.copy(ROOT / route.MOVES, temp / route.MOVES)
        (temp / route.DEVICES).write_text(json.dumps({'devices': {d: {'verbs': ['enter', 'exit']} for d in devices}}))
        (temp / route.BASELINE).write_text(json.dumps({'files': {}}))

    def plant(self, rel: str, text: str) -> str:
        (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
        (self.root / rel).write_text(text, encoding='utf-8')
        return rel


class RouteAtParity(unittest.TestCase):
    def test_a_planted_composition_for_a_move_with_a_device_fails(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Repo(Path(temp), ['receipt_print'])
            rel = repo.plant('docs/plans/2099-01-05-monday/video/panels.py', RECEIPT)
            found = route.check(repo.root, [rel])
            self.assertEqual(len(found), 1)
            self.assertIn("'printing-receipt'", found[0])
            self.assertIn("'receipt_print'", found[0])

    def test_the_same_composition_passes_while_the_move_has_no_device(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Repo(Path(temp), ['headline', 'stamp'])
            rel = repo.plant('docs/plans/2099-01-05-monday/video/panels.py', RECEIPT)
            self.assertEqual(route.check(repo.root, [rel]), [])

    def test_an_existing_device_bans_its_move_today(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Repo(Path(temp), ['scribble'])
            rel = repo.plant('apps/renderer/src/pieces/2099-01-05/rings.ts', SCRIBBLE)
            self.assertEqual(len(route.check(repo.root, [rel])), 1)
            other = repo.plant('scripts/quick-edit/render_2099_short.mjs', SCRIBBLE)
            self.assertEqual(len(route.check(repo.root, [other])), 1)

    def test_only_per_piece_code_is_checked(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Repo(Path(temp), PORTS + ['scribble'])
            files = [repo.plant('apps/renderer/src/engine/devices/receipt_print/index.tsx', RECEIPT),  # the device itself
                     repo.plant('docs/plans/2099-01-05-monday/notes.md', RECEIPT),                      # words, not code
                     repo.plant('scripts/velib/compile.py', SCRIBBLE)]
            self.assertEqual(route.check(repo.root, files), [])

    def test_history_passes_unchanged_and_is_checked_once_edited(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Repo(Path(temp), ['receipt_print'])
            rel = repo.plant('docs/plans/2026-10-26-monday/video/draw_panels.py', RECEIPT)
            digest = hashlib.sha256(RECEIPT.encode()).hexdigest()
            (repo.root / route.BASELINE).write_text(json.dumps({'files': {rel: digest}}))
            self.assertEqual(route.check(repo.root, [rel]), [])
            (repo.root / rel).write_bytes(RECEIPT.replace('\n', '\r\n').encode())  # a Windows checkout of the same file
            self.assertEqual(route.check(repo.root, [rel]), [])
            repo.plant(rel, RECEIPT + '# a later edit\n')
            self.assertEqual(len(route.check(repo.root, [rel])), 1)

    def test_the_real_monday_26_code_is_recognised_for_every_port(self):
        moves = {m['device']: m for m in json.loads((ROOT / route.MOVES).read_text())['moves']}
        monday = ''.join((ROOT / 'docs/plans/2026-10-26-monday/video' / name).read_text(encoding='utf-8')
                         for name in ('motion.py', 'draw_panels.py', 'whatitis.py'))
        import re
        for device in PORTS:
            self.assertTrue(any(re.search(s, monday, re.I) for s in moves[device]['signatures']),
                            f'no signature of {device} matches the Monday 26 code it ports')

    def test_every_move_is_banned_once_its_device_lands_and_not_before(self):
        moves = json.loads((ROOT / route.MOVES).read_text())['moves']
        for move in moves:
            with tempfile.TemporaryDirectory() as temp:
                without = Repo(Path(temp), [m['device'] for m in moves if m is not move])
                rel = without.plant('docs/plans/2099-01-05-monday/video/x.py', move['example'] + '\n')
                hits = [f for f in route.check(without.root, [rel]) if f"'{move['id']}'" in f]
                self.assertEqual(hits, [], f"{move['id']} is banned with no device")
            with tempfile.TemporaryDirectory() as temp:
                with_it = Repo(Path(temp), [move['device']])
                rel = with_it.plant('docs/plans/2099-01-05-monday/video/x.py', move['example'] + '\n')
                self.assertEqual(len(route.check(with_it.root, [rel])), 1, f"{move['id']} is not banned with its device")

    def test_the_repository_passes(self):
        self.assertEqual(route.check(ROOT), [])

    def test_moves_are_coherent(self):
        moves = json.loads((ROOT / route.MOVES).read_text())['moves']
        devices = json.loads((ROOT / route.DEVICES).read_text())['devices']
        self.assertEqual(len({m['id'] for m in moves}), len(moves))
        self.assertTrue(set(PORTS) <= {m['device'] for m in moves})
        for move in moves:
            self.assertTrue((ROOT / move['card']).exists(), move['card'])
            if move['device'] in devices:  # a registered device draws every verb its move needs
                self.assertTrue(set(move['verbs']) <= set(devices[move['device']]['verbs']), move['id'])


if __name__ == '__main__':
    unittest.main()
