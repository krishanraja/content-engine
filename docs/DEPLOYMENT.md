# Deployment

> Scope: the Video and Carousel Studio. For the whole system start at `README.md`. Its known stale passages are listed in `docs/STUDIO.md`, "The detailed Studio documents".

## Upstream review order

The adapter implementation is split into independently reviewable pull requests:

1. Control Center secure export: `krishanraja/control-center#244` (merged).
2. Control Center existing-route security follow-up: `krishanraja/control-center#246` (merged). PR #245 was superseded to keep the security review independent after #244 merged.
3. mm-ctrl cached radar export: `krishanraja/mm-ctrl#371` (merged).

The verified upstream main commits are pinned in `config/studio.json`. Recheck main before merging if either pull request becomes stale.

## Secrets

Create two separate strong random provider-token values. Configure the mm-ctrl value as `VIDEO_STUDIO_EXPORT_TOKEN` only in its Supabase project, and configure the different Control Center value under that same provider-local key only in its Vercel project. Store each matching value locally in its own Windows Generic Credential:

```text
MindmakeVideoStudio/mm-ctrl-radar-token
MindmakeVideoStudio/control-center-radar-token-v2
```

Use the interactive writer so the value never appears in shell history:

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/mm-ctrl-radar-token
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-radar-token-v2
```

Configure provider URLs through environment variables:

```text
MINDMAKE_MM_CTRL_URL
MINDMAKE_CONTROL_CENTER_URL
```

Do not add the token, Supabase service-role key, OAuth credential, biometric descriptor, or customer data to a repository, `.env` file, job manifest, fixture, log, or command line.

The optional Krish recognition key uses `MindmakeVideoStudio/krish-identity-key`. The identity-enrolment command can generate it inside Windows Credential Manager without displaying it. The encrypted face template remains under the ignored local runtime root. Only its fixed identity and version hash may appear in a manifest; guest identity data is never persisted beyond a job.

## Independent runner setup

Set the control-plane API base URL as environment configuration, never as a credential:

```text
MINDMAKE_CONTROL_PLANE_URL=https://controlcenter.krishraja.com/api/video-studio/runner
MINDMAKE_PREVIEW_STORAGE_ORIGIN=https://<project-ref>.supabase.co
MINDMAKE_RUNTIME_ROOT=%USERPROFILE%\Documents\MindmakeVideoStudio\runtime
MINDMAKE_DRIVE_ROOT=G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine
MINDMAKE_MEDIA_INBOX=G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine\Inbox
MINDMAKE_ARCHIVE_ROOT=G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine\Archive
MINDMAKE_DISCOVERY_STABILITY_SECONDS=30
MINDMAKE_DISCOVERY_MAX_FILES=500
MINDMAKE_DISCOVERY_MAX_ENTRIES=2000
MINDMAKE_DISCOVERY_MAX_DEPTH=4
MINDMAKE_DISCOVERY_HISTORY_RETENTION_DAYS=365
MINDMAKE_DISCOVERY_REVERIFY_SECONDS=86400
```

The Control Center URL is production-pinned and an override must be absent or exactly equal to that value. Set the preview origin to the exact public origin of the dedicated Supabase project, with no path, credentials, query, or fragment. The runner rejects HTTP, local/private destinations, cross-origin signed upload URLs, redirects, and upload routes outside Supabase Storage's signed-object path.

Use a dedicated, non-virtualized checkout for the background runner. The supported source location is `%USERPROFILE%\Documents\MindmakeVideoStudio\runner-source`:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Documents\MindmakeVideoStudio"
git clone https://github.com/krishanraja/content-engine.git "$env:USERPROFILE\Documents\MindmakeVideoStudio\runner-source"
Set-Location "$env:USERPROFILE\Documents\MindmakeVideoStudio\runner-source"
git switch --detach <approved-40-character-commit>
npm ci
$env:MINDMAKE_RUNTIME_ROOT = "$env:USERPROFILE\Documents\MindmakeVideoStudio\runtime"
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/migrate-runner-runtime.ps1
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/verify-runner-source.ps1 -RequirePersistentLocation
```

Do not install source or keep runtime state in `%LOCALAPPDATA%`, a Codex worktree, or another application-managed location. Packaged applications can virtualize LocalAppData while npm records workspace junctions and runtime state against the logical path. The resulting checkout can look complete while Node cannot traverse its internal packages, and an outside Scheduled Task can see a different Python or job root. The preflight rejects LocalAppData, requires the dedicated Documents source and runtime locations for task installation, verifies a clean exact Git commit, checks every workspace link and package hash, and starts the CLI before it permits task registration.

Before installing the task, run `studio v2 inbox init`, then two scans separated by the configured stability interval against a harmless owned fixture. Confirm the local status contains no absolute path and that a candidate remains review-only. A missing mount, missing Inbox, permission failure, or bounded-scan limit must keep cloud claims paused.

The runner uses two separate Windows Generic Credentials:

```text
MindmakeVideoStudio/control-center-runner-token-v2
MindmakeVideoStudio/control-center-runner-signing-key-v2
```

The first is the dedicated bearer accepted only by runner endpoints. The second must match the server-side `VIDEO_STUDIO_RUNNER_SIGNING_KEY` and signs receipt hashes. It is distinct from the bearer and from the durable local approval and decision ledger key:

```text
MindmakeVideoStudio/approval-signing-key
```

Enter all values interactively. The local ledger key never leaves the machine and must remain stable for the lifetime of the signed job history:

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-token-v2
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-signing-key-v2
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/approval-signing-key
```

After the matching Control Center API and server-side credentials are live, verify the local prerequisites from that dedicated checkout and install the task:

```powershell
$env:MINDMAKE_RUNTIME_ROOT = "$env:USERPROFILE\Documents\MindmakeVideoStudio\runtime"
npm ci
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/migrate-runner-runtime.ps1 -CheckOnly
npm run bootstrap:python
.\scripts\studio.ps1 doctor
.\scripts\studio.ps1 index rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-runner-task.ps1
Start-ScheduledTask -TaskName "Mindmake Video Studio Runner"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/runner.ps1 -Mode status
```

The installed task combines an at-logon trigger with a five-minute recovery
trigger. The latter is a local watchdog only: `IgnoreNew` prevents duplicate
daemons, while an interrupted daemon is restarted inside the current
interactive session without waiting for another logon or a Codex session.

Before replacing an existing task, stop it and require the runner singleton to become explicitly inactive:

```powershell
Stop-ScheduledTask -TaskName "Mindmake Video Studio Runner"
$stopPreflight = powershell -NoProfile -ExecutionPolicy Bypass -File scripts/runner.ps1 -Mode stop-preflight | ConvertFrom-Json
if ($stopPreflight.active -ne $false) { throw 'The prior runner process is still active; do not inspect, migrate, install, or start a replacement.' }
Disable-ScheduledTask -TaskName "Mindmake Video Studio Runner"
if ((Get-ScheduledTask -TaskName "Mindmake Video Studio Runner").State -ne 'Disabled') { throw 'The prior task did not become disabled.' }
$stopPreflight = powershell -NoProfile -ExecutionPolicy Bypass -File scripts/runner.ps1 -Mode stop-preflight | ConvertFrom-Json
if ($stopPreflight.active -ne $false) { throw 'The prior runner restarted during the stop transition; do not continue.' }
```

This check detects an orphan from the former PowerShell to npm to tsx launcher chain. Do not terminate an unidentified process. Verify the exact old daemon, confirm that it is idle with no pending or conflicted receipt or project journal, and reconcile any authority evidence before an explicit operator-approved termination. The installer first runs a strictly read-only singleton probe that does not load a signing key, initialize identity, migrate authority state, or touch a journal. Unless that probe returns exactly inactive, it refuses the later full status check and `Register-ScheduledTask -Force`. When an old task exists, the installer then disables it, verifies `Disabled`, and repeats the read-only probe before full status can migrate anything. Any subsequent failure leaves the registered task disabled.

The runtime migration is copy-only. It never deletes or overwrites either root. Existing target files must match the legacy file byte-for-byte or migration stops for manual review. It preserves jobs, signed events, learning, reviews, radar data, runner identity and receipts, plus unknown future state. It skips only pinned Python, browser binaries, caches, the rebuildable SQLite index, and the obsolete LocalAppData source clone. The task preflight reruns the migration in check-only mode, so a legacy file added or changed after migration blocks installation instead of silently forking history.

The task runs as the current interactive user without storing a Windows password. Its action is the exact absolute Node 24 executable with the repository's absolute tsx loader imported in-process and the absolute runner entry point; it never launches PowerShell, npm, cmd, or the process-spawning tsx CLI. Task Scheduler therefore owns the actual daemon rather than a disposable wrapper. The runner entry point independently pins the same non-virtualized runtime used by the interactive CLI. The task starts at logon, starts when available, may start on battery power, continues when the device switches to battery, is hidden, allows Task Scheduler's hard-terminate fallback, restarts after failure, and ignores a second concurrent instance. Installation reads back the exact executable, arguments, working directory, enabled state, hard-terminate capability, and both battery settings, disabling the task if any field drifted. It has no network-only start condition because it must report honest offline state and replay local receipts after connectivity returns. It still requires the user to be signed in and the device to be awake; battery resilience does not turn the Windows host into an always-on cloud worker.

After installation, prove the lifecycle before activation: start the task, require full status `active: true`, stop it, require both Task Scheduler state `Ready` and read-only stop preflight `active: false`, then run full status, start it again, and require a healthy status. A stopped task whose read-only preflight is not exactly inactive is a release blocker. Do not run the potentially migrating full status or continue to projection or command tests until the exact daemon has stopped.

The runner also requires an exact clean checkout: its configured repository root must equal Git's actual top-level path, `HEAD` must be a real 40-character commit, `MINDMAKE_SOFTWARE_COMMIT` must be absent or equal to that commit, and no tracked or untracked source file may differ. Project publication and command claiming fail closed when provenance is unknown. Install from a clean committed revision, never from this implementation working tree.

The implementation in this repository does not itself install the Scheduled Task, deploy Control Center, or configure any credential. Those remain explicit operator actions. A merged code change is not an installed runner. After any credential change, `npm run probe:runner-credentials` proves the bearer and signing key against production without leasing or writing work. An installed runner is not a verified live control-plane integration until that probe, `doctor`, task status, project bootstrap, claim, proxy upload, completion, and cloud readback all succeed.

To rotate the bearer, stop and disable the task, create a fresh versioned LocalMachine credential target, replace the matching Vercel Secret, update the active constant, then reinstall the exact clean commit and verify runner status. Never reuse the three quarantined unversioned names.

The signing key authenticates retained claims, receipts, project journals, conflict records, acknowledged cursors, and the external runner-authority marker. A deliberate change must use `scripts/rotate-runner-signing-key.ts --commit --new-credential-target <new-versioned-target>` while the task is disabled. The script verifies every old signature, creates a full backup, changes only hash-bound runner signatures, rereads them under the new key and never accepts or prints a key value. It deliberately excludes approval-ledger and review-binding signatures because those use a separate body-signing trust root. After migration, update the active constant and deploy the matching Vercel Secret before restarting. Never delete, edit or re-sign authority records by hand.

## Projection cursor protocol rollout

Deploy the matching Control Center migration and API first. Stop the old Scheduled Task before enabling the new Studio runner. Confirm every existing platform row is at a root state with no active candidate or parent lineage, and confirm there is no queued or leased command. Then update the clean runner checkout, run `npm ci`, run the full repository verification, and start the new task.

The first projection from a new runner release sends the authenticated local source event count, event-chain hash, and semantic source revision. A pre-existing root platform row may adopt that tuple only when its complete protected state already equals the requested base state. Further pre-existing platforms may adopt the same exact source tuple under the same exact-state rule. Active, mismatched, partial, or in-flight states fail closed. After adoption, every projection uses the exact signed acknowledged platform cursor as its compare-and-swap predecessor.

The temporary omitted-expectation compatibility branch exists only for the controlled rollout from the prior runner. Remove it in the next control-plane schema major after all installed runners have an acknowledged cursor. Do not restart an older runner after the source tuple has been adopted.

## Deployment checks

Before enabling Control Center editorial radar refresh:

1. Merge the adapter PRs after CI and review.
2. Configure the dedicated secret in Vercel and Supabase.
3. Deploy `video-radar-export` through the repository's normal Supabase deployment path.
4. Confirm missing, empty, and incorrect bearer values return 401.
5. Confirm authenticated responses set `Cache-Control: no-store`, do not set wildcard CORS, and contain no raw database IDs or private canaries.
6. Run `studio radar pull` against both providers and against the committed offline fixtures.
7. Confirm the Control Center refresh schedule writes prepared opportunities to Content without chat delivery.

If either radar provider is unavailable, `studio radar pull` records the failure and imports any available feed. The Studio holds no schedule of its own; the refresh cadence belongs to the Control Center schedule. Neither side starts a replacement scraping path.

## Proactive delivery

There is no chat pulse. `config/video-engine-pulse-heartbeat.json` records the retired automation and its pull-only replacement. Scheduled discovery and editorial preparation write rows into the Control Center Content surface. Krish sees new opportunities and runner attention when he opens Control Center. No scheduled job initiates a conversation or posts into an LLM thread.

The Control Center refresh remains preparation-only. It never creates a Studio job, inspects editorial media, moves a file, uploads, publishes, or changes an approval. `studio radar pull` remains available for authenticated evidence diagnostics and offline fixture recovery, not as a second editorial ranking system.

## Publishing

The YouTube credential must be a short-lived OAuth access token stored as `MindmakeVideoStudio/youtube-access-token`. Store a refreshed token with the same interactive writer. The upload command requests and verifies `private` status. No public upload mode exists. LinkedIn, TikTok, and Instagram Reels remain local packages. `studio doctor` reports missing credentials without placing their values in diagnostics.
