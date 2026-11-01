"""Lip-sync (SyncNet, lipsync_gate.py) on the four rebuilt 2 and 4 Nov cuts, on their own bytes.

    python3 docs/plans/2026-11-02-week/sync_cuts.py [mon-long mon-short wed-long wed-short]

His face is on camera in every segment that is not a full-frame picture or the close; those are the spans measured.
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
        if spans and a <= spans[-1][1] + 0.05:
            spans[-1][1] = max(spans[-1][1], b)
        else:
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


if __name__ == '__main__':
    main(sys.argv[1:])
