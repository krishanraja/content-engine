# The two runner secrets, and what to do with them

## What they are

Two shared passwords between the Windows machine and the cloud.

- `VIDEO_STUDIO_RUNNER_TOKEN` is the bearer the runner sends to prove a request
  is from your machine.
- `VIDEO_STUDIO_RUNNER_SIGNING_KEY` signs the receipts the runner sends back, so
  the cloud knows a receipt is genuine and unaltered.

Each exists in two copies that must be byte-identical: one in Vercel, one in
Windows Credential Manager. The engine is now the side that checks them, so the
engine project needs the same two values the machine holds.

A mismatch does not fail loudly. The runner authenticates fine and every receipt
it signs is then rejected, which reads like the Studio quietly not working.

## Just do this (recommended): set new values on both sides

Nothing needs to be read out of anywhere. These are shared passwords, so any two
strong random strings work as long as both sides get the same ones. This also
rotates a pair that has been sitting unchanged.

**1. Generate two values.** On the Windows machine, in PowerShell:

```powershell
$t = -join ((48..57) + (97..122) | Get-Random -Count 48 | % {[char]$_})
$k = -join ((48..57) + (97..122) | Get-Random -Count 48 | % {[char]$_})
$t; $k   # read these two lines; you will paste them twice each
```

**2. Put them in Vercel.** Go to the `content-engine` project (not
`control-center`), Settings, Environment Variables, and add both for
**Production**, ticking **Sensitive**:

- `VIDEO_STUDIO_RUNNER_TOKEN` = the first value
- `VIDEO_STUDIO_RUNNER_SIGNING_KEY` = the second value

Then redeploy production so the running functions pick them up.

**3. Put the same two on the Windows machine.** From the Studio checkout, these
prompt interactively so the values never land in shell history:

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-token
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-signing-key
```

Paste the first value into the first, the second into the second. Do **not**
touch `MindmakeVideoStudio/approval-signing-key`: that one never leaves the
machine and must stay stable for the life of the signed job history.

**4. Restart the runner scheduled task**, then check the readback below.

## The readback

```
curl -s https://content-engine-flame-nu.vercel.app/api/content-engine/ping
```

`"ready": true` means both are set. While either is missing it stays `false`,
and the authenticated health route names exactly which one.

Then confirm the round trip actually works: the runner's next heartbeat should
advance `video_studio_runner_heartbeats`. If the token is right but the signing
key is not, heartbeats arrive and receipts are rejected, so check a receipt
lands too before calling it done.

## The alternative, if you would rather not rotate

Read the two existing values out of Windows Credential Manager and paste them
into Vercel unchanged. Credential Manager will not show a password in its UI, so
this needs PowerShell and the `CredentialManager` module, which is more work
than generating new ones. There is no way to read them back from Vercel: they
are stored `sensitive`, and no API call, `vercel env pull`, or dashboard view
will return the plaintext. That is why this is yours to do and not something the
deployment can copy for itself.

## The other three values, and the one to leave alone

Also owed on the `content-engine` project, all copyable from `control-center`:

- `CTRL_SUPABASE_URL` and `CTRL_SUPABASE_SERVICE_KEY`: feed ingest reads the
  CTRL headlines pool. Without them that one job fails its run and says so.
- `VIDEO_STUDIO_EXPORT_TOKEN`: the candidates export the Studio radar reads.

**Do not set `CRON_SECRET` until Control Center has stopped scheduling.** Two
schedulers against one database would run the Monday purge twice.

## Rotate afterwards

The Supabase, Vercel, GitHub and n8n tokens used to build this sit in a chat
transcript. Rotate all four once the cutover reads green.
