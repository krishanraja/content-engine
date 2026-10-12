---
name: make-piece
description: Make one piece end to end from the piece id Control Center sent, through the workroom, the fact gate, the visual gate, the scripts, the publish page and the pack, recording every step on the piece's board row so Control Center shows it live. Use when a session starts with "piece_id:" or when Krish asks to make a piece he picked in Control Center.
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
| Visual gate | Real logos, real pages piled up when the piece is about volume, the house cover with Krish's face (`scripts/post-pack/visual_gate.py`). Keep the plan's facts in the repository: `docs/plans/<plan>/cover-facts.json`, with every logo it draws committed as SVG in `docs/plans/<plan>/logos/` (git keeps no PNG or JPEG) and its paths relative to the facts (`"logos/<file>.svg"`), so any checkout, a home computer included, can draw the artwork. With the cover, draw the two video thumbnails (house rule THUMBNAIL_EVERY_SIZE): `python3 scripts/pages/build.py docs/plans/<plan>/cover-facts.json --thumbs --out <work folder>/thumbs`, with no `--assets`, and every company the piece names in a row or in `"thumbs": {"strip": [...]}`. Pack them as `thumbnail` entries, `"shape": "wide"` and `"tall"`, each with its logos | `making.py <uuid> visual-gate post.json` |
| Scripts | Two scripts, each with its own hook and its own outro (house rule TWO_CUTS, Krish, 2026-10-11): the 3-minute long cut, 405 to 495 spoken words, 16:9, for Substack and YouTube; and the 90-second short cut, 160 to 225 spoken words, 9:16, for YouTube Shorts, TikTok and Instagram Reels. Spoken words only, provocative open, article in the outro. `story_check.py --cut long long.md` and `story_check.py --cut short short.md` check each one. Keep both as the dated drafts beside the plan (`docs/plans/<date>-draft-script.md` and `-draft-script-90s.md`): the matcher and `kit.py` read them there. Each script's words are hashed, and each cut keeps the time its words last changed; checking the same words again keeps it, and a change after Krish has recorded makes his take of that cut stop counting (a take of an older script), so say so to him before changing words he may have read; `making.py scripts` then asks him on the board whether to use that take. A script never says it was made with AI or with Claude (house rule NO_AI_DISCLOSURE_LINE; Krish, 2026-10-12: "Eliminate the "I made this with AI" entirely"). The automatic send to Descript is not built: Monday's and Friday's scripts went by hand on 12 October with his yes (`WORKBENCH.md`) | `making.py <uuid> scripts long.md short.md`, the long cut first, both required |
| Publish page | `publish_manager.py`: one page with Copy on every text and every picture; publish it as an artifact | `making.py <uuid> publish-manager <https link>` |
| Pack | `build.py post.json` then `send.py <pack>` (both record themselves when post.json has `piece_id`). Send it the same day: until it is sent, a home computer has none of the post's pictures for the video kit | automatic |
| Record (Krish) | Krish records both cuts, each from its own script, and drops each file at the top of the Video Engine Inbox. The home computers' recordings upload sends each take to the engine, then places it on its piece and cut by itself (`recording_match.py --record --board --by "Recordings lane"`, every five minutes on either machine), stamped with the hash of the script it was read from, and asks Krish once on the board about any take it is unsure of. The step is done only when both cuts have a take of their current words | the recordings lane, or the production session (`.agents/skills/produce-video`): `recording_match.py --record` |
| Video assets (Codex) | Both cuts produced with the logos and the pile-up on screen, the intro sting once Krish approves one, the licensed music bed and a thumbnail for each size, filed in the archive and, through the visual gate for videos and thumbnails, in the post's library folder (`3 Video`). It never rebuilds the pack and never writes the Visual gate or Pack steps. Not this session's step, except when Krish engages `produce-video` in Claude Code on a home computer | Codex: `making.py --by Codex <uuid> video long "<name>" <path> --thumb <path> --thumb-file <the drawn file> --music <track id>`, with `--thumb` only for a thumbnail actually drawn and filed |
| Publish board (Claude), then posting (Krish) | Once the video assets are on the record, the cuts and their thumbnails are in the post's library folder already. Put them in the publish page. When this session holds the post's working folder and the finished cut files, also add them to `post.json` (`video` and `thumbnail` entries, each declaring the logos on screen) and rebuild: `build.py --replace` runs the visual gate again and records Visual gate and Pack, then `send.py`. Krish posts in the amplification order (`docs/AMPLIFICATION.md`); he ticks channels off in Control Center, or a session records what he said he posted. The step is done when the standing five are ticked: Substack, YouTube, Shorts, TikTok and Instagram | `making.py <uuid> posted substack <https>` |

`post.json` carries `"piece_id": "<uuid>"` so the pack tools report by
themselves. Nothing in this skill sends, posts, spends or deletes: a paid
fact check, a market, a post go only on Krish's words, immediately before.

## Board items about this piece

Every board item you write about this piece carries `"idea_id": "<uuid>"`
and, when one step finishes it, `"closes_on": "<step>"` (WORKBENCH.md, "The
board"). The engine closes it when that step lands, and closes every item
about the piece once its publish step is done (the standing five ticked), so
nothing about a finished piece lingers on Krish's board. An item waiting on
him (`"lane": "on_you"`, such as recording both cuts) also carries
`"only_you"` (`"face"` for a recording) and an `https://` `"link"` to what he
acts on; without all of them, and the `idea_id` and `"closes_on"` above, the
engine refuses it and names the field it lacks. A job of his that no step
closes goes `"in_progress"`, its detail saying what would show it done, and
you ask him in your reply.

## Before you stop

Update `WORKBENCH.md` and the board (`WORKBENCH.md`, "The board"), and end
every reply with https://controlcenter.krishraja.com/#/home?waiting=1.
