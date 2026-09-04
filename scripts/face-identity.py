from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

import cv2
import mediapipe as mp
import numpy as np


MODEL = "opencv-dct-face-v1"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def face_descriptor(frame: np.ndarray, relative_box: object) -> list[float] | None:
    height, width = frame.shape[:2]
    left = max(0, int(relative_box.xmin * width))
    top = max(0, int(relative_box.ymin * height))
    right = min(width, int((relative_box.xmin + relative_box.width) * width))
    bottom = min(height, int((relative_box.ymin + relative_box.height) * height))
    if right - left < 40 or bottom - top < 40:
        return None
    crop = frame[top:bottom, left:right]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
    gray = cv2.equalizeHist(gray).astype(np.float32) / 255.0
    coefficients = cv2.dct(gray)[:16, :16].flatten()[1:128]
    norm = float(np.linalg.norm(coefficients))
    if norm < 1e-8:
        return None
    return [round(float(value), 7) for value in coefficients / norm]


def image_frames(path: Path) -> Iterable[np.ndarray]:
    frame = cv2.imread(str(path))
    if frame is not None:
        yield frame


def video_frames(path: Path, maximum: int = 30) -> Iterable[np.ndarray]:
    capture = cv2.VideoCapture(str(path))
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total <= 0:
        capture.release()
        return
    positions = np.linspace(0, max(0, total - 1), num=min(maximum, total), dtype=int)
    for position in positions:
        capture.set(cv2.CAP_PROP_POS_FRAMES, int(position))
        ok, frame = capture.read()
        if ok:
            yield frame
    capture.release()


def frames(path: Path) -> Iterable[np.ndarray]:
    if path.suffix.lower() in IMAGE_SUFFIXES:
        yield from image_frames(path)
    else:
        yield from video_frames(path)


def enroll(paths: list[Path]) -> dict[str, object]:
    descriptors: list[list[float]] = []
    with mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.65) as detector:
        for path in paths:
            for frame in frames(path):
                result = detector.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                detections = list(result.detections or [])
                if not detections:
                    continue
                # Enrollment inputs must contain Krish alone. A multi-face frame is skipped
                # rather than guessing which identity should become durable memory.
                if len(detections) != 1:
                    continue
                descriptor = face_descriptor(frame, detections[0].location_data.relative_bounding_box)
                if descriptor is not None:
                    descriptors.append(descriptor)
    if len(descriptors) < 5:
        raise RuntimeError("fewer than five unambiguous Krish face samples were found")
    # Keep a bounded, diverse template. The local profile contains no source frames.
    if len(descriptors) > 64:
        indexes = np.linspace(0, len(descriptors) - 1, num=64, dtype=int)
        descriptors = [descriptors[int(index)] for index in indexes]
    return {"model": MODEL, "sample_count": len(descriptors), "descriptors": descriptors}


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a local Krish-only face template")
    subparsers = parser.add_subparsers(dest="command", required=True)
    enroll_parser = subparsers.add_parser("enroll")
    enroll_parser.add_argument("--input", action="append", required=True)
    args = parser.parse_args()
    if args.command == "enroll":
        result = enroll([Path(value).resolve() for value in args.input])
        print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
