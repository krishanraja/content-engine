# Deployment

## Upstream review order

The adapter implementation is split into independently reviewable pull requests:

1. Control Center secure export: `krishanraja/control-center#244` (merged).
2. Control Center existing-route security follow-up: `krishanraja/control-center#246` (merged). PR #245 was superseded to keep the security review independent after #244 merged.
3. mm-ctrl cached radar export: `krishanraja/mm-ctrl#371` (merged).

The verified upstream main commits are pinned in `config/studio.json`. Recheck main before merging if either pull request becomes stale.

## Secrets

Create one strong random `VIDEO_STUDIO_EXPORT_TOKEN` value. Configure it server-side in both upstream deployments. Store the same value locally as two separate Windows Generic Credentials so each provider can rotate independently later:

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
