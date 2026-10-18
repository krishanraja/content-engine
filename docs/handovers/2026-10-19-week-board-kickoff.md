# Prompt: kick off the week of 19 October

Paste everything below the line into a fresh Claude Code session on `krishanraja/content-engine`.

---

Make **This Week's Publish Board (wC 19 Oct)**: one new board for Monday 19, Wednesday 21 and Friday 23 October,
with a new **first tab, "Ideas"**, holding at least three content ideas for each day for me to pick from. When I have
picked, we start on Monday's piece.

## Read first, and only these

1. `python3 scripts/check_failures.py`, then the entries in `config/failures.json` and `config/learnings.json` dated
   16 to 18 October.
2. `WORKBENCH.md`, "This week's publish board" (the week of 19 Oct already has a board item,
   `week-publish-board-2026-10-19`, and a link made on 18 Oct with options written for all three days).
3. `.agents/skills/plan-week/SKILL.md`, and `docs/prompts/sunday-ideas-tab.md` if it exists.
4. `GET /api/week/options?week=2026-10-19` through `scripts/engine.py` for the options already on the pieces, and
   `GET /api/workbench` for my `said` notes.

## The board

- Title it exactly "This Week's Publish Board (wC 19 Oct)". Tabs in this order: Ideas, Mon 19 Oct, Wed 21 Oct,
  Fri 23 Oct. The Ideas tab shows at least three ideas per day (follow.the.money Monday, under.the.hood Wednesday,
  mind.the.gap Friday), each with its one-line story, why now, its strongest checked fact and where it came from,
  and a pick box I tick. Build it with `scripts/post-pack/week_board.py` (extend it for the Ideas tab; do not hand
  write HTML), store my picks in the board's own store, and write them onto the pieces through `/api/week/options`.
- Publish the same file to every link in `config/boards.json` for the week (add the new week's links there), with my
  yes immediately before the first publish.

## What 16 to 18 October taught us (do not make me say any of it again)

1. **No bare scores anywhere**: article, scripts, captions, cards (house rule PLAIN_SCORES; the article check now
   refuses them). Say a result as a plain comparison, a share or a multiple. A test percentage is a score.
2. **Check a filed date before adding a fact** ("recently Astra" was wrong: GPT-6 Astra came out before the post it
   followed). Never invent; if it is not on file, ask or leave it out.
3. **Fact check**: estimate any paid run from `meter_daily`'s last run, cap it with `max_fresh_sentences`, and get my
   yes. Lines the checker cannot match go to me as a short list with what the filed source says; my sign-off goes
   through `POST .../fact-check {action: 'sign_off'}` (guard G9), never another paid run.
4. **Test the board as I open it before every publish**: open the built board in a browser on each tab; every picture
   loads, every Download saves a real file, Copy article carries its links and pictures. `week_board.py --verify`
   refuses an empty picture; that is the floor, not the test.
5. **Every file a step names links to its current Drive copy**, checked by folder and size; never link a stale copy.
   A video that is not made says so first in every step that needs it, and is named for what it is (the week's
   deep cut is not "the 3-minute video").
6. **The article links its sources from the phrases they back**, traced to the filed evidence.
7. **Titles, headlines and thumbnail words are mine, after I record** (TITLES_AFTER_RECORDING); ask in one round.
8. **Analogies live in the scripts only**; the article and every picture show the real product and real statistics.
9. **Nothing lives only in a container**: commit code and plans, send media to the post's library folder the same
   day, say in `WORKBENCH.md` where each thing is. Working folders reach the library as `working-files.json`;
   music licences travel with their tracks; recordings and library files go up to 2 GiB.
10. **Cost**: this session does the board and the picks only. Each day's piece is its own fresh session started from
    its handover (`make-piece`); Sonnet for renders, packs and board rebuilds; no agents or workflows unless a
    separate reader is needed; never read a board into the chat.

## Done when

The board is published to every link, the Ideas tab holds at least three checked ideas per day with pick boxes that
save, `WORKBENCH.md` names the link, and you give me the link and nothing else to read. After I pick, write the
handover for Monday's piece to `docs/handovers/` and tell me to start it in a fresh session.
