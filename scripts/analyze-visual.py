from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from typing import Any

import cv2
import mediapipe as mp
import numpy as np


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return min(maximum, max(minimum, value))


def rect(x: float, y: float, width: float, height: float) -> dict[str, float]:
    left = clamp(x)
    top = clamp(y)
    right = clamp(x + width)
    bottom = clamp(y + height)
    return {
        "x": round(left, 6),
        "y": round(top, 6),
        "width": round(max(0.000001, right - left), 6),
        "height": round(max(0.000001, bottom - top), 6),
    }


def centre(bounds: dict[str, float]) -> tuple[float, float]:
    return bounds["x"] + bounds["width"] / 2, bounds["y"] + bounds["height"] / 2


@dataclass
class Track:
    track_id: str
    first_ms: int
    last_ms: int
    last_centre: tuple[float, float]
    scores: list[float] = field(default_factory=list)
    face_keyframes: list[dict[str, Any]] = field(default_factory=list)
    body_keyframes: list[dict[str, Any]] = field(default_factory=list)
    hand_keyframes: list[dict[str, Any]] = field(default_factory=list)
    identity_descriptors: list[list[float]] = field(default_factory=list)
    mouth_keyframes: list[tuple[int, float]] = field(default_factory=list)


def face_descriptor(frame: np.ndarray, bounds: dict[str, float]) -> list[float] | None:
    height, width = frame.shape[:2]
    left = max(0, int(bounds["x"] * width))
    top = max(0, int(bounds["y"] * height))
    right = min(width, int((bounds["x"] + bounds["width"]) * width))
    bottom = min(height, int((bounds["y"] + bounds["height"]) * height))
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
    return [float(value) for value in coefficients / norm]


def assign_detections(tracks: list[Track], detections: list[tuple[dict[str, float], float, list[float] | None]], at_ms: int) -> list[tuple[Track, dict[str, float], float]]:
    assignments: list[tuple[Track, dict[str, float], float]] = []
    unused = set(range(len(tracks)))
    for bounds, score, descriptor in sorted(detections, key=lambda item: item[0]["width"] * item[0]["height"], reverse=True):
        point = centre(bounds)
        candidates = [(index, math.dist(point, tracks[index].last_centre)) for index in unused if at_ms - tracks[index].last_ms <= 1500]
        if candidates:
            index, distance = min(candidates, key=lambda item: item[1])
        else:
            index, distance = -1, 1.0
        if index >= 0 and distance <= 0.18:
            track = tracks[index]
            unused.remove(index)
        else:
            track = Track(f"subject-{len(tracks) + 1}", at_ms, at_ms, point)
            tracks.append(track)
        track.last_ms = at_ms
        track.last_centre = point
        track.scores.append(score)
        if descriptor is not None:
            track.identity_descriptors.append(descriptor)
        track.face_keyframes.append({"at_ms": at_ms, "bounds": bounds, "confidence": round(score, 4)})
        assignments.append((track, bounds, score))
    return assignments


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right):
        return -1.0
    return float(np.dot(np.asarray(left, dtype=np.float32), np.asarray(right, dtype=np.float32)))


def identity_scores(tracks: list[Track], profile: dict[str, Any] | None) -> dict[str, float]:
    if not profile or profile.get("model") != "opencv-dct-face-v1":
        return {}
    references = profile.get("descriptors") or []
    scores: dict[str, float] = {}
    for track in tracks:
        sample_scores: list[float] = []
        for descriptor in track.identity_descriptors:
            matches = sorted((cosine_similarity(descriptor, reference) for reference in references), reverse=True)
            if matches:
                sample_scores.append(float(np.mean(matches[: min(5, len(matches))])))
        if sample_scores:
            scores[track.track_id] = float(np.median(sample_scores))
    return scores


def active_speaker_intervals(tracks: list[Track], source_id: str, duration_ms: int, sample_fps: float) -> list[dict[str, Any]]:
    motion_by_time: dict[int, list[tuple[Track, float]]] = {}
    for track in tracks:
        previous: float | None = None
        for at_ms, openness in track.mouth_keyframes:
            if previous is not None:
                motion_by_time.setdefault(at_ms, []).append((track, abs(openness - previous)))
            previous = openness
    step_ms = max(1, round(1000 / sample_fps))
    raw: list[dict[str, Any]] = []
    for at_ms in sorted(motion_by_time):
        ranked = sorted(motion_by_time[at_ms], key=lambda item: item[1], reverse=True)
        if not ranked or ranked[0][1] < 0.006:
            continue
        track, movement = ranked[0]
        runner_up = ranked[1][1] if len(ranked) > 1 else 0.0
        margin = movement - runner_up
        if len(ranked) > 1 and margin < 0.003:
            continue
        raw.append({
            "track_id": track.track_id,
            "start_ms": max(0, at_ms - step_ms),
            "end_ms": min(duration_ms, at_ms + step_ms),
            "confidence": round(min(0.82, 0.52 + movement * 3.5 + max(0.0, margin) * 2.0), 4),
        })
    merged: list[dict[str, Any]] = []
    for item in raw:
        if merged and merged[-1]["track_id"] == item["track_id"] and item["start_ms"] <= merged[-1]["end_ms"] + step_ms:
            merged[-1]["end_ms"] = item["end_ms"]
            merged[-1]["confidence"] = round((merged[-1]["confidence"] + item["confidence"]) / 2, 4)
        else:
            merged.append(dict(item))
    return [{
        "interval_id": f"{source_id}-visual-speaker-{index + 1}",
        "source_id": source_id,
        "track_id": item["track_id"],
        "speaker_label": "Visually inferred speaker",
        "start_ms": item["start_ms"],
        "end_ms": max(item["start_ms"] + 1, item["end_ms"]),
        "overlap": False,
        "confidence": item["confidence"],
    } for index, item in enumerate(merged)]


def landmark_bounds(landmarks: Any, indexes: list[int], padding: float = 0.03) -> dict[str, float] | None:
    points = [landmarks[index] for index in indexes if index < len(landmarks) and landmarks[index].visibility > 0.45]
    if not points:
        return None
    left = min(point.x for point in points) - padding
    top = min(point.y for point in points) - padding
    right = max(point.x for point in points) + padding
    bottom = max(point.y for point in points) + padding
    return rect(left, top, right - left, bottom - top)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze subjects, hands, gaze and composition anchors")
    parser.add_argument("--input", required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--role", choices=["krish", "guest", "unknown"], default="unknown")
    parser.add_argument("--profile-id")
    parser.add_argument("--profile-version-hash")
    parser.add_argument("--identity-profile-stdin", action="store_true")
    parser.add_argument("--sample-fps", type=float, default=4.0)
    args = parser.parse_args()
    identity_profile = json.loads(sys.stdin.read()) if args.identity_profile_stdin else None

    capture = cv2.VideoCapture(args.input)
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 30.0)
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_ms = max(1, round(total_frames / fps * 1000))
    sample_every = max(1, round(fps / max(0.25, args.sample_fps)))
    tracks: list[Track] = []
    gestures: list[dict[str, Any]] = []
    gaze: list[dict[str, Any]] = []
    negative_space: list[dict[str, Any]] = []
    protected_regions: list[dict[str, Any]] = []

    with mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as faces, mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=4, refine_landmarks=False, min_detection_confidence=0.5, min_tracking_confidence=0.5) as face_mesh, mp.solutions.pose.Pose(static_image_mode=False, model_complexity=1, min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose, mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.5, min_tracking_confidence=0.5) as hands:
        frame_index = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % sample_every:
                frame_index += 1
                continue
            at_ms = min(duration_ms, round(frame_index / fps * 1000))
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_result = faces.process(rgb)
            detections: list[tuple[dict[str, float], float, list[float] | None]] = []
            for detection in face_result.detections or []:
                box = detection.location_data.relative_bounding_box
                bounds = rect(box.xmin, box.ymin, box.width, box.height)
                detections.append((bounds, float(detection.score[0]), face_descriptor(frame, bounds)))
            assignments = assign_detections(tracks, detections, at_ms)

            mesh_result = face_mesh.process(rgb)
            for mesh in mesh_result.multi_face_landmarks or []:
                points = mesh.landmark
                mesh_centre = (sum(point.x for point in points) / len(points), sum(point.y for point in points) / len(points))
                candidates = [(track, math.dist(mesh_centre, centre(bounds))) for track, bounds, _ in assignments]
                if not candidates:
                    continue
                track, distance = min(candidates, key=lambda item: item[1])
                if distance > 0.2:
                    continue
                face_height = max(point.y for point in points) - min(point.y for point in points)
                if face_height > 0.01:
                    openness = abs(points[14].y - points[13].y) / face_height
                    track.mouth_keyframes.append((at_ms, float(openness)))

            if assignments:
                primary = max(assignments, key=lambda item: item[1]["width"] * item[1]["height"])[0]
                pose_result = pose.process(rgb)
                if pose_result.pose_landmarks:
                    landmarks = pose_result.pose_landmarks.landmark
                    body = landmark_bounds(landmarks, list(range(11, 29)), 0.035)
                    if body:
                        primary.body_keyframes.append({"at_ms": at_ms, "bounds": body, "confidence": 0.75})
                    for hand_name, indexes in (("left", [15, 17, 19, 21]), ("right", [16, 18, 20, 22])):
                        hand = landmark_bounds(landmarks, indexes, 0.035)
                        if hand:
                            primary.hand_keyframes.append({"at_ms": at_ms, "bounds": hand, "confidence": 0.7, "hand": hand_name})
                    left_wrist, right_wrist = landmarks[15], landmarks[16]
                    left_shoulder, right_shoulder = landmarks[11], landmarks[12]
                    for hand_name, wrist, shoulder in (("left", left_wrist, left_shoulder), ("right", right_wrist, right_shoulder)):
                        horizontal = wrist.x - shoulder.x
                        vertical = wrist.y - shoulder.y
                        if abs(horizontal) > 0.14 or vertical < -0.1:
                            direction = "right" if horizontal > 0.14 else "left" if horizontal < -0.14 else "up"
                            gestures.append({"gesture_id": f"gesture-{len(gestures) + 1}", "track_id": primary.track_id, "start_ms": at_ms, "end_ms": min(duration_ms, at_ms + round(1000 / args.sample_fps)), "hand": hand_name, "kind": "point" if abs(horizontal) > 0.14 else "emphasis", "direction": direction, "target": {"kind": "direction", "direction": direction}, "confidence": 0.66})

                face_box = max(assignments, key=lambda item: item[1]["width"] * item[1]["height"])[1]
                face_centre_x, _ = centre(face_box)
                direction = "camera" if abs(face_centre_x - 0.5) < 0.16 else "right" if face_centre_x < 0.5 else "left"
                gaze.append({"gaze_id": f"gaze-{len(gaze) + 1}", "track_id": primary.track_id, "start_ms": at_ms, "end_ms": min(duration_ms, at_ms + round(1000 / args.sample_fps)), "direction": direction, "confidence": 0.58})

                left = min(item[1]["x"] for item in assignments)
                right = max(item[1]["x"] + item[1]["width"] for item in assignments)
                free_left, free_right = left, 1 - right
                if max(free_left, free_right) >= 0.24:
                    if free_left >= free_right:
                        bounds = rect(0.02, 0.12, max(0.01, free_left - 0.04), 0.58)
                    else:
                        bounds = rect(right + 0.02, 0.12, max(0.01, free_right - 0.04), 0.58)
                    negative_space.append({"region_id": f"negative-{len(negative_space) + 1}", "source_id": args.source_id, "start_ms": at_ms, "end_ms": min(duration_ms, at_ms + round(1000 / args.sample_fps)), "bounds": bounds, "reason": "Detected clear space beside visible faces.", "confidence": 0.7})

                for _, bounds, score in assignments:
                    padded = rect(bounds["x"] - 0.035, bounds["y"] - 0.04, bounds["width"] + 0.07, bounds["height"] + 0.13)
                    protected_regions.append({"region_id": f"protected-{len(protected_regions) + 1}", "source_id": args.source_id, "start_ms": at_ms, "end_ms": min(duration_ms, at_ms + round(1000 / args.sample_fps)), "bounds": padded, "reason": "Keep captions and evidence clear of the face and upper torso.", "confidence": round(score, 4)})
            frame_index += 1
    capture.release()

    visible_tracks = [track for track in tracks if len(track.face_keyframes) >= 2]
    visible_tracks.sort(key=lambda track: len(track.face_keyframes), reverse=True)
    scores = identity_scores(visible_tracks, identity_profile)
    ordered_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    identity_match_id: str | None = None
    identity_match_score = 0.0
    identity_ambiguous = False
    if ordered_scores:
        identity_match_id, identity_match_score = ordered_scores[0]
        threshold = float(identity_profile.get("match_threshold", 0.62))
        minimum_margin = float(identity_profile.get("minimum_margin", 0.045))
        runner_up = ordered_scores[1][1] if len(ordered_scores) > 1 else -1.0
        identity_ambiguous = identity_match_score >= threshold and identity_match_score - runner_up < minimum_margin
        if identity_match_score < threshold or identity_ambiguous:
            identity_match_id = None
    subjects: list[dict[str, Any]] = []
    for index, track in enumerate(visible_tracks):
        if identity_match_id == track.track_id:
            role = "krish"
        elif args.role == "guest" and index == 0:
            role = "guest"
        elif args.role == "krish" and not identity_profile and index == 0:
            role = "krish"
        else:
            role = "unknown"
        subject: dict[str, Any] = {
            "track_id": track.track_id,
            "source_id": args.source_id,
            "role": role,
            "start_ms": track.first_ms,
            "end_ms": max(track.first_ms + 1, track.last_ms),
            "face_keyframes": track.face_keyframes,
            "body_keyframes": track.body_keyframes,
            "hand_keyframes": track.hand_keyframes,
            "detection_confidence": round(sum(track.scores) / len(track.scores), 4),
        }
        if role == "krish":
            subject["profile_id"] = args.profile_id
            subject["profile_version_hash"] = args.profile_version_hash
        subjects.append(subject)

    known_ids = {subject["track_id"] for subject in subjects}
    output = {
        "subjects": subjects,
        "gestures": [item for item in gestures if item["track_id"] in known_ids and item["end_ms"] > item["start_ms"]],
        "gaze": [item for item in gaze if item["track_id"] in known_ids and item["end_ms"] > item["start_ms"]],
        "negative_space": [item for item in negative_space if item["end_ms"] > item["start_ms"]],
        "protected_regions": [item for item in protected_regions if item["end_ms"] > item["start_ms"]],
        "active_speakers": active_speaker_intervals(visible_tracks, args.source_id, duration_ms, args.sample_fps),
        "sample_fps": args.sample_fps,
        "identity_match": {
            "attempted": bool(identity_profile),
            "matched_track_id": identity_match_id,
            "score": round(identity_match_score, 5) if ordered_scores else None,
            "ambiguous": identity_ambiguous,
        },
    }
    print(json.dumps(output, separators=(",", ":")))


if __name__ == "__main__":
    main()
