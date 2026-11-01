# The Off days options

Reference for the `plan-week` skill, read at step 3c (`.agents/skills/plan-week/SKILL.md`). Moved out of the core unchanged on 29 October 2026 so a session starts lean (`docs/COST_GUARDS.md`, G14); the gates stay named in the core.

**The Off days options** (Krish, 2026-10-28: "I'm happy to plan the
Tuesday, Thursday, Saturday, and Sunday content within the Sunday ideas
session if you give me a few options to approve as you do the
Mon/wed/fri"). Since 1 November 2026 they are judged like Monday, Wednesday
and Friday (Ruling, Krish, 2026-11-01, locking
`docs/handovers/board-mocks-2026-11-01-offdays/`: "Mock looks right, lock it
and build it"; he had asked for "Ideas and a suggested creative direction to
approve or improve or flat out reject for a reason, and the machine can learn
over time").

On the Ideas tab, 4 to 6 options each for Tuesday, Thursday, Saturday and
Sunday (the board takes 2 to 6), for the Make Your Mind Up Instagram, TikTok
and YouTube Shorts channels (Shorts takes video only, so a carousel goes
there as a short slideshow). Each is one of four formats: a meme made fresh
from a cue, in the makeyourmindup brand kit (a borrowed format is credited;
someone else's image or clip is never reposted); an uplifting AI news
carousel, every claim naming its primary source and dated within 7 days of
its day, each checked against that source the same day and through the fact
gate before it is made; one level-up move, a single practical way to get more
from AI; or a snackable cut from a past week's approved master, named by its
piece and word range. Mix them across the week: no day all one format, and at
least two days feeding that week's Monday, Wednesday or Friday piece.

**Where the ideas come from.** Add no source: there are many already (Krish,
2026-11-01: "there are so many sources of inspiration by now throughout the
engines"). Use what `board_feed.py gather` wrote to `sources.json`:
`inspiration` (his routed and liked cards, Content Inspo and Production Inspo,
creator moves; a card he routed to an off-day post comes first), the week's
three pieces (an off-day option that sets one up or carries it on), `cues`,
`must_cover` (`his_idea` and links saved with his words, below), and
`offday_verdicts`, his Approve, Improve and Reject on the last eight weeks'
off-day options, his words verbatim. Follow every Improve note; never offer
again what a Reject reason rules out; make more of what he approved.

**Each option** goes into ideas.json `offdays`, `{"tue": [...], "thu":
[...], "sat": [...], "sun": [...]}`:

```json
{"id": "prices", "format": "Carousel, 4 cards", "source": {"label": "Content Inspo", "url": "https://..."},
 "copy": "<two plain sentences: what it is and why it lands>",
 "hook": "<the headline he reads first, one line>",
 "pitch": {"see": "<what you see or hear>", "lands": "<why it is funny or useful>", "why_now": "<the dated reason, if any>", "share": "<the one line people send on>"},
 "cards": [{"words": "...", "picture": "..."}],
 "inspiration": {"label": "<the saved post it borrows from, as he would name it>", "url": "https://...", "saved": "Saved 29 Oct"},
 "learned_from": ["<his words that shaped it, quoted, with their date>"],
 "ties_to": "Mon: follow.the.money",
 "recommended": true,
 "direction": {"look": "<the look, named after the saved post it borrows>", "format": "4 cards, 4:5",
               "frames": [{"words": "<on the card>", "picture": "<what it shows>"}],
               "tone": "<one line>", "kit": "<the brand-kit pieces it uses>", "inspo_url": "https://..."},
 "covers": ["<must_cover id>"]}
```

`hook`, `pitch` and `direction` are what he judges, so every option has them;
`learned_from` quotes only his own words from `offday_verdicts` or `cues`,
never a paraphrase, and is left out when none applies. One option a day is
`recommended`. The copy and every line of the direction pass `python3
scripts/post-pack/copy_lint.py --applies-to channel_copy` (and `--applies-to
carousel_text` for a carousel) and `node
vendor/makeyourmindup/kill-list/kill-list.mjs` before they reach the tab.
They reach the tab only through `week_board.py --ideas`, never by patching
the page; `week_board.py` refuses a wrong shape and names it.

**His presses.** On each option he presses the idea, the direction and, once
Growth returns it, the mock: Approve, Improve (his words) or Reject (his
reason); the idea also takes Next week. They are saved in
`queue/off-<day>-<option>`, each side `{verdict, words, sha256}`, bound to
what that side showed him. His Improve and Reject words go to his taste ledger
by themselves (`api/board/_presses.ts`, `offdayReports`) and come back next
Sunday in `offday_verdicts`. An Improve also starts one revision run
(`.github/workflows/offday-revise.yml`, below). Growth reads each option whose
idea and direction he approved (`GET /api/board/<Monday>/pieces`, `offdays`),
makes the mock in the brand kit from the direction exactly as shown, and
returns it on the option as `mock` for his final yes; this repository cuts any
snackable clip.

**Revising one option** (the revision run, or a session asked to). Read his
words on that side from the option's record (`python3
scripts/post-pack/board_web.py read <Monday> queue`, the document
`off-<day>-<option>`, only if `updated_by` is Krish). Change only that side of
that one option in `docs/plans/<Monday>-week/ideas.json` `offdays` to answer
his words, keep its `id`, and set `"revised": {"side": "<idea, direction or
mock>", "words": "<his words, verbatim>"}`. A revised mock is Growth's to
remake, so for the mock side change nothing and say so. Run the same checks as
above, then rebuild and publish the board with the same inputs as the last
build (step 7). The side's hash changes with its words, so his old press reads
as answered and he judges the new card.

**An off-day piece he records** (Ruling, Krish, 2026-10-29: an idea he drops in
"should appear on my Sunday board for either Tuesday, Thursday, Saturday, or
Sunday publish, and queue the script up in teleprompter for me and pick up the
recording in my inbox"; asked what he records: "could be a short with motion
designed subtitles and branding, or voiceover with motion designed
infographics"). This is the fifth kind of option, and the one his own ideas
take. Every idea he dropped in through Control Center is in `sources.json`
`must_cover` (`kind: his_idea`, its id the idea's own row). Unless his words
name Monday, Wednesday or Friday, offer it as a recorded option on the off day
it fits best, ranked first that day. It is one short cut, nothing else:

1. Write the script from his words: 160 to 195 spoken words (it finishes under
   89 seconds), opening on a question, for the ear, a 12-year-old can follow
   it, never his name, and closing on the one thing he would do, in his first
   person and one short beat, never a list of orders (house rule SCRIPT_CLOSE,
   2026-10-31). There is no article, so
   it never says "The full deep dive is at makeyourmindup.ai.".
2. Check it: `python3 scripts/post-pack/story_check.py --cut short <file>`
   (every finding but the article close must be fixed), the copy lint and
   the kill list as above.
3. Have two fresh readers (separate subagents, no access to your reasoning,
   each an ordinary 12-year-old hearing it once) read exactly those words.
   Only "nothing lost" from both lets it on the board.
4. Write it into `offdays` as
   `{"id": "mine", "kind": "recorded", "format": "Said to camera" or "Voiceover with motion graphics", "style": "to_camera" or "voiceover", "series": "<the subchannel slug it belongs to>", "piece_id": "<his idea's id>", "covers": ["<his idea's id>"], "title": "<its subject, one line>", "source": "Your idea, dropped in <date>", "copy": "<two plain sentences: what it says and why it lands>", "script": "<the exact words>", "read_back": {"readers": ["<reader 1>", "<reader 2>"], "found": "nothing lost"}}`.
   Pick the style from the idea: to camera when it is his take or story, a
   voiceover when the point is a mechanism or numbers a picture shows better.

`week_board.py` refuses a recorded option that fails any of this. On the card
he sees the whole script. His Approve puts the piece on that day in its
series and the server sends those exact words to Teleprompter in the piece's
folder (`apps/control-plane/api/board/_presses.ts`, `offdayRecorded`); the
card then says whether it went. The recordings lane places his take on the
piece by its words or its Teleprompter name, the short cut alone
(`recording_match.py`, `making.py one_cut`), and `produce-video` cuts the one
9:16 short in the style he approved. A Skip leaves the idea for another week
(and takes back an earlier Approve unless he has recorded it).

**A link he saved with his own words** is owed a place too (`must_cover`,
"Inspiration card ... you saved with your words", his words in `his_words` and
on the card as `saved_why`). When his words ask for a meme or another off-day
format ("We should reskin this as a hilarious video meme for when your AI
talks to your customer's AI.", 29 October), offer it on an off day in that
format, its `covers` holding the card's id: a meme is made fresh in the brand
kit from the format he pointed at, credited, and never reposts the clip itself.

