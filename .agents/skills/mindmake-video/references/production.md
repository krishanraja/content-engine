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
2. Evidence: inspect the exact screenshot contact sheet and source files, then approve the packet hash. Treatment must fail closed if a screenshot changes after approval.
3. Treatment: approve the exact render-manifest hash when the treatment is new.
4. Final: approve the exact master-video hash after QA.

Never substitute chat agreement for the recorded approval.

## Visual prior

Keep the presenter or guest primary. Use interfaces, evidence, diagrams, headlines, and owned artifacts as supporting beats. The Money of AI is mechanism-led and commercially authoritative. Built With AI is tactile and operational. Use one shared Mindmaker skeleton with distinct accents.

Every treatment must make an explicit supporting-visual decision against the spoken claims. Prefer short, timed evidence screenshots, interfaces, owned artifacts, or diagrams that explain the mechanism. Record attribution, source URL, editorial purpose, rights rationale, and approval for every third-party excerpt. If presenter-only footage is genuinely stronger, record why no overlay is needed. Never substitute generic decorative B-roll for missing proof.

Before capturing external evidence, show Krish a short source-and-headline shortlist. Recommend one option, state the strongest reason it may fail, and prefer one exceptional headline over two merely relevant pages. Do not spend time capturing or laying out a source that has not survived this editorial preflight.

Headline evidence must earn the interruption:

- Prefer primary authorities and tier-one reported news, then corroborated specialist trade reporting. Vendor marketing and secondary blogs cannot receive full-screen proof treatment.
- Treat 60 days as the default ceiling for `fresh_news` and 180 days for `current`. Older material must be genuine primary research or evergreen evidence, not stale reported news relabelled as evergreen.
- Reject generic service content, marketing claims, listicles, guides, SEO headlines, and pages whose relevance exists only in the body copy.
- The visible headline must name a development, quantified consequence, conflict, or structural shift that directly matches the spoken claim.
- Specialist trade claims require independent corroboration. Record the strongest objection even when the source passes.
- Budget enough screen time to read the headline. In a short clip, use one strong headline if two would create rushed proof beats.
- Capture only the useful source logo, exact headline, date, and decisive visual or statistic. Remove browser chrome, cookie banners, unrelated navigation, and unreadable body copy before the exact screenshot approval packet is created.

Orchestrate each beat around the viewer's immediate task:

- `presenter_primary`: Krish's expression or delivery is the value. Use only a short, low-reading-load corner card in verified negative space.
- `sidecar`: the viewer needs Krish and a simple artifact simultaneously. Reserve a deliberate side of frame; never float it over a face.
- `evidence_ribbon`: default for a headline or compact screenshot that should remain inside a portrait presenter shot. Anchor it across the lower-middle torso/background area, preserve the full face and expression, and keep captions below it.
- `evidence_cutaway`: the viewer needs to inspect or verify proof. Replace the presenter intentionally, keep captions clear of the proof, then return to Krish for connection and the ending.

Do not make captions, presenter expression, and dense evidence compete for the same moment. Use sentence or claim boundaries for transitions. Prefer an evidence ribbon over a complete cutaway when the approved source remains legible at portrait width; reserve complete cutaways for proof that genuinely needs uninterrupted inspection. Unless the ending itself is an essential artifact reveal, return to an unobstructed Krish for at least the final second.

Captions should carry visual personality through an approved treatment preset: selective emphasis, purposeful movement, and series-specific accents while preserving safe zones and exact transcript-word fidelity. Avoid random word animation, permanent oversized blocks, or effects that compete with evidence. A new caption personality remains a treatment approval decision until Krish confirms it.

Generated media is exceptional and must be labelled as illustration where it could be confused with evidence. Third-party excerpts require attribution, an editorial purpose, and a recorded rights rationale.

## Output

Normalize to 1080 by 1920, constant 30 fps, 48 kHz. Use phrase captions with at most two lines and selective emphasis. Package the master, caption files, titles, post copy, claims, asset ledger, provenance, QA, and approvals.
