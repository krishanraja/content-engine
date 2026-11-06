# Source: Keyframes full-visual + character, 0.2.13

**Ownership.** Krish's own, given to him licence-free (Krish, 2026-11-06: "its been given to me license free, terms
allow it, no need to vendor it - its mine now"). No vendor copy lives in this repository. What we adopt is rewritten as
ve's own code and docs, and each adopted entry carries `source: "keyframes@0.2.13"`.

**The original.**
- File: `full-visual-character-0.2.13.zip`, 849 files, 34 MB, sha256
  `6b1a72cba867fdca61c385188db4469e048ac417fb2c02d6728934064f6ac3b7`.
- Its reference home is Drive, `Ventures > Inspiration > Production Inspo` (`1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-`).
  That upload is still to be done from a home computer: the cloud session that wrote this note could not move a 34 MB
  binary through the Drive connector.
- A later release is read against this page. Re-port only the capabilities whose source changed. Nothing replaces a
  capability on its own.

## What the pack is

A self-contained studio. It has:
- a Remotion 4.0.522 engine (`engine/full-visual/`);
- 14 skills, mirrored for Claude, Codex (`.agents`) and Grok;
- its own SessionStart hooks and permissions;
- a workspace web app;
- a bootstrap that downloads Node and ffmpeg;
- a whisper model;
- four worked example reels;
- the `character` pack, which draws the creator as an acting cartoon with GPT Image.

Its method is one bespoke scene file per reel, written by many builders at once, with the transcript as the only
approval. ve keeps its own method (one signed spec, devices from cards, Gates 1 to 3), so the pack's method was not
installed. Its repertoire was.

## Adopted

| Capability | ve home | Status |
|---|---|---|
| The craft: picture, motion, caption, hook, never-list, builder method | `_corpus/keyframes-full-visual.md` | reference |
| Full-visual motion style | `config/style-references.json`, bank id `full-visual` (motion layer) | untested; Claude may pick it per piece, and Krish's verdict decides |
| A picture hands over only in a pause of 0.15 s or more | `scripts/velib/qc_gates.py` `handover_in_gaps`; ve qc row `beats.handover_in_gaps` | advisory on every format; counted where a format's `qc` names `handover_gap_ms` |
| Build caption: the page grows word by word, with the key word boxed | card `docs/ve/cards/keyframes/ve-kf-1-caption-build.md` | card written; not dispatched |

## Next, one card or change at a time

1. `ve qc` caption geometry for `captionStyle: 'build'`, once the card's chrome lands.
2. Verbs from the pack's kit, as pure functions on `progress()` and `drift()`, under `apps/renderer/src/engine/kit/`:
   `countTo` with jitter, `typeOn`, `draw`, `mix`, `Cursor`.
3. A trial format, `full-visual`:
   - no presenter, 9:16;
   - his own voice-over, the build caption and the house bed;
   - `qc.longest_still_s` 1.2 and `qc.handover_gap_ms` 150;
   - `status: trial` until a Gate 2 press on a real piece.
4. Devices from the real-thing doctrine, each from a card: `cutaway_section` (cut inside), `count_roll`,
   `cursor_path`.
5. A bare-ground check: no frame of empty ground in a handover.

## Deliberately left out, and why

| Left out | Why |
|---|---|
| `.claude/`, `.agents/`, `.grok/`, `.cursor/`, `.gemini/`, `.codex/` and their hooks | They would collide with this repository's skills and guard hooks (`.claude/settings.json`) and widen permissions (`acceptEdits`, `npm install *`, `network_access = true`). |
| The bootstrap's binary downloads and the workspace app | ve has its own doctor and runners. |
| The ElevenLabs, OpenAI or Fish key in `.env.local`, and the synthetic voice | Secret guard; Krish records his own voice. |
| `@composio/core` | No new dependency without a need. |
| Example stills, reels, fonts and the whisper model | We never commit media. They stay in the original zip. |
| Bespoke per-reel scenes, and five hooks rendered as five videos | One signed spec. Alternate hooks wait for a format change. |
| The `character` pack | Parked. It needs his photo, paid image generation and a taste call. It waits until he asks. |
