# 2026-11-07: publish board v4 built

Status: Layout v4 is built and checked (config/board-layout.json `v4`, scripts/post-pack/board_v4.py, week_board.py,
week.js, the board API's Sign creative and dated Scores presses, tests, the lock rewritten with Krish's words of 7 Nov).
The live 9 Nov board (0e79df54) is not rebuilt yet: the engine API answers 401 from a cloud session, so the rebuild runs
in `.github/workflows/board-rebuild.yml` from `docs/plans/2026-11-09-week/board-build.json`, dry run first.

Next: after merge, run Board rebuild (week 2026-11-09, recipe docs/plans/2026-11-09-week/board-build.json) as a dry run;
on Krish's yes, run it with publish "publish approved by Krish".

- North Star check (2026-11-07): holds.
