# The beat

Read from the plan-week skill (`SKILL.md`, "The channel, the idea tests and his asks").

**The beat** (Krish, 2026-11-24, 20:18Z: "we need to ensure the engine brings
the best of stories and ideas that I want to move towards, as opposed to
governance, data breaches etc. I really liked the AI Music piece, it got good
response the way it was broken down. we can still keep a focus on the
economics of AI but in these focus sectors"). The focus sectors, the avoid
list, the tone and the model piece ("a Reiki master wrote a UK number two": a
hit traced back to the people and tools behind it, money included) are rows
in `config/beat.json`; read it, never copy it. Media, entertainment, arts,
music and creator tech, the economics of AI inside them, with a positive
spin. Not governance, regulation, security, privacy or breaches, and not
enterprise productivity with no creative angle: `board_feed.py gate` refuses
such an option (`off_beat`) from the 30 Nov board.

**The off days are the reader's world too** (Krish, 2026-11-26: "Make sure all the good news suggestions and meme
suggestions are also aligned to the new positioning, as well as the carousels."). The good news, the memes and meme
templates, and every off-day carousel, tip, how-to and short are written for the reader in `config/beat.json` `reader`,
by the lines in `config/beat.json` `offdays` (`references/offdays.md`, "Every off day is the reader's world"). From the
story score's board `board_feed.py gate` refuses one with no focus-sector word, an office one as such, and a good-news
story outside the focus sectors (`off_beat`, `idea_checks.offday_beat_findings`).

**A mix of businesses and creators, layered where it can be** (Krish, 2026-11-27: "My ideas board has become a little
bit too focused on individual creators and not enough on what it was before, which is businesses and, under the hood,
how AI is changing things."; then, 2026-11-28: "I want a mix, not a lean." and "a mix, or a multilayered combo is better
than one or the other. therein lies the ability to tell better stories."). The focus sectors and the reader stay as they
are; this sets which way a Monday, Wednesday or Friday story faces inside them, and each off day's explainers. The line,
the three subjects and the words are `config/lens.json`; read it, never copy it.

- Research both sides: the labels, studios, publishers, broadcasters, streamers, platforms, agencies, clubs and leagues of
  these industries and the AI firms, prices and markets they run on (asking what AI is changing in how each works: how
  the work is made, sold, priced, licensed or paid for; the weeks of 16 and 23 Nov are that register, "Anthropic made $17
  billion in three months and still lost money"), and the creators, artists and performers and the tools they use.
- Prefer the layered story that carries both: what a label's AI deal does to its artists, how a studio's pipeline
  changes an animator's job. It is labelled `both` and counts on each side.
- Each open hero day has at least two options with a business side and two with a creator side (`min_each_per_day`; a
  `both` counts on each), and each off day's explainers at least one of each (`min_each_offday`). Neither side takes over.
- Every hero, and every off-day explainer, carries `"lens": {"subject": "business" | "creator" | "both", "who": "<the
  business or person, by name>", "under_the_hood": "<one plain line: what AI changes in how it works>"}` (an explainer
  needs no `under_the_hood`). Label it honestly: `board_feed.py gate` (`lens`, `scripts/post-pack/lens.py`, from the 7 Dec
  board) refuses a lens missing or unknown, a `who` the option's words never name, a weak `under_the_hood`, a `business`
  or `both` subject whose question, headline, hook and first sentence name no company, label, studio, platform, club,
  league or market, a `business` one led by a creator when its `who` is not a business, a `both` one that names no
  creator, and a day short of either side. A day he has already answered is never checked, and an idea from his own
  words or his Inspiration tick is his: write its lens, but the gate never checks or counts it.

**What is actually happening in the world** (Ruling, Krish, 2026-11-28: "Ultimately that week's ideas, memes, and
carousels should be aligned to what is actually happening in the world."). The news hub carries three trend lanes above
the six sectors, money, behaviour and technology (`config/hub-sources.json` `trends`), each with its checked stories
and a line of what is moving and why; the gather reads them into `sources.json` as `hub.trends` and the lanes' stories
into `hub.items` with their `trend`. Start the week's research there, then from the big trends of the fortnight.

- Every open Monday, Wednesday and Friday option, and every open off-day option but the Saturday good news (memes and
  shorts included), carries `"trend": {"lane": "money" | "behaviour" | "technology", "line": "<the trend it follows, one
  plain line>", "source_url": "<an https page that shows it>", "date": "<YYYY-MM-DD>"}`. `board_feed.py gate` (`trend`,
  `scripts/post-pack/trend_tie.py`, from the 14 Dec board; the words are `config/trend-tie.json`) refuses an option with
  no trend, a lane that is not one of those three, a line under eight words, longer than a line or its so-what again, a
  source that is not https, or a date more than 21 days before the week starts or after it. A meme's trend is the AI
  moment its caption is about. An idea from his own words or his Inspiration tick is his and is never checked.
