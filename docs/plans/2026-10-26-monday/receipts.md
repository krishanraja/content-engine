# Motion system: "Receipts"

The look of both Monday 26 October videos (follow.the.money, Character.AI, piece
`b358e788-209f-427b-a84d-1f79a8ebb430`). Decided by Claude on 26 October 2026 from the style on the piece's idea card
(script format `follow-the-receipt`, production `face-with-proof`, experiment `receipt-animation`) and the narrative
Krish signed ("yes, go to the scripts", 26 October): "A money map: two receipts and an empty shell ... the money
followed the people, and everyone else was left with the box." Built inside the brand book; nothing here adds a colour
or a font. Every beat that names this file in `creative-direction.json` is drawn from these rules.

## Revised 28 October 2026, on Krish's review of the first cuts

His words: "We've wasted one of the most important frames on such a boring visual treatment. This should be a
motion-designed, headline-grabbing statement ... provocative and visually intense", "what the hell is that stupid box
around character.ai? That's a horrible, tacky, unprofessional, low-quality visual", "These infographics ... still don't
move enough. They don't catch the eye enough. There's not enough happening", and "we also don't need three separate
outro transitions and screens. Ever." Four changes, which override anything below that says otherwise:

1. **The first picture is a statement, not a logo.** Frame one after the sting is the wall of friends (the chat tiles
   of the people who made friends there), the words "MILLIONS MADE FRIENDS HERE.", and on the spoken word "bust" a
   slam: hazard tape reading "CHAPTER 11" and "FILED 12 OCT 2026 · COURT FILING", "NOW IT'S BANKRUPT.", the wall
   falling away. In the 90-second cut the same wall opens it and the slam closes the paragraph on "went bust",
   with "OUT OF CASH." and "LAWSUITS." landing on those words. "Millions", not a number: no source in the project
   gives a user count, so none is printed (Krish's "45 million" is waiting for one).
2. **Everything moves.** Nothing below sits still: objects arrive with weight, receipts print line by line and their
   numbers count up, the stamp slams with a shake and a flash, arrows draw, chips fly from one card to the other, a
   scan line crosses each document, and the ground and camera drift on every picture (`video/motion.py`). The rule
   that nothing moves between ideas, and that logos never move, is dropped. Words still land on the words that name
   them.
3. **The box is a company card.** The open-top box is gone: the firm is a card with its logo and an "IN CHAPTER 11"
   tag, holding what it holds as cream chips. What left is a dashed empty slot.
4. **One close.** One end screen (the question and the URL, held 4 s); no teaser, no logo screen, no repeated CTA panel.

## The one rule: the picture adds, the voice tells

- No on-screen label repeats the sentence being said (the burned captions carry his words). Labels add only what
  the ear does not get: the source and its date, the exact number, the name of the thing, or the one changed word
  (learning `visuals-add-not-repeat`).
- The picture shows the mechanism the voice names. The voice says "the money followed the people"; the picture shows
  two receipts with the people on them, and an empty box with nothing going in.
- Every move lands on the word that names it (word start from the take's transcript, minus 3 frames so the eye leads
  the ear). Nothing moves between ideas for decoration. Jokes land on stillness: his face, held.

## The world: receipts on an ink desk

The piece's one idea is that the money followed the people. Three objects carry it, and only these three:

1. **Receipt 1, Google, August 2024.** Cream till paper (`#F4EFE4`), ink type in IBM Plex Mono, a torn top edge.
   Lines: `GOOGLE · AUG 2024`, `USE OF THE TECH ... $2.7B (REPORTED)`, `HIRES: THE FOUNDERS + RESEARCH TEAM`. Footer:
   the source line `WIRED · 19 OCT 2026`.
2. **Receipt 2, Disney, 2026.** The same paper. Lines: `DISNEY · OCT 2026`, `66 STAFF ... ~$60M A YEAR × 3 YEARS`,
   `THE CODE (OPENING BID) ... $20M`, sub-lines `trust and safety tools`, `age prediction`. Footer: `COURT FILINGS VIA
   GIZMODO · WIRED`.
3. **The empty box.** An ink outline of an open box (stroke in cream at 60%), labelled `CHARACTER.AI`. Labels drop
   into it and stay: `THE APP`, `USERS' CHATS`, `THE LAWSUITS`. Nothing ever comes out of it.

All three sit on the ink desk (`#0C1512`, grain at 4%). The money that moved is **mint** (`#7EF0C0`): the totals on
both receipts and the arrow on the money map. Nothing else is mint.

## The moves

- **Print.** A receipt line prints top to bottom (6 frames per line, a soft till tick under the music bed, never over
  his voice), landing on the word that names the line ("two point seven billion", "sixty-six", "twenty million").
- **Void.** The Disney and OpenAI deal is a receipt that prints its header and then takes a `VOID` stamp (cream on
  ink, rotated 8 degrees) on "died"; its total reads `$0 CHANGED HANDS`.
- **Money map.** On "takes the people and the code", two labels (`THE PEOPLE`, `THE CODE`) slide out of the
  Character.AI box along one mint arrow to the Disney wordmark; `THE LAWSUITS` stays in the box. 12 frames, ease out.
- **The one picture.** On "See, the money followed the people", the camera pulls back from Receipt 2 to show Receipt
  1, Receipt 2 and the empty box side by side, and holds for the whole beat. This is the frame the cover and the
  thumbnails echo.
- **Logos** arrive on their names at equal height (cap height 72 px on the 16:9 stage), never animated themselves.
  No Disney character artwork anywhere: wordmarks only.
- **Documents and screens** (`screen-proof`): the real page, captured, with the proving words highlighted in mint at
  30% behind the text; a slow push in (5%) across the beat; the source label bottom left in IBM Plex Mono.
- **The four questions** at the close are four small cream cards on the desk, numbered 1 to 4, each arriving on its
  question with the one line of proof from this story under it.
- **End card:** `makeyourmindup.ai` on ink, the follow.the.money series mark, held.

## Framing

- **5-minute (16:9):** his portrait selfie in a full-height panel on the left, the desk on the right (on the 19 Oct
  quick-edit route there are no full-frame cutaways: `brand.route`). His room is treated (darkened and softened) so
  the bed and lamps behind him do not compete.
- **90-second (9:16):** his face full frame; a picture fills the top of the frame with his face in the band below.
- Captions burned into every cut (Krish, 2026-10-27: captions burned into every cut), in the house look of
  `docs/STUDIO.md`: cream Archivo Black on an ink block, a hard shadow in follow.the.money's colour, at most one loud
  word per line (its first figure) on the mint swipe. That swipe is the captions' own; on the desk, mint is still only
  the money that moved. The caption file comes from the finished file's own transcript.
- No intro sting: `config/intro-sting.json` is still a candidate.

## Truth

Every number on a receipt is one the script says and a filed source carries. A receipt line never adds a figure the
voice does not support (the $5.5 million and the $2 million deposit in Wired's report stay off: the script does not
say them). If a beat cannot be built as written, production stops and says which beat and why; Claude changes the
direction and Krish signs again.
