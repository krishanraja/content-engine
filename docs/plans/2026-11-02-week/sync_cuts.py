"""Lip-sync (SyncNet, lipsync_gate.py) on the four rebuilt 2 and 4 Nov cuts, on their own bytes.

    python3 docs/plans/2026-11-02-week/sync_cuts.py [mon-long mon-short wed-long wed-short]

His face is on camera in every segment that is not a full-frame picture or the close; each such segment is one span.
Writes .cache/proof/<day>/<cut>.lipsync.json.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import lipsync_gate  # noqa: E402

CUTS = {
    'mon-long': ('.cache/proof/mon/mon-long-16x9.mp4', 'docs/plans/2026-11-02-monday/rebuild/plan_long.json'),
    'mon-short': ('.cache/proof/mon/mon-short-9x16.mp4', 'docs/plans/2026-11-02-monday/rebuild/plan_short.json'),
    'wed-long': ('.cache/proof/wed/wed-long-16x9.mp4', '.cache/proof/wed/timeline-long.json'),
    'wed-short': ('.cache/proof/wed/wed-short-9x16.mp4', '.cache/proof/wed/timeline-short.json'),
}


def face_spans(plan):
    end = plan.get('closeAt') or plan.get('voice_end') or plan['dur']
    spans = []
    for s in plan['segs']:
        if s['mode'] in ('full', 'close'):
            continue
        a, b = max(0.0, s['a']), min(end, s['b'])
        if b - a <= 0:
            continue
        # One span per timeline segment: inside a segment his face holds one place in the frame, and a window that
        # straddles a layout move (the column sliding, the brand frame arriving) moves the face out of SyncNet's
        # fixed crop, which reads as low confidence about the instrument, not the cut.
        spans.append([a, b])
    return [tuple(x) for x in spans]


def main(names):
    for name in names or CUTS:
        video, plan = CUTS[name]
        spans = face_spans(json.loads((ROOT / plan).read_text(encoding='utf-8')))
        result = lipsync_gate.check_cut(str(ROOT / video), spans, [])
        result['spans'] = spans
        out = ROOT / video.replace('.mp4', '.lipsync.json')
        out.write_text(json.dumps(result, indent=1), encoding='utf-8')
        print(name, result['status'], result.get('reason', ''), flush=True)


CLEARS = {
    'mon-long': [
        {'span_s': [126.24, 128.82], 'krish': 'Krish, 2026-11-02: "1. accept. 2 clear"',
         'reason': 'Question 2 asked whether he clears Monday long\'s two side-on sync windows (about 2:06 and 3:29: inconclusive, '
                   'never measured out of sync) by his own eye, or holds. SyncNet read this window at confidence 2.95 with the '
                   'face found in every frame.'},
        {'span_s': [208.96, 211.7], 'krish': 'Krish, 2026-11-02: "1. accept. 2 clear"',
         'reason': 'Question 2 asked whether he clears Monday long\'s two side-on sync windows (about 2:06 and 3:29: inconclusive, '
                   'never measured out of sync) by his own eye, or holds. SyncNet read this window at confidence 2.75 as he '
                   'turns side-on, the face found in every frame.'},
    ],
}


def remeasure(name, changed_frames, previous):
    """Re-score only the segments whose decoded frames changed since `previous` (a result for other bytes of the same
    cut, same spans); keep the rest. The caller proves the unchanged frames decode identically (framemd5) and the audio
    is unchanged. Krish's clearances are applied to the merged segments, never to a fail."""
    video, plan = CUTS[name]
    spans = face_spans(json.loads((ROOT / plan).read_text(encoding='utf-8')))
    prev = json.loads(Path(previous).read_text(encoding='utf-8'))
    assert [s['span_s'] for s in prev['segments']] == [list(x) for x in spans], 'previous result used other spans'
    fps = 30
    touched = [i for i, (a, b) in enumerate(spans) if any(x <= b * fps + 1 and y >= a * fps for x, y in changed_frames)]
    cfg = lipsync_gate.load_config()
    fresh = lipsync_gate.gate(str(ROOT / video), [spans[i] for i in touched], [], lipsync_gate.SyncNetScorer(
        *lipsync_gate.model_paths(cfg)), cfg)
    segments = []
    for i, seg in enumerate(prev['segments']):
        if i in touched:
            new = fresh['segments'][touched.index(i)]
            segments.append({**new, 'index': i, 'remeasured': True})
        else:
            old = {k: v for k, v in seg.items() if k not in ('cleared_by',)}
            if old['status'] == 'krish_cleared':
                old['status'] = 'inconclusive'
            segments.append({**old, 'reused': 'frames decode identically to the bytes measured before (framemd5); audio unchanged'})
    refused = lipsync_gate.apply_clears(segments, CLEARS.get(name))
    out = lipsync_gate.summarise(segments, spans, cfg, 'syncnet', refused)
    import sync_check
    out['face_detector'] = sync_check.face_detector()[0]
    out['spans'] = spans
    out['remeasured_segments'] = touched
    path = ROOT / video.replace('.mp4', '.lipsync.json')
    path.write_text(json.dumps(out, indent=1), encoding='utf-8')
    print(name, out['status'], out['line'], flush=True)


if __name__ == '__main__':
    if sys.argv[1:2] == ['--remeasure']:
        remeasure(sys.argv[2], json.loads(sys.argv[3]), sys.argv[4])
    else:
        main(sys.argv[1:])
