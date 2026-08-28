from __future__ import annotations

import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a word-timed local transcript")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base.en")
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(args.input, word_timestamps=True, vad_filter=True)
    result = {"language": info.language, "source": "faster_whisper", "segments": []}
    for segment in segments:
        result["segments"].append({
            "start_ms": round(segment.start * 1000),
            "end_ms": round(segment.end * 1000),
            "text": segment.text.strip(),
            "words": [
                {"start_ms": round((word.start or segment.start) * 1000), "end_ms": round((word.end or segment.end) * 1000), "text": word.word.strip()}
                for word in (segment.words or [])
            ],
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
