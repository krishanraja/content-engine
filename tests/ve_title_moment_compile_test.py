"""The episode title moment on a cut's clock (Krish, 2026-11-18, Tue 17: "should be seamlessly made the title with epic
hero title treatment as I am saying that line"): each word keeps its spoken frame, the captions leave those words out,
and a title that holds past his next word fades where it stands while the captions take that word."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib.compile import title_moment_props, title_without_wordmark  # noqa: E402

ROWS = [{'w': i, 'text': t, 'atFrame': 10 * i} for i, t in enumerate(
    ['and', 'where', 'does', 'AI', 'get', 'built?', "Let's", 'find', 'out.', 'Meta'])]


def spec(span, beats):
    return {'title_moment': {'title': 'Where does AI get built?', 'line': 'and where does AI get built?', 'spans': {'short': span}},
            'cuts': {'short': {'beats': beats}}}


class TitleMomentTest(unittest.TestCase):
    def test_no_moment_for_a_cut_without_a_span(self):
        self.assertIsNone(title_moment_props({'cuts': {'short': {'beats': []}}}, 'short', ROWS, 200))

    def test_words_keep_their_frames_and_the_first_is_capitalised(self):
        got = title_moment_props(spec({'from_w': 1, 'to_w': 5}, [{'span': {'from_w': 1, 'to_w': 5}}]), 'short', ROWS, 200)
        self.assertEqual([w['text'] for w in got['words']], ['Where', 'does', 'AI', 'get', 'built?'])
        self.assertEqual([w['atFrame'] for w in got['words']], [10, 20, 30, 40, 50])
        self.assertEqual((got['fromFrame'], got['toFrame'], got['release']), (10, 60, 'captions'))

    def test_a_title_held_through_its_beat_flows_back_into_the_captions(self):
        # The captions stay away while it holds (compile drops every word inside [fromFrame, toFrame)), so no lone
        # caption word sits under the title, and it flows back into the caption line at the end.
        got = title_moment_props(spec({'from_w': 1, 'to_w': 5}, [{'span': {'from_w': 1, 'to_w': 8}}]), 'short', ROWS, 200)
        self.assertEqual((got['toFrame'], got['release']), (90, 'captions'))

    def test_a_span_the_cut_does_not_hold_is_refused(self):
        with self.assertRaises(ValueError):
            title_moment_props(spec({'from_w': 8, 'to_w': 12}, []), 'short', ROWS, 200)


class TitleWordmarkTest(unittest.TestCase):
    """From 26 Nov the lockup carries no wordmark: the stacked V10 is retired (S3h replaced it) and S3h on the v5 outro is
    the cut's one wordmark (Krish, 2026-11-25, ONE-MARK.md). A cut dated before keeps the lockup it was signed with."""

    def test_from_26_nov_the_lockup_has_no_wordmark(self):
        self.assertEqual([title_without_wordmark({'publish_day': d}) for d in ('2026-11-25', '2026-11-26', '2026-12-01')],
                         [False, True, True])

    def test_a_cut_with_no_publish_day_keeps_the_lockup_as_compile_keeps_its_close(self):
        self.assertFalse(title_without_wordmark({}))


if __name__ == '__main__':
    unittest.main()
