# The full look: one board, every surface, built from the same picks

The founder said: "it all needs to work in tandem, having just one small decision at a time is not helpful to me", and that he is "confused where the icon goes and what the full look is". Build ONE board that shows the whole makeyourmindup system working together, so he can approve or change it as a whole.

Extend study.html and render.py in this folder only. Do not commit. Do not launch Chromium (the host renders). Never use page.route. Keep every existing sheet working.

## The picks (apply them everywhere, consistently)
- **Icon:** mark D, cream and mint on grained ink (docs/ve/cards/identity-lab/marks/d-face-off.svg).
- **Wordmark:** W0 in two working forms from study.html.
  - **V4 (one line):** sits under every headline and in every horizontal space.
  - **V6 (two lines):** for square spaces.
  - **Lockups:**
    - V9 (D beside V4) for wide headers;
    - V10 (D above V6) for the closing card.
  - The wordmark always sits on ink: cream type with a mint UP.
- **Colour blocks:** F1, a flat colour with visible grain. Type on colour is always ink. Coral, butter and lilac code the climb; mint is the answer.
- **Show art:** S3g, three huge cream lines on grained ink with a mint UP.
- **Photos:** the house operating-table stills in .scratch/why-ladder/assets/ (evo-cover, evo-topdown, evo-specimens, still-timer, still-record-phone, still-jukebox). Use the burn (photo fading to ink) on feed posts.
- **Type:** Anton, Fraunces (SOFT 50, WONK 0), DM Mono. No em dashes, no exclamation marks, British spelling.
- **Faces and names:** no people, no faces, no personal names.

## Sheet 7 "full-look" (2400 x 3000)
Title: "The full look". Use the same header style as the other sheets.

### Band 1: the kit
One row, each item with a one-line DM Mono rule underneath:
- D icon: "the icon: anywhere the platform crops to a circle or a small square";
- V4: "under every headline, on ink";
- V6: "square spaces";
- V9: "wide headers";
- V10: "the closing card";
- a colour row of ink, cream, mint, coral, butter and lilac as F1 grained chips: "coral, butter, lilac climb; mint answers; type on colour is ink";
- the three type specimens.

### Band 2: where it all goes
Draw the surfaces side by side in neutral, generic device frames: plain rounded rectangles, simple grey UI lines and generic labels. Never copy any platform's logo, icon set or exact UI. Each surface gets a small DM Mono label naming the platform type (for example "photo app profile", "podcast app", "video channel") and one line saying what it shows.

1. **Phone, photo app profile.**
   - Circular avatar: D on grained ink.
   - A one-line bio in Fraunces: "Who gets paid. What's real. Where the pitch and the product part ways."
   - A 3 x 3 grid built from the same picks:
     - three feed posts: a photo burning into ink, a cream Anton headline bottom-left, V4 under it on the same left edge;
     - carousel step cards: "WHY 1" in DM Mono with an ink Anton question on coral F1, then butter, then lilac;
     - a mint F1 landing card with a Fraunces line;
     - one S3g tile.
   - Headlines to use: "WHY DID POP SONGS GET SHORTER?", "WHO GETS PAID?", "THE NEW PRODUCER", "PAID AT 0:30."
2. **Podcast app page.**
   - S3g at about 300 px, with the show title "Make Your Mind Up" in plain UI text beside it.
   - Below it, a small row showing S3g at 56 px among three plain grey placeholder squares.
3. **Video channel.**
   - A wide banner: a lilac F1 block holding an ink Anton line ("AI, UNPICKED.") next to a photo.
   - The D avatar circle overlapping the banner's lower left.
   - Below it, two video thumbnails in the feed template: photo burn, Anton headline, V4.
4. **Browser.**
   - A tab with the D icon as the favicon.
   - Under it, a site header on ink with V9 at left and one mint button ("Subscribe", ink text).
   - Then an article hero: a photo burning into ink with an Anton headline and a Fraunces dek.
5. **Newsletter.**
   - An email header on ink with V9 centred.
   - Then a post card: a photo, a Fraunces title and a DM Mono date.
6. **Video frames, three 9:16 frames in a row:**
   - the title frame: photo burn, Anton title with V4 aligned under it;
   - a step card: photo above, coral F1 block below at least 40% of the frame, "WHY 1" and an ink Anton question;
   - the closing card: mint F1 block with a Fraunces takeaway, then an ink band with "Follow for more" and V10.
7. **Email signature:** a strip with V4 on ink and a DM Mono line "makeyourmindup.ai".

### Band 3: the rules in one place
Five short DM Mono lines:
- "D is the icon: avatars, favicon, app icon, video watermark. Never beside a headline."
- "The wordmark lives on ink. V4 under headlines, V6 in squares, V9 in wide headers, V10 on the closing card."
- "Colour blocks are flat with grain. Type on colour is ink. Coral, butter, lilac climb. Mint is the answer."
- "Photos burn into ink. The burn is the only gradient."
- "S3g is the podcast cover."

## render.py
Add "full-look" at 2400 x 3000 to the sheet loop and keep the no-overflow assert.

## NOTES.md
Append a short section on the full-look sheet.

Static-check paths and syntax. Report the files you changed.
