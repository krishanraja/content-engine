# Production assembly

This reference governs how the stations are assembled and approved. It does not own the detailed judgment inside any station.

## Source modes

- `extract`: find a self-contained 18 to 75 second argument in long-form material.
- `solo`: refine an existing direct-to-camera recording.
- `short_native`: receive an approved Control Center production brief, create a record-ready script and capture it in the weekly batch.

Apply `editorial-selection.md` before angle approval. The engine should return no publishable candidate when the source cannot support one. A transcript search result is not an editorial recommendation.

## Assembly

The executable order, prerequisites and invalidation graph are in code. The machine-validated inventory at `stations/registry.json` and each station's `station.json` own discoverability and typed boundaries. The matching `STATION.md` owns that station's responsibility, quality bar, fallback, handoff and learning boundary.

The extract and solo assembly is:

`ingest -> normalize -> transcript + source analysis -> candidates -> claims -> visual plan -> assets -> styleframes -> animatic -> treatment -> render -> QA -> package`

Short-native begins before recording:

`brief -> script -> candidates -> claims -> angle approval -> recording brief -> recorded ingest`

A replaced take invalidates only media-dependent descendants. CI rejects drift between station contracts and the executable graph.

## Approval gates

1. Angle: approve the exact candidate and claims after truth, meaning and rights review.
2. Visual plan: approve exact attention, camera, proof, technique and fallback decisions. Soft blocks require a recorded override reason.
3. Evidence: inspect and approve the exact source and asset pixels. Any later pixel change creates a new asset and approval requirement.
4. Storyboard and animatic: approve phone-size styleframes and the timed low-resolution argument before treatment.
5. Treatment: approve the exact platform render manifests.
6. Final: approve each exact platform master after QA.
7. Package: approve the titles, copy, cover, captions, disclosures, ledgers, provenance and delivery settings as one exact artifact.

Never substitute chat agreement for the recorded approval.

## Shared output contract

Normalize video to 1080 by 1920, constant 30 fps and 48 kHz. Target approximately -14 LUFS integrated and no more than -1 dBTP true peak. Use phrase captions with at most two lines, safe-zone validation and selective emphasis.

Package the master, caption files, titles, post copy, claims, asset ledger, provenance, QA and approvals. Archive or private-upload only the approved package hash. Public publishing remains outside the engine.
