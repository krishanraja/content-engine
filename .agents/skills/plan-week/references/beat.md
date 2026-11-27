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

**Businesses first, and under the hood** (Krish, 2026-11-27: "My ideas board has become a little bit too focused on
individual creators and not enough on what it was before, which is businesses and, under the hood, how AI is changing
things."). The focus sectors and the reader stay as they are; this sets which way a Monday, Wednesday or Friday story
faces inside them. The line, the two subjects and the words are `config/beat.json` `lens`; read it, never copy it.

- Research businesses first: the labels, studios, publishers, broadcasters, streamers, platforms, agencies, clubs and
  leagues of these industries, and the AI firms, prices and markets they run on. Ask of each story what AI is changing
  in how that business works: how the work is made, sold, priced, licensed or paid for. The weeks of 16 and 23 Nov are
  the register he means ("Anthropic made $17 billion in three months and still lost money"; "An AI fixed another AI by
  changing 0.016% of it"), brought inside the focus sectors.
- One person or one tool feature leads at most one option a day (`max_creator_led_per_day`), and only when the story
  is what it shows about how the business around them works. A creator tool's launch is creator-led unless what it
  leads on is the company's deal, price, revenue or market.
- Every hero carries `"lens": {"subject": "business" | "creator", "who": "<the business or person, by name>",
  "under_the_hood": "<one plain line: what AI changes in how it works>"}`. Label it honestly: `board_feed.py gate`
  (`lens`, `idea_checks.lens_findings`, from the 7 Dec board) refuses a hero with no lens, a `who` its story never names,
  an `under_the_hood` under eight words, longer than a line or the so-what again, a `business` subject whose question,
  headline, hook and first sentence name no company, label, studio, platform, club, league or market, and an open hero
  day with more than one creator-led option.
