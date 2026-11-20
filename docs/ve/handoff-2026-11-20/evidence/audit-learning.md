I've answered all four questions below, but parts 3 and 4 rest on partial evidence. The local clone is shallow, with history starting 2026-11-18 06:56, so the git command you gave returns only 45. I recounted from the GitHub commits API (read-only). The piece ledgers also turned out not to record renders or QC runs at all.

# Content-engine audit: learnings into enforcement, and the style system (read only, 2026-11-19)

## 1. Style ingredients

**There is no compatibility matrix.** The design says every ingredient is independent:
- "27 caption styles, any of which can sit over any motion style" (`docs/ve/INGREDIENTS.md:16`).
- A motion style never picks the captions, transitions or camera (INGREDIENTS.md:8-13).

Compile and lint refuse only these cross-ingredient combinations:
- **`tray` layout:** needs `captions.placement: upper` (`scripts/velib/compile.py:776-778`).
- **`transitions.lead`:** only on whip, push, zoom-through or punch (`compile.py:875-877`).
- **One-word caption cuts:** `cinematic`, `stair-flash` and `anchor-quote` are refused on a word-mode cut from 18 Nov (`scripts/velib/lint.py:218-236`, data in `config/ve/caption-steady.json`).
- **Palettes:** an unknown palette, or one that breaks contrast, is refused (INGREDIENTS.md:95).
- **Unknown names:** compile rejects any value not in its lists (`compile.py:791-795, 871-874, 900`).

Where the docs and code disagree:
- **"Crossfade needs a motion style"** (INGREDIENTS.md:58) is not enforced in `ingredient_props` (`compile.py:858-883`). The renderer only fades when a profile exists (`apps/renderer/src/engine/kit/beatMotion.ts:38`).
- **"Each motion style's bank entry names the ingredients it was measured with"** (INGREDIENTS.md:63-64) is not true of the data. No bank entry has such a field; the ingredients appear only in prose in each entry's `from` text (`config/style-references.json:927, 941, 955`).
- **The `pillar` layout** was added on 19 Nov (`compile.py:795`, INGREDIENTS.md:246) during Fri 20 production.

**What is tested:**
- Each ingredient on its own: `kit/ingredients.test.ts` (26 tests: transitions, camera, energy, lead, focus, "captions never move", placement).
- Profile-specific modes: `kit/fiveStyles.test.ts`, `kit/strongStyles.test.ts`.
- Every caption style's cover-still zones: `stills/stills.test.ts:62, 86`.
- Recorded cuts unchanged with no style: `houseGolden.test.ts:110`.
- No test iterates caption style × motion style × transition × camera × energy × layout. Every combination is untested in code.

**Known-broken:**
- `cinematic`, `stair-flash` and `anchor-quote` on one-word pages (refused).
- Rule 2 (the previous word stays a little longer) fails for 25 of 27 styles. Only `podcast` and `art-directed` keep it, and this is a "known gap… not yet a refusal" (INGREDIENTS.md:121-125; `caption-steady.json`).
- Mark clearance has no QC row ("not built yet", INGREDIENTS.md:22-27).
- The new style devices and stagings are not proven on his take with real brand chrome (INGREDIENTS.md:479-485).

**There are no house recipes.**
- Of the 23 motion bank entries, 21 have `krish_verdict: "untested"`. The two marked "liked" (`ladder`, `living-screen`) are the `needs_device` 3D styles he rejected on 13 Nov.
- `recipes` (`style-references.json:1012`) holds one script recipe, from 16 Oct, still "waiting on Krish".
- `config/ve/recipes/data-story.json` is one saved through-line system. It is carried into Codex cards (`scripts/velib/cards.py:87-99`) and is not a locked, pre-rendered ingredient combination.
- Every piece this week composed a fresh, never-proven combination:

| Piece | Motion | Captions | Transition / camera / energy | Layout |
|---|---|---|---|---|
| habits | `swiss-kinetic-type` | art-directed | cut / none / high | fill |
| Tue 17 | `eating-jobs-ladder` | podcast | not set | band |
| Wed 18 | `hud-terminal` | rack-focus | punch + lead / phased / high | fill |
| Fri 20 | `ai-music-slam` | art-directed | whip / phased / high | pillar (built mid-piece) |

Source: each piece's `docs/plans/<piece>/ve/spec.json`.

## 2. Learnings into enforcement

**Whole registers** (output of `python3 scripts/check_failures.py`):
- **Failures:** 132 entries: 112 guarded (76 with a named test, 36 "marker only, configuration coverage, not proof"), 19 open, 1 declined.
- **Learnings:** 100 encoded, 11 open.
- **What "guarded" means:** a guard is a string-present check (`scripts/check_failures.py:52-58`). The file itself says "A marker in a file proves the guard is still there, never that it works" (`check_failures.py` docstring).

**Video-related failures** (80 entries, classified by me from their guard files and `guard_level`; boundary calls are mine):

| Class | Count | Examples (`config/failures.json` line) |
|---|---|---|
| Code that blocks before render (lint, compile, renderer), with a named test | 23 | F31 one idea (:1895, `velib/guards.py:96`); F33 engine freeze (:1972, `guards.py:347`); F34 two-render cap (:2009, `guards.py:409`); F40 bed (:2284); F57 steady captions (:3385, `lint.py:221`); build-or-buy guards (:4077, `velib/piece_guards.py:36-207`); title lockup (:4277) |
| Pre-render code, marker only (no test) | 8 | head-cut-off (:2792), plate-old-title, reels-cut-off |
| Code that blocks after render, before Krish (`ve qc` / proof / delivery gates), tested | 13 | F28 captions on face; F42 repeat title (:2397); F44 evidence readable (:2488); F53 smear (:3249); F58 plain frames (:3476, `velib/plainframes.py:85, 211`); qc-rows (:4038) |
| Post-render code, marker only | 8 | cuts-shown-before-checked (:3582, `velib/showgate.py`), lip-sync-drift, long-cut-too-quiet |
| Checklist row at the show gate: a reviewer types an attestation after render, nothing measured | 9 | all `tue17-*` / `wed18-*` / process rows (:3627 onward) in `config/ve/pre-show-checklist.json` |
| Prose only (a session must remember) | 7 | F54 known fault shipped with caveat (:3296); F55 cues from transcript (:3327); F29, F52, F38 |
| Open, no guard | 12 | chopped-words-published (:891), F05 motion decorated (:1077), F07 brand (:1128), F08 captions (:1154), F56 text cut at device edge (:3361), F01, F03, F06, F09, F10, F16, stills-from-rejected-thu5-take |

- **Model critic:** no failure relies only on the Critic. `velib/refgate.py` (a model compares the cut with references) sits beside code for F13 and F26, and F38 is critic prose.
- **Time limits on the gates:**
  - Show gate: applies to pieces publishing from 2026-11-20 (`config/ve/show-gate.json:3`, `showgate.py:50-51`).
  - Frame checks: count only from 2026-11-17 (`config/ve/frame-checks.json:3`).
  - Caption steadiness: from 2026-11-18 (`lint.py:218`).
  - `bind_unshown` has been on since 19 Nov (`show-gate.json:10-11`, `showgate.py:64-68`), so it changes the rules for unshown in-flight cuts.

**Video-related learnings** (68 of 111):

| Status | Count |
|---|---|
| Code marker plus a test file | 11 |
| Code marker only | 34 |
| Prose only (md or skill) | 15 |
| Config only | 1 |
| Open | 7 |

**Rejection floor:**
- 272 standards apply to video makers: 145 aims, 107 examples, 20 floor.
- Only 12 may block: the eight "nevers" (`config/rejection-floor.json` `floor.nevers`).
- `floor.py` enforces only that the floor was read. `ve brief` and `ve render` refuse without a preflight receipt (`scripts/ve.py:1471, 1917`; `velib/preflight.py:24`), but nothing checks the content.
- `config/floor-rulings.json` holds 1 ruling.

## 3. Change rate

**Commit counts** (your path set, from the GitHub API):
- 9 to 19 Nov: 326 commits (266 non-merge).
- 16 to 19 Nov: 147 commits, including 41 on 17 Nov and 66 on 18 Nov.
- Adding `apps/renderer/src/engine` and `config/ve`: 481 commits since 9 Nov, 215 of them on 16 to 19 Nov.

**Changes that hit pieces in flight:**
- **Captions:**
  - f84ab4b (18 Nov) rebuilt art-directed captions (F57). Tue 17 switched to `podcast`.
  - The habits proof v10 then regressed "from main's new caption engine" (F58, :3476).
  - The halo changed four times: 37650d3, 2a2d130, 73c4778, 98272d1.
- **Title moment** (rewritten four times in about 18 hours): 18e09b7 epic title, 37650d3 card that slams in, c811b5f placement, then bce8602 (19 Nov) full-frame lockup. Wed 18's title failure (:4277) came out of this.
- **Body logo rule:** 5631f20 set it to start on 23 Nov, then 5335203 and 7f795ee applied it to Tue 17 early. The house goldens were re-recorded (ee5f39b, 6d8a4bf).
- **Face-with-proof format** (used by Tue 17, Wed 18 and Fri 20): 49ae7e0 and 9b63034 deleted its key frames and made it a rules-only lock. 57cb301 changed the SPLIT geometry.
- **Treatment bank:** c402783 now applies effects to every cut by rule.
- **Wed 18 engine approvals:** the piece needed 13 engine-exception approvals in one day (`docs/plans/2026-11-18-wednesday/ve/engine-exceptions.json`). One of them reads: "I refuse to say 'approve engine' ever again."
- **Fri 20:**
  - 0baf15b (`bind_unshown`), 457485a, 7b6134f, d5cc8b4 and 7926f67 (19 Nov) put new gates on it mid-piece.
  - bc3d592 records "Fri 20 cuts reworked to pass the new piece guards" and added the new `pillar` layout. a96ceb9 changed pillar again an hour later.

## 4. This week's pieces

The ledgers hold preflight, Codex and credit receipts only. Render counts live in `renders.<cut>.json` under the work folder, which is not in git. So revisions below are commits to each `spec.json` (from the API), and proofs are proof files.

| Piece | Ledger | Spec commits | Proofs / QC | Why it went round |
|---|---|---|---|---|
| habits VO short (701a2c55) | 3 Codex receipts; no preflight rows in its ledger | 1 (3072bf7) | at least 10 (F58 names "Proof v10") | caption engine change and black-screen regression (F58) |
| Tue 17 (b019dbf8) | 10 rows, all preflight; failures re-read 4 times, the floor re-read after its hash changed | 11 on 18 Nov (16:58 to 22:53) plus 2 drafts | 1 proof file; approved "looks good, continue" | Krish found 12 faults himself (:3438); captions changed, logo rule, title, false start |
| Wed 18 (db9f9f6a) | 16 rows: 4 preflight, 3 Codex plates, 80 credits (Higgsfield, share already 317 of 300), 8 preflight re-reads | 10 (18 Nov 17:57 to 19 Nov 02:19) | 13 engine approvals | 6 faults: head cut off, title squeezed (:2792, :4277) |
| Fri 20 (c00cd4e0) | no ledger | 5 on 19 Nov plus 2 earlier | 4 proofs (3 in history, 2 of them were sendable); the current one is `sendable: false`, and its QC fails captions.ocr, captions.render, composition and title.stage_width | new piece guards and the pillar layout landed mid-piece |

Fri 20's QC state is in `docs/plans/2026-11-20-friday/ve/proof/short.json` and `short.qc.json`.

Working lists are in `/tmp/claude-0/-home-user/63cf1651-3ee8-5d67-9673-d5fc61485f70/scratchpad/` (`fail.txt`, `req.txt`, `commits.txt`).