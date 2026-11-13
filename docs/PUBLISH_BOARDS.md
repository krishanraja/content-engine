# Publish boards

The one live Publish Board is Control Centre's Content tab (Ruling, Krish, 2026-11-11), drawn from this engine's
view and pressed through its routes; this page says how it is fed and used. The engine's own board pages are retired
for good (Ruling, Krish, 2026-11-13: "We need to retire the old publish boards now permanently"): every old address,
content.krishraja.com/board/<Monday> included, redirects to the live board ("The old board pages are retired for good",
below).

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
  in seconds, not after raw.githubusercontent.com's five-minute cache. The Sunday ideas run, the good-news run (by hand
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
the other four on its other ideas, never a second Approve.

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
  as one board document per day: `picks/<day>-lock-words` (kind `sign_lock`, bound to the lock he approved by
  `lock_path` and `lock_sha256`, `making.py lock_body_hash`) or `picks/<day>-scripts-words` (kind `approve_scripts`, the
  exact words of each cut as the Approve scripts press carries them, with their Teleprompter titles and folder). Written
  only with `python3 scripts/post-pack/board_session.py <uuid> approve lock|scripts ...` (the board session tools, on the
  operator's key); `--sign` also writes his words as the lock's signature line when it has none, so `making.py`'s
  narrative check and the board agree. `_contracts.ts` (`WORDS_ID`, `wordsBody`) holds the shape; a session's document
  with `via: words` anywhere else is refused.
- **What it does.** The board draws it as "Approved in your words: "...", Fri 13 Nov (where)" on the day's Narrative lock
  or Scripts line, and the piece's path moves on as for his press. A lock's typed approval counts only while the lock on
  the board is the text his words approved (its hash); a lock he signed in the file shows his signature words the same
  way. Typed approval of scripts goes to his Teleprompter exactly as the Approve scripts press does (`afterPress`,
  `sendApprovedScripts`, held until the scripts' check and two fresh readers have passed); the Teleprompter gate
  (`_teleprompter.ts typedApproval`, `teleprompter_send.py typed_approval`) counts his press or this document, never
  another session's.
- **What it never does.** Put an idea on the publish board: his Approve on an idea (`picks/<day>`), his answers on the
  ideas board (`queue`), and the database's gate (`idea_outcomes`, `content_ideas_board_gate`) are unchanged and stay his
  presses alone (`hisOnlyRefusal`: `pick_is_his`, `press_is_his`). Nor any other decision (titles, publish, cuts, the
  production gates), nor taking an approval back.

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
  (`GET /api/inspiration/candidates`, for the roles it teaches, else look, motion and captions), with its
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
- **`sample_url`** is a rendered sample listed in `config/ve/style-samples.json`, as a same-site path, or null. None is
  listed yet, and nothing renders one to fill it.
- **His press**: `presses.yes` and `presses.not_this` (labels "Yes" and "Not this") each say `POST
  /api/board/<Monday>/<op>` with a body. `POST /api/board/<Monday>/style` takes `{ piece_id, motion?, captions?,
  reject?: { layer: 'motion' | 'captions' | 'treatment', id } }`, his press only, on a piece scheduled in that week, the same guards
  as the look. A motion id is checked against the bank on main and a caption id against `config/caption-themes.json`
  (400 `unknown_motion` or `unknown_caption`; a look id is checked by its shape, 400 `unknown_look`; 400 `invalid_reject`, 400 `nothing_to_record`; 503 `styles_unavailable`
  when the bank cannot be read). It writes `content_ideas.meta.style` `{ motion, captions, rejected: { motion, captions, treatment },
  by, at }` beside `meta.look`, read and written guarded on the row's `updated_at` (`patchMeta`), so a write that lands
  in between is kept, never overwritten (409 `piece_busy` when they never stop); the `content_ideas` trigger bumps the
  week's `board_signal`. "Not this" on the picked style takes the pick away; a later Yes takes a style back off the
  "Not this" list. It never edits a `creative-direction.json`.
- **Who reads it:** make-piece and ve read `meta.style` as the default for a new spec's `style.motion.module` and
  `brand.caption_theme` (`docs/ve/RUNBOOK.md`, S1), and a signed spec stays his.
- **Held by:** `tests/control-plane/board-style.test.ts` and `tests/control-plane/board-view-contract.test.ts`.
- **Routing:** `vercel.json` has no rewrite of its own for `/api/board/<Monday>/style`, and cannot have one, since
  `GET` there is the read-only view of his Pick a style documents. So the press arrives as the collection `style`, and
  the handler reads a `POST` with no id to `style` (or `cut-verdict`) as the press (`POST_OPS` in `_handler.ts`).
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
| Approve scripts | Drafts | `picks/<day>-scripts` `{kind: "approve_scripts", day, piece_id, approved, texts: {cut: words}, scripts: {cut: sha256}, titles: {cut}, folder_title, folder_id?, script_ids?}` | works out `scripts` from `texts` (refused as `approval_hash_mismatch` when the press brings others); sends only words the piece's making record shows the scripts' check passed and two fresh readers read back (the gate `teleprompter_send.py plan` holds a session to), else holds them; sends with `sendApprovedScripts`, writes a send that read back to the piece's making record, and writes its answer into the same document as `send` `{status: sent, held, no_key, refused or error, folder_id?, scripts?, error?, recorded?, record_error?, at, by}` | `teleprompter_send.py plan` (the `approvals` view); on `held`, `no_key`, `refused` or `error` a session checks the words if they need it, then sends exactly those words through the connector; on `sent` with `recorded: false` a session records it with `teleprompter_send.py record` and the ids in `send` |
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
reads `GET /api/week/options?include=sources` and `GET /api/idea-queue?combine=1`
(read-only, no spend) into `docs/plans/<Monday>-week/sources.json`: each
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
relayed board item the ideas board owes him. `board_feed.py cover <Monday>` checks the week's `ideas.json` against
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
and 20:47 UTC, the second only a retry), idempotent for the week, and startable by hand. It fills the whole ideas board
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
