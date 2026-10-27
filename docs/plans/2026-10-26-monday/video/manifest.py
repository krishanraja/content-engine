"""The visual-clarity inventory of one finished Monday cut: every visual state, frame-exact, with the words
it shows, their role and what each adds, its recognisable cue and its intended takeaway.

    python docs/plans/2026-10-26-monday/video/manifest.py long|short

States come from make.py's own windows and pages (recomputed from the cut's transcript and config, as the
render placed them), the story intro and outro, the tall cut's opening strap, and his face between pictures.
The burned captions are the narration itself (Krish, 2026-10-27: captions burned into every cut): they are
listed once, as the narration track, and not as labels, so the audit compares every label with them.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = Path(__file__).resolve().parents[1]
WORK = ROOT / '.cache/produce/2026-10-26-b358e788'
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))

INTRO_TEXT = [('MAKE YOUR MIND/UP', 'identity', 'the publication'), ('follow.the.money', 'identity', 'the series'),
              ('WHY IS DISNEY EATING THE SCRAPS OF BANKRUPT CHARACTER.AI?', 'relationship', 'the story\'s question, its picked title'),
              ('Google 2024: $2.7B', 'quantity', 'the first buyer and what it paid'), ('VS', 'relationship', 'the stand-off'),
              ('Disney $20M', 'quantity', 'the second buyer and its bid')]
OUTRO_TEXT = [('MAKE YOUR MIND/UP follow.the.money', 'identity', 'the publication and series'), ('TELL ME IN THE COMMENTS', 'relationship', 'the ask'),
              ('WHO MAKES THE AI YOUR BUSINESS RUNS ON?', 'relationship', 'the comment question'),
              ('The full story is free makeyourmindup.ai', 'source', 'where the story is'), ('NEXT ROUND WEDNESDAY under.the.hood', 'identity', 'the next piece')]


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def main(cut):
    import make
    shape = '16x9' if cut == 'long' else '9x16'
    cfg = json.loads((WORK / 'kit' / f'{cut}.json').read_text(encoding='utf-8'))
    out = WORK / cut
    report = json.loads((out / f"{cfg['name']}.report.json").read_text(encoding='utf-8'))
    video = out / f"{cfg['name']}-{shape}.mp4"
    frames = int(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames',
                                                     '-of', 'json', str(video)]))['streams'][0]['nb_frames'])
    s = report['shapes'][shape]
    fps = report['fps']
    intro, total = s['intro_seconds'], s['total_seconds']
    words = json.loads((out / f"{cfg['name']}.words.json").read_text(encoding='utf-8'))['words']
    segs, main_s = make.segments(words, make.resolve_removals(words, cfg.get('remove', [])), cfg['max_gap'], cfg['pad_before'],
                                 cfg['pad_after'], report['source_seconds'])
    ws = make.retime(words, segs)
    wins, _ = make.cue_windows(ws, cfg['cues'], main_s)
    pages = make.expand_pages(wins, shape, ws)
    panels = json.loads((WORK / 'panels' / 'panels.json').read_text(encoding='utf-8'))
    direction = json.loads((PLAN / 'creative-direction.json').read_text(encoding='utf-8'))['cuts'][cut]['beats']
    point = lambda cid: direction[int(cid[1:3]) - 1]['point']

    def page_spec(c):
        name = Path(c['panel']).name.replace('-push', '')
        for pid, spec in panels.items():
            for p in spec['pages']:
                if p['file'] == name:
                    return pid, p
        raise SystemExit(f'no drawn page for {name}')

    marks = []   # (start_s on the finished clock, end_s, state)
    for c in pages:
        pid, p = page_spec(c)
        marks.append((intro + c['s'], intro + c['e'], {'id': f"{c['id']}", 'text': p['text'],
                      'visual_cues': [Path(c['panel']).name], 'takeaway': point(pid)}))
    if shape == '9x16' and cfg.get('strap'):
        hit = make.find(ws, cfg['strap']['after'])
        t0 = ws[hit[0]]['s']
        p = panels['s01']['pages'][0]
        marks.append((intro + t0, intro + t0 + cfg['strap']['seconds'], {'id': 's01-strap', 'text': p['text'],
                      'visual_cues': ['his face, full frame', 'the Character.AI logo'], 'takeaway': direction[0]['point']}))
    marks.sort(key=lambda m: m[0])
    f = lambda t: min(frames, max(0, round(t * fps)))
    states, cursor = [], 0
    states.append({'id': 'intro', 'start_frame': 0, 'end_frame': f(intro), 'text': [{'value': v, 'role': r, 'adds': a} for v, r, a in INTRO_TEXT],
                   'visual_cues': ['Google and Disney logos facing off', 'the picked title'], 'takeaway': 'Two giants paid for one AI company'})
    cursor = f(intro)
    for a, b, st in marks:
        if f(a) > cursor:
            states.append({'id': f'face-{len(states)}', 'start_frame': cursor, 'end_frame': f(a), 'text': [],
                           'visual_cues': ['Krish to camera, the room behind him darkened and softened'], 'takeaway': 'Krish tells the story'})
            cursor = f(a)
        end = max(cursor + 1, f(b))
        states.append({**st, 'start_frame': cursor, 'end_frame': end})
        cursor = end
    outro_at = f(total - s['outro_seconds'])
    if outro_at > cursor:
        states.append({'id': f'face-{len(states)}', 'start_frame': cursor, 'end_frame': outro_at, 'text': [],
                       'visual_cues': ['Krish to camera'], 'takeaway': 'Krish closes'})
        cursor = outro_at
    states.append({'id': 'outro', 'start_frame': cursor, 'end_frame': frames, 'text': [{'value': v, 'role': r, 'adds': a} for v, r, a in OUTRO_TEXT],
                   'visual_cues': ['makeyourmindup brand', 'the comment question'], 'takeaway': 'Answer in the comments; the full story is free'})
    narration = WORK / 'review' / f"{cfg['name']}-final-narration.txt"
    manifest = {'schema': 1, 'video': video.name, 'video_sha256': digest(video), 'frames': frames, 'fps': fps,
                'narration': str(narration.relative_to(WORK / 'review')), 'narration_sha256': digest(narration),
                'captions': 'burned in; they are the narration track itself and are compared, not counted as labels',
                'states': states}
    dest = WORK / 'review' / f'{cut}-visual-manifest.json'
    dest.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    import visual_clarity
    result = visual_clarity.audit(manifest, narration.read_text(encoding='utf-8'))
    (WORK / 'review' / f'{cut}-visual-audit.json').write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{cut}: {len(states)} states over {frames} frames; audit {result["status"]}')
    for p in result['problems']:
        print('  ', p)


if __name__ == '__main__':
    main(sys.argv[1])
