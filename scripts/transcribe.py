from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a word-timed local transcript")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--vocabulary", default="")
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    # His lexicon (scripts/velib/lexicon.py): the names ve has learned he says, as the prompt and as hotwords.
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from velib import lexicon
        doc = lexicon.load()
        prompt, hot = lexicon.prompt(doc), lexicon.hotwords(doc) or None
    except Exception:  # noqa: BLE001 - a bad lexicon file never stops a transcript
        prompt, hot = "", None
    prompt = (prompt + (f" Names and terms that may occur: {args.vocabulary}." if args.vocabulary.strip() else "")).strip() or None
    segments, info = model.transcribe(args.input, word_timestamps=True, vad_filter=True, initial_prompt=prompt,
                                      beam_size=5, hotwords=hot)
    result = {"language": info.language, "source": "faster_whisper", "model": args.model, "verified": False, "segments": []}
    for segment in segments:
        result["segments"].append({
            "start_ms": round(segment.start * 1000),
            "end_ms": round(segment.end * 1000),
            "text": segment.text.strip(),
            "words": [
                {"start_ms": round((word.start or segment.start) * 1000), "end_ms": round((word.end or segment.end) * 1000), "text": word.word.strip(), "probability": word.probability}
                for word in (segment.words or [])
            ],
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
