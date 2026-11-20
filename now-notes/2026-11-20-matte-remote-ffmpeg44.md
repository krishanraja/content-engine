Status: The GPU matte trial's second run (44739662276) rented one RTX A4000 for 216 s ($0.0102) and decoded no frames: the pod's ffmpeg 4.4 has no -fps_mode. Fixed to -vsync passthrough with a guard test. The spend approval's two runs are used, so the comparison was made on the local CPU instead (same pinned models, same clip).
Next: Krish reads the matte comparison and says whether a GPU run of BiRefNet over a whole take is worth a new approval.
North Star check (2026-11-20): holds.
