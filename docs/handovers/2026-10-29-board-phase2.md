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
