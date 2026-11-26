# Library: one wordmark per artefact, and the headline only where a medium introduces itself

Edit library.html, library.json and NOTES.md in this folder only. Do not commit. Do not launch a browser. Keep the fit system and the content contract.

Krish's ruling (25 Nov 2026), verbatim: "I like the square MAKEYOURMINDUP wordmark, but there should only be one of these wordmarks on any given artifact or page, and the headline should only appear once on any given medium (Insta bio, Substack homepage, etc etc). It doesn't need to go on every single artefact like every single close card etc".

The headline is now "Creativity, AI and money, simplified." (his decision, 25 Nov). It replaces "WE TAKE AI CLAIMS APART, ONE WHY AT A TIME." everywhere it appeared.

## Rules to apply to every template
1. **At most one wordmark per artefact.** The wordmark forms are V4 (one line), V9 (D plus V4), V10 (D above V6) and S3h (the square three-line name with D as the O).
   - The D icon on its own is not a wordmark.
   - Remove any second wordmark from every item, and record the count per item in library.json (`wordmarks: 0 or 1`).
2. **The square wordmark is S3h,** and it replaces V6 and V10 in square and stacked spaces. The closing cards end with S3h small, under "Follow for more", in place of V10. S3h already contains the icon, so there is no separate icon above it.
3. **The headline appears only on the surface where a medium introduces itself, once per medium,** never on per-piece artefacts.
   - It is not on close cards, thumbnails, feed posts, carousels, video frames, newsletter post images or figures.
   - Each medium gets it once:
     - the IG, TikTok, X, LinkedIn and YouTube bios (text, not artwork);
     - the Substack homepage tagline (text);
     - the site hero.
   - Banners therefore carry no headline when the platform shows a bio. Rebuild the YouTube banner, Facebook cover, X header and LinkedIn banner as:
     - the climb steps on grained ink;
     - S3h, the one wordmark, inside the safe area, on ink;
     - no text line.
   - Add a `bio` text item in the profile family listing each platform's bio. The bio carries the headline once, then the subscribe link line. Use only text the brand already has: "Creativity, AI and money, simplified." and "Three pieces a week. Free to read."
4. **The newsletter weekly edition** keeps V9 once in its masthead and carries no headline.
5. **web-desktop and web-mobile** mirror the site mock: the D icon in the header, S3h once in the hero, the headline once under it.
6. **Brand-book-facing notes.** Update the Library index rules text to say:
   - "One wordmark per artefact."
   - "The headline appears once per medium, where the medium introduces itself (bio, homepage, site), never on per-piece artefacts."

## Check
Add a static check in render.py or the page script that fails any item with more than one wordmark, and any per-piece item carrying the headline text. Report which items changed.
