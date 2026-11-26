# Round 9 · Captions, evidence, charts and profiles

The comparison starts from the host-reviewed Round 8 working tree. Its registry SHA-256 begins `df9d9841015a`. All 191 active items were compared at their first and settled frames. Eighteen items changed composition, and five further missing-camera exports lost their framing guide. The other 168 produced byte-identical SVG at both frames.

## Caption behaviour

The short opens with the complete question “Why did pop songs get shorter?” Each cue keeps its whole sentence on screen, across at most two lines. Only the emphasis follows the word onsets. A sheet uses the item's caption cue or a complete line from the sequence script. Closes, outros, statement closes and frames showing S3h have no house caption, including during a push from a signed slide.

| Sequence | Frames at 25 fps | Complete cues |
| --- | ---: | ---: |
| Short | 688 | 12 |
| Long | 825 | 13 |
| Off-day | 375 | 3 |
| Good news | 375 | 6 |

The four scripts group the former fragments into sentences. A few short and off-day lines and the good-news captions were condensed to fit the existing shots. The six good-news cues draw on the registered 21 November edition. The carousel's headlines, copy and five house stills retain their Round 8 values.

## Spotify document

Each proof uses pixels from the captured Spotify for Artists definition. The source wraps across three to five rows according to the reading column. The panel takes the full column, with a small inset matching the source background. The wide side-by-side uses the column beside the face. It is the registry's wide counterpart to the vertical split and inset-camera treatments.

The measurements below use the painted height of the digits in “30 seconds” in the settled, native-size raster. The floor is 33 px per 1080 px of frame width.

| Item | Document width, px | Painted digits, px | Per 1080 px |
| --- | ---: | ---: | ---: |
| `video-vertical-document` | 756 | 51 | 51 |
| `video-vertical-quote` | 756 | 51 | 51 |
| `video-vertical-split` | 900 | 62 | 62 |
| `video-vertical-pip` | 900 | 62 | 62 |
| `video-vertical-plate` | 900 | 62 | 62 |
| `video-wide-document` | 1632 | 89 | 50.1 |
| `video-wide-quote` | 1632 | 89 | 50.1 |
| `video-wide-side-by-side` | 976 | 78 | 43.9 |

## Threshold charts

“30 seconds” is the Anton headline inside the butter bar. The four DM Mono ticks run from 0 to 30 seconds. Bar coverage uses the full safe content height. Tick measurements use the smallest painted numeral height among the four ticks.

| Item | Painted bar height, px | Share of content height | Smallest tick, px per 1080 |
| --- | ---: | ---: | ---: |
| `video-vertical-chart` | 411 | 34% | 33 |
| `video-wide-chart` | 312 | 34% | 33.2 |
| `carousel-chart` | 338 | 34% | 34 |
| `social-number` | 390 | 34% | 33 |
| `newsletter-figure-chart` | 231 | 34% | 33.3 |

## Profile artwork

The four colour steps sit beside S3h on ink. YouTube and Facebook use their all-device crops. X and LinkedIn use their registered content boxes clear of the avatar. Both YouTube end-screen element zones stay clear. “Follow for more” paints at 128 native pixels, or 36 px per 1080.

| Item | Safe height, px | Painted S3h height, px | Safe height occupied |
| --- | ---: | ---: | ---: |
| `profile-youtube-banner` | 423 | 420 | 99.3% |
| `profile-facebook-cover` | 624 | 620 | 99.4% |
| `profile-x-header` | 240 | 238 | 99.2% |
| `profile-linkedin-banner` | 190 | 189 | 99.5% |
| `profile-youtube-endscreen` | 1836 | 1120 | 61% |

Banner crops, end-screen elements and the dashed camera framing guide are visible on their review sheets. All 191 standalone exports passed the dashed-guide check. On five additional items, restoring just the missing-camera guide in a comparison run reproduced both original Round 8 SVG hashes.

- `video-vertical-talking-head`
- `video-wide-talking-head`
- `social-youtube-thumb-face`
- `social-tall-cover-face`
- `future-sponsor-read`

## Verification

- The static verifier generated 191 of 191 items at both endpoints, passed all 383 declared spacing checks and exercised 1,337 stress previews. The embedded registry equals `library.json`. The vertical close and settled outro have identical artwork, and the wide pair retains its matching signing layers and backdrop.
- All 2,263 sequence frames were generated and checked for complete caption text or editorial silence. The suite also exercised all 199 word onsets and forced captions across signed transitions to verify suppression.
- The 18 revised compositions were rasterised at native size with resvg and the local fonts. Document measurements sample the original digits in place. Chart measurements sample the coloured bar and axis glyphs. Signature measurements use visible ink. These are local SVG raster measurements. The host's native browser ink-alignment, spacing and phone review remain pending.

From the Library directory, run `python -B verify_static.py` for the browser-free checks. The host can run `python render.py --phone` for the native item captures, sheets, phone proofs and pixel checks.
