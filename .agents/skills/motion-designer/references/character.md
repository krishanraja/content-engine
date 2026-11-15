# The cartoon character: picking a pose

Krish's cartoon character is placed at the bottom of a tall cut from his own drawn pose library. The skill plans only
which pose plays on which word; drawing the library and placing the bust belong to the engine
(`config/ve/character.json`, the `character_layer` device).

## When it may appear at all

- Only when the spec names it (`spec.character`) and `ve lint` raises no `character.*` line: Krish has approved the
  base, the library is built and the device is registered (`scripts/velib/character.py`).
- **9:16 only.** A wide placement waits for its own measured spot and his look (`acting.aspects` in
  `config/ve/character.json`). `spec.character.cuts` names tall cuts only.
- **Never in the hook.** No cue falls inside a cut's hook beat (`acting.not_in_hook`): the hook is the motion-designed
  statement, and the character arrives after it.
- When `style.idea.never` rules out figures acting out a sentence, the character stays off the piece.

## Which pose

The pose matches the beat's `point`, never the sentence's surface.

1. Read the beat's `point` and find the one word that carries its idea.
2. Read each pose's `use_when` line in `config/ve/character-poses.json` (its `poses` list) and pick the one whose
   `use_when` says what that word does: a count of two takes `two-fingers`, a direct "you" takes `point-viewer`, a firm
   claim takes `arms-crossed`, a turn in the story takes a thinking or reacting pose.
3. Put the cue on that word (`at_w`). The layer leads it by its own frames so the pose lands with the word.
4. Pick a side (`spot`) that points toward the thing on screen, never across it.

## How often

- At most 0.8 poses a second and at least 0.5 s apart (`acting.max_poses_per_second`, `acting.min_pose_gap_s`); a
  beat rarely needs more than one.
- The same pose twice in a row only when the point repeats; between ideas it rests on `neutral`.
- A pose never stands in for a picture: the beat still shows its real artifact or its data device.

## Never

- A pose the library does not hold. A new pose is appended to the library first by its own card, never drawn for a
  piece.
- A cue that covers the beat's key picture, the caption band or a channel's buttons. The layer moves or sinks the bust
  to clear them and refuses a cue it cannot clear; plan the cue where it can.
