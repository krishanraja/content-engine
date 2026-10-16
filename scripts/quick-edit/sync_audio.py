#!/usr/bin/env python3
"""sync_audio: put a take's own sound back on a picture recorded without it.

Friday 16 October's 90-second take reached the engine with a sound track of
digital silence (-91 dB for all 1:59) while Krish talked on camera with his
clip mic on, its red light showing. When the mic keeps its own recording, that
file is the take's sound. This lines it up with the picture by his mouth:

  1. Where (roughly): with --script, the audio is transcribed and the script's
     first words found in it, so a long mic file holding several takes is
     narrowed to this one. Without it, the whole file is searched.
  2. Exactly: how open his mouth is in every frame (mediapipe's face mesh,
     inner lips over face height) against how loud the sound is in the same
     frame, matched at every offset a frame apart around that place. The best
     match is the offset; how far it beats the next best, away from it, says
     how sure it is.
  3. The picture with that sound, from the picture's first frame to its last,
     the picture copied untouched.

    python sync_audio.py VIDEO AUDIO --out OUT.mp4 [--script SCRIPT.md] [--json]
    python sync_audio.py --self-test     # a take's own sound, moved by a known amount, found again

Exit 0: synced and sure. Exit 2: synced but not sure (look at it before using
it). Exit 1: it could not be done (no face found, no speech found).
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 16000
SEARCH_S = 3.0      # around the rough place, this far each way
SURE_CORR, SURE_MARGIN = 0.25, 0.08


class SyncError(Exception):
    pass


def probe(path):
    out = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,r_frame_rate,avg_frame_rate',
                                     '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout)
    v = next((s for s in out['streams'] if s['codec_type'] == 'video'), None)
    fps = None
    if v:
        n, d = (v.get('avg_frame_rate') or v['r_frame_rate']).split('/')
        fps = float(n) / float(d) if float(d) else None
    return float(out['format']['duration']), fps


def mouth_series(video, fps):
    """Inner-lip opening over face height, one value a frame (nan where no face)."""
    import cv2
    import mediapipe as mp
    cap = cv2.VideoCapture(str(video))
    mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=False)
    vals = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        h, w = frame.shape[:2]
        small = cv2.resize(frame, (360, round(360 * h / w)))
        res = mesh.process(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
        if not res.multi_face_landmarks:
            vals.append(np.nan)
            continue
        lm = res.multi_face_landmarks[0].landmark
        face = abs(lm[152].y - lm[10].y) or 1e-6
        vals.append(abs(lm[14].y - lm[13].y) / face)
    cap.release()
    a = np.array(vals, dtype=float)
    if np.isnan(a).all():
        raise SyncError('no face was found in the picture, so it cannot be lined up by his mouth')
    idx = np.arange(len(a))
    good = ~np.isnan(a)
    return np.interp(idx, idx[good], a[good]), float(good.mean())


def audio_samples(audio, start=0.0, length=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{max(0.0, start):.3f}', '-i', str(audio)]
    if length:
        cmd += ['-t', f'{length:.3f}']
    raw = subprocess.run(cmd + ['-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def envelope(samples, fps):
    """Loudness a frame, in dB, from the samples."""
    hop = SR / fps
    n = int(len(samples) / hop)
    out = np.empty(n)
    for i in range(n):
        seg = samples[int(i * hop):int((i + 1) * hop)]
        out[i] = 10 * np.log10(np.mean(seg * seg) + 1e-10)
    return np.clip(out, -70, 0)


def z(x):
    x = np.asarray(x, dtype=float)
    s = x.std()
    return (x - x.mean()) / s if s > 0 else x * 0


def smooth(x, k=3):
    return np.convolve(x, np.ones(k) / k, mode='same')


def best_offset(mouth, env, fps, lo_frames, hi_frames):
    """(offset in frames, its correlation, the best correlation more than half a
    second away): the audio's frame i + offset is the picture's frame i."""
    m = z(smooth(mouth))
    e = z(smooth(env))
    scores = {}
    for off in range(lo_frames, hi_frames + 1):
        a0, a1 = max(0, -off), min(len(m), len(e) - off)
        if a1 - a0 < fps * 5:
            continue
        mm, ee = m[a0:a1], e[a0 + off:a1 + off]
        scores[off] = float(np.corrcoef(mm, ee)[0, 1]) if mm.std() > 0 and ee.std() > 0 else -1.0
    if not scores:
        raise SyncError('the sound and the picture overlap by less than five seconds at every offset tried')
    best = max(scores, key=scores.get)
    away = [v for k, v in scores.items() if abs(k - best) > fps * 0.5]
    return best, scores[best], max(away) if away else -1.0


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower())


def rough_place(audio, script):
    """Where the script's first words are said in the audio, in seconds (None
    when they are not found), from a transcript."""
    from faster_whisper import WhisperModel
    text = Path(script).read_text(encoding='utf-8')
    want = [norm(w) for w in text.split() if norm(w)][:8]
    model = WhisperModel('small.en', device='cpu', compute_type='int8')
    segs, _ = model.transcribe(str(audio), word_timestamps=True, vad_filter=True)
    words = [(norm(w.word), w.start) for s in segs for w in (s.words or []) if norm(w.word)]
    best, at = 0, None
    for i in range(len(words)):
        hit = sum(1 for k, x in enumerate(want) if i + k < len(words) and words[i + k][0] == x)
        if hit > best:
            best, at = hit, words[i][1]
    return at if best >= max(3, len(want) // 2) else None


def speech_onset(mouth, fps):
    """The first frame his mouth moves like speech: well above its quiet level."""
    m = smooth(mouth, 5)
    quiet, busy = np.percentile(m, 15), np.percentile(m, 85)
    hit = np.nonzero(m > quiet + 0.35 * (busy - quiet))[0]
    return float(hit[0]) / fps if len(hit) else 0.0


def sync(video, audio, out, script=None):
    vdur, fps = probe(video)
    adur, _ = probe(audio)
    if not fps:
        raise SyncError(f'{video} has no picture')
    mouth, seen = mouth_series(video, fps)
    rough = rough_place(audio, script) if script else None
    if rough is not None:
        guess = rough - speech_onset(mouth, fps)
        lo, hi = guess - SEARCH_S, guess + SEARCH_S
        how = f'the script\'s first words at {rough:.2f} s in the sound'
    else:
        lo, hi = -SEARCH_S, max(0.0, adur - vdur) + SEARCH_S
        how = 'the whole sound searched'
    start = max(0.0, lo)
    env = envelope(audio_samples(audio, start, (hi - start) + vdur + 1.0), fps)
    shift = round(start * fps)
    off, corr, other = best_offset(mouth, env, fps, round(lo * fps) - shift, round(hi * fps) - shift)
    offset = (off + shift) / fps
    sure = corr >= SURE_CORR and corr - other >= SURE_MARGIN and seen >= 0.8
    if offset >= 0:
        af = f'[1:a]atrim=start={offset:.4f},asetpts=PTS-STARTPTS,apad,atrim=end={vdur:.4f}[a]'
    else:
        ms = round(-offset * 1000)
        af = f'[1:a]adelay={ms}|{ms},apad,atrim=end={vdur:.4f}[a]'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(video), '-i', str(audio), '-filter_complex', af,
                    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
                    '-movflags', '+faststart', str(out)], check=True)
    return {'video': str(video), 'audio': str(audio), 'out': str(out), 'offset_s': round(offset, 3),
            'correlation': round(corr, 3), 'next_best_away': round(other, 3), 'face_seen': round(seen, 3),
            'rough': how, 'sure': bool(sure)}


def self_test():
    """A take with its own sound: the sound moved 7.3 s later behind a stretch
    of room noise, the picture made silent, and the offset found again."""
    take = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    if not take or not take.exists():
        print('sync self-test needs a take with sound: python sync_audio.py --self-test TAKE.mp4')
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-t', '40', '-i', str(take), '-an', '-c:v', 'copy', str(t / 'silent.mp4')], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=7.3:c=pink:a=0.002:r=48000', '-t', '40', '-i', str(take),
                        '-filter_complex', '[1:a]aresample=48000,aformat=channel_layouts=mono[s];[0:a][s]concat=n=2:v=0:a=1[a]',
                        '-map', '[a]', str(t / 'mic.wav')], check=True)
        got = sync(t / 'silent.mp4', t / 'mic.wav', t / 'out.mp4')
    ok = abs(got['offset_s'] - 7.3) <= 1.5 / 30 and got['sure']
    print(json.dumps(got, indent=1))
    print('sync self-test passed: the 7.3 s shift found' if ok else 'sync self-test FAILED')
    return 0 if ok else 1


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('video')
    ap.add_argument('audio')
    ap.add_argument('--out', required=True)
    ap.add_argument('--script', help='the script the take was read from, to find the take in a long mic file')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    try:
        got = sync(Path(a.video), Path(a.audio), Path(a.out), a.script)
    except (SyncError, subprocess.CalledProcessError) as e:
        sys.exit(f'sync: {e}')
    print(json.dumps(got, indent=1) if a.json else
          f'{"synced" if got["sure"] else "SYNCED, NOT SURE"}: the sound starts {got["offset_s"]:+.3f} s from the picture '
          f'(match {got["correlation"]}, next best {got["next_best_away"]}; {got["rough"]}) -> {got["out"]}')
    sys.exit(0 if got['sure'] else 2)


if __name__ == '__main__':
    main()
