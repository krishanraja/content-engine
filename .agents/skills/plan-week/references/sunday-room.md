# The Sunday room: the interview and the narrative lock

Reference for the `plan-week` skill, read at steps 9 and 10 (`.agents/skills/plan-week/SKILL.md`). It holds the
interview protocol and the lock's exact shape, moved out of the core so a session starts lean
(`docs/COST_GUARDS.md`, G14). The steps, the checks and the gates stay named in the core.

Krish, 2026-10-28: "Claude interviews me on all three ideas to nail down the narrative arc, make it really
powerful, useful, and fun to consume, and really find the deeper story beneath the surface story."

## The interview protocol, which never bends

- **One question at a time** (learning `one-question-at-a-time`): the one that changes the work most first,
  across all three picks rather than Monday's first by habit, each with your best guess, and the next only after
  he answers.
- **Each question settles one part of a lock** (step 10): the deeper story beneath the surface story; the arc;
  what makes it fun to consume; what makes it useful, the one thing a business leader does differently on Monday
  (the lock's The use); his close, his own call in his own words (ask for it, never write it for him; learning
  `his-call-in-his-words`); the facts that must be checked; the spine of the outline and its sections; the style
  recipe (a script format, a production format and the experiment, from `config/style-references.json`
  `formats`); and the music bed (an approved track in the ledger, `config/music-library.json`; never browse Drive
  for audio).
- **Check before you ask.** A fact you can check is checked, not asked; what `docs/CADENCE.md`, the house rules
  or his recorded words already answer is never asked. A line he gives that the evidence does not hold is said
  back to him with what the source says, as the next question.
- **His answers are kept verbatim.** Each question in one line, its best guess and his exact answer, with the
  time, go into `docs/plans/<Monday>-week/interview.md` as he gives them: his words exactly, and never the rest of
  the chat (exact excerpts, never whole transcripts). A lock quotes his words where they decided a part; a
  paraphrase is never his.
- **Confidentiality is a hard gate.** `interview.md` and the lock are committed and merge to main, so they stay in
  git history. An answer he says is off the record, or one that names a client, a deal figure or anything else
  private, is kept out of both: the file says only that something was withheld, why in a word ("off the record",
  "names a client") and when, never what.
- **The clock.** When a piece's parts are all answered, put its lock to him (step 10) without waiting for the
  others. At 11:45, say which parts are still open, with your best guess for each, and ask whether to sign as it
  stands: recording starts at 13:00.

## The lock's exact shape

`docs/plans/<Monday>-week/narrative-lock-<day>.md` (`mon`, `wed`, `fri`), written flush left in exactly this
shape (`making.py`'s `LOCK_PARTS` reads each part):

```
# Narrative lock: <Ddd D Mon> <series> - <subject>

piece_id: <uuid>
Publishes: <YYYY-MM-DD>

## Surface story
## Deeper story
## Arc
## The fun
## The use
## His close
## Facts to check
## Outline
Spine: <the one question the piece answers>?
Answer: <its one-line answer>
1. <SECTION HEADING> | proves: <the part of the answer it proves>
## Style recipe
## Music bed

Signed by Krish: "<his words>", <YYYY-MM-DD>, lock sha256 <the hash making.py printed>
```

- Every part has its words under it. Only the outline's sections are numbered, at most six (house rule
  ONE_SPINE); everything else is plain lines or `-` bullets, because the spine check reads numbered lines.
- The use is the one thing a business leader does differently on Monday, from his answer; it is new, never an
  action a recent piece already gave (step 10's checks).
- Each fact to check is `- <the claim> | <its source, linked> | <checked on YYYY-MM-DD, or to check>`.
- `Publishes` is the day it goes live, and the piece's dated drafts carry that date
  (`docs/plans/<that date>-draft-script.md` and `-draft-script-90s.md`).
- **The signature binds his words.** Before he signs, `python3 scripts/post-pack/making.py <uuid> narrative
  <lock>` prints the lock's sha256 once every part holds. Put the whole lock to him in the room, the words
  themselves and never a pointer to them. Once he signs, add his exact typed words, the date and that hash as the
  last line; nothing below it counts. Run `narrative` again until it says signed. Any word changed above the
  signature afterwards makes the lock refused: a signed lock is never edited. A change to its end message, its
  close, its use, its spine or a section goes back to him (the drift rule), and the changed lock gets a new hash
  and his new signature.

## Starting each make

Step 11, once a piece's lock is signed and pushed; one fresh run per piece, never a piece made in the room.

- First `python3 scripts/post-pack/making.py <uuid> show`: a session that started on the piece under six hours
  ago may still be at work (Control Center's rule, `LIVE_SESSION_MS` in control-center `api/_make.ts`). Look at it
  through its link on the record (a `make-piece.yml` run, `gh run view <id>`, or a session he opened). Still working: give him its link and start no second one. Stopped (a
  make started before the lock was signed stops at the lock and makes nothing): start a fresh one as below.
- Never a routine (Ruling, Krish, 2026-10-29: "FYI, I want zero Claude routines. No Claude schedules of any kind in
  this architecture"). The make runs as Claude Code inside GitHub Actions on his subscription:
  `.github/workflows/make-piece.yml`, one run per piece, on the room's pushed branch, because the lock is not on
  `main` until the room's pull request merges. Dispatch it with `gh workflow run make-piece.yml --ref <the room's
  branch> -f piece_id=<uuid>` (or a `repository_dispatch` of event type `make-piece` with `client_payload`
  `{"piece_id": "<uuid>", "ref": "<the room's branch>"}`), then `gh run list --workflow make-piece.yml --limit 3` to
  see it queued. Its concurrency group is the piece, so a second dispatch waits for the first and never runs beside
  it.
- It cannot be dispatched from the room (no GitHub access here): say so to him in one line, with the page to press,
  https://github.com/krishanraja/content-engine/actions/workflows/make-piece.yml (Run workflow, the room's branch,
  the piece id).

## When the server answered no_key

Step 12, only for a cut whose Approve scripts press came back `no_key` (the server's Teleprompter key is not set
yet). The room sends exactly those approved words through the Teleprompter connector.

- Per cut, the script's current sha256 (`making.py`'s script hash, which `teleprompter_send.py plan` prints) must
  equal the hash his press approved; `plan` reads his press from the board's `approvals` collection and refuses
  otherwise. Words changed since his press are not sent, and the cut goes back on its tab for a new press.
- `python3 scripts/post-pack/teleprompter_send.py plan <uuid> docs/plans/<date>-draft-script.md
  docs/plans/<date>-draft-script-90s.md`, then exactly the calls it prints, as `make-piece` says ("The Scripts
  step", step 6): never `move_script` or `update_folder`, never a second folder or script, never his `fontSize`,
  `speed`, `alignment` or `timedSpeed`.
- Run each `record` line it prints, then `get_script` each cut and check its text is the approved words (the
  readback).
