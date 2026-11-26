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

**Every off-day option names its kind** (Ruling, Krish, 2026-11-13: the publish board shows only what he approved,
in one week model, three pieces and off-day posts of fixed kinds; his words: "In general, we have carousels that
support Monday, Wednesday, or Friday. We have voiceovers, explainers, uplifting carousels, and memes."). Write
`"kind"` on each option, one of the five, and the board says its plain name everywhere he reads it
(`apps/control-plane/api/board/_weekModel.ts`, `OFFDAY_KINDS`):

| `kind` | Its name on the board | What it is |
|---|---|---|
| `supporting` (with `"supports": "mon"`, `"wed"` or `"fri"`) | Carousel for Monday's piece | A carousel that carries that day's piece further |
| `voiceover` | Voiceover short | A short with his voice over motion graphics or footage. A piece he records keeps `"kind": "recorded"` (below) and reads as a Voiceover short |
| `explainer` | Explainer | An explainer carousel or infographic that stands on its own |
| `good_news` | Good news | Saturday's uplifting good news: four stories, a fifth a spare only (below) |
| `meme` | Meme | A meme, a meme carousel or a meme video; from the 30 Nov board also a meme template (below, and `references/meme-roaster.md`) |

An older plan with no `kind` is read from its format by one rule (`offdayKind`); a quiz or level-up carousel is a
supporting carousel when it ties to a publishing day and an explainer when it does not. A suggestion that is none of
the five is not offered.

On the Ideas tab, at least 5 options each for Tuesday, Thursday and Saturday from the 23 Nov board, from different
sources (the Instagram sheet, the web, his cards) and spanning at least two aims (Krish, 2026-11-16: "There's not
enough quality and breadth of ideas flowing through to this week's or next week's boards"; `board_feed.py gate`,
code `aim`); 4 to 6 before it (the board takes 2 to 6; Sunday is a rest day and nothing is published on it:
Ruling, Krish, 2026-11-02, "Let's eliminate Sunday from Publishing anythign
permanently. Sunday is rest and planning and ideation day."), for the Make Your Mind Up Instagram, TikTok
and YouTube Shorts channels (Shorts takes video only, so a carousel goes
there as a short slideshow). Each is one of four formats: a meme made fresh
from a cue, to the carousel standard (`docs/MEME-STANDARD.md`: the same type, palette and picture quality as a carousel
card; a borrowed format is credited; someone else's image or clip is never reposted, except a meme template's clip,
below); a good news
carousel of the reader's industries (below), every claim naming its primary source and dated within 7 days of
its day, each checked against that source the same day and through the fact
gate before it is made; one level-up move, a single practical way to get more
from AI; or a snackable cut from a past week's approved master, named by its
piece and word range. Mix them across the week: no day all one format, and at
least two days feeding that week's Monday, Wednesday or Friday piece.

How each is made once he approves it is not this skill's job, and it is one
route (Rulings, Krish, 2026-11-13: "all the carousels should now be done in
Claude, but using the Codex plug in as per the other usual workflows";
"memes and Notes images should go the same way"; "Off-day voiceover shorts
should go the same way too"): a carousel, a meme or a Notes image is made in
a Claude session, with the Codex plugin building it
(`docs/CAROUSEL-STANDARD.md`, "How a carousel is made"), and a voiceover
short or a meme video on the ve route from a Claude session. The board's
"Copy prompt for Claude" says so on every approved off-day post. The plan
only proposes; never a scheduled job, a headless model run or a template
engine makes one.

**Where the ideas come from.** Add no source: there are many already (Krish,
2026-11-01: "there are so many sources of inspiration by now throughout the
engines"). Use what `board_feed.py gather` wrote to `sources.json`:
`inspiration` (his routed and liked cards, Content Inspo and Production Inspo,
creator moves; a card he routed to an off-day post comes first), the week's
three pieces (an off-day option that sets one up or carries it on), `cues`,
`must_cover` (`his_idea` and links saved with his words, below), and
`offday_verdicts`, his Approve, Improve and Reject on the last eight weeks'
off-day options, his words verbatim. Follow every Improve note; never offer
an option he rejected again; weigh each Reject reason as a cue (it becomes a
standing rule only when he approves one); make more of what he approved.

**Where an option's day lives once he presses** (Ruling, Krish, 2026-11-12: any off-day post or idea moves to any
day at his press, and the move updates every place that names its day). The day you put an option under in ideas.json
is the plan's starting point only. The moment he approves it, moves it (Move to…, any day from today through four
weeks) or files it for later, its row in the engine's `offday_items` is the one place its day lives, and nothing you
write in ideas.json moves it again (`docs/PUBLISH_BOARDS.md`, "Moving an off-day item to any day"). Never re-date an
option by editing ideas.json; never place one anywhere: only his press does. Growth's own options reach the board
through `POST /api/board/<Monday>/offdays`, never through this file.

**Each option** goes into ideas.json `offdays`, `{"tue": [...], "thu":
[...], "sat": [...]}`:

```json
{"id": "prices", "format": "Carousel, 4 cards", "source": {"label": "Content Inspo", "url": "https://..."},
 "copy": "<two plain sentences: what it is and why it lands>",
 "hook": "<the headline he reads first, one line>",
 "pitch": {"see": "<what you see or hear>", "lands": "<why it is funny or useful>", "why_now": "<the dated reason, if any>", "share": "<the one line people send on>"},
 "shape": "story", "dive": "<the mechanism to dive into, one sentence>", "aim": "humour",
 "funny": "<its humorous angle, one plain line>",
 "lookalike": {"pattern": "<a pattern id in lookalike.json>", "beats": "<the feed post URL it is similar to, better than or adapted from>", "our_take": "<one line: what we say that the post did not>"},
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

**Its shape, aim and humour, from the 23 Nov board** (Krish, 2026-11-16: "Everything should be tinged with a humorous
angle, all scripts for pieces and all suggestions for off days."). Every option carries `shape` (`"theme"`, one topic and
at least three sourced `stories`, or `"story"`, one primary `source` and `dive`), `aim` (`"utility"`, `"interest"` or
`"humour"`; its own field, so `pitch.lands` stays the line on why it lands), `funny` (its humorous angle, one plain line)
and `lookalike` (the pattern and the feed post it beats; none for an idea of his or one he records), as
`references/lookalike.md` says. The humour lives in the angle, the headline and the narration, never in stickers,
badges or slogans on a cover (`docs/CAROUSEL-STANDARD.md`). `board_feed.py gate` refuses an option without them, and an
option that repeats a post of the last three weeks or another option on the board (one story is one option; a carousel
for a day's piece says so in `supports` or `ties_to`).

**An off-day carousel is utility, at the level of the best posts in his Instagram inspo sheet** (Krish, 2026-11-16:
"Ultimately what performs really well is what's on those Instagram info sheets. Off day Carousels should have that level
of utility: attention-grabbing headline and visual, and actual real utility."). Its `aim` is `"utility"`. Its hook is a
headline that stops the scroll, and its `pitch.see` the picture that does the same. Its cards give the reader something
they can use the same day, at the level of the sheet's best posts (the lookalike pattern it beats). The humour still rides
on top, in the angle. The weekly good news and the memes keep their own aims. `board_feed.py gate` refuses an off-day
carousel whose aim is not utility (from the 23 Nov board).

**The sheet is a source, and its card flow is the model** (Krish, 2026-11-16: "Just look at that Instagram inspo sheet
for content ideas. Look at it for the way the narrative goes from card to card. You are more than welcome to copy any
ideas but we just change the copy, we change the branding, we change the imagery, and ideally we have our own take on
the card (even if we're allowed to use the specific bit of news or idea or format)."). An option may take a sheet post's
news, idea or format outright, naming it in `lookalike.beats`. Its `cards` follow the job of each card in that
pattern's `card_flow` (lookalike.json), in our own words, on our brand and with our own pictures, and `lookalike.our_take`
says in one line what we add. Never their sentence: the gate refuses seven of their words in a row. Ours must beat the
post it draws on; a copy that is "way worse" (2 Nov) is cut.

**Fun to make, fun to consume** (Krish, 2026-11-16: "one of the main things about ALL makeyourmindup content is that it
must be fun for me to produce, and must be fun for an audience to consume."). An option he would not enjoy making, or a
reader would not enjoy reading, is cut before the tab, however useful.

**Every off day is the reader's world** (Ruling, Krish, 2026-11-26: "Make sure all the good news suggestions and meme
suggestions are also aligned to the new positioning, as well as the carousels."). The reader is the North Star line in
`config/beat.json` `reader` (his "I approve the lines", 26 Nov): people who make the calls or make the work in the
creative, arts, music, entertainment, media and sports industries, reading on what AI is doing to how their work makes
money. Every off-day suggestion is written for them, in the tone of `config/beat.json` `tone` (what AI lets makers,
performers and the businesses around them do, earn and express), and the lines in `config/beat.json` `offdays` say it for
each kind; quote them, never restate them:

- the good news: `offdays.good_news` (people in those industries doing, earning or making more with AI);
- a meme or a meme template: `offdays.meme` (studios, labels, creators, clubs, leagues, artists, performers and fans;
  never office or enterprise AI: the inbox, the spreadsheet, the meeting, the boss, the copilot at work);
- a carousel, a tip, a how-to or a short: `offdays.carousel` (a tool, a deal, a price or a move for their own work).

General AI news, office AI and enterprise productivity with no line into those industries are not offered, however funny
or useful; governance, security and breaches stay off the beat (`references/beat.md`). From the story score's board
(`config/story-score.json` `from`) `board_feed.py gate` refuses an off-day option with no focus-sector word in what it says
it is about (its title, hook, copy, pitch, topic, funny line, cards, and a template's title and why_it_works), says so when
it is office AI, refuses a good-news story outside the focus sectors, and holds the weekly good news to the avoid list
(code `off_beat`, `idea_checks.offday_beat_findings`); the story score holds the same fit floor on every off-day type.

A carousel's first `picture` (its cover) names a scene that is the story's object, place or moment, or the house robot
doing something (`config/brand-robot.json`), never a made-up robot (Ruling, Krish, 2026-11-05: "either use the branded
toy robot or are more creative than just a robot doing something"; `docs/CAROUSEL-STANDARD.md`).

**Read back before the tab, from the 9 Nov week** (Krish, 2026-11-02, of the 9 Nov off days: a Tuesday option
"already being used this week", a meme "just a copy of a post from my inspo board but way worse", and of a Thursday
pitch, "I have zero idea what this even means"). Before an option reaches the tab:

1. Two fresh readers (separate subagents, none of your reasoning, each an ordinary 12-year-old reading once) get the
   option's `hook` and `pitch.see` only, and each says in one line what the post is. A reader who cannot, or says
   something else, sends it back to be rewritten or cut. The same readers are shown every piece and off day in
   `sources.json` `recent` and `recent_offdays` (this week's and the two before) and say whether the option is one of
   them under new words; if it is, cut it.
2. An option made from one of his inspiration cards (it `covers` the card, or names the saved post in `inspiration`)
   says in `adds` what it has that the original does not: a newer dated fact, our angle, the tie to the week's piece.
   A third fresh reader sees the original and ours side by side and says whether ours adds something
   (`read_back.versus`). If not, cut it: a weaker copy of a post he saved is never offered.
3. Save it on the option: `"read_back": {"readers": ["<reader>", "<reader>"], "says": ["<one line>", "<one line>"],
   "against": <the count of recent plus recent_offdays>, "versus": "<the side-by-side verdict, inspo options only>"}`.

A **weekly series** (an option with `"weekly"`, today only the Saturday good news) recurs every week by design: its
format coming back is never a repeat, and its readers judge only whether its stories could repeat.

`board_feed.py cover` refuses an option without these, and reads the file's off-day options with
`week_plan.read_offdays`, which refuses a shape it cannot read and names it.

`hook`, `pitch` and `direction` are what he judges, so every option has them;
`learned_from` quotes only his own words from `offday_verdicts` or `cues`,
never a paraphrase. From the 23 Nov board every off-day option carries it: each option quotes the earlier verdict of his
it learned from, three words or more of his exact words in quotation marks (`board_feed.py cover` checks the quote; the
ideas quality plan, item 8). One option a day is
`recommended`. The copy and every line of the direction pass `python3
scripts/post-pack/copy_lint.py --applies-to channel_copy` (and `--applies-to
carousel_text` for a carousel) and `node
vendor/makeyourmindup/kill-list/kill-list.mjs` before they reach the tab.
They reach the live board only through `ideas.json` itself, which its view
reads (`docs/PUBLISH_BOARDS.md`); `board_feed.py cover` refuses a wrong shape
and names it, and no page is published.

**His presses.** On each option he presses the idea, the direction and, once
content-engine has made it, the mock: Approve, Improve (his words) or Reject (his
reason); the idea also takes File for later (Next week until 11 November) and
Save as a trend (his words name the trend), so every idea ends in one of the
five outcomes of the ideas gate (`docs/PUBLISH_BOARDS.md`, "The ideas gate"),
and only his Approve puts it on the publish board. Every option also has an open box for
his own words on anything (Krish, 2026-11-02: "I still need to be able to provide
actual feedback on anything in open text format"), saved exactly as typed in the
record's `note`; it may be the exact text to put on the post ("it would contain
the exact meme text to put above the meme video"), so the maker uses it word for
word and nothing paraphrases it. Only text he puts in quotation marks is used
exactly, on the picture or video; his other words are direction, never printed,
and a quote that reads as what not to say is held for him (Krish, 2026-11-02:
"only where i specifically give a quote to use - i dont want requests put
verbatim in the posts"; Growth `offday.note_parts`). They are saved in
`queue/off-<day>-<option>`, each side `{verdict, words, sha256}`, bound to
what that side showed him. His Improve and Reject words go to his taste ledger
by themselves (`apps/control-plane/api/board/_presses.ts`, `offdayReports`) and come back next
Sunday in `offday_verdicts`. An Improve on the idea or the direction also
starts a revision run (`.github/workflows/offday-revise.yml`, below), whose
revised card goes live at the board's next build. A content-engine make
session reads each option whose idea and direction he approved (`GET
/api/board/<Monday>/pieces`, `offdays`), makes the mock from the direction
exactly as shown, from the locked v5 Library by its route (`config/asset-routes.json`;
a carousel through `scripts/carousel_make.py`, `docs/CAROUSEL-STANDARD.md`, "How a
carousel is made"), writes its captions and asks the judges, and returns it on the
option as `mock` for his final yes; Growth posts it once he approves (Ruling, Krish,
2026-11-26: content-engine makes every asset, the mocks included). This
repository cuts any snackable clip.

**Revising one option** (the revision run, or a session asked to). What waits
is what `python3 scripts/post-pack/offday_pending.py
docs/plans/<Monday>-week/ideas.json <queue.json>` lists, from `python3
scripts/post-pack/board_web.py read <Monday> queue` saved as `queue.json`:
each side whose record Krish saved says improve and whose hash is still that
side's current hash. Revise only those. For each, change only that side of
that option in `docs/plans/<Monday>-week/ideas.json` `offdays` to answer his
words, keep its `id`, and set `"revised": {"side": "<idea or direction>",
"words": "<his words, verbatim>"}`. A revision stays in the reader's world ("Every off day is the reader's world", above). Run the same checks as above and check
the file reads (`board_feed.py cover <Monday>`). The side's hash
changes with its words, so his old press reads as answered and he judges the
new card when the live board next reads these ideas; a side already
revised is never revised again from the same words. The revision run does not
publish the board. A mock is content-engine's to remake from his words, by the same route.

**An off-day piece he records** (Ruling, Krish, 2026-10-29: an idea he drops in
"should appear on my Sunday board for either Tuesday, Thursday, Saturday, or
Sunday publish, and queue the script up in teleprompter for me and pick up the
recording in my inbox"; asked what he records: "could be a short with motion
designed subtitles and branding, or voiceover with motion designed
infographics"; Sunday is a rest day since 2 November, so Tuesday, Thursday or Saturday). This is the fifth kind of option, and the one his own ideas
take. Every idea he dropped in through Control Center is in `sources.json`
`must_cover` (`kind: his_idea`, its id the idea's own row). Unless his words
name Monday, Wednesday or Friday, offer it as a recorded option on the off day
it fits best, ranked first that day. It is one short cut, nothing else:

1. Write the script from his words: 160 to 210 spoken words, one story (it runs 60
   to 90 seconds as he says it, about the length of his AI music short: house rules TWO_CUTS, SHORT_CUT and
   ONE_STORY_SHORT, Ruling, Krish, 2026-11-17: "75 word script is insanely short"; the ideas gate holds it from the
   week of 23 Nov, and a week before keeps 160 to 195 words), great fun to say and to hear, its first sentence naming one
   concrete thing (ONE_CONCRETE_THING), opening on a question, for the ear, a 12-year-old can follow
   it, never his name, and closing on the one thing he would do, in his first
   person and one short beat, never a list of orders (house rule SCRIPT_CLOSE,
   2026-10-31). There is no article, so
   it never says "The full story is free at makeyourmindup.ai." (SCRIPT_CLOSE_LINE).
2. Check it: `python3 scripts/post-pack/story_check.py --cut short <file>`
   (every finding but the article close must be fixed), the copy lint and
   the kill list as above, then the hannah-fry teaching check, silently
   (`.agents/skills/hannah-fry/SKILL.md`): fix what it names before he sees the words, and never show him its verdict.
3. Have two fresh readers (separate subagents, no access to your reasoning,
   each an ordinary 12-year-old hearing it once) read exactly those words.
   Only "nothing lost" from both lets it on the board.
4. Write it into `offdays` as
   `{"id": "mine", "kind": "recorded", "format": "Said to camera" or "Voiceover with motion graphics", "style": "to_camera" or "voiceover", "series": "<the subchannel slug it belongs to>", "piece_id": "<his idea's id>", "covers": ["<his idea's id>"], "title": "<its subject, one line>", "source": "Your idea, dropped in <date>", "copy": "<two plain sentences: what it says and why it lands>", "script": "<the exact words>", "read_back": {"readers": ["<reader 1>", "<reader 2>"], "found": "nothing lost"}}`.
   Pick the style from the idea: to camera when it is his take or story, a
   voiceover when the point is a mechanism or numbers a picture shows better.

`board_feed.py cover` (`week_plan.read_offdays`) refuses a recorded option that fails any of this. On the card
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
format, its `covers` holding the card's id. A meme video he asks to reskin is a meme template (below): the original
clip, credited, his caption on top (Ruling, Krish, 2026-11-17, which overrides "a meme is made fresh in the brand kit
... never reposts the clip itself" for meme templates only). Any other meme is made fresh to `docs/MEME-STANDARD.md`.

## Saturday is carousels modelled on his sheet (Ruling, Krish, 17 November 2026)

His words, looking at Sat 21 Nov's board (a good news carousel, two 2-panel memes, "My AI agent bought 72 eggs" and "My
translator now sounds exactly as fed up as I do", and a voiceover short): "I feel like we are very much missing the
point of the Saturday suggestions. Each suggestion should be a carousel like one carousel from my Instagram Inspo sheet,
not just one story." And his answer the same day: every Saturday suggestion is a full carousel modelled on one named
carousel in his Instagram inspo sheet (the same card-by-card flow, our copy, brand and images); the weekly good news
stays the good-news carousel (four stories since 26 Nov) and also follows a sheet carousel's card flow; memes move off Saturday into their own
lane.

From the 30 Nov board (earlier boards keep their shape):

- Every Saturday option is a carousel: `kind` `good_news`, `explainer` or `supporting`. No meme, voiceover or recorded
  option goes on Saturday; a meme belongs in the meme templates lane (below), a recorded idea of his on Tuesday or
  Thursday.
- Each Saturday option but the weekly good news names the sheet carousel it is modelled on in `lookalike.beats` (a
  post URL in that week's `lookalike-input.json`, one the sheet holds as a carousel), its `lookalike.pattern` has a
  `card_flow` (`references/lookalike.md`), and its `cards` and `direction.frames` follow that card_flow card for card:
  the same count, 4 to 10 cards, each card doing that card's job in our words.
- The weekly good news follows a pattern's card_flow too (its `lookalike.pattern`): its four stories fill the middle
  cards, so the flow holds a cover, a card for each story and a close, and its cards and frames follow it one for one.

`board_feed.py gate` fails the run on a Saturday option that breaks this (code `saturday`,
`idea_checks.saturday_findings`).

## Saturday is good-news carousels of varied good news (Ruling, Krish, 19 November 2026)

His words, of Sat 28's ideas board (one hospital good news, a plain carousel, an explainer and two memes): "We also need
to significantly improve the good news suggestions. These are still all just one idea, mostly, and they're not good news
carousels. Some of them are memes that are sneaking through, and the only actual uplifting carousel is about AI in
hospital again, which is all we post about. We should find good news that's not medical stuff." And his answers the same
day: "Sat should just be good news carousels - 5 great things AI is doing for people (ideally things that make people
smarter or better or happier or more successful)." and "Can mix if no1 is implemented properly."

From the 23 Nov board, every rule a row in `config/good-news.json`:

- Saturday offers only good-news carousels (`kind` `good_news`, or the weekly series): at least three, each four great
  things AI is doing (his words said five; since 26 Nov the carousel carries four (a fifth found is a spare only, never drawn; `config/carousel-format.json` `good_news`, the Library's good-news set order: cover, four items, close)) for people in the creative, arts, music, entertainment, media and sports industries (from the story
  score's board, `config/beat.json` `offdays.good_news`). Each story says who it helps and how: `"helps": {"who": "<the people>", "how":
  "smarter" | "better" | "happier" | "more successful"}`. No meme, explainer or one-story carousel on Saturday; the
  ideas board holds one that slips through, with the reason (`_goodNews.ts`).
- A carousel may mix topics. This supersedes the one-topic rule of 13 Nov ("The Saturday carousel is supposed to be five
  good news stories on that same topic"). Where three or more of its stories share a theme (or its `topic_kind` says
  so), that theme leads it.
- No two Saturday options led by one theme or carrying one story; no lead a Saturday carried in the four weeks before.
- No medicine-led carousel while the last four Saturdays carried two medical stories; any other carousel carries at most
  one medical story. Health stories dominate search results for "AI good news", so search each focus sector on its own
  (music, film and TV, games, creators, art and design, theatre and performance, sports, media, creative tools, licensing
  and rights: `config/beat.json` `focus_sectors`) and pick the four best there, a fifth as a spare only. Each focus sector is a lead theme and a
  story `kind` of its own (`config/good-news.json` `sector_topics`), so the lead and repeat rules spread the Saturdays
  across the sectors.
- A carousel short of four stories says `stories_to_find: true`, the board's "Find the other N stories".

`board_feed.py gate` fails the run on any of these (code `goodnews`, `idea_checks.goodnews_findings`). Explainer and
supporting carousels no longer go on Saturday (his ruling of 19 Nov over the 17 Nov rule); each good-news carousel but
the weekly series still names the sheet carousel it is modelled on.

## The meme templates lane (Ruling, Krish, 17 November 2026)

His words: "why can we not create a pipeline of existing meme videos that could be good to reskin, and show me those
in here? Then I could think of a funny caption for it thats related to AI." From the 30 Nov board the Ideas tab carries
6 to 10 meme templates a week, each an existing meme video with why it fits an AI caption and 2 to 4 caption ideas,
for his own caption. They are off-day options of `kind` `meme` with a `template`, written on `offdays.tue` or
`offdays.thu`, so his presses, his note (the caption box), Move to and `offday_items` work as for any option; they never
count toward a day's five options. His caption and Approve turn one into a meme post, which he can move to any off day.
How the Sunday run finds and writes them, and what the gate checks (code `template`): `references/meme-roaster.md`.
How one is made once he approves: `docs/MEME-STANDARD.md`.

## The Saturday good news

A weekly series (Krish, 2026-11-02: "you focus on w/c 9 Nov for the Saturday weekly good news. You will need to find
the actual good news on Sunday as per the usual system so that the news items are fresh"; his Improve on the 7 Nov
good news: "I want actual news items and the content we are going to use here - embedded real world images or
videos"). Since 11 November it is found with the rest of the week's ideas, once a week (Ruling, Krish, 2026-11-11: the
ideas board fills once a week in full, Saturday's good news included; the Thursday good-news schedule is retired; his
words: "Saturday's actual real good news story ideas are presented to me"). Each week's board carries it on Saturday
as `{"id": "goodnews", "weekly": "good_news", "stories_due": "<the day the stories were found>", "stories": [...], ...}`
with the rest of an option (hook, pitch, direction, read-back). He answers it like any off-day option, with the five
outcomes; only his Approve puts it on the publish board.

**The Sunday ideas run fills it** (`.github/workflows/sunday-ideas.yml`, step 3c of the skill; by hand,
`.github/workflows/saturday-goodnews.yml` finds them again for a week, for the week `python3
scripts/saturday_goodnews.py check` names; a session can run the same steps):

0. Read his positive saves first (`sources.json` `inspiration.positive`: cards he saved as good news, his words beside
   each, the ideas quality plan, item 12): a story they point to, or one of the kind they show he likes, comes before
   anything the search finds. Then his Instagram inspo sheet (Krish, 2026-11-16: "Good news stories can come from the
   Instagram inspo as well. There's absolutely tonnes in there. We would just need to pick the right ones if the good
   news was on a specific theme"): `python3 scripts/post-pack/lookalike.py goodnews <Monday>` writes the sheet's newest
   posts to `goodnews-input.json` (never committed). Its good-news posts are candidates for step 1 (place
   `sheet`); a run of them on one theme may be the topic. A post is where a story was found, never
   its source: the story still has its primary source and its own picture (steps 1 to 3), is told in our words, never
   the post's, and says where it was found (`"found": {"label": "Your Instagram inspo sheet", "url": "<the post>"}`).
   A story found there may be up to thirty days old (his Yes, 16 Nov); one the web search finds stays within the seven
   days (step 1). The web search finds the rest.
1. **Look wide, then choose the topic** (Krish, 2026-11-16: "Something's gone wrong in where you're looking and how
   you're looking because there should be millions of good news stories. What about Reddit, YouTube, or LinkedIn?
   Given that it's business leaders, we might want some successful business stories as well. In fact successful
   business stories might be really good."). First gather at least fifteen candidates from at least three kinds of
   place: the news, Reddit, YouTube, LinkedIn, his sheet and his saved cards. Write them on the option as
   `"candidates": [{"title": "<our words>", "url", "place": "news" | "reddit" | "youtube" | "linkedin" | "sheet" |
   "card", "date": "YYYY-MM-DD"}]`. Good news is `config/beat.json` `offdays.good_news`: people in the creative, arts,
   music, entertainment, media and sports industries doing, earning or making more with AI, an artist, musician,
   performer, writer, creator or athlete, or the label, studio, publisher, broadcaster, club or league around them,
   named, with the number that shows it where there is one (fans reached, money earned, hours saved, work made). His
   "successful business stories" are their businesses now: the reader is the North Star line in `config/beat.json`
   `reader` (26 Nov), not the general business leader of 16 Nov, and a success story in those industries may be the best
   of all. A story with no line into them (a hospital, a farm, a council) is not offered, however uplifting.
   Then choose the four great things AI did for people in those industries this week (a fifth found is a spare only;
   since 26 Nov the carousel carries four (a fifth found is a spare only, never drawn; `config/carousel-format.json` `good_news`, the Library's good-news set order: cover, four items, close)) (Ruling, Krish, 2026-11-19: "5 great things AI is
   doing for people (ideally things that make people smarter or better or happier or more successful)"; "Can mix if
   no1 is implemented properly", which supersedes the 13 Nov one-topic rule): they may share a topic or mix, write
   what joins them on the option as `"topic": "<a few plain words>"`, and make the option's hook say it. Never choose
   a topic first and hunt for four. Each story is
   published in the seven days up to `stories_due` (today), or the thirty for one found in his sheet (step 0), none
   already run (`sources.json` `recent_offdays` urls). A Reddit thread, a video or a post is where a story was found
   (`found`), never its source. Four is the post: three or fewer is not a good-news post yet, and the board says so
   plainly on Saturday ("1 of 4 stories found"). Tag each story with its `kind`: from the story score's board its focus
   sector, one of `music`, `film_tv`, `games`, `creators`, `arts_design`, `performance`, `sports`, `media`,
   `creative_tools` or `rights` (`config/beat.json` `focus_sectors`); the older kinds, `business`, `health`, `lab`, `science`, `work`,
   `money`, `learning`, `climate`, `creative`, `people`, `safety` or `other`, stay valid; the board shows the week's mix on the option
   ("The mix: 2 health, 1 work, ..."), so he sees it before he presses. Since 19 Nov a carousel on another topic carries at most one health story,
   and Saturday leads on medicine only when the last four Saturdays carried fewer than two medical stories
   (`config/good-news.json`). Prefer a primary source: the organisation's own page, the paper, the official
   announcement, a company's own results or case study; a press story only names where it read it, and a founder's own
   post about their own company is that company's own words, said as theirs.
2. Check each against its primary source the same day: the headline, the number and the date must be on that page.
   A claim the source does not carry is cut, never softened.
3. Each story has its own picture: a photo or clip of the thing itself from the source or the organisation (`media`,
   https), never a stock image.
4. Write them into that week's `docs/plans/<Monday>-week/ideas.json`, on the good-news option only, as
   `"stories": [{"headline", "what", "why", "kind", "helps": {"who", "how"}, "date": "YYYY-MM-DD", "source": {"label", "url"}, "media": {"kind":
   "photo" or "clip", "url"}}]`, five of them, in plain English a 12-year-old follows, and set `stories_due` to today.
5. `python3 scripts/post-pack/copy_lint.py --applies-to carousel_text` on the words, then
   `python3 scripts/post-pack/board_feed.py gather <Monday>` and `cover <Monday>`: it refuses a story dated outside
   the seven days (the thirty for one found in his sheet), one with no source or picture, and one a recent off day ran.
6. Put them on the live board (Ruling, Krish, 2026-11-11: one live board, in Control Centre) with the rest of the week's ideas: the workflow's keep step puts the week's folder on the week's
   branch `offday-revise/<Monday>`, which the live board's view reads before main (`scripts/week_branch_keep.sh`, with a
   pull request that merges itself), and bumps the week's change signal (`board_web.py touch <Monday>`). The view
   counts the stories as this week's when they were found on or after the day the week's ideas run fills its board
   (`ideasRunOf`, the Saturday nine days before the Monday). Never build or publish a board page: the old pages are
   retired for good.

**The trade-off, said plainly.** The run fills the board for the week that starts eight days after its Sunday, so a
story it finds is about two weeks old by the Saturday it posts on. So before content-engine makes the post, each story is
checked against its source again through the fact gate (as every off-day news claim is, above), and one the source no
longer carries is cut and named.

**Filling an approved post to four.** When he approves a good-news post that holds fewer than four stories (an
uplifting option with one story of its own, as Sat 14 Nov's "AI found a mistake in a maths proof from 1986" was), its
topic stands and his Approve stands: the board's "Find the other N stories" press starts
`.github/workflows/saturday-goodnews.yml` with `fill: off-<day>-<id>`. The run then:

1. reads the option's own story (its hook, copy and source) as the topic and the first story, and writes it as the
   first entry of `stories` when the option has none;
2. finds the rest, to four, on that same topic, by steps 0 to 3 above (the seven days up to today, checked against
   each primary source, each with its own picture);
3. writes them onto that option only, sets `stories_due` to today, and never changes its copy, hook, pitch or
   direction: his Approve is bound to those words (`_offdaySides.ts`), and a story list is not part of them;
4. runs `board_feed.py gather` and `cover`, and the keep step puts the week on its branch as above.

It never writes a second good-news option, never approves anything and never moves a day. Fewer than five found on
the topic in the window is said on the option (`"stories_short": "<why>"`) and on the board, never padded with a story
off the topic.

content-engine makes the carousel from the stories as shown, in a Claude session from the v5 Library's `good-news` set (`python scripts/library/make_piece.py <piece> --set good-news`, its cover from `scripts/covers/make_covers.py`; `docs/CAROUSEL-STANDARD.md`, "How a carousel is made"; Ruling, Krish, 2026-11-26), and its mock comes back for his final yes as with any off day. Growth posts it. When the Library is not on the checkout the session says "the v5 Library is not on this checkout yet" and draws nothing another way.

