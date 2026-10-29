"""A Codex card's max_minutes and max_calls are enforced (W2.12): a foreground dispatch is stopped at max_minutes, and
verify-card refuses a run its session log shows went past either limit, or a run with no log. Synthetic logs only."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import cards  # noqa: E402


def session(path: Path, cwd: str, minutes: float, calls: int) -> str:
    lines = [{'timestamp': '2026-11-08T22:00:00Z', 'type': 'session_meta', 'payload': {'cwd': cwd}}]
    lines += [{'timestamp': '2026-11-08T22:00:30Z', 'type': 'response_item', 'payload': {'type': 'function_call', 'name': 'shell'}} for _ in range(calls)]
    end = 22 * 60 + minutes
    lines.append({'timestamp': f'2026-11-08T{int(end // 60):02d}:{int(end % 60):02d}:00Z', 'type': 'event_msg', 'payload': {'type': 'task_complete'}})
    path.write_text('\n'.join(json.dumps(x) for x in lines), encoding='utf-8')
    return str(path)


class CardLimits(unittest.TestCase):
    def test_usage_is_read_from_the_cards_own_session(self):
        with tempfile.TemporaryDirectory() as tmp:
            mine = session(Path(tmp) / 'a.jsonl', 'C:/work/ve-card-1', 12, 7)
            other = session(Path(tmp) / 'b.jsonl', 'C:/work/other', 90, 300)
            usage = cards.card_usage('ve-card-1', 'C:\\work\\ve-card-1', [mine, other])
            self.assertEqual((usage['minutes'], usage['calls'], usage['log']), (12.0, 7, mine))

    def test_a_run_past_either_limit_is_refused(self):
        meta = {'card': 've-card-1', 'max_minutes': '40', 'max_calls': '40'}
        self.assertEqual(cards.limit_problems(meta, {'minutes': 39.0, 'calls': 40}), [])
        self.assertTrue(any('max_minutes 40' in p for p in cards.limit_problems(meta, {'minutes': 41.0, 'calls': 3})))
        self.assertTrue(any('max_calls 40' in p for p in cards.limit_problems(meta, {'minutes': 3.0, 'calls': 41})))

    def test_a_run_with_no_log_is_said_never_passed(self):
        problems = cards.limit_problems({'card': 'x', 'max_minutes': '40', 'max_calls': '40'}, None)
        self.assertEqual(len(problems), 1)
        self.assertIn('cannot be checked', problems[0])

    def test_limits_are_whole_numbers_in_range(self):
        for bad in ({'max_minutes': 'soon', 'max_calls': '1'}, {'max_minutes': '0', 'max_calls': '1'}, {'max_minutes': '1', 'max_calls': '999'}):
            with self.assertRaises(SystemExit):
                cards.card_limits(bad)


if __name__ == '__main__':
    unittest.main()
