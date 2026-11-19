# Post-production: from his take to the reveal

ve cannot make this cut today. `docs/ve/STATUS.md` says "No generated assets pipeline: ChatGPT Images, Runway and
Higgsfield are not wired", and "Compile still refuses generated plates". So an experiment is a hand-built composite
(Ruling, Krish, 2026-11-10: "One-off composite"; `docs/ve/ENGINE.md`, "Hand-built composites"), and it carries that
route's receipts itself. A known gap is never shipped with a caveat (F54). Where a step below cannot be done, stop and
name the blocker and the smallest engine request.

## 1. Pick the take

The take reaches the piece through the recordings lane, as any take does (`recording_match.py`). Watch every take
whole, with sound. Pick the one where every prop stays in frame and in light on the line that changes it. Its two
forced-aligner clocks (`<piece>/ve/takes/<take>.json`) time every change (F55). A whisper transcript never times a
change.

## 2. Stills first, priced, then his yes

For each beat in the shot script:
- Pull the frame at the changing word.
- Make the transformed still with the image tool the plan names.
- Check that his face, pose and hands survive.
- Show him the before-and-after pairs on the piece's board, filed with `add_piece_material`, and never as a page.

Price the motion renders with the tool's own estimator before asking him (Higgsfield `estimate_video_cost`, or
Runway's plan and credits read), and book the spend through Control Center (`reserve_credit_spend`, then
`settle_credit_spend` after). Generation spends his credits: nothing renders until he says yes to the stills and the
price, in words, for that piece (AGENTS.md, "Spend"; floor 5).

## 3. The motion renders

Run video-to-video renders of the chosen take, one per stage of the peel. Each one holds every transformation still
standing at that stage: stage 1 has all of them, the last stage has none (the original itself). Use the same seed and
settings across stages, so the parts that stay the same look the same. Read every render at full size, with these
checks:
- His face is unchanged, except where the shot script transforms it on purpose.
- The prop's silhouette matches his hands.
- Nothing smears or melts (`scripts/frame_smear.py measure`).
- The render is exactly as long as the take, frame for frame.

A render that fails is made again or its beat is cut. It is never shipped with a note.

## 4. The composite

- Fit every layer by cover, with its dimensions asserted before the first frame is written (ENGINE.md, "Every picture
  keeps its aspect"; F53).
- Stack the panels as the shot script's frame says, with the raw take always running in sync below or beside.
- Cut the generated layer from one stage to the next on the forced clock of the word that removes each
  transformation.
- Use the palette's one opening and one close (`config/brand-palette.json`; `scripts/brand_palette.py` refuses
  anything else).
- Keep his voice from the take, and add no voiceover. A voice effect (a robot, a famous person's gag) goes on his own words; nobody's voice is cloned.

## 5. Receipts and review

- **Two receipts on the exact bytes:**
  - `python scripts/frame_smear.py measure CUT --receipt`
  - `python scripts/av_sync.py measure CUT --take TAKE --edl EDL --receipt`

  `making.py video` refuses a hand-built cut without both.
- **The Codex minimum:** the art direction for the transformed stills is a Codex receipt (`config/codex-minimum.json`,
  `ve codex receipt`).
- **A separate reader watches it whole, at full size, with sound,** and checks two things: every claim is undone on
  screen on the word that undoes it, and his words stay in sync in both panels.
- **Filed like any cut** once the reader passes it, with no approval asked of him; his Approve for publish on the board, bound to the file shas, gates publishing only (Ruling, Krish, 2026-11-19).

## What to log for the experiment

Write it to the piece, in its plan folder as `experiment.md`, which becomes its research record:
- the hypothesis;
- what was measured once it posted (Growth's channel numbers);
- what changed from the shot script on the day;
- which renders failed and why;
- the cost.

The next experiment reads it first.
