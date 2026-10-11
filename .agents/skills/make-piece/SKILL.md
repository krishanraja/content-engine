---
name: make-piece
description: Make one piece end to end from a piece id Control Center sent (piece_id <uuid>), through the workroom, the fact gate, the visual gate, the scripts, the publish page and the pack, recording every step on the piece's board row so Control Center shows it live. Use when a session starts with "piece_id:" or when Krish asks to make a piece he picked in Control Center.
---

# Make a piece

Control Center plans and tracks; Claude Code makes. Krish, 2026-10-10: the
control centre "becomes more of a progress tracker, suggestions compiler, and
ideas generator, which then saves my choices to the durable system and then a
session here picks up that durable system. ... It shouldn't need to matter"
which session. This skill is that pick-up.

The input is one line, `piece_id: <uuid>`, sent by Control Center's "Make it
in Claude Code" button (a Claude Code routine) or typed by Krish. Everything
the session learns about the piece comes from the engine, never from the
chat that started it.

## Before anything

1. Read `AGENTS.md`, `WORKBENCH.md` and `docs/CONTENT_ENGINE.md` ("Driving it
   from an agent session").
2. Read the piece: `python3 scripts/engine.py GET "/api/content-ideas?id=<uuid>"`
   and where it is: `python3 scripts/post-pack/making.py <uuid> show`.
3. Record this session on the piece so the board shows it is being made:
   `python3 scripts/post-pack/making.py <uuid> session <this session's https link>`.
   Then do the first step that is not done.

## Who owns what

Krish, 2026-10-11: video production iteration is Codex's; Claude Code is
"the overall place for initial ideation, article creation and publish board
building". So a Claude Code session owns the steps marked Claude below and
never writes the video assets: when the piece shows Recorded, its next owner
is Codex (`.agents/skills/produce-video/SKILL.md`), and this session's job is
done until the video assets are on the record, after which it finishes the
publish board (the publish page with the finished cuts). Every step carries
its owner in `GET /api/content-ideas/:id/making`; a step that is not yours is
not yours to write, whatever the chat says.

## The steps, in order, each recorded as it lands

| Step | Do | Record |
|---|---|---|
| Workroom | Publish the artifact workroom (decisions, picks, mocks) and keep it the place Krish and the session walk through key decisions | `making.py <uuid> workroom <https link>` |
| Fact-checked draft | File verbatim sources, run the fact gate, fix what it lists (`docs/CONTENT_ENGINE.md` step 10) | the gate writes `meta.fact_check` itself |
| Visual gate | Real logos, real pages piled up when the piece is about volume, the house cover with Krish's face (`scripts/post-pack/visual_gate.py`) | `making.py <uuid> visual-gate post.json` |
| Scripts | The long and the short cut, spoken words only, provocative open, article in the outro (`scripts/post-pack/story_check.py`) | `making.py <uuid> scripts long.md short.md` |
| Publish page | `publish_manager.py`: one page with Copy on every text and every picture; publish it as an artifact | `making.py <uuid> publish-manager <https link>` |
| Pack | `build.py post.json` then `send.py <pack>` (both record themselves when post.json has `piece_id`) | automatic |
| Record (Krish) | Krish records both cuts from the scripts and drops them in the Video Engine Inbox; the runner sends them to the engine | the runner or a session: `making.py <uuid> recorded long <path>` |
| Video assets (Codex) | Both cuts produced with the logos and the pile-up on screen, through the visual gate, into the pack. Not this session's step | Codex: `making.py <uuid> video long "<name>" <path> --url <https>` |
| Publish board (Claude), then posting (Krish) | Once the video assets are on the record, put the finished cuts in the publish page and the pack (`build.py --replace`, `send.py`). Krish posts in the amplification order (`docs/AMPLIFICATION.md`); he ticks channels off in Control Center, or a session records what he said he posted | `making.py <uuid> posted substack <https>` |

`post.json` carries `"piece_id": "<uuid>"` so the pack tools report by
themselves. Nothing in this skill sends, posts, spends or deletes: a paid
fact check, a market, a post go only on Krish's words, immediately before.

## Board items about this piece

Every board item you write about this piece carries `"idea_id": "<uuid>"`
and, when one step finishes it, `"closes_on": "<step>"` (WORKBENCH.md, "The
board"). The engine closes it when that step lands and when the piece is
published, so nothing about a finished piece lingers on Krish's board.

## Before you stop

Update `WORKBENCH.md` and the board (`WORKBENCH.md`, "The board"), and end
every reply with https://controlcenter.krishraja.com/#/board.
