# Template approvals and rendering

Use `python render.py --changed` for normal rounds. After the first manifest, it captures only templates with changed inputs or a missing or damaged export. An unchanged run opens no renderer and leaves the existing files in place. Run these commands from `docs/ve/cards/library/`.

## Approve a template

When Krish approves a specific template, use its exact ID and his exact words. Run the command on the reviewed revision with the same renderer, fonts and media.

```text
python render.py --lock <id> --approved-by "Krish" --words "<verbatim approval>"
```

`lock.json` records the reviewer, UTC date, words, renderer and SHA-256 of the first and settled frames at native size. The hashes cover RGB pixels in row order. For motion, it also hashes all source RGB frames in playback order, then encodes the same frames at 25 fps and hashes the decoded YUV420p frames. A change confined to the middle of a clip can fail the lock. A second approval cannot overwrite an existing one.

## Verify every round

```text
python render.py --check-locks
```

The gate recaptures only the approved IDs into temporary storage. It reports every mismatch by ID and exits non-zero. Verification leaves the saved exports and approval records in place. With zero approvals it exits without capturing a frame. The round verifier, `python verify_static.py`, runs this gate too.

A round that revises an approved template must name its exact ID in its Markdown brief. Before editing, record that file as the unlock reason.

```text
python render.py --unlock <id> --reason ROUND-BRIEF.md
```

The command checks the ID in the brief and records the file name and hash alongside the original approval. A reviewer can also withdraw an approval with a plain-text reason. The item returns to pending approval. After a revision, present the new render to Krish and lock it with his new words.

## What gets rendered

The first full or changed-only render creates `.scratch/library/out/render-manifest.json` at the worktree root. It records the inputs and file hashes for each active template. Earlier renders without a manifest need one baseline run. The planner follows the item's registry entry, nested slides, drawing functions, SVG symbols, fonts, crops, evidence and house stills. A shared mark or photograph invalidates its consumers. An edit to the common rendering code can affect every item.

| Command | Output |
| --- | --- |
| `python render.py --changed` | New or changed native item PNGs. |
| `python render.py --changed --phone` | Also updates missing or changed phone proofs. |
| `python render.py --changed --motion` | Also updates missing or changed individual motion exports. |
| `python render.py` | Full native items, sheets, stress proofs and layout checks. |
| `python render.py --motion` | All item films and named sequences. |

Changed-only runs verify affected approvals before replacing an export. The manifest advances after a successful batch. A per-piece `--carousel-pack` writes under `.scratch/library/out/packs/<pack-hash>/` so a story's copy and photographs have their own files.

Chromium is the host's default renderer. Use `--rasterizer resvg` with `--lock` only for a proof reviewed with that backend. The gate remembers the choice for each approval. The dependency planner uses the repository's Node dependencies, including TypeScript. Motion checks use FFmpeg and FFprobe.
