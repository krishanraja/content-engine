# Windows credential contract

> Scope: the Studio's Windows credentials. For the whole system start at `README.md`. Its known stale passages are listed in `docs/STUDIO.md`, "The detailed Studio documents".

## Outcome

No credential value belongs in Git, chat, shell history, command arguments,
logs, screenshots, or a local `.env` file. Vercel stores the cloud half as a
write-only Secret. Windows Credential Manager stores the matching local half.

The active control-plane credentials are:

| Windows credential target | Vercel variable | Persistence |
|---|---|---|
| `MindmakeVideoStudio/control-center-runner-token-v3` | `VIDEO_STUDIO_RUNNER_TOKEN` | LocalMachine |
| `MindmakeVideoStudio/control-center-runner-signing-key-v3` | `VIDEO_STUDIO_RUNNER_SIGNING_KEY` | LocalMachine |
| `MindmakeVideoStudio/control-center-radar-token-v3` | `VIDEO_STUDIO_EXPORT_TOKEN` | LocalMachine |
| `MindmakeVideoStudio/studio-mcp-token-v2` | `VIDEO_STUDIO_MCP_TOKEN` | LocalMachine |

`MindmakeVideoStudio/approval-signing-key` is a separate, machine-local trust
root for the approval ledger. Never rotate it as part of a cloud credential
change.

## Every runner machine

Since 2026-09-28 the Studio has a primary runner and a cold standby on a
second Windows machine (`docs/OPERATIONS.md`, "Primary and cold standby").
The contract above holds per machine:

- Every runner machine holds its own copy of the four active targets above,
  each written on that machine through `scripts/set-credential.ps1` as a
  LocalMachine credential. The values are the same on every machine because
  each must match its Vercel Secret; they are entered interactively on each
  machine and never copied as files, exported or pasted into a chat.
- Every runner machine has its own `MindmakeVideoStudio/approval-signing-key`,
  generated on that machine with `scripts/set-credential.ps1 -Generate` and
  never shared. Local approvals signed on one machine are verified only by that
  machine; this is one reason nothing in a runtime is copied between machines.
- Retired names may remain in a machine's store: the `-v2` bearer, signing-key
  and radar targets retired by the v3 rotation, and the three quarantined
  unversioned names below. Nothing reads them, and their presence proves
  nothing about what is current.
- `scripts/inspect-credentials.ps1 -EnforceActiveContract` and
  `npm run probe:runner-credentials` are run on each machine separately. On
  2026-09-28 both passed on the standby; the probe reported "runner bearer and
  signing credentials accepted by production".
- A rotation is complete only when every runner machine carries the new
  targets. Rotate the standby in the same window as the primary, or record
  that it is behind and keep its task disabled until it is brought level.

## The Studio MCP token

`MindmakeVideoStudio/studio-mcp-token-v2` holds the bearer the Studio MCP proxy
(`scripts/studio-mcp-credential-proxy.ps1`) sends to the production gateway.
Its value has a fixed family: `vst_mcp_` followed by at least 64 lowercase
hexadecimal characters. The proxy refuses anything else ("wrong family
prefix"), so a value of the right length can still leave `studio.session.open`
unavailable, which is what Krish's Windows session reported on 2026-09-28.

- `scripts/set-credential.ps1 -Target MindmakeVideoStudio/studio-mcp-token-v2
  -Generate` writes `vst_mcp_` and 96 lowercase hex from the cryptographic
  generator. `-FromStdin` and the interactive prompt refuse a value outside the
  family before anything is deleted or written; the message names the target
  and never the value. Every other target is unchanged.
- `scripts/inspect-credentials.ps1 -EnforceActiveContract` fails with
  "studio-mcp-token-v2 has the wrong family prefix" when the stored value is
  outside the family. It reports a verdict and never any part of the value.
- The same value must be in two places: the `content-engine` Vercel project as
  `VIDEO_STUDIO_MCP_TOKEN` (Production; the gateway reads it only after a
  redeploy), and each runner machine's LocalMachine store under the target
  above. Control Center holds no copy: it rewrites `/api/video-studio/*` to the
  `content-engine` project, where `apps/control-plane/api/_videoStudioMcpAuth.ts`
  compares the bearer with that variable.

Rotation, without the value ever reaching a screen, a file, a log, a command
argument or a chat:

1. Close any Codex or Claude Code session using the Studio tools on the
   machines.
2. On the primary, generate the new value into the store:
   `powershell -NoProfile -File scripts/set-credential.ps1 -Target MindmakeVideoStudio/studio-mcp-token-v2 -Generate`.
   It prints only the length (104) and a 12-character fingerprint.
3. Move it to Vercel through the clipboard, never the console. Run the reader
   as a separate process so its output goes into the pipe:
   `pwsh -NoProfile -File scripts/get-credential.ps1 -Target MindmakeVideoStudio/studio-mcp-token-v2 | Set-Clipboard`.
   (Invoked as `.\scripts\get-credential.ps1` inside the same session it
   writes straight to the console; do not do that.) Paste it as the
   Production value of `VIDEO_STUDIO_MCP_TOKEN` in the `content-engine`
   project, marked Sensitive, then clear the clipboard with
   `Set-Clipboard -Value ' '` and redeploy production.
4. On every other runner machine, enter the same value at the masked prompt of
   `scripts/set-credential.ps1 -Target MindmakeVideoStudio/studio-mcp-token-v2`
   (no `-Generate`), carried by a password manager or the same clipboard
   routine, never a file or a chat. The prompt refuses a wrong-family value.
   On the cold standby, `scripts/standby-studio-mcp-token.ps1` does this step
   and step 5 in one run: it checks the runner task there is disabled, stores
   the value at the masked prompt and runs the inspector. Copy it out of the
   repository first (to Downloads), because a file added inside the runner
   checkout makes it unclean.
5. On each machine, `scripts/inspect-credentials.ps1 -EnforceActiveContract`
   must pass and show the same fingerprint for the target as the primary.
6. Open a Studio session from that machine: `studio.session.open` returning a
   tracked session proves the Vercel value matches.

The target name stays `studio-mcp-token-v2`: the proxy pins it, so a new name
would be a code change and a runner upgrade.

On 2026-10-02 Krish reported the token stored on both machines, the standby's
through `scripts/standby-studio-mcp-token.ps1`, with the credential checks
passing. Step 6 is still to do: no tracked Studio session has been opened
since.

## The engine key for agent sessions

`ENGINE_OPERATOR_TOKEN` in the `content-engine` Vercel project lets an agent
session with no browser (Claude Code, Codex) read and write the content engine
and the work board (`docs/CONTENT_ENGINE.md`, "The guards"; `WORKBENCH.md`).
Ruling (Krish, 2026-10-03): "I will use codex on one of the two machines set up
as the video runner, either or. sort the engine key", and "feel free to use
KeePass in the H drive which stores all the other creds for the video runner".

Where the one value lives, and nowhere else:

- the `content-engine` Vercel project, Production, as `ENGINE_OPERATOR_TOKEN`;
- each Windows home machine that runs Codex or Claude Code, in Windows
  Credential Manager as `Mindmake/engine-operator-token` (LocalMachine), written
  by `scripts/engine-key.ps1`; `scripts/engine.py` reads it from there;
- Claude Code's cloud environment, as the environment variable
  `ENGINE_OPERATOR_TOKEN`;
- KeePass, beside the runner's other keys, as "Mindmake engine key
  (ENGINE_OPERATOR_TOKEN)".

The name sits outside `MindmakeVideoStudio/`, so the runner's credential
contract and `inspect-credentials.ps1` are unaffected.

Rotated 2026-10-03: Krish ran `engine-key.ps1 -New` on a home machine and put
the new value in KeePass, Vercel and the Claude environment ("key done"). The
engine was redeployed the same hour, and the previous value, which had been
held in a session's scratch folder, stopped working at that deployment.

To make a new one (rotation): on one home machine run
`scripts/engine-key.ps1 -New` from outside the runner checkout. It stores a
fresh `mm_engine_` key, puts it on the clipboard once for KeePass, Vercel and
the Claude environment, then clears the clipboard. Redeploy the engine so it
takes the new value; the old one stops working at that deployment. On the other
machine run the script without `-New` and paste the key from KeePass at its
hidden prompt. `-Check` prints the fingerprint and whether the engine accepts
the key; both machines must show the same fingerprint.

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
9. After a bearer rotation, switch the active runner role to the primary's
   new hash (`docs/OPERATIONS.md`, "Runner roles"). The hash covers the
   bearer, so the primary reports under a new, unassigned hash and takes no
   work until the switch; retire the old hashes afterwards. A signing-key
   rotation alone leaves the hashes and roles unchanged.

If any check fails, keep the runner disabled. Do not delete, edit or re-sign an
authority record by hand.

## Incident record

Credential values were previously committed to this file and appeared in a
chat transcript. The three runtime values were revoked on 2026-09-12 and a
separate MCP credential was created. Current-tree scanning now rejects secret
assignments, paste instructions, common token families, bearer literals and
private keys. The revoked literals remain in Git history until a separately
approved history rewrite is coordinated with every clone.

Each runner machine keeps its installed checkout at:

```text
%USERPROFILE%\Documents\MindmakeVideoStudio\runner-source
```

On each machine the scheduled task is `Mindmake Video Studio Runner` and
remains Interactive by design so Windows DPAPI can unlock Credential Manager.
Do not change the task principal. Both machines were verified at
`6bf78628a481a61bf16ea3b4deec0d326281eee6` on 2026-09-28 with clean detached
checkouts and verified source provenance.
