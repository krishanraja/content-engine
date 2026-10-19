# Friday video repairs — final review report

Both finished files were accepted by Krish after complete review with sound. The short is v8, 87.75 seconds; the deep cut is v4, 816.512 seconds. No media changed after those acceptances. The assistant inspected sampled frames and native-resolution captions; it does not claim complete audio/video playback.

| Check | Short, 9:16 | Deep, 16:9 |
|---|---|---|
| SHA-256 | 93a10b5bcb6af642878c3bd1d100bfec659f93ccd790b8850cd5c49ffbdd6eec | 4b908e3a93083be29fa538a13e790e9304151b237170f44f90102a4d3fdf63b9 |
| Calibrated sync checkpoints, seconds | 5, 18, 31, 44, 57, 71 | 30, 180, 342, 480, 630, 780 |
| Offsets, ms | -40, 0, 0, 0, -40, -40 | -40, 0, -40, 0, 0, 0 |
| Voice loudness | -13.9 LUFS | -14.0 LUFS |
| Final mix loudness | -14.5 LUFS | -14.5 LUFS |
| Final true peak | -1.8 dBTP | -1.3 dBTP |
| Speech-bed windows in normal range | 748 / 748 | 7331 / 7331 |
| Speech-bed silence longer than 0.5 s | None | None |
| Visual coverage | 99.962%; longest gap 0.03 s | All scheduled cards inspected; short density thresholds do not apply |
| Visual changes | 24.54 per minute; 32 steps | 77 cues |
| Essential authored text at 1080 width | Minimum 67 px, 66 lines | Minimum 53 px, 227 lines |
| Essential real control labels | Minimum 70 px | Minimum 49 px |
| Sampled frames inspected | 88 seconds + 38 intro/outro samples | 817 seconds + 90 intro/outro samples |

SyncNet uses 40 ms measurement bins; the source frame period is 41.67 ms. These are bounded measurements, not sub-frame proof. Known +/-200 ms injected offsets calibrated the measurements. One deep-cut sample at 330 seconds was inconclusive because its fixed crop crossed a layout transition and contained chapter text; it remains recorded as inconclusive, not a pass. Stable windows on either side were measured separately; 342 seconds is the replacement checkpoint and 320 seconds is an additional passing observation.

The original drift was reproduced at up to 680 ms. The earliest demonstrated defect was segment encoding: 62 pieces lost 668.44 ms of PCM audio against picture duration. The repaired encoder drains the filters and checks exact frame/sample counts. No unexplained global offset was applied; the withdrawn timestamp-gap diagnosis remains withdrawn.

## Speech and caption differences

The short has eight raw recognizer differences, retained in short-v8-caption-comparison.json. Independent source/final recognition, byte-identical decoded speech across visual revisions, Krish's explicit “I'm 85% sure of this” correction and his complete review resolve delivery acceptance.

The deep has 79 raw small.en recognizer differences. Independent medium.en recognition of the exact finished mix recovers the apparent 14-word omission around 5:49–5:57 in full. Spelling/tokenization differences include ChatGPT/chat GPT, OpenAI/open AI and centres/centers. Full source and final recognition also retain fillers and self-corrections. The simplified captions do not repeat every spoken stutter; that caption treatment was included in Krish's complete acceptance. The raw comparisons remain available, and acceptance is not represented as zero ASR differences or individual word-by-word human adjudication.

Script differences are separate from speech checks. Spoken ad-libs have not been rewritten to fit the approved script. Caption spelling repairs are bound to source, processing speed, edited clock and exact token hashes.

## Visuals, music and evidence

Real badges, photographs and unchanged user-provided control screenshots replace the drawn car treatment. Mercedes = Claude and C-Class = Opus 5.5 are distinct steps. Sally has an illustrated character; the full card set was checked for unexplained empty space. Added eyebrows and source-credit overlays were removed. Approved titles, thumbnails and story clips remain. Image credits and licences are in the accompanying credit file.

The approved no-curves-instrumental track provides continuous deep-cut music, starting at -31 LUFS under speech and -22 LUFS chapter lifts, with 0.5-second rise, 0.8-second fall and two-second track crossfades. The measured speech-bed requirement is -36 to -28 LUFS outside lifts and transitions.

The two adjacent validation receipts bind all five gates to exact video hashes and destinations. The working repair folder holds the production-input archive and the complete sampled-frame/sync-evidence archive. The final QA evidence archive contains detailed measurements, raw transcription comparisons, human review records and regression results.

npm run verify passed: 1781 tests, one skip, 142 test files, both type checks and repository checks. Windows-only exclusions are explicitly reported for checks requiring Linux deployment paths. The failure register now has 33 guarded failures and none open; unrelated general learnings remain open.

**Publication remains a separate decision. The live article fact gate is failed. Revised-card evidence has been checked and preserved; accepting these video repairs does not clear the article or authorize social publication.**
