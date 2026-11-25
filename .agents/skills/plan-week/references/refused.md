# What he refused stays refused: the ideas board's checks in code (the ideas quality plan, Wave 1)

Read by every run of `plan-week` before step 1, and again at the triage readback (step 8) for the scorecard. Before
ideas.json is kept, `python3 scripts/post-pack/board_feed.py gate <Monday>` must pass, then `cover`.

Krish, 2026-11-09, of the 16 Nov board: "I just said that Infosys is boring so why did you make the piece about
Infosys?" The run had his "Infosys is boring as hell" and ranked it first anyway. Nothing here is a new rule: each check
enforces a rule already live, or his own words on that item, and keys narrowly ("I would much rather the engine know
what kind of thing doesn't fly with me, rather than implement incredibly specific rules everywhere"). The checks are code
(`scripts/post-pack/idea_checks.py`), run by `board_feed.py cover` and `board_feed.py gate <Monday>`; the workflow runs
`gate` again and keeps the week off the live board while it fails.

- **A subject he refused is not offered again.** His Reject (`sources.json` `outcomes.rejected`, his not-for-us cues,
  his Drops) keys on the subject his refusing words share with the option he refused (Infosys), never on every company
  an option names; with no name in his words it keys on that idea only. An option on it fails the run, unless it answers
  one of his asks (its `covers` names one), he raised the subject again afterwards, or he gave it back with "Offer it
  again". List every refusal that stands in ideas.json `vetoes` (`{"subject", "said": his words exactly, "at", "ref",
  "day"}`, as `cover` prints them); the board shows each as "Not offered again: <subject>" with his words and the one
  press that gives it back. A rejected idea is already out of the pool (`skipped.rejected`) and is one of his Drops.
- **His tick outranks an older refusal.** Ruling (Krish, 2026-11-12): his own tick outranks an older refusal; the
  idea comes to him with the refusal shown, and only his Approve places it. An option from an Inspiration card he
  ticked (`from_inspiration`, written by `inspiration_act.py place`) on a refused subject never fails the gate: it
  carries the refusal in `refused_before` and the gate prints a `his tick:` line. Every other option keeps the checks
  here exactly. Every line the gate prints names the refusal that matched and why ("it is the same idea he refused", or
  the name his refusing words and the option share).
- **Refusing words inside another press warn.** "boring", "lame", "no point", "don't understand" in a Track, File or
  Improve press: the option on that subject carries `warning` (`{"subject", "said": his refusing words exactly, "at"}`,
  drawn first on the option) and is never first on its day nor `recommended`. It blocks only once he approves P6 on
  his taste ledger (`idea_checks.P6_APPROVED`, his to change).
- **Depth before he sees it** (his words on the 9 and 16 Nov boards: "give me a Perplexity prompt", "10 times the
  amount of research"), after step 2 and before step 3. For every publishing-day option and every return, first use your own web search to
  find the newest sources and answer each question he asked, then write `research_prompt`: one ready prompt he can paste
  into deep research (Perplexity or another), naming the plain question, what to find, the date range from his press,
  and that every claim comes with its source and date. It is 150 characters or more, and it asks for **the 5 Whys**
  (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that suggests predictions,
  calls, dated, odds or scores): starting from the plain question, one answer per Why backed by two primary sources on
  different domains, dated, with a verbatim quote; the strongest counter-evidence or "none found" with the scope
  searched; a stop where the evidence runs out, never padded to five; and a landing of what this shows plus an open
  question, never a forecast. Why 1 starts by series: who pays and why the price moved (follow.the.money), how it is
  built and what broke (under.the.hood), where the claim and the reality part (mind.the.gap). `idea_checks.py` refuses
  one that does not name the 5 Whys from the 30 Nov board (`WHYS_FROM`).
- **Read what he refused and the house rules first** (in step 1, after the gather): `sources.json` `outcomes` (his answers on the eight
  boards before), `unvetoed` (the subjects he gave back) and `house_rules` (BIG_PICTURE and STORY_ARC, in full). Say in
  your reply how many answers of each kind it holds and which subjects stand refused.
- **A return comes back deeper, or is held.** An idea he filed for later, saved as a trend or asked to improve comes
  back only with `returns` (`{"press": "<week>/<doc>", "said": his words exactly, "answers": [{"q": each question he
  asked, exactly, "a": the answer}], "sources": [{"url", "date"}]}`, at least one source dated after his press),
  changed copy and a `research_prompt`. Otherwise leave it out and say why in ideas.json `held` (`{"ref", "day",
  "title", "reason"}`), which the board shows. Where he pressed Next week after refusing a subject, the return is not
  vetoed: it must come back deeper.
- **His half is his, or stated empty.** An option is `his` or `inspo` only when it points to his own typed ask, card or
  material (`covers`, or its id is his own idea in the pool) or names his worded press in `from_press`
  (`"<week>/<doc>"` or `"cue/<id>"`); a press that refuses the subject never counts. A day with nothing of his says why
  in ideas.json `his_empty.<day>`, never fills the half.
- **The plain question first** (house rules BIG_PICTURE and STORY_ARC, both live and both his; `sources.json`
  `house_rules` holds their words: read them as the judges and writers do). From the 23 Nov board every publishing-day
  option is a full `pitch` that opens on `question`: one plain sentence ending in "?", at most 25 words, naming no
  company, product, person or study. One company's news or one study is the example inside the pitch, never the
  question. Each carries `research_prompt` (step 2a) and `source_tag` (`his_ask`, `his_card`, `his_idea`, `his_press`,
  `his_queue`, `inspo_card`, `newsletter`, `instagram`, `creator`, `engine_research`, `radar` or `trade_press`), and
  every off-day option a `source_tag`.
- **Nothing that went out is offered again, every option has its shape, and a re-run of some days keeps every
  answered option** (Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly things we published last
  week"). `gate` fails on a repeat (code `repeat`: a recent post's primary source or words, an earlier board's option he
  did not send back, the same evidence as a post, two options on one story) and, from the 23 Nov board, on an option
  without `shape`, `aim`, `funny` and `lookalike` (code `aim`); `board_feed.py keep` holds a `days` re-run to the open
  options. The rules and the fields: `references/lookalike.md`.
- **The scorecard.** After his presses, `python3 scripts/post-pack/board_feed.py scorecard <Monday>` counts his real
  presses on that board, each count beside its written rule and each label beside his exact words, and writes
  `docs/plans/<Monday>-week/scorecard.json` (ids, labels and counts only). Read it into the triage readback (step 8),
  its counts and labels beside his words; he can overrule any label. The history test (`scripts/post-pack/ideas_history.py check`) replays every check on his past
  boards; a new check joins only when it still passes.

## The second part (items 4, 6, 8, 10 and 12), from the 23 Nov board

`board_feed.py cover` checks each; none of them fails the gate.

- **His words split** (item 4). Each worded press of his on last week's board is split into its parts in ideas.json
  `split` (`[{"ref": "<week>/<doc>", "parts": [{"kind", "quote"}]}]`, kinds `refuse`, `reframe`, `depth`, `simpler`,
  `format`, `wish`), each part an exact quote of his words. A press whose words refuse (boring, lame, no point, don't
  understand) has a refuse part quoting them. The split is your reading: the quotes keep it honest, and the refusal
  checks read his words, never the split. Until he approves P6, a refusal in a press that was not a Reject shows as a
  warning line on its option, never ranked first (above). Durable storage of the split waits for his yes on a migration.
- **His asks at full scope** (item 6). An option that covers his ask quotes it word for word in `asks`
  (`[{"id", "said": his words exactly, "scope": "as_typed" or "narrowed", "why": when narrowed}]`), and says why when it
  narrows it ("software to edit itself on the fly" is a bigger question than one lab's find). An open ask left off the
  board is in `accounted` with a reason that cites only rows that exist in `sources.json`, never swaps his question for a
  narrower one, and is a held line on the board: `held` with ref `ask/<id>`, the reason he reads, his words exactly in
  `said`, a `title` that names what it is about (the post he saved and what to make of it, never his words alone), and,
  for an ask from a card, the card's own link in `source` (`{"label": "<what it is, as he would name it>", "url": "<the
  card's link>"}`). Krish, 2026-11-16: "feedback and suggestions like "Let's make a hilarious meme" end up in the ideas
  board without any context of what I actually wanted to make a hilarious meme about. We've now ended up with a vague
  instruction where I actually put on the inspiration board something very specific." The gate holds it (code `held`).
  Hold an ask only when making it now would break a rule he set; otherwise make the idea he asked for.
- **Off days say what they learned** (item 8): every off-day option quotes the earlier verdict of his it learned from
  (`references/offdays.md`).
- **Look at more, show the best** (item 10). Research up to eight candidates for each publishing day and show the best
  four; record how many in ideas.json `considered` (`{"mon": 8, "wed": 7, "fri": 8}`), at least as many as shown. On
  7 Nov the ideas stage used 20 of its 240 minutes: the time is there.
- **Saturday's good news reads his positive saves first** (item 12; `references/offdays.md`, "The Saturday good
  news"): each story tagged with its `kind`, the mix shown on the board.
- **What the run reads beside the cards** (item 9): `sources.json` `inspiration.feed` (the feed's posts of the last
  eight days: other people's posts, a topic signal, never his view), `inspiration.corrections` (his corrections reported
  from sessions, his words exactly, with where he typed them), `inspiration.hindsight` (his hindsight scores and notes on
  published pieces) and `inspiration.positive`. A wordless card from a bulk import (25 or more saved in the same minute)
  leaves `fresh` and stays in the library (`counts.fresh_left_out_bulk_wordless`). A newsletter is a lead, never the
  angle. The full text of his newsletters and his Drive inspiration folder are not read yet: the engine keeps only each
  newsletter's mined seeds, and a Drive connector on the Sunday workflow changes what that job can reach, so it waits for
  his yes.
