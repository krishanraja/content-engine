# Friday 16 Oct, the long cut (mind.the.gap)

Krish's 14-minute one-shot take (`recordings/ee91ab41...0fd9f.mp4` on the piece; 1.1 GB, too big for the engine
store, so it lives on his Drive and in the cloud session that placed it). He ad-libbed most of it, so every cue,
cut, chapter and push-in here is his words in the take, found with make.py's own finders.

- `long-take.words.json`: the take heard by faster-whisper small.en with the script's names as a hint. Every
  phrase below depends on it: put it beside the config as `../words/long.words.json` and never transcribe again.
- `long.json`: the edit list (44 picture steps, 10 cuts, 30 caption fixes, 8 chapters,
  8 push-ins). It carries the cuts Krish approved on 17 October ("Happy with your cuts."): the 7:22
  "semi-automatic, famously F1 cars" line and the 11:41 "Now, I mentioned ... earlier, and they" lead-in, so his later
  F1 point is not contradicted, and the 6:33 clause that gave his guess as Altman's reason. Copy it into the kit
  folder (`kit.py ... --out WORK/kit`), beside `../takes/<the take>`.
- `edit-list.json`: the workflow's full analysis (wf_f9964bd6-49b): every claim checked against the evidence, each
  cut's edges measured, each caption fix heard by a bigger model, and the completeness critic's findings.

The panels (`panels/<id>-{aspect}.png`) are drawn by `scripts/pages/video_card.py` once Krish picks the headings.
