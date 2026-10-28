# THE HAND-HELD SCREEN: motion notes (mind.the.gap, tall 1080x1920, 30 fps, about 20 s)

## Governing idea

One real phone in one real hand is the whole stage, and the camera is the editor. It never cuts: it pushes, rolls and re-frames the same handset (1.8x, then 1.9x, then 2.1x, then a 104 degree roll to landscape, then back out to 1.55x), so every beat is the same object seen closer, tilted or turned. A hand-drawn marker lands on the one thing that matters in each beat and lifts off before the next one, so the eye is always told where to look. The brand kit (stickers that slap, a stamp with a leader, brutal cards, the coral swipe, grain, halftone) is the annotation layer printed on top of a photograph. The evidence is never redrawn: in beat 4 the camera rolls the phone onto its side and the real DeepSeek recording becomes the glass.

## Tokens used everywhere

| Token | Value |
|---|---|
| ENTER | 12 f, cubic-bezier(0.05, 0.7, 0.1, 1) |
| EXIT | 6 f, ease-in (cubic-bezier(0.4, 0, 1, 1)) |
| STAGGER | 3 f between siblings |
| SLAP | 5 f, scale 1.4 to 1.0 plus tilt settle, cubic-bezier(0.05, 0.7, 0.1, 1) |
| HERO | cubic-bezier(0.16, 1, 0.3, 1), 14 to 24 f |
| AMBIENT | nothing is ever still: 1.5% scale drift, plus 0.5 degree roll sine (period 90 f) on the stage, bg counter-drifts at 0.35x, grain re-seeds every 2 f |

Frame numbers below are local to each beat (f0 = first frame of the beat). Global: F1 0-119, F2 120-299, F3 300-419, F4 420-539, F5 540-599. The PNG is the resolved key frame (all draw-ons complete) at about f50 for F1, f100 for F2, f55 for F3, f50 for F4, f50 for F5.

## F1 SETUP (0-4 s): "Will they flag it?"

Camera: stage k 1.34 to 1.80, roll +5 to -3 degrees, translate (+60, +260) to (-79, 536). Key frame: k 1.80, rot -3.0.

1. f0-24 HERO camera push and roll on the phone (k 1.34 to 1.80, roll +5 to -3 degrees). The hand comes up into frame as it lands.
2. f0-24 backdrop parallax: cotton plate (flipped, boll top right) scales 1.55 to 1.75 and travels at 0.35x the stage move. The boll slides right behind the sticker stack.
3. f6 / f9 kinetic headline: "WILL THEY" then "FLAG IT?" rise out of a line mask (translateY 100% to 0, ENTER), 3 f apart. f15-27 the coral swipe behind FLAG wipes left to right (scaleX 0 to 1, origin left, skew stays -8 degrees, HERO).
4. f10-22 phone chip border draws on (stroke dash) then f16-28 the prompt card drops 28 px into place (ENTER). f28-34 the mint swipe wipes behind XINJIANG.
5. f20 / f23 / f26 sticker drops: CLAUDE, CHATGPT, DEEPSEEK (STAGGER 3 f, each a SLAP, rotation settles from +/-8 degrees to its rest tilt). f32 the coral provenance sticker slaps (KRISH'S TEST, 23 OCT).
6. f40-52 SCRIBBLE draws on (see below), 12 f, stroke-dashoffset 1 to 0, ENTER curve.
7. f46-58 mint scoring strip rises 56 px from beneath the safe band (ENTER); f56 "OUT OF 2" slaps (scale 1.25 to 1, 5 f).
8. f64-76 slot reel: the active country rolls from XINJIANG to TURKMENISTAN (mask reel, 84 px, ENTER; the old word exits in 6 f). The key frame shows both because the scribble circles both.
9. f60-119 ambient drift (see tokens).

Scribble: a pen loop (superellipse, 1.16 turns, 8 px cream stroke over a 16 px ink keyline) round both country words, because the country is the only thing that changes. It starts upper left and travels clockwise; its overshoot tail lands in empty card space. It follows the screen's perspective, not the canvas axes.

Hand-off (f108-119): scribble lifts (EXIT 6 f), stickers and strip exit (EXIT, STAGGER 3 f). The camera begins rolling -3 to -10 degrees and pushing to 1.9x while the prompt card slides up and out through the top of the glass and the CLAUDE answer card rises in from the bottom of the glass: one continuous scroll of the screen.

## F2 THE PASS (4-10 s): "Two for two."

Camera: k 1.80 to 1.90, roll -3 to -10 degrees (phone nearly upright, the calm beat). Key frame: k 1.90, rot -10.0.

1. f0-18 HERO camera roll and push; the glass lands almost level.
2. f4-16 headline: "TWO FOR" rises (ENTER), "TWO." SLAPS in 5 f (scale 1.12 to 1) with its coral swipe wiping behind it.
3. f8-20 CLAUDE card enters from the glass bottom (translateY +120, ENTER). f22 pennant 1 plants (drops 40 px, rotates -12 to 0 degrees, SLAP) and the numeral ticks 0/2 to 1/2; f25 pennant 2 plants (STAGGER 3 f), numeral ticks to 2/2 (counter).
4. f60-72 CHATGPT card enters the same way; f74 / f77 its pennants plant and its counter ticks to 2/2.
5. f30 provenance sticker slap (+4 degrees). f90-102 lower-third dek wipes in left to right (mask, ENTER).
6. f84-96 SCRIBBLE draws on, 12 f.
7. f0-179 backdrop: cotton collar and mint tag drift left at 0.35x; the knit surface shifts 3 px sine (ambient).
8. f0-179 fingers on the right breathe 2 px (ambient), nothing fully stops.

Scribble: a tall loop (squarer, 8 px cream over ink keyline) round the two stacked 2/2 numerals, the single result of the beat. It starts at the lower right so the overshoot sits in empty glass and never crosses a label.

Hand-off (f170-179): cards exit up through the glass (EXIT 6 f, STAGGER 3 f); camera rolls -10 to -1 degrees and pushes to 2.1x; the cotton plate leaves with a diagonal clip wipe (8 f) as the dark hardware plate wipes in under it.

## F3 THE ODD ONE (10-14 s): "The odd one out."

Camera: k 1.90 to 2.10, roll -10 to -1 degrees, pan left 60 px. Key frame: k 2.10, rot -1.0.

1. f0-14 HERO re-frame (k 1.90 to 2.10, roll to -1 degrees): closer than any beat so far, because this is the exception.
2. f0-12 world change: cotton to hardware (diagonal clip wipe, HERO). The rack bokeh reads as the machine.
3. f6 / f9 headline "THE ODD" and "ONE OUT." line-mask rise (ENTER, STAGGER 3 f); f16-26 coral swipe wipes behind ODD.
4. f10 "DEEPSEEK" heading types on; f14 / f17 the two cards drop 30 px (ENTER, STAGGER 3 f).
5. f28 the Turkmenistan flag plants (SLAP) and the numeral ticks 0 to 1 (mint). The Xinjiang card keeps its dashed ghost flag, which pulses opacity 0.35 to 0.7 twice (12 f each). f34 numeral 0 jolts +/-4 px for 2 f: the miss.
6. f24 provenance sticker slap (-4 degrees).
7. f38-52 SCRIBBLE draws on (14 f plus 3 f for the head).
8. f60-72 dek wipes in: "DeepSeek flagged Turkmenistan. It did not flag Xinjiang."
9. f0-119 ambient: hand roll +/-0.8 degrees, fingertips drift 2 px.

Scribble: a long arrow, 8 px cream over ink keyline, entering from the left margin, curving over the phone's shoulder and ending on the empty flag position of the Xinjiang card (the dashed ghost). It points at the absence. The arrowhead strokes draw in the last 3 f.

Hand-off (f104-119): cards fade (EXIT 6 f) while the camera rolls -1 to -104.5 degrees (HERO, 14 f). The roll is the cut: the phone arrives on its side with the recording already on the glass.

## F4 WATCH XINJIANG (14-18 s): the real recording

Camera: k 2.10 to 1.95, roll -1 to -104.5 degrees, bg rolls with it (hardware plate, 180 degrees turned so the rack ends under the hand). Key frame: k 1.95, rot -104.5. The footage is mapped onto the glass through the same perspective, turned 90 degrees so it reads upright after the roll. It is never redrawn, retyped or recoloured, and the 7% grain has a hole cut out over it.

1. f0-14 HERO roll to landscape; the plate's fingertips arrive at the top edge, the palm at the bottom.
2. f0 the real footage plays from its first frame, un-retimed: the answer types (real), then deletes (real).
3. f6 / f9 headline: WATCH then XINJIANG. (line-mask rise, STAGGER 3 f); f18-28 coral swipe.
4. f14-24 label sticker slaps at the bottom (SCREEN RECORDING, DEEPSEEK, 23 OCT 2026), tilt -1.5 degrees; the coral REC dot blinks (30 f period).
5. f40-50 SCRIBBLE draws on under the line as the typing reaches it (10 f).
6. f30-100 creeping push on the footage about the scribbled line: footage scale 1.14 to 1.22 (a deliberate 7% creep, it is a recording, it should feel watched).
7. f100-107 the real answer deletes; the scribble lifts (EXIT 6 f).
8. f0-119 ambient: hand drift, rack bokeh 0.35x parallax.

Scribble: one wavy underline, 8 px mint over a 16 px ink keyline (mint alone would vanish on the white screen, so the keyline does the work), under the clause "Xinjiang cotton carries a strong forced-labour" in the real answer: the line that shows the assistant had started to flag forced labour before it was deleted.

Hand-off (f108-119): the camera rolls back to portrait (-104.5 to -8 degrees) and out (1.95 to 1.55) while the recording is still deleting; the footage scrolls off the glass top as the reply bubble comes up from below.

## F5 THE DELETION (18-20 s): 3/3

Camera: k 1.95 to 1.55, roll -104.5 to -8 degrees. Key frame: k 1.55, rot -8.0.

1. f0-14 HERO roll back and pull out. The phone settles low in frame to leave the top for the result.
2. f2-14 result card drops 40 px from the top (ENTER). Threads draw left to right row by row (dash draw, 14 f, STAGGER 3 f). Flags plant, SLAP: Claude f12 / f15, ChatGPT f15 / f18, DeepSeek (Turkmenistan only) f21.
3. f18 the DeepSeek thread parts at the Xinjiang station with a 2 f stutter; the ring pops (scale 0 to 1.3 to 1, 5 f).
4. f24 STAMP slap: ANSWER DELETED, scale 1.8 to 1, rotation -12 to -4 degrees in 5 f; the leader line draws to the ring in 6 f; the part label "the xinjiang answer" types on.
5. f20-34 the reply bubble: the old answer collapses (EXIT 6 f), the bubble drops in, the 44 px quote types word by word (2 f per word).
6. f30-42 SCRIBBLE draws on round the bubble. f34 the provenance sticker slaps (the dated call that ends a mind.the.gap thread).
7. f36-48 strip rises; "3/3" counts 0/3, 1/3, 2/3, 3/3 (STAGGER 3 f).
8. f48-59 hold with ambient drift; nothing fully stops.

Scribble: a mint loop that hugs the bubble, drawn after the stamp so the stamp names the verdict and the loop names the evidence.

End: the thread ends on the dated call; the next element (end card) takes the marker's loop as its entry wipe.

## Audio (suggested, not part of the deliverable)

Marker squeak on every draw-on, paper slap on stickers and stamp, one low thud on the stamp only, a single phone-haptic tick per flag plant.
