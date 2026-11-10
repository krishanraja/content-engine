# Wed 11 short: one-off composite

Ruling (Krish, 2026-11-10): "One-off composite", for this piece only. The video engine (ve) can't yet place his
cut-out bottom-right or play real TikTok clips, so the short is built outside it, under the same reviewer and his sign-off.

- `jobs.py`: the Codex devices' moves (slot_machine, arrangement x2), timed to his words on the trimmed timeline.
- `devframes.tsx`: renders a device's frames to PNGs (`npx tsx devframes.tsx job.json`, from the repo root).
- `comp.py`: the composite: real TikToks and screenshots, the device frames, his MediaPipe cut-out bottom-right,
  word captions. The sound (voice, the song under the cold open, NO CURVES at -30 LU from 13.9 s) is mixed with ffmpeg.

Trim: take 1.0 to 59.5 s and 60.6 to 89.4 s (87.3 s); no ad-lib removed. Media and renders stay out of the repository.
