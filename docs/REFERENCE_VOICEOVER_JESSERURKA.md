# Reference: the one-diagram voiceover (jesserurka, studied 2026-11-08)

> Scope: one reel Krish sent on 2026-11-08 and what it teaches our voiceover cuts. Everything below
> "What it does" is Claude's reading, measured on a cloud machine; nothing here is a rule until Krish
> rules on it. The standard it is read against is `docs/ve/MOTION_STANDARD.md` (signed 3 Nov 2026).

Krish, 2026-11-08, in full: "Can you study this post and figure out how we can get closer to this for
our voiceovers in every way?"

| Field | Value |
|---|---|
| Reference | https://www.instagram.com/reel/DfVpRJEmVAI/ (jesserurka, "Part 2: Vibe Coding Essentials", what GitHub is) |
| File | `instagram_DfVpRJEmVAI.mp4`, 720x1280, 30 fps, 54.7 s, stereo 48 kHz |
| sha256 | `c5b97cb6abe40461…` (full hash in `config/style-references.json`) |
| Counts at fetch | 166,098 views, 12,445 likes, 40 comments |
| Rights role | analysis only; the file is never committed |
| How it was read | `content-watch fetch` (Instagram embed) then `content-watch read` (whisper, shots, loudness); one frame a second looked at by Claude; ffmpeg mid/side loudness for the bed |

## What it does

One idea, drawn once, explained by moving around it. The whole 55 seconds is a single lime-green commit
timeline on a near-black canvas. Every new word in the script (commit, push, clone, branch, merge,
delete, tag) is a new state of that same line: a node appears, the line rises into a GitHub page, forks
for a branch, folds back for a merge, gets a red node for the broken version, a white tag for v1. The
script names the metaphor out loud ("that's your app's timeline") and then says "timeline" five times,
so the voice and the picture are the same object.

Real artifacts, never redrawn: the real GitHub repo page with its Fork count, the real Claude Code
terminal running `git switch -c dark-mode` and `git reset --hard`, the real Finder folder, the real
habit-tracker app the commits belong to, a real Vite error in red. They sit as cards on the timeline at
the node they belong to.

## Measured

| What | This reel | Ours today | Source for ours |
|---|---|---|---|
| Hard cuts | 3 in 54.7 s (2.2 a minute) | 30+ a minute required on a graphics-led short | `MOTION_STANDARD.md`, Motion |
| Picture change | continuous: one long camera move along the diagram, a new element every 1.5 to 3 s | cut-driven | same |
| Words a minute | 226 | 172 to 185 talking (narration ledger, 9 takes) | `config/narration-ledger.json` |
| Pauses | none over 0.6 s; longest 0.5 s; speech 83% of the time | his natural gaps; one approved speed (1.12x on the Friday short) | `docs/ve/STATUS.md` |
| Words a sentence | 9.8 (206 words, 21 sentences) | 9.7 to 15.7 said | narration ledger |
| Questions as turns | 4 ("What actually is GitHub?", "So how do you keep it safe?", "What if you want to try…?") | not counted | |
| First word | 0.0 s, a question | rule 11: open straight on the hook | AGENTS.md |
| Close | one action ("tell Claude to commit and push"), then the series line | rule 11: the one thing he would do | AGENTS.md |
| Mix loudness | -14.1 LUFS integrated, loudness range 2.0 LU, peak -0.7 dBFS | -14 LUFS final, true peak -1.0 dBTP | `config/music-library.json` levels |
| Voice (mid) vs bed (side) | voice -17.1 LUFS; stereo bed -38.4 LUFS, about 21 LU under the voice, steady (-44 to -34 across the reel, the peaks are whooshes) | bed -31 LUFS under a -14 mix, about 17 LU under | same |
| Silence | none: no stretch under -45 dB for 0.15 s anywhere | | |
| On-screen words | 2 to 4 words at a time at the top (about 19% down), light grey sans, the one key word bold lime and underlined, timed to the voice | one word a page on the chest (the georgia build) for face-with-proof | `MOTION_STANDARD.md`, Captions |
| Palette | near-black with a faint grid, one accent (lime), white UI cards, red only for the broken state | the house mint, light wash on cards | brand kit |

## How we get closer, layer by layer

Each is a proposal for Krish; the bank modules added on 2026-11-08 carry them as `untested`.

1. **Script: one metaphor, said out loud, reused.** Pick the one object before the script (F31 already
   asks for `style.idea`), name it in the script in the first 20 seconds ("that's your app's timeline"),
   and make every later concept a change to that object in words too. The script and the storyboard
   then cannot drift apart. Module `named-metaphor-spine`.
2. **Script: questions as the turns.** Instead of signposts ("the second thing is"), move to the next
   idea with the question the viewer would ask: "So how do you keep it safe?" Three or four per minute.
   Module `question-turns`.
3. **Delivery: tight, not fast-talking.** His sentences are already the reel's length (9.7 to 15.7
   words); the gap is pace and air. 226 against 175 words a minute is about 1.29x. Do it mostly by
   closing gaps, not speed: cap every pause at 0.25 to 0.35 s in `ve conform` (it already joins only in
   gaps both aligners agree on) and keep the one approved speed at or under 1.12x. Estimated result about
   205 to 215 words a minute with his voice unchanged. Suspected, not tested: needs one proof on a real
   take, heard by him. Module `tight-air`.
4. **Picture: one diagram, one camera.** For a voiceover cut, replace the cut count with a change count:
   one persistent diagram on an infinite dark canvas, the camera travelling along it, something new
   arriving every 1.5 to 3 s. This conflicts with the signed `MOTION_STANDARD.md` (30 cuts a minute,
   measured on a face-led reel), so it needs his ruling: either a second motion grammar for voiceover
   cuts or keep the cut rule. Module `one-diagram-world`, filed under graphics for now: a motion-layer
   style is one the engine must draw (`kit.test.ts` holds the roster), so it moves there only once he
   rules and its device is built.
5. **Picture: real screens on the diagram.** The real terminal, the real repo page, the real app,
   pinned to the node they explain. We already require this (F32, `style.idea.real_artifacts`,
   `living-ui`, `screen-proof`); the new part is pinning each card to its place on the one diagram.
6. **Words on screen: the phrase with one key word.** 2 to 4 words timed to the voice, top of the safe
   zone, one word in the accent. The bank's `vertical-captions` already says this; the open question is
   that it repeats the spoken words, which the learning `visuals-add-not-repeat` forbids. Krish decides
   which wins on voiceover cuts.
7. **Sound: a quieter, constant, stereo bed with UI sound.** The bed sits about 21 LU under the voice
   (ours about 17), never drops out, and carries soft whooshes and clicks on each arrival. Our bed shape
   (`config/music-bed.json`, F40) already keeps it steady; the proposal is bed_lufs about -35 on
   voiceover cuts and approved UI sounds from `config/sfx-approved.json` on each card arrival. Levels are
   an approved ledger, so this is his call. Module `quiet-stereo-bed`.
8. **Palette: one accent on near-black.** One colour does all the meaning (lime here; the house mint
   for us), red only for the broken state. Fits the brand; no change asked.

## What not to copy

- The lime accent and the exact timeline drawing: use the house mint and our own device.
- A pace that hides his voice. If the tight edit makes him sound clipped, the gaps come back.

## Still open

- Whether the reel's voice is a person read fast and tightened, or synthetic: not tested.
- Screen text was not machine-read (no tesseract on the machine that read it); the caption reading above
  is from Claude looking at one frame a second.
