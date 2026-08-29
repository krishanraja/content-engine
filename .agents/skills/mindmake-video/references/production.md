# Production workflow

## Source modes

- `extract`: find a self-contained 18 to 75 second argument in long-form material.
- `solo`: refine an existing direct-to-camera recording.
- `short_native`: approve a radar angle, create a record-ready script and capture it in the weekly batch.

Apply [editorial-selection.md](editorial-selection.md) before angle approval. The engine should return no publishable candidate when the source cannot support one. A transcript search result is not an editorial recommendation.

## Stage order

`ingest → normalize → transcript → candidates/claims → treatment → render → QA → package`

Short-native adds `brief → script → recording brief` before ingest.

## Approvals

1. Angle: approve the exact candidate file hash after claims and rights review.
2. Treatment: approve the exact render-manifest hash when the treatment is new.
3. Final: approve the exact master-video hash after QA.

Never substitute chat agreement for the recorded approval.

## Visual prior

Keep the presenter or guest primary. Use interfaces, evidence, diagrams, headlines, and owned artifacts as supporting beats. The Money of AI is mechanism-led and commercially authoritative. Built With AI is tactile and operational. Use one shared Mindmaker skeleton with distinct accents.

Every treatment must make an explicit supporting-visual decision against the spoken claims. Prefer short, timed evidence screenshots, interfaces, owned artifacts, or diagrams that explain the mechanism. Record attribution, source URL, editorial purpose, rights rationale, and approval for every third-party excerpt. If presenter-only footage is genuinely stronger, record why no overlay is needed. Never substitute generic decorative B-roll for missing proof.

Captions should carry visual personality through an approved treatment preset: selective emphasis, purposeful movement, and series-specific accents while preserving safe zones and exact transcript-word fidelity. Avoid random word animation, permanent oversized blocks, or effects that compete with evidence. A new caption personality remains a treatment approval decision until Krish confirms it.

Generated media is exceptional and must be labelled as illustration where it could be confused with evidence. Third-party excerpts require attribution, an editorial purpose, and a recorded rights rationale.

## Output

Normalize to 1080 by 1920, constant 30 fps, 48 kHz. Use phrase captions with at most two lines and selective emphasis. Package the master, caption files, titles, post copy, claims, asset ledger, provenance, QA, and approvals.
