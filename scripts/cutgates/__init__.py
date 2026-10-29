"""cutgates: the calibrated cut gates both routes share (plan W2.4).

Floor never 3, in Krish's words (19 Oct): "my words randomly chop out, making the video incomprehensible".
quick-edit (scripts/quick-edit/make.py) and ve (scripts/velib/qc.py) call the same functions here:

  - gaps.joins_in_gaps: every join sits in a gap every aligner agrees on (config/gates.json, joins);
  - captions.clock_truth and captions.renderer_truth: caption pages on the clock of the aligner that did not draw
    them, and as the renderer drew them, read by OCR near each page start;
  - aligners: faster-whisper, and ElevenLabs Scribe behind a flag that is off by default;
  - receipt: each check machine written and bound to the file's sha256, and what a missing check holds.

The words gate itself stays scripts/quick-edit/words_gate.py (check_aligners for two passes).
"""
