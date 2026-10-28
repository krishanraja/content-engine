---
name: plan-week
description: Plan the publishing week and run the Sunday room. Research three or four options for each publishing day (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap) and the off-day options, stress-test them, write them onto the pieces through /api/week/options and onto the Ideas tab of the week's publish board by 06:00 Sunday, read back Krish's five presses from the board, interview him one question at a time on all three picks to find the deeper story, write one narrative lock per piece for him to sign, start each signed piece's make in its own fresh session, and send approved scripts to Teleprompter when the server could not. Use when the Sunday ideas routine fires, or when Krish asks to plan or re-plan the week.
---

# Plan the week

## Publish-board routing

Follow `docs/PUBLISH_BOARDS.md` before touching a weekly publish board. It owns
current web addresses, all six collection reads, build/download/publication,
making-record attribution and rollback. Check `config/boards.json.web_cutover`:
while pending, source migration is unfinished; once active, use only the web
board for new interactions. Claude artifacts are retired for good (Krish,
2026-10-19: "we are now retiring the Claude artefact permanently and we are
working in content.krishraja.com for all published board updates"): no step
makes or publishes one. The week's board, a day's tab in draft, the workroom and
the publish page all go to content.krishraja.com (`week_board.py --target web`,
then `board_web.py publish-web`), and `scripts/hooks/artifact_gate.py` refuses
every Artifact publish and every ArtifactData write. Any Artifact, ArtifactData,
ArtifactComments or dual-account step below is history: read an old artifact
only to recover what it holds.

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

The clock, in his local time (Control Center's operator time zone). Each row
names the checkpoint Control Center watches for it:

| When | What | Checkpoint |
|---|---|---|
| Sat 23:00 to Sun 06:00 | The Sunday ideas routine fires this skill into the Sunday room session; steps 0 to 7 put the Ideas tab live | `week_ideas_ready` |
| Sun by 10:00 | Krish's five presses on every idea, about 15 minutes | `week_picked` |
| Sun 10:00 to 11:45 | The triage readback (step 8), then the interview (step 9), about 105 minutes | `narratives_locked` |
| As each lock is signed | That piece's make starts in its own fresh session (step 11) | `scripts_ready` |
| About 12:30 | His Approve scripts press per day: the server sends both scripts to Teleprompter and reads them back (step 12) | `scripts_sent` |

Once the Ideas tab is live, the Sunday room does three things only: the
triage readback, the interview and one signed narrative lock per piece. Then
it starts each signed piece's make, and sends approved scripts to
Teleprompter only when the server could not. It never drafts a script, an
article or a visual: each piece's make session does, from its signed lock
(`.agents/skills/make-piece/SKILL.md`).

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
   engine first: every `QUEUE <pick> <verdict> <reason>` comment and
   `queue/<pick>` doc on last week's board (web `queue` and `comments`
   collections after active cutover; ArtifactData only for legacy sources)
   goes to `POST /api/idea-queue` (`action: queue` with `verdict`, `reason`,
   `angle`, `decided_by: "Krish"`, the idea's `so_what`, `story` as `idea`,
   `source_url`, `series`, `from_week`, `from_pick`). A mark with no verdict
   is only queued. Never write a verdict he did not give.
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
   evidence, never a rule until he approves one). `must_cover` lists every routed card and every
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
3. For each publishing day, find three or four real options. Prefer existing
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
   Mon/wed/fri"). On the Ideas tab, 2 to 3 options each for Tuesday,
   Thursday, Saturday and Sunday of the week, for the Make Your Mind Up
   Instagram, TikTok and YouTube Shorts channels (Shorts takes video only,
   so a carousel goes there as a short slideshow). Each is one of four
   formats: a meme made fresh from a cue, in the makeyourmindup brand kit (a
   borrowed format is credited; someone else's image or clip is never
   reposted); an uplifting AI news carousel, every claim naming its primary
   source and dated within 7 days of its day, each checked against that
   source the same day and through the fact gate before it is made; one
   level-up move, a single practical way to get more from AI; or a
   snackable cut from a past week's approved master, named by its piece and
   word range. Each shows its format, its source and its draft copy, and
   its copy passes `python3 scripts/post-pack/copy_lint.py --applies-to
   channel_copy` (and `--applies-to carousel_text` for a carousel) and `node
   vendor/makeyourmindup/kill-list/kill-list.mjs` before it reaches the
   tab. Growth (growth-makeyourmindup) owns this lane and will feed it
   automatically; until it does, the room drafts the options. They
   reach the tab only through `week_board.py --ideas`, in the off-days part
   `docs/PUBLISH_BOARDS.md` names, never by patching the page. His one press
   approves or skips each (`queue/<idea_id>` with `use: offday`, its `day`
   and `approved`); Growth makes and schedules what he approved, and this
   repository cuts any snackable clip.
4. Write each day's options, best first, one recommended:
   `python3 scripts/engine.py POST /api/week/options @options.json` with
   `{"week_start": "<Monday>", "series": "<slug>", "options": [{"id": "<uuid>", "rank": 1, "pitch": "two or three plain sentences", "why_now": "the dated event, with its date", "recommended": true, "covers": ["<must_cover id>"]}]}`.
   `covers` is the board idea's own `covers` list, unchanged: the engine keeps it on the piece (`meta.covers`, never
   cleared), so once he picks it the Inspiration card the piece became is known for good
   (`inspiration_card_pieces`; krishanraja/inspirationhouse `docs/TWO_WAY.md`, step 3).
   A piece already scheduled for its day (a pick carried over) needs no options.
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
   its day's tab; the Sunday-night run (`.agents/skills/produce-video/SKILL.md`,
   21:30) renders only from the signed direction.
6b. **No weekly deep cut: a 15-minute feature only when Krish calls one**
   (house rule FEATURE, Krish, 2026-10-21: "all videos are generally 90 sec
   and 5 min. From time to time I might do a special 15 min feature"; asked
   whether that replaces the weekly deep cut: "Yes, replace it"). Every piece
   is a 90-second and a 5-minute video. Never propose a feature. When he
   calls one for a piece, in words, add it to `config/features.json` under
   `pieces.<piece id>` with his words and the date; the board then shows the
   feature as a third cut on that day. `config/deep-cuts.json` is retired
   and gets no new week.
7. **Make the week's publish board**, last, once the options are written.
   Krish, 2026-10-12: "just give me one ... Publish Manager for the ...
   whole week with 3 tabs on it for Mon / Weds / Fri, which we need to get
   to 100%. Give me a tick box next to each one so I can tick as I go and
   you can durably record that completion where it needs to be recorded.
   That Publish Manager is what you create every Sunday and let me iterate
   inside until we're done, and then I check off the list what I have done
   as I do it."
   - **Feed the fixed layout, never shape it** (from the week of 26
     October: Ideas, Queue, then each day's Brief, Drafts, Record and
     Publish; `docs/PUBLISH_BOARDS.md`, "The fixed layout"). Give
     `--ideas`, `--queue` and `--combine` every Sunday; each pick's record-ready brief
     goes on its day with `--brief DAY=brief.json` once it is drafted, due
     the night before its day. Never patch the built page.
   - **Build it** with all three tabs, from the week's picks as they stand:
     `python3 scripts/post-pack/week_board.py --week <Monday> --live --ideas
     docs/plans/<Monday>-week/ideas.json --queue .cache/week-board/<Monday>/queue.json
     --combine docs/plans/<Monday>-week/combine.json --out
     .cache/week-board/<Monday>/week-board.html`. Its title names the week,
     "This Week's Publish Board (wC 19 Oct)". A day whose piece already
     has a publish page (a pick carried over) is a made tab: `Artifact`
     `read` its `publish_manager` link (in its making record) and add
     `--day DAY=<the saved file> --piece DAY=<uuid>`. A picked day not made
     yet gets its "not made yet" tab with a working checklist; a day not
     picked yet says so. It writes `week-board.json` beside the page: the
     week, each day's state and piece, every tick id, and the publish call.
     Exit 2 is a refusal it names: fix it and build again.
   - **Active web route:** build with `--target web`, publish the verified
     manifest through `board_web.py publish-web`, register the dated URL in
     `config/boards.json.web`, and read it back as `docs/PUBLISH_BOARDS.md`
     requires. Continue at "Record its link" below. No new Claude board or
     cross-account copy is created after active cutover.
   - **Legacy artifact mode only:** publish as a new private artifact, a new one every Sunday, never
     last week's link: `Artifact({action: "publish", file_path: "<absolute
     path>/week-board.html", title: <the manifest's publish.title>, icon:
     "calendar", capabilities: <the manifest's publish.capabilities>, description:
     "<the manifest's publish.description>", pin: true})`, from a session
     signed in as Krish's own account, so it lands pinned in his sidebar
     (Krish, 2026-10-14: "lets pin this weeks artifact (I cant seem to do
     that myself)"; a board made under another organisation cannot be
     pinned, and its ticks cannot be read from Claude Code). The publish
     hook (`scripts/hooks/artifact_gate.py`) refuses a board the engine did
     not build. Add its link under the week in `config/boards.json` (Krish
     works from two Claude accounts; every board publish goes to every link
     listed there), and ask Krish to add his other account as an editor so
     both accounts can open it. Each link keeps its own store (ticks, saved
     edits), readable only from the account that owns it; comments are
     readable from both, which is why a Save is also posted as a comment
     (`make-piece`, "Krish's edits on the board"). Then one `ArtifactData`
     `list` of `ticks` and one of `links` on its link: both are empty on a
     new board, and the page's own store is then known to answer.
   - **Record its link where every later session finds it.** On the board,
     an item of its own for this week, `week-publish-board-<Monday>`, so
     last week's item and link stay as they are: `POST /api/workbench` with
     `{"action": "upsert_items", "client": "claude_code", "items": [{"id":
     "week-publish-board-2026-10-19", "lane": "on_you", "rank": 0, "area":
     "This week", "title": "This week's publish board, 19 to 23 October",
     "detail": "One page for Monday, Wednesday and Friday. Tick each step as
     you do it; every tick is saved at once, and the next session copies it
     onto the piece.", "only_you": "post", "closes_on": "week_published",
     "link": "<its link>", "link_label": "Open this week's publish
     board"}]}` (the id and the dates are the week's). Only he posts, and it
     says how it ends: Control Center's done-check sweep closes it once
     every picked day is at 100% on the record, so no session moves it to
     done. While last week's board is still open, Control Center holds the
     new one back from his list ("waits on last week's board") and shows it
     once last week's is closed. In
     `WORKBENCH.md`, under "This week's publish board": the new week's line
     goes first, and the ending week's line moves under "Last week's
     publish board" (replacing the one there), where it stays until that
     week's item is done.
   - **When the picks come in.** This run is early on Sunday, before Krish
     picks, so most tabs start as not picked. The room rebuilds the board
     with the picks after the triage readback (step 8) and republishes it to
     this same link, with `--previous` so no day it holds is lost, and no
     tick is lost; from then on each make session keeps its own day's tab
     current (`make-piece`, "The week's publish board"), and so does any
     session that finds a day picked or made that the board does not show
     yet. When this skill runs again in the same week (Krish asks to
     re-plan), it republishes to this week's link rather than making
     another.

The Sunday room now waits for him in this same session: he comes back
after his presses, by 10:00.

8. **The triage readback.** His five presses on the Ideas tab are his
   decisions, and the board writes each into the store that holds it: Pick
   for day (`picks/<day>`, with his optional `note`; the pick reaches its
   piece by itself), Wider piece (`queue/<idea_id>` with `use:
   wider_piece_context`), Future trend (`use: track_over_time`), Next week
   (`use: next_week` with `target_week`) and Reject (`use: not_for_us`, with
   his `reason`), and on the off-day options, approve or skip (`use:
   offday` with `day` and `approved`). Read them: `python3
   scripts/post-pack/board_web.py read <Monday> picks`, then the same with
   `queue` and `comments`. Only documents whose `updated_by` is Krish are
   his; nothing else is read back as his. Then say it back to him in one
   message, by day: what he picked, with his note in his exact words; each
   idea he kept for a wider piece, a future trend or next week, and each he
   rejected with his reason in his exact words; and the off-day posts he
   approved. Check that each pick reached its piece (`scheduled` in
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
9. **The interview** (Krish, 2026-10-28: "Claude interviews me on all three
   ideas to nail down the narrative arc, make it really powerful, useful,
   and fun to consume, and really find the deeper story beneath the surface
   story"), about 105 minutes, 10:00 to 11:45. Before the first question,
   read the floor for scripts and articles (`python3 scripts/floor.py
   --format script`, `--format article`), each pick's research (its
   `sources.json` entries, the corpus he linked to it, `select name,
   drive_file_id, read_as, note_for_claude from inspiration_items where kind
   = 'corpus' and piece_id = '<piece_id>'`, and his note on the pick) and the
   last three weeks' pieces, so no question repeats what is already settled.
   The protocol, which never bends:
   - **One question at a time** (learning `one-question-at-a-time`): the
     one that changes the work most first, across all three picks rather
     than Monday's first by habit, each with your best guess, and the next
     only after he answers.
   - **Each question settles one part of a lock** (step 10): the deeper
     story beneath the surface story; the arc; what makes it fun to
     consume; what makes it useful, the one thing a business leader does
     differently on Monday; his close, his own call in his own words (ask
     for it, never write it for him; learning `his-call-in-his-words`); the
     facts that must be checked; the spine of the outline and its sections;
     the style recipe (a script format, a production format and the
     experiment, from `config/style-references.json` `formats`); and the
     music bed (an approved track in the ledger, `config/music-library.json`;
     never browse Drive for audio).
   - **Check before you ask.** A fact you can check is checked, not asked;
     what `docs/CADENCE.md`, the house rules or his recorded words already
     answer is never asked. A line he gives that the evidence does not hold
     is said back to him with what the source says, as the next question.
   - **His answers are kept verbatim.** Each question in one line, its best
     guess and his exact answer, with the time, go into
     `docs/plans/<Monday>-week/interview.md` as he gives them: his words
     exactly, and never the rest of the chat (exact excerpts, never whole
     transcripts). A lock quotes his words where they decided a part; a
     paraphrase is never his.
   - **The clock.** When a piece's parts are all answered, put its lock to
     him (step 10) without waiting for the others. At 11:45, say which
     parts are still open, with your best guess for each, and ask whether
     to sign as it stands: recording starts at 13:00.
10. **One narrative lock per piece, signed by him**:
   `docs/plans/<Monday>-week/narrative-lock-<day>.md` (`mon`, `wed`,
   `fri`), written flush left in exactly this shape:

   ```
   # Narrative lock: <Ddd D Mon> <series> - <subject>

   piece_id: <uuid>
   Publishes: <YYYY-MM-DD>

   ## Surface story
   ## Deeper story
   ## Arc
   ## The fun
   ## His close
   ## Facts to check
   ## Outline
   Spine: <the one question the piece answers>?
   Answer: <its one-line answer>
   1. <SECTION HEADING> | proves: <the part of the answer it proves>
   ## Style recipe
   ## Music bed

   Signed by Krish: "<his words>", <YYYY-MM-DD>
   ```

   Every part has its words under it. Only the outline's sections are
   numbered, at most six (house rule ONE_SPINE); everything else is plain
   lines or `-` bullets, because the spine check reads numbered lines. Each
   fact to check is `- <the claim> | <its source, linked> | <checked on
   YYYY-MM-DD, or to check>`. `Publishes` is the day it goes live, and the
   piece's dated drafts carry that date. Put the whole lock to him in the
   room, the words themselves and never a pointer to them, and ask him to
   sign it. Once he does, add his exact typed words as the last line;
   nothing below his signature counts. Then `python3
   scripts/post-pack/making.py <uuid> narrative` until it says signed,
   commit the lock and `interview.md`, push the room's session branch and
   open its pull request with auto-merge on (`AGENTS.md`, "Commit and
   closeout"; nothing lives only in this container). The signed lock stands
   for the outline's approval and the style recipe's yes (`make-piece`): he
   signs once per piece. A change to its end message, its close, its spine
   or a section after he signed goes back to him and is signed again (the
   drift rule). From 9 November `making.py scripts` refuses a piece without
   it.
11. **Start that piece's make, in its own fresh session**, as soon as its
   lock is signed and pushed; one session per piece, and never a piece made
   in the room.
   - First `python3 scripts/post-pack/making.py <uuid> show`: a session
     that started on the piece under six hours ago is still live (Control
     Center's rule, `LIVE_SESSION_MS` in control-center `api/_make.ts`).
     Give him its link and start no second one.
   - Control Center's "Make it in Claude Code" (`POST /api/content/make`)
     answers only his signed-in browser, and the routine it fires
     (`CLAUDE_MAKE_ROUTINE_ID`, with the one-line payload `piece_id:
     <uuid>`, `makePayload` in `api/_make.ts`) starts on `main`, where the
     lock is not yet. So start the session with `create_session` on
     `https://github.com/krishanraja/content-engine` at the room's pushed
     branch (`source_revision`), its prompt two lines: `piece_id: <uuid>`,
     then Control Center's own words (`makePrompt`): "Make this piece:
     follow .claude/skills/make-piece/SKILL.md in krishanraja/content-engine.
     Read the piece and where it is from the engine, record this session on
     it, then do the first step that is not done."
   - Without `create_session`, once the room's pull request has merged:
     fire the make routine with `fire_trigger`, its id found with
     `list_triggers` (the routine whose prompt follows make-piece), and the
     text exactly `piece_id: <uuid>`. Neither works: say so to him in one
     line, with those two lines to paste into a new claude.ai/code session.
   - The new session records itself on the piece (`make-piece`, "Before
     anything"); the room records nothing for it.
12. **Approve scripts, and Teleprompter** (about 12:30; Krish, 2026-10-28:
   "Once I approve, the two scripts will go to teleprompter" and "Server
   sends directly", which replace the standing yes of 12 October). Each
   make session puts its two checked scripts on its day's tab. His Approve
   scripts press binds to their exact sha256, and the server sends them
   itself (`sendApprovedScripts` in `apps/control-plane/api/_teleprompter.ts`:
   `create_folder`, `create_script`, and `update_script` with text and
   duration only, then a readback), answering `sent`, `no_key`, `refused` or
   `error`. Read each press and its answer on the board (`board_web.py read
   <Monday>` with the approvals collection `docs/PUBLISH_BOARDS.md` names).
   - `sent`: nothing to do; `making.py <uuid> show` says, per cut,
     "Teleprompter, 5-minute cut: holds the current words".
   - `no_key` (the Teleprompter key is not set yet): the room sends exactly
     those approved scripts through the Teleprompter connector itself. Per
     cut, the script's current sha256 (`making.py`'s script hash, which
     `teleprompter_send.py plan` prints) must equal the hash his press
     approved; words changed since his press are not sent, and the cut goes
     back on its tab for a new press. Then `python3
     scripts/post-pack/teleprompter_send.py plan <uuid> long.md short.md`,
     and exactly the calls it prints, as `make-piece` says ("The Scripts
     step", step 6): never `move_script` or `update_folder`, never a second
     folder or script, never his `fontSize`, `speed`, `alignment` or
     `timedSpeed`. Run each `record` line it prints, then `get_script` each
     cut and check its text is the approved words (the readback).
   - `refused`: the approval did not hold for these words; send nothing,
     and say why on the day's tab for a new press.
   - `error`: one line on the day's tab with what Teleprompter said; his
     press again retries the server's send.

## Without the connectors

The scheduled Sunday routine may run with no Drive and no Firecrawl
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
publish board, https://content.krishraja.com/board/<Monday>.
