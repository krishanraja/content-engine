from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np


ANALYZER_VERSION = "mindmake-caption-region-v1"
REGION = {"x": 0.04, "y": 0.48, "width": 0.92, "height": 0.46}
MINIMUM_INTERVAL_MS = 750
MAXIMUM_SAMPLES = 160
OCR_SAMPLE_TIMEOUT_SECONDS = 8.0
OCR_TOTAL_BUDGET_SECONDS = 240.0


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def safe_tesseract_path() -> str | None:
    configured = os.environ.get("MINDMAKE_TESSERACT")
    candidates = [configured, shutil.which("tesseract")]
    if os.name == "nt":
        candidates.extend([
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ])
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    return None


def command_first_line(command: list[str]) -> str:
    try:
        result = subprocess.run(command, capture_output=True, check=True, timeout=15)
        body = (result.stdout or result.stderr).decode("utf-8", errors="replace")
        return body.splitlines()[0].strip() or "unknown"
    except Exception:
        return "unknown"


def target_times(duration_ms: int) -> list[int]:
    duration_ms = max(1, round(duration_ms))
    required_interval = math.ceil(max(0, duration_ms - 1) / max(1, MAXIMUM_SAMPLES - 1))
    interval_ms = max(MINIMUM_INTERVAL_MS, math.ceil(required_interval / 50) * 50)
    count = min(MAXIMUM_SAMPLES, max(1, math.ceil(duration_ms / interval_ms)))
    return [min(duration_ms - 1, index * interval_ms) for index in range(count)]


def crop_caption_region(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    left = max(0, min(width - 1, round(width * REGION["x"])))
    top = max(0, min(height - 1, round(height * REGION["y"])))
    right = max(left + 1, min(width, round(width * (REGION["x"] + REGION["width"]))))
    bottom = max(top + 1, min(height, round(height * (REGION["y"] + REGION["height"]))))
    return frame[top:bottom, left:right]


def perceptual_hash(gray: np.ndarray) -> str:
    small = cv2.resize(gray, (16, 16), interpolation=cv2.INTER_AREA)
    mean = float(np.mean(small))
    bits = "".join("1" if value >= mean else "0" for value in small.flatten())
    return "".join(f"{int(bits[index:index + 4], 2):x}" for index in range(0, len(bits), 4))


def pixel_fingerprint(gray: np.ndarray) -> str:
    normalized = cv2.resize(gray, (32, 18), interpolation=cv2.INTER_AREA)
    return sha256_bytes(normalized.tobytes())


def visual_metrics(gray: np.ndarray) -> tuple[float, float]:
    edges = cv2.Canny(gray, 80, 180)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    contrast = float(np.std(gray)) / 127.5
    return round(edge_density, 6), round(min(1.0, contrast), 6)


def prepare_for_ocr(gray: np.ndarray) -> bytes:
    enlarged = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(enlarged, (3, 3), 0)
    threshold = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    ok, encoded = cv2.imencode(".png", threshold, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    if not ok:
        raise RuntimeError("unable to encode caption region for OCR")
    return encoded.tobytes()


def run_tesseract(engine: str, image: bytes, timeout_seconds: float) -> dict[str, Any]:
    command = [
        engine,
        "stdin",
        "stdout",
        "--dpi",
        "150",
        "--psm",
        "6",
        "-l",
        "eng",
        "tsv",
    ]
    result = subprocess.run(command, input=image, capture_output=True, timeout=max(0.5, timeout_seconds))
    if result.returncode != 0:
        diagnostic = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(diagnostic[:500] or f"OCR exited with {result.returncode}")
    body = result.stdout.decode("utf-8", errors="replace")
    words: list[str] = []
    confidences: list[float] = []
    for row in csv.DictReader(io.StringIO(body), delimiter="\t"):
        text = (row.get("text") or "").strip()
        if not text:
            continue
        try:
            confidence = float(row.get("conf") or -1)
        except ValueError:
            confidence = -1
        if confidence >= 0:
            words.append(text)
            confidences.append(confidence)
    return {
        "status": "complete",
        "text": " ".join(words),
        "mean_confidence": round(float(np.mean(confidences)), 3) if confidences else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample and inspect the expected caption region of a finished video")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--samples-dir", required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--duration-ms", required=True, type=int)
    args = parser.parse_args()

    source_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    samples_dir = Path(args.samples_dir).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    samples_dir.mkdir(parents=True, exist_ok=True)
    if sha256_file(source_path) != args.source_sha256:
        raise RuntimeError("input media hash does not match the supplied SHA-256")

    capture = cv2.VideoCapture(str(source_path))
    if not capture.isOpened():
        raise RuntimeError("unable to open input video")
    duration_ms = max(1, args.duration_ms)
    targets = target_times(duration_ms)

    tesseract = safe_tesseract_path()
    tesseract_version = command_first_line([tesseract, "--version"]) if tesseract else None
    samples: list[dict[str, Any]] = []
    ocr_failures = 0
    ocr_budget_exhausted = 0
    ocr_started_at = time.monotonic()
    for index, at_ms in enumerate(targets):
        capture.set(cv2.CAP_PROP_POS_MSEC, float(at_ms))
        ok, frame = capture.read()
        if not ok:
            continue
        crop = crop_caption_region(frame)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        sample_name = f"frame-{index + 1:04d}-{at_ms:09d}ms.jpg"
        sample_path = samples_dir / sample_name
        preview_scale = min(1.0, 480.0 / float(crop.shape[1]))
        preview = crop if preview_scale == 1.0 else cv2.resize(
            crop,
            (480, max(1, round(crop.shape[0] * preview_scale))),
            interpolation=cv2.INTER_AREA,
        )
        if not cv2.imwrite(str(sample_path), preview, [cv2.IMWRITE_JPEG_QUALITY, 90, cv2.IMWRITE_JPEG_OPTIMIZE, 0, cv2.IMWRITE_JPEG_PROGRESSIVE, 0]):
            raise RuntimeError("unable to write caption-region sample")
        edge_density, contrast = visual_metrics(gray)
        sample: dict[str, Any] = {
            "at_ms": at_ms,
            "relative_path": f"{samples_dir.name}/{sample_name}",
            "sample_sha256": hashlib.sha256(sample_path.read_bytes()).hexdigest(),
            "normalized_pixel_sha256": pixel_fingerprint(gray),
            "perceptual_hash": perceptual_hash(gray),
            "edge_density": edge_density,
            "contrast": contrast,
        }
        if tesseract:
            remaining_budget = OCR_TOTAL_BUDGET_SECONDS - (time.monotonic() - ocr_started_at)
            if remaining_budget < 0.5:
                ocr_failures += 1
                ocr_budget_exhausted += 1
                sample["ocr"] = {"status": "budget_exhausted"}
            else:
                try:
                    sample["ocr"] = run_tesseract(tesseract, prepare_for_ocr(gray), min(OCR_SAMPLE_TIMEOUT_SECONDS, remaining_budget))
                except Exception:
                    ocr_failures += 1
                    sample["ocr"] = {"status": "failed"}
        else:
            sample["ocr"] = {"status": "engine_unavailable"}
        samples.append(sample)
    capture.release()

    if len(samples) != len(targets):
        raise RuntimeError("caption-region analyzer did not cover the canonical sampling plan")
    if sha256_file(source_path) != args.source_sha256:
        raise RuntimeError("input media changed during caption-region analysis")

    if not tesseract:
        ocr = {
            "status": "engine_unavailable",
            "engine": None,
            "engine_version": None,
            "precision": "diagnostic_only",
            "reason": "No supported local Tesseract binary is installed. Exact SRT sidecars remain authoritative.",
        }
    else:
        completed = len(samples) - ocr_failures
        status = "complete" if ocr_failures == 0 else "partial" if completed > 0 else "failed"
        ocr = {
            "status": status,
            "engine": "tesseract-cli",
            "engine_version": tesseract_version,
            "precision": "diagnostic_only",
            "successful_samples": completed,
            "failed_samples": ocr_failures,
            "budget_exhausted_samples": ocr_budget_exhausted,
            "total_budget_seconds": OCR_TOTAL_BUDGET_SECONDS,
            "per_sample_timeout_seconds": OCR_SAMPLE_TIMEOUT_SECONDS,
            "reason": "OCR is diagnostic evidence. Exact supplied SRT sidecars remain authoritative.",
        }

    required_interval = math.ceil(max(0, duration_ms - 1) / max(1, MAXIMUM_SAMPLES - 1))
    interval_ms = max(MINIMUM_INTERVAL_MS, math.ceil(required_interval / 50) * 50)
    output = {
        "analysis_version": 1,
        "analyzer": ANALYZER_VERSION,
        "method": "python_opencv",
        "source_sha256": args.source_sha256,
        "duration_ms": duration_ms,
        "sampling": {
            "region_normalized": REGION,
            "interval_ms": interval_ms,
            "maximum_samples": MAXIMUM_SAMPLES,
            "sample_count": len(samples),
            "coverage_start_ms": samples[0]["at_ms"],
            "coverage_end_ms": samples[-1]["at_ms"],
        },
        "implementation": {
            "python": command_first_line([os.sys.executable, "--version"]),
            "opencv": cv2.__version__,
            "tesseract": tesseract_version,
        },
        "caption_ocr": ocr,
        "samples": samples,
    }
    output_path.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
