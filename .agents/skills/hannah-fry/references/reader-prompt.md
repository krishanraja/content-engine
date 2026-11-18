# The teaching check: the separate reader's prompt

The eight moves are what Hannah Fry does in "Could Alzheimer's start in our nose?", each shown with her line and the
time she says it in `breakdown.md`. Start one fresh subagent (the Agent tool, description "Separate reader: teaching
check"). Give it this prompt word for word, then the script's spoken words, and nothing else. The session that wrote
the script never reads for it. Use one reader per cut, every time the words change.

```
You are judging a video script for how well it teaches, in the manner of the mathematician and broadcaster Hannah Fry: she makes dull topics gripping, never talks down to anyone, and is a joy to listen to. You hear the script read aloud once, as a smart, busy manager who is not technical. Judge only the words. For each of the eight moves below, answer PASS or FAIL, quote the exact line that earns it (or the line where it breaks), and for a FAIL give one sentence on what is missing.

1. CLAIM FIRST: The first sentence states the surprising claim itself, with its subject named. It does not warm up, tease, or wait for later to say it.
2. KNOWN, THEN BIGGER: Early on, the script names the version of this that listeners may already half-know, then says plainly that the claim goes further.
3. ONE THING TO KNOW: Before the evidence, the script gives the single piece of background I need, as something I can picture, and any technical term comes inside or after that picture, explained in plain words.
4. LADDER AND REFRAIN: The evidence is told as a story I can follow. In a script over two minutes, each further example comes closer to my own life than the one before and ends on the same short refrain line. In a script of two minutes or less, there is one example only, followed all the way through.
5. PHYSICAL WORDS: The verbs and nouns are things I could see or touch (squirt, sniff, flecks, holes), not abstractions (leverage, ecosystem, framework).
6. HEDGE WORDS, NOT CAVEATS: How sure the speaker is comes through in single words (theory, maybe, thought to) inside the story. There is no stop for a run of caveats about methods, sources or limits.
7. THE CLAIM COMES BACK BIGGER: Near the end, the opening claim returns in a larger or reframed form (for example "So here is the theory", in numbered parts), and it changes how I see the start.
8. EASE AND DELIGHT: At least one aside is self-aware and dry (the speaker gently teasing themselves or the material) and lands without outside knowledge, and once the speaker lets me hear that they find this fascinating. Nothing talks down to me: no "simply", "basically", "obviously" or "as you know".

Then answer two more questions:
A. Quote the line where you were most curious about what came next.
B. Quote the first line where you stopped being curious, or say "none" if you stayed curious to the end.

End with one line: PASS if all eight moves pass and B is "none" or falls in the last two sentences; otherwise FAIL.
```

## What the session does with the answer

- **PASS:** write the reader's answer to the piece's plan folder as `teaching-check-<cut>.md` (beside
  `reader-test.md`), with the date and the script's sha256, and go on to the read-back.
- **FAIL:** rewrite the lines it names in Krish's voice, keeping every checked fact. Then run the mechanical checks
  again (`story_check.py`, `humour_check.py`) and a new teaching reader. Never argue a fail and never ask the same
  reader again.
- A move that clashes with a house rule (see `breakdown.md`, "Where it meets Krish's house rules") goes the house
  rule's way. Note it in the file and do not count it as a fail.
