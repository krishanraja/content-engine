# The makeyourmindup template Library (v5): build brief

Write files only inside docs/ve/cards/library/ in this worktree. Do not commit. Do not launch Chromium (the host renders). Never use page.route.

## What this is
Krish locked the full look v5. The locked spec is docs/ve/cards/identity-round2/study.html?view=full-look, with notes in docs/ve/cards/identity-round2/NOTES.md, FIXES-4.md to FIXES-8.md and SYSTEM-BRIEF.md. Read those first, plus docs/ve/cards/why-ladder-evo/{tokens.json,SPEC.md} and docs/ve/cards/brand-book/content.md.

He wants "templates built for every single asset type we have ever needed and might ever need in the future built in to a Library which I will then approve of". Every template is fresh in v5. Nothing old (v1.x kit, skins, stickers, brutal shadows, highlighter swipe, halftone, the felt robot, IBM Plex Mono, Newsreader, Instrument Serif, day colours, series badges) may appear.

## The locked look, in brief
- **Colour:** ink #0C1512 with 7% grain, cream #F4EFE4 and mint #7EF0C0 (the answer).
  - Coral #FF6A4D, butter #FFD84D and lilac #B7A6FF code the climb: why 1, why 2, why 3, then round again.
  - Colour blocks are flat with grain (F1), and type on colour is ink.
- **Type:** Anton (uppercase, one loud line), Fraunces (SOFT 50, WONK 0) for the human line with italic for the contested, and DM Mono for labels and sources.
- **Icon:** D, two half-discs, cream and mint, off-register. It is the avatar, favicon and app icon. Never beside a headline, never a watermark.
- **Wordmark (W0):** on ink only.
  - V4: one line, under every headline, sharing its left edge.
  - V6: two lines, for squares.
  - V9: D beside V4, for wide headers.
  - V10: D above V6, for the closing card.
- **Podcast cover:** S3h, three huge cream lines on ink with D as the O in YOUR and a mint UP.
- **Photos:** the operating-table photos burn into ink; the burn is the only gradient.
- **Evidence:** every card carries real evidence or a photo. Named companies show their real logo, unaltered (crop it from a real document; never redraw).
- **Copy:** it says the fact plainly. No vague or clever lines. No em dashes, no exclamation marks, British spelling.
- **Assets:**
  - fonts in .scratch/tonal-ab/;
  - photos in .scratch/why-ladder/assets/ (evo-cover, evo-topdown, evo-specimens, still-timer, still-record-phone, still-jukebox);
  - real documents in .scratch/why-ladder/assets/doc-*.png (doc-spotify-streams.png carries the real Spotify for Artists logo);
  - marks in docs/ve/cards/identity-lab/marks/;
  - wordmark builds in docs/ve/cards/identity-round2/study.html.
- **No people, no faces, no personal names.**

## Example content
Fill the hero example of every template with the one real story we have: "Why did pop songs get shorter?" Spotify counts a stream at 30 seconds (Spotify for Artists, "How your streams are counted"). Every other slot uses bracketed slot text that names what goes there, for example "[One plain sentence: what happened]" or "[Source, date]". Never invent a fact, number or quote.

## The Library
1. **docs/ve/cards/library/library.html**, one file.
   - `?view=index` is the index.
   - `?view=<family>` is each family sheet.
   - `?item=<id>` renders one template alone at its true platform size, for export.
2. **docs/ve/cards/library/library.json**, the registry. For every template it records:
   - id, family, name, platform;
   - true size in px;
   - safe zones (reuse C:\Users\krish\dev\mindmake\ce-cards\surface-rollout\docs\ve\cards\surfaces\surfaces.json for every platform it covers);
   - which locked rules apply;
   - the motion spec for video items;
   - `status: "proposed"`.
3. **docs/ve/cards/library/render.py.** Copy the Windows driver pattern from docs/ve/cards/identity-round2/render.py exactly; never use page.route. It renders:
   - each family sheet to .scratch/library/out/sheets/<family>.png;
   - each item at true size to .scratch/library/out/items/<id>.png;
   - the no-overflow assert on every sheet.
4. **docs/ve/cards/library/NOTES.md**, one paragraph per family.

Each family sheet shows every template in it at a readable size, captioned in DM Mono with its name, platform, true size and where it is used.

## Families and templates (build all of them)
- **video-vertical (9:16, 1080x1920) and video-wide (16:9, 1920x1080).** Each is a keyframe sheet, with a short motion note per template drawn from the locked motion floor:
  - title frame (Anton lines, V4 aligned under the title);
  - step card for why 1, 2 and 3 (photo or evidence above, the colour block below at least 40%, "WHY n" in DM Mono, an ink Anton question);
  - evidence plate in five kinds: document, chart, place, creative work, quote (margin bar in the rung colour, one Anton note, one DM Mono source line, strength tag);
  - callout (2 px leader to a boxed DM Mono tag);
  - strength tags (DOCUMENTED, INFERRED, OPEN);
  - challenger (parked, dashed);
  - recap stack (cream, ruled, rung-colour numbers, 2x2 evidence grid);
  - landing (flat mint block, Fraunces insight, italic open question, no wordmark);
  - closing card (the takeaway on mint, then an ink band with "Follow for more" and V10);
  - source lower third;
  - the house caption style: Fraunces 500 sentence case in cream over a soft ink burn, 2 to 5 words per page, the current word in mint, no box, no swipe, no shadow;
  - the ladder rail.
- **carousel (1080x1350):** cover (feed template), why step cards 1 to 3, evidence card, landing, close. Also the two off-day carousels the growth lane makes: good-news carousel and simple-advice carousel (cover, item card, close).
- **social:**
  - feed post 1080x1350;
  - square post 1080x1080;
  - IG story 1080x1920;
  - Reels cover;
  - TikTok cover;
  - YouTube thumbnail 1280x720 (shown at 168 px too);
  - Shorts thumbnail;
  - quote card;
  - number card;
  - versus card;
  - poll question and result frames;
  - clip cover (a short clip from a past week);
  - meme in a v5 form: a real photo or screenshot, the burn, a plain Anton caption, V4, no stickers;
  - X or Threads text card;
  - LinkedIn document carousel page (1080x1350 PDF page);
  - YouTube community post image.
- **profile:**
  - the D avatar at every platform size, shown in its circle crop;
  - YouTube banner 2560x1440 with its safe area;
  - Facebook cover;
  - X header;
  - LinkedIn banner;
  - IG highlight covers (mint for start here, then coral, butter and lilac in climb order);
  - YouTube end screen;
  - Substack logo;
  - the favicon set.
  - Banners use the climb steps on grained ink with the line "WE TAKE AI CLAIMS APART, ONE WHY AT A TIME."
- **podcast:**
  - S3h show art 3000x3000 (shown at 300, 150 and 56 px);
  - episode art (S3h system plus the episode question);
  - audiogram 1080x1920 (waveform in mint, the quote in Fraunces, V4).
- **newsletter:**
  - **The weekly newsletter email,** a new overarching edition modelled on the structure of the ultrathink email Krish shared, built entirely in our look and voice. A 600 px email, in order:
    - V9 masthead on ink;
    - a short plain-spoken opener;
    - a "This week" list of the three deep dives;
    - each deep dive as its own section with its rung colour as a thin band, title, two-line summary, one evidence image and "Read the full piece";
    - "What else happened": short plain news items grouped by topic with their sources;
    - one closing line;
    - footer with subscribe, share and unsubscribe.
  - Substack post header;
  - Substack cover 1200x1200;
  - post social image 1456x1048;
  - email header 1100x220;
  - Substack wordmark 1344x256;
  - article figure styles: chart and document card.
- **web:**
  - **makeyourmindup.ai cover page,** desktop 1440 wide and mobile 390 wide. Krish asked for it to be "a lot simpler and more premium". One screen:
    - V9 header with one mint "Subscribe" button;
    - S3h-scale name;
    - the line "Who gets paid. What's real. Where the pitch and the product part ways.";
    - this week's three pieces as three plain cards;
    - the subscribe field;
    - nothing else.
  - article page (hero burn, Anton headline, Fraunces dek and body, evidence figure);
  - OG card 1200x630.
- **email:** the signature (V4 on ink, DM Mono domain).
- **future** (things likely needed next):
  - talk or workshop slide deck (16:9: cover, section, evidence, quote, close);
  - press kit one-pager;
  - sponsor or partner card;
  - event or live poster (1080x1350);
  - ad creative square and vertical;
  - WhatsApp channel or Telegram header;
  - merch mark sheet (D and V6 on cream and on ink).

## Quality bar
- Every item at its true size and inside its platform's safe zone.
- Contrast at least 4.5:1, and 3:1 for large type.
- No text on a photographed object.
- At most one callout per frame.
- The wordmark only on ink.
- No series badges on socials.
- Every card carries real evidence or a photo.
- Static-check every asset path and the HTML and JS syntax.

Report back:
- the families built;
- the item count;
- every id;
- anything you could not verify.
