# The weekly rhythm

Krish, 2026-10-10, after Friday's piece ran late: "I think I'm going to need
to have Sunday, Tuesday, and Thursday as the content preparation days when I
receive a slate of ideas which I pick from (if I posted anything in the cold
ideas and inspire drive or there's a backlog of content that we've got a queue
for). Once we've decided what we're going to be talking about, the artefact
workflow takes shape: ready for publish the next morning after I've recorded,
the video runner is done, and post-production is done and I have my final
publish board. This feels like it's going to be the ongoing durable system."

This is that system, in order. Control Center plans and tracks; Claude Code
makes (`docs/CONTENT_ENGINE.md`, "The split"); the record of every step is
the piece's own row (`/api/content-ideas/:id/making`).

| When | Where | What happens | Who |
|---|---|---|---|
| Sunday, Tuesday, Thursday | Control Center, Content tab | The slate: a short list of pieces to pick from, drawn from what he dropped in the cold ideas and Inspo folder on Drive (`inspiration/drive-scan`, every two hours) and from the backlog the judges rank. He picks one for the next slot. | Krish picks |
| Same day, after the pick | Claude Code ("Make it in Claude Code", or a session he starts) | The workroom, the fact-checked draft, the visual gate, both scripts, the publish page, the pack in Drive. Each step lands on the piece as it is done. | a session |
| Next morning | His desk | He records the long cut and the 90 second cut from the scripts, and drops them in the Video Engine Inbox. The piece shows Recorded. | Krish |
| Same morning | The runner and a session | The runner fetches the recordings; the session makes both cuts with the logos and the pile-up on screen, through the visual gate, into the pack. The piece shows Video assets, with links. | a session |
| Then | Control Center, the piece | The publish board: the publish page open, every channel in the amplification order (`docs/AMPLIFICATION.md`) with a Copy button and a tick. He posts and ticks each one. | Krish |

Three slates a week means three pieces a week at most, one per subchannel
day. A slate day with nothing worth picking is a slate day with nothing
picked; the queue never forces a piece.

What exists today: the pick, the making record, the button, the pack tools,
the publish page, the recordings lane, the ticks. What is still to build is
in `WORKBENCH.md`: the slate itself on Sunday, Tuesday and Thursday in
Control Center (a cron that assembles the three best from the Drive folder
and the backlog, and a call that asks him to pick), and the runner's
post-production step that puts the video assets on the record by itself.

## Who owns what, and where things live

Krish, 2026-10-11: "I'm going to transfer all video production iteration
through to Codex, whilst Claude will remain the overall place for initial
ideation, article creation and publish board building." Two tools, one
record, one rule: **a tool never writes a step it does not own.** The owner
of every step is in the record itself (`MAKING_OWNERS` in
`apps/control-plane/api/_making.ts`, mirrored in Control Center), so the
board, the strip and both skills read the same table.

| Step | Owner | Skill | Writes |
|---|---|---|---|
| Slate and pick | Control Center (cron), Krish | `api/content/slate.ts` there | the work board; the pick |
| Workroom, fact-checked draft, visual gate, scripts, publish page, pack | Claude Code | `.agents/skills/make-piece` | `meta.making.workroom`, `.publish_manager`, `.visual_gate`, `.script_check`, `.pack`; the body through the engine |
| Record | Krish, then the runner | the recordings lane | `meta.making.recordings` |
| Video assets | Codex, on a runner machine | `.agents/skills/produce-video` | `meta.making.video_assets`; the pack rebuilt with the cuts |
| Publish board with the cuts | Claude Code | `make-piece` (last step) | the publish page and pack, again |
| Posting and ticks | Krish | Control Center | `meta.making.channels` |

Where each thing lives, and nowhere else:

| Thing | Lives in | Reached by |
|---|---|---|
| The piece and its making record | the shared database, `content_ideas` | the engine's routes only (never SQL for a body, walk log F32); Control Center reads it live |
| The work board | the engine's `work_board_*` tables | `/api/workbench` on the engine key or Krish's cookie |
| The engine key | Claude Code cloud: a network secret bound to the engine's host. Codex cloud: the environment secret. Windows home machines: Credential Manager, read by `scripts/engine.py` | never a file, a chat or a commit |
| The runner's bearer | Credential Manager on each runner machine | the recordings and library lanes |
| Control Center's secrets (access code, cron secret, the routine's id and token) | Control Center's Vercel project | its own routes; the slate cron speaks to the board on the access-code cookie |
| Recordings | the engine's recordings lane (object store plus manifest) | `scripts/post-pack/recording.py get`; never the Drive connector (10 MB cap) |
| The pack, the publish page, the finished cuts | Krish's Drive library, written by his own machine from the engine's library store | `build.py`, `send.py`; the Drive folder is the canonical copy for every tool and for Krish |
| The workroom and the publish page as artifacts | claude.ai | Claude Code and Krish only; a convenience view of what the pack holds. Codex and the runner never need them |
| Code, rules, skills | GitHub `main` of this repository, and of `control-center` | both tools commit small and pull first; the docs steward writes `NOW.md` and the log |

What could be misread, and what stops it:

1. **Both tools think a step is theirs.** The record carries the owner;
   each skill reads `making.py <id> show` first and stops at a step that
   is not its own. `by` on every write says who wrote it.
2. **A Codex session is asked, in chat, to touch the article or the
   approval.** The produce-video skill names what it never writes. A
   decision Krish made in words is relayed with `decided_by: 'Krish'` by
   either tool, never invented.
3. **A link only one tool can open.** Artifact links open only in
   claude.ai. The pack in Drive is canonical, so Codex and the runner work
   from the folder; the strip shows both.
4. **A key in the wrong place.** The engine key is never in a repository,
   a file or a chat. Inside Codex's Windows sandbox it cannot be read: the
   skill says to run outside the sandbox with Krish's approval. In Claude
   Code's cloud the proxy adds it; the container never holds it.
5. **Two sessions start for one piece.** Control Center fires one routine
   per press and opens a live session instead of firing again. Codex has
   no trigger from Control Center: the Recorded step is its signal, and
   the record shows the session making it.
6. **The slate at the wrong time.** The cron runs at 20:00 UTC on
   Saturday, Monday and Wednesday, which is Sunday, Tuesday and Thursday
   morning in Sydney, and the slot dates are computed in Krish's own time
   zone from the operator profile. When his zone changes, the cron line in
   `control-center/vercel.json` is the one thing to move.
7. **A pack rebuilt without the gate.** `build.py --replace` runs the
   visual gate again, so a cut added without its logos declared refuses
   the whole pack. Only Krish's own words in `visual_gate_override` pass
   one through.
8. **A recording that never arrives.** The lane sends every finished
   recording from whichever runner machine is on; a session fetches with
   `recording.py get --wait`. A missing file is reported by step, never
   worked around through Drive.
9. **The row changes under a write.** Every writer of the making record
   merges and is guarded on `updated_at`; a lost race is reported, not
   silently overwritten.
10. **Drift between the two mirrors.** `scripts/check-make-handoff.mts`
    in Control Center fails CI when its step rules or owners differ from
    the engine's lines.
