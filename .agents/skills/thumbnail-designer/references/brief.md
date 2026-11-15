# The thumbnail brief

Reference for `.agents/skills/thumbnail-designer/SKILL.md`, step 1. Write it before any option is drawn; the drawer
(`scripts/pages/build.py --thumbs --options`) refuses to draw without it (`thumb_options.py`, `brief_problems`).

The brief is short on purpose: a thumbnail makes one promise, and every option must keep it. Write it from what he
said on camera and from the piece's checked facts, never from what would get the most clicks.

## The fields

```json
{
  "promise": "Google paid $2.7 billion for Character.AI's team before Disney moved",
  "supported_by": ["the long script, line 4: 'Google paid two point seven billion first'", "source s3, the court filing, page 12"],
  "avoid": ["that the deal was illegal (the piece does not say so)", "that Disney lost money (no source says it)"],
  "words": ["GOOGLE PAID", "$2.7B FIRST"],
  "named": ["Google"],
  "references": [
    {"card": "bright-number-tile", "source": "1AbCdEfGhIjKlMnOpQrStUv", "looked_at": "2026-11-15T10:12:00+00:00",
     "why": "one number fills the tile and reads at grid size"}
  ]
}
```

- **promise**: one line. What a stranger will believe the piece gives them after one look at the thumbnail. It must
  be the piece's real story (the floor: "Never title or caption a piece with an angle or claim that isn't actually in
  the piece").
- **supported_by**: where the piece holds the promise up: a line he says, a checked source and where in it. At least
  one. If you cannot point to one, the promise is wrong; change it, not the evidence.
- **avoid**: the claims the thumbnail must not make, even by suggestion: what the piece does not say, what no source
  proves, a superlative nobody checked, a framing that names one country as the threat. At least one.
- **words**: the exact words he picked for the thumbnail, split as they are drawn (the lead, then the part on the
  series colour). The drawer refuses words that are not the ones in the facts. At most 7 words (the cover standard,
  point 1).
- **named**: the companies the headline or the picture names. These are the only logos a thumbnail should carry
  (point 3). `[]` when it names none.
- **references**: the inspiration cards you actually looked at for this piece, by the rules in
  `.agents/skills/thumbnail-designer/references/reference-library.md`. It may be empty; say so in your reply when it
  is.

Keep it in the work folder (`WORK/thumbs/brief.json`). The set's record (`thumb-options.json`) keeps its sha256, so
the critic and Krish judge the options against the brief they were drawn from.
