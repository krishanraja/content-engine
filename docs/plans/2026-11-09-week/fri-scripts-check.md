# Fri 13 Nov scripts: checks, facts and read-back (make-piece run, 3 Nov 2026)

Piece f3fcd5e1-573e-4692-a413-db7c5823a10e, from the signed lock `narrative-lock-fri.md`.
Scripts: `docs/plans/2026-11-13-draft-script.md` (5-minute) and `-90s.md` (90-second).

## Gates
- `story_check.py` ready for both (`--series mind_the_gap`). One warning is kept on purpose:
  PERSONAL_INTRO, because the signed style recipe opens cold on Hanoi 1902 (the random-headline experiment).
- `copy_lint.py` clean; kill list PASS, 0 vetoes.
- `making.py scripts` recorded both (Scripts: done, not in Teleprompter yet).

## Facts the scripts state, checked against the lock's sources (3 Nov)
- Meta board: Fortune 9 Apr 2026. "A Meta employee independently created" it; titles include "Token Legend";
  it came down two days after the news broke, removed by the employee, not by Meta. The scripts
  say "came down" and "one of its staff built", never "Meta shut it".
- Meta reviews: daily.dev, Sept 2026: "will no longer use AI adoption dashboards or token counts to evaluate performance".
- Amazon: CIO, 29 May 2026: "Kirorank", unofficial board for the Kiro tool; staff made agents do
  "unnecessary tasks" to raise scores; taken offline; a senior VP said its compute costs were too high.
  CNBC, 27 Oct 2026: token usage and the like are "deeply flawed" measures; "a finding, not a failing".
  **Not found in either source:** "tokenmaxxing is at odds with frugality". The lock lists it; the scripts
  leave it out. The article must not quote it until a source holding those words is filed.
- Quota study: arXiv 2609.32859 abstract: one large medical-device company, about 5,000 staff, target of 200
  queries a month, 31% repeated or off-task, target lowered to 100, volume down 30% (about 90% of the drop
  was junk), monthly sales up 7%, staggered rollout across branches.
- Cobra: The Juggernaut: "little evidence to support the veracity"; Horst Siebert, 2001.
- Not re-fetched in this run: Hanoi (Vann 2003), Shopify memo, Duolingo reviews (well documented; check at the fact gate).
- The engineer's joke is one person's post, said as a joke in the script.

## Read-back: three rounds, readers A, B and C on each cut
Every retelling matched the spine and answer in all three rounds. No round came back "nothing" from all
three readers. Each round found smaller things, which were fixed: who "they" was in the joke, "Cache
Wizard", "the news", Kiro, why tails, "board" heard as board of directors, the vague close. What the last
round still raised: whether halving the target caused the sales rise (the long cut now says branches were
compared), and "delete" the target when the study only halved it (that is Krish's agreed takeaway, so kept).
Per make-piece step 4, the words are on Friday's tab for Krish (two review boxes and one waiting line, web
board build 9db178ac). His Approve scripts press is his sign-off. Record it with
`making.py <uuid> read-back long|short --krish-words "Krish, DATE: ..."`; no reader read-back is recorded as passed.
