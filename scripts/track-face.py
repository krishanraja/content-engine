from __future__ import annotations

import argparse
import json

import cv2
import mediapipe as mp


def main() -> None:
    parser = argparse.ArgumentParser(description="Create deterministic presenter crop keyframes")
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    capture = cv2.VideoCapture(args.input)
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 30)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    sample_every = max(1, round(fps / 2))
    target = 9 / 16
    frames: list[dict[str, float | int]] = []
    previous_x: float | None = None
    previous_y: float | None = None

    with mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.55) as detector:
        frame_index = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % sample_every:
                frame_index += 1
                continue
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            detections = detector.process(rgb).detections or []
            if detections:
                detection = max(detections, key=lambda item: item.location_data.relative_bounding_box.width * item.location_data.relative_bounding_box.height)
                box = detection.location_data.relative_bounding_box
                centre_x = (box.xmin + box.width / 2) * width
                centre_y = (box.ymin + box.height / 2) * height
                if width / height > target:
                    crop_width, crop_height = height * target, float(height)
                    x, y = min(width - crop_width, max(0, centre_x - crop_width / 2)), 0.0
                else:
                    crop_width, crop_height = float(width), width / target
                    x, y = 0.0, min(height - crop_height, max(0, centre_y - crop_height * 0.35))
                if previous_x is not None:
                    x = previous_x * 0.75 + x * 0.25
                    y = (previous_y or 0) * 0.75 + y * 0.25
                previous_x, previous_y = x, y
                frames.append({
                    "at_ms": round(frame_index / fps * 1000),
                    "x": round(x),
                    "y": round(y),
                    "width": round(crop_width),
                    "height": round(crop_height),
                    "confidence": round(float(detection.score[0]), 3),
                })
            frame_index += 1
    capture.release()
    print(json.dumps(frames))


if __name__ == "__main__":
    main()
