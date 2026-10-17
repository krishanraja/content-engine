# How Krish says a script: the week of 12 October

Krish, 2026-10-17: "I also need you to list everything about my narration that deviated from the script, down to the fact
that I talk in, let's say, about 30% of that. Thats how script should be written in the future."

Seven takes, each lined up word by word with the exact script he read (`scripts/post-pack/narration_diff.py`; the transcriber's
habits are folded out, and the long cut's verified caption fixes are applied first).

- `<take>.md`: every difference, in order, with the time, the script's words and what he said. `fri-long.md` has all 172.
- `patterns.md`: the seven takes side by side. `habits-and-rules.json`: seven readers' notes, the rules drawn from them, and
  a skeptic's count of each rule against every take.
- `config/narration-ledger.json`: each take's rates, read by `story_check.py`.

## What the numbers say

| | Mon 3-min | Mon 90s | Wed 3-min (a, b) | Wed 90s (a, b) | Fri 14-min |
|---|---|---|---|---|---|
| His own words, of all he said | 9% | 16% | 24%, 25% | 20%, 33% | 38% |
| Script said word for word | 97% | 96% | 92%, 90% | 92%, 92% | 85% |
| Words a minute | 171 | 170 | 173, 181 | 179, 174 | 169 |
| Sentences opening So/And/But/Now/See (his, script's) | 41%, 20% | 33%, 13% | 36%, 16%; 28%, 19% | 33%, 16%; 36%, 17% | 50%, 17% |

He adds more as the week goes on; he almost never stumbles (one restart in 14 minutes); every 3-minute script ran over three
minutes and every 90-second script ran long.

## The rules (house rule SCRIPT_AS_HE_TALKS)

1. About one sentence in three opens with So, And, But, Now or See: So before a result, a verdict or the prediction; "Now,"
   before a new step or a question; And to carry a point on. Keep the full stop and say the link in the opening word. (7 of 7 takes)
2. The prediction is one spoken lead-in run into the claim ("So my prediction is that..."), never a bare "My prediction:" or
   "Here's my bet." (6 of 6), and its deadline is a period ("by the end of December 2027"; 3 of 3), with the exact day kept in
   the article and the record.
3. His words: "no one", not "nobody"; "I reckon", not "I bet". A question with no verb gets its verb. In a contrast, the shared
   word is said again ("before the singers get paid"; 5 of 7).
4. Facts, figures, names and sources go in short fixed lines: short lines are the ones he keeps word for word. He riffs in the
   set-up and at the turns.
5. One or two of his own verdicts softened his way ("kind of", "probably", "I reckon"), never a fact; "actually" on the turn;
   after his view, its reason.
6. Length: about 200 script words for the 90-second cut and about 400 for the 3-minute cut.

The checker (`story_check.py`) warns on 1, 2, 3 and the length, never refuses; the rest are for the writer and the judges.
After every take, `narration_diff.py` measures it and adds it to the ledger, so the rules follow how he talks as it changes.
