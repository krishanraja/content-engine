#!/usr/bin/env python3
"""Wednesday 4 Nov's two make.py configs: kit.py's starter configs, with every picture beat of the signed direction
as a cue anchored on his heard words.

The anchors are read off make.py's own transcript of the stabilised take (the words file a --plan run writes), so
they match it exactly: each beat's window in the take (creative-direction.json `timing`, from the take's word clock)
maps to the first and last three words he said inside it. Face beats carry no cue (his face, held) in the long cut.
The 90-second cut gives every beat a picture: make.py's 9:16 gate needs pictures over 90% of his words, no gap over
1.5 s and 20 picture changes a minute. A continuous panel is cut into pages at word anchors so it keeps playing
across the page turns; no picture restarts.

    python3 docs/plans/2026-11-04-wednesday/video/configure.py            # after kit.py, the panels and a first --plan
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = ROOT / 'docs/plans/2026-11-04-wednesday'
WORK = ROOT / '.cache/produce/2026-11-04-b63d2507'
KIT, PANELS, RENDER = WORK / 'kit', WORK / 'panels', WORK / 'render'
D = json.loads((PLAN / 'creative-direction.json').read_text(encoding='utf-8'))

# beat number (1-based, creative-direction.json) -> panel name (panels/<name>-<shape>.mp4)
# Krish's reviewer (31 Oct): the 16:9 cut never holds the still brand frame: every run of face beats has The Queue
# drifting beside him. key: first beat of the run -> (panel, last beat of the run)
LONG_RUNS = {1: ('l01-amb', 2), 9: ('l09-amb', 11), 19: ('l19-amb', 20), 26: ('l26-amb', 26), 28: ('l28-amb', 28),
             31: ('l31-amb', 31), 33: ('l33-amb', 33), 36: ('l36-amb', 36)}
LONG = {3: 'first', 4: 'l04-logos', 5: 'brief', 6: 'l06-stops', 7: 'setup', 8: 'l08-carries', 12: 'l12-microsoft',
        13: 'tasks', 14: 'reply', 15: 'todo', 16: 'think', 17: 'make', 18: 'calendar', 21: 'l21-tool', 22: 'l22-today',
        23: 'l23-duet', 24: 'l24-reddit', 25: 'l25-hours', 27: 'l27-vo', 29: 'l29-limits', 30: 'l30-plans', 32: 'l32-it',
        34: 'l34-steps', 35: 'l35-steps'}
SHORT = {1: 's01-open', 2: 'first', 3: 'brief', 4: 's04-stops', 5: 'setup', 6: 's06-email', 7: 'todo', 8: 'think',
         9: 's09-limits', 10: 'calendar', 11: 's11-tool', 12: 's12-doit', 13: 's13-steps'}
# The 90-second cut's last picture holds over "The full deep dive..." to the end card (one close).
SHORT_TAIL = {13: 3.4}
# The opening panel starts 0.6 s in, so its first frame already shows the Claude mark landing, never an empty desk.
OFFSET = {'s01-open': 0.6}
PAGE_S = 2.6   # a continuous panel turns a page about this often in the 90-second cut (20 changes a minute)

# The transcriber hears Duet as DeWitt or Dewitt, Claire Vo as Clairvaux and "draft" as "draw" (direction take_edits).
# Captions only; the sound is never touched.
REPLACE = [['DeWitt', 'Duet'], ['Dewitt', 'Duet'], ['De Witt', 'Duet'], ['Clairvaux', 'Claire Vo'], ['Claire Voe', 'Claire Vo'],
           ['let it draw', 'let it draft'], ['a long thing like me', 'a long think like me'], ['makeyourmindup .ai', 'makeyourmindup.ai'], ['MakeYourMindUp .ai', 'makeyourmindup.ai'],
           ['make your mind up .ai', 'makeyourmindup.ai'], ['Lenny\'s newsletter', 'Lenny\'s Newsletter']]


def clock(s):
    m, _, rest = s.partition(':')
    return int(m) * 60 + float(rest)


def window(beat):
    m = re.match(r'(\d+:\d+\.\d+)-(\d+:\d+\.\d+)', beat['timing'])
    return clock(m.group(1)), clock(m.group(2))


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower())


def take_words(cut):
    """make.py's transcript of the take, on the take's own clock (the plan run writes it)."""
    path = RENDER / cut / f'claude-duet-{cut}.words.json'
    return json.loads(path.read_text(encoding='utf-8'))['words'], path


def anchors(words, s, e, n=3):
    inside = [w for w in words if s - 0.05 <= w['s'] < e - 0.02 and norm(w['w'])]
    if len(inside) < 2:
        return None
    k = min(n, max(1, len(inside) // 2))
    return ' '.join(w['w'].strip() for w in inside[:k]), ' '.join(w['w'].strip() for w in inside[-k:]), inside


def unique(words, phrase):
    want = [norm(x) for x in phrase.split() if norm(x)]
    toks = [norm(w['w']) for w in words]
    return sum(1 for i in range(len(toks) - len(want) + 1) if toks[i:i + len(want)] == want) == 1


def grow(words, inside, first=True):
    """The shortest phrase from this end of the beat that is said only once in the take."""
    seq = inside if first else inside[::-1]
    for k in range(3, len(seq) + 1):
        part = seq[:k] if first else seq[:k][::-1]
        phrase = ' '.join(w['w'].strip() for w in part)
        if unique(words, phrase):
            return phrase
    return ' '.join(w['w'].strip() for w in (inside if first else inside))


def panel(name, shape):
    p = PANELS / f'{name}-{shape}.mp4'
    if not p.exists():
        sys.exit(f'configure: missing panel {p.name}; render it first (phone.py or scenes.py)')
    return p


def pages_of(name, shape, inside, beat_s):
    """Cut one continuous panel into pages at word anchors, so the 90-second cut turns a page every ~2.6 s while the
    picture plays on unbroken. Each page is the panel from that word on."""
    src = panel(name, shape)
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(src)]))
    cuts, last = [OFFSET.get(name, 0.0)], 0.0
    on = [None]
    for i, w in enumerate(inside[:-3]):
        t = w['s'] - beat_s
        if t - last >= PAGE_S and (inside[-1]['e'] - w['s']) >= 1.2:
            phrase = ' '.join(x['w'].strip() for x in inside[i:i + 3])
            cuts.append(round(t + 0.15, 3)); on.append(phrase); last = t
    if len(cuts) == 1:
        return None
    files = []
    for k, c in enumerate(cuts):
        out = PANELS / 'pages' / f'{name}-{shape}-p{k + 1}.mp4'
        out.parent.mkdir(exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{c:.3f}', '-i', str(src), '-t', f'{max(0.5, dur - c):.3f}',
                        '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-an', str(out)], check=True)
        files.append(f'../panels/pages/{out.name}')
    return files, on


def cues(cut, mapping, shape, paged=False):
    words, _ = take_words(cut)
    beats = D['cuts'][cut]['beats']
    out = []
    for n, name in sorted(mapping.items()):
        last = n
        if isinstance(name, tuple):
            name, last = name
        b = beats[n - 1]
        s, e = window(b)[0], window(beats[last - 1])[1]
        a = anchors(words, s, e)
        if not a:
            print(f'warn {cut} beat {n}: no words found in its window; no cue')
            continue
        _, _, inside = a
        start, end = grow(words, inside, True), grow(words, inside, False)
        c = {'id': f'{cut[0]}{n:02d}', 'panel': f'../panels/{name}-{shape}.mp4', 'start': start, 'end': end}
        panel(name, shape)
        if paged:
            pg = pages_of(name, shape, inside, s)
            if pg:
                files, on = pg
                on[0] = start
                c['panel'] = files[0]
                c['pages'] = {shape: files}
                c['on'] = on
        if cut == 'short' and n in SHORT_TAIL:
            c['tail'] = SHORT_TAIL[n]
        out.append(c)
    return out


def face_pushes(cut, mapping):
    """A push in on the second half of every face beat, so his face is never a still frame: the framing changes
    at least once a beat (Krish, 2026-10-31: "way more animation than ever before and movement")."""
    words, _ = take_words(cut)
    out = []
    for n, b in enumerate(D['cuts'][cut]['beats'], 1):
        if n in mapping or b['picture']['kind'] != 'face' or any(a <= n <= z for a, (_, z) in LONG_RUNS.items()):
            continue
        s, e = window(b)
        inside = [w for w in words if s - 0.05 <= w['s'] < e - 0.02 and norm(w['w'])]
        if len(inside) < 8:
            continue
        mid = inside[len(inside) // 2:]
        out.append({'start': ' '.join(w['w'].strip() for w in mid[:3]), 'end': ' '.join(w['w'].strip() for w in mid[-3:])})
    return out


def configure(cut, shape, cue_list, extra):
    path = KIT / f'{cut}.json'
    cfg = json.loads(path.read_text(encoding='utf-8'))
    cfg.update({
        'source': f'../takes/{cut}-stable.mp4', 'crop': [1080, 1920, 0, 0],
        'music': 'auto', 'series': 'under_the_hood', 'voice': 'repair',
        'max_gap': 0.9, 'pad_before': 0.2, 'pad_after': 0.3,
        'model': 'large-v3-turbo', 'captions': True, 'caption_style': 'house', 'cues': cue_list,
        'replacements': REPLACE, 'remove': [], 'strap': False, 'face': [690, 920], **extra})
    path.write_text(json.dumps(cfg, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return cfg


if __name__ == '__main__':
    which = sys.argv[1:] or ['long', 'short']
    if 'long' in which:
        c = cues('long', {**LONG, **LONG_RUNS}, '16x9')
        # Krish, 2026-10-31: "way more animation than ever before and movement": his face is never a still frame
        # either: the framing changes at each hidden pause cut, and pushes in on the lines that carry the piece.
        configure('long', '16x9', c, {'music_mode': 'episode', 'music_seconds': 100, 'reframe': True,
                                      'emphasis': face_pushes('long', LONG)})
        print(f'long: {len(c)} cues')
    if 'short' in which:
        c = cues('short', SHORT, '9x16', paged=True)
        configure('short', '9x16', c, {'music_seconds': 90, 'reframe': False})
        print(f'short: {len(c)} cues, {sum(len(x.get("pages", {}).get("9x16", [1])) for x in c)} pictures')
