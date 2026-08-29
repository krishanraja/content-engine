# Mindmaker Video Studio

A deterministic, Codex-operated production and learning system for The Money of AI and Built With AI.

The studio optimizes honest reach, retention, sharing, and qualified action. It does not promise virality, invent counterarguments, publish publicly, or turn performance data into taste rules.

## Authority and boundaries

- GitHub owns code, schemas, configuration, tests, and repo-scoped skills.
- Local runtime folders hold replaceable media, caches, OAuth state, immutable job artifacts, and the rebuildable SQLite index.
- Approved job folders can be archived to Google Drive with masters, captions, cover, manifests, approvals, claims, assets, provenance, and platform packages.
- Secrets are read from Windows Credential Manager. They never enter Git, media manifests, or command arguments.
- YouTube upload is private-only. LinkedIn produces local files only.

## Quick start

```powershell
npm ci
npm run bootstrap:python
.\scripts\studio.ps1 doctor
.\scripts\studio.ps1 job create --series money_of_ai --mode extract --source "C:\media\episode.mp4" --rights permissioned
```

The Python command creates one hash-locked media runtime under `%LOCALAPPDATA%\MindmakeVideoStudio\python`. Disposable GitHub checkouts reuse it rather than reinstalling transcription dependencies per session. The first renderer run also seeds a versioned shared Chrome Headless Shell under the same runtime root.

Set `MINDMAKE_RUNTIME_ROOT` for fast local scratch storage. The versioned defaults use `G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine` as the media base and its `Archive` folder for approved deliverables. Rendering remains policy-blocked until Remotion licence eligibility is explicitly recorded.

In any new Codex chat, the installed `$video-engine` launcher is implicitly triggered by the initial prompt `Video engine`. It fetches the latest GitHub `main`, runs health and queue checks, and recommends the strongest next action.

## CLI surface

```text
studio doctor
studio radar pull
studio job create
studio ingest
studio transcribe
studio candidates
studio approve
studio evidence prepare
studio treatment
studio render
studio qa
studio feedback import|confirm|rules|broaden|promote
studio analytics import
studio experiment create|evaluate|list
studio benchmark transcription
studio package linkedin
studio publish youtube --privacy private
studio status
studio resume
studio index rebuild
```

Use `studio job create --purpose calibration` for analysis-only source calibration. Those jobs render unbranded previews and cannot create finals, platform packages, or uploads. `studio render --preview` renders and caches a representative six-second 270x480, 15 fps first-beat review proxy by default; request a longer window or add `--full-preview` only after a treatment is shortlisted. Human-corrected timing documents can be imported with `studio transcribe --verified <transcript.json>`.

Approved treatments are structured, scoped presets rather than globally trusted string IDs. The studio can apply `evidence-kinetic-ribbon-v1` only to Built With AI solo work with an approved evidence packet and verified transcript-word captions. The preset still requires a per-job layout review because presenter composition changes. The active `mindmake-video-v1` theme is pinned to the current `krishanraja/mindmake` design contract and was added after the calibration approval. The approval is for the exact combined layout, composition and theme, not a promise that a matching name is safe.

`studio candidates` without `--input` produces discovery windows only. Codex must author a `CandidateV1` with an exact edit plan and editorial assessment before angle approval. The gate checks removal-only caption wording, semantic and audience-value scores, ending strength, cut boundaries, source-order decisions, and conditional cold-open logic. If the source cannot clear the bar, the candidate remains blocked and carries specific rerecord guidance instead of forcing a video.

Evidence is a separate approval gate. Before capture, Codex presents a source-and-headline shortlist and recommends one option. `studio evidence prepare --candidate <candidate.json> --overlays <plan.json> --strategy <summary>` then validates source authority, freshness, headline specificity and consequence, spoken-claim match, visual legibility, corroboration, and minimum reading time before staging exact content-addressed screenshots. Generic listicles, guides, marketing pages, weak sources, and stale news fail closed. After Krish approves the exact packet hash, pass it to `studio treatment --evidence-packet <packet.json>`. Direct overlays fail closed. Each beat declares whether the viewer should stay with Krish, share the frame with a simple artifact, or deliberately cut away to proof. The renderer records attribution and rights provenance and supports deterministic clean or kinetic captions. Use `studio render --preview --full-preview --high-quality-preview` only after the low-resolution proxy survives review.

Stdout is JSON. Diagnostics use stderr. Stable failure codes are documented in [operations](docs/OPERATIONS.md).

## Design

- [Architecture and contracts](docs/ARCHITECTURE.md)
- [Deployment and secret setup](docs/DEPLOYMENT.md)
- [Four-week pilot](docs/PILOT.md)
- [Operations and recovery](docs/OPERATIONS.md)
