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
| 4 | One piece, one session, two loops, then Krish | `record_render` and `loop_problems`: `ve render` refuses a third full render of a cut since his last press of any gate. One piece, one session, Claude orchestrating and Codex making assets, is his ruling of 4 Nov in `docs/ve/RUNBOOK.md` and learning `one-piece-one-session` | guarded, F34; ruled |
| 5 | Codex makes the piece's named plate, never the engine backlog, during production | he left it to the session; written into `docs/ve/RUNBOOK.md` with the one-session ruling. No check in `ve dispatch` yet | ruled, F39 open until checked |
| 6 | Judge in motion with sound | already answered: from 9 Nov `ve proof` renders the hardest beat moving, with sound, on his own take (8 to 15 s, `--scale` for low resolution), and `ve render` refuses a full cut until his Approve proof press (`scripts/velib/proof.py`, `tests/ve_proof_test.py`, F04 and F13). Stills are no longer the design gate | guarded before this page, F04 |
| 7 | One type system | He said no (4 Nov): "it needs to look good, and it didn't that time"; experiment carefully, sometimes words fill most of the screen. So nothing is refused by count: `type_note` lists every type role on every surface on the proof (`ve proof`, `proof/<cut>.json` `type`) for his Approve proof press. Learning `experiment-carefully` | listed, never refused, F35 |
| 8 | Off days look neutral and sound different | `offday_problems` is built and tested (an off-day piece refusing the series bed and sting) but binds nothing: `docs/GROWTH-HANDOFF.md` and `compile.py` still let an off day wear a series' house dress, so this is new taste | waits on Krish, F36 |
| 9 | Check his own records before questioning his words | his answer: listen to what he said on the recorded take, not the Teleprompter script, which he paraphrases. In `docs/ve/RUNBOOK.md` and learning `listen-to-the-take`; no check yet | ruled, F37 open until checked |
| 10 | The Critic is a check, not the brief; compare against his favourite first | Monday 2 Nov is in `config/reference-cuts.json` (`mon02-wide`, `mon02-tall`, `critic_first`) and on `docs/production/THE_BAR.md`; the Critic opens on it and the piece's `style.idea` (`.claude/agents/ve-critic.md`) | guarded, F38 |

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

## His answers (4 Nov 2026)

1. Off days: "I don't understand." Asked again in plain words below.
2. Monday 2 Nov as the Critic's first reference: "Yeah, sure." Done.
3. Codex only on the piece's own plates: "Whatever you think is the best coherent outcome. I don't really care." Written into the runbook with answer 4.
4. One piece, one session: "Yes, I would assume one piece and one session would be good, with Claude orchestrating and Codex doing asset production." Ruled.
5. One caption typeface: "No, I just don't think that is true at all. I just think that it needs to look good, and it didn't that time. We still need to experiment and make videos that are impactful, which, in my eyes, isn't just going to be in the future where every video has boring captions. Sometimes the words will be taking up most of the screen, but we need to figure out what looks good. When we're experimenting, instead of using proven, approved templates, we need to experiment carefully, as opposed to just producing videos experimentally and then seeing that they're shit." The type count no longer refuses anything; it is listed on the proof.
6. Checking his words: "I think the session would need to listen to what I actually said on the script, as opposed to reading the teleprompter folders, because sometimes I paraphrase the teleprompter script and that only gets picked up in the live recording." Ruled.

## Still open for Krish

1. Tuesday, Thursday and Saturday posts: should they stop using a weekday show's music and look (Thursday's used Wednesday's under.the.hood tag colour and its theme music), and get their own track and a plain house look?
