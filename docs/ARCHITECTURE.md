# Architecture

## State model

Each job freezes its current studio configuration and complete skill directories under `pinned/`. `job.json` is the materialized state; `events.jsonl` is append-only. Every stage artifact is schema-validated, content-addressed from semantic inputs, and immutable. Timestamps are audit metadata and do not affect semantic hashes.

V1 extracted jobs remain resumable. New V2 work follows:

```text
ingest -> normalize -> transcript + source_analysis
       -> candidates -> claims -> visual_plan -> assets
       -> styleframes -> animatic -> treatment -> render -> QA -> package
```

Short-native work adds the pre-recording path:

```text
radar/brief -> script -> candidates -> claims -> recording brief -> recorded ingest
```

An approved short-native script stays upstream when a recording is replaced. Re-ingest invalidates transcript, visual analysis, and visual descendants without discarding the editorial decision that caused the recording.

## Station machinery

The production graph is a mechanical assembly of independently governed stations, not one procedural prompt. `mindmake-video/SKILL.md` is a thin router. Shared editorial, visual, safety and learning policies remain focused cross-cutting references. Every executable V2 stage has its own station directory under `.agents/skills/mindmake-video/stations/` containing:

- `station.json`: the typed machine boundary, version, owners, prerequisites by source mode, inputs, outputs, approval gate, invalidation map, fallback, learning permissions and regression cases.
- `STATION.md`: the judgment needed at that station, including its responsibility, quality gates, failure behavior, handoff and change-control rule.
- Existing deterministic test files named by the station contract as its regression evidence.

The small `stations/registry.json` is an inventory and assembly map. It is not a second implementation of the engine. The runtime graph remains executable code, while the station files own operating judgment and boundary metadata. `npm run check:stations` proves exact parity between the registry, station contracts and runtime order, prerequisites and descendant invalidation. It also verifies that every named owner, test and instruction exists and content-addresses every contract and instruction card.

The registry also declares the conveyor's `external_inputs` and `terminal_outputs`, and `npm run check:stations` proves the artifact topology across every station's declared inputs and outputs: each produced artifact needs exactly one producing station and either a consuming station or a declared terminal output, and each consumed artifact needs either a producing station or a declared external input. A missing producer, a duplicate producer, an orphaned output or an unowned terminal output fails the check rather than reaching runtime.

This creates four separate kinds of authority:

1. Prose owns intent, judgment, stopping conditions and handoff behavior.
2. Zod schemas own data shape and reject incompatible handoffs.
3. TypeScript owns execution, state transitions and invalidation.
4. Fixtures and validators own admission to release.

No production station can activate a learning rule. Stations emit observations; the governed feedback lifecycle may propose a scoped rule; Krish approves a durable change; reviewed Git configuration activates it. Operational telemetry, taste feedback and performance evidence remain separate.

New formats reuse the shared upstream editorial workpiece and add only genuinely different downstream stations. A carousel, video or future long-form path must not clone the ideas pipeline, evidence ledger, voice rules, feedback memory or Control Center review surface. A proposed new station is admitted only when it has a distinct responsibility and owner, typed inputs and outputs, real failure behavior, regression cases and less overlap than extending an existing station. This keeps the machinery flexible without turning it into a collection of competing skills.

`SourceBundleV1` holds up to 32 aligned camera, audio, and screen sources. `SourceVisualAnalysisV1` records normalized tracks, shot boundaries, active-speaker confidence, gesture and gaze intervals, safe negative space, protected presenter regions, capability downgrades, and conservative fallbacks. A Krish face template is encrypted in Windows-runner state and supplied to the analyzer over stdin; neither its descriptors nor source images enter Git, a job manifest, command arguments, or logs. Its manifest reference contains only the fixed profile ID and content hash. Guests receive job-local labels only. An ambiguous identity match remains unknown.

`VisualNarrativePlanV1` is the editorial-to-render boundary. It binds the exact candidate, claims, source analysis, technique registry, and preference snapshot; gives every beat one primary attention target and narrative function; specifies layered shot and camera decisions; links proof to exact assets; declares fallbacks; and enforces the local-first £15 cloud ceiling. Generated media has the truth role `illustration`, never `evidence`, and synthetic speech is not supported.

New visual treatments must pass exact-asset review, phone-size styleframes, and an audio animatic. The renderer consumes only the resulting immutable `RenderManifestV2`. Four platform manifests share the approved edit but have platform-specific safe zones, copy, covers, and delivery records. After all target masters pass QA and receive exact final approval, the complete package artifact receives a separate Krish approval before archive or private upload.

Discovery candidates are mechanical search windows and cannot be approved. Codex authors the publishable `CandidateV1` with an `EditPlanV1` and `EditorialAssessmentV1`. The edit may contain one continuous segment or a bounded set of stitched source segments; every cut, final order, source-order change, cold-open decision, throughline, and ending is explicit.

Caption treatment is deletion-only: captions may omit filler, false starts, accidental duplicates, and redundant setup, but every remaining token must occur in the verified selected transcript and original spoken order. Punctuation, capitalisation, and identity corrections backed by known speaker metadata are the only transformations. The approved caption script reuses the matched word timings. A changed caption treatment invalidates render, QA, and package; it does not invalidate transcription or source discovery. Short-native re-ingest does not invalidate the approved script.

## Editorial gates

Hard blocks cover truth, rights, confidentiality, meaning, canonical naming, transcript fidelity, identity, semantic coherence, publishable impact, audience value, and ending quality. The approval command independently recomputes them and refuses to override them. Soft clarity, novelty, engagement, or audience-fit blocks require an explicit override reason tied to the exact candidate hash.

External headline evidence has an independent editorial-quality gate. Fresh news defaults to a 60-day ceiling; current sources to 180 days. Full-screen evidence excludes vendor marketing, secondary blogs, guides, listicles, generic service copy, and marketing claims. It also enforces authority, specificity, consequence, spoken-claim match, visual legibility, corroboration for specialist trade reporting, and enough duration to read the visible headline. The evaluation date is frozen into the packet so an approved job remains resumable without silently becoming stale later.

The default is one continuous cut. Stitched edits must be materially stronger, non-overlapping, and coherent as one argument. A source-order change must be declared and justified. Longer-than-30-second work records whether a roughly five-second source-grounded cold open helps; it is never added mechanically. When no edit passes, `rerecord` requires an actionable hook, missing proof, structure, delivery, ending, and duration brief.

Short-native candidates pass the same quality floor before a recording brief exists. When every proposed script is blocked, the script and diagnoses remain recorded but the `recording_brief` stage stays pending. Cadence alone cannot advance the job into recording.

The system stores facts, inferences, and judgments separately. Proper nouns, products, legal wording, numbers, and consequential factual claims enter `needs_review` and block treatment until the candidate ledger is edited with evidence and re-approved. Series fit requires both AI context and the series-specific commercial or implementation mechanism. It is not inferred from transcript length.

## Deterministic media decisions

- Input timing is normalized to constant 30 fps and 48 kHz audio.
- The manifest records every source segment and final order, exact trim, crop, caption cues and personality, timed evidence beats, their viewer intent and presentation mode, asset rights and attribution, series colour, and fixed seed.
- Inter 800 is pinned through npm rather than relying on a host font.
- Source audio is transcribed once with faster-whisper INT8 and word confidence. Project vocabulary is passed as transcription context. Approved wording reuses those timings across treatments.
- Final audio uses measured two-pass normalization toward -14 LUFS with pre-codec headroom for a true peak at or below -1 dBTP.
- QA checks dimensions, frame rate, sample rate, loudness, true peak, duration, caption limits, caption provenance and semantic alignment, canonical copy, frame perceptual hashes, audio characteristics, and responsive official-wordmark legibility.

Brand placement is a deterministic cue timeline. The theme freezes the complete real letter region inside each hash-pinned series asset, including antialiased edge pixels, and requires at least 50 region pixels at 1080 output, equivalent to at least 17 CSS pixels in a 375-pixel preview. This is calibrated to keep at least 16 CSS pixels of high-contrast letter ink. Each video selects one collision-free 1.2 second series identity cue in opening, ending, then safe-beat priority. The expanded official stack is preferred; the official series-only identity is allowed only when it clears the same letter and full-width-containment floor. All remaining dense story time uses the compact official Mindmake-only anchor. The compositor uses an explicit `branding` layer corner when present; otherwise authored camera lead room provides the face-safe preference. It tries the other approved top corner and later safe windows before blocking. A protected visual occupying every permitted placement is a render block, not permission to cover the visual, cover Krish, or shrink a mark below its floor.

MP4 bytes are not expected to match across different hardware. Functional equivalence is assessed from the edit manifest, cue timing/text, perceptual frame hashes, and audio measurements.

## Learning boundary

Feedback is captured from approvals, explicit comments, exact structured diffs, and re-imported external finals. Every event records whether it came from the user, Codex, or the system. Codex and system diagnostics remain observations and cannot become taste rules. External-video comparison records transcript, scene cuts, crop-sensitive frame fingerprints, duration, and loudness; optional SRT, EDL, and FCPXML sidecars preserve exact editor decisions.

Feedback moves through `observed -> inferred -> confirmed -> trial -> eligible -> user_approved -> active -> retired`. Runtime observations and rule proposals are derived state. Approval creates a content-addressed configuration-change proposal; it does not mutate active configuration. A rule becomes active only after the exact rule appears in reviewed Git configuration. A broader scope requires three confirmed instances across at least two jobs.

Performance experiments must name one primary variable. Views cannot make a rule eligible. Three comparable control and treatment observations must improve the target without degrading qualified action; the result remains a proposal until user approval.

## Control plane and independent runner

Control Center stores a redacted projection, not another copy of the media system. Local append-only job events and immutable stage artifacts remain authoritative. The cloud projection contains safe titles, safe summaries, stage and route states, exact revision and artifact hashes, a semantic target-map hash, five hard-gate results, and private proxy object keys. It cannot contain media bytes, transcripts, local or Drive paths, credentials, raw logs, private source objects, or database identifiers.

The Windows runner is claim-driven. It authenticates with a dedicated bearer credential, validates an exact schema-major-one command, binds it to the current local revision and artifact, and compiles free-form direction into a small typed operation set. Crop scale, exact caption-token emphasis, approved overlay placement, opacity, and within-beat overlay timing are presentation controls. Meaning, claims, evidence content, story structure, unsupported directions, and no-op directions return to editorial review without producing a candidate.

Prepare commands create an immutable child candidate and real low-resolution Before and After MP4 proxies. The runner uploads each proxy directly to a command-bound signed private-storage URL, verifies the resulting content-addressed object through the control plane, then completes with a signed receipt. Vercel never receives MP4 bytes and the runner never receives a storage service credential. Activation and return are separate exact-hash commands. Return creates an auditable new activation result and never rewrites history. A signed local cursor and immutable cloud lineage retain every immediate parent, so candidate-to-candidate edits can return repeatedly to the original base without truncating ancestry. The maximum undo depth is 100. Activation, return, and every recorded review decision advance the local revision and publish a freshly bound semantic target-map hash, so a later mobile edit cannot inherit stale targeting.

Each projection is compare-and-swap bound to the complete last acknowledged platform state. Its source event count, event-chain hash, and semantic revision come from one authenticated local ledger snapshot. Non-failed command receipts carry the same post-dispatch source tuple. Control Center stores the tuple atomically, accepts only monotonic advancement or an exact equal-state catch-up, and rejects delayed or divergent projections. Pending project requests and command receipts are signed and reconciled before new work is claimed.

The treatment artifact contains all platform manifests, so v1 deliberately allows only one active magic-edit lineage per job. Other-platform projections and commands are blocked until return to root. A revision-only editorial or final-review projection may advance during the active lineage; its treatment artifact, candidate, and parent tuple remain immutable. Platform-scoped treatment artifacts and merge-on-return are a future protocol change, not an implicit v1 behavior.

Non-activation `review_decision_record` commands synchronize story, treatment, final, learning, and keep-current decisions back into the authoritative local event ledger. The event binds the exact review, parent, review artifact, platform, feedback, override reason, learning action, semantic command hash, originating command-attempt UUID, and Krish attribution. It is domain-separated HMAC signed and idempotent. A fresh attempt UUID may resume an exact semantic command after a crash, but it reuses the originally signed event and cannot change any decision or lineage field. Keep-current records the negative decision without granting approval. A positive story, treatment, or final decision also records the exact local approval; final approval is accepted only when the platform master still matches its local content hash. The active media artifact remains unchanged because this command records governance rather than activating a media candidate.

`review_recovery_record` is the only bridge from a terminal cloud command back to a decidable review. It creates a signed local alias for the exact existing review identity and records its root and bounded generation without mutating the job revision or media artifact. The recovered binding preserves the first bridge attempt as provenance, while an exact semantic retry may finish a missing signed recovery event or receipt under a new attempt UUID. A signed failed receipt proves a runner failure, an authenticated claimed-command envelope proves exhausted attempts, and the absence of either local record is required for a command that expired before claim. The runner rejects mismatched semantic hashes, review lineage, evidence type, or recovery chain.

Receipts are HMAC signed over canonical JSON and journaled before completion. Claimed command envelopes are separately HMAC journaled before dispatch, without lease credentials. A committed completion whose HTTP response is lost fences its job and is retried from the receipt journal; unrelated jobs may continue. The exact command may be reclaimed only to the same stable installed runner identity, which atomically rebinds the outer journal to the fresh lease without changing the signed receipt. A matching terminal receipt can therefore be acknowledged after its original lease expires. If Control Center reports a deterministic unrecoverable authority state, including a recovery that already won, the original receipt is preserved in signed quarantine and surfaces explicit attention instead of retrying forever. Unlike an ordinary pending receipt, this contradictory history stops the whole runner before project replay, discovery, claim, or preview retention until bespoke operator reconciliation. Every such stop still sends one best-effort degraded heartbeat containing only path-free counts and safe attention state. Transient lease, provider, or media availability errors do not create a contradictory terminal receipt. The lease expires and the server may issue a bounded reclaim. Historical pre-cursor success receipts are authenticated acknowledged evidence only: they cannot be replayed, submitted, or used for recovery, and a legacy non-failed pending receipt is quarantined. A missing Drive mount is heartbeated as degraded and no media command is claimed until the mount returns.

The daemon singleton lock binds its PID to the operating system's process-start identity and records acquisition time. This prevents an unrelated process which later inherits a crashed runner's Windows PID from making the stale lock permanent. Legacy locks without an instance identity are reclaimed only when the live process start time proves PID reuse; ambiguity remains a hard concurrent-runner block.

V1 job bootstrap is explicit. `studio v2 runner project` verifies the exact current local treatment approval, builds its semantic target map, removes local-only fields, and publishes one idempotent per-platform review launcher. For a final launcher it also verifies the exact master hash and passing QA. Before any cloud command claim, the daemon records one bounded mounted-Drive discovery scan. It does not project intake candidates or create jobs automatically.

## Mounted Google Drive discovery

The configured Drive root contains two separate, non-overlapping surfaces: `Inbox` for incoming recordings and `Archive` for approved deliverables. Discovery never scans the root or Archive. Lexical and resolved-path boundary checks fail closed. The first healthy scan binds the resolved Inbox identity. Transient outages preserve trusted history while candidates become unavailable; a different resolved folder or mounted account stays blocked until Krish approves an append-only old/new fingerprint rebind. `events.jsonl` under ignored local runtime state is the append-only authority; a partial final append is recoverable while earlier corruption is not. `state.json` is only a verified, rebuildable materialization. Candidate artifacts are content-addressed. Files remain in Drive and no media is copied into Git or Control Center.

A supported file must keep the same size, modification time, and filesystem identity across at least two scans, satisfy the configured stability interval, survive first-byte and last-byte access probes, and remain unchanged while SHA-256 hashing completes. New and expired hashes share a pinned byte budget; verified hashes are reused so the deterministic path-ordered queue advances on later scans. One file larger than the whole budget is identified separately and requires an intentional limit change. Sidecars have a tighter byte ceiling before hashing or parsing. Stable content is rehashed on a bounded interval, and exact review performs another full content check. A mismatch forces a hash-refresh scan before the stale action fails. Changed, zero-byte, unreadable, unsupported, missing, permission-denied, scan-limited, budget-deferred, and duplicate files remain explicit states. Content history is bounded and persists across restarts. If the historical canonical copy and another exact-hash copy both exist, the historical path remains canonical and the other copy is a duplicate. If the old path is gone and exactly one current copy remains, `content_location_rebased` deliberately moves the canonical location so a renamed or moved file does not remain a permanent duplicate. The content-derived candidate ID survives that move, while its path-bound candidate hash changes and invalidates any earlier review.

Only explicit DJI names ending in `part`, `pt`, `split`, `segment`, or `seg` plus a part number can form a sequence. Generic camera numbers are standalone clips. Automatic sequence trust is capped at 16 parts, while the content-addressed candidate manifest itself is bounded at 32 media components. A gap, repeated part number, larger group, omitted component, partial exact-stem association, multiple caption or edit match, or one association shared by several candidates creates an attention state. Exact-stem audio, SRT, VTT, EDL, and FCPXML are never guessed onto another recording. An SRT containing DJI camera or flight telemetry remains an attention item rather than becoming speech. Intake acceptance is bound to the Inbox identity, scan event, candidate hash, component hashes, and Krish's confirmation. Automatic SourceBundle drafting supports one video, at most one exact-stem audio source, and unambiguous typed sidecars. Job creation and ingest validate any intake provenance against the exact local scan and accepted review event, then ingest rechecks every media and sidecar hash. A split sequence requires explicit authoring so no input is silently dropped.

The portable job proof contains only the accepted candidate, its exact component observations, the immediately following accepted review, and a compact scan attestation. Proof creation validates the complete discovery ledger first. The attested health, configuration, and software values are audit anchors copied from that verified scan, not a claim that the excluded full Inbox snapshot can be reconstructed from the portable proof. The accepted review's previous-event hash must equal the attested scan event hash, and the whole portable proof is integrity-bound by the `intake_proof_hash` recorded in the job event ledger. Proof files use that hash as their immutable content address. Each source attachment records the current proof hash or explicit `null`, so replacing a take never overwrites history or leaves an older proof authoritative. Job creation and source attachment still require the live discovery ledger; later resume can validate the job-bound proof without retaining unrelated Inbox inventory.

Cloud heartbeats receive only the existing `ready`, `unavailable`, or `not_configured` Drive state. Local runner output adds path-free counts and safe codes. File names and inbox-relative paths are visible only through the explicit local candidate command. An accepted intake review records Krish's exact candidate-hash decision, but still does not create a production job. A human or Codex must author and inspect the source bundle metadata and start the normal editorial workflow.

## Radar boundary

The studio does no gathering. It reads `RadarFeedV1` from the existing mm-ctrl public pool and Control Center owned/operator patterns. Offline JSON fixtures use the same schema. Internal sanitized patterns are research prompts only and are hard-blocked from factual scripting until replaced with public evidence or approved case material.

## Art director repertoire

The art director extends the one versioned registry at `config/techniques.json`; it does not create a competing effects system. Reference work is reduced to analysis-only observations, atomic devices and optional recipes. Every device declares its narrative jobs, eligible series and formats, required inputs, contraindications, implementation state, render adapter, QA checks, production cost and fallback.

For each beat, eligibility fails closed before deterministic weighted scoring. The trace records every rejected and eligible candidate, exact scores, one primary device, at most two supporting devices and its fallback. Production visual plans bind one trace to every beat. A Short may carry at most one signature device and one experimental or invented device.

The sharp alternative is available only when no existing device clears the recorded threshold. It creates one bounded invention proposal in the experimental lane. It cannot enter treatment without exact Krish approval, phone-size styleframes and an animatic. Reference frames, compositions, copy and creator likeness remain prohibited production inputs.

Device feedback is append-only and scoped by job, session, series, mode, treatment or platform. Weekly aggregation can make a narrow strong correction or a repeated cross-job pattern eligible for promotion, but it cannot activate a rule. Conflicting evidence leaves the pattern observational. Active repertoire changes still require exact Krish approval and reviewed Git configuration.

The repertoire owns pre-treatment selection; `film-jury-v1` owns independent evaluation of the rendered evidence. Jury packets bind the same registry hash and selection traces so verdicts can cite the mechanism actually used. Jury scores, platform performance and Krish's taste remain separate evidence classes. None can silently promote a device.
