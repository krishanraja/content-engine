# makeyourmindup brand book v2.0: content (every word the book prints)

Layout: one HTML book, then a PDF. Each `##` heading is a spread or page. Each `[image: ...]` names an asset from `assets.json`. Keep every word below verbatim and add none, apart from figure captions built from the asset's own label and size.

## Cover
- Title: MAKEYOURMINDUP
- Subtitle: Brand book v2.0. Coming of age.
- Line: AI, unpicked.
- Date line: 24 November 2026. For approval.
- [image: cover-hero]

## What changed, and what didn't
Body: This is the same brand, grown up. Ink, cream and mint stay. So do Anton, the Fraunces human line, the wordmark, the grain and the operating table where we unpick AI. What goes is everything that read as toy: offset shadows, stickers, the highlighter swipe, halftone, tilt and the felt robot as the default subject. Premium comes from restraint, real evidence and better photographs. Joy comes from colour, wit and motion, never from decoration.
Decisions, in Krish's words:
- "I want an evolution and coming of age of my existing branding, not a complete overhaul."
- "just because we are upscaling in premium feel does not mean out motion animations or design or copy become boring"
- "we've lost some element of joy which i suspect went away with all the colour. I didn't want to make this completely homogenuos"
- "lets remove all badges like mind.the.gap from socials, and just have the wordmark left aligned with the wording at the bottom"

## Colour codes the climb
Body: Ink is the page. Cream is the reading colour and the light page. Mint is the answer. Coral, butter and lilac belong to the climb, not the weekday: the first why is coral, the second butter, the third lilac, then round again. Each frame uses one colour family, used big, as a flat block. Type on a colour block is always ink.
Swatches (name, hex, job):
- Ink, #0C1512, the page, always with 7% grain
- Cream, #F4EFE4, reading colour and light sections
- Mint, #7EF0C0, the answer; the one primary button on web
- Coral, #FF6A4D, why 1
- Butter, #FFD84D, why 2
- Lilac, #B7A6FF, why 3
Rule line: Never a colour gradient, never gradient text. The only gradient anywhere is the burn: a photograph fading into ink.

## Three typefaces, three jobs
- Anton. The one loud line. Uppercase. One per frame. [specimen: WHY DID POP SONGS GET SHORTER?]
- Fraunces. The human line: insight, questions, recaps. Italic marks what is contested or handed back to you. [specimen: Songs didn't lose their attention span. They got a stopwatch.]
- DM Mono. Labels, tags, sources. Lower case for names, capitals for tags. [specimen: DOCUMENTED · Spotify for Artists help page, Nov 2026]
Rule line: Never IBM Plex Mono, Newsreader or Instrument Serif. Those belong to other brands or to every AI startup.

## The operating table
Body: Our photographs are one world: a theatre lamp, teal surgical cloth, real objects from the creative economy laid out like specimens, coral thread, a mint seam ripper. Deadpan, true colour, a little comic. Evidence is always real: documents, screenshots and creative work shown as crisp cards, logos unaltered. No stock, no cartoon faces, no generated people.
[image: still-evo-cover] [image: still-evo-topdown] [image: still-evo-specimens] [image: still-timer]
Rule line: Full-bleed photographs may burn into ink over their lower half so type sits on the image with no box.

## The wordmark
Body: The wordmark is the real file, never typed or redrawn, on ink only. On video it appears on the title frame, aligned with the title, and on the closing card with "Follow for more". On social images it sits directly under the headline, sharing its left edge. Never mid-sequence, never on colour or cream, never as a badge. Avatars use the mark on grained ink.
[image: wordmark-in-use]

## The why-ladder: the signature format
Body: Every piece climbs three to seven whys to one insight. Each why is load-tested on screen: the evidence lands, its strength shows, and a real rival claim gets a fair hearing before it is parked. The rail shows where you are. Strength is the line itself: solid for documented, thinner for inferred, dashed for open.
[image: scene-1] [image: scene-2] [image: scene-3] [image: scene-4] [image: scene-5] [image: scene-6]
Captions, in order: Cover. Step card on the why's colour. The evidence, real and legible. The rival claim, weighed and parked. The recap, also the carousel cover. The landing on mint: the answer and the question we hand you.
Link: Watch the motion: [file: motion-mp4]

## The floor: every component
Body: The floor is the minimum every generated component must meet. Visual style combos on the board sit on top of it. A combo that cannot meet the floor is an earned device only, used when it makes a narrative point and with a written reason.
Table (component, the floor):
- Title frame: animates as the title is said inside a natural sentence near the start; Anton lines land with the words; wordmark aligned with the title.
- Ladder rail: thin seam; current node in the why's colour; finished nodes cream with a 2 to 4 word label, never rotated; future nodes hollow.
- Step card: the why's colour block, at least 40% of the frame; WHY n in DM Mono; the question in Anton, ink, three lines at most.
- Evidence plate: real, crisp, full brightness, legible on a phone; a margin bar in the why's colour, never a highlighter; one Anton note; one source line.
- Callout: a 2 px leader to a boxed DM Mono tag; never crosses text; one per frame at most.
- Strength tag: DOCUMENTED solid, INFERRED solid at 70%, OPEN dashed.
- Challenger: only a real rival claim with its own source; at most two per piece; parked or forked, struck only on documented evidence.
- Recap: cream, ruled; numbers in the why's colour; strength tags; a grid of the real evidence above.
- Landing: a flat mint block; the insight in Fraunces in the house wit; the open question in italic; no verdict, forecast, odds or lesson for leaders; no wordmark.
- Closing card: the only end screen; the takeaway on mint, then "Follow for more" with the wordmark.

## The floor: motion
- Every move decelerates: cubic-bezier(0.22, 1, 0.36, 1). Never bounce, overshoot, slap, tilt, typing or a slow drift.
- Brisk and full-frame: 6 to 12 frames at 25 fps per entry.
- Card to card is seamless: the next block or photograph wipes or pushes in. Never a flash, a snap or a cut through black.
- Anton lines rise 60 px over 8 frames, 4 frames apart. Leaders draw in 6 frames, then the tag steps in. Numbers count as their line draws. Colour blocks wipe up in 8 frames. The landing holds a beat before the question.

## Socials: one template, every post
Body: The grid should read like a sophisticated media business without losing a laugh. Every per-piece post uses one template: the photograph burns into ink, the Anton headline sits bottom-left inside the crop, the wordmark sits under it on the same left edge. No series badges. Nothing reaches the grid off-template, memes included. Profiles carry the colour: banners, highlights and show art use big flat blocks of the climb colours.
[image: tile-B] [image: surface ig-carousel-cover] [image: surface ig-reels-cover] [image: surface youtube-thumb]

## Every surface
Body: Thirty surfaces, each built for its platform's real size, crop and safe zone, and checked at the size it actually shows.
[grid: every entry in assets.json under "surfaces", with its label, platform and size as the caption]
Note: The two personal profile pictures use an approved headshot, cropped only. They live on Krish's own X and LinkedIn, never on makeyourmindup surfaces.

## The website
Body: The site follows the same floor: the cover, the three series pages, a full why-ladder article and subscribe. It is clickable.
Link: Open the clickable mock: https://claude.ai/artifact/Xy5E6hM5JeTNDK6h8swo3R
[image: web-1440-cover] [image: web-390-cover] [image: web-1440-article-hero] [image: web-390-recap-grid-zoom] [image: web-1440-landing] [image: web-390-mind-the-gap]

## Words on screen
Body: The words are dry, short and aimed at the hype, never at you. On-screen words add a source, number, name or date the narration does not say. No em dashes, no exclamation marks, British spelling.
Examples:
- "the new producer" pointing at a kitchen timer set to 0:30
- "Paid at 0:30. Not a second sooner."
- "We all became goldfish." (the claim, parked)
- "Who gets paid. What's real. Where the pitch and the product part ways."
- "Three short reads a week. Hype removed under local anaesthetic."

## Retired, and earned devices
Retired as defaults: brutal offset shadows; stickers and badges; the highlighter swipe; halftone; tilt; translucent panels over photographs; colour gradients and gradient text; day colours; series labels on social images; the felt robot as the default subject; drawn faces; the 48 pastel palettes; toy skins; pop and hustle captions; slap and bounce motion.
Earned devices: any of these may return for one beat when it makes a strong visual point that adds to that beat's narrative point, with a written reason ("adds: ..."). Never as decoration, never as a fallback.

## For the engine
Body: Exact values for the components already in the video engine, so the placeholders can be swapped after approval.
- WhyStep: colour block in the why's colour (coral, butter, lilac by order), at least 40% of the frame; DM Mono "WHY n"; Anton question, ink, at most 3 lines; strength shown as a tag (DOCUMENTED solid 2 px border, INFERRED solid at 70%, OPEN dashed 8/6) and on the rail (solid 3 px, solid 2 px, dashed).
- LandingCard: flat mint block; DM Mono "what this shows"; Fraunces 62 roman insight; 2 px rule; Fraunces 50 italic question; no wordmark.
- carousel-deck/2: cover uses the feed template; one why per card on its colour, with its real evidence and one source line; the last card is the landing on mint; the close is "Follow for more" with the wordmark.
- Tokens: docs/ve/cards/why-ladder-evo/tokens.json.

## After you approve
- The book replaces v1.5 in the Drive folder "1 Brand kit (permanent)", and the surfaces go to "1 Brand kit (permanent)/Channel art" ("2 Channel art (permanent)" is retired since 26 Nov 2026), keeping private crops out of shared folders.
- One cowork prompt per account updates Instagram, TikTok, YouTube, X, LinkedIn, Facebook, Substack, Spotify and Apple, makeyourmindup.ai and the email signature. You run them.
- Tokens and rulings land in the repos: content-engine first, then growth-makeyourmindup, makeyourmindup and krishraja-site.
- Nothing has been committed, filed or applied yet.
