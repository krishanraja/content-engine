# Motion floor: the minimum every makeyourmindup video meets (26 Nov 2026)

Krish, 26 Nov 2026: "make sure that all the video motion, caption, and visual style templates are not only perfectly on brand but set the highest of bars possible for animation, motion speed, and quality ... I'd like you to make sure that there is a minimum floor standard."

A cut that fails any rule below is not shown to Krish. There is no partial pass and no averaging. Where sources disagree, section 5 says which wins (the newest Krish ruling). A number marked **new** has no source number yet and needs his yes before a script refuses on it.

Frames are at 25 fps (40 ms each), the Library's rate. ve renders at 30 fps, so timings convert by milliseconds (frames x 1.2), never by copying the frame count.

## 1. The floor

| # | Rule | Measured by | Source |
|---|---|---|---|
| F1 | One constant frame rate per cut, equal to the composition's. His take is resampled once, sync checked after. | `ffprobe`: `r_frame_rate` = `avg_frame_rate` = composition fps | `library.json`; `clock.ts`; failure av-sync-drift-converted-take |
| F2 | Entrances and camera settles decelerate on `cubic-bezier(0.22,1,0.36,1)`; exits accelerate on `cubic-bezier(0.3,0,0.8,0.15)`. No positional move at constant speed. | Each track's ease; speed falls through each entrance | `library.json`; `brand-tokens.json`; THE_BAR quality 3 |
| F3 | Entrances: vertical 4 to 10 frames (160 to 400 ms), long-form 7 to 12 (280 to 480 ms). Type travels 24 to 60 px, evidence at most 120 px. Opacity full by 30% of the entrance. | Track durations; `check_static.cjs`; `floorProblems()` | MOTION_STANDARD (13 Nov); `library.json`; `method.md` rule 1 |
| F4 | No bounce or elastic: an element crosses its rest position at most once. Overshoot 0%, except one vertical payoff slam at most 12%. `HOUSE_BACK` is never used. | Rest crossings per element | MOTION_STANDARD; `library.json` "nothing bounces"; INGREDIENTS captions rule 3 |
| F5 | Exits: vertical 4 to 6 frames, long-form 6 to 8. What does not carry leaves on the beat's last word, before the next entrance. | Exit tracks against next entrance | `brand-tokens.json` exit 200 ms; `method.md` rule 2 |
| F6 | At most two entrances in flight, plus one ambient camera move. Entrances in a beat start 3 or more frames apart, in reading order. | Overlapping tracks per frame | design lock stagger 3; section 3; THE_BAR quality 8 |
| F7 | An event at least every 3 s of a beat, on the word that names it; no graphic still over 3.5 s (drift counts); no loop without a cue. | `ve lint` `motion.event_cadence`; `ve qc` `motion.change_density`, `motion.longest_still`, `motion.periodicity` | MOTION_STANDARD; F05 |
| F8 | Readable hold (**new**): a card's words stay settled for 0.5 s plus 1 s per 3 words, never under 1.0 s; at most 8 primary and 16 total words per state. | Settled frames per text state against OCR word count | `visual-clarity.json`; `said.py` (2.9 words a second is rushed); opening gate hold 2.0 s |
| F9 | Nothing a viewer reads under 33 px per 1080 px of width; graphic-beat headline at least 96 px Anton; evidence words at least 40 px. | `ve qc` `evidence.readable`; design lock `min_text_px` (raise 30 to 33) | `STANDARD.md` rule 3; MOTION_STANDARD rule 2 |
| F10 | Captions burned into every cut, 1 or 2 lines, at least 64 px (72 on 9:16). One anchor: caption y varies under 2% of frame height across the cut, a new word's anchor moves under 100 px, the previous word stays dimmed. No pop, flash or blank between words. Never over his face (box plus 10%), never over bright content without a scrim, empty during the title hold, never ending a page on a filler word. | `ve lint` `captions.steady`; `ve qc` `captions.off_face`, `captions.ocr`; `plainframes.py`; grammar `caption_zone` | F08 ruling (27 Oct); `caption-steady.json` (F57); `library.json`; THE_BAR quality 12 |
| F11 | 9:16: every word, figure, logo and graphic point inside x 60 to 860, y 270 to 1320; captions y 1090 to 1320, or the seam (y 670 to 850) on a split. 16:9: inside x 144 to 1776, y 81 to 999. | `python3 scripts/channel_safe.py FILE`; `ve qc` `channel.safe_zones` | `channel-safe-zones.json`; MOTION_STANDARD (11 Nov); `library.json` |
| F12 | Text at least 4.5:1 against its surround on the hardest frame (**new** ratio). | Only `plainframes.py`'s bright check today | SOCIAL-BEST-PRACTICES 6.1, 11 |
| F13 | No flash: no frame whose mean luma jumps over 20% of full scale across a quarter of the frame and returns within 10 frames (**new**), never 3 a second, no grey or blank frame at a cut, no plain dark band over 120 px. Only exception: the Library outro's step pulse as drawn. | Luma scan (gap); `plainframes.py` plain_dark | SOCIAL-BEST-PRACTICES 11; `plain-frames.json`; Krish 12 Oct "weird flashes" |
| F14 | No unmotivated zoom: ambient push only (title 1.06 to 1 over 2 s; elsewhere at most 1.2% scale a second). A faster zoom starts on the word naming its target and stops at 1.5x. **Impact zoom on his face (Krish, 26 Nov 2026: "Zoom for impact... classy and subtle rather than too aggressive"):** on the take layer only, starting on the onset of one of the most impactful words, push to about 1.05 (16:9) or 1.06 (9:16) over 10 to 12 frames on the house ease, hold through the phrase, then release gently or reset under the next cut. One strong impact per cut may reach 1.10; never above 1.15. At least 4 s apart, at most 6 a minute on shorts and 4 on long cuts. Face-anchored and capped by source resolution. Never on b-roll, windows, splits, screen recordings or graphic beats, and never as a punch or whip transition. | Scale per second; `at_w` on the event; `config/ve/impact-zoom.json` (content-engine) | `library.json`; MOTION_STANDARD engine notes; Krish 26 Nov |
| F15 | Transitions: a cut in his pause, a carry, a designed push or a zoom out. Crossfade only between two non-face grounds of one tone, 6 to 10 frames. Never a dissolve on his face. Never whip, spin, zoom-through, flash, punch, shake, glitch, light leak or plugin wipe. | `ve lint` transitions kind; `ve qc` `ghost_face`, `beats.handover_in_gaps` | THE_BAR quality 11; frame-checks ghost_face (17 Nov) |
| F16 | One staging per cut; at most 4 staging switches a minute; his face on screen 90% or more (45% on an anchor cut with plates); no face-free run under 4 s; one annotation at most 3 times. | `ve lint` `grammar.*` | `shot-grammar.json` (Krish, 20 Nov) |
| F17 | Nothing before the hook. Voice by 0.5 s; frame 0 edge density 0.02 or more, luminance spread 30 or more; no frame in the first 3 s over 85% flat; a headline holds 2 s inside the first 3 s; movement in 2 of the first 3 s. | `opening_gate.py <file>`; `ve qc` `first_seconds`; `ve lint` `story.hook_event` | `opening-gate.json`; THE_BAR never 7 (12 Nov) |
| F18 | One end card, 3.5 to 5.0 s, nothing after it; the outro holds still from frame 60. | grammar `end_card_s`; `check_static.cjs` | `shot-grammar.json`; `library.json` |
| F19 | No mark, wordmark or series tag over 9:16 animated content. The wordmark appears only inside the title lockup and on the close. | `ve qc` `brand.no_mark`, `render_current` | MOTION_STANDARD rule 3 (11 Nov); Krish 18 Nov |
| F20 | -14 LUFS plus or minus 1, true peak at most -1.0 dBTP. Ledger bed (intro -16, bed -31, outro -18 LUFS), steady within 2 LU under his voice, two direction changes at most, 6 LU over the bed at the open and the end, chapter lift 0.5 s up and 0.8 s down. No voice-keyed ducking, never silent, picture and voice within 40 ms. | `bed_shape.py`; `npm run check:music-bed`; `ve qc` audio; report `loudness`; `sync_check.py` | produce-video step 6; `music-bed.json`; `music-library.json`; `s8ce587e7db` |

## 2. Two profiles

Both hold the whole floor; they differ in speed, density and material.

### Vertical (Shorts, Reels, TikTok): each point as fast and clear as possible

- **First frame:** the piece's one named thing, words on screen inside the first second (FIRST_TWO_SECONDS, 16 Nov).
- **The one-second point:** from the word that names a point to its picture fully landed is at most 1.0 s; the event starts on the word (plus or minus 2 frames).
- **One idea per beat:** a point a muted stranger follows; one focal point, one thing in mint (`method.md` rules 5 and 6).
- **Big type:** headline 96 px or more, at most three lines, line height 0.90 to 0.95, at least 70% of content width (`STANDARD.md` rule 2).
- **Kinetic, readable:** entrances 4 to 8 frames (type 8 frames, 36 px, as the Library draws it); one payoff slam may take 10 frames and 12% overshoot; handovers 6 to 10 frames; camera up to 3% scale a second.
- **Pictures:** the real artifact first; generated only as art-directed metaphor, bright, one palette colour (shot grammar 20 Nov; `IMAGERY.md`).

### Long-form (5 minutes plus): real-world and premium

- **Real material:** every evidence beat shows a real photograph, footage, document or recording at 55% of frame width or more (shot grammar); generated imagery only as metaphor, never for a real event (`IMAGERY.md` rule 8); graphic-only beats at most 1 in 4 picture beats (**new**).
- **Slow camera:** every hold over 2 s carries a push of 1.00 to 1.045 over 4 s or slower; zoom-to-focus no faster than 0.5x a second; energy calm.
- **Longer holds:** plates and documents hold 4 to 8 s; F7's events inside them are highlights and underlines on the words, never new scenes.
- **Gentle entrances:** 7 to 12 frames, no overshoot, no slams, one annotation a beat.
- **Documentary lower thirds:** the Library's `video-wide-lower-third`: label 58.7 px or more, 63 characters and 3 lines at most, naming only a person, source or date (THE_BAR ruling 2), 8-frame entrance, held 3 s or more (**new**), above y 999. A proposed design: his yes before first use.
- **Chapter cards:** full frame, 1.5 s at most, headline 96 px or more, the bed lifting.
- **Restraint:** no big-moment sound until he approves the set by ear; a 5.0 s end card under YouTube end-screen elements.

## 3. The title card

Krish, 26 Nov: the title card "should feel stable, consistent, and really premium at all times", using imagery generated for the piece. Every video uses the same timings; only the picture, words and source change. It enters as he says the title, inside the first 30 s; captions stay empty while it holds.

| Frame (25 fps) | ms | At 30 fps | What happens |
|---|---|---|---|
| 0 | 0 | 0 | Picture full bleed at scale 1.06, settling on the house ease. Nothing else drawn. |
| 3 to 13 | 120 to 520 | 4 to 16 | Headline rises 48 px to rest, opacity full by frame 6. |
| 10 to 20 | 400 to 800 | 12 to 24 | Source (document crop or official logo) rises 60 px, opacity full by frame 13. |
| 20 to 49 | 800 to 2000 | 24 to 60 | Everything has landed and holds; only the picture moves, reaching 1.00 at frame 49. |
| Exit | | | Vertical: headline and source leave in 5 frames, then a hard cut in his pause. Long-form: 8 frames, then the cut. |

Both profiles: 2.0 s in all (shot grammar `title_full_frame_max_s`), no overshoot, no light sweep, no slamming bands. Anton, at most 60 characters and 3 lines, at least 105 px on 9:16 and 96 px on 16:9, on one left edge inside F11. The wordmark, where drawn, sits inside the lockup and moves with it.

**The picture** is generated in that piece's session, never drawn from a bank (`IMAGERY.md`): one encapsulating hero visual or story scene, bright light, one strong palette colour, no text, logos or readable screens, generated at 2k separately for 9:16 and 16:9, subject clear of the headline zone, checked against the exemplar `ph-bus-skip`, with prompt, model, date and cost on the record. Vertical favours the hero object; long-form a photoreal story scene.

## 4. The check before any cut reaches Krish

1. `python3 scripts/check_failures.py --piece <piece>`; `python3 scripts/floor.py --format short_video` and `long_video`; `python3 scripts/preflight.py <piece> --skill ve`.
2. `python scripts/ve.py lint <spec>` clean.
3. Library templates: `python verify_static.py` here (runs `check_static.cjs`).
4. `python scripts/ve.py qc <cut> --format <format> --props <props>`: `measured_pass` and `complete`.
5. `ve proof` passes its plain-frame and caption checks, with `--title-looked` and, after any engine or asset change, `--compared`.
6. `python3 scripts/channel_safe.py <file>` on the cut and its cover.
7. `python scripts/quick-edit/opening_gate.py <file>`.
8. `scripts/bed_shape.py` and `npm run check:music-bed`; report loudness within F20.
9. `scripts/quick-edit/words_gate.py` and `sync_check.py`.
10. `ffprobe`: one constant frame rate, equal to the composition's.
11. Full-size frames at every beat change beside the last approved version, his standing notes walked (F58). Contact strips do not count.
12. A Critic who did not make the cut scores it 8 or more against each reference card (`ve refs`, `refgate.py`).
13. `ve show-check`.

**No check exists yet for:** ease and rest crossings on rendered devices (F2, F4; `FLOOR` checks profiles only and FormatMaster clamps silently); flashes and contrast (F12, F13); reading hold (F8); zoom rate (F14; `FLOOR.zoom` allows 3x); banned transitions (F15; the menu still offers whip, zoom-through, flash, punch); title entrance timing (`ve qc` reads only the settled frame, and its centring rule fails a left-edge lockup); 25 to 30 fps conversion (F1); the Library's layouts against `channel_safe.py`; any profile difference (the Library gives vertical and wide identical motion); the quick-edit fallback, which only warns on safe zones.

## 5. Contradictions, and which rule wins

| # | One source | Another | Wins |
|---|---|---|---|
| 1 | Library: 25 fps | ve: 30 fps | No ruling. This floor binds milliseconds; Krish picks the render rate. |
| 2 | Library: one ease, no overshoot | ve: four curves, `HOUSE_BACK` 1.9 back | Library (his 26 Nov words). |
| 3 | 13 Nov: overshoot to 12% | Library and 26 Nov: nothing bounces | 26 Nov, except one vertical payoff slam. |
| 4 | ve floor clamps entrances at 333 ms | Library title: 400 ms; bars 480 ms | 26 Nov; widen the ve clamp. |
| 5 | MOTION_STANDARD: house motion with no style enters in 12 frames | Its own floor: 4 to 10 | The floor; every cut names a style. |
| 6 | MOTION_STANDARD (3 Nov): 30 or more cuts a minute | Shot grammar (20 Nov): one staging, 4 switches a minute | 20 Nov. |
| 7 | Social corpus: captions y 940 to 1160 | MOTION_STANDARD (11 Nov): y 1090 to 1320; Library band y 1302 to 1479 | 11 Nov. The Library band and content box run under Instagram's handle (from y 1320) and must move up. |
| 8 | Library: Fraunces captions, current word in mint type | `method.md`: mint is never type; MOTION_STANDARD: Archivo | Style is his per-piece pick; mint type is his to rule; meanwhile a mint chip behind the word. |
| 9 | Library and `STANDARD.md`: DM Mono | `fonts.json`, produce-video: IBM Plex Mono | `STANDARD.md` (25 Nov); `fonts.json` needs DM Mono. |
| 10 | Design lock: 30 px; `STANDARD.md` labels 26 to 30 px | `STANDARD.md` rule 3: 33 px | 33 px, labels included. |
| 11 | Library: vertical title headline to 56 px, chapter to 33 px | MOTION_STANDARD 96 px; title check about 105 px | 96 and 105 px; raise the slot minimums. |
| 12 | `TitleMoment` (19 Nov): slamming bands, light sweep; Library title has no wordmark | 26 Nov: stable settle; 19 Nov: wordmark inside the lockup | 26 Nov for motion, 19 Nov for the wordmark. |
| 13 | THE_BAR quality 6: mark tile on every wide beat | Krish 18 Nov: "ONLY THE WORDMARK DURING THE TITLE FRAME AND THE CLOSING FRAME" | 18 Nov. |
| 14 | produce-video step 6: wordmark and series tag in tall top corners | MOTION_STANDARD rule 3 (11 Nov) | 11 Nov; that line is stale. |
| 15 | produce-video (19 Oct): no source citations on cards | THE_BAR ruling 2 (28 Oct): source and date labels are fine | 28 Oct. |
| 16 | INGREDIENTS: whip, zoom-through, flash, punch, cream flash | THE_BAR quality 11; ghost_face (17 Nov) | No stock transitions. |
| 17 | Rejection floor `sc4472cd02b`: music "ducks under speech" | F40, `music-bed.json`: no voice-keyed ducking | 4 Nov: a steady low bed. |
| 18 | Episode route: long cut SRT only | F08 ruling (27 Oct): burned in | 27 Oct, SRT as well. |
| 19 | MOTION_STANDARD: typing at 25 to 40 characters a second | Krish 10 Nov: "The typing animation is awful" | 10 Nov: no typing reveals. |
| 20 | `FLOOR.zoom` up to 3x; `s62fa64eff3` dramatic zooms on his face | living-ui 1.5x; 26 Nov stable; Krish 26 Nov impact zoom | 1.5x elsewhere. On his face: the slow push, plus the word-anchored impact zoom in F14 (1.05 to 1.06, one per cut up to 1.10, hard cap 1.15). |
| 21 | This page's brief: a one-frame outro flicker | `library.json`: a two-frame 24% cream pulse per step | The built pulse, until Krish says otherwise. |

## 6. Decisions taken under Krish's delegation (26 Nov 2026)
Krish, 26 Nov 2026: "Just do what you need to do to get this asset library to 100%." These settle the open calls above; he can overrule any of them.
- **Render rate:** the Library and every cut work at 25 fps; ve converts by milliseconds (frames x 1.2), never by copying frame counts.
- **The spoken word in mint:** allowed, one word at a time, only inside burned-in captions (mint marks the word being said; nothing else in the caption is mint).
- **Mono face:** DM Mono, the locked v5 label face. IBM Plex Mono is retired with the old kit.
- **Outro pulse:** one frame per colour step, as built and approved in the Library outros.
- **New numbers adopted as the floor:** the readable-hold formula (F8), 4.5:1 text contrast (F12), the flash threshold (F13), the long-form share of graphic-only beats and the lower-third hold. Each stays a hard floor until Krish changes it.
- **Captions on 9:16:** every vertical template now carries a pinned `caption_band` whose bottom edge is y 1320 and whose right edge is x 860, clear of Instagram's handle zone and the right-hand action stack.
