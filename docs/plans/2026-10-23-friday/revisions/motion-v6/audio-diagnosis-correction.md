# Audio diagnosis correction, 26 October 2026

This note supersedes only two unproven timestamp claims in the preserved historical `audio-diagnosis.json`: that resume 33.23 seconds is confirmed inside “Use”, and that resume 39.80 seconds is confirmed inside “I”. The rejected reel remains rejected. This is neither approval of those boundaries nor approval of any replacement cut.

Actual 48 kHz PCM from the continuously sped 1.12x processing source contains a below -50 dBFS RMS interval 32.962–33.270 seconds and another 39.476–39.840 seconds (2 ms analysis windows). Existing ASR word spans include preceding pauses, so interval overlap alone does not prove speech clipping. CTC emissions occur later and are not exact acoustic word boundaries. Low-energy measurement likewise does not certify phonetic silence or a natural join.

The first join’s “all / the” transition remains materially different: no qualifying 40 ms acoustic clearance is established. The first cut is blocked. The proposed earlier resumes for joins 2 and3 remain unapproved and unapplied; join 2’s departure is still tight.

Evidence: `audio-pcm-evidence-2026-10-26.json` contains the PCM method, exact source hashes and measurements. `audio-repair-proposal-2026-10-26.json` contains the narrow authorized removals, all boundary limitations, and clock mapping: processing=raw×25/28, raw=processing×28/25. This nominal mapping is not a substitute for measuring speech on the current PCM; never speed that source again.

The waveform and reproducibility files are filed as working evidence only. Their exact engine-library paths and independent downloaded-byte SHA-256 checks are in `../../../2026-10-26-quality-evidence/canary-reproduction-and-pcm-receipt.json`. Friday diagnostic material there is not an insulation scene asset or a reusable brand kit. No original recording was modified, no rejected cut applied, and no listening, signed qualification or production-readiness claim was made.
