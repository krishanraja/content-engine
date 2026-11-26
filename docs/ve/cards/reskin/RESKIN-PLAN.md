# Reskin plan: every piece published before v5

## What exists (read 25 Nov 2026; recount from the catalogue before starting)
- **Substack:** the feed holds 20 posts from 5 Oct to 13 Nov: 13 articles and 7 older "VIDEO:" posts. Each has a cover image (1200 x 630) and a social image.
- **YouTube:** each long cut has a wide thumbnail, and each Short a cover frame.
- **TikTok and Instagram Reels:** each 90-second cut, with its tall cover.
- **Growth's social posts:** 139 from 5 Oct to 14 Nov, read from Buffer: carousels, memes, off-day posts and clips (docs/reviews/2026-11-16-what-works.md in growth-makeyourmindup).
- **Profiles:** avatars, banners and highlights on every platform, and the Substack header, wordmark and email header.
- **The members area:** 10 PNG files from 4 pieces.
- **Drive:** the v1.x brand kit in "1 Brand kit (permanent)", and old channel art in "2 Channel art (permanent)".

## Rules for the reskin
- Never re-upload a published video, and never change a published URL. Both lose views, comments and links.
- Never change a published title on our own. Titles that break the copy rule ("vague and smart arse") are listed for Krish, and he decides each one.
- Reversible actions only: replace a cover, swap a thumbnail, or archive (not delete) a post. Deleting anything needs his explicit yes, item by item.
- Reuse each piece's existing photos and evidence. New stills only where a piece has none, from the Higgsfield share, and only with his yes on the count.
- Nothing goes live without his approval. The engine prepares, he approves on the board, and he runs the swaps through one cowork prompt per platform.

## The tiers, in order
1. **Profiles and the front door (first, cheapest, seen most):**
   - avatars (the D icon);
   - banners (the climb);
   - highlights;
   - the Substack header, wordmark and email header;
   - the email signature;
   - the makeyourmindup.ai site (mock v2, once approved).

   All of these come from the Library's profile, newsletter, web and email families.
2. **Each piece's packaging (no re-recording):** for every piece in the catalogue, render from the Library's v5 templates using the piece's own photos and evidence:
   - the Substack cover and social image (feed template);
   - the YouTube wide thumbnail;
   - the Shorts, TikTok and Reels covers where the platform lets a cover change after posting. YouTube and Instagram allow it; TikTok must be checked, and where it can't change, leave it.

   Order: highest-traffic pieces first (growth's what-works review), then newest to oldest.
3. **The grid:** Instagram's grid is the one place old posts sit beside new ones.
   - Pinned posts are replaced with v5 versions.
   - Off-template posts (old memes, old carousels) are listed, and archiving them (hidden, reversible) goes to Krish as one decision with the list.
   - Nothing is deleted.
4. **Members files:** the 10 PNGs are re-rendered in v5 from the Library's evidence and figure templates, with the same filenames so links hold.
5. **Videos:** published cuts stay as they are. A v5 re-cut of an evergreen top performer is a separate proposal, one piece at a time, on his word.
6. **Drive:**
   - the v2.0 book and the Library files go into the permanent folders;
   - the v1.x kit moves to _Archive;
   - private crops stay out of shared folders.

## How it runs
1. content-engine builds a reskin queue from the publication catalogue: every piece, its assets, its live links and which tiers apply. It renders each piece's v5 packaging through the v5_feed skin and the Library templates (PR krishanraja/content-engine#976 provides both), with Codex doing the production work and the fit check on every render.
2. Each batch goes on the board as one approval per piece, with old and new side by side.
3. growth-makeyourmindup applies the approved swaps through its scheduled sessions, or Krish runs the cowork prompt per platform. Growth keeps its goals, channels and remit unchanged.
4. A piece is done when every one of its live surfaces shows v5 or is archived on his word.

## Decisions for Krish
- Archive the off-template Instagram posts: yes, no, or pick from the list.
- Titles that break the copy rule: keep, or retitle on platforms where a retitle doesn't break links (YouTube allows it, and Substack only before it's emailed).
- New stills for pieces with no photo: how many credits.

## Not done yet
- This is a plan. Nothing has been rendered, swapped or archived.
- It needs the Library and PR #976 approved first.
