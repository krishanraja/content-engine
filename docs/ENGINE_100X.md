# The 100x plan: every tool, every plausible use, for far better content

Status: the standing plan. Started 2026-10-09 on Krish's ask: "list all the
possible plausible ways you could use any tool that you have access to for the
purposes of content creation being 100x better. That's about what we want to
accomplish."

This is the ambition doc. `docs/TOOL_BANK.md` is the ledger that tracks what
has actually been tried and kept; this one says where we are trying to get to.
Read them together: ideas here, evidence there.

## What 100x actually means here

Not 100x more content. 100x better content, at the same one-piece-a-week
cadence, measured four ways:

1. **True beyond doubt.** Every number checked twice, now against more
   independent sources, so the fact gate is harder to fool, not just faster.
2. **Impossible to fake.** Built from the operational exhaust and from live,
   sourced data nobody else bothers to pull: market odds, news velocity, the
   room's real words.
3. **Lands faster than the words.** Every piece carries one visual or
   interactive that makes its hardest point obvious in a second, and a video
   that is Krish reacting, not an article read aloud.
4. **Learns every week.** Each piece records what the tools added, so the next
   piece starts ahead of the last.

The real multiplier is not any single tool. It is the **combinations** (last
section): odds plus a scoreboard, a scrape plus a judge, a transcript plus a
story check. One tool is 2x. The right chain is 100x.

## The pipeline, tool by tool

The engine's own order: **find → judge → write → picture → film → cut →
ship → learn.** Live means usable now; keyed means the key is placed and needs
only a reader; connector means reached through an MCP connector in a session.

### Find: better raw material than anyone else has

- **Prediction markets** (Polymarket, Kalshi; keyless, live). Read the market's
  odds on any question we have an opinion on. This is the signature move: every
  piece makes a dated Call with a confidence; show the market's number beside
  ours and track both to the due date. Nobody in this lane does it.
- **GDELT** (keyless, live). The whole world's news by subject and hour. Gives
  the velocity behind a story (is this one article or a pile-on) and the raw
  material for the news-wall picture.
- **Hacker News** (keyless, live). What builders said the hour a story broke,
  the sharpest contrarian comment for under.the.hood.
- **SEC EDGAR** (keyless, live). Filings as the revealed layer for
  follow.the.money: who paid whom, in their own words.
- **Reddit, YouTube, App Store, jobs, LinkedIn** (Apify, connector). The room's
  sentiment before we write; the claim every video repeats (skip) versus the
  one none says (chase); demand and hiring, revealed.
- **Exa** (keyed, live in Vercel env). "Find three more outlets that ran this,"
  and semantic "pages like this page" for the news wall and for prior art.
- **Brave Search** (keyed, live). A cheap second web search so no single source
  decides a fact.
- **X** (keyed, live). What a lab's own staff and its critics posted the hour a
  story landed.
- **Firecrawl** (connector, live). Turn any page into clean text, including the
  browser-only pricing pages the fact gate kept having to cut.
- **Wispr Flow** (connector). Krish's spoken idea on a walk, read by the engine
  the same hour, so a correction never again arrives only as a screenshot.
- **Gemini / an LLM with search** (keyed, to build). A cheap wide first pass to
  map what has been said, so the writer pushes past the rehearsed material.

### Judge: harder to fool, and graded against the world

- **Perplexity Sonar** (keyed, live). The fact gate's independent checker today.
- **Brave + Exa + an LLM with search** (keyed, live). Two or three independent
  checkers instead of one, so a single wrong source can no longer pass a claim.
- **Reddit sentiment** (Apify). A reality check on the angle: does the room
  actually feel what we are about to claim it feels.
- **Higgsfield virality predictor** (connector). Score the finished cut for
  hook and retention before it ships, logged against the real 7-day result, so
  after five videos we know if it predicts anything.
- **Gemini video understanding** (keyed, to build, cheap). A judge that can
  watch our cut or a competitor's and describe every shot and where attention
  would drop.
- **Market odds as a judge of our own Call.** If the market strongly disagrees
  with our confidence, that is a flag to go deeper before we publish.

### Write: Krish's voice, sharper and more his

- **Wispr Flow** (connector). He talks the opening in his own cadence; the
  writer builds the script around his real phrasing. The best fix for "I can't
  say it out loud."
- **Real quotes** (Apify, Firecrawl). Three real lines from the room, quoted
  word for word with a date, instead of our paraphrase of "people were upset."
- **The personality pass** (`VOICE_ON_CAMERA`, proposed). The article states
  the facts; the script is Krish reacting to them: one dry self-deprecating
  line, one sarcastic line at the hype, one exaggeration obvious by its size,
  one analogy a child would get, one opinion said as opinion and kept apart
  from the checked facts. The story check gains a sixth point for it.
- **ElevenLabs / an LLM voice** (connector, live). A scratch voiceover so the
  script gets an ear before Krish records, and the story check hears its
  rhythm.

### Picture: one image that does the work of a paragraph

- **21st Dev** (connector). Generate the interactive the piece needs (the plan
  slider, the money map, the fork) and a reusable house component kit so every
  piece looks like one publication.
- **Canva** (connector). Brand templates with autofill for the cover, the
  1200 x 630 social preview and the carousel, every export through the edge and
  phone checks.
- **Brandfetch** (connector). Real logos and each company's own brand colours
  by domain, so the logo rule runs itself and a receipt's columns are in the
  companies' real colours.
- **Higgsfield / Runway / fal.ai** (connector / keyed). A generated background
  or texture where the page tool cannot draw it, never as evidence, only where
  it makes one point land faster.
- **The data pictures** (built in-house from live data): the news wall from
  GDELT, the odds bars from the markets, the velocity timeline.

### Film: keep Krish the face, lower the cost of being on camera

- **Riverside** (connector). Record with separate tracks and a transcript the
  moment he stops; the Inbox lane still receives the file.
- **Wispr Flow** (connector). Dictate the beats; the camera take follows a
  script he has already said aloud.
- **HeyGen** (connector). Translate a finished video into other languages with
  his own lips and voice, the one use that keeps "my name on it" true; fix one
  flubbed line without redoing the take.

### Cut: ten times richer post, in order of what it adds

1. **The data graphics** (news wall, odds bars) dropped in by anchor word
   (`scripts/quick-edit`, in place).
2. **Sound** from Runway or ElevenLabs: the receipt tearing, the till, a quiet
   bed under the cold open and outro. Krish's voice stays the only voice.
3. **Screen captures** of the interactive for the beat it explains.
4. **One generated b-roll clip** (Higgsfield / Runway / fal.ai) for the single
   beat a talking head cannot carry, shown to Krish before it is cut in.
5. **Real logos and colours** (Brandfetch) on every graphic.
6. **Captions** from the runner's transcriber, or AssemblyAI / Deepgram /
   ElevenLabs as a fallback, with the known-mishearing fixes.
7. **Auto-cut candidates** (Descript, Captions, Opus Clip, or Riverside's own
   tools) judged against `quick-edit` on the same recording, best one kept.
8. **The predictor** (Higgsfield) on the finished cut as a judge.

### Ship: out the door with the right words, and self-hosted where it pays

- **The `package` step** (in place) writes the YouTube and Substack titles and
  descriptions, now chosen with the YouTube-title findings from the clue mine.
- **Riverside / YouTube Data API** (connector): direct upload with those words.
- **Mux / Cloudflare Stream** (keyed, to build): self-host the videos on
  makeyourmindup.ai with view analytics for the newsstand.
- **n8n** (connector): the publish checklist as a workflow that fires when a
  post is marked published (pack sent, library written, scoreboard set to "Not
  due yet", LinkedIn ready).

### Learn: every piece starts ahead of the last

- **Our own results** (YouTube Data API, Plausible/PostHog, Substack public
  stats via Apify): what readers did, weekly, into the ledger, so the judges
  are graded against reality and not only against Krish's taste.
- **The Call versus the market** (Polymarket/Kalshi): track our dated calls and
  the market's odds to the due date; the scoreboard becomes a record of who was
  right, us or the crowd.
- **The tool bank** (`docs/TOOL_BANK.md`): every post records what each tool
  added, and a status moves only on evidence.

## The combinations that are actually 100x

A single tool is a feature. These chains are the publication:

1. **The scoreboard that keeps score.** Market odds (keyless) + each Call's
   stored slug + the scoreboard on makeyourmindup.ai: our dated prediction
   beside the crowd's, both tracked to the day they resolve. No other AI
   publication puts its own calls on a live betting line.
2. **The pile-on, proven.** GDELT velocity + Firecrawl on each outlet + a
   generated news-wall picture: the story's own spread becomes the evidence
   that it matters, in one image and one video beat.
3. **The room, quoted and judged.** Apify Reddit + sentiment + three real
   quotes + a judge that checks the angle against what the room actually feels.
4. **The script that sounds like Krish.** Wispr Flow dictation + the
   personality pass + an ElevenLabs scratch read + the story check: a script he
   can say, in his own cadence, with opinion kept apart from fact.
5. **The fact gate that is hard to fool.** Perplexity + Brave + Exa + an LLM,
   three independent checkers, with Firecrawl reading the pages the old gate had
   to skip.
6. **The piece that watches itself.** Gemini video understanding + the
   Higgsfield predictor + our own 7-day results: the engine learns which cuts
   hold attention and feeds it back into the next storyboard.

## How a post picks from this

Every post's plan (`docs/plans/`) names the handful of tools it will use, from
this list, and after it ships records in `docs/TOOL_BANK.md` what each one
added. Concentrated rigor: pick the few that serve this piece, go deep on them,
skip the rest. The bank learns; this plan is the menu.

## What is live right now (2026-10-09, end of day)

- **The scoreboard that keeps score, built.** `POST /api/content-ideas/:id/call-market`
  pins a Polymarket slug or Kalshi ticker to a piece's Call (read once, so a
  wrong one is refused); the `signals_odds` cron reads every pinned market
  daily into `meta.call_market.history`; `GET /api/calls` serves every
  published piece's Call, our confidence, `not_due_yet` or `due`, Krish's
  verdict when made, and the market's odds. Keyless. The cover site reads it.
- **The pile-on, proven, built.** The `signals_news` cron sweeps GDELT and
  Hacker News for every piece in review, approved or published in the last
  thirty days, records each headline in `trend_observations`, and turns the
  board's "News velocity" signal to warn when a subject doubles in a day.
- **The script that sounds like Krish, built.** House rule `VOICE_ON_CAMERA`
  is live for the writers, the draft judges and the final pass; the script
  writer carries it as the sixth point of the story check; `voiceOnCameraIssues`
  is a soft block in the Studio's validators and `story_check.py` warns.
- **A judge that can watch, built.** `scripts/signals/video.py` sends a cut to
  Gemini once and gets a shot list, the attention drops and the one change
  that would hold viewers. Needs `GEMINI_API_KEY`.
- **Keyless and tested:** Polymarket, Kalshi, GDELT, Hacker News, SEC
  (`api/_signals.ts` for the engine, `scripts/signals/collect.py` for a
  session or a runner).
- **Keys placed in the engine's Vercel env:** Exa and Brave (already read by
  `api/_enrich.ts` inside `webResearch`), the X API (`xRecentSearch`), the
  Hacker News value. **All four were exposed in chat and must be rotated**
  (`docs/INTEGRATIONS.md`).
- **Connectors live in a session:** Firecrawl, GitHub, Apify, ElevenLabs, and
  the creative tools (Higgsfield, Runway, HeyGen, Canva, 21st Dev, Riverside,
  Brandfetch, Wispr Flow).
- **Next, by value:** draw the news-wall picture from the sweep's rows; pin
  Friday's Call to a market and watch the scoreboard fill; wire Brave and Exa
  as a second independent verdict inside the fact gate (today they feed its
  research); the Reddit chorus through Apify; the personality pass on Friday's
  script.
