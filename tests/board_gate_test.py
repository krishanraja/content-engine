"""scripts/post-pack/board_gate.py: what it prints for a week's ideas gate, and that a held line stops a session (exit 1),
offline. The gate itself is tested in tests/control-plane/ideas-gate.test.ts and, on the real migration,
tests/ideas-gate-db.mjs."""
import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'scripts'))
import board_gate as gate  # noqa: E402

ANSWER = {'ok': True, 'week': '2026-11-16', 'approvals_read': True, 'days': [
    {'day': 'mon', 'date': '2026-11-16', 'pieces': [{'id': 'p1', 'title': 'Oracle borrows', 'approval': {'label': 'Approved by you, Mon 9 Nov, 08:07'}}], 'held': []},
    {'day': 'wed', 'date': '2026-11-18', 'pieces': [], 'held': [{'piece_id': 'p2', 'option': None, 'title': 'Held: not approved by you', 'text': 'A piece. Nothing you pressed put it here.'}]},
    {'day': 'tue', 'date': '2026-11-17', 'pieces': [], 'held': []},
]}


class BoardGateTest(unittest.TestCase):
    def test_prints_each_piece_with_its_approval_and_each_held_line(self):
        out, held = gate.lines(ANSWER)
        self.assertEqual(held, 1)
        self.assertEqual(out, ['mon 2026-11-16:', '  on the board: Oracle borrows (p1). Approved by you, Mon 9 Nov, 08:07',
                               'wed 2026-11-18:', '  Held: not approved by you: A piece. Nothing you pressed put it here. (p2)'])

    def test_says_when_his_approvals_could_not_be_read(self):
        out, _ = gate.lines({**ANSWER, 'approvals_read': False})
        self.assertTrue(out[0].startswith('His approvals could not be read'))

    def test_a_held_line_stops_the_caller_and_an_unreadable_gate_is_never_clear(self):
        calls = []
        real_call, real_key = gate.engine.call, gate.engine.operator_key
        try:
            gate.engine.operator_key = lambda: 'synthetic'
            gate.engine.call = lambda method, path, **kw: (calls.append((method, path)) or (200, json.dumps(ANSWER)))
            with redirect_stdout(io.StringIO()):
                self.assertEqual(gate.main(['2026-11-16']), 1)
            self.assertEqual(calls, [('GET', '/api/board/2026-11-16/gate')])
            clear = {**ANSWER, 'days': ANSWER['days'][:1]}
            gate.engine.call = lambda method, path, **kw: (200, json.dumps(clear))
            with redirect_stdout(io.StringIO()):
                self.assertEqual(gate.main(['2026-11-16']), 0)
            gate.engine.call = lambda method, path, **kw: (503, json.dumps({'ok': False, 'error': 'down'}))
            self.assertEqual(gate.main(['2026-11-16']), 2)
            self.assertEqual(gate.main(['next week']), 2)
        finally:
            gate.engine.call, gate.engine.operator_key = real_call, real_key


if __name__ == '__main__':
    unittest.main()
