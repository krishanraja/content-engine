# Private weekly board: verified production release

Both weeks are live behind the existing access-code login:
- https://content.krishraja.com/board/2026-10-12
- https://content.krishraja.com/board/2026-10-19

The overarching week tabs keep both available. `/` and `/board` open 19 October.
The web board is the sole place for new interactions. All four Claude artifacts
and artifact-generation support remain preserved; there is no ongoing sync.
`docs/PUBLISH_BOARDS.md` governs every board-reading/building workflow.

## Authority and source freeze

Krish explicitly requested both repositories merged to main and both weeks live.
He paused edits on all four Claude boards and confirmed no newer-account changes
since their exports. The older-account final comparison, 19 October 2026 at
14:18:41–14:21:31 UTC, found zero changes. He explicitly approved preservation of
all available data with the source metadata limitations below. These approvals
cover this private migration; they do not authorize social posts, video changes,
paid fact checks, or new editorial decisions.

## Exact release targets and order

1. Applied the additive board migration to Supabase `gojpffsrxybbpbdzzrvs`
   (Mindmaker OS). All seven tables have RLS; anon and general authenticated
   roles have no table reads; server service-role access is enabled.
2. Content Engine PR104 merged as `c34fdd5422f8aec678d8f2ad2784fa65074bb7da`.
   Source comment compatibility and workflow routing followed in PR105,
   main `5c8330deac8ab8d6ed8f03ee19b570a7cc70ea07`, production deployment
   `dpl_Atzdg4fP6sazefCBPtKtVTTwgJTB`, project `prj_fDRrOHcBrGTdrdrwS7W6OBzLuelX`.
3. Control Center PR499 merged as `0fba42d1eae1b4b5584d94491f3b1e0cae6df48c`,
   followed by PR504 fixing root/operator forwarding, main
   `a341cf42d39ded0300a54551f41ad9ed7cf9e037`, production
   `dpl_uD3aGcx7cP7vW81TpjrcAHs287CF`, project
   `prj_ymGIPNZzWx5gSuxv1kqppexR60Ac`. Team: `team_iXZBozK4Ss7NHuyNk8L9wmO6`.
4. Attached and verified content.krishraja.com on Control Center. The live provider
   recommendation was `63597985a263e155.vercel-dns-016.com.`; existing Vercel
   wildcard DNS already routed correctly. No zone record change was needed.
5. Archived four exports and original HTMLs, imported all records, activated both
   verified builds, and completed authenticated production API/browser readback.
   The final routing/config commit records active cutover after this evidence.

## Migration coverage

| Source | Ticks | Links | Edits | Picks | Queue | Comment roots | Replies |
|---|---:|---:|---:|---:|---:|---:|---:|
| Older account, 12 Oct | 18 | 0 | 3 | 0 | 0 | 14 | 10 |
| Older account, 19 Oct | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Newer account, 12 Oct | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Newer account, 19 Oct | 0 | 0 | 0 | 3 | 11 | 28 | 0 |

All six stores were authenticated and fully read in each source; zero means a
verified empty collection. All 87 source versions and 87 canonical records were
compared independently by ID, body and digest after import. No conflicts remained.
A repeated import applied zero changes. Unticks remain explicit `done: false`.
All original ZIP bundles, raw readouts, JSON/HTML exports and the final freeze
receipt are retained in private `content-library` storage. The archive inventory
below gives immutable object keys, sizes and SHA-256 digests. Original source
addresses remain in `config/boards.json.weeks` and each archived record.

Source limitations approved by Krish: generation manifests were not exposed;
comments supplied thread IDs and displayed author/time/status, but no native
reply/account IDs or precise older timestamps/timezones. Ten reply IDs are
deterministic; comments are namespaced by source. The 24 older comments whose
anchors are missing/obsolete appear at board level, with their original location
metadata retained. No timestamp precision or original manifest was invented.
Raw comment tool readouts are preserved as supplied transcriptions, not claimed
as native comment JSON. Existing source revision numbers are preserved where
available; earlier unexposed source revisions cannot be reconstructed.

## Activated immutable builds

| Week | Build ID | HTML bytes | Download assets |
|---|---|---:|---:|
| 2026-10-12 | `197574d279893a8b9fc2297b1392afb6f9b7b46ef525a87963ee5c77ec6b5439` | 14,281,929 | 12 |
| 2026-10-19 | `ecaa9a8ab2dbb9fa7bac65d0683da9d75c0b66122f79dc602087649b3c3e87c6` | 134,121 | 0 |

Twelve source assets total 689,355,738 bytes. All downloaded content types, sizes
and SHA-256 digests matched the manifests. The 14 MB historical board streams
through the authenticated hostname successfully, exceeding the buffered 4.5 MB
limit. Both builds preserve their current source layout/content; 19 October uses
the newer account's Monday draft. Friday's existing files are retained while its
two replacement videos remain separate work awaiting completion and approval.

## Verification and limits

- Original 106 board self-checks retained. Full Content Engine `npm run verify`
  passed clean Ubuntu and Windows CI on the final implementation, with board-web,
  browser-buttons, SQL, dependency and operating-context checks. Control Center's
  actual CI verify/build and full desktop/phone E2E passed. Skill synchronization
  and skill-core checks passed. Local Windows broad-suite credential-dependent
  baseline failures were superseded by those clean CI runs.
- Disposable PostgreSQL plus real handlers verified RLS, revisions/CAS, source
  replay, week isolation, immutable builds, rollback without state reversion,
  missing credentials, direct access denial and large streamed responses.
- Browser fixture acceptance covered saved edits, comments/replies, clipboard,
  downloads, failed requests/retry, expired links, five-second/focus refresh and
  dirty typing. A delayed-save/concurrent-edit race was reproduced and fixed;
  cancelled conflict replacement preserves unsaved words.
- Actual production login preserved dated URLs with a secure HttpOnly host-local
  cookie. Live Chromium at 390×900 and 1440×900 visited every day/ideas tab in both
  weeks, loaded every image, checked no horizontal overflow/runtime exceptions,
  compared visible ticks to API state, read historical comments/replies and
  reloaded. Screenshots were inspected. Root/latest routing and operator-only
  publication denial passed. Production stale and cross-origin writes rejected;
  an identical-body edit write persisted unchanged. No publication ticks were
  toggled and no synthetic comments were added to the live weeks.
- Production files and every source/canonical record have independent readback.
  A real signed link expired and a fresh link succeeded. An earlier 19 October
  build was selected and hash-read, then the current build restored; all 42
  interaction documents stayed identical. Re-activation kept the pointer revision.
  Live operator HTML hashes and invalid-bearer rejection passed on both hosts.
  Destructive/failure scenarios use disposable data rather than
  changing Krish's live publishing history. This is Chromium viewport coverage,
  not a claim of physical-device or every-browser testing.

Machine-readable evidence: [API and files](board-web-evidence/production-readback.json),
[live browser](board-web-evidence/browser-readback.json),
[exact source coverage](board-web-evidence/source-coverage.json),
[private source archive](board-web-evidence/source-bundle-archive.json),
[operator access](board-web-evidence/production-operator-readback.json),
[real link expiry](board-web-evidence/production-link-expiry.json),
[production rollback](board-web-evidence/production-rollback.json).

## Operating commands and rollback

Use the existing operator credential through the approved runtime; never paste
it into HTML, command lines, logs or files. `board_web.py read WEEK COLLECTION`
reads all pages. `board_web.py download WEEK --output FILE` supplies `--previous`.
Build with `week_board.py --target web`; artifact mode remains the default only
for compatibility. `board_web.py publish-web FILE --assets MAPPING` is dry-run;
`--apply` uploads immutable bytes and activates only after verification.

`board_web.py rollback WEEK BUILD_ID` previews; `--apply` selects a prior verified
manifest and reads the pointer back. It never reverses interaction data. Keep all
prior builds and source archives. If a code rollback is necessary, prefer a known
good board-capable release. Pre-migration deployments were CE
`dpl_YcVYDd84ugrmat4is8PtXkLG3LUE` and CC `dpl_GyMZVCy1NkJU12JtBLk6TNVK7wVm`;
restoring them would remove the new board routes and needs an explicit maintenance
decision. Do not drop tables, delete archives, overwrite assets or reopen Claude
as an interaction source automatically. Diagnose and preserve current web state.

Monday's editorial/video branch and Friday repairs were not merged or modified by
this migration. Apply future replacements only after their separate review and
publication authority.
