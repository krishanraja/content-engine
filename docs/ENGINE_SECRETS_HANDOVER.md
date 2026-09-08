# Finishing the engine's environment (the part no API can do for you)

Five values are still owed to the Vercel project `content-engine`
(`prj_fDRrOHcBrGTdrdrwS7W6OBzLuelX`, root directory `apps/control-plane`).

Two of them are the reason the cutover is blocked. Vercel marks
`VIDEO_STUDIO_RUNNER_TOKEN` and `VIDEO_STUDIO_RUNNER_SIGNING_KEY` as
`sensitive`, which means no API call, `vercel env pull`, or dashboard view
will ever return their plaintext again. They exist in exactly two places: the
Control Center project, where they are equally unreadable, and the Windows
machine's Credential Manager, where the runner reads them at start-up. The
Windows copy is the source of truth, because a mismatch does not fail loudly:
the runner authenticates fine and every receipt it signs is silently rejected.

`GET /api/content-engine/ping` reports `ready:false` until both are set. It is
the readback: no guessing, no dashboard screenshot.

## The prompt

Run this on the Windows machine, in a Claude Code session with the Vercel CLI
installed and `vercel login` done. Paste it whole.

```
You are configuring the Vercel project `content-engine` (org: krish-rajas-projects,
root directory apps/control-plane). Do not print any secret value to the terminal,
to a file, or back to me. Print names, lengths, and pass/fail only.

Context: this project is a second deployment of the same control plane that
`control-center` runs today. Five environment variables are missing. Two of them
must byte-for-byte match what the Windows runner already holds, or the runner will
authenticate and then have every signed receipt rejected.

1. Read the two runner secrets from Windows Credential Manager, where the runner
   reads them. Do not echo them. In PowerShell:

     $t = (Get-StoredCredential -Target 'mindmake-video-studio/runner-token').GetNetworkCredential().Password
     $k = (Get-StoredCredential -Target 'mindmake-video-studio/runner-signing-key').GetNetworkCredential().Password

   If those target names are wrong, run `cmdkey /list | findstr mindmake` and tell me
   the names you find rather than guessing. If CredentialManager is not installed,
   `Install-Module CredentialManager -Scope CurrentUser`. Report only the byte length
   of each and whether it is non-empty.

2. Confirm those two are what the running runner actually uses, by checking the
   runner's own config resolution (scripts/verify-runner-source.ps1 in the
   content-engine checkout) rather than assuming the Credential Manager entry is live.

3. Set them on the engine's production environment, without them ever appearing in
   shell history or a file on disk. Pipe, never type:

     $t | vercel env add VIDEO_STUDIO_RUNNER_TOKEN production --sensitive
     $k | vercel env add VIDEO_STUDIO_RUNNER_SIGNING_KEY production --sensitive

   Use `--scope krish-rajas-projects` and link the directory to the `content-engine`
   project first (`vercel link`), and confirm with `vercel project ls` that you are
   pointed at `content-engine` and NOT `control-center` before any write. Writing a
   runner token onto control-center would be harmless; writing anything else onto it
   would not be.

4. Set the three remaining feature values the same way, taking them from the
   control-center project's own settings where you can read them, and telling me
   which you cannot:

     CTRL_SUPABASE_URL
     CTRL_SUPABASE_SERVICE_KEY
     VIDEO_STUDIO_EXPORT_TOKEN

5. Do NOT set CRON_SECRET. Control Center is still running the content crons. Two
   schedulers against one database would run the Monday purge twice and spend the
   scraping budget twice. It goes on in the same window as the control-center PR
   merge, not before.

6. Redeploy production so the new values are picked up (`vercel deploy --prod`), then
   verify and report exactly this:

     curl -s https://content-engine-flame-nu.vercel.app/api/content-engine/ping

   Expected: `"ready": true`. If it is still false, the response names the missing
   variable; report that name. Do not attempt to work around a false readback by
   changing the health route.

7. Then clear the two PowerShell variables ($t, $k) and confirm you did.
```

## After it returns `ready: true`

1. Merge `krishanraja/control-center#293`. That deletes Control Center's 14 content
   crons and points its `/api/*` rewrites at this engine.
2. Set `CRON_SECRET` on `content-engine` in the same window, and only then. The
   window between the merge and this write is a window where no crons run at all,
   which is the safe side to be on.
3. Watch `content_engine_runs` for the first engine-written row, and
   `video_studio_runner_heartbeats` for a heartbeat that arrived through the rewrite.

## Rotate

The Supabase, Vercel, GitHub and n8n tokens used to build this sit in a chat
transcript. Rotate all four once the cutover reads green.
