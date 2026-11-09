# Publish board: from static snapshot to a live command desk

## Context

Krish (2026-11-09) says the board makes extra work. Half the buttons fail, it never shows the current state, and it overwhelms him instead of letting him expand what he needs. He wants it to be "my go-to instead of just having to remember everything", and he wants it visionary: "as live, fresh, and action-oriented as possible. I should always open it with something to do for each piece or for the week, unless the day or the week is complete." On 2026-11-07 he also asked for a redesign of the 9 Nov board. He chose the **live rebuild**: stop the breaks now, then build the new board at `/board/next`. The new board replaces the old one only when he approves it.

**North Star:** every press that fails or gets lost delays a piece. The number is 3 published this week against a target of 8 (U4). A board that always shows the next move removes the time Krish spends remembering what each piece needs, and that time is the bottleneck.

### Why it breaks today (from the code)
- **A snapshot, not a view.** `scripts/post-pack/week_board.py` (7,560 lines) bakes static HTML. That HTML is uploaded to Supabase storage and streamed by `apps/control-plane/api/board/_handler.ts:363`. The 5-second `/state` poll (`week_board/web.js:330`) patches only a few fields. Anything else raises a yellow "rebuild" bar (`web.js:297`).
- **Fragile buttons.** `week.js` (1,735 lines) was written for the retired Claude-artifact runtime. `board_web.py:27` converts it to the web runtime by regex. Presses fail without saying so:
  - the cookie has expired (401, `api/_auth.ts:251`);
  - the Origin header doesn't match (`_contracts.ts:36`);
  - a stale revision or stale media review returns 409 (`web.js:128`, `_handler.ts:340`).
  Krish's lost Friday comments (`NOW.md:38`) are this class of failure.
- **Too much at once.** Ten tabs plus Comments, and every step of every day is rendered in full.

## The vision: "The Desk"

One page that opens on the next move, with everything else one tap away.

**The rule (enforced in code, not left to taste).** The server works out a `next_action` for every piece and for the week:
- What it is, with a verb: "Approve Wed scripts", "Record Fri long cut", "Pick Saturday's good news".
- Who owns it: Krish, or the engine or Growth, with the reason.
- When it is due, and the one-tap action.

If every piece and the week are complete, the page opens on a "Week done" state instead, with what shipped and the North Star count. A piece that is not complete but has no next action is a **build failure**: a test refuses it. The page can never open on nothing.

### Layout (top to bottom, first visit, 390px and desktop)
1. **Now strip.** Live pulse dot plus "Live, updated 4s ago" (Status Dot #24882). Then the North Star counter "3 of 8 this week", which animates to its value (Count Up #20068). Then a week strip Mon to Sat with a status dot for each day (pattern from Calendar with Event Indicators #25133). A day dot is green when shipped, amber when it needs Krish, grey when the engine is on it, and red when late.
2. **Your move (the hero).** A focused card stack of everything that needs Krish, most urgent first. It works one card at a time like a triage deck: approve, improve with his words, or reject (Card Stack #35044 or Swipe Deck #23568). Undo and the keyboard keys A, I, R are kept. Each card is an Approval Card (#36498 or AI Approval #23792) with the real thing inline: the script text, the cut playing in place (Interactive Video Player #28516), the thumbnail, the options. Cleared cards fly off. The counter ticks down to "Nothing needs you. Next: Fri long cut ready Thu 18:00".
3. **This week, by piece.** One row per piece. It shows the series, the title, the stage as a compact stepper (Brief, Scripts, Recorded, Cut, Approved, Posted, using the key-value stepper #40073), and the piece's own next action on the right. Rows are closed by default. Opening one shows its detail as an accessible accordion (#34660, native `<details>`): scripts, assets, fact gate, standards, its comment thread.
4. **What moved since you last looked.** A timeline grouped by day (#35051), newest first. New items slide in as the live feed brings them (pattern from Live Notification Feed #36949). Example items: "Engine filed Wed short cut 14:02", "Growth posted Mon carousel". It is closed after five items.
5. **Ideas and next week.** A tab-free section of collapsed cards that opens only when ideas are waiting. On Sundays it is promoted to the hero.
6. **Jump anywhere.** ⌘K, or a floating button on a phone, opens a command palette (#23522). It finds any piece, day or week and runs "Approve…", "Comment on…" or "Open last week".

### Live and fresh
- Server-Sent Events from a new `GET /api/board/:week/stream`, with a 5-second poll as the fallback. The view is rebuilt on the server every time the state changes. There is no static snapshot anywhere in the new route.
- Saves are optimistic and confirmed: the card moves at once, then shows a check when the server confirms. If the save fails, the card returns with a plain reason and Retry. Every text box keeps a local draft until the server confirms the save, so a comment is never lost again.
- Staleness is visible. If the stream drops for more than 30 seconds, the Now strip turns amber and says "Reconnecting, showing data from 14:03".
- On a 401, an unlock sheet opens inline and the pending press is replayed afterwards.

### Look
- The Make Your Mind Up tokens from `scripts/post-pack/tokens.css` and the board's display type: an editorial, calm, CEO-grade look rather than a neon SaaS dashboard.
- Motion only where it carries meaning: cards clearing, the counter, new items arriving. Reduced motion is respected.
- 44px tap targets and no sideways scroll at 390px. Both already have checks in `check_board_layout.py --browser`.
- The 21st components are adapted into the house style, not pasted in. Code is retrieved only for the ones adopted, since each retrieval is paid (about 12).

## Phases

### Phase 0: stop the breaks (this week, no layout change)
1. Reproduce the lost Friday comments against a fixture week with `tests/board-browser.mjs`. Fix the root cause. Call the cause "suspected" until the test proves it.
2. Add local drafts to every text box on the current board. Show plain-language save failures with Retry, and replay the press after an inline unlock on a 401.
3. Extend `scripts/post-pack/buttons_in_browser.py` to click every button on the fixture weeks and read back the stored row. A dead button fails CI.

The fixed-layout fixture is untouched, so no layout approval is needed.

### Phase 1: rendered mock, then Krish's yes
- Run the concept round (`build-apps-with-krish` / `krish-design`). The spine is fixed by his brief: the Desk above. The variants worth judging are:
  - the hero as a card stack, a ranked list, or a one-card focus;
  - piece rows as steppers or as a week timeline.
- Judge the variants blind and combine the best into one mock. Render it with real 16 Nov data at 390px and 1280px in two states: "things to do" and "week done".
- The mock passes the presentation check, then goes to Krish cold as files. It is not a Claude artifact.
- Record the lock in `docs/PUBLISH_BOARDS.md`.

### Phase 2: build `/board/next`
- **Server (`apps/control-plane/api/board/`):**
  - New `_view.ts` builds the view model: `next_actions[]`, `pieces[]` with stage and `next_action`, `week_status`, `moved_since[]`, `north_star`, `as_of`.
  - It reads `board_documents`, `board_ticks`, the making record (`_live.ts`), Growth's posted ticks and the archive (`_archive.ts`). Plan-only parts (ideas, briefs, options) come from a `view.json` that `week_board.py` writes beside each build, reusing `desk_model()` (`week_board.py:2796`) and its panel models.
  - New routes `GET /view` and `GET /stream`. Presses stay `PUT /:collection/:id` through `board_save`, guarded by `his_document` and `hisOnlyRefusal`.
- **Client:** a Vite + React + Tailwind page built to `apps/control-plane/public/board-next/`, with the adapted 21st components under `apps/control-plane/board-next/src/components/`. No regex runtime swaps.
- **Routing:** `vercel.json` adds `/board/next` and `/board/next/:week`. `/board` stays on the old board.
- **Layout lock:** add the new route's structure to `fixtures/week-board/` and `check_board_layout.py` once Krish approves the mock, through `--update --approved "Krish, …"`.

### Phase 3: switch over (his call)
Run both boards side by side for a week. Switch `/board` only on his words. After a clean week, retire `week.js` and `web.js`, and cut `week_board.py` back to writing the plan feed.

## Critical files
- `apps/control-plane/api/board/{_handler.ts,_contracts.ts,_presses.ts,_live.ts,_archive.ts}` plus the new `_view.ts`; `apps/control-plane/vercel.json`
- `scripts/post-pack/week_board.py` (`desk_model`, panel models), `week_board/{week.js,web.js}`, `board_web.py`
- `scripts/post-pack/buttons_in_browser.py`, `tests/board-browser.mjs`, `tests/control-plane/board-*.test.ts`
- `config/board-layout.json`, `fixtures/week-board/fixed-layout.json`, `scripts/check_board_layout.py`, `docs/PUBLISH_BOARDS.md`

## Verification
- **Phase 0:** the comment-loss repro fails before the fix and passes after. The every-button run is green, with stored rows read back.
- **Phase 2:**
  - Unit tests on `_view.ts` covering empty, partial, late, stale and all-done weeks.
  - An invariant test: every unfinished piece and the week has a `next_action`, and an all-done week renders "Week done".
  - Playwright runs on the 16 Nov fixture at 390px and 1280px:
    - every open action saves and reads back;
    - a failed save keeps the draft;
    - a cookie killed mid-press recovers through the unlock sheet;
    - the stream pushes a change into an open page within 5 seconds.
- `npm run verify` and `npm run check:board-layout`, then a separate `reviewer` agent before the push. The pull request merges itself through `auto-merge.yml` on green.

## Approval walls
Each of these needs Krish's own words at the time:
- the mock;
- the layout-fixture update;
- switching `/board` over.

Nothing is published or sent on his behalf.
