# Historical workbench entry: 21 October board and optional feature

This entry moved from `WORKBENCH.md` on 23 October 2026 to keep the live
handoff within its size gate. The current status remains in `NOW.md` and the
latest workbench handoff.

## 21 October: the publish board, parts 2 to 4 and the 15-minute feature (Claude)

- **Krish:** "just get it all done now, to full completion", then "merge it when green and keep going".
- **Built (PR #128, branch `claude/content-publish-board-ux-4dl7ai`, merged to main when CI is green):**
  - Part 2: `GET /api/week/options?include=sources` (`api/_weekSources.ts`) gathers his ideas, his inspo folder's and
    the engine's, his first, then near something he liked (`why_here`); judges stay blind (`check-judges.ts`).
    `GET /api/idea-queue?combine=1` and the Queue tab's Combine button (his tap only, `combine_is_his_tap`).
    `scripts/post-pack/board_feed.py gather <Monday>` and `taps` feed plan-week.
  - Part 3: the Drafts editor (tap to edit, select to comment, one Save bar); `edit_sweep.py` carries a number or
    fact change only where its neighbouring words match, shows it under "Also changed" with Undo, and never touches a
    recorded script. Only his saves count (`edit_is_his_save`, `tap_is_his`). The ledger takes the `publish_board`
    surface (migration applied live on his yes and read back).
  - Part 4: the Publish step is a run-sheet: Download first, then one card per place in posting order.
  - The feature is a third cut (`making.py`, `teleprompter_send.py`, `recording_match.py`, `publish_kit.py`,
    `build.py`, `_making.ts`), with YouTube long-form and Spotify cards on feature pieces only.
- **Layout lock:** CI (`npm run check:board-layout`); every change in this PR is recorded with his words in
  `fixtures/week-board/fixed-layout.json`. No approval prompts (Ruling, Krish, 2026-10-21).
- **Live gather ran (21 Oct, after the deploy):** `docs/plans/2026-10-26-week/sources.json`: his 0 (none since
  11 Oct; 1 relayed board item holds his words), inspo 36, engine 53, queue 4, no combine group. 77 of the 89 have no
  series yet, and under.the.hood's pool is empty; plan-week now places the unassigned by mandate. No idea scored close
  enough to one he liked for a `why_here` line (only 3 liked ideas so far).
- **Control Center (22 Oct, his yes, "but we do not produce 15 minutes every single time"):** its mirror
  `src/lib/making.ts` knows the feature as an optional third cut: asked for, and its two posting ticks shown, only on
  a piece whose scripts' check holds a feature hash (`makingCuts`, `channelsFor`); the long cut reads "5-minute".
