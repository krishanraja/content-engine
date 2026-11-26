Status: tests/floor_groups_print_test.py passes again on main: its synthetic group was keyed house_brand, which the 25 Nov v5 ruling (config/floor-rulings.json v5_groups) now rewords, so the test printed the ruling's words instead of its own; the group is now corner_mark, which no ruling touches.
Next: Let the standards check-in pull request #994 rerun its CI on main with this fix and merge itself.
North Star check (2026-11-26): holds.
