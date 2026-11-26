# Library round 2: fix what the host render showed

Edit library.html, library.json, render.py and NOTES.md in this folder only. Do not commit. Do not launch Chromium.

The host rendered video-vertical, video-wide, carousel, social, profile and index. The render of podcast, newsletter, web, email and future timed out in page.screenshot after 30 s. The rendered sheets show the systemic faults below. Fix each one in the shared helpers so it applies to every template.

## 1. Photo framing: the objects must be in frame, and no dead ink
- Today most photo templates show a strip of bare teal cloth at the top, with the records, tray and timer cropped out, then 50 to 60% empty ink below.
- Give every photo in assets a focal box in library.json (`photos.<name>.focus`: x, y, w and h as fractions of the source) that contains its objects:
  - evo-cover: tray, timer and record sleeve;
  - evo-topdown: phone, records and forceps;
  - evo-specimens: tray and both records;
  - still-timer: timer and record stack;
  - still-record-phone: record sleeve and phone;
  - still-jukebox: the jukebox.
  - Check each image to place the box.
- Feed template:
  - The photo is full bleed, with object-fit cover positioned so the focal box is fully visible in the upper part of the frame.
  - The burn runs from 0 to 100% ink over the bottom ~45% on 9:16 and ~55% on 4:5 and 1:1, and starts just below the focal box.
  - The headline is bottom-anchored at the platform's safe bottom: 9:16 type baseline about y 1500 of 1920; 4:5 about y 1150 of 1350; 1:1 about y 960 of 1080; 16:9 about y 600 of 720. V4 goes under it.
  - No frame may have an empty ink area taller than 20% of its height.
- Step cards keep the photo above and the colour block below, at 40 to 50%, and the photo crop must show its focal box.

## 2. Evidence crops: never cut a line
Define two named crops of doc-spotify-streams.png (1800 x 3000) in library.json and use only these:
- `spotify-logo-heading`: the Spotify for Artists logo row plus the heading "How your streams are counted";
- `spotify-song-stream`: the logo row plus the complete line "Song stream: Counted when a listener plays your song for at least 30 seconds", with no partial next line.

Inspect the image to get exact pixel boxes. On every evidence plate, show the document at a size where its body text is at least 28 px high on a 1080-wide frame, crisp, on a white card. The 4 px rung-colour margin bar sits beside the key line.

## 3. Strength tags are tags, not frames
- Replace the three full frames (documented, inferred, open) with one frame: an evidence plate carrying its tag, plus a strip showing the three tag styles (DOCUMENTED solid 2 px, INFERRED solid at 70%, OPEN dashed 8/6) at true size. Do this for both video families.
- Callout and captions frames: show them over a properly framed photo (focal box visible), with the caption or tag at true size in the lower third.
- Rail: show it on a real step-card frame.

## 4. Banners and headers fill their space
- YouTube banner 2560 x 1440: the climb steps (coral, butter, lilac, then mint) run full width on grained ink. The Anton line "WE TAKE AI CLAIMS APART, ONE WHY AT A TIME." sits inside the all-devices safe area (507, 508, 1546 x 423), with its cap height at least 18% of 423 px and every word on colour.
- The Facebook cover, X header and LinkedIn banner follow the same system at their own sizes:
  - the type is as large as the safe zone allows;
  - avatar zones are kept clear (X: avoid 0, 320, 400, 180; LinkedIn: avoid 0, 170, 420, 226).
- YouTube end screen 3840 x 2160: a full-frame mint takeaway, then the ink band with "Follow for more" and V10, with the end-screen element zones kept clear and marked faintly as dashed boxes on the library preview only.
- In the sheets, show every item's full frame scaled to fit. Never draw a miniature inside a larger empty box.

## 5. Rendering must finish
- In render.py:
  - `page.set_default_timeout(180000)`;
  - render sheets with each item drawn at preview scale (a CSS transform of the true-size node, or a smaller re-layout), never placing 3000 px nodes on a sheet;
  - render items at true size one at a time;
  - keep the no-overflow assert.
- Make sure the podcast, newsletter, web, email and future sheets render.

## 6. Self-check before you finish
For every template, check statically:
- its focal box is inside the visible photo area;
- the headline box is inside the platform safe zone;
- no empty-ink region exceeds 20%;
- no evidence crop cuts a text line.

List any you could not satisfy.
