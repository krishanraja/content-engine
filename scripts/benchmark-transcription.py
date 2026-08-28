from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from faster_whisper import WhisperModel


def words(value: str) -> list[str]:
    return re.sub(r"[^a-z0-9\s]", " ", value.lower()).split()


def distance(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for row, left_word in enumerate(left, start=1):
        current = [row]
        for column, right_word in enumerate(right, start=1):
            current.append(min(current[-1] + 1, previous[column] + 1, previous[column - 1] + (left_word != right_word)))
        previous = current
    return previous[-1]


def reference_text(path: Path) -> str:
    body = path.read_text(encoding="utf-8")
    if path.suffix.lower() != ".json":
        return body
    parsed = json.loads(body)
    if isinstance(parsed, dict) and isinstance(parsed.get("segments"), list):
        return " ".join(str(segment.get("text", "")) for segment in parsed["segments"])
    return str(parsed.get("text", "")) if isinstance(parsed, dict) else body


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark local faster-whisper models against verified fixtures")
    parser.add_argument("--fixture", action="append", required=True, help="MEDIA_PATH=VERIFIED_TRANSCRIPT_PATH")
    parser.add_argument("--models", default="tiny.en,base.en,small.en")
    parser.add_argument("--maximum-wer", type=float, default=0.12)
    parser.add_argument("--maximum-realtime-factor", type=float, default=1.5)
    args = parser.parse_args()

    fixtures: list[tuple[Path, Path]] = []
    for value in args.fixture:
        media, separator, verified = value.partition("=")
        if not separator:
            raise SystemExit(f"invalid fixture, expected MEDIA=TRANSCRIPT: {value}")
        fixtures.append((Path(media), Path(verified)))

    results: list[dict[str, object]] = []
    for model_name in [item.strip() for item in args.models.split(",") if item.strip()]:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        runs: list[dict[str, object]] = []
        for media, verified in fixtures:
            started = time.perf_counter()
            segments, info = model.transcribe(str(media), word_timestamps=True, vad_filter=True)
            hypothesis = " ".join(segment.text.strip() for segment in segments)
            elapsed = time.perf_counter() - started
            reference = reference_text(verified)
            reference_words = words(reference)
            wer = distance(reference_words, words(hypothesis)) / max(1, len(reference_words))
            duration = float(info.duration)
            runs.append({
                "media": str(media.resolve()),
                "verified": str(verified.resolve()),
                "duration_seconds": duration,
                "elapsed_seconds": elapsed,
                "realtime_factor": elapsed / max(duration, 0.001),
                "wer": wer,
            })
        max_wer = max(float(run["wer"]) for run in runs)
        max_realtime = max(float(run["realtime_factor"]) for run in runs)
        results.append({
            "model": model_name,
            "runs": runs,
            "max_wer": max_wer,
            "max_realtime_factor": max_realtime,
            "meets_target": max_wer <= args.maximum_wer and max_realtime <= args.maximum_realtime_factor,
        })

    selected = next((result["model"] for result in results if result["meets_target"]), None)
    print(json.dumps({
        "maximum_wer": args.maximum_wer,
        "maximum_realtime_factor": args.maximum_realtime_factor,
        "results": results,
        "selected_model": selected,
    }, indent=2))


if __name__ == "__main__":
    main()
