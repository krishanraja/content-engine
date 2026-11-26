# Library round 7

The browser-free model passes all **393 declared vertical gaps across 191 active items**. Of those items, 138 have vertically consecutive groups and 53 have none. Each item has a row in [spacing-static.json](spacing-static.json), including the final painted coordinate of the upper group, the first coordinate of the lower group, the gap and the required minimum.

The inventory has 27 portrait videos, 25 wide videos, 24 carousel items, 28 social items, 28 profile items, seven podcast items, 18 newsletter items, six web items, one email item, 14 future items, ten copy items and three sonic items. Round 7 adds no item IDs.

## What changed in the frames

| Reading interval | Modelled gap at the item’s native width | Minimum |
|---|---:|---:|
| Portrait video landing, insight to question | 87 px | 40 px |
| Wide video landing, insight to question | 152.33 px | 71.11 px |
| Carousel landing, insight to question | 87 px | 40 px |
| All five good-news cards, headline to dek | 87 px | 40 px |
| Good-news item inside the portrait slideshow viewport | 82.36 px | 40 px |
| Three weekly deep dives, title to summary | 50.61–54.88 px | 22.22 px |
| Four weekly topic headings to their opening news paragraphs | 47.48–51.36 px | 22.22 px |

The landings and news items give the two paragraphs a larger interval than the minimum. Their portrait photo apertures adapt to the fitted type. The text keeps its shared left ink edge. The other layouts use 40 px per 1080 px for a headline and dek and 64 px for separate groups. Measured stacks carry three additional native pixels for raster rounding. Chart ticks, ledger columns, button rows and parallel credits have separate reading paths.

| Statement close | S3h left ink edge | S3h ink width | Last statement ink to foot |
|---|---:|---:|---:|
| Portrait video | 90 px | 604.8 px | 88.56 px |
| Wide video | 144 px | 448 px | 141.88 px |
| Simple-advice carousel | 81 px | 734.4 px | 91.67 px |

Each statement starts at its top safe line, takes the full content width and sits on mint. The signature fits the corresponding close’s ink width. Its ink foot continues to the bottom edge. The portrait sheet raises the signature above the sample house caption while preserving its size.

The Saturday email is 600 px wide. Its height follows the content. The preview contains the opener, contents, three weekday-labelled deep-dive sections with picture and link slots, nine news entries in four topics, a forwarding request, the tagged subscribe link, a closing line and the email footer. Each news entry carries a linked primary source and an event date. The example uses the checked records from the distribution repository’s 14 November dry run. The two unassigned pieces and the article and video destinations remain editable slots. The schedule is one email on Saturday at 08:00 in America/New_York. The weekly row reads the weekly lane. [Approved distribution design](https://github.com/krishanraja/growth-makeyourmindup/pull/143)

## Geometry register

The comparison uses the settled item drawing and its family-sheet preview for all 191 IDs, with the same font fixture on both sides of the comparison. It includes changes to generated positions even when an edge remains anchored and the numerical change is subpixel. **101 item drawings and five additional sheet previews differ from Round 6.** The measurement report uses the locked Fraunces axes and weights. The change in the model itself is excluded from the drawing comparison.

### Video-vertical

| Item | Drawing | Geometry |
|---|---|---|
| `video-vertical-why-1` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `video-vertical-why-2` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `video-vertical-why-3` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `video-vertical-chart` | Item and sheet | The label, figure, scale ticks and source have distinct vertical intervals. |
| `video-vertical-challenger` | Item and sheet | The question or contested line clears its introductory label. |
| `video-vertical-landing` | Item and sheet | The roman insight and italic question have a full paragraph gap on their common ink edge. |
| `video-vertical-close` | Item and sheet | The mark, invitation and site use the separate-group interval. |
| `video-vertical-rail` | Item and sheet | The rung label clears the question above the caption band. |
| `video-vertical-chapter` | Item and sheet | The chapter label and question have a separate-group interval. |
| `video-vertical-outro` | Item and sheet | The invitation and site settle on the same geometry as the corresponding close. |
| `video-vertical-statement-close` | Item and sheet | The top statement takes the full 756 px content width. The captioned sheet raises the 604.8 px signature above its caption band. |
| `video-vertical-slideshow` | Item and sheet | The scaled news card carries its headline-to-dek interval into the video viewport. |

### Video-wide

| Item | Drawing | Geometry |
|---|---|---|
| `video-wide-why-1` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `video-wide-why-2` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `video-wide-why-3` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `video-wide-document` | Item and sheet | The lower text zone begins higher to accommodate the full source interval. |
| `video-wide-chart` | Item and sheet | The label, figure, scale ticks and source have distinct vertical intervals. |
| `video-wide-place` | Item and sheet | The title and source retain their opposite safe anchors, with the source interval enforced. |
| `video-wide-creative-work` | Item and sheet | The title and source retain their opposite safe anchors, with the source interval enforced. |
| `video-wide-documented` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `video-wide-challenger` | Item and sheet | The question or contested line clears its introductory label. |
| `video-wide-recap` | Item and sheet | The three recap entries fit shorter type boxes beside their coloured rules. |
| `video-wide-landing` | Item and sheet | The roman insight and italic question have a full paragraph gap on their common ink edge. |
| `video-wide-close` | Item and sheet | The invitation fits the left signing column with independent gaps above and below it. The right side remains available for end-screen elements. |
| `video-wide-lower-third` | Item and sheet | The source sits lower in its panel and clears the logo chip. |
| `video-wide-rail` | Item and sheet | The rung label clears the question above the caption band. |
| `video-wide-chapter` | Item and sheet | The chapter label and question have a separate-group interval. |
| `video-wide-big-moment` | Item and sheet | The figure height leaves a full group interval before the unit label. |
| `video-wide-number` | Item and sheet | The figure height leaves a full group interval before the unit label. |
| `video-wide-outro` | Item and sheet | The invitation and site settle on the same geometry as the corresponding close. |
| `video-wide-statement-close` | Item and sheet | The wider statement measure uses the full 1,632 px content width. The ink foot carries the 448 px signature. |

### Carousel

| Item | Drawing | Geometry |
|---|---|---|
| `carousel-cover` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `carousel-why-1` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `carousel-why-2` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `carousel-why-3` | Item and sheet | The rung label and Anton question share one ink edge with a separate-group interval. |
| `carousel-landing` | Item and sheet | The roman insight and italic question have a full paragraph gap on their common ink edge. |
| `carousel-close` | Item and sheet | The mark, invitation and site use the separate-group interval. |
| `carousel-good-news-cover` | Item and sheet | The date clears the headline in the lower text zone. The photo aperture follows their combined height. |
| `carousel-good-news-item` | Item and sheet | The photo aperture yields to an 87 px gap between the fitted Anton headline and Fraunces dek. |
| `carousel-good-news-close` | Item and sheet | The five-square strip and large signature remain. The invitation and site gain their separate-group interval. |
| `carousel-simple-advice-cover` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `carousel-simple-advice-item` | Item and sheet | The step label clears the headline. The body stays anchored below. |
| `carousel-simple-advice-close` | Item and sheet | A single top-anchored statement leads a mint field. The full-bleed ink foot carries the carousel close’s S3h. |
| `carousel-chart` | Item and sheet | The label, figure, scale ticks and source have distinct vertical intervals. |
| `carousel-explainer-step` | Item and sheet | The step label clears the headline. The explanation anchors the lower zone. |
| `carousel-good-news-item-2` | Item and sheet | The photo aperture yields to an 87 px gap between the fitted Anton headline and Fraunces dek. |
| `carousel-good-news-item-3` | Item and sheet | The photo aperture yields to an 87 px gap between the fitted Anton headline and Fraunces dek. |
| `carousel-good-news-item-4` | Item and sheet | The photo aperture yields to an 87 px gap between the fitted Anton headline and Fraunces dek. |
| `carousel-good-news-item-5` | Item and sheet | The photo aperture yields to an 87 px gap between the fitted Anton headline and Fraunces dek. |

### Social

| Item | Drawing | Geometry |
|---|---|---|
| `social-feed` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-square` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-ig-reels-cover` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-tiktok-cover` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-youtube-thumb` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-youtube-shorts-thumb` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-number` | Item and sheet | The label, figure, scale ticks and source have distinct vertical intervals. |
| `social-poll-question` | Item and sheet | The poll label clears the question while the response sits at the lower safe line. |
| `social-poll-result` | Item and sheet | The poll label clears the result. The explanation occupies the lower zone. |
| `social-clip-cover` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-threads-text` | Item and sheet | The opening label has a separate interval before the two text groups. |
| `social-linkedin-page` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-youtube-community` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-youtube-thumb-face` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-tall-cover-face` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-meme-tall` | Sheet only | The sheet adds the platform action column and caption lines around the existing picture window. |
| `social-poll-frame` | Item and sheet | The poll label clears the question above the response. |
| `social-note-image` | Item and sheet | The opening label moves up so the note body clears it. |
| `social-share-card` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `social-x-card` | Item and sheet | The label, figure, scale ticks and source have distinct vertical intervals. |

### Profile

| Item | Drawing | Geometry |
|---|---|---|
| `profile-youtube-endscreen` | Item and sheet | The left signing column fits separate mark, invitation and site intervals beside the reserved end-screen area. |
| `profile-ig-highlight-start-here` | Sheet only | The Story reply bar and link position appear on the sheet preview. |
| `profile-ig-highlight-follow-the-money` | Sheet only | The Story reply bar and link position appear on the sheet preview. |
| `profile-ig-highlight-under-the-hood` | Sheet only | The Story reply bar and link position appear on the sheet preview. |
| `profile-ig-highlight-mind-the-gap` | Sheet only | The Story reply bar and link position appear on the sheet preview. |
| `profile-bio` | Item and sheet | Platform names occupy a narrow left column. Bio copy and subscribe lines share a second ink edge and clear the next example. |

### Podcast

| Item | Drawing | Geometry |
|---|---|---|
| `podcast-episode-thumb` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `podcast-audiogram-wide` | Item and sheet | The stack gains five pixels at its lower limit for the measured Fraunces excerpt and waveform. |

### Newsletter

| Item | Drawing | Geometry |
|---|---|---|
| `newsletter-weekly-edition` | Item and sheet | The 600 px layout grows with three deep dives and a dated, source-linked topic digest. |
| `newsletter-post-header` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `newsletter-substack-cover` | Item and sheet | The cover dek gains a raster-rounding allowance below the title. |
| `newsletter-substack-post-social` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `newsletter-figure-chart` | Item and sheet | The measure label, figure, ticks and source clear their neighbours. |
| `newsletter-substack-cover-wide` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `newsletter-substack-feed` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `newsletter-figure-scale` | Item and sheet | The heading, bar, ticks and source have separate reading intervals. |
| `newsletter-figure-timeline` | Item and sheet | The timeline sits higher so its endpoint labels clear the explanatory line. |
| `newsletter-figure-comparison` | Item and sheet | The lower value in each column sits farther below the value above. |
| `newsletter-figure-whys` | Item and sheet | The question and answer type fits shorter row boxes, increasing clearance between rungs. |
| `newsletter-welcome-email` | Item and sheet | The opening label clears the headline above the lower text. |
| `newsletter-paid-welcome` | Item and sheet | The opening label clears the headline above the lower text. |

### Web

| Item | Drawing | Geometry |
|---|---|---|
| `web-desktop` | Item and sheet | The masthead clears the navigation. Article cards clear the email form. |
| `web-mobile` | Item and sheet | The signature and site hero line have more space beneath the navigation. |
| `web-article` | Item and sheet | The article title clears the lead question on the cream reading field. |
| `web-og-card` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |

### Email

| Item | Drawing | Geometry |
|---|---|---|
| `email-signature` | Item and sheet | The V4 is sized to leave a full group interval before the site in the 120 px strip. |

### Future

| Item | Drawing | Geometry |
|---|---|---|
| `future-deck-cover` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `future-deck-section` | Item and sheet | The section label clears the question on the same ink edge. |
| `future-deck-close` | Item and sheet | The invitation and site clear one another in the text column beside the signature. |
| `future-press-kit` | Item and sheet | The introductory label clears the headline. Contact copy anchors the lower zone. |
| `future-partner` | Item and sheet | The headline and signature clear one another. A full-width mint band holds the partner credit. |
| `future-event` | Item and sheet | The label and headline have separate reading intervals above the event details. |
| `future-ad-square` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `future-ad-vertical` | Item and sheet | The headline clears V4. The tall sheet also carries platform controls. |
| `future-channel-header` | Item and sheet | V4 clears the full fitted headline by the separate-group minimum or half its cap height, whichever is greater. |
| `future-desk-teardown` | Item and sheet | The introductory label clears the headline above the lower text. |
| `future-sponsor-read` | Item and sheet | The label and headline clear one another beside the media plate. |

## Checks and host readback

The static pass generated the start and final frame of all 191 items, 1,337 stress previews, five samples from each of `short`, `long`, `offday` and `goodnews`, shot-boundary frames and 220 caption word onsets. It exercised all 15 combinations of six to ten news entries and two to four topics. The two settled portrait drawings match. In landscape the final opaque ink field, grain, signature and invitation match. All horizontal column declarations, embedded registry equality, JSON parsing and script syntax checks passed.

All 44 platform-marked sheet previews draw one interface ghost. The action column and caption lines belong to vertical video and feed covers. Story previews use the reply bar and link position. Vertical sequence cuts carry one ghost even during a push. The native item export and the three-column profile crop both draw zero. The grid crop represents the profile thumbnail as seen in the grid.

The native check compares each visible line or mark with a capture of the same pixels while that element is hidden. It merges the ink rows of wrapped lines, then measures the clear rows between consecutive groups. A missing member, an overlap or a gap below the scaled minimum fails. A statement foot is measured at the canvas edge where its dark pixels begin and must run uninterrupted to the bottom. The horizontal tolerance remains two native pixels. The native colour-buffer comparison covers both close/outro pairs.

From the repository root, the host can run the native checks with

```powershell
python -B docs/ve/cards/library/render.py --alignment-only
```

It writes `ink-spacing.json`, `ink-alignment.json` and `fit-failures.json` under `.scratch/library/out/`. The native thresholds use whole pixels rounded up. The [static report](spacing-static.json) uses fractional geometry. Round 6 has host-confirmed native alignment and matching holds. Round 7 still needs the host’s native reports and true-size visual judgement.

## Structural open-area readings

The occupancy check ignores the universal backing and grain. These are the rectangles above 20% in its 100 × 100 sample. The percentages describe the largest connected empty rectangle admitted by that model.

| Items | Canvas area | Intended space |
|---|---:|---|
| `video-wide-close`, `profile-youtube-endscreen` | 64%, 57% | The YouTube end-screen elements occupy the open right side. |
| `profile-youtube-banner`, `profile-x-header`, `profile-linkedin-banner` | 33%, 29%, 29% | Platform crops and avatar protection surround the signature and stepped colour field. |
| `newsletter-substack-email-header`, `newsletter-substack-wordmark`, `email-signature` | 34%, 28%, 53% | Masthead and signature clear space. The email sign-off uses the short canvas height for a measured gap between the mark and site. |
| `future-partner` | 20.5% | The lower ink panel holds the square signature at the left. The mint credit band runs below it. |
| `video-vertical-slideshow`, `video-wide-side-by-side` | 33%, 29.4% | The evidence viewport and the caption and platform-control reservations are separate. |
| `social-meme-tall`, `social-meme-video` | 22%, 22% | The image and signature clear the bottom platform controls. |
| `podcast-audiogram`, `podcast-audiogram-wide`, `podcast-audio-edition` | 34%, 26.1%, 21.4% | The audio frame leaves a quiet field around the excerpt or long-hold waveform. |
