# The makeyourmindup 3-second carousel format

Written 26 Nov 2026 from the owner's competitor sheet ("Instagram inspo") and his instruction of the same day: carousels must follow "a really easy-to-understand format that someone can swipe through in 3 seconds and understand but it's also visually stunning."

Read with `TITLES.md` (his cover-title shapes) and `library.json` (`carousel_sets` and the `carousel-*` items). This file proposes changes; it does not edit either.

---

## 1. What the sheet contains, and how much of it was read

**Portion read: all of it.** The export is one JSON object whose `fileContent` string is 1,018,945 characters. It was read in 17 sequential slices of 60,000 characters (the last slice 58,945), start to finish, with nothing skipped. One caveat on completeness: the string ends mid-row, inside the capture-status cell of post `Dcf2-TRTMig` (an evolving.ai Reel). The file handed over was therefore cut off at its source, most likely by the Drive tool's read limit. Everything in the file was read; anything in the live spreadsheet after that point was never in the file.

**Two sheets.**

- **Themes** (the first 40,000 characters): 54 theme rows with five columns (Theme, What they are saying, Direction, Supporting source URLs, Evidence caveat), citing 200 post URLs. Its header still says "323 unique posts" and "513 carousel pages OCR'd"; both figures are stale against the Posts sheet below.
- **Posts** (the rest): one row per Instagram post, 16 columns (Post ID, Published, Retrieved, Type, Pages, Capture status, Headline, Faithful summary, Future-of-AI claims, Named entities, Time horizon, Evidence or source named, Full caption, Carousel slide text (ordered), Post URL, Account). 418 complete rows plus the truncated 419th.

**Channels and counts (complete rows).**

| Account | Posts | Carousels | Median pages (carousels with a page count) |
|---|---|---|---|
| @evolving.ai | 238 | 69 | 7 (range 2 to 19) |
| @therundownai | 126 | 40 | 4 (range 2 to 7) |
| @getintoai | 29 | 18 | 7 (range 2 to 17) |
| @power.ai | 14 | 10 | 5 (range 3 to 9) |
| @syntaix.ai | 11 | 11 | 13 (range 2 to 13) |
| **Total** | **418** | **148** | **5.5 (mean 6.7)** |

Post types: 145 carousels, 2 carousels with video, 1 mixed-media carousel (148 carousel-type posts), 100 posts, 98 single images, 71 Reels, 1 post with video.

**How much carousel text exists.** 102 of the 148 carousels have a page count. 71 have at least two pages of readable slide text (OCR). The rest are caption-only because Instagram stalled during capture; those rows say so and infer nothing.

**Citations below** use the sheet's own key, the Post ID, plus "Posts row N", where row 1 is the sheet title, row 2 its description, row 3 the column headers and row 4 the first post.

---

## 2. Patterns in the carousels that work hardest

### What "best-performing" can and cannot mean here

The sheet carries **no post-level engagement**: no likes, comments, saves, shares or views for any of the 418 posts. Nine rows contain view or like figures, and every one belongs to something shown inside the post, never the post itself. Examples: the tweet screenshotted in `DfSJYPjgLe8` (Posts row 204) shows 6.7M views; the Japanese Prime Minister's post inside `DezPzF1gLXq` (row 123) shows 88.6M views; `DfStxlXk-D8` (row 233) screenshots other creators' videos at "1M likes and 16M views" and 61M plays. The only audience sizes the accounts state are their newsletters: evolving.ai "+100,000 readers" (later "120,000+"), The Rundown "2,000,000+ subscribers".

So performance has to be inferred. Three proxies are used below; each is an inference, and the sheet measures none of them:

1. **Formats a publisher keeps repeating.** evolving.ai ran the 7-day roundup at least four times (`DeZI5SKAO2U` row 15, 17 pages; `DerDH5aAESn` row 75; `De9a2oUgKEv` row 143, 15 pages; `DfPW8fmgCnt` row 201, 17 pages).
2. **Formats copied across accounts.** "Claude's advice for the next 10 years" ran on evolving.ai (`DfPo57fAL9g`, row 207), getintoai (`DfP_rokE8x6`, row 239, with a paid line inserted) and power.ai (`DfcCbPXlWQ-`, row 308). "Subscription-killing gadgets" ran on evolving.ai (`De4B3hIiLKj`, row 115) and getintoai (`DfR9kIEk0d_`, row 237). The Felix Rieseberg prompt ran on evolving.ai (`DegmHW6AEp6`, row 37) and The Rundown (`Deen2mzEiBS`, row 56). The Sam Altman RAM memes ran on evolving.ai (`DfPg9iTACeu`, row 208) and getintoai (`DfSyz0lExfe`, row 232).
3. **Formats advertisers pay to sit inside.** Higgsfield, Polymarket and Abacus AI all bought carousel slots (`DfSaA34gSY6` row 235; `DfPtlppCdtr` row 243; the `#higgsfieldpartner` posts).

### Slide count

- Overall median 5.5 pages, mean 6.7 (102 carousels with a count).
- Distribution: 20 carousels of 2 pages, 46 of 3 to 7, 18 of 8 to 10, 18 of 12 to 19.
- The fastest reader, The Rundown, never goes past 7 (median 4). Its typical news carousel is cover, one or two evidence screenshots, newsletter close (`DecPuUmkqrY` row 21; `DeeYGwlks4j` row 57; `De2KG3bkm1c` row 129).
- Long carousels (13 to 19 pages) are compilations where each page is a two-second laugh or a single demo: AI-slop captions (`DeeqU7IgMmh` row 40, 19 pages), internet reactions (`DejI5FaAHuf` row 29, 15 pages), 7-day roundups, and syntaix.ai's repo lists (13 pages each).

### Cover hook shapes (71 covers with readable text)

- **43 of 71 covers contain a number.** "HERE ARE THE BEST 5" (`DeZY0UCANtg` row 13); "7 SUBSCRIPTION KILLING GADGETS, BUY ONCE, STOP PAYING MONTHLY" (`De4B3hIiLKj` row 115); "BOOSTING ITS SCORE BY OVER 6X" (`DfSJYPjgLe8` row 204); "PUT 70% OF THE WORLD'S WEBSITES AT RISK" (`DewxpImgHJr` row 92); "ANTHROPIC REPORTS A $24 BILLION NET LOSS IN Q3" (`DfSaA34gSY6` row 235).
- **Named company plus a physical verb in the past tense.** "SOMEONE JUST CANCELED ELON MUSK'S ORDER AFTER HE LEAKED HIS ORDER DETAILS ONLINE" (`DeZhswTgB_y` row 12); "GOOGLE FORCED TO HALT WORK IN FINLAND AFTER ILLEGALLY CLEARING 250,000 TREES" (`De3gAQ7AFlK` row 116). 8 covers lead with "JUST IN", "BREAKING" or "JUST released/launched/revealed".
- **Stakes and superlatives.** "THE DAY THE INTERNET BROKE." (`DewxpImgHJr` row 92); "THIS IS THE MOST SERIOUS 48 HOURS IN CYBERSECURITY HISTORY" (`DezPzF1gLXq` row 123); "PALANTIR CEO SAYS ONLY 2 TYPES OF PEOPLE WILL SURVIVE THE AI ERA" (`DfMsM51gB-U` row 211).
- **The experiment.** "I ASKED CHATGPT WHAT LAWS IT WOULD PASS IF IT GOVERNED THE WHOLE WORLD" (`Deb6wbXAHTx` row 8); "CLAUDE'S ADVICE FOR THE NEXT 10 YEARS" (row 207).
- **A price anchor.** "CLAUDE CAN NOW FIX YOUR SLOW COMPUTER THE WAY A $120/HOUR IT TECHNICIAN WOULD" (`Dey1P3MAMcz` row 124).
- **Questions are rare:** 5 of 71 (for example "DO YOU REALIZE WHAT JUST HAPPENED IN AI IN THE LAST 7 DAYS?", row 15).
- **22 of 71 covers print a swipe cue** ("SWIPE FOR MORE", "SWIPE TO WATCH", "SWIPE FOR 12 WILD EXAMPLES").
- **Cover length:** median 20 words of OCR text (this includes wordmark and logo noise, so the headline itself runs nearer 12 to 18 words). The Rundown sets one sentence-case sentence under an "AI NEWS" or "AI GUIDES" tag; evolving.ai and getintoai set all capitals.

### The arcs, slide by slide

1. **News with receipts** (evolving.ai, The Rundown): cover claim, then the primary source as a screenshot (the CEO's tweet, the newsroom post, the filing), then 1 to 5 more evidence screenshots each topped by one plain-English line, then a "what it means" line, then the newsletter. `DecyEy6AE7Z` (row 4, 7 pages), `DeZ3hq7gDJv` (row 10, 8), `DfSJYPjgLe8` (row 204, 9), `DewxpImgHJr` (row 92, 10). 35 of the 71 readable carousels carry at least one screenshot of a primary source inside.
2. **The numbered list** (all five accounts): cover promises N things, each inside page is one item: NAME IN CAPITALS, one or two lines, one product photo or screenshot. `DeZY0UCANtg` (row 13), `De4B3hIiLKj` (row 115), `DfR9kIEk0d_` (row 237), `DfM0PZdgLr0` (row 210), `DfC36S3gCnq` (row 153, TIME inventions, 16 pages), `Deb6wbXAHTx` (row 8, five "laws").
3. **The compilation** (reactions, demos, memes): one tweet or clip per page, a 4 to 15 word line on each. `DejI5FaAHuf` (row 29), `Dee2A05ACEW` (row 39: "Argon built a Minecraft clone in 19 minutes for about $3"), `DeeqU7IgMmh` (row 40).
4. **The how-to.** The Rundown's "AI GUIDES" pages pair a screenshot with "STEP N" and 40 to 60 words (`DeaKbamCD58` row 24; `DeSYED-kUaZ` row 27). getintoai puts one step per page: a bold instruction, the prompt, one line of why (`DfR2CJ8E-Ux` row 238; `DfSPKgwEwxF` row 236). evolving.ai crams three prompts onto a page at around 120 words (`Dey1P3MAMcz` row 124).
5. **The dense infographic** (syntaix.ai): 13 pages, each a GitHub screenshot with "WHAT IS IT / WHY IT MATTERS" panels at 100 to 140 words, closing on "COMMENT 'MOTION' AND I'LL SEND YOU ALL 10 LINKS" (`DfNN283EnxG` row 244; `De7HzFpCUDL` row 247). This is the counter-example for a 3-second read.

### Words per slide

Median OCR words on inside pages: evolving.ai 37, getintoai 41, The Rundown 128, syntaix.ai 139 (all 71 readable carousels: median 61, quartiles 27 and 136). These counts include text inside screenshots, so the overlay copy is much shorter. The cleanest overlay lines in the sheet:

- 5 to 12 words: "Tons of useful tools. All free." / "10,000+ free courses, with certificates." / "Turn any text into a podcast and learn faster." (`DfM0PZdgLr0`, row 210)
- 6 to 10 words per page across 19 pages (`DeeqU7IgMmh`, row 40)
- 11 words: "Argon built a Minecraft clone in 19 minutes for about $3" (row 39)
- 13 words over a stock photo: "A small drop for a giant: Nvidia lost about $185 billion in market value" (`DfIaM_ygLxI`, row 218)
- 14 to 16 words: "Free local channels in HD, forever. YouTube TV charges $82.99 a month for the same networks." (`DfR9kIEk0d_`, row 237)

### Visual devices

- **Screenshots of the primary source:** 35 of 71. The overlay line explains; the screenshot proves.
- **Big numbers:** 43 of 71 covers carry one; whole slides are built on a number (`DfRgKNRAFaA` row 206, Stack Overflow questions 119,730 to 24,732 to 986; `DfIaM_ygLxI` row 218, one falling stock and one figure per page).
- **Product or face photo per list item:** every numbered list above.
- **Before and after or versus:** rare, 5 of 71 (for example cleanyourtv's BEFORE/AFTER home screen inside `DfJ7J80ieCr`, row 245).
- **Wordmark:** evolving.ai and syntaix.ai stamp the account name on every page; The Rundown stamps "AI NEWS" or "AI GUIDES".

### How the last slide closes

At least 34 of the 71 readable carousels end on a growth ask: evolving.ai's "Join the #1 AI Newsletter in the world" page (16), The Rundown's "Join The Rundown's AI newsletter FREE, 2,000,000+ subscribers" page (12), syntaix.ai's "comment for the links" page (4), getintoai's "WE SHARE EVERYTHING HAPPENING IN THE WORLD OF AI & TECH" page (2). Most of the rest end on content because the last page failed to OCR. **No carousel in the sheet closes on a takeaway.** Where a takeaway exists, it sits on the second-to-last page: "The most alarming part is that these security flaws had existed for over a decade" (`DewxpImgHJr` page 9); "The researchers believe this could one day let AI find hidden problems in other models" (`DfSJYPjgLe8` page 8). That gap is the opening for makeyourmindup: close on the takeaway and the wordmark, and put the follow ask in the caption.

---

## 3. The makeyourmindup 3-second carousel format

**The test:** a stranger swipes cover to close in about 3 seconds, roughly half a second a slide, and can say the story back in one sentence. Every rule below serves that.

### Hard numbers

| Rule | Number |
|---|---|
| Slides | **4 to 7.** Cover, 3 to 5 inside slides, close. Default 6. |
| Words, cover headline | **10 or fewer** (50 characters or fewer), in one of his `TITLES.md` shapes |
| Words, cover dek | **8 or fewer**, one line, optional |
| Words, inside glance line | **8 or fewer** (44 characters or fewer). This line alone must carry the slide. |
| Words, inside support line | **12 or fewer**, optional, skippable |
| Words, any inside slide in total | **15 maximum**, counting every overlay word the reader needs (glance line, support line, labels, a typed prompt); the step counter, the source credit, the site and text inside a screenshot do not count |
| Words, close | **10 or fewer** for the takeaway, plus the wordmark and the site |
| Words, whole carousel inside slides | **50 or fewer** across all inside slides |
| Type, cover headline | **120 px minimum** at 1080 wide (about 43 pt on a phone) |
| Type, inside glance line | **96 px minimum** (about 34 pt) |
| Type, a big number | **200 px minimum** |
| Type, support line and prompts | **44 px minimum** (about 16 pt); prompts in quotation marks may drop to 40 px |
| Type, credits, counters, site | **34 px minimum** (about 12 pt), and only for words the story does not depend on |
| Type, absolute floor | **Nothing below 34 px anywhere** |
| Visuals | **One dominant visual per slide**, covering at least half the slide |
| Canvas | 1080 x 1350 (4:5), as the templates already are |

(Phone sizes assume Instagram shows 1080 px across about 390 pt, a factor of roughly 2.8.)

### The cover

- **Hook in his shapes from `TITLES.md`**: who is doing what to whom, statement then twist, repetition then question, the reveal, the big binary, what happens next for you, the order of events with the real number, taken apart. Name the real thing as people search it; lead with the most dramatic true claim; use a physical verb. The words are always his pick.
- **One hero visual**: the story scene (Style 1) in the upper band, a face or the moment itself where possible. The real source logo is the only second element allowed, and it stays small.
- **The wordmark**: the right-aligned V4 the cover templates already place.
- **No swipe cue in words.** The sheet's swipe cues (22 of 71) spend words on an instruction the reader already knows; the picture breaking into slide 2 does that job.
- A number on the cover whenever the story has one (43 of 71 competitor covers do).

### The inside slides (3 to 5)

- **One idea per slide.** If a slide needs "and", it is two slides or one cut.
- **Statements, never questions.** Each slide answers. The question lives on the cover or in the caption.
- **One visual per slide, chosen by job:**
  - a **big number** when the story has a figure (the number is the headline);
  - a **screenshot** when the claim needs proof (crop to the one sentence or figure that matters, enlarged so its own text renders at 34 px or more);
  - a **face or the moment** when the story is about a person;
  - **before and after** only when the change is visible in one frame.
- **Slide 2 stands alone.** Instagram re-shows an unswiped carousel starting at slide 2, so slide 2 must work for someone who never saw the cover: it carries the answer (the number or the claim plus its proof), names the subject, and uses no "this", "it" or "as above". The test: cover slide 1 with your hand; slide 2 still tells the story.
- **Order:** answer first (slide 2), proof (slide 3), consequence (slide 4), what it means for the reader (slide 5, optional).

### The close

- **The takeaway in his words**, 10 words or fewer, set large (72 px or more). It is the sentence the reader should repeat.
- **The wordmark** (the S3h mark the close templates already place) and the site.
- **No new fact**, no newsletter page, no "comment for the link". The follow ask goes in the caption.

### The 3-second check before export

1. Read only the glance lines, in order. Do they tell the story? If not, rewrite them.
2. Count words per slide (15 maximum) and across the inside slides (50 maximum).
3. Cover the cover. Does slide 2 make sense?
4. Shrink the slide to phone size. Is any word you need smaller than 96 px (glance) or 44 px (support)? Is any word anywhere below 34 px?
5. Does every slide have exactly one thing to look at first?

---

## 4. Mapping onto `library.json`

All `carousel-*` items are 1080 x 1350. The content contract already refuses rather than truncates ("Text over max_chars or exceeding max_lines at the minimum size is refused"), so lowering `max_chars` and raising `min_size_px` makes the system enforce this format by itself.

### What the four sets do today, and what changes

**`piece`** (cover, why-1, document, why-2, chart, why-3, landing, close): **8 slides, over the 7 maximum.** Its sample copy shows the problem: slide 2 is "Why 1: Why cut the intro?", a question with no answer, so it fails the slide-2 test; the answer arrives on slide 3; two more "why" slides ask further questions; the close says "Follow for more" with no takeaway.

- New order: cover, **chart** (slide 2: the number answers the question), **document** (proof), **why-3** reworded as a statement (consequence), **why-1** reworded as a statement (what it means for you), close. 6 slides.
- **Drop `carousel-why-2`** from the set.
- **Merge `carousel-landing` into the close**: its "insight" becomes the close takeaway; its open question ("What changes before a play counts?") moves to the caption.
- Rewrite the `use` of the why templates: the label is no longer "Why 1/2/3" and the headline is an answer, never a question.

**`good-news`** (cover, 5 items, close): 7 slides, at the ceiling, so it stays, but each item slide carries about 30 words today (headline 13 to 20 words, body 12 to 17). Cut each to a glance line of 8 words or fewer and, only where it adds a name or a date, one support line. Four items is the default (worked example B shows why); five only when most support lines go. The close keeps its five thumbnails (a good recap device) and gains a takeaway.

**`simple-advice`** (cover, item, close): already close to the format; the sample item ("Try this / Time the intro / Stop when the singing starts.") is 9 words. Repeat the item 3 to 5 times, never more; give the close a takeaway.

**`how-to`** (how-to cover, step, simple-advice close): the step template holds a counter, a "Works in" label, tool logos, a screenshot, a background photo, a prompt and **three** numbered steps, about 45 words, and the sample counter reads "01 / 10". Change to **one step per slide**, 3 to 5 steps, counter never above "05", the screenshot as the dominant visual and the background photo demoted to tone (or removed).

**`explainer`, `quiz`, `meme`** (not in scope, noted for consistency): apply the same type floors. `carousel-body`'s `use` caps it at 20 words; lower that to 8 to match the glance-line rule (its 45-character limit already sits close to 8 words). `carousel-versus` has seven text slots; keep the two counts as the headline-sized elements and the rest at the 34 px floor.

### Proposed slot limits

Current values are as found in `library.json` on 26 Nov 2026. Sizes are px at 1080 wide.

**Covers** (`carousel-cover`, `carousel-good-news-cover`, `carousel-good-news-roundup-cover`, `carousel-simple-advice-cover`, `carousel-howto-cover`)

| Slot | Now: max_chars / max_lines / min to max px | Proposed |
|---|---|---|
| headline_1 | 66 / 3 / 33 to 212 | **50 / 3 / 120 to 212** |
| body_1 (dek) | 83 / 2 / 36 to 42 | **45 / 1 / 44 to 56, optional** |

**`carousel-why-1`, `-why-2`, `-why-3`**

| Slot | Now | Proposed |
|---|---|---|
| label_1 | 32 / 3 / 33 to 36 | **12 / 1 / 36 to 44, optional** (a kicker such as "SO" or "FOR YOU", never "Why 1") |
| headline_1 | 32 to 35 / 3 / 33 to 500 | **40 / 3 / 96 to 500**, a statement |

**`carousel-document`**

| Slot | Now | Proposed |
|---|---|---|
| headline_1 | 35 / 3 / 33 to 427.5 | **40 / 2 / 96 to 427.5** |
| document_1 | registered source crop | crop to one sentence or one figure; **at least 55% of slide height**; quoted text renders at 34 px or more |

**`carousel-chart`** (becomes slide 2 of `piece`)

| Slot | Now | Proposed |
|---|---|---|
| label_1 | 70 / 2 / 33 to 34 | **44 / 2 / 56 to 72**, the glance line that says what the number means |
| headline_1 (the number) | 70 / 2 / 33 to 313 | **16 / 2 / 200 to 313** |
| label_4 (source) | 70 / 2 / 33 to 34 | **40 / 1 / 34 to 38** |

**`carousel-landing`** (if kept outside `piece`)

| Slot | Now | Proposed |
|---|---|---|
| body_1 | 50 / 3 / 33 to 180 | **44 / 2 / 72 to 180** |
| body_2 | 46 / 4 / 36 to 52 | **remove** (the open question belongs in the caption) |

**Closes** (`carousel-close`, `carousel-good-news-close`, `carousel-simple-advice-close`)

| Slot | Now | Proposed |
|---|---|---|
| body_1 | 32 / 1 / 36 to 60, holds "Follow for more" | **44 / 2 / 72 to 120**, holds the takeaway |
| label_1 (site) | 32 / 1 / 26 to 38 | **32 / 1 / 34 to 38** |

**`carousel-good-news-item`, `-item-2` to `-item-5`**

| Slot | Now | Proposed |
|---|---|---|
| headline_1 | 91 to 125 / 3 / 35 to 367 | **44 / 2 / 96 to 367** |
| body_1 | 109 / 5 / 36 to 44 | **70 / 2 / 44 to 52** |
| photo_1 | licensed story photo | unchanged; it is the one visual, a face where the story has one |

**`carousel-simple-advice-item`**

| Slot | Now | Proposed |
|---|---|---|
| label_1 | 32 / 3 / 33 to 34 | **12 / 1 / 36 to 44** ("TRY THIS", "01") |
| headline_1 | 32 / 3 / 35 to 317 | **36 / 2 / 96 to 317** |
| body_1 | 32 / 4 / 36 to 44 | **56 / 2 / 44 to 52** |

**`carousel-howto-step`**

| Slot | Now | Proposed |
|---|---|---|
| counter | 12 / 1 / 33 to 45 | **7 / 1 / 34 to 45**, never above "05 / 05" |
| works | 12 / 1 / 33 to 34 | **12 / 1 / 34 to 38** |
| tools | registered tool marks | unchanged, small |
| screenshot_1 | source pixels | **the dominant visual, at least 55% of slide height** |
| photo_1 | 4:5 full-bleed photo | demote to a dark tone behind the screenshot, or remove |
| number_1 + step_1 | 2 / 1 / 33 to 34 and 67 / 2 / 36 to 42 | **merge into one step headline: 44 / 2 / 88 to 160**, number included ("01 Find every site selling you") |
| prompt | 86 / 2 / 36 to 44 | **40 / 1 / 40 to 48, optional**, 5 words or fewer; longer prompts show typed in the screenshot and go in the caption |
| number_2, step_2, number_3, step_3 | as step_1 | **remove** (one step per slide) |

---

## 5. Three worked examples

Cover words are review samples in his shapes from `TITLES.md`; the live words are always his pick. Facts marked "check" must be confirmed against the piece's own source before use.

### A. "Why did pop songs get shorter?" (set: `piece`, 6 slides)

| # | Template | Visual | Words on the slide |
|---|---|---|---|
| 1 | `carousel-cover` | Hero: thumb on the skip button, sofa scene (`ph-sofa-wide`); Spotify logo small | Headline (who did what to whom): **"Spotify's 30-second rule is shrinking song intros."** (7 words, 50 characters). Dek: "Why did pop songs get shorter?" (6). V4 wordmark. |
| 2 | `carousel-chart` | Big number on the threshold bar | Number: **30 SECONDS**. Glance line: **"A play only counts after 30 seconds."** (7). Source: "Spotify for Artists". Stands alone: subject, number and rule are all on the slide. |
| 3 | `carousel-document` | Screenshot: Spotify's own stream definition, cropped to the one sentence | **"Skip early and the play never counts."** (7) |
| 4 | `carousel-why-3` | Studio photo (`ph-studio`) | Kicker "SO". **"Songs now open on the hook."** (6). Check: if an intro-length figure is used in the support line, cite the piece's source. |
| 5 | `carousel-why-1` | Thumb on skip, close up (`ph-skip-thumb`) | Kicker "FOR YOU". **"Your skip decides if the artist gets paid."** (8) |
| 6 | `carousel-close` | S3h mark | Takeaway: **"Hook them in 30 seconds or lose the play."** (9 words, 41 characters). Site. |

Inside words: 33 including kickers and the number. Caption carries the open question ("What changes before a play counts?") and the follow ask.

### B. Good-news roundup (set: `good-news`, 7 slides, using the five stories already in the library)

| # | Template | Visual | Words on the slide |
|---|---|---|---|
| 1 | `carousel-good-news-cover` | Hero: the Vocality story photo | Headline (the order of events, shortened from the library's own line): **"AI helped people speak, sign and get around."** (8 words, 44 characters). Dek: "Five good-news stories this week." (5). V4 wordmark. |
| 2 | `carousel-good-news-item` | Her face (licensed story photo) | **"ALS took her voice. AI gave it back."** (8). Support: "Vocality rebuilt it from recordings of her talking." (8). Stands alone: who, what, how. |
| 3 | `carousel-good-news-item-2` | Parent and child signing | **"An app turns speech into signs and back."** (8). Support: "Thatsign, in testing, is for hearing parents of deaf children." (10) |
| 4 | `carousel-good-news-item-3` | Glide in use on a pavement | **"Glide steers blind people around obstacles."** (6). Support: "Now reaching its first customers." (5) |
| 5 | `carousel-good-news-item-4` | The glasses on a wearer | **"Google's glasses read small print to blind wearers."** (8). Support: "Guided Vision goes on sale on 10 December." (8) |
| 6 | `carousel-good-news-item-5` | The founder's face | **"Blind people can now read their bank statements."** (8). Support: "Yash Bhatnagar, 17, built Visionably. It reads about 95% of test PDFs." (12) |
| 7 | `carousel-good-news-close` | The five thumbnails | Takeaway: **"Speak, sign, move, read: five wins this week."** (8). S3h mark and site. |

Inside words: 81 across five items, which breaks the 50-word ceiling. Dropping the support lines on items 3 and 4 only brings it to 63. The recommended edit: run four items (drop Thatsign, the one still in testing) and keep support lines only where they add a date or a name (items 5 and 6). That gives 30 glance words plus 20 support words: exactly 50. A roundup is the one set where the ceiling bites first, so four items is its default. With Thatsign dropped, the cover headline becomes "AI helped people speak, read and get around." (8 words, 44 characters), the dek becomes "Four good-news stories this week." and the close takeaway becomes **"Speak, move, read: four wins this week."** (7).

### C. A how-to (set: `how-to`, 6 slides; source story: getintoai `DfR2CJ8E-Ux`, Posts row 238)

| # | Template | Visual | Words on the slide |
|---|---|---|---|
| 1 | `carousel-howto-cover` | Hero: a people-search results page with a home address blurred | Headline (statement, then twist): **"Your address is for sale. Claude files opt-outs."** (8 words, 48 characters). Dek: "Four prompts. Check each removal yourself." (6). V4 wordmark. |
| 2 | `carousel-howto-step` | Screenshot: Claude's chat with the typed prompt and its list of broker sites | Counter "01 / 04", "Works in" + Claude mark. **"01 Find every site selling your details."** (7). The prompt shows typed inside the screenshot and is repeated in the caption. Stands alone: the goal and the first action are both on it. |
| 3 | `carousel-howto-step` | Screenshot: the prompt and one drafted removal request | **"02 Have Claude write each removal request."** (6) |
| 4 | `carousel-howto-step` | Screenshot: Customize, Connectors, Google Chrome | **"03 Connect Chrome so Claude can submit them."** (7) |
| 5 | `carousel-howto-step` | Screenshot: a submitted opt-out form | **"04 Re-check weekly. Resubmit what gets ignored."** (6). Support: "Some removals still need you to confirm." (6) |
| 6 | `carousel-simple-advice-close` | S3h mark | Takeaway: **"Fewer sites selling you, one form at a time."** (9). Site. |

Inside words: 40 (step lines, the "Works in" label on each step, and the slide 5 support line; counters excluded). The heaviest slide, slide 5, holds 14. The prompts live inside the screenshots and in the caption; setting one as an overlay with the optional `prompt` slot would push most step slides past 15 words, so that slot is for a prompt of 5 words or fewer. The caveat on slide 5 keeps the post true to its source, which says manual verification may be needed and that permanent deletion cannot be guaranteed.
