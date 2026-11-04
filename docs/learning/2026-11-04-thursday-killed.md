# Thursday 5 Nov, killed: what now guards each lesson

Krish, 4 Nov 2026, on the off-day short: "Okay, this is shit. I'm going to kill this completely. The visuals are
tacky. The subtitles are all over the place typographically."

The failure report (written by an earlier session; summarised in the task that made this page) found three days, about
53 commits, five engine PRs merged mid-production, four Critic rounds all NOT READY and at least seven full renders on
4 Nov. Its root cause: no single visual idea. His favourite, Monday 2 Nov "Who trains your 2030 seniors", was built on
one object ("The Ladder", `docs/plans/2026-11-02-monday/motion-system.md`).

The failures are in `config/failures.json` as F31 to F39, with recurrences added to F04 (stills stood in for motion)
and F30 (captions into Instagram's caption zone). The report's ten lessons are proposals until Krish says yes. Below,
each lesson, what already existed, and what guards it now. A guard is built only where it is mechanical and enforces
something he already approved; the rest wait on him.

All new guards are in `scripts/velib/guards.py`, set by `config/ve/production-guards.json`, tested by
`tests/ve_thursday_guards_test.py` (16 behavioural tests: each refuses Thursday's case and passes a Monday-shaped one),
and bind a whole cut of a piece published from 9 Nov 2026 (`creative_direction.MOTION_FROM`), like the proof gate.
Run on Thursday's real files, the idea guard refuses its spec and the type guard counts 6 treatments in its props.

| # | Lesson | What enforces it | Status |
|---|---|---|---|
| 1 | No idea, no production | `idea_problems`: `ve lint` refuses a spec without `style.idea` (the object, each move and what it means, a never-list, the real artifact or why there is none). Enforces floor groups `motion_explains`, `words_add`, `real_evidence` and learning `visuals-add-not-repeat` ("one named motion system per piece, decided before the storyboard") | guarded, F31 |
| 2 | Show the real thing, never re-type it | `retype_problems` and the on-screen check in `idea_problems`: a named artifact must be on screen; a device whose words are 60% or more the artifact's own is refused. Enforces floor group `real_evidence` | guarded, F32 |
| 3 | Freeze the engine during a piece | `freeze` (run by `ve expect`, which writes the sheet his Sign storyboard press binds) records a sha256 of the renderer source, `compile.py` and the ve brand, device and font configs; `engine_problems` refuses `ve proof` and `ve render` when it changed, unless his exception approval binds the new hash. Extends the approved proof gate: what he approved is what renders | guarded, F33 |
| 4 | One piece, one session, two loops, then Krish | `record_render` and `loop_problems`: `ve render` refuses a third full render of a cut since his last press of any gate. Enforces `docs/ve/RUNBOOK.md` "Maximum 2 fix loops total". The one-session part is a process rule | two loops guarded, F34; one session waits on Krish |
| 5 | Codex makes the piece's named plate, never the engine backlog, during production | nothing yet | waits on Krish, F39 |
| 6 | Judge in motion with sound | already answered: from 9 Nov `ve proof` renders the hardest beat moving, with sound, on his own take (8 to 15 s, `--scale` for low resolution), and `ve render` refuses a full cut until his Approve proof press (`scripts/velib/proof.py`, `tests/ve_proof_test.py`, F04 and F13). Stills are no longer the design gate | guarded before this page, F04 |
| 7 | One type system | `type_treatments` and `type_problems`: `ve proof` and `ve render` count each type role on each surface (caption, caption on the light stage, loud caption word, held title, card roles read from each device's renderer source) and refuse more than the brand book's four roles (floor group `house_brand`), unless his exception approval binds that set. Captions in one typeface, weight and colour is stricter and waits on him | four-role limit guarded, F35; one caption treatment waits on Krish |
| 8 | Off days look neutral and sound different | `offday_problems` is built and tested (an off-day piece refusing the series bed and sting) but binds nothing: `docs/GROWTH-HANDOFF.md` and `compile.py` still let an off day wear a series' house dress, so this is new taste | waits on Krish, F36 |
| 9 | Check his own records before questioning his words | nothing mechanical; AGENTS.md "Check before you ask" in general | waits on Krish, F37 |
| 10 | The Critic is a check, not the brief; compare against his favourite first | Monday 2 Nov is not in `config/reference-cuts.json`; the stills half is held by lesson 6 | waits on Krish, F38 |

## What a spec now carries

```json
"style": {
  "motion": {"module": "data-story", "reason": "one number per frame"},
  "idea": {
    "object": "One career ladder; every number is drawn on, beside or instead of a rung",
    "moves": [{"move": "the drop", "means": "the junior rung thins as 27% falls to 9%"}],
    "never": ["No figures or icons acting out a sentence"],
    "real_artifacts": [{"asset": "anthropic-report-p4", "text": "the words on the page, as printed"}]
  }
}
```

`real_none` (a sentence) replaces `real_artifacts` only when no real artifact exists.

## For Krish: yes or no

1. Off days: no series bed or sting, an off-day bed licensed from Epidemic Sound, and no series dress in the render?
2. Add Monday 2 Nov "Who trains your 2030 seniors" to the reference cuts, as the Critic's first comparison?
3. During a piece, Codex makes only that piece's named plates; engine and library cards wait until it is filed?
4. One piece, one session: the session that starts a piece finishes it, or brings you the cut or one question?
5. Captions in one typeface, weight and colour: drop the serif loud word and the ink caption on the light stage?
6. Before asking about a name you used, the session first checks your Teleprompter folders, the board and the glossary?
