# Workbench: where we are and what's next

[Story correction and Growth handoff, 26 Oct](docs/history/2026-10-26-story-closeout.md).

## 26 October: Monday to its one sign-off; Wednesday and Friday next (Claude)

- **Asked (Krish, 26 Oct):** "yes, both good, and yes to the fix - already recorded both videos, and they're in the inbox. Get everything from here ready ... this week's publish board should be up to date. Monday's content should be moved and taken all the way to Codex ... then you should interview me on Wednesday and Friday's narrative arcs, and then get everything ready in Wednesday and Friday's board ready to send to teleprompter".
- **Done:** sign-off recorded on both Monday cuts; the scripts step no longer waits on the paid spine judge (PR #181, learning `no-paid-call-before-a-free-step`, encoded). Monday's article rewritten in his voice and stored; 22 verbatim sources filed (free pre-check clean); takes fetched, transcribed and lined up (`docs/plans/2026-10-26-monday/takes/`); creative direction for both cuts (`creative-direction.json`, `receipts.md`) timed against the takes; logos (`logos/`, SOURCES.md; the Character.AI wordmark may be the 2023 one); titles cold-read twice; `storyboard-signoff.md` on the board's Monday Drafts step. Board republished (build 851da30a): Monday in review, Wednesday and Friday picked.
- **Signed (26 Oct, "Yes to all four, recommended title"):** the storyboard (direction signed, `--for-render` passes), the title "Why is Disney eating the scraps of bankrupt Character.AI?" and thumbnail "GOOGLE PAID $2.7B FIRST" (verdicts recorded), the paid checks up to $1.20 ($1.02 spent: fact check 27 then 13 blockers; spine judge flags OUR PREDICTION). His three picks relayed to the engine (state drafting, scheduled 26, 28, 30 Oct) and both Monday takes placed on the record by hand (Recorded done). Board build a02a9aed: Monday's Drafts hold titles to pick, fact lines to sign off, the prediction bridge; Publish holds both thumbnails and the vertical cover.
- **Waiting on Krish (Monday, options sent 26 Oct):** the last chapter heading (recommended "Ask your AI supplier the four questions Character.AI failed"; "The four questions that spot the next Character.AI" cold-read as confusing); the wide cover words (recommended "GOOGLE PAID $2.7B FIRST"; the "eating the scraps" lines ran long and cold-read as cheap); sign-off of the fact check's 11 lines plus one last small paid check of the 14 bridge-changed sentences (third run today; both refused by this session's permission system, so Control Center or his explicit words); his paste of `docs/plans/2026-10-26-monday/CODEX_PROMPT.md` into Codex (sent to him as a file).
- **Wednesday (26 Oct):** Krish: "I think for Wednesday's Claude piece we've already done that message takeaway with the Muse versus Grok piece. I would suggest we focus in on what Duet actually adds to the Claude ecosystem for Claude power users." Draft 2 of the end message and the question put to him (is staff connecting work apps to a personal account the sharpest point?) are in `docs/plans/2026-10-26-week/narrative-wed.md`; Help Center facts in `research-wed.md`. Learning `no-repeat-takeaway` encoded in make-piece (PR #182).
- **Wednesday, later (26 Oct):** his answer ("unpacking the things the Claude site and the can-do reviews dont tell you ... where you would integrate it first with practical examples if you are an existing claude power user"), the community reviews file (being distilled into `docs/plans/2026-10-26-week/research-wed-community.md`), and "Merge and get on with the rest". Narrative draft 3 with five checkpoints, the picture and scope; outline `docs/plans/2026-10-28-outline.md`; his call asked. Monday's chapter 6 and wide covers picked ("All recommended"); a production helper is drawing, filing and boarding them.
- **Evening (26 Oct):** Wednesday's scripts are in Teleprompter and recorded on the piece (read-backs: long by two readers, short on Krish's words); `docs/plans/2026-10-28-wednesday/` holds post.json, brief.json and signoff.md. Board build 9c7b4681 (inputs in `.cache/week-board/2026-10-26/run2/`). Monday's 14 artwork files were sent twice by two helpers, so the library holds them in "3 Posts/2026-10-26 Mon follow.the.money - Disney, Google and Character.AI/2 Covers and images/" (canonical, named in CODEX.md) and "...- Why is Disney eating the scraps of bankrupt Character.AI/2 Covers and images/"; nothing deletes from the library, so Krish decides whether to remove the second. Monday's titles box text now shows his picks; it reaches the board on the next rebuild. Friday: end message signed, question 2 asked.
- **Next:** on his line: `creative_direction.py` signed block with his words and the scripts' hashes; fact gate then `spine_check.py judge` (within $1.00); cover-facts.json, cover and thumbnails (visual gate), video cards, `build.py` and `send.py`; `locked/CODEX_PROMPT.md` for Codex. Then the Wednesday and Friday interviews (research in `docs/plans/2026-10-26-week/research-wed.md`, `research-fri.md`; Friday still needs "the past" researched).
- **Tools in a cloud session:** the full `requirements.lock.txt` does not install on Python 3.13 here (mediapipe 0.10.21 has no build); the transcriber works with its four pinned versions alone (`faster-whisper==1.2.0 av==18.1.0 ctranslate2==4.8.1 onnxruntime==1.29.0`). Filing sources needs `NODE_USE_ENV_PROXY=1 ENGINE_OPERATOR_TOKEN=injected-by-the-session-proxy`.

## 26 October: Friday motion v6

[Production handoff](docs/plans/2026-10-23-friday/revisions/motion-v6/BRIEF.md). [Quality gate and failed $3 calibration](docs/plans/2026-10-26-quality-evidence/README.md): eight calls, no qualification. Gates remain draft; four videos and final board incomplete.
## 26 October: production and social growth have separate owners

Krish's ruling is recorded in docs/GROWTH-HANDOFF.md and AGENTS.md.
Content-engine alone owns production and its standards; Growth-MakeYourMindUp
owns social/posting strategy, amplification briefs, account management,
authorised automatic distribution and channel learning. The transferred
carousel rules live here in docs/CAROUSEL-STANDARD.md. Krish approved all
eight cards of Grok Bot vs Muse revision 03 on 26 October. Growth originates
amplification ideas, channel best practices and missed-placement opportunities;
content-engine supplies production execution and quality standards for all
formats. Krish now prioritises merging the engine changes, then continuing
Friday production with its existing production owner. Growth briefs receive
a checked creative package through the existing editorial/Studio path. This change updates repository guidance
only; it does not mutate a tracked Studio session, learning record or board.

## 24 October: Friday locked and signed off; Codex makes the videos (Claude)

- **Signed off by Krish:** storyboard, no trim, titles, outline ("signed off, keep, all A"), prediction A2 ("a2"), and
  the six first-person test lines in the fact gate ("yes, $0.30, and I sign off my test lines"). Spend: $1.09 of the
  $1.30 he approved.
- **Done:** the article (`docs/plans/2026-10-23-draft-body.md`, on the piece; fact gate `ok`, voice, AI scan and spine
  checks pass) and every channel's copy (`docs/plans/2026-10-23-friday/locked/board-copy/`: `article.md`,
  `publishing-copy.md`; voice score 4.5, bar 6). The board shows the signed storyboards (revision 50).
- **Waiting on Krish:** start Codex by pasting `docs/plans/2026-10-23-friday/locked/CODEX_PROMPT.md` (the part below
  the line) into a new Codex session on a home computer. Then his look at the four videos on the board, then his yes
  to the final board publish.
- **Changed after sign-off (his answers, 24 Oct):** the 90-second on-camera cut loses the recap and three small repeats
  ("Cut the recap (Recommended)"), and both vertical cuts are sped to 1.12x ("Speed both to 1.12x (Recommended)") so the
  whole file with intro and outro runs under 89 s. His warning, "last time Codex glitched a bunch of words on the
  speedup and also misaligned the captions", is `config/learnings.json` `speedup-without-glitches` and the
  "Speed without glitches" section of `CODEX.md`.
- **Making record completed by Claude (24 Oct, after Codex stopped on it):** Visual gate (cover and thumbnails drawn
  from his picked words, gate passed), Scripts with both read-backs (two fresh readers each, nothing lost) and Pack
  (sent to the Two passports library folder) are recorded; every step up to Recorded reads done. `scripts/pages/build.py`
  now tries the smaller headline sizes on its ladder before refusing a 3:2 cover.
- **Codex** works from `locked/CODEX.md` and nothing else; it fills only the chapter times in `publishing-copy.md`.
- **Where things are:** takes in the engine's recordings store (`recording.py list`); evidence captures under
  `2 Covers and images/Evidence` and the storyboards under `2 Covers and images/Storyboard` in the post's library
  folder. The Anthropic and GitHub reference clip (Video Engine > Inspiration) had still not reached the library;
  Codex fetches it first (`motion-system.md`).

## The idea queue: read it first

### Monday 19 October: earlier review hold resolved

The source-backed review and Krish's full-playback acceptance supersede the
older hold; see the current release entry above and its immutable receipts.
No further spend or public posting is authorised.

### 19 Oct, Monday in review on the board

Monday is on its tab of https://claude.ai/artifact/CDgS3JDULpzvRnxkHwLkVk in draft (version 5): outline, article and both scripts in review boxes, and one call waiting on him (sign off both scripts). Fact gate open (three runs, $0.43 then less, his sign-offs on the example month and three framing lines); spine judge passed; scripts pass story_check and four read-back rounds, waiting on his words, then Teleprompter. The other board link (4SZR…) is his other account: a session there republishes the same file. Workroom: https://claude.ai/artifact/DdBDf3JPCAdjkmDj7ss6na. Still to do: cover and thumbnails, publish page, pack.

### 19 Oct, later: three narratives written, waiting on his sign-off

He answered the seven questions (his words are in each narrative file). The three narratives are in
`docs/plans/2026-10-19-week/narrative-mon.md`, `-wed.md` and `-fri.md`; nothing is made until he signs each.
Monday's end message changed: Google's pricing page (read 19 Oct, updated 16 Oct) shows the reused-input rate
doubles too ($0.10 to $0.20), so reuse makes the bill smaller but does not stop it doubling; the figure is
"about 95% cheaper", never "a tenth". The research he pasted is in `research-mon-argon.md` (unchecked leads
except the Standard rows read at Google's page). Wednesday's line-up is his: Muse, Grok Bot, dots, Gemini
Spark and Poke scored, OpenClaw as the origin only, Viktor out. "Narrative before making" is now standing:
the first step of `make-piece` (learning `narrative-before-making`, encoded). Parked ideas: `parked.md`
(the AI-shopper rulebook parked, three let go; none was in the queue, so nothing was written). Other board
link (`4SZR…`): per his 14 Oct ruling, a session on his other account rebuilds and republishes it; that link
returns 404 from this account. Monday's narrative is signed and its outline approved (`docs/plans/2026-10-19-outline.md`, with his downgrade section). Monday's workroom and draft are done (handover, "Done in the first session"); the fact gate waits on his yes to the paid run. **Next:** `docs/handovers/2026-10-19-monday-argon-make.md`; Wednesday and Friday still wait on his sign-off.

### 19 Oct: queue live, picks saved, next is the editorial narrative

Live: the idea queue (migration applied, PRs content-engine #94 and control-center #481 merged). His picks (Mon
`5b5bfadc`, Wed `d7a20885`, Fri `7083d6ad`) are `drafting`, scheduled for their days and on the day tabs of
https://claude.ai/artifact/CDgS3JDULpzvRnxkHwLkVk (version 4). No making session was started. The queue holds
his four marked ideas, all triaged; his two Drops are recorded as dropped. His feedback is five entries in
`config/learnings.json` (business-leader test, simple then unpacked, show the money, no repeat within three
weeks, reading his marks) plus `narrative-before-making`, open until he says whether it is standing.
**Next:** a fresh session runs `docs/handovers/2026-10-19-editorial-narrative.md`: one signed-off narrative
(end message, checkpoints, drift rule) per day before anything is made.
Waiting on him: the seven questions at the end of that handover, and the merge of two small PRs (engine
`question` field; Control Center shows it). The other account's board is now
migrated. The Argon "a tenth" figure remains with the editorial work (the row's numbers give a twentieth).

## How Krish wants to be worked with

- **Every title earns the click, from the piece, never from nothing** (house
  rule TITLE_EARNS_THE_CLICK; `scripts/post-pack/title_check.py`). No straw
  man ("Muse isn't ChatGPT", "X vs Y isn't a fair fight"), no bare topic
  ("Three kinds of AI"), no stock phrase; name who did what or give the
  surprising number, from the checked piece. The card tool, publish page,
  cover drawer and story intro all refuse what it refuses. Krish,
  2026-10-14: "We need an anti-dumb filter ... this sort of crap cannot be
  allowed to pass in the future, ever". He liked "Muse's real rival: Siri."
  **Titles go to him as options first, and nothing is made from a title he
  has not picked** (make-piece "Titles (Krish picks)"; config/title-verdicts.json
  holds every verdict and what it teaches; `title_check.py lessons`). Krish,
  2026-10-14: "Stop ... generating assets ... when I haven't actually
  approved your new approach ... iterate, and understand what I actually
  like, and then encode that into the system forever."
- **Every day on the publish board is built the same way, by the engine.**
  Each made day is its own `publish_manager.py` page (Copy on every word and
  picture), and the board is `week_board.py` over those pages, republished
  to its own link. Never lay a hand-written script over the board (a
  scratchpad "draft mode" did on 2026-10-13 and stripped Wednesday's and
  Friday's Copy cards; Krish, 2026-10-14: "why are Wednesday and Friday
  built differently to Monday? ... I thought I didn't need to keep telling
  you this sort of stuff?"). A day whose page link is lost is carried over
  with `week_board.py --keep DAY --previous <the board as read>`. A day whose
  words are in review is built with `--draft DAY` and its `--review` files,
  never kept or given an older publish page (15 October: Friday v3 sat on
  its first version's page, whose chips said the new words were checked).
- Plain words. Nothing he reads may contain codes, labels, hashes, version
  numbers or project shorthand. Say what happened, what it means for him, and
  what you need from him. If a sentence would confuse someone outside the
  project, rewrite it.
- After everything you do, update the board (below), and end every reply to
  him with the link to what waits on him:
  https://controlcenter.krishraja.com/#/home?waiting=1. Update this file when
  how the work is done changes.
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
- Every video script opens with its series line, then the hook, and says
  "I'm Krish" only there (house rule `SERIES_OPENER`, Krish, 2026-10-12). And
  an ordinary 12-year-old must follow every script heard once. His words:
  "Every single script should be understandable by a 12-year-old. I can't
  even understand what I'm reading off the teleprompter. I thought we had
  hard gates for this?" (house rule `R7`, now a hard gate: `story_check.py`,
  then two fresh readers; `make-piece`, "The Scripts step").
- Every video, in every format, gets an animated intro made for its own
  story, its audio treatment and an animated outro card. His words,
  2026-10-12: "when the videos come back bear in mind that I want a proper
  animated branded intro to this specific story visually, the audio
  treatment, and then a proper animated outro card. Across all formats, and
  this should be part of the system moving forward." Design comes first and
  is his to approve; until then no cut is finished (house rule
  `STORY_INTRO_OUTRO`, `config/story-intro-outro.json`).
- He reads his scripts in teleprompter.com and drops each take at the top
  of the Video Engine Inbox. His words, 2026-10-12: "Also note that Descript
  is permanently gone, teleprompter.com is permanently in, connected via MCP
  here". Every checked script goes there by itself, one folder per piece
  and one script per cut, updated in place, and nothing there is ever
  deleted (`AGENTS.md`, `config/teleprompter.json`).

- Never hand him a blocker you have not checked is real, and never one a
  session can clear itself. His words, 2026-10-12, after a session relayed
  the runner's "Drive unavailable" light as his to fix: "I find it a bit
  ridiculous that you're bringing me this blocker. I think you've done this
  before and you just eventually realised you're making a mistake so you
  need to fix this." Both home computers had Drive working. The runner's
  `drive_state` light is not proof: check it on the machine before saying
  anything.
- **Any machine makes the videos; nobody is ever sent to a home computer.**
  His words, 2026-10-12: "the audio is literally in the drive connected here
  via MCP and also on Google drive, what the fuck is happening here? record
  this capability of yours so you do not whine about this ever again". What
  every session can do, in the cloud as anywhere:
  - his takes: `python3 scripts/post-pack/recording.py get recordings/<sha>.<ext>`
    (the path is on the piece's making record; the Inbox lane uploads every
    take to the engine within minutes);
  - the licensed music: `python3 scripts/quick-edit/music.py fetch`, then
    `MINDMAKE_MUSIC_ROOT=<the folder it prints>` (both home computers publish
    it to the engine's library every pass, `music.py publish`);
  - a post's pictures: `GET /api/library/file?path=3 Posts/<post>/2 Covers and
    images/<name>` (or the board's own copies);
  - the tools: `pip install faster-whisper==1.2.0 ctranslate2==4.8.1 av==18.1.0
    playwright`, `npm ci`, `MYMU_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
  - the story intro and outro: `scripts/quick-edit/story_io.py props --plan
    <plan>` then `render`.
  Then kit.py, make.py, the thumbnails, send.py and making.py as
  `produce-video` says. The midday run (`.github/workflows/produce-day.yml`,
  `scripts/produce_day.py`) does all of it by itself at 12:00 New York on
  Monday, Wednesday and Friday, on GitHub's machine (his choice: "GitHub
  always renders"); its Run workflow button is the one click.
- Epidemic Sound gives no per-track licence number. His safelisted channels
  are the licence record (`config/music-licences/`, screenshot of 12
  October); never ask him for licence details again. LinkedIn and every
  other platform need no safelisting (Epidemic's own screen, second
  screenshot there).

## This week's publish board

**18 Oct, evening (same session): Friday's deep cut is being rendered in the cloud.** Krish raised the library cap to
2 GiB, so the 14-minute take (`recordings/ee91ab41...0fd9f.mp4`, 1.1 GB) reached the engine. The 17 and 18 Oct
cards and panels now reach any session (`working.py fetch`, fixed three ways on 18 Oct). Work folder:
`.cache/produce/2026-10-16-904658db` (rebuilds from the engine with the commands in the Friday handover); config
`kit/long.json` is `docs/plans/2026-10-09-friday/long-cut/long.json` plus the story intro and outro. Plan: 13 min
41 s, 51 cues found, licensed bed. When it is done it goes to the library, onto the record and onto both boards.

**session_01RY92XqvcV9kwoDWLBnN8fp (18 Oct, afternoon): Friday is publish-ready.** Article v7
(`docs/plans/2026-10-09-draft-body-v7.md`) carries Krish's edits to the nine lines and says every test result as a
plain comparison (his words on 7 and 8: "vague scores mean nothing to a reader"). One capped paid rerun (13
sentences, about $0.80); 11 lines signed off in his words through the new sign-off step (guard G9, on main); the
fact gate and every blocking publish check pass, including the new PLAIN_SCORES article check. The v7 pack
(publish manager, Substack copy, web page, covers, six charts, the 90-second cut and its thumbnails) is in the
library: `3 Posts/2026-10-16 Fri mind.the.gap - Why so many AIs/`, inputs in `docs/plans/2026-10-09-friday/`
(`post-v7.json`, `manager.json`, `words.json`, `page-facts-v7.json`; the work folder rebuilds from the library
with the commands in `nine-lines.md` and `HANDOVER.md`). Still waiting: the 14-minute long cut, which Krish
renders on his PC (Codex, `produce-video`, `docs/plans/2026-10-09-friday/long-cut/long.json`; his pick, 18 Oct:
"Merge; I render on PC"). The source links inside the article (54 listed, none linked from a phrase) are still
open from 18 Oct. Both board links hold the same build (H6qK version 17, RjLH version 41, 18 Oct): Monday and
Wednesday carried over unchanged, Friday made with its publish page; its publish-page link on the record is the
post's Drive folder (`making.py ... publish-manager`), because Krish's machine had not yet written the new page to
Drive. No Friday ticks on H6qK; RjLH's tick store cannot be read from this account.
Then Krish (18 Oct): "there are significant issues with the publish board, not downloading or linking the right
assets. it's not ready for me to use." Fixed and republished (H6qK version 18, RjLH version 42): the six chart cards
had no picture (a size trick that needed a script the board does not run; reverted, charts now 256-colour where no
pixel visibly changes); every file a step names links to its Drive copy (each checked in Friday's folder, same size);
YouTube, Spotify and Substack name the deep cut and say first that it waits on Krish's PC. Tested in a browser on
the board itself: 44 of 44 pictures load, 10 of 10 picture downloads are real PNGs, Copy picture works. The board's
check now refuses a picture with nothing to show (`config/failures.json`, publish-board-empty-pictures).

**Closing session_01YHC9kjnvJEzYDeFDdADLBq (18 Oct).** Three files Krish asked for, all on main and on both board
links (Friday tab, "Review the words"): `docs/COST_GUARDS.md` (the six standing cost rules and guards G1 to G9 to
build), `docs/plans/2026-10-09-friday/nine-lines.md` (the nine fact-check lines for his sign-off) and
`docs/prompts/sunday-ideas-tab.md` (the prompt for the board's Sunday Ideas tab, to run in a fresh session).
Friday's state: `docs/plans/2026-10-09-friday/HANDOVER.md`. Redrawn panels and cards: the library's
`3 Posts/2026-10-16 Fri mind.the.gap - Why so many AIs/3 Video/working 18 Oct/`.

One page a week, with a tab for Monday, Wednesday and Friday and a tick for
every step, made each Sunday by `plan-week` and republished to the same link
all week by every session that makes a piece (`make-piece`, "The week's
publish board"). Krish ticks there as he goes; every making session in
any tool copies his channel ticks onto the pieces at its start and before
it stops (`make-piece`, "The week's ticks"). Each week's board has its own
board item, `week-publish-board-<its Monday>`, with the same link. Sunday's
run puts the new week's line here and moves this one under "Last week's
publish board", which every session's tick copy still reads until every
day on it is at 100% (Friday's reposts go out at the weekend).

- Week of 26 to 30 October: https://content.krishraja.com/board/2026-10-26. Ideas tab first; nothing picked yet (25 Oct).

Last week's publish board (19 to 23 October):

- https://content.krishraja.com/board/2026-10-19.
  The newer source's Ideas and draft day tabs are preserved. Its three picks,
  eleven queue decisions and 28 comments are available to every authenticated
  workflow. Monday is in review. Its editorial/video handover owns the next
  production steps; this migration does not approve those steps.

Last week's publish board (12 to 16 October):

- https://content.krishraja.com/board/2026-10-12 remains open alongside this week.
  Monday and Wednesday show 7 of 7; Friday remains unfinished. Eighteen stored
  ticks (including recording ticks and false values), three saved edits and
  24 comments/replies were retained. The existing Friday files stay until its
  separately repaired cuts are watched and approved.
- Read edits and full comment threads through `board_web.py read WEEK COLLECTION`
  along with ticks, links, picks and queue. Apply Krish's words to source drafts
  with the existing script-change and making-record attribution rules, then
  rebuild with `--target web`. Original Claude addresses remain in
  `config/boards.json.weeks` for provenance, not for ongoing synchronization.

### What the 12 October evening session made permanent (read this first)

All on main; each has its tests.

- **Monday is finished and on the board**: both cuts (3-minute 2:48, 90-second
  1:27) in Drive `3 Posts/2026-10-12 Mon .../3 Video`, with NO CURVES, the
  stand-off story intro and outro, thumbnails, and five covers. Only posting
  is left, and that is his.
- **The midday run** (`.github/workflows/produce-day.yml`,
  `scripts/produce_day.py`): Monday, Wednesday and Friday at 12:00 New York,
  GitHub renders both cuts end to end (his choice: "GitHub always renders");
  the Run workflow button is the one click. The secret ENGINE_OPERATOR_TOKEN
  is set. A stop writes one board item `videos-<date>` saying what stopped.
  No schedule puts the videos on the board: Krish deleted the publish board
  schedules from both accounts on 19 Oct ("We are not ready for this yet").
  A session links them when he asks (`making.py <piece> drive-link`).
- **Video tool** (`scripts/quick-edit/make.py`): pictures ease in and
  crossfade, the speaker slides aside, no gap flashes the frame behind
  ("the title card flashes up for about 0.1s ... unacceptable"); true peaks
  are limited under -1 dBTP by itself; a story intro of up to 5 s on the
  approved config.
- **Story intro and outro** (`apps/renderer/src/story`, `scripts/quick-edit/
  story_io.py props --plan <plan>` then `render`): the approved stand-off,
  the real wordmark and masthead from `brand.fetch` (never typed), a 6 s
  outro that holds its last card 2 s. Approved in `config/story-intro-outro.json`.
- **Music**: NO CURVES approved in his words; the home computers publish it
  to the library every pass (`music.py publish`); any machine fetches it
  (`music.py fetch`, `GET /api/library/file`). Epidemic's safelist screenshots
  are the licence record; LinkedIn needs no safelisting.
- **Covers**: every pack carries five, each drawn for its place
  (`scripts/pages/build.py --cover`): Substack upload 1200x630, feed
  1200x800, share card 1200x675, square 1080x1080, vertical 1080x1920 for
  Shorts, TikTok and Reels. A pack missing one is refused.
- **Board**: Download waits for the save capability and says why a save
  failed (`week_board/week.js`, `publish_manager.py`).
- **House rules**: ARTICLE_LENGTH (1,000 to 1,400 words: "about 30%
  shorter") and SHARP_PREDICTION (one checkable event on a date, not
  already happening). Open with him: the AI-detection score (93%); his
  answer is awaited on a voice note per piece and which detector flagged it.
- **Pictures in every scheduled video**: a picture too small to read in a
  shape is shown a readable part at a time, cut at its own gaps, crossfading
  (`kit.py legible_pages`, `make.py expand_pages`); a picture as wide as the
  frame within a pixel of the floor goes as it is (he passed exactly that on
  Monday); a cue line he said his own way is still found (`make.py
  find_loose`). Proven on Monday's takes on GitHub on 12 October: every
  picture in both cuts. Wednesday has no made piece or takes yet, so its run
  will stop and say so.

### Resumed 12 October, about 18:00 UTC (session_01YHC9kjnvJEzYDeFDdADLBq)

- Krish's words this session: "Yes I approve that licence track. Feel free
  to tighten it if I stumbled. For now you just take control of this entire
  thing, get the videos produced, and have the publish board ready for me to
  publish absolutely everything, including the videos." Asked whether
  Monday's two videos may go out without the story intro and end card this
  once, he picked "Yes, ship Monday without it". Recorded under
  `exceptions` in `config/story-intro-outro.json`; every other piece still
  waits for the approved design. Monday ships first; Wednesday and Friday
  are his for tomorrow ("publish today ASAP and then work on Wednesday and
  Friday tomorrow").
- The music track approval cannot be written yet: `music.py approve` refuses
  NO CURVES with no licence id, licence file, sha256 or loudness. A home
  computer can measure the file; the Epidemic Sound licence details are his.
  Until then the cuts go without music.
- The board (same link) was republished with Wednesday shown in production
  (working headline from the sources, his two calls) and Monday's blocker.
  This session's account cannot read the board's tick store or open the
  Monday and Friday day pages (both made under another account), so the
  board was edited by hand, not rebuilt with `week_board.py`.
- Krish said "Merge it": the exception is on main. Drive works on both
  home computers (his words); the runner's light was wrong. Board item
  `mon-produce-today`: start Codex on a home computer with "produce
  Monday's video"; that run measures NO CURVES (`music.py add`) and records
  his approval ("Yes I approve that licence track.") before rendering. Both
  cuts get music: LinkedIn is covered without safelisting (Epidemic's
  screen, recorded in the ledger). After the cuts are recorded, a Claude Code
  session adds them to Monday's tab and republishes the board.
- Story intro design: three blind concepts made (stand-off, receipt printer,
  song track); judges split (stand-off v receipt); a tie-break judge was run.
  Files were in that session's scratchpad only.

### "Resume this week's publish board"

Krish closed the 12 October session with: "lets just close this session
out here, I will get another session to pick up exactly from here with the
prompt "resume this weeks publish board"". The goal he set it, his words:
"leave me with the final Publish Board with Monday 100% ready to publish
(post produced video links included), Weds and Fri in production". Where it
stood at about 17:30 UTC: Monday recorded, its produced videos blocked on a
design only he can approve; Wednesday has its workroom and waits on two
calls from him; Friday's scripts are in his Teleprompter and wait on one
call from him, then his recording. A session given that prompt picks up
here, in this order, and ends every reply with
https://controlcenter.krishraja.com/#/board:

1. **Read where it stands.** The three pieces: `python3
   scripts/post-pack/making.py <piece> show` for Monday
   f328382d-71b3-41a7-a221-d8615826f12e, Wednesday
   7554ed4a-560b-4365-b266-ea72abeed7ef and Friday
   904658db-4df2-4537-a0ed-ebe93e081db7. The board: `board_web.py download 2026-10-12 --output FILE`, then `week_board.py
   --show <the saved file>`, then copy his ticks ("The week's ticks" in
   `make-piece`; Monday's two Record ticks are in its store already, written
   on 12 October from his words "the two Monday videos are now in Inbox").
   The waiting list: `python3 scripts/engine.py GET /api/workbench --full`
   (items `wed-muse-calls`, `friday-record`,
   `week-publish-board-2026-10-12`; his replies are in `replies`).
2. **Ask Krish, once, in the chat, the calls that are his**, with the
   board link (Control Center's reply box is retiring, so his answer comes
   in the chat): (a) Wednesday's headline and its go to spend (item
   `wed-muse-calls`, workroom https://claude.ai/artifact/XW7uwdEJbMybpXVh2gjJRu:
   the planned headline "The Opt-In Was Buried in the Onboarding" has no
   source; the supported story is that Muse keeps a page on people who
   never signed up, TIME, 6 October; he says "use it" or gives his own,
   and "go" for the paid draft and fact check); (b) Friday's prediction
   line (item `friday-record`: keep the dated call, by 30 September 2027
   at least two of OpenAI, Anthropic and Google pick the brain for app
   builders by default, 85%, which young readers keep getting lost at, or
   say the broader bet "the list disappears, the app picks for you" in the
   video and leave the exact call to the article; the 12 October session
   recommended the broader bet); (c) the design, once step 3 has one to
   show.
3. **Monday's story intro, audio treatment and outro card** (what stands
   between Monday and its produced videos). Run the process in
   `docs/plans/2026-10-12-story-intro-outro-brief.md`: three blind
   concepts, blind judges, one synthesis, shown to him cold. A first attempt
   was stopped unfinished when the 12 October session closed and nothing
   was kept. Put the design to him in the chat and as an `on_you` item
   (`only_you` `judgment`, `idea_id` Monday's piece, `closes_on` `video`,
   `link` the design). Settle with it, because they decide how the cuts can
   be made: the music track and its levels (the only track in
   `config/music-library.json`, NO CURVES, and the levels are both still
   proposed; `scripts/quick-edit/music.py` records his approval), and the
   90-second cap (Monday's short take is 95 seconds of speech before any
   intro or outro; `produce-video` says tighten only where he stumbled,
   never speed up, and tell him both numbers). Record nothing as approved
   without his own words.
4. **After his approval: build it, then the home computer makes the
   videos.** Record his words in `config/story-intro-outro.json`. Then build
   it in this repository: the story intro and outro as Remotion
   compositions in `apps/renderer`, an approve step that stores his words
   with a hash of the source he saw (as `scripts/quick-edit/intro.py` does
   for the sting; note the sting's own compositions are not registered in
   the renderer yet either, `intro.py status`), `make.py` reading the
   config so a cut gets them, `produce-video` updated, and tests. Commit, merge to main and deploy
   only with his go in that session (a home computer pulls main). Then
   Krish starts Codex on a home computer with "produce Monday's video"
   (`produce-video`); a cloud session cannot render (`docs/ENGINE_SESSION.md`).
   Codex records the cuts (`making.py --by Codex <piece> video ...`). Then a
   Claude Code session puts the cuts and their thumbnails on Monday's
   publish page (https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS),
   republishes it to its link, rebuilds the board and republishes it to its
   link (command below). Monday is 100% when he has posted the standing
   five; that part is his.
5. **Friday, on his answer.** Rewrite `docs/plans/2026-10-09-draft-script.md`
   and `-90s.md`; `story_check.py --cut long|short --series mind_the_gap`
   until ready; two fresh readers (the prompts in `make-piece`, "The
   Scripts step") until both find nothing that loses them; `making.py
   <piece> scripts long.md short.md`; then `making.py <piece> read-back long`
   and `short` with the readers' answers; then `teleprompter_send.py plan`
   and `update_script` in place (folder
   DD28154B-B6D1-47DB-803A-79410D83196D; 3-minute script
   185F739E-733F-43B9-B5B2-66846CB5EC44, 90-second
   1165370C-68A6-444E-88D5-A326A131E58C) and the record lines it prints.
   Then Friday's page (https://claude.ai/artifact/SHPLKcPPVDkg3j4Yy7vUVV)
   and the board. With the post's working folder at hand, rebuild the page
   with `publish_manager.py`; without it (a cloud session), edit it as the
   12 October session did: the scripts are the `<pre class="txt"
   id="c13">` (3-minute) and `id="c14"` (90-second) blocks, the words
   HTML-escaped in both `data-raw` and the text, checked to round-trip, and
   the chip "Waiting: your call on the prediction line, then recording"
   replaced.
6. **Wednesday, on his answer.** Its routine session
   (session_01FzzvZdb6pALs4La91JrMJb, https://claude.ai/code/session_01FzzvZdb6pALs4La91JrMJb)
   finished the Workroom and stopped at 16:56 UTC, waiting on him; its
   notes are its entry under "Latest handoff". On his words, either carry
   Wednesday on in this session (`make-piece`: draft, fact gate, visual
   gate, scripts with the under.the.hood line, read-back, Teleprompter,
   publish page, board) or fire the "Make a piece" routine
   (trig_01BNH3a98CuVV9sGW9b56DNJ) with `piece_id:
   7554ed4a-560b-4365-b266-ea72abeed7ef`, quoting his words in the fire
   text. Never both.
7. **Read-backs already behind us.** No cut, Monday's or Friday's, has a
   two-reader pass on record, whatever the 16:45 entry below says ("each
   cut passed `story_check.py` and two fresh 12-year-old readers": they
   passed `story_check.py`; the strict readers still lost the thread in
   places). Monday's takes are recorded, so leave Monday's words alone and
   record no pass for them; Friday's get theirs in step 5.
8. **Only Krish can**: attach the Teleprompter connector to both routines
   ("Plan the week" trig_016PWevC6fzViu6mHpKSAbHM and "Make a piece"
   trig_01BNH3a98CuVV9sGW9b56DNJ) and remove Descript from them, in
   claude.ai; until he does, a routine session stops at the Teleprompter
   send and says so. Still open with him: the second sting design
   (https://claude.ai/artifact/FnDVNoCk1CqxGKTHRYENKH, which the story
   intro may absorb; step 3), and Library Sync on the backup computer.

What a session may do without asking, and what needs his go in that
session (`AGENTS.md`, "Authority"): his standing words cover the
Teleprompter send (on the terms above), and the making work `make-piece`
gives Claude covers republishing his private day pages and the week's
board to their own links, making-record lines and board items. A paid
draft or fact check, a merge or deploy, and anything that sends, posts,
spends, deletes or changes a permission needs his words immediately
before it.

Rebuild the board with every made day's current page (each saved with an
`Artifact` read), the board as last read as `--previous`, then republish it
to its own link, never as a new artifact (the store, with every tick, stays
with the page). In a cloud session `CLAUDE_CODE_REMOTE=1` lets the engine
reads through with the environment's key (`scripts/engine.py`); on a home
computer leave it off:

    CLAUDE_CODE_REMOTE=1 python3 scripts/post-pack/week_board.py --week 2026-10-12 --live \
      --previous <the board as Artifact read saved it> \
      --day mon=<Monday's page> --day fri=<Friday's page> [--day wed=<Wednesday's page>] \
      --out .cache/week-board/2026-10-12/week-board.html

With `--live` each day's piece and each cut's Teleprompter script come from
the engine, so `--piece` and `--teleprompter` are not needed (the second
takes a file when used). Check the built page for each day's current
opening line before publishing.

## The board: what is waiting on Krish, in progress and done

The live list lives in the shared database, not in this file. What is
waiting on Krish is his one list on Control Center's Home
(https://controlcenter.krishraja.com/#/home?waiting=1), where he clears, bumps
or purges it; that is the link to give him. The whole board, in progress and
done too, is a log at https://controlcenter.krishraja.com/#/board. Every
session, in Claude Code or Codex, reads and writes it through the engine:

- Read it: `python3 scripts/engine.py GET /api/workbench --full` (`python` on
  Windows).
- Add or change items (up to 50 at once; an existing item changes only the
  fields you send):
  `python3 scripts/engine.py POST /api/workbench @items.json` with
  `{"action": "upsert_items", "client": "codex", "items": [{"id": "p3-record", "lane": "on_you", "rank": 2, "area": "Article 3", "title": "Record both cuts from the scripts", "detail": "...", "only_you": "face", "link": "https://...", "link_label": "Open the scripts", "idea_id": "<the piece's uuid>", "closes_on": "record"}]}`.
  Lanes: `on_you`, `in_progress`, `done`, `archived` (hidden). Ids are
  lowercase words joined by hyphens. Links must start with `https://`.
- Change the headline or the status lights: `{"action": "set_state",
  "headline": "...", "signals": [{"label": "Home computer", "state": "ok",
  "text": "On and ready"}]}` (state is `ok`, `warn`, `bad` or empty).
- **Replies are retired; his words about an item arrive as its `said`
  notes.** Control Center has no reply box any more. What he says about a
  board item comes in through Control Center's one door, and its filer keeps
  it as a note on that item. `GET /api/workbench` returns them on each open
  item as `said: [{ "part_id", "excerpt", "at" }]`, newest first, at most
  10 (a purged note is gone; `said_read: "failed"` means they could not be
  read, and the board still loads). Read an item's `said` notes before you
  work it, and act on them. Never answer them: they are his words to the
  system, not a question to you. Never leave an item waiting for his words:
  an item on him ends when it closes itself or when he clears, bumps or
  purges it on his list, and a question only his words answer is asked in
  your reply to him. The engine
  refuses the reply action (`410 replies_retired`) and an item with a
  `"prompt"` (`400 prompt_retired`; `"prompt": null` clears an old one).
  The replies he wrote before stay in `replies` (`unseen_replies` counts the ones no
  session has acted on; `{"action": "mark_seen", "ids": ["<reply id>"],
  "client": "codex"}` after you act on one). The engine key can never write
  one: a session must never put words in his mouth.

Set `"client"` to `"codex"` or `"claude_code"` so the board says who changed it.
Write every item in plain words: what happened, what it means for him, and what
you need from him.

**Every item says how it ends. Record the fact; the check closes it. Close
only items you hold (`closes_on` `session`).** Krish, 2026-10-11: "I am
happy to Clear(complete)/Bump/Purge things off my lists as I go but the rest
should be automatically done." Step 4 of his operating system is one
done-check sweep in Control Center (`api/_doneChecks.ts`) that ends every
item by its kind. The kinds (`closes_on`), with what each needs:

- a making step (`workroom`, `draft`, `visual_gate`, `scripts`, `pack`,
  `record`, `video`, `publish`) or `published`: the piece's `idea_id`;
- `week_planned`: the week's planning item alone (`week-<its Monday>`);
- `week_published`: the week's publish board alone
  (`week-publish-board-<its Monday>`); the sweep closes it once every
  picked day is at 100% on the record, so no session moves it to done;
- `share_image_changed`: `"close_ref": {"url": "<the post>", "was": "<the
  file id of the share image it shows now>"}`;
- `job_ok`: `"close_ref": {"job": "<the job>", "after": "<a time a clean
  run must be newer than>", "probe": "dry"}`;
- `post_matched` (the watcher's `post-<id>`, with `"close_ref": {"url"}`)
  and `take_placed` (the recordings lane's `take-<sha12>`): machine
  questions, held for a session, never on him;
- `session`: work you hold; you close it, or the sweep lets it go after 7
  untouched days;
- `his_word`: nothing can see it done, so only his Clear ends it, and only
  he puts one on his list (his cookie, his words relayed, or Control
  Center); an agent gets `409 his_word_is_his`.

The engine refuses, by name: an open item, new or edited, from anyone, with
no kind (`400 open_needs_closes_on`); a session closing an item that is not
its own work, that is anything but `closes_on` `session` (`409
check_closes_it`: record the fact and leave it); a session turning an open
item that closes on a check's kind into `session` work, relayed or not,
which would let it close the item next (`409 kind_is_the_checks`; a close
Krish made is relayed as the close itself); a session reopening an item
a check closed (`409 check_closed_it`; only Krish does, by his Undo or his
words relayed); a kind on an open item without what it needs
(`400 close_ref_invalid`); an item whose piece step it can already see done
(`409 already_done`: nothing waits); a close or reopen relayed with
`decided_by: 'Krish'` without his exact words in `"said"` (12 to 287
characters; `400 relayed_close_needs_his_words`), which are kept on the item
as `closed_proof`; and a `closed_proof` from anyone but the sweep (`400
closed_proof_is_the_checks`). The sweep writes as client `done_check`, one
item a call (`400 done_check_one_item`): it only closes an open item that
says how it ends and is not `his_word`, with its proof, recorded as `check:
<kind>` (`409 done_check_only_closes` otherwise, and when another writer
closed it first). A database refusal names its
constraint (`board_write_failed`, `code`, `constraint`). The database holds
the same rules: every open item says how it ends
(`work_board_items_open_says_how_it_ends`), and a trigger
(`only_a_check_or_krish_closes`) lets only Krish, a check with its proof, or
a session on its own work move an item to done or archived. Nothing else in
the engine closes an item (`scripts/check-one-close.ts`, in `npm run
verify`): the making route, the publish watcher, the recordings lane, the
purge and the midday run record what happened, and the sweep closes.

**An item about a piece names the piece, so it closes itself** (Krish,
2026-10-11: items "should really be chalked off automatically when we are
done with a publish flow"). Give it `"idea_id": "<the piece's uuid>"` and
`"closes_on"`: a making step (`workroom`, `draft`, `visual_gate`, `scripts`,
`pack`, `record`, `video`, `publish`) or `published`. Control Center's
done-check sweep closes it once that step is on the piece's making record,
closes every item tied to a piece once its publish step is done (the
standing five ticked: Substack, YouTube, Shorts, TikTok and Instagram;
Krish, 2026-10-11), and lets them go when the piece is dropped, absorbed or
buried. A making write asks the sweep to look at the piece's items at once
(`apps/control-plane/api/_controlCenter.ts`), so an item leaves within
seconds; otherwise the sweep looks every 15 minutes. The Substack post alone
ends only the items whose `closes_on` is `published`, so use `published`
only for an item about the Substack post itself; an item about the reposts
uses `publish`. A piece made before the making record existed (no step a
session wrote, at most the watcher's Substack tick) still ends everything on
the Substack post. The publish watcher (`/api/publish/watch`, hourly) learns
a piece is published from the publication's own archive, so Krish never has
to say so; a post whose title matches no piece becomes one item in progress
for a session (`post_matched`), which closes itself once the post is
recorded on its piece (`making.py <piece id> posted substack <link>`) and
the watcher matches it. A machine question with no piece to end it (an
unmatched post, `post-<id>`, or a take with no piece, `take-<sha12>`) that
no session touches for a week is let go by the sweep. A session that hears
from Krish that something is done relays his words (`decided_by: 'Krish'`
and `"said"`); a session closes by itself only its own work. Never leave an
`in_progress` item behind you: when you stop, it is closed (your own work),
handed on with a kind that says how it ends, or back on him.

**An item waiting on him is ready for his list, or it is not written**
(Krish, 2026-10-11: one list, holding only what he alone can do, what is
prepared, and what says how it closes itself; and "you are just capping
the garbage. Surely we need to not have garbage."). Give every `on_you` item
all three:

- `"only_you"`, why only he can do it: `send`, `post`, `spend`, `delete`,
  `permission`, `credential`, `face` (his face and voice), `login` or
  `judgment` (his call).
- `"link"`, an `https://` link to the prepared thing he acts on (the script,
  the draft, the page), with a short `"link_label"` for its button. A typed
  answer is not a link.
- `"closes_on"` with what its kind needs (above): a piece's step with the
  piece's `"idea_id"`, so the sweep closes it when that step lands; the
  week's planning item (`week-<its Monday>`) with `"week_planned"`, which
  Control Center closes once every day has a piece; the week's publish board
  with `"week_published"`; `"share_image_changed"` or `"job_ok"` with their
  `close_ref`; or `"his_word"`, which only he puts there. Never `session`,
  `post_matched` or `take_placed`. A `judgment` item needs one of these
  closes too.

The engine refuses an `on_you` write that lacks any of them, checked with
what the item already holds, so a partial edit of an item on him counts too
(`lane_if_new` is held to it for a new item): `400` with `on_you_needs_only_you`,
`on_you_needs_link`, `on_you_needs_closes_on`, `on_you_needs_idea_id` or
`on_you_needs_close_ref`, and a
`detail` naming the values allowed. Keep such an item `in_progress` until it
has them. A job only he can do that nothing can see finished (a login, a key
only he can change, an email only he can send) gets a check kind when one can
see it (`share_image_changed`, `job_ok`), else stays `in_progress` with
`session` until he says, in your reply, that it goes on his list as
`his_word`. The database holds the same rule
(`work_board_items_on_you_is_ready`, migration `20261013093000`, rewritten
per kind by `20261022091000`), the
week's close on the week's item alone included: when it is applied, every
item on him that fails it moves to `in_progress`, its detail starting "Held
from your list on <date>: it" and the gates it fails in Control Center's
own words ("does not need you", "is not ready for one press", "does not say
how it closes itself"). The engine's own tools never put a question on him:
nothing he can press answers which take a recording is, or which piece a
post is, so the recordings lane and the publish watcher hold those in
progress for a session, which asks him in its reply. The sweep closes a
take's once the take is on a piece, and lets one go once the lane notes no
waiting piece can be it (`"close_ref": {"no_piece": true}`); it closes a
post's once a piece holds the post; and it lets either go after a week
untouched (above).
`bumped_until` is written by his Bump; leave it alone.

**An item Krish closed himself stays closed** (his Clear or Purge in Control
Center, or a close you relay from his words with `decided_by: 'Krish'`). The
engine key cannot move it back to `on_you` or `in_progress`: the write is
refused with `409 krish_closed_it`. The board keeps who closed an item in
`closed_by`, so your later edits to it (a line in its detail, done to
archived) do not change that. If something new needs him, write a new item.

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

Claude Code works from the same rules and skills as Codex. `CLAUDE.md` imports `AGENTS.md`
and adds only what is particular to Claude Code: which doc to read for which task, the
models (Opus, with `repo-scout`, `executor` and `reviewer` subagents in `.claude/agents/`), the
hooks that refuse secrets and North Star edits and put every publish, send or taste-rule edit to
Krish in person (`.claude/hooks/`), and the checks. To find code, search `docs/REPO_MAP.md`
(`npm run repo-map` keeps it current) rather than opening files. `docs/ENGINE_SESSION.md`,
"Running from Claude Code", has the session loop. The handover for the job that set this up is
`docs/handovers/2026-10-19-claude-code-parity.md`.

Krish starts a session by pasting this:

> Continue the Mindmake content engine. Read AGENTS.md and WORKBENCH.md, then
> read the board. Tell me in plain words what is waiting on me and what you
> will do next, then do the top thing that is not waiting on me. Update the
> board and WORKBENCH.md before you stop, and end every reply with the link to
> my list.

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
which step failed. The lane has run on both machines since 2026-10-06
(`scripts/post-pack/README.md`, "Recordings: from the Inbox to a cloud
session"). Which take is which piece and cut needs no file name:
`python3 scripts/post-pack/recording_match.py` works it out from his opening
words, and the `produce-video` skill takes it from there. The home computers
also place each take on its piece and cut by themselves at the end of every
pass, and a take already on a piece is fetched by the path its record holds
(`recording.py get "recordings/<sha256>.<ext>"`). This is the one way a take
comes back: Teleprompter holds his scripts only, and Descript, which was to
bring takes back, was retired on 12 October.

## Latest handoff

- 2026-10-24: **Wednesday's production outcome failed.** Krish reports that he published only the horizontal long video, later noticed random small cuts and chopped words in it, and scrapped the vertical video and article. The defect is reported, not independently located or attributed. His latest decision supersedes the earlier “Both approved” playback and the 23 October “board ready” handoff. `docs/plans/2026-10-21-wednesday/FAILURE_REPORT_2026-10-24.md` documents the observed failures, limits of the old checks, Claude/Codex execution differences and exact corrective owners. The report is a handoff for Claude, not a restart order. No live public-platform or private-board readback was done in this report session. **Next:** reconcile the making record and private board to published-long-with-reported-defect / withdrawn-short-and-article; preserve history; compare the exact public upload with the accepted export before attributing the defect; do not alter the public cut or publish anything else without Krish's instruction.

- Older handoffs (12 to 23 October): `docs/history/2026-10-18-WORKBENCH-handoffs.md`. This section holds only the newest one: when you write a new handoff, move the one it replaces to the top of that file (G11, `scripts/check_workbench.py`).

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

Measured again over the 7 days to 2026-10-15 (`meter_daily`, provider
anthropic): $45.51 in all. The fact gate was $21.39 of it (4,367 calls:
on-file $11.99, second look $4.21, extract $3.30, entail $1.89): 59 paid runs
on 13 and 14 October, mostly run, fix one number, run again. (Unchanged
sentences already keep their verdict: carryForward, walk log F52.) Since
2026-10-15 the free GET of the fact check returns `precheck`, and
`engine.py` refuses a paid run while any stated number is on no filed source
(`--despite-precheck` overrides); the gate's own checks are unchanged. The AEO probe (AEO-Engine on GitHub Actions, about 96 web-search probes) was
$9.87; it now runs fortnightly (odd ISO weeks, next 25 October; AEO-Engine
`6041cb5`). The editorial radars were $3.48, and the eight timer judges
were about $3. This chat-side work runs on Krish's plan, not on API credits.
Krish (2026-10-15) asked for "optimizations we can make".

18 October, Friday's article: four fact-check runs cost $4.07 (about $1 a run once 62 sources were filed),
against an estimate of about 20 cents for the last one. Two causes, for the cost audit: the on-file check sends
the whole source set with every claim, so filing more sources makes every check dearer; and the second look
re-reads every leftover sentence on every run, with nothing carried. Estimate a rerun from the meter's last
run, never from the count of fresh sentences.

Plan usage (the sessions themselves), 18 October: `docs/COST_AUDIT_2026-10-18.md`. One six-day session read
1,086M tokens because every step re-reads a context that sat at a median of 459k; the fix is one fresh session per job.

Cost guards, 18 October (`docs/COST_GUARDS.md`): G1–G8 and G11 built on branch `claude/token-efficiency-content-dfb8q7`
(context ceiling, budget against the meter, rerun ceiling, second look carried, no board reads, agent gate, quiet
scripts, Sonnet for produce-video, a lean workbench). Phase 2, the same day, merged to main with the rest: G12
(Perplexity and OpenAI metered; each fact-check run's calls stamped with piece and run), G9 is main's (996544a, kept: `{action:'sign_off', decided_by:'Krish', lines:[{sentence, said}]}`; this branch's
stricter version, which refused a contradicted line, was withdrawn before the merge) and G14 (make-piece and produce-video split into a core plus
`references/`, checked by `scripts/check_skill_core.py`). Done 18 October on his answers: the
`meter_events` migration is applied (read back); G13 dropped, the nightly sweep stays; G9 now refuses a contradicted
line; the cost gate has no context ceiling and never blocks a database tool. Waiting on Krish: (1) three sign-offs on
piece `904658db` made before the G9 ruling are on contradicted lines, left as they are until he says; (2) the first real fact-check run after this
(his approval for the spend) is the live proof: `fact-gate-on-file` cache writes about one source set a run.
