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
  4. Renders both shapes: the intro sting first (when Krish has approved it,
     in the colour of the piece's series), graphics in, captions timed to the
     words, the end card on the end. The sting's own sound is never mixed:
     its stretch is silence under the music bed.
  5. Mixes the sound: his voice, the licensed music bed under the whole
     video (high over the sting, low under his voice, higher over the end
     card), then one two-pass loudness pass on the final mix (-14 LUFS,
     true peak at most -1 dBTP), measured again after the encode.
  6. Writes preview frames at the sting and every graphic, and a report of
     what it did, the music it used and the loudness it measured.

Needs Python 3.10+, ffmpeg and ffprobe on the PATH, and for transcription
the pinned faster-whisper from requirements.lock.txt (`python -m pip install
--require-hashes -r requirements.lock.txt`; never an unpinned install, whose
newest pair cannot decode sound). Run from anywhere:

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
defaults to MINDMAKE_ARCHIVE_ROOT, the archive the Studio uses, else on
Windows runtime.archive_root in config/studio.json. README.md has the rest.

`--plan` also warns when the config has no cues but the post it was made
from has pictures (leaving out those Krish let go, in kit.py's
--allow-missing words), and the report and the plan show each cut's speech
(main_seconds) and the whole video (total_seconds): the 90 second check on
the short cut reads the figure TALL_CAP names.

The captions follow the script's spelling (house rule BRITISH_SPELLING): a
heard word that is the script's word spelt the US way ("check" where the
script says "cheque") is captioned as the script spells it, and the plan and
the report list each one under "spellings"; a US spelling no script word
covers is a warning. A number the transcriber split at its punctuation
("$150" and ",000", "70" and "%") is one caption word again.

Neither the sting's own sound nor the end card's is ever mixed: both
stretches are silence, with the music bed over them.
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
import spelling
import transcriber
from archive import ArchiveError, archive_root, archive_videos, plan as archive_plan, read_package
from share import share_copy

CREAM, INK, MINT = '&H00E4EFF4', '&H0012150C', '&H00C0F07E'
FPS, RATE = 30, 48000
SIZE = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
# The voice is set to the target before the mix, and the mix is limited this
# far under full scale (true peak, 4x oversampled) before the final loudness
# pass, so that pass is a plain gain and the AAC encode stays under -1 dBTP.
LIMIT_DBTP = -2.0
# House rule TWO_CUTS: the short cut runs at most 90 seconds. Krish has not
# yet ruled on whether those 90 seconds count the intro sting and the end
# card, so the check reads the one figure named here: 'main_s', his speech
# alone (the captioned main), which is what story_check's word budget (225
# words at 150 a minute) measures too. The report shows total_seconds, with
# the sting and the end card, either way. If he rules that the 90 seconds is
# the whole video, make 'measures' 'total_s'.
TALL_CAP = {'seconds': 90, 'measures': 'main_s'}
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
    """How a word is compared with the script and the config: lower case,
    letters, digits, % and $, and its British and US spellings folded into
    one (spelling.fold), so a cue that ends on "cheque to court" is found
    where the transcriber wrote "check to court"."""
    return spelling.fold(re.sub(r"[^a-z0-9%$]", '', t.lower()))


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
    """Each kept word with its time in the edited cut. `glue` is true for a
    word the transcriber wrote with no space before it (",000" after
    "$150"), which tokens() may join to the word before."""
    res = []
    for g in segs:
        for i in g['idx']:
            w = words[i]
            raw = str(w['w'])
            res.append({'w': raw.strip(), 's': round(g['off'] + w['s'] - g['a'], 3), 'e': round(g['off'] + w['e'] - g['a'], 3), 'src': i,
                        'glue': bool(raw) and not raw[0].isspace()})
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
    # Pictures close together share the screen without a gap: a gap of a
    # frame or two flashed the frame behind them (Krish, 2026-10-12: "the
    # title card flashes up for about 0.1s before the next card comes in.
    # this is unacceptable"). The next picture crossfades in over this one.
    for x, y in zip(found, found[1:]):
        if x['e'] > y['s'] or y['s'] - x['e'] < BRIDGE_S:
            x['e'] = y['s']
    return found, missing


# Two pictures less than this apart are bridged into one run on screen.
BRIDGE_S = 1.5
# How long every picture, and the speaker's move out of its way, takes to ease in or out.
FADE_S = 0.35


def runs_of(wins):
    """The windows as runs: pictures that follow each other with no gap
    between them are one stretch of the screen given to pictures."""
    out = []
    for c in wins:
        if out and c['s'] <= out[-1][-1]['e'] + 1e-6:
            out[-1].append(c)
        else:
            out.append([c])
    return out


def presence(wins, d=FADE_S):
    """An ffmpeg expression in t: 0 with no picture on screen, 1 with one,
    eased linearly over d at each run's start and end."""
    parts = [f"clip(min((t-{r[0]['s']})/{d},({r[-1]['e']}-t)/{d}),0,1)" for r in runs_of(wins)]
    return '+'.join(parts) or '0'


def panel_layers(wins, d=FADE_S):
    """[(window, fade filters, enable end)] for each picture: it fades in
    (over the one before it, when they touch, so the change is a crossfade)
    and fades out only when nothing follows it at once; a picture followed
    at once stays under the next one until that has fully faded in."""
    layers = []
    for i, c in enumerate(wins):
        nxt = wins[i + 1] if i + 1 < len(wins) else None
        followed = nxt is not None and nxt['s'] <= c['e'] + 1e-6
        f = f"fade=t=in:st={c['s']}:d={d}:alpha=1"
        end = c['e']
        if followed:
            end = round(c['e'] + d, 3)
        else:
            f += f",fade=t=out:st={max(c['s'], c['e'] - d):.3f}:d={d}:alpha=1"
        layers.append((c, f, end))
    return layers


# A piece of a word the transcriber starts on its own at a punctuation mark
# (faster-whisper's tokenizer splits words there): ",000" after "$150", ".4"
# after "$5", "%" after "70", "'s" after a name.
GLUE = re.compile(r"^(?:[.,]\d[\d.,]*|%|'(?:s|re|ve|ll|d|m|t)|n't)[.,!?;:]*$", re.I)


def joined(ws):
    """The words with the pieces the transcriber split off put back: a piece
    written with no space before it (retime's `glue`) that GLUE names joins
    the word before it, when nothing was cut between them, so the captions
    read "$150,000", "$5.4 billion" and "70%"."""
    out = []
    for w in ws:
        prev = out[-1] if out else None
        follows = prev is not None and (prev.get('src') is None or w.get('src') is None or w['src'] == prev['src'] + 1)
        number = re.match(r'^[.,%]', w['w']) and re.search(r'\d$', prev['w'] if prev else '')
        owner = w['w'][:1] in "'n" and re.search(r'[A-Za-z]$', prev['w'] if prev else '')
        if follows and w.get('glue') and GLUE.match(w['w']) and (number or owner):
            out[-1] = {**prev, 'w': prev['w'] + w['w'], 'e': w['e'], 'src': w.get('src', prev.get('src'))}
            continue
        out.append(dict(w))
    return out


def respell(heard, script):
    """The heard word in the script's spelling, keeping the heard word's
    punctuation and its capital."""
    lead, core, tail = re.match(r"^(\W*)(.*?)(\W*)$", heard).groups()
    want = re.match(r"^\W*(.*?)\W*$", script).group(1)
    if core[:1].isupper():
        want = want[:1].upper() + want[1:]
    elif core[:1].islower():
        want = want[:1].lower() + want[1:]
    return lead + want + tail


def script_words(cfg, P):
    """The words of the cut's script (the config's "script", which kit.py
    writes as the words he says), or [] when there is none."""
    if not cfg.get('script'):
        return []
    try:
        text = Path(P(cfg['script'])).read_text(encoding='utf-8-sig')
    except OSError:
        return []
    return [w for w in text.split() if norm(w)]


def spellings(ws, said):
    """{index in ws: the script's word} for every heard word that lines up
    with a script word spelt the other way: the transcriber's "check" where
    the script says "cheque", "neighbor" for "neighbour", "license" for the
    noun "licence". The script is the truth (house rule BRITISH_SPELLING),
    so the caption takes its spelling; the sounds are the same."""
    import difflib
    if not ws or not said:
        return {}
    heard, script = [norm(w['w']) for w in ws], [norm(w) for w in said]
    fixes = {}
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, heard, script, autojunk=False).get_opcodes():
        if tag != 'equal':
            continue
        for i, j in zip(range(i1, i2), range(j1, j2)):
            if spelling.variant(said[j], ws[i]['w']):
                fixes[i] = said[j]
    return fixes


def spelling_warnings(toks):
    """US spellings left in the captions (an ad-lib the script does not
    cover, or a script that spells it so): one warning naming them."""
    left = [f'"{t["w"]}" ({t["s"]:.1f} s)' for t in toks if spelling.looks_us(t['w'])]
    if not left:
        return []
    return [f'the captions read {len(left)} US spelling(s) no script word covers: {", ".join(left[:12])}'
            f'{" and more" if len(left) > 12 else ""}. Add a replacement for each (house rule BRITISH_SPELLING), '
            'unless it is a name or a quotation']


def tokens(ws, replacements, spell=None):
    """Words as caption tokens: the script's spellings (spellings()), the
    pieces the transcriber split off put back (joined()), brand names
    joined, fixes applied, sentence case restored after a cut."""
    ws = [dict(w, w=respell(w['w'], spell[i])) if spell and i in spell else w for i, w in enumerate(ws)]
    ws = joined(ws)
    out, i = [], 0
    while i < len(ws):
        hit = None
        for seq, name in BRAND:
            if [norm(w['w']) for w in ws[i:i + len(seq)]] == seq:
                tail = re.sub(r'^.*?([.,!?;:]*)$', r'\1', ws[i + len(seq) - 1]['w'])
                hit = ({'w': name + tail, 's': ws[i]['s'], 'e': ws[i + len(seq) - 1]['e'], 'src': ws[i + len(seq) - 1].get('src')}, len(seq))
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


def max_volume(path, start=None, length=None):
    """The loudest sample of a file's sound (or of a stretch of it) in dB,
    from ffmpeg's volumedetect; -inf for silence or no sound at all."""
    cut = (['-ss', f'{start}'] if start is not None else []) + (['-t', f'{length}'] if length is not None else [])
    said = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *cut, '-i', str(path), '-vn', '-af', 'volumedetect', '-f', 'null', '-'],
                          capture_output=True, text=True).stderr
    m = re.search(r'max_volume: (-?inf|-?[\d.]+) dB', said)
    return float('-inf') if not m or 'inf' in m.group(1) else float(m.group(1))


SILENT_DB = -90.0  # quieter than this is silence: a kit end card, or a house sting


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


def read_post(cfg, base):
    """The post.json the config was made from (kit.py names it), or None."""
    named = (cfg.get('kit') or {}).get('post') if isinstance(cfg.get('kit'), dict) else None
    named = named or cfg.get('post')
    if not isinstance(named, str) or not named.strip():
        return None, None
    path = Path(named)
    path = path if path.is_absolute() else (Path(base) / path)
    try:
        return path, json.loads(path.read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as e:
        return path, e


def series_of(cfg, base='.'):
    """The piece's series, for the sting's colour: (series, note). From the
    config's "series" (or "subchannel"), else the subchannel of the post it
    was made from; an unknown or missing one gets follow_the_money's."""
    given = cfg.get('series') or cfg.get('subchannel')
    if not given:
        _, post = read_post(cfg, base)
        given = post.get('subchannel') if isinstance(post, dict) else None
    found = sting.series_name(given)
    if found:
        return found, None
    if given:
        return sting.DEFAULT_SERIES, (f'the piece\'s series {given!r} is none of {", ".join(sting.SERIES)}, '
                                      f'so the sting is in {sting.DEFAULT_SERIES}\'s colour')
    return sting.DEFAULT_SERIES, f'the config names no "series" (nor a post with a subchannel), so the sting is in {sting.DEFAULT_SERIES}\'s colour'


def intro_override(cfg):
    """Krish's own words letting a clip that is not the approved house sting
    open the cut, or None. Like "thumbnail_override", they start with his name."""
    words = cfg.get('intro_override')
    return words.strip() if isinstance(words, str) and words.strip().lower().startswith('krish') else None


def resolve_intro(cfg, asp, P, base='.'):
    """The sting in front of this cut: (intro, note). intro is None when the
    cut has none, and note says why. The config's "intro" is "auto" (the
    house sting once Krish has approved it, config/intro-sting.json, in the
    colour of the piece's series), false, or {"9x16": file, "16x9": file}.
    A file named in the config is used only when it is the approved house
    render for this shape and series (the same sha256), or when the config
    carries Krish's own words in "intro_override". Its own sound is never
    used: make.py lays silence under it. A sting problem never stops a render."""
    want = cfg.get('intro', 'auto')
    if want is False or want is None:
        return None, None
    series, series_note = series_of(cfg, base)
    notes = []
    if want == 'auto':
        path, why = sting.sting_for(asp, series=series)
        if not path:
            return None, why
        source = 'house'
    elif isinstance(want, dict):
        if not want.get(asp):
            return None, f'the config\'s "intro" names no {asp} file, so this cut has no intro'
        path = P(want[asp])
        if not path.is_file():
            return None, f'the intro file {path} is missing, so this cut has no intro'
        house, why = sting.sting_for(asp, render_missing=False, series=series)
        override = intro_override(cfg)
        if house and sha256_file(house) == sha256_file(path):
            source = 'house'
        elif override:
            source = 'override'
            notes.append(f'the intro is a file named in the config, not the approved house sting, used on Krish\'s words in "intro_override": "{override}"')
        else:
            return None, (f'the intro file {path.name} named in the config is not the approved house sting for {asp} {series}, so this cut has no intro. '
                          'Only the approved sting, or Krish\'s own words in "intro_override", puts a clip there'
                          + (f' (the house sting: {why.replace(", so this cut has no intro", "")})' if why else ''))
    else:
        return None, '"intro" in the config is "auto", false or {"9x16": file, "16x9": file}; this cut has no intro'
    try:
        info = clip_info(path)
    except (ValueError, subprocess.CalledProcessError, KeyError) as e:
        return None, f'the intro {path} could not be read ({e}), so this cut has no intro'
    lo, hi = sting.SECONDS
    if source == 'override':
        # A story intro (house rule STORY_INTRO_OUTRO) runs longer than the
        # 1 to 2 s sting: up to STORY_INTRO_MAX_S, on Krish's words.
        lo, hi = sting.SECONDS[0], STORY_INTRO_MAX_S
    if not lo - 0.5 / FPS <= info['seconds'] <= hi + 0.5 / FPS:
        return None, f'the intro {path.name} runs {info["seconds"]} s, outside {lo} to {hi} s, so this cut has no intro'
    if source == 'house' and series_note:
        notes.append(series_note)
    if info['audio'] and source != 'house':
        # The house sting's track is silent by construction (intro.finish);
        # any other clip's sound is named, since it is dropped.
        notes.append(f'the intro {path.name} has a sound track of its own; it is replaced with silence, under the music bed')
    return ({'file': path, 'source': source, 'series': series if source == 'house' else None, 'sha256': sha256_file(path),
             'own_sound_replaced': info['audio'], **info}, '; '.join(notes) or None)


def piece_key(cfg):
    """What ties both cuts of one piece to the same music."""
    return str(cfg.get('piece_id') or cfg.get('piece') or cfg.get('subject') or cfg['name'])


# The story intro and outro (house rule STORY_INTRO_OUTRO,
# config/story-intro-outro.json): the longest each may run.
STORY_INTRO_MAX_S = 5.0
STORY_OUTRO_MAX_S = 6.0
# What a cut adds to its recording at most: the longest intro and end card.
CUT_EXTRA_S = max(sting.SECONDS[1], STORY_INTRO_MAX_S) + STORY_OUTRO_MAX_S


def piece_seconds(cfg, base='.'):
    """(seconds, how): how much music the piece needs, the same for both its
    cuts. The config's "music_seconds" when it gives one; else the long cut's
    recording (the longer cut, house rule TWO_CUTS), as kit.py measured it in
    kit.json beside the config, plus the most a sting and the end card add;
    else (None, why), and music.py asks for PIECE_SECONDS."""
    given = cfg.get('music_seconds')
    if isinstance(given, (int, float)) and given > 0:
        return float(given), 'the config\'s "music_seconds"'
    if not isinstance(cfg.get('kit'), dict):
        return None, 'the config was not made by kit.py, so the long cut\'s length is not known'
    try:
        cuts = json.loads((Path(base) / 'kit.json').read_text(encoding='utf-8')).get('cuts') or {}
    except (OSError, ValueError):
        return None, 'there is no kit.json beside the config, so the long cut\'s length is not known'
    made = {cut: (cuts.get(cut) or {}).get('recording_seconds') for cut in ('long', 'short')}
    made = {cut: float(x) for cut, x in made.items() if isinstance(x, (int, float)) and x > 0}
    if 'long' not in made:
        return None, 'the long cut\'s kit is not made yet (kit.py --cut long), so its length is not known'
    return round(max(made.values()) + CUT_EXTRA_S, 3), 'the long cut\'s recording, as kit.py measured it'


def resolve_music(cfg, asp, seconds, base='.'):
    """The bed under this cut: (bed, note). The config's "music" is "auto"
    (music.py's pick for this piece among the approved, licensed tracks),
    false, or a track id. Only a track in the ledger with Krish's approval
    and a licence for every place this cut is posted is ever used."""
    want = cfg.get('music', 'auto')
    if want is False or want is None:
        return None, None
    notes = []
    try:
        data = music.load()
        platforms = music.SHAPE_PLATFORMS[asp]
        if want == 'auto':
            # Both cuts of the piece ask with the piece's needs (the long cut's
            # length, from kit.json), so both get the same track.
            longest, how = piece_seconds(cfg, base)
            track, skipped, needs = music.pick_for_piece(piece_key(cfg), seconds, data, longest=longest)
            needs_from = how if longest else f'{how}; asked for {music.PIECE_SECONDS:g} s'
            if not track:
                passed = '; '.join(f'{k}: {", ".join(v)}' for k, v in skipped.items())
                return None, ('no approved licensed track can go under this piece\'s cuts, so this one has voice only'
                              + (f' (passed over: {passed})' if passed else ' (the music ledger has no tracks yet)'))
            usual = longest if longest else music.PIECE_SECONDS
            if seconds > usual + 0.001:
                notes.append(f'this cut runs {seconds:.1f} s, longer than the {usual:.1f} s the piece\'s music is chosen for ({needs_from}), '
                             'so its track may differ from the other cut\'s')
        elif isinstance(want, str):
            track = music.by_id(want, data)
            why = music.problems(track, platforms, None, seconds)
            if why:
                return None, f'the track {want} cannot go under this cut ({"; ".join(why)}), so it has voice only'
            needs = {'seconds': round(seconds, 3), 'platforms': list(platforms)}
            needs_from = 'the track the config names, for this cut alone'
        else:
            return None, '"music" in the config is "auto", false or a track id; this cut has voice only'
        path = music.resolve(track, data)
        levels = dict(music.levels_of(data))
    except music.MusicError as e:
        return None, f'the music could not be used ({e}), so this cut has voice only'
    ledger = music.ledger_path()
    if ledger.resolve() != music.LEDGER.resolve():
        notes.append(f'the music came from {ledger}, not config/music-library.json')
    return {'track': track, 'file': path, 'levels': levels, 'ledger': str(ledger), 'needs': needs, 'needs_from': needs_from}, '; '.join(notes) or None


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
    """The 90 second check on the tall (short) cut, on the figure TALL_CAP names."""
    cap, measures = TALL_CAP['seconds'], TALL_CAP['measures']
    if asp != '9x16' or tl[measures] <= cap:
        return []
    if measures == 'main_s':
        return [f'the tall cut\'s speech runs {tl["main_s"]:.1f} s (main_seconds, his words alone), over the {cap} s cap for the short cut '
                f'(house rule TWO_CUTS); with the sting and the end card the whole video runs {tl["total_s"]:.1f} s (total_seconds)']
    return [f'the whole tall cut runs {tl["total_s"]:.1f} s (total_seconds, with the sting and the end card), over the {cap} s cap '
            f'for the short cut (house rule TWO_CUTS); his speech alone runs {tl["main_s"]:.1f} s (main_seconds)']


def let_through(cfg):
    """(Krish's words, the picture files they let this cut go without), from
    kit.py --allow-missing, which writes them into the config's kit block."""
    kit = cfg.get('kit') if isinstance(cfg.get('kit'), dict) else {}
    allowed = kit.get('allow_missing') if isinstance(kit.get('allow_missing'), dict) else {}
    words = allowed.get('words') if isinstance(allowed.get('words'), str) and allowed['words'].strip().lower().startswith('krish') else None
    files = {Path(str(x.get('file') or '')).name for x in allowed.get('pictures') or [] if isinstance(x, dict)} if words else set()
    return words, files - {''}


def picture_warnings(cfg, base='.'):
    """A config with no cues whose post has pictures would go out as a bare
    talking head, against VISUAL_EVIDENCE: say so before anything renders.
    The pictures Krish let the cut go without (kit.py --allow-missing, his
    words in the config's kit block) are left out, and his words quoted."""
    if cfg.get('cues'):
        return []
    path, post = read_post(cfg, base)
    if path is None:
        return []
    if not isinstance(post, dict):
        return [f'the config has no cues and its post {path} could not be read ({post}), so nobody has checked it has no pictures']
    pics = [Path(e['file']).name for e in post.get('files') or [] if isinstance(e, dict) and e.get('kind') == 'image' and e.get('file')]
    words, allowed = let_through(cfg)
    gone = [p for p in pics if p in allowed]
    pics = [p for p in pics if p not in allowed]
    said = [f'this cut goes without {", ".join(gone)}, as Krish said: "{words}"'] if gone else []
    if not pics:
        return said
    return said + [f'the config has no cues, but its post has {len(pics)} picture(s) ({", ".join(pics)}), so this cut would go out as a bare '
                   'talking head: find each picture (kit.py --files) and make the kit again, or add the cues by hand']


def ffmpeg(*args, cwd=None):
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *args], quiet=True, cwd=cwd)


def build_audio(work, edited, voice_gain, intro, end, tl, bed):
    """The cut's sound as three files in `work`: dialog.wav (the sting's
    silence, his voice set to the target, the end card's silence), bed.wav
    (the music under the whole cut, or none), and mix.wav, the final mix.
    Neither the sting's nor the end card's own sound is ever mixed. Returns
    what the report needs."""
    work.mkdir(parents=True, exist_ok=True)
    smp = {k: round(tl[k] * RATE) for k in ('intro_s', 'main_s', 'outro_s', 'total_s')}
    inputs, g, labels = ['-i', str(edited)], [], []
    if intro:
        # The sting's own sound, if it has any, is never mixed: its stretch
        # is silence here, and the music bed is up over it.
        g.append(f'anullsrc=r={RATE}:cl=stereo,{NORM},atrim=end_sample={smp["intro_s"]},asetpts=PTS-STARTPTS[ia]')
        labels.append('[ia]')
    g.append(f'[0:a]{NORM},highpass=f=70,volume={voice_gain:.3f}dB,apad,atrim=end_sample={smp["main_s"]},asetpts=PTS-STARTPTS[va]')
    labels.append('[va]')
    # The end card's own sound, like the sting's, is never mixed: its stretch
    # is silence here, and the music bed rises over it. Only a ledger track
    # goes under a cut (house rule MUSIC_BED).
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
            'placement': how, 'start_s': float(track.get('intro_cue_s') or 0), 'chosen_for': bed.get('needs'),
            'chosen_for_from': bed.get('needs_from')})
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
        nr = len(runs_of(wins))
        g.append(f'[0:v]split={1 + max(nr, 1)}[sp]' + ''.join(f'[fcs{i}]' for i in range(max(nr, 1))))
        g.append(f"[sp]scale=1080:{round(ch * 1080 / cw)}:flags=lanczos,crop=1080:1920,unsharp=5:5:0.6[s1]")
        for i in range(max(nr, 1)):
            g.append(f"[fcs{i}]crop={cw}:{fh}:0:{fy},scale={fw_out}:920:flags=lanczos,unsharp=5:5:0.5[fc{i}]")
        if not nr:
            g.append('[fc0]nullsink')
        last = 's1'
        px, py = 0, 0
    else:
        inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(cfg['frame16']))]
        fr = n
        n += 1
        sw = round(cw * 1080 / ch)
        g.append(f"[0:v]scale={sw}:1080:flags=lanczos,unsharp=5:5:0.4[spk]")
        g.append(f"[{fr}:v]format=rgba[fr]")
        # The speaker eases aside as a picture comes in, and back as it goes.
        g.append(f"[fr][spk]overlay=x='{(1920 - sw) // 2}*(1-min(1,{presence(wins)}))':y=0:eval=frame[s1]")
        last = 's1'
        px, py = sw, 0
    k = 2
    if asp == '9x16':
        # Tall: each run of pictures is one layer (the ink panel, his face
        # below, the pictures above) that fades in over the full-frame
        # speaker and out again; inside a run the pictures crossfade.
        for r_i, run in enumerate(runs_of(wins)):
            rs, re_ = run[0]['s'], run[-1]['e']
            g.append(f"color=c=0x0C151200:s=1080x1920:r=30:d={total:.3f},format=rgba,"
                     f"drawbox=x=0:y=1000:w=1080:h=920:color=0x0C1512@1:t=fill[cv{r_i}]")
            g.append(f"[fc{r_i}]format=rgba[fa{r_i}]")
            g.append(f"[cv{r_i}][fa{r_i}]overlay=x={(1080 - fw_out) // 2}:y=1000[c{r_i}_0]")
            cur = f'c{r_i}_0'
            layers = panel_layers(run)
            for j, (c, f, stop) in enumerate(layers):
                inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(c['panel'].replace('{aspect}', asp)))]
                if j == 0:
                    f = f.split(',', 1)[1] if ',' in f else 'null'   # the layer itself fades in
                if j == len(layers) - 1:
                    f = ','.join(x for x in f.split(',') if not x.startswith('fade=t=out')) or 'null'
                g.append(f"[{n}:v]format=rgba,{f}[pp{n}]")
                g.append(f"[{cur}][pp{n}]overlay=0:0:enable='between(t,{c['s']},{stop})'[c{r_i}_{j + 1}]")
                cur, n = f'c{r_i}_{j + 1}', n + 1
            g.append(f"[{cur}]fade=t=in:st={rs}:d={FADE_S}:alpha=1,fade=t=out:st={max(rs, re_ - FADE_S):.3f}:d={FADE_S}:alpha=1[run{r_i}]")
            g.append(f"[{last}][run{r_i}]overlay=0:0:enable='between(t,{rs},{re_})'[s{k}]")
            last, k = f's{k}', k + 1
    else:
        for c, f, stop in panel_layers(wins):
            inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', str(P(c['panel'].replace('{aspect}', asp)))]
            g.append(f"[{n}:v]format=rgba,{f}[pp{n}]")
            g.append(f"[{last}][pp{n}]overlay=x={px}:y={py}:enable='between(t,{c['s']},{stop})'[s{k}]")
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


def cut_plan(cfg, asp, P, main_frames, ws, base='.'):
    """What one shape's cut will be, before anything is rendered: its sting,
    its end card, its clock, its music and anything to say about them."""
    notes = []
    intro, note = resolve_intro(cfg, asp, P, base)
    notes += [note] if note else []
    end_file = P(cfg['endcard'][asp])
    end = {'file': end_file, **clip_info(end_file)}
    end['own_sound'] = bool(end['audio']) and max_volume(end_file) > SILENT_DB
    if end['own_sound']:
        notes.append(f'the end card {end_file.name} has a sound track of its own; it is replaced with silence, under the music bed '
                     '(only a track in the music ledger goes under a cut, house rule MUSIC_BED)')
    tl = timeline(intro['frames'] if intro else 0, main_frames, end['frames'], ws)
    bed, note = resolve_music(cfg, asp, tl['total_s'], base)
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
    # The 90 s check reads his speech until Krish rules: Monday's 219-word
    # short script is 87.6 s of speech and 93.1 s with the sting and end card.
    checks.append(('the 90 s cap is on his speech, in one named constant', TALL_CAP, {'seconds': 90, 'measures': 'main_s'}))
    checks.append(('a tall cut whose speech runs over 90 s is flagged; one under it is not, whatever its total',
                   (len(length_warnings('9x16', {'main_s': 91.2, 'total_s': 96.7})), len(length_warnings('9x16', {'main_s': 87.6, 'total_s': 93.1})),
                    len(length_warnings('16x9', {'main_s': 200.0, 'total_s': 205.5}))), (1, 0, 0)))
    said_over = length_warnings('9x16', {'main_s': 91.2, 'total_s': 96.7})[0]
    checks.append(('the warning says which figure it is and gives the whole video too',
                   ('main_seconds' in said_over, 'total_seconds' in said_over, '96.7' in said_over), (True, True, True)))
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
    checks += caption_self_test()
    checks += gate_self_test()
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'quick-edit self-test passed: {len(checks)} checks')
    return 1 if bad else 0


def caption_self_test():
    """The captions: numbers the transcriber split put back together, the
    script's spellings, cue words found across the two spellings, and the
    warning for a US spelling nothing covers. No media needed."""
    checks = []

    def heard(*raw, cut_after=None):
        """Words as faster-whisper writes them (a leading space on most), through retime."""
        words = [{'w': w, 's': n * 0.4, 'e': n * 0.4 + 0.3} for n, w in enumerate(raw)]
        idx = [i for i in range(len(words)) if cut_after is None or i != cut_after + 1]
        return retime(words, [{'a': 0.0, 'off': 0.0, 'idx': idx}])
    said = lambda ws, spell=None: [t['w'] for t in tokens(ws, DEFAULT_FIXES, spell)]
    checks.append(('"$150" and ",000" are one caption word, "$150,000"', said(heard(' $150', ',000', ' a', ' work')), ['$150,000', 'a', 'work']))
    checks.append(('"70" and "%" are "70%", the full stop kept', said(heard(' 70', '%', ' sure.')), ['70%', 'sure.']))
    checks.append(('"$5" and ".4" are "$5.4", and a name keeps its \'s', said(heard(' Suno', "'s", ' $5', '.4', ' billion')),
                   ["Suno's", '$5.4', 'billion']))
    joined_ws = joined(heard(' 60', ',202', ' recordings'))
    checks.append(('the joined word runs from the first piece\'s start to the second\'s end', (joined_ws[0]['w'], joined_ws[0]['s'], joined_ws[0]['e']),
                   ('60,202', 0.0, 0.7)))
    checks.append(('a piece with a space before it, or with a cut between, stays apart',
                   (said(heard(' 70', ' %')), said(heard(' 70', ' and', '%', ' sure'), )), (['70', '%'], ['70', 'and', '%', 'sure'])))
    checks.append(('nothing cut between is checked by the source word', said(heard(' $150', ' more', ',000', cut_after=0)), ['$150', ',000']))
    chunked = chunks(tokens(heard(' Warner', ' sued', ' over', ' 60', ',202', ' recordings', ' and', ' Suno', ' is', ' worth', ' $2', '.45', ' billion.'),
                            DEFAULT_FIXES), [])
    checks.append(('a joined number never splits across two caption groups',
                   any(t['w'] in ('60,202', '$2.45') for g in chunked for t in g) and not any(t['w'] in (',202', '.45') for g in chunked for t in g), True))
    # The script's spellings (house rule BRITISH_SPELLING).
    ws = heard(' Bring', ' your', ' check', ' to', ' court,', ' one', ' neighbor', ' says,', ' and', ' a', ' license', ' can', ' become', ' evidence.')
    script = 'Bring your cheque to court, one neighbour says, and a licence can become evidence.'.split()
    spell = spellings(ws, script)
    checks.append(('heard US spellings line up with the script\'s British ones', sorted(spell.values()), sorted(['cheque', 'neighbour', 'licence'])))
    checks.append(('the captions take the script\'s spelling, punctuation and capitals kept', said(ws, spell)[2:7],
                   ['cheque', 'to', 'court,', 'one', 'neighbour']))
    checks.append(('a cue ending on "cheque to court" is found where the transcriber wrote "check to court"', find(ws, 'cheque to court') is not None, True))
    checks.append(('nothing to fix where the script says what was heard', spellings(ws, [w['w'] for w in ws]), {}))
    loose = spelling_warnings(tokens(heard(' the', ' color', ' of', ' money'), DEFAULT_FIXES))
    checks.append(('a US spelling no script word covers is one warning naming it', (len(loose), '"color"' in ' '.join(loose)), (1, True)))
    checks.append(('a replacement in the config clears it', spelling_warnings(tokens(heard(' the', ' color'), DEFAULT_FIXES + [['color', 'colour']])), []))
    return checks


# How to install the transcriber, and the check that it decodes sound:
# transcriber.py, which recording_match.py's check asks too.
TRANSCRIBER_FIX = transcriber.FIX
transcriber_decodes = transcriber.decodes

# The Python modules --doctor checks: (module, distribution, state when it
# cannot be imported, what it is for). faster_whisper is a fail: kit.py's
# configs carry no "words", so make.py transcribes every take, and
# recording_match.py hears each take with it. It must also decode sound
# (transcriber_decodes), not only import.
DOCTOR_MODULES = (
    ('faster_whisper', 'faster-whisper', 'fail', f'transcribes every take (make.py and recording_match.py): {TRANSCRIBER_FIX}'),
    ('PIL', 'pillow', 'fail', 'Pillow draws the tall logo pill and the thumbnails'),
    ('playwright', 'playwright', 'warn', 'draws the graphics, end cards and thumbnails from HTML'),
)


def gate_self_test():
    """The sting's series, the gate on a config-named intro, its sound never
    mixed, the pictures warning and the doctor's transcriber rule, on small
    synthetic files under .cache."""
    checks = []
    work = Path(__file__).resolve().parents[2] / '.cache' / 'quick-edit' / 'self-test' / 'make'
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    checks.append(('the series from the config, in any spelling',
                   [series_of({'series': 'mind.the.gap'})[0], series_of({'subchannel': 'Under the hood'})[0], series_of({'series': 'follow_the_money'})],
                   ['mind_the_gap', 'under_the_hood', ('follow_the_money', None)]))
    post = work / 'post.json'
    post.write_text(json.dumps({'subchannel': 'mind.the.gap', 'files': [{'kind': 'image', 'file': 'pileup.png'}, {'kind': 'video-script', 'file': 'script.md'}]}))
    checks.append(('else from the post the kit was made from', series_of({'kit': {'post': str(post)}})[0], 'mind_the_gap'))
    plain, why = series_of({})
    checks.append(('no series at all is follow_the_money, and says so', (plain, 'no "series"' in (why or '')), ('follow_the_money', True)))
    checks.append(('an unknown series falls back to follow_the_money too', series_of({'series': 'built_with_ai'})[0], 'follow_the_money'))
    said = picture_warnings({'cues': [], 'kit': {'post': str(post)}})
    checks.append(('no cues while the post has pictures is a warning that names them', (len(said), 'pileup.png' in ' '.join(said)), (1, True)))
    checks.append(('cues, or a post with no pictures, is no warning',
                   (picture_warnings({'cues': [{'id': 'a'}], 'kit': {'post': str(post)}}), picture_warnings({'cues': []})), ([], [])))
    checks.append(('a missing faster_whisper fails --doctor', next(state for module, _, state, _ in DOCTOR_MODULES if module == 'faster_whisper'), 'fail'))
    checks.append(('the doctor\'s fix is the pinned set, never an unpinned install',
                   ('--require-hashes -r requirements.lock.txt' in TRANSCRIBER_FIX, 'never an unpinned' in TRANSCRIBER_FIX), (True, True)))
    import importlib.util
    if importlib.util.find_spec('faster_whisper') is None:
        checks.append(('without faster_whisper the decode check fails and names the pinned set',
                       (transcriber_decodes()[0], 'requirements.lock.txt' in transcriber_decodes()[1]), (False, True)))
    allowed = {'cues': [], 'kit': {'post': str(post), 'allow_missing': {'words': 'Krish, 2026-10-12: a self-test stand-in, not his words',
                                                                        'pictures': [{'id': 'pileup', 'file': 'pileup.png', 'name': None}]}}}
    said_allowed = picture_warnings(allowed)
    checks.append(('pictures Krish let go are not a warning to go back for; his words are quoted',
                   (len(said_allowed), 'as Krish said' in said_allowed[0], 'bare' in ' '.join(said_allowed)), (1, True, False)))
    not_his = dict(allowed, kit=dict(allowed['kit'], allow_missing={'words': 'fine', 'pictures': [{'file': 'pileup.png'}]}))
    checks.append(('words that are not Krish\'s let nothing go', any('bare' in w for w in picture_warnings(not_his)), True))
    (work / 'kit.json').write_text(json.dumps({'cuts': {'long': {'recording_seconds': 185.2}, 'short': {'recording_seconds': 88.0}}}))
    checks.append(('the piece\'s music length: the long cut\'s recording plus the most a sting and end card add, for both cuts',
                   (piece_seconds({'kit': {}}, work), piece_seconds({'kit': {}, 'music_seconds': 200}, work)[0], piece_seconds({}, work)[0]),
                   ((round(185.2 + CUT_EXTRA_S, 3), 'the long cut\'s recording, as kit.py measured it'), 200.0, None)))
    (work / 'kit.json').write_text(json.dumps({'cuts': {'short': {'recording_seconds': 88.0}}}))
    checks.append(('with only the short cut\'s kit made, it is not known (music.py then asks for its floor)', piece_seconds({'kit': {}}, work)[0], None))
    # A sting with a loud tone on it, a voice, an end card.
    ff = lambda *a: subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *map(str, a)], check=True)
    loud = work / 'loud-sting.mp4'
    ff('-f', 'lavfi', '-i', 'color=c=0xB7A6FF:s=108x192:r=30:d=1.5', '-f', 'lavfi', '-i', 'sine=f=1000:d=1.5:r=48000',
       '-filter_complex', '[1:a]volume=0.9,aformat=channel_layouts=stereo[a]', '-map', '0:v', '-map', '[a]',
       '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', loud)
    other = work / 'other-sting.mp4'
    ff('-f', 'lavfi', '-i', 'color=c=0x7EF0C0:s=108x192:r=30:d=1.5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', other)
    voice = work / 'voice.wav'
    ff('-f', 'lavfi', '-i', 'sine=f=220:d=3:r=48000', '-af', 'volume=0.3', '-ac', '1', voice)
    end = work / 'end.mp4'
    ff('-f', 'lavfi', '-i', 'color=c=0x0C1512:s=108x192:r=30:d=1', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '1',
       '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', end)
    here = lambda q: work / q
    named = {'name': 't', 'intro': {'9x16': loud.name}}
    got, why = resolve_intro(named, '9x16', here)
    checks.append(('a config-named intro with no approved sting and no words from Krish is left out', (got, 'intro_override' in (why or '')), (None, True)))
    got, why = resolve_intro(dict(named, intro_override='use it, said someone'), '9x16', here)
    checks.append(('an intro_override that does not start with Krish\'s words lets nothing through', got, None))
    words = 'Krish (a self-test stand-in, not his words): open with this clip'
    got, why = resolve_intro(dict(named, intro_override=words), '9x16', here)
    checks.append(('Krish\'s words in intro_override let it through, and the report quotes them',
                   (got and got['source'], words in (why or ''), got and got['own_sound_replaced']), ('override', True, True)))
    real = sting.sting_for
    try:
        sting.sting_for = lambda shape, *a, **k: (loud, None)
        got, why = resolve_intro(named, '9x16', here)
        checks.append(('a config-named file that is the approved house render is used', got and (got['source'], got['series']), ('house', 'follow_the_money')))
        sting.sting_for = lambda shape, *a, **k: (other, None)
        got, why = resolve_intro(named, '9x16', here)
        checks.append(('one that is not, is not', (got, 'not the approved house sting' in (why or '')), (None, True)))
    finally:
        sting.sting_for = real
    # The sting's own tone is never mixed: its stretch is silence.
    intro = {'file': loud, **clip_info(loud)}
    words_at = [{'w': 'one', 's': 0.1, 'e': 0.6}, {'w': 'two', 's': 2.2, 'e': 2.8}]
    tl = timeline(intro['frames'], 90, 30, words_at)
    made = build_audio(work / 'audio', voice, 0.0, intro, {'file': end, **clip_info(end)}, tl, None)

    def peak(path, start, length):
        said = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-ss', f'{start}', '-t', f'{length}', '-i', str(path), '-af', 'volumedetect',
                               '-f', 'null', '-'], capture_output=True, text=True).stderr
        m = re.search(r'max_volume: (-?inf|-?[\d.]+) dB', said)
        return float('-inf') if not m or 'inf' in m.group(1) else float(m.group(1))
    checks.append(('the sting\'s loud tone is not in the dialogue or the mix: its stretch is silence',
                   (peak(made['dialog'], 0, 1.45) <= -90, peak(made['mix'], 0, 1.45) <= -90), (True, True)))
    checks.append(('and his voice is there after it', peak(made['dialog'], 1.6, 2.5) > -40, True))
    # An end card with a tone of its own: its sound is never mixed either.
    loud_end = work / 'loud-end.mp4'
    ff('-f', 'lavfi', '-i', 'color=c=0x0C1512:s=108x192:r=30:d=1', '-f', 'lavfi', '-i', 'sine=f=1000:d=1:r=48000',
       '-filter_complex', '[1:a]volume=0.9,aformat=channel_layouts=stereo[a]', '-map', '0:v', '-map', '[a]',
       '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', loud_end)
    noisy = build_audio(work / 'audio-end', voice, 0.0, None, {'file': loud_end, **clip_info(loud_end)}, timeline(0, 90, 30, words_at), None)
    checks.append(('the end card\'s own tone is not in the dialogue or the mix: its stretch is silence',
                   (peak(noisy['dialog'], 3.05, 0.9) <= -90, peak(noisy['mix'], 3.05, 0.9) <= -90), (True, True)))
    checks.append(('max_volume tells a sounding end card from a silent one', (max_volume(loud_end) > SILENT_DB, max_volume(end) > SILENT_DB), (True, False)))
    plan = cut_plan({'name': 't', 'intro': False, 'music': False, 'endcard': {'9x16': loud_end.name}}, '9x16', here, 90, words_at, work)
    checks.append(('the plan says the end card\'s own sound is replaced', any('end card' in w and 'replaced with silence' in w for w in plan['warnings']), True))
    return checks


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
    for module, dist, state, why in DOCTOR_MODULES:
        try:
            __import__(module)
            try:
                version = metadata.version(dist)
            except metadata.PackageNotFoundError:
                version = 'installed'
            add(module, 'ok', f'version {version}')
        except Exception as e:  # noqa: BLE001 any import failure is the answer
            add(module, state, f'not importable ({type(e).__name__}): {why}')
            continue
        if module == 'faster_whisper':
            ok, detail = transcriber_decodes()
            add('faster_whisper decode', 'ok' if ok else 'fail', detail)
    add('node', 'ok' if shutil.which('node') else 'warn', shutil.which('node') or 'not on the PATH: the intro sting cannot be rendered here')
    for env, why in (('MINDMAKE_MUSIC_ROOT', 'the licensed music'), ('MINDMAKE_ARCHIVE_ROOT', 'the video archive')):
        value = os.environ.get(env)
        if not value:
            try:
                fallback = music.music_root(music.load()) if env == 'MINDMAKE_MUSIC_ROOT' else archive_root()
            except (music.MusicError, ArchiveError):
                fallback = None
            if fallback and Path(fallback).is_dir():
                add(env, 'ok', f'not set ({why}); using {fallback} from config/studio.json')
            else:
                add(env, 'warn', f'not set ({why})' + (f'; {fallback} from config/studio.json is not reachable (is Google Drive running?)' if fallback else ''))
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
        every = [f'{shape} {series}' for shape, per in s['renders'].items() for series in per]
        ready = [f'{shape} {series}' for shape, per in s['renders'].items() for series, r in per.items() if r['approved']]
        add('intro sting', 'ok' if s['status'] == 'approved' and len(ready) == len(every) and not s['source_problem'] else 'warn',
            f'{s["status"]}; rendered here for {", ".join(ready) or "no shape and series"}'
            + (f'; its source cannot be used: {s["source_problem"]}' if s['source_problem'] else '')
            + ('' if s['status'] == 'approved' else '; cuts render without it until Krish approves it'))
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
                    help='file the finished videos in the archive (default ROOT: MINDMAKE_ARCHIVE_ROOT, else on Windows runtime.archive_root in config/studio.json)')
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
    wins, missing = cue_windows(ws, cfg.get('cues') or [], total)
    early = picture_warnings(cfg, base)
    # The captions spell a word as the script does (house rule BRITISH_SPELLING).
    spell = spellings(ws, script_words(cfg, P))
    spelt = [{'heard': ws[i]['w'], 'script': respell(ws[i]['w'], w), 'at': ws[i]['s']} for i, w in sorted(spell.items())]
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
        toks = tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []), spell)
        early += spelling_warnings(toks)
        groups = chunks(toks, sorted({c['s'] for c in wins} | {c['e'] for c in wins}))
        shapes = {}
        for asp in aspects:
            try:
                plan = cut_plan(cfg, asp, P, main_frames, ws, base)
            except (KeyError, ValueError, OSError, subprocess.CalledProcessError) as e:
                shapes[asp] = {'error': f'cannot plan the {asp} cut: {e}'}
                continue
            tl = plan['timeline']
            shapes[asp] = {'intro': plan['intro'] and str(plan['intro']['file']), 'intro_source': plan['intro'] and plan['intro']['source'],
                           'intro_series': plan['intro'] and plan['intro']['series'], 'music': plan['bed'] and plan['bed']['track']['id'],
                           'intro_seconds': tl['intro_s'], 'main_seconds': tl['main_s'], 'outro_seconds': tl['outro_s'],
                           'total_seconds': tl['total_s'], 'warnings': plan['warnings']}
        print(json.dumps({'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
                          'cuts': [{'words': ' '.join(words[i]['w'].strip() for i in range(a, b + 1)), 'at': words[a]['s']} for a, b in cuts],
                          'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
                          'captions': len(groups), 'spellings': spelt, 'warnings': early, 'shapes': shapes,
                          **({'archive': {k: archiving['plan'][k] for k in ('folder', 'videos')}} if archiving else {})}, indent=1))
        for w in early + [f'{asp}: {w}' for asp, cut in shapes.items() for w in cut.get('warnings', [])]:
            print(f'note: {w}', file=sys.stderr)
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
    toks = tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []), spell)
    early += spelling_warnings(toks)
    bounds = sorted({c['s'] for c in wins} | {c['e'] for c in wins})
    groups = chunks(toks, bounds)
    report = {'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
              'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
              'captions': len(groups), 'spellings': spelt, 'loudness_in': loud['input_i']}
    fonts = Path(__file__).resolve().parent / 'fonts'
    shapes = {}
    for asp in aspects:
        plan = cut_plan(cfg, asp, P, main_frames, ws, base)
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
        if loudness.get('true_peak') is not None and loudness['true_peak'] > levels['max_true_peak_dbtp']:
            # The AAC encode lifts inter-sample peaks over the ceiling: one
            # oversampled limiter pass on the sound alone (the picture is
            # copied) brings them under it without moving the loudness.
            limited = final.with_name(final.stem + '.limited.mp4')
            ceiling = 10 ** ((levels['max_true_peak_dbtp'] - 0.8) / 20)
            run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(final), '-map', '0', '-c:v', 'copy',
                 '-af', f'aresample=192000,alimiter=limit={ceiling:.3f}:attack=1:release=50:level=0,aresample=48000',
                 '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', str(limited)])
            limited.replace(final)
            loudness = measure_cut(final, tl, cut_audio)
            loudness['peak_limited'] = True
        warnings += loudness_warnings(loudness, levels)
        shapes[asp] = {
            'file': final.name, 'intro_seconds': tl['intro_s'], 'main_seconds': tl['main_s'], 'outro_seconds': tl['outro_s'],
            'total_seconds': tl['total_s'], 'voice_start_seconds': tl['voice_start_s'], 'voice_end_seconds': tl['voice_end_s'],
            'intro': intro and {'source': intro['source'], 'series': intro['series'], 'file': str(intro['file']), 'sha256': intro['sha256'],
                                'seconds': intro['seconds'], 'own_sound_replaced': intro['own_sound_replaced']},
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
        report['warnings'] = early + list(only['warnings'])
    else:
        report['warnings'] = early + [f'{asp}: {w}' for asp, cut in shapes.items() for w in cut['warnings']]
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
