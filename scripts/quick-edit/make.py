#!/usr/bin/env python3
"""quick-edit: one to-camera recording into a finished vertical (9:16) and wide
(16:9) cut in the makeyourmindup look.

It is for pieces that do not go through the Studio (a launch hello, a quick
take) or for when the Studio is not set up yet. It never touches the Studio's
Inbox or job folders: point it at a copy of the recording.

What it does, in order:
  1. Transcribes the recording word by word (faster-whisper), unless a words
     file is given.
  2. Cuts the words the config removes and tightens every pause longer than
     `max_gap` seconds, so dead air and stumbles go but the delivery stays.
  3. Finds each graphic's moment from the words themselves (an anchor phrase
     where it starts and one where it ends), so a re-recording needs no new
     timings unless the words change.
  4. Renders both shapes: graphics in, captions timed to the words, even
     loudness (-14 LUFS), the end card on the end.
  5. Writes preview frames at every graphic and a report of what it did.

Needs Python 3.10+, ffmpeg and ffprobe on the PATH, and for transcription
`pip install faster-whisper`. Run from anywhere:

    python make.py config.json --out OUTDIR [--only 9x16|16x9] [--plan] [--share-mib 29] [--archive [ROOT]]

`--plan` stops after the transcript: it prints every cut, every graphic's
window and the caption count, and renders nothing. Run it first.
`--share-mib` also writes a copy of each finished video under that size
(share.py), for chat uploads that stop at 30 MiB.
`--archive` then files the finished videos in the archive (archive.py), in a
folder named by the date, the config's `subject` and where to post them. ROOT
defaults to MINDMAKE_ARCHIVE_ROOT, the archive the Studio uses. README.md has
the rest.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from archive import ArchiveError, archive_root, archive_videos, plan as archive_plan, read_package
from share import share_copy

CREAM, INK, MINT = '&H00E4EFF4', '&H0012150C', '&H00C0F07E'
BRAND = [(['follow', 'the', 'money'], 'follow.the.money'), (['under', 'the', 'hood'], 'under.the.hood'),
         (['mind', 'the', 'gap'], 'mind.the.gap'), (['make', 'your', 'mind', 'up'], 'makeyourmindup')]


def run(cmd, quiet=False, **kw):
    if not quiet:
        print('+', ' '.join(str(c) for c in cmd)[:240], flush=True)
    return subprocess.run([str(c) for c in cmd], check=True, **kw)


def norm(t):
    return re.sub(r"[^a-z0-9%$]", '', t.lower())


def transcribe(src, out, model='small.en', prompt=''):
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device='cpu', compute_type='int8')
    segs, info = m.transcribe(str(src), word_timestamps=True, vad_filter=True, beam_size=5, initial_prompt=prompt or None)
    words = [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for s in segs for w in s.words]
    Path(out).write_text(json.dumps({'duration': info.duration, 'words': words}, indent=0))
    return words


def seconds(at):
    """'3:02' or 182 as seconds into the raw recording."""
    if isinstance(at, (int, float)):
        return float(at)
    m, _, s = str(at).rpartition(':')
    return float(m or 0) * 60 + float(s)


def restart_cut(words, at, before=25.0, slack=6.0):
    """The false start before a restarted sentence, found by time alone.

    Krish, 2026-10-06: "I messed up and restarted my sentence at 3m02s". When a
    sentence is restarted, its opening words are said twice: once in the false
    start, once again from about `at`. This finds the restart (a run of at least
    two words, starting within `slack` seconds of `at`, that was also said in the
    `before` seconds just ahead of it) and returns the false start, from its first
    word up to the word before the restart, so the second take is the one kept.
    The longest repeated run wins, then the restart nearest `at`."""
    t = seconds(at)
    toks = [norm(w['w']) for w in words]
    best = None
    for j, w in enumerate(words):
        if abs(w['s'] - t) > slack:
            continue
        for i in range(j - 1, -1, -1):
            if words[i]['s'] < w['s'] - before:
                break
            k = 0
            while i + k < j and j + k < len(toks) and toks[i + k] and toks[i + k] == toks[j + k]:
                k += 1
            if k >= 2:
                # A stumble often repeats its opening more than once ("how do
                # you keep, how do you, sorry, lose ... How do you lose ...").
                # The retake is the last clean start near `at`; the false start
                # runs back to the first time those words were said. So a run of
                # three or more words wins, then the widest cut, then the longer run, then nearness.
                score = (min(k, 3), j - i, k, -abs(w['s'] - t))
                if not best or score > best[0]:
                    best = (score, i, j)
    if not best:
        return None
    return best[1], best[2] - 1


def resolve_removals(words, remove):
    """Word ranges to cut. An entry is the words themselves, {"say": "So, you know,",
    "after": "is coming"}, found in the transcript after the `after` phrase, an
    index pair [first, last] into the words file, or {"restart_near": "3:02"}, the
    false start of a sentence restarted at about that point in the raw recording
    (restart_cut). Words survive a re-transcription; index pairs do not, so
    configs that live in the repository use words or restart_near."""
    ranges, missing = [], []
    for r in remove:
        if isinstance(r, (list, tuple)):
            ranges.append((int(r[0]), int(r[1])))
            continue
        if 'restart_near' in r:
            hit = restart_cut(words, r['restart_near'])
            if hit:
                ranges.append(hit)
            else:
                t = seconds(r['restart_near'])
                near = ' '.join(w['w'].strip() for w in words if t - 20 <= w['s'] <= t + 8)
                missing.append({**r, 'words_said_there': near})
            continue
        t0 = 0.0
        if r.get('after'):
            hit = find(words, r['after'])
            if not hit:
                missing.append(r)
                continue
            t0 = words[hit[1]]['e']
        hit = find(words, r['say'], after=t0)
        if hit:
            ranges.append(hit)
        else:
            missing.append(r)
    if missing:
        raise SystemExit(f'cuts not found in the transcript: {missing}')
    return ranges


def segments(words, remove, max_gap, pad_before, pad_after, src_dur):
    """Source windows to keep. A removed word, or a pause over max_gap, ends a window."""
    gone = set()
    for a, b in remove:
        gone.update(range(a, b + 1))
    segs, cur = [], None
    for i, w in enumerate(words):
        if i in gone:
            if cur:
                segs.append(cur)
                cur = None
            continue
        if cur and w['s'] - words[cur['last']]['e'] <= max_gap:
            cur['last'] = i
            cur['idx'].append(i)
        else:
            if cur:
                segs.append(cur)
            cur = {'first': i, 'last': i, 'idx': [i]}
    if cur:
        segs.append(cur)
    out = []
    for g in segs:
        a = max(0.0, words[g['first']]['s'] - pad_before)
        b = min(src_dur, words[g['last']]['e'] + pad_after)
        if out and a <= out[-1]['b']:
            out[-1]['b'] = b
            out[-1]['idx'] += g['idx']
        else:
            out.append({'a': round(a, 3), 'b': round(b, 3), 'idx': g['idx']})
    # Each window is a whole number of frames at 30 fps, so its picture and
    # sound are the same length and the joined cut never drifts out of sync.
    for g in out:
        g['b'] = round(g['a'] + max(1, round((g['b'] - g['a']) * 30)) / 30, 4)
    t = 0.0
    for g in out:
        g['off'] = round(t, 3)
        t += g['b'] - g['a']
    return out, round(t, 3)


def auto_crop(src, dur):
    """The real picture inside the frame, [w, h, x, y], from ffmpeg's cropdetect,
    narrowed to a centred 9:16 window when the picture is wider than that, which
    is the shape both renders expect (a phone held upright)."""
    probe = subprocess.run(['ffmpeg', '-hide_banner', '-ss', f'{min(30.0, dur / 3):.1f}', '-t', '6', '-i', str(src),
                            '-vf', 'cropdetect=24:2:0', '-f', 'null', '-'], capture_output=True, text=True).stderr
    found = re.findall(r'crop=(\d+):(\d+):(\d+):(\d+)', probe)
    if not found:
        raise SystemExit('crop "auto" could not read the picture: set "crop" to [w, h, x, y] by hand')
    w, h, x, y = (int(v) for v in found[-1])
    if w * 16 > h * 9:
        nw = (h * 9 // 16) // 2 * 2
        x, w = x + (w - nw) // 2, nw
    return [w, h, x, y]


def retime(words, segs):
    """Each kept word with its time in the edited cut."""
    res = []
    for g in segs:
        for i in g['idx']:
            w = words[i]
            res.append({'w': w['w'].strip(), 's': round(g['off'] + w['s'] - g['a'], 3), 'e': round(g['off'] + w['e'] - g['a'], 3), 'src': i})
    return res


def find(ws, phrase, after=0.0):
    p = [norm(x) for x in phrase.split() if norm(x)]
    toks = [norm(w['w']) for w in ws]
    for i in range(len(toks) - len(p) + 1):
        if ws[i]['s'] >= after and toks[i:i + len(p)] == p:
            return i, i + len(p) - 1
    return None


def cue_windows(ws, cues, total):
    found, missing = [], []
    for c in cues:
        a = find(ws, c['start'])
        b = find(ws, c['end'], after=ws[a[0]]['s']) if a else None
        if not a or not b:
            missing.append(c['id'])
            continue
        s = max(0.0, ws[a[0]]['s'] - c.get('lead', 0.15))
        e = min(total, ws[b[1]]['e'] + c.get('tail', 0.35))
        found.append({**c, 's': round(s, 3), 'e': round(e, 3)})
    found.sort(key=lambda c: c['s'])
    for x, y in zip(found, found[1:]):
        if x['e'] > y['s'] - 0.05:
            x['e'] = round(y['s'] - 0.05, 3)
    return found, missing


def tokens(ws, replacements):
    """Words as caption tokens: brand names joined, fixes applied, sentence case restored after a cut."""
    out, i = [], 0
    while i < len(ws):
        hit = None
        for seq, name in BRAND:
            if [norm(w['w']) for w in ws[i:i + len(seq)]] == seq:
                tail = re.sub(r'^.*?([.,!?;:]*)$', r'\1', ws[i + len(seq) - 1]['w'])
                hit = ({'w': name + tail, 's': ws[i]['s'], 'e': ws[i + len(seq) - 1]['e']}, len(seq))
                break
        if hit:
            out.append(hit[0])
            i += hit[1]
            continue
        w = dict(ws[i])
        for a, b in replacements:
            if ' ' not in a.strip():
                w['w'] = re.sub(rf'\b{re.escape(a)}\b', b, w['w'])
        out.append(w)
        i += 1
    for a, b in replacements:
        if ' ' not in a.strip():
            continue
        seq = [norm(x) for x in a.split() if norm(x)]
        k = 0
        while k + len(seq) <= len(out):
            if [norm(x['w']) for x in out[k:k + len(seq)]] == seq:
                tail = re.sub(r'^.*?([.,!?;:]*)$', r'\1', out[k + len(seq) - 1]['w'])
                out[k:k + len(seq)] = [{**out[k], 'w': b.rstrip('.,!?;:') + tail, 'e': out[k + len(seq) - 1]['e']}]
            k += 1
    for j, t in enumerate(out):
        if j == 0 or re.search(r'[.!?]$', out[j - 1]['w']):
            t['w'] = t['w'][:1].upper() + t['w'][1:]
    return out


def chunks(toks, bounds, max_words=5, max_dur=2.2, gap=0.35):
    res, cur = [], []
    for j, t in enumerate(toks):
        cur.append(t)
        nxt = toks[j + 1] if j + 1 < len(toks) else None
        cross = nxt and any(t['s'] < b <= nxt['s'] for b in bounds)
        if (not nxt or len(cur) >= max_words or cur[-1]['e'] - cur[0]['s'] >= max_dur or cross
                or (re.search(r'[.!?,;:]$', t['w']) and len(cur) >= 2) or (nxt['s'] - t['e'] > gap)):
            res.append(cur)
            cur = []
    return res


def ass_time(t):
    t = max(0.0, t)
    return f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}'


def write_ass(path, groups, wins, aspect):
    if aspect == '9x16':
        W, H, fs, box = 1080, 1920, 70, 16
        norm_pos, norm_m, cut_pos, cut_m = r'\an8\pos(540,250)', (60, 60), r'\an8\pos(540,1014)', (60, 60)
    else:
        W, H, fs, box = 1920, 1080, 48, 12
        norm_pos, norm_m, cut_pos, cut_m = r'\an2\pos(960,1040)', (360, 360), r'\an2\pos(303,1040)', (24, 1920 - 582)
    lines = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
             '[V4+ Styles]',
             'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
             f'Style: Cap,Archivo Black,{fs},{CREAM},{CREAM},{INK},{INK},0,0,0,0,100,100,0,0,3,{box},0,8,60,60,0,1', '',
             '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    for k, g in enumerate(groups):
        s = g[0]['s']
        e = groups[k + 1][0]['s'] if k + 1 < len(groups) else g[-1]['e'] + 0.4
        e = min(e, g[-1]['e'] + 0.9)
        mid = (s + g[-1]['e']) / 2
        cut = any(c['s'] <= mid <= c['e'] for c in wins)
        pos, (ml, mr) = (cut_pos, cut_m) if cut else (norm_pos, norm_m)
        words = []
        for t in g:
            w = re.sub(r'[{}\\]', '', t['w'])
            words.append(rf'{{\c{MINT}}}{w}{{\c{CREAM}}}' if re.search(r'[0-9%$]', w) else w)
        lines.append(f'Dialogue: 0,{ass_time(s)},{ass_time(e)},Cap,,{ml},{mr},0,,{{{pos}}}{" ".join(words)}')
    Path(path).write_text('\n'.join(lines) + '\n', encoding='utf-8')


def between(wins):
    return '+'.join(f"between(t,{c['s']},{c['e']})" for c in wins) or '0'


def measure_loudness(src):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(src), '-af', 'highpass=f=70,loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', p.stderr)
    return json.loads(m.group(0))


def archive_settings(args, cfg):
    """Checks --archive before anything is transcribed or rendered, so a
    missing folder, subject or bad setting stops the run in seconds, not
    after the render. None without --archive."""
    if args.archive is None:
        return None
    try:
        root = Path(archive_root(args.archive or None))
        if not root.is_dir():
            raise ArchiveError(f'the archive folder {root} does not exist: check the path, and that Google Drive is running if it is on Drive')
        subject = cfg.get('subject')
        if not isinstance(subject, str) or not subject.strip():
            raise ArchiveError('--archive needs a "subject" in the config: the piece\'s short title, as it should read, such as "Who gets paid"')
        post_to = cfg.get('post_to')
        if isinstance(post_to, str):
            post_to = [part for part in post_to.split(',') if part.strip()]
        if post_to is not None and not (isinstance(post_to, list) and all(isinstance(part, str) for part in post_to)):
            raise ArchiveError('"post_to" in the config is a list of places, such as ["YouTube", "LinkedIn"]')
        tiktok = cfg.get('tiktok', False)
        if not isinstance(tiktok, bool):
            raise ArchiveError('"tiktok" in the config is true or false')
        day = cfg.get('date')
        settings = {'root': root, 'subject': subject, 'day': day, 'post_to': post_to, 'tiktok': tiktok, 'package': args.package}
        shapes = ['tall' if asp == '9x16' else 'wide' for asp in ([args.only] if args.only else ['9x16', '16x9'])]
        planned = archive_plan(subject, shapes, day, post_to, tiktok)
        if args.package:
            read_package(args.package)
    except ArchiveError as error:
        sys.exit(f'archive: {error}')
    return {**settings, 'plan': planned}


def self_test():
    said = ('so what can you take from this if your business runs on someone else\'s um '
            'if your business runs on someone else\'s AI do not run on just one').split()
    words = [{'w': w, 's': 170.0 + n * 0.4, 'e': 170.3 + n * 0.4} for n, w in enumerate(said)]
    restart = said.index('if', 8)
    trip = ('so back to the question how do you keep your biggest how do you sorry lose your biggest supplier '
            'how do you lose your biggest supplier and keep growing').split()
    stumble = [{'w': w, 's': 172.0 + n * 0.4, 'e': 172.3 + n * 0.4} for n, w in enumerate(trip)]
    phrase = [{'w': w, 's': n * 0.4, 'e': n * 0.4 + 0.3} for n, w in enumerate('nobody is back to full year.'.split())]
    checks = [
        ('the false start and the um go', restart_cut(words, 170.0 + restart * 0.4), (7, restart - 1)),
        ('a time a little off still finds it', restart_cut(words, 170.0 + restart * 0.4 + 3), (7, restart - 1)),
        ('no repeat, no cut', restart_cut(words[:restart], 172.0), None),
        ('3:02 is 182 seconds', seconds('3:02'), 182.0),
        ('a stumble goes back to its first start', restart_cut(stumble, 172.0 + 19 * 0.4), (5, 18)),
        ('a phrase fix joins the words', [x['w'] for x in tokens(phrase, [['nobody is back to full', 'nobody has banked a full']])],
         ['Nobody has banked a full', 'year.']),
        ('found through resolve_removals', resolve_removals(words, [{'restart_near': 170.0 + restart * 0.4}]), [(7, restart - 1)]),
    ]
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'quick-edit self-test passed: {len(checks)} checks')
    return 1 if bad else 0


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser()
    ap.add_argument('config')
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', choices=['9x16', '16x9'])
    ap.add_argument('--plan', action='store_true', help='print the cuts and graphic windows, render nothing')
    ap.add_argument('--share-mib', type=float, help='also write a copy of each video under this size')
    ap.add_argument('--archive', nargs='?', const='', metavar='ROOT',
                    help='file the finished videos in the archive (default ROOT: MINDMAKE_ARCHIVE_ROOT)')
    ap.add_argument('--package', help='with --archive: the engine\'s package answer, for the YouTube and Substack words')
    args = ap.parse_args()
    if args.package and args.archive is None:
        ap.error('--package goes with --archive')
    cfg_path = Path(args.config).resolve()
    base = cfg_path.parent
    cfg = json.loads(cfg_path.read_text())
    archiving = archive_settings(args, cfg)
    P = lambda p: (base / p).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    src = P(cfg['source'])
    dur = float(json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(src)], capture_output=True, text=True).stdout)['format']['duration'])
    wpath = P(cfg['words']) if cfg.get('words') else out / f"{cfg['name']}.words.json"
    words = json.loads(wpath.read_text())['words'] if wpath.exists() else transcribe(src, wpath, cfg.get('model', 'small.en'), cfg.get('prompt', ''))

    cuts = resolve_removals(words, cfg.get('remove', []) + cfg.get('remove_words', []))
    segs, total = segments(words, cuts, cfg.get('max_gap', 0.35), cfg.get('pad_before', 0.10), cfg.get('pad_after', 0.16), dur)
    ws = retime(words, segs)
    wins, missing = cue_windows(ws, cfg['cues'], total)
    if cfg['crop'] == 'auto':
        cfg['crop'] = auto_crop(src, dur)
        print(f"crop auto: {cfg['crop']}", file=sys.stderr)
    cw, ch, cx, cy = cfg['crop']
    # The face band under a tall graphic: 100 to 550 down a 720-high picture
    # kept the eyes in frame for the launch videos, so scale that by default.
    cfg.setdefault('face', [round(ch * 100 / 720), round(ch * 450 / 720)])
    if args.plan:
        toks = tokens(ws, cfg.get('replacements', []))
        groups = chunks(toks, sorted({c['s'] for c in wins} | {c['e'] for c in wins}))
        print(json.dumps({'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
                          'cuts': [{'words': ' '.join(words[i]['w'].strip() for i in range(a, b + 1)), 'at': words[a]['s']} for a, b in cuts],
                          'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
                          'captions': len(groups),
                          **({'archive': {k: archiving['plan'][k] for k in ('folder', 'videos')}} if archiving else {})}, indent=1))
        sys.exit(1 if missing else 0)

    # Stage 1: the edited talking head, cropped to the real picture.
    edited = out / f"{cfg['name']}.edited.mkv"
    # One short encode per window, then a join without re-encoding. A single
    # filter graph over every window held each window's frames in memory at
    # once, and a 3:38 upright 1080x1920 recording with 57 windows was killed
    # for running out of it (2026-10-06).
    plan_lines = [f"{g['a']:.4f} {g['b']:.4f} crop={cw}:{ch}:{cx}:{cy}" for g in segs]
    g1 = out / 'stage1.plan'
    # The cut only changes when the words to remove or the pause rule change, so reuse it otherwise.
    if not (edited.exists() and g1.exists() and g1.read_text() == '\n'.join(plan_lines)):
        parts = out / 'parts'
        parts.mkdir(exist_ok=True)
        for old in parts.glob('*.mkv'):
            old.unlink()
        names = []
        for i, g in enumerate(segs):
            d = g['b'] - g['a']
            part = parts / f'{i:04d}.mkv'
            run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f"{g['a']:.4f}", '-i', src, '-t', f'{d:.4f}',
                 '-vf', f'crop={cw}:{ch}:{cx}:{cy},fps=30,setpts=PTS-STARTPTS',
                 '-af', f'aresample=48000,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.012,afade=t=out:st={max(0, d - 0.012):.4f}:d=0.012',
                 '-frames:v', str(round(d * 30)), '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-c:a', 'pcm_s16le', part], quiet=True)
            names.append(f"file '{part.as_posix()}'")
        listing = parts / 'list.txt'
        listing.write_text('\n'.join(names) + '\n')
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listing, '-c', 'copy', edited])
        g1.write_text('\n'.join(plan_lines))
    loud = measure_loudness(edited)
    afilter = (f"highpass=f=70,loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={loud['input_i']}:measured_TP={loud['input_tp']}:"
               f"measured_LRA={loud['input_lra']}:measured_thresh={loud['input_thresh']}:offset={loud['target_offset']}:linear=true,aresample=48000")

    toks = tokens(ws, cfg.get('replacements', []))
    bounds = sorted({c['s'] for c in wins} | {c['e'] for c in wins})
    groups = chunks(toks, bounds)
    report = {'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
              'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
              'captions': len(groups), 'loudness_in': loud['input_i']}
    aspects = [args.only] if args.only else ['9x16', '16x9']
    fonts = Path(__file__).resolve().parent / 'fonts'
    for asp in aspects:
        ass = out / f"{cfg['name']}-{asp}.ass"
        write_ass(ass, groups, wins, asp)
        inputs = ['-i', edited]
        n = 1
        g = []
        cut = between(wins)
        if asp == '9x16':
            fy, fh = cfg['face'][0], cfg['face'][1]
            fw_out = round(cw * 920 / fh)
            g.append('[0:v]split=2[sp][fc]')
            g.append(f"[sp]scale=1080:{round(ch * 1080 / cw)}:flags=lanczos,crop=1080:1920,unsharp=5:5:0.6,"
                     f"drawbox=x=0:y=1000:w=1080:h=920:color=0x0C1512@1:t=fill:enable='{cut}'[s0]")
            g.append(f"[fc]crop={cw}:{fh}:0:{fy},scale={fw_out}:920:flags=lanczos,unsharp=5:5:0.5[face]")
            g.append(f"[s0][face]overlay=x={(1080 - fw_out) // 2}:y=1000:enable='{cut}'[s1]")
            last = 's1'
            px, py = 0, 0
        else:
            inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', P(cfg['frame16'])]
            fr = n
            n += 1
            sw = round(cw * 1080 / ch)
            g.append(f"[0:v]scale={sw}:1080:flags=lanczos,unsharp=5:5:0.4[spk]")
            g.append(f"[{fr}:v]format=rgba[fr]")
            g.append(f"[fr][spk]overlay=x='if({cut},0,{(1920 - sw) // 2})':y=0[s1]")
            last = 's1'
            px, py = sw, 0
        k = 2
        for c in wins:
            inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', P(c['panel'].replace('{aspect}', asp))]
            g.append(f"[{last}][{n}:v]overlay=x={px}:y={py}:enable='between(t,{c['s']},{c['e']})'[s{k}]")
            last, n, k = f's{k}', n + 1, k + 1
        if asp == '9x16' and cfg.get('strap'):
            st = cfg['strap']
            hit = find(ws, st['after']) if st.get('after') else (0, 0)
            t0 = ws[hit[0]]['s'] if hit else 0.3
            inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', P(st['png'])]
            g.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{t0:.2f},{t0 + st.get('seconds', 3.5):.2f})'[s{k}]")
            last, n, k = f's{k}', n + 1, k + 1
        ass_rel = ass.name
        g.append(f"[{last}]ass={ass_rel}:fontsdir=fonts,fps=30,setsar=1,format=yuv420p[vm]")
        g.append(f"[0:a]{afilter}[am]")
        inputs += ['-i', P(cfg['endcard'][asp])]
        g.append(f"[{n}:v]fps=30,setsar=1,format=yuv420p[ev]")
        g.append(f"[{n}:a]aresample=48000[ea]")
        g.append('[vm][am][ev][ea]concat=n=2:v=1:a=1[V][A]')
        gfile = out / f'stage2-{asp}.graph'
        gfile.write_text(';\n'.join(g))
        final = out / f"{cfg['name']}-{asp}.mp4"
        # libass reads the captions and fonts relative to the working folder.
        fl = out / 'fonts'
        if not fl.exists():
            fl.mkdir()
            for f in fonts.glob('*.ttf'):
                (fl / f.name).write_bytes(f.read_bytes())
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-filter_complex_script', gfile.name, '-map', '[V]', '-map', '[A]',
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', final.name], cwd=out)
        report[f'{asp}_file'] = final.name
        if args.share_mib:
            report[f'{asp}_share'] = share_copy(final, out / 'share' / final.name, args.share_mib)
        # Preview: one frame inside every graphic, the opening, and the end card.
        shots = [1.0] + [round((c['s'] + c['e']) / 2, 2) for c in wins] + [total + 2.0]
        for j, t in enumerate(shots):
            run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', final.name, '-frames:v', '1', '-vf', 'scale=-2:640',
                 f'preview-{asp}-{j:02d}.jpg'], quiet=True, cwd=out)
    archive_failed = None
    if archiving:
        # Copies only what this run made: a share copy left from an earlier
        # run is never picked up in place of a fresh one.
        made = {asp: out / report[f'{asp}_file'] for asp in aspects}
        try:
            report['archive'] = archive_videos(
                archiving['root'], archiving['subject'], tall=made.get('9x16'), wide=made.get('16x9'), day=archiving['day'],
                tall_share=report.get('9x16_share', {}).get('file'), wide_share=report.get('16x9_share', {}).get('file'),
                package=archiving['package'], post_to=archiving['post_to'], tiktok=archiving['tiktok'], find_shares=False)
        except (ArchiveError, OSError) as error:
            # The render stands: the report is written, and archive.py can
            # file the same videos once the archive is reachable.
            archive_failed = report['archive_error'] = str(error)
    (out / f"{cfg['name']}.report.json").write_text(json.dumps(report, indent=1))
    (out / f"{cfg['name']}.cut.txt").write_text(' '.join(t['w'] for t in toks))
    print(json.dumps(report, indent=1))
    if missing:
        print('MISSING CUES:', missing, file=sys.stderr)
    if archive_failed:
        sys.exit(f'archive: {archive_failed}')


if __name__ == '__main__':
    main()
