# Library v5, round 4: every asset, critiqued, as one system

You are building the next version of the makeyourmindup template Library in this worktree (branch look/v5-library-system, made from PR #977). Write files only inside `docs/ve/cards/library/`. Do not commit. Do not launch a browser: the host renders and reviews every output at true size and sends you its critique. Never use page.route.

## Why this round exists

Krish (25 Nov): "in the makeyourmindup session, I want every possible asset templated concretely, this includes off day pieces, and everything else." He wants to see it "all ... in tandem", as one system, not one small decision at a time. He rejected a closing card with a dead empty half ("this is ridiculous how you can present this as good work"), and on 24 Nov said the look had "lost some element of joy which i suspect went away with all the colour. I didn't want to make this completely homogenuos", while asking for it to be "as simple to look at as possible". Passing the fitter is not good design. Every frame must be composed deliberately, fill its canvas and read at phone size.

## Read first, in this order

1. `INVENTORY.md`: every asset, with its id and action (keep, fix, new, spec). It is the build list.
2. `CRITIQUE-1.md`: the creative-director critique of round 3, the defects and fixes you must make.
3. `DOVETAIL.md`: how evidence, footage, stills, generated motion, colour, type and motion combine, which layer leads in each format, and the speeds.
4. `FLOOR.md`: Krish's approved standards that bind templates, with the table of conflicts with v5 and how to treat each.
5. `BRIEF.md`, `NOTES.md`, `ONE-MARK.md`, `EDGE-CASES.md`: the earlier briefs and the fit system. Keep the fit system, the content contract, the grid, the refusal stamps and the one-wordmark count.
6. The locked look: `../identity-round2/SYSTEM-BRIEF.md`, `../identity-round2/NOTES.md`, `../why-ladder-evo/SPEC.md` (especially "Notes pass") and `../why-ladder-evo/tokens.json`.

## The locked look (unchanged)

- Ink #0C1512 with 7% grain, cream #F4EFE4, mint #7EF0C0 (the answer). Coral #FF6A4D, butter #FFD84D and lilac #B7A6FF code why 1, 2 and 3. Colour blocks are flat with grain; type on colour is ink.
- Anton (uppercase, the one loud line), Fraunces (SOFT 50, WONK 0; italic for the contested), DM Mono (labels and sources). No other face.
- The D icon (two half-discs, cream and mint, off-register): avatar, favicon, app icon. Never beside a headline, never a watermark.
- Wordmarks: S3h (square, MAKE / YOUR / MIND/UP with the D as the O and a mint UP), V4 (one line, under feed headlines, sharing their left edge), V9 (D plus V4, wide headers). At most one wordmark per page or frame, always on ink.
- The headline "Creativity, AI and money, simplified." appears only in bios, the Substack homepage and the site hero.
- Photos burn into ink; the burn is the only gradient. No people in stills. Real logos, unaltered.
- Copy says the fact plainly. No em dashes, no exclamation marks, British spelling.
- Retired, never to appear: brutal shadows, stickers, stamps, badges, the highlighter swipe, halftone, tilt, the felt robot, day colours, series badges, Fraunces carousel headlines, "AI, unpicked.", slap or bounce motion, typing animation, gradients other than the burn, IBM Plex Mono, Archivo, Newsreader, Instrument Serif.

## What to build

### A. Fix every round-3 template that CRITIQUE-1.md names
Each fix is visual, not just a number change. In particular:
- **No dead space.** Every frame's content fills its safe area. Compose by zone (image zone, word zone, caption band) and size the type to its zone. On vertical video the caption band is reserved, and the frame is still composed so the empty band does not read as a void.
- **Type sized for a phone.** House captions at least 64 px per 1080 px of width, Fraunces 600, sentence case, the current word in mint, at most two lines. Labels and sources never below 28 px per 1080 px. Thumbnails readable at 168 px wide.
- **Photos alive.** Burn only where type sits. Crop to the focal box; never stretch edge pixels (remove that code path and change the aperture instead).
- **Joy through colour.** Each frame uses one colour family and uses it big. Off-day formats use the climb colours and mint more boldly than hero covers.
- **The closing card rebuilt** (CRITIQUE-1.md, "Closing card, rebuilt"): ink, full bleed, S3h large across the content box, "Follow for more" large, the site in DM Mono. The takeaway stays on its own landing card. Carousel and deck closes follow the same build.
- **Video wordmarks.** No wordmark on any video frame except the close. Covers and thumbnails keep V4 under the headline.
- **Shorts carry no source lines or strength tags** (floor 45). Mark video-vertical-documented and video-vertical-lower-third as long-cut-only in the registry and caption.

### B. Build every template INVENTORY.md marks "new"
Use the sizes, platforms and notes in the inventory. Specific requirements:
- **Footage and headshots.** Templates with a face use a photo slot named `headshot` (tall and wide crops) and a footage zone. When the file is missing (it always is in the repo), draw a neutral camera plate: grained ink lifted to about #1E2A25, a soft head-and-shoulders silhouette at 25% cream, and the DM Mono label "[Camera: to camera]" or "[Approved headshot]". Register `headshot` in the photos registry with the path `.scratch/private/headshot.png`; the host may place a private file there for its own proof. Never embed or commit a face.
- **Split screen.** Evidence above, face below, an opaque seam, captions on the seam, the face never covered (floor 150, 254).
- **Big moment.** A full-frame flat rung-colour block, one Anton number as large as the frame allows, one DM Mono label. No gradient.
- **Outro sequences.** video-vertical-outro: 2.0 s at 25 fps (50 frames): coral, butter and lilac blocks push up in turn (4 frames each, each covering the previous), ink lands, S3h and "Follow for more" settle by frame 30 and hold. video-wide-outro: 6 s (150 frames), settled by 2.75 s, with the right 44% (x 1100 to 1800 on 1920) left clear and the end-screen element guides drawn only on the sheet.
- **Statement close (off days).** Mint, a single Fraunces statement, S3h small on an ink foot that runs to the bottom edge, no days row.
- **Story sequence.** Hook, proof and action frames that read as a set, with the link-sticker zone kept clear on the action frame.
- **Tall covers.** Every tall cover keeps its headline and logos inside Instagram's 3:4 grid crop (y 240 to 1680) and clear of each platform's controls. Draw the grid crop as a guide on the sheet only.
- **Good-news carousel.** Cover: full-bleed photo, Anton headline, the date in DM Mono. Item: the photo leads, Anton headline, one Fraunces line, no source line (sources go in the caption). Close: the five photos as a row of crisp squares above the ink close, "Follow for more", S3h. No mint rings.
- **Memes.** A real picture leads; one plain caption in Anton on ink above or below the picture (never over an object); the small V4 bottom-right under the picture (floor 227). Square, tall with the clip window (x 200 to 880, y 600 to 1240), the two-beat video (two keyframes) and the meme carousel card.
- **Article figures.** Scale, timeline, ledger, map and comparison, each built from real-looking data slots, labelled with source, what it measures and its scale (floor 171). The Whys ladder figure lists the three questions in their rung colours with their answers.
- **Copy templates** (family `copy`, 800x1080, like profile-bio): each shows the parts, the character limits, where the subscribe link goes and one example built only from the real story. Mark example copy as "example, voice-checked by the host" in the caption; the host runs check_voice.
- **Podcast.** Episode art: decide one lead per the critique and prove it at 56 px. The audio-edition frame is a calm full-frame composition (S3h or the episode question, a slow waveform track) that holds for 8 to 12 minutes without looking frozen.

### C. Motion you can watch
Every video item gets a deterministic timeline. Add `t` (frame number at 25 fps) to `?item=<id>`: the page draws that item exactly as it is at frame t, using the item's `motion.tracks` in the registry (element, property, from, to, start frame, duration in frames, ease). No timers, no requestAnimationFrame in render mode: the state is a pure function of t.
- Use only the DOVETAIL.md speeds and the ease cubic-bezier(0.22, 1, 0.36, 1). Card changes are wipes or pushes, upward in the climb. No crossfade, flash, bounce or overshoot.
- Add `?seq=<name>&t=<frame>` for four sequences built from the items, with the house captions running as their own layer from a caption script in the registry:
  - `short`: the hero vertical cut condensed to about 30 s: talking head (hook) 3 s, title 2 s, why 1 1.5 s, document plate 4 s, split 3 s, why 2 1.5 s, chart plate 4 s, why 3 1.5 s, big moment 2 s, landing 3 s, outro 2 s.
  - `long`: the wide cut condensed to about 35 s with the same climb, a chapter card and the 6 s outro.
  - `offday`: a voiceover short with a meme beat and the statement close, about 15 s.
  - `goodnews`: the good-news carousel played as a Shorts slideshow, about 15 s.
  The caption script uses only sentences about the real story (Spotify counts a stream at 30 seconds), written plainly, no em dashes.
- render.py gains `--motion`: for each video item with tracks, and each sequence, capture every frame at true size and encode an MP4 with ffmpeg (H.264, yuv420p, CRF 18, 25 fps) to `.scratch/library/out/motion/<name>.mp4`. Keep frames in a temporary folder and delete them after encoding. Default rendering (no flag) stays as it is.

### D. One system on one page
- `?view=system`: the whole Library as Krish will judge it. Sections in this order:
  1. **The core:** the icon, the three wordmarks, the colours with their meanings, the three faces, the grid at 1080 px.
  2. **The week:** seven columns, Monday to Sunday. Each column shows, as real item previews, every asset made that day, grouped by lane (hero piece, off-day, every day). Sunday reads "Rest. Nothing publishes." The weekly edition sits in its own row.
  3. **One piece, everywhere:** every asset one hero piece produces, laid out by where it lands (Substack, site, YouTube, Shorts, Reels, TikTok, X, Threads, LinkedIn, Spotify, Notes).
  4. **Permanent:** profiles, podcast, site, email.
  5. **Motion:** the four sequences and the two outros as playing videos (`<video>` pointing at `.scratch/library/out/motion/`), with a still fallback.
  6. **The dovetail:** DOVETAIL.md set as a designed page, each rule beside a real example item.
  7. **Sound:** the close-sting timeline and the bed arc as a drawn timeline with the approved levels.
  The previews come from `window.itemPreviews`, as the index does now.
- `?view=grid`: nine tall covers in Instagram's 3-wide profile grid, cropped as Instagram crops them, to prove the covers work together.
- Add registry fields to every item: `day` (array of mon to sun, or "permanent" or "weekly"), `lane` (hero, offday, everyday, weekly, permanent, future), `channels`, `made_by` (content-engine, growth-makeyourmindup, makeyourmindup, Krish by hand), `leads` (the dovetail layer that leads) and `inventory` (keep, fix, new, spec). The system view reads them.

## Example content
The hero examples use the one real story: "Why did pop songs get shorter?" Spotify counts a stream at 30 seconds (Spotify for Artists, "How your streams are counted"). Off-day and other slots use slot labels that name what goes there. Set slot labels at their true size and position, in cream or ink at 60%, so the composition reads true while plainly marked as a slot. Never invent a fact, number, quote, logo or source.

## Quality bar, checked before you hand back
- Every item at its true size, inside its platform's safe zones, nothing cut off, nothing overlapping.
- No region larger than 20% of the canvas that carries neither content nor a deliberate colour field. Check this statically per item and list any exceptions with the reason.
- Contrast at least 4.5:1 for text, 3:1 for large type.
- At most one wordmark per item; the headline only on profile-bio, the web hero and the Substack homepage.
- No retired element anywhere (scan the HTML for the retired fonts and words).
- The embedded registry in library.html equals library.json.
- Static generation of every item at t = 0 and at its last motion frame, and every sequence at five sample frames, without errors. Run `node --check` on the extracted script and parse every JSON.

## Report back
The item count by family, every new id, every changed id with its fix in one line, the motion items and sequences, anything you could not do or verify, and the exceptions to the dead-space check with reasons.
