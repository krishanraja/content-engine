# Story intro and outro: three blind concepts and the judging (12 October)

**Revised 13 October on Krish's review of Wednesday's video** ("font
consistency issues throughout ... text that falls off the page ... brand
guidelines have been seriously violated"; the vertical stand-off "an absolute
dog's dinner"; "we've not made any use of business logos"). The engine now:
sets every text in the brand's faces by role (Anton headlines, Archivo text,
IBM Plex Mono labels; Archivo Black is gone) and stops the render if one does
not load; uses the short `video_title` from cover-facts.json, fitted to its
area or the render fails (`STORY_FIT`); draws every player on one badge (its
logos, its name in type, its tag) on both sides; builds each element in
place, in order, inside the safe areas (`config/story-intro-outro.json`,
`check`); adds a logo line-up under the title; and checks every frame of
every render, failing it on anything outside the safe area, any collision or
any non-brand face, with a contact sheet per clip for a person to look at.
The intro is now 3.5 s (105 frames).

Run as `docs/plans/2026-10-12-story-intro-outro-brief.md` says. Nothing here is
approved; Krish has not seen any of it. Monday ships without a story intro on
his words (`config/story-intro-outro.json`, `exceptions`).

- Concepts: the stand-off (cast and fight card, `standoff-*`), the receipt
  printer (`receipt-spec.md`), the song track on the beat (`songtrack-spec.md`).
  Only the winner's mock is kept here; the others' mocks stayed in that
  session's scratchpad.
- Judges, blind, shuffled: judge one picked the stand-off (67, receipt 59,
  song track 65); judge two picked the receipt on a tie (62 each with the song
  track; stand-off 60, marked down for a playback bug that judge three could
  not reproduce); the tie-break judge picked the stand-off (64, song track 61,
  receipt 58). **Winner: the stand-off.**
- Grafts for the synthesis, agreed across judges:
  - make Warner's SUING to PAID flip the biggest thing on screen, with its own beat (at least 0.4 s);
  - drop or enlarge the end line-up tiles (Universal's mark is unreadable small);
  - the question card moves (a wobbling "?" stamp, from the receipt);
  - keep makeyourmindup.ai on screen to the end of the outro, with a highlight;
  - end the outro on the track running out (the song track's flat line, wordmark lands on it);
  - beat grid as props (BPM, first downbeat) so hits follow NO CURVES once measured;
  - plain role chips "Pays / Gets paid / Suing", and show "you pay Suno, Suno pays Warner";
  - duck the bed fully before Krish's first word; start the outro rise after his last word;
  - a one-corner variant for stories with no fight;
  - 9:16: lift the bottom strip clear of the 1500px line; intro about 3.0 s, outro about 4.0 s.
- Next: render one synthesis, check it at 400px and laptop, publish it
  privately, show it to Krish cold (`on_you`, `judgment`, `closes_on` `video`).
