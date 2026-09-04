# Mindmaker Video Studio

A deterministic, Codex-operated production and learning system for The Money of AI and Built With AI.

The studio optimizes honest reach, retention, sharing, and qualified action. It does not promise virality, invent counterarguments, publish publicly, or turn performance data into taste rules.

## Authority and boundaries

- GitHub owns code, schemas, configuration, tests, and repo-scoped skills.
- Local runtime folders hold replaceable media, caches, OAuth state, immutable job artifacts, and the rebuildable SQLite index.
- Approved job folders can be archived to Google Drive with masters, captions, cover, manifests, approvals, claims, assets, provenance, and platform packages.
- Secrets are read from Windows Credential Manager. They never enter Git, media manifests, or command arguments.
- Every approved master can produce native YouTube Shorts, LinkedIn, TikTok, and Instagram Reels packages. YouTube upload is private-only; the other three remain local packages for human posting.

## Quick start

```powershell
npm ci
npm run bootstrap:python
.\scripts\studio.ps1 doctor
.\scripts\studio.ps1 v2 job create --series money_of_ai --mode extract --source-bundle "C:\media\episode.source-bundle.json"
.\scripts\studio.ps1 v2 ingest --job <job-id>
```

The Python command creates one hash-locked media runtime under `%LOCALAPPDATA%\MindmakeVideoStudio\python`. Disposable GitHub checkouts reuse it rather than reinstalling transcription dependencies per session. The first renderer run also seeds a versioned shared Chrome Headless Shell under the same runtime root.

Set `MINDMAKE_RUNTIME_ROOT` for fast local scratch storage. The versioned defaults use `G:\My Drive\Ventures\Active\Mindmaker\04\_Content\Video Engine` as the media base and its `Archive` folder for approved deliverables. Rendering remains policy-blocked until Remotion licence eligibility is explicitly recorded.

In any new Codex chat, launch the workflow by making the complete first message `Video engine` (case-insensitive, with surrounding whitespace allowed). The launcher deliberately does not trigger for `$video-engine`, punctuation, extra words or lines, a later message, or a generic request to edit a video. It fetches the latest GitHub `main`, runs health and queue checks, and recommends the strongest next action.

The proactive radar is an active Codex heartbeat whose GitHub contract is [config/weekly-radar-heartbeat.json](config/weekly-radar-heartbeat.json). It runs every Monday at 11:00 Europe/London and posts the result into the Codex thread to which the automation is attached. Codex app notification settings determine whether that thread update also produces a system notification. Starting a new Video Engine chat does not silently move the heartbeat; changing its destination is an explicit automation update.

## V2 visual story director

V2 treats a Short as a directed visual argument rather than a captioned crop. Its immutable dependency graph is:

```text
ingest -> normalize -> transcript + source analysis -> candidates + claims
       -> visual plan -> exact assets -> styleframes -> animatic
       -> treatment -> render -> QA -> four platform packages
```

The source analysis can align multiple cameras, track subjects, shot boundaries, gestures, gaze, protected face/body regions, negative space, and active-speaker confidence. Optional persistent recognition is encrypted locally and is only for Krish; guests remain job-local and are never added to durable biometric memory. Uncertain analysis produces a conservative stable crop or mixed-program fallback rather than a confident guess.

Every beat declares what the viewer should attend to and why. The planner may keep Krish primary, share the frame with approved proof, guide attention through a document, cut to full-screen evidence when inspection is genuinely necessary, or use clearly labelled generated illustration. Exact screenshots and generated outputs are hash-approved before use. New treatments require phone-size styleframes and an audio animatic before a full render.

The three treatment lanes are restrained, premium, and experimental. Experimental work is limited to one principal unproven hero technique per Short. Local processing is the default; optional cloud generation receives only the exact approved clip or frame and has a £15 per-job ceiling unless Krish separately approves more. Synthetic speech is prohibited.

## CLI surface

```text
studio doctor
studio radar pull
studio v2 identity status|enroll|revoke
studio v2 job create|status|resume
studio v2 ingest
studio v2 transcribe
studio v2 candidates
studio v2 recording-brief create
studio v2 source analyze
studio v2 visual-plan context|import
studio v2 assets prepare|verify
studio v2 styleframes create
studio v2 animatic create
studio v2 treatment register
studio v2 render
studio v2 qa
studio v2 approve
studio v2 feedback import|confirm
studio v2 package create|archive
studio v2 publish youtube --privacy private
studio v2 analytics import
studio v2 experiment create|evaluate|list
studio index rebuild
```

V2 is the production surface for new work. The V1 commands remain only so existing V1 jobs can be resumed. Run `studio --help` and `studio v2 --help` for the machine-readable command groups.

The validated V2 production entry points are `studio v2 ingest`, `studio v2 transcribe`, `studio v2 candidates`, `studio v2 recording-brief create`, and `studio v2 source analyze`. Inspect the V2 queue with `studio v2 job status` and resume a job with `studio v2 job resume --job <job-id>`. Extract and solo jobs require a source bundle when created. Short-native jobs intentionally do not: they begin with a brief and an editorially assessed script, require exact angle approval, create a specific recording brief, and attach the recorded source bundle only afterwards. Replacing that take invalidates media-dependent stages without discarding the approved upstream script.

Use `studio v2 job create --purpose calibration` for analysis-only source calibration. Those jobs render unbranded previews and cannot create masters, platform packages, or uploads. `studio v2 render --job <job-id> --profile preview` renders and caches a representative six-second 540x960, 30 fps first-beat proxy; use `--preview-seconds <n>` for a deliberate longer window. The animatic is 270x480 at 30 fps, while styleframes remain 1080x1920 stills. Human-corrected timing documents can be imported with `studio v2 transcribe --job <job-id> --verified <transcript.json>`.

Approved treatments are structured, scoped presets rather than globally trusted string IDs. The studio can apply `evidence-kinetic-ribbon-v1` only to Built With AI solo work with an approved evidence packet and verified transcript-word captions. The preset still requires a per-job layout review because presenter composition changes. The active `mindmake-video-v1` theme is pinned to the current `krishanraja/mindmake` design contract and was added after the calibration approval. The approval is for the exact combined layout, composition and theme, not a promise that a matching name is safe.

Every branded render uses the official GitHub-pinned Mindmake wordmark plus the official wordmark for its series. The renderer downloads the exact assets from the pinned `krishanraja/mindmake` commit, verifies their SHA-256 values, caches them locally, and fails closed rather than recreating either mark as text. Alpha-bound cropping removes transparent padding without altering the asset pixels. The approved lockup stacks Mindmake above the matching series mark inside one compact ink square in the top-left. Minimum rendered dimensions and square fit are validated before rendering.

`studio v2 candidates` without `--input` produces discovery windows only. Codex must author a `CandidateV1` with an exact edit plan and editorial assessment before angle approval. The gate checks removal-only caption wording, semantic and audience-value scores, ending strength, cut boundaries, source-order decisions, and conditional cold-open logic. If the source cannot clear the bar, the candidate remains blocked and carries specific rerecord guidance instead of forcing a video.

Evidence is a separate approval gate. Before capture, Codex presents a source-and-headline shortlist and recommends one option. `studio v2 assets prepare --evidence-overlays <plan.json>` validates source authority, freshness, headline specificity and consequence, spoken-claim match, visual legibility, corroboration, and minimum reading time before producing the exact screenshot contact sheet. Generic listicles, guides, marketing pages, weak sources, and stale news fail closed. The visual plan is approved first so the screenshots have a defined narrative job and placement; no screenshot enters styleframes or an animatic until Krish approves its exact evidence packet and the asset verifier binds that approval to the file hash. It can use face-safe layering or a deliberate evidence inspection shot, but never covers the meaningful subject by accident. The renderer records attribution and rights provenance and supports deterministic clean or kinetic captions. Use full-resolution rendering only after the low-resolution proxy, exact assets, styleframes, and animatic survive review.

Stdout is JSON. Diagnostics use stderr. Stable failure codes are documented in [operations](docs/OPERATIONS.md).

## Design

- [Architecture and contracts](docs/ARCHITECTURE.md)
- [Deployment and secret setup](docs/DEPLOYMENT.md)
- [Four-week pilot](docs/PILOT.md)
- [Operations and recovery](docs/OPERATIONS.md)
