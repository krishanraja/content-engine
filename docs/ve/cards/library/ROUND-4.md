# Library v5 · Round 4

189 registered items across 12 families. The round adds 68 IDs, carries forward 121 and replaces the former standalone Story with hook, proof and action frames.

Open `library.html?view=system` for the whole library or `library.html?view=grid` for the nine-cover crop proof. The index links to both. A single item accepts `?item=<id>&t=<frame>`. A sequence accepts `?seq=<name>&t=<frame>`. All time is measured at 25 fps.

## Checks and limits

- The offline registry and its embedded copy match. Node parsed the extracted script and both supporting scripts. Every item generated SVG at frame zero and the final frame. The four sequences generated at five evenly spaced samples and at the start, first moving frames and end of every shot.
- The measured-slot check uses local font metrics in Node. All editable scene text and mark zones fit the declared content box and have no intersecting text or mark zones. Flat text supports passed the 4.5:1 normal and 3:1 large-type checks, including both grain extremes. The lowest tested large-type combination was 3.10:1. The scan found no retired fonts or treatments in the HTML.
- At the 168 px proof width, both YouTube thumbnails fit two lines at 19.7 px em. Episode art has one lead and fits three Anton lines at 13.8 px em in the 56 px proof. These are font measurements. The host judges the reductions visually.
- The encoder was exercised with 151 synthetic frames across its 150-frame chunk boundary. FFprobe confirmed H.264, yuv420p, exactly 25 fps and all 151 frames. The host command is `python render.py --motion`. It renders the real art at native size and checks the encoded dimensions, codec, pixel format, rate and frame count before replacing an output. The default command continues to make sheets, items and stress proofs.
- Browser rendering, playback of the actual library MP4s, phone-size optical review, and check_voice are host gates. Copy-card character budgets are editorial limits where no platform maximum was supplied. Source audio and aligned spoken-word timings were not supplied. The example timelines have authored word cues, an illustrative waveform and a ten-minute audio-edition hold. Sound items specify the sting and mix levels. The motion proofs are silent.
- The optional private headshot resolves from `.scratch/private/headshot.png`. The missing-image state shows the camera silhouette. The five good-news images are archival examples of photographic slots, not news claims. Replace image and text together when making an edition.
- A Windows TemporaryDirectory used by the first encoder fixture denied access to its own directory. The encoder now creates a uniquely named temporary folder with inherited permissions and cleans it after encoding. Sandbox policy blocked removal of the earlier fixture directory `tmpx_vmhbbw`. The second fixture and its encoded file were removed after readback.

## Inventory

| Family | Items | Added IDs |
|---|---:|---:|
| video-vertical | 29 | 11 |
| video-wide | 25 | 7 |
| carousel | 20 | 7 |
| social | 28 | 12 |
| profile | 28 | 0 |
| podcast | 7 | 4 |
| newsletter | 18 | 10 |
| web | 6 | 2 |
| email | 1 | 0 |
| future | 14 | 2 |
| copy | 10 | 10 |
| sonic | 3 | 3 |

## Motion

| Sequence | Frames | Seconds |
|---|---:|---:|
| short | 688 | 27.52 |
| long | 825 | 33 |
| offday | 375 | 15 |
| goodnews | 375 | 15 |

The 60 motion items are marked with their frame counts in the register below. A dash identifies a still or specification.

## Structural open-area check

The checker measures the largest axis-aligned rectangle without foreground on a 100 × 100 grid. It ignores the universal backing and counts explicit colour fields. This is a structural check on the settled frame. Photographic detail, perceived weight, anti-aliasing and movement still need the true-size review. The 18 results above 20% are listed below.

| Item | Open area | Reason for review |
|---|---:|---|
| `video-vertical-close` | 26% | The common right and bottom control exclusion remains ink below the subscribe route. |
| `video-wide-close` | 26.4% | Left signature and right invitation share the full-bleed ink field; check their optical balance. |
| `profile-youtube-banner` | 36% | The all-device mark and rising steps leave a clear platform crop and profile-overlay field. |
| `profile-facebook-cover` | 30% | The all-device mark and rising steps leave a clear platform crop and profile-overlay field. |
| `profile-x-header` | 30% | The all-device mark and rising steps leave a clear platform crop and profile-overlay field. |
| `profile-linkedin-banner` | 29% | The all-device mark and rising steps leave a clear platform crop and profile-overlay field. |
| `profile-youtube-endscreen` | 53% | Clear space is reserved for the two native end-screen elements. |
| `podcast-episode-art` | 23.8% | The question alone must read at 56 px; the ink margin isolates the type. |
| `podcast-audiogram` | 26% | Space around the quote or master mark and the waveform is the quiet field for the audio hold. |
| `newsletter-substack-email-header` | 33% | Single horizontal brand signature on ink; the remaining area is its clear space. |
| `email-signature` | 36% | Single horizontal brand signature on ink; the remaining area is its clear space. |
| `future-deck-close` | 26.4% | Left signature and right invitation share the full-bleed ink field; check their optical balance. |
| `social-meme-tall` | 33% | The caption and right-aligned signature sit outside the picture; tall formats preserve the specified clip window and UI margins. |
| `social-meme-video` | 33% | The caption and right-aligned signature sit outside the picture; tall formats preserve the specified clip window and UI margins. |
| `carousel-meme` | 22% | The caption and right-aligned signature sit outside the picture; tall formats preserve the specified clip window and UI margins. |
| `podcast-audio-edition` | 22.8% | Space around the quote or master mark and the waveform is the quiet field for the audio hold. |
| `podcast-audiogram-wide` | 23.7% | Space around the quote or master mark and the waveform is the quiet field for the audio hold. |
| `podcast-audiogram-square` | 23.7% | Space around the quote or master mark and the waveform is the quiet field for the audio hold. |

## Every ID and change

Every carried item also received calendar, lane, channel, maker, leading layer and inventory metadata. The former `social-ig-story` is replaced by the three Story IDs below.

### video-vertical

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `video-vertical-title` | Fix | 50 | Photograph and large question on a shared left edge. |
| `video-vertical-why-1` | Fix | 38 | Question centred on its rung colour beneath the focal photograph. |
| `video-vertical-why-2` | Fix | 38 | Question centred on its rung colour beneath the focal photograph. |
| `video-vertical-why-3` | Fix | 38 | Question centred on its rung colour beneath the focal photograph. |
| `video-vertical-document` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-vertical-chart` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-vertical-place` | Fix | 100 | Full-aperture picture slot and a separate rung-colour note field. |
| `video-vertical-creative-work` | Fix | 100 | Full-aperture picture slot and a separate rung-colour note field. |
| `video-vertical-quote` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-vertical-callout` | Fix | 100 | Leader terminates at the padded tag on the timer photograph. |
| `video-vertical-documented` | Fix | 100 | Long cut only. Evidence and note occupy separate full-bleed zones. |
| `video-vertical-challenger` | Fix | 100 | Full-width parked ink panel with an italic alternative below the photograph. |
| `video-vertical-recap` | Keep | 100 | Four-image contact sheet over three rung-coloured question rows. |
| `video-vertical-landing` | Fix | 75 | Timer, mint insight and open question in separate zones. |
| `video-vertical-close` | Fix | 100 | S3h fills the ink close above the invitation and site. |
| `video-vertical-lower-third` | Fix | 100 | Long cut only. Identify the source while the evidence is on screen |
| `video-vertical-captions` | Fix | 100 | Fraunces 600 with a mint current word on an opaque caption band. |
| `video-vertical-rail` | Fix | 100 | Thin progress rail along the frame edge, with the current rung in coral. |
| `video-vertical-talking-head` | Added · new | 100 | Full-frame visual with the face or subject above the opaque caption band. |
| `video-vertical-chapter` | Added · new | 37 | One chapter question on a full lilac field. |
| `video-vertical-big-moment` | Added · new | 50 | Full-frame butter field, one Anton number and a single unit label. |
| `video-vertical-number` | Added · new | 100 | Number on the platform content grid. |
| `video-vertical-outro` | Added · new | 50 | S3h fills the ink close above the invitation and site. |
| `video-vertical-statement-close` | Added · new | 100 | One statement on mint. The ink foot reaches the frame edge. |
| `video-vertical-split` | Added · new | 100 | Camera plate and opaque caption band. |
| `video-vertical-pip` | Added · new | 100 | Camera plate and opaque caption band. |
| `video-vertical-voiceover` | Added · new | 100 | Full-frame visual with the face or subject above the opaque caption band. |
| `video-vertical-plate` | Added · new | 100 | Camera plate and opaque caption band. |
| `video-vertical-slideshow` | Added · new | 100 | Archival photo proof. Replace the photo and bracketed story slots together for each edition. |

### video-wide

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `video-wide-title` | Fix | 50 | Photograph and large question on a shared left edge. |
| `video-wide-why-1` | Fix | 38 | Question centred on its rung colour beneath the focal photograph. |
| `video-wide-why-2` | Fix | 38 | Question centred on its rung colour beneath the focal photograph. |
| `video-wide-why-3` | Fix | 38 | Question centred on its rung colour beneath the focal photograph. |
| `video-wide-document` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-wide-chart` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-wide-place` | Fix | 100 | Full-aperture picture slot and a separate rung-colour note field. |
| `video-wide-creative-work` | Fix | 100 | Full-aperture picture slot and a separate rung-colour note field. |
| `video-wide-quote` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-wide-callout` | Fix | 100 | Leader terminates at the padded tag on the timer photograph. |
| `video-wide-documented` | Fix | 100 | Evidence and note occupy separate full-bleed zones. |
| `video-wide-challenger` | Fix | 100 | Full-width parked ink panel with an italic alternative below the photograph. |
| `video-wide-recap` | Keep | 100 | A four-image grid on the left and three ruled questions on the right. |
| `video-wide-landing` | Fix | 75 | Timer, mint insight and open question in separate zones. |
| `video-wide-close` | Fix | 100 | S3h fills the ink close above the invitation and site. |
| `video-wide-lower-third` | Fix | 100 | Identify the source while the evidence is on screen |
| `video-wide-captions` | Fix | 100 | Fraunces 600 with a mint current word on an opaque caption band. |
| `video-wide-rail` | Fix | 100 | Thin progress rail along the frame edge, with the current rung in coral. |
| `video-wide-talking-head` | Added · new | 100 | Full-frame visual with the face or subject above the opaque caption band. |
| `video-wide-chapter` | Added · new | 37 | One chapter question on a full lilac field. |
| `video-wide-big-moment` | Added · new | 50 | Full-frame butter field, one Anton number and a single unit label. |
| `video-wide-number` | Added · new | 100 | Number on the platform content grid. |
| `video-wide-outro` | Added · new | 150 | S3h fills the ink close above the invitation and site. |
| `video-wide-statement-close` | Added · new | 100 | One statement on mint. The ink foot reaches the frame edge. |
| `video-wide-side-by-side` | Added · new | 100 | Camera plate and opaque caption band. |

### carousel

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `carousel-cover` | Fix | – | Photograph and large question on a shared left edge. |
| `carousel-why-1` | Fix | – | Question centred on its rung colour beneath the focal photograph. |
| `carousel-why-2` | Fix | – | Question centred on its rung colour beneath the focal photograph. |
| `carousel-why-3` | Fix | – | Question centred on its rung colour beneath the focal photograph. |
| `carousel-document` | Fix | – | Evidence at full brightness with a separate note zone. |
| `carousel-landing` | Fix | – | Timer, mint insight and open question in separate zones. |
| `carousel-close` | Fix | – | S3h fills the ink close above the invitation and site. |
| `carousel-good-news-cover` | Fix | – | Archival photo proof. Replace the photo and bracketed story slots together for each edition. |
| `carousel-good-news-item` | Fix | – | Archival photo proof. Replace the photo and bracketed story slots together for each edition. |
| `carousel-good-news-close` | Fix | – | Archival photo proof. Replace the photo and bracketed story slots together for each edition. |
| `carousel-simple-advice-cover` | Fix | – | Image-led advice cover. The action shares its left edge with the signature. |
| `carousel-simple-advice-item` | Fix | – | Photo leads, step label sits below the picture, followed by one action. |
| `carousel-simple-advice-close` | Fix | – | S3h fills the ink close above the invitation and site. |
| `carousel-body` | Added · new | – | One Anton sentence below the anchor picture, limited to 20 words. |
| `carousel-chart` | Added · new | – | Measure, unit and source are attached to the figure. |
| `carousel-versus` | Added · new | – | Two equal logo wells and two counts on the same measure. |
| `carousel-explainer-step` | Added · new | – | One action and its explanation on mint. |
| `carousel-meme` | Added · new | – | Real motion-blurred clock; plain caption on ink and V4 underneath at right. |
| `carousel-quiz-question` | Added · new | – | A documented clock photograph and the house timer still in equal apertures. |
| `carousel-quiz-answer` | Added · new | – | A documented clock photograph and the house timer still in equal apertures. |

### social

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `social-feed` | Fix | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `social-square` | Fix | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `social-ig-reels-cover` | Fix | – | Photograph and large question on a shared left edge. |
| `social-tiktok-cover` | Fix | – | Photograph and large question on a shared left edge. |
| `social-youtube-thumb` | Fix | – | Photograph and large question on a shared left edge. |
| `social-youtube-shorts-thumb` | Fix | – | Photograph and large question on a shared left edge. |
| `social-quote` | Fix | – | Source excerpt and attributed quote occupy separate zones. |
| `social-number` | Fix | – | Number in the social feed |
| `social-versus` | Fix | – | Two equal logo wells and two counts on the same measure. |
| `social-poll-question` | Fix | – | Question above two response slots. |
| `social-poll-result` | Fix | – | Winning option above the verified count and share. |
| `social-clip-cover` | Fix | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `social-meme` | Fix | – | Real motion-blurred clock; plain caption on ink and V4 underneath at right. |
| `social-threads-text` | Fix | – | One sentence in Fraunces on cream with its source below. |
| `social-linkedin-page` | Keep | – | Linkedin page in the social feed |
| `social-youtube-community` | Fix | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `social-youtube-thumb-face` | Added · new | – | Photograph and large question on a shared left edge. |
| `social-tall-cover-face` | Added · new | – | Photograph and large question on a shared left edge. |
| `social-meme-tall` | Added · new | – | Real motion-blurred clock; plain caption on ink and V4 underneath at right. |
| `social-meme-video` | Added · new | 100 | Real motion-blurred clock; plain caption on ink and V4 underneath at right. |
| `social-ig-story-hook` | Added · new | – | Ig story hook on the platform content grid. |
| `social-ig-story-proof` | Added · new | – | Ig story proof on the platform content grid. |
| `social-ig-story-action` | Added · new | – | Action line finishes above the empty native link zone. |
| `social-poll-frame` | Added · new | – | Poll frame on the platform content grid. |
| `social-receipt` | Added · new | – | Evidence at full brightness with a separate note zone. |
| `social-note-image` | Added · new | – | Note image on the platform content grid. |
| `social-share-card` | Added · new | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `social-x-card` | Added · new | – | X card on the platform content grid. |

### profile

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `profile-ig-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-tiktok-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-youtube-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-x-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-linkedin-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-substack-logo` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-youtube-banner` | Fix | – | Large S3h inside the all-device crop. Four steps climb on the right. |
| `profile-facebook-cover` | Fix | – | Large S3h inside the all-device crop. Four steps climb on the right. |
| `profile-x-header` | Fix | – | Large S3h inside the all-device crop. Four steps climb on the right. |
| `profile-linkedin-banner` | Fix | – | Large S3h inside the all-device crop. Four steps climb on the right. |
| `profile-youtube-endscreen` | Fix | – | Grained ink close with a clear right-hand end-screen area. Outlines appear on sheets only. |
| `profile-ig-highlight-start-here` | Fix | – | Circular crop filled edge to edge by the focal photograph. |
| `profile-ig-highlight-follow-the-money` | Fix | – | Circular crop filled edge to edge by the focal photograph. |
| `profile-ig-highlight-under-the-hood` | Fix | – | Circular crop filled edge to edge by the focal photograph. |
| `profile-ig-highlight-mind-the-gap` | Fix | – | Circular crop filled edge to edge by the focal photograph. |
| `profile-facebook-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-threads-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-whatsapp-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-telegram-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-podcast-avatar` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-favicon-16` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-favicon-32` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-favicon-48` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-favicon-180` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-favicon-192` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-favicon-512` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-maskable-512` | Keep | – | Retained the single D and registered its permanent platform placement. |
| `profile-bio` | Keep | – | Retained one tagline per platform bio and set its proof in the house face. |

### podcast

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `podcast-show-art` | Keep | – | Retained S3h and its reduced-size proofs. |
| `podcast-episode-art` | Fix | – | One Anton question. Same artwork reduced to 56 px on the sheet. |
| `podcast-audiogram` | Fix | 100 | Recorded excerpt in Fraunces with a full-width waveform. Bind the recording length before export. |
| `podcast-episode-thumb` | Added · new | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `podcast-audio-edition` | Added · new | 15000 | Full-width waveform beneath the episode lead. |
| `podcast-audiogram-wide` | Added · new | 100 | Recorded excerpt in Fraunces with a full-width waveform. Bind the recording length before export. |
| `podcast-audiogram-square` | Added · new | 100 | Recorded excerpt in Fraunces with a full-width waveform. Bind the recording length before export. |

### newsletter

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `newsletter-weekly-edition` | Fix | – | Three picture-led articles followed by a news example from the 21 November approved deck. |
| `newsletter-post-header` | Keep | – | Post header in the email or article |
| `newsletter-substack-cover` | Keep | – | Substack cover in the email or article |
| `newsletter-substack-post-social` | Keep | – | Substack post social in the email or article |
| `newsletter-substack-email-header` | Fix | – | Substack email header in the email or article |
| `newsletter-substack-wordmark` | Keep | – | Substack wordmark in the email or article |
| `newsletter-figure-chart` | Fix | – | Measure, unit and source are attached to the figure. |
| `newsletter-figure-document` | Fix | – | Evidence at full brightness with a separate note zone. |
| `newsletter-substack-cover-wide` | Added · new | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `newsletter-substack-feed` | Added · new | – | Large photographic cover with a short Anton question, real logo and V4 on ink. |
| `newsletter-figure-scale` | Added · new | – | Measure, unit and source are attached to the figure. |
| `newsletter-figure-timeline` | Added · new | – | Measure, unit and source are attached to the figure. |
| `newsletter-figure-ledger` | Added · new | – | Measure, unit and source are attached to the figure. |
| `newsletter-figure-map` | Added · new | – | Geographic data slot on a real Natural Earth land map with measure, territory and source scale. |
| `newsletter-figure-comparison` | Added · new | – | Measure, unit and source are attached to the figure. |
| `newsletter-figure-whys` | Added · new | – | Three questions with their answer or explicitly open evidence slot. Each row uses its rung colour. |
| `newsletter-welcome-email` | Added · new | – | Welcome email on the platform content grid. |
| `newsletter-paid-welcome` | Added · new | – | Paid welcome on the platform content grid. |

### web

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `web-desktop` | Fix | – | Site hero, three photographic article links and subscribe form composed across the 1440 px fold. |
| `web-mobile` | Fix | – | Mobile in the publication website |
| `web-article` | Fix | – | Body copy follows the dek on the cream reading surface. |
| `web-og-card` | Fix | – | Photograph and large question on a shared left edge. |
| `web-subscribe-band` | Added · new | – | The email field and subscribe action sit together on the reading grid. |
| `web-subscribe-band-mobile` | Added · new | – | The email field and subscribe action sit together on the reading grid. |

### email

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `email-signature` | Keep | – | Sign off an outgoing email |

### future

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `future-deck-cover` | Fix | – | Photo aperture beside the short headline and signature. |
| `future-deck-section` | Fix | – | Section question on a single colour field. |
| `future-deck-document` | Fix | – | Cropped evidence on cream and a separate note and attribution. |
| `future-deck-quote` | Fix | – | Cropped evidence on cream and a separate note and attribution. |
| `future-deck-close` | Fix | – | S3h fills the ink close above the invitation and site. |
| `future-press-kit` | Fix | – | press kit artwork |
| `future-partner` | Keep | – | partner artwork |
| `future-event` | Fix | – | event artwork |
| `future-ad-square` | Keep | – | ad square artwork |
| `future-ad-vertical` | Keep | – | ad vertical artwork |
| `future-channel-header` | Keep | – | channel header artwork |
| `future-merch-marks` | Keep | – | merch marks artwork |
| `future-desk-teardown` | Added · new | – | Desk teardown on the platform content grid. |
| `future-sponsor-read` | Added · new | 100 | Sponsor read on the platform content grid. |

### copy

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `copy-substack-note` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. Native Note, up to four per day at U5. |
| `copy-x-post` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-x-thread` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-yt-description` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-yt-pinned` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-spoken-close` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-carousel-caption` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-chapters` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-substack-about` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |
| `copy-welcome` | Added · spec | – | example, voice-checked by the host · Editorial copy budgets are shown on the card. |

### sonic

| ID | Action | Frames | Template or change |
|---|---|---:|---|
| `sonic-close-sting` | Added · spec | – | Close sting on the platform content grid. |
| `sonic-beds` | Added · spec | – | One licensed bed. Hero reflective, good news and tips brighter, memes retain original sound. |
| `sonic-big-moment` | Added · spec | – | Big moment on the platform content grid. |

## Proof image credits

These files ship with the offline proof. Their source blobs were checked before conversion to WebP. The credit and source are also stored in the photos registry. The map uses Natural Earth public-domain 1:110 million land geometry in plate carrée projection. [Natural Earth land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)

| Photo | Credit | Rights |
|---|---|---|
| [DSCOVR launch](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/rocket.jpg) | SpaceX | public domain |
| [Hubble eXtreme Deep Field](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/hubble_deep_field.jpg) | NASA | public domain |
| [Fundus photograph](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/retina.jpg) | Mikael Häggström | CC0 |
| [Cell in saline](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/cell.png) | Paul Müller and collaborators | CC0 |
| [Clock photographed in motion](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/clock_motion.png) | Stefan van der Walt | public domain |

[Photograph provenance and rights notes](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/_fetchers.py)
