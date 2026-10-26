# Handover: plan the week of 26 October, then the story and scripts (Sunday 25 Oct)

Krish's ask, word for word: "for the week of 26 October. Sunday is my recording day: build the Ideas tab, then once
I've picked all three days, interview me one question at a time on each piece until its narrative arc is locked,
then the scripts." The first session stopped at the cost guard (G1, 514k tokens of context). Start a fresh session
from this file with `/plan-week`, then `/make-piece` per picked day.

## Done (session_013xRLaNEgcXXYC6fx3j4xJx, branch `ccr-a871eb96-ny473k`, pushed)

- **Last week closed out.** The six stores of the 19 Oct web board were read. Monday's seven ticks are already
  on its record; Wednesday and Friday have no ticks. No queue marks or Combine taps are waiting. Friday 22 Oct's
  `QUEUE fri-2 angle` was his brief for Friday 23 Oct's piece, which is already made.
- **Teleprompter.** `teleprompter_send.py pending` lists Friday 23 Oct (7083d6ad) as not sent. The folder
  "Fri 23 Oct mind.the.gap - Two passports" already holds both cuts, sent by hand: the 5-minute is script
  A79BB1A5-CB21-4404-88AC-2290891CE729 and the 90-second is 7D2740AD-9565-4B67-84CB-5A906279D1F8. He has recorded
  from them, so they were left alone. The record has no line for them. Do not create a second folder.
- **Gather.** `docs/plans/2026-10-26-week/sources.json`: his 0, inspo 45, engine 83, queue 4, no combine groups.
  `.cache/week-board/2026-10-26/queue.json` holds the queue; rebuild it with
  `python3 scripts/engine.py GET /api/idea-queue --full`, stripping the first line (the status code).
- **Inspiration House.** Three routed cards:
  - Claude Duet and his "09 Reading is free. Sending needs a yes." are on Wednesday idea 1. On the second card
    he typed: "It's just good general advice for other topics that are more interesting than this."
  - The models-by-country card is in `accounted`: it became Friday 23 Oct's piece.
  - All three are marked `routed_at` (2026-10-25 12:34 UTC).
- **Ideas tab.** `docs/plans/2026-10-26-week/ideas.json` holds Monday 4, Wednesday 3, Friday 2. Every fact was
  read against its linked source on 25 Oct. Two kill passes by a separate reader; the reasons are in
  `killed-second-pass.json` and the first pass's verdicts are summarised in the commit history.
  - **Monday:** Character.AI (Disney vs Google, his queued angle), Meta ad prices up 14% (SEC filing),
    Microsoft Maia (his queued angle), OpenClaw's $10 million month (wildcard).
  - **Wednesday:** Claude Duet with his three-question test (routed cards), his connectors question (his words,
    17 Oct), Kling 4.0 teardown.
  - **Friday:** Anthropic's junior hiring 27% to 9%, plus Disney's $60m a year for 66 staff. Then OpenAI's agent
    monitoring gap (METR and Redwood report, 22 Oct).
- **Board.** `combine.json` is `[]`. A trial build with the earlier ideas passed `week_board.py --verify` and
  `npm run check:board-layout`. Nothing is published yet.
- **NOW.md** updated, with the North Star check: holds.

## Next, in order

1. **Fill the gaps.** Wednesday needs one more idea, a wildcard. Friday needs two more, one of them a wildcard.
   - Each must be a different story from the day's others, dated inside two weeks of its day (Wed 28, Fri 30 Oct),
     with a so_what a 200-person media, adtech or data leader acts on Monday.
   - Prefer fascinating and aspirational subjects (AI content creation).
   - Fix the notes in `killed-second-pass.json` first:
     - Kling: drop the beat that makes our own test, drop "faces and hands", and replace the dated call.
     - Wednesday 1 and 2 share the Duet page as their hook: give the connectors idea its own hook.
   - Fresh, verified leads not yet used:
     - Jack Clark told the IMF/World Bank meetings that AI-driven discovery is outrunning people's ability to
       follow (Import AI 477, about 21 Oct).
     - Meta's new business terms from 30 Oct, with no opt-out, may let it crawl sites linked to business accounts
       (Nieman Lab, 17 Oct). This could be the connectors idea's own hook.
     - PHP2Shell fixes, 21 Oct (OpenAI's own account).
     - Websites blocking AI agents (The Verge, 17 Oct). Krish passed on the AI-shopper angle on 19 Oct.
   - Never re-offer the AI-designed virus idea: it is biology-adjacent and tripped a model safety filter.
2. **Kill pass on the new ideas.** A separate `reviewer` reader tries to kill only the new ones. The board refuses
   fewer than four ideas a day.
3. **Validate and build.** Run `read_ideas`, `style_problems` and `coverage_problems`; they passed this session
   (see the commit), so run the same checks. Then build:
   `python3 scripts/post-pack/week_board.py --week 2026-10-26 --live --ideas docs/plans/2026-10-26-week/ideas.json --queue .cache/week-board/2026-10-26/queue.json --combine docs/plans/2026-10-26-week/combine.json --target web --out .cache/week-board/2026-10-26/week-board.html`
   Then `--verify`.
4. **Write the week's options.**
   - Create rows for the ideas with `id: null` first: `POST /api/content-ideas`, `source_type` `week_research`.
   - Then `POST /api/week/options` per series, best first, one recommended.
5. **Publish.**
   - `board_web.py publish-web` dry run, then `--apply`; the publish guard asks Krish.
   - In a cloud session the board API answers on the engine's host, so prefix every `board_web.py` command with
     `BOARD_BASE_URL=https://content-engine-flame-nu.vercel.app ENGINE_OPERATOR_TOKEN=injected-by-the-session-proxy`.
   - Register `2026-10-26` under `config/boards.json.web`.
   - Upsert the board item `week-publish-board-2026-10-26` (`closes_on: week_published`).
   - In `WORKBENCH.md`, put the new week's line first and move 19 Oct under "Last week's publish board".
6. **His picks.** Read `picks` and `comments` (`board_web.py read 2026-10-26 picks`). Write each pick as its day's
   rank 1 option.
7. **Per picked day, `make-piece`:**
   - The narrative interview, one question at a time: the question that changes the work most first, with the
     session's best guess, and the next only after he answers. Continue until the end message, the action, the
     checkpoints, the one picture and what is out of scope are locked. Write `narrative-<day>.md` and get his
     words signed.
   - Then the outline (spine and judge), then the scripts.
   - Scripts follow "The Scripts step": open on the hook; close on "Here's what I'd do with this info if I were
     you"; end on "The full deep dive is at makeyourmindup.ai."; `story_check.py` must pass.
   - Read-back by three fresh readers, then the Teleprompter send under his standing yes, then the creative
     direction before he records.
   - Ask his own view for the call beat, in his words.

## Watch out

- It was past midday (his scripts-by-midday rhythm) when this session stopped, so tell him where the day stands
  and offer the fastest path: picks first, then one piece at a time.
- `npm run verify` cannot run in a fresh cloud container until `npm ci` has run: the typecheck has no node types.
  The board layout check passes.
- `engine.py` prints the HTTP status code on the first line of its output; strip it before parsing as JSON.
