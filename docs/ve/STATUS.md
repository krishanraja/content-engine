# ve status (28 Oct 2026: Phase 1 engine merged; format H built and proven; awaiting Krish's Gate 2 on the new frames)

Read `docs/ve/RUNBOOK.md` to produce and `docs/ve/design/TEMPLATE.md` for what a frame must look like. This page says what ve can and cannot do right now.

## Can do
- **Spec to picture in one clock:** `ve lint`, `ve compile`, `ve render` (tall 9:16 and wide 16:9) through one `FormatMaster`. Compile refuses a verb the device does not draw and anything it cannot draw truthfully.
- **Design is a gate, not a hope (F19):** `config/ve/design-lock.json` holds the approved zones, type roles, thresholds, scribble, plate rules and the ten approved key frames (formats `hand-held-screen` and `two-passports`, frozen 28 Oct). `ve lock check|show|freeze`. A device card or spec for a format without a frozen lock is refused.
- **Formats and devices:** format H (hand-held screen) and the two-passports module on the full-canvas `STAGE` layout. Devices: `hand_phone_stage` (real hand and phone, camera that never cuts, UI on the glass in perspective, glass kinds prompt, cards, footage, bubble), `headline`, `sticker`, `stamp`, `stat_strip`, `marquee`, `scribble` (hand-drawn draw-on, one per beat), `thread_card`, `passport_page`; the original five devices remain.
- **QC with no tokens:** `ve qc --props` runs the 11 mechanical checks plus **composition** (screen fill at least 80% outside the caption zone, nothing under 30 px, caption and platform zones, edges, ILLUSTRATION tag) and **key-frame match** (render vs approved still: caption zone masked, smoothed, SSIM at least 0.75; faithful render 0.83 or more, wrong beat 0.67 or less, rejected frames 0.65 or less). `ve comp` and `ve keyframes` run them on stills and videos.
- **Packet and status:** `ve verdict write` binds a Critic verdict (frames viewed, findings) to the exact mp4 hash. `ve packet` refuses to assemble a Gate packet unless QC, composition, key frames, a frozen lock and a non-blocking Critic verdict hold for that file. `ve status` separates "mechanically valid" from "design approved".
- **Fonts:** the four makeyourmindup faces are vendored with licences and a hash manifest (`ve fonts check|css|sync`, a hard `ve doctor` row).
- **Budgets, cards, render fixes:** `ve time`, `ve ledger`, `ve card|dispatch|verify-card`; ASCII props transport; AAC priming removed; subprocess output decoded as UTF-8 (a quote's ellipsis no longer turns into mojibake).
- **Measured on the format H proof (21 s, tall):** mechanical checks pass and complete; key frames 0.83 to 0.89; composition passes on all five beats; render about 2.8 minutes.

## Cannot do yet (do not pretend otherwise)
- **Marks removed on Krish's word (28 Oct 2026):** "I hate all these stupid little abbreviations and marks ... If these three were not in the videos, they would be perfect." The ILLUSTRATION tag, the KRISH'S TEST 23 OCT stickers and the coral marquee are no longer drawn (the lock records `illustration_tag_required: false`). The recording's own source label stays. Format H's proof was re-rendered without them: QC measured_pass and complete, key frames 0.83 to 0.86, composition passes. **The fourth Critic's SEND TO KRISH covered the earlier render (with the marks), so it does not bind to this file; `ve status` will show a different file until a Critic reviews it and Krish approves the exact file.** The two-passports golden frames still show the tag and are due a rebuild when that module is rendered. Open round-4 nits: the open-beat scribble loop dips to y 1180 under the caption card (3.2 to 7.3 s); the recording sticker's corner overlaps the XINJIANG swipe by about 15 px; bare 0 and 1 without a denominator at 12.5 s.
- **No publish, send or schedule verb**, by design. Krish publishes.
- `ve ingest`, `ve stills` and `ve file` are placeholders (exit 2). Word end times and the archive step come from another route.
- **No sound effects kit:** compile lists `sfx_missing`; `ve status` blocks on it.
- **No generated assets pipeline:** ChatGPT Images, Runway and Higgsfield are not wired; plates are the approved derived illustrations in `assets/plates/`. Flags in the passports module are simplified drawings and need a licensed set; the passport paper is a procedural substitute for the original photograph.
- **Two QC checks do not apply to STAGE layouts:** the square mark tile (the logo is in the stage header) and cue sync (a full-canvas slot under a moving camera cannot show an event separately). Events on STAGE devices are proved by device tests and the key-frame match.
- The proof uses the original test story and the real DeepSeek recording at about 1:1; its text is evidence and is never enlarged or retyped (a verbatim pull quote carries it).
- Format `two-passports` has its devices and approved frames but no rendered proof yet; the wide aspect has no design lock.
- One composition test skips on this machine (pinned ffmpeg path); the checks run in every real QC.

## Local caveats
- `. scripts/ve-env.sh` pins ffmpeg and tesseract and clears `MINDMAKE_*` Drive variables.
- In a git worktree, `tests/archive-naming.test.ts` can write to the real Drive (junctioned `node_modules`). CI is unaffected; run it from the main checkout.
- Codex's sandbox cannot run vitest or create temp dirs: Claude re-runs every card's acceptance outside it before merging.
