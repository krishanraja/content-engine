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

Set `MINDMAKE_RUNTIME_ROOT` for fast local scratch storage and `MINDMAKE_ARCHIVE_ROOT` for the approved Google Drive archive. Rendering remains policy-blocked until Remotion licence eligibility is explicitly confirmed.

## CLI surface

```text
studio doctor
studio radar pull
studio job create
studio ingest
studio transcribe
studio candidates
studio approve
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

Stdout is JSON. Diagnostics use stderr. Stable failure codes are documented in [operations](docs/OPERATIONS.md).

## Design

- [Architecture and contracts](docs/ARCHITECTURE.md)
- [Deployment and secret setup](docs/DEPLOYMENT.md)
- [Four-week pilot](docs/PILOT.md)
- [Operations and recovery](docs/OPERATIONS.md)
