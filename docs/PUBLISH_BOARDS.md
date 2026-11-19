# Publish boards

The one live Publish Board is Control Centre's Content tab (Ruling, Krish, 2026-11-11), drawn from this engine's
view and pressed through its routes; this page says how it is fed and used. The engine's own board pages are retired
for good (Ruling, Krish, 2026-11-13: "We need to retire the old publish boards now permanently"): every old address,
content.krishraja.com/board/<Monday> included, redirects to the live board ("The old board pages are retired for good",
below).

## The workflow in one page (Krish, 2026-11-17)

Krish, 2026-11-17: "distill the workflow i want to be in place down to its simplest form, and [...] ensure that every
single element of the content tab is stable, consistent, predictable and delivers on this at every step of the way".
Every card on every day follows this page. A change to the board that breaks a line here is wrong, whatever else it fixes.

**A piece:** Idea → Approve (ideas board) → Sign the lock → Production picks (look, motion, captions) → Scripts (read,
edit, Approve: they go to his Teleprompter at once) → Record (My takes are in the Inbox) → Production plan (open, review,
swap; docs/production/PRODUCTION_PLAN.md) → Produce (the Claude production prompt) → Approve to publish →
Live. An off-day post follows the same rules on its own path.

1. **One next action, his, from live state.** Read from the records on every view. Never a press he has already made
   (F46). The card never moves back a step unless it says why (a script filed after his approval).
2. **Every press shows its effect at once.** The card moves on, and the press answers in plain words what it did
   (`line`); a refusal says why, in the sheet he is looking at. Nothing fails silently (F47, F49, F50).
3. **His words are his.** Edits are saved, become the words, and survive a closed sheet or a refused save. His Approve
   sends them to his Teleprompter at once; the checks run after and report to him (F49). Only scripts he records go to
   his Teleprompter: his pieces and the voiceovers he records himself. Copy for a carousel, meme or other post is
   approved and kept, never sent there (Ruling, Krish, 2026-11-17: "only scripts i record go to teleprompter"). An
   approval goes stale only when a script is filed after it.
4. **The scripts stay on the card until he has recorded.** Before Approve: Read and approve. After: Edit the scripts
   (his approved words) and Take back my approval. A send that never reached his Teleprompter puts his words back for
   Approve (F50).
5. **His notes first, then the prompt copies.** Every prompt on every card has an optional notes box above it ("Your
   notes"); what he types goes at the end of the prompt and is kept on the board (Krish, 2026-11-17: "there should have
   been an area for me to edit or give my thoughts prior to a prompt button being pressed surely for all cards"). The
   button only copies; a session reports to the board, and the board never waits on a chat.
6. **Plain words.** No script names, no "making record", no failure numbers on the card.
7. **One rule, one result, every card.** A series day's piece, a piece moved to another day and an off-day post at the
   same state show the same step and the same action. A rule lives in one function every card builder calls
   (tests/control-plane/board-every-card.test.ts, board-decisions.test.ts, "the workflow in one page").

## The live board is Control Centre's

Ruling (Krish, 2026-11-11): Control Centre's Publish Board is where everything wires in, live; engine changes upgrade
the board and never break it. His words: "make sure this is built such that when I make other updates to the publish
board and content engine, they do not regress this work, they just elegantly upgrade the publish board in the content
tab. ... your version of the publish board is 1000% where everything wires in to fresh and live and accurately".

- **Where he works:** Control Centre's Content tab, `https://controlcenter.krishraja.com/#/content`, at a week
  and a day with `?week=<Monday>&day=<mon..sat>`. One constant: `config/boards.json` `live_board.url`, mirrored by
  `apps/control-plane/api/board/_liveBoard.ts` (a test holds them equal); Python prints a link with
  `python3 scripts/post-pack/live_board.py <Monday> [day]`. Every link the engine gives him to the board is that one:
  the reply that ends `plan-week`, the week's board item (`week-publish-board-<Monday>`, its `link`), the Sunday ideas
  run, `make-piece`'s links to a day, `WORKBENCH.md`'s week lines and the Claude prompt on every day of the view.
  The address carries no `?ui=next`: Control Centre's rebuilt UI is its default since its cutover (Ruling, Krish,
  2026-11-12).
- **The old addresses redirect.** `content.krishraja.com/board/<Monday>` answers a permanent redirect to the live board
  at that week, and so does every other old board address; no old page is served (retired 2026-11-13).
- **Every press goes through this engine's routes** (`/api/board/<Monday>/...`) from the live board. See "One live
  board", below.

## One live board (Ruling, Krish, 2026-11-11)

Krish, 2026-11-11: "Can we retire and deduplicate everything that's newest on the old board and make sure the new
board has everything up to date and, not only that, is genuinely live?" The audit behind this section is control-center
`docs/plans/ui-rebuild/board/one-live-board-audit.md`.

- **The view carries everything the old board showed** (contract 1.2.0, `_viewExtras.ts`): on each day, every piece
  on it (`pieces`, so a second piece or an off-day piece is never hidden behind the first), the day's options in full
  (`options`: a publishing day's Sunday options, an off day's options with the weekly good news's stories), his
  comments (`comments`), what Growth has posted (`posted`) and his yes (`yes`); on the week, the change signal
  (`revision`). An off-day option the week's plan records as `decided` counts as chosen, and a weekly good news without
  this week's stories (`storiesFresh`: found for a date on or after the Saturday nine days before the Monday, when
  the week's ideas run fills its board) waits on a run, with "Find the stories now" (`saturday-goodnews.yml`, by hand),
  never "stuck".
- **Every press the old board made is in the view** as the action kind `press`: the document the old board saved
  (Pick and the four presses on an idea, Approve, Improve, Reject and Next week on an off-day option, his yes for a
  day, his thoughts on a step, research pasted onto a piece), which the live board saves as it is, filling in only his
  words and the time. The server checks each as before (`validBody`, `preparePress`).
- **Every writer lands where the view reads.** The pieces' records, his presses, Growth's ticks and the week's builds
  are tables the view reads on every request. The week's plan files are read from the week's branch
  `offday-revise/<Monday>` before main, at the commit each points at now (`branchSha`), so a push reaches the board
  in seconds, not after raw.githubusercontent.com's five-minute cache. The week's `ideas.json` is read from both and
  merged from the commit where they split (`mergeWeekPlan`, `mergeBaseSha`): each row, matched by id, and each value
  comes from the side that changed it since, so a session's write to main (a piece's production pick) is never hidden by
  the branch's older copy, and a run's write to the branch is never hidden by main; a value both changed keeps the
  branch's. Without the board's GitHub token the split cannot be found and the branch's copy is read whole. The Sunday ideas run, the good-news run (by hand
  since the Thursday schedule was retired, Ruling, Krish, 2026-11-11), the inspiration piece run and the revise run all put the week's folder on that branch (`scripts/week_branch_keep.sh`: main, then what is on
  the branch, then the run's commit; a fast-forward, never a force), each with a pull request to main that merges
  itself. Nothing builds or publishes a board page any more.
- **Genuinely live.** One row a week, `board_signal` (migration `20261125090000_board_signal.sql`), is bumped by a
  trigger on every write the view reads (`board_documents`, `board_ticks`, `board_weeks`, `content_ideas` by the
  week of its date) and published over Supabase realtime; a writer whose change is a file bumps it with
  `python3 scripts/post-pack/board_web.py touch <Monday>` (`POST /api/board/<Monday>/touch`, the operator's key).
  Control Centre's board listens to it and reads the view again 150 ms later; the ETag keeps an unchanged read a 304,
  and the 15-second poll stays as the fallback. Measured on a local Postgres with the real view builder and parser:
  write to parsed view in about 160 ms, of which 150 ms is the deliberate settle.
- **No old page remains.** From 11 to 13 November the engine's own pages were a read-only archive that refused every
  press; since 13 November they are retired for good and every old address redirects here ("The old board pages are
  retired for good", below).

## The week model: what the publish board draws (contract 1.12.0)

Ruling (Krish, 2026-11-13): the publish board shows only what he approved, in one week model (three pieces and off-day
posts of fixed kinds), one action per item, ideas only on the ideas board, and never the old composer. His words: "The
Publish board is still SO confusing ... I thought this UI was retired and that the purpose of the publish board was now
to either only do an action (for example in GitHub or somewhere else) or copy a prompt to Claude so I can run a session
on it. That session would automatically re-update the board when it was done ... Monday, Wednesday, and Friday are
set-in-stone ideas on that topic: branded, fleshed out, production planned, and then produced. On a Sunday, I decide
where all the off-day stuff goes."

**One model, computed in the engine** (`apps/control-plane/api/board/_weekModel.ts`, the view's `model`). The view
builds it on every read from the days it already gates and stages from the records (the pieces in `content_ideas`
through the ideas gate, the off-day items in `offday_items`, his presses, Growth's records), and Control Centre's
Publish Board draws `model` and nothing else on a day.

- **The week is two kinds of thing.** The three pieces, Mon, Wed and Fri, each on one fixed path, and the off-day posts
  he approved, each of one fixed kind, on one day, on its own path:

  | Path | Its steps | Read from (one place: `PIECE_PATH`, `POST_PATH`) |
  |---|---|---|
  | A piece | Branded, Fleshed out, Production planned, Produced, Live | Branded: his Approve and the signed narrative lock (`story`). Fleshed out: the research on file and the look picked (`research`, `look`). Production planned: the storyboard and both scripts approved (`board`). Produced: both cuts recorded and cut (`after_recording`). Live: out on its channels |
  | An off-day post | Approved, Made, Scheduled, Live | Its stage (`_stage.ts`): his Approve, Growth's made, scheduled and live records, his It's live |

  The kinds are one short list (`OFFDAY_KINDS`), each with one plain name the board uses everywhere: Supporting
  carousel ("Carousel for Friday's piece"), Voiceover short, Explainer, Good news and Meme. A plan names the kind
  (`kind`, `supports`; plan-week `references/offdays.md`); an older plan is read from its format by one rule
  (`offdayKind`).
- **Only what he approved is on a day.** A day's `items` are the piece his approval holds and the off-day options his
  Approve stands on. An idea he has not answered, one a session said was decided that he never pressed (held), a
  revised option and any other suggestion is in `model.ideas`, which only the ideas board draws, with the five presses
  that answer it; a day says only how many wait there (`ideas`). The day's own presses never carry an idea's Approve
  any more, and `yours` holds only his real decisions.
- **One next action per item** (`next`): a press that does the thing (It's live, Approve for publish, a run on GitHub
  such as "Find the other 4 stories") or the one prompt, "Copy prompt for Claude", which names the item and tells the
  session to report back to the board as it works (`writeBack`). Never a page of the archive, never the old look
  picker or review. A live item has none; a scheduled one waits on Growth. An off-day post's prompt also says how it is
  made (`makeRoute` and `routeLine`, `apps/control-plane/api/board/_makeRoute.ts`; Rulings, Krish, 2026-11-13): a
  carousel, a meme or a Notes image in that Claude session, with the Codex plugin building it
  (`docs/CAROUSEL-STANDARD.md`, "How a carousel is made"), and a voiceover short or a meme video on the ve route from a
  Claude session (`docs/ve/ENGINE.md`). Never a scheduled job, a headless model run or a template engine
  (`tests/control-plane/make-route.test.ts`).
- **His decisions on a day** are only his real ones (`decision`): Approve for publish on a made piece, and a choice an
  approved post is still missing (its direction, with the other answers in `others`). Never an idea.
- **Good news is one post, five stories on one topic.** The Saturday item lists its stories in full (headline, what,
  why it matters, source, date) and how many of five it holds (`stories`, `stories_planned`; the board says "1 of 5 stories
  found"). One that holds fewer has as its next action "Find
  the other N stories", `saturday-goodnews.yml` with `fill: off-<day>-<id>`, which fills that approved post to five
  on its own topic and changes none of the words his Approve is bound to (plan-week `references/offdays.md`, "Filling
  an approved post to five").
- **The read sheet** (`read` on every item and idea): its story, why now, the fact, its sources and the research on
  file, read-only, with its one action. Control Centre opens it from a card, and `#/content?idea=<id>` opens it for
  that idea; the old content composer is never reached from the board.

Held by `tests/control-plane/board-week-model.test.ts` on the week of 9 Nov as it stood on Fri 13 Nov (an unanswered or
held option is never on a day; Thu 12's explainer and meme video; Sat 14's one-story good news beside the held
five-story idea; the piece path; one action an item; decisions), `modelProblems` inside `viewProblems`, and the frozen
fixture `apps/control-plane/api/board/fixtures/week-2026-11-09.view.json`, which Control Centre's board specs draw.

## The ideas gate: only his Approve crosses (Ruling, Krish, 2026-11-11)

Krish, 2026-11-11: "Once I've completed it, ideas should either be: filed away for later, rejected and learnt from,
saved as a trend for a wider piece, improved for a future piece cue. If they're approved, they should move into the
publish board. The ideas board-to-publish board process should be bulletproof. I shouldn't end up seeing random ideas in
the publish board that I never wanted there and that I didn't approve to move to the publish board. This process should
be crystal clear, incorrigible, and incorruptible."

**Five outcomes, and nothing else.** Every idea on the ideas board (a publishing day's option, an off-day option,
Saturday's good news) ends in exactly one of five, each a press he makes on the live board. Each press says where it
sends the idea before he presses (`goes`, contract 1.3.0), and its label says the day where it has one:

| Outcome | His press | Where it goes | Stored as | His words |
|---|---|---|---|---|
| Approved | Approve for <day and date> | Onto the publish board on that day: the server places it (`placePick`, or `placeOffday` for a piece he records) | `picks/<day>` with `idea_id`, `so_what`, `story`, `option_sha256`; an off-day option's `idea.verdict: approve` | optional note: what the story must do |
| Filed for later | File for later | Kept with the date; it comes back on a later ideas board, or when he asks | `use: next_week` with `target_week`; off day `verdict: next_week` | optional note |
| Rejected and learnt from | Reject | Kept as a cue the next ideas run reads, and sent to his taste ledger in his words (`ideaReport`, `offdayReports`) | `use: not_for_us` with `reason`; off day `verdict: reject` | his reason, required |
| Saved as a trend for a wider piece | Save as a trend | Kept with the trend he names, for a wider piece | `use: wider_piece_context` with `note` (the older Track it over time, `track_over_time`, reads as a trend); off day `verdict: trend` | the trend, required |
| Improved for a future piece | Improve for a future piece | His note kept as a cue on that idea for a future slate; on an off day the revise run also brings a revised version back to approve | `use: improve` with `note`; off day `verdict: improve` | his note, required |

An idea he approved carries no other press: one idea, one outcome. A day that already has its approved piece offers
every other idea an Approve that says what it replaces and asks where that piece goes (contract 1.13.0, "Replacing a
day's piece, and Move to… on a series piece", below), with the other four beside it. Until 13 November it offered no
Approve at all there, and Krish could not put an idea on a held day ("There is no approve button").

**The record.** Every answer is one row of `idea_outcomes` (migration `20261126090000_ideas_gate.sql`): the week, the
day and date, the idea, the board document and the revision he saved, the outcome, his words, the hash of the option
text he saw (`option_sha256`), `decided_by` Krish and when. The database writes it itself, from `board_history`, only for
a revision saved by Krish through `board_save`; an insert that names no such revision is refused, and nothing in the
table is ever changed, removed or truncated. His presses before 11 November were recorded once from `board_history`
(`source: board_history_backfill`); a pick from then carries no option hash, so its words were not bound and the
board does not pretend they were.

**The gate, in three places.**

1. *The database* refuses to put a piece on a day (`scheduled_for` set or changed, or a piece on a day brought back
   from buried or dropped) unless an approval of his for that exact piece and that exact date stands
   (`content_ideas_board_gate`, `board_approval_holds`, `board_approvals_now`). It is the same for every writer: the
   engine's routes, Control Centre, a session's SQL, a workflow. Taking a piece off a day is never refused. A
   publishing day's approval is his latest pick for that day; an off-day option's is its latest answer, when that is
   Approve; his Approve for publish on a day names its piece too. An approval never covers another idea, another
   day, or (on an off day) a second piece made from the same option. Held by `tests/ideas-gate-db.mjs` on the real
   migration.
2. *The view* draws only the pieces his approval holds (`_gate.ts`, `gatePieces`), each with "Approved by you" and
   when (`pieces[].approval`, and the day's first detail line), and lists every other piece on the day as a held
   line (`held`), never hiding it: "Held: not approved by you" when nothing he pressed put it there, "Held: changed
   since you approved it" when the option's words on the ideas board changed after his Approve (the approval binds
   the words he saw). A held piece that is not one of the day's options carries its own Approve press. Since 1.12.0
   (Ruling, Krish, 2026-11-13) a held line and its Approve are the ideas board's (`model.ideas`), never drawn on the day
   ("The week model", above). An off-day
   option a session wrote as `decided` in `ideas.json` is held too: his words in a session are shown on it and never
   read as his press. When his approvals cannot be read, every piece is held. Held by
   `tests/control-plane/ideas-gate.test.ts`.
3. *Every writer* meets the same refusal: `POST /api/content-ideas/<id>/schedule` answers 409 `not_approved_by_krish`
   without his approval; Growth's read (`GET /api/board/<Monday>/pieces`) hands over only approved pieces and
   off-day options (503 `approvals_unavailable` when they cannot be read, never everything); only he can save a pick
   or a press (`hisOnlyRefusal`: `pick_is_his`, `press_is_his`). A session (plan-week, make-piece, produce-video, a
   workflow, `board_session.py`, the connector) proposes ideas onto the ideas board and never puts one on the
   publish board.

`GET /api/board/<Monday>/gate` (the operator's key or his login, read-only) lists the week's pieces with the approval
that holds each and every held line; `python3 scripts/post-pack/board_gate.py <Monday>` prints it.

What the database cannot tell: a writer holding the service key could still write `board_history` as Krish by hand.
Nothing in a database tells a forged name from his press; the routes refuse every other writer, and the ledger names
the revision every approval came from.

## His typed approval: scripts and locks only (Ruling, Krish, 2026-11-12)

Ruling (Krish, 2026-11-12): "Scripts and locks only. Typed approval counts for locking a story and approving a script;
putting an idea on the publish board still needs your press, so that gate is unchanged." It narrows the earlier "one yes
anywhere" (2026-11-02) for these two decisions and adds nothing else.

- **What a session carries.** His exact typed words, verbatim, with when and where he typed them and the session's link,
  as one board document per day the piece is on (Monday to Saturday, since 14 Nov: a piece he places on an off day is
  still a piece), or his own "Signed." press on the board (Sign the lock): `picks/<day>-lock-words-<piece>` (kind `sign_lock`, bound to the lock he approved by
  `lock_path` and `lock_sha256`, `making.py lock_body_hash`) or `picks/<day>-scripts-words-<piece>` (kind `approve_scripts`, the
  exact words of each cut as the Approve scripts press carries them, with their Teleprompter titles and folder). Written
  only with `python3 scripts/post-pack/board_session.py <uuid> approve lock|scripts ...` (the board session tools, on the
  operator's key); `--sign` also writes his words as the lock's signature line when it has none, so `making.py`'s
  narrative check and the board agree. `_contracts.ts` (`WORDS_ID`, `wordsBody`) holds the shape; a session's document
  with `via: words` anywhere else is refused.
  Each approval is a document of its own piece: `<piece>` is the first 8 hex of its piece id (`wordsDocId`), so two pieces on one day never share one (Ruling, Krish, 2026-11-17: board feedback is done to every day; Tue 17 held two pieces and one approval document). The older day-named document stays readable, for the piece it names only.
- **What it does.** The board draws it as "Approved in your words: "...", Fri 13 Nov (where)" on the day's Narrative lock
  or Scripts line, and the piece's path moves on as for his press. A lock's typed approval counts only while the lock on
  the board is the text his words approved (its hash); a lock he signed in the file shows his signature words the same
  way. Typed approval of scripts goes to his Teleprompter exactly as the Approve scripts press does (`afterPress`,
  `sendApprovedScripts`, held until the scripts' check and two fresh readers have passed); the Teleprompter gate
  (`_teleprompter.ts typedApproval`, `teleprompter_send.py typed_approval`) counts his press or this document, never
  another session's.
  Every send names his Teleprompter folder and scripts by the one rule in `config/teleprompter.json` (`folder_name`,
  `script_title`): "Fri 20 Nov mind.the.gap - <subject>" and "Fri 20 Nov - 5-minute - <subject>". The server works the
  names out itself from the day's date and the piece's series (`teleprompterNames`, `_presses.ts namedByRule`), whatever
  names the press carried, on a series day, a piece placed on an off day and a recorded off-day post alike (Ruling,
  Krish, 2026-11-17: "it doesn't name it correctly under the right naming convention"). A piece whose folder is already
  on its record keeps that folder: the engine never renames a folder or moves a script (`config/teleprompter.json`
  never), so a folder named wrongly before 17 Nov is renamed by Krish in the app.
- **What it never does.** Put an idea on the publish board: his Approve on an idea (`picks/<day>`), his answers on the
  ideas board (`queue`), and the database's gate (`idea_outcomes`, `content_ideas_board_gate`) are unchanged and stay his
  presses alone (`hisOnlyRefusal`: `pick_is_his`, `press_is_his`). Nor any other decision (titles, publish, cuts, the
  production gates).
- **His words must name it** (Ruling, Krish, 2026-11-17). A typed approval counts only when his words say "approve",
  "approved", "approval", "sign" or "signed" (a lock also "lock it"; `_contracts.ts` `APPROVAL_WORDS`, `LOCK_WORDS`,
  in `wordsBody`, so the board, `_teleprompter.ts typedApproval`, `teleprompter_send.py` and `board_session.py` hold the
  same rule). "Merge all to main and then let me know when all done, ready in teleprompter for me" was carried as an
  approval of Tue 17's voiceover script and was not one; since this rule it does not count.
- **Taking it back** (Ruling, Krish, 2026-11-17). His Take back my approval press, or his typed words that name it
  (`TAKE_BACK_WORDS`: take it back, undo, reopen, unapprove, withdraw, revoke, edit), saves
  `picks/<day>-<lock|scripts>-back-<piece>` (kind `take_back`, `approved: false`, `backBody`). Every approval of that
  piece's lock or scripts made at or before it stops counting (`takenBackAt`); a newer approval counts again. The
  `approvals` view carries it, so `teleprompter_send.py` reads it as a withdrawal; Teleprompter keeps what it has. A
  session writes one only as his words (`board_session.py approve scripts --take-back`); a press-shaped one is his
  alone (`take_back_is_his`).
- **The scripts are on every card** (Ruling, Krish, 2026-11-17: "I want the board in a state where I can see the script
  and edit it, and then press approve"). Filed and not approved, the card offers Read and approve the scripts (the
  review he reads and edits in place); on an off-day post he records, that is the card's next action. Approved, the
  card keeps Edit the scripts (the same review, whose Approve approves the words he leaves) and Take back my approval
  beside its own action (`scriptsOnCard`, applied to every card the week model draws). A new approval goes under the
  piece's own document name; the bare day-wide name is refused for writes.

Held by `tests/control-plane/board-typed-approval.test.ts` (the shape, who may write it, a typed approval that places
nothing, the Teleprompter send, the board's words) and `tests/board_session_test.py`.

## His instruction: a ticked inspiration card (Ruling, Krish, 2026-11-12)

Krish, 2026-11-12: "In my inspiration board can I have an option to tick a box that states that this isn't just random
inspiration but it's an actual instruction that needs to be followed (or made into a piece urgently), or a production
style that should be mimicked within the next week? We can turn some inspiration into actual action immediately and jump
the queue." Ruling (Krish, 2026-11-12): an inspiration card he ticks is an instruction that jumps the queue: Content
means make it into a piece now, Production means use the style within a week.

The tick is Control Centre's: one row of `inspiration_actions` (control-center migration `20261128093000`), set only by
his press in its Inspiration place (control-center `docs/app/inspiration/README.md`, "Act on this"). This engine never
creates, drops or closes one.

- **Content: a piece now.** His press sends this repository one `repository_dispatch` (event `inspiration-piece`,
  `client_payload` `{action_id}` only), the shape of the board's "Find the stories now" press. It is his press, never a
  schedule: `.github/workflows/inspiration-piece.yml` has no cron, so the scheduled jobs that may touch a board are still
  the ones in AGENTS.md. Claude Code runs on his subscription and follows
  `.agents/skills/plan-week/references/inspiration-piece.md`: it reads the tick, his words, the card and its reading
  (`GET /api/inspiration/actions?id=`; the brief stays in `.scratch/`, never committed), researches, and writes one
  idea through the normal idea path (the floor, the copy lint, the kill list, a row through `POST /api/content-ideas`
  as `week_research`) for the planning week Control Centre's To approve shows, on the earliest open day whose series it
  fits, else as a recorded off-day option. `scripts/post-pack/inspiration_act.py place` appends it to its day in
  `ideas.json` after the day's other options (their press ids never move), marked `from_inspiration` with his tick and
  the card, the card in its `covers`; `board_feed.py gate` must pass; the workflow keeps `ideas.json` on the week's
  branch, then `inspiration_act.py offer` offers it for its series through `POST /api/week/options` on top of the day's
  four (`inspiration_action`, one a day, `MAX_INSPIRED`), and the run reports its own state on his tick
  (`POST /api/inspiration/actions`, the operator's key: running, then drafted with the idea, or failed with the reason
  in words, which Control Centre shows on the card and in To approve with Try again). Control Centre lists the idea
  first in To approve, with the card's preview and its Drive link.
- **His idea file goes on the piece.** Krish, 2026-11-17: "The research needs to stay concretely bound to the idea as it
  travels through this UI in to the ideas board, then in to the publish board. nothing should ever get lost." A
  Markdown idea he adds on Control Centre's Inspiration ("Add an idea") is filed in his Drive and its text written as
  the request's reading (`content_reads`, `engine_rev` `control-center-idea`), which the brief carries. When the run
  reports his tick drafted on a new piece, `POST /api/inspiration/actions` files that reading on the piece as
  `research` through the materials store (`addText`, `source_ref` `inspiration_actions:<id>`, by "Inspiration tick")
  and copies it to his research library, so it is on the piece's shelf on the ideas board and the publish board
  without depending on the run's model (`researchToFile` in `api/inspiration/_actions.ts`). Only his own idea files,
  never a fetched post's reading; once per piece; a filing that fails never fails the report, and the answer's
  `research` says what happened. Tests: `tests/control-plane/inspiration-actions.test.ts`.
- **The gate is untouched.** The idea waits for his Approve like every other; the run never sets a day, saves a pick or
  writes `decided`, and the database refuses any other placement. `tests/ideas-gate-db.mjs` tries it: an idea his ticked
  card made is refused a day by the run's own write and by a pick the run saves, and placed by his Approve only.
- **His tick outranks an older refusal.** Ruling (Krish, 2026-11-12): his own tick outranks an older refusal; the idea
  comes to him with the refusal shown, and only his Approve places it. `place` finds each refusal the idea is on
  (`board_feed.tick_notes`, the same match as the gate) and writes it onto the option as `refused_before` (the
  subject, his words exactly, the day, the ref); the board's view says it first on the option ("Turned down before: on
  3 Nov you said ...", `tickNote` in `_viewExtras.ts`) and `offer` says it first in the week option's pitch, which To
  approve shows. The gate prints it as a `his tick:` line and never fails on it. Every idea the engine proposes on its
  own keeps the gate exactly as it was. The run's gate answers only for what the run added (`gate --base`, the week's
  ideas before the run): what the week's own options already had is printed as "on the board before this run" and
  never holds his idea. Every line says which refusal matched and why, and the run prints them all. On 12 Nov his tick
  ("what kind of human qualities are going to result in job loss versus succeeding") was held because the 16 Nov
  board, made before the gate existed, already failed it on its own Infosys Monday and two off-day returns; his idea
  matched no refusal.
- **Production: the style within a week.** An open Production tick comes first among the cards `ve init` offers a cut
  (`GET /api/inspiration/candidates`, for the roles it teaches, else look, motion and captions; a card teaches a role
  by his word first, then by the engine's read grounded in his words, then by a bare guess), with its
  `instruction` `{action_id, due_at, words}`. The next fitting cut names it in `brand.references` (failure F26's path,
  `.agents/skills/ve/references/board-references.md`), and `ve verdict` records the use in `card_uses`, which closes
  his tick in Control Centre (its done-check, `inspiration_act`). Growth reads the same tick in its directive (protocol
  1.21.0). Past its day and unused, Control Centre's Publish Board says so in one line.

## Moving an off-day item to any day (Ruling, Krish, 2026-11-12)

Ruling (Krish, 2026-11-12): any off-day post or idea moves to any day at his press, and the move updates every place
that names its day. His words: "I should be able to fluidly reassign any off-day post or assign any off-day idea to any
day at will, and that should update the single source of truth everywhere."

**One place says which day an off-day item is on: `offday_items`** (migration `20261129090000_offday_items.sql`). One
row per item, versioned: what it is (its option as shown), where it came from (`engine`, the week's `ideas.json`;
`growth`, Growth's own options) and where it is (`offered` on a day, `approved` on a day, `later` in his Ideas for Later,
`withdrawn` when Growth took back a proposal he never pressed). The week's `ideas.json` is the plan's starting point
only: an engine option no press has touched sits on the day the plan offered it (state `slate` on the board); once he
approves it, moves it or files it for later, its row is where its day lives and nothing in `ideas.json` moves it again.
Every off-day approval that stood on 12 November was given its row once. An item's key is
`<engine|growth>:<the week it was first offered>:<option id>`.

**Move to… on every off-day item**, approved or not, made or not, live or not yet live, on every day of the board and in
his Ideas for Later (`options[].move`, contract 1.9.0, `_offdayItems.ts` `moveSpec`; each off-day idea for later in
`GET /api/board/later` carries the same `move`, by its row when he sent it back to later, and an idea his move put on a
day leaves that list): every day from today through
the next four weeks, never a past day and never a Sunday (Sunday is a rest day), its current day marked; a series day
is a day like any other (Krish, 2026-11-12: a publishing day can carry off-day posts), and a day may hold several.
"Back to Ideas for Later" takes it off its day. Two limits, each said on the picker: a week's good news stays in its own
week (its stories are that week's), and a piece he records goes out on a Tuesday, Thursday or Saturday.

**One write: `POST /api/board/<Monday>/move`** `{item, version, from, to: {date} | "later"}`, his press only (403
`his_press` for anyone else). `moveItem` reads where the item is and its words as the board shows them, refuses a
stale version (409 `stale`, "It moved elsewhere a moment ago"), a past or Sunday date, a day past four weeks, and a
day whose own plan already offers the same idea (409 `day_has_it`), then calls `offday_item_move`, which in one
transaction:

1. takes his approval off the day it leaves: the same `queue/off-<day>-<option>` document saved again with no verdict
   on its idea and `moved` saying where it went, which `idea_outcome_record` reads as `withdrawn`; back to his Ideas for
   Later it is his File for later (`verdict: next_week`, outcome `filed`);
2. saves his Approve for the new day: `queue/off-<newday>-<option>` in the new week, bound to the words shown
   (`idea.sha256`, `idea.shown`), his direction, mock and note on it carried over, and `moved` saying where it came
   from. Moving an idea he never pressed onto a day **is** his Approve for that day;
3. moves the row (its version goes up by one) and, for a piece he records, `content_ideas.scheduled_for` with it;
4. keeps the move, append only, in `offday_moves`.

The gate holds on the row as on `content_ideas`: a row is `approved` on a day only while his approval for exactly that
document on exactly that date stands (`offday_items_gate`, `board_approval_holds`), so a session, Growth or a workflow
cannot put an item on a day or re-date it, and a row he placed is moved by nobody else (`his_placement`). Any part
refused (a revision changed under it, no approval standing), none of it lands. His board's own Approve on an off-day
option writes the row the same way (`syncApprove`, in `afterPress`). The answer carries `line` (what it did), `undo`
(the same press back: to the day it left, back to an idea offered on its old day, or back to later; an Undo may name
a day now past, and only the one the move before took it from) and `followed`.

**Every place that names the day follows the row.**

| Place | How it follows |
|---|---|
| The live board (Control Centre's Publish Board) | The view reads the rows (`readItems`, `dayOptions`): the item leaves the day it left and shows on its new day, in its new week; both weeks' `board_signal` is bumped by the board documents and by `offday_items_signal`, so both boards read again at once |
| Growth's read of what to make and post on which day | `GET /api/board/<Monday>/pieces` hands an approved option over only on the day its row says (`placedHere`), with `item`, `version`, `date` and `moved_from`; 503 `items_unavailable` when the rows cannot be read, never a day that may be stale. Growth binds each approved option to the board's day, not the day it first planned |
| The post's folder in Drive (3 Posts) | Renamed by its ID to the new date and day ("2026-11-12 Thu off.day - AI agent not set up" moved to the 19th becomes "2026-11-19 Thu off.day - ..."), so every reader that reads it by ID keeps it and the board files it under its new week (`followDrive`, as the owner of his Drive with the `drive` scope); never moved to another folder, never one outside 3 Posts, kept as it is when the item goes back to later. `followed.drive` says what happened |
| The research library's index | Every `00 Index` row naming a piece he records takes its new Week, Day and Piece cells, under the library's one lease (`_offdayLibrary.ts`). An off-day post with no piece has no research rows of its own |
| A post Growth already scheduled on a platform | This engine never moves a post on a platform. Growth reports what it has scheduled for each item (`POST /api/board/<Monday>/offday-posts`, below), and until Growth's approved route moves it, the item says so plainly: "Still scheduled for Tue 17 on Instagram: move it there too" (`options[].elsewhere`, and the move's answer) |

**Growth's options come in through the same place** (`POST /api/board/<Monday>/offdays` on Growth's key, the
`growth-offdays/1` file `growth.py mix offdays` writes, or `growth-offdays/2` `{week, options: [{id, day, copy, format,
source, ...}]}`): each becomes a row offered on its day (`offday_items_offer`), shown on the board with its kind and
source and with every press a plan option has, Move to… and Approve included. A row he has pressed is never touched by
Growth; a Growth option no longer in its list and never pressed is `withdrawn`, never deleted. Sunday options and an
id the week's own plan uses on the same day are left out, and the answer says each one and why. `GET
/api/board/<Monday>/offdays` gives Growth back where every item is now.

**Growth writes its own off-day posts back to the same place** (`POST /api/board/<Monday>/offday-posts` on Growth's
key, `reportPosts`; migration `20261129100000_offday_items_posts.sql`). An off-day post has no piece, so the older
write-back (`/posted`) could not take it: Tue 10 Nov's carousel went out on six channels and the board still said "With
Growth". Growth reports, from its own posting record, `{posts: [{option (off-<day>-<id>) or item, state, channel,
due_at, url, at, buffer_post_id, drive?}]}`: `made` (its files are in its post folder; `drive` names the folder when
the item has none yet), `scheduled` on a channel for a time, `live` on a channel with the post's own link, `cancelled`
(a scheduled post taken back). It is merged into the item's record (`posts`): one made, and per channel its latest
scheduled or live post; a live post is never undone by a later scheduled report. Live needs the channel and the link,
and Growth never reports a post it did not post. The board shows it: the option's `posts` (contract 1.9.0), the day's
`posted` (`by: growth`, with each link), the day's line ("Approved. Growth made it", "Growth scheduled it on Instagram,
TikTok"), and an approved option Growth reports live makes the day done ("Live on Instagram, TikTok. Growth posted it,
Tue 10 Nov, 13:25") with no It's live left to press.

Held by `tests/offday-items-db.mjs` (the migration on PGlite: no day without his press, a move whole or not at all,
Growth never over his row, moves append only) and `tests/control-plane/board-move.test.ts` (the one write, the route
his press only, a move read back from the view, Growth's read, the Drive folder, the library and what is still
scheduled, and Growth's own made, scheduled and live posts making the day done).

**Growth asks the judges here too** (`POST /api/board/<Monday>/judge` on Growth's key; Ruling, Krish, 2026-11-12:
"Judge them; count passes."): every carousel and Short is judged by the draft judges' panel before Growth makes it, a
pass is bound to its Buffer post, and every sent post is reported so the judged ones count as live
(`docs/GROWTH-HANDOFF.md`, "Every carousel and Short through the 10/10 judges"; `asset_judgements`).

## One post, one item (Ruling, Krish, 2026-11-12)

Ruling (Krish, 2026-11-12): the board shows exactly where everything is, and one post is one item that can never sprawl
across days or go stale. His words: "Make sure the publish board is completely up to date with exactly where everything
is at ... I expect Sunday's ideas board to be epic and everything to be not only up to date but impossible to sprawl over
time."

**Why.** An item's key names the id it was first offered under. On 11 Nov a session moved Tue 17's POV meme
(`povteach`) to Thu 12 by deleting it from the week's plan and writing the same post again as `agentnotsetup`. His
Approve (10 Nov) still stood on Tue 17, so the one post sat on two days.

**What a post is.** An off-day option is known by what it is, never by the id a session gave it (`_onePost.ts`
`postKeys`; the database's `offday_post_keys`, migration `20261130090000_offday_one_post.sql`, computes the same keys,
held equal on `tests/fixtures/one-post-keys.json`): the item it names (`"item": "<key>"`, how a re-plan that carries an
item says so), its hook in plain lower-case words (12 characters or more; a weekly hook such as Saturday's good news is
keyed by its week too), its post folder in Drive, and the one public post or video it reposts (YouTube, Instagram,
TikTok, X). An article it cites is never its identity: two posts may cite one article. Options sharing any key are one
post.

**Never on two days.**

1. *The database* refuses a second item of one post on a day (`offday_items_one_post`): two rows offered or approved
   that share a key cannot both stand, whoever writes (a move, his Approve, Growth's offer, a session's SQL). Growth
   offering a post he already has is `taken`, never written.
2. *His Approve carries the one item.* His Approve on an option that is a post already an item somewhere (on a day or
   in his Ideas for Later) moves that item there under the option he approved (`syncApprove`, `carry`): his approval
   comes off the day it leaves (the same document saved with `moved`, recorded as `withdrawn`), in the same transaction
   (`offday_item_move`, which now takes the option id of his press, and only for the same post: `not_the_same_post`).
   Nothing is copied and nothing of his is deleted: both presses stay in `board_history`, the carry in `offday_moves`.
3. *The view draws the post once.* A plan option that is the same post as an item on its own day is not drawn beside
   it; on another day it is that item (`options[].item` is the item's, `same_post` says where it is and its Approve's
   `goes` says "Moves the one post here from Tue 17 Nov ... It is never on two days"), and the day the item is on says
   where else it is up as an idea ("Thu 12 Nov also has this post up as an idea (agentnotsetup). Your Approve there
   moves it there, so it is only ever on one day."). Growth's posts on an item show on the day the item is on only.
4. *The week plans* carry no post twice under two ids (`duplicatePosts`, `tests/control-plane/board-truth.test.ts`,
   in `npm run verify`): a session never moves a post by copying it; a re-plan names the item it carries (`"item":
   "<its key>"`, as Thu 12's `beststicker` names Tue 17's `auditrule`), and the option it carries leaves its day on the
   live board (`carriedItems`), unless a press of his stands on it. A session's `closed` words alone never take an idea
   off his board.

Held by `tests/offday-one-post-db.mjs` (the migration on PGlite, in CI) and `tests/control-plane/board-one-post.test.ts`.

## The current state, and nothing stale (Krish, 2026-11-13)

Krish, 2026-11-13: the Publish Board "fully up to date with no glitches, errors, duplicates, or fragmentation in the data
pipeline", showing "the current state of affairs on what needs to be done". Five rules, each from a glitch the live board
showed that day (`tests/control-plane/board-state-truth.test.ts`):

- **A day is Done only when every item on it is live** (`dayLine`). Fri 13 Nov said "Done: everything on it is live"
  because its piece was out, while two approved posts on it were not. A day with some out says "1 of 3 live. 2 items in
  progress."
- **The ideas board asks only what still waits on him.** An idea for a day that has passed, and an idea that is the same
  post as an item already out or scheduled, leave `model.ideas` (Thu 12's "POV: your AI agent..." still asked for his
  Approve after the one post went out on Fri 13), and a piece his approval already holds on a day of the week (Fri 20's
  "Voters just said no to AI's power bill" still asked for his answer after he moved that piece to Tue 17). The plan
  keeps every one; only the board stops asking.
- **A narrative lock follows its piece, never its day** (`lockOf`, the lock's `piece_id:` line). On 13 Nov Fri 20's piece
  was replaced and moved to Tue 17 (his words, in the session: "chose Tue 17 Nov for the data-centre piece"); the new Fri
  20 piece read as Branded from the lock he signed for the one that left, and the moved piece lost it. A piece moved to
  another day keeps its lock and says it was missed when its day passes. Every day's `narrative-lock-<day>.md` is read
  (`LOCK_DAYS`), so the data-centres piece's lock on Tue 17 counts there.
- **A send Buffer recorded closes its item by itself.** Control Centre's done-check sweep (`DONE_CHECKS.buffer_sent`,
  ADR-036) reads Buffer's sent and scheduled posts on the seven Make Your Mind Up channels and reports each one it can tie
  to an approved off-day item to `POST /api/board/<Monday>/offday-posts` as `client: done_check, check: buffer_sent`.
  Each post keeps `check: buffer_sent` and its Buffer post id as the proof (the public link where Buffer gives one; a live
  post with no link is taken from a check only by its Buffer id), Growth's own entry on a channel always wins, a replay
  writes nothing, and the day says "Live on Instagram, Facebook. Buffer shows it sent, Tue 10 Nov, 12:34". Until then a
  post a session scheduled by hand in Buffer never reached the board: Growth's `board posts` reports only the posts its own
  derived slots made (it reported 0 on 13 Nov while Buffer had sent four of the week's posts).
- **Scripts agreed before the production pick never skip it** (Krish, 2026-11-13: "I've already agreed the scripts for
  Monday, Wednesday, and Friday and just need to pick and lock down the rest of the production before I get recording").
  Until a take is recorded, a piece with its scripts approved and no look is at its look: the card says "Branded. Scripts
  approved. Pick the look", and its one action is the press **Pick the look** (contract 1.14.0, `op: look`, `POST /api/board/<Monday>/look`,
  his login, the looks to choose from with the recommended one first), his decision for the day. Once picked, the next
  step is recording from his Teleprompter. A take already recorded is never sent back to the look.
- **His whole production pick, one press each, on every piece before recording** (contract 1.15.0, `lookPresses`):
  **Pick the look** (the treatment, `op: look`), **Pick the motion style** and **Pick the captions** (`op: style`, the
  engine's style route), each with its options, the recommended one first and marked, the one he picked marked, a
  motion style ve cannot draw yet marked "not ready yet" and listed last (the style press refuses it; Krish, 2026-11-17:
  "Mark them and build all nine"), nothing he said Not this to. At the look step the look leads
  and the other two wait in the read sheet; at an earlier step (a lock still to sign) all three wait in the read sheet,
  so he can pick before or after he signs; a piece moved to an off day (Tue 17) has the same three, from its own record.
  The recommendation a session makes for a piece is its row's `style` in the week's plan (`production`, `motion`,
  `captions`): named there, it is the one recommended, first, in place of the channel's own three. When it cannot be
  recommended (he said Not this to it, called it not for us, or ve cannot draw it yet), the plan's next choices
  (`motion_alternatives`, `captions_alternatives`, `production_alternatives`) are tried in order, and the one that stands
  says why ("its first, Living screen, is one you said Not this to"); only when none stands are the channel's own shown.
  A session writes the row on main as usual: the board reads main and the week branch together (below), so its write
  reaches the card at the next read (Ruling, Krish, 2026-11-17: "Why do recommendations in my UI never adapt to the
  piece?").
- **A post scheduled after its day says when it goes, never Missed** (`postedStage`): Fri 13's "Your AI thinks it's the
  best" was scheduled in Buffer for Tue 17, so its card says "Scheduled on Instagram, X for Tue 17 Nov, 08:30, after its
  day (Fri 13 Nov)". Its day on the board moves only with his Move to…. A schedule whose time passed with no send is
  missed, as before.
- **His "Signed." is one press on the board, on any day the piece is placed.** A piece whose narrative lock is written
  under the day it is on and not signed offers **Sign the lock** (his words, "Signed.", saved as his typed approval of the
  lock as it stands, `picks/<day>-lock-words-<piece>`, bound by the lock's hash), with the lock to read in its read sheet. The
  typed-approval route takes any day from Monday to Saturday (`WORDS_ID`): a piece he moved to an off day with
  `place_piece` (Tue 17's data-centres piece) is still a piece. His words there sign it on the board; the producing
  session writes the signature line into the lock file (`board_session.py approve lock --sign`) for `making.py`'s gate.
- **His approval in a session reaches the record.** Every copied prompt for a piece now says to file his typed approval
  of the lock or the scripts at once with `board_session.py <piece> approve lock|scripts` (`APPROVAL_RULE`): on 13 Nov he
  had agreed Mon 16's and Wed 18's stories and scripts in sessions, and the board said "No approved scripts are filed yet",
  because the approvals stayed in the chats and in draft files the board never reads.

## Replacing a day's piece, and Move to… on a series piece (contract 1.13.0)

Krish, 13 Nov 2026, on the live board, trying to put "The Great Recount" on Fri 20 and bring Fri 20's data-centre piece
forward: "There is no approve button. I have to click through five different fucking pages for one idea, even though
there are actually many ideas." Earlier the same day: "the great recount should be for 20 Nov, and the current 20 Nov
piece should be brought forward as it is time sensitive", then "approved on both, get it done". The cause, read from
the live API that day: Fri 20 held his pick of 9 Nov, so its options offered no Approve; Ideas for Later offered the
idea only "Approve for Friday 27 Nov" (the next free Friday); Move to… existed only for off-day items; and nothing could
replace a day's pick. Two presses close it, each his only, each one transaction (`_seriesMoves.ts`; migration
`20261201100000_series_piece_moves.sql`).

**Approve on a day that already holds a piece.** Every idea on a held series day, and every idea for later on each
date of its weekday that holds a piece (`replaceTargets`, four weeks ahead), carries an Approve that says what it
replaces: "Approve for Fri 20 Nov, replacing <title>". Its `choose` (written at `current_to`, one value, required) asks
where the current piece goes: any day a move may go to (a date), `later` (his Ideas for Later), or `alongside` (it
stays on the same day beside the new one). The press is `op: "replace"`: `POST /api/board/<Monday>/replace` with
`{day, revision, pick: {pick, idea_id, series, story, so_what, option_sha256}, replaces: {item: "piece:<id>", version},
current_to, note?, at}`. 403 `his_press` for anyone else. It refuses words that changed (`changed_words`), a stale pick
or piece (`stale`), a piece no longer on that day (`not_on_day`), an idea already on another day (`new_elsewhere`), and
a past day, a Sunday or a day past four weeks for the old piece. One call to `series_piece_place` then:

1. saves his pick for the day (`picks/<day>`, the same body his Approve saves, with `replaced`), which idea_outcomes
   records as `approved` via `pick`;
2. writes the old piece's placements: alongside, `picks/place-<day>-<id>` `{kind: place_piece, placed: true}` on the
   same day; another day, `placed: false` on the day it leaves and `placed: true` on the day it goes to; later,
   `placed: false, later: true`, his File for later on it (outcome `filed`);
3. moves both pieces' `scheduled_for` (the new one into the series and in flight, as `placePick` does), each guarded
   on the `updated_at` the board read; the content_ideas gate checks his approval for every new day;
4. keeps the move, append only, in `series_moves`.

Any part refused, none of it lands. The research library's index rows then follow each piece that moved
(`libraryFollower`). The answer carries `line` ("Approved for Fri 20 Nov. "<title>" moved to Tue 17 Nov, approved for
that day.").

**Move to… on a series piece.** Every piece his approval holds on a day carries `move` (`days[].pieces[].move` and the
model's piece item `move`), the same shape as an off-day item's: `item` is `piece:<id>`, `version` is the piece's
`updated_at` in milliseconds, `days` runs from today through four weeks, never a past day and never a Sunday, and
`later` sends it back to his Ideas for Later. The Tuesday, Thursday and Saturday limit is for a piece recorded on an off
day; a series piece goes on any other day, and its picker says so (`note`). It posts to the same route as every move,
`POST /api/board/<Monday>/move` `{item, version, from, to: {date} | "later"}`, which hands a `piece:` item to
`moveSeriesPiece`; a piece that is out, buried or an off-day item (its own row moves it) has no `move`. The answer
carries `undo`, back to the day it left, a day now past included only when it is the day his last move took it from.

**The gate holds.** A placement is his approval only from a revision Krish saved (idea_outcomes, via `placed`), and
`board_approvals_now` lets a placement supersede every earlier approval of the same piece in that week on another
document: once he moves a piece, the pick that first put it on a day no longer holds it there, so a session cannot put
it back. A placement is never written through the plain document route (`PUT /picks/place-*` answers 400
`place_is_its_own_press`); `series_piece_place` refuses a call that names any actor but Krish (like `board_save`, it
trusts the actor the route names, and the routes name Krish only for his own press) and any document but a day's pick
(only with a replacing Approve) and placements. A piece kept alongside keeps his approvals on that day (its Approve for
publish); a piece moved to another day needs his Approve for publish again there. His Approve again on a day a piece
was moved from, with the same words, records a new approval. Held on the real migration by `tests/series-moves-db.mjs` on every pull
request, and the routes by `tests/control-plane/board-series-moves.test.ts`.

**What Control Centre reads.** An option's or idea's `actions[]` press with `op: "replace"`: draw it as an Approve
button with its `label`, show `goes`, ask `choose` (one of `options[]`, `value` a date, `later` or `alongside`; draw the
dates as the Move to… picker draws `days`) and `words` (the optional note), stamp `at`, and post `body` with
`current_to` set to the value chosen, to `/api/board/<week>/replace`, where `week` is the press's own `week`. A piece's
`move` is drawn with the same Move to… component as an off-day item's. A day may now hold more than one piece (one moved
there, or one kept alongside): `model.days[].items[]` lists each as its own `type: piece` item.

## Where everything is: one stage per item, and a missed day says so (contract 1.10.0)

Every off-day option and every piece on a day carries exactly one `stage` (`_stage.ts`), from the records and never typed
by hand: `idea` (on the ideas board, with his answer when he gave one; with no outcome on record, its status in his words:
rejected, filed, saved as a trend, improved or revised), `approved`, `made` (Growth's record, its post
folder holding files, or its cuts), `scheduled` (Growth's record, with when), `live` (Growth's record, his It's live or
the piece's own record, with each post's link) or `missed` (its day passed and it is not marked live). Back in his Ideas
for Later is the sixth: such an item is not on a day, so `GET /api/board/later` draws it.

A publishing day's approved option is the day's piece, so it carries the piece's one stage (Wed 11's approved option
read "Missed" while the day was published on every channel, until 12 Nov). A day before today that is not out is never
"with Growth" or "ready": its `who` is `missed`, its line says "Missed: Tue
10 has passed and nothing on it is marked live. If it went out, press It's live with its link", It's live leads, and its
line from before is kept in `detail` ("Before its day passed"). Carrying a missed item to today is today's To approve.

**Late, for one day** (Ruling, Krish, 2026-11-18: an item not posted on its day goes back to its step, My takes are in
the Inbox, and is marked late for a maximum of one day; Missed had blocked him from moving forward with anything). The
day after its own (`LATE_DAYS`, `lateOn` in `_stage.ts`), a day or item not out keeps its own stage, `who` and next
step, and its line leads "Late: Tue 17 passed. It stays on its next step until the end of Wed 18 Nov, then it is marked
missed." A scheduled or live item never says Late. From the second day after (`missedOn`) it is Missed, as above.

**A piece's scheduled posts.** `POST /api/board/<Monday>/offday-posts` (Growth's key) also takes a piece's own entries,
`{piece_id, day, state: scheduled | cancelled, channel, due_at, buffer_post_id}`, each kept on the day's box for its
channel (`board_ticks` `<day>-<channel>`, `done` stays false, `scheduled`); a box already out is never touched, and the
piece must be on that day. A series day approved for publish then says "Approved in your words. Scheduled: Substack
Notes, from Fri 13 Nov, 12:40" in place of "Ready to post", and its piece's stage is `scheduled`.

**What is not filed yet is said, never guessed.** A series day's detail carries Scripts (approved by him on the board,
written and waiting for his Approve scripts, or not filed yet: none on the record and none sent to his Teleprompter), and
a step he settled in a session the engine cannot see is never shown as done: the line says what is not filed ("No
narrative lock and no approved scripts are filed yet. If you settled them in a session, file them from that session; if
not, settle the story in a short session and sign the narrative lock").

`viewProblems` runs `truthProblems` on every view the tests build: no option or piece without a known stage, no item on
two days, no past day with Growth or without "Missed". Held by `tests/control-plane/board-truth.test.ts`,
`board-one-post.test.ts`, `board-scheduled.test.ts` and `board-its-live.test.ts`.

## What he refused stays refused: the ideas board's checks in code (the ideas quality plan, Wave 1)

Krish, 2026-11-09: "I just said that Infosys is boring so why did you make the piece about Infosys?" The Sunday run's
ideas are checked in code before the week goes on the live board (`scripts/post-pack/idea_checks.py`, run by
`board_feed.py cover` and `board_feed.py gate <Monday>`; `.github/workflows/sunday-ideas.yml` keeps the week off the
live board while `gate` fails). Each check enforces a rule already live or his own words on that item:

- A subject he rejected (his Reject, a not-for-us cue, a Drop) is not offered again, unless an option answers his own
  ask, he raised the subject again, or he gave it back. The veto keys on the subject his refusing words share with the
  option he refused, never every name an option carries.
- Refusing words in another press (boring, lame, no point, don't understand) put a warning on the option, his words
  first in its text, and it is never first on its day; it blocks only once he approves P6.
- An idea he filed, saved as a trend or asked to improve comes back only with his words, an answer to each question he
  asked, a source newer than his press, changed copy and a research prompt; otherwise it is held with its reason.
- From the 23 Nov board every publishing-day option opens on one plain question (`pitch.question`, drawn as its title),
  with a research prompt and a source tag.
- Since 16 Nov an option that retells a piece or post that went out or is on its way fails the gate (code `repeat`:
  the same primary source, the same hook, an earlier board's option he did not send back, a twin on the same board,
  or two of the same works; an idea of his own or from his tick carries the match and never fails, `his_repeat`;
  Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly things we published last week"). From the
  23 Nov board every option also says its shape, its aim (utility, interest or humour) and its funny line, and names
  the lookalike pattern it draws on from his Instagram inspo sheet (code `aim`, plan-week `references/lookalike.md`).

**On the board** (`_viewExtras.ts ideaLines`, after a day's options, no new contract field): each subject not offered
again is a line "Not offered again: <subject>" with his words and one press, "Offer it again" (`queue/veto-<subject>`,
`unveto`, his alone: `press_is_his`); each return or ask held back is a line "Held back: ..." with its reason. Status
`not offered again`, `given back` or `held back`.

**The scorecard**: `python3 scripts/post-pack/board_feed.py scorecard <Monday>` reads his presses on that board
(`GET /api/board/<Monday>/outcomes`, read-only, the engine key: `idea_outcomes`, or for a board before the gate its
`board_history`, triage marks and queue cues) and writes `docs/plans/<Monday>-week/scorecard.json`: each count with
its written rule, each press labelled, ids and labels only. The history test (`scripts/post-pack/ideas_history.py`,
`tests/ideas_history_test.py`, and the eval suite `ideas-history`) replays every check on his past boards with only
what was known before each.

## The view's contract: add freely; never remove or rename a field

Control Centre draws the week from one feed, `GET /api/board/<Monday>/view`. Its shape is
`apps/control-plane/api/board/view.schema.json`, versioned by `x-contract-version`; every view carries the same as
`contract_version` (`_viewContract.ts`, `VIEW_CONTRACT_VERSION`).

- **Add freely.** A new field, a new kind of action, media, step or step state, a new section on a day: add it to the
  view and to the schema, and bump the minor. Control Centre ignores fields it does not read and draws a kind or a
  section it does not know generically (a titled block with its text, its link or its media), so it shows up in the
  Content tab with no change there. Lists marked `x-open` in the schema (actions, media, steps, `who`) are the ones it
  draws generically.
- **Never remove or rename a field,** never send `null` or another type where the schema promises one, and never stop
  always sending a field the schema lists as required. That is a major bump, and Control Centre shows its "changed
  shape" line until it reads the new major.
- **Held by:** `tests/control-plane/board-view-contract.test.ts` (every view the engine builds keeps the schema, a
  view missing or renaming anything it promises fails, the frozen fixture `apps/control-plane/api/board/fixtures/view.json`
  still keeps it) and `npm run check:view-contract` (in `npm run verify`), which compares the schema with main's and
  fails a breaking change that is not a major bump, or any change with no bump; an addition passes with a notice that
  Control Centre's pinned copy (control-center `tests/fixtures/board-view/`, with the engine commit and the schema's
  sha256) is behind. Refresh the fixture with `UPDATE_VIEW_FIXTURE=1 npx vitest run tests/control-plane/board-view-contract.test.ts`.
- **Live:** the view answers with an `ETag` of what it says (never when it was read) and `304` to a matching
  `If-None-Match`, so Control Centre asks every few seconds at almost no cost.
- **1.1.0 (11 Nov 2026)** added `sessions` and `materials` to every day (the section below).
- **1.2.0 (11 Nov 2026)** added `pieces`, `options`, `comments`, `posted` and `yes` to every day, the action kind
  `press`, and the week's `revision` ("One live board", above).
- **1.3.0 (11 Nov 2026)** added the ideas gate: `held` on every day, `approval` on each piece, `outcome` and `held` on
  each option, and `outcome` and `goes` on each press ("The ideas gate", above).
- **1.4.0 (11 Nov 2026)** added `style` to each series day's `path`: the piece's motion style, caption style and
  treatment, each option with its press ("The style choices", below).
- **1.5.0 (11 Nov 2026)** added `stages` to each series day's `path`: the steps from idea to publish (approved mock
  M5), Ideas, Agreed, Flesh out, Script and record, After recording and Ready to post, each `{ key, label, state, when
  }`. `when` is the day the record says it happened (Ideas: the Sunday before the week; Agreed: the day the narrative
  lock was signed, else the day of his pick; Flesh out: the day the look was picked; Script and record: the day the
  making record's Recorded step was done, its latest take; After recording: the day its Video assets step was done, its
  latest cut file, `makingDays`) or, for Ready to post, the day it goes out; null when the record does not say, never a
  guessed day. Until 12 Nov 2026 Script and record and After recording always read null: the takes and files carried
  their days, and the view did not pass them. A later step done means every step before it is.
  The working steps (`steps`, `current`) stay as they were, for the next step, the prompts and the sessions' step
  names (`stagesOf` in `_view.ts`). A treatment option also carries "Not this" from 1.5.0, all but the picked one ("The style choices").
- **1.6.0 (11 Nov 2026)** added `presses` and `verdict` to each cut in a day's `media` (approved mock M5, Cuts: Yes,
  Not this, Change it and Add a note on every cut): his Yes or Not this on that file and his latest answer on it ("His
  answer on each cut", below). A thumbnail carries neither.
- **1.7.0 (12 Nov 2026)** added `drive` and `drive_why` to each item of a day's `media`, `posts` to each day, `post` to
  each off-day option and `drive` to `sources` ("Every asset, with its Drive link", below). Ruling (Krish, 2026-11-12):
  every cut on the board carries its Google Drive link; nothing on the board is ever cut off.
- **1.8.0 (12 Nov 2026)** added `manifest` to each day: the day's piece's draft manifest with his Approve for publish
  bound to its sha256 ("Approve for publish, bound to the manifest", below). It's live and the ideas for later landed in
  the same minor, from a pull request merged the same minute: the press kind `op: live` (a post he marked live),
  `choose` on a press (a choice he makes before it, the channels here) and `week` (the board a press saves into, when it
  is not the week shown), `by` on each `posted` item, and `measured` beside the live `north_star.current` ("It's live",
  and "Ideas for later", below).
- **1.9.0 (12 Nov 2026)** added Move to…: `item` (its row in `offday_items`, the one place its day lives) and `move` on
  each off-day option, `elsewhere` (a post Growth still has scheduled for a day the item left) and `posts` (Growth's own
  record of the option's posts: made, scheduled, live) ("Moving an off-day item to any day", above).
- **1.10.0 (12 Nov 2026)** added `stage` to every option and piece, `same_post` to an option, and `missed` to `who`
  ("One post, one item" and "Where everything is", above).
- **1.11.0 (13 Nov 2026)** added `sign_offs` to every week: the three video sign-off cards, each sample with its preview,
  its Drive link, his answer and whether the engine holds it, and the press kind `op: sign-off` ("To review: the video
  sign-offs", below).
- **1.12.0 (13 Nov 2026)** added `model` to every week: the week model the Publish Board draws (the pieces and the
  off-day posts he approved, each with its kind, path and one next action; the ideas that wait on the ideas board; "The
  week model", above). From 1.12.0 a held option's Approve is no longer spliced into its day's `actions`, a day with
  only held ideas no longer leads with them, and `yours` holds only his real decisions.
- **1.13.0 (13 Nov 2026)** added the replacing Approve (`op: "replace"` on a press, with `choose` at `current_to`) on
  every idea on a day that already holds a piece and on every idea for later on such a date, and `move` on every piece
  his approval holds (`days[].pieces[].move`, the model's piece `move`), the same shape as an off-day item's; a day's
  model may list more than one piece ("Replacing a day's piece, and Move to… on a series piece", above).
- **1.14.0 (13 Nov 2026)** added the press op `look`, Pick the look, for a piece whose path is at its look ("The current
  state, and nothing stale", above).
- **1.15.0 (13 Nov 2026)** added the press op `style`, Pick the motion style and Pick the captions, beside Pick the look
  on every piece before recording (`lookPresses`, the same section).
- **1.16.0 (15 Nov 2026)** added `thumbs` to each series day: the piece's thumbnail options while a set the critic
  judged is on its making record, each option's wide and tall files as same-site Drive file paths with their sha256, the
  critic's line, the grid mock, Pick on each option and Not this on the set, and the press op `thumb-pick`, which the
  week model makes the piece's decision while the set waits on him ("Thumbnail options and his pick", below; Ruling,
  Krish, 2026-11-15, approved with the specialists plan: thumbnail options carry a pick press on the Content board). It
  also added `sample_drive` to each style option, and a style sample's `sample_url` is the Drive file route
  `/api/board/sign-offs?file=<drive id>` ("The style choices", below).
- **1.17.0 (16 Nov 2026)** made four additions.
  - **`notes` on the Claude prompt.** Krish types his own notes before he copies the prompt. The board adds them under
    the heading, at the end of the prompt, and saves them with `save`: his comment on the day, `use: claude_notes`.
    `afterPress` files that comment to his taste ledger as his words.
    - Ruling (Krish, 2026-11-16): "I should be able to provide feedback or what I think the next steps are first, and
      then click the "Copy to Claude" button, and the prompt incorporates that."
  - **`open` on the Claude prompt**, `{ app: 'claude_code', repository }`. The board opens a new Claude Code session on
    claude.ai/code with that repository chosen and the prompt filled in. The board builds the address; the view still
    carries no link. Retired in 1.22.0: the prompt is only copied.
    - From approval of the story until a take is recorded, the prompt stays beside the picks. A session that changes an
      approved story takes his approval line off its end, so the board asks him to approve the new story. A story
      changed under its old line reads as unsigned too: `lockSigned` checks the line's `lock sha256` against the words
      above it, as making.py's drift rule does.
    - Ruling (Krish, 2026-11-16): "Even though this piece is locked, I should be able to tweak the narrative slightly in
      it by opening a session with Claude."
  - **Stills for the pickers.** The press `after` field is reserved for the production press of the next release:
    the prompt the board opens once that press is saved. No press carries it yet.
    `choose.options[].line` and `.still` are added, and `still_url` is added to each style option, from
    config/ve/style-samples.json's `stills` map, recorded by `ve lab still`. The board shows the still when he hovers
    over or picks an option.
    - Ruling (Krish, 2026-11-16): "hover over the captions, look, and motion style and see a templated screenshot of
      what it might look like".
  - **Repeats are flagged.** `item.repeat` and `model.repeats` (with each idea's `piece_id`, so the one list leaves it
    out too) are added. An idea that retells a piece or post an earlier board put out or on its way, approved,
    scheduled or live, from 14 days before it to the end of its own week, leaves the ideas board. It is listed in
    `repeats`, and its line says what matched and when. An approved item says the same in `repeat`. A retelling is any
    one of:
    - the same primary source;
    - the same hook (never for the weekly good news, whose hook is the same every week);
    - two or more of the same named sources.

    This week's own board is never its own repeat: a twin on it is the Sunday run's to refuse (`board_feed.py gate`).

    Ruling (Krish, 2026-11-16): "this week's Ideas Board needs to not contain mostly things we published last week".
- **1.18.0 (16 Nov 2026)** made two additions.
  - **`link` on an option**, `{ label, href }`, https only: what it came from, to open. A held ask of his keeps the card
    he saved: its link, his words in `said`, and a title naming what it is about. On 16 Nov the board showed "Held back:
    Lets make a hilarious meme." with no sign of the YouTube short he had saved to make it from.
    - Ruling (Krish, 2026-11-16): "feedback and suggestions like "Let's make a hilarious meme" end up in the ideas board
      without any context of what I actually wanted to make a hilarious meme about. We've now ended up with a vague
      instruction where I actually put on the inspiration board something very specific."
  - **`why` on a recommended choice.** Each recommended option of the look, the motion style and the captions says why
    in plain words, so the board can offer the three as one recommended set. With no look from the Sunday room, the
    proven look he has not turned down is the recommended one.
    - Ruling (Krish, 2026-11-16): "on my mobile, that I can pick the look, pick the caption style, and pick the motion
      style myself or the system itself can considerately recommend the best combination for me."

  The ideas gate also gained a same-story review the same day: a fresh reader judges every option against the words of
  what went out on the last three weeks' boards, because a retold story shares no link and no sentence with its post
  (Thu 5 Nov's No spending, no sending short came back for Tue 17 as "Your AI is about to start messaging you first").
  `plan-week`, `references/lookalike.md`, "The same story under new words".
- **1.19.0 (17 Nov 2026)** added **`saved` on a prompt's `notes`**: his notes already saved on that item (its piece, or
  an off-day post's key), newest first, whole, `{ at, text }`. The box stays empty for new words and the board shows these
  beside it. His notes were saved as a comment on the week and filed to his taste ledger, but nothing carried them back,
  so the box he typed in came back empty when he reopened the piece. Each note is also filed on the piece itself, kind
  `note`, role `krish_notes`, so every session's `get_piece_board` reads it.
  - Krish, 2026-11-17: "when I add feedback in to the control center UI, it obviously loads in to the prompt that comes
    here, but when i reopen the piece at a later date it seems to have vanished".

  The same release added **`tool` on a prompt** (`claude` or `perplexity`) and a second prompt on every piece: the
  **Perplexity research prompt** beside the **Claude production prompt** (the label that was "Copy prompt for Claude").
  It shares the notes box and its save, and is built from everything on record: the publication, the piece, the signed
  story, the sources found, the research already on file (so it goes past it) and his notes (`board/_researchPrompt.ts`).
  It is only copied. Its answer is one Markdown document that starts with the piece's `piece_id:` line, and his Paste
  research press files it on the piece as research, which the research library copies into Drive by itself (that press
  filed a `file` until 17 Nov, which the library never copied). Every Claude prompt now also carries his earlier notes and
  a last write-back step, "Close the loop as you go": files on the piece as they exist, Drive where docs/DRIVE.md places
  things, the repository committed with its closeout note, a done report saying where each thing is, and the one next step.
  - Ruling (Krish, 2026-11-17): "There should probably just be a Perplexity research prompt button that gathers everything
    we've gotten to date (including my latest comments if I've just made some in the box above) and turns that into a
    Perplexity research prompt instead of a Claude production prompt. We can distinguish the buttons by changing 'copy
    prompt for Claude' to \"Claude production prompt\" and the other button to \"Perplexity research prompt\"".
  - Ruling (Krish, 2026-11-17): "Every prompt created for Claude or Perplexity should leave the new session with nothing to
    assume, and it should also close the loop on updating the board, the drive, and everything else as it goes."

  A link filed by url with kind research now stays research, and when it names a file in his Drive the store reads the
  file (a Google Doc, a Word file, a text or JSON file) and files its words beside the link as research, copied to the
  library (`api/_researchLink.ts`; the answer's `research_text`).

- **1.21.0 (17 Nov 2026)** added **`scripts` on an Approve scripts press**: the scripts a session filed on the piece,
  each cut's words with its word count and rough length, so the board shows them as a review he reads and can edit in
  place, then approves with one press (Krish, 2026-11-17: "Surely we can do a 10x better job of having the scripts easy
  to review, and ideally I can manually edit them too (to add some final Krish-isms), and then press Approve"). The
  board writes the words he approves at `path` (`body.texts.<cut>`) and the press's own words, `approve` as filed or
  `approve_edited` when he changed any; edited words are held from his Teleprompter until the scripts' check and fresh
  readers pass them (`heldBecause`). A board before 1.21.0 still asks his words through `words`.

- **1.22.0 (17 Nov 2026)** made two changes.
  - **Every Claude prompt is only copied.** `open` on a prompt is retired: the engine never sends it, and the schema keeps
    it, marked `x-retired`, so a view built before 1.22.0 still validates. Control Centre copies the prompt, says it
    copied, and opens no window or tab for any prompt, Claude or Perplexity, on any card or day.
    - Ruling (Krish, 2026-11-17): "can you stop having my Claude production prompt buttons open up a new browser window?
      Just copy to clipboard is enough for all such buttons".
  - **An off-day voiceover's prompt follows its stage.** A voiceover short he records himself (Record it myself, his pick
    or the default until a voice holds; `recordsItself`) keeps the make prompt until he approves its script: write it,
    get his approval, send it to his Teleprompter. Once he has approved it, the card says to record it and drop the take
    in the Video Engine Inbox, and the prompt assumes he has: get the take (`recording.py get NAME`, AGENTS.md rule 9),
    check it against the approved words, cut it on the ve route with Codex building the visuals from cards, file it.
    The signal is his approval of the scripts for the piece id the option carries (`offdayScripts`): his Approve scripts
    press (`picks/<day>-scripts`, his login) or his typed approval (`picks/<day>-scripts-words[-<8 hex>]`), on any day,
    whether or not the engine has a row for that id (Tue 17's habits voiceover, 701a2c55, has none). An ElevenLabs voice
    has no take to wait for, so it keeps the make prompt. No take in the Inbox yet: the session checks his Teleprompter
    holds the approved words, sends them if not, tells him in one line and stops.
    - Krish, 2026-11-17: "presumably when it gets to this stage and the files are in teleprompter, the next action
      presumes I have recorded the video and put it in the inbox, and thats what the next button's prompt is there to
      do in Claude?"
  - A typed approval now counts after the server has answered it: the `send` the server writes on the document (its
    Teleprompter try) is set aside before the approval is checked (`asWritten`), so Tue 17's `picks/tue-scripts-words`,
    held, still counts. A `send` written by anyone else is still refused.

- **1.30.0 (18 Nov 2026)** added to a piece's production `plan`: **`got`**, every file Krish got himself and dropped on
  the plan (`{ id, title, kind, content_type, beats, at, drive: { state, path } }`), **`folder`**, the piece's one post
  folder in `3 Posts` (or null before anything bound one), and on each `fetch` its own **`got`**. Krish, 2026-11-18:
  "Can we add a drag and drop/upload functionality where I can put multiple files? image, small videos and maybe some
  text/pdf files etc", then "when I drop stuff in there, it needs to be filed properly in my Drive in the right place, so
  its easily accessible later on. every resource along the way for a single piece needs to be bound to the piece in a
  bullet proof way". A file filed on a piece with role `krish_got` (the board's drop, or any session) is a material on
  the piece keyed by its beats (`got:<beats>:<sha256 16>`), and the same bytes become a library row at
  `3 Posts/<folder>/3 Video/Your materials/<BEATS> - <name>`, which the library sync writes into his Drive
  (`apps/control-plane/api/_postFolder.ts`; `docs/DRIVE.md`, "Post folders are bound to their pieces"). `drive.state` is
  `in_drive` once the sync wrote it, `filing` while it waits, `not_filed` when no row holds it (the same drop again files
  it). The production prompt names each file by its material id and says where they are in Drive (`gotBrief`). The same
  day a ready plan carries **`ask`**, the one question only he can answer before he copies its prompt
  (`{ question, heading, save }`, `VISUAL_POINTS_ASK`): any point he wants made visually that the script does not make
  strongly enough (Krish, 2026-11-18: "for example I talk about seeing a lot of upgrade offers which are hiding
  different pricing models - and I dont mention clearly enough what a grandfathered pricing model is, and that you can
  stay on it if you like"). His answer rides the copied prompt under `VISUAL_POINTS_HEADING`, which gives each point a
  picture of its own, and is saved as his notes exactly as he typed them, marked `frame: visual_points` (the comments
  contract takes no other frame), so later prompts carry it among his earlier notes with `VISUAL_POINT_LINE` before it.
  The card's own notes question stays general.

- **1.29.0 (18 Nov 2026)** added to a piece's production `plan`: **`fetch`**, what Krish gets himself (`{ beat, what,
  why }`), and on each beat's picture and options **`lever`** (impact, hilarity, absurdity, exaggeration, beauty,
  clarity), **`maker`** (codex, generated, real, you), **`why`** (why it is a 100/10) and **`basis`** (script or
  research, with `basis_ref`). Krish, 2026-11-18: "suggest how the production prompt should make these visuals 100/10
  [...] visuals can come from my script or from the backing research too". The same day, **My takes are in the Inbox**
  matches a take by every name the board shows for each piece of the week (`boardNames`), not only its stored idea, and
  refuses (`takes_unclear`) when the Inbox holds more than one recording and no name says which is this piece's: it had
  put the build-or-buy and skeletons takes on the data-centres piece. The post-production prompt carries each take's
  Drive link and has the session show him mocks as it goes.

- **1.28.0 (18 Nov 2026)** made the experiment an **optional press, never a pick**, and added **`experiment_idea`** on a
  piece's style: his own words on what to experiment with and how. The press has no `choose`, so the board never counts
  it among the look, motion and captions. Off, it is **Add an experiment (optional)**, which asks for his idea
  (`words.path` `experiment_idea`, required). On, it is **Change the experiment** (its `goes` quotes his idea) and
  **Remove the experiment** (`experiment: []`). A tick with no idea is refused (400 `experiment_idea_required`). The
  production prompt carries his idea verbatim and has the session flesh it out, draw 3 to 5 mock frames at no cost and
  ask him to go, change it, or call it, before any shot script or paid still.
  - Krish, 2026-11-18: "It should be an optional tick box, separate to the three things I need to pick as mandatory.
    If I were to tick the tick box, I'd need to supply more long-form input as to what I think we should experiment
    with and how and then when I go to copy the Claude production prompt the production prompt would need to contain a
    more fleshed-out version of my idea and produce some mocks inside the claude session for me to decide whether or
    not I like the experimentalist angle or whether to just call it"
- **1.27.0 (18 Nov 2026)** added **`experiment`** on a piece's style (`path.style.experiment`, `meta.style.experiment`):
  the experiment Krish ticked beside his look, motion and captions, or null. Every piece's picks carry one more press,
  **Add an experiment**: a tick-box (`choose.multi`, not required) over `EXPERIMENTS` in `_style.ts` (today
  `directed-shoot`), posted to the style op as `experiment: [<id>]`, or `[]` to untick. A motion or captions pick keeps
  the tick, and an unknown id is refused (400 `unknown_experiment`). Once ticked, the production prompt names the skill
  to run beside his picks.
  - Krish, 2026-11-18: "Can you add a checkbox on every future piece that I'm planning, as I do the motion picking and
    caption picking, etc., that can activate this skill alongside what I pick? Don't just add it to one card. Make it
    available as a feature in all."

- **1.26.0 (17 Nov 2026)** added **`recipe`** on a plan's picture: a generated picture's exact higgsfield-generator recipe
  (model, prompt, the still it starts from, length, estimated credits), shown in the plan and carried into the Claude
  production prompt, which follows the skills' own guide: stills before video, motion from the approved still on
  Seedance 2.5, reframe for a clip at the wrong shape, cost before generation, no Soul ID, presets or Higgsfield audio,
  and the Virality Predictor as a signal on the reviewed short (Krish, 2026-11-17: "ensure
  https://github.com/krishanraja/higgsfield-generator is also used elegantly if post production uses higgsfield").
- **1.25.0 (17 Nov 2026)** added **`plan`** on a card that holds a piece once his takes are in: the production plan
  (`api/board/_productionPlan.ts`; the run and the plan's shape: `docs/production/PRODUCTION_PLAN.md`).
  - Takes are now video **or audio** (his Teleprompter exports a voiceover take as `.aac`; the Tue 17 habits take was
    skipped by the video-only rule), matched to the piece by its title and its approved scripts' titles against the
    week's other pieces; a file named for another piece is never taken (`newTakes`). The recordings store takes `.aac`.
  - His My takes are in the Inbox press also starts `production-plan.yml` (job `production-plan`), Claude Code on his
    subscription: the edit pass (`edit_pass.py`: restarts clipped, silences cut, length measured, the even speed-up
    that brings a short under 90 seconds), every beat's picture with one or two other options, the humour already in
    his words (krishanraja/humour-engine, his style from ai-harness), and two or three scenes mocked from real stills
    in his picked styles (`plan_scene.py`), filed on the piece (roles `production_plan`, `plan_scene`).
  - `plan.status` is `making` until the plan is filed, then `ready`, with the edit numbers, the scenes (each a
    same-site still) and every beat. Each other option carries **Use this**, a picks document `plan-<8 hex>`, kind
    `plan_swaps`, bound to the plan's sha256 (a swap on an older plan does not count). The plan file never changes.
  - The card's Claude production prompt carries the plan with his swaps (`planBrief`), the edit pass, the humour and
    the higgsfield-generator skills for generated stills and motion (Krish, 2026-11-17: "it should also leverage the
    https://github.com/krishanraja/higgsfield-generator where needed in post production").
  - Ruling (Krish, 2026-11-17): "create the final production plan for me to open, review and then press the Claude
    production prompt button [...] The UI should also have mocked up 2 or 3 scenes using my real content stills using
    the visual styles I selected, and give me the final opportunity to switch something out".

- **1.23.0 (17 Nov 2026)** added the press op **`takes-in`**: **My takes are in the Inbox**, and the stage around it, on
  every card that holds a piece (the day's own piece, a placed piece, an off-day post he records), every day.
  - Once his scripts are approved and in his Teleprompter (a held send is said first, `heldSend`), the card waits on his
    one press, with Open Teleprompter and the record step's Claude prompt beside it.
  - The press (`POST /api/board/<Monday>/takes-in`, his login only) reads the Video Engine Inbox by its Drive ID
    (`library/_inboxDrive.ts listInbox`). It takes the video files changed since he approved the scripts (less three
    hours) that no other piece holds, oldest first (`newTakes`), and writes their names, Drive ids, sizes and checksums
    on the piece (`meta.takes_in`). Then it asks GitHub to place them on their cuts by their words (`place-takes.yml`).
    None there: a 409 `no_new_takes` with a line saying so, and nothing written.
  - From then on the card names the takes. A production pick still missing (look, motion style, captions) is his press
    first, unless a take is already on the making record (a recorded take is never sent back to a pick; the prompt then
    names what is not picked). Then its next action is the **one post-production prompt** (`productionBrief`). It carries
    every decision with who made it, the approved words, the research on file, each take with its exact
    `recording.py get` line, and the creative calls it makes beat by beat: his face, a logo or wordmark, real visuals, a
    social post or screenshot, motion design (a ve device or Codex plate), or cinematic generation. The prompt makes the
    finished cut in one go, to a separate reviewer.
  - Takes the home pass or the take-placing job already put on the making record count as his takes too.
    `api/board/_takesIn.ts`.
  - Ruling (Krish, 2026-11-17): "whenever I press approve script, the new board state should be waiting for me to
    confirm the videos are in the Inbox, at which point it will fetch the name of the video(s) and integrate them in the
    piece on the board so the next post production prompt does a completely accurate job, with all the research, motion
    styles etc being in one place and decided as well, the post production should always be one shot - and can decide
    where to bring in logos, real visuals, social posts, screen shots, motion design, cinematic generation, my face etc
    etc."

- **17 Nov 2026, no contract change: two system fixes on every day.** Ruling (Krish, 2026-11-17): "well ultimately all
  this feedback applies to all relevant days, i told you i do not want one off fixes but system upgrades".
  - **An off-day video post gets a piece's production picks.** Every off-day post cut on the ve route (a voiceover short,
    a meme video, a good-news short; `videoOffday`) offers the look, motion and caption presses a series piece offers,
    until it is scheduled. Each press carries the post's record id and `item`, its document. The record id is the piece id
    its option names, else one derived from the week and the document (`offdayPieceId`, the same on every read). His
    Approve on the option makes the record (`syncApprove`, `linkOffdayPiece`); for a post approved before 17 Nov, his first
    pick makes it, and only when the board itself offers that press with that id on that post. The record is seeded and
    linked to its week in `meta.offday_link`, never scheduled, so it is never a second card on the day; the view reads
    linked records beside the week's pieces, and the post's prompt reports to the record once it exists.
    `api/board/_offdayPiece.ts`.
    - Krish, 2026-11-17: "at no point does a voiceover short give me the same controls as a mon/wed/fri piece in terms of
      the motion, captions etc etc. why not?"
  - **His Approve scripts counts the moment he presses it, and a held send is said.** The server's own Teleprompter answer
    no longer cancels his approval (`asWritten`, 1.22.0). When that answer is not `sent` and the making record does not
    show the scripts in his Teleprompter since, every card holding the piece (`heldSend`: the day's own piece, a placed
    piece, an off-day post he records) says in one line that his approval counts and why the send was held, and its next
    action is the Claude prompt whose session checks the scripts (`making.py scripts`), has two fresh readers read them
    back, and sends exactly the approved words (`teleprompter_send.py`).
    - Krish, 2026-11-17: "the button does not seem to work. Would it not just send to teleprompter directly and change the
      board state immediately?"
  - **His own Approve scripts press sends at once, his edits included (F49).** A press he makes on the board (`updated_by`
    Krish) is never held by the checks: the server sends his exact words, puts the checks still to run in `send.checks`,
    and answers a plain `line` the board shows him ("Approved and sent to your Teleprompter at 16:20 UTC. ..."). The
    checks then run after the send and report to him. His approval goes stale only when a script is filed after it
    (`scriptsChanged`), so his own edits are the scripts; the card says when they were sent and moves on to recording,
    and its title is the one his approved scripts speak (`spokenTitle`, `workingTitle`; a working title until he picks
    the final one with the finished video). A session's send, or his typed words carried by a session, still waits on
    the checks.
    - Ruling (Krish, 2026-11-17): "you need to fix every instance of this workflow everywhere - I need to see the board
      state change and my edits get saved, and the approve scripts button auto sends to teleprompter"
  - **A new typed approval goes under its piece's own name.** A write of `picks/<day>-<lock|scripts>-words` without the
    piece suffix is refused; saved ones are still read. (On 17 Nov the history of `picks/tue-scripts-words` showed no
    approval was lost there: its first revision was already the habits voiceover's.)

- **1.24.0 (17 Nov 2026)** added **`template`** and **`caption_ideas`** on an off-day option: the meme templates lane,
  from the 30 Nov board.
  - `template` (an option of kind `meme` with a template only; `_viewExtras.ts`, `templateOf`): `{title, clip {url, page,
    poster, seconds}, found {place, label, url}, credit, what_happens, why_it_works, mechanism, moment, date}`. Links are
    https only (a template without an https clip and page, or with an unknown place, is not shown as one), strings are
    trimmed and capped, and `mechanism` keeps only the humour engine's ids. `caption_ideas` is up to four strings.
  - Nothing else changes: the option keeps its presses, its note (his caption box), Move to and its item. His caption
    plus Approve makes it a meme post; Move to puts it on any day. Control Centre draws the new fields generically until
    its "Meme templates" row reads them.
  - Ruling (Krish, 2026-11-17): "why can we not create a pipeline of existing meme videos that could be good to reskin,
    and show me those in here? Then I could think of a funny caption for it thats related to AI."
    (`.agents/skills/plan-week/references/meme-roaster.md`, `docs/MEME-STANDARD.md`)

- **1.20.0 (17 Nov 2026)** added **`audio` on a choice's option**: a sample to hear before he picks, a same-site path
  (an off-day track's brand-kit file through `GET /api/board/sign-offs?file=<drive id>`, or a voice's ElevenLabs preview
  through `GET /api/board/sign-offs?voice=<bank id>`, a redirect to the bank's own preview clip; no sample spends a
  credit). With it, every approved off-day post not yet scheduled carries its sound picks in `others`: a voiceover short
  **Pick the voice** (`config/voice-bank.json`: his Krish Remix voice first, then the stock voices, a proposed one marked
  "proposed") and **Pick the music under the voice**; a carousel (supporting, good news, explainer) **Pick the track**. The
  tracks are the off-day rotation in `config/music-library.json` (`"for": "off-day"`), laid at the one bed shape
  (`config/music-bed.json`, F40). Each is one press, his only: `picks/audio-<voice|bed>-<item>`, kind `audio_pick`,
  `{layer, item, pick, at}` (`_audio.ts audioBody`), counted only when the board saved it under his login. A session reads
  his pick and makes the post with it (`ve voice clone --voice <id>`); it never writes one, and a stock voice is generated
  only once the bank marks it approved from his press. Control Centre plays `audio` in place on each option.
  Pick the voice always offers **Record it myself** (`record-myself`, no sample): his own take in place of an
  ElevenLabs voice. The post's Claude prompt then says so, and the making session sends the approved script to his
  Teleprompter (`teleprompter_send.py`) and cuts from his take; `ve voice clone --voice record-myself` refuses. With an
  ElevenLabs voice picked, the prompt names it and the `--voice` to use (`_audio.ts soundLine`). Krish, 2026-11-17: "I
  should be able to choose to record manually myself as well, and then the teleprompter workflow will activate, as
  opposed to the ElevenLabs workflow".
  Until a voice holds on a whole script (`config/voice-bank.json` `whole_script.passed`), Record it myself is the
  **default**: it leads the list marked "(default)", a post with no voice picked is told to go to Teleprompter, and `ve
  voice clone` with no `--voice` refuses with that route (Ruling, Krish, 2026-11-17: "make Record it myself the default
  until a voice passes"). Once his default voice passes, it is the default instead.
  - Krish, 2026-11-17: "I always want to be given a few options in my control center. We should have some stock voices
    approved in Eleven Labs and, obviously, my own Krish remix voice too as an option on the control center Content
    Board. voiceovers would have light approved epidemic audio behind the voice."

## To review: the video sign-offs (contract 1.11.0)

Ruling (Krish, 2026-11-12): the three video sign-offs are one review card each on his board, with samples, and only his
presses write the configs. His words: "One review card each: each goes on your Publish Board as a card with samples to
look at and listen to, plus Approve or Not this. About 10 minutes in total." The three that had waited on him: a set of
sound effects (`config/sfx-approved.json`), at least five golden frames (`config/ve/golden-frames.json`) and Gate 2 on
face-with-proof at 16:9 (`config/ve/design-lock.json`, the `face-with-proof@16:9` draft).

- **The cards and their samples** are `config/ve/sign-offs.json`, made and recorded by `scripts/velib/signoffs.py`
  (`ve signoff stills|gate2|add|check`): each sample is a file in his Drive (id and link) with the sha256 of its bytes;
  no media is committed. The 13 Nov samples: 12 Epidemic Sound effects (his plan covers sound effects), 12 stills cut
  from his published cuts of 26 Oct, 2 Nov, 4 Nov and 6 Nov (the library's copies, checked by sha256), and four 16:9
  stills, one per beat, from the published Mon 2 Nov wide cut. They are in his Drive's `Inbox from My AI`, each named
  `Video sign-off - ...` (docs/DRIVE.md).
- **In the view:** `sign_offs` on every week, `{ waiting, cards }`. Each card has its `ask`, `why`, `note`, `counts`,
  `state` (`waiting`, `answered`, `written`) and `line`; each sample `{ id, title, kind, mime, src, drive, sha256, lines,
  verdict, written, presses }`. `src` is `GET /api/board/sign-offs?file=<Drive id>`, which serves only a sample a card
  shows (302 to the board's copy; 404 `sample_not_found` for any other file). Sound effects and golden frames take a
  press per sample; Gate 2 takes one press for the card (`presses_mode: card`), bound to the canonical map of its four
  stills' sha256s (`sha256`). `verdict` is his latest press on those exact bytes; `written` says the config on main holds
  it. Null when the manifest cannot be read (`sources.sign_offs` false).
- **His press:** `POST /api/board/<Monday>/sign-off` with `{ card, item, verdict: approve | not_this, sha256, words? }`,
  his login only (403 `his_press`), on a sample on the card now whose bytes his press names (409 `sample_changed`, 404
  `sample_not_found`). His words are optional: on Not this, and on Gate 2's Approve. Kept append only on
  `picks/signoff-<card>` of the week he pressed on (board_save as Krish; board_history keeps every revision); the same
  answer twice in a row on the same bytes is kept once (`already`).
- **What writes the configs:** never the press. It starts `.github/workflows/signoff-apply.yml` (a repository_dispatch,
  `_run.ts` job `signoff-apply`, no payload), which reads every press back (`GET /api/board/sign-offs`, the engine key),
  fetches each approved sample's bytes by its Drive id through the engine, checks its sha256, and writes through the
  configs' own writers: `sfx.approve_reviewed` (an approved row carries `approved_press`, never words he did not type;
  before it is written, the sound's exact bytes are filed in the brand kit's Music folder at `sfx/<id>.<ext>` through
  the library, recorded as `filed`, so ve compile stages it from `MINDMAKE_MUSIC_ROOT` on the next cut and stops by
  name on a machine without it),
  `golden.fill_from_cut` (the next empty slot, `source: cut`), and `designlock.freeze` with his `approved` record for
  Gate 2. A Not this is written as his no with the date (`declined` in the first two, the draft's `gate2` in the lock).
  The pull request merges itself on green CI, and the card then reads "Written to the engine".
- **What it never does:** approve anything for him, publish, post or send, or freeze a lock from a press that names
  other stills.
- **Held by:** `tests/control-plane/board-sign-offs.test.ts`, `tests/ve_signoffs_test.py` and
  `tests/control-plane/board-view-contract.test.ts`.

## It's live: marking a post live (contract 1.8.0)

Krish, 2026-11-12: "How do I indicate that Tuesday the 10th was posted correctly?" One press, **It's live**, on every
piece on the publish board, series days and off days alike: open the day on the live board; once the day is due and only
Growth has it, the press under the card is It's live (before that it waits under More presses, and a piece still being
made on a day to come has none). He pastes the post's link, the board ticks the channel the link belongs to, and he ticks
any other channel it went out on.

- **The record** is his, append only: `picks/live-<day>` (`_itsLive.ts`, `recordLive`, `POST /api/board/<Monday>/live`),
  one post per press `{ channels, url, at, by: 'Krish', piece_id | option, title?, note? }`. Only his login writes it
  (`live_is_his`); a plain write of the document is refused (`live_is_its_own_press`), so a post is never changed or
  taken away; a repeat of the same link writes nothing. The subject is the day's piece his approval holds there, or an
  off-day option his Approve stands on (`not_approved_by_krish` otherwise).
- **On a piece** it copies each new channel onto the piece's making record (`meta.making.channels`, actor Krish), the link
  on the channel it belongs to (`channelOfUrl`); a channel Growth already recorded keeps Growth's entry. So the publish
  step moves, Control Centre's done-check sweep closes what waited on it (`piece_step`, `week_published`), and the
  publish watcher matches a Substack link on the record by address.
- **The day** moves to Live and Done: an off day once any approved option, or its piece, is marked live (or Growth's tick
  is on the piece); a series day once he marks its essay live on Substack (the watcher's match follows). The day's line
  says where and when ("Live on Instagram, LinkedIn. You marked it live, Tue 10 Nov, 12:30"), and `posted` lists each
  channel with `by: you` beside Growth's ticks (`by: growth`, with their links: where Growth recorded a post, no press is
  needed). Another approved option on a day that is out keeps its own It's live, never leading, and an off-day option
  approved for a series day has its own, with the off-day channels.
- **The count**: the view's `north_star.current` is live (`publishedNow`): the pieces of the publication's series with
  `published_at` in the last seven days (the North Star reader's own rule) plus each post he marked live in that window
  that the rule cannot see yet (an off-day post, or a piece the watcher has not matched), each subject once.
  `north_star.measured` is the number NOW.md last recorded. The measured North Star line counts pieces only, so an
  off-day carousel he marks live raises the board's count at once and the measured line only if its source line widens.
- **Growth's learning**: `GET /api/board/<Monday>/pieces` carries `live`, every post he marked live with its day, its piece
  or option, its channels, its link and when, so Growth learns from posts Buffer never saw.

Held by `tests/control-plane/board-its-live.test.ts`.

For every makeyourmind/up Substack article or video post, leave the public byline empty (Krish, 2 November 2026). The native editor may attach the signed-in writer automatically. Remove every name until "Add byline" appears, check the reader preview before scheduling, and reopen the public post after release to verify its header. Hold release if any author remains visible.

## Ideas for later (GET /api/board/later)

Krish, 2026-11-12: "Does my 'Ideas for Later' tab contain everything I've not approved but not rejected in all the
previous ideas boards?" It did not: Control Centre's Queue ("Ideas for later") showed only the ideas the older boards'
"Queue it for later" mark put in `content_ideas.queued_at`. `GET /api/board/later` (`_later.ts`, his login or the
operator's key, read-only) reads every option on every ideas board from the engine's records and keeps each one he
neither approved nor rejected:

- **The boards**: every week's `ideas.json` (the week's branch first) and Growth's `offdays-growth.json`, from the week of
  19 October.
- **His answers**: his presses in `board_documents` (picks and queue), the verdicts imported from the first boards
  (`engine_operator`, before 26 October), `idea_outcomes` (append only), the cues the idea queue filed from his words
  (`feedback_cues`, his and by rule, never a model's guess), and each idea's own row: on a day or published means
  approved; `queued_at` means filed. An option with no record id is linked to the piece the old queue made of it by
  `meta.queue.from_week` and `from_pick`, never by its words. The latest answer across every board an idea was on is the
  one that counts; an Approve that still stands, anywhere, takes it off the list.
- **The groups**, newest board first: Filed for later; Saved as trends; To improve (an off-day option's Improve or Reject
  on its direction counts as his answer on it); Answered on an older board (a verdict from before the five outcomes,
  Curious, Cute, Story or Angle, kept in his words and never read as one of the five); Never answered. What he has not
  answered on a board whose week has not begun waits on the Sunday slate (`counts.on_slate`), not here.
- **The presses**: each item carries the five presses of the ideas gate, each with the `week` it saves into: File for
  later, Reject, Save as a trend and Improve on the board it was last on; Approve for the next free date of its own
  weekday within four weeks (`picks/<day>`, or `queue/off-<day>-<id>` bound to the words it showed). An idea with no
  record, a Sunday option or a week's good news has no Approve, and says why (`held`). Only his Approve puts an idea on a
  publish board, through the same routes and the same refusals.
- **An off-day option approved onto another board** is drawn on its new day from the words his Approve bound
  (`offdayList`), so the approval covers it and Growth's read hands it over.

Measured on 12 November 2026 from the live records: 73 ideas on five boards; 20 approved, 13 rejected, 9 unanswered on
next week's slate, and 31 for later: 9 filed, 7 trends, 4 to improve, 4 answered on the first board, 7 never answered.
Held by `tests/control-plane/board-later.test.ts`.

## The style choices (contract 1.4.0)

Each series day's piece carries its style choices in `path.style`, built by `apps/control-plane/api/board/_style.ts`
on every read, in three layers of the same shape: `motion`, `captions` and `treatment`. A layer lists every option
(`id`, `name`, a one-line `line` on what it is, its `rules`, `recommended` with a plain `why`, `sample_url`, `rejected`
and `presses`) and what is picked now (`picked`, `picked_by`, `picked_at`).

- **Motion** is the bank's motion layer (`config/style-references.json`, layer `motion`; `line` is its `how`, each
  option also carries its `point_types`, its `formats` and `ready`, false while its `ve_route` says `needs_device`).
  Up to three are recommended and listed first: each made for every format the piece makes (a series piece makes the
  long and the short cut), sharing a point type with the piece when its spec names them (`style.points`), one ve can
  draw now (the rule `ve styles` keeps: `needs_device` holds a style back until his yes on its test render), never one
  he called not for us and never one he said "Not this" to on this piece; those that suit the channel often come first,
  then his liked ones, then the most point types matched.
- **Captions** is `config/caption-themes.json`, one entry per name in `apps/renderer/src/engine/captions/names.ts`
  (`captions.test.ts` holds them equal). The one with a `recommended_why` (art-directed, his pick on 11 Nov 2026) is
  recommended, with his own words, unless he said "Not this" to it on this piece.
- **Treatment** is the looks (`path.look.options`) in the same shape, so the three draw alike; the Sunday room's
  recommendation is marked, and its Yes is the look op with his experiment and inspiration kept. Its "Not this" is the
  style op with `reject: { layer: 'treatment', id }` (mock M5: Yes and Not this on every option): kept in
  `meta.style.rejected.treatment`, it takes the look off the recommended until he picks it. The picked look carries
  no "Not this" (the look op holds the pick, so a no would leave it picked); he picks another instead.
- **Picked** shows his press on the board first (`meta.style`), then, for motion, his Pick a style gate on the making
  record (`gates.style`), then a creative direction he signed (`signed.by` Krish in the day's
  `docs/plans/<date>-<dayname>/ve/spec.json` or `creative-direction.json`, `picked_by: spec`). A spec he has not signed
  is never shown as a pick, and one whose `piece_id` names another piece is never read.
- **`sample_url`** is a rendered sample listed in `config/ve/style-samples.json`, as a same-site path, or null; and
  `sample_drive` (1.16.0) its file in his Drive, `{ file_id, url }`, or null. Each value in that file is a path string
  (`_style.ts` reads only strings): the engine's Drive file route `/api/board/sign-offs?file=<drive id>`, with the Drive
  id in its separate `drive` map, by layer and style. The route serves a sample only when its id is in that map
  (`sampleFiles`), beside the sign-off cards' samples. An empty value is a render still waiting: it reads as null, the
  board draws no sample for it (never a placeholder), and the file's `waiting` map says which render. Every value is
  empty today: each sample is the style lab's render of that style on his pinned take (`config/ve/lab.json`), made on a
  home computer, filed in Drive's Inbox from My AI and recorded with `ve lab sample`. The commands, on a home computer
  in this repository:

  ```
  . scripts/ve-env.sh
  python3 scripts/post-pack/recording.py get --sha256 203d10c946954c5343ccec5b0e3a3626e9b2dfd7ef376485ff1bbbf4f35dddd5 --out .cache/lab-take
  python3 scripts/ve.py lab render --take .cache/lab-take/thurs5Novrecording-nospendingnosending.mp4 \
    --brand-dir <the folder holding the three pinned makeyourmindup marks, config/studio.json> --out .cache/ve/lab/samples \
    --only <each motion id in style-samples.json> <theme-<id> for each caption style in it>
  # watch each clip at full size; file each in Inbox from My AI as "Style sample - motion - <id>.mp4"
  # (or "- captions -"), read it back, then record it:
  python3 scripts/ve.py lab sample --layer motion --module <id> --drive-id <its Drive id> --clip .cache/ve/lab/samples/<id>.mp4
  python3 scripts/ve.py lab sample --layer captions --module <id> --drive-id <its Drive id> --clip .cache/ve/lab/samples/theme-<id>.mp4
  ```

  `ve lab sample` checks the clip is the lab's own render of that style (its manifest beside it), writes the value, the
  drive map and clears the waiting note; commit `config/ve/style-samples.json` only, never the media. A caption style is
  drawn by the lab only when `--only` names it (`theme-<id>`), so the regression reel never grows by itself.

  **Stills** are the picture he sees when he hovers a look, a motion style or a caption style (Krish, 16 Nov 2026: "No
  need for a video, just a still."). They sit in the same file, in a `stills` map by layer (`treatment` for the seven
  looks of `formats.production`, `motion` for the 14 drawable styles, `captions` for the 27 caption styles), each value
  the same Drive file route as a sample, `/api/board/sign-offs?file=<drive id>`, with its Drive id in a `stills_drive`
  map by layer. An empty value is a still not recorded yet: no picture, never a placeholder. `python3 scripts/ve.py lab
  stills` cuts one 540x960 JPEG per motion and caption style from the lab's renders, all at the same frame, into
  `.cache`; each is watched, filed in Inbox from My AI as "Style still - <layer> - <id>.jpg", read back and recorded
  with `python3 scripts/ve.py lab still <layer> <id> --drive <its Drive id> --file <the jpg>`. A look's still comes
  from a design-lock key frame or a Codex plate, recorded the same way. Commit the file only, never the stills.
- **His press**: `presses.yes` and `presses.not_this` (labels "Yes" and "Not this") each say `POST
  /api/board/<Monday>/<op>` with a body. `POST /api/board/<Monday>/style` takes `{ piece_id, motion?, captions?,
  reject?: { layer: 'motion' | 'captions' | 'treatment', id } }`, his press only, on a piece scheduled in that week, the same guards
  as the look. A motion id is checked against the bank on main and a caption id against `config/caption-themes.json`
  (400 `unknown_motion` or `unknown_caption`; a look id is checked by its shape, 400 `unknown_look`; 400 `invalid_reject`, 400 `nothing_to_record`; 503 `styles_unavailable`
  when the bank cannot be read; 409 `not_drawable_yet` for a pick of a motion style whose `ve_route` says `needs_device`,
  while a Not this on one is still taken). A style sample or still (`GET /api/board/sign-offs?file=`) is signed for an
  hour and handed out again by the instance for 25 minutes, with `Cache-Control: private, max-age=1800`, so a still he
  hovers again costs no Drive call (Krish, 2026-11-17: "The motion screenshots take so long to load when I hover over
  them"). It writes `content_ideas.meta.style` `{ motion, captions, rejected: { motion, captions, treatment },
  by, at }` beside `meta.look`, read and written guarded on the row's `updated_at` (`patchMeta`), so a write that lands
  in between is kept, never overwritten (409 `piece_busy` when they never stop); the `content_ideas` trigger bumps the
  week's `board_signal`. "Not this" on the picked style takes the pick away; a later Yes takes a style back off the
  "Not this" list. It never edits a `creative-direction.json`.
- **The experiment** (1.27.0, optional since 1.28.0): `{ piece_id, experiment: ['directed-shoot'], experiment_idea: '<his words>' }` on the same route sets `meta.style.experiment` and `meta.style.experiment_idea`, and `{ experiment: [] }` clears both; it is never one of the three picks, and the production session fleshes out his idea and shows him mocks before anything is made.
- **Who reads it:** make-piece and ve read `meta.style` as the default for a new spec's `style.motion.module` and
  `brand.caption_theme` (`docs/ve/RUNBOOK.md`, S1), and a signed spec stays his.
- **Held by:** `tests/control-plane/board-style.test.ts` and `tests/control-plane/board-view-contract.test.ts`.
- **Routing:** `vercel.json` has no rewrite of its own for `/api/board/<Monday>/style`, and cannot have one, since
  `GET` there is the read-only view of his Pick a style documents. So the press arrives as the collection `style`, and
  the handler reads a `POST` with no id to `style` (or `cut-verdict`, or `thumb-pick`) as the press (`POST_OPS` in `_handler.ts`).
  Until 11 Nov 2026 it did not, and every style press from Control Centre was answered 400 `read_only_view`
  (`tests/control-plane/board-cuts.test.ts` sends it as production does).

## Every asset, with its Drive link (contract 1.7.0)

Krish, 2026-11-12: "I need the Google Drive hyperlink because it is actually more useful for me: it actually enables me
to download it directly to my device as well, or view it in a more reliable player", and "I should always be able to
link the assets in Google Drive as well as see them if I am to approve them".

- **A cut's Drive link.** Each item of a day's `media` carries `drive` `{ file_id, url }`: the exact file in his Drive,
  read from the making record's `url` (the file's own Drive link, which `making.py PIECE drive-link` and `video` record
  by its Drive file id; never a guessed path). With none, `drive` is null and `drive_why` says "Not in Drive yet" and
  why. The board shows "Open in Drive" on every cut, even when its player works.
- **A cut always plays.** `GET /api/board/<Monday>/media/<id>` signs the library's copy, looking for a path the record
  wrote relative to the post (`3 Video/fri13-5min-v3.mp4`) inside the post's own folder (`3 Posts/<pack.folder>/...`).
  A file the library has no copy of is served from Drive by the id on its record: the board copies that one file into
  the engine's store (`board-drive/<id>-<version>.<ext>`, by its Drive md5) the first time and answers with a short
  signed link, so a file replaced in Drive is copied again and an unchanged one never is. This is why Friday 13 Nov's
  cuts drew an empty player until 12 Nov: they were in Drive but never sent to the library, and their record named
  them relative to the post, so the route answered 404 `media_not_found`.
- **Every asset of every post.** Each day carries `posts`: every folder in `makeyourmindup > 3 Posts` dated that day
  (`_drivePosts.ts`, read by the folder's ID as its owner, read only, kept a minute), each `{ id, name, url, option,
  piece_id, assets }`. `option` is the off-day option whose `drive` names the folder (the option carries it as `post`);
  `piece_id` is the piece whose `pack.folder` names it. Each asset is `{ id, kind, title, mime, at, url, folder,
  seconds?, width?, height?, slides?, versions }`: `kind` is cut, video, meme, carousel, image, cover, figure,
  thumbnail or note (a plain-text file such as the post's description); a carousel's `slides` are its cards in order,
  the newest version of each; `versions` are the older files of the same asset, newest first (a reskin "-black-v2" is
  the newer version of the file it reskins). Working folders (`working ...`), pages, scripts and manifests are left to
  Drive. Null when Drive could not be read, with `sources.drive` false.
- **Seeing one.** `GET /api/board/<Monday>/drive/<file id>` (the board's own login) serves a file the week's `posts`
  list (an asset, a slide or a version; 404 `drive_file_not_found` for any other, 503 `drive_unavailable` when Drive
  cannot be read), the same way as a cut: copied once, then a short signed link (302).
- **Held by:** `tests/control-plane/board-drive.test.ts` and `tests/control-plane/board-view-contract.test.ts`.

## The live check on a sent post (Krish, 2026-11-19)

Krish: "There need to be automatic checks done on the live posts to verify that everything posted correctly, because a lot of the times thumbnails and covers don't go correctly (or carousels are supposed to have audio tracks and do not)... Once the post is verified live, the board needs to self-update live. Again that should be all completely autonomous."

Control Center's 15-minute Buffer sweep (`api/_doneChecks.ts`, `buffer_sent`) already moves a card to Live when Buffer shows the post sent. Since 19 Nov it also reads each sent post again as Buffer holds it and checks it (`api/_liveVerify.ts`, a pure function, `tests/api/liveVerify.test.ts`): sent with no error, its public link, its caption, every file with an address, every picture's alt text, a video's cover frame (`thumbnailOffset`, on every service that shows one), a carousel's card count, and a carousel's audio track (a video, or Instagram's music sticker; a meme keeps its own sound and is not asked for one). The verdict rides the post entry as `verify {at, ok, passed, failed[]}` and is accepted only from the done-check client (`growthPost`, `_offdayItems.ts`); Growth's own record cannot claim one. The card's live line says "Checked live: every post matches how it was made", or "It did not all go out right: Instagram: a carousel went out with no audio track...". A post Buffer could not be read for says nothing and is never shown as checked. The card moves by itself, with no press and no session.

Not checked yet, because Buffer cannot show it: the pixels a platform rendered and an audio stream inside a video file. A check this layer cannot make is left out, never reported as passed.

## Approve for publish, bound to the manifest (contract 1.8.0)

Growth posts only what Krish approved (docs/GROWTH-HANDOFF.md, "The piece manifest"). A piece's draft manifest
(`scripts/post-pack/piece_manifest.py draft`, sent with the post's pack to `3 Posts/<pack.folder>/0 Publish/
manifest.draft.json`) lists its exact files in order, each with its Drive id and sha256, and each channel's words. The
old board page's Approve for publish bound its sha256; the live board's view carries that press from 1.8.0
(`apps/control-plane/api/board/_manifest.ts`).

- **In the view:** each series day's `manifest` is `{ sha256, qa, assets: [{ name, drive_id, sha256, order, url }],
  channels, state, approved_at, press, why }`, or null when the piece has no draft. The draft is the library's newest
  ready copy, its bytes checked against the sha256 the library recorded. `state` is `waiting` (no press of his binds
  it), `approved` (his `picks/<day>-publish`, his login only, approved and bound to exactly this sha256) or `changed`
  (his press binds another draft: `why` says the files or words changed after he approved them, and the press reads
  "Approve the new files for publish"). `press` is `{ kind: 'press', label, collection: 'picks', id: '<day>-publish',
  revision, body: { kind: 'approve_publish', day, piece_id, approved: true, manifest_sha256 }, stamp: ['at'], done }`,
  null once his press binds the draft; while it waits it also leads the day's `actions`. Control Centre shows every file
  of the manifest, each seen and linked in Drive, beside the press.
- **His press:** `PUT /api/board/<Monday>/picks/<day>-publish`. The route refuses a press whose `manifest_sha256` is not
  the draft as it stands now (409 `manifest_changed`, a page left open while the draft changed) or names a piece with no
  draft (409 `manifest_not_found`). A press with no `manifest_sha256` (an older piece) and a take-back are unchanged.
- **The seal:** `piece_manifest.py seal --draft D --approval <his picks/<day>-publish document>` accepts the press as
  the live board saves it and refuses it for any other draft ("bound to another manifest").
- **Held by:** `tests/control-plane/board-manifest.test.ts` (the bind, the seal through piece_manifest.py itself, the
  refusal on a changed hash) and `tests/control-plane/board-view-contract.test.ts`.

## The Publish step on a finished post (week model, 18 Nov 2026)

**Growth places it; nobody asks Krish (Krish, 2026-11-19: "I've never decided the channels before. They are just known by the growth repository. Post time, I've never decided before. Caption always gets generated by the growth repository.").** The Publish prompt names the channels and formats of the post's Growth lane and its four daily slots, both read from `vendor/makeyourmindup/mix.json` (growth-makeyourmindup's `mix.json`, vendored byte for byte and pinned by sha256 in `tests/control-plane/growth-placement.test.ts`; `apps/control-plane/api/board/_growthPlacement.ts` only maps a board kind to a lane). The session writes each channel's caption in Growth's account voices (`docs/ACCOUNT-VOICE.md`), files them on the piece, and gives Buffer each file as a Drive download address (`https://drive.google.com/uc?export=download&id=...`), which Buffer accepts (the 18 Nov explainer's eight images went in this way). A missing channel list, time, caption or "public link" is never a reason to stop. A channel Growth holds (TikTok short video) is skipped and named, never the whole post. Still not built: a Publish press that schedules with no session at all. That needs Growth's maker to take a finished post from the board as its input; the walls (`docs/GROWTH-HANDOFF.md`, Growth's `docs/PUBLISHING-AUTHORITY.md`) say who may call Buffer, so it waits on his ruling.


Krish, 2026-11-18: "when a piece is complete [...] Everything's there, ready to publish, with a button that just says
'Publish.' Which would then schedule in Buffer directly, ideally, or produce a prompt that I could do it in a session";
"we need to ensure all the assets are visible in the board including the covers, thumbnails, captions etc". Before this a
post made and filed in its Drive folder stopped at "Made: its files are made and filed" with only the Claude production
prompt, and no session could move it on.

- **The card.** A made, unscheduled, not missed off-day post whose files are in its post folder (the view's `posts[].assets`)
  leads with one button, **Publish**, and carries `assets` on the model item: every file by kind (cut, carousel with each
  slide, image, cover, thumbnail, caption or note), its folder and its Drive link, so he sees each one beside the button.
- **The prompt (the fallback, built).** Publish opens a prompt that lists every file and says: check each from its link,
  schedule one post per listed channel through the Buffer connector with each caption verbatim and its files attached, never
  a different file, never publish now, read each back from Buffer, and report on the board. His pressing it is his approval
  for exactly that list, so this one prompt's wall allows scheduling that post and nothing else (`WALLS_SCHEDULE`); every
  other prompt keeps "never post or publish anything". Control Centre reads Buffer every 15 minutes (done-check
  `buffer_sent`) and moves the card to Scheduled by itself.
- **Its files at every step, and a moved post's folder.** `assets` stays on the card once it is Scheduled or Live (no Publish
  button then). A post's Drive folder is dated for the day it was first made for, and a post he moves keeps it: `dayPosts`
  now also takes a folder of another day of the week when an option on this day names it (`drive`), or, with nothing naming it,
  when its title is contained in exactly one option's title (never a guess between two). This was why Thu 19 "Free ChatGPT has
  ads now", scheduled on Instagram for Fri 20 with its eight cards and caption in `2026-11-17 Tue off.day - ...`, showed no
  files at all (Krish, 2026-11-18). Held by `tests/control-plane/board-week-model.test.ts`.
- **A post's folder follows its day, even when its folder is bound after the move.** Move to... renames the bound folder to the
  new date and day (`followDrive`). The Thu 19 post was moved at 21:25 UTC and Growth bound its folder, dated Tue 17, at 21:31, so
  that rename never ran. `reportPosts` (every Growth or Buffer-sweep report on an item, 15 minutes apart) now also puts the bound
  folder's name right by its ID whenever it touches a placed item, and records a rename or a failure in the item's `followed`. The
  board also reads the item's own `drive_folder` as the option's folder when the plan names none. Never a move or a deletion.
- **Not built yet.** Scheduling from the button itself, with no session: Control Centre's Buffer key can write, but its
  code is held to reads by a ruling and `tests/api/bufferSent.test.ts`, and a bound approval for a post with no manifest
  does not exist yet. Held for Krish's go on both.
- **Held by:** `tests/control-plane/board-week-model.test.ts`.

## The proof on any piece, and Approve for publish on an off-day piece (contract 1.31.0)

Krish, 2026-11-18, on Tue 17's habits voiceover: "nothing has changed on the board - this seems like a system UI workflow
failure"; "the board needs to update to a new state - the final state for me to press approve or make any comments /
feedback, and copy the final prompt back in to that same session"; "once the final assets, covers, thumbnails are produced
and filed in drive, that then replaces the mocks/proofs stage, which might be a final board state - at which point I can
press Publish". The produce session filed its proof on the piece and the board had no press for it: `<day>-proof` was a
Monday, Wednesday and Friday name, and an off-day piece he records had no Approve for publish.

- **The proof press, any piece, any day:** `PUT /api/board/<Monday>/picks/<day>-proof-<the piece id's first 8 hex>`
  (`PROOF_ID`), kind `approve_proof`, the same body (`gateBody`: the clip's sha256, approve, or reject with his words) and
  the same write as `<day>-proof`: `meta.making.gates.proof`, which `ve proof` and `ve render` read
  (`scripts/velib/gates.py`). One document a piece, so two pieces on one day never write over each other's answer.
  Control Centre's card builds it once the proof is on the piece (role `proof`) and shows every asset with it.
- **Each material's sha256** is in the view (`days[].materials[].sha256`, a stored file's, null for a link or a text),
  so a press binds to exactly the file he saw.
- **Approve for publish on an off-day piece he records:** the day's draft manifest is read for every day's piece, not only
  the series days, and `picks/<tue|thu|sat>-publish` (`OFFDAY_PUBLISH_ID`) takes the series body (`approve_publish`, bound
  to the manifest's sha256; `checkPublishBind`). Once the piece's final files and their draft manifest are in its post
  folder, the off-day card's next step is that press, as his decision (`postItemBase`): it replaces the mocks and the
  proof. Its seal (`piece_manifest.py seal`) is what Growth's go-live schedules in Buffer; content-engine never calls Buffer.
- **Held by:** `tests/control-plane/board-offday-proof-publish.test.ts`, `board-view-contract.test.ts` and
  `board-week-model.test.ts`.

## A day that passed while its piece is still being made (contract 1.32.0)

Krish, 2026-11-19, on Tue 17's habits voiceover (piece 701a2c55): "I don't see this on the board anywhere." Its proof v9 was filed and a production session waited on his Approve proof, but once Tue 17 passed the card read Missed, the proof press vanished and there was no Move to….

- **The rule (`stillBeingMade`, `_weekModel.ts`):** a piece is never Missed while it is still being made: a proof filed on it whose gate (`meta.making.gates.proof`) he has not answered for that exact file (the newest proof's sha256; a newer proof is a new question); or a production session working on it (`working` or `blocked`); or its final files filed with their Approve for publish not pressed. Missed stays for a finished or due piece never marked live. It applies to a series day's piece (`pieceItem`), a piece placed on another day (`placedPieceItem`) and an off-day post he records (`postItemBase`).
- **The shape:** such an item has `missed: false` and `passed: true` (`modelItem.passed`, since 1.32.0). Its line says "Its day, <day>, has passed and it is still being made: <why>", its next step is the real one, and its `move` stays so Move to… is offered beside the step (Control Centre draws a Move to… button in the card's footer).
- **Held by:** `tests/control-plane/board-week-model.test.ts` (a passed day with a proof waiting, with a session working, with his answer to that exact proof, an off-day post he records, and nothing in production still reading Missed) and `tests/control-plane/board-offday-proof-publish.test.ts`.

## His answer on each cut (contract 1.6.0)

The approved mock M5 gives every cut in the Cuts tab its own Yes, Not this, Change it and Add a note. Change it and Add
a note are his words on the day ("Add your thoughts", pinned to the step). Yes and Not this are this press, one per cut,
built by `apps/control-plane/api/board/_cuts.ts` on every read.

- **In the view:** each item of a day's `media` whose `kind` is `cut` carries `presses` `{ yes, not_this }` and
  `verdict`. Each press is in the shape of the action kind `press`: `{ kind: 'press', label, op: 'cut-verdict', body:
  { piece_id, media_id, verdict: 'yes' | 'not_this' }, stamp: [], done }`, and Not this also carries `words` `{ path:
  'words', ask, required: true }`, so the board asks for his words first and never sends it without them. `verdict` is
  his latest answer on that file `{ said: 'yes' | 'not_this', words, at }`, or null. A thumbnail carries neither.
- **His press:** `POST /api/board/<Monday>/cut-verdict` with `{ piece_id, media_id, verdict, words? }`, his press only
  (403 `his_press`), on a piece scheduled in that week (404 `piece_not_in_week`), on a cut on that piece's own making
  record (`meta.making.video_assets`, the media id the view gave; 404 `media_not_found` for a thumbnail or any other
  id). 400 `invalid_media`, `invalid_verdict`, and `words_required` for a Not this with no words. His words are kept as
  he typed them, trimmed, up to 4000 characters.
- **Kept append only on the piece:** one entry per press in `content_ideas.meta.cut_verdicts`, `{ media_id, cut,
  verdict, words, sha256, path, by: 'Krish', at }`, where `sha256` and `path` are the file's on the making record.
  Nothing is rewritten or removed; the same answer pressed twice in a row on one file is kept once (`already: true`).
  The write is guarded on the row's `updated_at` (`patchMeta`), so a write that lands in between is kept (409
  `piece_busy` when they never stop), and the `content_ideas` trigger bumps the week's `board_signal`.
- **What it never does:** change, refile or publish the cut, or unlock anything. It is not the Approve cut gate
  (`meta.making.gates.final`, "The production gates on a day's tab"). A new render is a new file with a new media id,
  so an answer stays with the file he saw, and the new cut waits for his.
- **Not `cut`:** `GET /api/board/<Monday>/cut` is the read-only view of his Approve cut documents and stays so; his
  answer posts to `cut-verdict`.
- **What a Not this teaches** (`fileCutLearning`): the same learning his other rejections on the board feed, after the
  press is saved and only when it is new (never on an `already` answer, never on a Yes):
  - his taste ledger: one `taste_reports` row, `krish_words`, his words as typed, said where ("publish board, <Monday>
    <day>, Cuts: Not this on the long cut") and when, lane `production`, `dislikes`, subject `piece:<id>` (the row a
    Reject of the proof files);
  - the rejection inbox: one `taste_rejection_inbox` row, `rejected`, his words alone with the piece and the cut's
    format (`long_video` for the long cut and a feature, `short_video` for the short), the file's library path and
    sha256 in `meta`; no Drive id, since the cut is reached by its library path (the row a Reject asset files, which the
    inspirationhouse rejections job compiles into the rejection floor);
  - the failure loop: one `engine_incidents` row, `krish_reject` at the `cut` stage, with his words, the file's sha256
    and the piece's preflight receipt as it stood (`docs/learning/README.md`).
  Each is keyed on the piece, the file and his words, so the same words on the same file file once. None blocks the
  press: the answer says what happened to each, `learned` `{ taste, inbox, incident }` (`filed`, `failed`,
  `waits_on_migration`, or `refused` for an incident the table refuses).
- **Who reads it:** the view (each cut's `verdict`); the piece's record, `GET /api/content-ideas/<id>/making`, answers
  with every press (`cut_verdicts`, oldest first), and `making.py <id> show` prints each one in his words, which
  make-piece and produce-video read before the next cut ("A Not this is the brief for the next cut of that kind").
- **Held by:** `tests/control-plane/board-cuts.test.ts`, `tests/control-plane/making.test.ts`, the making self-test and
  `tests/control-plane/board-view-contract.test.ts`.

## Thumbnail options and his pick (contract 1.16.0)

Ruling (Krish, 2026-11-15, approved with the specialists plan): thumbnail options carry a pick press on the Content
board. The thumbnail-designer skill draws two or three options, a separate critic judges each file by its sha256, and
the set is on the piece's making record (`meta.making.thumbnail_options`, `apps/control-plane/api/_thumbOptions.ts`).
Until 15 Nov he answered only in a session; now the board shows the set and takes his answer
(`apps/control-plane/api/board/_thumbs.ts`).

- **In the view:** a series day whose piece holds a set the critic judged, and not every option blocks, carries
  `thumbs`: `{ set_sha256, headline, state, line, options, grid_mock, critic, answer, not_this }`. Each option is
  `{ id, note, files, critic: { line, blocking, best }, press }`, its files the tall then the wide, each
  `{ shape, src, drive, sha256 }`, where `src` is the same-site Drive file route `/api/board/<Monday>/drive/<drive id>`
  of its review copy and `drive` its Drive link. The critic's `line` is one sentence: held, with its reason; all seven
  checks pass; or how many pass, with its first note. A set the critic has not judged, or holds back whole, is never
  carried: the skill never puts options below the bar to him.
- **States:** `awaits_pick` (every file and the grid mock are in Drive, and nothing is answered); `not_in_drive` (the
  review copies are not all in Drive: no press, since he cannot pick what he cannot see); `picked` and `redraw` (his
  answer, in `answer`, `{ said, option, how, words, at }`, and no press).
- **His presses, while it waits:** Pick on each option the critic does not hold (`press`), and Not this on the set
  (`not_this`, its words optional: "What should the new ones do differently?"). Both are `POST
  /api/board/<Monday>/thumb-pick` with `{ piece_id, set_sha256, verdict: 'pick' | 'not_this', option?, words? }`, his
  login only (403 `his_press`), on a piece scheduled in that week (404 `piece_not_in_week`). 400 `invalid_set`,
  `invalid_verdict`, `invalid_option`.
- **The decision on the day:** the week model leads the piece with **Pick the thumbnail** (`op: thumb-pick`, its
  `choose` at `option`, the critic's pick first and marked) while the set waits on him, after an Approve for publish
  and before anything else. Control Centre opens the options at their own shapes from it; the choice is what a board
  that cannot draw them still sends.
- **The write:** his pick lands on the making record as `thumbnail_options.pick` `{ option, files, decision: "picked on
  the board", at: his press time, by: Krish }`, bound to the set's hash and that option's files by the making route's own
  rule (`thumbnailOptionsProblems`). It is his decision, never words he did not type: `krish_words` stays for a pick he
  gave in a session. Not this lands as `thumbnail_options.redraw` `{ decision: "not this: draw them again", words, at,
  by: Krish }`. A press on a set that is no longer the one on the record is refused with the making route's 409
  `thumbnail_options_unbound` (and its `problems`), an option the critic held with 409 `option_held_by_critic`, and a
  different answer after one with 409 `thumbnails_answered` (a change of mind is recorded by a session, in his words).
  The same answer again changes nothing (`already: true`). Guarded on the row's `updated_at` (`patchMeta`).
- **What closes the ask:** the session's one item on his list (`thumbs-<set>`, `making.py thumbnails --ask`, closes on
  `video`) closes by the done check, never a cron: after the write the engine asks Control Centre's sweep to look at the
  piece's open items (`askChecksForPiece`), and its `piece_step` check closes a `thumbs-<set>` item as soon as his
  answer to that set is on the record, and at the latest when the Video assets step lands.
- **What a Not this teaches:** with his words, one `taste_reports` row (his words, `dislikes`, subject the piece) and
  one `taste_rejection_inbox` row (format `thumbnail`, for the rejection floor), once each, never blocking (`learned`).
- **Then:** `making.py video` accepts the picked option's files as before (`option_pick_problem` reads `pick.option`
  and its sha256s), and produce-video files his pick. A Not this sends the session back to step 5 of the skill.
- **The review copies:** before asking, the session files each option's two files and the grid mock in Drive's Inbox
  from My AI (`docs/DRIVE.md`), records their ids beside the set with `thumb_options.py drive OUT a:wide=ID ... mock=ID`
  (`OUT/drive.json`), and records the set again with `making.py PIECE thumbnails OUT`, which carries each `drive_id`;
  the same set recorded again keeps its verdict and his answer. `GET /api/board/<Monday>/drive/<id>` serves only those
  ids of a piece of that week, beside the week's posts.
- **Held by:** `tests/control-plane/board-thumbs.test.ts`, `tests/control-plane/thumb-options.test.ts`,
  `tests/control-plane/board-view-contract.test.ts`, the thumb_options and making self-tests.

## Sessions and materials

Krish, 2026-11-11: "If I copy a Claude prompt out of the content publish board ... that session should automatically
update the board once it's done or as it's going. This system should be immune from multiple sessions working on stuff
simultaneously and should have a rock-hard repository for everything it's drawing on. ... if I put a screenshot in as
inspiration for that day or if I put a research corpus in as supporting material, that should never be lost again. Even
if I ran four separate sessions on one piece of content, it would know where everything was."

**What a copied prompt says.** Every Claude and Growth prompt on the view ends with one instruction
(`apps/control-plane/api/board/_writeBack.ts`, `writeBack`; a Perplexity prompt does not, it is not a session). It names
the piece (or the week and the day when there is no piece yet) and the step, and tells the session to: see what is on
file and who else is on the piece first; choose a session id once and report `start`, `progress` at each milestone, and
`done` (or `blocked`, with what it needs); and file everything it makes or draws on on the piece, never only in its chat.
Its fourth line is the research rule (`RESEARCH_RULE`; Ruling, Krish, 2026-11-11): research is never left in scratch or
a chat, every research document is filed on the piece as it is written, and a Markdown file Krish sends is filed on the
piece first. Its fifth is the walls (`WALLS`): this board is the only place to put the work (the old pages at
content.krishraja.com/board are retired and redirect to it), and a session never posts or publishes anything and never
puts an idea on the publish board.
Two doors, both on the same routes and rules, and neither puts a key in the prompt:

| Door | For | Authenticates with |
|---|---|---|
| Control Centre's connector: `get_piece_board`, `report_board_session`, `add_piece_material`, `read_piece_material` | a claude.ai chat, and a Claude Code session that has the connector | the connector's own sign-in; Control Centre calls the engine on his access cookie, labelled with the session (`via: control_center`) |
| `python3 scripts/post-pack/board_session.py PIECE show / start / progress / done / blocked / add / read / archive` | a session in a checkout of this repository (Claude Code, Codex, either home computer, GitHub Actions) | the engine key `scripts/engine.py` already finds (the cloud session's network secret, `ENGINE_OPERATOR_TOKEN`, or Windows Credential Manager) |

**The routes** (`apps/control-plane/api/_pieceStore.ts`; Control Centre reaches both through its own `/api/content-ideas/*` rewrite):

- `POST /api/content-ideas/sessions` a report: `{ piece_id | week+day, session_id, kind, step?, summary?, client_key?, fields? }`.
  The answer names the other sessions on the piece.
- `GET /api/content-ideas/store?piece=<id>` (or `?week=<Monday>&day=<mon..sun>`) the one listing: every material on the
  piece, its day and its week (latest version of each; `&all=1` every version, `&archived=1` the archived ones), each
  session's presence and last line, the latest value of each field, and the newest reports. Reading a piece first files
  anything on its working set the store does not hold yet.
- `GET /api/content-ideas/store?op=read&id=<material>` a text as JSON; a file as a short signed link (`&link=1` for JSON).
- `POST /api/content-ideas/store?op=text|link|upload-url|confirm|archive`. A file is two calls: `upload-url` (its name,
  sha256 and size; up to 64 MB, any type the content library takes) gives a signed address for the bytes, and `confirm`
  reads every byte back and checks the sha256 before it counts.

**The rules that make several sessions safe** live in the database (migration
`20261125093000_board_sessions_and_piece_store.sql`), so they hold whichever door a write comes through:

- A report is one appended row in `board_session_events`, idempotent on the session's own key for it: a retry lands
  once. A session's presence is read from its latest lease (30 minutes from each report by default; `done` and `end`
  close it): `working`, `blocked`, `quiet` (it went silent), `done` or `ended`. Nothing is updated in place.
- A field a session sets on a piece (`board_piece_fields`) names the revision it read. `set` is refused with what is
  there now when another revision landed first; `append` adds to the list as it stands, so two sessions appending at
  once both land. Nothing is overwritten silently.
- A material is kept by its sha256: a text in `material_texts` (the database checks the hash), a file in the content
  library's bucket at `files/<sha256>.<ext>`, a link by its address. `piece_materials` keeps one row per version of each
  `material_key` (the same bytes again are one material; a new version never removes the old), on a piece or on a day
  with no piece yet. Nothing is deleted: the tables refuse delete, update and truncate (archive only, which hides a
  material from the lists).
- The piece's working set, `content_ideas.meta.materials`, stays what the writers ground on. A trigger files every
  change to it in the store in the same write, so a material trimmed from the working set (it keeps 40), taken off by
  `DELETE /api/content-ideas/<id>/materials`, or lost to two writers racing is still on record. The writes to the
  working set from the store, from the old materials route and from the board's research are guarded on the row's
  `updated_at`, so a making record that lands in between is read again and kept.
- Piece materials only: brand assets live in the brand kit (`docs/DRIVE.md`, "The brand kit"), never here.
- Research is copied into his Drive's research library (`makeyourmindup > 6 Research library`; `docs/DRIVE.md`, "The
  research library"): a material of kind `research`, `corpus`, `note` or `paste` (or role `research`, `sources`, `corpus`
  or `notes`) gets a copy with the store's exact bytes under its week and piece, and a row in the library's `00 Index`.
  `POST ?op=text` and `?op=confirm` copy it at once and answer `library` (`copied` or `already` with the Drive link,
  `later`, or `not_research`); the hourly sweep `research_library_mirror` copies the rest. The store stays the record:
  a failed copy loses nothing, and the library only ever gains folders, files and rows.

**On the board.** Each day of the view carries `sessions` (who is on the day's piece or the day, working first, with
their step and last line) and `materials` (what is on file, newest first, with a thumbnail id for a picture and no text
or link). Control Centre's Publish Board draws them inside its existing tabs until the redesign places them; its own
upload (drag and drop, the camera or photos on a phone) is the same two calls through Control Centre's rewrite.

**Held by:** `tests/board-sessions-db.mjs` (the migration on PGlite, and on a real Postgres four sessions on one piece at
once: every report, note, screen grab, version and racing paste lands, and every set names the revision it read),
`tests/control-plane/board-sessions.test.ts` (the prompts, the view, the routes), `tests/board_session_test.py` (the
script) and `tests/integration/board-sessions-e2e.ts` (a copied prompt followed for real against the routes and a real
database, with three more sessions on the same piece, and the view reading all of it).

## The board's own routes for research, files, looks and runs

The live board presses through these routes as well as the documents below; each is his login only and lives in
`apps/control-plane/api/board/`:

- `POST /api/board/<Monday>/run` (`_run.ts`, his press only) sends an allow-listed `repository_dispatch` on the token
  the board already holds (`OFFDAY_REVISE_DISPATCH_TOKEN`); every job it names lists its own type.
- `GET /api/board/<Monday>/media/<id>` answers one id of that week's `media` (`_media.ts`: the newest asset of each cut
  on its making record and that cut's thumbnail, by an opaque id, with no library path, store link or key) with a short
  signed link (302) to the library file, or to the board's copy of its Drive file when the library has none, and 404
  for an id that is not on that week's pieces or has neither.
- `POST /api/board/<Monday>/research` runs sonar-pro (`_research.ts`, metered) and files the answer on the piece
  (`meta.materials`); `POST /api/board/<Monday>/material` files a Markdown file dropped on the day the same way.
- `POST /api/board/<Monday>/look` saves his pick from `config/style-references.json` formats, the Sunday room's
  recommendation first, with his own words on his production inspiration beside it (`meta.look`).
- A revised off-day option is judged as the same `queue/off-<day>-<id>` record, bound to the same hashes
  (`_offdaySides.ts`, the same values `scripts/post-pack/week_plan.py` reads from the week's plan files).

## The production gates

Krish, 2026-11-04: "Can I select a visual style now that we have different
style skills? Do I get shown mocks at the right moment?" Each visual decision
on a ve piece is one press on its series day, in this order. Each press is his alone (`hisOnlyRefusal`), bound to
the sha256 of what it shows, and saved as `picks/<day>-<gate>`
(`board_documents` takes no new collection without a migration, so each gate
is also a read-only view: `GET /api/board/<Monday>/storyboard`, `style`,
`proof`, `cut`). After the save the server writes it onto the piece's making
record as `meta.making.gates.<gate>`, gate by gate, with the guarded write
Approve scripts uses (`_presses.ts` `recordGate`). The making route refuses a
patch that brings `gates`. ve reads them there.

| Press | What it shows | What it writes | What it unlocks |
|---|---|---|---|
| Sign storyboard | The storyboard and the expectations sheet (at most 6 lines, `ve expect`) | `gates.storyboard {by, at, sha256}`; sha256 of canonical `{"expect", "storyboard"}`, LF line ends (`scripts/velib/gates.py` `storyboard_sha`) | Recording |
| Pick a style | The style mocks side by side on his take, each with its name, one-line how, Pick and "Not for us"; "None of these" needs his words | `gates.style {by, at, sha256, module, reason?, verdicts}`; sha256 of the styles.json bytes; `module` null for None of these; `verdicts` `[{module, verdict: picked, seen or not_for_us, sha256}]`, which the engine's verdict writer folds into `config/style-references.json` (the server never edits that file) | `style.motion` |
| Approve or Reject proof | The moving proof beside the reference cards its spec names (`brand.references`) | `gates.proof {by, at, sha256, verdict, words?, cut?}`; sha256 the clip's; Reject needs his words | The full render |
| Approve cut (from the making record's cuts with their `sha256`) | Both cuts, each with its download | `gates.final {by, at, sha256, cuts}`; one cut: its file hash; both: sha256 of canonical `cuts` | Filing |

His words on a Rejected proof or on None of these go to his taste ledger as `krish_words` with where and when.

## His presses: what each one saves

Krish, 2026-10-28, asked where he presses and approves: "Publish board". On the
Ideas tab: "pick an idea for a specific day AND add any optional comments
easily, which can be saved, or I can: mark an idea as being useful in a future
wider piece OR mark it as being an idea that should be stored for a future trend
OR queue it for next week OR reject it", and of the off days, "I'm happy to plan
the Tuesday, Thursday, Saturday, and Sunday content within the Sunday ideas
session if you give me a few options to approve as you do the Mon/wed/fri" (Sunday
is now a rest day and nothing is published: Ruling, Krish, 2026-11-02). On
the day tabs: "Once I approve, the two scripts will go to teleprompter" and
"Server sends directly"; titles are a "Sunday evening press"; go-live is
"Approve each day Monday".

The live board saves each press as the document below (the view's `press` actions; "One live board", above), the
same document the old board pages saved, so every reader here reads it unchanged. The Where column names where the
press sat on those pages, retired on 13 Nov 2026; on the live board it is a press on the item or the day.
Every press saves at once into a store `board_documents` already takes, so no
migration was needed. Only the access-cookie actor (Krish) writes them: the
board refuses any other writer with `pick_note_is_his`, `press_is_his` or
`decision_is_his` (`apps/control-plane/api/board/_contracts.ts`
`hisOnlyRefusal`), and refuses any other writer a `picks` or `queue` document
he saved, whatever the new body carries, with `his_document`
(`apps/control-plane/api/board/_handler.ts`). A session reads them and never
writes them; a document whose `updated_by` is not Krish is never his.

| Press | Where | Writes | What the server does | Who reads it |
|---|---|---|---|---|
| Approve for the day (Pick until 11 Nov), with a note | Ideas, the pick box | `picks/<day>` `{pick, idea_id, series, story, so_what, option_sha256, day, at, note?}` | works out `option_sha256` from the words he saw (refused as `approval_hash_mismatch` when the press brings another), records the approval (`idea_outcomes`), and puts that idea on its day (`placePick`), answering `placed` `{status: placed, already or refused, date, error?}`; only his press does, and the database refuses any other placement ("The ideas gate") | plan-week: the note is his words for the brief |
| Save as a trend (Wider piece until 11 Nov) | Ideas | `queue/<pick>` `{use: "wider_piece_context", note}`, the trend his words name | records the outcome (trend) | the Inspiration House cue run reads it from the board (`src/collect/feedbackCues.ts`, documents Krish wrote) and files a `wider_piece_context` cue, his note as said (a theme when he named one); plan-week reads the cue. Never relayed to the idea queue |
| Future trend (until 11 Nov; reads as Save as a trend) | Ideas | `queue/<pick>` `{use: "track_over_time", note?}` | records the outcome (trend) | the cue run files a `track_over_time` cue; plan-week reads it. Never relayed to the idea queue |
| File for later (Next week until 11 Nov) | Ideas | `queue/<pick>` `{use: "next_week", target_week: <the Monday after>, queued: true, note?}` | records the outcome (filed) | plan-week relays it to the idea queue (`action: queue`, no verdict) and offers it first on the day it fits the week of `target_week`; the cue run files a `future_piece` cue |
| Reject | Ideas | `queue/<pick>` `{use: "not_for_us", reason}`; the reason is required (the board asks for it before it saves) | records the outcome (rejected) and files his reason to his taste ledger as his words (`taste_reports`, `ideaReport`); no rejection inbox row, since an idea is a subject and the rejection floor holds rules of form and process only | the cue run files a `not_for_us` cue, his reason as said, so the idea is never offered again. Never relayed to the idea queue |
| Improve for a future piece (11 Nov) | Ideas | `queue/<pick>` `{use: "improve", note}`, his note required | records the outcome (improved) and files his note to his taste ledger as his words | the next ideas run reads it as a cue on that idea (`sources.json`, `outcomes`) |
| Take a press back | Ideas, the same press again | `queue/<pick>` `{use: null}` | records the answer as withdrawn | nothing reads it as a press |
| Approve, Improve, Reject or Next week on an off-day option's idea, direction or returned mock (Ruling, Krish, 2026-11-01: "Mock looks right, lock it and build it"; it replaces the one mix press of 2026-10-30) | Ideas, Off days, each option | `queue/off-<day>-<option>` `{use: "offday", idea, direction, mock}`, each side `{verdict, words, sha256, at, shown}`; Improve and Reject need his words | his Improve and Reject words filed to `taste_reports`; an Improve not asked before sends an `offday-revise` dispatch (`.github/workflows/offday-revise.yml`) | Growth reads the approved options from `GET /api/board/<Monday>/pieces` (`offdays`); Sunday reads every verdict back as `offday_verdicts` |
| Move to… on an off-day item (Ruling, Krish, 2026-11-12: any off-day post or idea moves to any day at his press) | Every off-day option, on any day, and his Ideas for Later | `POST /api/board/<Monday>/move` `{item, version, from, to}`: his Approve for the new day (`queue/off-<day>-<option>` in its week) and his approval taken off the old one (`moved`), in one transaction with the row in `offday_items` | the post's Drive folder renamed to its new date by ID; a piece he records moves `scheduled_for` and its research index rows | Growth reads it on its new day from `GET /api/board/<Monday>/pieces`; what Growth still has scheduled on the old day is said on the item ("Moving an off-day item to any day", above) |
| Approve or Skip an off-day option (boards before the week's mix) | Ideas, Off days (any day of the week) | `queue/off-<day>-<option>` `{use: "offday", day, approved, copy_sha256, format, source, option_id}` | nothing | Growth makes and schedules what he approved, only while `copy_sha256` is the copy it holds |
| Approve or Skip an off-day piece he records (Ruling, Krish, 2026-10-29) | Ideas, Off days | the same, with `kind: "recorded"`, `piece_id`, `series`, `style`, `script` (the exact words he saw), `script_sha256` (worked out by the server), `folder_title`, `title`, `readers` | the server puts the piece on that day in its series, in flight, one short cut (`placeOffday`), sends the words to Teleprompter with his press as the approval and records the send; a Skip after an Approve takes it off the day unless recorded | the board shows what the send did (`send`); the recordings lane then waits for his short take |
| Approve scripts | Drafts | `picks/<day>-scripts` `{kind: "approve_scripts", day, piece_id, approved, texts: {cut: words}, scripts: {cut: sha256}, titles: {cut}, folder_title, folder_id?, script_ids?}` | works out `scripts` from `texts` (refused as `approval_hash_mismatch` when the press brings others); his own press sends his words at once and names any check still to run in `send.checks` (F49); a session's carried approval sends only words the piece's making record shows the scripts' check passed and two fresh readers read back (the gate `teleprompter_send.py plan` holds a session to), else holds them; sends with `sendApprovedScripts`, writes a send that read back to the piece's making record, and writes its answer into the same document as `send` `{status: sent, held, no_key, refused or error, folder_id?, scripts?, error?, recorded?, record_error?, checks?, at, by}` and answers a plain `line` | `teleprompter_send.py plan` (the `approvals` view); on `held`, `no_key`, `refused` or `error` a session checks the words if they need it, then sends exactly those words through the connector; on `sent` with `recorded: false` a session records it with `teleprompter_send.py record` and the ids in `send` |
| Titles | Record | `picks/<day>-titles` `{kind: "titles", day, piece_id?, picks: {long_title?, short_title?, long_thumbnail?, short_thumbnail?}}` | writes the long_title pick to `content_ideas.title`, the title of record the board shows over the pitch, and answers `title` `{recorded, waits_on_migration or failed}` (2026-10-31) | produce-video's Sunday-night run and the title round (the `titles` view); the home computers' overnight run starts once every picked day has one (`overnight.py due`). The press itself starts nothing |
| Approve for publish | Publish, after Download first | `picks/<day>-publish` `{kind: "approve_publish", day, piece_id, approved, manifest_sha256?}` | nothing on the server | `piece_manifest.py seal` (W2.8): only this press, bound to the draft manifest's sha256, seals `0 Publish/manifest.json` for Growth, whose go-live dispatch then names it with every slot `per_item_review` (one decision per post). Growth and Control Center read the go-live. It holds no fact sign-off: a go-live reader must also require the article's fact sign-off for the piece (the Article press, not built yet, and the fact gate), so a day never counts as approved with its facts unsigned |
| Scores (layout v3) | Publish, last on a made day; and each Archive row | `picks/score-<piece>` `{kind: "scores", piece_id, narrative, production, basis: at_publish or hindsight, note?}`, each mark 1 to 10 | one `piece_scores` row, `scored_by` krish, history kept (a new score is a new row; the same marks saved again file nothing twice); answers `scores: filed`, or `waits_on_migration` until the Wave 2 migration batch is applied | the Archive, Control Center's #/week and the retrospective (W3.6), through `piece_scores_current`, which counts his scores only |
| Reject asset | Publish, beside each ready file | `picks/<day>-reject-<asset>` `{kind: "reject_asset", day, piece_id, asset, label, reason, drive_id?, at_ms?, formats?}`; the reason is required | one `taste_rejection_inbox` row: his reason, where and when, the piece, the formats, and the file's Drive id with the moment (`at_ms`) or as the whole cut; the file itself is never copied | the inspirationhouse rejections job; the next session's repair round |

Of these presses only a rejected asset files an inbox row (a Not this on a cut
files one too: "His answer on each cut", above). Each row's `client_report_id` is the
hash of the week, the document and his words, so a press saved again files
nothing twice. A row that the inbox could not take is said on the board, and
the board document still holds his reason for a session to file.

Each Approve scripts press writes its document twice: his save, then the
server's, which adds `send`. `board_history` names Krish for both, because the approval must stay a document he wrote for
`teleprompter_send.py` to count it; `send.by` ("content-engine server") marks
the server's revision. A held send is not an error: his edited words, or words
the scripts' check has not passed or no fresh readers heard, wait for a session
to check them, and nothing reaches Teleprompter before that.

`GET /api/board/<Monday>/approvals` and `/titles` (`board_web.py read <Monday>
approvals`) are read-only views of the `picks` documents of that kind; nothing
writes to a view.

Sunday's sources: `python3 scripts/post-pack/board_feed.py gather <Monday>`
reads `GET /api/week/options?include=sources`, `GET /api/idea-queue?combine=1`
and the view of each of the three weeks before (what went out, `recent_posts`, for the repeat
check), all read-only and with no spend, into `docs/plans/<Monday>-week/sources.json`: each
series' pool, his ideas first, then near something he liked, then the ladder
score, each with `source_kind` and `why_here`, the queue and its combine groups,
and which source is empty and why. His ideas are `manual` rows (his words
through Control Center's one door) and topics he asked the engine to research
in Control Center (`requested_research` with `requested_by: Krish`); board items
that relay his words (`krish-ideas-*`, `said-*`) come as `his_relayed`. His
Inspiration House comes as `inspiration` (`_inspirationSources.ts`): the cards
he routed to Make a piece, the cards he answered, the ones he has not seen yet,
the production references he routed to Study style, content-watcher readings,
creator moves and taste claims; `must_cover` lists every routed card and
relayed board item the ideas board owes him. Every card carries the engine's read of it (`style`, inspirationhouse
tag-v4's `facets.style` in this repository's ids) and `grounded_in`, which of his own fields on the card the read was
built on: a grounded read is his steer, a bare one a guess (Ruling, Krish, 2026-11-17). Files in a reference set he
filed together (`facets.collection`, such as his thumbnail study) are for making, not story sources: they stay out of
the newest-500 window and out of the block unless he wrote on or routed one (`counts.reference_set_left_out`). `board_feed.py cover <Monday>` checks the week's `ideas.json` against
them before the board reads it: the file's own shape (at least four ideas a publishing day, each with what a business
person finds out, its story, why now, its fact and its linked source, `scripts/post-pack/week_plan.py`), every
`must_cover` id carried or accounted for, the style rules and the Wave 1 checks. The gather stops when the route has
no `inspiration` block. His taste steers this sourcing and ranking only; the
judges stay blind.

Videos: every piece is a 90-second and a 5-minute video. A 15-minute feature
appears as a third cut only on a piece Krish called one for
(`config/features.json`, house rule FEATURE).

## Read the board's store before every session that touches a week

For the current week and any unfinished previous week, read **all six** stores:

```
python3 scripts/post-pack/board_web.py read <Monday> ticks
python3 scripts/post-pack/board_web.py read <Monday> links
python3 scripts/post-pack/board_web.py read <Monday> edits
python3 scripts/post-pack/board_web.py read <Monday> picks
python3 scripts/post-pack/board_web.py read <Monday> queue
python3 scripts/post-pack/board_web.py read <Monday> comments
```

`approvals` and `titles` read his Approve scripts and Titles presses alone;
`picks` holds them too, beside his day picks ("His presses", above).

The CLI follows every page. Failed or inaccessible reads are blockers, never empty feedback. Access uses the existing
engine operator credential; do not paste it into a prompt, file or command line.

- Ticks retain the existing IDs and bodies. Copy completed publishing actions to
  the piece with the existing `making.py PIECE posted CHANNEL [url]` rules and
  actor attribution. `done: false` never deletes an existing making record.
- Links provide the actual published destinations; do not infer publication from
  a download or from a completed build.
- Edits are Krish's saved words. Carry them with `scripts/post-pack/edit_sweep.py` and file the sweep on the piece
  (`make-piece`, step 7). Tell him before changing a script he has recorded.
- Picks supply his day/idea choices, with his note; use the existing
  week-options workflow. `picks/<day>-<decision>` documents (a `kind`) are his
  decisions on a day, never a pick.
- Queue decisions supply his presses (`use`, with his note or reason). Never invent his decision.
- Comments include roots and replies with stable anchors. Read the whole thread,
  retain original metadata and distinguish notes from authorization to publish.

## Who writes to the board, and when

Ruling (Krish, 2026-10-29): "FYI, I want zero Claude routines. No Claude schedules of any kind in this architecture";
then "Could you not get Github to trigger Claude subscription to do something and then update the content.krishraja.com
board?" (the board was the engine's own page then; it is retired, and its addresses redirect to the live board). No
Claude routine writes to a board. The Sunday ideas board is `.github/workflows/sunday-ideas.yml`: Claude Code inside a
GitHub Actions job on his subscription (`CLAUDE_CODE_OAUTH_TOKEN`, never an API key), fired twice on Saturday (12:17
and 20:47 UTC, the second only a retry), idempotent for the week, and startable by hand or by a board press (by hand,
its `days` input makes again only the options nobody answered on those days). It fills the whole ideas board
once a week, Saturday's good news included (Ruling, Krish, 2026-11-11: the ideas board fills once a week in full,
Saturday's good news included; the Thursday good-news schedule is retired): the publishing days' options, every off
day's options and Saturday's five real, sourced stories, each checked against its primary source, with `stories_due`
the day it found them. Its guard (`scripts/sunday_ideas.py built`) counts the week as built only when the view carries
all of it. The trade-off, said plainly: the run fills the board for the week that starts eight days after its Sunday,
so a story it finds is about two weeks old by the Saturday it posts on (it is dated within the seven days up to the
run); before Growth makes the Saturday post, the fact gate checks every story against its source again.
`.github/workflows/saturday-goodnews.yml` stays, by hand only (the board's "Find the stories now" press, or Run
workflow), to find them again for a week; it has no schedule. The Monday final board is no built page: the live board
reads the week's records, and the overnight runner reports each cut made or held on its piece (Wave 2; until then the
first session on Monday), never Claude on a timer (`docs/CADENCE.md`). Every other write is a session he started or a
`make-piece.yml` run for a piece he signed. All of them write through the engine API (`ENGINE_OPERATOR_TOKEN`) and the
week's files the live view reads.

Videos: every piece is a 90-second and a 5-minute video. A 15-minute feature appears as a third cut only on a piece
Krish called one for (`config/features.json`, house rule FEATURE).

## The standards page

He opens `/board/standards` (also served at `/standards`) to decide the rejection floor in about 20 grouped decisions
instead of 215 (Krish, 2026-11-04: "group the 215 floor standards for my approval"). It is a decision page, not a board,
and stays. Each
card is one `taste_floor_groups` row (seeded once by `scripts/floor_group.py
--seed` from `config/floor-groups.json`) with its never-beneath line, its check,
how many standards and productions it covers, his own words from the members
verbatim, and the member standards behind a fold. Approve, Reword (his words,
required) and Reject go to `/api/board?op=standards` on the board's own login
and through the same decision write as POST /api/video-studio/learning-proposals
(`api/_learningDecision.ts`); the operator's key may read the page and is refused
a press. A decided group shows his decision, and every member standard takes it
in `public.taste_floor`. Nothing is decided for him.

## The old board pages are retired for good (Ruling, Krish, 2026-11-13)

Krish, 2026-11-13: "We need to retire the old publish boards now permanently". The engine's own board pages are gone:
the four Claude artifacts of October (frozen since 19 October; their addresses stay in `config/boards.json` `weeks`
only so the cost guard can refuse reading one whole into a chat), the baked week board (`week_board.py`, published by
`board_web.py publish-web` and `board-rebuild.yml`), the desk (`/board/<Monday>` from 10 November, the `board-next`
client) and the read-only archive both became on 11 November. Every old address, `content.krishraja.com/board`,
`/board/<Monday>` (with `#<day>` or `?archive=1`), `/board/next` and `/board/next/<Monday>`, answers a permanent
redirect (308) to the live board in Control Centre at the same week (`_handler.ts`, `OLD_PAGES`), before any read.
Nothing builds, publishes, downloads or rolls back a board page, and nothing stores a new build: the routes that took
uploads, imports, sources and a new build are gone, and the week's earlier builds stay readable for Control Centre's
list and Growth's ledger (`GET /api/board/<Monday>`, `/build`). The parts of the old builder still read live moved to
`scripts/post-pack/week_plan.py`. `tests/control-plane/old-boards-retired.test.ts` fails if any page, builder or publisher comes back,
or if anything a session reads first sends anyone to `content.krishraja.com/board` to work.

What was retired and where it lived: `docs/history/2026-11-13-old-boards-retired.md`. This page as it stood before,
with every section on the old pages: `docs/history/2026-11-13-PUBLISH_BOARDS-before-retirement.md`.
