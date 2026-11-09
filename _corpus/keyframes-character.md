# Keyframes character: the craft, for ve

Source: the Keyframes `character` pack, version 0.2.13 (`.agents/skills/character/SKILL.md`, its
`references/{drawing,poses,acting,full-visual}.md`, `packs/character/SPEC.md` and `scripts/character/`). It is Krish's
own, given to him licence-free (Krish, 2026-11-06: "its been given to me license free, terms allow it, no need to vendor
it - its mine now"). He asked for it on 2026-11-09: "I will put a character in to it as well later this week, so ensure
that is ready too." What was taken, and where each part lives, is in `docs/ve/sources/keyframes.md`.

This file is a reference that cards, briefs and the Critic cite by section (`§3.2`). It is not Krish's taste.
- His approved rules come from the taste ledger and the floor (`python3 scripts/floor.py --format <maker>`).
- Where this file and a house rule disagree, the house rule wins. §7 lists every known disagreement.
- A line here becomes a durable rule only when Krish approves it.

Where things are in ve:
- The manifest: `config/ve/character.json` (where his inputs and the library live, the approval, the acting numbers).
- The poses: `config/ve/character-poses.json` (65 poses, their "use when" lines, the literal drawing text, the prompt
  templates, the draw order).
- The gate in code: `scripts/velib/character.py` (ve lint `character.*`), `spec.character` in
  `packages/contracts/src/production-spec.ts`.
- The cards: `docs/ve/cards/keyframes/ve-kf-6-character-library.md` (draw the library) and
  `ve-kf-7-character-layer.md` (place it in a cut).

## 1. What it is

A flat 2D cartoon of Krish, a bust cut at the waist, in the house style of the pack's own character. About 60 poses,
each with a closed mouth, an open mouth and a blink, the same person in every one. It stands at the bottom of a cut
and acts: a face that tells the viewer how to feel with the sound off, a hand that points at what matters.

The test: it reads as him on a phone in a tenth of a second, and the picture above it is still the cut.

## 2. Why it is built this way

**2.1 Identity is fragile, style is not.** An image model redraws a face a little differently on every call. So the
likeness is decided once, in one base image he approves, and every pose after it is an edit of that base. The photo is
never sent again after the base.

**2.2 What changes between two frames is made by code.** The mouth swaps every few frames and the eyes blink every few
seconds. If the model drew those, the hair and hands would shimmer. The open mouth and the blink are new drawings of the
same pose, and only the changed mouth or eye pixels are patched into the closed pose.

**2.3 A likeness lives in a few signature things.** On a phone people read the hair shape, glasses, the top and its
colour, facial hair and skin tone. Find his two or three and draw them exactly; keep the rest simple.

**2.4 The character serves the picture.** The cut is about the thing above him. The character fails the moment it
competes with the picture; every "too much" the pack's author heard was that.

## 3. Drawing

**3.1 The way: GPT Image 2 through Codex signed in with ChatGPT.** Krish's subscription, no API key, no other paid
service. Check before promising: `codex --version`, `codex login status` (signed in with ChatGPT). The tool depends on
the plan and the model Codex runs; when Codex says its image tool is not available, stop and say so. The fallback is
ChatGPT by hand with the sheet prompts (§3.6), never another provider. Drawing in code is not offered: two blind runs
scored the likeness 5 to 6 out of 10 and the pack's author called it horrible.

**3.2 Identity notes.** Read the photo and write `identity.md` beside it:
- face shape, skin tone, hair (shape, colour, parting side), eye colour, brows, facial hair, glasses, jewellery, the
  top and its colour;
- `## Keep`: one bullet per thing every pose keeps identical;
- `## Hidden`: what the photo cannot show (eye colour behind sunglasses, hair under a cap), asked of him once and
  written into every prompt, because the model fills every gap with a default;
- `Glasses: none | clear | dark`, `Head covering: yes | no`, `Key: magenta | green | blue`, and `Mirror: no` when a
  mirrored drawing is not him (a side parting, one earring, a swept fringe).

**3.3 The style image gives style only.** The base is drawn from his photo (image 1) and the house style image (image
2). Name what not to take from the style image: the house character's green sunglasses, red t-shirt, swept brown hair
and mustache. Otherwise its identity leaks into his.

**3.4 Flat, and nothing borrowed.** Flat fills with one soft shade step, thin dark lines only on brows, nose and
mouth, no outer outline, no texture, no hair strands, no realism. No logos, text or brand marks anywhere: they appear on
glasses and clothes unless forbidden.

**3.5 The prompts.** One instruction per thing, never an if-then: "if they wear pink use green" made the model paint
a pink cardigan green. Decide the key colour first (magenta, unless he wears or carries pink, purple or magenta; then
green, then blue), write that one colour, and add "keep every colour of their clothes". Framing words stay in ("the
character is SMALL in the canvas... large empty space above the head"), but framing is measured afterwards, never
trusted: the model lands the top of the hair anywhere from 19 % to 42 %.

**3.6 The by-hand way.** A sheet is a 3 x 3 grid on the key colour: each row one pose, its columns the closed mouth,
the talking mouth and the blink. Three poses a sheet, about 20 sheets for 60 poses, pasted in the same ChatGPT chat that
drew the cartoon. Say each column's state outright in every row ("mouth CLOSED, even in shock"; "both eyes fully
CLOSED"); a check flags a state that did not change.

## 4. The library

**4.1 About 60 poses.** At 14 poses the house character felt like "only 5 movements"; at 65 the reels stopped
repeating. The set, in `config/ve/character-poses.json`:
- Talking (9): neutral, present-palm, wave, point-viewer, hand-on-chest, arms-crossed, calm-palms, tap-wrist, hood-mask.
- Pointing (7): point-up-left, point-up-right, point-up-both, look-up-point, point-left, point-right, point-down.
- Counting and size (10): index-up to five-fingers, hands-wide, pinch-tiny, level-hand, squeeze-palms, stack-palms.
- Holding (10): hold-chest, hold-up-show, typing, grip-plug, loupe-peer, sand-pour, tweezers-steady, blow-dust,
  saw-chop, switch-flip.
- Reacting (16): thumbs-up, shock-cheeks, worried-mouth, facepalm, shrug, stop-palm, cover-eyes, hands-up-caught,
  collar-tug, grimace-teeth, hands-on-head, fan-face, wipe-brow, unplug-guilty, shield-eyes, mind-blown.
- Thinking (5): thinking-chin, scratch-head, temple-tap, head-tilt, look-up.
- Endings (8): celebrate-fist, arms-up, fist-palm, wink-thumbs, finger-guns, peace-sign, nod-smirk, dust-off-hands.

Draw in the file's `order` when a plan limits images an hour: neutral, the pointing family, the first counts,
thumbs-up, shock-cheeks, shrug, stop-palm, thinking-chin, then the rest. Those are the poses cuts reach for most.

**4.2 A pose is described literally, and fixed in words.** Which hand by side of the image, the hand shape, its height
against a body landmark (chin, collarbone, hair), what it must not read as, what is in the hand or "nothing in the
hand", and one line for the face. "Exactly TWO arms", walked from the shoulder. Three the house character got wrong:
- grip-plug: a forearm came out of the chest like a third arm; fixed by walking the arm from the shoulder.
- calm-palms: the hands landed at the waist; fixed by "held HIGH at the height of the collarbones".
- squeeze-palms: it read as praying, with an angry face; fixed by naming the wrong read, "this is NOT a praying gesture".

Nothing rises above the top of the hair (or what he wears on his head): the image is cut there.

**4.3 The layers each pose gets.**
- Closed mouth: drawn on the flat key colour and keyed with the edge colour un-mixed, so no fringe.
- Aligned: the head matched to the neutral pose so a pose change never jumps. A low match means the head is acting (a
  tilt, hands over the face): keep the drawn framing and store that pose's own head box.
- Open mouth: a second drawing asking for the mouth only; only the changed mouth pixels are patched in, squashed to
  60 % of their height.
- Blink: the same for the eyes (closed lids; a small dip of the brows behind dark glasses).
- Anchors: head box, mouth centre, the fingertip of a pointing pose, the holding hand of a holding pose, the side it
  faces.

**4.4 Measure his face, never assume.** Head box, mouth, eyes and the key colour come from his base. A mouth found by
red lips fails under a beard; a skin test tuned on fair skin fails on dark skin.

**4.5 Mirror only what mirrors.** A side pose is mirrored only when the mirror is still him; otherwise it is drawn for
both sides.

**4.6 The library only grows.** A finished image is never rewritten. A new pose joins through the same steps with its
"use when" line. A failed pose is described again and redrawn, never painted over.

**4.7 Done.** One person on every tile of the contact sheet with the head on the line; every pose at full size has two
arms, hands inside, nothing above the hair, the mouth closed in the closed image; every pose has an open mouth, a blink
and a "use when" line; the check passes.

## 5. The one gate

Nothing is drawn after the base until Krish says yes to it: every pose inherits it. He sees the base at full size and
at phone size beside his photo, and says what to fix. His yes is recorded in `config/ve/character.json` as `approved:
true` with `approval: {by: "Krish", said: <his exact words>, on: <date>}`; `scripts/velib/character.py` refuses an
approval without his words and a library listed before it. His taste goes to `preferences.md`, in his words.

## 6. Acting at the bottom of a cut

**6.1 Added last.** The character goes in once the cut's pictures are final, as one layer over every beat and under the
caption, one character for the whole cut. A beat is never changed to make room for it: the character moves instead.

**6.2 Read each cut.** Nothing about the acting is a template. Per beat, read the bottom third of the stills and decide
the spot, when it sinks, which way it points. Per sentence, find the word that carries the idea and the pose whose "use
when" line says it.

**6.3 Size and place.** A bust 570 px tall on 1080 x 1920, its bottom at y 1985 so it is cut at the waist, the hair
near y 1430. Spots: centre x 540 (the default), right x 710 to 720, left x 330 to 370, left only when the picture needs
the right side. The ve numbers are in `config/ve/character.json` `acting`.

**6.4 Not in the hook.** It rises from below on the first word after the hook. `ve lint` refuses a cue in a cut's
first beat (`character.in_hook`).

**6.5 A pose per idea.** In place about 4 frames before its word, then held while he keeps talking. About 0.8 poses a
second at most, never two within half a second: a pose that cannot be read is a flicker.

**6.6 A pose change is one swap.** One image replaces the other and the body takes it with a small dip and settle.
Two poses cross-faded show a ghost arm: one image at a time.

**6.7 One move at a time.** Body moves (nod, reach, hop, recoil, slump, lean, tilt) go on the few words that carry the
story. Never two on one beat, never a move on top of a walk.

**6.8 Always alive.** Breathing, a slow sway, a blink every 3 to 4.5 s on poses that have one, the mouth on his voice:
open while a word is spoken, closed in his pauses.

**6.9 Walks and props, few.** At most six walks and five props a cut. The cut the pack's author liked most ("perfectly
synced, not too much movement, but very nice") had a pose almost every second but 2 walks and 5 props; one with 10
walks and 10 props was "too much actions, reduce by half".

**6.10 Room for the picture.** It sinks 40 to 190 px under a label, or steps aside when something comes down onto its
spot, and comes back when the picture leaves. Never over the key part of the picture.

**6.11 Never.** In the hook. Over a label, a legend or the key part of the picture. Small, or in a corner. A walk every
beat, a prop on every idea, a prop that repeats what the picture already shows. A generated stranger in his place ("looks
too much like AI"). A second copy of him drawn inside a picture.

## 7. Where the house wins

| Their rule | The house rule that wins |
|---|---|
| The photo and the cartoon land in a `workspace/input/character/` folder | His asset library, `1 Brand kit (permanent)/character/krish/` under `runtime.library_root`; only the manifest is in git (never commit media). |
| An OpenAI key in `.env.local` as a second way to draw | No key. Codex on his ChatGPT subscription, or ChatGPT by hand. The secret guard refuses `.env` writes. |
| A rig copied into each reel's own scene folder, with a per-reel `CharacterScript.ts` | One signed spec: the poses are cues in `spec.character`, and one library device (`character_layer`) draws them in every cut. No per-piece code. |
| The character in the pack's Full Visual only | Any 9:16 cut whose spec names it, once he has approved it. A 16:9 placement waits for its own measured spot. |
| Bottom right as a default spot (x 710 to 720) | Centre first. The bust's opaque pixels never enter a channel's action rail or top bar (`config/channel-safe-zones.json`; Instagram's rail starts at x 880). |
| 60 fps acting timings | ve's 30 fps clock: the 4-frame lead and blink lengths are read at 30 fps. |
| Five hook variants carrying one layer | One spec, one opening per cut. |

Open, for his first look: the bust's head sits in Instagram's handle and caption band (from y 1320), where nothing that
must be read may go. The bust is not text, so the rule does not refuse it, but he judges it there.
