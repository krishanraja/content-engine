# Round 10 · The climb, the sign-off and the carousel

The Library has 193 active templates. The two additions are `carousel-howto-cover` and `carousel-howto-step`. The [360 px review sheet](ROUND-10-proof.jpg) shows all six video why cards with their sheet captions, the covers, and the how-to from opening card to CTA.

## Why cards and colour fields

Across 51 publication frames, the photograph occupies the upper 53% and burns into that frame’s stock. The two-image quiz uses two equal upper apertures. Evidence frames keep the real document at full brightness above the photographic ground. The Story action preserves the link-sticker zone.

On all six video why cards the painted question ends 8 native pixels above the caption band. WHY and the question share the same left edge. These widths and bottom rows were measured by removing the question from the native raster and subtracting the two images.

| Question | Portrait width occupied | Portrait bottom, px | Landscape width occupied | Landscape bottom, px |
| --- | ---: | ---: | ---: | ---: |
| Why 1 | 99.2% | 1294 | 99.6% | 834 |
| Why 2 | 98.4% | 1294 | 99% | 834 |
| Why 3 | 98.8% | 1294 | 99.4% | 834 |

## Outro playback

| Review clip | Native export | First settled frame, zero-based | Calm hold |
| --- | --- | ---: | ---: |
| [Vertical outro](media/outro-vertical.mp4) | 1080 × 1920, 50 frames | 30 | 20 frames |
| [Wide outro](media/outro-wide.mp4) | 1920 × 1080, 150 frames | 68 | 82 frames |

Coral, butter, lilac and mint rise in adjacent columns, then return to the four steps at the foot. MAKE rises first. YOUR opens around the landing D. MIND/ follows and UP comes in mint. The invitation and site each have their own masked entrance. The moves take 7 to 10 frames and use the house ease. The wide sweep spreads along the foot after it clears the end-screen elements.

Both clips are H.264, yuv420p, CRF 18 at 25 fps. The final uncompressed raster matched the corresponding close pixel for pixel, including a comparison with the S3h paths from the approved spine. Both reserved YouTube element rectangles matched the close through the wide animation. The host renderer can regenerate the motion from the registry tracks.

## Carousel production

The piece, advice, good-news and how-to covers each take a full-bleed Style 1 scene. The headline has a cream lead and a mint payoff in Anton, with a Fraunces dek, optional original logo and V4 at bottom right. The 21 November cover keeps its date and headline. All seven registered carousel sets start and end with a signed card.

The how-to step puts the counter and the original ChatGPT and Claude marks on ink. The mint edge surrounds two crops of Spotify’s actual support page, its heading and the complete song-stream definition. The digits in “30 seconds” paint at 34 px in the 1080-wide export. The quoted prompt and three numbered instructions fit below the screenshot.

All 28 carousel photo slots and all seven document, logo-row and screenshot slots have a numbered imagery style. Fifteen photo slots accept generation. The other thirteen photo slots take credited originals for good news, the meme and the real half of the quiz. Screenshot and logo slots take original evidence.

### Supplying the next piece

- Open **Image brief** on the carousel family sheet and describe the moment. **Show prompt** returns the slot’s house style, framing and 4:5 generation brief. The same brief is available from `node imagery.js carousel-howto-cover photo_1` in the Library directory.
- The production host can set `window.libraryImageGenerator` to its approved generator. **Generate image** then passes it the brief. Its result supplies `src`, `model`, `date` and numeric `credits`. The Library records the prompt and style, decodes the image, checks the aspect and resolution, and redraws the card. A producer can also call `window.generateCarouselImage(id, slot, scene, generate)` directly.
- For a repeatable host render, `python render.py --carousel-pack piece.json --phone` accepts a pack with `content` and `images` keyed by item ID and slot. Generated image records include `src`, `imagery_style`, `prompt`, `model`, `date`, `credits` and an optional normalised `focus` box. Licensed photo records use `src`, `source` and `credit`. The optional `evidence.tool_logos` and `evidence.screenshots` registries supply original assets for other tools or stories. File paths resolve relative to the pack.

The review sheet uses the house stills as photographic stand-ins. The producer handoff was exercised with a test generator. A live model was not run for this revision. The ImageGen skill’s default save location is outside the authorised Library directory.

## Changed artwork

The baseline is the Round 9 working registry, SHA-256 `5fd9b720c35b1f3444de2257c949503fad09f64fa87ff94e89a5ba8ef4ac6dc2`. Fifty-seven existing items changed at their first or settled SVG frame. The two additions bring the register below to 59. The other 134 existing items matched Round 9 at both endpoints.

| Family | Item IDs |
| --- | --- |
| video-vertical | `video-vertical-why-1`, `video-vertical-why-2`, `video-vertical-why-3`, `video-vertical-document`, `video-vertical-place`, `video-vertical-creative-work`, `video-vertical-quote`, `video-vertical-landing`, `video-vertical-rail`, `video-vertical-chapter`, `video-vertical-big-moment`, `video-vertical-number`, `video-vertical-outro`, `video-vertical-slideshow` |
| video-wide | `video-wide-why-1`, `video-wide-why-2`, `video-wide-why-3`, `video-wide-document`, `video-wide-place`, `video-wide-creative-work`, `video-wide-quote`, `video-wide-documented`, `video-wide-landing`, `video-wide-rail`, `video-wide-chapter`, `video-wide-big-moment`, `video-wide-number`, `video-wide-outro` |
| carousel | `carousel-cover`, `carousel-why-1`, `carousel-why-2`, `carousel-why-3`, `carousel-document`, `carousel-landing`, `carousel-good-news-cover`, `carousel-good-news-item`, `carousel-simple-advice-cover`, `carousel-explainer-step`, `carousel-quiz-question`, `carousel-quiz-answer`, `carousel-good-news-item-2`, `carousel-good-news-item-3`, `carousel-good-news-item-4`, `carousel-good-news-item-5`, `carousel-howto-cover`, `carousel-howto-step` |
| social | `social-quote`, `social-threads-text`, `social-ig-story-hook`, `social-ig-story-proof`, `social-ig-story-action`, `social-poll-frame`, `social-receipt` |
| newsletter | `newsletter-figure-document`, `newsletter-welcome-email`, `newsletter-paid-welcome` |
| future | `future-deck-document`, `future-deck-quote`, `future-event` |

## Checks

The browser-free verifier generated all 193 items at both endpoints, checked 392 declared ink gaps and exercised 1,351 stress previews. It checked complete captions or editorial silence across 2,263 sequence frames, including all 199 word onsets. The embedded registry matched the JSON file.

Local native raster checks covered the revised compositions, document lettering, question bounds, the settled closes and the YouTube exclusion zones. The lowest sampled contrast inside a solid glyph across the 56 revised still compositions was 3.10:1, on large placeholder type. The host’s browser render and Krish’s judgement of the motion and phone compositions remain pending.
