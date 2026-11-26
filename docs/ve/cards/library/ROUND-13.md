# Round 13 · Review copy
All 40 named templates now have filled review samples. Four other templates drew bracketed copy from the renderer. The second beat of the meme video, both homepages and the partner credit now take their words from the item’s sample metadata. The production slot names and refusal stamps still apply.
## Scope of the change
| What changed | IDs or result |
| --- | --- |
| Named templates | All 40 are in the replacement ledger below. |
| Additional copy | `social-meme-video`, `web-desktop`, `web-mobile`, `future-partner`. |
| Embedded slide | `video-vertical-slideshow` depends on a good-news slide whose hidden photo brief changed. Its drawing matches the baseline. |
| Camera dependencies | `video-vertical-talking-head`, `video-vertical-split`, `video-vertical-pip`, `video-vertical-plate`, `video-wide-talking-head`, `video-wide-side-by-side`, `social-youtube-thumb-face`, `social-tall-cover-face`. The sponsor read is already in the named 40. |
| Total | 53 inputs selected by changed-only logic. 37 templates changed in the sampled drawings. The other 16 have matching drawings. The remaining 141 templates retain their input hashes. |

The camera slot has an explicitly empty review source. Its production path stays registered. Both the browser and native resolver treat an unbound source as missing and the existing DM Mono framing guide is drawn. No face was used.

The 35 active why cards, covers, how-to steps, closes and outros matched their pre-edit drawing hashes. Only the specifically named good-news close had an item-record edit in that group. Its five hidden photo briefs and their references changed. The closing photograph strip, signature and type are identical.
## Evidence and editorial choices
The quiz asks when a Spotify play counts. The quote cards reproduce a continuous phrase from the actual Spotify document. The versus cards compare staying with an intro and skipping to another track. The poll question and result show the same two choices. There is no vote total, percentage or winner.

The weekly sample uses the title and two angles from the filed music investigation. Its six short news entries draw on the five reports in the 21 November research, grouped under finding your voice, sign language, getting around and reading small print. Vocality has two separately attributed findings. The checked date is 18 November, the date of the research pass. The source links are on the individual entries.

The YouTube samples retain the full tagged subscribe URL. The printed line can wrap at the slash before “subscribe”. The pinned example’s slot accommodates the complete address. The displayed platform budgets remain 240 and 5,000 characters. Chapters show the verified opening at 0:00. The material supplies no second chapter time. The event and commercial samples use a listening exercise and an illustrative read, with no invented booking or sponsor.
## Replacement ledger
Each entry gives the original field, its review text and its evidence. Repeated entries cover separate slots, rendered copies or motion metadata. The five supporting label changes are included alongside the 90 fields that contained bracketed copy. The source key and filed location are also recorded in each item’s `sample.sources`.

### video-vertical-place

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Where it happened]` | `United States` | [INTRO](#intro) |

### video-vertical-creative-work

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Title of the work]` | `How your streams are counted` | [SP](#sp) |
| `scene.headline_1.display_lines` | `[Title of` / `the work]` | `How your streams` / `are counted` | [SP](#sp) |

### video-vertical-challenger

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Alternative explanation]` | `Did attention spans shrink?` | [ATTENTION](#attention) |

### video-wide-place

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Where it happened]` | `United States` | [INTRO](#intro) |
| `scene.label_1` | `[Source and date]` | `Musicae Scientiae / 2018` | [INTRO](#intro) |

### video-wide-creative-work

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Title of the work]` | `How your streams are counted` | [SP](#sp) |
| `scene.label_1` | `[Source and date]` | `Spotify for Artists / Nov 2026` | [SP](#sp) |

### video-wide-challenger

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Alternative explanation]` | `Did attention spans shrink?` | [ATTENTION](#attention) |

### video-vertical-quote

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Exact words from the source]` | `“for at least 30 seconds”` | [SP](#sp) |

### video-wide-quote

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Exact words from the source]` | `“for at least 30 seconds”` | [SP](#sp) |

### social-quote

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Exact words from the source]` | `“for at least 30 seconds”` | [SP](#sp) |

### future-deck-quote

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Exact words from the source]` | `“for at least 30 seconds”` | [SP](#sp) |

### carousel-good-news-item

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `Anne-Marie Poirier with her iPad and the Vocality founders.` | [N1](#n1) |

### carousel-good-news-close

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `Anne-Marie Poirier with her iPad and the Vocality founders.` | [N1](#n1) |
| `photo_2.scene_brief` | `[The specific moment or object in this slide’s story.]` | `Confidence Ugolo at the Thatsign dashboard.` | [N2](#n2) |
| `photo_3.scene_brief` | `[The specific moment or object in this slide’s story.]` | `A person walking with Glide, holding its handle.` | [N3](#n3) |
| `photo_4.scene_brief` | `[The specific moment or object in this slide’s story.]` | `A wearer of Google’s glasses in the filed Google photograph.` | [N4](#n4) |
| `photo_5.scene_brief` | `[The specific moment or object in this slide’s story.]` | `The filed Visionably photograph from The Better India.` | [N5](#n5) |

### carousel-good-news-item-2

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `Confidence Ugolo at the Thatsign dashboard.` | [N2](#n2) |

### carousel-good-news-item-3

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `A person walking with Glide, holding its handle.` | [N3](#n3) |

### carousel-good-news-item-4

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `A wearer of Google’s glasses in the filed Google photograph.` | [N4](#n4) |

### carousel-good-news-item-5

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `The filed Visionably photograph from The Better India.` | [N5](#n5) |

### carousel-simple-advice-item

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.label_1` | `Step [number]` | `Try this` | [EXAMPLE](#example) |
| `scene.headline_1` | `[One thing to try]` | `Time the intro` | [EXAMPLE](#example) |
| `scene.body_1` | `[How to do it]` | `Stop when the singing starts.` | [EXAMPLE](#example) |

### social-versus

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[What the counts measure]` | `Do you stay for the intro?` | [EXAMPLE](#example) |
| `scene.label_1` | `[Logo A]` | `First listen` | [EXAMPLE](#example) |
| `scene.headline_2` | `[Count]` | `Play on` | [EXAMPLE](#example) |
| `scene.body_1` | `[Name]` | `Wait for the voice.` | [EXAMPLE](#example) |
| `scene.label_2` | `[Logo B]` | `Next track` | [EXAMPLE](#example) |
| `scene.headline_3` | `[Count]` | `Skip ahead` | [EXAMPLE](#example) |
| `scene.body_2` | `[Name]` | `Try another song.` | [EXAMPLE](#example) |

### carousel-versus

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[What the counts measure]` | `Do you stay for the intro?` | [EXAMPLE](#example) |
| `scene.label_1` | `[Logo A]` | `First listen` | [EXAMPLE](#example) |
| `scene.headline_2` | `[Count]` | `Play on` | [EXAMPLE](#example) |
| `scene.body_1` | `[Name]` | `Wait for the voice.` | [EXAMPLE](#example) |
| `scene.label_2` | `[Logo B]` | `Next track` | [EXAMPLE](#example) |
| `scene.headline_3` | `[Count]` | `Skip ahead` | [EXAMPLE](#example) |
| `scene.body_2` | `[Name]` | `Try another song.` | [EXAMPLE](#example) |

### social-poll-question

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Option A]  /  [Option B]` | `In the intro / After the chorus` | [EXAMPLE](#example) |

### social-poll-result

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.label_1` | `The result` | `Your call` | [EXAMPLE](#example) |
| `scene.headline_1` | `[Winning option]` | `When do you skip a song?` | [EXAMPLE](#example) |
| `scene.body_1` | `[Verified votes and share]` | `In the intro / After the chorus` | [EXAMPLE](#example) |

### social-poll-frame

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Native poll zone]` | `In the intro / After the chorus` | [EXAMPLE](#example) |

### podcast-audiogram

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Recorded excerpt]` | `A stream counts at 30 seconds.` | [SP](#sp) |
| `motion.excerpt.slot` | `[Recorded excerpt]` | `A stream counts at 30 seconds.` | [SP](#sp) |

### podcast-audiogram-square

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Recorded excerpt]` | `A stream counts at 30 seconds.` | [SP](#sp) |
| `motion.excerpt.slot` | `[Recorded excerpt]` | `A stream counts at 30 seconds.` | [SP](#sp) |

### podcast-audiogram-wide

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Recorded excerpt]` | `A stream counts at 30 seconds.` | [SP](#sp) |
| `motion.excerpt.slot` | `[Recorded excerpt]` | `A stream counts at 30 seconds.` | [SP](#sp) |

### future-press-kit

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[Audience and press contact]` | `For music readers. makeyourmindup.ai` | [EXAMPLE](#example), [LINK](#link) |

### future-event

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.label_1` | `[Date and venue]` | `A listening exercise` | [EXAMPLE](#example) |
| `scene.headline_1` | `[Event title]` | `Listen to the intro` | [EXAMPLE](#example) |
| `scene.body_1` | `[Booking details]` | `Pick a track and press play.` | [EXAMPLE](#example) |

### newsletter-figure-map

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[Where the plays came from]` | `Where people use Vocality` | [N1](#n1) |
| `scene.body_1` | `[Territory]` | `North America` | [N1](#n1) |
| `scene.label_1` | `[Streams per territory]` | `Over 100 daily users` | [N1](#n1) |
| `scene.label_2` | `Natural Earth 1:110m / [Data source and date]` | `Canadian Press, 11 Nov 2026 / Natural Earth 1:110m` | [N1](#n1), [MAP](#map) |

### newsletter-welcome-email

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[First article link]` | `Why did pop songs get shorter?` | [TITLE](#title) |

### newsletter-paid-welcome

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_1` | `[How to request your teardown]` | `Reply with a claim to check.` | [EXAMPLE](#example) |

### carousel-body

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[One sentence about what changed]` | `US top-ten intros got shorter.` | [INTRO](#intro) |

### carousel-meme

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `The filed photograph of a record beside a phone.` | [GUIDE](#guide) |

### carousel-quiz-question

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `The timer in the filed Spotify listening example.` | [GUIDE](#guide) |
| `scene.label_2` | `A` | `At 30 seconds` | [SP](#sp) |
| `scene.label_3` | `B` | `At the end` | [EXAMPLE](#example) |
| `scene.label_1` | `Spot the AI` | `Spotify quiz` | [SP](#sp) |
| `scene.headline_1` | `[Quiz question]` | `When does a Spotify play count?` | [SP](#sp) |

### carousel-quiz-answer

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `photo_1.scene_brief` | `[The specific moment or object in this slide’s story.]` | `The timer in the filed Spotify listening example.` | [GUIDE](#guide) |
| `scene.label_2` | `[First image]` | `At 30 seconds` | [SP](#sp) |
| `scene.label_3` | `[Second image]` | `At the end` | [EXAMPLE](#example) |
| `scene.headline_1` | `[Verified answer]` | `After 30 seconds of listening.` | [SP](#sp) |

### copy-yt-description

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_2` | `Why did pop songs get shorter?` <br> `[Tagged subscribe link]` <br> `Spotify for Artists, “How your streams are counted”` | `Why did pop songs get shorter?` <br> `https://home.makeyourmindup.ai/subscribe?utm_source=youtube` <br> `Spotify for Artists, “How your streams are counted”` | [LINK](#link), [TITLE](#title), [SP](#sp) |

### copy-yt-pinned

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_2` | `When do you skip a song?` <br> `[Tagged subscribe link]` | `When do you skip a song?` <br> `https://home.makeyourmindup.ai/subscribe?utm_source=youtube` | [LINK](#link), [EXAMPLE](#example) |

### copy-chapters

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.body_2` | `0:00 Why did pop songs get shorter?` <br> `[Time] When does a play count?` | `0:00 Why did pop songs get shorter?` | [CUT](#cut), [TITLE](#title) |

### future-desk-teardown

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.headline_1` | `[The claim under review]` | `When does a play count?` | [SP](#sp) |
| `scene.body_1` | `[Evidence, verdict and next action]` | `Spotify sets the threshold at 30 seconds.` | [SP](#sp) |

### future-sponsor-read

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `scene.label_1` | `Partner read` | `Illustrative read` | [EXAMPLE](#example) |
| `scene.headline_1` | `[Partner contribution]` | `Before the music starts` | [EXAMPLE](#example) |
| `scene.body_1` | `[Approved spoken disclosure]` | `Listen for the first voice on the track.` | [EXAMPLE](#example) |

### social-meme-video

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `sample.payoff` | `[The pay-off]` | `Get to the chorus.` | [EXAMPLE](#example) |

### future-partner

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `sample.credit` | `[Partner name and contribution]` | `Independent editorial example` | [EXAMPLE](#example) |

### web-desktop

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `sample.headlines.1` | `[Second piece]` | `When does a play count?` | [SP](#sp) |
| `sample.headlines.2` | `[Third piece]` | `Why cut the intro?` | [INTRO](#intro) |

### web-mobile

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `sample.headlines.1` | `[Second piece]` | `When does a play count?` | [SP](#sp) |
| `sample.headlines.2` | `[Third piece]` | `Why cut the intro?` | [INTRO](#intro) |

### newsletter-weekly-edition

| Field | Previous | Review text | Source |
| --- | --- | --- | --- |
| `pieces.1.title` | `[Second piece]` | `Why cut the intro?` | [INTRO](#intro) |
| `pieces.1.summary` | `[Summary of the second piece]` | `US top-ten intros averaged five seconds in 2015.` | [INTRO](#intro) |
| `pieces.2.title` | `[Third piece]` | `How long is a hit?` | [LENGTH](#length) |
| `pieces.2.summary` | `[Summary of the third piece]` | `Fortune reported a Hot 100 average of three and a half minutes.` | [LENGTH](#length) |
| `scene.contents_pieces` | `Why did pop songs get shorter?` <br> `[Second piece]` <br> `[Third piece]` | `Why did pop songs get shorter?` <br> `Why cut the intro?` <br> `How long is a hit?` | [TITLE](#title), [INTRO](#intro), [LENGTH](#length) |
| `scene.piece_1` | `[Second piece]` | `Why cut the intro?` | [INTRO](#intro) |
| `scene.summary_1` | `[Summary of the second piece]` | `US top-ten intros averaged five seconds in 2015.` | [INTRO](#intro) |
| `scene.piece_2` | `[Third piece]` | `How long is a hit?` | [LENGTH](#length) |
| `scene.summary_2` | `[Summary of the third piece]` | `Fortune reported a Hot 100 average of three and a half minutes.` | [LENGTH](#length) |

## Source key

### SP

Spotify for Artists, How your streams are counted. The filed document is .scratch/why-ladder/assets/m-spotify.png. The verbatim line is transcribed in docs/ve/cards/library/FIXES-1.md under spotify-song-stream. [0](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### INTRO

Musicae Scientiae (2018). The filed series measures average intro length in US top-ten hits, 1986 and 2015. [plate](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### ATTENTION

TIME, May 2015. The piece parks the attention-span hypothesis as open. [challenger](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### LENGTH

Fortune, January 2019. The filed plate gives the Hot 100 average as 3:30. [2](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### TITLE

Filed title of the pop-songs piece. [piece.json#title](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### EXAMPLE

Illustrative editorial copy about listening. No survey, booking, sponsorship or recording is asserted. [piece.json](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### LINK

House subscribe destination. The sample tags identify the channel. [library.json#profile-bio.subscribe_url](library.json)

### MAP

Filed Natural Earth basemap, 1:110 million. [library.json#geography](library.json)

### CUT

The review cut opens at frame zero. The piece has no filed chapter timestamp for a second cue. [library.json#sequences.long.shots](library.json)

### GUIDE

The filed record-and-phone and timer stills from the Spotify example. [ground](../../../../docs/ve/cards/why-ladder-evo/piece.json)

### N1

Story 1. The Canadian Press via MTL Blog, 11 Nov 2026 · https://www.mtlblog.com/woman-with-als-hears-her-own-voice-again [research.md#the-five-stories](../../../../docs/plans/2026-11-16-week/goodnews-carousel/research.md)

### N2

Story 2. Techpoint Africa, 12 Nov 2026 · https://techpoint.africa/feature/thatsign-to-bridge-communication-gap/ [research.md#the-five-stories](../../../../docs/plans/2026-11-16-week/goodnews-carousel/research.md)

### N3

Story 3. Glidance, 10 Nov 2026 · https://www.glidance.io/news/glide-wins-2027-ces-innovation-awards-in-two-categories [research.md#the-five-stories](../../../../docs/plans/2026-11-16-week/goodnews-carousel/research.md)

### N4

Story 4. Google, 12 Nov 2026 · https://blog.google/innovation-and-ai/technology/xr-ar/google-intelligent-eyewear-collections-pre-order/ [research.md#the-five-stories](../../../../docs/plans/2026-11-16-week/goodnews-carousel/research.md)

### N5

Story 5. The Better India, 16 Nov 2026 · https://thebetterindia.com/innovation/ai-tool-makes-pdfs-accessible-for-the-blind-gurugram-visionably-yash-bhatnagar-12814698 [research.md#the-five-stories](../../../../docs/plans/2026-11-16-week/goodnews-carousel/research.md)

## Verification

The pre-edit registry and HTML matched the Round 12 handoff hashes. The host had 194 existing native PNGs and no production render manifest. The comparison ran the `render.py --changed` input planner against both source revisions, then used its output-hash check on the existing host files. Both renderer plans selected the same IDs. The planner traces conditional motion arms separately so editing the meme’s second beat does not invalidate every template with text. The comparison used the same planner on both revisions. No production manifest or export was replaced.

The static gate checked all 194 items, their normal sheet previews, the embedded registry, four sequences and 390 spacing pairs. The copy gate examines rendered SVG text and scans the stored samples, including split display lines, image briefs and excerpt metadata. A separate pass checked every one of the 19,992 frames in the 58 motion items. Only the two DM Mono camera labels are permitted to contain brackets.

The 53 selected templates were captured locally with resvg at native size. All 53 passed, including 126 measured spacing pairs. The native ink alignment, spacing, fit and composition results are in the [per-template proof](.scratch/round-13/native-results.json). The [scope comparison](.scratch/round-13/scope.json) lists every selected input, visible change and frozen template. Both lock regression tests passed. No browser was launched. Chromium visual acceptance remains with the host. The production approval ledger has zero locks.
