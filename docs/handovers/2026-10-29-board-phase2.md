# Handover, 29 Oct 2026: the cadence restart and phase 2 of the publish board

Written because cost guard G1 asked for a fresh session at 517k tokens. Start the next session from this file.

## Krish's standing instruction, verbatim

"yes you tell it, and wake up and go once your orchestrator confirms all the other sessions are 100% closed out"

Then: "you can make the mocks now". The mocks are done. Everything else waits until the orchestrator session
(`session_01JRhKyrvZVBC6wX9CHa6R6i`, growth-makeyourmindup) confirms that every other content-engine session is closed.

## Done

- The four publish dates moved through `POST /api/content-ideas/<id>/schedule` and were read back
  (`docs/plans/2026-10-29-cadence-restart.md`):
  - `9a0c97af-f0d6-4d12-a7ce-773c622d4b67`: Mon 2 Nov
  - `b63d2507-dbb4-449d-bce4-f21e859ee2ad`: Wed 4 Nov
  - `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`: Fri 6 Nov
  - `b358e788-209f-427b-a84d-1f79a8ebb430`: Mon 9 Nov
- PR #264 records the moves. It holds this handover and the mock sources.
- PR #267 adds `POST /api/board/<Monday>/posted`: Growth ticks a posting box, using `GROWTH_WRITEBACK_TOKEN`.
  - The repo map is regenerated in `1fdd6a1`; CI was red only on that.
  - Krish must set `GROWTH_WRITEBACK_TOKEN` in Vercel and as Growth's secret.
- PR #269 adds `config/asset-spec.json` and `scripts/post-pack/asset_spec.py`.
- Three board layout mocks, on synthetic data: `docs/handovers/board-mocks-2026-10-29/`.
  - The directions are A (today first), B (the week, day by day) and C (the pipeline).
  - Render them with `node shoot.js a-today.html b-week.html c-pipeline.html` from that folder (the fonts resolve from
    `assets/fonts/makeyourmindup`).
  - Krish has seen six screenshots and has not picked a direction yet.

## Next, in order, once the orchestrator confirms

1. Merge the latest main into #264, #269 and #267. Run `npm run verify` and merge each with a merge commit once green.
2. Set `9a0c97af`'s series to `follow_the_money`. Krish's words: "move what was recorded on 30th to 2nd (it is kind of
   a follow the money piece)". Use the engine's route and quote his words in the commit.
3. Extend the posted route:
   - `day` may be any of mon to sun;
   - channels add instagram, x, threads, facebook and substack-notes;
   - off-day posts get board boxes;
   - add `GET /api/board/<Monday>/pieces` → `{days:[{day, date, piece_id, channels:[...]}]}` under the same key.
   - Send the final shape to the orchestrator.
4. Item 5: show the assets on each day.
5. The cross-week carry route:
   - move a day's publish page and his edits and comments to another week;
   - build the 2 and 9 Nov boards;
   - take the moved days off the 19 and 26 Oct boards only after the new boards read back.
6. Build the board to the direction Krish picks (items 1, 2, 3 and 6):
   - one layout every day;
   - off-day posts first-class;
   - liked/disliked filed as cues and to `taste_reports`;
   - stages through to amplification.
   - Prove it on fixtures with phone and desktop screenshots, and update the layout fixture with his words.

Walls: nothing publishes, sends or posts. A migration goes to the orchestrator unapplied. No media is committed.

## Krish's feedback on the mocks, 29 Oct 2026, typed in the session, verbatim

"it feels like all components are just whatever size they feel like being - we need ultimate component stability and predictability and consistency. buttons and other components should be where i expect them to be, the size I expect them to be, no aggressive wrapping, etc etc. Seeing the next action on me in this format for any given piece is incredibly helpful, just one button per thing I need to approve of - perfect - as long as i can click through to what i am approving easily."

He sent two screenshots with it: mock B's desktop week (the one he critiqued) and mock A's "Needs you" queue (the one he praised).

What it asks of the build:
- Every component has a fixed size and a fixed place. Every action button has one height and one width rule, and sits at the
  same spot on every card. No button label wraps (B's "Approve Substack post" wrapped onto two lines).
- Day cards are equal height, with footers aligned. Previews keep one aspect ratio and size. The asset tiles and the stage
  lane keep one row with fixed cells, never wrapping onto a second line.
- Keep A's "Needs you" queue: one row and one button per thing he approves.
- Every ask links through to the thing it approves: the post, the words or the cut.

The CI state when this was written:
- #267 and #269 are merged with main.
- Main itself fails `npm run typecheck`, with errors in `_content.ts`, `_meter.ts`, `_prices.ts` and `_publishChecks.ts`, none
  of them from these PRs. Port the fix once one exists on main.
