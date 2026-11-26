# Every asset makeyourmindup makes, or could make

Built 25 Nov 2026 from the Library registry (122 items) and from audits of content-engine (origin/main f03dcbc4) and growth-makeyourmindup (origin/main d21f60d). "Today" says who makes it now and where the evidence is. "Library" says what this Library does: **keep** (it passes the critique), **fix** (CRITIQUE-1.md names the defect), **new** (missing until now), or **spec** (a rule or copy pattern, not artwork).

Ids are the Library's. One template can serve several platforms when the crop is identical. Where it is not, each crop has its own template (Krish's standard 137).

## The week

> **Ruling, Krish, 26 Nov 2026:** all asset production moves into content-engine ("I believe that growth should move all asset production to Content Engine ... This would leave growth in charge of simply growing the channel"; "I want everything to be one harmonious engine"). Content-engine makes every asset in this Library, including carousels, memes, Notes, captions, thumbnails, covers and derived cuts, and writes captions into the piece manifest. Growth posts, schedules, distributes, runs the subscribe route and measures. Where the tables below say "growth" under "Today", that is who made the asset before this ruling.

- **Mon, Wed, Fri:** a hero piece each: an article, a 5-minute wide cut and a 60 to 90 second vertical cut, all made by content-engine, then posted by growth.
- **Tue, Thu, Sat:** off-day posts, made by content-engine since 26 Nov (growth before): supporting and explainer carousels, tips, memes, voiceover and recorded shorts, clips from past weeks. Saturday is the good-news carousel, five stories.
- **Sun:** rest. Nothing publishes.
- **Weekly:** the overarching newsletter edition (its day is set by the distribution design; the template is here).
- **Permanent:** profiles, channel art, podcast show art, the site, the email signature.

## 1. Hero piece, video (content-engine)

| Id | Asset | Size | Channels | Today | Library |
|---|---|---|---|---|---|
| video-vertical-talking-head | Hook and to-camera frame, with house captions | 1080x1920 | Shorts, Reels, TikTok | the cut itself (`_houseRules.ts:187`) | new |
| video-vertical-split | Evidence above, face below | 1080x1920 | same | face-with-proof format (`config/ve/formats/`) | new |
| video-vertical-pip | Evidence full frame with a small face window (the Thursday cut, face kept minimal) | 1080x1920 | same | floor 238 | new |
| video-vertical-title | Title moment, within the first 30 s | 1080x1920 | same | `TitleMoment.tsx` | fix |
| video-vertical-why-1, -2, -3 | Why step cards | 1080x1920 | same | `WhyStep.tsx` (structure only) | fix |
| video-vertical-document, -chart, -place, -creative-work, -quote | Evidence plates, five kinds | 1080x1920 | same | FIVE-WHYS devices | fix |
| video-vertical-callout | One leader and boxed tag | 1080x1920 | same | v5 lock | fix |
| video-vertical-documented | Strength tags at size | 1080x1920 | long cut only (floor 45) | v5 lock | fix, moved |
| video-vertical-challenger | Parked alternative explanation | 1080x1920 | same | v5 lock | fix |
| video-vertical-big-moment | One rung-colour block, one Anton number, at most 2 s, once a cut | 1080x1920 | same | accent kit, plum and ember (retired by v5) | new |
| video-vertical-number | Kinetic number with its label | 1080x1920 | same | number shot, 1 to 6 s | new |
| video-vertical-chapter | Chapter card, at most 1.5 s | 1080x1920 | same | growth `chapter-card-vertical` | new |
| video-vertical-recap | Recap stack | 1080x1920 | same | FIVE-WHYS, no code | keep, tighten |
| video-vertical-landing | Insight and open question; the short ends on it | 1080x1920 | same | `LandingCard.tsx` | fix |
| video-vertical-close | Close card, 2.0 s, end of the outro | 1080x1920 | same | `sting_beat` | fix, rebuilt |
| video-vertical-outro | The close as a sequence: climb push, ink, S3h | 1080x1920 | same | `sting_beat` timings | new |
| video-vertical-statement-close | Off-day close on mint | 1080x1920 | off-day shorts | `statement_beat` | new |
| video-vertical-captions | House caption style | 1080x1920 | all vertical cuts | 27 styles plus house | fix |
| video-vertical-rail | Ladder progress rail | 1080x1920 | hero shorts | FIVE-WHYS, no code | fix |
| video-vertical-lower-third | Source lower third | 1080x1920 | long cut only; needs Krish's yes (`HYPERFRAMES.md:51`) | none | fix, moved |
| video-wide-* | The same set at 16:9 | 1920x1080 | YouTube, Substack video post, Spotify video | `VeFormatMasterWide` | fix |
| video-wide-talking-head | To-camera frame with the caption band | 1920x1080 | same | the cut | new |
| video-wide-side-by-side | Face left 40%, evidence right 60% | 1920x1080 | same | face-with-proof | new |
| video-wide-chapter | Chapter card | 1920x1080 | same | `chapter` shot; growth `chapter-card` | new |
| video-wide-big-moment, -number | As vertical | 1920x1080 | same | as above | new |
| video-wide-outro | Close sequence, 6 s, right 44% clear for end-screen elements | 1920x1080 | YouTube | `sting_card` | new |
| video-wide-statement-close | Off-day close | 1920x1080 | YouTube | `statement_card` | new |
| (spec) | 15-minute feature | 1920x1080 | YouTube, Spotify | designed, never called | uses the wide set |

## 2. Hero piece, packaging (content-engine)

| Id | Asset | Size | Channels | Today | Library |
|---|---|---|---|---|---|
| cover-receipt-youtube, cover-scene-youtube (were social-youtube-thumb) | Wide thumbnail, no face: Receipt or Scene | 1280x720 | YouTube, Substack video post | `receipt.py` (weekly skins) | fix |
| cover-face-youtube (was social-youtube-thumb-face) | Wide thumbnail with his approved headshot cut out on the series colour | 1280x720 | YouTube, X, LinkedIn | face-led covers test from 17 Nov | new |
| cover-scene-tall, cover-receipt-tall (were social-ig-reels-cover) | Tall cover, safe inside Instagram's 3:4 grid crop (y 240 to 1680) | 1080x1920 | Reels | `receipt.py` tall | fix |
| cover-face-tall, cover-receipt-tall (were social-tiktok-cover, social-youtube-shorts-thumb) | Tall cover per platform guide | 1080x1920 | TikTok, Shorts | same | fix |
| cover-face-tall (was social-tall-cover-face) | Tall cover with his approved headshot cut out on the series colour | 1080x1920 | TikTok, Reels | face-led test | new |
| newsletter-substack-cover-wide | Substack cover | 1200x630 | Substack post settings | live | new |
| newsletter-substack-feed | Substack feed cover, packed only | 1200x800 | kept in the post folder | live | new |
| social-share-card | Share card and link preview | 1200x675 | LinkedIn, links | live | new |
| social-square | Square cover | 1080x1080 | Substack archive, Instagram | live | fix |
| newsletter-substack-cover, -post-header, -substack-post-social | Library's earlier Substack sizes | 1200x1200, 1456x816, 1456x1048 | Substack | not made by the engine | keep, size to verify against Substack's docs |
| (view) grid proof | Nine covers in a 3-wide Instagram grid | n/a | internal pick | `grid-mock.png` | new view |

## 3. Hero piece, article (content-engine)

| Id | Asset | Size | Channels | Today | Library |
|---|---|---|---|---|---|
| web-article | Web edition page | 1440 wide | makeyourmindup.ai | `page.html` | fix |
| newsletter-figure-document | Source-page figure | 1200x800 | Substack, site | `render_figure.mjs` | fix |
| newsletter-figure-chart | Chart figure, labelled source, measure, scale | 1200x800 | same | same | fix |
| newsletter-figure-scale, -timeline, -ledger, -map, -comparison | The other five figure forms | 1200x800 | same | `config/article-figures.json` | new |
| newsletter-figure-whys | "The Whys" ladder that ends each article | 1200 wide | same | `page.html` | new |
| web-subscribe-band | The subscribe band at the end of a piece | 1440 and 390 wide | site | `page.html` | new |

## 4. Off days (made by content-engine, posted by growth)

| Id | Asset | Size | Day | Channels | Today | Library |
|---|---|---|---|---|---|---|
| carousel-cover, carousel-close | Cover and close for every carousel | 1080x1350 | all | IG, TikTok photo mode, Threads, FB | `render/templates/carousel-*` | fix, close rebuilt |
| carousel-body | One Anton sentence of 20 words or fewer over an anchor image | 1080x1350 | Tue, Thu | same | growth repurposed carousel | new |
| carousel-why-1, -2, -3, carousel-document, carousel-landing | The hero piece as a carousel | 1080x1350 | hero days | same | proposed in `AMPLIFICATION.md:145` | fix |
| carousel-chart | Chart card with its source and scale | 1080x1350 | any | same | floor 171 | new |
| carousel-versus | Two sides, logos at equal size, plain counts | 1080x1350 | any | same | growth `versus-card-tall` | new |
| carousel-simple-advice-cover, -item, -close | Tips and level-up carousel: one job per card, 5 to 10 cards | 1080x1350 | Tue, Thu | same | AI-tips carousel, live since 5 Nov | fix |
| carousel-explainer-step | Explainer step on ink, mint accent | 1080x1350 | Tue, Thu | same | explainer carousel | new |
| carousel-good-news-cover, -item, -close | Saturday: five stories, photo cover with the date, fixed close showing the five photos | 1080x1350 | Sat | IG, TikTok, YT slideshow, X | live since 7 Nov | fix, rebuilt |
| carousel-meme | Meme carousel card | 1080x1350 | Tue, Thu | IG, TikTok | mocked | new |
| carousel-quiz-question, -answer | "Spot the AI" quiz | 1080x1350 | Sat | IG, TikTok | planned | new |
| social-meme | Square meme: real picture, plain caption, small V4 bottom-right | 1080x1080 | Tue, Thu | IG, X, Threads, FB | `meme-square` | fix, rebuilt |
| social-meme-tall | Tall meme with the clip window (x 200 to 880, y 600 to 1240) | 1080x1920 | Tue, Thu | IG, TikTok, YT | `meme_tall` | new |
| social-meme-video | Two-beat vertical meme, original sound | 1080x1920 | Tue, Thu | same | `meme-vertical`, from the 30 Nov board | new |
| video-vertical-voiceover | Voiceover short frame: picture-led, captions, no face | 1080x1920 | Tue, Thu | IG, TikTok, Shorts | live | new |
| video-vertical-plate | To-camera short with plates (a real chat, email or order shown as evidence) | 1080x1920 | Tue, Thu | same | planned | new |
| video-vertical-slideshow | A carousel card on a tall ink frame for the Shorts slideshow | 1080x1920 | carousel days | Shorts | live | new |
| cover-scene-tall (was social-clip-cover) | Cover for a clip from a past week | 1080x1920 | Tue, Thu | Reels, TikTok, Shorts | snackable, built | fix |
| social-x-card | Landscape card from a carousel cover or a number | 1200x675 | any | X | growth X cover card | new |

## 5. Every day (made by content-engine, posted by growth)

| Id | Asset | Size | Channels | Today | Library |
|---|---|---|---|---|---|
| social-ig-story-hook, -proof, -action | Story sequence of three frames, link-sticker zone kept clear | 1080x1920 | IG, FB Stories | live since 26 Oct | new (replaces social-ig-story) |
| social-quote | Quote card | 1080x1350 | X, Threads, IG, FB | built | fix |
| social-number | Scorecard, one sourced number | 1080x1350 | X, Threads | live once | fix |
| social-receipt | Receipt card, link in the first reply | 1600x900 | X, Threads | built | new |
| social-versus | Versus card | 1080x1350 | any | built | fix |
| social-poll-question, -result | Poll cards | 1080x1350 | X, Threads, Meta | planned | fix |
| social-poll-frame | Tall poll frame | 1080x1920 | Stories, Shorts | proposed | new |
| social-threads-text | Text card, one sentence | 1080x1350 | X, Threads | n/a | fix, rebuilt |
| social-note-image | Substack Notes image, small wordmark bottom-right | 1456x1048 | Substack Notes | live, but the review says written Notes convert and images do not | new, low priority |
| social-linkedin-page | LinkedIn document page | 1080x1350 | LinkedIn | handed to growth-mindmake 13 Nov | keep |
| social-youtube-community | Community post image | 1080x1080 | YouTube | planned | fix |
| social-feed | Feed post | 1080x1350 | IG, FB | n/a | fix |

## 6. Words without artwork (spec)

Each is a copy template: its parts, its limits and one example from the real story, checked with check_voice.

| Id | Asset | Channels | Today |
|---|---|---|---|
| copy-substack-note | Written Note, no outside link, up to 4 a day at U5 | Substack Notes | live; the one format that converted |
| copy-x-post | Native written post, link in the first reply | X, Threads | partly live |
| copy-x-thread | Thread of 4 to 6 posts | X | drafted |
| copy-yt-description | Description lead line with the tagged subscribe link | YouTube | live |
| copy-yt-pinned | Pinned comment and community question | YouTube | planned |
| copy-spoken-close | Spoken close, 15 words or fewer | TikTok, Shorts | brief rule |
| copy-carousel-caption | Carousel caption: the sources live here | IG, TikTok | floor 186 |
| copy-chapters | YouTube and Spotify chapter list | YouTube, Spotify | live |
| profile-bio | Each platform's bio, the headline once | every profile | live |
| copy-substack-about, copy-welcome | Substack about page and welcome email | Substack | live, rewritten 19 Nov |

## 7. Weekly and paid (makeyourmindup, Substack)

| Id | Asset | Size | Today | Library |
|---|---|---|---|---|
| newsletter-weekly-edition | The overarching weekly edition | 600 wide | proposed in the distribution brief | fix |
| newsletter-substack-email-header | Email header | 1100x220 | makeyourmindup brand files | fix |
| newsletter-substack-wordmark | Substack wordmark | 1344x256 | same | keep |
| newsletter-welcome-email | Welcome email as it lands | 600 wide | Substack's own | new |
| newsletter-paid-welcome | Paid members' welcome email | 600 wide | `substack-kit/PAID.md` | new |
| future-desk-teardown | The paid "Real or Theatre" Desk teardown, a written page | A4, 1240x1754 | annual perk | new |

## 8. Podcast (content-engine, Spotify for Creators)

| Id | Asset | Size | Today | Library |
|---|---|---|---|---|
| podcast-show-art | Show art | 3000x3000 | `show-art.py`, waiting on the look | keep |
| podcast-episode-art | Episode art | 3000x3000 | none; the show art is used | fix |
| podcast-episode-thumb | Spotify video episode thumbnail | 1920x1080 | documented | new |
| podcast-audio-edition | The frame under an audio edition published as a video episode | 1920x1080 | scripts for 4 pieces | new |
| podcast-audiogram | Audiogram, tall | 1080x1920 | none | fix |
| podcast-audiogram-square, -wide | Audiogram, square and wide | 1080x1080, 1920x1080 | none | new |

## 9. Profiles and channel art (permanent)

| Id | Asset | Size | Today | Library |
|---|---|---|---|---|
| profile-*-avatar | The D at every platform size | 320 to 3000 | live (YouTube, IG, FB) | keep |
| profile-favicon-* | Favicon set and maskable icon | 16 to 512 | site | keep |
| profile-youtube-banner | Banner, phone-safe middle 1546x423 | 2560x1440 | live | fix |
| profile-facebook-cover, profile-x-header, profile-linkedin-banner | Covers and headers | 1640x856, 1500x500, 1584x396 | live | fix |
| profile-youtube-endscreen | End-screen layout | 3840x2160 | live | fix, matches video-wide-outro |
| profile-ig-highlight-* | Highlight covers | 1080x1920 | made, not uploaded | fix |
| (none) | YouTube watermark | 150x150 | **live, set by the channel kit** | retire: the rule is "never a watermark" |

## 10. Site and email (makeyourmindup)

| Id | Asset | Today | Library |
|---|---|---|---|
| web-desktop, web-mobile | Cover page | site mock, makeyourmindup PR #54 | fix, to mirror the mock |
| web-og-card | Open-graph card | live | fix |
| (site mock) | 404, members, newsstand and legal states | PR #54, every state rendered | referenced, not copied |
| email-signature | Signature | Drive | keep |

## 11. Future and partner

| Id | Asset | Library |
|---|---|---|
| future-deck-cover, -section, -document, -quote, -close | Talk or workshop deck | fix |
| future-press-kit | Press kit page | fix |
| future-partner | Partner or collab card (the collab launch kit) | keep |
| future-event | Event or live poster | fix |
| future-ad-square, -vertical | Paid social | keep |
| future-channel-header | WhatsApp or Telegram header (growth: "stay off" WhatsApp for now) | keep |
| future-merch-marks | Merch marks | keep |
| future-sponsor-read | A partner read inside a cut | new |

## 12. Sound (spec)

| Id | Asset | Today | Library |
|---|---|---|---|
| sonic-close-sting | Three rising notes on the climb push | the close plays the old 1.87 s sting at 1.5x | spec, new sting needed |
| sonic-beds | Bed by lane, one arc, approved levels | 18 tracks in `config/music-library.json` | spec, keeps the approved levels |
| sonic-big-moment | One sound effect at most | under test (`THE_BAR.md:268`) | spec |

## Retired, and kept from coming back by PR #976

The rotating weekly cover skins (neon, sunburst, papercut and six more), day colours, series pills and badges, the felt robot, stickers, stamps (the "BLOCKED" plate becomes a real screenshot), brutal shadows, the highlighter swipe, halftone, the plum and ember big-moment gradient, the opening sting, the mark tile and stage header, the 30 s Scored cut, IBM Plex Mono, Archivo, Newsreader and Instrument Serif. growth-makeyourmindup's `render/kit.css` still uses Archivo and IBM Plex Mono and day colours; it is replaced when the agreed templates are ported (handover step 3).
