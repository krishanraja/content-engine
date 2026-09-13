# Windows credential contract

## Outcome

No credential value belongs in Git, chat, shell history, command arguments,
logs, screenshots, or a local `.env` file. Vercel stores the cloud half as a
write-only Secret. Windows Credential Manager stores the matching local half.

The active control-plane credentials are:

| Windows credential target | Vercel variable | Persistence |
|---|---|---|
| `MindmakeVideoStudio/control-center-runner-token-v2` | `VIDEO_STUDIO_RUNNER_TOKEN` | LocalMachine |
| `MindmakeVideoStudio/control-center-runner-signing-key-v2` | `VIDEO_STUDIO_RUNNER_SIGNING_KEY` | LocalMachine |
| `MindmakeVideoStudio/control-center-radar-token-v2` | `VIDEO_STUDIO_EXPORT_TOKEN` | LocalMachine |
| `MindmakeVideoStudio/studio-mcp-token` | `VIDEO_STUDIO_MCP_TOKEN` | LocalMachine |

`MindmakeVideoStudio/approval-signing-key` is a separate, machine-local trust
root for the approval ledger. Never rotate it as part of a cloud credential
change.

## Quarantined names

These original names are permanently retired:

```text
MindmakeVideoStudio/control-center-runner-token
MindmakeVideoStudio/control-center-runner-signing-key
MindmakeVideoStudio/control-center-radar-token
```

Windows credential roaming restored stale values under the first two names
after successful writes and readbacks. Active code must not read them and the
credential writer refuses to overwrite them. Their presence in Credential
Manager is not evidence that they are current.

## Normal verification

Run this from the exact installed runner checkout:

```powershell
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/inspect-credentials.ps1 -EnforceActiveContract
```

The check prints only target names, persistence, length, timestamps and one-way
fingerprints. It fails unless every active target exists, is at least 32
characters, was written by the repository helper and is LocalMachine-persisted.

Codex does not need `VIDEO_STUDIO_MCP_TOKEN` in its parent environment. The
project `.codex/config.toml` launches `scripts/studio-mcp-credential-proxy.ps1`,
which reads only the dedicated MCP target inside its own process and forwards
JSON-RPC to the pinned production gateway. The token is never printed.
Codex loads that project layer only after the repository is trusted; the runner
machine therefore keeps an exact trust entry for this checkout rather than
depending on a broad parent-directory trust rule.

## Rotation protocol

1. Stop and disable `Mindmake Video Studio Runner`. Require
   `scripts/runner.ps1 -Mode stop-preflight` to return `active: false` before
   touching runtime state.
2. Confirm there are no pending or conflicted receipts or project journals.
3. Create fresh versioned LocalMachine targets through
   `scripts/set-credential.ps1`. Never pass a value as a command argument.
4. Update the matching Vercel Secret values and deploy production.
5. For the runner signing key, run
   `scripts/rotate-runner-signing-key.ts` with `--new-credential-target`. The
   script verifies every old signature, excludes body-signed approval bindings,
   creates a full backup, re-signs, rereads and verifies the new signatures. It
   never accepts or prints the key.
6. Update the active credential constants, verify the repository, merge, and
   install the exact clean commit into the dedicated runner checkout.
7. After the new production deployment is ready, run
   `npm run probe:runner-credentials`. This state-free challenge must report
   that both credentials were accepted; it neither leases a command nor writes
   a receipt.
8. Re-enable and start the scheduled task, then verify healthy status and a
   fresh heartbeat. Normal signed receipts remain the business-flow proof, but
   they are no longer required merely to establish that the two credential
   stores agree.

If any check fails, keep the runner disabled. Do not delete, edit or re-sign an
authority record by hand.

## Incident record

Credential values were previously committed to this file and appeared in a
chat transcript. The three runtime values were revoked on 2026-09-12 and a
separate MCP credential was created. Current-tree scanning now rejects secret
assignments, paste instructions, common token families, bearer literals and
private keys. The revoked literals remain in Git history until a separately
approved history rewrite is coordinated with every clone.

The installed runner remains at:

```text
C:\Users\krish\Documents\MindmakeVideoStudio\runner-source
```

Its scheduled task is `Mindmake Video Studio Runner` and remains Interactive by
design so Windows DPAPI can unlock Credential Manager. Do not change the task
principal.
