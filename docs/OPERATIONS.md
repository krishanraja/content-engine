# Operations

## Source and state

GitHub is authoritative for source, configuration, schemas, tests, and skills. Runtime state defaults to `%LOCALAPPDATA%\MindmakeVideoStudio` and is never committed. Approved job folders may be copied to `MINDMAKE_ARCHIVE_ROOT`.

Every job contains `job.json`, append-only `events.jsonl`, immutable stage artifacts, media, renders, and platform packages. If the SQLite index is lost, rebuild it with:

```powershell
npm run studio -- index rebuild
```

CLI success is exit code `0`. Stable failure categories are `10` validation, `20` policy or approval block, `30` external service, `40` media tool, `50` job state, and `1` unexpected. Stdout is machine-readable JSON; diagnostics and errors use stderr.

## Setup

1. Install Node 24, Python 3.12, Git, FFmpeg and FFprobe.
2. Run `npm ci`.
3. Run `npm run bootstrap:python`. It creates the reusable `%LOCALAPPDATA%\MindmakeVideoStudio\python` runtime and installs only hash-locked wheels from `requirements.lock.txt`. New disposable GitHub checkouts reuse this runtime. The first renderer run similarly seeds its versioned Chrome Headless Shell under `%LOCALAPPDATA%\MindmakeVideoStudio\browser`; later checkouts reuse it.
4. Confirm Remotion licence eligibility and record the approved basis in `config/studio.json`. `MINDMAKE_REMOTION_LICENSE_CONFIRMED=true` remains an emergency runtime override, not the durable authority.
5. Set the runtime root if desired. The media base and archive defaults are versioned in `config/studio.json` and mirrored in `.env.example`.
6. Store provider tokens as Windows Generic Credentials:
   - `MindmakeVideoStudio/mm-ctrl-radar-token`
   - `MindmakeVideoStudio/control-center-radar-token`
   - `MindmakeVideoStudio/youtube-access-token`
   Use `scripts/set-credential.ps1 -Target <target>` so the value is prompted securely rather than passed on the command line.
7. Run `npm run studio -- doctor`.

The YouTube credential is a short-lived OAuth access token. If it expires, replace the credential through the OAuth administration flow; never put it in a repository file or command argument.

## Typical extracted-video run

```powershell
npm run studio -- job create --series money_of_ai --mode extract --source "C:\media\episode.mp4" --rights permissioned --consent-note "Guest promotional clipping cleared"
npm run studio -- ingest --job <job-id>
npm run studio -- transcribe --job <job-id>
npm run studio -- candidates --job <job-id>
npm run studio -- candidates --job <job-id> --input <codex-authored-candidate.json>
npm run studio -- approve --job <job-id> --gate angle --artifact <candidate-json-path>
npm run studio -- treatment --job <job-id> --candidate <candidate-json-path> --overlays <evidence-overlay-plan.json>
npm run studio -- approve --job <job-id> --gate treatment --artifact <render-manifest-path>
npm run studio -- render --job <job-id>
npm run studio -- qa --job <job-id>
npm run studio -- approve --job <job-id> --gate final --artifact <master-video-path>
npm run studio -- package linkedin --job <job-id> --archive
```

The first candidates call creates discovery material only. Inspect the verified transcript and author the strongest continuous or stitched `CandidateV1`, including `edit_plan`, `editorial`, and any rerecord guidance, then import it with `--input`. Angle approval re-runs the gate from the transcript, pinned configuration, and job identity, so editing away stored blocks does not bypass the policy.

Solo and short-native jobs default the known presenter to Krish; use `--presenter` only when the source has another verified primary speaker. Identity correction is limited to self-introduction context so a real guest named Chris remains Chris.

If automatic transcription is uncertain, correct a copy of the `TranscriptDocument` and import it with `studio transcribe --job <job-id> --verified <transcript.json>`. The original content-addressed transcript remains in the job history. Proper nouns, numbers, products, legal wording, and consequential claims remain blocked until the approved candidate ledger records verification.

For source or visual calibration, create the job with `--purpose calibration`. Calibration previews omit series branding and are technically blocked from final rendering, packaging, and upload. Preview renders use the first six seconds at 270x480 and 15 fps, and are content-addressed in the local cache. Use `--preview-seconds <n>` or `--full-preview` deliberately when more footage is needed. Add `--high-quality-preview` only after a treatment survives the proxy review; it produces a full-resolution 1080x1920, 30 fps review without converting the calibration job into a publishable final. Final renders remain 1080x1920 at 30 fps.

## Recovery

- `studio status` shows every stage and approval.
- `studio resume` identifies the first pending or invalidated stage.
- Stage artifacts are content-addressed. Do not edit them in place.
- If an approved artifact is changed externally, import it through `studio feedback import`; then create a new downstream artifact.
- Provider failure does not block supplied-source jobs. Radar output records the failed provider and source age.

## Publishing boundary

The LinkedIn command creates local files only. The YouTube command rejects every privacy value except `private`, requires final approval and passing QA, and checks the API response confirms private status.
