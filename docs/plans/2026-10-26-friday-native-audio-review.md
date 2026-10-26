# Friday native audio review

Status: prepared, awaiting explicit spend approval. No requests executed.

Purpose: repair and verify Friday's remaining speech edits through actual audio input. The local Omni control missed an intentionally removed portion of a word. Gemini calibration also failed its controls. Neither route can approve the cuts.

Provider/model: OpenAI Realtime `gpt-realtime-2.1`, text responses only. Existing authorised runtime credential, never copied into evidence. Each request starts a fresh session, disables turn detection and automatic responses, sends one complete PCM24k mono audio item, requests one response, then closes. No tools, transcription service, generated speech, conversational history, retries or model fallbacks.

Maximum additional spend: $3 total, separate from the exhausted eight-request Gemini calibration authorisation. Maximum 40 requests including failures: four controls, then at most 36 Friday source/candidate/final audio reviews. Each input is at most 60 seconds; combined prompt at most 2,000 UTF-8 bytes; response at most 1,024 tokens. Reserve $0.07 before every request and stop before the reservation sum exceeds $2.80; remaining $0.20 is safety margin, not permission for another request. Log returned token usage and stop on anomalous billing/usage. No automatic retry.

Cost basis, checked 26 October 2026: $32/M input audio tokens, $4/M input text tokens, $24/M output text tokens. User audio is approximately one token per 100ms, plus small special-token overhead. Per-call expected upper envelope: 600 audio tokens ($0.0192), 2,000 text tokens ($0.008), 1,024 output tokens ($0.024576), total $0.051776 before overhead. Reservation is $0.07. Sources: https://developers.openai.com/api/docs/pricing and https://developers.openai.com/api/docs/guides/voice-latency-cost .

Controls, with labels and expected outcomes withheld from the reviewer:

1. Zero PCM silence (`audio-qa/gguf-route-control/K7.wav`). Must report no speech.
2. Unmodified source (`audio-qa/gguf-defect-control/V6.wav`). Must recover the central spoken words without inventing material content.
3. Same source with 190ms removed inside American (`audio-qa/gguf-defect-control/R4.wav`). Must identify the interior speech damage rather than say there are no audible defects.
4. User-rejected join reel (`join-candidates/Friday-join-candidates.wav`). Must identify the user-reported interior join defects. The exact file hashes and durations are recorded before execution.

Prompt for every blind control: “Listen to the supplied audio. First transcribe what is actually audible, marking incomplete words or uncertainty rather than completing them from context. Then identify abrupt internal speech edits, clipped syllables, repeated words or unnatural joins with approximate times and the words around them. Ignore whether the outer clip edges form a complete sentence. Distinguish silence from speech. Do not infer a clean recording from a plausible sentence. Return concise JSON with transcript, audible_defects, uncertainty.”

Stop after controls if discrimination fails. A passing control set only permits Friday diagnostic use. It does not qualify the engine's general reviewer, activate enforcement, sign a release, or replace exact-file approval. Follow-on inputs are confined to Friday originals, repaired candidate joins and the finished four audio tracks in contiguous overlapping chunks. Record each file hash, exact sample range, reserved cost and result before deciding the next request. Preserve source audio; no synthetic reconstruction of Krish's voice.

Success: audible evidence supports each repaired join and a continuous pass of each final audio track; unresolved words or defects remain blocking. Full visual playback and factual checks remain separate.

## Execution record, 26 October

Krish approved the additional $3. Thirteen shared-budget reservations total $0.91; reported estimated spend is $0.178743 including unsuccessful diagnostic routes. A through F native audio controls did not qualify a listener. T1 through T5 used Whisper native audio transcription for exact-file word timestamps (including two superseded short candidates), without supplied script text. This bounded fallback provides transcription evidence only, not release certification. The current three exports are T3, T4 and T5; the short VO preserves previously approved audio. No recurring spend or ongoing reviewer qualification follows. See motion-v7/additional-budget-readback.json and SHIPPING.md.
