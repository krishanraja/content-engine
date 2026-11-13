# Source: OpenMontage (read 13 Nov 2026)

Why we read it: Krish rejected both 3D style test cuts on 13 Nov 2026 ("no, these are both terrible. the captions
should be decoupled from the animation styles, these captions are boring and not active enough. The motion design is
terrible, the use of the screen space is terrible, the motion is 10X too slow, not immersive and engaging at all."),
and the handoff asked for OpenMontage to be explored and integrated where it serves ve
(`docs/ve/FAILURE_2026-11-13_3d-styles.md`, "The bar for the next attempt").

**The original.** https://github.com/OpenMontageInc/OpenMontage, commit `fecb9a1e3cc23ef84de30b272059457a427f16f8`
(8 Nov 2026), 2,285 files. It was read in a scratch clone and nothing was run from it. No copy lives in this
repository.

## Licence: GNU AGPL-3.0. Read it, do not vendor it

- The whole repository is **AGPL-3.0** (`LICENSE`, README badge). Copying its code into content-engine makes the
  combined work AGPL. Any part served over a network, such as the control plane on Vercel, would then owe its
  source to its users.
- The ideas, numbers, timings and techniques in it are not copyrightable. So ve adopts **behaviour and parameters**,
  rewritten as ve's own code, and never copies its files. Every adopted entry says `source: "openmontage@fecb9a1"`
  in its comment or config row. Krish decides if he wants more than this, for example running OpenMontage as a
  separate tool at arm's length.
- **Vendored inside it:**
  - The 12 HyperFrames skills (HeyGen's `hyperframes`, v0.7.17; `.agents/skills/hyperframes/PROVENANCE.md`). Their
    upstream licence was **not checked here**; check it before adopting anything word for word.
  - 18 Pixabay sound effects (`hyperframes-media/assets/sfx`, Pixabay Content Licence). Under the house rule they
    are not ours to use until Krish files them in `1 Brand kit (permanent)` (AGENTS.md, "Drive folders are
    load-bearing").

## What it is

An agent-first production platform. Python tools are wrapped by YAML pipeline manifests and markdown "director"
skills, and the AI agent drives the stages:

```
idea > script > scene_plan > assets > edit > compose > publish
```

There are two renderers:
- **Remotion** (`remotion-composer/`, Remotion 4.0.484), with compositions Explainer, CinematicRenderer, TalkingHead,
  CollageBurst, TitledVideo and LyricOverlay.
- **HyperFrames**: HTML and CSS driven by a paused GSAP timeline that a headless browser seeks frame by frame.

A per-video **style playbook** (`styles/*.yaml`) bundles palette, type, motion, audio and image prompts in one file.

Its depth is in prose: the skills hold many good numbers. Its code is thinner than its docs, and most playbook
motion fields never reach a component, because each component hard-codes its own springs.

## Captions: weaker than ve's

- **One caption component** (`components/CaptionOverlay.tsx`), with different colours per composition.
  - Pages of 4 to 6 words.
  - The word being said takes a highlight colour and a glow, spoken words stay full colour, and coming words show at
    60%.
  - An optional spring pop on the word being said (damping 12, stiffness 220).
  - The page springs in (damping 18, stiffness 120, rising 20 px) and is held for its next start or `endMs + 700 ms`.
- **LyricOverlay**: one whole line at a time, in 6 frames and out in 8, a line's fade clamped to the next line's start.
- **No karaoke fill, slam, stack or per-word movement beyond the pop**, and no safe-zone logic: one `bottomOffset`
  number.
- **Captions are already apart from style.** Only two theme colours reach them.
- **Its numbers** (`skills/creative/typography.md`, `short-form.md`):
  - reading 21 characters a second;
  - a caption held 1 to 7 s;
  - at most 30 characters a line on a Short;
  - on-screen text in the top 40% of the frame, entering in 0.2 to 0.3 s.

ve already has 15 caption styles on one kit (`apps/renderer/src/engine/captions/`). What we take from OpenMontage:
- the next-start-or-plus-700-ms hold;
- the no-overlap fade clamp;
- the three word states (said, being said, to come) as one shared helper.

## Motion, transitions and camera

**Remotion side: two transitions (cut, fade 8 to 10 frames) and seven camera moves.**

| Move | What it does |
|---|---|
| zoom-in | 1 to 1.18 |
| zoom-out | the reverse |
| pan | ±40 px at 1.15 |
| ken-burns | +0.22 scale with a −25/−15 px drift |
| parallax | ±15 px at 1.1 |
| drift | ±22 px |
| static | 1.02 |

**CollageBurst is its most immersive piece, and already 9:16.**
- Cards enter on one of six springs: `pop`, `slide-zoom`, `spin`, `shutter`, `glitch`, `swoop`. Entry is damping 10,
  stiffness 130, mass 0.85 over 20 frames. Exit is 14/200/0.8 over 12 frames, shrinking to 0.3 with an 8 degree
  twist.
- A white flash on each landing: 6 frames, strength 0.22, or 0.55 on a hero card.
- A 6-frame seeded screen shake that decays linearly, 5 px, or 12 px on a hero card.
- Once landed, cards "breathe" ±1.2%.

**HyperFrames rules hold the strongest motion craft.**
- **Energy-tiered transitions** (`TRANSITION-REGISTRY.md`, `overview.md`):

| Energy | Transitions | Duration | Ease | Blur |
|---|---|---|---|---|
| Calm | blur-crossfade | 0.5 to 0.8 s | sine | 20 to 30 px |
| Medium | push or whip | 0.3 to 0.5 s | power2/3 | 8 to 15 px |
| High | zoom-through (out to 2.5x, in from 0.5x, blur 8 px), overexposure, glitch, squeeze | 0.15 to 0.3 s | power4/expo | 3 to 6 px |

- **Multi-phase camera**: three zoom phases (0.88 to 0.96, then 0.98 to 1.02, then 1.04 to 1.15) under a 2 to 8 px
  sine micro-drift. Never a spring on the camera.
- **Kinetic beat-slam**: text hits from one shared beat list, eased power4.out, expo.out or back.out(2), held 0.35 to
  0.6 s, exiting in 0.25 s or less, with at least three distinct entrance eases in a piece.
- **Coordinate-target zoom** into an off-centre point, a motion-blur streak and depth-of-field blur.

**Pacing prose** (`short-form.md`, `cinematic.md`):
- a visual change every 1 to 3 s;
- no static hold over 3 s;
- 20 to 40 cuts a minute;
- never the same shot length three times running.

## Pace measurement: none on pixels

- Its scorers (`lib/slideshow_risk.py`, `lib/variation_checker.py`) read the planner's own text fields, not the
  video.
- Its video analyser counts scenes with PySceneDetect (a minimum scene of 0.5 s), classifies motion with Farneback
  optical flow (mean under 0.5 is a still, variance under 2 is a pan or zoom on a still), and sorts pacing by
  average scene length.
- Nothing measures events a second or how much of the frame is used. ve builds that itself (`ve pace`, below).

## Sound

- **Targets**: -14 LUFS for Shorts and Reels, true peak -1 dBTP; music 18 to 20 dB under the voice.
- **Ducking**: sidechain compression at threshold 0.02, ratio 9, attack 200 ms, release 500 ms. The house does not
  duck music to his voice: the bed is one shape, F40, `config/music-bed.json`.
- **Sound-effect timing**: a whoosh starts 10 to 20 ms before the visual change and peaks on it. The table of types
  (whoosh 400 to 500 ms, impact under 300 ms, and so on) is guidance only. There is no sound-effect library of its
  own beyond the Pixabay files above.

## What ve adopts, and where

Rewritten as ve's own code; each item names its source.

| From OpenMontage | Into ve | Status |
|---|---|---|
| Energy-tiered transitions (push/whip, zoom-through, flash) with durations and blur by tier | `style.transitions` ingredient (`docs/ve/INGREDIENTS.md`) | designed |
| CollageBurst landing flash and decaying shake | `style.camera` hit response on device events | designed |
| Multi-phase camera with micro-drift, never springs on the camera | `style.camera` move `phased` | designed |
| Kinetic beat-slam hold and exit timings | caption style `slam` | designed |
| Caption hold rule and fade clamp | caption kit | designed |
| Scene-detect pacing plus motion energy | `ve pace` measures events per second, energy and frame coverage instead | built |
| Bundled playbook | **Not adopted**: ve splits it into independent ingredients | n/a |

What we do not take:
- the agent-driven pipeline (ve keeps one signed spec and Gates 1 to 3);
- the HyperFrames runtime (ve stays on Remotion);
- the paid generation tools;
- the Pixabay effects, unless Krish files them in the brand kit.
