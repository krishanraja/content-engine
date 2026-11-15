# The plan: what goes in the spec, what goes in the storyboard document

The plan lives in two places only. The spec holds what the engine draws, in fields it already has. The storyboard
document (`<ve dir>/storyboard.md`, beside `expect.md`) holds what a person needs to read and the spec has no field for.
Nothing else is written: no scene file, no per-piece code.

## In the spec: the piece's choices

Each choice carries its `reason` in one plain line that names this piece's point, never a general preference.

```json
"style": {
  "idea": {
    "object": "the one object or system that carries the piece, in a sentence",
    "moves": [{ "move": "fills", "means": "what that move says about the story" }],
    "never": "what this piece never does, in a sentence",
    "real_artifacts": [{ "asset": "an asset id in the spec", "text": "the words on it, as they are" }]
  },
  "motion": { "module": "his pick from ve styles", "reason": "why it suits this piece's point" },
  "transitions": { "kind": "cut", "reason": "how this piece hands over, and why" },
  "camera": { "move": "drift", "hits": true, "reason": "what the camera does between events" },
  "energy": "medium",
  "layout": { "mode": "band", "reason": "how his take and the graphics share the frame" }
}
```

## In the spec: one beat

```json
{
  "id": "b3-the-press",
  "role": "anchor",
  "span": { "from_w": 41, "to_w": 58 },
  "viewer_task": "inspect_artifact",
  "point": "One sentence a stranger would follow with the sound off.",
  "layout": "STAGE",
  "plate": { "source": "asset:real-page" },
  "uses": ["screen", "answer"],
  "events": [
    { "at_w": 41, "obj": "screen", "verb": "enter", "to_state": "the real page, every box at its final size" },
    { "at_w": 42, "obj": "answer", "verb": "enter", "to_state": "the answer box, empty, at its final size" },
    { "at_w": 44, "obj": "screen", "verb": "move", "to_state": "cursor glides to the send button" },
    { "at_w": 46, "obj": "screen", "verb": "pick", "to_state": "pressed on the word 'asked'" },
    { "at_w": 47, "obj": "answer", "verb": "type", "to_state": "the answer types into its reserved box" },
    { "at_w": 53, "obj": "screen", "verb": "highlight", "to_state": "the result line in mint" }
  ],
  "transition_out": "carry"
}
```

Each verb is one its object's device lists in `config/ve/devices.json`; compile refuses any other. The words in
`to_state` say what the frame shows once the move has landed, in plain words; they are what the Critic checks the
frame against.

## In the storyboard document: one paragraph a beat

```
b3-the-press (anchor, words 41 to 58). The real page fills the stage from its first frame, every box already placed.
The cursor glides to Send, waits a word, presses on "asked"; the answer types into its box and the result line goes
mint on "nine". Hands over by carrying the answer box into b4. Gap: none.
```

A move the device library cannot draw is written as `Gap: <the move>, needs a device card`, and the beat is planned
with what the library can draw today.

## The self-check, every beat

Answer each for every beat before `ve lint`. A no is rewritten, never waved through.

1. Is the `point` one idea, one sentence, clear with the sound off?
2. Does every event sit on the word that names its change, with at least one event every 3 seconds?
3. Does every object enter before anything else happens to it, and have a word's room to land?
4. Does the outgoing beat leave before the next arrives, with no grey or empty frame between a light and a dark ground?
5. Does the handover fall in one of his pauses?
6. Where a cursor acts, does it glide, wait a word, press on the word and let the screen act?
7. Is every box at its final size on the beat's first frame, so nothing re-wraps?
8. Is mint on one thing only, the active or the result, and never on type?
9. Does the frame use the safe screen, with nothing under 30 px and no small device in empty space?
10. Is the real artifact shown as itself, every figure from a dataset with its producer?
11. Is nothing on the refused list (`.agents/skills/motion-designer/references/adaptations.md`)?
