---
name: plan-week
description: Plan the publishing week and run the Sunday room. Research at least four options for each publishing day (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap) and the off-day options, stress-test them, write them onto the pieces through /api/week/options and onto the Ideas tab of the week's publish board by 06:00 Sunday, read back Krish's five presses from the board, interview him one question at a time on all three picks to find the deeper story, write one narrative lock per piece for him to sign, start each signed piece's make in its own fresh session, and send approved scripts to Teleprompter when the server could not. Use when the Sunday ideas run fires in GitHub Actions, or when Krish asks to plan or re-plan the week.
---

# Plan the week

## Publish-board routing

Ruling (Krish, 2026-11-11): one live board, in Control Centre; the old board is a read-only archive. The week's
publish board is Control Centre's Content tab (`python3 scripts/post-pack/live_board.py <Monday> [day]` prints its
link), and it draws the week from the engine's `GET /api/board/<Monday>/view` (`docs/PUBLISH_BOARDS.md`, "One live
board"). Update it by writing what the view reads, never a page: the piece's making record (`making.py`), his presses
and his yes (`board_web.py read`, `yes.py`), and the week's plan files (`docs/plans/<Monday>-week/ideas.json`, the
narrative locks, the research) on main or on the week's branch `offday-revise/<Monday>`; when only a file changed,
`python3 scripts/post-pack/board_web.py touch <Monday>` makes the live board read the week again at once. Never build
or publish a board page (`week_board.py`, `board_web.py publish-web`): the content.krishraja.com pages are the
archive, read-only, and refuse every press. A question for Krish is a press the view carries or an item on his one
list; his approval of scripts is his own words in the session, recorded with `making.py <uuid> read-back CUT
--krish-words` before `teleprompter_send.py`. Claude artifacts stay retired (Krish, 2026-10-19), and
`scripts/hooks/artifact_gate.py` refuses every Artifact publish and every ArtifactData write. Steps below that build,
download or publish a board page, or work in a day's tab in draft, are history kept as written: read them for what
they record, and do the same work through the records above.

## Report to the board as you work

A session started from this skill, not from a prompt copied off the board, reports the same way a board prompt says
("Keep the board current as you work", `writeBack` in `apps/control-plane/api/board/_writeBack.ts`): first
`get_piece_board` on the Control Center connector, or `python3 scripts/post-pack/board_session.py <piece_id> show`;
then `report_board_session` (start, progress at each milestone, done, or blocked with what it needs), or
`board_session.py <piece_id> start|progress|done|blocked "one line" --session <id> --step <step>`; and everything it
makes or draws on goes on the piece with `add_piece_material`, or `board_session.py <piece_id> add <file or text>`. A
day with no piece yet is `day:<Monday>/<day>`. Add, never replace.

## The Sunday loop (rulings, Krish, 2026-10-28)

Krish records the whole week on a Sunday, and it goes live eight days later:
"record the entire week on a Sunday, but it does not go live until the Monday
after (8 days later)". So on the recording Sunday the week this skill plans
starts on the Monday eight days later (`<Monday>` below): on Sunday 1
November it is the week of 9 November, whose pieces go live on Monday 9,
Wednesday 11 and Friday 13 November. The backlog is not this loop's: Monday
26, Wednesday 28 and Friday 30 October go live on 2, 4 and 6 November.

"on a Sunday, Claude Code proactively brings me ideas", and then "Claude
interviews me on all three ideas to nail down the narrative arc, make it
really powerful, useful, and fun to consume, and really find the deeper story
beneath the surface story." That retires both halves of the rule of 11
October (Monday's piece only, and never asking him anything else on a
Sunday). The publish board is the one surface (his answer: "Publish board");
Control Center's #/week only tracks it. Still never ask him what
`docs/CADENCE.md` already answers (a 5-minute video and a 90-second cut, every
piece; Substack and YouTube, then Shorts, TikTok and Instagram).

**Zero Claude routines** (Ruling, Krish, 2026-10-29: "FYI, I want zero
Claude routines. No Claude schedules of any kind in this architecture"; then
"Could you not get Github to trigger Claude subscription to do something and
then update the content.krishraja.com board?"). No claude.ai scheduled or
fired trigger and no headless Claude on a home-computer timer runs any step
here. GitHub Actions is the scheduler, and Claude Code runs inside its job on
his subscription (`CLAUDE_CODE_OAUTH_TOKEN`), writing to the board only
through the engine API:

- **The Sunday ideas run**, `.github/workflows/sunday-ideas.yml`: GitHub's
  cron fires it early on Saturday (UTC), twice, because GitHub fires late; a
  guard (`scripts/sunday_ideas.py built`) makes it do nothing once the live
  board's view carries the week's options. It runs steps 1 to 7 only (of step
  0, only the Inspiration cards routed to a piece), and keeps `ideas.json` and
  `combine.json` on the branch `sunday-ideas/<Monday>-<run>` and on the week's
  branch `offday-revise/<Monday>`, which the live board reads before main
  (`scripts/week_branch_keep.sh`, with a pull request that merges itself).
- **The Thursday good-news run**, `.github/workflows/saturday-goodnews.yml`:
  the one other scheduled Claude run (Ruling, Krish, 2026-11-07). It fires
  twice on Thursday, finds that week's Saturday good news ("The Saturday good
  news" in `references/offdays.md`), puts it on the live board through the
  week's branch `offday-revise/<Monday>` (with a pull request that merges
  itself), bumps the week's change signal, and keeps a copy on
  `saturday-goodnews/<Monday>-<run>`. Stories found before the week's Thursday
  are last week's news, so it finds them again.
- **The Sunday room** is a session Krish opens himself. It merges that branch
  into its own, writes the `WORKBENCH.md` lines the run could not keep (step
  7 and "Without the connectors"), does step 0's close-out, then steps 8 to
  12. The run only reads the Inspiration cards (through `/api/week/options`)
  and never marks them; the room marks `routed_at` on the ones the plan took,
  after merging the branch.
- **Each signed piece's make** is one run of `.github/workflows/make-piece.yml`
  (step 11), never a routine.

The clock, in his local time (Control Center's operator time zone). Each row
names the checkpoint Control Center watches for it:

| When | What | Checkpoint |
|---|---|---|
| Saturday, by 06:00 Sunday | The Sunday ideas run (GitHub Actions) does steps 1 to 7: the Ideas tab is live | `week_ideas_ready` |
| Sun by 10:00 | Krish's five presses on every idea, about 15 minutes | `week_picked` |
| Sun 10:00 to 11:45 | The triage readback (step 8), then the interview (step 9), about 105 minutes | `narratives_locked` |
| As each lock is signed | That piece's make starts in its own fresh session (step 11) | `scripts_ready` |
| About 12:30 | His Approve scripts press per day: the server sends both scripts to Teleprompter and reads them back (step 12) | `scripts_sent` |
| About 15:30 | His Titles press: three options per surface. It records his picks; "I've recorded", said to Claude Code, starts the Sunday-night run (`produce-video`); a surface he has not picked by 21:30 takes its top-ranked option | `titles_picked` |

Once the Ideas tab is live, the Sunday room does three things only: the
triage readback, the interview and one signed narrative lock per piece. Then
it starts each signed piece's make, and sends approved scripts to
Teleprompter only when the server could not. It never drafts a script, an
article or a visual: each piece's make session does, from its signed lock
(`.agents/skills/make-piece/SKILL.md`).

## The channel, the idea tests and his asks (Krish, 2026-10-31)

The channel is smart entertainment: "Make Your Mind Up takes the strangest,
funniest and quietly biggest things AI did this week and makes them make
sense to a busy leader in one listen, so they walk into Monday with an
opinion of their own." Every idea passes five tests before it reaches him:

1. **Wait, what headline.** The first line makes a busy person stop.
2. **Pub test.** One real-world example he could tell a friend at the pub.
3. **One mechanism.** It explains one thing that works one way.
4. **Make-your-mind-up ending.** It closes on our take, never on orders.
5. **Chain test.** It can be told as a chain of 5 to 8 everyday
   cause-and-effect links, like Hannah Fry's short "your neurons are dated by
   nuclear bombs": an impossible-sounding claim, "let me explain", single
   steps with everyday objects, one number at a time, then a close that
   calls back to the hook. An idea that cannot be chained is not ready.

**His asks.** Every card he typed words on in the 45 days before the week
(`why_here`, a typed `why_like`, `would_do`), dismissed, style-only or
already a piece included, is in `sources.json` `asks` (newest first, his
words verbatim, its state) and in `must_cover` (`ask: true`). Each one is
used (an idea's `covers`), combined with others into one idea, or declined
in `accounted` with a reason. A `style_only` ask may be answered by its
style instead: name its id in an idea's `style_from`. One already made
(`piece_id`) is accounted, never offered again.

**Half and half.** Each publishing day (Monday, Wednesday, Friday) has at
least one option from his asks (`source_kind` `his` or `inspo`) and at least
one from engine research (`source_kind` `engine`). No idea repeats a piece
made or scheduled in the 21 days before the week (`sources.json` `recent`).
`board_feed.py cover <Monday>` checks all three.

**Every idea is a full story pitch.** Beside its existing fields an idea may
carry `pitch`: `{"headline": "<the wait, what line>", "hook": "<the opening
sentence>", "examples": ["<2 to 3 pub-test examples>"], "chain": ["<5 to 8
cause-and-effect links>"], "take": "<our take, the ending>"}`. Each carousel
option carries `cards`: `[{"words": "<what the card says>", "picture":
"<what it shows>"}]` (the board renders both).

## Steps

0. **Close out the week that is ending.** Copy Krish's ticks from its
   publish board onto the records (`.agents/skills/make-piece/SKILL.md`,
   "The week's ticks"), with that week's board link (its item
   `week-publish-board-<that Monday>`). The board is not closed by this: its
   item stays open, and every session's tick copy keeps reading it as last
   week's board until every picked day on it is at 100%, because Krish
   posts Friday's reposts at the weekend. Then `python3
   scripts/post-pack/teleprompter_send.py pending`, and again with `--week
   <Monday>` (the week this room plans is eight days out): a cut it lists
   goes to Teleprompter only once his Approve scripts press holds its exact
   words (step 12; Krish, 2026-10-28: "Once I approve, the two scripts will
   go to teleprompter", which replaces the standing yes of 12 October). A
   cut whose press came back `no_key` is sent as step 12 says; one with no
   press waits for it, named in one line on its day's tab. A cut sent by
   hand gets its record line instead, and one held back after a failed send
   is only named. Then relay his taps and comments on the ending week's "What I
   learned" lessons, the taste ledger's `taste:` ones included, exactly as
   `make-piece` says (yes, no, or a comment as his rewording), and only those
   whose `updated_by` is Krish. One he left alone stays proposed. Next, read
   every Inspiration card he routed to a piece that no plan has taken yet
   (`select id, name, kind, why_like, why_like_source, picked_likes,
   why_here, would_do, drive_file_id, read_as, note_for_claude, facets,
   transcript, piece_id from inspiration_items where 'make_piece' =
   any(routes) and answered_at is not null and routed_at is null and
   dismissed_at is null order by answered_at`; a card may carry several
   routes, and no time window, so a missed Sunday loses nothing): each is
   an idea of his for step 2. His own words are `why_here` and `would_do`
   (he types them) and `why_like` where `why_like_source` is `typed`;
   `picked_likes` are guesses he agreed with. Once the week's options are
   written in step 2, mark the cards the plan took (`update
   inspiration_items set routed_at = now() where id = any(<their ids>) and
   routed_at is null`), so no card is offered twice; his Undo on the page
   clears it. Take in each file the way `read_as` says
   (`watch` means the whole video with sound, never one frame; `transcript`
   holds its words when the ledger watched it) and follow
   `note_for_claude`; `facets` says its platform, format, source and who it
   features. Then the cards he routed to "Study the style"
   (`'study_style' = any(routes)`, same columns): study each before the
   week's recordings, as
   `docs/STYLE_REFERENCES.md`, "Cards he sends from the Inspiration page",
   says, and name in the reply which you studied and which are still
   waiting. Each card says what kind of thing it is (`kind`; Krish,
   2026-10-24: "It's important that you understand what the different types
   of stuff are in here"): a video saved for "the script, the narrative, or
   the production style" (his picks say which), an image for "the clarity",
   a research corpus, an idea or another document. Read three more kinds of
   inspiration for step 2. The feed's posts from the last 8 days, the latest
   fresh posts from the channels he follows (`select title, excerpt,
   meta->>'account' as account, meta->>'url' as url, occurred_at from
   taste_evidence where venture = 'publication' and source = 'drive_cold'
   and source_ref like 'instagram:%' and occurred_at > now() - interval
   '8 days' order by occurred_at desc`; the ledger is keyed by venture and
   this repository reads Make Your Mind Up's, `publication`): other people's
   posts, so a topic signal and never his view. The opinions about AI his cards carry (`facets->'opinion'`, a topic
   and the author's stance), where he tapped the topic or routed the card to
   a piece: a topic he may want to speak about, never his own stance. And
   the research corpora he named no piece for yet (`kind = 'corpus' and
   piece_id is null`): research waiting for a piece, read as the research
   for whichever option it serves.
1. **Read the idea queue first**, before anything else and before any
   research (Krish, 2026-10-19: ideas he likes that are not time-sensitive
   are queued, and the queue "needs to survive everything and be the first
   thing in chat"): `python3 scripts/engine.py GET /api/idea-queue --full`.
   Save the answer to `.cache/week-board/<Monday>/queue.json` (the board
   reads that file, never your memory of it). Tell him how many wait and
   how many have no verdict yet, and offer the queued ideas that fit each
   day before you research anything new. Copy his board marks into the
   engine first: every `QUEUE <pick> <verdict> <reason>` comment and every
   `queue/<pick>` doc with no `use` on last week's board (a week before the
   fixed layout; web `queue` and `comments` collections after active
   cutover; ArtifactData only for legacy sources) goes to
   `POST /api/idea-queue` (`action: queue` with `verdict`, `reason`,
   `angle`, `decided_by: "Krish"`, the idea's `so_what`, `story` as `idea`,
   `source_url`, `series`, `from_week`, `from_pick`). A mark with no verdict
   is only queued. Never write a verdict he did not give. Of his presses
   (a `queue/<pick>` doc with `use`), only Next week (`use: next_week`)
   goes there, as `action: queue` with no verdict, so it is offered first
   next week. Never relay Wider piece, Future trend, Reject or an off-day
   press to the idea queue: queuing those would offer again an idea he
   rejected or set aside. The Inspiration House cue run reads every press
   from the board itself (inspirationhouse's `src/collect/feedbackCues.ts`, documents Krish
   wrote) and files it as a cue; Growth reads the off-day ones.
   Copy his Combine taps the same way: `python3 scripts/post-pack/board_feed.py taps <last Monday>`
   prints a synthesize body for every `queue/combine-<n>` doc Krish wrote
   himself (`updated_by: "Krish"`; it skips any other writer and says so,
   and the board API refuses a session's tap). Send each to
   `POST /api/content-ideas/synthesize` with its series as `lane_slot`,
   `decided_by: "Krish"` and `said: null`. The `COMBINE combine-<n>`
   comment the tap posts carries the board's own words, which a session
   wrote, so it is never his `said`; set `said` only to words he typed
   himself in a comment of his own about that group. synthesize takes the
   members out of the queue, recording `absorbed_into` and
   `combined_by: "Krish"`. Never combine queued ideas without his tap or
   words: the route refuses (`queued_needs_his_word`).
   **Then gather every source in one read** (Krish, 2026-10-21: "a fresh
   batch of ideas that sources from all my different sources of ideas ...
   learnt from what I previously liked"): `python3 scripts/post-pack/board_feed.py gather <Monday>`.
   It reads `GET /api/week/options?include=sources` and `GET /api/idea-queue?combine=1`
   (no spend) into `docs/plans/<Monday>-week/sources.json`: each series'
   pool with his ideas first, then ideas near something he liked, then the
   ladder score, each with `source_kind` and `why_here`; the queue and its
   combine groups; `his_relayed` board items; and which source is empty and
   why. Say the counts and every empty source in your reply.
   **His Inspiration House is read in the same gather** (Krish, 2026-10-24:
   "Double check my inspirationhouse gets read properly when ideas are
   being built, alongside all the other sources of content suggestions").
   `sources.json` holds `inspiration` (`_inspirationSources.ts`): `routed`,
   the cards he routed to Make a piece, each owed a place on the board;
   `liked`, cards he answered with a why; `fresh`, cards he has not seen
   yet; `study_style`, production references (they feed the style, never a
   topic); `corpora`, content-watcher readings he dropped in; `creators`,
   creator moves with his angle; `claims`, taste claims (form only;
   evidence, never a rule until he approves one); `asks`, every card he
   typed words on (see "his asks" above); `recent`, the pieces of the last
   21 days. `must_cover` lists every routed card, every ask and every
   board item holding his words: each one goes in some idea's `covers`, or
   in ideas.json `accounted` with the reason it is not on the board. The
   gather stops when production has no `inspiration` block, and the board
   build refuses ideas that drop one (`board_feed.py cover <Monday>`). A
   card's `why_like` is his typed words; `endorsed` is a suggestion he
   tapped, never quoted as his.
   **Then read his feedback cues** (Krish, 2026-10-26: "all the feedback
   I've given you goes into a really clear set of cues that you can draw
   from in the future"). `sources.json` holds `cues` (`_feedbackCues.ts`;
   the Inspiration House files them daily from his queue verdicts and his
   typed card answers): `future_pieces`, ideas he wants made later, offered
   where they fit a day; `wider_pieces`, context kept for a bigger piece,
   grouped by `theme` (when a theme has gathered enough, propose the bigger
   piece and cite each cue); `tracked`, topics to check for news this week;
   `briefs`, his angle on how a piece should be told, carried into that
   idea's pitch; `not_for_us`, subjects never offered again. `said` is his
   words verbatim; `use_origin` says whether his words, a rule or a model
   guess named the use, and a `model_guess` is never quoted as his reading.
   Say the cue counts in your reply. When `empty` says the cues table is
   not there yet, say so and carry on. His taste
   steers this ranking only; never pass it to a judge. Most ideas arrive
   with no series yet (`unassigned`: 77 of 89 on 21 Oct, when
   under.the.hood's pool was empty), so read `unassigned` too and place
   each idea in the series whose mandate it fits, or leave it out; the
   placing is your judgment, said in your reply, never recorded as his.
   Then read `docs/CADENCE.md` and each series' mandate and the material on hand:
   `python3 scripts/engine.py GET "/api/week/options?week_start=<Monday>" --full`
   (mandates, options already written, what is in flight or scheduled, the
   judges' best, and the ideas Krish dropped in during the last fortnight).
   Also list the Drive "Cold Ideas & Inspo" folder for anything new, when the
   Drive connector is attached (see "Without the connectors" below).
2. Flesh out what Krish dropped in first: an idea of his is never ranked below
   an equal one of the engine's.
3. For each publishing day, find at least four real options. Prefer existing
   rows. Check each against the series mandate; Krish's ruling of 6 October
   (fascinating and aspirational, never dull enterprise subjects); freshness
   (the dated event is inside two weeks); overlap with what was published and
   with the other days; and whether its numbers can be sourced verbatim for
   the fact gate. Run an adversarial pass that tries to refute each option
   before you rank them; say plainly when only one survives.
3b. **The Ideas tab** (Krish, 2026-10-18: "adding a 4th tab at the front:
   Ideas. Cementing Ideas and basic narrative is Sunday's job", then "give
   me more than 3 from all my suggested sources and the ones I threw at
   other sessions last week"). It is live by 06:00 on the recording
   Sunday, so he can press before 10:00. Last week's Next week presses come
   first, before anything new: every queued idea he marked for this week
   (`use: next_week` with `target_week` this `<Monday>`, in the idea queue
   and in `queue/<idea_id>` on last week's board) is offered on the day it
   fits. Then draw the ideas from his own words:
   every idea he gave any session since the last Sunday (`krish-ideas-*`
   and `said-` items on `GET /api/workbench`, `dropped_by_krish`, his cold
   ideas in the Inspo folder), then the sources `docs/prompts/sunday-ideas-tab.md`
   lists (his saved inspiration posts, the people he follows, the radar).
   Start from `sources.json`: his ideas, then his inspo folder's, then the
   engine's, in its order. Every idea carries `source_kind` (`his`,
   `inspo` or `engine`; the board refuses one without it from 26 Oct),
   `why_here` copied from the gather when it has one (never invented), and
   `beats`, three to five lines of the narrative sketch
   (`docs/prompts/sunday-ideas-tab.md`), `covers` (the `must_cover` ids it
   answers, when any) and `style`: `{"script": <format>, "production":
   <format>, "experiment": {"format": <format>, "why": "the bolder try"}}`,
   each a format id from `config/style-references.json` `formats` (Krish,
   2026-10-24: "suggest script and production styles that I can choose
   from or that it recommends for specific content ... pushing and pushing
   and pushing, becoming more and more creative and experimental"). Pick
   the recommendation for the content (the format's `fits`), and make the
   experiment a format that has not been made yet. The board refuses a day
   with one script format, a day with no untried experiment, a week where
   one production format is over half the cards, and a format he marked
   not for us (`week_board.style_problems`).
   **The quality bar, before an idea reaches him** (Krish, 2026-10-24:
   "most importantly focus on improving your own work quality"). Each day's
   ideas are four different stories, never four angles on one headline.
   Each one's `so_what` names what the face (a senior leader who will not
   admit they are not ready) does differently on Monday morning; its hook is
   a specific, surprising, checked fact, never a category. At least one idea
   a day comes from his own words or his Inspiration House when either has
   anything that fits, and one is a wildcard the engine would not usually
   offer. Then hand the whole ideas.json to a separate reader (the
   `reviewer` subagent, no access to your reasoning) to try to kill each
   idea against this bar and the 19 Oct triage lessons below; replace every
   idea it kills before the board is built, and say in your reply how many
   it killed and why. Leave out a candidate with
   `near_drop` unless something new answers why he dropped its neighbour.
   Then write `docs/plans/<Monday>-week/combine.json` from the gather's
   combine groups: for each group that threads into one higher-level
   argument, `{"members": [its ids], "series", "thesis", "joins": [3 to 5 beats]}`;
   drop a group that does not, and say why in your reply.
   Write at least four a day to `docs/plans/<Monday>-week/ideas.json`, each
   with `so_what` first (what a business person finds out, in one plain
   sentence, the consequence before any mechanism; Krish, 2026-10-19: "In
   plain English what would be so interesting to a business person?"; the
   board refuses an idea without it), then its one-line story, why now with its date, its strongest fact and
   the source it came from, linked; check every fact against that source
   the same day (a company's own claim says so) and leave out any you
   cannot; no titles, which are his after he records. Stale or unchecked
   filler never pads a day. The board builds it as its first tab with
   `--ideas` and refuses a day with fewer than four checked ideas. His
   five presses on each idea are read back in step 8.
   **What his 19 Oct triage taught** (`config/learnings.json`, entries
   `ideas-pass-the-business-leader-test`, `simplify-and-unpack-the-concept`,
   `follow-the-money-traces-the-money`, `no-repeat-topic-within-weeks` and
   `reading-his-board-marks`). Apply these before an idea reaches the tab:
   - *The business-leader test.* Say, in one plain sentence, what a general
     business leader can do or decide differently right away because of the
     idea. If you cannot, he will mark it curious-not-convinced ("I just
     can't figure out how general business leaders would be helped
     immediately by knowing this"), so do not offer it.
   - *Simple first, then unpacked.* A concept idea opens with its plain
     version ("a bake-off that anyone can understand") and then unpacks each
     party's own motive ("Why is Disney going after it, and why is Google
     going after it? ... Unpack both").
   - *follow.the.money shows the money.* Name every party, where the money
     moves, and how it meets content IP or monetisation, so it can be drawn.
   - *No topic again within three weeks.* Check the last three weeks of
     published and in-flight pieces first; a sequel says what is new.
   - *Reading his marks.* Only the final state of a card counts (he taps
     through verdicts). Queued plus a verdict is "develop this later" with
     his words as the brief; curious and not queued is "pass for now" with
     his reason; drop is never offered again; his own angle on a picked
     idea is its brief.
3c. **The Off days options** (Krish, 2026-10-28: "I'm happy to plan the
   Tuesday, Thursday, Saturday, and Sunday content within the Sunday ideas
   session if you give me a few options to approve as you do the
   Mon/wed/fri"). Read `.agents/skills/plan-week/references/offdays.md`
   first: 4 to 6 options each for Tuesday, Thursday and Saturday (Sunday is
   a rest day, Ruling, Krish, 2026-11-02) on
   the Make Your Mind Up Instagram, TikTok and YouTube Shorts channels, each
   an idea and a suggested creative direction he approves, improves or
   rejects for a reason (Ruling, Krish, 2026-11-01, the locked off-day
   mock), made from the inspiration already gathered and from his past
   verdicts (`sources.json` `offday_verdicts`). Its
   gates: someone else's image or clip is never reposted; every news claim
   names its primary source, is checked against it the same day and passes
   the fact gate; each option's copy passes the copy lint and the kill list
   before it reaches the tab; they go into ideas.json `offdays` and reach
   the tab only through `week_board.py --ideas`, never by patching the page,
   and until the board has its Off days part the room says so in step 8.
   Saturday carries the weekly good news (`references/offdays.md`, "The Saturday good news"): its format each week,
   its stories due on the Thursday of its week and none yet (the card says they come Thursday); the Thursday run
   (`.github/workflows/saturday-goodnews.yml`) finds its five fresh stories. Never research them on Sunday.
   Growth makes what he approved. **His own
   ideas go here as pieces he records** (Ruling, Krish, 2026-10-29): every
   idea he dropped in (`must_cover`, `kind: his_idea`) is a recorded off-day
   option, one 90-second cut said to camera or as a voiceover, unless his
   words name Monday, Wednesday or Friday. Follow the reference's last part:
   the script, its story check, two fresh readers, then `kind: recorded`.
   His Approve schedules it and sends the script to Teleprompter itself.
4. Write each day's options, best first, one recommended:
   `python3 scripts/engine.py POST /api/week/options @options.json` with
   `{"week_start": "<Monday>", "series": "<slug>", "options": [{"id": "<uuid>", "rank": 1, "pitch": "two or three plain sentences", "why_now": "the dated event, with its date", "recommended": true, "covers": ["<must_cover id>"]}]}`.
   `covers` is the board idea's own `covers` list, unchanged: the engine keeps it on the piece (`meta.covers`, never
   cleared), so once he picks it the Inspiration card the piece became is known for good
   (`inspiration_card_pieces`; krishanraja/inspirationhouse `docs/TWO_WAY.md`, step 3).
   A piece already scheduled for its day (a pick carried over) needs no options: write it into ideas.json
   `locked`, `{"mon": {"piece_id", "so_what", "why"}}`, and give that day none. The board shows it as Already
   picked; `board_feed.py cover` and the build refuse options on a scheduled day (Krish, 2026-11-02: "Monday's piece
   is already done").
   A new idea that is not yet a row is created first with
   `POST /api/content-ideas {"raw_text": "...", "source_type": "week_research"}`.
   Never leave out `source_type` and never use `manual`: a manual row is what
   the week page shows as an idea Krish dropped in, so a session's own find
   would pose as his. If the reply says `"via": "ingest_gate"`, the engine's
   relevance gate dropped it as off-topic; it is not an option.
5. Put the question on the board: the slate cron does this each Sunday morning
   (`control-center api/content/slate.ts`), and the week page reads the options
   live, so nothing else is needed. Check that the board item
   `week-<Monday>` exists; if the cron has not run yet, it will.
6. Do not pick, schedule, draft or spend. Picking is Krish's press on the
   board's Ideas tab; a pick starts nothing by itself. Each piece's make
   starts once he signs its narrative lock (steps 10 and 11).
   **Sunday is his recording day** (Krish, 2026-10-24: "Yes, Sunday is my
   recording day"). The room locks the three stories with him; each make
   session takes its piece to checked scripts on the day's tab for his
   Approve scripts press by about 12:30, with the creative direction for
   every cut (`docs/CREATIVE_DIRECTION.md`) before he records. He records
   from 13:00, presses Titles at about 15:30 and signs each storyboard on
   its day's tab. He starts the Sunday-night run (`produce-video`) by
   telling Claude Code "I've recorded" (his Titles press records titles
   only), and it renders only from the
   signed direction; 21:30 is only the deadline for a surface he has not
   picked.
6b. **No weekly deep cut: a 15-minute feature only when Krish calls one**
   (house rule FEATURE, Krish, 2026-10-21: "all videos are generally 90 sec
   and 5 min. From time to time I might do a special 15 min feature"; asked
   whether that replaces the weekly deep cut: "Yes, replace it"). Every piece
   is a 90-second and a 5-minute video. Never propose a feature. When he
   calls one for a piece, in words, add it to `config/features.json` under
   `pieces.<piece id>` with his words and the date; the board then shows the
   feature as a third cut on that day. `config/deep-cuts.json` is retired
   and gets no new week.
7. **Put the week on the live board**, last, once the options are written
   (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old
   board is a read-only archive). The live board draws the week from
   `GET /api/board/<Monday>/view`, which reads `ideas.json` (each publishing
   day's options and the off-day options) from the week's branch
   `offday-revise/<Monday>` before main, his presses from the board's store
   and the pieces from their records; every option on it carries his presses
   (Pick and the four presses on an idea; Approve, Improve, Reject and Next
   week on an off-day option). So nothing is built: in the Sunday ideas run
   the workflow keeps the week's folder on that branch and bumps the week's
   change signal; in a session, commit the folder to that branch or to main
   (a pull request), then `python3 scripts/post-pack/board_web.py touch
   <Monday>`. Read the view back (`python3 scripts/engine.py GET
   /api/board/<Monday>/view`): each publishing day lists its options. Never
   build or publish a board page with `week_board.py` and `board_web.py
   publish-web` (the archive refuses it all). The steps that follow are kept
   as written where they still apply.
   - **Record its link where every later session finds it.** On the board,
     an item of its own for this week, `week-publish-board-<Monday>`, so
     last week's item and link stay as they are: `POST /api/workbench` with
     `{"action": "upsert_items", "client": "claude_code", "items": [{"id":
     "week-publish-board-2026-10-19", "lane": "on_you", "rank": 0, "area":
     "This week", "title": "This week's publish board, 19 to 23 October",
     "detail": "One page for Monday, Wednesday and Friday. Tick each step as
     you do it; every tick is saved at once, and the next session copies it
     onto the piece.", "only_you": "post", "closes_on": "week_published",
     "link": "<python3 scripts/post-pack/live_board.py <Monday>>",
     "link_label": "Open this week's publish board"}]}` (the id and the dates are the week's). Only he posts, and it
     says how it ends: Control Center's done-check sweep closes it once
     every picked day is at 100% on the record, so no session moves it to
     done. While last week's board is still open, Control Center holds the
     new one back from his list ("waits on last week's board") and shows it
     once last week's is closed. In
     `WORKBENCH.md`, under "This week's publish board": the new week's line
     goes first, and the ending week's line moves under "Last week's
     publish board" (replacing the one there), where it stays until that
     week's item is done.
   - **When the picks come in.** This run is on Saturday, before Krish
     picks, so most days start as not picked. He picks on the live board (a
     day's options, on its More tab); his pick is `picks/<day>`, read back in
     step 8, and the day moves on by itself because the view is built on
     every read. Nothing is rebuilt or republished, and each make session
     keeps its day current by writing the piece's record. When this skill
     runs again in the same week (Krish asks to re-plan), it writes the
     week's `ideas.json` again and the same link shows it.

The Sunday room now waits for him in this same session: he comes back
after his presses, by 10:00.

8. **The triage readback.** His five presses on the Ideas tab are his
   decisions, and the board writes each into the store that holds it: Pick
   for day (`picks/<day>`, with his optional `note`; the pick reaches its
   piece by itself), Wider piece (`queue/<idea_id>` with `use:
   wider_piece_context`), Future trend (`use: track_over_time`), Next week
   (`use: next_week` with `target_week`) and Reject (`use: not_for_us`, with
   his `reason`), and on each off-day option his verdict on the idea, the
   direction and any returned mock (`queue/off-<day>-<option>`, each side
   `{verdict, words}`: approve, improve, reject or next week; a piece he
   records keeps `approved`). Read them: `python3
   scripts/post-pack/board_web.py read <Monday> picks`, then the same with
   `queue` and `comments`. Only documents whose `updated_by` is Krish are
   his; nothing else is read back as his. Then say it back to him in one
   message, by day: what he picked, with his note in his exact words; each
   idea he kept for a wider piece, a future trend or next week, and each he
   rejected with his reason in his exact words; and the off-day options he
   approved, improved (his words) or rejected (his reason). Check that each pick reached its piece (`scheduled` in
   `python3 scripts/engine.py GET "/api/week/options?week_start=<Monday>"
   --full`), and name any that did not; for one that did not, write the
   picked idea onto its piece as the day's rank 1 option through
   `/api/week/options` (creating its row first if it has none), as before.
   Never relay a pick he makes in chat
   as a board tap: what he types in the room is relayed as his words with
   where he typed them ("Sunday room chat" and the time), only through a
   route that takes his words with their source (the idea queue's
   `decided_by: "Krish"` with his words as the reason, for example), and
   his press on the board is still what records a pick. Rebuild the board
   with the picks (step 7, "When the picks come in"). A day with no pick:
   its pick is the first question of step 9, with your best guess.
   **Check the day tabs' presses now, not at 12:30.** `python3
   scripts/post-pack/board_web.py read <Monday> approvals`, then the same
   with `titles`. If either read fails, say so at the top of the
   readback, in one line, and on the week's board item: with no Approve
   scripts press no script reaches Teleprompter (neither the server nor
   `teleprompter_send.py plan` sends without his press, and nothing stands
   in for it), so he reads each script from its day's tab while he records;
   with no Titles press the night's cuts take each surface's top-ranked
   option (`produce-video`, "The Sunday-night run").
9. **The interview** (Krish, 2026-10-28: "Claude interviews me on all three
   ideas to nail down the narrative arc, make it really powerful, useful,
   and fun to consume, and really find the deeper story beneath the surface
   story"), about 105 minutes, 10:00 to 11:45. Read
   `.agents/skills/plan-week/references/sunday-room.md` first: it holds the
   protocol, which never bends. One question at a time (learning
   `one-question-at-a-time`), each with your best guess and each settling one
   part of a lock; check before you ask; his answers kept verbatim in
   `docs/plans/<Monday>-week/interview.md`, never the rest of the chat; and
   the 11:45 clock. **Confidentiality is a hard gate:** an answer he says is
   off the record, or one that names a client, a deal figure or anything
   else private, stays out of `interview.md` and the lock, which merge to
   main; the file says only that something was withheld. Before the first
   question, read the floor for scripts and articles (`python3
   scripts/floor.py --format script`, `--format article`), each pick's
   research (its `sources.json` entries, the corpus he linked to it, `select
   name, drive_file_id, read_as, note_for_claude from inspiration_items where
   kind = 'corpus' and piece_id = '<piece_id>'`, and his note on the pick)
   and the published and in-flight pieces of the last three weeks, with
   their end messages and Monday actions: no question repeats what is
   already settled, and step 10 checks each lock against them.
10. **One narrative lock per piece, signed by him**:
   `docs/plans/<Monday>-week/narrative-lock-<day>.md`, in exactly the shape
   `.agents/skills/plan-week/references/sunday-room.md` gives: its piece and
   the day it publishes, then Surface story, Deeper story, Arc, The fun, The
   use (the one thing a business leader does differently on Monday), His
   close, Facts to check, Outline (one spine, at most six sections, house
   rule ONE_SPINE), Style recipe and Music bed. **Three checks before it
   goes to him**, on its Answer, The use, His close and any test it runs,
   the same checks the backlog's Narrative step makes (`make-piece`), and
   say in the room what each found:
   - *Against the research.* Each is checked against the piece's sources
     before he signs: a line the evidence does not hold changes here, never
     later.
   - *Against the series' recent pieces* (read in step 9). A takeaway or a
     Monday action a recent piece already landed is never the Answer or The
     use again; the lock says what is new (Krish, 2026-10-26: "we've already
     done that message takeaway with the Muse versus Grok piece"; learning
     `no-repeat-contract-takeaway`: never "check your contract" again unless
     he asks).
   - *A test is an experiment.* A test the piece runs is designed before it
     is run: what it tests, one thing changed only (a matched control), the
     same access and settings for every tool, prompts that need nothing
     outside their own words, and what will be read from each answer
     written down before any answer exists (Krish, 2026-10-23: "I don't
     think you are really thinking much about how to design a test that
     yields the experiment needed").
   Then `python3 scripts/post-pack/making.py <uuid> narrative <lock>` until
   only his signature is missing; it prints the lock's sha256. Put the whole
   lock to him in the room, the words themselves and never a pointer to
   them, and ask him to sign it. Once he does, the last line is his exact
   typed words, the date and that hash: `Signed by Krish: "<his words>",
   <YYYY-MM-DD>, lock sha256 <hash>`. Run `narrative` again until it says
   signed, commit the lock and `interview.md`, push the room's session
   branch and open its pull request with auto-merge on (`AGENTS.md`,
   "Commit and closeout"; nothing lives only in this container). The signed
   lock stands for the outline's approval and the style recipe's yes
   (`make-piece`): he signs once per piece. A signed lock is never edited:
   `making.py` refuses one whose words changed under his signature. A change
   to its end message, its close, its use, its spine or a section after he
   signed goes back to him, and the changed lock gets a new hash and his new
   signature (the drift rule). From 9 November `making.py scripts` refuses a
   piece without it.
11. **Start that piece's make, in its own fresh run**, as soon as its
   lock is signed and pushed; one run per piece, and never a piece made in
   the room. First check none is at work on it (`python3
   scripts/post-pack/making.py <uuid> show`: a session that started under
   six hours ago may be), then dispatch `.github/workflows/make-piece.yml`
   (Claude Code in GitHub Actions on his subscription) at the room's pushed
   branch, exactly as `.agents/skills/plan-week/references/sunday-room.md`
   ("Starting each make") gives; never a routine (Krish, 2026-10-29: "I
   want zero Claude routines"). The room dispatches it itself; only when no
   route here can does he get the Run workflow page, the branch and the piece id.
   The run records itself on the piece (`make-piece`, "Before anything");
   the room records nothing for it.
12. **Approve scripts, and Teleprompter** (about 12:30; Krish, 2026-10-28:
   "Once I approve, the two scripts will go to teleprompter" and "Server
   sends directly", which replace the standing yes of 12 October). Each
   make session puts its two checked scripts on its day's tab. His Approve
   scripts press binds to their exact sha256, and the server sends them
   itself (`sendApprovedScripts` in `apps/control-plane/api/_teleprompter.ts`:
   `create_folder`, `create_script`, and `update_script` with text and
   duration only, then a readback), answering `sent`, `no_key`, `refused` or
   `error` (or `held`, unsent, when the record does not show those words
   checked and read back). Read each press and its answer on the board: `python3
   scripts/post-pack/board_web.py read <Monday> approvals` (the collection
   `config/teleprompter.json` `approval.collection` names; only documents
   whose `updated_by` is Krish are his press).
   - `sent`: nothing to do; `making.py <uuid> show` says, per cut,
     "Teleprompter, 5-minute cut: holds the current words".
   - `no_key` (the Teleprompter key is not set yet): the room sends exactly
     the words his press approved through the Teleprompter connector, by
     `teleprompter_send.py plan` and the calls it prints, as
     `.agents/skills/plan-week/references/sunday-room.md` ("When the server
     answered no_key") gives, then reads each one back. Words changed since
     his press are not sent: the cut goes back on its tab for a new press.
     Never `move_script` or `update_folder`, never a second folder or
     script, never his `fontSize`, `speed`, `alignment` or `timedSpeed`.
   - `held`: once the make session records the check and read-back of
     those words (`make-piece`, Scripts step 5), they go as for `no_key`.
   - `refused`: the approval did not hold for these words; send nothing,
     and say why on the day's tab for a new press.
   - `error`: one line on the day's tab with what Teleprompter said; his
     press again retries the server's send.

## Without the connectors

The Sunday ideas run in GitHub Actions has no Drive and no Firecrawl
connector. Then research with the built-in web search and web fetch instead,
and skip the Cold Ideas & Inspo folder rather than guessing what is in it.
Say which sources were unavailable on the week's board item, in one plain line
at the end of its detail, for example "Researched with web search only: Drive
and Firecrawl were not connected, so the Cold Ideas & Inspo folder was not
read." Write it with `POST /api/workbench {"action": "upsert_items",
"client": "claude_code", "items": [{"id": "week-<Monday>", "detail": "..."}]}`,
keeping the detail already there (read it first with `GET /api/workbench`); if
the item does not exist yet, give it `"lane": "on_you"`, a `"title"`,
`"only_you": "judgment"`, `"link": "https://controlcenter.krishraja.com/#/week"`,
`"link_label": "Open the week"` and `"closes_on": "week_planned"` too, or
the engine refuses it, naming the field it lacks (`WORKBENCH.md`, the
board).
Put the same line in `WORKBENCH.md`, because the slate cron rewrites the week
item's text each morning.

The server sends approved scripts to Teleprompter itself; only a `no_key`
answer needs the Teleprompter connector (step 12). Without it, name each
waiting cut in one line on its day's tab. Descript was retired on 12
October (Krish: "Descript is permanently gone, teleprompter.com is
permanently in, connected via MCP here"): nothing is sent there. The active web board needs the existing engine
operator credential, not an Artifact connector. If authenticated board reads
fail, record that specific blocker; never treat inaccessible feedback as empty.

## Before you stop

Copy the week's ticks once more (a board made this run has none yet).
Commit what the room made (`ideas.json`, `interview.md`, each lock) and push
the room's branch. Update `WORKBENCH.md` and end every reply with the week's
publish board in Control Centre, `python3 scripts/post-pack/live_board.py <Monday>`.
