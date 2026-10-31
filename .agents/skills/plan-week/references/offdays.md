# The Off days options

Reference for the `plan-week` skill, read at step 3c (`.agents/skills/plan-week/SKILL.md`). Moved out of the core unchanged on 29 October 2026 so a session starts lean (`docs/COST_GUARDS.md`, G14); the gates stay named in the core.

**The Off days options** (Krish, 2026-10-28: "I'm happy to plan the
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
automatically; until it does, the room drafts the options. Write them
into ideas.json as `offdays`, `{"tue": [...], "thu": [...], "sat": [...],
"sun": [...]}`, each with its `format`, `source` and `copy`. They reach
the tab only through `week_board.py --ideas`, never by patching the page,
and only once the board has its Off days part (it lands with the board's
own change); until then `week_board.py` does not show them, so say so in
one line in the triage readback (step 8). His one press approves or skips
each (`queue/<idea_id>` with `use: offday`, its `day` and `approved`);
Growth makes and schedules what he approved, and this repository cuts any
snackable clip.

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

