"""scripts/now_trim.py keeps NOW.md under its limit on main, so no branch trims it by hand and two pull requests never
conflict over it (2026-11-10: #499, #509 and #510 sat unmerged on NOW.md conflicts). Run with
python3 tests/now_trim_test.py."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from now_trim import trim  # noqa: E402

PAGE = (
    "# N\n\n## Where it is right now\n\n- **bold stays**\n- w1 newest\n- w2\n- w3 oldest\n\n"
    "## What changed recently\n\n- c1 newest\n- c2 " + "x" * 14500 + "\n- c3 old\n"
    "Older lines: `docs/history/a.md` and `LOG.md`.\n\n## What is next\n\n- Next\n"
)


class NowTrim(unittest.TestCase):
    def test_under_the_limit_is_untouched(self):
        self.assertIsNone(trim("# short\n", "2026-11-10", set())[1])

    def test_moves_oldest_lines_verbatim_and_points_at_them(self):
        new, name, history = trim(PAGE, "2026-11-10", {"2026-11-10-NOW-moved-1.md"})
        self.assertEqual(name, "2026-11-10-NOW-moved-2.md")
        self.assertLess(len(new.encode()), 14_000)
        for kept in ("- **bold stays**", "- w1 newest", "- c1 newest", "- Next"):
            self.assertIn(kept, new)
        for moved in ("- c3 old", "- c2 x"):
            self.assertNotIn(moved, new)
            self.assertIn(moved, history)
        self.assertTrue(history.startswith("> **Historical.**"))
        self.assertIn("Older lines: `docs/history/2026-11-10-NOW-moved-2.md` (it names every earlier move)", new)
        self.assertNotIn("`docs/history/a.md`", new)
        self.assertIn("- `docs/history/a.md`", history)

    def test_no_line_is_lost(self):
        new, _, history = trim(PAGE, "2026-11-10", set())
        for line in PAGE.splitlines():
            if line.startswith("- "):
                self.assertTrue(line in new.splitlines() or line in history.splitlines(), line[:30])

    def test_old_dated_lines_of_what_is_next_move_when_nothing_else_can_but_standing_lines_never_do(self):
        page = ("# N\n\n## What changed recently\n\n- only one\n\n## What is next and what is waiting on Krish\n\n- Next (2026-11-18): newest\n"
                "- Old waiting (2026-11-09): " + "z" * 14200 + "\n- Krish declined required status checks (2026-10-25): standing\n"
                "- Fresh (2026-11-17): same week stays\n- North Star check (2026-11-18): holds.\n")
        new, name, history = trim(page, "2026-11-18", set())
        self.assertIsNotNone(name)
        self.assertLess(len(new.encode()), 14_000)
        for kept in ("- Next (2026-11-18)", "- Krish declined required status checks (2026-10-25)", "- Fresh (2026-11-17)", "- North Star check (2026-11-18): holds."):
            self.assertIn(kept, new)
        self.assertIn("- Old waiting (2026-11-09): z", history)
        self.assertNotIn("- Old waiting", new)
        # An undated line and a young one are never moved.
        undated = page.replace("- Old waiting (2026-11-09)", "- Old waiting without a date")
        self.assertIsNone(trim(undated, "2026-11-18", set())[1])

    def test_a_long_list_of_earlier_moves_folds_into_history_when_no_line_can_move(self):
        older = "Older lines: " + ", ".join(f"`docs/history/2026-11-1{i}-NOW-moved-1.md`" for i in range(9)) + " and `LOG.md`."
        page = "# N\n\n## What changed recently\n\n- only " + "y" * 13800 + "\n" + older + "\n\n## Next\n"
        new, name, history = trim(page, "2026-11-13", set())
        self.assertEqual(name, "2026-11-13-NOW-moved-1.md")
        self.assertLess(len(new.encode()), len(page.encode()))
        self.assertIn("- only y", new)
        for i in range(9):
            self.assertIn(f"`docs/history/2026-11-1{i}-NOW-moved-1.md`", history)
        self.assertIsNone(trim(new, "2026-11-13", {name})[1])  # one pointer left: nothing more to fold


if __name__ == '__main__':
    unittest.main()
