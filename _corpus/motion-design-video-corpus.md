# The Motion-Design Video Corpus (v1.0, October 2026)
### Cinematic motion graphics fused with real footage: vertical (9:16) and YouTube (16:9), voiceover-led and on-camera

> **Audience:** an AI production agent (and the humans directing it).
> **Goal:** read this file and be able to plan, build, render and QA motion-designed video at the standard of Vox, Johnny Harris, James Jani, Netflix-documentary map work and top-tier Instagram/TikTok talking-head editors, using both traditional tools (After Effects, Premiere, Resolve, CapCut) and code-render or generative-AI pipelines (Remotion, HyperFrames, Claude Motion / Opus 5.5, Seedance 2.0, Veo 3.1, Kling 3.0).
> **Evidence base:** 40+ YouTube tutorials and breakdowns (transcripts pulled with Apify, combined view count above 15M), roughly 480 Reddit posts and comments from r/MotionDesign, r/AfterEffects, r/editors and r/VideoEditing (pulled with Apify), first-party docs (Remotion, HyperFrames/HeyGen, Material Design 3, GSAP, Adobe, Meta/TikTok safe-zone specs) and 2026 benchmark reports on AI video models. Raw evidence is in Appendices A and B.
> **Evidence labels used throughout:**
> - **[SRC]** comes directly from a cited source (link given).
> - **[PRAC]** is a practitioner default: a standard industry convention included so the agent has a complete spec. It is not tied to one source. Treat it as a strong default and override it when a reference or brief says otherwise.
> - **[UNVERIFIED]** is plausible but not confirmed in research. Do not state it to clients as fact.

---

## 0. Operating Instructions for the Agent

1. **Never start rendering from a one-line prompt.** Practitioners testing Opus 5.5 say the prompt is only about 10% of the result and the "harness" (references, assets, storyboard, skills, framework) is the other 90%; generic output is "centered text and a gradient" [SRC: Lukas Margerie, https://www.youtube.com/watch?v=747ZnEtsRbg]. Without a storyboard, "Claude will start guessing" and scenes arrive in random order [SRC: Sanji Nai-Chien, https://www.youtube.com/watch?v=D5qpBbEWTxo].
2. **Pipeline order is fixed:** Brief → Script with beat map → Visual-evidence inventory → Storyboard (scene spec JSON, §14) → Style lock (design tokens) → Build → Sound design → QA rubric (§15) → Render → Platform safe-zone check (§4).
3. **Take the grammar of a reference, never its content.** Copy its timing, camera movement, texture grain and how text enters and exits. Never copy its logos, characters or copy [SRC: prompt quoted in https://www.youtube.com/watch?v=747ZnEtsRbg].
4. **Every graphic must earn its place.** Mute test: watch the graphic with sound off, then listen to the same ten seconds with eyes closed. If you got the same information both times, delete the graphic [SRC: Mark Studios, https://www.markstudios.com/blog/motion-graphics-for-youtube-when-animation-earns-its-place-2026].
5. **Cohesion comes from rules you repeat.** "Set up rules on how things move and look. Follow them; the repetition of following the rules you set is what creates the perception of cohesiveness" [SRC: r/AfterEffects, https://www.reddit.com/r/AfterEffects/comments/1k5ple9/]. Write a motion style guide (§14.2) before building scene 1.
6. **Restraint beats spectacle.** Community critique repeatedly flags overused bloom and lighting: "a few pops of lighting bloom here and there look nice if used sparingly, but it can get tiring if it's used everywhere" [SRC: r/MotionDesign, https://www.reddit.com/r/MotionDesign/comments/1rff2vm/].
7. **Audio is half the perceived quality.** A strong animation was dismissed by peers because of an "awful AI voice over and music selection" [SRC: same thread]. Never ship with unmixed temp audio (§11).

---

## 1. The Doctrine: What Separates World-Class from Competent

| Principle | What it means operationally | Evidence |
|---|---|---|
| **Visual evidence first, then context** | Alternate concrete, pointable things (footage, documents, places, objects) with short explanatory bridges. Johnny Harris openings are "jammed with varied repeating visual evidence"; context sections are short and pulse rhythmically between them | [SRC: David Mora, https://www.youtube.com/watch?v=dIKsEhX-vyU] |
| **Anchor → Bridge → Anchor** | Anchors zoom in so the viewer experiences the topic. Bridges zoom out to fill in context and lead straight to the next anchor. Anchors recur like characters | [SRC: same] |
| **Material honesty ("screens feel like screens, paper feels like paper")** | Vox leans into messy source material (archival footage, charts, articles) with a heavily analog art direction. Every object gets a material | [SRC: Chris Moran, https://www.youtube.com/watch?v=sACZlG7z35Q] |
| **Nothing ever fully stops** | Group elements under a parent or null, move the group, offset child keyframes and keep a residual drift | [SRC: Sanji Nai-Chien, https://www.youtube.com/watch?v=D5qpBbEWTxo] |
| **Motion tied to speech** | Graphics land on the stressed syllable or keyword. Claude-planned edits put "animations on the value and rest where the viewer needs it" | [SRC: Joseph, https://www.youtube.com/watch?v=WcMOCtas1pg] |
| **Visuals explain and refocus** | On-screen visuals do two jobs: explain what the speaker says and re-capture attention | [SRC: Joseph, same video] |
| **Variety and surprise** | Talking-head retention depends on variety; "you want to keep that element of surprise" | [SRC: The Editing Podcast, https://www.youtube.com/watch?v=7hHyY2HhHf4] |
| **Progression devices** | James Jani uses countdowns, chapters and puzzle-piece reveals to give a "sense of progression" and "something to look forward to" | [SRC: The Editing Podcast × James Jani, https://www.youtube.com/watch?v=bwz-jLZz2w8] |
| **The last 20–30% of detail** | Top editors note that "barely 100 people will really notice" the final details, yet that is where premium perception comes from. Budget for it, but prioritise legibility and story first | [SRC: The Editing Podcast, extract in Appendix A] |
| **Imitate format and hook, innovate content (80/20)** | Ali Abdaal recommends about 80/20 imitation vs innovation, borrowing hooks and formats from outliers | [SRC: https://www.youtube.com/watch?v=A8PxRHQrLJ8] |

---

## 2. The Exemplar Canon (Who to Study and Exactly What to Steal)

| Exemplar | Format | Signature techniques (decoded) | Recreation recipe source |
|---|---|---|---|
| **Johnny Harris** | 16:9 VO plus on-camera documentary | Mapbox Studio custom styles fed into GEOlayers 3. Lat/long/zoom/bearing keyframes. Older workflow: a large flattened map file moved by a null, with 50–100 layers stacked on top. Red "marker" write-on strokes. Textured photo collage. Film-roll overlays | Johnny Harris "How I Make My Maps" https://www.youtube.com/watch?v=GsojLuJpe_0; byl CapCut recreation https://www.youtube.com/watch?v=IjMVme1aDWg; Matt Loui https://www.youtube.com/watch?v=42ukI3kJpXY |
| **Vox** | 16:9 VO explainer | Analog material doctrine. Paper and halftone textures in overlay/multiply. Parallax photos (FG/MG/BG split). "Cutting on the curve" at peak velocity. Trim-path outlines. Turbulent-displace edges. Mostly After Effects; 3D sometimes freelanced | Chris Moran (3 videos: https://www.youtube.com/watch?v=KtEgj5hMEUk, https://www.youtube.com/watch?v=KkckBGX6Yho, https://www.youtube.com/watch?v=sACZlG7z35Q); Motion Street https://www.youtube.com/watch?v=mVhEb-4nnhQ; Mapal https://www.youtube.com/watch?v=F7A503llNBA; ex-Vox designer on Reddit https://www.reddit.com/r/MotionDesign/comments/1vspixn/ |
| **James Jani** | 16:9 long-form investigative doc | Directs a motion team. Uses retention "language" such as countdowns, chapters and puzzle-piece builds. Contrast in the hook builds unease | https://www.youtube.com/watch?v=bwz-jLZz2w8 |
| **Netflix-doc map style** | 16:9 | Fractal-noise displacement glitch, country highlight via trim-path stroke and glow, aircraft with motion blur and wiggle shake, tint transitions on portraits | AEffecto (74-min breakdown) https://www.youtube.com/watch?v=JRCCTbBR2tI |
| **Ali Abdaal Shorts** | 9:16 talking head | Paper-tear hook cutting off the top half. Subject rotoscoped over the tear. Wiggle-driven paper background (0.5°/s rotation, wiggle(1,50)). Hold-keyframe "stop-motion" graphics with loopOut. Highlighter text | Validation https://www.youtube.com/watch?v=ZAuKQRfWGQ0 |
| **Premium IG talking head (2025–26 style)** | 9:16 | Deep Glow (radius 700, exposure 0.1, chromatic aberration). Circular inverted feathered vignette. Advanced 3D renderer. Out-of-screen zoom-outs with CC Lens. Silk and halftone textures. Riser → whoosh → click sound design | Joseph https://www.youtube.com/watch?v=Qbntd8yud0o and https://www.youtube.com/watch?v=HQvV75kjblY |
| **AI-native talking head (2026)** | 9:16 | Claude clip selection saved as a skill, Submagic captions, Claude edit plan, Higgsfield scene design plus Seedance 2.0 animation, Premiere assembly | Joseph https://www.youtube.com/watch?v=WcMOCtas1pg |
| **Hormozi captions** | 9:16 | All-caps bold, two lines, one or two keywords coloured (yellow/green) and enlarged, heavy shadow, emojis, animated stacks | Kate Telek https://www.youtube.com/watch?v=LWWAajjx-aw |
| **"Smooth minimal" captions** | 9:16 | Inter Bold (or Montserrat/Poppins/Helvetica). Single-word or short-phrase uppercase. Slide-up with transform and blend keyframes. Size and glow emphasis on key words | Matt Loui https://www.youtube.com/watch?v=YddyvmAFxnY |
| **Conceptual minimal titles** | Both | Tracking-expansion animations (80 → 130 → 80) with speed-graph shaping, staggered offsets and a CC Vignette | SonduckFilm https://www.youtube.com/watch?v=wdrKpsZDsQo |
| **Craft frontier (2026)** | Brand and film | Burberry (pastel hard/soft edges), ManVsMachine, Moncler × Gilga Farm (2D animation interacting with a 3D surface), Space Dawg / Michael Lim Hermès, dither used as a designed palette rather than a filter, Max Cooper hand-drawn rotoscope flow | Ben Marriott "Best of 2026 (so far)" https://www.youtube.com/watch?v=ylXeuDp_8XM |

---

## 3. Format Taxonomy and Layer Stacks

Each format below has a **layer stack** (bottom to top), **geometry** for 1080×1920 (V) or 1920×1080 (H), and **motion rules**. Geometry figures are [PRAC] unless they come from §4 data.

### 3.1 Voiceover-only formats

**F1. Documentary collage explainer (Vox/Harris)**
- Stack: paper/BG solid (multiply) → paper texture (multiply, about 70% opacity) → dot or halftone pattern (about 90%) → photo cut-outs with drop shadow → trim-path annotations → type → adjustment layer (chromatic aberration, vignette, grain) → texture overlay (overlay/add) [SRC: Motion Street https://www.youtube.com/watch?v=mVhEb-4nnhQ; Chris Moran https://www.youtube.com/watch?v=sACZlG7z35Q].
- Motion: camera nulls push 3–8% per shot [PRAC]. Cut on the curve between scenes [SRC: https://www.youtube.com/watch?v=KtEgj5hMEUk].
- Cadence: alternate anchor (evidence) and bridge (context) every 4–12 s [PRAC, derived from §1 anchor-bridge].

**F2. Map-led geopolitical sequence**
- Stack: map tiles (GEOlayers/Mapbox/MapTiler/ESRI World Terrain plus LUT) → country fills (0–20% opacity) → glowing border strokes (trim path) → route lines → icons and units with motion blur → labels → displacement-glitch adjustment [SRC: AEffecto https://www.youtube.com/watch?v=JRCCTbBR2tI; Reddit free LUT https://www.reddit.com/r/AfterEffects/comments/1mtu4uc/; MapTiler + GEOlayers 3 https://www.reddit.com/r/AfterEffects/comments/1pc2fno/].

**F3. Data infographic / kinetic chart**
- Charts the viewer must read need 4–6 s on screen, and the narration should stop during them [SRC: Mark Studios].
- Build order: axis → gridlines (low contrast) → data enters in reading order → highlight one datum (colour plus scale 1.05–1.15) → annotation [PRAC].

**F4. Code-rendered launch or explainer (AI-native)**
- Each frame is a pure function of time t, so loops close to the pixel. Fonts are embedded. A built-in checker confirms every line stays on screen long enough to read. Rendered at 60 fps with Playwright and ffmpeg (example: 3,360 frames for 56 s) [SRC: Didier Girard, https://x.com/DidierGirard/status/2104246320286335439].

### 3.2 On-camera formats (subject plus motion design)

| ID | Layout | Geometry (V 1080×1920) | When to use | Key technique |
|---|---|---|---|---|
| **P1 Full-frame + overlay HUD** | Subject fills the frame; graphics float on top | Subject eyes at about Y 620–760; graphics inside the safe box (§4) | Default talking head | Callouts, icons with Deep Glow, kinetic captions [SRC: Joseph] |
| **P2 Split panel 50/50** | Graphic top, subject bottom (or the reverse) | Two 1080×960 panels; seam can be hard, torn paper or a gradient | Dense explanation, demos | Paper-tear seam with the subject's head breaking the seam via roto [SRC: Validation https://www.youtube.com/watch?v=ZAuKQRfWGQ0] |
| **P3 Split 60/40 or 2:1** | Graphic gets 1152 px, subject 768 px | Keep the face clear of the bottom 35% UI zone | Charts, screenshots | Screen recordings plus face cam (Tella-style) [SRC: Peverelli https://www.youtube.com/watch?v=HzXD4GVqXwM] |
| **P4 Behind-subject (depth sandwich)** | BG plate → graphic/text → rotoscoped subject | Text sits behind the head and shoulders | Hero titles, keywords | Duplicate the clip, matte the subject (Roto Brush, Magic Mask, SAM 2 + MatAnyone 2), put the text between [SRC: Daniel Batal https://www.youtube.com/watch?v=LLodyQbxWsQ; MatAnyone 2 https://studio.aifilms.ai/blog/matanyone-2-video-matting] |
| **P5 Out-of-screen zoom-out** | Camera pulls back so the subject becomes a card in a larger scene | White solid under the video, adjustment layer with Transform plus CC Lens (size 100, convergence 25 keyframed) | Topic pivots, "zoom out to the big picture" | [SRC: Joseph https://www.youtube.com/watch?v=HQvV75kjblY] |
| **P6 Picture-in-picture over B-roll** | B-roll full-frame, subject in a rounded card | Card about 40–45% width, corner radius 32–48 px, inside safe box [PRAC] | Narration over evidence | Card flies in on emphasized-decelerate (§5) |
| **P7 Subject in 3D space** | Subject plate on a 3D layer among 3D graphics and camera | Use AE's Advanced 3D renderer, but precompose blur and glow effects because Advanced 3D does not render them | Premium hooks | [SRC: Joseph https://www.youtube.com/watch?v=Qbntd8yud0o] |
| **P8 Tracked-world text** | Text pinned into the filmed environment | 3D Camera Tracker, text on a solved plane, blur-to-sharp plus opacity reveal over about 3 s | Location intros, drone shots | [SRC: Adobe https://www.adobe.com/learn/after-effects/web/add-3d-text-video-footage] |
| **P9 Interactive image** | Subject reacts to or points at an animated photo | Photo with parallax, sound: riser → whoosh → clicks | Proof moments | [SRC: Joseph https://www.youtube.com/watch?v=HQvV75kjblY] |
| **P10 Paper-cut collage talking head** | Subject rotoscoped onto a paper world | Paper texture wiggling, hold keyframes for stop-motion | Educational shorts | [SRC: Validation] |

---

## 4. Platform Geometry and Safe Zones (Hard Constraints)

**The numbers are disputed. Use the strictest set.** Published Reels guides put the top margin anywhere from 108 to about 269 px and the bottom from 250 to about 672 px. TikTok publishes template files rather than numbers [SRC: NBK Social https://www.nbksocial.com/journal/nobody-agrees-where-the-safe-zone-ends/].

| Platform (1080×1920) | Top | Bottom | Left | Right | Source |
|---|---|---|---|---|---|
| Instagram/Facebook Reels and Stories (Meta Ads Guide) | 14% = 269 px | 35% = 672 px (40% with a disclaimer) | 6% = 65 px | 6% = 65 px | [SRC: Solid https://www.solidlabs.com/social-safe-zones] |
| TikTok In-Feed (official template, measured) | 240 px | 660 px | 120 px | 120 px above Y 840; **300 px below Y 840** (action rail) | [SRC: Mark Studios https://www.markstudios.com/tools/safe-zone-checker; Solid] |
| Strictest across Shorts, Reels, FB Reels and TikTok | 288 px | 672 px | 120 px | 192 px; 300 px below Y 840 | [SRC: Mark Studios] |

**Agent rules:**
- **Hard-safe box (all platforms):** X 120–888, Y 288–840 for key text and logos. Below Y 840, keep X 120–780 [SRC: Mark Studios]. That leaves about 768×552 px plus 660×408 px below, so design for big type and few words.
- **Soft-safe box (organic posts, faces and captions):** about 900×1400 px centred, biased slightly left, because every platform puts its action rail on the right [SRC: Shotcraft https://shotcraft.video/reference/platform-safe-zones/; Kreateflo https://kreateflo.com/blog/caption-safe-zones-for-tiktok-instagram-reels-and-youtube-shorts].
- **Caption anchor:** about Y 1300, never below about Y 1500 [SRC: Kreateflo]. Ad specs are stricter than organic-post specs, and no platform publishes an organic-post safe zone [SRC: Mark Studios].
- **Reels crops** to 4:5 in the feed and 3:4 in the profile grid, so keep the key visual dead centre [SRC: AffRoom https://affroom.com/blog/tiktok-safe-zone/].
- **16:9 YouTube:** title-safe 90% and action-safe 93% of frame [PRAC broadcast convention]. Keep the bottom-right roughly 15% clear for end screens and the timestamp overlay [PRAC].

---

## 5. Motion Physics: Easing, Timing, Choreography

### 5.1 Easing library (exact values)

| Name | Value | Use | Source |
|---|---|---|---|
| M3 Emphasized decelerate | `cubic-bezier(0.05, 0.7, 0.1, 1.0)`, about 400 ms | Elements **entering** | [SRC: Material 3 https://m3.material.io/styles/motion/easing-and-duration/tokens-specs] |
| M3 Emphasized accelerate | `cubic-bezier(0.3, 0.0, 0.8, 0.15)`, about 200 ms | Elements **exiting** | [SRC: same; durations from https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration] |
| M3 Emphasized | Path `M0,0 C0.05,0 0.133,0.06 0.167,0.4 C0.208,0.82 0.25,1 1,1`, about 500 ms | Starts and ends on screen | [SRC: same] |
| M3 Standard | `cubic-bezier(0.2, 0, 0, 1)`, 300 ms | Utility and data-dense motion | [SRC: same] |
| Legacy "fast out slow in" | `cubic-bezier(0.4, 0, 0.2, 1)` | Neutral UI | [SRC: Material 2 https://m2.material.io/guidelines/motion/duration-easing.html] |
| Remotion "push, no bounce" | `Easing.spring({damping: 200})` | Default entrance in code | [SRC: Remotion skills https://github.com/remotion-dev/skills/blob/main/skills/remotion-best-practices/remotion-markup/timing.md] |
| Expo-out bezier (Remotion example) | `Easing.bezier(0.16, 1, 0.3, 1)` | Hero snap-in | [SRC: same] |
| GSAP power3.out | — | The "cinematic" standard | [SRC: https://annnimate.com/learn/easing/power4-out] |
| GSAP power4.out | — | Hero reveals that should "land hard". About 70% of travel happens in the first 200 ms of a 1 s tween. Don't use under 300 ms | [SRC: same] |
| GSAP expo.out | — | Harder brake than power4 | [SRC: same] |
| GSAP back.out / elastic.out | — | Overshoot or bounce for playful brands only | [SRC: same] |
| AE speed graph "spike" | Influence about 80–100% outgoing / about 60–90% incoming [PRAC]; tutorials drag the handle "all the way to the left" | Snappy accelerate-then-glide | [SRC: Motion Street https://www.youtube.com/watch?v=mVhEb-4nnhQ; SonduckFilm] |

**Duration law:** larger movements take longer, smaller ones less. Scaling duration to distance gives a consistent sense of speed [SRC: M3 https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration]. Pair a decelerate entrance with an accelerate exit, and make exits as fast as or faster than entrances [SRC: M3; Mediascaleup https://mediascaleup.com/post/broadcast-graphics-and-lower-thirds-what-actually-works-motion].

**Timing table at 30 fps / 60 fps [PRAC, aligned to M3 tokens]:**

| Action | ms | Frames @30 | Frames @60 |
|---|---|---|---|
| Micro pop (icon, word highlight) | 150–200 | 5–6 | 9–12 |
| Text line entrance | 300–450 | 9–14 | 18–27 |
| Card or panel entrance | 400–550 | 12–17 | 24–33 |
| Scene transition / camera move | 500–900 | 15–27 | 30–54 |
| Ambient drift (never stops) | whole shot | — | — |
| Exit | 60–70% of the entrance | — | — |

### 5.2 Choreography rules
- **Cutting on the curve:** give object A heavy ease in and out, parent object B to A so it matches speed and position, then hard-cut at peak velocity. The result is seamless cuts between photos and scenes [SRC: Chris Moran https://www.youtube.com/watch?v=KtEgj5hMEUk].
- **Parent and offset:** group under a null, move the group and offset child keyframes by 2–4 frames each (stagger) [SRC: Sanji Nai-Chien; stagger value PRAC].
- **Sequential shortening:** photo-montage clips get progressively shorter (21 → 15 → 10 frames) to build acceleration [SRC: Matt Loui https://www.youtube.com/watch?v=42ukI3kJpXY].
- **Photo push:** scale to 105% and keyframe a position move over a few frames for life [SRC: Matt Loui].
- **Organic drift expressions (AE):** `wiggle(1,50)` on position, about 0.5°/s rotation, hold keyframes plus `loopOut()` for stop-motion jitter [SRC: Validation https://www.youtube.com/watch?v=ZAuKQRfWGQ0]. `posterizeTime()` on wiggle adds textured jitter [SRC: Mapal https://www.youtube.com/watch?v=F7A503llNBA].
- **Posterize in code:** Remotion's `posterize: 3` updates the animation every three frames, giving a stop-motion feel [SRC: Remotion https://www.remotion.dev/docs/paths/interpolate-paths].
- **Scale animations** should interpolate perceptually: Remotion `output: 'perceptual-scale'` [SRC: Remotion skills].
- **Text arrives as a unit** for anything that must be read (lower thirds). Letter-by-letter typing delays readability [SRC: Mediascaleup].
- **Shape continuity:** a new 2026 approach has each shape stay continuous and fuse into the next, so morphs replace cuts [SRC: https://www.youtube.com/watch?v=6Ij9-f2T2Ck]. Use Remotion `interpolatePaths()` for SVG morphs with per-segment easing [SRC: https://www.remotion.dev/docs/paths/interpolate-paths].

### 5.3 Shake, impact and glitch
- Impact shake: wiggle at speed 3 and amount 100, keyframe the amount 0 → 100 → 0 over about 10–15 frames [SRC: AEffecto https://www.youtube.com/watch?v=JRCCTbBR2tI].
- Glitch: fractal-noise precomp as a displacement map with max horizontal 6 and max vertical 7, cut for under 1 s [SRC: AEffecto].
- Turbulent displace on edges: amount about 8 / size about 8 for text boxes and 40 / 2 on outlines, with an evolution expression `time*5` for boil [SRC: Mapal].

## 6. Typography and Captions

### 6.1 Font and caption systems

| System | Spec | Source |
|---|---|---|
| **Smooth minimal** | Inter Bold (alternatives: Montserrat, Poppins, Arial, Helvetica). Uppercase. One word to a short phrase at a time. Transform and blend (opacity) keyframes for a slide-up. Emphasis by size, glow, colour and a font switch on special words | [SRC: Matt Loui https://www.youtube.com/watch?v=YddyvmAFxnY] |
| **Hormozi stack** | All-caps bold, two lines, heavy shadow. One or two words recoloured (yellow or green) and enlarged as they're spoken. Emojis. Animated stack entrances | [SRC: Kate Telek https://www.youtube.com/watch?v=LWWAajjx-aw] |
| **Documentary typewriter** | Typewriter font with a "retro typer" in-animation over about 3 s, then a slight scale-down zoom-out. Film-dust overlay | [SRC: byl https://www.youtube.com/watch?v=IjMVme1aDWg] |
| **Conceptual expanding title** | Tracking animator 80 → 130 → 80 with an easy-ease speed graph and staggered line offsets | [SRC: SonduckFilm https://www.youtube.com/watch?v=wdrKpsZDsQo] |
| **AI auto-caption base** | Submagic, CapCut auto-captions or Parakeet ASR give word timestamps. Agents use these timestamps for word-level sync | [SRC: Joseph https://www.youtube.com/watch?v=WcMOCtas1pg; Peverelli https://www.youtube.com/watch?v=HzXD4GVqXwM] |

**Font speaks before the message.** If a font is hard to read, viewers stop trying [SRC: Matt Loui].

### 6.2 Reading-time law (use for every on-screen text)
- 1–3 word label: 1.5–2 s. Sentence or stat with context: 2.5–3.5 s. Readable chart: 4–6 s with narration paused. Lower third: about 3 s, animating in and out, never held [SRC: Mark Studios].
- Planning rate: about 1/3 s per word plus a fixed buffer for noticing the graphic [SRC: Mediascaleup]. Conservative signage rate: words = (seconds − 3) × 2 [SRC: https://digitalsignage.com/digital_signage/docs/content/how-many-words-on-a-digital-sign/].
- Agent formula: hold_s = max(1.5, 0.6 + 0.33 × words), plus 1.5 s for any figure with digits. Cap at 6 s, then split [PRAC, synthesised from the above].

### 6.3 Type scale on a 1080×1920 canvas [PRAC]
- Hero keyword: 120–180 px, weight 800–900, tracking −2% to −4%.
- Caption: 64–84 px, weight 700–800, 2 lines max, 18–24 characters per line.
- Label or annotation: 36–48 px, weight 600.
- Contrast: white or near-white text with a 4–8 px shadow or stroke at about 60–80% black, or a pill background. WCAG 4.5:1 is the minimum for small text.
- On 1920×1080, multiply each value by about 0.75.

---

## 7. Texture, Material and Finishing (the "Analog Layer")

| Layer | Settings | Source |
|---|---|---|
| Paper base | Paper texture image on multiply, about 70% opacity; dot pattern about 90% | [SRC: Motion Street https://www.youtube.com/watch?v=mVhEb-4nnhQ] |
| Halftone grunge | 50%-grey textures use overlay-family blend modes; black-background textures use add/screen | [SRC: Chris Moran https://www.youtube.com/watch?v=sACZlG7z35Q] |
| Photo texture | Hard light, overlay or soft light on photos; multiply or overlay on text | [SRC: Matt Loui https://www.youtube.com/watch?v=42ukI3kJpXY] |
| Chromatic aberration | "Quick Chromatic Aberration" (free) on an adjustment layer | [SRC: Chris Moran] |
| CRT / TV screen | CC Ball Action, grid spacing 0, for pixelation, plus chromatic aberration | [SRC: Chris Moran] |
| Glow | Deep Glow radius 700, exposure 0.1, chromatic aberration on. Overlay blend for map outlines | [SRC: Joseph https://www.youtube.com/watch?v=Qbntd8yud0o; Mapal https://www.youtube.com/watch?v=F7A503llNBA] |
| Focus vignette | Adjustment layer with Gaussian blur 30, brightness −100 and Deep Glow exposure 0.01, plus an inverted feathered circle mask so the centre stays sharp | [SRC: Joseph] |
| Silk / premium BG | Silk texture over the background | [SRC: Joseph https://www.youtube.com/watch?v=HQvV75kjblY] |
| Film | Film-dust overlay, film-roll overlay at cuts, "90s" effect, whites −34 | [SRC: byl https://www.youtube.com/watch?v=IjMVme1aDWg] |
| Finishing trio | Film grain, chromatic aberration and light leaks "add life and warmth without completely taking over" | [SRC: Ben Marriott https://www.youtube.com/watch?v=ylXeuDp_8XM] |
| Dither | Treat dither as a designed palette from the start, not a filter on top | [SRC: Ben Marriott] |
| Texture sources | Texture Labs (paper, halftone), Envato (silk) | [SRC: Chris Moran; Validation; Joseph] |

**Rule:** texture belongs to materials (paper, screen, film), not to everything. Apply the analog layer at about 10–25% perceptual strength. Over-finishing ranks with overused bloom as the most common critique [PRAC; SRC for bloom: https://www.reddit.com/r/MotionDesign/comments/1rff2vm/].

---

## 8. Maps and Geographic Motion

1. **Style the map first.** Mapbox Studio is free for custom styles. Strip clutter, set borders white and add your own labels [SRC: Johnny Harris https://www.youtube.com/watch?v=GsojLuJpe_0]. Alternatives: MapTiler style in GEOlayers 3 [SRC: https://www.reddit.com/r/AfterEffects/comments/1pc2fno/], or ESRI World Terrain plus a free Harris-style LUT [SRC: https://www.reddit.com/r/AfterEffects/comments/1mtu4uc/].
2. **Camera:** GEOlayers keyframes latitude, longitude, zoom and bearing. Hold about 4 s on a destination [SRC: Johnny Harris]. Without the plugin, move a large map file with a null and stack layers on top (Harris used to run 50–100 layers this way) [SRC: same].
3. **Country highlight:** draw the border stroke manually, animate the trim-path end over about 0.7 s, fill opacity 0 → 20%, plus an orange glow [SRC: AEffecto https://www.youtube.com/watch?v=JRCCTbBR2tI].
4. **Write-on markers (Harris red marker):** simple mask or path reveals, or a paid aescripts write-on tool [SRC: https://www.reddit.com/r/AfterEffects/comments/1cnyauq/].
5. **Vehicles:** scale about 4.5%, Z about −290, travel off-screen corner to corner over about 1 s with motion blur, and add an impact shake [SRC: AEffecto].
6. **Portrait tie-in:** tint the leader's photo in, use displacement-glitch transitions and mask wipes with a speed-graph peak on the left [SRC: AEffecto].
7. **Code alternative:** HyperFrames ships catalog blocks for maps, charts, captions and overlays (`npx hyperframes add data-chart`) [SRC: HeyGen https://help.heygen.com/en/articles/15001510-hyperframes-x-heygen; README https://github.com/heygen-com/hyperframes/blob/main/README.md].

---

## 9. Making Photos Feel Like Footage

- **2.5D parallax:** choose an image with clear FG, MG and BG. Separate the planes in Photoshop and clone-stamp the holes. Space them in AE 3D (the free "Depth" plugin does this in one click) and slowly dolly or pan the camera [SRC: Chris Moran https://www.youtube.com/watch?v=KkckBGX6Yho].
- **AI depth:** Depth Anything Video produces per-frame depth maps for compositing and effects [SRC: fal https://fal.ai/models/fal-ai/depth-anything-video/playground]. Use depth for displacement parallax, depth-of-field and fog [PRAC].
- **Image-to-video:** animate stills with Seedance 2.0, Veo 3.1 or Kling 3.0 (§13.3). Free route: Flow plus Nano Banana-generated stills animated at 5 s, 720p [SRC: Jacksons AI https://www.youtube.com/watch?v=RaxX_Q7Apj0].
- **Physical metaphors:** show photos as objects being handled, such as turning book pages or thumbing through prints [SRC: r/AfterEffects https://www.reddit.com/r/AfterEffects/comments/npfggh/].
- **Archive staging:** frame photos inside period frames (polaroid, medium-format borders). Retro frames are "coming back" with younger audiences [SRC: same thread].

---

## 10. Compositing the Human With the Graphics

| Need | Best 2026 method | Notes |
|---|---|---|
| Subject matte (behind-text, out-of-frame breaks) | AE Roto Brush on a duplicated layer; Resolve Magic Mask (Studio) or a tracked pen power window (free) with an alpha output node | [SRC: Validation; Daniel Batal https://www.youtube.com/watch?v=LLodyQbxWsQ] |
| Pixel-accurate hair and edges without green screen | **MatAnyone 2** (CVPR 2026) with a **SAM 2** first-frame mask; produces per-pixel alpha with partial transparency on hair and motion blur | [SRC: https://studio.aifilms.ai/blog/matanyone-2-video-matting] |
| Quick cut-outs | Runway green screen is an option, but in an AE pipeline Roto Brush is simpler | [SRC: Validation https://www.youtube.com/watch?v=ZAuKQRfWGQ0] |
| Text locked into a scene | 3D Camera Tracker, then text on the solved plane | [SRC: Adobe] |
| Graphics in 3D with the subject | Advanced 3D renderer; precompose layers that carry blur or glow | [SRC: Joseph] |
| Gradients on icons | Gradient ramp start white and end brand colour, then a Deep Glow adjustment layer, then precompose | [SRC: Joseph] |

**Depth-sandwich recipe (P4), step by step [SRC: Daniel Batal, Validation; ordering PRAC]:**
1. V1: original plate. 2. V2: title or graphic. 3. V3: matted subject duplicate. 4. Feather the matte 1–3 px, light-wrap at 5–10% [PRAC]. 5. Give the title its own drop shadow toward the subject's light direction [PRAC]. 6. Fill the hidden part of the text with the BG plate so the read still works. Keep the key word unobstructed for at least 1.5 s (§6.2).

---

## 11. Sound Design and Mix (Non-Negotiable)

- **Motion-sync grammar:** riser into a whoosh on the transition, clicks on each text or icon pop, plus a reactive hit after the key line ("screens off") so the viewer *feels* it [SRC: Joseph https://www.youtube.com/watch?v=HQvV75kjblY].
- **Libraries:** Boombox by Mt. Mograph (15,000+ SFX with panels in Premiere and AE; Boombox Studio adds variations and mixing). Soundly with Reaper. Epidemic Sound Studio auto-places SFX from video analysis [SRC: r/MotionDesign https://www.reddit.com/r/MotionDesign/comments/1xccp6f/].
- **Music curation:** curated, highly selective libraries matter more than plugins ("if it's not a bop, it's not a cop") [SRC: The Editing Podcast, Appendix A].
- **Mix targets:** YouTube normalises to −14 LUFS integrated and only turns loud masters *down*, never quiet ones up [SRC: Forasoft https://www.forasoft.com/learn/audio-for-video/articles-audio/lufs-targets-per-platform-2026]. True peak ≤ −1 dBTP [SRC: Audiopod https://audiopod.ai/blog/creator-audio-loudness-best-practices-every-platform; Fabric https://fabric.so/learn/what-is-loudness-normalization]. Dialogue alone around −16 to −20 LUFS [SRC: Fabric]. Narration peaks −12 to −6 dB. Music under VO −18 to −25 dB, music without VO −12 to −14 dB [SRC: VidPros https://vidpros.com/fix-background-music-too-loud-video/].
- **Never ship AI voice without human review.** Peers dismissed a strong animation because of "awful AI voice over and music" [SRC: r/MotionDesign https://www.reddit.com/r/MotionDesign/comments/1rff2vm/].
- **Music-first timing:** when the music is right, the edit's rhythm follows. Editors lay "insert motion graphics here" placeholders on a black timeline until music and footage are locked [SRC: The Editing Podcast, Appendix A].

---

## 12. Narrative and Retention Architecture

**Beat grammar for a 45–60 s vertical [PRAC, built on cited mechanics]:**

| t (s) | Beat | Visual module | Mechanic |
|---|---|---|---|
| 0–1.5 | Pattern break | P4 behind-subject keyword or P10 paper tear | The hook is where the most effects go [SRC: Validation] |
| 1.5–5 | Claim plus visual anchor | Evidence card or screenshot with highlight | Visual evidence first [SRC: David Mora] |
| 5–20 | Bridge / anchor ×2 | Alternate P1 HUD and P2 split | Anchor → bridge rhythm |
| 20–35 | Escalation | Countdown, chapter card, puzzle build | Progression devices [SRC: James Jani] |
| 35–50 | Payoff | P5 out-of-screen zoom-out | Zoom out to the big picture |
| 50–60 | Resolve and loop | Callback to the first frame | Loop closes |

**Long-form 16:9 (8–20 min):** chapter cards every 90–180 s. The anchor-to-bridge ratio is about 60:40 on screen time. Every bridge ends on a cue that sets up the next anchor [PRAC derived from §1].

**Planning workflow used by pros:** script → markers for motion ideas → find the linked articles in the script and pull the clearest headline or caption → build in AE [SRC: The Editing Podcast https://www.youtube.com/watch?v=7hHyY2HhHf4]. The AE-to-Premiere master-comp approach: assemble timing in a master AE comp, import it into Premiere for the rough sound draft, then render ProRes [SRC: r/AfterEffects https://www.reddit.com/r/AfterEffects/comments/1kn2ikb/].

## 13. The AI-Native Production Stack (October 2026)

### 13.1 Code-rendered motion graphics (deterministic, editable, sharp text)

| Tool | What it is | Key facts for agents |
|---|---|---|
| **Claude Motion / Opus 5.5** | Artifacts tab "Motion" that turns prompts, screenshots or links into editable animated video, built as code | It writes code, not pixels. A headless browser captures each frame and ffmpeg encodes them, which gives sharp text and exact timing but no photoreal people [SRC: https://blog.laozhang.ai/en/posts/claude-opus-5-5-video-generation; MindStudio https://www.mindstudio.ai/blog/claude-motion-ai-video-generator]. At launch it was limited to Team and Enterprise plans and usually asks a style follow-up question [SRC: MindStudio]. A public gallery lists 2,179 works, 530 with prompts [SRC: https://github.com/zhuyansen/awesome-opus-5.5-video] |
| **HyperFrames (HeyGen, Apache 2.0)** | HTML/CSS/JS compositions with data-attribute timing | Adapters for GSAP, CSS, Lottie, Three.js, Anime.js and WAAPI. Renders by seeking, not playing, in headless Chrome, with FFmpeg encoding [SRC: README https://github.com/heygen-com/hyperframes/blob/main/README.md; research https://www.heygen.com/research/html-to-video]. Embedded `<video>` files are pre-extracted to JPEG frames [SRC: research]. Cloud API: `POST /v3/hyperframes/renders`, fps 1–240, 16:9/9:16/1:1, 1080p or 4K. WebM and MOV carry alpha for transparent overlays at 1080p; 4K output is opaque [SRC: https://developers.heygen.com/hyperframes]. Catalog: `npx hyperframes add flash-through-white`, `instagram-follow`, `data-chart` [SRC: https://help.heygen.com/en/articles/15001510-hyperframes-x-heygen] |
| **Remotion (React)** | `interpolate()`, `spring()`, `Easing`, `interpolatePaths()` | Studio-editable when values are inline. Clamp extrapolation. Use `perceptual-scale` for scale. Per-segment easing arrays [SRC: https://www.remotion.dev/docs/studio/interactivity-best-practices; skills repo] |
| **Plain canvas JS** | Claude writes JS that draws each frame without a framework | A free database of 86 styles exists. Prompts that embed the full example code transfer well even to Sonnet. Models can't watch reference videos, only screenshots, so code beats video as a style reference [SRC: Futurepedia https://www.youtube.com/watch?v=Ge1B-Ok1Pfk] |

**Harness lessons (hard-won, all cited):**
- Lock the canvas (for example 1920×1080 at 60 fps) and position everything relative to the centre. A layout "exploded" because the Figma frames were 1440 wide [SRC: Sanji Nai-Chien https://www.youtube.com/watch?v=D5qpBbEWTxo].
- Export UI as **SVG, not screenshots**, so camera zooms stay razor sharp [SRC: same].
- Embed fonts. Unembedded fonts fell back to Times New Roman [SRC: same; Didier Girard].
- Every scene is its own code block, built from a storyboard [SRC: same].
- Build self-checks into the page, such as a minimum on-screen time per text line [SRC: Didier Girard https://x.com/DidierGirard/status/2104246320286335439].
- Iterate by "tasting": the Girard teaser took five prompt versions [SRC: same].
- Turn successful sessions into reusable **skills** [SRC: Futurepedia; Sanji; Joseph; Peverelli].

### 13.2 Agentic editing pipelines (real, published)
- **Peverelli (722K views):** Parakeet (NVIDIA) for transcription, Claude Code for cut decisions, HyperFrames for motion graphics, a researcher agent that captures screenshots and scroll recordings of sources and highlights lines, Tella (face plus screen recording) via MCP, and FFmpeg for black-frame and sync QA. The editing style lives in a skill file [SRC: https://www.youtube.com/watch?v=HzXD4GVqXwM].
- **Joseph "ONLY AI" talking head:** Claude learns clipping and saves it as a skill, then Submagic captions, a Claude edit plan, Higgsfield scene mock-ups and Seedance 2.0 animations (5 s with SFX), then Premiere assembly [SRC: https://www.youtube.com/watch?v=WcMOCtas1pg].
- **Vox-style automation:** master prompt plus a source PDF "engine", then image prompts, Flow/Nano Banana stills animated as 5 s clips at 720p [SRC: https://www.youtube.com/watch?v=RaxX_Q7Apj0].
- **AE via MCP:** Higgsfield's "AI Motion Designer" is an AE extension plus an MCP bridge to ChatGPT or Claude. A pro tester says you can build your own AE MCP server, and that "AI is just terrible at animation at this point" for native AE keyframing [SRC: Jake In Motion https://www.youtube.com/watch?v=QLZNiwaKqWg].

### 13.3 Generative video models (B-roll, image-to-video, stylised inserts)

| Model | Strengths | Limits | Price signal | Source |
|---|---|---|---|---|
| **Seedance 2.0 (ByteDance, Feb 2026)** | #1 on Arena for text-to-video and image-to-video. Up to 9 images, 3 videos and 3 audio references. 4–15 s, up to 1080p/2K at 24 fps. Native audio | Safety ranked 6th in HKU study | about $0.30/s 720p, $0.68/s 1080p (fal) | [SRC: Kubeez https://kubeez.com/blog/seedance-2-vs-kling-vs-veo-vs-grok; Picsart https://picsart.com/blog/best-ai-video-models/; fal https://fal.ai/learn/tools/best-image-to-video-apis-2026; HKU https://lead.hku.hk/en/article/2026/10/hku-business-school-releases-report-on-gen-ai-video-generation-capabilities/] |
| **Veo 3.1 (Google)** | True 4K. Best native dialogue (48 kHz). First and last frame control, 3 reference images, timeline events in the prompt, 9:16 support | 8 s clips; extensions capped at 720p | $0.20–0.60/s | [SRC: Kubeez; Picsart; fal] |
| **Kling 3.0 (Kuaishou)** | Most realistic human motion. Most literal prompt-follower. Multi-shot direction. Up to 4K | Image-to-video weaker (Arena #9) | about $0.11–0.20/s | [SRC: Gendia https://gendia.ai/blog/best-ai-video-generators-2026; Kubeez; fal] |
| **HKU 2026 visual scores** | Seedance 2.0 Pro 3.84, Veo 3.1 3.47, Vidu Q3 Pro 3.44, Kling 3 3.27, Sora 2 Pro 3.27 | Adding image inputs *lowered* quality for most models (Wan 2.6 fell from 3.41 to 2.75) | — | [SRC: HKU] |

**Agent policy:** use generative video for *evidence-like* B-roll, environments and stylised transitions. Never use it for typography, charts, maps or brand UI; build those in code or AE for legibility. Label synthetic footage in journalism-style content [PRAC]. Image-reference degradation means you should test text-to-video versus image-to-video per shot [SRC: HKU].

### 13.4 Honest capability assessment (community, 2026)
- Higgsfield Vibe Motion: reviewers call it useful for rough prototypes and simple loops, but unreliable for precise timing, typography control and layer composition. It burns credits and is "not a replacement" [SRC: https://www.youtube.com/watch?v=gxBRbiq2GVA; https://www.youtube.com/watch?v=HlQEPecp0sE; https://www.youtube.com/watch?v=CyJnkHXAf3c].
- Pros on Reddit accuse vendors of a "creator hype, then nerf" pattern [SRC: https://www.reddit.com/r/MotionDesign/comments/1rmltp7/].
- r/MotionDesign is pushing back hard against "AI slop" posts, and users accuse AI tools of pulling others' assets [SRC: https://www.reddit.com/r/MotionDesign/comments/1x044lx/; https://www.reddit.com/r/MotionDesign/comments/1wqrlx6/]. **Implication:** originality and asset provenance are differentiators. Log every asset's source (§14.3).
- In a head-to-head, Claude matched a human on camera depth, glow accents and clean typography, but the human still won on "custom lighting flares and micro details". Claude rendered in 34 minutes versus hours for the human [SRC: kaye.creatives https://www.youtube.com/watch?v=AsvN_feasyY].
- The saturated "AI SaaS promo" genre "tells no story". Strong motion can't rescue a weak concept [SRC: https://www.reddit.com/r/MotionDesign/comments/1u6ia55/].
- Vox-level intros are "the assignment of one or more animators for at least a week" [SRC: https://www.reddit.com/r/MotionDesign/comments/1vspixn/].

---

## 14. The Modular System (Build Your Own Engine)

### 14.1 Module library
An agent composes videos from these typed modules. Each module has a fixed interface: inputs, duration rule, layout, motion preset, sound cue, and QA checks.

```yaml
layouts:        [P1_fullframe_hud, P2_split_50, P3_split_60_40, P4_depth_sandwich, P5_out_of_screen_zoom,
                 P6_pip_over_broll, P7_subject_in_3d, P8_tracked_world_text, P9_interactive_image, P10_papercut_world,
                 F1_collage, F2_map, F3_chart, F4_code_launch]
evidence_cards: [screenshot_highlight, article_headline_pull, document_zoom, tweet_card, photo_parallax,
                 archival_film_frame, ai_broll_clip, screen_recording_scroll]
type_modules:   [hormozi_stack, smooth_minimal, typewriter_doc, expanding_tracking_title, lower_third, kinetic_stat]
motion_presets: {enter: m3_emph_decel_400, exit: m3_emph_accel_200, hero: power4_out_700,
                 ambient: wiggle_1_50_drift, stopmotion: hold_kf_posterize_3, transition: cut_on_curve, morph: path_morph}
finish_packs:   [analog_paper, halftone_news, crt_screen, film_doc, premium_glow, clean_none]
sound_cues:     [riser, whoosh, click, pop, hit, paper_rustle, typewriter, map_ping, bass_drop, silence_beat]
```

### 14.2 Style-lock tokens (write before scene 1)
```json
{
  "canvas": {"w": 1080, "h": 1920, "fps": 30, "safe": {"top": 288, "bottom": 672, "left": 120, "right": 192, "right_below_y840": 300}},
  "palette": {"bg": "#F2EDE4", "ink": "#111111", "accent": "#E63B2E", "accent2": "#F5C518", "data_neutral": "#9AA0A6"},
  "type": {"display": "Inter Tight 900", "body": "Inter 700", "mono": "JetBrains Mono 600", "caption_px": 76, "hero_px": 150},
  "motion": {"enter": [0.05,0.7,0.1,1.0], "exit": [0.3,0.0,0.8,0.15], "stagger_frames": 3, "ambient_drift_pct": 2},
  "finish": {"pack": "analog_paper", "grain": 0.12, "chromatic_aberration_px": 1.5, "glow_budget_per_min": 3},
  "audio": {"lufs_integrated": -14, "true_peak": -1, "music_under_vo_db": -22}
}
```
(Values are [PRAC] defaults. Override them from a reference "grammar" extraction.)

### 14.3 Scene spec (one per beat)
```json
{
  "scene_id": "S03",
  "t_in": 5.2, "t_out": 11.8,
  "script_span": "…and that's when the price tripled overnight.",
  "beat_role": "anchor",
  "layout": "P2_split_50",
  "top_panel": {"module": "kinetic_stat", "value": "3x", "label": "overnight", "hold_s": 2.6},
  "bottom_panel": {"source": "talking_head_A", "crop": "eyes_at_y_1320"},
  "seam": "paper_tear", "subject_breaks_seam": true,
  "sync_points": [{"word": "tripled", "action": "stat_scale_pop", "sfx": "hit"}],
  "transition_out": "cut_on_curve",
  "asset_provenance": [{"asset": "chart_data", "source_url": "…", "license": "…"}],
  "qa": ["safe_zone_pass", "read_time_pass", "mute_test_pass"]
}
```

### 14.4 Decision engine (which module for which beat) [PRAC]
- **Spoken number or statistic** → kinetic_stat (P1 or P2), plus a pop sfx on the number word.
- **Named place** → F2 map flight, or P8 tracked text if there's location footage.
- **Claim that needs proof** → evidence card (screenshot_highlight / article_headline_pull) via the researcher agent [SRC pattern: Peverelli].
- **Abstract idea** → metaphor illustration (paper-cut or icon system), never stock-photo literalism.
- **Emotional peak** → strip graphics back to silence_beat and a slow push on the face (contrast through restraint).
- **Topic pivot** → P5 out-of-screen zoom-out or a chapter card.
- **List of 3+** → progressive build that keeps prior items visible at 40% opacity.
- **Same visual module twice in a row** → forbidden. Variety rule [SRC: The Editing Podcast].

---

## 15. QA Rubric (Score Every Render; Ship Only at 90+/100)

| # | Check | Pass threshold | Pts |
|---|---|---|---|
| 1 | Hook | Pattern break inside 1.5 s; a visual anchor by 5 s | 10 |
| 2 | Safe zones | No key text or logo outside the strictest box (§4) | 10 |
| 3 | Reading time | Every text meets §6.2 | 10 |
| 4 | Mute test | No graphic only repeats the audio | 10 |
| 5 | Motion physics | No linear moves on visible travel; entrance decel, exit accel, exits shorter than entrances | 10 |
| 6 | Continuity | Nothing fully freezes (except deliberate silence beats); cuts on the curve where possible | 5 |
| 7 | Variety | No identical layout module twice in a row; at least 4 layout types per minute in vertical | 5 |
| 8 | Finish restraint | Glow or bloom moments within budget; texture doesn't reduce legibility | 5 |
| 9 | Edges | Mattes free of chatter or halos at 100% zoom | 5 |
| 10 | Audio | −14 LUFS ±1, TP ≤ −1 dBTP, music −18 to −25 dB under VO, sfx on every visible pop | 10 |
| 11 | Typography | Fonts embedded, no fallback fonts, contrast ≥ 4.5:1, ≤ 2 caption lines | 5 |
| 12 | Provenance | Every asset logged; generative footage labelled where required | 5 |
| 13 | Story | Anchor → bridge rhythm holds; payoff lands; the loop or CTA resolves | 10 |

---

## 16. Known Gaps and Unverified Areas
- Platform safe-zone figures are **ad specs**. No platform publishes organic-post safe zones [SRC: Mark Studios].
- Retention *lift* from specific techniques (for example "captions raise retention by X%") was not verified in independent studies. Creator claims such as "130% retention" are anecdotal [SRC: Matt Loui self-report].
- Vox and Netflix in-house pipelines are inferred from tutorials and one ex-Vox designer comment, not official documentation.
- Generative-model rankings shift monthly. Re-check Arena and Artificial Analysis before committing a pipeline.
- Reddit collection was partial: the Apify run hit its 10-minute timeout after about 290 items in the second pass. r/VideoEditing and r/premiere coverage is thinner than r/MotionDesign.

---

## Appendix A — Raw Evidence: YouTube Transcript Extracts (via Apify)

> Keyword-filtered transcript excerpts, one block per video: title | channel | views | duration (s) | URL.

##### How I Make My Maps | Johnny Harris | 1551563 views | 1769s | https://www.youtube.com/watch?v=GsojLuJpe_0
- my journey in map-making and the evolution of my style. And then I'm gonna dive into two different workflows. One is a workflow that requires a $200 plugin, which is expensive. And I used to not be able to afford that. And so, I'm also going to teach you the workflow that doesn't include that
- plugins. It just requires AfterEffects, the Adobe animation program which is a program that is enhanced by this processor. Then I will move on to the one that requires the $200 plugin called GeoLayers. If you want to just skip to that, to the GEOlayers part, go to the time code that is here on
- Make these borders all white and save. This is happening way faster than what I'm used to. Okay. Anyway, next we go back. The file is now updated. So now I've got this thing that I could zoom in on itself or better yet. I could make a null layer, new, null and this is
- P and S is a matter of now putting two little keyframes, going to where you want to go next and going over a little bit or going this way. And you now animate and maybe zoom out a little bit. Okay. And now you've got yourself a little animation. Okay. You can do that
- on. Okay. Boom. Okay. So that is the basics. This is how I used to do it. I used to make so many videos using this workflow of zooming around using a null and a big old file and layering stuff on top of it. And there was like 50 or a hundred layers. All
- what the style is. You can license some of this data that they have on the GEOlayers site or you can pick one of their default styles or you can do what I do, which is go to Mapbox. Mapbox are the people behind a lot of the mobile apps you use, the maps you
- use for like Uber or GrubHub. I don't know, but like those types of maps, Mapbox makes those, but hack of the world is that you can design your own maps and not use them for an app, but use them in GEOlayers, check it out. This is called Mapbox Studio and it is free
- you can start to see the power of this. We went from a big cluttered design to a super clean nice design that we can put our own labels on. Once this is in GEOlayers. Yes. This is going to be in GEOlayers pretty soon. This is ready for me to bring into AfterEffects. The
- Iraq. So I'm going to have it wait there for maybe, I dunno, four seconds. And then I am going to look at all of these. These are the keyframes that run GEOlayers, latitude, which makes it go up and down, longitude, which makes it go left and right, zoom, which makes it zoom, bearing,

##### Create Better Motion Graphics Like Vox in After Effects | Tutorial #15 | Motion Street | 836548 views | 2394s | https://www.youtube.com/watch?v=mVhEb-4nnhQ
- the after effects and like we always do we'll start by creating a new composition and let's call this as render and for the dimension we'll go with 1920 x 1080 which is full HD with 30 FPS and 10 seconds long with the background color is complete PL now hit okay and the animation
- a new solid and we'll call this as just maybe BG for background hit okay all right and then we will search for effect which is called fail and by the way if you don't see this tab on the screen you can always go to this window and make sure this effects and presets
- with this one all right which is off yellow color I believe and then once you done hit okay and we can go back to this project project window and it's time to drag our paper texture clip onto the top of this PG and then uh we will drag our paper texture image this
- the second layer and then we'll quickly change its blending mode to multiply like this and let's put this paper clip at the very bottom and we'll also change the blending mode of this PG to multiply okay and now what we'll do is we'll select our fourth layer which is the paper clip and
- then hit T to see the opacity and let's decrease down the opacity down to 70% and also we'll do the same thing for our dots pattern and let's bring down the opacity down to 90% like this okay and now if we do a scrap preview we will see this is the animation that
- just expand this trim path then go to somewhere around 2 seconds and then drop a key frame on the end property with 100% value like this and then stay at the very beginning of your timeline and bring the same value down to zero all right now just select both the key frames that
- we have dropped hit F9 to easy ease them and then go to this graph editor and if your graph editor doesn't look like this then make sure you're working in this edit speed graph all right now just select this right handle hold shift and bring this all the way to the left like
- and then increase the offset drop key frame and then increase the offset to 100% all right and then go back to the very start and decrease the offset down to zero like this and now we can again select both the key frames H F9 to easy ease them and then go to this
- to zero like this and then let's open up this range selector one make sure to stay at the very beginning and then drop a key frame on the offset with 0% value and then go to 2 seconds and increase this offset value back to 100% like this all right and after this we'll

##### How does Vox make their cuts look so smooth? #vox #motiongraphics #aftereffects #animation | Chris Moran | 897736 views | 21s | https://www.youtube.com/watch?v=KtEgj5hMEUk
- Vox cuts look so smooth because they use this one trick. It's called cutting the curve. Here's how you do it. Set your key frames for the first object with heavy ease in and out. Now parent the second object to the first object so it matches its speed and position. At the peak of
- its velocity, right about here, you should make a hard cut. And that's it. You can now cut between photos and scenes seamlessly.

##### How Vox makes images look like videos | Chris Moran | 484275 views | 37s | https://www.youtube.com/watch?v=KkckBGX6Yho
- Look at this Vox animation. See it? Something about it feels almost like a video. Remove the effect and it feels kind of flat, like an iMovie slideshow. It's called a parallax effect and it's how Vox brings historical images to life. Here's how to do it. Start with an image that has plenty of
- depth. Look for a clear foreground, midground, and background. In Photoshop, separate those elements into their own layers. Then, I use the clone stamp tool to patch over any areas hidden behind them. Bring those layers into After Effects and space them out in 3D. I use this free plugin called Depth to do this
- in one click, but you can also do it manually. From there, slowly dolly or pan the camera to create that parallax effect and immerse your viewer in the photo.

##### How VOX breaks the Digital Feel with Motion Graphics | Chris Moran | 180952 views | 750s | https://www.youtube.com/watch?v=sACZlG7z35Q
- format walks the viewer through the messy source material [music] that's a part of journalism. think archival footage, charts, maps, articles, interviews, stuff coming from all over the place. Instead of trying to smooth that out, they leaned into it and established [music] an art direction that's heavily analog. Basically, screens feel like screens, paper
- feels like paper. Everything has this tactile [music] element to it. Once you understand that, all the choices within After Effects feel pretty intuitive and make sense. If you think about it, everything in the world has some sort of material associated with it. Create a truly analog look. Vox introduces texture into their digital
- from texture labs. And I think with this animation, something like a half te pattern would look pretty good because it'll give you that newspaper cutout kind of feel. So I pulled this texture by searching half te grunge in texture labs and it gave me something that looks like this. So let me drop
- that in and let's scale it down since it's so high res. And then what I'm going to do is since it's got that 50% gray to it, we're going to want to use one of the overlay blend modes. Um so basically anything in this section and I'm just going to select overlay. And
- let's name this chromatic aberration and vignetting. So, first thing I'm going to do is add uh chromatic aberration and there's a free plugin uh called quick chromatic aberration that I think works great and it's not baked into After Effects like a standard effect. So, highly recommend you getting that. Um, also another thing
- on texture labs. I think it might look nice if we put it over everything and just kind of discolored the paper a little bit. Um, so let's add that on top and scale it down. And what I'm going to do is I'm going to set that blend mode to something like add. Since
- it's kind of got a black background, you're going to want to use blend modes in this section. See, I like how that's interacting with the paper in the background and that uh newspaper cutout. It's just a little bit of discoloration. I think it makes this whole composition look a little bit more organic.
- of the frame, which I like. Next thing we're going to do, we're going to add another adjustment layer for the rest of our effects. First effect I'm going to add is called CC ball action. Weird name. It almost creates this TV like screen. So, we're going to reduce the grid spacing down to
- zero. And that's pretty much it. And if you zoom in, you can see it's doing a little bit of work creating that pixelation. Next thing we're going to do is add some chromatic aberration, which we've done a lot of. And we're going to use that same plugin. We'll crank this up to something

##### I Fully Automated My Video Editing Using Claude Code (Full Walkthrough) | Christian Peverelli | 722423 views | 1018s | https://www.youtube.com/watch?v=HzXD4GVqXwM
- in front of the timeline for hours. They watch every clip, they pick the ones they like, cut out the ones that they don't, decides where every zoom goes, and also figures out the graphics and animations that they want and where. Now, in my system, Claude Code is the tool that does all of
- It's completely free tool, and it was built by Nvidia, which is the leading manufacturer of chips. No, not Doritos or Lays. I mean like the chips, right, for AI. Mm, chips. Get back to it. So Parakeet does the transcription and then Claude is able to actually read the timestamps and exactly what is
- any motion graphics. And in the old world, this was done with After Effects. You literally had to use one tool just to do these things. And this is exactly where Hyperframes comes in, tool number three. Now this again is a free tool developed by HeyGen, which is the video platform. Claude writes each
- I say that, I actually need the fourth person which is the researcher. Someone who goes out and is able to find a screenshot of that announcement or a post on X or a research paper that proves the point that I'm actually illustrating and turns that into what we call B-roll, things that you
- do that research. And in the background, Claude, my researcher, is able to grab screenshots or record video scrolling down a website and then it could do things like highlight lines or actually zoom into specific sections of those pages. And the great thing is that it only shows you exact facts. So it's really
- I use screen sharing a lot, and that's why I used a tool called Tella. Tella records my face and my screen at the same time, and because Tella has a connector called an MCP, I can connect it directly into Claude Code, and it's able to do all the things it does inside of
- the software. The cuts, the zooms, the layout, the formatting, yada yada, everything that you can do inside the software, you're able to do via Claude Code. So, I literally only just have to record through it, and it does the rest. But, up until now, we've just been talking about the visuals of this
- than 20 years. In fact, it's under the hood of pretty much every editing software that exists today. So, Claude uses it, and it's responsible for cutting out any black screens, checks if there's nothing off with audio sync before I ever get to even see the video. So, those are the seven tools or
- jobs that have to be done, but none of those actually know what my video's supposed to look like. That's probably the most important thing, and it's called the skill. A skill is simply just a file of instructions that Claude reads before it does the job, and it's pretty much my editing style broken

##### How to Make Insane Motion Graphics With Opus 5.5 | Lukas Margerie | 677923 views | 1216s | https://www.youtube.com/watch?v=747ZnEtsRbg
- try it out on their own. And what they get is some sloppy AI video with a centered text and a gradient. Kind of the whole design looks very generic. But the thing is the prompt is only 10% of the outcome of this video. And the rest of the 90% is the harness. So
- it can use a framework like Remotion, Hyperframes, Diffusion Studio. It can be a mixed pipeline with image video models plus Opus Composites on top of that or you have existing videos and Opus 5.5 can cut those videos, add captions, add B-roll, etc. etc. And by the way, if you want to learn more
- don't have Hyperframes or Remotion connected, what you can do is you can go over here to the connectors and just search for hyperframes, right? You install that, you authenticate your account, and you can do the same thing with Remotion. Install this Claude Code plugin. And so, let's start from scratch in a new
- canvas plugin that you can use for Codex and for Claude code. And I'm just going to give it the same prompt as before, but now I'm going to say about Magic Path and see what result it gives me. And then this is the result that we get. So we have the different steps.
- an entire product explanation and he basically told Claude to gather the brand assets by itself by saying use actual product screenshots, logo assets. And so this article on X that I was referring to before has a great prompt that you can use where it can do this research for you and then generate
- prompt and a whole team of designer agents gets to work. Plug in Claude code, Codex, or Cursor. Push any design into your [music] repo as real React. Five agents building five screens at once. Half 2.0. Try it at magicpath.ai. >> Now the next step here is to try to give Opus 5.5 references
- movements, texture grain, how text enters and exits. Then write a short list markdown for a 15-second launch video about Magic Path in that style and use real screenshots. Take the grammar of the reference, never its content, logos, or characters." And then what we get is this, right? It's like literally a Magic Path
- a video with Opus 5.5. I just discovered it today actually. It's by Donald on X. I made this with one prompt using Opus 5.5. I spoke to my computer for 5 minutes, Claude worked for 12 hours, and I woke up to this. And you can see his prompt that consists of like thousands
- initial video that he was remixing. And we get insanely impressive works by other creators like pleometric in this like retro anime style. And so in this article by Movidius, he gives us this prompt which I find very helpful and very interesting. So, you are the director, animator, sound designer, and render engineer for

##### How To Make Insane Motion Graphics With Opus 5.5 (Claude Motion) | kaye.creatives | 473454 views | 744s | https://www.youtube.com/watch?v=AsvN_feasyY
- What if you could produce high-end motion graphics without touching After Effects or any kind of design software? People are claiming Cloud Motion with Opus 5.5 is good enough to replace motion designers entirely. So, today I'm putting Cloud directly against my motion designer friend to see if that's true or it's all just marketing
- Claude code or After Effects for this. Literally, just open up the regular Claude chatbot. Go to Artifacts, click on motion, and we're good to go. Now, here's a golden rule nobody tells you about. If you give Claude a lazy one-sentence prompt like add a motion graphics to my clip, you are going to
- get basic and boring results. People getting mind-blowing visuals understand that the prompt is 90% of the work. So, you need to feed it references, brand assets, and actual direction. And don't worry if that sounds like a lot. At the end of the video, I'm giving you my secret skill that writes my master
- prompts for you on the first try. Okay, now that we covered the basics, we can now proceed to the prompting part. I have a raw video where I talk about Claude Opus 5.5, and I know, I know, I'm asking Claude to edit a video about Claude. Weird, right? And as I have mentioned
- phrase I say. Third, we need visual references. Like I mentioned, uploading multiple reference clips is a secret to walking in your exact visual direction. And I finally attach my custom AI skill into the chat. It acts as an automated prompt generator that feeds Claude all the motion design rules and code structures behind
- CEOs are publicly debating AI safety and telling us we need to slow down, Anthropic just launched Claude Opus 5.5. Basically, it acts like a real visual engineer. It can build and render complex 2D and 3D animations directly in HTML. Now, is it perfect on the first try? Of course it's not. It never
- wording and take a look at the B-rolls it generated. I think this video turned out really well. Now, the moment of truth. Like I promised at the very start, we're putting Claude head-to-head against a real professional. Quick context, it took Claude only 34 minutes to render the whole video. However, it took 5
- I just type my quick feedback straight into the prompt box. Okay, Cloud updates, regenerates the visual, and gives me version two. Let's see what it cooked. Okay, wow. Now, this is clean. Look at the style. It looks like paper cutouts from magazines, and the transitions between scenes are so clean. And what I
- versions head-to-head. Let's see who takes the crown. Motion designer's version has these smooth, subtle human touches like custom lighting flares and micro details that make it look ultra polished. But looking at Claude's version, the camera depth, the glowing accents, and typography are crazy clean. If I didn't know an AI generated this, I

##### Higgsfield AI Motion Designer: I Tested the Claims | Jake In Motion | 341695 views | 962s | https://www.youtube.com/watch?v=QLZNiwaKqWg
- Spoiler alert, [music] it's all fake. Higgsfield AI motion designer is not what they want you to think it is. I've tested out myself and in this video I'm going to show you my authentic first impressions of how it performed and I put chapter markers if you just want to skip there, but I
- access to that model. You have to bring that model to Higgsfield. All they're giving you is an extension that you install into After Effects and an MCP server. That's model context protocol and it's just a way for AI to control apps. So, when you install that Higgsfield plugin, you're just creating a bridge
- between ChatGPT or Claude, which they don't say anywhere on the page, you can also use Claude to use After Effects. And you don't need Higgsfield to do that. You could literally ask ChatGPT or Claude to build an MCP server for After Effects for you and start asking your agents to just make you
- things inside of After Effects. [music] I've done it. It actually works really well, but AI is just terrible at animation at this point and AI motion designer from Higgsfield doesn't bring anything new to the table. What you're really getting with their plugin is the ability to link it to your Higgsfield account and
- use [music] credits that you've purchased or your subscription to generate assets as you're talking to ChatGPT or Claude. And you'll see how that works with my tests. [music] Besides that, I'm sure there's custom tooling and prompt engineering that is built into their plugin that guides Chat GPT to [music] create interpretations of what
- piece of paper the entire time. There is a slight drop shadow there, but it is rotating with the paper, so that's not photo real. And it didn't really do much with the background. I was expecting more than just a subtle paper texture using my brand color when I asked for a studio kind
- with hold keyframes on the opacity of those layers. That doesn't bother me too much. I probably would have handled it slightly differently. And then back in this comp, if I press U, there are a whole lot of keyframes and expressions. So, let's go into the effect controls. It added a drop shadow, renamed
- Effects using native After Effects layers. That being said, if you want to make custom textures, feel free to generate those assets. I would also love to hear some music and sound effects timed to the animation. So, feel free to generate those as well. The frame rate should be 24 frames per second. The
- the name of the folder and say there's a folder in After Effects named Higgsfield reference. I don't have time to give you any more feedback or the budget to create something original. So, I just want you to take a look at the style of all of the screenshots in that folder and apply

##### The Best Motion Design & Animation of 2026 (So Far...) | Ben Marriott | 305935 views | 1110s | https://www.youtube.com/watch?v=ylXeuDp_8XM
- shows a delicate touch to color and grain on the designs for this short Burberry animation. Beautifully contrasting hard and soft edges as if they were drawn with soft pastels. There are plenty of ways to get this wrong, but this absolutely nails it. [music] ManVsMachine created this little diddy of a commercial for their
- collaboration between Moncler and Gilga Farm, where the 2D animation interacts and influences the 3D surface with superb playfulness and attention to detail. Michael Lim, aka Space Dawg, has become one of my favourite animators to see with new work. And his Hermès 520 campaign is one of many that combines his exceptional frame by
- has only a 10-second runtime, but the clean graphic elements are instantly legible. And subtle analogue finishes, film grain, chromatic aberration, and light leaks add life and warmth without completely taking over. And also, their background work for BBC's Turner: The Secret Sketchbooks are just sublime. and other recent work they've created are even more
- and magnificent. Here, the dither effect is not used just as a filter over the top of an existing animation. It is a palette of different textures and values that are clearly considered from the beginning. There is nothing like it. But what happens when the monster underneath the mask gains control? Kaho Yoshida's YouTube
- all very well worth the watch. For one person to do this is actually incredible. Sélim Lallaoui's Above the Sea is another incredible showcase of an individual skill. The sheer detail in the models and in the texture that the millions of object on screen create are wonderful, but they never compromise the solid composition
- traditional effects animation. Pure skill and understanding of the elements. The 2008 family film can take a hike because this is my favorite water horse. [music] The music video for Mac Miller's Rush Hour is a wonderfully fitting tribute. Using hand-painted watercolour techniques, Danaë Gosset is absolutely incredible in this corner of the animation world.
- Max Cooper is maybe the most beautiful and mesmerizing animation that you'll see this year. Handdrawn frame by frame. The way the rotoscope elements flow right into this wild and fluid straight ahead organically growing animation is seamless and so captivating. It just transports you into this world where you've got no choice to be
- pulled through this river of memories and biological forms that you cannot peel your eyes away from. [music] [music] A Qing Yu A's short film Abstwin is one of the strangest and most striking on this list. The scale of this project is absolutely wild for one person. The amount of different skills and techniques
- incredible. I love that painterly bleeding edge kind of marker texture which gives it so much life. I cannot wait for the show and I can't imagine anyone ever skipping this intro. Potto Collective created this trailer for the comic La Langue des Vipères, carefully matching the same great line work from the comic art,

##### Claude Makes a New Kind of Video - Full Tutorial | Futurepedia | 300172 views | 679s | https://www.youtube.com/watch?v=Ge1B-Ok1Pfk
- There's a new way to make videos with Claude and they are perfect for motion graphics, explainer videos, and just videos that don't look like they were made with AI. And Claude doesn't have a video generator, but it doesn't need one. It does it all through code. I'll show you how these work and
- exactly how to make them. Plus, I actually created a huge free database of 86 styles you can explore and use just by copying the prompt. There's simple ones, more elaborate ones, and some that are just really unique. And they are all customizable and have the option to sync them up to a voiceover
- and time them perfectly to the words. Now, first off, I want to explain what's new about this since I've been using Claude to create motion graphics for a while already using frameworks like Remotion and Hyperframes as many other people have. Those are toolkits you can install that give Claude a structure to build
- videos. This doesn't need any of that. Claude writes plain JavaScript that draws each frame by itself. JavaScript is the programming language built into every web browser. It doesn't really matter to know any of that, but I wanted to cover it. And I got most interested in this over the previous workflows I had
- prompt into Chat GPT and Astra gave me a good result, too. Although I think it is a little worse than Claude's. That's how easy this is to use and there are so many different styles in here. A lot of them are really, really cool. I may have gone a little overboard on this.
- [music] >> And you may have noticed when I pasted it into Claude, it was the little pasted text attachment. That's because the prompt is really long. This is what the whole thing looks like. I do have some guidance built in, but the most important part is it includes all the actual code that
- was used to create the example video. That's why these can be so consistent and why it gets just as good of results out of Sonnet as it does Opus. If you just send the video itself as a style reference, Claude and Chat GPT can't watch it. All they do is take screenshots and
- want. Just ask to change the color palette or things to move slower. Ask for any customizations to these. Just explain that in your prompt or through iteration after it comes back. Then if you end up with a new custom version you like, ask Claude to turn that into a skill so you don't
- storyboard off for this one. Click copy prompt. Open a new chat in Claude. Paste and send it off. Hey, that's all finished. And you'll see the option on the right to load voice over. You can click that and select the file or just drag the voice over in. Then, it's all ready to

##### I Turned Claude Into a $880/Day Motion Graphics Skill (No After Effects) | Sanji Nai-Chien | 173687 views | 1195s | https://www.youtube.com/watch?v=D5qpBbEWTxo
- if you think you can just drop a prompt into Claude and get a masterpiece out of it right away, then you're dead wrong. It never works on the first try, but once you've set up the process, you can actually turn it into a custom skill. Which is to say, it'll become a permanent
- instruction set that Claude will follow every single time for this kind of work. After that, then you can generate everything you need from a single prompt. And by the way, I've attached my entire motion design skill in the blog post link below so that you can download it and use it on all
- is this. Nothing should ever fully stop. In the skill, I tell Claude to work the way that a motion designer works in After Effects. Group related elements under a parent, basically a null object, and move the whole group instead of every piece separately. Then, you want to offset the keyframes, so each element
- like a website and looks like a real launch video. And Claude does all of this in code, so you never have to set a single keyframe yourself. >> [music] >> And fourth, the tech specs. 1920 pixels wide, 1080 pixels high, 60 frames per second. Plus safe zones, so when you adapt the video
- breaking out what's on screen, how long it stays, and where the camera goes. The brand colors and fonts, the background images, and the UI straight from Figma, exported as SVG, not screenshots. Now, the part that matters, when the camera zooms into a button, an SVG stays razor sharp, and a screenshot turns into
- a blurry mess. Then, one prompt. Using the motion skill, build this storyboard as a 30-second launch video scene by scene. Claude starts writing. Every scene becomes its own block of code. The tasks pile up, the copy-paste grind, the agents kicking in, the payoff, and the logo. Then, the whole thing renders frame by
- frame into a video. So, I ended up dropping it all into Claude Opus 5.5, and right away, it broke. Just look at this. The text is overlapping, the camera pan is way too fast. Also, the whole layout just explodes off the canvas, the font at some points fell back to Times New Roman,
- once you know that cause, then the fix is just a single second. The layout exploded because the Figma screens were designed 1440 pixels wide, and the video we asked for is 1920. So, I need to tell Claude, "Lock the canvas to 1920 by 1080, and position everything relative to the center, not the
- straight from code. No timeline stretching, no missing plugins, and I didn't set a single keyframe by hand. Now, do you remember our first rule? Here's what happens without a storyboard. Same assets, same skill, same prompt. [music] Simply no storyboard. Claude will start guessing. >> [music] >> Scenes come in in a totally random

##### FREE Claude Prompt That Creates VOX Style Videos AUTOMATICALLY | Here's How | Jacksons AI | 281252 views | 1120s | https://www.youtube.com/watch?v=RaxX_Q7Apj0
- Now, there's this crazy new trend going viral, like crazy, that features Vox style animations. Those paper cut style visuals used to tell documentary stories and keep viewers hooked and glued to the screen. And they're pulling in some crazy numbers. So, I checked YouTube to see if anyone had covered how to make these
- how to create high-quality Vox style animations from scratch using 100% free AI tools. And simple enough that any beginner can follow along. I mean, check out this cool animation I made in like 5 minutes with this free strategy. >> May, 1925. Paris. A well-dressed man reads a newspaper story about the Eiffel Tower
- Claude, but you can still use Deep Seek or GPT. They both work the exact same way. So, I'm just going to choose Claude, head back to my master prompts, scroll down to the bottom, hit command plus A to highlight everything, then control plus C to copy it all. Once I've copied it, I'll
- head back to Claude, paste it in, and send it. Now, once you send it, Claude thinks for a bit and then asks you for the source PDF, which is basically the content engine we're going to use for this whole process. [music] To get the source PDF, just head back to the master prompts.
- I stored everything in there, and scroll down to the engine prompt. Click on that. Once you do, it takes you to an eight-page PDF on a Google Drive. Just click download to save it to your computer. Then, head back to Claude, drag it into the prompt box, and type engine attached. Once you
- that we've got our images, we can close the extension. Next, we need to animate these images by turning them into videos. For this, we're going to head back to Claude and type next. Once you do, Claude starts creating a very detailed universal video generation prompt. Now, the default is 10 seconds, but here's
- do is head back to Claude or whatever chatbot you're using and ask, "Could you change the duration to 5 seconds instead of 10?" Then send it. When you do, Claude gives you a new prompt. Of course, you can still use the 10-second prompt if you're planning to use a paid software, [music] but
- for the free users, I think 5 seconds works just fine. All you got to do is copy the entire video prompt. Once you've copied it, head over to Flow, click on the Nano Banana option, and switch from the image model to the video model. Then select one output. For the duration, select about
- plan to animate. Once you do that, select the image so [music] it's added to the prompt box. Then, paste in the prompt Claude gave you. In the duration section, reduce it to just 5 seconds and make sure the aspect ratio is the exact one you want. Set the resolution to 720p so you

##### How To Edit Talking Head Videos | The Editing Podcast | 191189 views | 1154s | https://www.youtube.com/watch?v=7hHyY2HhHf4
- videos people are drawn to variety you want to keep that element of surprise if it's making me laugh I just have to trust other people will also laugh Schultz the viewer's attention away refocuses their attention who doesn't love a cuddly little teddy bear [Music] recorded by the best video podcasting tool Riverside honestly
- if you're not using Riverside for all of your virtual meetings you're making a big mistake I've even been using it for consultations as soon as we're done I get to send them the entire recording and not to mention the recording quality is freaking it's good whereas other virtual meeting Services can only do
- up to 720 Riverside can do 4K which is why we like to use it for podcasting and we love it because it records each audio and video tracks separately so that editing is such a breeze when we get into post which means our editor can get started on cutting it almost immediately and
- even if you or your guest has absolute garbage internet it doesn't matter because remember that one time when we were in the hotel room I mean the call kept on jostling I thought we lost it but because Riverside records locally and then uploads the cult was perfect and it's easy for the guests
- riverside.fm for free and use code editing podcast for 20 off and you can find that link in the description and we'll see you back in the interview talking head genre is I think very underappreciated in terms of how to make these videos work on YouTube because I think part of the writing is
- font you know trying to give it like an 8-bit quality to it it kind of makes me feel like I'm playing a Tekken game choose your character and then with that implication really does add to that competitive nature of all of these rankings So today we're ranking fictional TV lawyers and we'll be
- doing that using several criteria so this screen I wanted to create just like a just a gameplay kind of thing with options just translating everything because he's a lawyer so lawyers have very specific skills so is this all one after effects comp yes it is I don't know what I wrote but occasionally
- know memes or quotes from the the shows that he's referencing you're even using to say the memes and quotes from the show to even respond to what Devin was saying yes the call in the response of it his law skills are extremely extremely lacking objection how much time does it take you to
- I will leave markers like notes for myself about like what I want to do with Motion Graphics once I get into After Effects you know Finding finding the articles that are linked in the script reading those articles and then trying to find the best caption that is easily understandable to anybody it's basically

##### How To Edit Documentaries like James Jani | The Editing Podcast | 173259 views | 1223s | https://www.youtube.com/watch?v=bwz-jLZz2w8
- directs his motion graphics team to generate some of the most polished visuals on YouTube. This is the editing podcast and its interview was recorded with Riverside, the all-in-one video podcasting tool. If you're new here, please subscribe. I'm very excited to introduce you to Sam Bankman Freed, the wealthiest person under 30 in the
- but there's a sense of something isn't quite right. Uh and I think I'm just naturally hooked to stories like that. Uh which is why I usually gravitate in that direction when I pick ideas. How do you make us feel that? Like cuz yeah, you can show us, hey, look how great Sam Beckman
- Freed is, but I don't trust him already. How did you make us feel that? with the context in mind that you're watching a video titled The Fake Genius. There's already a feeling of unease with that. I think in the hook of that video, there was a really important um sort of contrasting moment
- put their money into and that box will return back tenfold what you gave it, how could you not be tempted? From the years of 2020 to 2021, the world of cryptocurrencies had become that box for regular people. The puzzle pieces though, it was a really satisfying I would say retention moment of like
- to see what that was. And then you started building it back up in the retention editing language. That became my dopamine hit, you know, like oh, you know, oh, this is working. I I am now getting uh the signal of chapters of like getting that sense of progression. It's a very cheeky retention
- Riverside for your show and use the code editing podcast for 20% off. the countdown that then being another sense of progression, another sense of time of what of something for us to then look forward to towards that moment. Why was the countdown so important for you in this story? Yeah, the countdown thing
- in Premiere Pro is what I use. The timeline is literally just going to be a black screen that says insert motion graphics of whatever here. Once you've got a good sense of we know the music is right, we have a decent amount of footage um and archive footage that we we know we're
- that they literally only let 1% of the music submitted to them on their service. If it's not a bop, it's not a cop. If you know what I You know what I'm saying? They have any kind of genre, any kind of mood, and the producing quality is absolutely ridiculous. Like off the charts.
- realize uh amongst a lot of these conversations is that that last 30 to 20% of details, barely 100 people will really notice that detail. Yeah. And then but then that's where you then start breaking your mind on that detail that 99.9% of the audiences won't care about. And as you gain the audience

##### How to Edit VIRAL Instagram Talking Head Videos (NEW Style for 2025!) | Joseph | Video Editing | 404951 views | 1068s | https://www.youtube.com/watch?v=Qbntd8yud0o
- center cuz it looks really nice and in our graph editor let's smoothen out the whole animation and take a look at this there's Improvement but we can do better let's bring in a deep glow effect and change the radius to 700 and the exposure to 0.1 enable chromatic aberration and let's paste the
- same glow onto our other text that looks awesome one final touch we can add is we'll add an adjustment layer then bring the layer down so that it's only above our aoll then add a gajan blur and a brightness and contrast effect and a deep glow set the brightness to minus 100 and
- blur to 30 and glow exposure to 0.01 then bump up the chromatic aberration select our Circle mask draw this circle out and lastly click on invert and feather out the mask and we get this really clean and simple overlay great start now let's get to work on our graphic animations first we add
- frame the current transparency then move back and change it to zero this will make our icon fade in and do the same thing to all of them finally I'll add an adjustment layer and add a deep glow on top of it change the exposure to 0.1 then precompose it with the icon animations
- light sweep effect now let's add in our user icon from before and simply place it right here add a gradient ramp and change the start to White and the end to Green now let's also duplicate the adjustment layer with the glow and also precompose them again and this all looks great but let's
- get some really cool text effects on our captions and with that being said the intro is finally complete so let's stop it off with some Zoomin and zoom outs this will only take a second I add in an adjustment layer and add in the transform effect let's go to where my icon popup
- that that our scene is in advanced 3D now you're going to notice something our text just disappeared that's because our Advanced 3D renderer doesn't render out effects like blurs and glows so let's precompose it and change it to an advanced render all right perfect let's animate this big b first let's open up
- tripod in and place it inside my square like this then add an ing gradient place the start here and the end here and change the start color to Blue and the end color to white now let's add in an adjustment layer add a deep glow to it and precompose it with the icon
- start at 100% then move forward and drop it down to zero and finish it off with some Feathering too great so we have a bunch of graphic animations and a bunch of stuff happening on the screen now let's make this look good let's add in a deep glow to the circle here change

##### How to Edit a Viral Talking-Head Using ONLY AI (2026 Style) | Joseph | Video Editing | 229771 views | 987s | https://www.youtube.com/watch?v=WcMOCtas1pg
- studying this, Claude learned how to pick hooks, how to link clips together into valuable stories, and what to leave on the table. And once Claude was a master clipper, I asked it to save everything it learned into something called a skill. So that now, anytime I need clips cut, Claude pulls up the
- Submagic in your browser, click create project, click generate captions here, select the files from my computer, and add in the short that Claude just cut. Then, click this button. Submagic now listens through the clip and turns the audio into subtitles automatically. Once it's done, click the style button next to AI captions, and
- have high-quality captions in a matter of minutes. Then, just click export up here, and render the video with the captions on it. This checks off step two, and we now have a high-quality clip with amazing captions. Now, stay tuned because later in the video, we're going to create these amazing animations using Claude,
- with captions, let's move into step three, planning out our edit. Before I show you how Claude planned this edit, you first have to understand how a real editor plans a short-form video. The visuals on the screen do two very important things. First, they explain what the speaker is saying. When a viewer sees
- video, a focused scene with the lesson written out on the screen. This was mind-blowing. Claude didn't just decorate the video, it planned exactly like a high-level editor would, animations on the value and rest where the viewer needs it. Retention the whole way through. Again, if you guys want access to these skills, it's
- already has animation skills built into it. So Claude and Higgsfield speak the same language here. So now the process is that simple. I upload the mock-up of the scene, I tell Claude to use C-Dance 2.0, that's the AI video model inside of Higgsfield, to create a 5-second animation with sound effects, but no
- And finally, scene seven, a paper style animation introducing the pointing fingers while the character types in the middle of the screen and the text writes out which also looked amazing. And just like that every design became a high quality animation ready for the edit. So let's recap where we are. Claude extracted the
- clip, Sub Magic built the captions, Claude planned the edit, and Hicksfield designed and animated every scene. There's one thing left which is putting it all together and it's the easiest step of them all. Everything comes together inside of Premiere Pro. And if you've never used Premiere, don't worry this is literally just dragging
- in step one Claude cut out the clip. In step two Sub Magic created the captions. In step three Claude planned out the entire edit. In step four Hicksfield generated the branded designs. And in step five Hicksfield turned those designs into animations. And finally in step six we combined it all together in Premiere

##### How to Edit Viral Instagram Talking Head Videos (New Style 2026) | Joseph | Video Editing | 177690 views | 1037s | https://www.youtube.com/watch?v=HQvV75kjblY
- and add an adjustment layer and trim it here. Then add the transform effect to it, go to the beginning, keyframe the position here, and then move forward and move the scene over to here to where our new text is, like so. In our speed graph, just make sure that the movement spikes the
- about earlier that makes this animation special. Head over to Envato and search for a silk texture, and I downloaded this pack and imported a silk texture into After Effects. Then, I scaled it up and I placed it right above my background there. And just like that, our animation looks absolutely stunning. So, let's
- more depth to our scene. And now, to create the zoom out that brings this whole thing to life, add an adjustment layer and add the transform effect to it, and then add the CC lens effect. Set the size to 100 and the conversions to 25. Keyframe the conversions at the beginning at 25,
- built, it's time to create our out of screen zoom out and cinematic b-roll sequence. Let me show you in just 2 minutes how we built it. First, let's start with our text. Duplicate the white text we've been using and write the words timing off. Then duplicate the special text, write the word food
- screen zoom out? Let me show you. First, let's right click and add a white solid, but make sure to add it under your main video layer. Then right click and add a adjustment layer and place it on top of all of your layers. Then add the transform effect and to create a zoom
- layers we created for the other b-roll, duplicate both texts over to the second bureau, and change the words to have your final meal at 6:00 p.m. And there we go. That is how you create an awesome out of screen zoom out effect with cinematic bureau. Now that our hook, our dynamic heart, and
- animation. The last thing you need to do is add some depth with some textures and movement. So first, I add in a halftone texture and place it like this. Then I add an adjustment layer and add the transform effect. Keyframe the position, move it forward, and start the animation off the screen to
- created our hook animation, our dynamic heart animation, the out-of-screen zoom out, and an interactive image animation, we've officially finished all the animations for the video, which means there's one final step, and it's to bring all these animations to life using our viral sound design workflow. So, let's get into it. Now, real quick,
- sound effect after he says screens off to really help the viewer feel what he just said. All right, now we get into our interactive image animation. So, to finish it up, here's how we sound design it. Start with a riser, whoosh to transition into the animation, then add clicks for the text that

##### How to make Shorts like Ali Abdaal // In-depth tutorial | Validation | 562139 views | 1717s | https://www.youtube.com/watch?v=ZAuKQRfWGQ0
- the effects so let's start by modeling this intro scene here which looks awesome so there's a couple of things going on here first we have a paper tear cutting off the top half of the screen we have Ali rotored out so you can see the top of his head after that paper tear
- clip we have a paper background that's new moving around with some texture overlaid on top of that we have some text animation a cool little highlighter effect and then some graphics as well when we break this down there's a lot going on here but considering this is the hook of the video and
- your footage which is going to be a recurring effect that we use throughout this shorts creation process now you could use an AI tool like runaway green screen to do this but I think the easiest way because I'm already going to be working in After Effects is to just use the Roto brush
- now we're going to use the Roto brush tool so first duplicate the clip that you're going to be working on by pressing Ctrl D now go to the top of After Effects and click on this little icon which is the rotobrush tool double click on your footage and this is going to open
- them and drag them closer to the front one and because we have that toggle hold keyframe we can now drag out the end of the clip as long as we need it now if I turn back on my rotoscoped layer you can see that the tear cuts across the screen and my head
- which we're going to use over and over again so let me show you how to make one of these from scratch create a new composition with the same layout settings as your main composition but this time make the duration of it longer let's say like 30 seconds go find a paper texture online
- or take a photo of yourself and drag it into after effects to match the halo effect short I found this folded paper texture from texture labs and I drag that into my composition and into the timeline next to turn it from a white piece of paper into a black piece of paper you
- rotate this paper background once per second by 0.5 degrees and so we're going to do the same thing with position pull up the property I'll click on the stopwatch icon and type in wiggle bracket one for one per second comma and then 50 this time because I wanted to move around by 50
- effect highlight all of these keyframes and select toggle hold keyframe so now each time those keyframes play the graphic is going to jump to that new rotation value now to make this animation play out for the duration of the clip alt click on the stopwatch icon and again use the loop out expression

##### Why every Johnny Harris video goes viral | David Mora | 858376 views | 347s | https://www.youtube.com/watch?v=dIKsEhX-vyU
- this airport this texas army this is look at this look at things how does one person create videos explaining everything from mcdonald's ice cream machines to venezuela's border crisis and get millions of views on every single one i mean johnny harris even got nominated for an emmy which is like okay it isn't
- that johnny harris is an expert in these topics it isn't his fancy animations other people do that and never go viral so what is it johnny it's my formula the formula visual evidence then context and while these two pieces seem simple to use their viral power comes from johnny weaving them together in
- a way that no one else is even attempting to here's proof step one look at johnny harris's venezuelan border crisis explainer millions of people have fled venezuela step two compare it to this pbs explainer of the same topic millions of venezuelans have fled step three label every section as providing either visual evidence
- or context step four attach a musical note to every contact section and a new note to each new piece of visual evidence step five listen to them in order for the pbs piece you can hear long droning sections of context and only sparse visual evidence but in johnny's video listen to how the
- opening section is jammed with varied repeating visual evidence context sections are short and pulsed rhythmically between sections of visual evidence you just experienced johnny harris's explanation secret sauce visual evidence then context visual evidence then context or from the audience's perspective experience it understand it experience understand it this repeating two-part structure is how
- he gets millions of views but it's something that anyone can do here's how number one i experience it visual anchors look at the first three minutes of the video and you'll see these visual anchors visual anchors also known as visual evidence are things that you can point your camera out that exists in
- are what we traditionally think of as explaining but they're a minority of the video and as a rule always come after visual anchors anchor bridge anchor bridge is my formula and here's why his formula works visual anchors zoom in to let us experience the topic bridges zoom out to fill in the context
- look at how johnny harris zooms in to show us visual evidence of economic crisis then zooms out to answer our curiosity of how that crisis happened before zooming back in to show us visual evidence of the resulting mass migration in school we're taught to explain using context than evidence but anchor bridge is
- for context that bridges us directly to the next piece of visual evidence and how like a character in a story visual anchors repeat again and again it shows johnny harris's skill but it also reveals a deeper truth for anyone seeking to convey knowledge that good explanation doesn't start up in our head but

##### How To Edit A Documentary Like Johnny Harris in CapCut | Matt Loui | 164451 views | 931s | https://www.youtube.com/watch?v=42ukI3kJpXY
- Effects, DaVinci, or Premiere Pro, and that's just not true. So, here are five simple editing secrets to instantly level up your edits and help you make more cinematic, story-driven edits just like his. So, let's start with one of the biggest problems us editors face. Boring photos. You drag your photo onto your timeline
- screen. Then, make sure that the scale is 105%. We can then go to the very beginning of our timeline and add a transform keyframe. Then, using the arrow key on your keyboard, toggle five frames forward. You can see how many frames you've toggled forward right here. Let's go ahead and add another transform
- change the position while selected on that keyframe and you'll see that we now zoom in to the right. I'm sure you've heard about Opus Clip. It takes a long-form video and generates amazing short-form videos from it. They've just launched some brand new features that turn it more into a growth engine and all-in-one
- can remove filler words, pauses, you can add speech enhancement, you can also auto add AI B-roll or stock B-roll to your short-form video, emojis, and so much more. For the growth engine part, you can then take all of those short-form videos that it's created and schedule them to auto upload on a given
- date and time. So, Opus Clip takes a ton of that manual work that you'd be doing like the editing, the captions, the B-roll, the uploading to YouTube, and it automates it. So, if you'd like to try Opus Clip, which I recommend you do, you get a free sign-up, which is incredible. No obligations,
- free sign-up. But, if you decide that you love it, it fits in your workflow, and you'd like to pay for it, do it this month because it's Cyber Month, and they're offering 50% off your first month or 65% off when you move to an annual Pro Plan. Back to the video. So, that's
- change the blend mode of that texture to one of three things: hard light, overlay, or soft light. Now, all of these subtly change the way that that texture interacts with our photo, and I find using one of these three generally works best. For this case, I like the effect that hard light gives.
- size Egypt exactly the same as you did for this. A secret tip is to have each layer or each clip get sequentially shorter. So, our first clip is 21 frames. If I zoom in here, our second clip is 15 frames, then 10 frames, and you get the point. Simply by trimming off a
- and place that wherever we have a new image pop up. On all of your text, go ahead and drag a texture, go ahead and scale that over your whole image, and change its blend mode to either multiply or overlay. In this case, multiply works a lot better, and you can see that our

##### How To Make Vox Style Videos - After Effects Tutorial | Mapal | 378916 views | 1329s | https://www.youtube.com/watch?v=F7A503llNBA
- animate a little outline and then some text so I'm going to zoom in a little bit so I can see what I'm doing I'm going to grab the pen tool and I'm going to set the stroke to White that works and let's set the pixels to or the width to three so I'm
- this slightly off green color here just to match the style a little bit more make it feel like it's a part of it and then lastly I want to add a a little circle highlighting an area here so I'm going to draw a circle and then I'm just going to remove the stroke
- contents and then add a trim offs open up the trim offs go forward to about one and a half seconds and keyframe the end and go to the beginning and set that to zero so now if we play that back you have an outline animation it's a bit far so I'm just going
- to go ahead to about two seconds and remove that keyframe and then add some easing to it you can play with the easing however you like but for now for this tutorial I'm just going to use some presets next up we have the text and for this layer I want to animate the
- impact so now we have that now it looks a bit weird with just textures coming in like that so what I'm going to do is I'm going to add a rectangle and I'm just going to go forward so I can see where the text is going to be and then I'm just going
- tablet displace and set that to eight and eight and then open the evolution options and we'll click the random seed and add a time times five just to add a little bit more texture to it and I'm also going to add a transform and or click the position at a posterous time and
- wiggle just a slight wiggle so it just adds a little bit more movement to it so it's not so static and the outline I'm going to add a tablet displays as well well that was all caps I'm going to set the amount to 40 and the size to 2 so we get some
- going to move the keyframes for the text I'm going to move it a bit earlier and the same with the text now that's pretty much all we're going to do for the map animation itself what you can do for some more stylistic choices is you can add a glow to the outline I'm
- just going to use deep glow in this example because it's so much better than a regular glow I highly recommend it and then change the opacity or the blending mode to Overlay anyways let's hop back into our main composition so now one thing we're going to do is I'm going to decrease the

##### How To Make Map Animation Like Netflix Documentaries in After Effects (NO PLUGINS) | AEffecto | 262621 views | 4432s | https://www.youtube.com/watch?v=JRCCTbBR2tI
- near the displacement map, select our fractal noise pre-comp. These vertical and horizontal displacement sliders will help us to control our glitch effect. Okay, so let's set max horizontal to six and max vertical to seven. Move adjustment layer to 21 frames and cut [music] it at one second 16 frames. Awesome. Now, duplicate it,
- timeline to 6 seconds [music] 0 frames and decrease scale to 0. Awesome. Now let's work with lines. Select every line you want. I will select Jordan line. Open this layer and click on edge trim path. Go to 7 seconds 1 frame and create an end key frame. At 6:19 decrease it to 0.
- icon to hide them also because we don't need them for now. >> [music] >> Our next task is to highlight Iran country by creating orange glowing stroke. And as long as we don't use GeoLayers plugin, the only way to highlight the country is manually by drawing the stroke. So go to 0 frames
- [music] the stroke by trim path. Create end key frame at 6 seconds 14 frames, decrease it [music] to 0. Go to 8 seconds 5 frames and increase it to 100. And also animate opacity of fill layer from 0 to 20% sticking [music] to the same timing. It looks even better than I expected.
- it shake. Apply wiggle position preset on it. Change wiggle speed to three, wiggle amount to 100. Create wiggle amount key frame at 8 seconds 19 frame. At 8 seconds 10 frames decrease amount to 0. Go to 9 seconds 4 frames and create another key frame with 100 wiggle. And at 9:17 decrease amount
- change scale to 4.5% and Z position to minus 290. Move it out of screen to the bottom left corner and rotate. At 6 seconds 7 frames, create a position keyframe. At 7 seconds 10 frames, move to opposite side out of screen. Enable motion blur on these two layers. Also, go to the main
- duplicate shake that we have used for aircraft. It should start at 7 seconds 9 frames. Move the last keyframe to 9 seconds >> [music] >> 2 frames to make our shake longer. And also from 715 to 812, decrease red residence outline layer from 50 opacity to zero. Select these keys, [music] press F9.
- Ali Khamenei layer to 8 seconds 12 frames. Second pair should end at 8 seconds 28 frames. Also, copy our displacement adjustment, move it to 812. It should end at 9 seconds 9 frames. Finally, apply tint effect on Ali image. At 812, lower amount to tint to zero. >> [music] >> Create a keyframe.
- this mask that covers all the comp. Invert it. Open this mask here and keyframe mask path at 25 seconds 15 frames. Go to 26 seconds 14 frames and move this mask to the left out of screen. Select keys, press F9, [music] create this speed graph with a slight peak on the left. Create

##### 3 Conceptual Title Minimalism Techniques in After Effects | SonduckFilm | 247805 views | 624s | https://www.youtube.com/watch?v=wdrKpsZDsQo
- this font um but go ahead and type out your first title and when you have that in here what we're going to do is open title layer go to animate and we're going to add a tracking to this and what we're going to do is we're going to increase the tracking from here
- so i'll increase the tracking amount up to maybe like 80. so what i'm going to do is move forward my timeline to maybe 12 frames i'm going to add a keyframe for tracking amount and i'm going to move forward to about two seconds and i'm going to increase the tracking amount to about
- 130. okay then what we're going to do is we're going to select our keyframes hit f9 on keyboard make them easy ease keyframes and then we'll move just a little bit past four seconds and we'll set our tracking amount back to what the first keyframe was which was 80. so we're just going
- to have this very lame tracking animation but we're going to spice this up real quick we'll come here to the graph editor and you'll go ahead and select tracking amount and we're going to select all of our keyframes and i'm under the speed graph and what we're going to do is we're just
- keyframes and right at the tracking amount that first keyframe there was we'll just bring in the endpoint of all these layers so you know they'll just be hidden and we'll see the first word like so now all we want to do is select say the top title layer here and we can also
- a little bit and one last thing that we'll do is we'll grab all the tracking amounts here and we'll just offset them you know in time by a little bit so now our title animation will expand upward and now outward and then it'll come back in just like that so that is a
- typography and vertical video templates right here for after effects so this is our 150 motion graphic extension right here for after effects we call it's pack pulse because we have these really cool designer you know full screen motion graphics for you know typography instagram stories cool animated backgrounds lower thirds and even long
- is take our echo layer here and i'm just going to move it forward in our timeline so we'll already have those up there and i'll go ahead and create an adjustment layer layer new adjustment layer and then i'll go to effect stylize and grab cc vignette this will kind of darken out the
- this move that keyframe forward by a little bit to like about a half a second and we'll bring down the y value here we'll go back to our title stack expand downward here and that should be fine make the last keyframe an easy ease keyframe by f9 you go to graph editor and

##### Put Text BEHIND an Object - DaVinci Resolve | Daniel Batal | 1699921 views | 138s | https://www.youtube.com/watch?v=LLodyQbxWsQ
- Da Vinci resolve for noobs let me show you how to put text behind an image in Da Vinci resolve in both the paid version and the free version now I've got this piece of footage of a sailboat just sailing across the water and let's say I want to put text up into that
- sky behind the sailboat itself I'm going to put my playhead at the beginning of that piece of footage I'm going to hit alt on my computer left click and drag upwards to create a copy of that now for the moment I'm going to disable the track on the bottom and I'm going to
- go over to the color page now you'll only see the clip that I want to mask the first thing I need to do is right click up in the gray area of the node graft and add an alpha output see that little blue dot let's connect the Blue Dot from your color node
- to that Alpha output that'll allow for transparency once I add a mask now I'm going to grab the magic mask option right here I'm going to take my cursor left click and hold in my preview window and just draw a rough mask around the water in the sailboat and you'll immediately see that
- that'll be masked out now to track this mask I'm going to hit the forward and backward Arrow option and it'll track that magic mask across your footage now if you're using the free version you won't have the magic mask option so we're going to create a manual mask and track it and this
- is what we refer to as rotoscoping let's swap over to the power window section and go down to this pen tool that will allow us to create a manual custom mask we just need a mask around this sale itself so let's just carefully left click and draw a mask around this sale itself
- what happens below the waterline doesn't matter that much so this can be rougher let's just make sure we connect to the original point so we have a complete complete mask you can slightly edit any of these points or add another one if some of this isn't exactly the way you need it to
- be and once that's drawn you're going to swap over to the tracker now hit the back and forth Arrow buttons and it will track that mask that you've created back and forth in your footage now no matter which way you've created this mask go back to your edit page and then back on
- change the font increase the size of that let me relocate on screen a little bit and how about I add a little bit of crop to the bottom and soften that just slightly now it looks like that sailboat is moving across the water and the text is behind it

##### CAPTIONS like Alex Hormozi for free in CapCut | Kate Telek | Smartphone Videography | 60170 views | 84s | https://www.youtube.com/watch?v=LWWAajjx-aw
- Alex Hermosa is famous for his style of captions and I'll show you how to create them for free to start tap on your video text Auto captions this is the base I like to change the font from the default to all caps like Alex you can select the one you like from the
- library or import your own I'm using bold I then go to presets basic select the closest one to his style and increase the shadow Alex usually has shorter captions so let's split this one by half after the word famous now I just need to delete the words after famous on the first half
- and before famous on the second half I then wanted to have two lines instead of one so I press enter before is and make it a bit bigger from here Alex often just changes the color one or two words and even make them bigger or he makes it so that the lines get
- bigger and change the color when he reads it for that make another split tap on the first part select the first line and change its color and size Alex usually uses yellow or green then tap on the second half and do the same thing for the bottom line so now when you read
- it gets bigger accordingly I notice Alex also uses emojis so you can add them as well using text lastly he often animates his Stacks so tap on your text animation and select the one you like and don't forget to give me follow if you want to create more engaging content for social media

##### How to Create Smooth Style Captions in CapCut in 2025 | Matt Loui | 720855 views | 354s | https://www.youtube.com/watch?v=YddyvmAFxnY
- [Music] This is the minimal, stylish caption style you've been seeing everywhere. It's also the caption style that got me over 130% retention rate on a YouTube short. I believe this is art and I'm going to be showing you how to create it in Caput. Obviously, it all starts with the font. Different fonts
- communicate different emotions and there's a reason that professional documents aren't written in comic sands. That's because your font speaks before your actual message does. If your font is too hard to read, well, people will just simply stop trying. The reality is that simplicity isn't boring. It's effective. For this style, choose something clean,
- something minimal, something sexy. Some suggestions for different fonts. And in this case, I used Interbold, but there's Monserat, Poppins, Ariel, Helvetica, and a font called Hando. All of these look very similar, but will get you that desired professional, very clean look. Now that you've got your font, let's jump into Capka and get
- animating. The first thing I do with my video on my timeline is I click on my video, go to text, and generate auto captions. We're not actually going to be using the auto captions as captions, but they help make it easy to remember what's being said. Now, it's time to design our first
- word. Go to add text, and let's create a default text layer. From here, I can go ahead and select my font. I'm going to select enter bold and let's type in our first word which is the I'm then going to select the uppercase option which is going to turn our word into uppercase
- captions and I want it to end after I say thing about c. I'm going to move my playhead to that point and drag my text layer to end over there. Now go to the beginning of your timeline. Scroll down a bit and create a transform key frame and a blend key frame. I'm
- to the first one. Again, >> you'll see that we have a super smooth slide up animation now. And just like that, you've done 90% of the work to get this caption style animations. Now, it's about layering your text and finding those secret elements that add some dynamism. What I'm going to do is
- clip to manipulate the size of that text. Different size words obviously going to stand out more than others. That means you can emphasize certain words that you say just by having them bigger. For special words like beautiful, maybe add some glow, change the color of the word, and change the font. This is
- really going to help it stand out. And remember, the most beautiful thing about captions is not that they're only incredible for accessibility purposes, but that they can be your expression of art. And good art attracts good people.

##### How I Edit Documentary Video LIKE Johnny Harris in Capcut (Part 1) | byl | 891816 views | 685s | https://www.youtube.com/watch?v=IjMVme1aDWg
- Johnny Harris is one of the most recognizable documentary storytellers on YouTube his videos are packed with stunning visuals Dynamic animations and a signature editing style that keeps viewers hooked from start to finish the way he Blends Motion Graphics maps and cinematic effects makes his documentaries feel both engaging and high quality it is
- and consists of 18 Clips it features various elements such as map animations textured overlays Transitions and well-placed text design that enhance the storytelling we'll go step by step on how you can recreate it using cap cut so if you want to take your editing skills to the next level and learn how to
- editing in the community chat you can join my patreon the link in the description now let's get jump to the first clip in this first clip we're going to create a text animation like this first add a text layer to the timeline then type in the text you want for the font I'm
- using cap Cut's default font called intellect to typewriter after that go to animation choose the Retro typer animation as the inanimation and set the duration to 3 seconds next move forward to 1 second before the last frame then press Ctrl plus b to split the text layer go back 1 second and add
- a key frame on [Music] transform now move forward to the last frame of this layer and slightly reduce the scale to create a zoom out [Music] effect now select the split text layer and increase its scale like this after that compound both text layers here I'll add a film dust overlay for the
- level I'll also insert a memo cutout between them [Music] [Music] next I'll add some effects the first effect is called [Music] 90s and here are the settings also I'll add an adjustment layer only modify the whites to minus 34 now select all layers and clip two then compound them after that I just
- need to speed it up by going to the speed settings and setting it to 10x speed the result looks like this now I'll create a transition to smooth out the cut first I'll insert this film roll overlay then position and trim it exactly at the cut between these two clips change the blending
- and compound the again now I'm going to make a zoom out effect at the first second using key frames now press alt and K and change the key frames curves to ease to smooth the [Music] motion lastly I'll copypaste the adjustment layer from before and place it on this clip and the result
- remove it first compound delay layer then simply trim the fade duration now that it's like this I will add a line animation using a line asset that I created in photopia then change the blend mode to [Music] multiply now let's animate it using masking go to mask then select split rotate the mask

##### How I'd Create Content in 2026 (If I Had To Start Over) | Ali Abdaal | 368783 views | 955s | https://www.youtube.com/watch?v=A8PxRHQrLJ8
- say. But, if you are trying to do content as you're either trying to make money from it or you're trying to drive leads to an existing business or anything like that, then your approach to content needs to be more strategic than someone who's just doing it as a hobby. So, assuming that you
- for example, what you can imitate is the hook and the format. If a piece of content was an outlier, the hook must have been really good because if the first one or two lines are not good, no one's even going to click read more on the content, and so they're not going to
- engage with the content. If there's an outlier on Instagram or TikTok as a as a reel, you know that the first five seconds of that video must be good. Even if you want to use that hook word for word, you could totally use the hook, like the first line of the reel. Now,
- and so I think 80/20 is a good level of imitation versus innovation to strive for as you're building your sort of content engine. Now, if you're watching this and you happen to be an entrepreneur or a creator, then you're going to want to check out ManyChat, who are very kindly sponsoring this video.
- you know that you can use social media to drive leads to your business and make money. And ManyChat makes that process way more seamless and way more automated than you just having to do it manually yourself. So, if you would like to grow your audience, connect with them meaningfully, and also potentially monetize
- to decades is also a really important part of this. So, it's all it's all like a balancing act. Sometimes doing stuff that is under-optimized for the sake of you enjoying the process a little bit more is 100% a worthwhile trade to make. I have a lot of kind of big big YouTuber friends,
- that talks about the strategy, the skills, and the systems you need to succeed on YouTube. Another big tip I would say, and a a mistake I see my Lifestyle Business Academy students make all the time, is overusing AI. When you suck at doing content, i.e., you're a beginner, the temptation is there to
- just put stuff into ChatGPT and get ChatGPT to generate your content. You haven't yet developed the skill of actually doing the content or the taste for what makes good content. And so, you just outsourcing it to AI means the AI is doing the work, and increasingly people are getting very good, especially with
- manually is a better way of building up the skill than using AI for your stuff. Another big thing around content is over time you inoculate yourself against feeling cringe. So at the start, everyone feels cringe with the content that they post because we all fear social disapproval. We're all worried about what what
## Appendix B — Raw Evidence: Reddit Threads and Comments (via Apify)

> Posts and top technical comments from r/MotionDesign, r/AfterEffects, r/editors, r/VideoEditing.

## r/MotionDesign | Why does AI lie? (After Effects, Illustrator, Photoshop) | https://www.reddit.com/r/MotionDesign/comments/1wtmjfv/why_does_ai_lie_after_effects_illustrator/ ::  submitted by /u/Wells_Fuego [link] [comments]
  - nDesign/comments/1wtmjfv/why_does_ai_lie_after_effects_illustrator/pcw5uuk/ :: great video! like the motion! and smooth transition/parallaxes, and anticipations! I have a question about the audio that would be of great to me now that am doing similiar videos: how did you choose the background music? at which stages you chose the music? before or after recording the vocal script? before or after doing the visual animation? how did you choose the volume balance between voice track and background music? Thanks!
  - nDesign/comments/1wtmjfv/why_does_ai_lie_after_effects_illustrator/pcxbigt/ :: Great video, the only criticism I can offer is that it sounded like AI only "predicts the next likely word" when it doesnt know the the answer or the question is difficult, and as far as I understand AI does this for every question no matter what. It can't "know" anything because it doesnt think.
  - nDesign/comments/1wtmjfv/why_does_ai_lie_after_effects_illustrator/pd02oaf/ :: Predicting the next word was a simple metaphor to help people understand how it works and that was only the first models. People like to repeat that statement because it makes AI sound more stupid than them. Keyboards used to predict words just by matching letters in common words and phrases. AI matches words by their meaning. The term has become absolutely meaningless now that keyboards are predicting the next word with AI. AI has a vector matrix of words and terms (tokens) that are placed near each other by their actual meaning. It's nothing like what next word prediction of the past was. Cu

## r/MotionDesign | Can we ban AI Motion Design Slop? | https://www.reddit.com/r/MotionDesign/comments/1x044lx/can_we_ban_ai_motion_design_slop/ :: I’m not talking about “oh I used this part for inspiration”. I’m talking about the blatant trash that people pass off as “I made this using After effects”. It looks like trash and real motion designers are tired of this amateurness being poured in here. submitted by /u/Euphoric-Practice-83 [link] [comments]
  - m/r/MotionDesign/comments/1x044lx/can_we_ban_ai_motion_design_slop/pehetol/ :: For real. There’s no fixing anything that touches the internet going forward but there’s a whole real world out there that needs to get reconnected with
  - m/r/MotionDesign/comments/1x044lx/can_we_ban_ai_motion_design_slop/pemrtzq/ :: Not deep at all. You're trying to rationalize being okay with a world where everything is generated for consumption, and humans are diluted into obscurity.

## r/MotionDesign | What's it's actually like to use Higgsfield's Vibe Motion | https://www.reddit.com/r/MotionDesign/comments/1rmltp7/whats_its_actually_like_to_use_higgsfields_vibe/ :: Higgsfield AI has reached out to me twice to promote their Vibe Motion tool. I ignored the emails and created my own paid account, used the exact prompts from their own video, and this is what happened. submitted by /u/jakeinmotion [link] [comments]
  - n/comments/1rmltp7/whats_its_actually_like_to_use_higgsfields_vibe/o9218so/ :: It's the new business model for most of these AI companies. Give some creators early access when the model's in it's best state, the creators come out hyping its capabilities, then they nerf the model on open access. People who've seen the hype and ads then think, "maybe I'm prompting wrong, lemme try again" and in doing so buy and burn more credits.
  - n/comments/1rmltp7/whats_its_actually_like_to_use_higgsfields_vibe/o9389t2/ :: Wow. My previous connect was deleted by reddit. Haha.. Well if they are thinking to replace us, then it will be curse for them. Creative comes from brain to hand, not from prompt.

## r/MotionDesign | Looking to recreate this vox intro | https://www.reddit.com/r/MotionDesign/comments/1vspixn/looking_to_recreate_this_vox_intro/ :: Hello everyone, A beginner here. I am looking to create this intro from a Vox series called AI explained. Watching this, It appears to me that some cc griddler has been used but I could be wrong. Can you guys help me figure this out? Even a tutorial on youtube would be super helpful. Thanks submitted by /u/searchpulse [link] [comments]
  - r/MotionDesign/comments/1vspixn/looking_to_recreate_this_vox_intro/p4nh81z/ :: Vox has an absolutely massive team of seasoned pros, there's no single plug-in that is going to accomplish this simply. This was likely the assignment of one or more animators for at least a week straight to get a first version.
  - r/MotionDesign/comments/1vspixn/looking_to_recreate_this_vox_intro/p4n3sqw/ :: The grid thing at the beginning could likely be cavalry, or in AE, some type of single comp repeated over the frame with the switching animation, then using time displacement with a blocky/mosaic gradient to drive it? Something like this - https://www.youtube.com/watch?v=UJ7jWZ7QvZo but with a bit more tweaking. I think you could get most of the way there. I'm not advanced enough to know how to do this exactly but that's where i'd start! EDIT: I linked the wrong tutorial :) Try this for the random text scramble: https://www.youtube.com/watch?v=2T_4ndZ6Nr8 Falling text blocks could be animated 
  - r/MotionDesign/comments/1vspixn/looking_to_recreate_this_vox_intro/p4mxjo3/ :: Thank you so much for your response. The part in the beginning, as symbols and grids move toward the right. And then when the eyes appear. I have even analysed it frame by frame, but still could not get how random it was
  - r/MotionDesign/comments/1vspixn/looking_to_recreate_this_vox_intro/p4nncsx/ :: Vox overwhelmingly uses AE, especially for anything living in this context. Occasionally a freelancer will use another program for 3D, but 2D largely stays in AE. Source: used to do motion design at Vox.

## r/MotionDesign | I am so sick of everyone shoving AI video editing and motion graphics down our throats | https://www.reddit.com/r/MotionDesign/comments/1vlgo43/i_am_so_sick_of_everyone_shoving_ai_video_editing/ :: I feel like I’m losing my mind every time I open YouTube, X, or Reddit lately. Every single day it’s the exact same post: "Why After Effects is officially DEAD" or "How I generated a full video and 3D motion graphics sequence in 20 seconds using Claude and Higgsfield!" And then you watch the actual video and it looks like total garbage. The pacing feels like a robot cut it because it literally did
  - comments/1vlgo43/i_am_so_sick_of_everyone_shoving_ai_video_editing/p318hpa/ :: Just a quick reminder that many of these AI companies are currently blitzing UGC creators with very high paying (yet aggressive) marketing contracts - thats why you see a disproportionate reference to the same two or three platforms. You can head over to some of the UGC subs and they are talking about it. Dont get fooled by the marketing, the sky isnt falling.
  - comments/1vlgo43/i_am_so_sick_of_everyone_shoving_ai_video_editing/p31a034/ :: When a company spends more on sponsoring TikTok creators than they do on actual software development, you know the product can't stand on its own feet.
  - comments/1vlgo43/i_am_so_sick_of_everyone_shoving_ai_video_editing/p318g3h/ :: There are so many people in charge that think it looks just fine and they see one less person they have to hire. They don’t see the same things we see in it.
  - comments/1vlgo43/i_am_so_sick_of_everyone_shoving_ai_video_editing/p319q1u/ :: Exactly. That’s the real tragedy: the people holding the budget are completely tone-deaf to quality. They’d rather save a dime on a broken render than pay for actual craft.

## r/MotionDesign | For anyone considering using Higgsfield AI | https://www.reddit.com/r/MotionDesign/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/ :: just posted and deleted on twitter. we all know its coming but dont support them please! submitted by /u/Fantastic-King-5709 [link] [comments]
  - Design/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/o3k3xiu/ :: I love that is all pretty much trash though, and easy to do in actual software. So, ask yourself would you rather use AI and beat your head against a wall or build it in AE? I can’t imagine prompting a whole video. It sounds miserable.
  - Design/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/o3k89uk/ :: I don’t even understand what the goal is, I’m not sure it makes motion design any easier. But I do envision a scenario where some fine marketing folks use it and think it’s great. Just wasting time making junk.
  - Design/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/o3ka0wq/ :: They’re building a product that they can sell to some massive corporation, the founders will exit with a ton of money, a few things will get rolled into existing products, and you’ll never hear about it again.
  - Design/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/o3pvhnz/ :: as long as they get some little blip in their metrics, their job is justified. Let them have tools to make their bullshit without me. I am not in competition with people who have no fucking clue about design.
  - Design/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/o3ki2ck/ :: Im against AI, but some people just want easy off the shelf solutions in the same way you want food from McDonalds. They don't really care about the quality as much as they care about a cheap product being made.
  - Design/comments/1qvtesv/for_anyone_considering_using_higgsfield_ai/o6usil1/ :: Exactly! Even in development they are starting to notice it too, had about the Godot engine they are starting to face problems like that as well from contributors.

## r/MotionDesign | Recent project I did for AI based firm | https://www.reddit.com/r/MotionDesign/comments/1rff2vm/recent_project_i_did_for_ai_based_firm/ :: I have not done sfx on this and voiceover was given by them I just showed my animation and design skills here!!! I would have love to add music and sfx but client wanted plane on this project . I would love to to know what do you think of this project submitted by /u/piyushr21 [link] [comments]
  - tionDesign/comments/1rff2vm/recent_project_i_did_for_ai_based_firm/o7jjge8/ :: Very nice! The motion flows together well. The one thing I would say is the gold lighting and bloom vfx look to be a bit overdone, especially the light shimmer at the top edge. I think it takes the focus away from the nice animations you have going on. A few pops of lighting bloom here and there look nice if they're used sparingly, but it can get tiring if its used everywhere.
  - tionDesign/comments/1rff2vm/recent_project_i_did_for_ai_based_firm/o7joc82/ :: Really nice animation - but as you mentioned, awful AI voice over and music selection it's like Temu Base44 - swapping out the music would make a huge difference.

## r/MotionDesign | We built a motion graphics tool around gestures instead of keyframes | https://www.reddit.com/r/MotionDesign/comments/1wnnz34/we_built_a_motion_graphics_tool_around_gestures/ :: This is not an “AI motion designer” or “An After Effects replacement” where it just simplifies everything by adding some fancy random effects and calling it a professional video. We want to make intentional motion easier, the little details that AI tools don't do and so you are stuck with doing them manually on After Effects. Specifically, for this release, we are focusing on: Easier match-cuts: y
  - n/comments/1wnnz34/we_built_a_motion_graphics_tool_around_gestures/pbie3ve/ :: thanks guys! We are focusing on Apple platforms now, but Android will come down the road. Stay tuned on our YouTube channel and our discord! I'll share all updates there.

## r/MotionDesign | Made one of those saas ads for fun | https://www.reddit.com/r/MotionDesign/comments/1ukqntx/made_one_of_those_saas_ads_for_fun/ :: Honestly pretty fulfilling to make, everything just comes together nicely. A lot of other ai saas ads just look like carbon copies of each other, so I tried to be as unique as possible while still being an “ad” All in davinci resolve submitted by /u/UltFireSword [link] [comments]

## r/MotionDesign | TheMotionDot reel, UI and animation experiments | https://www.reddit.com/r/MotionDesign/comments/1sx3jx6/themotiondot_reel_ui_and_animation_experiments/ :: Wanted to share our latest reel, a collection of recent projects our small team has been working on over the past months. A big focus has been on UI/UX motion, product visualization, dashboard interactions, smoother transitions, and combining clean interface design with stronger storytelling through animation.We’ve also been exploring more hybrid workflows between design systems, prototyping, and 
  - gn/comments/1sx3jx6/themotiondot_reel_ui_and_animation_experiments/ojw1icw/ :: Beautiful work. Wow. So clean and crisp. Did you use composting with AE? Like like using the redshift object tag or Redshift AOV in C4d and adding effects to the elements in in AE?
  - gn/comments/1sx3jx6/themotiondot_reel_ui_and_animation_experiments/oik8txc/ :: Fantastic work! Are you guys doing any Rive, etc or sticking to AE? Also maybe saw some interactive 3D in there? If so, what are you using for interactive UIs?
  - gn/comments/1sx3jx6/themotiondot_reel_ui_and_animation_experiments/oikak8d/ :: We test lot of tool, try to implement AI where it is possible and not affecting the quality, but in final - still mostly use AE, Cinema. The whole UI are done by us and then selected ones are transformed into animations.

## r/MotionDesign | My first motion design project 🎉 | https://www.reddit.com/r/MotionDesign/comments/1w79kmb/my_first_motion_design_project/ :: I just saw the last guys post so please don't come at me for blantantly copying base44. This is my first every project and I was just focusing on actually making something decent. In light of that here's my first project. Please give me some helpful critic. If I can get some advice on some useful next steps so I can find my own ideas instead of copying others please let me know. Here are a list of
  - com/r/MotionDesign/comments/1w79kmb/my_first_motion_design_project/p7ttcmk/ :: Yes, pick music first. It makes it much easier to build the story around it. I use Artlist to find music - they have a catalogue with different filters to find what you are looking for. There’s probably also some other free options out there I use Soundly - a library with 250.000 different sounds. They also have a free version with 3.000. It’s drag and drop, so you can easily find what you need, drag it into the software and be on your way. You can do it whichever way you’d like. With a programming background, you should be leveraging expressions to make it easier for yourself.
  - com/r/MotionDesign/comments/1w79kmb/my_first_motion_design_project/p7tp4x1/ :: A lot to like here. I’d give a more detailed breakdown but I’m shattered. You could take this up levels with better easing. Do some watching and learning about the graph editor and work on the speed, fluidity and cadence of the motion. Keep it up

## r/MotionDesign | mods any plan on how to handle ai posts? it's literally the entire sub now | https://www.reddit.com/r/MotionDesign/comments/1wsizbd/mods_any_plan_on_how_to_handle_ai_posts_its/ :: i get that its moving fast/new tools/need to stay up to date etc. but it's literally been non-stop are we cooked posts of ai claude animations. can there be a new sub called ai-assisted motion design or something? submitted by /u/RickyWinterborn [link] [comments]
  - esign/comments/1wsizbd/mods_any_plan_on_how_to_handle_ai_posts_its/pcltjes/ :: Second this. The posts are constant. I’m starting to think part of the AI marketing strategize is to sow fear in whatever community is next to be COOKED.
  - esign/comments/1wsizbd/mods_any_plan_on_how_to_handle_ai_posts_its/pcoindm/ :: That's exactly why they should ban them, there's obviously a huge shadow marketing campaign for this stuff now. VFX 'influencers' are being paid to post about it, it would be naive to think they don't also have bot accounts or marketing people posting about it on reddit as well.
  - esign/comments/1wsizbd/mods_any_plan_on_how_to_handle_ai_posts_its/pcmhh4t/ :: Since the release last week, there’s been a slew of cult like shills attempting to put the fear of god into everyone. It’s been utterly dishonest, and as divisive as hfield boasting about ending graphic artist careers, and their shills wishing ill on anyone who called them out. I’ve noticed a commonality among the recent posters, too - either they have their post and comment history turned off, or they are long dormant accounts suddenly come to life. It’s vile
  - esign/comments/1wsizbd/mods_any_plan_on_how_to_handle_ai_posts_its/pcn6j1d/ :: It truly is. The AI heads including Huang have been getting on the soapbox about all of this but it just hasn’t been true. Several of the billionaire caste have said radiologists have been fully replaced as a profession, for instance, but that’s completely untrue. All of these guys are in survival mode because they know they’re the ones that are cooked (along with the whole economy, alas) if their tech can’t find a way to profitability, which it currently absolutely can’t.

## r/MotionDesign | Astra and Opus 5, are both pure theft at this point, and it's going to kill everyone's drive to create and share. | https://www.reddit.com/r/MotionDesign/comments/1wqrlx6/astra_and_opus_5_are_both_pure_theft_at_this/ :: With the crazy influx of constant "Look what I one shotted" and "Found on X" I need to point out that a lot of these models are stealing beyond just being "Trained". If you ask Astra or claude to build something for you it's going to go out and find a way to build that. Pull those assets and present them as something new. The end user doesn't know the difference and is wildly impressed... but what
  - sign/comments/1wqrlx6/astra_and_opus_5_are_both_pure_theft_at_this/pc6sgwz/ :: If I ripped assets from 10 different places, it would still be theft. The fact that AI systematically ripped off everything from everywhere doesn’t somehow magically make it not theft. It makes it a scale of theft that doesn’t even have a name yet.
  - sign/comments/1wqrlx6/astra_and_opus_5_are_both_pure_theft_at_this/pc6thyn/ :: Correct, and if everything can be stolen with zero consequences it makes everything essentially worthless. If you can clone someones work with a click of a button and then sell it yourself, what is the point of making anything in the first place.
  - sign/comments/1wqrlx6/astra_and_opus_5_are_both_pure_theft_at_this/pc6w26e/ :: It comes down to what constitutes “Fair Use”. It would be unreasonable to accuse you of copying someone else’s work because over the course of your life you experienced someone else’s works and they happened to inspire your own works. But to train and orchestrate a piece of software designed to not only copy, but to “distill” any and all works… is most certainly a violation of “Fair Use”. Imagine if the “Pirating” community had systematically cracked and decompiled (distilled) all pirated software into a single highly coherent system and systematically decomposed all pirated media into a singl
  - sign/comments/1wqrlx6/astra_and_opus_5_are_both_pure_theft_at_this/pc8dvmo/ :: First the painters, then the translators, then the voice actors, then the coders, then VFX, now I see the motion designers up in arms. I really wonder where this is going... but a lot of people are angry. Thankfully.

## r/MotionDesign | How can I find or recreate these types of sound effects as a non-sound designer? | https://www.reddit.com/r/MotionDesign/comments/1xccp6f/how_can_i_find_or_recreate_these_types_of_sound/ :: I recently saw this video with sound design and music that really "tickled my brain". I know they had a dedicated sound designer who likely created these sounds from scratch using synths, but as a video editor/non-musician, I'd love to get close to this style. I'm trying to get more into the emotional and 'moving' side of sound design, rather than just relying on standard sound effects and music. 
  - ents/1xccp6f/how_can_i_find_or_recreate_these_types_of_sound/19rhhctoujwoy/ :: I've been using Boombox by Mt. Mograph for years now - it's an awesome tool that adds a panel right into Premiere and After Effects, so you can preview sounds and drop them right into the timeline. It's got like 15,000+ SFX all neatly organized into various different themes. Now, a caveat to my recommendation: I bought into it when it was still a perpetual license. It's since moved to a subscription model. From what I've heard from other people, they've made a ton of improvements, but I've been happy with the 'old' version well enough that I haven't switched over. https://mtmograph.com/product
  - ents/1xccp6f/how_can_i_find_or_recreate_these_types_of_sound/19ri611amdl50/ :: Man, I also bought the original Boombox plugin but recall them only supplying very "futuristic" "over the top" space sounds and all of the more natural, organic sounds were nowhere in sight, so I let it go. You wanna tell me original owners still jave access to it? Same acceas subscribers have? Or a legacy one? Did you ever see more organic new libraries added? I just recall hearing sound effects I will never use cause they're too remote from motion graphics.
  - ents/1xccp6f/how_can_i_find_or_recreate_these_types_of_sound/19ri6w9a4t4xv/ :: I dunno if they blocked anything now, but I’ve been able to run the update function (can’t remember exactly) and download all the latest packs. Or maybe it’s limited? But there’s a lot of organic stuff in my library now!
  - ents/1xccp6f/how_can_i_find_or_recreate_these_types_of_sound/19rmi7rgxw090/ :: Hi, developer at Mt. Mograph here, awesome that you are enjoying Boombox so much. All the new packs that we've been releasing over the years and new ones that will sync in the future are available in the Boombox plugin. We created Boombox Studio as a standalone tool so we can add deeper sound design features like creating your own variations on sounds and a full mixing page. Boombox Studio has connections with After Effects, Premiere, Audition, Davinci Resolve and Reaper so you can add sounds to these programs without leaving Boombox. If you bought Boombox before you can still use the plugin b
  - ents/1xccp6f/how_can_i_find_or_recreate_these_types_of_sound/19rhef8rar8ld/ :: Soundly is a fantastic source of sound FX, especially when used with Reaper. Epidemic Sound uses their library in their Sound FX section. If you have an ES sub (I do through work), you can upload your video to their ‘Studio’ and it analyses your video and pulls in SFX it thinks matches your motion and auto-adds them in on a web-based timeline. You can then move them around, replace them, mix them and export them individually or as a mix. Works surprisingly well!

## r/MotionDesign | AI is ruining our lives | https://www.reddit.com/r/MotionDesign/comments/1p7271x/ai_is_ruining_our_lives/ :: So I'm sure you've all seen the prices of ram skyrocketing. And I was thinking of upgrading my laptop just for the price of Ram to sky rocket 3 times. And who's fault is it that the prices increased? The freaking AI companies. These greedy bastards just made a deal and gobbled up 40% of manufactured Ram. AI was running careers but now it's just straight up gate keeping it by increasing price of Ra
  - reddit.com/r/MotionDesign/comments/1p7271x/ai_is_ruining_our_lives/nqwf64m/ :: It wouldn't be bad if AI was doing stuff like replacing google searches with tony stark like image and voice response. Our current culture being social mediafacing makes them focus on the least helpful use of AI to create content. Actually hurts society to have totally fake content, and will be used for real evil.
  - reddit.com/r/MotionDesign/comments/1p7271x/ai_is_ruining_our_lives/nr1g6iv/ :: I'm sure you already have one but here's a back up, little buddy. https://preview.redd.it/bkw0uhd9fs3g1.jpeg?width=275&format=pjpg&auto=webp&s=bb7befd405d35b0de685a2c3124218a60340073a

## r/MotionDesign | Motion designers falling head over heels for AI | https://www.reddit.com/r/MotionDesign/comments/1wz9iw4/motion_designers_falling_head_over_heels_for_ai/ :: Ive worked with a few veteran motion designers who have fallen head over heels for AI. Before AI, they were decorated, and well established in their craft, but as soon as the whole AI thing took off, they seem to have completely abandoned 3D motion design and spend 99% of their time designing in AI, and even seem to get a hair annoyed at others who dont fully embrace the AI workflow. How can peopl
  - n/comments/1wz9iw4/motion_designers_falling_head_over_heels_for_ai/pe9r7sl/ :: I worked with a designer who used AI and delivered THE MOST TASTELESS EXPORT I’ve ever seen in my life. Literally portrayed a character’s shoulders spinning on his torso as an excuse for a walk cycle. Client approved. What a nightmare for those of us who like things to look right.
  - n/comments/1wz9iw4/motion_designers_falling_head_over_heels_for_ai/pec6ktp/ :: This is the issue that people don't grasp. We motion/vfx/3d designers have trained eyes and knowledge for the art. No the client. And he is the one that approves this shit show.
  - n/comments/1wz9iw4/motion_designers_falling_head_over_heels_for_ai/pel4b4t/ :: I got reprimanded at work for calling out something as AI slop, apparently that's an unwarranted insult despite the photo having 4 versions of the same person.

## r/MotionDesign | Got this really insulting email offering to “pay” for my work | https://www.reddit.com/r/MotionDesign/comments/1wn6l10/got_this_really_insulting_email_offering_to_pay/ :: Sure, lemme just sell you my clients’ work without their permission and break some NDAs to earn an insultingly low amount of money for the amount of work- all so you can feed your AI model and fast track my obsolescence. submitted by /u/LittleDansonMan [link] [comments]
  - n/comments/1wn6l10/got_this_really_insulting_email_offering_to_pay/pbdaqys/ :: Dude I'm thinking the same thing - assets for shows that went off the air decades ago, music videos for bands that never became rock stars, SO. MUCH. CORPORATE. (And good luck with finding Red Giant Light Wrap)
  - n/comments/1wn6l10/got_this_really_insulting_email_offering_to_pay/pbe9a89/ :: Ooh.. I wonder if they would buy all the old CD sleeves I made for my friends punk bands. I’d sell that stuff in a heartbeat and it might do AI some good to have some crust punk ethics injected into it.

## r/MotionDesign | Made a spec launch film for Canva Video 3.0 — Full motion pipeline + sound design. Would love honest crit. | https://www.reddit.com/r/MotionDesign/comments/1u6ia55/made_a_spec_launch_film_for_canva_video_30_full/ :: Spent the last few weeks on this as a self-directed spec piece. Goal was a 47-second launch film: script, storyboard, design, animation, music, and all the sfx done from scratch. The strangest part is 3D cylinder is the AI generated footage :P Sfx is nightmare but i love how it came out. I posted on X and got no views, still have no idea about that. Any opinion helps me now? submitted by /u/Nhutho
  - n/comments/1u6ia55/made_a_spec_launch_film_for_canva_video_30_full/orsuzbq/ :: Nice and clean motion work. But why would anyone care about (yet another) Saas AI promo vid? This concept is run into the ground by now. It tells no story, doesn't make me feel anything and most likely promotes a product that isn't capable of anything close to what's advertised. Just my 2 cents on the concept. Again, the motion work itself is high quality.
  - n/comments/1u6ia55/made_a_spec_launch_film_for_canva_video_30_full/orszf4p/ :: Totally fair, and honestly you’re half-right: the “AI SaaS promo” space is flooded and most of it is soulless. That was kind of my point with this: I wasn’t trying to sell Canva, I was using a fake product to test whether you can make even a saturated genre feel like it has a pulse. Did it fully work? Maybe not. But that’s the exact problem I’m interested in solving. I know some guys stil grinding everyday and get 6 figures deals monthly, consistently. The market is not a liar. Appreciate the honest read

## r/AfterEffects | I'm trying to watch a Johnny Harris video, but the animator in me can't help but question how he got that red marker effect? Does anyone know how he may have achieved it? | https://www.reddit.com/r/AfterEffects/comments/1cnyauq/im_trying_to_watch_a_johnny_harris_video_but_the/ ::  submitted by /u/ReturnPure8518 [link] [comments]
  - /comments/1cnyauq/im_trying_to_watch_a_johnny_harris_video_but_the/l3ahjfx/ :: Watching the video back, it looks like all the animations are simple mask reveals or path reveals.. I can't remember the name of that effect, but you reveal along a path at a certain radius to get that 'written on' effect.
  - /comments/1cnyauq/im_trying_to_watch_a_johnny_harris_video_but_the/l3bry5y/ :: It's third party, and costs money, you can find it on aescripts. It's pretty cool, and stupid simple to use. So if you need to do this a lot, it's great. Good old mask or matte reveal works great too though, for simpler stuff like in this video.

## r/AfterEffects | Easy Vector Map Animation Tutorial | Vox & Johnny Harris Style in After Effects | https://www.reddit.com/r/AfterEffects/comments/1nf1xu9/easy_vector_map_animation_tutorial_vox_johnny/ ::  submitted by /u/No-Understanding5331 [link] [comments]

## r/AfterEffects | Tried recreating a map animation inspired by Johnny Harris. | https://www.reddit.com/r/AfterEffects/comments/1pc2fno/tried_recreating_a_map_animation_inspired_by/ :: Would really appreciate your feedback on this! Map Style: MapTiler Plugin Used: GEOlayers 3 Software: After Effects submitted by /u/Able_Asparagus1376 [link] [comments]

## r/AfterEffects | Create Animations Like Vox, Soch, Johnny Harris in After Effects - EP01 | https://www.reddit.com/r/AfterEffects/comments/1f3908g/create_animations_like_vox_soch_johnny_harris_in/ ::  submitted by /u/mithilesh_paul [link] [comments]

## r/AfterEffects | Should i upgrade or buy a new one? | https://www.reddit.com/r/AfterEffects/comments/1fytd39/should_i_upgrade_or_buy_a_new_one/ :: I've been working for my employer for quite a while and after effects is becoming more and more necessary based on his demands. I am working on videos similar to johnny harris (you can search him on yt and he's pretty famous with his retro style kind of editing) Simple animations with graphs easing doesn't seem to be a problem but adding layers and layers to achieve the retro style film and a vect
  - /r/AfterEffects/comments/1fytd39/should_i_upgrade_or_buy_a_new_one/lqxbj3b/ :: Use puget systems to see what build solutions they offer for the tour of projects you’ll be needing to complete write down the lists of parts that they suggest in the build Go to pc part picker and search for the parts to source the cheapest price for each part Or you could just buy a build straight from puget systems. They have great builds and even greater customer service and can be worth paying their surcharge for it. Large ssd for cache is very helpful I’d highly recommend i7 or above for cpu for working in after effects 64 gb of RAM is a good start and is enough for many people. Just dep
  - /r/AfterEffects/comments/1fytd39/should_i_upgrade_or_buy_a_new_one/lqxfyua/ :: If it was a desktop i would've suggested to up your ram to 128 gig,For now try the 64 gig upgrade then try to optimize your projects, if nothing works then only upgrade. Why waste money when you have a perfectly working machine

## r/AfterEffects | How do you all put together a cohesive theme for a brand? How do you make it feel complete? | https://www.reddit.com/r/AfterEffects/comments/1k5ple9/how_do_you_all_put_together_a_cohesive_theme_for/ :: Looking at professional work, for example, TV Main Titles, or promotional content, YouTubers like Dodford, Vox, Johnny Harris, etc. they seem to have a cohesive brand personality that feels complete and thought out, for those who have done this before, what is your workoflow/advice to achieve this cohesive and purposeful feel? submitted by /u/GrandRevolutionary99 [link] [comments]
  - /comments/1k5ple9/how_do_you_all_put_together_a_cohesive_theme_for/mok4zq9/ :: Set up rules on how things move and look. Follow them, the repetition of following the rules you set is what creates the perception of cohesiveness. I recommend looking up brand guidelines online, there’s lots available. Some are incredibly detailed and give lots of insight into the process behind good branding.