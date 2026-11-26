# Round 6 critique, read at true size by the host (25 Nov 2026)

Your alignment check passes on all 191 items at native size, and the close matches the outro. The Story cards, the meme, the carousel cover and the good-news close are now right. Three spacing faults from CRITIQUE-3 are still in the pixels, and the statement close was not rebuilt.

## 1. Groups still touch (measured on the host renders)
- **Landing** (video-vertical-landing, video-wide-landing, carousel-landing): the roman insight's last line and the italic question's first line have no gap between them. Required: 40 px ink to ink at 1080 px width.
- **Good-news item** (carousel-good-news-item and its slideshow and weekly-edition uses): the Anton headline's last line sits about 10 px above the Fraunces line. Required: 40 px.
- Audit every item for the same fault: any two consecutive text groups with different roles (Anton headline, Fraunces dek or question, DM Mono label, source or site, a wordmark) must have at least the scale's gap between their inks.

## 2. Make spacing a check, like alignment
Extend `--alignment-only` (or add `--spacing-only`) so that, for every item at native size, it measures the vertical ink gap between consecutive declared groups and fails any gap below its declared minimum (40 px headline to dek, 64 px between groups, scaled by width/1080). Report per item, as the alignment report does.

## 3. Statement close (CRITIQUE-3, section 8, not yet done)
video-vertical-statement-close, video-wide-statement-close and any off-day close: mint full frame; the statement set large and anchored to the top safe line with the full content width; an ink foot at the bottom running to the frame's bottom edge, holding S3h at exactly the size and left edge it has on the close; the foot's top at least 64 px below the statement's last line. No text inside a narrow band.

## 4. The weekly edition, now designed
The distribution design Krish approved (growth-makeyourmindup PR 143, `docs/plans/2026-11-25-weekly-edition/DESIGN.md`) sets the edition: **one email a week, Saturday 08:00 New York**, carrying the week's three pieces and **six to ten creative-industry news items**, each checked against its primary source, grouped by topic. Update newsletter-weekly-edition:
- registry `day: ["sat"]`, `lane: "weekly"`;
- the "What else happened" section holds six to ten items in two to four topic groups, each item one or two plain sentences with its source and date, and the layout stays within 600 px with no dead space;
- keep the three deep-dive sections, the opener, the closing line and the footer.

## 5. Platform interface on sheets
Confirm the quiet platform-interface ghost (Reels and TikTok action column and caption lines, Story reply bar and link-sticker spot) is drawn on every vertical video, Story and tall cover preview on the sheets and in the sequences, and never in an item export.

## When you hand back
List every item whose geometry changed, and the spacing report's result as your static model computes it. The host re-renders, runs both checks and reviews at true size.
