# Post-mortem: the week of 2 November 2026

Written 7 Nov 2026 (Claude Code), from Krish's three Scores presses on the 2 Nov board (read from
`board_documents`, `picks/score-*`, 7 Nov 16:06 to 16:10), his three phone screenshots in Bugs & Issues
(the 6 Nov reel and the profile grid, 7 Nov 15:23), his presses on the 2 Nov and 9 Nov boards, the Video Engine Inbox,
and `docs/learning/2026-11-04-thursday-killed.md`. Everything below marked **proposal** waits on his yes.

## 1. The scores

| Day | Piece | Narrative | Production | His words |
|---|---|---|---|---|
| Mon 2 Nov, follow.the.money | Claude's AI is eating the jobs of its own humans (9a0c97af) | 6 | 8 | "I think this was one of the strongest in terms of the animation style of the job badges etc" |
| Wed 4 Nov, under.the.hood | AI used to reply. Now it acts first. Claude Duet is the start. (b63d2507) | 7 | 5 | "The opening doesn't have enough of a hook. The animations get cut off. They're not full screen, specifically when there's the hand holding the phone. The screenshots are just not really clear enough in terms of being able to make a clear point. As I was watching the videos I couldn't really understand or see properly what the screenshots even were or what was happening there. Overall clarity of production was a bit lower." |
| Fri 6 Nov, mind.the.gap | Why every country wants its own AI (two passports) (7083d6ad) | 8 | 8 | "This was very clear and thought-provoking. The production quality was really good and the script was clear as well." |
| Tue 3, Thu 5, Sat 7 | off days | none | none | The board has no Scores press for an off day, so he could not score them (his complaint, 7 Nov). |

Average 7.0 narrative, 7.0 production, against the 10/10 the North Star counts. No piece reached 9.

Reach, from his grid screenshot (Instagram views, 7 Nov): the "What could you hand to AI this week?" carousel 1,792;
the two-passports reel 35; Saturday's "Five good things AI did for people this week" 10. The one utility carousel
outdrew everything else by roughly fifty times. One week is a signal, not a rule.

## 2. What went wrong, by cause

### A. The hand-held phone ate the evidence (Wed 5, and the Fri bugs)
Wednesday's lowest score and Friday's visual bugs share one device: a stock hand holding a phone, with the evidence
(a screenshot, a card) composited onto its tilted screen. On a phone that puts a phone inside a phone: the screen
is about a third of the frame, the screenshot is unreadable, and the animation is cut off at the phone's edges
("They're not full screen, specifically when there's the hand holding the phone"). It breaks floor group
`real_evidence` in spirit: the real artifact is shown, but nobody can read it.

### B. Draw-on annotations are not tied to what they mark (Fri, screenshot 3)
The white hand-drawn underline is drawn across the bottom border of the "AT STAKE" card, not under the words, and it
stays flat while the card sits on a tilted screen. The underline is placed in frame coordinates; the card is placed
in perspective. Nothing checks that an annotation lands on its target.

### C. Words on screen repeat and break mid-phrase (Fri, screenshot 1)
The frame shows the title "DOES THAT MATTER?" and, at the same moment, a caption bar reading "Does that". The
caption repeats the title (learning `visuals-add-not-repeat`, still open) and is cut mid-phrase, so the frame reads
as an unfinished sentence. The caption bar is also wider than its words.

### D. Covers are not checked against where they are seen (Fri, screenshots 1 and 2)
On the profile grid the reel's cover loses its top line ("USING A") to Instagram's 3:4 grid crop, and in the reel
itself the title sits under Instagram's account row. `scripts/channel_safe.py` checks buttons and the caption zone,
not the grid crop or the top account row. The cover is a dark stock photo of a hand and a jumper with a low-contrast
headline; the strong tiles beside it (Monday's chart, the mint carousel) are bright, one idea, one real artifact.
Krish: "the thumbnails need to be managed better... the Chinese AI thumbnail is not really at the top of its game."

### E. The hook (Wed 7, Mon 6)
Wednesday's opening "doesn't have enough of a hook", and Monday's story scored 6 despite strong pictures. Open
learning `script-is-the-bottleneck` holds: the script gets settled before the pictures, but nothing scores the
first seven seconds on their own before he records.

### F. Off days had no finish line
Thursday 5 Nov was killed ("Okay, this is shit... The visuals are tacky. The subtitles are all over the place
typographically"), its replacement recording (`proactive-ai-offday.mp4`, 5 Nov) is still in the Inbox, and no off
day can be scored. Off days are half the week's posts and the place the best performer came from.

### G. The board lags reality
- Friday 6 Nov is live on Instagram, but its row in `content_ideas` still says `drafting` with no `published_at`,
  so the North Star number (read from `published_at`) does not count it. The week is under-counted.
- Friday 13 Nov's Approve scripts press was held for read-back, and Wednesday 11 Nov's scripts were never pressed,
  yet both pieces were recorded on 5 Nov. The board still shows them waiting on him.
- He has to hunt: what waits on him is spread across six tabs, four steps each, and a waiting line per day.

### H. What worked
- Monday's job badges: one object, moving with meaning. Same lesson as "The Ladder" (F38 reference cut).
- Friday's script: "very clear and thought-provoking". The narrative lock and the read-back rounds work when the
  story is a strong single idea.
- The approved off-day carousels for 9 Nov went through in one round of his edits.

## 3. How to improve the system (proposals unless marked)

1. **Retire the hand-held phone for evidence. (proposal)** Evidence is shown full frame: the screenshot cropped to
   the one line that matters, at least 60% of frame height on the tall cut, with a slow push and one mark. A phone
   mockup is allowed only as a one-second establishing shot. Guard: a ve lint rule that refuses an evidence slot
   whose readable text is under a set height on the 9:16 frame.
2. **Annotations follow their target. (proposal)** Every underline, circle or highlight is placed relative to the
   element it marks (its box and transform), never in frame coordinates. Guard: `ve qc` checks each annotation's
   box overlaps its target's text box, on the rendered frames.
3. **Captions break on phrases and never repeat the title. (proposal)** Caption chunks end at a phrase boundary
   (no chunk ends on "that", "the", "a", "of"...), and a caption that repeats on-screen title words at the same
   moment is dropped. Closes `visuals-add-not-repeat`'s missing check.
4. **Covers are checked where they are seen. (proposal)** `channel_safe.py` gains the Instagram profile grid crop
   (3:4 centre of the 9:16) and the top account row; the cover is rendered into a mock grid beside the last six
   posts and a YouTube results row before he sees it. Thumbnails become a pre-production choice (below), with two or
   three options, never one.
5. **A pre-production sheet before any build. (proposal, the main change)** One page per piece, after the script
   and before Codex or ve builds anything: subtitle options, motion style options, the storyboard, the opener and
   the close in script and in picture, the thumbnail options, each as a still or a loop on his own frame. He signs
   once. It merges the existing Sign storyboard and Pick a style presses into one view. See
   `docs/proposals/2026-11-07-board-v4.md`.
6. **Score the first seven seconds before he records. (proposal)** Three hook variants per script, read back by
   fresh readers for "would you keep watching", the strongest shown first on the Script step.
7. **Every post gets a Scores press, off days included. (proposal)** The same narrative and production marks, plus
   the platform's views when Growth has them, on one Review tab for the week just gone.
8. **Fix the counter. (can do now, data only)** Mark Friday 6 Nov published with its live URL so the North Star
   number counts it; then make the go-live record write `published_at` (Growth's go-live dispatch, or a check that
   compares 3 Posts with the live grid).
9. **Visual bugs get a home. (proposal)** Each file in Bugs & Issues is attached to its piece on the board, with a
   cause, the guard that now catches it, and a status, so he sees it closed.

## 4. Lessons to record (proposed for `config/learnings.json`, his yes needed)

- `evidence-full-frame`: evidence is read full frame on the tall cut; a phone held in a hand is never the evidence.
- `annotation-on-target`: a mark on screen sits on what it marks, through every move.
- `cover-checked-in-place`: a cover is judged in the grid and the results row it will sit in.
