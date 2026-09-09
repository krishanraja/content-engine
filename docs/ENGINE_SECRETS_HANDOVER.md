# The Windows side of the cutover

## The thing that was confusing, said plainly

There is no vault these values come from. They are **passwords you choose**,
shared between two machines: the cloud (Vercel) and the Windows box. Both sides
must hold the same string. That is the whole idea.

Nobody can read the old ones back. Vercel stores them `sensitive`, which means
no API call, no `vercel env pull`, and no dashboard view will ever show them
again. So the move is not "find them", it is "pick new ones and set both sides".

The cloud side is **already done**. Three values were generated and set on the
`content-engine` project, and each was tested against the live route that checks
it. `GET /api/content-engine/ping` reports `ready: true`.

What is left is the Windows box, because nothing outside it can write to its
Credential Manager.

## Paste this on the Windows machine

From the Studio checkout. Each command prompts for the value, so nothing lands
in shell history.

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-token
# paste: rt_d26867dedb995704ec05f4278b8a5cefed9ba49aab49fe82

powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-runner-signing-key
# paste: sk_90cf45cb7cb114cd84f7259c458172842cb47d6ed66c1d40

powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/control-center-radar-token
# paste: ex_8d91781f9833c86a9188b51ac0c2c71a4cec87ded17bcaea
```

Then restart the runner scheduled task.

**Do not touch** `MindmakeVideoStudio/approval-signing-key`. That one never
leaves the machine and must stay stable for the life of the signed job history.

## What each pair is for

| Windows credential | Engine variable | What breaks without it |
|---|---|---|
| `control-center-runner-token` | `VIDEO_STUDIO_RUNNER_TOKEN` | the runner cannot talk to the cloud at all |
| `control-center-runner-signing-key` | `VIDEO_STUDIO_RUNNER_SIGNING_KEY` | the runner talks fine and every receipt it signs is rejected |
| `control-center-radar-token` | `VIDEO_STUDIO_EXPORT_TOKEN` | the Studio radar cannot read the candidates export |

The middle row is the one that fails quietly, which is why it is worth checking
a receipt lands and not just a heartbeat.

## Where the runner actually is

`SURFACE`. Checkout at `C:\Users\krish\Documents\MindmakeVideoStudio\runner-source`,
scheduled task `Mindmake Video Studio Runner`, running `node.exe` directly.

Two things there look wrong and are not:

- The runner talks to `https://controlcenter.krishraja.com/api/video-studio/runner`,
  not the engine domain. That is `DEFAULT_CONTROL_PLANE_URL` in
  `packages/core/src/runner.ts:78`, and Control Center rewrites the path through
  to the engine. Repointing it is a later change needing a source reinstall, not
  an env edit. Do not "correct" it.
- There is no separate `content-engine` checkout. The control plane is
  `apps/control-plane` in this repo.

The task principal is `LogonType Interactive` on purpose
(`scripts/install-runner-task.ps1:81`, asserted by `tests/runner-windows.test.ts:23`).
An S4U principal runs without the user's password, DPAPI never unlocks, and the
runner cannot read any of the credentials below. Never change it.

The consequence, which is real: with an At-Logon trigger, Interactive logon and no
automatic logon configured, **the runner does not come back after a reboot** until
someone signs in at the console. The five-minute recovery trigger cannot help at a
lock screen; it exists for sleep and session interruption while signed in.

## Windows credential roaming silently reverted two of these

On 2026-09-08 `control-center-runner-token` and `control-center-runner-signing-key`
were written and verified at 14:28. By 15:42 both held their 2026-09-04 values
again, with `Persist = 3` (Enterprise, roams), an empty `Comment`, and a
`LastWritten` of Sept 4. They were not copies pasted back by some tool; they were
the original entries restored by Windows credential roaming, metadata included.

Two things about this are worth keeping.

**A successful write proves nothing.** `CredWrite` returned true, the read back
matched, and a live call authenticated. Hours later a sync replaced the entry.
`set-credential.ps1` now deletes any existing entry before writing and refuses to
report success unless the read back shows the right length and `Persist = 2`.

**`Persist = 2` on the write does not make it safe.** Confirmed twice: two
LocalMachine writes, each verified by fingerprint, each rolled back inside 25
minutes. An inbound roam re-creates the entry wholesale, class and metadata
included, whatever the local entry was. `control-center-radar-token` survives
because it is a newer name with no copy in the roaming store, not because
LocalMachine defends it.

SURFACE is `WorkplaceJoined` to the `krishraja.com` tenant, with no local roaming
policy keys set, so the copy lives tenant-side. The `LastWritten` on a reverted
entry reads Sept 4, not the time of the overwrite, which is the tell: a sync
replicating a stored blob, not a tool writing a fresh one.

**The fix is to make the sync carry the right value, not to fight it.** These two
names roam whatever we do, and the only writable end is the local one, so writing
the correct value as Enterprise propagates it and a later restore restores what we
want:

```powershell
powershell -NoProfile -File scripts/set-credential.ps1 -Roaming -Target MindmakeVideoStudio/control-center-runner-token
powershell -NoProfile -File scripts/set-credential.ps1 -Roaming -Target MindmakeVideoStudio/control-center-runner-signing-key
```

`-Roaming` is never a default and the script refuses an Enterprise readback
without it. The trade is real and worth saying once: these two then sync to the
tenant and to the account's other joined devices. They already did, at their old
values. This changes what roams, not whether.

**Done, and proven rather than assumed, on 2026-09-08.** Both values were written
as Enterprise and then left alone for thirty minutes. The two previous attempts
were reverted inside twenty-five, so surviving that window is the actual test, not
the write succeeding: a write that reports success and a write that lasts had
looked identical twice already. A runner started fresh afterwards came up healthy,
which is the half a running daemon cannot tell you, because it holds its key in
memory and keeps heartbeating over a store that would refuse the next start.

Rejected, and worth recording so it is not revisited: unregistering the workplace
join or disabling roaming tenant-wide, which carries blast radius across all of
Microsoft 365 to fix a video runner; and renaming the credentials to dodge the
roaming set, which works but needs a source pull and a task reinstall on SURFACE
to buy the same outcome.

The failure is silent and delayed, which is what makes it dangerous. A daemon
already running holds its key in memory and keeps heartbeating; only the next start
reads the store, fails marker verification, and refuses to come up. On 2026-09-08
the machine had been up nine days, so nothing had exercised it.

`scripts/inspect-credentials.ps1` reports `Persist`, `Comment`, `LastWritten` and a
one-way fingerprint for every `MindmakeVideoStudio/*` entry, and warns on any that
is Enterprise-persisted or that our own script did not write. It prints no secret,
because the moment to run it is the moment someone pastes the output somewhere.

## The readback

```
curl -s https://content-engine-flame-nu.vercel.app/api/content-engine/ping
```

Already `ready: true`: that means the cloud half is configured, not that the
runner works. The proof of the round trip is that
`video_studio_runner_heartbeats` advances after the restart, and then that a
signed receipt is accepted rather than rejected.

## Done without you

- `CRON_SECRET`, generated and set. All 16 engine crons are registered and one
  was run end to end against the live database.
- `CTRL_SUPABASE_URL` and `CTRL_SUPABASE_SERVICE_KEY`, read from the Mindmaker
  AI project (the one holding `live_headlines_cache`) and set. Feed ingest has
  its pool.
- The three values above, on the cloud side only.

## CRON_SECRET was rotated on 2026-09-08

Deliberately, to exercise `POST /api/content-engine/runs/replay` end to end. It
could not be verified otherwise: Vercel stores it `sensitive` and returns it to
nothing.

Nothing needs the value by hand. Vercel's scheduler injects it from the
environment, and the replay route reads it the same way. It was safe to rotate
because nothing else holds it: every n8n HTTP node in the inspiration sweep
calls Supabase or a third-party API, and none calls the engine.

If you ever want to drive the recovery routes from a script rather than the
dashboard, rotate it again to a value you keep. The route takes either that
bearer or the dashboard cookie.

## Rotate

The Supabase, Vercel, GitHub and n8n tokens used to build this sit in a chat
transcript, as do the three values above. Rotating the three means repeating
this page with new strings; rotating the four API tokens is independent and
worth doing sooner.
