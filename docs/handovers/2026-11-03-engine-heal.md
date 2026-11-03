# Handover: engine heal of 3 Nov 2026 (PR #364)

Status: PR https://github.com/krishanraja/content-engine/pull/364 (branch claude/keen-dirac-t3k2uw) holds the reference
gate, captions.off_face, 4 Growth filing, channel safe zones, the motion standard, F26-F30 and the upright Fraunces.
CI on c5bc1a4 completed with nothing failed; CI on the head (upright Fraunces) was running at hand-off. Locally
`npm run verify` passes but for tests/quick-edit-mix.test.ts, which fails here only because this container's ffmpeg is
6.1 (CI pins ffmpeg 8).

Krish's go: "yes merge to main" (2026-11-03). A ve PR merges by hand: when every check on the head is green, merge
#364 (never auto-merge), then send_message session_01JRhKytctRBJEYF6oFABHVF one line: the merged PR link and what
changed (reference gate, captions.off_face, channel.safe_zones advisory, MOTION_STANDARD, upright Fraunces, four
Codex cards in docs/ve/cards/motion-standard/). Do not make the Thursday video.

Seen in a render of Thursday's props (upright Fraunces proof, 3 Nov): on the SPLIT beat at frame 313 the card's top-left
runs under the mark tile; card ve-motion-2-mark-clearance covers it.

Waiting on Krish: sign docs/ve/MOTION_STANDARD.md (signed since); the 4 Growth rule is superseded by 3 Posts as the one home (Ruling, Krish, 2026-11-03, #366); config/studio.json's
Instagram zones (bound into the signed media-standard hash) to the measured ones; spend for the four Codex cards; the
Sat 7 Nov good-news carousel is still only in 3 Posts.
