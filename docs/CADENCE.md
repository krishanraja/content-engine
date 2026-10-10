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
