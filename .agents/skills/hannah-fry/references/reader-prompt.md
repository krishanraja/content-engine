# The teaching check: the separate reader's prompt

Start one fresh subagent (the Agent tool, description "Separate reader: teaching check"), give it this prompt word
for word and then the script's spoken words, nothing else. The session that wrote the script never reads for it.
One reader per cut, every time the words change.

```
You are judging a video script for how well it teaches, in the manner of the mathematician and broadcaster Hannah Fry: she makes dull topics gripping, never talks down to anyone, and is a joy to listen to. You hear the script read aloud once, as a smart, busy manager who is not technical. Judge only the words. For each of the eight moves below, answer PASS or FAIL, quote the exact line that earns it (or the line where it breaks), and for a FAIL give one sentence on what is missing.

1. QUESTION: By the end of the opening, I have been handed a question about my own world that I did not know I had, and I want the answer.
2. PICTURE BEFORE NAME: Every hard idea first arrives as something I can picture or an everyday comparison; any technical term comes after it, explained in plain words, or not at all.
3. ONE CHAIN: Each paragraph answers the question the one before it raised. I can name that question for every paragraph. Nothing is a list of points standing side by side.
4. SIGNPOSTS: At each turn in the argument the speaker tells me where we are ("here's the thing", "now this is the odd part"), and none of those markers is filler.
5. OBVIOUS, THEN TWIST: The script states what a reasonable person would already believe, fairly, before showing what does not fit. It never makes the other view look stupid.
6. HOW SURE: There is one plain line saying how strong the evidence is. It is not a run of caveats about methods, sources or limits.
7. RESPECT: Nothing talks down to me. No "simply", "basically just", "obviously", "as you know", "don't worry", and no explaining something I clearly already know. It assumes I am clever and busy.
8. DELIGHT: At least once the speaker lets me hear that they find this fascinating, and at least one dry, understated aside lands on its own, without needing outside knowledge to get it.

Then answer two more questions:
A. Quote the line where you were most curious about what came next.
B. Quote the first line where you stopped being curious, or say "none" if you stayed curious to the end.

End with one line: PASS if all eight moves pass and B is "none" or falls in the last two sentences; otherwise FAIL.
```

## What the session does with the answer

- **PASS:** write the reader's answer to the piece's plan folder as `teaching-check-<cut>.md` (beside
  `reader-test.md`), with the date and the script's sha256, and go on to the read-back.
- **FAIL:** rewrite the lines it names, in Krish's voice, keeping every checked fact. Then run the mechanical checks
  again (`story_check.py`, `humour_check.py`) and a new teaching reader. Never argue a fail and never ask the same
  reader again.
- A move that fights a house rule (see `breakdown.md`, "Where it meets Krish's house rules") goes the house rule's
  way. Note it in the file and do not count it as a fail.
