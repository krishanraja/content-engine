# Deployment

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
MindmakeVideoStudio/control-center-radar-token
```

Use the interactive writer so the value never appears in shell history:

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/mm-ctrl-radar-token
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-radar-token
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
git clone https://github.com/krishanraja/mindmake-video-studio.git "$env:USERPROFILE\Documents\MindmakeVideoStudio\runner-source"
Set-Location "$env:USERPROFILE\Documents\MindmakeVideoStudio\runner-source"
git switch --detach <approved-40-character-commit>
npm ci
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/verify-runner-source.ps1 -RequirePersistentLocation
```

Do not install source or keep runtime state in `%LOCALAPPDATA%`, a Codex worktree, or another application-managed location. Packaged applications can virtualize LocalAppData while npm records workspace junctions and runtime state against the logical path. The resulting checkout can look complete while Node cannot traverse its internal packages, and an outside Scheduled Task can see a different Python or job root. The preflight rejects LocalAppData, requires the dedicated Documents source and runtime locations for task installation, verifies a clean exact Git commit, checks every workspace link and package hash, and starts the CLI before it permits task registration.

Before installing the task, run `studio v2 inbox init`, then two scans separated by the configured stability interval against a harmless owned fixture. Confirm the local status contains no absolute path and that a candidate remains review-only. A missing mount, missing Inbox, permission failure, or bounded-scan limit must keep cloud claims paused.

The runner uses two separate Windows Generic Credentials:

```text
MindmakeVideoStudio/control-center-runner-token
MindmakeVideoStudio/control-center-runner-signing-key
```

The first is the dedicated bearer accepted only by runner endpoints. The second must match the server-side `VIDEO_STUDIO_RUNNER_SIGNING_KEY` and signs receipt hashes. It is distinct from the bearer and from the durable local approval and decision ledger key:

```text
MindmakeVideoStudio/approval-signing-key
```

Enter all values interactively. The local ledger key never leaves the machine and must remain stable for the lifetime of the signed job history:

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-token
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-signing-key
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/approval-signing-key
```

After the matching Control Center API and server-side credentials are live, verify the local prerequisites from that dedicated checkout and install the task:

```powershell
$env:MINDMAKE_RUNTIME_ROOT = "$env:USERPROFILE\Documents\MindmakeVideoStudio\runtime"
npm ci
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/migrate-runner-runtime.ps1
npm run bootstrap:python
.\scripts\studio.ps1 doctor
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-runner-task.ps1
Start-ScheduledTask -TaskName "Mindmake Video Studio Runner"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/runner.ps1 -Mode status
```

The runtime migration is copy-only. It never deletes or overwrites either root. Existing target files must match the legacy file byte-for-byte or migration stops for manual review. It preserves jobs, signed events, learning, reviews, radar data, runner identity and receipts, plus unknown future state. It skips only pinned Python, browser binaries, caches, the rebuildable SQLite index, and the obsolete LocalAppData source clone. The task preflight reruns the migration in check-only mode, so a legacy file added or changed after migration blocks installation instead of silently forking history.

The task runs as the current interactive user without storing a Windows password. Its wrapper pins the same non-virtualized runtime used by the interactive CLI. It starts at logon, starts when available, may start on battery power, continues when the device switches to battery, is hidden, restarts after failure, and ignores a second concurrent instance. Installation reads the registered task back and fails if either battery setting drifted. It has no network-only start condition because it must report honest offline state and replay local receipts after connectivity returns. It still requires the user to be signed in and the device to be awake; battery resilience does not turn the Windows host into an always-on cloud worker.

The runner also requires an exact clean checkout: its configured repository root must equal Git's actual top-level path, `HEAD` must be a real 40-character commit, `MINDMAKE_SOFTWARE_COMMIT` must be absent or equal to that commit, and no tracked or untracked source file may differ. Project publication and command claiming fail closed when provenance is unknown. Install from a clean committed revision, never from this implementation working tree.

The implementation in this repository does not itself install the Scheduled Task, deploy Control Center, or configure any credential. Those remain explicit operator actions. A merged code change is not an installed runner, and an installed runner is not a verified live control-plane integration until `doctor`, task status, project bootstrap, claim, proxy upload, completion, and cloud readback all succeed.

To rotate the bearer, stop the task, replace the server and local bearer values, then restart and read back runner status. To rotate the signing key, first require `pending_receipts: 0`; then stop the task, rotate the server and local signing values together, restart, and verify one signed completion. If an unacknowledged receipt exists, restore its prior signing key until reconciliation completes rather than discarding the journal.

## Deployment checks

Before enabling the weekly radar:

1. Merge the adapter PRs after CI and review.
2. Configure the dedicated secret in Vercel and Supabase.
3. Deploy `video-radar-export` through the repository's normal Supabase deployment path.
4. Confirm missing, empty, and incorrect bearer values return 401.
5. Confirm authenticated responses set `Cache-Control: no-store`, do not set wildcard CORS, and contain no raw database IDs or private canaries.
6. Run `studio radar pull` against both providers and against the committed offline fixtures.
7. Compare the prepared automation with `config/weekly-radar-heartbeat.json`, then activate the Monday 11:00 Europe/London heartbeat only after these checks pass. Update the existing automation rather than creating a duplicate.

If either provider is unavailable, the weekly run records the failure and uses any available feed. It never starts a replacement scraping path.

## Proactive delivery

`config/weekly-radar-heartbeat.json` is the GitHub authority for the schedule, source branch, delivery policy, and replayed prompt. The runtime automation stores only operational state such as active or paused status and its attached Codex thread ID.

At 11:00 Europe/London each Monday, the heartbeat posts its brief into that attached Codex thread. The Codex app then applies Krish's normal notification settings to the thread update. A new chat launched with `Video engine` does not automatically take ownership of the heartbeat, so the delivery location stays predictable. Moving it to another thread is an explicit automation update; do not create a second weekly radar.

## Publishing

The YouTube credential must be a short-lived OAuth access token stored as `MindmakeVideoStudio/youtube-access-token`. Store a refreshed token with the same interactive writer. The upload command requests and verifies `private` status. No public upload mode exists. LinkedIn, TikTok, and Instagram Reels remain local packages. `studio doctor` reports missing credentials without placing their values in diagnostics.
