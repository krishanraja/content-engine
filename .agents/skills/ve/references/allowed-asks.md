# Allowed asks: no approvals during production

Every production skill (make-piece, ve, produce-video, motion-designer, thumbnail-designer) points here from its own
"Allowed asks" section. The list itself is `config/ve/asks.json`; `scripts/validate-skills.py` refuses a production
skill that tells a session to wait for Krish anywhere outside that section.

Ruling (Krish, 2026-11-19): no approvals during production. Between Sign storyboard and the final review the engine
never stops to wait for him. His words: "We need to eliminate the 4 million approvals like this that I'm required to
make. It basically means I have to sit there for 7 hours waiting for the next stupid fucking approval to give and the
engine refuses to move on even though it's just going to lead to more errors anyway."

## The four moments he is asked

1. **The lock.** He signs the narrative lock: the recipe picked from the proven list and one credit ceiling for the
   whole piece.
2. **Scripts and storyboard, one press** (Sign storyboard), before he records. Rules and the engine freeze here.
3. **The final review.** One screen: both cuts and the article, every default the session chose (the piece's
   for_final_review lines, each changeable in one press), the critic's notes, and his Approve bound to the file shas.
4. **Publish.** He publishes; nothing in production publishes, posts or schedules.

## Between Sign storyboard and the final review

- Decide, record, carry on. No board question, no `blocked` question, no item on his list, no typed approval, no
  wait. A session never asks him to approve the engine or a renderer hash, and never asks for a typed "final approve"
  before a file is filed.
- Anything he might want to change is one line on the final review:
  `python3 scripts/post-pack/making.py <piece> final-review KEY "LINE"` (KEY such as `title_youtube`, `thumbnail`,
  `speed`, `music`, `take_short`, `fact_1`, `motion`). A newer line on the same key replaces the older.
- Titles, thumbnail, cover, speed, voice, plan swaps and lines "for his ear": the recipe's or the round's default is
  taken and recorded, never as his pick; he changes any at the final review.
- An unsure take: the session matches it by its words, length and script hash and records the match as a line.
- A deterministic failure is fixed by the engine, or passed when inside its stated tolerance, or logged as an engine
  bug. A model critic's opinion is a note on the final review, never a block.
- The proof is a preview he may look at; the whole cut renders without waiting on it.

## Spend, filing and freezing

- Spend inside the credit ceiling signed at the lock needs no further ask (Ruling, Krish, 2026-11-19). Every
  generation, music, sound, Maxine and Codex dispatch reserves against it; at the ceiling the spend is refused,
  recorded as a final-review line, and the piece carries on without it.
- Filing to his own post folder needs no approval; his one final Approve press on the board, bound to the file shas,
  gates publishing only (Ruling, Krish, 2026-11-19).
- Rules and the engine freeze at Sign storyboard; a new rule or fix binds from the next piece (Ruling, Krish,
  2026-11-19).

## Where the code still asks

Some gates in code still hold for a press until the press model changes (the plan's PR 5, 16 and 17a): `ve render`
refusing a whole cut without a proof approval, the thumbnail drawer refusing words without his `picked` verdict, and
`making.py video` refusing an options-set thumbnail he has not picked. Where one holds, report it `blocked` once as an
engine gap and carry on with everything that does not need it; never ask him in chat or on the board to clear it.
