# A longer long cut

Read this when a piece's signed narrative lock asks for a long cut longer than about 5 minutes (make-piece, the
Scripts step).

House rule TWO_CUTS; Ruling (Krish, 2026-11-14): the long cut's word cap lifts for a piece when the story is worth
it; the narrative lock says so and why. His words: "lift if worth it".

The long cut is 675 to 825 spoken words. When the signed lock asks for a longer one (its Style recipe, or his words
in it), judge, from the lock and the research, whether the story is worth the minutes: two stories that each need
setting up for a slow listener, a draft that has to squeeze a section he asked for, research deep enough to carry
it. Never lift it to fill time.

If it is worth it, add the piece to `config/long-cuts.json`:

- `words`: above 825 and at most 1,200 (about 8 minutes at 150 a minute), never more than he asked for;
- `lock`: its signed narrative lock, `docs/plans/<Monday>-week/narrative-lock-<day>.md`;
- `lock_says`: the lock's own words asking for the longer cut, quoted exactly;
- `reason`: one line, at most 140 characters, why it is worth it (the board shows it);
- `judged`: who, when and why.

Then:

- `python3 scripts/post-pack/long_cut.py <uuid>` says what the long cut may run to, or why the lift does not hold
  (a lock edited after he signed it, words it does not hold, more than 1,200 words);
- check the long script with `python3 scripts/post-pack/story_check.py --cut long --piece <uuid> long.md`, which
  holds it to that length and says it is lifted;
- `making.py <uuid> scripts` checks it the same way and records the lift (`script_check.long_cut`), so the Scripts
  step on the board names the length and the reason; `build.py` reads it by the post's `piece_id`.

If it is not worth it, keep the long cut at 825 words and say why on the day's tab. Never lift it any other way.
Spend the extra minutes on explaining, never on more figures or names than house rule LISTENING allows.
