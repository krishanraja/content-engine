# ve: the video engine

Read this and [RUNBOOK.md](RUNBOOK.md), then the signed spec and <=36 KB pack (`ve start`). Do not load NOW.md, WORKBENCH.md, learnings or failures while producing. Never read big files, individual images or raw logs into context: use QC JSON and one contact sheet.


**Design:** what a frame must look like, and the gates that enforce it, is `docs/ve/design/TEMPLATE.md` with the lock `config/ve/design-lock.json` (F19). A format or device card is refused until its lock is frozen.

## Why ve exists

Friday 23 Oct took a 62-hour thread, about 253M tokens, and four rejected cuts. Bespoke code bypassed gates, receipts were self-written, and prose rules lacked enforcement. ve uses one signed spec, one data-fed composition, specialists as code and measured readiness.

## The pieces

| Piece | Where |
|---|---|
| Spec: creative-direction.json, schema_version 2 | `packages/contracts/src/production-spec.ts`; `packages/contracts/scripts/check-spec.ts` |
| Formats (data, not code) | `config/ve/formats/*.json` |
| Crew: sections, lints, QC, cards | `config/ve/crew/<id>.{json,card.md,lens.md}` |
| Invariants | `config/ve/invariants.json` |
| Brand/motion roles | `config/ve/brand-tokens.json` |
| Tools/rulings | `config/ve/tools.json` |
| CLI and libraries | `scripts/ve.py`, `scripts/velib/*.py` |
| Usage and clock | `config/ve/budget.json`; piece `ve/ledger.jsonl`, separate `ve/clock.json` |
| Device capabilities | `config/ve/devices.json`; renderer `devices/registry.ts` and `devices/CONTRACT.md` |
| Renderer | `apps/renderer/src/engine/` (one `FormatMaster`, BrandFrame, devices) |
| Best practice | `_corpus/motion-design-video-corpus.md`, cited by section in each card |
| Caption styles (27) | `apps/renderer/src/engine/captions/` (`names.ts`, `kit.ts`, `draw.tsx`, `themes.tsx`, one file each in `styles/`) and `chrome/ArtDirectedCaption.tsx`; picked with `style.captions` (theme and placement), apart from the motion style ([INGREDIENTS.md](INGREDIENTS.md)) |
| Transitions, camera, energy | `apps/renderer/src/engine/kit/ingredients.ts`; picked with `style.transitions`, `style.camera`, `style.energy` ([INGREDIENTS.md](INGREDIENTS.md)) |
| Treatments (effects applied by rule, never chosen; video and stills) | `config/ve/treatments.json`, planned by `scripts/velib/treatments.py`; built by the `docs/ve/cards/treatments/` cards ([TREATMENTS.md](TREATMENTS.md)) |
| Pace | `scripts/velib/pace.py` (`ve pace`), compared with `config/ve/pace-references.json` |
| A bed's beat | `scripts/velib/beats.py` (`ve beats`; ve qc's advisory `music.beats` row): tempo, bars, drops and a confidence, no grid under 1.5; measured, never snapped to (his words are the clock) |
| The per-beat motion plan | the motion-designer skill (`.agents/skills/motion-designer/SKILL.md`), written into the spec before Sign storyboard |
| The style lab | `lab/styles/` (one folder per built style, `STYLE.md` and `scene.mjs`); `lab/styles/README.md` |
| The moves (one copy, for the lab and ve) | `packages/moves/` (`@mymu/moves`, plain ES modules, `draw` or `update` from t); `lab/moves/` keeps the gallery, the check and re-exports |
| 3D | `three` and `@remotion/three` in `apps/renderer`; renders use software WebGL (`gl: 'swangle'` in `scripts/ve-render.mjs`), so a 3D device renders the same on every machine |
| Channel safe zones | `config/channel-safe-zones.json`, read by `scripts/channel_safe.py`, `velib/qc_channel.py` and the lab's `check.mjs` |

## Protocol

Commands, outputs and 55-minute envelope: RUNBOOK.md. Batch questions; end sessions at gates. Krish-wait is separate.

| Step | Action | Who |
|---|---|---|
| S0 | doctor, start pack, ledger, start clock | Claude/scripts |
| S1 | Two treatments, lint, stills; Gate 1: treatment, stills, bed, credits merged into storyboard sign-off. The stills show both lead pictures, the series picture from the brand book and a story object, with Claude's pick marked; his signature accepts it unless he ticks the other, and no gate waits on a tick (under test, `docs/production/THE_BAR.md`; recorded with `making.py <piece> choices --lead-picture ...`) | Director/Claude, Krish |
| S2 | New hero only: card, dispatch --piece while Krish records, verify acceptance/golden stills | Claude dispatches/verifies; Codex builds |
| S3 | ingest each take with two aligners' word clocks; conform: takes line by line, flubs out, joins only in agreed gaps, one speed, EDL | script |
| S4 | Fresh Director session: lint, compile cut-ready timings/assets | Claude/scripts |
| S5 | Trial format/device: render excerpt proof; Gate 2 acceptance | script, Krish |
| S6 | Render each accepted cut | script |
| S7 | QC --props, <=2 fix loops, fresh Critic, final packet; Gate 3: watch cuts/hear joins reel | scripts, Claude, Krish |
| S8 | file READY cuts to the archive and the post's `3 Video` folder, bound to piece_id; stop clock | script/Claude |

In `config/ve/formats/*.json` face-with-proof is `proven`; hand-held-screen, two-passports, scoreboard-test and voice-led-pictures are `trial`. `config/ve/devices.json` registers 43 devices (18 Nov 2026: `photo_plate` added), the same 43 the renderer's `devices/registry.ts` draws; format lists also name future devices. Compile refuses device verbs absent from devices.json. test_grid draws carry with a dashed box and ANSWER DELETED outline text.

## CLI

Run commands as `python scripts/ve.py <command>`:

```text
doctor
start <piece>
lint <spec>
qc <cut> --format <format> [--out <path>] [--props <props>]
study <ref> [--out <path>]
card <fields>
sprint start <week> --ref <ref> [--ref <ref>] | cards <week> | gate2 <device> --words <his words> --where <where> --at <date> | status
dispatch <card> [--wait] [--piece <piece>]
budget pull --read <file> | verify | hash | status
ledger <piece> reserve <provider> <amount> | settle <id> <amount>
lock spend
verify-card <card> --cwd <worktree>
status <piece>
coverage
compile <spec> --cut <cut> (--words <words.json> | --edl <edl.json>) --assets-dir <assets>
render <props> <out> --spec <spec> --assets-dir <assets> [--scale <number>]
expect <spec>
styles <spec> [--cut <cut>] [--top 3] [--points <a,b>] [--props <props>] [--scale <number>]
proof <spec> --cut <cut> [--beat <id>] [--props <props>] [--assets-dir <assets>] [--scale <number>] [--no-qc]
eyeline [<piece>] --media <take> (--backend maxine --maxine-copy <copy> [--maxine-eye] | --lens <receipt>) [--out <dir>] [--no-qc]
ingest <piece> --take <id> --media <file> --aligner-a <name> --aligner-b <name> [--clock-a <json>] [--clock-b <json>]
conform <piece> --cut <cut> [--script <words.json>] [--takes <id> ...] [--crossfade-ms 20..40] [--render --assets-dir <assets> [--joins-reel]]
said <piece> --take <id> --teleprompter <script.txt>
voice-ab <piece> --cut <cut> --assets-dir <assets> --at <s> [--seconds 10]
sfx audition <piece> --cut <cut> --assets-dir <assets> --candidates <id> ... [--at-frame <n>] [--beat <id>] | approve --id <id> --words <his words> --on <date> --audition <sfx-audition.json> | stage --assets-dir <assets>
brief <piece> [--cut <cut>] [--beat <id> ...] [--move <beat>=<move> ...] [--check <dir> --plate <id>]
golden show|check|fill <slot> --reference <file> --at <mm:ss.s> --said <his words>
signoff check | stills <piece> --cut long|short --out <dir> [--at <m:ss.s,...>] | gate2 <props> --out <dir> | add <card> --item <json> --file <local> | apply
init <piece> [--format <clip format>]
refs <piece> <cut>
lock draft <format> --aspect 9:16|16:9 --beats <b> ... [--modules <format> ...] --anatomy <md> --motion <md>
stills [rest ...]
ledger <piece>
ledger <piece> add <kind> <amount> [--note <text>]
time <piece> start <phase>
time <piece> stop
time <piece> status
file <piece> --subject <text> [--date <YYYY-MM-DD>] [--cut <cut> ...] [--dry-run]
```

Also: `comp`, `keyframes`, `lock check|show|freeze`, `fonts`, `lane`, `verdict write`, `packet`, `premix`, `receipt`, `faces` and `lab` (RUNBOOK.md, STATUS.md; `ve <command> -h`). `stills` is a placeholder (exit 2), apart from `ve lab stills` (below); quick-edit is fallback. Never claim complete ve production from unavailable stages.

**One production round (plan 4 Nov 2026; F04, F13).** **expect** writes `<ve dir>/expect.md`, at most six plain lines of what the cut will and won't do, each only when it applies (`velib/expect.py`). **styles** renders the same 8 to 15 s window of his take once per shortlisted motion style (`creative_direction.pick_motion`, top 3; a style whose device is not built is left out and named) to `styles/<module>.mp4` and `styles.json`, each option's props carrying its own `motion` (the style id and its profile from the renderer's `kit/motion-profiles.json`, which the renderer draws; see STATUS.md for the ten styles drawn and the seven that need a device); with no take it uses his last take of the same format, labelled, never stock. Only distinct options are offered (`config/ve/style-distinct.json`): it renders the house look on the same window to `styles/house.mp4`, leaves out first a style whose own effect touches no device in the window (named, reason `no_device_in_window`), samples 6 frames of every clip at 270 px wide in greyscale with ffmpeg, scores every pair by mean absolute difference and offers a style only when it differs from the house and every option already offered by at least the threshold; a look-alike (`look_alike`, with its score and the clip it resembles) gives way to the next ranked drawable style, two distinct options are offered with a `note` saying so, and fewer than two refuse. `styles.json` carries `house`, `distinctness` {threshold, frames, width, pairs} and each option's `differs`. **proof** renders only the hardest beat (`velib/proof.py`: `style.proof.beat`, else most distinct devices, then a SPLIT beat with a card, then the longest) from the compiled props, cut to that window on the same clock and rendered by the same `render`, then runs qc on it; it writes `proof/<cut>.mp4` and `proof/<cut>.json` {beat, start, end, sha256, spec_sha256, style_module}. From `creative_direction.MOTION_FROM` (9 Nov 2026) `render` of a whole cut, `packet` and `status` refuse unless Krish approved that proof by its sha256 and `proof.structural_hash` (style.motion, the device set, each beat's id, uses and layout; never caption text) still matches, and the beat has not moved 0.5 s or more. His presses are read from the piece's making record, `gates.{storyboard,style,proof,final}` (`velib/gates.py`, GET `/api/content-ideas/<id>/making`, the uuid from the plan folder's `post.json`), and from the spec's own `approvals`; the record wins, and offline it says NOT CHECKED. A proof press that names its `cut` counts only for that cut; the final press binds each cut in `gates.final.cuts` ({long, short}: file sha256s), and `gates.storyboard.sha256` is `gates.storyboard_sha` (canonical JSON of expect.md and storyboard.md, LF). `packet` opens with "In short" (at most ten lines), counts `rounds` in `packet.record.json` and writes it to the making record (the route refuses session writes to `gates`, never `rounds`).

**eyeline** corrects his eye contact on a take before ingest and writes `<take>.eyeline.mp4`, with the take's own sound and every frame time kept: the reading drift and the glances by a push of his own eye (Maxine's own eye on the big glances is opt-in, `--maxine-eye`, and failed two blind reviews). How to record for it, make the Maxine copy, run it, review it and fix a refusal: [`EYE_CONTACT.md`](EYE_CONTACT.md).

**ingest** writes `<piece>/ve/takes/<take>.json`: the media's path, SHA-256 and duration (the media is never copied) and both aligners' words. Two different aligners are required. Clocks arrive as files (ve or faster-whisper shapes); only a free local `faster-whisper:<model>` is ever run by ingest. There is no paid aligner (Krish, 2026-10-29: "do not use eleven labs for this"); two local models count as two aligners.

**conform** is the dialogue editor (F09). It splits the signed script (`<piece>/ve/script.words.json`, words `w` from 0) into lines, finds each line's readings in every take on aligner A's words, and chooses one per line over the whole cut: fewest unscripted words kept, then fewest joins, then most words both aligners heard, then the later take. A flub is removed with a cut only in a gap both aligners agree on (`velib/gaps.py`: at least 80 ms, 30 ms clearance); with no such gap it plays through and is listed for his ear. Joins crossfade over 20 to 40 ms (default 30). The approved `edit.speed` (with `speed_said`) applies to picture and sound in one ffmpeg graph. It writes `edl.<cut>.json` and `words.<cut>.json`; the F09 lint re-derives every gap from the take records and refuses a bad EDL. `--render` writes `conformed.<cut>.mp4` and `dialogue.<cut>.wav` under the assets folder; `--joins-reel` writes `joins.<cut>.wav` for Gate 3. `compile --edl` takes the EDL (its words, the conformed picture) and `qc --edl` measures its joins, on the finished file's clock, which is the cut's own: nothing goes before the hook.

**file** files only cuts `ve status` calls READY, through `scripts/quick-edit/archive.py` (`MINDMAKE_ARCHIVE_ROOT`) and the library rules of `scripts/post-pack/library.py` (`MINDMAKE_LIBRARY_ROOT`, `3 Posts/<post>/3 Video`), re-hashing each file first and never overwriting; it writes `ve-<piece_id>.json` beside the videos and `filed.json` in the piece. Shadow cuts are compared, not filed.

**brief** writes `briefs/<plate>.brief.json` and `<plate>.card.json` (fields for `ve card`) per plate slot: the point, the line and duration, slot geometry, style recipe, a named move (`config/ve/plate-moves.json`), the eight floor nevers from `scripts/floor.py`, acceptance tests and the tool route; 2 treatments x 4 candidates; the Critic ranks the eight and blocks only on a never or a failed test. It never dispatches. `--check` runs the mechanical acceptance on a candidate folder.

**signoff** (Ruling, Krish, 2026-11-12: the three video sign-offs are one review card each on his board, with samples, and only his presses write the configs) makes the samples for the To review cards (`stills` cuts candidate frames from a published cut's library copy, `gate2` renders one 16:9 still per locked beat through `ve-render.mjs --stills`, `add` records a sample filed in Drive with its sha256) and `apply`, run by `signoff-apply.yml` on his press, writes his answers into `config/sfx-approved.json`, `config/ve/golden-frames.json` and `config/ve/design-lock.json` (docs/PUBLISH_BOARDS.md, "To review"). An approved sound is filed first, its exact bytes, in the brand kit's Music folder at `sfx/<id>.<ext>` (the library path `1 Brand kit (permanent)/Music/sfx/`, which the home computers' sync writes into Drive and `music.py fetch` brings anywhere). `compile` stages each approved sound a cut uses from `MINDMAKE_MUSIC_ROOT` into its assets, checked by sha256, and stops by name when it is not on the machine; `render` refuses props whose sound file is missing. A sound the spec asks for is never dropped.

**lock draft** writes an unfrozen entry under `drafts` in the design lock with one empty key-frame slot per beat; a 16:9 entry is `<format>@16:9` on a 1920x1080 canvas. Only `lock freeze` with Krish's Gate 2 stills turns a draft into a lock; the formats a draft names become modules then. **golden** holds 5 to 10 Production Inspo moments he names (`config/ve/golden-frames.json`), filled only with his words; Monday 26's moments serve meanwhile.
All commands accept `-h` / `--help`. Render scale defaults to 1 and must be
finite and positive. Render requires the source spec and the same staged assets
folder used to compile it, so lint and asset hashes are checked before rendering.

Compile/render lint first: findings print, exit 1, no new output. Words need unique indexes, text, ordered onset_s and finite numeric end_s >= onset_s. The onset-only 19-second fixture needs real aligned ends; synthetic test ends are not alignment. Compile refuses unapplied source edits and includes only objects in the cut's beat `uses`. Phase 1 refuses asset plates and used generated-asset references, in compile.py's own words: "asset plates arrive in Phase 2". Media paths must be relative and contained under assets, never URLs/absolute paths.

Captions use exact Archivo-heavy widths, aspect geometry/swipe padding. Pages: 2-5 words, <=2 lines, prefer punctuation; a single word only if it fills a line. With `brand.captions: "word"` (face-with-proof's default) the renderer shows each page one word at a time. With `style.captions.theme` (or, older, `brand.caption_theme`) set, a caption style draws the same pages instead of the house caption, in the placement `style.captions.placement` names; all 27 are listed in [INGREDIENTS.md](INGREDIENTS.md), inside every platform's safe area (`apps/renderer/src/engine/captions/`). `art-directed` is the one Krish picked (Anton phrases that build as he speaks, the key word alone at 168 px, phrases alternating sides, a faint echo behind; card instagram_DfkCOCLt7KZ; `chrome/ArtDirectedCaption.tsx`). `cinematic` is Audrey's cinematic caption system (github.com/audrey-560/hyperframes-cinematic-caption, MIT, rebuilt for ve): mixed-case support words in a cascade, one scored hero per page in silver tinted glass at hero scale, layout states rotating between pages, no fake depth. The other 13 (`pop`, `karaoke`, `kinetic-01`, `kinetic-02`, `hustle`, `grape`, `beast`, `poppin`, `aarit`, `soft-ai`, `gaming-stream`, `simple-one-word`, `podcast`) keep the ideas of vshukla7/remotion-captions-themes but are the house's own builds in the house faces and tokens (Krish, 2026-11-11: "None of other styles are amazing you need to improve them all 10X"); each is described where it is drawn, `captions/themes.tsx`. Oversize words are refused by name. Dialogue: `round(last end_s * 30) + 12` frames. Whole cuts with a call add a 105-frame ending; captions stop at its start. Excerpts have no ending.

SFX kits: `config/ve/sfx-kits/<audio.sfx_kit>.json`, names mapped to `{ "path": "sfx/name.wav", "gain_db": -6 }` under assets. Kits are absent today; referenced sounds are omitted/reported, as are unknown names in present kits. Compile writes `props.<cut>.json` and `compile.<cut>.json` in the piece's ve folder; report: lint clean, sfx_missing event ids, props_sha256. Non-empty sfx_missing blocks status. Never mark intended sounds silent to hide gaps. Staged spec assets with declared SHA-256 must match; mismatches name the asset/refuse render.

Render transports string values as ASCII escapes, decoded for drawing. It measures AAC lag against the stem, corrects offsets >1 ms without re-encoding video, prints lag/residual, and fails if residual >1 ms. This does not replace QC. In Bash `. scripts/ve-env.sh` pins ffmpeg n8.1.2 and puts tesseract on PATH. QC --props supplies sync, joins, OCR, brand and cue inputs. Nothing goes before the hook on any cut (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for good."), so QC's `opening` row (`velib/qc_opening.py`) passes only a file that holds exactly `durationFrames` frames whose first frames are none of the retired sting clips this machine holds, and fails props that carry a sting or an episode card (`qc.lead_frames` is 0). Missing OCR is not_run. Exit 0 means measured checks pass, possibly incomplete; require measured_pass and complete, then status exit 0.

## New capabilities: ingredients, 27 caption styles, three styles from his cuts, `ve pace` (13 Nov 2026)

**Read [INGREDIENTS.md](INGREDIENTS.md); it is the one reference.**
- A spec now chooses its caption style and placement (`style.captions`), transitions (`style.transitions`), camera
  (`style.camera`) and energy (`style.energy`), each apart from the motion style. With none chosen, a cut renders
  exactly as before.
- There are 27 caption styles.
- Three motion styles come from his own cuts: `character-ai-receipts`, `eating-jobs-ladder` and `ai-music-slam`.
- `ve pace CUT.mp4` measures pace and frame use beside his references and those cuts.
- The motion floor widened the same day (Ruling, Krish, 2026-11-13: "yes it should"): an entrance settles in 4 to 10
  frames, travels 0 to 500 px and overshoots at most 12% ([MOTION_STANDARD.md](MOTION_STANDARD.md)).

## New capabilities: how a session uses them (11 Nov 2026)

Each line says what the capability is, where it lives and the one thing a session does to use it. The decisions are
Krish's; his words are in the commits and in `docs/ve/STATUS.md`.

- **The vertical screen, end to end.** Nothing he must read sits under any platform's buttons, and the content uses
  the top of the screen (Krish, 11 Nov: "make maximum use of the full screen"; "stay within the boundaries of all the
  social platforms"). On 9:16: key content in x 60 to 860, from y 280 (under the top bar at 270) to y 1050; the house
  caption x 60 to 860, y 1090 to 1320; the word caption centred at y 1250; the held title from y 290; a SPLIT caption on
  the seam. Footage, grounds, 3D and the end card stay full bleed. The table is `MOTION_STANDARD.md`, Channels. A
  session never places words by hand: the layouts (`layouts/index.ts`), `HOUSE.caption` and the design lock's caption
  zone carry it, and `ve qc` `channel.safe_zones` fails a box that strays. The lock's older format zones (header,
  headline, lower line, marquee, platform) still predate this and are open (`STATUS.md`, Cannot do yet).
- **No wordmark over vertical content.** The 9:16 cut carries no wordmark, mark tile or series tag over its animated
  content and no animation ever passes over a wordmark; the closing outro card keeps the wordmark (Ruling, Krish,
  2026-11-11; `MOTION_STANDARD.md` rule 3). The 16:9 cut keeps its pill; from pieces published on 23 Nov it carries no
  mark tile and no header logo either (Ruling, Krish, 2026-11-17: the logo only on the animated title frame and the
  close; `docs/production/BRAND_PALETTE.md`, compile's `bodyLogo: false`, and `ve qc` then proves the mark absent).
  Before that date it keeps its mark tile, and nothing may overlap it.
- **Caption styles.** A spec sets `brand.caption_theme` to one of 15 names (`captions/names.ts`); with none, the house
  caption draws. Since 13 Nov there are 27, picked with `style.captions`, which wins over `brand.caption_theme` (above). `art-directed` is the one Krish picked; `cinematic` is Audrey's system (one scored hero word per page
  in silver tinted glass, support words in a cascade, layout states rotating); the other 13 are house rebuilds. Every
  style takes ve's caption pages and timing, the house faces and tokens, and stays in the safe area. Not yet proved on
  his take: prove a style on one before a cut ships with it, by setting `brand.caption_theme` in the spec and running
  `ve proof` (the hardest beat on his real take, through the one render path) for his Approve proof press. Every
  caption style keeps three rules (Krish, 2026-11-18; `INGREDIENTS.md`, "The caption rules"): a new word never appears
  somewhere else, the previous word or phrase stays a little longer, and nothing jolts. `ve lint` refuses a style that
  moves its word on a word-mode cut (`captions.steady`, measured in `config/ve/caption-steady.json`), and a proof of a
  caption is watched frame by frame at 30 fps on his take, never judged from stills.
- **Motion styles from the lab.** A piece's `style.motion` names one style in the bank (`config/style-references.json`,
  motion layer). `ladder` (The Ladder: one lit 3D object carries every number) and `living-screen` (The Living Screen:
  a working interface the camera reads for the viewer) joined on 11 Nov, liked by Krish, and are `needs_device`: since 14 Nov 2026 `ve lint` refuses a spec
  naming them (`motion.not_drawable`), where before it rendered in house motion (cards `docs/ve/cards/styles-3d/`: the
  prerequisite, 3D and the moves package, landed 11 Nov; `ladder_stage` landed 11 Nov and `living_screen` 12 Nov; each style routes to its device only after Krish's yes on its test render). A 3D device brings `@types/three` (a dev dependency of `apps/renderer`) and fills its whole device box with one `ThreeCanvas` given whole-pixel sizes, framing any words inside the 9:16 words-safe zone with its camera (`living_screen`'s `safeBox`); any plate it loads is staged by `ve-render.mjs`. How a lab style reaches ve: `lab/styles/README.md`, "From the lab to ve".
- **Two things called "lab".** `ve lab render` (`velib/lab.py`) renders the house and word caption builds and the
  bank's drawable styles on one window of his pinned take (`config/ve/lab.json`), to check the house look has not
  moved; it renders a caption style from `config/caption-themes.json` only when `--only` names it (`theme-<id>`, 15 Nov
  2026), so the regression reel never grows by itself, and `ve lab sample` records a render filed in Drive as the
  sample Pick a style shows on the board (`config/ve/style-samples.json`). The style lab (`lab/styles/`, `render.mjs`) is where a new
  style is designed and proved as a whole cut, outside the renderer. They are different tools.
- **Stills for the board's pickers** (Krish, 16 Nov 2026: "I should be able to hover over the captions, look, and motion
  style and see a templated screenshot of what it might look like. No need for a video, just a still."). `ve lab stills`
  cuts one 540x960 JPEG from each drawable motion style and each caption style the lab rendered (`--only` narrows it;
  with `--take` and `--brand-dir` it renders them first), every one at the same frame of the pinned window
  (`velib/lab.py` `STILL_FRAME`, frame 445, where a caption page and a device have both settled), into `<out>/stills/`
  under `.cache`, never the repository, and prints its manifest (`stills.json`: id, layer, path, sha256, width,
  height). Once he has looked at them and each is filed in Drive, `ve lab still <layer> <id> --drive <its Drive id>
  --file <the jpg>` records it in `style-samples.json`'s `stills` map (with its Drive id in `stills_drive`), served by
  the same Drive file route as a sample. A look's still (layer `treatment`) comes from a design-lock key frame or a
  Codex plate and is recorded the same way. It refuses a style the lab cannot draw (`needs_device`), an unknown id or
  layer, a malformed Drive id, and a file that is not a JPEG of about 540x960 or, for motion and captions, not the
  lab's own still.
- **What makeyourmindup.ai shows.** The engine's publication watcher (`apps/control-plane/api/publish/watch.ts`,
  hourly) records each piece's Substack post, YouTube video and Short as they go live, and
  `GET /api/publish/catalogue` serves them to the site (which takes each article's cover from Substack itself). Nothing in ve publishes; a session never edits the site's
  copy of a video by hand.

## Frame checks from the Tue 17 and Wed 18 lists (19 Nov 2026)

Krish found twelve faults on Tue 17 and six on Wed 18 himself, most with a rule already written. `scripts/velib/qc_frames.py`
reads `config/ve/frame-checks.json` (each block quotes his words, and holds every number) and adds these `ve qc` rows on any
aspect: `beats.one_carrier`, `figures.shown`, `transition.ghost_cut` and `transition.no_ghost_frames`, `backdrop.not_flat_black`,
`brand.render_current`, `text.no_off_day_props` and `text.no_off_day_frames`, `title.moment` and `title.stage_width`,
`takes.restarts`, `motion.first_seconds`, `head.whole_in_frame` (his whole head, and bottom right on 16:9). `ve lint` adds
`title.card` (title_moment.card), `takes.restarts` (a kept restart names `at_s` and `why`: `cuts.<id>.kept_restarts`) and
`text.no_off_day`. `ve qc --spec SPEC.json` supplies the publish day and the kept restarts. A piece published from `binds_from`
is counted; before it the rows are advisory (F33). A row that cannot read its render, its words or a face detector is `not_run`,
never a pass. Already measured before and unchanged: `captions.off_face`, `plate.head_in_band` (9:16 SPLIT), `brand.no_mark`,
the R128 bed shape. To add a row for the next fault: the header of the config file (a block with his words, one pure function in
`qc_frames.py`, a good and a bad case in `tests/ve_frame_checks_test.py`, a `config/failures.json` entry naming that test).

## Hand-built composites

A one-off composite (Ruling, Krish, 2026-11-10: "One-off composite") is built outside ve, so none of ve's gates see
it. It carries these itself (`config/failures.json` F53, F55 and av-sync-drift-converted-take):

- **Cues from the forced clocks.** Every cue is timed from the take's two forced-aligner clocks
  (`<piece>/ve/takes/<take>.json`), never from `script.words.json` or any whisper transcript. Whisper's word times ran
  3 to 19 frames off his voice (Thursday 5 Nov), and on 7 Nov a composite's cue was planned on them.
- **Every picture keeps its aspect.** Fit a plate by cover (scale to the larger ratio, then crop the middle) and
  assert the output's dimensions before the first frame is written. On 8 Nov a plate resized from a one-row crop became
  stripes across the whole frame.
- **Two receipts for its exact bytes before filing.** `python scripts/frame_smear.py measure CUT --receipt` and
  `python scripts/av_sync.py measure CUT --take TAKE --edl EDL --receipt`; `making.py video` refuses a hand-built cut
  without both, his words on the file notwithstanding.

## Phase 3: when ve replaces quick-edit (Ruling, Krish, 2026-11-14)

Ruling (Krish, 2026-11-14): the video engine's Phase 3 pass criteria, approved as written in
`docs/proposals/2026-11-14-phase3-and-chain-cap.md` (his words: "I agree with everything else until Batch 6").
Quick-edit stays the fallback until ve passes this test, and no longer.

ve passes Phase 3 when **three consecutive series cuts** (any of Monday, Wednesday or Friday; each long cut and each
short cut counts as one) each meet all five:

1. **Made on ve end to end.** Built from one signed `creative-direction.json` (`schema_version: 2`), with no quick-edit
   step and no hand-built composition, and filed with `ve file`.
2. **His Approve cut press** is on that cut's exact bytes. The Critic's verdict alone never counts.
3. **Pace inside his house band.** `ve pace` puts the cut inside the band in `config/ve/pace-references.json` for its
   shape.
4. **Clean `ve qc`, nothing beneath the floor.** No refusal from `ve qc`, nothing beneath
   `python3 scripts/floor.py --format long_video` (or `short_video`), and none of his standing nevers.
5. **Heard and watched.** The non-producer review (`ve-critic`) watched it at full size and heard it against its script
   (`config/failures.json`, `cut-called-done-unheard`).

And, approved with them:

- **Rounds.** Each cut reaches his Approve within two full-cut rounds (`ve packet`'s round count); a third round resets
  the count.
- **No quick-edit rescue.** A cut that reached him and was then re-made on quick-edit does not count.
- **Pace as a watch, not a refusal.** A cut below every kept reference on both events per second and active frame is
  watched side by side with the slowest reference before it reaches his board; it is never refused on the number alone
  (THE_BAR). The pace line it uses prints in `ve styles`, `ve lab render` and `ve packet` (`pace.beside_references`).
  It still does not count toward the three until its pace is inside the band (criterion 3).

If any cut fails, the count goes back to zero. Once ve passes, quick-edit stays only as a read-only fallback for one more
week, then is retired by his word. The count is kept in `docs/ve/STATUS.md` ("Phase 3 count"), each counted cut named
with its piece, shape, file SHA-256 and the evidence for all five; nothing counts a cut by itself today, so the session
that files a series cut on ve updates it.

## The show gate: nothing reaches Krish before anyone has watched it (19 Nov 2026)

Krish, 2026-11-19, of the Tue 17 and Wed 18 pieces, which each reached him with a dozen faults he caught himself: "Krish was the quality check." A proof or a render is shown to him only with a **show receipt** (`show-receipt.<label>.json` in the piece's ve folder) bound to that exact file's sha256. `scripts/velib/showgate.py` builds it; the rules are rows in config, never code, so it holds for any piece:

- **qc**: `ve qc` measured every check on this file and they pass (qc.<label>.json bound to the same sha256, complete).
- **critic**: the separate Critic's verdict on this file (`verdict.<label>.json`): bound to the sha256, no blocking finding, and for a whole cut every beat viewed.
- **checklist**: every row of `config/ve/pre-show-checklist.json` (one row per thing he has had to say more than once about a cut: his words, the failure it came from) answered for this file. A row is answered by the `ve qc` rows it names when every one ran and passed; with none named, or one that did not run, the reviewer attests it in one line citing a frame or a time; a named qc row that FAILED fails the row whatever is attested. `ve critic --pre` shows the reviewer the whole list before anything is made.
- **watched**: a recorded full-size watch and listen: `ve show-record <piece> --cut X [--proof] --by NAME --frames 1.2,5,... --heard-s N --script --attest file.json` (a reviewer who is not ve; at least `watch.min_frames` frames, at least `watch.min_listen_fraction` of the audio heard, the script open beside it).

`ve show-check <piece> --cut X [--proof]` prints what is missing and writes the receipt. `ve proof` writes the pending receipt and says what is missing; `ve file` refuses a whole cut with no complete receipt; and the board's **Approve proof** press is refused (409 `proof_not_shown`, `apps/control-plane/api/board/_showGate.ts`) until a receipt for the clip's sha256 is filed on the piece (`board_session.py <piece> add <receipt> --role show_receipt`). His Reject is never refused.

Held to a piece published from `config/ve/show-gate.json` `enforce_from` (2026-11-20) and to board weeks from `board.enforce_from_week`, so a piece in production is not changed mid-piece (config/failures.json F33); an earlier date is Krish's call. `bind_unshown` (on since 2026-11-19, Krish: "yes to all 3") makes a cut that has not yet been shown meet every rule that exists on the day it is shown rather than only the rules whose `binds_from` its publish day reaches (`guards.bind_day`). **The engine stays pinned**: `engine.json` records the engine files' hash and the commit it was written at; a merge that touches no engine file (`config/ve/production-guards.json` engine.paths) changes nothing, and for one that does, `ve pin <piece>` prints the `git worktree` that keeps rendering on exactly the engine he approved. `ve defect <piece> add --words "<his words>" --where <where>` counts the faults he found himself (target zero). **Red first**: `scripts/check_ruling_linked.py` (in `npm run verify`) refuses a commit body or now-note with a video-production `Ruling (Krish, ...)` line that names no `Failure: <id>` or `Learning: <id>` line for an entry in config/failures.json or config/learnings.json (`Red-first: not needed, <reason>` is the one escape).

## Rules

- Captions always on (schema); colour roles only, never hex.
- Positions are signed-script word indexes; compile derives frames.
- One opening per cut, and nothing before the hook, ever (house rule HOOK_IS_THE_INTRO; Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good."). Every cut, 16:9 and 9:16, series or off day, puts the hook on frame 0: compile lays no sting (`sting_props`) and refuses a spec with an episode card in its place (`brand.opening_exception`), ve lint and the contract refuse a spec that names a sting (`guards.opening_problems`), ve render refuses props that carry one (`sting_problems`), and every compile report records `opening: hook`. The house sting that opened the 16:9 whole cut of a series piece from 5 Nov is retired (`config/intro-sting.json`).
- One EDL drives picture, dialogue, bed, SFX/captions. No manual mux or separate retiming; AAC correction preserves video.
- No per-piece compositions/render scripts. New hero mechanisms become library devices via cards. `npm run check:ve-route` (`scripts/ve/check_route.py`) bans per-piece code for every move in `config/ve/moves.json` whose device is registered; the weekly device sprint is `docs/ve/SPRINT.md`.
- Never hand-write a pass/receipt/ready. status checks lint, QC bound to the existing MP4 SHA, completeness, Critic verdict and Krish's exact-file approval.
- Evidence is real; a generated picture never stands in for a real place, record or test. A generated plate carries no on-screen label, tag or provenance note, and no ILLUSTRATION tag (Krish, 28 Oct 2026: "No one cares that things are AI-generated"; "Yes remove those."); its sidecar keeps the provenance. Numbers name producers; mind.the.gap ends in a dated call. No synthetic Krish without realism-test approval. Follow tools.json recipes/rulings.
- No publish/send/schedule verb.

## Codex

Every cut is held to the signed [motion standard](MOTION_STANDARD.md); each piece names one style from the bank (`style.motion`, `ve lint` `motion.required` from 9 Nov 2026). Codex is a visual asset maker (Ruling, Krish, 2026-10-28: "Visual asset maker"). It makes pictures; the engine assembles every cut. Two jobs:

- **References are board cards, by id (Wave 3, 3 Nov 2026).** Each `brand.references[]` entry carries `id`, the card's `inspiration_items.id`, with the file stem kept as `card`, its label. `ve init <piece>` offers the top card per unnamed role from `GET /api/inspiration/candidates` (production lane, not dismissed; ranked by what the card `teaches`, his word first, then the engine's read grounded in his own words on the card (`facets.style.grounded_in`; Ruling, Krish, 2026-11-17), then a bare guess; then, for role `thumbnail`, a card from a reference set he filed (`facets.collection`, his thumbnail study) and for any other role a loose card first; then his kept or liked signal, then never used, then newest; read by value, so a bulk drop never pushes out a card with his words or a read; each candidate carries the read as `style` and `grounded_in`), each marked `offered: true`. ve lint (offline, deterministic) refuses, from 6 Nov 2026, a reference with no `id` or with `offered` left. `ve refs` checks every id against `GET /api/inspiration/cards` and refuses an unknown, dismissed, strategy-lane or non-clip card, or a Drive id that is not the card's; unreachable, it prints `board NOT CHECKED` and goes on. `ve verdict` posts one `card_uses` row per reference and role with the Critic's score (`POST /api/inspiration/uses`); the making route marks them published when a channel is posted.
- **Library devices.** Claude writes exact cards from fields JSON. A card for a piece takes `spec: <the piece's spec.json>` (or `motion_style: <id>`) in its fields, and is refused when a piece due from 9 Nov names no style; and `ve card` writes that style's rules and never-list from `config/style-references.json` into the card (a style not in the bank's motion layer, or one Krish marked not for us, is refused); `ve brief` adds it to plate cards by itself. Codex builds devices in worktrees between pieces. dispatch opens the card as a permanent thread through `scripts/codex_thread.mjs` with pinned model/effort, sandbox `workspace-write` and approval `never`. verify-card reruns acceptance outside the sandbox/checks write_allow; Claude then renders golden stills/reviews one contact sheet.
- **Visual plates into named slots.** A slot is named in the spec, with its geometry, its duration and the line it sits under; Codex makes candidate pictures for it (stills first, then motion of an approved still: `docs/ve/design/TEMPLATE.md`, "Images: how plates are made"), and the engine places the chosen one. Codex never picks a slot's size, timing or position. Compile still refuses generated plates until Phase 2 (above), with one slice open since 18 Nov 2026 (Ruling, Krish, 2026-11-18: "use codex for all asset production, generation, sourcing"): a generated still or clip may fill a `photo_plate` (a full-bleed picture with cover fit, a slow push, `move` punch-ins to named regions and mint `mark` rings, built by Codex from card habits-device-1) once its spec asset names its tool, job id and sha256 and Claude has checked it with `ve codex receipt` (`compile.generated_plate_problem`). Every other device still refuses a generated picture. `ve brief` writes the per-plate brief and its card fields (above); dispatching it and the Critic's ranking of the eight candidates are not automated yet.

Card fields name `write_allow` and `read` as `[a, b]` text or a JSON list; `ve card` writes either as `[a, b]`, the form
`ve verify-card` matches against (11 Nov 2026: a list once reached the card as Python's list text and a correct build
was refused). When the lane marks a build failed, read why: if the fault is the lane's, check the pushed
`ve-card/<card>` branch yourself (its acceptance, `ve verify-card`, the stills) before spending a second run. A re-queued card whose
first attempt cannot take in the current main (the same files changed on main since) starts fresh from main by itself, and
its build replaces that first attempt on its branch only if the branch has not moved since (`cards.restart_fresh`, 15 Nov 2026).

Codex never edits a cut: it never renders, assembles, trims, retimes, captions, mixes or files a production piece, and never touches its words or audio. Its report is never proof.

### Who does what, and the Codex minimum

Ruling (Krish, 2026-11-15): video production Codex cards stay rooted in the cloud and are never shown in Codex Desktop; only social-media management, started from a Claude session on his own computer, runs where he can see it (later the same day). His words: "In actual fact we should have kept video production rooted in the cloud and not accessible in the Codex desktop app, which is fine. All social media management tasks would be started on a local machine Claude session and go through the newly built route, which would enable me to see the session in the Codex desktop app." So the "visible in Codex Desktop" below holds for social-media legwork only; every video card is built under the Studio home and counts towards the minimum all the same.

Ruling (Krish, 2026-11-15): Codex does a minimum of every video session and the social legwork, visible in Codex Desktop; Claude owns strategy, orchestration, verification and learnings; Codex never updates ai-harness or Google Drive. His words: "Claude is in charge of strategy, planning, orchestration and verification and reingestion of learnings in to the system. Codex has a lot of token avails, better art direction capability and better browser access. Codex is not to be in charge of updating AI harness or Google Drive ever, even though these things always need to be done. Codex needs to be used so I can actually see the session in my Codex Desktop app".

| Claude | Codex |
|---|---|
| Strategy, the story, the scripts, the spec, the plan for the session | Art direction: candidate looks for the named slots against `style.motion` and the inspiration cards |
| Orchestration: writes every card, dispatches it, books and settles its spend | Plates for named slots and library devices from cards |
| Verification: verify-card, golden stills, the full-size watch, the receipt | Browser legwork in Krish's signed-in browser (reference pulls, platform previews) |
| Learnings back into the system: `config/failures.json`, the floor, the cues, ai-harness | Never ai-harness, never Google Drive, never a cut, never words or audio, never a publish |
| Filing to Drive (`ve file`, the library lane) and every ai-harness proposal | |

**The minimum** is in `config/codex-minimum.json`: every whole cut of a piece published from 16 Nov 2026 needs at least one verified Codex receipt of an `art_direction`, `plates` or `device` job on the piece's own ledger. `ve status` prints it under `codex:` and `ve file` refuses the cut until it is met (`scripts/velib/codex_minimum.py`). Browser legwork is recorded too but never counts towards the minimum. After Claude has checked Codex's work, Claude writes the receipt:

    python scripts/ve.py codex receipt <piece> --card <card id> --job art_direction --evidence <contact sheet> --verified-by Claude --cwd <card worktree>
    python scripts/ve.py codex status <piece>

Codex never writes a receipt, and one naming Codex as its checker is refused: its report is never proof.

**Two routes** (Ruling (Krish, 2026-11-15): video production Codex cards stay rooted in the cloud and are never shown in Codex Desktop; only social-media management, started from a Claude session on his own computer, runs where he can see it). `ve dispatch` and the lane (`ve lane build`, the venture lane) run every video card as before 15 Nov: under the Studio's own Codex home when it is built (no MCP server, no plugin), else Codex's own default home on that machine, never the home his Desktop app reads; inside WSL a `CODEX_HOME` on a Windows drive is dropped, so the build takes the native route. `ve dispatch --visible` runs under the home his Codex Desktop app reads, found by `scripts/overnight/codex_home.py` (`desktop_home()`): `VE_CODEX_DESKTOP_HOME` when set, else `CODEX_HOME`, else, inside WSL, the Windows side's home. It is for social-media legwork a session on his own computer starts, where he attaches his browser. `--visible` sets `VE_CODEX_VISIBLE=1`, the one switch for that route: the Desktop home, and inside WSL card worktrees beside his Windows Codex home so its sandbox can open them; without it every card keeps the layout's own worktrees. `ve codex where` prints both homes. Before each card, dispatch brings the main checkout's packages up to its lockfile (`fresh_modules` in `scripts/velib/cards.py`: `npm ci` once whenever `package-lock.json` has changed, stamped in `node_modules/.ve-lock-sha256`), because a card's worktree links those packages; on 15 Nov a card failed its acceptance on a lane clone that had not installed since the 3D styles added `three`. The bullets below describe the `--visible` route.

- **Windows Codex from WSL** (fixes lane builds failing from 16:24 UTC on 15 Nov with "failed to initialize sqlite state runtime under /mnt/c/Users/krish/.codex"). The lane builds in WSL, and the Linux codex cannot open its sqlite state on his Windows home reached through `/mnt/c`. So when dispatch runs in WSL and the home is a Windows one (`/mnt/<drive>/...`), it never runs the Linux codex: `scripts/velib/codex_route.py` starts `scripts/codex_thread.mjs` with the Windows `node.exe` (found by `cmd.exe /c where node`) through WSL interop, every path in its Windows form (`wslpath -w`) and `--home C:\Users\<you>\.codex`, with the folder of the Windows `codex.exe` (`where codex`) first on PATH. codex_thread.mjs is ai-harness's canonical copy and stays byte for byte: Windows node runs an identical copy written beside the Codex home (`C:\Users\<you>\.ve-codex\codex_thread.mjs`), because the script decides it is the main script from its URL's pathname, which drops the host of a `\\wsl.localhost` path; and only a `codex.exe` will do, because the script starts `codex` without a shell, which never reaches the npm `codex.cmd` shim. The card's worktree stays on the WSL filesystem and Windows Codex reaches it as `\\wsl.localhost\<distro>\...`: verify-card, git and the acceptance commands keep running in WSL on the same files at full speed, and a worktree on `/mnt/c` would put git and node on the same mount that broke the sqlite state. verify-card finds the session by that path (`linux_form`) or by the card's name in the prompt, so receipts, `ve codex receipt --cwd` and the Codex minimum read the same thread and session file. Windows node or codex missing, or WSL interop off, stops the dispatch in one line with the fix; there is no fallback to the Linux codex. A Linux home in WSL (`VE_CODEX_DESKTOP_HOME=~/.codex`) and native Windows run `node codex_thread.mjs` as before. `ve codex route` prints the route and the exact command a card would start with, and `ve dispatch <card> --dry-run` the one for that card; neither starts anything. Before each launch on this route, dispatch starts Windows node on the staged copy once with no command (it prints its usage and starts no Codex) and stops in one line with node's own error if that fails; `ve codex route` runs the same check. On this route a card's worktree is on the Windows drive, beside the Codex home (`C:\Users\<you>\.ve-codex\worktrees\content-engine\ve-card\<card>`, `codex_route.card_root`), not on the WSL filesystem: on 15 Nov Windows Codex's sandbox refused a `\\wsl.localhost` worktree ("Set-Location returned Access denied", `Wsl/Service/E_ACCESSDENIED`). WSL git and the acceptance commands reach it through `/mnt/c`; `MINDMAKE_LOCAL_WORKTREES` set by hand still wins. On 15 Nov the first card on the route came back with only the tail of node's MODULE_NOT_FOUND, so the lane now puts the line that names the error first, and a Windows-drive path (`/mnt/<drive>/...`) is put in its Windows form directly rather than asked of `wslpath`, which may answer a path that does not exist yet with its `\\wsl.localhost` form.
- **The run's settings.** The safety the Studio home gave is carried per run by a `ve-card` profile: one marked block at the end of his `config.toml` (`[profiles.ve-card]`: approval `never`, sandbox `workspace-write`, no network, the connector and plugin features off), written from `config/codex-profile.json` by `python scripts/overnight/codex_home.py install-profile` (dispatch writes it itself when it is missing; the file as it was is kept beside it as `config.toml.before-ve-card`; nothing else in the file is touched). Since 15 Nov dispatch starts Codex through `scripts/codex_thread.mjs`, which sets sandbox `workspace-write` and approval `never` on the thread itself; the profile block stays for runs started by hand. The browser and computer use features stay on so he can attach his browser.
- **What is wider than before.** A profile cannot switch off the MCP servers his own config names (Buffer and Teleprompter among them, which he keeps: "no, we need those", 30 Oct), so a visible card's Codex can reach them. What still holds: the tool profile holds any card that names a forbidden tool, the card says never publish, verify-card refuses work outside `write_allow`, and Claude checks every result. The Saturday preflight counts such servers and names them, and fails only on the Studio home.
- **The Studio home, the video default.** Every video card runs under the Studio's own home of 30 Oct when it is built: no MCP server and no plugin, and never shown in Codex Desktop. `--studio-home` is accepted and changes nothing.
- **A title he can find.** The prompt's first line names the card, the piece and its kind ("ve card fri-plates for 2026-11-20-fri (plates): The ledger wall"); the card file itself is unchanged.
- **Where it can never work.** A Codex session started inside a cloud container (claude.ai/code, Codex cloud, a GitHub Actions job) can never appear in his Desktop app: its home is on a machine that is not his. The worker server is not his Desktop either. Visible sessions are started from a Claude session on his own computer (the desktop app, a Claude Code terminal there, or Remote Control into that computer); a cloud session queues a video card (`ve lane queue`) and his PC's recordings pass builds it under the Studio home, never shown in Desktop.
- **Receipts.** Each receipt keeps the Codex session id and whether its log sits in that home; `ve codex status` says "NOT visible in Codex Desktop" for any run that did not.

## Budget

Caps come from `config/ve/budget.json`:

| Measure per piece | Ceiling / target |
|---|---|
| Engine time after recording | 1 h target; 300 min cap (`engine_minutes_cap`: Krish raised 60 to 120 on 28 Oct, a session then 300, not confirmed by him) |
| Claude tokens | 3.3M |
| Codex tokens | 2.1M |
| Total tokens (Claude + Codex) | 12.6M |

Codex use is never counted: no allowance points, booking, reservation or credit check before a card is sent (Ruling (Krish, 2026-11-17): "We have plenty of Codex credits, you need to permanently stop counting codex credits everywhere").

The ledger also holds the piece's preflight receipts (kind `preflight`, amount 0, written by `scripts/preflight.py`), which the totals pass over and `ve brief` and `ve render` read (`docs/learning/README.md`). `ledger <piece> add <kind> <amount>` appends actual usage; kinds: claude_tokens, codex_tokens, credits, engine_seconds, krish_wait_seconds. Amounts are finite/non-negative. Ledger reports OK/WARN/OVER, credits and wait minutes; exit 1 above any cap. Add still records over-cap usage. Credits/wait have no configured caps.

At >=80% stop and ask at a gate; refuse work past caps. These are session stop rules: ledger only warns at 80%; dispatch enforces all recorded caps only with --piece; time start enforces engine time only and refuses duplicate clocks. time stop appends elapsed seconds/removes clock; time status includes live elapsed time. Ledger/dispatch totals include stopped/logged time only. Separately, every dispatch and generation reserves against the credit caps Control Center places on the publication (Krish, 2026-10-29: credits are "handled by ai-harness and control-center"): `ve budget pull --read FILE` saves its get_engine_credits answer for growth-makeyourmindup, bound to its sha256, on this machine (never committed); `ve budget verify|status` read it; a missing, held, unknown or stale read, or a provider with no pool placed, holds with that reason, and no cap is ever typed here. Runway, Higgsfield and ElevenLabs each reserve against their own pool, and Codex is never reserved or counted; a card whose tools the Codex profile (config/codex-profile.json) does not allow is held. `ve lock spend` makes the design lock's per-generation yes those caps. This replaced the per-run --spend-approved flag (29 Oct 2026, plan Wave 2, W2.6). No flag waives piece caps.
