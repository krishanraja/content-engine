# The lookalike step, every option's shape, and no repeats

Reference for the `plan-week` skill, read at step 1b (`.agents/skills/plan-week/SKILL.md`), right after
`board_feed.py gather` and before any research. The checks in code: `scripts/post-pack/lookalike.py` (the patterns) and
`scripts/post-pack/idea_checks.py` (`repeat_findings`, `aim_findings`), run by `board_feed.py gate <Monday>`, which the
Sunday ideas workflow runs again and which keeps the week off the live board while it fails.

Krish, 2026-11-16, of the 16 Nov board: "this week's Ideas Board needs to not contain mostly things we published last
week - we also need to build a lookalike model of stories that pull from the latest in [the Instagram inspo sheet] and
then go and find similar if not better stories on the web. The the suggestions, as a result, should be either one clear
theme containing lots of different news stories or one clear story that we can dive into. The goal should always be
immediate utility for the user, or interest, or humor." And: "Everything should be tinged with a humorous angle, all
scripts for pieces and all suggestions for off days."

## The lookalike step

1. `python3 scripts/post-pack/lookalike.py prepare <Monday>` reads his Instagram inspo sheet ("Instagram inspo.xlsx",
   tabs Themes and Posts) through the engine (`GET /api/inspiration/instagram-sheet`, read-only, no spend) into
   `docs/plans/<Monday>-week/lookalike-input.json`: the newest 100 posts (by Published, else Retrieved: rows the
   profile-grid backfill added have no Published date), the Themes tab, and how fresh the sheet is (`freshness`:
   newest Published, newest Retrieved, rows, rows of the last 7 days). When the sheet cannot be read it says why and
   falls back to the feed the gather read (`sources.json` `inspiration.lookalike_feed`, the same sheet's rows over 45
   days), with `source: "feed_fallback"` and the reason. Say its counts, its freshness and every warning in your reply.
2. Write `docs/plans/<Monday>-week/lookalike.json`: 5 to 8 patterns, what travels in those posts, each
   `{"id": "<short id>", "pattern": "<what the posts have in common, a plain sentence>", "why_it_travels": "<why people
   share it>", "aim": "utility" | "interest" | "humour", "examples": [<post URLs from lookalike-input.json>],
   "card_flow": ["<the job card 1 does>", "<card 2>", ...], "search_briefs": ["<what to search the web for this
   week>"]}`. Read the posts themselves (headline, summary, caption, every slide in order), never only their headlines.
   A pattern whose examples are carousels says, in `card_flow`, how their story moves from card to card: the job each
   card does, 3 to 10 steps (for example "a claim that stops the scroll", "the screenshot that proves it", "what it means
   for you", "the three things to try"). `lookalike.py check` refuses a carousel pattern without it.

   The sheet is a source of ideas in its own right, not only a model (Krish, 2026-11-16: "Just look at that Instagram
   inspo sheet for content ideas. Look at it for the way the narrative goes from card to card. You are more than welcome
   to copy any ideas but we just change the copy, we change the branding, we change the imagery, and ideally we have our
   own take on the card (even if we're allowed to use the specific bit of news or idea or format)."). An option may take
   a post's news, idea or format outright. Its copy, its branding (the house look, config/brand-palette.json) and its
   imagery are always ours, and it says its own take in one line. The facts still come from the primary source, checked
   the same day: the post is where the idea came from, never the evidence.
3. A stale sheet (its newest row older than three days) or a fallback is a warning in `lookalike-input.json`
   `warnings`. Copy each one, word for word, into `lookalike.json` `_about` and into ideas.json `_about`: never a quiet
   skip.
4. `python3 scripts/post-pack/lookalike.py check <Monday>` must pass: every example is a post the input holds, nothing
   invented, and every warning is carried.
5. Then search the web for each pattern's briefs: this week's similar or better stories, dated within 7 days, each from
   its primary source and checked against it the same day. These are the engine's candidates for every day, beside his
   own ideas and asks, which still come first (step 2).

## Every option's shape (from the 23 Nov board)

`board_feed.py gate` fails (code `aim`) on an option without these:

- `shape`: `"theme"` (one clear topic with at least three different sourced stories, in `stories` or `sources`, each
  with its URL) or `"story"` (one clear story: its primary `source` and `dive`, the mechanism to dive into, in one
  sentence).
- `aim`: `"utility"`, `"interest"` or `"humour"`: what it is for. Its own field: an off day's `pitch.lands` stays the
  line on why it lands.
- `funny`: its humorous angle in one plain line, no em dash. Educational but humorous: the humour carries the point,
  never replaces it. On a carousel or a cover the humour lives in the angle, the headline and the narration, never in
  stickers, badges or slogans (`docs/CAROUSEL-STANDARD.md`: "The fun is colour and light, never jokey copy").
- `lookalike`: `{"pattern": "<an id in lookalike.json>", "beats": "<the feed post URL it is similar to, better than or
  adapted from>", "our_take": "<one line: what we say that the post did not>"}`. His own ideas, ideas he records
  (`kind: recorded`), ideas from his tick and the weekly series need none; they still carry `shape`, `aim` and `funny`.
- Its words are ours. The gate (code `aim`) refuses an option whose hook, title, copy, story, pitch or card words carry
  seven words in a row from the post it names in `beats` (its headline, caption and slides). A fact, a name or a number
  may match; their sentence may not.
- A carousel drawn from a pattern follows that pattern's `card_flow`, card by card, in our copy, on our brand and with
  our own pictures (`docs/CAROUSEL-STANDARD.md`, "Off-day carousels are utility").
- From the 30 Nov board every Saturday option is such a carousel, modelled on one named carousel in the sheet: its
  `beats` is a carousel in `lookalike-input.json`, and its cards and frames follow the card_flow one for one, 4 to 10
  cards, the weekly good news included (Ruling, Krish, 2026-11-17; `references/offdays.md`, "Saturday is carousels
  modelled on his sheet"; gate code `saturday`). A meme template needs no lookalike (`references/meme-roaster.md`).

## Nothing that went out is offered again

The 16 Nov board offered Saturday 14's live Axiom carousel as a Friday piece, Friday 13's live piece as a Tuesday meme,
Friday 13's carousel twice more under new words, and five stories twice each (once as a piece, once as an off day). The
run plans eight days ahead, and the old check compared ids only. So the gather reads the last three weeks' live boards
into `sources.json` `recent_posts` (every piece and post he approved, made, scheduled or live, with its sources) and the
options those boards offered into `earlier_options`, and `board_feed.py gate` fails (code `repeat`) on an option:

- whose primary source is a recent post's (the same page: host without www, no tracking parameters, no fragment, no
  trailing slash);
- whose hook or headline is a recent post's title or a recent piece's idea, word for word;
- that re-offers an earlier board's option he did not send back (File for later, Save as a trend, Improve, or his idea
  queue), unless it is his own open idea;
- that cites two or more of the same works as one post (its whole evidence is that post's);
- whose primary source another option on the board shares: one story is one option, unless one of them is a carousel
  that `supports` that day's approved piece (`"supports": "mon"`, the day locked to its piece).

Two posts may still cite one article (docs/PUBLISH_BOARDS.md, "One post, one item"). A past board the gather could not
read (`recent_posts_error`) fails the gate too: gather again. `python3 scripts/post-pack/board_feed.py repeats <Monday>`
prints only these lines.

## The same story under new words

Thu 5 Nov's No spending, no sending short came back as Tue 17's "Your AI is about to start messaging you first",
with no link and no sentence in common (Krish, 2026-11-16: '"AI is about to start messaging you first" was posted
last week. Why is it on my ideas board for this week?'). No rule above can see a retold story, so a reader judges it:

1. When every option is written, give a fresh reader (a separate subagent, the Task tool, with none of your reasoning)
   two lists: every option on the board (its ref, hook, `pitch.see` or story, and copy) and every post in
   `sources.json` `recent_posts` (its key, title, date and `words`). Ask, for each option, one question: does it tell
   the same story as one of those posts, the same news or the same advice to the same reader, under any words? The
   reader answers `new` or `same_story`, names the post, and gives one line of why.
2. Write its answers, unchanged, into ideas.json `repeat_review`: `{"reader": "<the subagent you asked>", "checked":
   [{"ref": "<board ref, e.g. off-tue-proactiveai or mon-2>", "verdict": "new" | "same_story", "of": "<the post's key>",
   "why": "<its line>"}]}`. Every option on the board has one, and only the reader's answer counts.
3. Cut or replace every option it calls `same_story`, then ask it again about the replacements. `board_feed.py gate`
   fails an option with no verdict, or one called the same story (code `repeat`); his own idea is shown with it, never
   failed.

## Making some days again

A run started with `days` (sunday-ideas.yml, e.g. `thu,sat`) makes again only the options nobody answered on those days
(`sources.json` `option_status`, `open`). Every other option stays exactly as it is, byte for byte and in its place:
approved, revised, held, filed, saved as a trend, improved and rejected options, and every option on any other day.
`board_feed.py keep` checks it against the copy and the status the workflow took before the run, and the week stays off
the live board if anything else changed.
