# Research brief, ideas board for the week of 7 December 2026

Today is Friday 27 November 2026. You research real, dated news stories for Make Your Mind Up, a publication whose
reader is: "people who make the calls or make the work in the creative, arts, music, entertainment, media and sports
industries, reading on what AI is doing to how their work makes money".

## The beat (hard)

- In: AI in music, film and TV, games, publishing and creators (YouTubers, podcasters, newsletters, authors), art and
  design, theatre and performance, sport, media and journalism, creative tools (Adobe, Canva, Midjourney, Runway, Sora,
  Veo, ElevenLabs, Suno, Udio, CapCut, Figma...), licensing, copyright and residuals. The economics stay in: who gets
  paid, what it costs, who wins the market. Positive spin is welcome.
- The sector must be in the sentence that carries the fact (a music label did X), never bolted on ("which matters for
  musicians").
- Out: governance, regulation, compliance, policy, security, privacy, surveillance, data breaches, deepfake fraud;
  enterprise or office productivity with no creative-industry angle; general AI lab news (model launches, chips, IPOs)
  unless the story itself happens inside a creative industry.
- No predictions, forecasts, odds, "will" calls, or advice.

## Freshness and sources (hard)

- Hero stories (Mon, Wed, Fri): the dated event is between 13 and 27 November 2026. Off-day stories: 20 to 27
  November 2026 (good news may go back to 28 October only if found in the Instagram sheet, which another reader does).
- Every story has a PRIMARY source: the outlet that first reported it, or the actor's own page (company newsroom,
  label press release, filing, the study itself, an official data host). Never an aggregator or syndicator (Yahoo,
  MSN, Google News, NewsBreak, Flipboard, Ground News, etc.): go past it to the original.
- Hero stories also need a SECOND independent source on a different site, so a later reader can document "why" rungs
  on two sites.
- Open each source with WebFetch and copy the key fact as a VERBATIM quote from the page (exact words, never a
  paraphrase). If the page will not load, say so; never guess what it says. A fact you cannot see on the page is cut.
- Read `docs/plans/2026-12-07-week/research/exclude.txt` first: it lists everything offered or posted on the last three
  boards. Do not bring back any of those stories (the same news under new words counts as the same story). Also skip:
  the EA Sports FC John Motson voice, Golden State Warriors/Gemini, Gods Don't Give Gifts, the Bartz v Anthropic
  author payments, Warner Music/Suno revenue, BumaStemra, Ubisoft generative-AI pitches, Suno Bridge, Suno Visuals,
  TikTok Likeness Detection, the 500-channel YouTube copyright mill, Character.AI bankruptcy, Xania Monet AI Music
  Awards, ITV free TV adverts, the 91% of designers survey, Adobe MAX, Infosys.

## What to return

Write your findings to the JSON file your lane names, shaped:

```json
{"lane": "<lane>", "searched": ["<queries you ran>"], "candidates": [
  {"key": "<short-slug>", "sector": "music|film_tv|games|creators|arts_design|performance|sports|media|creative_tools|rights",
   "headline": "<plain one-line what happened, our words>",
   "what_happened": "<2 to 3 plain sentences: who, what, the number, the date>",
   "date": "YYYY-MM-DD",
   "named_thing": "<the one product, deal, number or person it is built on>",
   "primary": {"label": "<outlet or org, title, date>", "url": "https://...", "kind": "original|report",
               "quote": "<verbatim sentence from the page carrying the key fact>"},
   "second": {"label": "...", "url": "https://...", "quote": "<verbatim>"},
   "more_sources": [{"label": "...", "url": "...", "quote": "..."}],
   "money_or_mechanism": "<one sentence: where the money moves, or how the thing is built, or where claim and reality part>",
   "why_it_matters": "<one plain sentence for the reader above>",
   "funny": "<one plain line: the true, slightly absurd angle; the joke is in the facts, never at a named person>",
   "media": {"kind": "photo|clip", "url": "https://<a real image or video of the thing itself, from the source or the org>"},
   "risks": "<anything shaky: paywall, single source, company claim only, older than the window>"}
]}
```

Use British spelling. No em dashes and no exclamation marks anywhere. Quality over quantity: a candidate you could not
check against its page is left out, and you say so in `searched`. Reply with only the file path, the number of
candidates and one line per candidate (key, date, sector).
