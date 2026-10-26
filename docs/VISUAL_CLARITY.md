# Visual clarity gate

Krish, 25 October 2026: country names, people and other entities should have visual representation; accomplish clarity creatively with as few words as possible; judge whether a layperson understands the cue in three seconds or less. Words in visuals must never merely duplicate the script or captions.

## Plan the picture before the words

For each beat, write the viewer's one takeaway, then identify the subject and the action or relationship. Start with zero on-screen words. Consider a real object/person, a demonstration, and a spatial comparison; use the one that communicates the point fastest. Add a short label only where the picture leaves a consequential ambiguity. Do not replace a spoken sentence with a written synonym.

| Entity or point | First visual option | Check before using it |
| --- | --- | --- |
| Country | Correct flag beside its short name | Equal size and treatment; identity, never a warning about nationality |
| Named person | Verified portrait, with their name only if needed | Correct person and source; no invented likeness |
| Company or AI model | Official recognisable mark | Avoid a second text name where the wordmark already supplies it |
| Place | Recognisable photograph or location view | Must identify the actual place, not a generic substitute |
| Hosting or data movement | Server/phone and visible packet movement | Destination and relationship must be understandable; a server alone is not proof of geography |
| Quantity or comparison | Countable objects, proportion or aligned comparison | Accurate denominator; never invent a breakdown the source does not give |
| Changed/deleted content | The actual before/after or screen recording | Preserve the real event, sequence and qualifications |

A flag solves country recognition; it does not explain how an AI works. An icon that requires a sentence to decode has failed. Not every noun needs another icon: the cue must help the viewer understand the point.

## What is enforced

`config/visual-clarity.json` sets conservative implementation defaults: at most eight primary words and sixteen total legible words per visual state. Source labels and readable words inside images count. These numerical defaults are implementation choices, not numbers quoted from Krish. Splitting a sentence between labels cannot evade the repeated-phrase check. No paragraph is exempt because it is inside a screenshot.

`scripts/quick-edit/visual_clarity.py` checks a frame-range inventory against the actual narration. It fails on excess words, shared phrases of three or more words, missing label purpose, missing visual cues and incomplete frame coverage. A role label alone does not prove that the text adds information: semantic repetition, including paraphrases, needs independent review.

`quality.delivery_problems` invokes the gate for delivery. `make.py` starts its receipt as not run. Final approval requires the exact video hash, actual frame count, hashed narration, complete rendered-text inventory and independent review evidence. A bare `status: pass`, a changed export, or a missing evidence file cannot pass. Working previews remain available for critique and are never called final.

## Three-second check

Show the visual at phone size for no more than three seconds, with sound and captions off, to a layperson who has not seen the script or the intended explanation. Then hide it and ask neutrally: “What did you see? What point did it make?” Record the actual answer before showing the intended takeaway. Passing requires the correct subject and point, with no misleading inference. Record confusion rather than coaching the answer.

The author's own review, automated word counts and contact sheets are prechecks. An independent model shown only the visual may predict whether a layperson can understand it in three seconds; that review must be blind and explicitly labelled `prediction_not_human_test`, with its first interpretation and rationale. It may support the production gate, but is never reported as a measured human result. Actual human testing records timed exposure and the person's response. This adds no new approval request to Krish and permits no generated or prefilled human results.

## Friday status

The latest production revision is `plans/2026-10-23-friday/revisions/clarity-v3/visual-copy.json`. Its three-beat study passes automated word/phrase checks; independent semantic review and timed layperson comprehension are pending. The remaining beats must be inventoried and revised before final delivery. The four final videos and final Publish Board remain incomplete.
