# The backup machine

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core unchanged on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md).

Quick-edit production needs no switch of any kind. The matcher, the kit,
the renders, the thumbnails, the archive and the record run on whichever
home computer Krish is at, the main one or the backup, and nothing in the
database changes. On the backup:

- Krish turns it on and signs in to Windows as himself, so Google Drive for
  desktop mounts H:.
- The work copy is at the latest `main` and `scripts/engine-key.ps1` has been
  run there once. `make.py --doctor` must say ready; an approved sting
  renders itself once on a machine that has none.
- The recordings upload already runs on both machines, and places takes on
  both: nothing to move. Its `-Check` (`scripts/install-recordings-upload.ps1`
  runs it) proves that machine has the engine key and a pinned Python that
  imports faster_whisper.
- **Library Sync runs only on the machine it is installed on, and does not
  follow the runner role.** With the main machine off, the cuts sent in
  step 8 wait in the engine until Krish moves it: install and enable it on
  the machine in use (`docs/OPERATIONS.md`, "Library sync",
  `scripts/install-library-sync.ps1` from `library-source`) and
  `Disable-ScheduledTask -TaskName "Mindmake Library Sync"` on the other.
  Tell him; he does it.

The Studio failover is a different thing. It is only for work that goes
through the Studio's queue (production briefs, review decisions and edits
sent from Control Center), never for these cuts, and only when Krish asks
for it in words. Never infer that one is needed from a missing heartbeat
alone: a sleeping laptop, a Windows update or a lost Drive mount all
silence a healthy main machine. The steps (`docs/OPERATIONS.md`, "Primary
and cold standby"):

1. **Main machine.** `powershell -NoProfile -ExecutionPolicy Bypass -File
   scripts/runner.ps1 -Mode status` shows zero pending and zero conflicted
   receipt and project journals and no active command. Then
   `Stop-ScheduledTask -TaskName "Mindmake Video Studio Runner"` and
   `Disable-ScheduledTask -TaskName "Mindmake Video Studio Runner"`, and
   `scripts/runner.ps1 -Mode stop-preflight` must return exactly
   `"active": false`. If the main machine cannot be inspected, stop here.
2. **Cloud, read only.** The health route shows the main machine silent
   (`runners.active.fresh` false) and nothing waiting: no queued or leased
   command and no claimable brief (`runners.waiting`).
3. **Backup.** `Enable-ScheduledTask` and `Start-ScheduledTask` for the same
   task name. `runner.ps1 -Mode status` must show `active: true`, the
   expected commit, provenance `verified`, Drive `ready` and zero conflicts.
4. **Krish switches the active role** in Control Center (OS, Systems, Studio
   runners, "Switch the active runner", with a reason). An agent cannot and
   never tries.
5. Move Library Sync as above. Failing back is the same in reverse; the
   machine that is not running keeps its task disabled.
