# The meme roaster: the week's meme templates

Reference for the `plan-week` skill, read at step 3c (`.agents/skills/plan-week/SKILL.md`) with
`references/offdays.md`. The checks in code: `scripts/post-pack/idea_checks.py` (`template_findings`), run by
`board_feed.py gate <Monday>`, from the 30 Nov 2026 board.

Ruling (Krish, 2026-11-17), looking at Sat 21 Nov's board: "we are also missing hilarious meme suggestions - we need to
build an AI pop culture roaster in my humour style - you saw the AI Agent using your computer meme and the AI
translator meme I liked - why can we not create a pipeline of existing meme videos that could be good to reskin, and
show me those in here? Then I could think of a funny caption for it thats related to AI. And lets bring up the
production value of the meme to looking more like the production quality of the rest of the carousels etc."

His answers the same day: meme templates get their own "Meme templates" row on the Ideas tab, 6 to 10 a week, each with
the clip, why it fits and a caption box; his caption plus Approve turns it into a meme post, which he can move to any
off day. The footage is the original clip, credited, his caption on top, like the translator meme. The sources are his
Instagram inspo sheet's meme videos and liked cards, Reddit's meme-template subreddits, the week's pop-culture moments
from the Sunday run's web search, and trending meme accounts on Instagram and TikTok through Apify (costed, off by
default, never without his approval of the run and its cap).

## His humour, read live

Read his humour traits live every time, never from memory and never from a copy: Control Center `get_skill`, skill
`krish-voice`, file `references/humour.md` (krishanraja/ai-harness). Where the connector is absent (the Sunday ideas
run in GitHub Actions), read the same file live from ai-harness main with WebFetch
(`https://raw.githubusercontent.com/krishanraja/ai-harness/main/skills/krish-voice/references/humour.md`). Use the Make Your Mind Up row: traits 1, 3, 4, 5
and 6 in full, and trait 2 (precise cruelty) only at claims, hype, incentives and decisions, never a person. Read its
"What makes a joke fall flat" too. If neither read works, say so and draft no caption idea: nothing here restates his
traits, so this file cannot stand in for them. Never copy them into this repository.

## The steps

1. **Gather.** `python3 scripts/post-pack/meme_templates.py gather <Monday>` (after `board_feed.py gather` and
   `lookalike.py prepare`) writes `docs/plans/<Monday>-week/meme-template-candidates.json`, never committed: video posts
   from his sheet and his video cards with a meme or humour signal, and the top video posts of the week on
   r/MemeTemplatesOfficial and r/memes. A source it cannot read is said in `sources` with why; say each count and each
   failure in your reply. A clip offered on the last three boards is already left out. Never pass `--apify`: it costs
   money and runs only once Krish approved that run and its cap (`--max-items`, at most 30, and
   `--i-approved-spend`).
2. **The week's moments.** Search the web for the pop-culture moments of the week (a film, a match, a launch, a
   viral clip people are already remixing). A moment with a clip people reuse is a candidate with place
   `pop_culture` and `moment` set, dated ("The final whistle at the 29 Nov derby, 2026-11-29").
3. **Pick 6 to 10.** Keep the clips whose action maps cleanly onto an AI situation the reader has lived: agents doing
   too much or too little, copilots, chatbots, AI at work, AI hype. The test is one sentence: "this is what happens
   when ...". From at least two kinds of place. A clip that needs its own explanation, is only funny with its sound on
   (most people watch muted), or shows a private person in a moment they would not want spread is cut.
4. **Say why it works.** For each: `what_happens` (one plain line: what the viewer sees), `why_it_works` (one line:
   the humour mechanism and why it fits an AI caption) and `mechanism`, the humour engine's ids
   (`idea_checks.MECHANISMS`, from krishanraja/humour-engine `schemas/ontology.json`).
5. **Draft 2 to 4 caption ideas.** In his traits, read live: one observation, a stupid premise, a slightly cruel
   payoff aimed at the AI or the hype, never a person. Surprise over the setup: no predictable pun. Use what the viewer
   can see in the clip; no off-screen premise (no invoice, contract or job the picture does not show). At most 20
   words, no em dash, no handle and nobody from the clip's credit, and each passes
   `python3 scripts/post-pack/copy_lint.py --applies-to channel_copy` and `node
   vendor/makeyourmindup/kill-list/kill-list.mjs`. They are ideas for him: his caption is the one used, and only text
   he puts in quotation marks in his note is printed verbatim (`references/offdays.md`, "His presses").
6. **Read back.** Two fresh readers (separate subagents with none of your reasoning, each an ordinary 12-year-old
   seeing the clip's `what_happens` and the first caption idea once) each say in one line what the meme is. A reader
   who cannot, or says something else, sends it back. Save it as `read_back`, as for any off-day option, with
   `against` the count of `recent` plus `recent_offdays`.
7. **Write them** into ideas.json `offdays.tue` or `offdays.thu` (Move to puts the post on any day once he approves).

## The option

```json
{"id": "doorbell", "kind": "meme", "format": "Meme template, your caption on the clip, 9:16 and 4:5",
 "source": {"label": "r/MemeTemplatesOfficial, top of the week", "url": "<the clip's page>"},
 "copy": "<two plain sentences: what the clip is and the AI moment it becomes>",
 "hook": "<the template's title>", "pitch": {"see": "<what the viewer sees>", "lands": "<why it lands>"},
 "aim": "humour", "shape": "story", "funny": "<its humorous angle, one plain line>",
 "template": {"title": "<the template's title>",
              "clip": {"url": "<https: the playable mp4 or webm, or the page>", "page": "<https page>", "poster": "<https image or null>", "seconds": 12},
              "found": {"place": "sheet" | "card" | "reddit" | "instagram" | "tiktok" | "youtube" | "pop_culture", "label": "<where>", "url": "<https>"},
              "credit": "<who made the original>",
              "what_happens": "<one plain line: what the viewer sees>",
              "why_it_works": "<one line: the humour mechanism and why it fits an AI caption>",
              "mechanism": ["reversal", "personification"],
              "moment": "<the pop-culture moment it rides, dated, or null>",
              "date": "YYYY-MM-DD"},
 "caption_ideas": ["<2 to 4 drafts>"],
 "read_back": {"readers": ["<reader>", "<reader>"], "says": ["<one line>", "<one line>"], "against": 49}}
```

A template needs no `lookalike` (its clip is the model), no `source_tag` and no `learned_from`, and it never counts
toward the day's five options: it rides on top, as an idea from his tick does. `board_feed.py gate` (code `template`)
fails a week with fewer than 6 or more than 10, from one kind of place only, and any template that is not whole: an
https clip and page, a credit, a found place, valid mechanism ids, 2 to 4 caption ideas each clean as above, or a clip
page offered on the last three boards or twice on this one.

## Once he approves

His caption, typed in the option's note, and his Approve make it a meme post on that day; Move to puts it on any off
day. It is made on the ve route from a Claude session to `docs/MEME-STANDARD.md`: the original clip at its full frame,
his caption on a clean band in the house type and palette, the mark and a credit line, filed with its social_clip
receipt.
