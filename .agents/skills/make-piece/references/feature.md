# The feature (only when Krish calls one)

Read this when a piece is in `config/features.json` (make-piece, the Scripts step). Moved here whole from the
SKILL.md table on 15 Nov 2026 to keep the skill under its byte cap.

If the piece is in `config/features.json` (house rule FEATURE, Krish, 2026-10-21: "From time to time I might do a special 15 min feature"), it gets a third script beside the 5-minute and the 90-second: the feature, 2,025 to 2,475 spoken words (about 15 minutes), written from the full article for the ear, opening straight on the hook, reading age 12 and the same close (SCRIPT_CLOSE), plus a `<script>.chapters.md` sidecar for Spotify (at least 3 chapters). Check it with `story_check.py --cut feature`. Never propose a feature: only his call adds one. A piece in the retired `config/deep-cuts.json` keeps its deep cut as it was

Check and record: `python3 scripts/post-pack/story_check.py --cut feature feature.md`; then the feature third everywhere the two go: `making.py <uuid> scripts <date>-draft-script.md <date>-draft-script-90s.md feature.md`, `making.py <uuid> read-back feature --readers ...`, `teleprompter_send.py plan <uuid> long.md short.md feature.md`
