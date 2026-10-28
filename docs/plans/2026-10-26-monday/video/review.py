"""Measure one finished Monday cut, as the review packet reports it. Run from the repository root:

    python docs/plans/2026-10-26-monday/video/review.py long|short [--sync]

- Loudness of the final encode (ffmpeg ebur128, true peak): -14 +-1 LUFS, at most -1 dBTP.
- Every camera join: make.py's own segmenter, run on the same transcript and config, gives each
  place two kept windows of the take meet; each is put on the finished clock (the intro added).
- Lip sync at every join (--sync): SyncNet (scripts/quick-edit/sync_check.py, pinned model) on a
  6 s window centred on the join, calibrated, so a join that slips shows on its own window.
- Every word: the finished file is transcribed again and compared, word for word, with the words
  make.py kept from the take (quality.word_diff).
- Contact sheets: a frame every second of the cut, every quarter second of the intro and outro.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / '.cache/produce/2026-10-26-b358e788'
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
SYNC_PY = ROOT.parent / 'content-engine/.cache/syncenv/Scripts/python.exe'
SYNCNET = ROOT.parent / 'content-engine/.cache/syncnet'


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def loudness(video):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(video), '-map', '0:a:0', '-af', 'ebur128=peak=true',
                          '-f', 'null', '-'], capture_output=True, text=True).stderr
    summary = err[err.rfind('Summary:'):]
    grab = lambda key: float(re.search(key + r':\s+(-?[\d.]+|-inf)', summary).group(1))
    return {'integrated_lufs': grab('I'), 'true_peak_dbtp': grab('Peak'), 'lra_lu': grab('LRA'),
            'pass': abs(grab('I') + 14) <= 1 and grab('Peak') <= -1.0}


def joins(cut, cfg, report):
    import make
    out = WORK / cut
    words = json.loads((out / f"{cfg['name']}.words.json").read_text(encoding='utf-8'))['words']
    removals = make.resolve_removals(words, cfg.get('remove', []))
    dur = report['source_seconds']
    segs, total = make.segments(words, removals, cfg['max_gap'], cfg['pad_before'], cfg['pad_after'], dur)
    shape = next(iter(report['shapes']))
    intro = report['shapes'][shape]['intro_seconds']
    at, points = 0.0, []
    for a, b in zip(segs, segs[1:]):
        at += a['b'] - a['a']
        points.append({'finished_s': round(intro + at, 3), 'source_out_s': round(a['b'], 3), 'source_in_s': round(b['a'], 3),
                       'removed_between': round(b['a'] - a['b'], 3)})
    return points, total, intro


def contact(video, cut, intro, total, outro):
    from PIL import Image, ImageDraw
    sheets = WORK / 'review' / cut
    sheets.mkdir(parents=True, exist_ok=True)
    tall = cut == 'short'
    w, h, cols = (216, 384, 8) if tall else (384, 216, 6)
    made = []

    def sheet(frames, label, name):
        rows = (len(frames) + cols - 1) // cols
        for s in range(0, len(frames), cols * 5):
            chunk = frames[s:s + cols * 5]
            rows = (len(chunk) + cols - 1) // cols
            page = Image.new('RGB', (w * cols, (h + 22) * rows), '#19251f')
            d = ImageDraw.Draw(page)
            for j, (t, f) in enumerate(chunk):
                x, y = (j % cols) * w, (j // cols) * (h + 22)
                page.paste(Image.open(f).resize((w, h)), (x, y + 22))
                d.text((x + 5, y + 5), f'{label} {t:.2f}s', fill='white')
            dest = sheets / f'{name}-{s // (cols * 5) + 1:02d}.jpg'
            page.save(dest, quality=90)
            made.append(str(dest))

    def grab(rate, start, length, prefix):
        folder = sheets / prefix
        folder.mkdir(exist_ok=True)
        for old in folder.glob('*.jpg'):
            old.unlink()
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.3f}', '-i', str(video), '-t', f'{length:.3f}', '-vf',
                        f'fps={rate},scale={w}:{h}', str(folder / 'f-%05d.jpg')], check=True)
        return [(start + (k + 0.5) / rate, f) for k, f in enumerate(sorted(folder.glob('f-*.jpg')))]

    sheet(grab(1, 0, total, 'every-second'), 's', 'cut')
    sheet(grab(4, 0, intro, 'intro'), 'intro', 'intro')
    sheet(grab(4, total - outro, outro, 'outro'), 'outro', 'outro')
    return made


def heard(video, cfg, kept, intro, outro, total):
    """The finished file transcribed again (speech only), against the words make.py kept."""
    import make
    import quality
    clip = WORK / 'review' / f"{cfg['name']}-speech.wav"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{intro:.3f}', '-i', str(video), '-t', f'{total - intro - outro:.3f}',
                    '-ac', '1', '-ar', '16000', str(clip)], check=True)
    out = WORK / 'review' / f"{cfg['name']}-final.words.json"
    words = make.transcribe(clip, out, cfg.get('model', 'small.en'))
    diff = quality.word_diff(kept, words)
    narration = WORK / 'review' / f"{cfg['name']}-final-narration.txt"
    narration.write_text(' '.join(w['w'].strip() for w in words) + '\n', encoding='utf-8')
    return {'model': cfg.get('model'), 'final_words': str(out), 'narration': str(narration), 'narration_sha256': digest(narration),
            **{k: diff[k] for k in ('status', 'expected_words', 'heard_words')}, 'changes': diff['changes']}


def sync(video, points, total, intro, outro, cut):
    out = WORK / 'review' / f'sync-{cut}'
    out.mkdir(parents=True, exist_ok=True)
    # Windows may not overlap (sync_check.py), so they are laid in order: each join sits at least a second
    # inside a window, centred where it can be; a join already a second inside the last window shares it.
    lo, hi = intro + 0.2, total - outro - 6.2
    # A window centred on every join first; then the rest of his speech tiled with whole windows between them,
    # so the whole cut is measured and every join sits in the middle of its own window.
    fixed = []
    for p in points:
        s = round(min(max(lo, p['finished_s'] - 3), hi), 2)
        if not fixed or s >= fixed[-1][0] + 6.01:
            fixed.append((s, [p['finished_s']]))
        else:
            fixed[-1][1].append(p['finished_s'])
    windows, cursor = [], lo
    for s, joined in fixed + [(hi + 6.02, None)]:
        while cursor + 6.01 <= s and cursor <= hi:
            windows.append((round(cursor, 2), []))
            cursor += 6.05
        if joined is not None:
            windows.append((s, joined))
            cursor = s + 6.05
    starts, covers = [w[0] for w in windows], [w[1] for w in windows]
    (out / 'windows.json').write_text(json.dumps([{'start': s, 'joins': c} for s, c in zip(starts, covers)], indent=1))
    run = subprocess.run([str(SYNC_PY), str(ROOT / 'scripts/quick-edit/sync_check.py'), str(video), '--syncnet-root', str(SYNCNET),
                          '--model', str(SYNCNET / 'data/syncnet_v2.model'), '--out', str(out), '--at', *map(str, starts),
                          '--seconds', '6', '--calibrate', '--speech-span', f'{intro:.2f}', f'{total - outro:.2f}'],
                         capture_output=True, text=True)
    result = out / 'sync-report.json'
    if run.returncode not in (0, 1, 2) or not result.is_file():
        found = sorted(out.glob('*.json'))
        if not found:
            raise SystemExit(f'sync_check failed: {run.stderr[-2000:]}')
        result = found[-1]
    return json.loads(result.read_text(encoding='utf-8')), run.stdout[-3000:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cut', choices=['long', 'short'])
    ap.add_argument('--sync', action='store_true')
    ap.add_argument('--no-heard', action='store_true')
    a = ap.parse_args()
    cfg = json.loads((WORK / 'kit' / f'{a.cut}.json').read_text(encoding='utf-8'))
    shape = '16x9' if a.cut == 'long' else '9x16'
    video = WORK / a.cut / f"{cfg['name']}-{shape}.mp4"
    report = json.loads((WORK / a.cut / f"{cfg['name']}.report.json").read_text(encoding='utf-8'))
    s = report['shapes'][shape]
    total, intro, outro = s['total_seconds'], s['intro_seconds'], s['outro_seconds']
    points, main_s, _ = joins(a.cut, cfg, report)
    kept = json.loads((WORK / a.cut / f"{cfg['name']}.words.json").read_text(encoding='utf-8'))['words']
    import make
    removals = make.resolve_removals(kept, cfg.get('remove', []))
    gone = {i for x, y in removals for i in range(x, y + 1)}
    kept_words = [w for i, w in enumerate(kept) if i not in gone]
    result = {'cut': a.cut, 'video': str(video), 'video_sha256': digest(video), 'bytes': video.stat().st_size,
              'seconds': {'intro': intro, 'main': s['main_seconds'], 'outro': outro, 'total': total},
              'loudness_final_encode': loudness(video), 'joins': points, 'join_count': len(points),
              'removed': [{'words': ' '.join(kept[i]['w'].strip() for i in range(x, y + 1)), 'at_source_s': kept[x]['s']} for x, y in removals],
              'contact_sheets': contact(video, a.cut, intro, total, outro)}
    if not a.no_heard:
        result['heard'] = heard(video, cfg, kept_words, intro, outro, total)
    if a.sync:
        result['sync'], result['sync_log'] = sync(video, points, total, intro, outro, a.cut)
    dest = WORK / 'review' / f'{a.cut}-measures.json'
    dest.write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({k: result[k] for k in ('cut', 'seconds', 'loudness_final_encode', 'join_count')}, indent=1))
    if 'heard' in result:
        print('heard:', result['heard']['status'], result['heard']['expected_words'], result['heard']['heard_words'], result['heard']['changes'][:12])


if __name__ == '__main__':
    main()
