"""An off-day option from an Inspiration card Krish ticked rides on top of the day's 2 to 6 (scripts/post-pack/week_plan.py,
read_offdays and his_tick). Ruling, Krish, 2026-11-12: an inspiration card he ticks is an instruction that jumps the
queue. The week of 16 Nov held six Tuesday options and his tick's seventh, and the reader refused the whole week while
the board's view drew all seven."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import week_plan as wb  # noqa: E402

TICKED = '701a2c55-7400-4dc8-99cb-d6001147ae16'
TICK = {'action_id': '7b4d3a28-2b85-47fc-893f-b41c9bfdbeb7', 'card_id': 'ccbe548e-9c51-4e7d-819b-f629c7e2ddc9', 'card_name': 'a-reel.mp4'}


def option(oid, **kw):
    return {'id': oid, 'format': 'Carousel', 'source': 'A source', 'copy': f'The words of {oid}.', **kw}


def session_options(n, **kw):
    return [option(f'own{i}', **kw) for i in range(1, n + 1)]


def from_tick(oid=TICKED):
    return option(oid, from_inspiration=dict(TICK), covers=[oid, TICK['card_id']])


def ids(data, day='tue'):
    return [o['id'] for o in wb.read_offdays(data)[day]]


class HisTickRidesOnTop(unittest.TestCase):
    def test_six_options_and_his_tick_read_whole_with_its_own_id(self):
        day = session_options(6) + [from_tick()]
        self.assertEqual(ids({'tue': day}), [f'own{i}' for i in range(1, 7)] + [TICKED])

    def test_a_seventh_option_a_session_wrote_is_still_refused(self):
        with self.assertRaisesRegex(wb.BoardError, 'Tuesday: give 2 to 6 options'):
            wb.read_offdays({'tue': session_options(7)})

    def test_closed_and_decided_options_still_count(self):
        # The board's view draws a closed or decided option on its day like any other, so it counts toward the six.
        day = session_options(4) + [option('settled', closed='Moved to Thursday.'), option('chosen', decided='Signed off for Tuesday.')]
        self.assertEqual(len(ids({'tue': day + [from_tick()]})), 7)
        with self.assertRaisesRegex(wb.BoardError, 'Tuesday: give 2 to 6 options'):
            wb.read_offdays({'tue': day + [option('one-more')]})

    def test_only_the_mark_his_tick_writes_counts_as_his(self):
        # inspiration is the saved post an option came from, on any option; from_inspiration with his tick's id is his.
        saved = option('saved', inspiration={'label': 'A saved reel', 'url': 'https://example.com/reel', 'saved': 'Saved 12 Nov'})
        with self.assertRaises(wb.BoardError):
            wb.read_offdays({'tue': session_options(6) + [saved]})
        with self.assertRaises(wb.BoardError):
            wb.read_offdays({'tue': session_options(6) + [option('noid', from_inspiration={'card_id': TICK['card_id']})]})

    def test_his_tick_never_makes_up_the_two(self):
        self.assertEqual(ids({'tue': session_options(2) + [from_tick()]}), ['own1', 'own2', TICKED])
        with self.assertRaises(wb.BoardError):
            wb.read_offdays({'tue': session_options(1) + [from_tick()]})

    def test_a_day_his_tick_alone_brought_is_read(self):
        self.assertEqual(ids({'thu': [from_tick()]}, 'thu'), [TICKED])

    def test_his_tick_is_read_where_idea_checks_reads_it(self):
        self.assertTrue(wb.his_tick(from_tick()))
        self.assertFalse(wb.his_tick(option('own')))
        self.assertFalse(wb.his_tick(None))


if __name__ == '__main__':
    unittest.main()
