# Shot grammar study (20 Nov 2026)

Material: house cuts fetched via drive_review.py and checked by sha256: Character.ai tall 1Ll0n3YD8sqzUWHP6h5sI8helefOgVtRV (39f1039c), Eating its own jobs tall 1TuWfO0l7wtxc1dkV2VnobjHTSU7JAR0B (2cdff09a), AI music tall 1cFzqFX9jpWY5RGkaN4Px6fwdLDKZlD-6 (3c360c73), Character.ai wide 1A8mx4YTcgchPLbmvBuFzde2_hCZ9H6Mh (the only good 16:9 cut measured). Reference: The Athletic "8 facts about Man United's finances". Rejected: Tue 17 short, Wed 18 long, the 9 s long.
Frames every 0.5 s, contact sheets, OpenCV Haar face detector, hand shot log. Files under scratchpad/shots/ (sheets/, f/<video>/, faces.json, *.sc, cmp_*.jpg).

## 1. Good vs rejected

| Measure | Char.ai tall | Char.ai wide | Jobs tall | AI music tall | Athletic | Rejected Tue 17 short | Rejected Wed 18 long | Rejected 9 s |
|---|---|---|---|---|---|---|---|---|
| Length | 85.7 s | 283 s | 68.5 s | 80.6 s | 78.3 s | 85.3 s | 300.6 s | 9.1 s |
| Body layouts | 1 band | 1 column (+ yellow chapter card, face kept) | 2 (full-frame face / full graphic) | 1 stage | 1 set | >=4 | 3 | 1 pillar |
| Face on screen | 91% | 97.5% | 48% | 93% | 95% | 56% | 63% | 100% |
| Face/no-face switches | 0 | 0 | 4 | 1 (title) | 0 | 14 | 18 | 0 |
| Shortest no-face run | - | - | 4 s | 2 s (title) | - | 1 s (x4) | 6 s | - |
| Face width / centre | 0.51 / (0.50,0.78) sd 0.025 | 0.18 / (0.155,0.62) left column | 0.37 / (0.44,0.44) | 0.21 / (0.78,0.69) | 0.10-0.30 / (0.52,0.37-0.43) | 0.34 / (0.58,0.72) | 0.20 / (0.83,0.46) | 0.11 / (0.84,0.50) |
| Mean panel-graphic hold | 7.8 s | ~8 s | 11.4 s/block | ~6 s | 3.9 s per camera size (~20 punch-ins) | 3.9 s | ~10 s per generated still | - |
| Real images share | 20% | 21% | 23% | 43% | 12% | ~23% (partly suspected generated) | ~25% as tiny cards | 0 |
| Real image size | fills panel width (receipt ~0.9 of panel) | ~0.55 frame width | doc <=0.30 + quote large; screenshot 0.85 | fills panel | cut-outs at body scale | full frame replacing him | 0.13-0.27 width on blurred copy | - |
| Generated | 0 | 0 | 0 | ~2.5% (one small inset) | 0 | box device ~24 s x5 + photoreal plates ~20 s | 11 full-frame stills, 100 s (33%), 6-14 s each | 0 |
| Empty panel | 0 | 0 | 0 | 0 | - | ~6 s | >=60 s blur | 4.5 of 9 s |
| Title | full card 0-4 s (now banned before hook) | same | sticker over head while talking | in panel 9-12.9 s then full frame 13-14.9 s (2 s) then back | words + giant 8 behind him via matte 1-6 s while talking | in panel 13-16 s | full frame 34-39 s (6 s) detached | - |
| Chapter marks | none | yellow card, face kept, ~every 30 s | none | none | "Fact N" numeral beside/behind <=1.5 s x8 | none | none | - |
| Caption position | pill on seam y 0.50-0.53 constant | in his column bottom | pill y 0.73-0.78 on face and graphic beats | one word x 0.03-0.30 y 0.80 beside him | y 0.63-0.72 under chin | moves (by hair, mid-plate, over photo words) | bottom-left of panel | bottom-left |
| Joins | 8-frame dissolve in panel, face never cut | same | 10-frame crossfade face<->graphic | blur whip in panel, face never cut | hard cut between camera sizes | hard switches of whole layout | hard cuts to/from full-frame stills | - |

Two invariants across all five good cuts: his face keeps one fixed place for the whole body (3 cuts never leave him; Jobs leaves only for blocks of 4-17 s); real images and motion live inside one fixed region, enter and leave there, sized to fill it, never on his face.

## 2. Rejected-cut failures (frames in shots/)
1. Card over face, Tue 17 short 56-60 s: "OUR CALL" at y 0.49-0.71 over brow (B2_short_t56.5/58.5/60.0.jpg, cmp_B2a.jpg). config/failures.json card-drawn-over-his-face says "Wed short"; it is the Tue 17 file.
2. Layout thrash, Tue 17: 14 switches; four 1 s no-face runs at 9, 24, 29, 45 s; face replaced by full-frame photos at 9, 21-24, 39-44, 81-83 s (cmp_B2b.jpg).
3. Suspected generated stand-ins for real photos, Tue 17: MAYOR plaque 9 s; WELCOME TO PIQUA / NO DATA CENTRES sign with crane 39-44 s (_t40.0.jpg). Truth risk.
4. One flat device repeated with no new state, Tue 17: isometric data-centre box at 5-8, 17-23, 25-29, 50-55, 76-79 s (_t5.0.jpg).
5. Captions wander, Tue 17: stacked grey/white by his hair at 1.5 s; mid-plate; over the photo's own lettering at 40 s.
6. Generated full-frame cutaways, Wed 18 long: 11 stock-style stills, 100 s (crocodile 22-33, 82-95 s; shredder 144-155 s; puppy 174-185 s; bedroom clock 208-219 s ...). None carries a fact.
7. Real evidence too small on blur, Wed 18: headline cards 0.13-0.27 width on enlarged blurred copy (_t12.0.jpg); panel empty blur >=60 s (_t64.0.jpg).
8. Title as its own long card, Wed 18: 6 s full frame at 34-39 s, not tied to his line (_t36.0.jpg).
9. Empty panel, 9 s cut: dark ghost texture fills 60%; face 0.11 width vs 0.18 in the good wide cut (B3_9s_t1.0.jpg vs G1W_charai_wide_t40.0.jpg, cmp_B1.jpg).

## 3. Proposed grammar (APPROVED by Krish 20 Nov, with: one staging per cut; generated imagery NEVER)

Shot types (coordinates are shares of the frame):
1. BAND (Character.ai). 9:16: panel y 0-0.52; face band 0.52-1.0; face width 0.45-0.55, centre x 0.50 +-0.05; eyes y >= 0.68; head inside band. 16:9: face column 0.32 wide (608 px) full height, on the RIGHT (Krish 19 Nov), panel the rest. Real image fills >= 0.85 of panel width with a source line. All motion inside panel. Caption pill on the seam y 0.50-0.55, never over the face band. 8-frame dissolve inside the panel; face band never cuts.
2. STAGE (AI music). 9:16: panel y 0-0.64 rounded bottom; him cut out bottom right, face centre x 0.78 +-0.06, width ~0.21; head may cross panel edge. 16:9: panel y 0-0.81, him bottom right. Real image fills the panel (clip, grid of clips, chart). Motion in panel. Caption one word x 0.03-0.30, y 0.78-0.85 beside him. Blur whip in panel only.
3. ANCHOR (Athletic, Jobs face beats). 9:16: face is the frame; eyes y 0.30-0.44; face width 0.17-0.37. 16:9: NOT ALLOWED until a good wide face-as-frame cut is measured. Real objects only as props at his scale in his world (beside chest y 0.55-0.80) or a giant number behind him via matte; never a flat card over him. Graphics only above head (y < face top - 0.03) or chest band (0.60-0.80). Caption y 0.63-0.78. Hard cut between camera sizes, 3-7 s each.
4. PLATE (Jobs graphic blocks; Anchor cuts only). Full-frame graphic, no face; only data devices, quotes or real documents. Quote form: source doc <= 0.30 width in a corner, quote set large; or a screenshot as one card 0.85 wide. Caption keeps the cut's face-beat y. 10-frame crossfade to/from face; each block >= 4 s.
5. IN-WORLD NUMBER. Hero number/word at head height behind him via matte, 0.4-0.6 of frame height, 1-6 s; slams in on the spoken word; cuts out on next camera size.
6. CHAPTER MARK. Numeral/label beside or behind him <= 1.5 s; he stays on screen. Hard in/out.
7. TITLE LOCKUP. Builds in the panel as he says the line (<= 4 s), then one full-frame lockup <= 2 s, then back to the same staging. Or behind him via matte while he talks. No captions while it holds.
8. END CARD. Full frame 3.5-5 s. Hard cut in.

Transition matrix (from -> to): BAND/STAGE -> same (in-panel dissolve/whip) yes; -> ANCHOR no; -> PLATE no; -> NUMBER yes in panel; -> CHAPTER yes; -> TITLE yes; -> END yes. ANCHOR -> BAND/STAGE no; -> ANCHOR yes (hard cut other size); -> PLATE yes crossfade; -> NUMBER, CHAPTER, TITLE, END yes. PLATE -> BAND/STAGE no; -> ANCHOR yes crossfade; -> PLATE yes crossfade; -> NUMBER, CHAPTER, TITLE no; -> END yes. TITLE -> back to the same staging only.

Sequencing rules:
- R1 one staging per cut (BAND, STAGE or ANCHOR for the body; additions only PLATE on ANCHOR cuts, TITLE, CHAPTER, END).
- R2 face share >= 90% of the body on BAND/STAGE/ANCHOR; >= 45% on an ANCHOR+PLATE cut (Jobs 48%).
- R3 no flicker: every with/without-face run >= 4 s; <= 4 switches a minute (Jobs 3.5/min; Tue 17 9.9/min).
- R4 panel never empty: blur alone never > 0.5 s.
- R5 a device returns only with a new state; <= 3 appearances a cut, never back to back (a through-line object excepted only if every appearance changes its state).
- R6 real images >= 15% of runtime; each >= 0.55 frame width or fills its region; words >= 40 px; enter/leave only inside the region.
- R7 captions: one zone per cut, same y every beat (+-0.02); never inside face box plus margin; never over words inside a picture.
- R8 panel state holds 3-12 s with an event every <= 3 s.
- Generated imagery: NEVER (Krish 20 Nov), superseding the study's "small inset" proposal.

## 4. Engine: has / conflicts / missing
Has: BAND/STAGE geometry apps/renderer/src/engine/kit/staging.ts:77 (seam 1000 px = 0.52), :83 (stage edge 1236 = 0.64), :94 (pillar 608 = 0.317); face keep-out scripts/velib/keepout.py:1-35; head in frame / bottom right wide config/ve/frame-checks.json:134; title lockup INGREDIENTS.md:335-372 and frame-checks.json:101; evidence words >= 40 px config/ve/onscreen-checks.json:29; screenshot crop config/ve/piece-guards.json screenshot_crop; steady captions scripts/velib/lint.py:222, config/ve/caption-steady.json; one picture per beat config/ve/pre-show-checklist.json:6; plain dark bands scripts/velib/plainframes.py:64; no identical adjacent beats lint.py:686; generated moves need yes config/ve/plate-moves.json.
Conflicts: layout variety lint.py:715-719 with config/ve/formats/face-with-proof.json:42 (3 layout types/min; 4 in voice-led-pictures.json:37) forces switching (piece-guards.json:38 "added just to make up its third layout type" is a symptom); face-with-proof.json:39 face_share_max 0.6 caps face below every good cut (dead: nothing reads it); staging.ts:23 graphics-only beat = full-frame takeover; layouts/index.ts:22-45 P1/P3/P6/F1/F3 slots over a full-frame take where his face is; piece-guards.json:75-76 max_bare_share counts beats with no events, not empty panels; treatments.json:119 pivot-split adds a layout change.
Missing: R1, R2, R3, R4, R5 across the cut (lint.py:749 novelty only vs earlier pieces, advisory), R6 size floor and region, R7 zone constancy, generated limits, 2 s full-frame title cap, in-world matte numbers and chapter marks (no device).

Smallest pre-render checks: grammar.staging, grammar.face_runs, grammar.region, grammar.evidence_size, grammar.generated (now: refuse any generated asset), grammar.repeat, grammar.caption_zone.

Inferred, not measured: 16:9 rules rest on one good wide cut; ANCHOR at 16:9 unmeasured; "generated" on Tue 17 photos is visual judgment (check asset origins); face shares from hand log cross-checked against a Haar detector.
