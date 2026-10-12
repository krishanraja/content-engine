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
  4. Renders both shapes: the intro sting first (when Krish has approved it),
     graphics in, captions timed to the words, the end card on the end.
  5. Mixes the sound: his voice, the licensed music bed under the whole
     video (high over the sting, low under his voice, higher over the end
     card), then one two-pass loudness pass on the final mix (-14 LUFS,
     true peak at most -1 dBTP), measured again after the encode.
  6. Writes preview frames at the sting and every graphic, and a report of
     what it did, the music it used and the loudness it measured.

Needs Python 3.10+, ffmpeg and ffprobe on the PATH, and for transcription
`pip install faster-whisper`. Run from anywhere:

    python make.py config.json --out OUTDIR [--only 9x16|16x9] [--plan] [--share-mib 29] [--archive [ROOT]]
    python make.py --doctor [--json]     is this machine ready to make a video
    python make.py --self-test

`--plan` stops after the transcript: it prints every cut, every graphic's
window, the caption count, the intro and the music each cut will get, and
renders nothing. Run it first.
`--share-mib` also writes a copy of each finished video under that size
(share.py), for chat uploads that stop at 30 MiB.
`--archive` then files the finished videos in the archive (archive.py), in a
folder named by the date, the config's `subject` and where to post them. ROOT
defaults to MINDMAKE_ARCHIVE_ROOT, the archive the Studio uses. README.md has
the rest.
"""
import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

import intro as sting
import music
from archive import ArchiveError, archive_root, archive_videos, plan as archive_plan, read_package
from share import share_copy

CREAM, INK, MINT = '&H00E4EFF4', '&H0012150C', '&H00C0F07E'
FPS, RATE = 30, 48000
SIZE = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
# The voice is set to the target before the mix, and the mix is limited this
# far under full scale (true peak, 4x oversampled) before the final loudness
# pass, so that pass is a plain gain and the AAC encode stays under -1 dBTP.
LIMIT_DBTP = -2.0
TALL_MAX_S = 90  # house rule TWO_CUTS: the short cut runs at most 90 seconds
NORM = f'aresample={RATE},aformat=sample_fmts=fltp:sample_rates={RATE}:channel_layouts=stereo'
BRAND = [(['follow', 'the', 'money'], 'follow.the.money'), (['under', 'the', 'hood'], 'under.the.hood'),
         (['mind', 'the', 'gap'], 'mind.the.gap'), (['make', 'your', 'mind', 'up'], 'makeyourmindup')]


def run(cmd, quiet=False, **kw):
    if not quiet:
        print('+', ' '.join(str(c) for c in cmd)[:240], flush=True)
    return subprocess.run([str(c) for c in cmd], check=True, **kw)


# Names the transcriber gets wrong, fixed in every video's captions before the
# config's own fixes. Krish, 2026-10-07, of the Higgsfield video: "the subtitle
# called Byte Dance, 'Bike Dance.'" Add a name here when a video gets it wrong,
# so the next one cannot.
DEFAULT_FIXES = [
    ['Bike Dance', 'ByteDance'], ['Byte Dance', 'ByteDance'], ['Bite Dance', 'ByteDance'], ['Bytedance', 'ByteDance'],
    ['Higgs field', 'Higgsfield'], ['Higsfield', 'Higgsfield'], ['Open AI', 'OpenAI'], ['Sorah', 'Sora'],
    ['Chat GPT', 'ChatGPT'], ['XAI', 'xAI'], ['Deep Seek', 'DeepSeek'], ['Mid Journey', 'Midjourney'], ['Eleven Labs', 'ElevenLabs'],
    ['MakeYourMindUp .ai', 'makeyourmindup.ai'], ['Chris', 'Krish'], ['theater', 'theatre'],
    # The AI-plans pieces (2026-10-09): names the transcriber gets wrong.
    ['Clawed', 'Claude'], ['Entropic', 'Anthropic'], ['Anthropics', 'Anthropic\'s'],
    ['Semi Analysis', 'SemiAnalysis'], ['Semi analysis', 'SemiAnalysis'], ['Semianalysis', 'SemiAnalysis'],
    ['Amoday', 'Amodei'], ['Fable five', 'Fable 5'], ['GPT six', 'GPT-6'], ['GPT 6', 'GPT-6'], ['GPT five', 'GPT-5'],
    ['Poly market', 'Polymarket'], ['Kal shi', 'Kalshi'], ['Hugging face', 'Hugging Face'], ['Sora two', 'Sora 2'],
]


def default_logo(out):
    """The makeyourmindup masthead on an ink pill, centred above the tall
    captions (they start 250 pixels down), on a transparent 1080x1920 frame.
    Drawn once per output folder from the brand's own masthead."""
    png = Path(out) / 'logo-9x16.png'
    if png.exists():
        return png
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pages'))
    import brand
    from PIL import Image, ImageDraw
    mast = Image.open(brand.fetch('masthead')).convert('RGBA')
    w = 440
    mast = mast.resize((w, round(mast.height * w / mast.width)), Image.LANCZOS)
    pad_x, pad_y, top = 26, 20, 50
    frame = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
    box = (540 - w // 2 - pad_x, top, 540 + w // 2 + pad_x, top + mast.height + 2 * pad_y)
    ImageDraw.Draw(frame).rounded_rectangle(box, radius=22, fill=(12, 21, 18, 235))
    frame.alpha_composite(mast, (540 - w // 2, top + pad_y))
    frame.save(png)
    return png


def script_prompt(path):
    """The names in the script, as a hint for the transcriber, so it hears
    "ByteDance" and "Higgsfield" the way they are spelt."""
    text = Path(path).read_text(encoding='utf-8-sig')
    names = []
    for m in re.finditer(r"\b(?:[A-Z][a-z]*[A-Z][A-Za-z]*|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*|[A-Z]{2,}[a-z]*)\b", text):
        word = m.group(0)
        if word not in names and word.split()[0] not in {'The', 'This', 'That', 'And', 'But', 'So', 'Now', 'Our', 'If', 'One', 'First', 'Then', 'When', 'What', 'How', 'Why', 'Think', 'People', 'Every', 'Most', 'Nobody', 'Instead', 'Expensive', 'Choose', 'Line', 'Before', 'Square', 'Written', 'On', 'In', 'It', 'They', 'You', 'We', 'He', 'She', 'Let', 'Back'}:
            names.append(word)
    return 'Krish, makeyourmindup. ' + ', '.join(names[:60]) + '.'


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
            got = [norm(x['w']) for x in out[k:k + len(seq)]]
            # The last word may carry an 's ("bike dances," is ByteDance's).
            owned = got[:-1] == seq[:-1] and got[-1] == seq[-1] + 's' and not seq[-1].endswith('s')
            if got == seq or owned:
                tail = re.sub(r'^.*?([.,!?;:]*)$', r'\1', out[k + len(seq) - 1]['w'])
                word = b.rstrip('.,!?;:') + ("'s" if owned else '') + tail
                out[k:k + len(seq)] = [{**out[k], 'w': word, 'e': out[k + len(seq) - 1]['e']}]
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


def loudnorm_json(stderr):
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', stderr)
    return json.loads(m.group(0))


def measure_loudness(src):
    """The voice's loudness as it goes into the mix: 48 kHz stereo (a mono
    phone recording counts twice once it is stereo), low rumble cut."""
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(src), '-vn', '-af', f'{NORM},highpass=f=70,loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True)
    return loudnorm_json(p.stderr)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def clip_info(path):
    """A clip's length in whole frames at 30 fps, and whether it has sound."""
    data = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,duration,width,height:format=duration',
                                      '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout)
    video = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'), None)
    if not video:
        raise ValueError(f'{path} has no picture')
    secs = float(video.get('duration') or data['format']['duration'])
    frames = max(1, round(secs * FPS))
    return {'frames': frames, 'seconds': round(frames / FPS, 4), 'audio': any(s.get('codec_type') == 'audio' for s in data['streams']),
            'width': video.get('width'), 'height': video.get('height')}


def resolve_intro(cfg, asp, P):
    """The sting in front of this cut: (intro, note). intro is None when the
    cut has none, and note says why. The config's "intro" is "auto" (the
    house sting once Krish has approved it, config/intro-sting.json), false,
    or {"9x16": file, "16x9": file}. A sting problem never stops a render."""
    want = cfg.get('intro', 'auto')
    if want is False or want is None:
        return None, None
    if want == 'auto':
        path, why = sting.sting_for(asp)
        if not path:
            return None, why
        source = 'house'
    elif isinstance(want, dict):
        if not want.get(asp):
            return None, f'the config\'s "intro" names no {asp} file, so this cut has no intro'
        path, source = P(want[asp]), 'config'
        if not path.is_file():
            return None, f'the intro file {path} is missing, so this cut has no intro'
    else:
        return None, '"intro" in the config is "auto", false or {"9x16": file, "16x9": file}; this cut has no intro'
    try:
        info = clip_info(path)
    except (ValueError, subprocess.CalledProcessError, KeyError) as e:
        return None, f'the intro {path} could not be read ({e}), so this cut has no intro'
    lo, hi = sting.SECONDS
    if not lo - 0.5 / FPS <= info['seconds'] <= hi + 0.5 / FPS:
        return None, f'the intro {path.name} runs {info["seconds"]} s, outside {lo} to {hi} s, so this cut has no intro'
    note = None
    if source == 'config':
        try:
            if sting.load()['status'] != 'approved':
                note = 'the intro is a file named in the config, not the approved house sting'
        except (OSError, ValueError):
            pass
    return {'file': path, 'source': source, 'sha256': sha256_file(path), **info}, note


def piece_key(cfg):
    """What ties both cuts of one piece to the same music."""
    return str(cfg.get('piece_id') or cfg.get('piece') or cfg.get('subject') or cfg['name'])


def resolve_music(cfg, asp, seconds):
    """The bed under this cut: (bed, note). The config's "music" is "auto"
    (music.py's pick for this piece among the approved, licensed tracks),
    false, or a track id. Only a track in the ledger with Krish's approval
    and a licence for every place this cut is posted is ever used."""
    want = cfg.get('music', 'auto')
    if want is False or want is None:
        return None, None
    try:
        data = music.load()
        platforms = music.SHAPE_PLATFORMS[asp]
        if want == 'auto':
            track, skipped = music.pick(seconds, piece_key(cfg), platforms, data)
            if not track:
                passed = '; '.join(f'{k}: {", ".join(v)}' for k, v in skipped.items())
                return None, ('no approved licensed track can go under this cut, so it has voice only'
                              + (f' (passed over: {passed})' if passed else ' (the music ledger has no tracks yet)'))
        elif isinstance(want, str):
            track = music.by_id(want, data)
            why = music.problems(track, platforms, None, seconds)
            if why:
                return None, f'the track {want} cannot go under this cut ({"; ".join(why)}), so it has voice only'
        else:
            return None, '"music" in the config is "auto", false or a track id; this cut has voice only'
        path = music.resolve(track, data)
        levels = dict(music.levels_of(data))
    except music.MusicError as e:
        return None, f'the music could not be used ({e}), so this cut has voice only'
    ledger = music.ledger_path()
    note = None if ledger.resolve() == music.LEDGER.resolve() else f'the music came from {ledger}, not config/music-library.json'
    return {'track': track, 'file': path, 'levels': levels, 'ledger': str(ledger)}, note


def timeline(intro_frames, main_frames, end_frames, ws):
    """The cut's clock: the sting, the captioned main and the end card, in
    whole frames, and when Krish's first and last words fall on it."""
    I, M, E = intro_frames / FPS, main_frames / FPS, end_frames / FPS
    vs = I + (ws[0]['s'] if ws else 0.0)
    ve = I + min(M, ws[-1]['e'] if ws else M)
    return {'intro_s': round(I, 4), 'main_s': round(M, 4), 'outro_s': round(E, 4), 'total_s': round(I + M + E, 4),
            'voice_start_s': round(vs, 4), 'voice_end_s': round(max(vs, ve), 4)}


def preview_shots(tl, wins):
    """Preview frame times on the finished cut: one in the sting (named
    `intro`), then the opening, every graphic and the end card, each moved
    on by the sting's length."""
    I = tl['intro_s']
    shots = [('intro', round(I * 0.7, 2))] if I > 0 else []
    main = [1.0] + [round((c['s'] + c['e']) / 2, 2) for c in wins] + [round(tl['main_s'] + 2.0, 2)]
    return shots + [(f'{j:02d}', round(I + t, 2)) for j, t in enumerate(main)]


def length_warnings(asp, tl):
    if asp == '9x16' and tl['total_s'] > TALL_MAX_S:
        return [f'the tall cut runs {tl["total_s"]:.1f} s with its intro and end card, over the {TALL_MAX_S} s cap for the short cut (house rule TWO_CUTS)']
    return []


def ffmpeg(*args, cwd=None):
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *args], quiet=True, cwd=cwd)


def build_audio(work, edited, voice_gain, intro, end, tl, bed):
    """The cut's sound as three files in `work`: dialog.wav (the sting's
    silence, his voice set to the target, the end card's sound), bed.wav (the
    music under the whole cut, or none), and mix.wav, the final mix. Returns
    what the report needs."""
    work.mkdir(parents=True, exist_ok=True)
    smp = {k: round(tl[k] * RATE) for k in ('intro_s', 'main_s', 'outro_s', 'total_s')}
    inputs, g, labels = ['-i', str(edited)], [], []
    k = 1
    if intro:
        if intro['audio']:
            inputs += ['-i', str(intro['file'])]
            g.append(f'[{k}:a]{NORM},apad,atrim=end_sample={smp["intro_s"]},asetpts=PTS-STARTPTS[ia]')
            k += 1
        else:
            g.append(f'anullsrc=r={RATE}:cl=stereo,{NORM},atrim=end_sample={smp["intro_s"]},asetpts=PTS-STARTPTS[ia]')
        labels.append('[ia]')
    g.append(f'[0:a]{NORM},highpass=f=70,volume={voice_gain:.3f}dB,apad,atrim=end_sample={smp["main_s"]},asetpts=PTS-STARTPTS[va]')
    labels.append('[va]')
    if end['audio']:
        inputs += ['-i', str(end['file'])]
        g.append(f'[{k}:a]{NORM},apad,atrim=end_sample={smp["outro_s"]},asetpts=PTS-STARTPTS[ea]')
    else:
        g.append(f'anullsrc=r={RATE}:cl=stereo,{NORM},atrim=end_sample={smp["outro_s"]},asetpts=PTS-STARTPTS[ea]')
    labels.append('[ea]')
    g.append(f'{"".join(labels)}concat=n={len(labels)}:v=0:a=1[dlg]')
    dialog = work / 'dialog.wav'
    ffmpeg(*inputs, '-filter_complex', ';'.join(g), '-map', '[dlg]', '-c:a', 'pcm_f32le', str(dialog))
    result = {'dialog': dialog, 'bed': None, 'music': None}
    mix_in = ['-i', str(dialog)]
    mix = '[0:a]anull[m]'
    if bed:
        track, levels = bed['track'], bed['levels']
        # Measure the track where it will sit, then set each stretch's gain
        # from what it really measures there, not from its average.
        raw = work / 'bed-raw.wav'
        ffmpeg('-i', str(bed['file']), '-filter_complex', music.bed_filter(track, tl, levels, out='bed', unity=True),
               '-map', '[bed]', '-c:a', 'pcm_f32le', str(raw))
        windows = music.envelope(track, tl, levels)['windows']
        placed = {name: (music.ebur128(raw, *w)['I'] if w else None) for name, w in windows.items()}
        tl_bed = {**tl, 'window_lufs': placed}
        stem = work / 'bed.wav'
        ffmpeg('-i', str(bed['file']), '-filter_complex', music.bed_filter(track, tl_bed, levels, out='bed'),
               '-map', '[bed]', '-c:a', 'pcm_f32le', str(stem))
        raw.unlink()
        env = music.envelope(track, tl_bed, levels)
        _, how = music.placement(track, tl, xf=levels['ramp_up_s'])
        result.update(bed=stem, music={
            'track_id': track['id'], 'title': track.get('title'), 'artist': track.get('artist'), 'sha256': track['sha256'], 'file': track['file'],
            'ledger': bed['ledger'], 'levels': levels, 'gains_db': env['gains_db'], 'placed_lufs': placed, 'windows': env['windows'],
            'placement': how, 'start_s': float(track.get('intro_cue_s') or 0)})
        mix_in += ['-i', str(stem)]
        mix = '[0:a][1:a]amix=inputs=2:duration=first:normalize=0[m]'
    target = (bed['levels'] if bed else default_levels())['final_integrated_lufs']
    # Every pass is metered with ebur128, the meter the report and the
    # Studio's QA read: loudnorm's own meter reads low notes up to about
    # 1.3 LU differently, so it is given ebur128's figures, not left to its own.
    summed = work / 'sum.wav'
    ffmpeg(*mix_in, '-filter_complex', f'{mix};[m]anull[o]', '-map', '[o]', '-c:a', 'pcm_f32le', str(summed))
    # Pass 1: the summed mix's loudness, to set the limiter's working level.
    pre = music.ebur128(summed)['I'] or target
    limited = (f'volume={target - pre:.3f}dB,aresample={RATE * 4},'
               f'alimiter=limit={10 ** (LIMIT_DBTP / 20):.4f}:attack=1:release=60:level=disabled:latency=1,{NORM}')
    # Pass 2 and 3: the two-pass loudness normalisation on the final mix,
    # linear, so it is one gain and never pumps the bed. If it cannot be a
    # plain gain it is left out and the limited mix stands.
    m = music.ebur128(summed, chain=limited)
    mixed = work / 'mix.wav'
    mode = None
    if m['I'] is not None and m['thresh'] is not None:
        lra = max(m['LRA'] or 0.0, 0.1)
        ln = (f'loudnorm=I={target}:TP=-1.0:LRA={max(11.0, min(50.0, lra + 1)):.1f}:measured_I={m["I"]}:measured_TP={m["TP"]}:'
              f'measured_LRA={lra}:measured_thresh={m["thresh"]}:offset=0:linear=true:print_format=json')
        p = subprocess.run(['ffmpeg', '-y', '-hide_banner', '-nostats', '-i', str(summed), '-af', f'{limited},{ln},{NORM},atrim=end_sample={smp["total_s"]}',
                            '-c:a', 'pcm_f32le', str(mixed)], capture_output=True, text=True, check=True)
        mode = loudnorm_json(p.stderr).get('normalization_type')
    if mode != 'linear':
        ffmpeg('-i', str(summed), '-af', f'{limited},atrim=end_sample={smp["total_s"]}', '-c:a', 'pcm_f32le', str(mixed))
        mode = 'limited'
    summed.unlink()
    result.update(mix=mixed, normalisation=mode, pre_mix_lufs=pre, target=target)
    return result


def video_graph(cfg, asp, P, out, edited, total, wins, ws, crop, intro, end, mix):
    """The ffmpeg inputs and filter graph for one shape: the captioned main
    (graphics, the tall logo, the strap, the captions), joined after the sting
    and before the end card, with the finished mix as its sound."""
    cw, ch, cx, cy = crop
    W, H = SIZE[asp]
    inputs = ['-i', str(edited)]
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
        inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(cfg['frame16']))]
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
        inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(c['panel'].replace('{aspect}', asp)))]
        g.append(f"[{last}][{n}:v]overlay=x={px}:y={py}:enable='between(t,{c['s']},{c['e']})'[s{k}]")
        last, n, k = f's{k}', n + 1, k + 1
    if asp == '9x16' and cfg.get('logo', True) is not False:
        # The makeyourmindup logo in the opening seconds of every tall video
        # (Krish, 2026-10-07: "put the Make Your Mind Up logo in the first
        # few seconds of the video somewhere on vertical video"). The PNG is
        # the whole frame, transparent, so it says where the logo sits. It is
        # laid on the captioned main, before the sting is joined in front, so
        # with a sting it starts as his face comes in, never over the sting.
        lg = cfg['logo'] if isinstance(cfg.get('logo'), dict) else {}
        secs = lg.get('seconds', 3.0)
        inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(lg['png']) if lg.get('png') else default_logo(out))]
        g.append(f"[{n}:v]format=rgba,fade=t=out:st={max(0.0, secs - 0.4):.2f}:d=0.4:alpha=1[lg]")
        g.append(f"[{last}][lg]overlay=0:0:enable='between(t,0,{secs:.2f})'[s{k}]")
        last, n, k = f's{k}', n + 1, k + 1
    if asp == '9x16' and cfg.get('strap'):
        st = cfg['strap']
        hit = find(ws, st['after']) if st.get('after') else (0, 0)
        t0 = ws[hit[0]]['s'] if hit else 0.3
        inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(st['png']))]
        g.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{t0:.2f},{t0 + st.get('seconds', 3.5):.2f})'[s{k}]")
        last, n, k = f's{k}', n + 1, k + 1
    g.append(f"[{last}]ass={cfg['name']}-{asp}.ass:fontsdir=fonts,fps=30,setsar=1,format=yuv420p[vm]")
    inputs += ['-i', str(end['file'])]
    g.append(f"[{n}:v]fps=30,setsar=1,format=yuv420p,trim=end_frame={end['frames']},setpts=PTS-STARTPTS[ev]")
    n += 1
    parts = ['[vm]', '[ev]']
    if intro:
        inputs += ['-i', str(intro['file'])]
        g.append(f"[{n}:v]fps=30,scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x0C1512,"
                 f"setsar=1,format=yuv420p,trim=end_frame={intro['frames']},setpts=PTS-STARTPTS[iv]")
        n += 1
        parts.insert(0, '[iv]')
    g.append(f'{"".join(parts)}concat=n={len(parts)}:v=1:a=0[V]')
    inputs += ['-i', str(mix)]
    return inputs, g, f'{n}:a'


def default_levels():
    """The ledger's levels, for a cut with no music (its loudness targets)."""
    try:
        return music.levels_of(music.load())
    except music.MusicError:
        return {'final_integrated_lufs': -14, 'tolerance_lu': 1, 'max_true_peak_dbtp': -1.0, 'bed_lufs': -31}


def cut_plan(cfg, asp, P, main_frames, ws):
    """What one shape's cut will be, before anything is rendered: its sting,
    its end card, its clock, its music and anything to say about them."""
    notes = []
    intro, note = resolve_intro(cfg, asp, P)
    notes += [note] if note else []
    end_file = P(cfg['endcard'][asp])
    end = {'file': end_file, **clip_info(end_file)}
    tl = timeline(intro['frames'] if intro else 0, main_frames, end['frames'], ws)
    bed, note = resolve_music(cfg, asp, tl['total_s'])
    notes += [note] if note else []
    if bed and bed['levels'].get('status') != 'approved':
        notes.append('the mix levels are still proposed until Krish approves them by ear (music.py approve-levels)')
    notes += length_warnings(asp, tl)
    return {'intro': intro, 'end': end, 'timeline': tl, 'bed': bed, 'warnings': notes}


def measure_cut(final, tl, cut_audio):
    """The finished file's loudness after the encode: integrated, true peak,
    each stretch (the sting, his voice, the end card after the bed has
    risen) and, from the two stems, how far the bed sits under his voice."""
    whole = music.ebur128(final)
    windows = (cut_audio['music'] or {}).get('windows') or {}
    I, M, T = tl['intro_s'], tl['main_s'], tl['total_s']
    voice = windows.get('voice') or ([tl['voice_start_s'], tl['voice_end_s']] if tl['voice_end_s'] - tl['voice_start_s'] >= music.MIN_WINDOW_S else None)
    intro = windows.get('intro') if cut_audio['music'] else ([0.0, I] if I >= music.MIN_WINDOW_S else None)
    outro = windows.get('outro') if cut_audio['music'] else ([I + M, T] if T - I - M >= music.MIN_WINDOW_S else None)
    at = lambda path, w: music.ebur128(path, *w)['I'] if w else None
    loud = {'integrated': whole['I'], 'true_peak': whole['TP'], 'lra': whole['LRA'],
            'intro_short_term': at(final, intro), 'voice_short_term': at(final, voice), 'outro_short_term': at(final, outro),
            'bed_to_voice_lu': None, 'windows': {'intro': intro, 'voice': voice, 'outro': outro},
            'normalisation': cut_audio['normalisation'], 'target': cut_audio['target']}
    if cut_audio['bed'] and voice:
        v, b = at(cut_audio['dialog'], voice), at(cut_audio['bed'], voice)
        if v is not None and b is not None:
            loud['bed_to_voice_lu'] = round(v - b, 1)
    return loud


def loudness_warnings(loud, levels):
    out = []
    target, tol = levels['final_integrated_lufs'], levels['tolerance_lu']
    if loud['integrated'] is None or abs(loud['integrated'] - target) > tol:
        out.append(f'integrated loudness {loud["integrated"]} LUFS is outside {target} +-{tol} LU')
    if loud['true_peak'] is not None and loud['true_peak'] > levels['max_true_peak_dbtp']:
        out.append(f'true peak {loud["true_peak"]} dBTP is over {levels["max_true_peak_dbtp"]} dBTP')
    if loud['bed_to_voice_lu'] is not None:
        want = target - levels['bed_lufs']
        if abs(loud['bed_to_voice_lu'] - want) > 2:
            out.append(f'the bed sits {loud["bed_to_voice_lu"]} LU under his voice, not about {want:g} LU')
    if loud['normalisation'] != 'linear':
        out.append('the final loudness pass could not be a plain gain, so the limited mix was kept without it')
    return out


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
    bike = [{'w': w, 's': n * 0.4, 'e': n * 0.4 + 0.3} for n, w in enumerate("made with bike dances, Alibaba's, XAI's.".split())]
    phrase = [{'w': w, 's': n * 0.4, 'e': n * 0.4 + 0.3} for n, w in enumerate('nobody is back to full year.'.split())]
    checks = [
        ('the false start and the um go', restart_cut(words, 170.0 + restart * 0.4), (7, restart - 1)),
        ('a time a little off still finds it', restart_cut(words, 170.0 + restart * 0.4 + 3), (7, restart - 1)),
        ('no repeat, no cut', restart_cut(words[:restart], 172.0), None),
        ('3:02 is 182 seconds', seconds('3:02'), 182.0),
        ('a stumble goes back to its first start', restart_cut(stumble, 172.0 + 19 * 0.4), (5, 18)),
        ('Bike Dance is ByteDance, owned and all', [x['w'] for x in tokens(bike, DEFAULT_FIXES)], ['Made', 'with', "ByteDance's,", "Alibaba's,", "xAI's."]),
        ('a phrase fix joins the words', [x['w'] for x in tokens(phrase, [['nobody is back to full', 'nobody has banked a full']])],
         ['Nobody has banked a full', 'year.']),
        ('found through resolve_removals', resolve_removals(words, [{'restart_near': 170.0 + restart * 0.4}]), [(7, restart - 1)]),
    ]
    # The intro, the bed and the clock (no media needed).
    ws = [{'w': 'Hello', 's': 0.1, 'e': 0.5}, {'w': 'there.', 's': 19.4, 'e': 19.84}]
    tl = timeline(45, 600, 120, ws)
    checks.append(('the clock: sting, main, end card, first and last word',
                   (tl['intro_s'], tl['main_s'], tl['outro_s'], tl['total_s'], tl['voice_start_s'], tl['voice_end_s']), (1.5, 20.0, 4.0, 25.5, 1.6, 21.34)))
    wins = [{'id': 'a', 's': 4.0, 'e': 6.0}]
    checks.append(('previews move on by the sting and add one in it', preview_shots(tl, wins),
                   [('intro', 1.05), ('00', 2.5), ('01', 6.5), ('02', 23.5)]))
    bare = timeline(0, 600, 120, ws)
    checks.append(('without a sting the previews are where they were', [t for _, t in preview_shots(bare, wins)], [1.0, 5.0, 22.0]))
    checks.append(('a tall cut over 90 s is flagged', (len(length_warnings('9x16', {'total_s': 91.2})), len(length_warnings('9x16', {'total_s': 89.9})),
                                                      len(length_warnings('16x9', {'total_s': 200.0}))), (1, 0, 0)))
    fake = {'name': 't', 'face': [100, 450], 'logo': {'png': 'logo.png'}, 'endcard': {'9x16': 'end.mp4'}}
    same = lambda p: Path(p)
    _, g, audio = video_graph(fake, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, [], ws, [720, 1280, 0, 0],
                              {'file': 'sting.mp4', 'frames': 45}, {'file': 'end.mp4', 'frames': 120}, Path('mix.wav'))
    pill = next(i for i, line in enumerate(g) if "overlay=0:0:enable='between(t,0,3.00)'" in line)
    main = next(i for i, line in enumerate(g) if line.startswith('[') and 'ass=t-9x16.ass' in line)
    checks.append(('the tall logo pill is unchanged and laid on the main, so it starts after the sting', pill < main, True))
    checks.append(('the sting goes first in the join, with no sound of its own in the picture graph', g[-1], '[iv][vm][ev]concat=n=3:v=1:a=0[V]'))
    checks.append(('the sound is the finished mix', audio, '4:a'))
    _, g, audio = video_graph(fake, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, [], ws, [720, 1280, 0, 0], None, {'file': 'end.mp4', 'frames': 120}, Path('mix.wav'))
    checks.append(('without a sting it is the main and the end card', (g[-1], audio), ('[vm][ev]concat=n=2:v=1:a=0[V]', '3:a')))
    got, why = resolve_intro({'name': 't'}, '9x16', same)
    checks.append(('a candidate sting is left out and the report says why', (got, 'candidate' in (why or '')), (None, sting.load()['status'] == 'candidate')))
    checks.append(('"intro": false is no intro and no note', resolve_intro({'intro': False}, '9x16', same), (None, None)))
    checks.append(('"music": false is no music and no note', resolve_music({'name': 't', 'music': False}, '9x16', 30), (None, None)))
    if not os.environ.get('MINDMAKE_MUSIC_LEDGER'):
        got, why = resolve_music({'name': 't'}, '9x16', 30)
        checks.append(('with no approved track the cut has voice only and says so', (got, 'voice only' in (why or '')), (None, True)))
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'quick-edit self-test passed: {len(checks)} checks')
    return 1 if bad else 0


def doctor(as_json=False):
    """Whether this machine can make a video: the tools, the Python modules,
    the music and archive folders, every approved track's file, the sting."""
    rows = []
    add = lambda name, state, detail: rows.append({'check': name, 'state': state, 'detail': detail})
    add('machine', 'ok', f'{platform.node()} ({platform.system()} {platform.release()}), Python {platform.python_version()}')
    if sys.version_info < (3, 10):
        add('python', 'fail', 'quick-edit needs Python 3.10 or later')
    if os.name == 'nt':
        try:
            task = subprocess.run(['schtasks', '/Query', '/TN', 'Mindmake Video Studio Runner', '/FO', 'CSV', '/NH'], capture_output=True, text=True, timeout=20)
            state = (task.stdout.strip().split(',')[-1].strip('"') if task.returncode == 0 else 'not installed')
            role = {'Ready': 'the active Studio machine', 'Running': 'the active Studio machine', 'Disabled': 'the standby Studio machine'}.get(state, 'not a Studio runner')
            add('studio runner task', 'ok', f'{state}: {role}. quick-edit renders on either machine; only the Studio queue needs the failover in docs/OPERATIONS.md')
        except (OSError, subprocess.SubprocessError) as e:
            add('studio runner task', 'warn', f'could not read it: {e}')
    for tool in ('ffmpeg', 'ffprobe'):
        path = shutil.which(tool)
        if not path:
            add(tool, 'fail', 'not on the PATH')
            continue
        first = subprocess.run([tool, '-version'], capture_output=True, text=True).stdout.splitlines()[:1]
        add(tool, 'ok', f'{first[0] if first else "unknown version"} ({path})')
    if shutil.which('ffmpeg'):
        listed = subprocess.run(['ffmpeg', '-hide_banner', '-filters'], capture_output=True, text=True).stdout
        have = {parts[1] for parts in (line.split() for line in listed.splitlines()) if len(parts) > 2}
        need = ('ass', 'overlay', 'concat', 'loudnorm', 'ebur128', 'amix', 'alimiter', 'volume', 'aloop', 'asetnsamples', 'acrossfade',
                'afade', 'apad', 'atrim', 'tpad', 'anullsrc')
        gone = [f for f in need if f not in have]
        add('ffmpeg filters', 'fail' if gone else 'ok', f'missing: {", ".join(gone)}' if gone else 'all the filters the edit and the mix use')
    fonts = sorted(p.name for p in (Path(__file__).resolve().parent / 'fonts').glob('*.ttf'))
    add('caption font', 'ok' if fonts else 'fail', ', '.join(fonts) or 'scripts/quick-edit/fonts has no .ttf')
    from importlib import metadata
    for module, dist, state, why in (('faster_whisper', 'faster-whisper', 'warn', 'transcribes the recording; without it give "words" in the config'),
                                     ('PIL', 'pillow', 'fail', 'Pillow draws the tall logo pill and the thumbnails'),
                                     ('playwright', 'playwright', 'warn', 'draws the graphics, end cards and thumbnails from HTML')):
        try:
            __import__(module)
            try:
                version = metadata.version(dist)
            except metadata.PackageNotFoundError:
                version = 'installed'
            add(module, 'ok', f'version {version}')
        except Exception as e:  # noqa: BLE001 any import failure is the answer
            add(module, state, f'not importable ({type(e).__name__}): {why}')
    add('node', 'ok' if shutil.which('node') else 'warn', shutil.which('node') or 'not on the PATH: the intro sting cannot be rendered here')
    for env, why in (('MINDMAKE_MUSIC_ROOT', 'the licensed music'), ('MINDMAKE_ARCHIVE_ROOT', 'the video archive')):
        value = os.environ.get(env)
        if not value:
            try:
                fallback = music.music_root(music.load()) if env == 'MINDMAKE_MUSIC_ROOT' else None
            except music.MusicError:
                fallback = None
            add(env, 'warn', f'not set ({why})' + (f'; using {fallback}' if fallback else ''))
        else:
            add(env, 'ok' if Path(value).is_dir() else 'warn', f'{value}' + ('' if Path(value).is_dir() else ': not reachable (is Google Drive running?)'))
    try:
        data = music.load()
        errors, warnings = music.check(data)
        add('music ledger', 'fail' if errors else 'ok', f'{music.ledger_path()}: {len(data["tracks"])} tracks, levels {data["levels"].get("status")}'
            + (f'; {"; ".join(errors)}' if errors else ''))
        root = music.music_root(data)
        for t in data['tracks']:
            if t.get('status') != 'approved':
                continue
            try:
                music.resolve(t, data)
                add(f'track {t["id"]}', 'ok', f'{t["file"]} sha256 {t["sha256"][:12]}... matches')
            except music.MusicError as e:
                add(f'track {t["id"]}', 'fail', str(e))
        if not any(t.get('status') == 'approved' for t in data['tracks']):
            add('music', 'warn', 'no approved track yet, so every cut has voice only' + (f' (music folder {root})' if root else ''))
    except music.MusicError as e:
        add('music ledger', 'fail', str(e))
    try:
        s = sting.status()
        ready = [shape for shape, r in s['renders'].items() if r['approved']]
        add('intro sting', 'ok' if s['status'] == 'approved' and len(ready) == 2 else 'warn',
            f'{s["status"]}; rendered here for {", ".join(ready) or "no shape"}' + ('' if s['status'] == 'approved' else '; cuts render without it until Krish approves it'))
    except (OSError, ValueError) as e:
        add('intro sting', 'warn', str(e))
    failed = [r for r in rows if r['state'] == 'fail']
    if as_json:
        print(json.dumps({'ready': not failed, 'checks': rows}, indent=1))
    else:
        for r in rows:
            print(f'{r["state"].upper() if r["state"] == "fail" else r["state"]:5} {r["check"]}: {r["detail"]}')
        print('ready to make a video' if not failed else f'not ready: {len(failed)} check(s) failed')
    return 1 if failed else 0


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    if sys.argv[1:2] == ['--doctor']:
        sys.exit(doctor('--json' in sys.argv[2:]))
    ap = argparse.ArgumentParser()
    ap.add_argument('config')
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', choices=['9x16', '16x9'])
    ap.add_argument('--plan', action='store_true', help='print the cuts, graphic windows, intro and music, render nothing')
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
    words = json.loads(wpath.read_text())['words'] if wpath.exists() else transcribe(src, wpath, cfg.get('model', 'small.en'), cfg.get('prompt') or (script_prompt(P(cfg['script'])) if cfg.get('script') else ''))

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
    aspects = [args.only] if args.only else ['9x16', '16x9']
    # The main's length in whole frames: every window is whole frames already.
    main_frames = sum(max(1, round((g['b'] - g['a']) * FPS)) for g in segs)
    if args.plan:
        toks = tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []))
        groups = chunks(toks, sorted({c['s'] for c in wins} | {c['e'] for c in wins}))
        shapes = {}
        for asp in aspects:
            try:
                plan = cut_plan(cfg, asp, P, main_frames, ws)
            except (KeyError, ValueError, OSError, subprocess.CalledProcessError) as e:
                shapes[asp] = {'error': f'cannot plan the {asp} cut: {e}'}
                continue
            tl = plan['timeline']
            shapes[asp] = {'intro': plan['intro'] and str(plan['intro']['file']), 'music': plan['bed'] and plan['bed']['track']['id'],
                           'intro_seconds': tl['intro_s'], 'main_seconds': tl['main_s'], 'outro_seconds': tl['outro_s'],
                           'total_seconds': tl['total_s'], 'warnings': plan['warnings']}
        print(json.dumps({'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
                          'cuts': [{'words': ' '.join(words[i]['w'].strip() for i in range(a, b + 1)), 'at': words[a]['s']} for a, b in cuts],
                          'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
                          'captions': len(groups), 'shapes': shapes,
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
    voice_in = float(loud['input_i'])
    toks = tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []))
    bounds = sorted({c['s'] for c in wins} | {c['e'] for c in wins})
    groups = chunks(toks, bounds)
    report = {'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
              'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
              'captions': len(groups), 'loudness_in': loud['input_i']}
    fonts = Path(__file__).resolve().parent / 'fonts'
    shapes = {}
    for asp in aspects:
        plan = cut_plan(cfg, asp, P, main_frames, ws)
        tl, intro, end, bed = plan['timeline'], plan['intro'], plan['end'], plan['bed']
        warnings = list(plan['warnings'])
        target = (bed['levels'] if bed else default_levels())['final_integrated_lufs']
        if voice_in <= -69.9:
            warnings.append('the recording measured as silence, so its level was left alone')
        voice_gain = 0.0 if voice_in <= -69.9 else max(-30.0, min(30.0, target - voice_in))
        cut_audio = build_audio(out / f'audio-{asp}', edited, voice_gain, intro, end, tl, bed)
        ass = out / f"{cfg['name']}-{asp}.ass"
        write_ass(ass, groups, wins, asp)
        inputs, g, audio_map = video_graph(cfg, asp, P, out, edited, total, wins, ws, cfg['crop'], intro, end, cut_audio['mix'])
        gfile = out / f'stage2-{asp}.graph'
        gfile.write_text(';\n'.join(g))
        final = out / f"{cfg['name']}-{asp}.mp4"
        # libass reads the captions and fonts relative to the working folder.
        fl = out / 'fonts'
        if not fl.exists():
            fl.mkdir()
            for f in fonts.glob('*.ttf'):
                (fl / f.name).write_bytes(f.read_bytes())
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-filter_complex_script', gfile.name, '-map', '[V]', '-map', audio_map,
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', final.name], cwd=out)
        report[f'{asp}_file'] = final.name
        levels = bed['levels'] if bed else default_levels()
        loudness = measure_cut(final, tl, cut_audio)
        warnings += loudness_warnings(loudness, levels)
        shapes[asp] = {
            'file': final.name, 'intro_seconds': tl['intro_s'], 'main_seconds': tl['main_s'], 'outro_seconds': tl['outro_s'],
            'total_seconds': tl['total_s'], 'voice_start_seconds': tl['voice_start_s'], 'voice_end_seconds': tl['voice_end_s'],
            'intro': intro and {'source': intro['source'], 'file': str(intro['file']), 'sha256': intro['sha256'], 'seconds': intro['seconds']},
            'music': cut_audio['music'], 'voice_gain_db': round(voice_gain, 2), 'loudness': loudness, 'warnings': warnings}
        if args.share_mib:
            report[f'{asp}_share'] = share_copy(final, out / 'share' / final.name, args.share_mib)
        # Preview: a frame in the sting, the opening, inside every graphic,
        # and the end card, all moved on by the sting's length.
        for label, t in preview_shots(tl, wins):
            run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', final.name, '-frames:v', '1', '-vf', 'scale=-2:640',
                 f'preview-{asp}-{label}.jpg'], quiet=True, cwd=out)
    report['shapes'] = shapes
    if len(shapes) == 1:
        # One shape per run is the house way (TWO_CUTS: each cut is its own
        # recording), so its timeline, music and loudness sit at the top.
        only = next(iter(shapes.values()))
        report.update({k: only[k] for k in ('intro_seconds', 'main_seconds', 'outro_seconds', 'total_seconds', 'intro', 'music', 'loudness')})
        report['warnings'] = list(only['warnings'])
    else:
        report['warnings'] = [f'{asp}: {w}' for asp, cut in shapes.items() for w in cut['warnings']]
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
    for w in report['warnings']:
        print(f'note: {w}', file=sys.stderr)
    if missing:
        print('MISSING CUES:', missing, file=sys.stderr)
    if archive_failed:
        sys.exit(f'archive: {archive_failed}')


if __name__ == '__main__':
    main()
