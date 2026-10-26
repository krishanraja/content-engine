# Independent media reviewer: bounded calibration

Status: eight authorised requests completed, reviewer failed calibration, production activation held. See [results and evidence](2026-10-26-quality-evidence/README.md). Krish approved the $3 ceiling; $2.25536 was conservatively reserved, with a $0.171354 reported-token estimate (not an invoice). The model invented speech in both a video without audio and an all-zero PCM control. No signing or qualification was enabled. Credentials remained in the hosted runtime.

## Exact pilot scope

Use Gemini 4 Argon on the paid Standard API, with no grounding, search, caching purchase, generation or background subscription. Run at most eight requests: accepted short voiceover audio, rejected join reel, accepted photographic styleframe, rejected icon treatment, latest frozen insulation motion proof, latest frozen supply-chain carousel, and at most two bounded diagnostic reruns. Resolve each input from the saved evidence manifests and hash-check it before submission. Keep output as calibration evidence; it cannot issue a production pass.

Before every call, count input tokens and refuse over 100,000. Cap generated output including thinking at 8,192 tokens. Reserve the maximum charge before issuing the request; count a timed-out request as spent and never retry automatically. At the rates checked on 26 October 2026 ($2/million input; $10/million output through November 30), each call is at most $0.28192 and eight calls at most $2.25536. Request a $3 total ceiling. Refuse if the price, model, request count, token ceilings or input identity differs. Runtime/infrastructure charges are not authorised by this pilot.

The October 23 service-economics snapshot has no model-provider meter rows, so there is no trustworthy prior-run estimate. The ceiling above is a conservative token bound, not an invented historical estimate. Record actual usage and charge after each request.

Sources: [provider pricing](https://ai.google.dev/gemini-api/docs/pricing), [video understanding](https://ai.google.dev/gemini-api/docs/video-understanding). Default video sampling may miss short motion defects. The pilot must inspect transitions at sufficient temporal density and combine full audio processing with source/acoustic evidence. Provider support is not proof of listening quality.

## Qualification of the reviewer

Use neutral input names and withhold expected labels during first interpretation. The listener must distinguish the known accepted audio from the rejected joins and locate the user-identified defects, rather than merely reconstruct a plausible transcript. The visual judge must reject the known icon treatment for the applicable criteria, recognise the accepted frame's limited scope, and identify ambiguous new-story relationships. Preserve uncertainty and raw provider evidence. A plausible response or one correct control is insufficient calibration.

The pilot carries no signing key and cannot qualify production. If it fails, retain the failed evidence and stop at the ceiling. If it succeeds, provision a separate reviewer runtime whose private signing key never enters the producer environment; independently read back its public registry and rerun exact-artifact API bypass tests. Finish Control Center readiness integration and verify normal draft-board updates before deploying gates. Do not deploy a verifier with no functioning reviewer, since that would block every board activation.

Friday remains four unfinished videos and a final Publish Board. Preserve the approved short-VO audio bytes; no rejected join may be applied. No public publication is authorised by this pilot.
