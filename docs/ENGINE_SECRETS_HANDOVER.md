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

## Rotate

The Supabase, Vercel, GitHub and n8n tokens used to build this sit in a chat
transcript, as do the three values above. Rotating the three means repeating
this page with new strings; rotating the four API tokens is independent and
worth doing sooner.
