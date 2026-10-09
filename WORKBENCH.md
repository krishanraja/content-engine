# Workbench: where we are and what's next

This is the one file every working session reads first and updates last,
whatever tool it runs in: Claude Code (web, desktop or phone), Codex (cloud or
desktop), or anything else that can open this repository. It is how work moves
from one tool to another without anything getting lost. The rules for agents
are in `AGENTS.md`; this file is the live state of the work.

Last updated: 2026-10-08, by a Claude Code session (cloud).

## How Krish wants to be worked with

- Plain words. Nothing he reads may contain codes, labels, hashes, version
  numbers or project shorthand. Say what happened, what it means for him, and
  what you need from him. If a sentence would confuse someone outside the
  project, rewrite it.
- After everything you do, update the board (below), and end every reply to
  him with its link: https://controlcenter.krishraja.com/#/board. Update this
  file when how the work is done changes.
- Make the call and say what you assumed. Ask only when the answer changes the
  shape of the work, and offer your best guess with the question.
- Every visual, interactive or animation must make one critical point of the
  piece land faster than the words can, from its checked evidence. No
  gimmicks (`AGENTS.md`, house rule `VISUAL_EXPLAINS`).
- His decisions are his alone. Record one only when he made it in words, with
  `decided_by: 'Krish'` (`AGENTS.md`).
- Pick subjects people find fascinating and aspirational, like AI content
  creation. Leave out the dull enterprise ones. His words, 2026-10-06, turning
  down the Salesforce piece: "We need to permanently shift focus away from
  things as boring as this towards things that are more fasincating and
  aspirational, like AI content creation for example". The engine's judges and
  channel briefs do not know this yet (see Latest handoff).
- **Always the big picture, never the small headline.** His words,
  2026-10-09, on the Friday workroom: "We need to always focus on the bigger
  picture, never the one small picture temporary news headline - make sure you
  ALWAYS remember this". A week's headline is evidence inside the bigger
  story, never the story (house rule `BIG_PICTURE`). The session that broke
  it built a whole piece around one report about AI plan value when he had
  asked for "why there are so many models now, and what that actually means".
- Every piece, its video and its posts answer three questions: what it means
  for the consumer, what it means for someone starting or building a
  business, and how the old way is changing, creatively and in who gets paid
  (house rule `THREE_LENSES`). Every visual uses the real logos of the
  companies it names, and the cover and share picture carry Krish's face
  (`LOGOS_AND_FACE`; `scripts/pages` cover facts, `"portrait": true`).

## The board: what is waiting on Krish, in progress and done

The live list lives in the shared database, not in this file. Krish sees it in
Control Center at https://controlcenter.krishraja.com/#/board (phone or desk)
and replies to items there. Every session, in Claude Code or Codex, reads and
writes it through the engine:

- Read it: `python3 scripts/engine.py GET /api/workbench --full` (`python` on
  Windows). His replies
  are in `replies`; `unseen_replies` counts the ones no session has acted on.
- Add or change items (up to 50 at once; an existing item changes only the
  fields you send):
  `python3 scripts/engine.py POST /api/workbench @items.json` with
  `{"action": "upsert_items", "client": "codex", "items": [{"id": "p3-approve", "lane": "on_you", "rank": 2, "area": "Article 3", "title": "...", "detail": "...", "prompt": "Yes, or what to change"}]}`.
  Lanes: `on_you`, `in_progress`, `done`, `archived` (hidden). Ids are
  lowercase words joined by hyphens. Links must start with `https://`.
- Change the headline or the status lights: `{"action": "set_state",
  "headline": "...", "signals": [{"label": "Home computer", "state": "ok",
  "text": "On and ready"}]}` (state is `ok`, `warn`, `bad` or empty).
- After you act on his replies: `{"action": "mark_seen", "ids": ["<reply id>"],
  "client": "codex"}`. The board then shows him that you read it.
- Only Krish writes a reply, from Control Center. The engine key cannot: a
  session must never put words in his mouth.

Set `"client"` to `"codex"` or `"claude_code"` so the board says who changed it.
Write every item in plain words: what happened, what it means for him, and what
you need from him.

## Pick up from any tool

Everything that matters lives in two places every tool can reach: this
repository on GitHub (code, rules, this file) and the shared database (the
articles, Krish's decisions, each channel's rules). Nothing important lives
only in a chat.

| Tool | What it can do | What it needs |
|---|---|---|
| Claude Code on the web, desktop or phone | Everything except running the video studio | This repository, and the engine key as a **network secret** in the cloud environment (done 2026-10-09): Bearer, allowed website `content-engine-flame-nu.vercel.app`, path `/api/`. The session's proxy adds the key to every engine request; the container never holds it, and `scripts/engine.py` works with no key set |
| Codex in the cloud | The same | This repository connected, and the same secret in the Codex environment |
| Claude Code or Codex on either Windows home computer | All of the above, plus the video studio (`docs/ENGINE_SESSION.md`) | Run `scripts/engine-key.ps1` once on that machine (the engine key then lives in Windows Credential Manager and the helper reads it from there). Work in Krish's own copy at `C:\Users\krish\dev\content-engine`, where he keeps his repositories, never in the runner's folder (`Documents\MindmakeVideoStudio\runner-source`), which must stay untouched. In Codex, run the engine helper and `git pull` or `git push` outside the sandbox (ask for escalated permissions; Krish approves): Codex's sandbox runs as a separate Windows user that cannot see the key or reach the internet |
| A plain chat (Claude.ai, ChatGPT) with no repository | Talk and plan only | Paste this file in |

To start a session in any of them: read `AGENTS.md`, then this file, then do
the top item that is not waiting on Krish. Before you stop, update this file.

Krish starts a session by pasting this:

> Continue the Mindmake content engine. Read AGENTS.md and WORKBENCH.md, then
> read the board and my replies on it. Tell me in plain words what is waiting
> on me and what you will do next, then do the top thing that is not waiting
> on me. Update the board and WORKBENCH.md before you stop, and end every reply
> with the board link.

He may add a line saying what he wants today; that comes first.

Talk to the engine with `python3 scripts/engine.py METHOD PATH [body]`, for
example `python3 scripts/engine.py GET "/api/content-ideas?id=<id>"`. On
Windows the command is `python`, not `python3`. It reads the key from
`ENGINE_OPERATOR_TOKEN`, or on a home computer from Windows Credential
Manager, and never prints it. In Claude Code's cloud it needs neither: the
network secret supplies the key on the way out. When it has no key it says why and what to do;
inside Codex's sandbox on Windows, that means running it again outside the
sandbox with Krish's approval. Never ask Krish to paste the key into a chat.

**Every post's assets go into Krish's asset library the same day.** Krish,
2026-10-06: "I want every single asset in there, permanent and for individual
posts, categorized properly, clear what to use them for, and every new post
gets its own new folder with all assets including the article HTML I can copy
paste, video scripts, etc etc". In any tool: pack each post's launch set
(the page and Substack copy, the cover and pictures, the video script, the
YouTube and Substack words, the finished videos, the LinkedIn post) with
`python3 scripts/post-pack/build.py post.json` and send it with
`python3 scripts/post-pack/send.py <pack folder>` the same day it is made. A
brand kit change goes with `send.py --brand-kit <kit folder or zip>`. Krish's
always-on Windows machine writes them into the makeyourmindup folder on Drive
within about ten minutes. The architecture doc's rule 0a.5 says agents never
write into his Drive; this is his explicit instruction for that one folder,
carried out by his own machine, and it covers that folder only. Details and
the one-time install on his machine: `scripts/post-pack/README.md`.

**A recording Krish drops in the Video Engine Inbox reaches any session.**
Krish, 2026-10-06, after a session told him it could not reach his file:
"figure out how to never make that error again". Fetch it with
`python3 scripts/post-pack/recording.py get "<file name>"` (`--wait 15` for one
he has just dropped; `list` shows what has arrived). Both runner machines send
every finished recording to the engine within about ten minutes, whichever is
online. The Drive connector caps downloads at 10 MB, so never take a recording
from Drive and never tell Krish one cannot be reached; if it is missing, say
which step failed. Until he has merged `claude/recordings-lane` and pasted the
install block on each runner machine, the lane is not running
(`scripts/post-pack/README.md`, "Recordings: from the Inbox to a cloud
session").

## Latest handoff

- 2026-10-09, night: **Scripts are only scripts, and every post now has one
  publish page.** Two new house rules: SCRIPT_ONLY (Krish: "make sure my video
  scripts are literally just scripts without all the excess internal monologue
  commentary (forever)") and HOOK_AND_CTA (open on the most provocative true
  thing; close by sending people to the free article at makeyourmindup.ai).
  `story_check.py` now refuses a script with stage directions, labels,
  timings, headings or joke options, or with an outro that never mentions the
  article; the video writer (`_video.ts`) keeps "say" to spoken words and puts
  joke options in "notes". The amplification plan is `docs/AMPLIFICATION.md`:
  one Substack **Video** post (long cut on top, article under it; Substack
  uploads it to YouTube privately), then YouTube, LinkedIn, Shorts, Reels,
  WhatsApp and Notes with one vertical cut of at most 90 seconds.
  `scripts/post-pack/publish_kit.py` writes it per post as
  `0 Publish/publish.html` (a new library section, in the cases file, the
  engine and library.py). Friday's files: `docs/plans/2026-10-09-draft-script.md`
  (about 4 minutes), `-draft-script-90s.md` (76 seconds), `-publish.json`
  (every channel's words, linted by `_packaging.ts` and the publish checks),
  `-manifold-market.md`. **The engine key now reaches cloud sessions** as a
  network secret (health answered 200 through it on 2026-10-09).
  **Next session, first job:** Friday's paid fact check, approved by Krish
  ("spend what you need within reason"). Find Friday's mind.the.gap piece
  (`904658db...`, `GET /api/content-ideas`), save the new draft
  (`docs/plans/2026-10-09-draft-body.md`) as its body through the engine's
  own route, run the free `GET .../fact-check` preview for the count, then
  `POST` with `max_fresh_sentences` set to that count. Fix what fails, record
  results here, and update the workroom
  (https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn) body checks.
  **Waiting on Krish:** create the Manifold market (no Manifold key here; the
  text is ready), record both cuts, rotate every key pasted in chat (including
  the Vercel master token), and confirm on first use that the Copy post paste
  keeps pictures inside a Substack Video post.

- 2026-10-09, evening: **Friday's piece is rebuilt on Krish's angle, the big
  story: why there are so many AI models, and what it means.** His seed
  (Perplexity research) was treated as raw material, never as an override:
  20 claims checked against primary sources, ten corrections
  (`docs/plans/2026-10-09-seed-fact-check.md`, including OpenAI's revenue cut
  from ~$70bn to almost $50bn on 8 Oct). Our own thesis: the name is doing four
  jobs (version number, price tag, advert, queue ticket). The $20 SemiAnalysis
  story is one paragraph. Drafts: `docs/plans/2026-10-09-draft-body.md`
  (passes every blocking publish check, reads at about age 10) and
  `2026-10-09-draft-script.md` (passes story_check.py). The workroom
  (https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn) carries all of it, with a
  new Mocks room (decoder, conveyor belt, four jobs, prices vs bills, the
  menu-misleads bars, the three futures) and new decision cards: angle, title,
  call and a new "revenue race" card. **All picks made:** angle "One name,
  four jobs"; title "Why are there suddenly so many AIs?"; revenue paragraph
  kept; Manifold market; level 1+, warm, both lengths. His call, in his words:
  "85% - big tech will make things more and more opaque and remove the illusion
  of choice to satisfy the masses and control margin/outcome". The checkable
  sentence is unchanged at 85%; his reason is now the stated bet in the article
  and script. **Waiting on Krish:** the paid fact-check cap (the call paragraph
  changed); approval to create the Manifold market; rotating the keys pasted in chat.

- 2026-10-09, afternoon: **Friday's piece now lives in a live workroom:**
  https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn (private to Krish). Four
  rooms: Decide (seven decisions as tappable cards with Claude's pick, level
  and cost; picks save to the page's database), Article (the draft with the
  engine's checks and a change log; a Note on any paragraph opens a comment
  that can be sent to Claude), Script (one card per beat, timed at his pace
  against a 90-second target, with joke options), Mocks (cover with his face,
  the two receipts, the nerf timeline, the ladder, the subsidy bars, the
  carousel and the storyboard). Content is in the page's database
  (`piece/meta`, `piece/body`, `piece/script`, `piece/mocks`, `decisions/*`),
  so a session updates it with ArtifactData and the page refreshes itself;
  his picks are read back from `decisions/*`. This session watches it for
  comments sent to Claude. **Waiting on Krish:** his picks in the Decide room.
- 2026-10-09, later: **Friday's piece is drafted along the recommended lane,
  with the full creative menu and costs for Krish to choose from.**
  `docs/plans/2026-10-09-who-picks-your-ai-creative.md` is the menu (six
  angles, seven titles, seven cold opens, seven visuals, six video shapes,
  the personality options, the Call and its market, distribution stunts, and
  four cost levels from $0 to a day of filming). `2026-10-09-draft-body.md`
  and `2026-10-09-draft-script.md` are the drafts: the body passes every
  mechanical publish check except the fact gate, which needs the engine key
  and his cap; the script passes the story check at about 100 seconds. The
  SemiAnalysis article's own open text is now on hand through Firecrawl, so
  the piece quotes it word for word; the $20-plan dollar figures are behind
  its paywall and are not used. Gemini is placed and proven. Polymarket's
  search endpoint was wrong in the engine and is fixed; no market matches the
  Call, so the menu offers a Manifold market. **Waiting on Krish:** the five
  decisions at the end of the menu, then the paid fact check, record, pack.
- 2026-10-09, night: **the engine is wired for the 100x world and merged to
  `main`.** On Krish's "prepare and harden the entire engine as though all of
  this exists permanently": the scoreboard that keeps score is built (pin a
  Call to a Polymarket or Kalshi market at `/api/content-ideas/:id/call-market`,
  the `signals_odds` cron reads it daily, `/api/calls` serves every published
  Call with our confidence and the market's odds); the news-velocity sweep is
  built (`signals_news`, GDELT and Hacker News for every piece in play, a board
  warning when a subject doubles in a day); the on-camera voice rule
  (`VOICE_ON_CAMERA`) is live in the writers, judges, final pass, the story
  check's sixth point, a soft block in the Studio and a warning in
  `story_check.py`; a Gemini judge that can watch a cut
  (`scripts/signals/video.py`, needs `GEMINI_API_KEY`); Exa and Brave were
  already read by the research chain and now have the keys; X has a reader.
  Every check passes (typecheck, control-plane typecheck, tests, all 28
  control-plane guards, secrets, public copy). **Waiting on Krish:** rotate the
  four keys that were pasted in chat; a `GEMINI_API_KEY`; pin Friday's Call to
  a market once it is published; approve the piece-2 plan.
- 2026-10-09, later: **the outside tools are wired and the 100x plan is
  written.** `scripts/signals/collect.py` reads four free public sources
  (prediction-market odds, GDELT news velocity, Hacker News, SEC), tested
  live. Exa, Brave, the X API and the Hacker News value are placed in the
  content-engine Vercel env (`EXA_API_KEY`, `BRAVE_API_KEY`, `X_BEARER_TOKEN`,
  `HN_ALGOLIA_KEY`); **they were exposed in chat and must be rotated**
  (`docs/INTEGRATIONS.md`). `docs/ENGINE_100X.md` is the standing plan: every
  tool, every plausible use, and the combinations that are actually 100x (the
  scoreboard that keeps score against the market, the pile-on proven from
  GDELT, the fact gate with three checkers). Everything merged to `main` on
  Krish's command. **Next to build:** the scoreboard-odds feature (keyless),
  a cheap Gemini video reader, then the Exa/Brave/X readers.

- 2026-10-08: **Friday's piece is planned, waiting on Krish's yes.** Plan:
  `docs/plans/2026-10-09-who-picks-your-ai.md`. Piece 2 is rebuilt around the
  SemiAnalysis report of 5 October behind the screenshot Krish sent ("Same
  $20, five times the AI"), with the counter-evidence early (the gap is a
  middle-plan result; Artificial Analysis puts a finished task at $5.98 on
  Opus 5.5 against $0.72 on GPT-6.1 Sol), both companies' quiet changes from
  his "Upgrade Treadmill" research (two errors in that doc are noted in the
  plan), the three questions, a receipt picture and a plan slider. The call
  stays at 75%. **Waiting on Krish:** the angle, the title, and a cap for one
  paid fact check. This session had no engine key, so the board was not read
  or updated; the next session with the key should add the plan to the board.
  Then, on Krish's ask to take the engine up a level: `docs/TOOL_BANK.md`
  holds every way each paid tool could add to the engine, with a status that
  moves only on evidence, and the plan has a "Taking the engine up a level"
  section: the news wall for velocity, Reddit as the room, YouTube as a clue
  mine, a proposed `VOICE_ON_CAMERA` rule for scripts with opinion and dry
  wit, and an eight-step post-production list. **Waiting on Krish:** one yes
  for the tools and their ceiling, and the script rule.
- 2026-10-07, night: **ready for tomorrow's Friday planning.** Engine live at
  `main` (`16e40b4`), health ready. Friday 9 October is mind.the.gap piece 2
  (`904658db`, approved, draft of 2026-09-25): fold in the model-names
  research Krish dropped in Drive, fact-check the new numbers, then build the
  launch set the same way as Higgsfield. What changed today, all on `main`:
  - Drive: Krish moved `makeyourmindup` to `Ventures > Active`, with
    `Video Engine` inside it ("the moves were made on purpose"); every path,
    both machines' environment and both READ MEs follow (`docs/DRIVE.md`).
  - Recordings reach a cloud session by themselves from either runner
    machine: `python scripts/post-pack/recording.py get NAME`.
  - quick-edit: the logo opens every tall video; known mishearings
    ("Bike Dance") are fixed in every caption; a restart is cut by its time.
  - Pictures: nothing may run off an edge (`edge_check.py` in the pack,
    `card.py` before a PNG). Substack's social preview box wants 1200 x 630;
    the pack does not make one yet (made by hand for Higgsfield).
  - The call is marked right, wrong or too close to call, everywhere.
  - makeyourmindup.ai: YouTube live (`@makeyourmind-up`, Krish's handle; the
    clean one was taken), the newsstand lists articles only and refreshes
    every 15 minutes, the scoreboard is a labelled example board until the
    real one has calls to count, and a Meet the judges button.
  **Waiting on Krish:** change "held, broke or unclear" to the new words on
  the two published pieces in Substack; replace the 16 one-off docs in Drive
  with the reworked scripts (`docs/one-offs/scripts/`). **Next to build:** a
  warning on the board when library files wait over 30 minutes (the sync
  stalled 18 hours unseen); the 1200 x 630 social preview in every pack.
- 2026-10-06, night: **the Higgsfield video is edited and the recordings
  lane is live on both machines.** Krish recorded from script v4; the cut
  (restart at 3:02 removed, 3:38 to 3:04), six graphics, captions and end card
  are in the post's `3 Video` folder with YouTube words v2
  (`editions/2026-10-higgsfield/video-kit`). The recording first had to be
  sent by hand: the Drive connector stops at 10 MB and no route existed. Krish:
  "figure out how to never make that error again", then "just use whichever
  machine is online". Now `scripts/recordings-upload.ps1` runs on both runner
  machines (installed by Krish, 2026-10-06) and any session gets a recording
  with `python scripts/post-pack/recording.py get NAME`. The Studio script
  station is at version 3 and refuses a short-native script that fails the
  story check (`storyArcIssues`), on Krish's "Do this task here ... and then
  merge to main". **Waiting on Krish:** publish Wednesday's set.
- 2026-10-06, late: **every script now has to tell one story** (walk log
  F75, closed). Krish found the Higgsfield script unsayable, then that
  version 2 never set up "you don't do paid", had takeaways that did not follow
  and ended on 85% with no outro. He approved the five-point story check
  ("happy with that idea") and asked that the system never do it again.
  Built: house rules FOR_THE_EAR and STORY_ARC (writers, judges, final
  pass), every `_video.ts` shape now ends question answered, call, spoken
  outro, and `scripts/post-pack/story_check.py` refuses to pack a script that
  fails. The Sora facts are now in the article and passed the fact check
  (49 claims, 0 blocking). The corrected article pages, script v4 and
  LinkedIn v3 are in the post folder. **Waiting on Krish:** the same approve,
  record and publish as below, from those files. **Next:** the 16 one-off
  scripts fail the story check and are being reworked, and the Studio script
  station still needs the same check.
- 2026-10-06, evening: **Wednesday 7 October is "Higgsfield, taken apart:
  the $1bn AI video machine"** (under.the.hood, `9ae1a768`), in place of
  Koa, which Krish turned down as boring (walk log, end of "Piece 3"). Built
  on his own research from the Cold Ideas & Inspo folder; he chose the title,
  85% and the paid fact check ("Title 2. 85%. And yes"). Fact check passed,
  37 claims, 0 blocking, after the piece took Krish's three questions
  (walk log F74). The whole launch set is in the library under `3 Posts` and
  was sent in chat: the cover carries his face and is also the LinkedIn
  picture, and both explainers carry the companies' real logos. **Waiting on Krish:** approve it, record the
  video from the script, paste the Substack copy and cover, publish, and post
  the LinkedIn post with the cover (link in the first comment). Any change to
  the body needs the fact check run again. **Next to build**, each shown to
  Krish as exact wording before it changes anything live: the shift to
  fascinating subjects in the judges and the three channel briefs, idea
  sources pointed at AI creation, and the Cold Ideas scan reading whole
  documents and Word files. Then F73: check the launch set's words against
  the passed body before packing (three slips were caught by hand today).
  Friday 9 October stays mind.the.gap piece 2 (`904658db`), with the model
  names research Krish dropped in the folder folded in and its new numbers
  fact-checked.
- 2026-10-06, later: **the Drive library sync is merged** (walk log H42),
  on Krish's "yes, merge the library sync to main". Its private store is in
  the database. **Waiting on Krish:** on the always-on machine, run the
  three install lines in `scripts/post-pack/README.md` ("Install it, once"):
  they make the sync its own copy of the repository, `library-source`, and
  install from it. The first try ran the bare `-File
  scripts\install-library-sync.ps1` from a folder where that file did not
  exist, and PowerShell could not find it. All 33 files for the channel art and
  the first two posts (the launch and Who gets paid) are in the store, the
  two tall videos too since Krish raised the storage upload limit to 500 MB,
  and wait there until the sync writes them.
  **Also waiting on
  Krish:** send the Maven email (sent in chat as one copy page, made with
  `scripts/pages/broadcast.py`, H41), and swap Monday and Wednesday in the
  free welcome email, which still has the old order.
- 2026-10-06, Drive and one-off scripts (Claude Code, cloud). Krish asked for
  `04_Content` in Drive to be organised, for the whole system to know where
  things go, and for one-off main-channel scripts. Done: the four film folders
  sit in one `Films` folder with plain names; `Sales Materials` and `One Off
  Content Ideas` have READMEs; a "READ ME FIRST - what goes where" file sits at
  the top of `04_Content`; `docs/DRIVE.md` is the map, linked from `AGENTS.md`
  and `README.md` here and from the other three repositories' `AGENTS.md`.
  `Video Engine` and `makeyourmindup` were not touched (path-bound, F63).
  Sixteen scripts plus an index are Google Docs in `One Off Content Ideas`;
  source and research in `docs/one-offs/`. A new email signature (draft v1) is
  in `Sales Materials > Email signature`; its banner is on the makeyourmindup
  branch `claude/relaxed-dirac-ubqur0` and goes live at
  makeyourmindup.ai/brand/ when that branch merges. **Waiting on Krish:** a
  yes or changes on the signature and the scripts; dropping the banner PNG and
  preview (sent in chat) into the signature folder.
- 2026-10-06: article 1, the Who gets paid video post and the launch post
  are live on Substack, and Krish says the videos are posted, the Drive
  folders are back and the schedule is pasted ("done all the things waiting
  on me"). **Waiting on Krish:** two covers in Substack (article 1 still shows
  its old 1200 x 630 cover; the launch post's cover is the Monday card), both
  sent in chat as 3:2 covers that pass the crop and phone checks; one line for
  the welcome email, because Outlook hides pictures from a new sender (walk
  log F66; the line is in makeyourmindup's `apps/cover/substack-kit/COPY.md`);
  a yes, or not, for the address change in the `mindmake` canon and
  `ai-harness`. **New:** every finished video is archived in a folder named
  by date, subject and where to post it (H40). To file the two launch
  videos, on a runner machine: `python scripts/quick-edit/archive.py --subject
  "Who gets paid" --date 2026-10-05 --tall <tall file> --wide <wide file>`,
  and the same with the hello (subject "Launch hello" until Krish names it).
- 2026-10-05, closing the launch-day session. **Wednesday 2026-10-07 is
  under.the.hood, so it is piece 3** (Salesforce's Koa, `5255dcd8`):
  approved, fact check passed, call "By 30 September 2027" at 55%. Settle
  three things with Krish before building its launch set, all written out at
  the end of "Piece 3" in `docs/walks/2026-09-three-piece-walk.md`: the final
  pass said the title promises a fork the body never covers and the reader's
  "what do I build" is left implied; four house rules arrived after he
  approved it; and nothing is made from it yet. Then make the set in the
  session, the way he asked to work: `scripts/pages` for the branded page and
  the Substack copy, visuals that each explain one point, a video script for
  him to record, `scripts/quick-edit` for the edit, the engine's `package`
  step for the YouTube and Substack titles and descriptions, `scripts/pages --cover`
  for a cover that survives Substack's crops, `scripts/pages/card.py` to check
  any artwork reads on a phone, and the LinkedIn post. Friday
  2026-10-09 is mind.the.gap, piece 2 (`904658db`, approved).
  **The publication lives at `home.makeyourmindup.ai`**, shipped everywhere on
  2026-10-05 once Substack switched it on (the cover's Subscribe button and
  feed, Control Center's tracking and its migration, the engine, the AEO
  engine); tracking keeps the old address as an alias. Article 1 and the
  Who gets paid video post went live on Substack the same day. **Waiting on
  Krish:** swap in article 1's new 3:2 cover (the second one sent in chat, which
  reads on a phone; Substack cut the old one on every screen, walk log F64); publish the launch post with the
  hello video; paste the new schedule into Substack; put back the Drive
  folders the clean-up moved; a yes for Claude to change the address in the
  `mindmake` canon and `ai-harness`. Findings from the day are F58 to F65 in
  the walk log. Open: F61 (Ship's refusal is only a pop-up) and F63 (nothing
  protects the Drive folders the OS reads by path), both in control-center,
  and article 1's explainers, which read small on a phone (F64).
- 2026-10-05, evening: both launch videos are edited and with Krish (the
  hello and Who gets paid, each tall and wide). He recorded them and shared
  them by Drive link; the edit was done in the agent session with the new
  `scripts/quick-edit` tool, whose settings for both are in
  `editions/2026-10-launch/video-kit/`. Chat uploads stop at 30 MiB, so he
  has share copies made with `--share-mib 29`; the full-size masters were
  only in that session. A re-record runs through the same configs:
  `--plan` first, then render.
- 2026-10-05, later: the schedule is now Monday follow.the.money, Wednesday
  under.the.hood, Friday mind.the.gap, in Krish's words "Let's just make follow
  the money permanently a monday thing, and swap it out". It is changed in all
  three repos, the database's day labels and the live site. Substack's short
  description, About page, welcome email and free-benefit line need Krish to
  paste the new text (board item `you-substack-schedule`), and the Windows
  runner needs a `git pull` before its next render. Krish also asked to work
  in the agent session while the engine is built: pieces and their artwork
  are made there as branded HTML and image files, and Control Center is for
  locking and publishing only. Article 1 passed the fact check with his
  rewritten opening (62 claims, 0 problems). Its branded page, the launch post
  (a visual page and a one-column Substack copy) and two video scripts (a hello
  for the launch post, and Who gets paid) are linked from the board.
- 2026-10-05: Article 1 is the launch piece, rewritten deeper at Krish's
  request ("why they get paid for different things ... the incentives ... where
  the consumer or merchant could get stung"), with his practical sections kept
  word for word. It passed the fact check on the fifth run (59 claims, 0
  problems) and is in review. Locking it is Krish's, in Control Center. The
  launch kit (a private artifact linked from the board item
  `you-launch-today`) holds the Substack title and subtitle, the article with
  three images and 28 sources linked, the launch post, the LinkedIn post and
  card, and the video script. Nothing is published. After he publishes, he
  sends the link; the makeyourmindup.ai scoreboard and the move from Issue 00
  to Issue 01 need his yes. What the fact check taught is walk log F56. The
  article supersedes the 2026-10-04 notes below.
- Krish read the current Article 1 revision on 2026-10-04 and said, "ok,
  happy with this article". Treat that as his taste approval of the exact
  wording he saw. His decision is recorded in the edit ledger against that
  body. The engine correctly refused the official approval state because the
  practical section was added after the last fact check. Authoritative
  readback still shows the article in review with no production approval. No
  paid check ran and no video job exists. Krish approved pushing the no-cost
  counter correction, it is live, and the production readback now establishes
  the exact scope: 61 reusable sentences and 31 fresh sentences. Running one
  paid truth check with a hard cap of 31 is the next decision waiting on him.
- Three timed jobs that failed on every run are fixed and merged. The Sunday
  job that turns Krish's edits into suggested rules had never saved one because
  each suggestion lacked the list of edits behind it, which the database
  requires. It now attaches them. The Friday shift spotter now writes the
  current channel names instead of retired ones. The Saturday build-signals
  job now says why it fails. Krish said on 2026-10-04 that the GitHub key in
  this engine's Vercel project is fresh. Nothing further is waiting on him for
  that key; the next scheduled job is the proof that build signals now fill.
- Krish's current correction for Article 1 is that its true value is the
  practical implication for a business leader or consumer: what business to
  build, which features matter, what to be wary of, and what a shopper should
  demand. One section now makes a single commercial call: build the authorised
  front door between agents and merchants. It names the likely customer, the
  metric, the merchant and shopper controls, the trust features, the platform
  risk, and the consumer test. The advice is clearly judgement rather than a
  new fact. The revised article is saved and visible in Control Center. Its
  deterministic checks pass, including reading age about 12. Because the
  words changed, the earlier passing fact check no longer covers the current
  body. The free preview reports 61 reusable sentences and 31 new sentences.
  No new paid check has run, the article is still in review, and no video job
  or public post exists. Krish now needs to say whether the new section is the
  value he meant, or what still needs to change. He has now said it does. This
  ruling, his approval and the handoff are recorded in the local documentation
  commit. Krish approved pushing it with the no-cost counter correction on
  2026-10-04. The correction is live and production still reports 61 reusable
  sentences and 31 fresh ones. No paid check has run.
- Krish approved Article 1's clearer wording on 2026-10-03 and made clarity a
  critical rule for every future article. Every sentence must have one clear
  reading. When an unfamiliar mechanism needs help, use a factual historical
  parallel, a familiar analogy or a clearly signposted comic exaggeration that
  does not change the fact. These instructions are now engine house rules for
  writing, checking and visual planning. All 1,107 tests and the repository's
  type, skill, station, renderer, public-copy and secret checks passed.
- Krish approved the two safeguards and exactly one more Article 1 fact-check
  run on 2026-10-04, conditional on learning how to avoid repeated paid checks.
  Both safeguards are live. Article 1's four failed lines were repaired in one
  exact edit: two unsupported details were cut, and the two dated contrast
  sentences became plain source-backed statements. The free preview reported
  59 reusable sentences and four fresh sentences. The run used a hard cap of
  four, ran once and passed with no blockers. It covered that exact earlier
  body only; the later practical-value revision above means it no longer
  covers the current article. No production brief or video job exists, and
  nothing has been published.
- The repeat-spend cause and prevention are now durable. The earlier result
  predated the sentence ledger, and the paid route offered no preflight or hard
  scope ceiling. The live route now reports settled versus fresh sentences and
  refuses before any model or web call when the fresh scope exceeds the
  approved cap. The capped Article 1 run proved the guard on a real piece.
- The post-run readback exposed a smaller bookkeeping gap: short scenario
  labels, such as "Guess one.", could not settle by fuzzy matching. The live
  correction now lets exact short matches settle and fills deterministic
  ledger gaps from a successful check of the exact current body and sources.
  The full repository verification passed: 1,109 tests plus the type, skill,
  station, renderer, public-copy and secret checks. Production still reports
  61 reusable and 31 fresh sentences for the current Article 1 because its new
  section was added after the older check. The correction prevents this leak
  on future exact results; it does not rewrite an older ledger after the body
  changed. No paid check ran.
- The board failed to render in an already-open tab after a deployment because
  the old app shell requested a route file whose hashed name had been replaced.
  Its Retry button retried the obsolete request; a full reload restored the
  board. The fix is live: Retry performs that full reload only for this class
  of stale-file failure. Its production deployment is ready, its live build
  identity matches the pushed fix, and the board renders after reload. The
  dependency install reported 64 existing audit findings; this narrow recovery
  repair did not change unrelated packages.
- Krish said he is ready to watch the sample. A tracked Studio session found
  no Article 1 video job or review, recorded his relatable-explanation feedback
  without the surrounding chat, and closed cleanly. The Windows runner creates
  that job only after the exact article passes the truth gate and its approval
  is recorded. The first output is a governed phone review.
- Krish agreed to the outside-tools plan. Shape the stack only after real video
  results exist: post the first pieces by hand, collect YouTube results, then
  choose tools from the evidence. No purchase has been made. Runway remains one
  capped illustration test, Higgsfield may be one evidence-checked judge, and
  Native stays out because it would bypass his approval.
- The earlier work remains complete: Article 3 is approved but unpublished;
  the access fix and the timer-judge cost cut are live and verified; elegant,
  exact-artifact feedback at every phone review step remains active Studio
  work.

## What costs money

Krish pays for the model only when the engine calls it. A session's own
thinking runs on his Claude or Codex subscription. Measured over the 14 days to
2026-10-02 (`meter_daily` in the database):

| What | Cost |
|---|---|
| Judges scoring new ideas on a timer | $39.34 |
| Control Center's people, growth and strategist features | $17.87 |
| Fact checking (mostly repeated checks on articles 1 and 3) | $15.06 |
| Writing and rewriting articles | $2.52 |
| Everything else on the model | about $11 |
| Apify (LinkedIn and job scraping, not the model) | $33.10 |

Writing is cheap; keep it in the engine, where Krish's rules and his edits
teach it. The timer judges are the biggest cost and run whether or not anyone
is working. Before you run anything that spends, check this table is still
true.

One Article 1 fact-check run completed on 2026-10-03 after this table's
measurement window. Its exact meter delta has not yet been read back.
