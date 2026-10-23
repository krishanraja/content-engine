# Narrative: Friday 23 October, mind.the.gap

Piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`. Status: **signed** (second version).

Signed by Krish: "Signed, go ahead and draft the scripts", 2026-10-23

## His words that fix this narrative

- His brief, on the board, 22 October 2026: "This really needs to be a simple explainer into what
  the main countries leading the AI race are. What is sovereign AI and what does it mean? What have
  news articles like this and others exposed about what other countries' AIs are doing differently?
  Which types of businesses are using other countries' AIs? Of course what does that mean when
  you're considering an AI from a different country?" (in full in `docs/plans/2026-10-23-friday/story.md`)
- His pick of the story, in the session, 22 October 2026: "A opening on B's hook (I like "You may
  already be using a Chinese AI." hook), I'll run the test tonight". A was "every AI has two
  passports"; B was "you may already be using a Chinese AI".
- His view, 23 October 2026, which adds an action ("It just increases the need to not have
  overreliance on one supplier"): in full in `docs/plans/2026-10-23-friday/story.md`.
- His action, 19 October 2026: "ask the AI you rely on, and one built in another country, the same
  three business questions, and see where they differ."

The first version of this narrative (19 October, the side-by-side test alone) was never signed; it is
in git history.

## 1. End message

"You may already be using a Chinese AI without knowing it: where an AI was born shapes what it tells
you, and where it lives decides who sees your data, so check both before your business relies on it."

Checked against the research (`docs/plans/2026-10-23-friday/research-gaps.md`): "may already be
using" holds (Airbnb's boss, Cursor and Lindy said so themselves); "shapes" is used, not "decides",
because how much a model's birthplace shows varies by model and version (the US government's own
test of DeepSeek on its own computers found it built in; one other Chinese model answered freely once
hosted outside China).

## 2. Who it is for, and what they do on Monday

The leader of a medium-sized company whose team uses AI tools every day, some of which may run on
another country's AI underneath, and who may have tried DeepSeek on their own phone. On Monday they
ask their main software suppliers which AI their product runs on and where it runs, and put the same
three work questions to the AI they rely on and to one born in another country.

## 3. Checkpoints

| # | Checkpoint | Pass test | Krish signs |
|---|---|---|---|
| 1 | The hook: you may already be using one | Airbnb's boss's own words (October 2025, said as last year), Cursor's admission (March 2026) and Lindy's switch (July 2026), each read at its source and said in plain words | which of the three the scripts name |
| 2 | Who is in the race, and what sovereign AI means | America and China in one line each from Stanford's 2026 index (59 against 35 notable models; $285.9bn against $12.4bn; the best Chinese model within about 3%); "everyone else wants its own" in one line; sovereign AI in one sentence a 12-year-old follows | the one-sentence meaning |
| 3 | Passport one: where it was born shapes what it says | The Monitor's test (about a third of 200 news questions refused, government lines or wrong; DeepSeek about two in three; Claude answered all) and one American example (Grok checking Elon Musk's posts), both read at the original | the figures |
| 4 | Passport two: where it lives decides who sees your data | HSBC running France's Mistral on its own computers; running a model yourself keeps your data home but keeps what the maker trained in, and how much depends on the model | the line |
| 5 | His test | The same three questions, word for word, put on one day to Claude and DeepSeek in their own apps, every answer kept in full; a plain list of what differed (the same, softened, refused, different facts), each item pointing to a kept answer | the list |

His change to checkpoint 5, 23 October 2026: "Add ChatGPT in there as well", with every setting
matched across the three apps ("all those things need to be apples for apples"). The run follows
`docs/plans/2026-10-23-friday/cowork-test-prompt.md`.

His redesign of checkpoint 5, 23 October 2026: "deepseek does not have the same access to my emails, and this
question is very vague, I don't think you are really thinking much about how to design a test that yields the
experiment needed". The test is now two matched pairs, each asked twice with only the place changed (Xinjiang against
Turkmenistan, Taiwan against Singapore), self-contained so no app uses his accounts, with what is read from each answer
written down before the run: `docs/plans/2026-10-23-friday/test-design.md`. The first three questions (19 to 22
October) are in git history.

## 4. The one picture

His own test: the same question at the top, Claude's answer and DeepSeek's side by side below it,
the lines that differ marked. The point it carries: the difference is real, and you can see it in a
work question, not only a political one. The question it answers: "Does it matter which country built
the AI my team uses?" (Made after he records; his words, 22 October: visuals "we could deal with
later".)

## 5. Out of scope

Which country's AI is better overall; telling anyone to stop using Chinese AI (the tone is eyes open
and positive: these are good, cheap tools with one thing to check); politics beyond what the tests
show; how the models are trained; any claim about why a model refused that its maker has not said;
any claim that Airbnb still uses Qwen today (only that its boss said so in October 2025).

## 6. Drift rule

Any change to the end message, the action or a checkpoint goes back to Krish before work continues.
