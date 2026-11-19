# The Critic's two questions, before anything is made (from 19 Nov 2026)

Krish, 2026-11-18, of the Tue 17 habits short, which reached the full render before the ve-critic blocked it on two things
knowable on day one: "how you are able to get all this way through to production and point out those two things - thats
ridiculous [...] that should have been picked up at the start".

What `ve lint` checks of `style.idea`:

- `idea.*`: the idea EXISTS and is complete: an object, a `means` per move, a non-empty never-list, a real artifact shown.
- `idea.one_object` (pieces published from 19 Nov): its CONTENT. No move's meaning acts out the line ("his line taken
  literally"); and the piece does not draw a different generated picture for almost every beat: more than 4 distinct
  generated illustrations or b-roll, unless `style.idea.carrier` names one asset or object that persists across at least
  60% of the beats. The numbers are in `config/ve/production-guards.json` (`one_object`) and are Krish's to change.
- `critic.pre`: the questions below were answered for this spec as it stands.
- Lint does not judge whether the idea is a good one: that is the reviewer's.

The two questions:

1. Does this carry one idea as clearly as The Ladder (Mon 2 Nov: one object, every move meaning something, nothing acting
   out a sentence)?
2. Is any number on screen invented: a figure the piece does not own (its datasets, real artifacts or his script)?

`ve critic --pre <piece>` writes the reviewer's inputs: the spec digest, the storyboard table and every card brief. A reviewer
who did not write the spec answers each in one line citing a beat or card; `ve critic --pre <piece> --write --reviewer NAME
--answers answers.json` records `verdict.pre.json`, bound to the spec's hash (his approvals do not make it stale; any other
change to the spec does). `ve card` and `ve lint` refuse a piece without a passing one. Do not ask Krish for Sign storyboard
until it passes: ve cannot hold that board press.

The never-list is not decoration: `ve card` writes the spec's `style.idea.never` into every card for the piece and refuses a card
whose quoted on-screen words carry a number the piece does not own (`numbers.invented`; a figure you supply goes in the card's
`numbers_supplied`); `ve verify-card` reads the numbers off what Codex made (OCR; `not_run` and said so when tesseract is absent).
