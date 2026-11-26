# Library v5

**Video vertical.** The title and three Why frames lead into five kinds of evidence. A labelled strength, source or parked challenge can sit between the evidence and the recap. Each keyframe caption gives its timing at 25 fps. The lower third, spoken captions and rail have individual exports.

**Video wide.** The same editorial sequence uses the full landscape canvas. The source crop retains the original logo and stream definition. The mint landing leaves room for the open question before the separate follow card.

**Carousel.** The core swipe sequence moves from the operating table through coral, butter and lilac to the answer. Good news and simple advice each have a cover, an item page and a close. Brackets identify the reporting needed for another edition.

**Social.** Covers share the photographic burn and aligned wordmark. The source document anchors the quote, number, comparison and poll treatments. The YouTube sheet includes a 168 px thumbnail proof. Reels, Stories and TikTok reserve space for their platform controls.

**Profile.** The D appears alone at avatar and icon sizes. The sheet shows circular avatar crops, square icon exports and the all-device guide on the YouTube banner. Four rising steps sit below S3h on ink. Highlight covers keep their photographic centre inside the circular crop.

**Podcast.** S3h uses the locked vector artwork, including the D inside YOUR. Its 300, 150 and 56 px proofs sit beside the full design. The episode variant sets the question below the name. The audiogram is a keyframe with an illustrative waveform and a slot for the recorded excerpt.

**Newsletter.** The 600 px edition opens with the V9 masthead, an introduction and a contents list. Three coloured rules separate the deep dives. Topic-grouped news and sources follow, with the closing line and subscription footer underneath. Header, cover, wordmark, social preview and two figure exports accompany the edition.

**Web.** Desktop and mobile each fit a masthead, subscription button, publication name, positioning line, three pieces and email field on one screen. The article gives the source its own reading space. The open-graph image pairs the question with a timer crop. These are design exports for approval.

**Email.** The compact signature sets the single-line V4 above the domain on grained ink.

**Future.** The five workshop slides cover the talk from opening question to closing takeaway. Press, partner, event, paid social and messaging placements have separate exports. On the merchandise proof the cream substrate carries an ink print panel for the wordmark.

## One-mark revision · 25 November 2026

One wordmark per artefact. The headline appears once per medium, where the medium introduces itself (bio, homepage, site), never on per-piece artefacts.

| Items changed | Placement |
| --- | --- |
| video-vertical-close, video-wide-close, carousel-close, carousel-good-news-close, carousel-simple-advice-close, future-deck-close, profile-youtube-endscreen | Small S3h below “Follow for more”. |
| profile-youtube-banner, profile-facebook-cover, profile-x-header, profile-linkedin-banner | S3h on grained ink within the content-safe area, above four rising steps. |
| profile-bio (new) | Selectable copy for Instagram, TikTok, X, LinkedIn, YouTube and the Substack homepage. Each entry has the approved headline followed by the linked subscription line. |
| web-desktop, web-mobile | D in the header, S3h in the hero, then the headline. These represent the same site at two sizes. |
| future-partner, future-merch-marks | One S3h in the partner artwork and one on the merchandise print panel. |

The registry records a wordmark count for all 122 items. The weekly edition retains one V9 masthead. The page checks the actual top-level SVG wordmark references and checks slot text before wrapping or uppercasing it. A standalone D counts as zero.

## Round two verification

The registry contains 121 templates across ten families. The six source photos were inspected at their native aspect ratio. Each template uses the same focal-box placement. When an aperture is too wide or narrow to cover with the original image while retaining the objects, the composition extends the photograph's edge pixels. This preserves the objects at the cost of a stretched background edge in extreme slots.

The Spotify crops are assembled from separate source rectangles for the logo and complete text lines. The narrow version wraps the first source line at a measured word space. All rectangle borders cleared the dark source glyphs in a pixel check. The document helper checks the smaller 22-pixel source line against the 28-pixel minimum, normalized to 1080 pixels wide.

Both video families now have one tagged evidence frame and a three-tag strip. The 4:5 and vertical feed titles reserve safe space for V4 below the final baseline. The weekly email uses its 32-pixel editorial gutters for its long reading canvas. The end-screen element guides appear only on its sheet.

Static generation exercised every item and preview, including focal-box and evidence-size assertions. The Anton headline geometry was checked with local font advances. A scan for uninterrupted full-width ink identified margins in the vertical close, avatars, YouTube banner and two newsletter mastheads. Their spacing was adjusted. Perceived dead space inside the source photography and optical alignment still require visual review.

The host renderer captures individual items sequentially, then composes sheets from downsampled copies of those captures. Its timeout is 180 seconds and the overflow assertion applies to every output. Browser screenshot completion remains unverified in this workspace. The permitted WebKit check stopped at process launch with spawn EPERM. The host should confirm all ten family sheets, particularly podcast, newsletter, web, email and future.

## Round three

V4 clears the final headline baseline by half its fitted height. The clip cover finishes its burn before the headline, and the article places its Fraunces dek directly below the title with V9 in the header. Episode art pairs S3h with the cream episode question on ink. The six closing cards carry ink to the bottom edge. Host visual review remains pending, including episode readability at 56 px.

## Weekly content and edge cases

The 121 templates use 36 canvas sizes. Each canvas has 12 columns. At 1080 px wide the baseline is 8 px, the gutter is 16 px and the headline-to-V4 clear space is 16 px. All three scale with canvas width. The four outer margins are recorded in top, right, bottom, left order for each platform profile. For example, the vertical evidence frame at 1080 × 1920 uses 269, 234, 441 and 90 px. Templates of the same size can have different platform exclusion zones. The grid overlay shows the content columns, baselines and platform guides.

The registry declares 344 fillable slots across the library, including 70 photo apertures and 38 document apertures. Each text slot has its own character limit, one to three lines, native-pixel size bounds and fixed decrement. The layout preserves explicit line breaks and greedily wraps words at every candidate size. Over-limit text, unbreakable words and copy exceeding the available lines or height are refused. Fixed brand marks have no copy slot. Image slots use focal-box or source-crop rules. Their text limits are null. The offline HTML embeds the registry and the host renderer checks it against library.json.

For weekly content, set window.libraryContent before rendering, keyed by item ID and then by a slot name in that item's registry. A missing photo, an unrecognised photo name or an explicit null uses grained ink. The bright-photo fixture requires still-record-phone. A 70% ink layer under overlaid type gives calculated worst-case contrasts of 6.05:1 for cream and 4.99:1 for mint over white, before the lower burn adds further darkening.

### Template changes

- Every template with a headline, body, source or label now uses bounded fitting. Hero covers, social-clip-cover, podcast-audiogram and future-event share the V4 clearance. The clip cover uses the same focal crop and fallback as the other photo slots.
- All document, chart, place, creative-work, quote and strength-tag evidence layouts, including article figure variants, now share a left edge with their caption and source. The two chart layouts and newsletter figure chart reserve separate space for the threshold label and rule. The vertical and wide strength-tag layouts reserve space between the document, tag and headline.
- The three-line key quotation originally failed the legibility check in video-wide-document, video-wide-chart, video-wide-quote, video-wide-documented, newsletter-figure-chart, web-article, future-deck-section, future-deck-document and future-deck-quote. The document helper cuts at two measured word spaces and trims blank scan margins. When space is tight it can put the logo beside the quotation. The key-text floor stays at 28 px per 1080 px of canvas width.
- video-vertical-recap and video-wide-recap keep their rung numbers in single-character slots. Both caption frames route the copy through the fitter and retain the mint highlight on the default “30”. newsletter-weekly-edition aligns its contents list to its editorial gutter.

### Coverage and refusal

Real content is never truncated or ellipsed. The fitter refuses text over `max_chars` and text that still exceeds `max_lines` at the minimum size. A stress sheet marks the slot with a red REFUSED stamp. An individual export fails. The long fixture adds whole words in order while they fit, reserving one character for the final question mark when the default copy asks a question. Supplied slot text takes precedence over fixtures.

Use ?item=social-number&stress=numbers&grid=1 for an item, or ?view=social&stress=long&grid=1 for a family. The renderer queues 70 stress sheets, one for each family and case, with default-only item PNGs. A refusal names the slot and rule in red on a stress sheet. A failing individual export raises an error. Static brand artwork stays fixed during stress runs.

The in-memory check generated all 121 defaults and all 847 stress SVGs using advance widths and glyph heights from the local fonts. All seven fixtures passed without a designed refusal. An over-cap input separately exercised the refusal path. A second pass checked text against canvas edges and other text for default, short and long copy. These checks do not establish browser shaping or optical alignment. WebKit check-only stopped at process launch with spawn EPERM. The host still needs to capture and inspect the sheets, including the platform guides and photographic burns.

## Chromium text-fit repair

All 236 text slots changed their fit rule from `step down, reflow at minimum, refuse` to `wrap at measured width at each size, step down, refuse at minimum`. The character and line caps, minimum and maximum sizes, and fixed decrements retain their registry values.

After the fonts load, each item or sheet preview measures its lines inside its own SVG at its displayed scale. The probe inherits the Fraunces variation settings. SVG bounds account for horizontal overhang, and canvas glyph ascent and descent place each baseline inside the declared slot. Labels and sources use uppercase DM Mono with 0.04 em tracking. Fitting finishes before `window.ready` resolves. Both fitted text and refusal stamps identify the template and slot.

No template has a hard-coded stress refusal. A measured failure at the minimum size stamps the slot on a stress sheet and refuses an individual export. The previous host report covers five defaults and 55 stress sheets. The specific template and case pairs that now refuse still require the host render.
