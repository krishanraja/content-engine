# The tool bank: what each outside tool could add to this engine

Status: living record. Started 2026-10-09 by a Claude Code session on Krish's
ask: "Theorise every plausible theoretical way how each one of these tools
could be additive specifically for this engine first. Log that to the engine
system. And then let's ideate how we improve the engine for this post
specifically. As we keep doing this and building up a working bank of what's
additive and unique, we can keep learning and logging."

How to use this file:

- Every idea here has a status: **theorised** (nobody has tried it), **tried**
  (used once on a named post, with what happened), **proven** (used on two or
  more posts and Krish kept the result), **dropped** (tried and not worth it,
  with why). Change the status when the evidence changes, never before.
- Every post's plan (`docs/plans/`) picks a handful from this bank, names
  them, and after the post ships records what each one added, in a
  "What the tools added" section. That is how the bank learns.
- The standing rule from 2026-09 still holds: tools are chosen from evidence,
  post by post. Krish has now paid for the accounts, so the question is no
  longer whether to buy, it is what each one proves. Nothing here spends on
  its own: a paid generation, a scrape or a publish needs his yes for that
  action.
- Nothing a tool makes skips the gates. A picture still passes the edge and
  phone checks, a number still comes from a passed sentence, a script still
  passes the story check, and a published video still carries Krish's own
  face and voice unless he decides otherwise in words.
- Two tools Krish named are not connected to a session yet: **ElevenLabs**
  (no connector; usable through n8n or its API with a key in `tools-access`)
  and **the news APIs and browser tools** (which ones is not written down
  anywhere; see "Not yet mapped").

The stages a tool can touch, in the engine's own order: **find** (ideas,
sources), **judge** (is it worth it, what does the world think), **write**
(article, script, posts), **picture** (covers, explainers, carousels),
**film** (the recording), **cut** (post-production), **ship** (channels), and
**learn** (what worked).

---

## Apify (scraping: Reddit, YouTube, news, LinkedIn, anything public)

What it is: thousands of ready scrapers, paid per result, callable from any
session. Already used for LinkedIn and jobs ($33 in the two weeks to 2 October).

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| A1 | judge | **Reddit sentiment on the subject before writing.** Pull the last 7 days of posts and comments on the piece's subject from the two or three subreddits that live it (for Friday: r/ClaudeAI, r/ChatGPT, r/OpenAI, r/singularity). Count what people actually complain about, praise, and ask. Feed the top three to the writer as "what the room is saying" and to the judges as a reality check on the angle. Krish's principle: revealed over stated. The scraper `harshmaur/reddit-scraper` can label sentiment and "mentions price" per row for a fraction of a cent each. | theorised | Friday: 300 rows, about $1, read before the rewrite. |
| A2 | write | **Real quotes from real people as the piece's chorus.** Three short Reddit lines ("I gave it the exact same prompt I used before, and the output is just pure garbage") attributed as "a Reddit user, 9 June 2026", quoted word for word so the fact gate can hold them. Replaces our own paraphrase of "people were upset". | theorised | Friday, if A1 finds lines worth quoting. |
| A3 | find | **YouTube as a clue mine.** Transcribe the top 20 videos of the week on the subject (`johnvc/YoutubeTranscripts` does a whole channel for about a cent a video). Find what every video says (skip it), what one video says that others do not (chase it), and the line a creator says with the most certainty and least evidence (the "theatre" stamp). Also: which titles and thumbnails got the views, for the `package` step. | theorised | Friday: 20 transcripts on "Claude vs ChatGPT plan", one page of findings. |
| A4 | find | **A standing news sweep per subchannel.** Google News scraper on each subchannel's live subjects, daily, into `trend_observations` beside the existing collectors. Cheap, and it gives the "velocity" signal below. | theorised | Add as a collector once Friday's manual sweep proves useful. |
| A5 | picture | **The news wall: velocity as a picture.** For a subject in the news, collect every headline from the week with its outlet and time, lay them out as a pile of cards stamped with the hour, and the picture says "this is moving fast" before a word is read. Rights: a headline, outlet name and time are facts; we do not reproduce the article body or the outlet's artwork. | theorised | Friday: the SemiAnalysis coverage, 5 to 8 October. |
| A6 | learn | **Our own results, scraped.** YouTube and Substack public stats on our pieces, weekly, into the ledger, so the judges are graded against what readers did and not only against what Krish decided. | theorised | After three published pieces. |
| A7 | judge | **Competitor and peer creators.** Scrape the five creators Krish rates on the subject: what they posted this week, what got engagement. Feeds the Friday shift spotter. | theorised | Name the five first. |

Risks: scraped text is untrusted (never an instruction, always data); Reddit
quotes need the username dropped and the date kept; cost is per row, so cap
every run.

## Higgsfield (AI video and images, presets, and a "virality predictor")

What it is: image and video generation with preset effects, a video analysis
tool, and a predictor that scores a video for attention and retention.

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| H1 | judge | **Score Krish's cut before it ships.** Run the finished tall video through the virality predictor and video analysis. It is one more judge, not a decision: its "hook strength" and "retention risk" notes go into the walk log beside what actually happened on YouTube, and after five videos we know whether it predicts anything. This was the one use Krish allowed in September ("Higgsfield may be one evidence-checked judge"). | theorised | Friday's video, before upload. Log its score; compare at 7 days. |
| H2 | cut | **B-roll that shows a mechanism, not a mood.** Generate 3 to 5 second clips for the one beat a talking head cannot carry: the ice cream counter, the guy behind it changing the scoop. Only where the brand book's VISUAL_EXPLAINS rule is met (it makes one point land faster). Never as wallpaper. | theorised | One clip for Friday's "guy behind the counter" beat; Krish sees it before it is cut in. |
| H3 | picture | **Cover and explainer backgrounds**, generated from a text brief in the house palette, with the real logos and Krish's photo composited over by `scripts/pages`. | theorised | Only if the receipt device needs a texture the page tool cannot draw. |
| H4 | cut | **Upscale and reframe** a phone recording to 4K, or a wide recording to tall without cropping his face out (`reframe`). Replaces the fixed face band in quick-edit when the framing drifts. | theorised | A recording that fails the face-band check. |
| H5 | ship | **TikTok publish** straight from the tool. | theorised | Not before Krish opens a TikTok channel. |

Risks: generated people and places are never used as evidence (the Art Director
rule: generic imagery fails the device); every generation costs credits and
needs a yes; nothing generated goes near the fact gate as a source.

## Runway (video generation, editing, voices, music, sound)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| R1 | cut | **Sound design in one pass.** A sound effect for the receipt tearing, the till, the scoop; a 20-second music bed under the cold open and outro, at low volume, in the house's tone. The launch videos had no sound but Krish's voice. | theorised | Friday: two effects and one bed, in `quick-edit`'s mix. |
| R2 | cut | **Remove the background** from a recording so the house ink and mint can sit behind him for the call card. | theorised | The call beat on one video. |
| R3 | cut | **The same clip in another market.** `localize_ad` and dubbing for an eventual Spanish or Hindi edition. | theorised | Not before an audience asks. |
| R4 | cut | **Multi-shot explainer** from a storyboard the Studio already writes, for the one-off main-channel scripts that have no recording. | theorised | One one-off script as a test. |
| R5 | picture | **Image generation and upscaling** for explainers, as with H3. One of the two tools gets picked after a side-by-side on the same brief. | theorised | Same brief to Higgsfield and Runway, Krish picks. |

Risks: as Higgsfield. Also the September ruling allowed "Runway one capped
illustration test"; R1 is the better first use because sound is additive and
cannot be mistaken for evidence.

## HeyGen (avatars, lip sync, translation, voice clones)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| G1 | ship | **Translate a finished video** into other languages with his own lip movement and voice. The one HeyGen use that keeps "my name on it" true. | theorised | After the first video has a reason to travel. |
| G2 | cut | **Fix one flubbed line** by lip-syncing a re-recorded sentence over the original take, so a 3-minute recording is not redone for one word. | theorised | The next recording with one bad line. |
| G3 | film | **An avatar of Krish for pieces he has no time to film.** Possible, and a credibility risk that is blocking, not additive: the publication's promise is him analysing it. If ever used, it is labelled on screen. Krish decides, in words, once. | theorised, not recommended | None until he rules. |
| G4 | picture | **Animate the cover portrait** for a 3-second Substack preview or LinkedIn video post. | theorised | One cover. |

## 21st Dev (interface components, generation, video blocks)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| D1 | picture | **The interactive, generated from a brief.** The plan slider for Friday (drag between $20, $100 and $200 and watch two bars) is exactly what it generates; `scripts/pages` then places it on the page in the house style. | theorised | Friday's slider. |
| D2 | picture | **A library of house components**: the receipt, the timeline, the fork, the scoreboard tile, each a component with the brand tokens, so every piece's visuals come from the same kit and look like one publication. | theorised | After the second interactive. |
| D3 | cut | **Video blocks for motion graphics**: the receipt tearing as an animation, exported for quick-edit. | theorised | One graphic. |

## Canva (designs, brand kits, templates, autofill)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| C1 | picture | **Brand templates with autofill.** A Substack cover, a 1200 x 630 preview, a LinkedIn card and a five-card carousel as templates with fields; the engine fills the headline, the call and the pictures and exports PNGs. Replaces the by-hand 1200 x 630 and gives the carousel a home. The edge and phone checks still run on the export. | theorised | Friday: the 1200 x 630 and the carousel. |
| C2 | ship | **Krish edits in Canva** when a cover needs his hand; the engine reads the design back and re-runs the checks. | theorised | When he first wants to. |

## Brandfetch (logos, colours, fonts of any company)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| B1 | picture | **Real logos, automatically.** LOGOS_AND_FACE says every company named gets its real logo. Today a session fetches them by hand. Brandfetch gives the official files for any domain in one call, so `scripts/pages` can take `"logos": ["openai.com", "anthropic.com"]` and place them. | theorised | Friday's receipt. |
| B2 | judge | **A company's brand colour as a fact.** The receipt's two columns in each company's own colour, from its brand file, never guessed. | theorised | Friday. |

Note from the connector: fetching the image bytes needs `*.brandfetch.io`
allowed for code execution, otherwise the page references the URL directly.

## Wispr Flow (voice notes, meetings, scratchpad)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| W1 | find | **Krish's spoken ideas, read by the engine.** He talks a piece idea or a correction into Flow on the walk; the session reads the scratchpad note the same hour. Replaces the message that reached a session as a screenshot (walk log F74). | theorised | Krish dictates Friday's feedback as a Flow note instead of typing. |
| W2 | write | **Script in his own cadence.** He talks the script's opening the way he would say it; the writer builds the script around his actual phrasing. The story check still runs. The best fix for "I can't even say it out loud". | theorised | Friday: one dictated opening. |
| W3 | learn | **Meeting notes as exhaust.** A client call where he explains a thing well becomes a one-off script candidate (with the client's name and anything private stripped). | theorised | Later. |

## n8n (workflows and agents, already running the content factory)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| N1 | find | **The daily sweep as a workflow**: Apify news and Reddit runs on a timer, results into the database, a line on the board when a subject's headline count doubles in a day (velocity alert). | theorised | After A1 and A4 are tried by hand. |
| N2 | ship | **The publish checklist as a workflow** that fires when Krish marks a post published: pack sent, library written, scoreboard set to "Not due yet", LinkedIn copy ready. | theorised | After one more post by hand. |
| N3 | cut | **ElevenLabs through n8n**: a scratch voiceover of the script in a stock voice so Krish hears the script's rhythm before he records, and the story check gets an ear. Never published. | theorised | Friday's script. |
| N4 | learn | **The 7-day results pull** (A6) on a timer. | theorised | After three posts. |

## ElevenLabs (voices; no connector yet)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| E1 | write | **Hear the script before filming** (N3). The single most useful thing for FOR_THE_EAR. | theorised | Friday. |
| E2 | cut | **Sound effects from text** where Runway's are not right. | theorised | As needed. |
| E3 | film | **A clone of Krish's voice** for a fix of one word, or for a video he cannot record. As G3: a credibility call that is his alone, labelled if ever used. | theorised, not recommended | None until he rules. |

## Riverside (recording, editing, captions, hosting; connected)

| # | Stage | Idea | Status | First test |
|---|---|---|---|---|
| V1 | film | **Record in Riverside** instead of the phone: separate tracks, higher quality, a transcript the moment he stops. The Inbox lane still receives the file. | theorised | One recording. |
| V2 | cut | **Its edit tools as a second cutter**: filler words, pauses, smart layout, captions presets, compared with `quick-edit` on the same recording. Keep the one Krish prefers. | theorised | Same recording through both. |
| V3 | ship | **Direct upload to YouTube and LinkedIn** with the `package` step's words. | theorised | After V1. |

## Already in the engine, and how the bank reaches it

- `scripts/quick-edit` takes a graphic by anchor word, so anything H2, R1,
  D3 or C1 makes drops in by naming the word it sits on.
- `scripts/pages` takes an interactive block and a cover brief, so D1, B1 and
  C1 feed it.
- The judges and the fact gate are untouched: scraped and generated material
  arrives as data, labelled with where it came from.

## Not yet mapped

Krish's "huge amount of browser tools and news APIs" are not written down
anywhere a session can read. Add each to `tools-access` with what it is and
how a session reaches it, and it gets its own rows here.

## Connection status (2026-10-09)

Krish connected or handed over keys for a wave of tools. What is live now,
value-free, is mapped in `docs/INTEGRATIONS.md`. In short: the four keyless
public sources (Polymarket/Kalshi odds, GDELT news velocity, Hacker News, SEC)
are built and tested in `scripts/signals/`; Firecrawl, GitHub, Apify and
ElevenLabs are reachable through their connectors; Exa, Brave, the X API and
Gemini have reserved secret names and need their pasted keys rotated before
use. The keys pasted into chat, the three master keys included, are exposed
and must be rotated; the master keys must not become engine runtime secrets
(`docs/INTEGRATIONS.md`, first section).

## Not yet bought: other APIs that could add, by rough cost

Written 2026-10-09 on Krish's ask: "What other apis could possibly be
additive? List them all and by rough cost". Costs are rough, at this
publication's volume (three pieces a week), and most come from third-party
price guides read the same day; a few are from memory and marked so.
Verify on the vendor's own page before buying. None is bought. Every row
is theorised.

Cost bands: **free**, **pennies** (under $10 a month for us), **tens**
($10 to $100 a month), **hundreds**, **thousands**.

### Find (ideas, velocity, the revealed layer)

| API | What it adds | Rough cost |
|---|---|---|
| Hacker News (Algolia) | What builders say the hour a story lands; the best contrarian comments for under.the.hood | free |
| GDELT | Every news article in the world by subject and hour; the news wall and velocity alerts without scraping | free |
| Google Trends (unofficial `pytrends`) | Is the public searching for it this week; a line on the timeline device | free, unofficial |
| YouTube Data API | Views, likes, comments and titles of any public video; our own results; which titles win (the Apify route costs pennies and needs no quota) | free quota (10,000 units a day) |
| Wayback Machine | "What it used to be" for mind.the.gap: a pricing page as it stood a year ago, as evidence | free |
| SEC EDGAR, Companies House | Filings as the revealed layer for follow.the.money: who paid whom, in their own words | free |
| GitHub API | What is being built: stars, commits, who moved to which tool; build signals already use it | free |
| Semantic Scholar, arXiv | The paper behind the press release, filed in its own words | free |
| Product Hunt, App Store and Play Store rankings (via Apify) | Pays-now demand, revealed | pennies |
| Brave Search API | A second web search for the fact gate's independent check, cheaper than Perplexity | pennies to tens (from memory, verify) |
| Exa | Search that returns pages like a given page; "find me three more outlets that ran this" for the news wall | about $7 per 1,000 searches |
| Tavily | Search built for agents, credits | about $5 to $8 per 1,000 |
| Firecrawl | Turn any page into clean text when the reader refuses it (walk log F72), including browser-rendered pricing pages the Higgsfield piece had to cut | pennies per page; plans $0 to $599 a month |
| Jina reader | Already used; the free route the filer tries first | free tier |
| X API | What the labs' own staff and critics post the hour it happens; pay-per-use is the only door for new accounts and reads cost about $5 per 1,000; full-archive search is enterprise, five figures a month | pennies for reads at our volume; thousands for archive |
| Polymarket and Kalshi public APIs | **The market's odds on our dated calls.** When we say 75%, show what traders say, and track both to the due date. Read-only, no account | free |
| Crunchbase, PitchBook, Similarweb | Funding and traffic; useful, pricey, and Apify covers most of it for pennies | hundreds to thousands |
| Glassdoor, Indeed, LinkedIn jobs (via Apify) | Hiring as the revealed layer; already how the LinkedIn work runs | pennies to tens |
| BuiltWith, Wappalyzer | The live tech stack of a company we write about; historical, so cross-check (Krish's own rule) | tens to hundreds |

### Judge (what the world thinks, what will travel)

| API | What it adds | Rough cost |
|---|---|---|
| Perplexity Sonar | Already the fact gate's independent checker; Sonar is about $5 to $12 per 1,000 requests plus tokens, so one piece's check is under a dollar | pennies per piece |
| Reddit official API | Free for low volume, awkward terms; Apify is simpler | free, limited |
| An LLM with web search (Anthropic, OpenAI, Gemini) | A second independent checker so no single source decides a fact | pennies per piece |

### Write and hear

| API | What it adds | Rough cost |
|---|---|---|
| ElevenLabs | Hear the script before filming; sound effects; a voice clone only if Krish rules | paid account exists |
| OpenAI or Gemini text-to-speech | A cheaper scratch voice for the same job | pennies |
| AssemblyAI | Transcribe Krish's recording for captions and the cut, about $0.15 to $0.21 an hour; the cheapest route if Whisper on the runner ever fails | pennies |
| Deepgram | Same, about $0.40 to $0.55 an hour, faster streaming | pennies |
| Gemini (video understanding) | Watch a competitor's video or our own cut and describe every shot; a judge that can see | pennies per video |

### Picture and film

| API | What it adds | Rough cost |
|---|---|---|
| fal.ai, Replicate | One door to every video and image model (Kling about $0.11 to $0.28 a second, Veo about $0.10 to $0.20 a second on fal, Sora 2 Pro $0.30 to $0.50) when Higgsfield or Runway lack the one we want | pennies to tens per clip |
| Google Veo direct (Vertex) | Native audio clips; about $0.75 a second | tens per clip |
| Pexels, Unsplash, Pixabay | Free stock photos and clips with clear licences, for the rare beat that needs a real place and not a generated one | free |
| Getty, Shutterstock | Editorial photos of the real people we name (Altman, Amodei); the only legal route to a real face on a cover | tens to hundreds per image |
| Giphy, Tenor | A reaction clip on the carousel's last card, if the brand ever allows it | free |
| Remotion (in the Studio) | Already the renderer; its licence covers us | in place |
| Figma API | If the brand kit moves to Figma, components flow to `scripts/pages` | tens a month |

### Cut

| API | What it adds | Rough cost |
|---|---|---|
| Descript, Captions.ai, Submagic, Opus Clip | Automatic cuts, captions, zooms and clip selection from a long recording; a rival to `quick-edit` and Riverside, judged on the same recording | tens a month each |
| Mux, Cloudflare Stream | Host the videos ourselves with view analytics, for the cover site's newsstand | tens a month |
| Suno, Udio | A music bed in the house's tone when Runway's is wrong; check the licence for commercial use first | tens a month |

### Ship and learn

| API | What it adds | Rough cost |
|---|---|---|
| YouTube Data API (upload) | Publish the video with the `package` step's words, on Krish's yes | free quota |
| LinkedIn API | Posting on a personal profile needs the Community Management product and approval; Riverside's social upload is the shorter route | free, gated |
| Substack | No public API; the copy page stays the route | none |
| Beehiiv, Ghost, Kit | Publications with real APIs, if Substack ever becomes the bottleneck | tens a month |
| Resend, Postmark | Send the Maven and other one-off emails from the engine, logged | pennies |
| Plausible, PostHog | What readers do on makeyourmindup.ai and the editions | free to tens |
| Buffer, Typefully | Schedule LinkedIn and X posts from the pack | tens a month |

### The five to try first, in order

1. **Polymarket and Kalshi** (free): the market's odds beside every dated
   call, on the scoreboard. Nobody else in this lane does it.
2. **GDELT plus Hacker News** (free): the news wall and the velocity alert
   without scraping.
3. **Firecrawl** (pennies): the pricing pages the fact gate keeps having to
   cut because they render only in a browser.
4. **Exa** (pennies): "find the other outlets that ran this" for the wall.
5. **AssemblyAI** (pennies): captions and the cut from a transcript with
   timestamps, as a fallback to the runner's transcriber.

Not worth it yet: Crunchbase, PitchBook, Similarweb, X archive search,
Veo direct. Apify and the free doors cover the same ground for pennies.

---

## What the tools added, post by post

### 2026-10-09, "Who picks your AI?" (mind.the.gap)

Chosen for this post (see `docs/plans/2026-10-09-who-picks-your-ai.md`,
"Tools for this post"): A1, A2, A3, A5, B1, D1, C1, N3/E1, H1, R1, W2.

Results: to be filled in after the post ships.
