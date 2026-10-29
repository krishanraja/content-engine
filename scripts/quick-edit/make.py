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
  4. Renders both shapes, each opening straight on the hook (house rule
     HOOK_IS_THE_INTRO, Krish 2026-10-29: no story card and no logo intro in
     front of it): the tall cut in the brand's dress from its first frame
     (the wordmark and the series tag in the top corners, kit.py's
     dress-9x16.png), the wide cut on its existing branded frame for now
     (its look is not yet put to Krish); graphics in,
     captions timed to the words, the one outro card on the end. Each
     report records the opening it used ("opening"), so real engagement can
     settle the choice. A clip goes in front only on Krish's own words for
     that piece ("intro_override"); its own sound is never mixed.
  5. Mixes the sound: his voice, the licensed music bed under the whole
     video and never dropping out (low under his voice, higher over the end
     card; Krish, 2026-10-28: "Yes I think music should be audible
     throughout but just lower."), then one two-pass loudness pass on the
     final mix (-14 LUFS, true peak at most -1 dBTP), measured again after
     the encode.
  6. Writes preview frames at the opening and every graphic, and a report of
     what it did, the music it used and the loudness it measured.

No caption carries his name, and no tall cut carries a name strap (Krish,
2026-10-28: "Remember, no content refers to Krish, ever. I still see that
popping up from time to time. Even articles written are not authored by
Krish. My face only, for assets and the video format."): a caption that
says it, or a self-introduction such as "I'm Krish", stops the run before
anything renders, naming where he said it so it can be cut with "remove".

Needs Python 3.10+, ffmpeg and ffprobe on the PATH, and for transcription
the pinned faster-whisper from requirements.lock.txt (`python -m pip install
--require-hashes -r requirements.lock.txt`; never an unpinned install, whose
newest pair cannot decode sound). Run from anywhere:

    python make.py config.json --out OUTDIR [--only 9x16|16x9] [--plan] [--share-mib 29] [--archive [ROOT]]
    python make.py --doctor [--json]     is this machine ready to make a video
    python make.py --self-test

`--plan` stops after the transcript: it prints every cut, every graphic's
window, the caption count, the opening and the music each cut will get, and
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

Neither an opening clip's own sound nor the end card's is ever mixed: both
stretches are silence, with the music bed over them.
"""
import argparse
import hashlib
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

import episode
import intro as sting  # the three series names; the sting itself is retired (HOOK_IS_THE_INTRO)
import music
import spelling
import transcriber
import quality
import words_gate
import advisory_qc
sys.path.append(str(Path(__file__).resolve().parents[1]))  # scripts/, after quick-edit's own modules
from cutgates import aligners as cut_aligners, joins_reel, receipt as cut_receipt, settings as cut_settings  # noqa: E402
from archive import ArchiveError, archive_root, archive_videos, plan as archive_plan, read_package
from share import share_copy

CREAM, INK, MINT = '&H00E4EFF4', '&H0012150C', '&H00C0F07E'
FPS, RATE = 30, 48000
# The cut's frame rate is the take's own (render_fps): the episode corpus,
# "Frame rate: Same as recorded source", and YouTube's own advice to upload at
# the rate it was recorded at. Krish's takes come from teleprompter.com at about
# 24 fps, a little uneven; until 17 October every cut was made at 30, which
# shows one frame in four twice. FPS above is the default until main() sets it.
HOUSE_RATES = (24, 25, 30, 50, 60)
SIZE = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
# The voice is set to the target before the mix, and the mix is limited this
# far under full scale (true peak, 4x oversampled) before the final loudness
# pass, so that pass is a plain gain and the AAC encode stays under -1 dBTP.
LIMIT_DBTP = -2.0
# House rule TWO_CUTS: the short cut runs at most 90 seconds. Krish has not
# yet ruled on whether those 90 seconds count the end card (and any opening
# clip), so the check reads the one figure named here: 'main_s', his speech
# alone (the captioned main), which is what story_check's word budget (225
# words at 150 a minute) measures too. The report shows total_seconds, with
# the end card, either way. If he rules that the 90 seconds is the whole
# video, make 'measures' 'total_s'.
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
# so the next one cannot. His own name is never one of them: no caption says it
# (Krish, 2026-10-28; name_in_captions), so "Chris" is never turned into it.
DEFAULT_FIXES = [
    ['Bike Dance', 'ByteDance'], ['Byte Dance', 'ByteDance'], ['Bite Dance', 'ByteDance'], ['Bytedance', 'ByteDance'],
    ['Higgs field', 'Higgsfield'], ['Higsfield', 'Higgsfield'], ['Open AI', 'OpenAI'], ['Sorah', 'Sora'],
    ['Chat GPT', 'ChatGPT'], ['XAI', 'xAI'], ['Deep Seek', 'DeepSeek'], ['Mid Journey', 'Midjourney'], ['Eleven Labs', 'ElevenLabs'],
    ['MakeYourMindUp .ai', 'makeyourmindup.ai'], ['theater', 'theatre'],
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
    "ByteDance" and "Higgsfield" the way they are spelt. It names the
    publication, never Krish: no caption says his name (Krish, 2026-10-28)."""
    text = Path(path).read_text(encoding='utf-8-sig')
    names = []
    for m in re.finditer(r"\b(?:[A-Z][a-z]*[A-Z][A-Za-z]*|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*|[A-Z]{2,}[a-z]*)\b", text):
        word = m.group(0)
        if word not in names and word.split()[0] not in {'The', 'This', 'That', 'And', 'But', 'So', 'Now', 'Our', 'If', 'One', 'First', 'Then', 'When', 'What', 'How', 'Why', 'Think', 'People', 'Every', 'Most', 'Nobody', 'Instead', 'Expensive', 'Choose', 'Line', 'Before', 'Square', 'Written', 'On', 'In', 'It', 'They', 'You', 'We', 'He', 'She', 'Let', 'Back'}:
            names.append(word)
    return 'makeyourmindup. ' + ', '.join(names[:60]) + '.'


def norm(t):
    """How a word is compared with the script and the config: lower case,
    letters, digits, % and $, and its British and US spellings folded into
    one (spelling.fold), so a cue that ends on "cheque to court" is found
    where the transcriber wrote "check to court"."""
    return spelling.fold(re.sub(r"[^a-z0-9%$]", '', t.lower()))


def transcribe(src, out, model='small.en', prompt='', provenance=None):
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device='cpu', compute_type='int8',cpu_threads=4)
    segs, info = m.transcribe(str(src), word_timestamps=True, vad_filter=True, beam_size=5, initial_prompt=prompt or None)
    words, last_progress = [], -30
    for segment in segs:
        words.extend({'w':w.word,'s':round(w.start,3),'e':round(w.end,3)} for w in segment.words)
        if segment.end-last_progress>=30:
            print(f'Transcribed {segment.end:.0f}/{info.duration:.0f}s: {Path(src).name}',file=sys.stderr,flush=True)
            last_progress=segment.end
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps({'duration': info.duration, 'words': words,
                                  **({'provenance': provenance} if provenance else {})}, indent=0), encoding='utf-8')
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


def sped_words(words, factor):
    """Word times on the clock of a take sped up by `factor`."""
    return [dict(w, s=w['s'] / factor, e=w['e'] / factor) for w in words]


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
            ended = [words[k]['w'].strip() for k in range(hit[0], hit[1]) if re.search(r'[.!?]["’”)]*$', words[k]['w'].strip())] if hit else []
            if hit and ended:
                # A false start is a sentence he did not finish. A cut that holds a
                # finished one would take out words he meant (17 October: "13:20" on
                # Friday's take found 7.1 s, the end of his prediction among them).
                said = ' '.join(w['w'].strip() for w in words[hit[0]:hit[1] + 1])
                missing.append({**r, 'refused': f'it would cut a finished sentence ("{ended[0]}" ends one inside it): "{said}". '
                                                 'Give the false start\'s own words as {"say": ..., "after": ...}'})
            elif hit:
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
        refused = [m for m in missing if isinstance(m, dict) and m.get('refused')]
        if refused:
            raise SystemExit('cuts refused: ' + '; '.join(f'{m.get("restart_near")}: {m["refused"]}' for m in refused)
                             + (f'; and not found: {[m for m in missing if m not in refused]}' if len(refused) < len(missing) else ''))
        raise SystemExit(f'cuts not found in the transcript: {missing}')
    return ranges


def thin_cuts(words, remove, segs, least=0.1):
    """Each cut that takes out less than `least` seconds of sound: its words'
    span, less what the kept windows (with their pads) still play. Such a row
    does nothing a viewer hears, so it is named in the warnings."""
    out = []
    for a, b in remove:
        s0, s1 = words[a]['s'], words[b]['e']
        kept = sum(max(0.0, min(s1, g['b']) - max(s0, g['a'])) for g in segs)
        if (s1 - s0) - kept < least:
            out.append(f'the cut "{" ".join(w["w"].strip() for w in words[a:b + 1])}" ({s0:.2f} s) takes out '
                       f'{max(0.0, (s1 - s0) - kept):.2f} s of sound, which nobody hears: the pause rule\'s pads keep it. '
                       'Cut more of the words, or drop the row')
    return out


def removal_joins(segs, remove):
    """The edited-clock times where a cut row (not a pause) joins two windows."""
    gone = {i for a, b in remove for i in range(a, b + 1)}
    return [round(g['off'], 3) for prev, g in zip(segs, segs[1:])
            if prev.get('idx') and g.get('idx') and any(prev['idx'][-1] < i < g['idx'][0] for i in gone)]


def snap_to_join(start, word_s, segs, within=0.6):
    """A push-in's start moved back onto a hidden cut in the pause just before
    its first word (at most `within` seconds before it), so the closer framing
    lands on the join and hides it, never a beat after it (a flick)."""
    for g in segs[1:]:
        t = g['off']
        if word_s - within <= t <= word_s:
            return round(t, 3)
    return round(start, 3)


def bare_joins(segs, framing, wins, frame=1 / 24):
    """Hidden cuts a viewer could see: a join with no framing change on it and
    no picture over it (the episode framings change at most every HOLD_S)."""
    edges = {round(t, 3) for a, b, _ in framing for t in (a, b)}
    out = []
    for g in segs[1:]:
        t = round(g['off'], 3)
        if any(abs(t - e) <= frame for e in edges) or any(c['s'] <= t <= c['e'] for c in wins):
            continue
        out.append(t)
    return out


def segments(words, remove, max_gap, pad_before, pad_after, src_dur, protect_removals=False):
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
        left = words[g['first']-1]['e'] if protect_removals and g['first']-1 in gone else 0.0
        right = words[g['last']+1]['s'] if protect_removals and g['last']+1 in gone else None
        a = max(a, left)
        # A window starts on a frame: its part is cut by seeking to `a`, and the picture can only begin at the next
        # whole frame while the sound begins at `a` itself, so a start between frames put his lips up to a frame
        # ahead of his voice (Monday 26 Oct's 5-minute cut began at 0.01 s and read -80 ms on SyncNet). Later,
        # never earlier, so a removed word stays out and the pad before his first word only shortens.
        a = min(math.ceil(a * FPS - 1e-6) / FPS, words[g['first']]['s'])
        if right is not None:
            b = min(b, right)
        if out and a <= out[-1]['b'] and not (protect_removals and g['first']-1 in gone):
            out[-1]['b'] = b
            out[-1]['idx'] += g['idx']
        else:
            out.append({'a': round(a, 6), 'b': round(b, 3), 'idx': g['idx'],
                        **({'left_limit':left,'right_limit':right} if protect_removals else {})})
    # Each window is a whole number of frames at the cut's rate, so its picture
    # and sound are the same length and the joined cut never drifts out of sync.
    for g in out:
        # Round outwards: rounding down can remove the end of a word when the
        # take itself ends immediately after it. End padding is safe to extend.
        frames = max(1, math.ceil((g['b'] - g['a']) * FPS-1e-8))
        end = g['a'] + frames / FPS
        if g.get('right_limit') is not None and end > g['right_limit']:
            # Keep complete words while keeping removed speech outside the cut.
            # Recover the fractional frame from available leading silence first.
            start = g['b'] - frames / FPS
            # On a frame too (lip sync, above), when the window's last frame still holds its last kept word whole.
            framed = math.floor(start * FPS + 1e-6) / FPS
            if framed >= g.get('left_limit', 0) and framed + frames / FPS >= words[g['idx'][-1]]['e']:
                g['a'], g['b'] = framed, framed + frames / FPS
            elif start >= g.get('left_limit',0):
                g['a'] = start
            else:
                # A short retained phrase between removals may not have a whole
                # frame of spare silence. Pad its final fractional frame with
                # silence instead of truncating the word or restoring a removal.
                g['source_end'] = g['b']
                g['b'] = end
        else:
            g['b'] = end
    t = 0.0
    for g in out:
        g['off'] = round(t, 3)
        t += g['b'] - g['a']
    return out, round(t, 3)


def source_rate(src):
    """The take's average frame rate (frames over duration), or None."""
    out = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,r_frame_rate',
                                     '-of', 'json', str(src)], capture_output=True, text=True).stdout or '{}')
    v = (out.get('streams') or [{}])[0]
    for key in ('avg_frame_rate', 'r_frame_rate'):
        n, _, d = str(v.get(key) or '0/0').partition('/')
        try:
            rate = float(n) / float(d or 1)
        except (ValueError, ZeroDivisionError):
            continue
        if rate > 0:
            return rate
    return None


def render_fps(cfg, src):
    """The cut's frame rate: `"fps"` in the config (one of HOUSE_RATES), else
    ("source", the default) the house rate nearest the take's average rate."""
    want = cfg.get('fps', 'source')
    if want != 'source':
        if want not in HOUSE_RATES:
            raise ValueError(f'"fps" is "source" or one of {", ".join(map(str, HOUSE_RATES))}, not {want!r}')
        return int(want)
    rate = source_rate(src)
    if not rate:
        raise ValueError(f'{src} reports no frame rate; set "fps" in the config')
    return min(HOUSE_RATES, key=lambda r: abs(r - rate))


# A take whose average rate is the cut's to within this is laid one frame a
# frame period (conform_filter), never resampled.
CONFORM_TOLERANCE = 0.001


def conform_filter(rate, fps):
    """How a part of the take becomes frames at the cut's rate. A
    teleprompter.com take is 24 fps on average (24.0005 on 16 October) but its
    frames are stamped unevenly, 30 to 60 ms apart, so resampling it to 24
    dropped one frame and showed the next twice about 40 times in 30 s. Its
    camera captured evenly, so when the average is the cut's rate (within
    CONFORM_TOLERANCE) every frame is shown once, laid 1/fps apart from the
    part's start (no frame strays a frame and a half from its stamp over a
    14-minute take: within lip sync); otherwise it is resampled."""
    if rate and abs(rate / fps - 1) <= CONFORM_TOLERANCE:
        return f'setpts=N/({fps}*TB),tpad=stop_mode=clone:stop_duration={2 / fps:.4f}'
    return f'fps={fps},setpts=PTS-STARTPTS'


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


def find_loose(ws, phrase, after=0.0, need=0.6):
    """Where he said a phrase his own way: the span whose words share the
    longest in-order run with the phrase, when that run holds at least
    `need` of its words and both its first and last matched words fall in
    the span ("its singers get" finds "the singers are going to get").
    (first, last) word indices, or None."""
    p = [norm(x) for x in phrase.split() if norm(x)]
    if not p:
        return None
    toks = [norm(w['w']) for w in ws]
    best = None
    for i in range(len(toks)):
        if ws[i]['s'] < after or toks[i] not in p:
            continue
        span = toks[i:i + len(p) + 4]
        # longest common subsequence of the phrase and the span, and where it ends
        prev = [0] * (len(span) + 1)
        end_at = [-1] * (len(span) + 1)
        for a in p:
            cur, cur_end = [0] * (len(span) + 1), [-1] * (len(span) + 1)
            for k, b in enumerate(span, 1):
                if a == b:
                    cur[k], cur_end[k] = prev[k - 1] + 1, k - 1
                elif cur[k - 1] >= prev[k]:
                    cur[k], cur_end[k] = cur[k - 1], cur_end[k - 1]
                else:
                    cur[k], cur_end[k] = prev[k], end_at[k]
            prev, end_at = cur, cur_end
        score = prev[-1] / len(p)
        if score >= need and (best is None or score > best[0]):
            best = (score, i, i + end_at[-1])
    return (best[1], best[2]) if best else None


def cue_windows(ws, cues, total, strict=False):
    found, missing = [], []
    for c in cues:
        if strict:
            a = quality.unique_anchor(ws,c['start'],norm)
            b = quality.unique_anchor(ws,c['end'],norm,after=ws[a[0]]['s'],end_after=True) if a else None
            if c.get('pages') and not c.get('on'):
                raise ValueError(f"{c['id']}: every page needs a spoken-word anchor")
        else:
            a = find(ws, c['start']) or find_loose(ws, c['start'])
            b = (find(ws, c['end'], after=ws[a[0]]['s']) or find_loose(ws, c['end'], after=ws[a[0]]['s'])) if a else None
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


def script_names(said):
    """The names the script spells as one word, which the transcriber can split
    ("co -work" for Cowork, Krish, 2026-10-14, of a posted Reel's caption: "like
    co -work and ChatGPT"): a word of five letters or more with a capital inside
    it (ChatGPT, OpenAI) or a capital where no sentence starts (Cowork, Anthropic)."""
    out = []
    for k, w in enumerate(said):
        core = re.sub(r"(?:['’]s)?\W*$", '', re.sub(r'^\W+', '', w))
        if len(norm(core)) < 5 or not core[:1].isalpha():
            continue
        starts = k == 0 or re.search(r'[.!?:]["’”)]*$', said[k - 1])
        inner = any(c.isupper() for c in core[1:])
        if (inner or (core[:1].isupper() and not starts)) and core not in out:
            out.append(core)
    return out


def join_names(ws, names, max_gap=0.3):
    """Words the transcriber split out of one of the script's names put back
    as that name, its first piece's capital and its last piece's punctuation
    kept: two or three pieces said without a pause whose letters are the name's."""
    want = {norm(n): n for n in names}
    out, i = [], 0
    while i < len(ws):
        hit = None
        for k in (3, 2):
            run = ws[i:i + k]
            if len(run) < k or any(b['s'] - a['e'] > max_gap for a, b in zip(run, run[1:])):
                continue
            name = want.get(''.join(norm(w['w']) for w in run))
            if name:
                lead = re.match(r'^\W*', run[0]['w'].strip()).group(0)
                tail = re.sub(r'^.*?([.,!?;:]*)$', r'\1', run[-1]['w'])
                hit = ({**run[0], 'w': ' ' + lead + name + tail, 'e': run[-1]['e'], 'src': run[-1].get('src', run[0].get('src'))}, k)
                break
        if hit:
            out.append(hit[0])
            i += hit[1]
        else:
            out.append(ws[i])
            i += 1
    return out


def spelling_warnings(toks):
    """US spellings left in the captions (an ad-lib the script does not
    cover, or a script that spells it so): one warning naming them."""
    left = [f'"{t["w"]}" ({t["s"]:.1f} s)' for t in toks if spelling.looks_us(t['w'])]
    if not left:
        return []
    return [f'the captions read {len(left)} US spelling(s) no script word covers: {", ".join(left[:12])}'
            f'{" and more" if len(left) > 12 else ""}. Add a replacement for each (house rule BRITISH_SPELLING), '
            'unless it is a name or a quotation']


def tokens(ws, replacements, spell=None, names=()):
    """Words as caption tokens: the script's spellings (spellings()), the
    pieces the transcriber split off put back (joined()), the script's names
    put back whole (join_names()), brand names joined, fixes applied,
    sentence case restored after a cut."""
    ws = [dict(w, w=respell(w['w'], spell[i])) if spell and i in spell else w for i, w in enumerate(ws)]
    ws = joined(ws)
    if names:
        ws = join_names(ws, names)
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


NO_NAME_RULING = ('Krish, 2026-10-28: "Remember, no content refers to Krish, ever. I still see that popping up from time to time. '
                  'Even articles written are not authored by Krish. My face only, for assets and the video format."')
# The captions are his own words as heard, so his name reaches one only when he
# says it or the transcriber hears another word as it. Any "Krish" is refused
# (asked whether another Krish may be named, Krish picked: "Yes, block it", with
# no override), and so is a self-introduction under whatever the transcriber
# heard for the name ("I'm Chris"). The word is closed at its end, so another
# name that only starts with those letters (Krishna, Krishnan) is left alone.
# The copy lint's "no_name" pattern (config/copy-lint.json) is read as well
# once that file carries one.
NAME_SAID = (re.compile(r'\bkrish(?:an)?(?:raja\d*)?\b', re.I),
             re.compile(r"\b(?:i\s*['’]?\s*m|i\s+am|my\s+name\s*(?:['’]\s*s|\s+is))\s+(?:chris|krish(?:an)?)\b", re.I))


def name_patterns():
    pats = list(NAME_SAID)
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
    try:
        import copy_lint
        pats += [rx for pid, rx, applies in copy_lint.patterns() if pid == 'no_name' and 'video_onscreen' in applies]
    except (ImportError, OSError, ValueError, KeyError):
        pass
    return pats


def name_in_captions(toks, words=None):
    """Every place the caption words (tokens()) say his name or introduce him:
    [{"said", "cut_s", "take_s"}], take_s on the words file's clock when the
    token keeps its source word."""
    text, starts = '', []
    for t in toks:
        starts.append(len(text))
        text += str(t['w']) + ' '
    spans = []
    for rx in name_patterns():
        for m in rx.finditer(text):
            spans.append((max(k for k, at in enumerate(starts) if at <= m.start()), max(k for k, at in enumerate(starts) if at < m.end())))
    merged = []
    for i, j in sorted(spans):
        if merged and i <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(j, merged[-1][1]))
        else:
            merged.append((i, j))
    out = []
    for i, j in merged:
        src = toks[i].get('src')
        take = words[src]['s'] if words is not None and isinstance(src, int) and 0 <= src < len(words) else None
        out.append({'said': ' '.join(str(t['w']) for t in toks[i:j + 1]), 'cut_s': toks[i]['s'], 'take_s': take})
    return out


def name_refusal(hits):
    """Why the run stops: where he said it, so it can be cut with "remove"."""
    clock = lambda t: f'{t // 60:.0f}:{t % 60:05.2f}'
    where = '; '.join(f'"{h["said"]}" at {clock(h["cut_s"])} in the cut' + (f' ({clock(h["take_s"])} in the take)' if h['take_s'] is not None else '')
                      for h in hits)
    return (f'the captions name him: {where}. No content refers to him ({NO_NAME_RULING}). '
            'Cut it from the take with a "remove" row ({"say": "the words", "after": "the words before them"}) and plan again')


def strap_problem(cfg):
    """The name strap is retired: it put his name on the tall cut (kit.py no
    longer draws one). None when the config carries none."""
    if cfg.get('strap'):
        return (f'"strap" in the config would put his name on screen, and no content refers to him ({NO_NAME_RULING}). '
                'Replace "strap" with "dress": {"9x16": "dress-9x16.png"}, the brand\'s dress the tall cut carries instead: kit.py draws '
                'that file on every run, even when it keeps a config edited by hand, so the cut opens in the brand\'s corners')
    return None


def reviewed_caption_tokens(cfg, resolve, tokens, identity, edited, duration):
    if not cfg.get('caption_repairs'):
        return tokens, None
    path=resolve(cfg['caption_repairs'])
    if not cfg.get('caption_repairs_sha256') or quality.digest(path)!=cfg['caption_repairs_sha256']:
        raise ValueError('Caption repair document differs from the reviewed evidence')
    document=json.loads(path.read_text(encoding='utf8'))
    return quality.repaired_caption_words(document,tokens,identity,quality.digest(edited),duration),document


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


def ass_colour(hexrgb):
    """'#FFD84D' as libass writes it, &H00BBGGRR."""
    h = hexrgb.lstrip('#')
    return f'&H00{h[4:6]}{h[2:4]}{h[0:2]}'.upper()


def series_accent(cfg, base='.'):
    """The piece's series colour from config/studio.json, for the house captions' shadow."""
    series, _ = series_of(cfg, base)
    studio = json.loads((Path(__file__).resolve().parents[2] / 'config' / 'studio.json').read_text(encoding='utf-8'))
    return studio['series'][series]['accent']


def write_ass(path, groups, wins, aspect, house=None):
    """The burned captions. `house` (the config's "caption_style": "house", with the series colour) draws
    the house captions of docs/STUDIO.md: the ink block with a hard shadow in the channel's colour and at
    most one loud word, the line's first figure, on the mint swipe; libass draws the block flat, so it has
    no grain. Without it, the quick-edit captions: cream on the ink block, every figure in mint."""
    if aspect == '9x16':
        W, H, fs, box, shadow = 1080, 1920, 70, 16, 12
        norm_pos, norm_m, cut_pos, cut_m = r'\an8\pos(540,250)', (60, 60), r'\an8\pos(540,1014)', (60, 60)
    else:
        W, H, fs, box, shadow = 1920, 1080, 48, 12, 8
        norm_pos, norm_m, cut_pos, cut_m = r'\an2\pos(960,1040)', (360, 360), r'\an2\pos(303,1040)', (24, 1920 - 582)
    back, shad = (ass_colour(house), shadow) if house else (INK, 0)
    lines = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
             '[V4+ Styles]',
             'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
             f'Style: Cap,Archivo Black,{fs},{CREAM},{CREAM},{INK},{back},0,0,0,0,100,100,0,0,3,{box},{shad},8,60,60,0,1', '',
             '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    figure = re.compile(r'[0-9%$]')
    for k, g in enumerate(groups):
        s = g[0]['s']
        e = groups[k + 1][0]['s'] if k + 1 < len(groups) else g[-1]['e'] + 0.4
        e = min(e, g[-1]['e'] + 0.9)
        mid = (s + g[-1]['e']) / 2
        cut = any(c['s'] <= mid <= c['e'] for c in wins)
        pos, (ml, mr) = (cut_pos, cut_m) if cut else (norm_pos, norm_m)
        words = [re.sub(r'[{}\\]', '', t['w']) for t in g]
        if not house:
            shown = [rf'{{\c{MINT}}}{w}{{\c{CREAM}}}' if figure.search(w) else w for w in words]
            lines.append(f'Dialogue: 0,{ass_time(s)},{ass_time(e)},Cap,,{ml},{mr},0,,{{{pos}}}{" ".join(shown)}')
            continue
        lines.append(f'Dialogue: 0,{ass_time(s)},{ass_time(e)},Cap,,{ml},{mr},0,,{{{pos}}}{" ".join(words)}')
        loud = next((i for i, w in enumerate(words) if figure.search(w)), None)
        if loud is not None:
            # The swipe is the same line again on the layer above, every word clear but the loud one, so its
            # mint block sits over the ink one and the next word's block cannot cover it; the layout is the same.
            swipe = [rf'{{\alpha&H00&\3c{MINT}\c{INK}\bord{box // 2 - 2}\shad0}}{w}{{\alpha&HFF&}}' if i == loud else w
                     for i, w in enumerate(words)]
            lines.append(f'Dialogue: 1,{ass_time(s)},{ass_time(e)},Cap,,{ml},{mr},0,,{{{pos}\\alpha&HFF&}}{" ".join(swipe)}')
    Path(path).write_text('\n'.join(lines) + '\n', encoding='utf-8')


def between(wins):
    return '+'.join(f"between(t,{c['s']},{c['e']})" for c in wins) or '0'


def loudnorm_json(stderr):
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', stderr)
    return json.loads(m.group(0))


def chain_latency(ref, processed, seconds=60.0, rate=16000, most=0.25):
    """How much later the processed voice runs than the voice it was made from, in seconds (cross-correlation
    over the first minute, at most a quarter second either way)."""
    import numpy as np

    def pcm(path):
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{seconds}', '-vn', '-ac', '1', '-ar', str(rate),
                              '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).astype(np.float64)
        return x - x.mean()
    a, b = pcm(ref), pcm(processed)
    n = min(len(a), len(b))
    if n < rate:
        return 0.0
    a, b = a[:n], b[:n]
    size = 1 << (2 * n - 1).bit_length()
    c = np.fft.irfft(np.fft.rfft(b, size) * np.conj(np.fft.rfft(a, size)), size)
    m = int(most * rate)
    lags = np.concatenate([np.arange(m + 1), np.arange(-m, 0)])
    return float(lags[np.argmax(np.concatenate([c[:m + 1], c[-m:]]))] / rate)


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
    """Anything in front of the hook in this cut: (intro, note). intro is
    None when the cut opens straight on the hook, which every cut does by
    default (house rule HOOK_IS_THE_INTRO, Krish, 2026-10-29: "Let's go with
    number one for now"; the sting is retired, config/intro-sting.json, so
    "auto" gives none and says nothing). The config's "intro" is "auto",
    false, or {"9x16": file, "16x9": file}: a file named there goes in front
    only on Krish's own words for this piece in "intro_override" (or if a
    house sting is ever approved again, as that render), so a different
    opening can be tried on his say and the report records it ("opening").
    Its own sound is never used: make.py lays silence under it. An opening
    problem never stops a render."""
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
        # A clip on Krish's words may run longer than the retired 1 to 2 s
        # sting: up to STORY_INTRO_MAX_S.
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


def opening_of(intro):
    """What the cut opened on, for its report. The hook as the intro is
    Krish's choice to test (house rule HOOK_IS_THE_INTRO, 2026-10-29: "we
    need to figure out what the right tone is over time based on real
    engagement"), so every cut records it and engagement can settle it."""
    if intro is None:
        return {'kind': 'hook', 'rule': 'HOOK_IS_THE_INTRO'}
    return {'kind': 'clip', 'source': intro['source'], 'file': str(intro['file']), 'seconds': intro['seconds']}


def piece_key(cfg):
    """What ties both cuts of one piece to the same music."""
    return str(cfg.get('piece_id') or cfg.get('piece') or cfg.get('subject') or cfg['name'])


# The longest a clip in front of the hook may run, on Krish's words only
# (the story intro it was made for is retired, HOOK_IS_THE_INTRO), and the
# longest the story outro runs (STORY_INTRO_OUTRO, config/story-intro-outro.json).
STORY_INTRO_MAX_S = 5.0
STORY_OUTRO_MAX_S = 6.0
# What a cut adds to its recording at most: the longest opening clip and end card.
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
    mode = cfg.get('music_mode')
    if mode == 'episode':
        # The old episode bed played only in the open, at the chapter turns and
        # in the close, and dropped out under the talk between them. Krish,
        # 2026-10-28: "Yes I think music should be audible throughout but just
        # lower." So it is the continuous bed now, low under his voice, lifting
        # at the chapter cards (the one he approved by ear on 19 October), or,
        # with no cards, a little at each spoken chapter turn as the old bed did
        # (Krish, 2026-10-16: "Feel free to raise the music slightly during the
        # section dividers.").
        mode = 'episode_bed'
        notes.append('"music_mode": "episode" plays the continuous bed ("episode_bed"): the music is audible under the whole cut, '
                     'low under his voice (Krish, 2026-10-28), lifting at its chapter cards, or a little at each spoken chapter turn '
                     'when it has none')
    if mode == 'episode_bed':
        seconds = 0  # Restarts go in the chapter cards, and further ones under a two-second crossfade where a stretch outruns the track.
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
        if mode == 'episode_bed':
            levels.update(cfg.get('episode_bed_levels') or {})
    except music.MusicError as e:
        return None, f'the music could not be used ({e}), so this cut has voice only'
    ledger = music.ledger_path()
    if ledger.resolve() != music.LEDGER.resolve():
        notes.append(f'the music came from {ledger}, not config/music-library.json')
    lift_turns = cfg.get('music_mode') == 'episode'
    mode = mode if mode == 'episode_bed' else None
    return ({'track': track, 'file': path, 'levels': levels, 'ledger': str(ledger), 'needs': needs, 'needs_from': needs_from, 'mode': mode,
             'lift_turns': lift_turns},
            '; '.join(notes) or None)


def timeline(intro_frames, main_frames, end_frames, ws):
    """The cut's clock: any opening clip, the captioned main and the end card, in
    whole frames, and when Krish's first and last words fall on it."""
    I, M, E = intro_frames / FPS, main_frames / FPS, end_frames / FPS
    vs = I + (ws[0]['s'] if ws else 0.0)
    ve = I + min(M, ws[-1]['e'] if ws else M)
    return {'intro_s': round(I, 4), 'main_s': round(M, 4), 'outro_s': round(E, 4), 'total_s': round(I + M + E, 4),
            'voice_start_s': round(vs, 4), 'voice_end_s': round(max(vs, ve), 4)}


def preview_shots(tl, wins):
    """Preview frame times on the finished cut: one in any opening clip
    (named `intro`), then the opening, every graphic and the end card, each
    moved on by that clip's length."""
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
                f'(house rule TWO_CUTS); with the end card the whole video runs {tl["total_s"]:.1f} s (total_seconds)']
    return [f'the whole tall cut runs {tl["total_s"]:.1f} s (total_seconds, with the end card), over the {cap} s cap '
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
    """The cut's sound as three files in `work`: dialog.wav (any opening
    clip's silence, his voice set to the target, the end card's silence),
    bed.wav (the music under the whole cut, never dropping out, or none),
    and mix.wav, the final mix. Neither an opening clip's nor the end card's
    own sound is ever mixed. Returns what the report needs."""
    work.mkdir(parents=True, exist_ok=True)
    smp = {k: round(tl[k] * RATE) for k in ('intro_s', 'main_s', 'outro_s', 'total_s')}
    inputs, g, labels = ['-i', str(edited)], [], []
    if intro:
        # An opening clip's own sound, if it has any, is never mixed: its stretch
        # is silence here, and the music bed is up over it.
        g.append(f'anullsrc=r={RATE}:cl=stereo,{NORM},atrim=end_sample={smp["intro_s"]},asetpts=PTS-STARTPTS[ia]')
        labels.append('[ia]')
    g.append(f'[0:a]{NORM},highpass=f=70,volume={voice_gain:.3f}dB,apad,atrim=end_sample={smp["main_s"]},asetpts=PTS-STARTPTS[va]')
    labels.append('[va]')
    # The end card's own sound, like an opening clip's, is never mixed: its stretch
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
    if bed and bed.get('mode') == 'episode_bed':
        import audio_quality
        track, levels = bed['track'], bed['levels']
        cards=tl.get('chapter_cards') or ()
        baseline={**levels,'bed_lufs':-31,'chapter_lufs':-31,'intro_lufs':-31,'outro_lufs':-31}
        chain, placed = music.continuous_episode_bed(track, tl, baseline, cards)
        raw=work/'bed-reference.wav'
        ffmpeg('-i', str(bed['file']), '-filter_complex', chain, '-map', '[bed]', '-c:a', 'pcm_s16le', str(raw))
        stem = work / 'bed.wav'
        # A spoken chapter turn's lift (tl "accents") is levelled with the cards and, like them, left out of the speech-bed check.
        accents=tl.get('accents') or ()
        correction=audio_quality.level_bed(raw,stem,tl,levels,cards,accents,music.ACCENT_LIFT_DB)
        measured=audio_quality.measure(stem)
        continuity=audio_quality.continuity_report(measured,tl['voice_start_s'],tl['voice_end_s'],list(cards)+list(accents))
        (work/'music-continuity.json').write_text(json.dumps(continuity,indent=2))
        if continuity['status']!='pass':
            raise ValueError('Music continuity gate: '+'; '.join(continuity['problems']))
        result.update(bed=stem, music={**placed, 'track_id':track['id'], 'sha256':track['sha256'],
                                     'levels':levels, 'file':track['file'], 'ledger':bed['ledger'],
                                     'local_level_correction':correction,'continuity':continuity})
        mix_in += ['-i', str(stem)]
        mix = '[0:a][1:a]amix=inputs=2:duration=first:normalize=0[m]'
    elif bed:
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
    if bed and bed.get('mode') == 'episode_bed':
        # The voice and continuous bed already have separately measured levels.
        # A second global normaliser would silently undo the approved bed balance.
        mixed=work/'mix.wav'
        ffmpeg('-i',str(summed),'-af',
               f'aresample={RATE*4},alimiter=limit={10**(LIMIT_DBTP/20):.4f}:attack=1:release=60:level=disabled:latency=1,{NORM},atrim=end_sample={smp["total_s"]}',
               '-c:a','pcm_f32le',str(mixed))
        result.update(mix=mixed,normalisation='separately levelled stems; peak limiter only',pre_mix_lufs=pre,target=target)
        summed.unlink()
        return result
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


def expand_pages(wins, asp, words=None):
    """A picture shown a part at a time in this shape (kit.py "pages") as
    one window per part, splitting its time evenly; the parts touch, so
    each crossfades into the next."""
    out = []
    for c in wins:
        pages = (c.get('pages') or {}).get(asp)
        if not pages:
            out.append(c)
            continue
        anchored = quality.word_pages(c, pages, words or [], norm)
        step = (c['e'] - c['s']) / len(pages)
        for k, page in enumerate(pages):
            s = anchored[k] if anchored else round(c['s'] + k * step, 3)
            e = anchored[k+1] if anchored else c['e'] if k == len(pages) - 1 else round(c['s'] + (k + 1) * step, 3)
            out.append({**c, 'id': f"{c['id']}-p{k + 1}", 'panel': page, 's': s, 'e': e})
    return out


def face_band(cw, ch, fy, fh):
    """The part of the frame that fills the tall cut's 1080 x 920 face band edge to edge, as (x, y, w, h):
    a wide recording keeps the face rows and loses its sides; a narrow (phone) one keeps its full width
    and the rows around the face. Never fitted inside the band with gaps beside it."""
    if cw * 920 >= fh * 1080:
        bw = min(cw, round(fh * 1080 / 920)) // 2 * 2
        return (cw - bw) // 2 // 2 * 2, fy, bw, fh // 2 * 2
    bw, bh = cw // 2 * 2, min(ch, round(cw * 920 / 1080)) // 2 * 2
    by = max(0, min(ch - bh, fy + fh // 2 - bh // 2)) // 2 * 2
    return 0, by, bw, bh


def card_fit(path, w, h):
    """A card that is not the size of the space it is laid in is fitted inside it, whole and centred, on a clear
    ground. Friday 16 Oct's deep-cut cards were drawn 1600 x 900 for a 1314 x 1080 space and laid in unscaled, so
    the right of every card (logos, numbers, sources) ran off the frame (19 Oct). '' when it already fits."""
    try:
        from PIL import Image
        cw, ch = Image.open(path).size
    except Exception:
        return ''
    if (cw, ch) == (w, h) or (cw <= w and ch <= h):
        return ''
    return (f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,")


def card_input(path, start, stop):
    """A card fed in only for its own window: the picture repeats from `start` (its clock kept on the main
    clock by -itsoffset, so every fade and enable time reads the same) to just past `stop`, and the overlay
    passes the main picture through untouched before and after it. Each card was fed in for the whole cut
    until 19 October, so a 13-minute deep cut with 51 cards turned about a million frames that were never
    shown, and took 3.5 hours: longer than a cloud container stays up (Krish: "are you saying we can never
    produce long videos?"). The pictures come out frame for frame the same."""
    moving = Path(path).suffix.lower() in {'.mp4', '.mov', '.mkv', '.webm'}
    loop = ['-stream_loop', '-1'] if moving else ['-loop', '1', '-framerate', str(FPS)]
    return [*loop, '-t', f'{max(0.1, stop - start + 0.5):.3f}',
            '-itsoffset', f'{start:.3f}', '-i', str(path)]


def bounded_decode_inputs(inputs, threads=2):
    """FFmpeg's codec thread option applies to one input, not all inputs.

    Dozens of looping picture cards otherwise each create an automatic pool
    (808 decoder threads on Wednesday's long cut). Keep stream order intact.
    """
    if type(threads) is not int or not 1 <= threads <= 8:
        raise ValueError('Input decoder threads must be between one and eight')
    result=[]
    for value in inputs:
        if value=='-i':result.extend(['-threads',str(threads)])
        result.append(value)
    return result


def video_graph(cfg, asp, P, out, edited, total, wins, ws, crop, intro, end, mix):
    """The ffmpeg inputs and filter graph for one shape: the captioned main
    (graphics, the tall cut's dress, the captions), joined after any opening
    clip and before the end card, with the finished mix as its sound."""
    cw, ch, cx, cy = crop
    W, H = SIZE[asp]
    wins = expand_pages(wins, asp, ws)
    inputs = ['-i', str(edited)]
    n = 1
    g = []
    cut = between(wins)
    # The episode framings (episode.py): a push under each hidden cut, closer on
    # a pivotal line. Laid on the speaker's own picture, never on the tall
    # cut's face band, whose crop is fixed.
    framing = cfg.get('_framing') or []
    # The cut's frames on exact times: its container (Matroska) keeps them to
    # the millisecond, which 1/24 s never is, and an overlay then showed a
    # frame twice whenever one landed a fraction of a millisecond late (241
    # times in 30 s of a 24 fps cut, 17 October). Every window of the cut is
    # whole frames (segments()), so frame N is at N/FPS exactly.
    g.append(f'[0:v]setpts=N/({FPS}*TB)[v0]')
    if asp == '9x16':
        bx, by, bw, bh = face_band(cw, ch, cfg['face'][0], cfg['face'][1])
        fw_out = 1080
        nr = len(runs_of(wins))
        g.append(f'[v0]split={1 + max(nr, 1)}[sp0]' + ''.join(f'[fcs{i}]' for i in range(max(nr, 1))))
        g.extend(episode.framing_graph('sp0', 'sp', framing, cw, ch, cfg['face']))
        g.append(f"[sp]scale=1080:{round(ch * 1080 / cw)}:flags=lanczos,crop=1080:1920,unsharp=5:5:0.6[s1]")
        for i in range(max(nr, 1)):
            g.append(f"[fcs{i}]crop={bw}:{bh}:{bx}:{by},scale=1080:920:flags=lanczos,unsharp=5:5:0.5[fc{i}]")
        if not nr:
            g.append('[fc0]nullsink')
        last = 's1'
        px, py = 0, 0
    else:
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{total:.3f}', '-i', str(P(cfg['frame16']))]
        fr = n
        n += 1
        sw = round(cw * 1080 / ch)
        g.extend(episode.framing_graph('v0', 'spf', framing, cw, ch, cfg['face']))
        g.append(f"[spf]scale={sw}:1080:flags=lanczos,unsharp=5:5:0.4[spk]")
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
            # The band under the pictures is solid ink: drawbox on a clear rgba canvas left it see-through, so
            # the full-frame speaker showed at its sides, a bigger Krish behind Krish (Krish, 2026-10-14:
            # "I also really hate my larger self in the background of the split screen").
            g.append(f"color=c=0x0C151200:s=1080x1920:r={FPS}:d={total:.3f},format=rgba[cvc{r_i}]")
            g.append(f"color=c=0x0C1512:s=1080x920:r={FPS}:d={total:.3f},format=rgba[ink{r_i}]")
            g.append(f"[cvc{r_i}][ink{r_i}]overlay=x=0:y=1000[cv{r_i}]")
            g.append(f"[fc{r_i}]format=rgba[fa{r_i}]")
            g.append(f"[cv{r_i}][fa{r_i}]overlay=x={(1080 - fw_out) // 2}:y=1000[c{r_i}_0]")
            cur = f'c{r_i}_0'
            layers = panel_layers(run)
            for j, (c, f, stop) in enumerate(layers):
                inputs += card_input(P(c['panel'].replace('{aspect}', asp)), c['s'], stop)
                if j == 0:
                    f = f.split(',', 1)[1] if ',' in f else 'null'   # the layer itself fades in
                if j == len(layers) - 1:
                    f = ','.join(x for x in f.split(',') if not x.startswith('fade=t=out')) or 'null'
                g.append(f"[{n}:v]format=rgba,{f}[pp{n}]")
                g.append(f"[{cur}][pp{n}]overlay=0:0:enable='between(t,{c['s']},{stop})'[c{r_i}_{j + 1}]")
                cur, n = f'c{r_i}_{j + 1}', n + 1
            # With a clip in front, the first split-screen run must already
            # be opaque at the cut. Fading it over the full-frame speaker
            # creates a short double-image immediately after the intro.
            fade_in='' if intro is not None and r_i==0 and rs<=1/FPS else f'fade=t=in:st={rs}:d={FADE_S}:alpha=1,'
            g.append(f"[{cur}]{fade_in}fade=t=out:st={max(rs, re_ - FADE_S):.3f}:d={FADE_S}:alpha=1[run{r_i}]")
            g.append(f"[{last}][run{r_i}]overlay=0:0:enable='between(t,{rs},{re_})'[s{k}]")
            last, k = f's{k}', k + 1
    else:
        for c, f, stop in panel_layers(wins):
            card = P(c['panel'].replace('{aspect}', asp))
            inputs += card_input(card, c['s'], stop)
            g.append(f"[{n}:v]format=rgba,{card_fit(card, 1920 - px if px else 1920, 1080)}{f}[pp{n}]")
            g.append(f"[{last}][pp{n}]overlay=x={px}:y={py}:enable='between(t,{c['s']},{stop})'[s{k}]")
            last, n, k = f's{k}', n + 1, k + 1
    dress = cfg['dress'].get(asp) if isinstance(cfg.get('dress'), dict) else None
    if dress:
        # The brand's dress from the first frame to the end card (house rule
        # HOOK_IS_THE_INTRO, Krish, 2026-10-29: the hook is the intro): the
        # makeyourmindup wordmark and the series tag in the top corners, as
        # the Friday 23 October tall cut has them. kit.py draws it from the
        # brand's own wordmark; a transparent whole frame laid over the
        # pictures, under the captions, with no entrance of its own.
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{total:.3f}', '-i', str(P(dress))]
        g.append(f"[{last}][{n}:v]overlay=0:0[s{k}]")
        last, n, k = f's{k}', n + 1, k + 1
    elif asp == '9x16' and intro is None and cfg.get('logo', True) is not False:
        # A config kit.py did not dress: the makeyourmindup logo in the opening
        # seconds of the tall video (Krish, 2026-10-07: "put the Make Your Mind
        # Up logo in the first few seconds of the video somewhere on vertical
        # video"). The PNG is the whole frame, transparent, so it says where the
        # logo sits. With an opening clip in front it is left out: the clip
        # carries the brand, and a second logo entrance after it is not wanted.
        lg = cfg['logo'] if isinstance(cfg.get('logo'), dict) else {}
        secs = lg.get('seconds', 3.0)
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{total:.3f}', '-i', str(P(lg['png']) if lg.get('png') else default_logo(out))]
        g.append(f"[{n}:v]format=rgba,fade=t=out:st={max(0.0, secs - 0.4):.2f}:d=0.4:alpha=1[lg]")
        g.append(f"[{last}][lg]overlay=0:0:enable='between(t,0,{secs:.2f})'[s{k}]")
        last, n, k = f's{k}', n + 1, k + 1
    if cfg.get('scoreboard'):
        import scoreboard
        g.extend(scoreboard.graph(last,'scored_main',asp,total,cfg['scoreboard']))
        last='scored_main'
    # Overlay inputs include a fade tail. Bound the composed main picture to
    # its exact frame count before concat, so that tail cannot delay the outro.
    main_clock = f'fps={FPS},trim=end_frame={round(total*FPS)},setpts=N/({FPS}*TB),setsar=1,format=yuv420p'
    if cfg.get('captions', True) is False:
        # No captions in the picture: the caption file goes to the platform instead (episode.py).
        g.append(f"[{last}]{main_clock}[vm]")
    else:
        g.append(f"[{last}]ass={cfg['name']}-{asp}.ass:fontsdir=fonts,{main_clock}[vm]")
    inputs += ['-i', str(end['file'])]
    held = f",tpad=stop_mode=clone:stop_duration={end['held_s']:.3f}" if end.get('held_s') else ''
    g.append(f"[{n}:v]fps={FPS},setsar=1,format=yuv420p{held},trim=end_frame={end['frames']},setpts=PTS-STARTPTS[ev]")
    n += 1
    parts = ['[vm]', '[ev]']
    if intro:
        inputs += ['-i', str(intro['file'])]
        g.append(f"[{n}:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x0C1512,"
                 f"setsar=1,format=yuv420p,trim=end_frame={intro['frames']},setpts=PTS-STARTPTS[iv]")
        n += 1
        parts.insert(0, '[iv]')
    g.append(f'{"".join(parts)}concat=n={len(parts)}:v=1:a=0[V]')
    inputs += ['-i', str(mix)]
    return bounded_decode_inputs(inputs), g, f'{n}:a'


def default_levels():
    """The ledger's levels, for a cut with no music (its loudness targets)."""
    try:
        return music.levels_of(music.load())
    except music.MusicError:
        return {'final_integrated_lufs': -14, 'tolerance_lu': 1, 'max_true_peak_dbtp': -1.0, 'bed_lufs': -31}


def cut_plan(cfg, asp, P, main_frames, ws, base='.'):
    """What one shape's cut will be, before anything is rendered: its opening,
    its end card, its clock, its music and anything to say about them."""
    notes = []
    intro, note = resolve_intro(cfg, asp, P, base)
    notes += [note] if note else []
    end_file = P(cfg['endcard'][asp])
    end = {'file': end_file, **clip_info(end_file)}
    hold = cfg.get('end_hold_s')
    if isinstance(hold, (int, float)) and hold > 0:
        # A long episode's close: the end card's last frame held, so YouTube's end-screen tiles sit over it
        # (Krish, 2026-10-16, agreeing to a 15 to 20 second close for long episodes; episode.py).
        end['held_s'] = float(hold)
        end['frames'] += round(hold * FPS)
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


def episode_extras(cfg, P, ws, wins, toks, tl):
    """The long-episode files and checks for one shape, on the finished cut's
    clock (episode.py): the caption file, the description's chapter lines and
    the end-screen space. (what the report says, warnings, files to write)."""
    srt_text = episode.srt(toks, tl['intro_s'])
    lines, warns = [], []
    chs = episode.chapters_of(cfg, P)
    if chs:
        starts = []
        for c in chs:
            hit = find_loose(ws, c['starts'])
            starts.append(ws[hit[0]]['s'] if hit else None)
        lines, warns = episode.chapter_list(chs, starts, tl['intro_s'])
    warns += episode.end_screen_warnings(wins, tl['intro_s'], tl['total_s'], cfg.get('end_screen_s'))
    framing = cfg.get('_framing') or []
    said = {'captions_burned': cfg.get('captions', True) is not False, 'caption_lines': srt_text.count(' --> '),
            'chapters': lines, 'voice': cfg.get('voice') or 'plain',
            'framings': {'push': sum(1 for *_, s in framing if s == episode.PUSH), 'close': sum(1 for *_, s in framing if s == episode.TIGHT)},
            'end_screen_from_s': round(tl['total_s'] - cfg['end_screen_s'], 2) if cfg.get('end_screen_s') else None}
    return said, warns, {'srt': srt_text, 'chapters': '\n'.join(lines) + '\n' if lines else None}


def measure_cut(final, tl, cut_audio):
    """The finished file's loudness after the encode: integrated, true peak,
    each stretch (any opening clip, his voice, the end card after the bed has
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
    loud['music_mode']=(cut_audio['music'] or {}).get('mode')
    loud['voice_stem_lufs']=at(cut_audio['dialog'],voice)
    loud['music_continuity']=(cut_audio['music'] or {}).get('continuity')
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
    if loud['true_peak'] is None or loud['true_peak'] > levels['max_true_peak_dbtp']:
        out.append(f'true peak {loud["true_peak"]} dBTP is over {levels["max_true_peak_dbtp"]} dBTP')
    if loud.get('music_mode')=='episode_bed':
        voice=loud.get('voice_stem_lufs')
        if voice is None or abs(voice-target)>tol:
            out.append(f'voice stem {voice} LUFS is outside {target} +-{tol} LU')
        if (loud.get('music_continuity') or {}).get('status')!='pass':
            out.append('continuous music measurement has not passed')
    elif loud['bed_to_voice_lu'] is not None:
        want = target - levels['bed_lufs']
        if abs(loud['bed_to_voice_lu'] - want) > 2:
            out.append(f'the bed sits {loud["bed_to_voice_lu"]} LU under his voice, not about {want:g} LU')
    if loud['normalisation'] not in ('linear','separately levelled stems; peak limiter only'):
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
    checks.append(('a raw words file goes onto the sped clock (Krish, 19 Oct: subtitles lagging)',
                   sped_words([{'w': 'a', 's': 11.0, 'e': 22.0}], 1.1), [{'w': 'a', 's': 10.0, 'e': 20.0}]))
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
    checks.append(('a branded intro is not followed by a second logo entrance',
                   any("overlay=0:0:enable='between(t,0,3.00)'" in line for line in g), False))
    checks.append(('the sting goes first in the join, with no sound of its own in the picture graph', g[-1], '[iv][vm][ev]concat=n=3:v=1:a=0[V]'))
    checks.append(('the sound is the finished mix', audio, '3:a'))
    first_picture=[{'id':'first','panel':'card.png','s':0.0,'e':4.0}]
    _, split_graph, _ = video_graph(fake, '9x16', same, Path('.'), Path('edited.mkv'), 20.0,
        first_picture, ws, [720, 1280, 0, 0], {'file':'sting.mp4','frames':45},
        {'file':'end.mp4','frames':120}, Path('mix.wav'))
    first_run=next(line for line in split_graph if line.endswith('[run0]'))
    checks.append(('the first split is fully visible after an intro, without a double presenter',
        'fade=t=in:' not in first_run, True))
    _, g, audio = video_graph(fake, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, [], ws, [720, 1280, 0, 0], None, {'file': 'end.mp4', 'frames': 120}, Path('mix.wav'))
    checks.append(('without an intro the opening logo is retained',
                   any("overlay=0:0:enable='between(t,0,3.00)'" in line for line in g), True))
    checks.append(('without a sting it is the main and the end card', (g[-1], audio), ('[vm][ev]concat=n=2:v=1:a=0[V]', '3:a')))
    _, split_graph, _ = video_graph(fake, '9x16', same, Path('.'), Path('edited.mkv'), 20.0,
        first_picture, ws, [720, 1280, 0, 0], None,
        {'file':'end.mp4','frames':120}, Path('mix.wav'))
    first_run=next(line for line in split_graph if line.endswith('[run0]'))
    checks.append(('without an intro the first split still eases over the speaker',
        'fade=t=in:' in first_run, True))
    _, g, _ = video_graph(fake, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, [], ws, [720, 1280, 0, 0], None,
                          {'file': 'end.mp4', 'frames': 510, 'held_s': 13.0}, Path('mix.wav'))
    checks.append(('a long episode\'s end card holds its last frame for the end-screen tiles',
                   any('tpad=stop_mode=clone:stop_duration=13.000,trim=end_frame=510' in line for line in g), True))
    # The hook is the intro (house rule HOOK_IS_THE_INTRO, Krish, 2026-10-29): "auto" puts no clip in front. The retired
    # sting says nothing; until its retirement is approved in the taste-guarded config, the unapproved candidate says why.
    status_now = sting.load()['status']
    clip, why = resolve_intro({'name': 't'}, '9x16', same)
    checks.append(('"intro": "auto" opens on the hook with no clip, and says nothing once the sting is retired',
                   (clip, status_now in ('candidate', 'retired'), why is None if status_now == 'retired' else 'candidate' in (why or '')),
                   (None, True, True)))
    checks.append(('each cut records what it opened on, so engagement can settle the choice',
                   (opening_of(None), opening_of({'source': 'override', 'file': Path('clip.mp4'), 'seconds': 3.0})['kind']),
                   ({'kind': 'hook', 'rule': 'HOOK_IS_THE_INTRO'}, 'clip')))
    dressed = dict(fake, dress={'9x16': 'dress-9x16.png'})
    _, g, _ = video_graph(dressed, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, [], ws, [720, 1280, 0, 0], None,
                          {'file': 'end.mp4', 'frames': 120}, Path('mix.wav'))
    dress_line = [line for line in g if line.endswith('overlay=0:0[s2]')]
    checks.append(('the tall cut wears its dress from the first frame to the end card, with no window, fade or entrance',
                   (len(dress_line), any('dress-9x16.png' in str(x) for x in _), any('enable=' in line or 'fade' in line for line in dress_line)),
                   (1, False, False)))
    inputs_dressed, _, _ = video_graph(dressed, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, [], ws, [720, 1280, 0, 0], None,
                                       {'file': 'end.mp4', 'frames': 120}, Path('mix.wav'))
    checks.append(('the dress is kit.py\'s picture, and it replaces the three-second opening logo',
                   ('dress-9x16.png' in inputs_dressed, any("enable='between(t,0,3.00)'" in line for line in g)), (True, False)))
    _, g, _ = video_graph(dressed, '9x16', same, Path('.'), Path('edited.mkv'), 20.0, first_picture, ws, [720, 1280, 0, 0], None,
                          {'file': 'end.mp4', 'frames': 120}, Path('mix.wav'))
    order = [i for i, line in enumerate(g) if line.endswith('[run0]') or ('[s' in line and line.endswith('overlay=0:0[s3]'))]
    checks.append(('the dress sits over the pictures, so the corners stay on through them', len(order) == 2 and order[0] < order[1], True))
    # No name on screen (Krish, 2026-10-28: "Remember, no content refers to Krish, ever.").
    strap = strap_problem({'strap': {'png': 'strap-9x16.png', 'after': 'so'}})
    import tempfile as _st
    with _st.TemporaryDirectory() as tmp:
        strapped = Path(tmp) / 'strapped.json'
        strapped.write_text(json.dumps({'name': 't', 'source': 'none.mp4', 'strap': {'png': 'strap-9x16.png'}}))
        ran = subprocess.run([sys.executable, str(Path(__file__).resolve()), str(strapped), '--out', str(Path(tmp) / 'out'), '--plan'],
                             capture_output=True, text=True)
    checks.append(('make.py stops on a strap config before it reads anything else', (ran.returncode != 0, 'no content refers to Krish, ever' in ran.stderr),
                   (True, True)))
    checks.append(('a strap config is refused, quoting his ruling and naming the dress to put in its place; "strap": false is no matter',
                   (bool(strap) and 'no content refers to Krish, ever' in strap, '"dress": {"9x16": "dress-9x16.png"}' in (strap or ''),
                    strap_problem({'strap': False}), strap_problem({})), (True, True, None, None)))
    checks.append(('"intro": false is no intro and no note', resolve_intro({'intro': False}, '9x16', same), (None, None)))
    checks.append(('"music": false is no music and no note', resolve_music({'name': 't', 'music': False}, '9x16', 30), (None, None)))
    if not os.environ.get('MINDMAKE_MUSIC_LEDGER'):
        got, why = resolve_music({'name': 't'}, '9x16', 30)
        checks.append(('with no approved track the cut has voice only and says so', (got, 'voice only' in (why or '')), (None, True)))
    checks += caption_self_test()
    # The voice chain's delay is found, so it can be taken off (chain_latency).
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        dry, wet = Path(tmp) / 'dry.wav', Path(tmp) / 'wet.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=3:c=pink:r=48000:seed=7', str(dry)], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(dry), '-af', 'adelay=25|25', str(wet)], check=True)
        found = chain_latency(dry, wet)
    checks.append(('a voice chain 25 ms late is measured as 25 ms late', abs(found - 0.025) < 0.0005, True))
    checks += gate_self_test()
    import scoreboard
    rows=scoreboard.states([{'at_s':1,'grok':1,'muse':0},{'at_s':2,'grok':1,'muse':1}],3)
    checks.append(('one tally begins level and changes only at its point events',[(r['start'],r['end'],r['grok'],r['muse'])for r in rows],[(0.,1,0,0),(1,2,1,0),(2,3,1,1)]))
    for event in [{'at_s':1,'grok':2,'muse':0},{'at_s':1,'grok':-1,'muse':0},{'at_s':float('nan'),'grok':1,'muse':0}]:
        rejected=False
        try:scoreboard.states([event],3)
        except ValueError:rejected=True
        checks.append(('invalid or invented point event is refused: '+str(event),rejected,True))
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
    bands = [face_band(cw, ch, round(ch * 100 / 720), round(ch * 450 / 720)) for cw, ch in ((1080, 1920), (1920, 1080), (720, 1280))]
    checks.append(('the tall face band is filled edge to edge from inside the frame, never fitted with gaps a bigger Krish shows through',
                   all(abs(bw / bh - 1080 / 920) < 0.01 and bx >= 0 and by >= 0 for bx, by, bw, bh in bands), True))
    # His name never reaches a caption, nor a self-introduction under a misheard name (Krish, 2026-10-28).
    named = lambda *raw: [h['said'] for h in name_in_captions(tokens(heard(*raw), DEFAULT_FIXES), [{'s': 100.0 + n} for n in range(len(raw))])]
    checks.append(('"Chris" is no longer turned into his name', said(heard(' Chris', ' Lehane')), ['Chris', 'Lehane']))
    checks.append(('a self-introduction is found under any hearing of the name, and his name anywhere',
                   (named(' Hi,', " I'm", ' Chris,', ' and'), named(' My', ' name', ' is', ' Krish.'), named(' Krish\'s', ' test'),
                    named(' this', ' is', ' Krish', ' here')), (["I'm Chris,"], ['My name is Krish.'], ["Krish's"], ['Krish'])))
    checks.append(('another Chris, Christmas and Christine are not his name',
                   (named(' Chris', ' Lehane', ' said'), named(' This', ' is', ' Chris', ' Lehane\'s', ' view'), named(' Christmas'), named(' I\'m', ' Christine')),
                   ([], [], [], [])))
    checks.append(('another name that only starts with the letters of his is not his name',
                   (named(' Arvind', ' Krishna'), named(' Sriram', ' Krishnan'), named(' Krishi'), named(' Krishan', ' Raja'), named(' at', ' krishraja.com')),
                   ([], [], [], ['Krishan Raja'], ['krishraja.com'])))
    where = name_in_captions(tokens(heard(' So', " I'm", ' Krish.'), DEFAULT_FIXES), [{'s': 100.0 + n} for n in range(3)])
    refusal = name_refusal(where)
    checks.append(('the refusal names the time in the cut and in the take, and how to cut it',
                   (where[0]['cut_s'], where[0]['take_s'], '0:00.40 in the cut' in refusal, '1:41.00 in the take' in refusal, '"remove"' in refusal,
                    'no content refers to Krish, ever' in refusal), (0.4, 101.0, True, True, True, True)))
    import tempfile as _tf
    with _tf.TemporaryDirectory() as tmp:
        script = Path(tmp) / 'script.md'
        script.write_text('I put GrokBot and Muse head to head. ByteDance pays for it.\n', encoding='utf-8')
        hint = script_prompt(script)
    checks.append(('the transcriber\'s hint names the publication, never him', (hint.startswith('makeyourmindup. '), 'krish' in hint.lower()), (True, False)))
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
    # A name the script spells as one word is captioned whole (failure caption-splits-names).
    split = heard(' like', ' co', ' -work', ' and', ' chat,', ' GPT.', ' An', ' thropic', ' makes', ' it,', ' and', ' so', ' meone', ' else')
    names = script_names('He tried Cowork and ChatGPT. Anthropic makes it, and someone else.'.split())
    checks.append(('the script\'s names: an inner capital, or a capital where no sentence starts', names, ['Cowork', 'ChatGPT']))
    names = script_names('like Cowork and ChatGPT, and Anthropic makes it.'.split())
    checks.append(('a name the transcriber split is captioned whole, its punctuation kept; other words are left alone',
                   [t['w'].strip() for t in tokens(split, [], None, names)],
                   ['Like', 'Cowork', 'and', 'ChatGPT.', 'Anthropic', 'makes', 'it,', 'and', 'so', 'meone', 'else']))
    paused = heard(' co', ' -work')
    paused[1] = dict(paused[1], s=paused[0]['e'] + 0.6, e=paused[0]['e'] + 0.9)
    checks.append(('pieces with a pause between them are two words, not a split name', [t['w'].strip() for t in tokens(paused, [], None, ['Cowork'])],
                   ['Co', '-work']))
    loose = spelling_warnings(tokens(heard(' the', ' color', ' of', ' money'), DEFAULT_FIXES))
    checks.append(('a US spelling no script word covers is one warning naming it', (len(loose), '"color"' in ' '.join(loose)), (1, True)))
    checks.append(('a replacement in the config clears it', spelling_warnings(tokens(heard(' the', ' color'), DEFAULT_FIXES + [['color', 'colour']])), []))
    # The house captions (docs/STUDIO.md): the channel's shadow, one loud word on the mint swipe.
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        groups = chunks(tokens(heard(' Google', ' paid', ' $2', '.7', ' billion', ' and', ' 66', ' staff'), DEFAULT_FIXES), [])
        write_ass(Path(tmp) / 'h.ass', groups, [], '9x16', '#FFD84D')
        house = (Path(tmp) / 'h.ass').read_text(encoding='utf-8')
        write_ass(Path(tmp) / 'q.ass', groups, [], '9x16')
        quick = (Path(tmp) / 'q.ass').read_text(encoding='utf-8')
    swipes = [l for l in house.splitlines() if l.startswith('Dialogue: 1,')]
    checks.append(('house captions: the shadow is the channel\'s colour, 12 px in the tall shape',
                   ',&H004DD8FF,' in house and ',3,16,12,8,' in house, True))
    with_figure = sum(any(re.search(r'[0-9%$]', t['w']) for t in g) for g in groups)
    checks.append(('house captions: one loud word per line with a figure, its first figure, on the mint swipe',
                   (len(swipes) == with_figure > 0, [l.count(r'\3c&H00C0F07E') for l in swipes] == [1] * with_figure,
                    r'\3c&H00C0F07E\c&H0012150C\bord6\shad0}$2.7' in house), (True, True, True)))
    checks.append(('without "caption_style" the quick-edit captions are unchanged: no shadow, every figure in mint',
                   (',3,16,0,8,' in quick, 'Dialogue: 1,' in quick, quick.count(r'{\c&H00C0F07E}')), (True, False, 2)))
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
    # Decode a moving panel past its source duration: the native input must
    # loop the movie, rather than applying the still-image demuxer option.
    moving=work/'moving.mp4'
    ff('-f','lavfi','-i','testsrc2=s=128x72:r=5:d=0.4','-an','-c:v','libx264','-threads','1',moving)
    hashes=subprocess.check_output(['ffmpeg','-v','error',*card_input(moving,0,.8),'-map','0:v','-frames:v','4','-f','framemd5','-'],text=True)
    decoded=[line.split(',')[-1].strip()for line in hashes.splitlines()if line and not line.startswith('#')]
    checks.append(('moving evidence loops as moving pictures',len(decoded)==4 and decoded[0]!=decoded[1]and decoded[0]==decoded[2],True))
    # Regression: evaluating a future point at t=0 formerly overflowed the
    # font size before drawtext's enable expression could hide it.
    import scoreboard
    (work/'fonts').mkdir(exist_ok=True)
    shutil.copy2(Path(__file__).parent/'fonts/Anton.ttf',work/'fonts/Anton.ttf')
    score_graph=scoreboard.graph('0:v','v','9x16',100,{'events':[{'at_s':70,'grok':1,'muse':0}]})
    subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','color=s=1080x1920:r=24:d=0.1','-filter_complex',';'.join(score_graph),'-map','[v]','-frames:v','1','-threads','1','score.png'],cwd=work,check=True)
    checks.append(('a point seventy seconds ahead renders safely at the opening frame',(work/'score.png').is_file(),True))
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
    said = [{'w': w, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, w in enumerate('then the singers are going to get it'.split())]
    checks.append(('a cue line he said his own way is still found', find_loose(said, 'its singers get'), (2, 6)))
    # A restart cut never takes a finished sentence (Friday 16 October, "13:20").
    told = [{'w': w, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, w in enumerate(
        ' will start in automatic again. And you will drive it in auto. And paid users will start in automatic too'.split())]
    try:
        resolve_removals(told, [{'restart_near': '0:07.6'}])
        checks.append(('a restart cut holding a finished sentence is refused, with the words it would take', False, True))
    except SystemExit as e:
        checks.append(('a restart cut holding a finished sentence is refused, with the words it would take',
                       'finished sentence' in str(e) and 'again.' in str(e), True))
    # A cut the pads keep is named; one that takes out sound is not.
    pads = [{'w': w, 's': s, 'e': e} for w, s, e in (('found', 0.0, 0.4), ('a', 0.45, 0.5), ('better', 0.55, 0.9), ('way', 0.95, 1.3))]
    kept, _ = segments(pads, [(1, 1)], 0.9, 0.2, 0.3, 2.0)
    checks.append(('a cut row the pause rule\'s pads put back is a warning', len(thin_cuts(pads, [(1, 1)], kept)), 1))
    kept2, _ = segments(pads, [(1, 2)], 0.9, 0.0, 0.0, 2.0)
    checks.append(('a cut that takes out sound is not', thin_cuts(pads, [(1, 2)], kept2), []))
    # Every window starts on a frame, never before a removed word's end or after its own first word (lip sync).
    late = [{'w': w, 's': s, 'e': e} for w, s, e in (('Disney', 0.21, 0.87), ('has', 0.9, 1.0), ('gone', 1.31, 1.6), ('now', 2.73, 3.0))]
    framed, _ = segments(late, [(2, 2)], 0.9, 0.2, 0.3, 4.0, protect_removals=True)
    checks.append(('a window that would start between frames starts on the next frame, after any removed word, before its first word',
                   [(abs(g['a'] * FPS - round(g['a'] * FPS)) < 1e-3, g['a'] >= (late[g['idx'][0] - 1]['e'] if g['idx'][0] == 3 else 0),
                     g['a'] <= late[g['idx'][0]]['s']) for g in framed], [(True, True, True), (True, True, True)]))
    checks.append(('a join made by a cut row is told from a pause cut',
                   removal_joins([{'off': 0.0, 'idx': [0, 1]}, {'off': 1.0, 'idx': [3, 4]}, {'off': 2.0, 'idx': [5]}], [(2, 2)]), [1.0]))
    checks.append(('a join with no framing change and no picture over it is listed',
                   bare_joins([{'off': 0.0}, {'off': 3.0}, {'off': 5.0}, {'off': 8.0}], [(3.0, 8.0, 0.9)], [{'s': 4.5, 'e': 6.0}]), []))
    checks.append(('a push-in starting just after a hidden cut starts on it; one with no cut near keeps its start',
                   (snap_to_join(10.3, 10.4, [{'off': 0.0}, {'off': 10.0}]), snap_to_join(20.3, 20.4, [{'off': 0.0}, {'off': 10.0}])), (10.0, 20.3)))
    checks.append(('and found when nothing covers it',
                   bare_joins([{'off': 0.0}, {'off': 3.0}, {'off': 4.0}], [(3.0, 9.0, 0.9)], []), [4.0]))
    # The cut's rate is the take's own: about 24 fps from teleprompter.com is made at 24, never 30.
    uneven = work / 'uneven-24.mp4'
    ff('-f', 'lavfi', '-i', 'color=c=0x0C1512:s=108x192:r=24:d=2', '-vf', "setpts='PTS+0.002*sin(N)/TB'", '-fps_mode', 'passthrough',
       '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', uneven)
    checks.append(('a take at about 24 fps is cut at 24; at 30, at 30; "fps" in the config wins',
                   (render_fps({}, uneven), render_fps({}, end), render_fps({'fps': 25}, uneven)), (24, 30, 25)))
    try:
        render_fps({'fps': 29.97}, uneven)
        checks.append(('an "fps" that is not a house rate is refused', False, True))
    except ValueError:
        checks.append(('an "fps" that is not a house rate is refused', True, True))
    global FPS
    keep = FPS
    try:
        FPS = 24
        at24, _ = segments([{'w': 'a', 's': 1.0, 'e': 1.37}], [], 0.35, 0.1, 0.16, 5.0)
    finally:
        FPS = keep
    checks.append(('a take at 24 on average is laid one frame a period; one at 29.97 cut at 30 is resampled',
                   (conform_filter(24.00047, 24).startswith('setpts=N/(24*TB)'), conform_filter(29.97, 30).startswith('fps=30'),
                    conform_filter(None, 24).startswith('fps=24')), (True, True, True)))
    checks.append(('at 24 fps every window is a whole number of frames', round((at24[0]['b'] - at24[0]['a']) * 24, 6) == round((at24[0]['b'] - at24[0]['a']) * 24), True))
    checks.append(('a line he never said is not found', find_loose(said, 'labels pay songwriters'), None))
    paged = expand_pages([{'id': 'm', 'panel': 'x', 's': 10.0, 'e': 16.0, 'pages': {'9x16': ['p1', 'p2', 'p3']}}], '9x16')
    checks.append(('a picture in pages is shown a part at a time, touching, over its window',
                   [(c['panel'], c['s'], c['e']) for c in paged], [('p1', 10.0, 12.0), ('p2', 12.0, 14.0), ('p3', 14.0, 16.0)]))
    checks.append(('pages for another shape leave the picture whole', len(expand_pages(paged[:1] and [{'id': 'm', 'panel': 'x', 's': 1, 'e': 2, 'pages': {'9x16': ['a', 'b']}}], '16x9')), 1))
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
                'afade', 'apad', 'atrim', 'tpad', 'anullsrc') + episode.FILTERS
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
    add('node', 'ok' if shutil.which('node') else 'warn', shutil.which('node') or 'not on the PATH: the story outro cannot be rendered here')
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
        if s['status'] == 'retired':
            add('opening', 'ok', f'every cut opens on the hook (house rule {s["retired"]["rule"]}, Krish, {s["retired"]["on"]}); the sting is retired')
        else:
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


def direction_problem(cfg):
    """Why this config may not render, or None. Krish, 2026-10-24: production takes over from the scripts and visual
    creative direction Claude locked; from 26 Oct a cut renders only from the signed direction kit.py checked, and only
    while that file is byte for byte what was checked (docs/CREATIVE_DIRECTION.md)."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
    import creative_direction
    from datetime import date as _date
    piece = str(cfg.get('piece_id') or '')
    if not cfg.get('date') and not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', piece, re.I):
        return None  # a synthetic render (mix_test.py's media) is no piece; kit.py writes the date and piece id on every piece
    try:
        day = _date.fromisoformat(str(cfg.get('date') or '')[:10])
    except ValueError:
        day = creative_direction.FROM
    if day < creative_direction.FROM:
        return None
    rec = cfg.get('creative_direction')
    if not isinstance(rec, dict) or not rec.get('path'):
        return ('no signed creative direction in this config: draw the kit with kit.py, which checks '
                'creative-direction.json beside post.json (docs/CREATIVE_DIRECTION.md)')
    path = Path(rec['path'])
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != rec.get('sha256'):
        return f'{path} changed (or is gone) since kit.py checked it; check it again and redraw the kit'
    return None


def main():
    global FPS
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    if sys.argv[1:2] == ['--doctor']:
        sys.exit(doctor('--json' in sys.argv[2:]))
    ap = argparse.ArgumentParser()
    ap.add_argument('config')
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', choices=['9x16', '16x9'])
    ap.add_argument('--plan', action='store_true', help='print the cuts, graphic windows, intro and music, render nothing')
    ap.add_argument('--prepare-only',action='store_true',help='build and verify the edited intermediate, then stop before graphics and mixing')
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
    strapped = strap_problem(cfg)
    if strapped:
        sys.exit(f'make: {strapped}')
    held = direction_problem(cfg)
    if held and not args.plan:
        sys.exit(f'make: {held}')
    import media_standard
    media_standard.preflight(cfg, base, full_production=not args.plan and not args.prepare_only)
    cfg['quality_required'] = True
    archiving = archive_settings(args, cfg)
    P = lambda p: (base / p).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if cfg.get('motion_composition'):
        if args.only != '9x16' or args.archive is not None or args.prepare_only:
            ap.error('Continuous motion composition currently supports --only 9x16 and working renders only')
        import motion_compose
        motion_compose.compose(cfg,base,out,sys.modules[__name__],plan_only=args.plan)
        return
    src = P(cfg['source'])
    # A take sped up before anything else, only on Krish's own words (episode.py, "speed").
    try:
        speed = episode.speed_settings(cfg)
    except episode.EpisodeError as e:
        sys.exit(f'make: {e}')
    try:
        FPS = render_fps(cfg, src)
    except ValueError as e:
        sys.exit(f'make: {e}')
    tag = ''
    if speed:
        src, tag = episode.sped_source(src, out, speed[0], FPS, conform_filter(source_rate(src), FPS).startswith('setpts')), f'.speed-{speed[0]:.3f}'
    conform = conform_filter(source_rate(src), FPS)
    dur = float(json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(src)], capture_output=True, text=True).stdout)['format']['duration'])
    wpath = P(cfg['words']) if cfg.get('words') else out / f"{cfg['name']}{tag}.words.json"
    if cfg.get('words_sha256') and (not wpath.exists() or quality.digest(wpath)!=cfg['words_sha256']):
        sys.exit('Transcript document differs from the reviewed word and timing adjudications')
    transcript_model = cfg.get('model', 'small.en')
    identity = quality.transcript_identity(src, speed[0] if speed else 1, transcript_model)
    document = json.loads(wpath.read_text(encoding='utf-8')) if wpath.exists() else None
    if document is not None and (document.get('provenance') or cfg.get('quality_required')):
        words = quality.checked_words(document, identity)
    elif document is not None:
        words = document['words']
    else:
        words = transcribe(src, wpath, transcript_model,
                           cfg.get('prompt') or (script_prompt(P(cfg['script'])) if cfg.get('script') else ''), identity)

    cuts = resolve_removals(words, cfg.get('remove', []) + cfg.get('remove_words', []))
    try:
        # A mishearing the words gate may forgive carries Krish's own words; refused here, before any render.
        words_gate.heard_as_rows({'heard_as': cfg.get('heard_as', [])})
    except words_gate.WordsGateError as error:
        sys.exit(f'heard_as: {error}')
    if speed and cfg.get('words') and document and not document.get('provenance'):
        # A words file named in the config was heard from the take before it was sped up, so its times are on
        # the raw clock: put them on the sped clock, or the cut points, captions and cards all land late, more
        # so as it goes. Friday 16 Oct's 90-second cut at 1.10x (Krish, 19 Oct: "the subtitles are lagging
        # severely", "the video lingers after I've finished my script"). After resolve_removals, whose
        # restart_near reads the raw clock; a transcript made here is already on the sped clock.
        words = sped_words(words, speed[0])
    segs, total = segments(words, cuts, cfg.get('max_gap', 0.35), cfg.get('pad_before', 0.18), cfg.get('pad_after', 0.25), dur,protect_removals=cfg.get('quality_required',False))
    if cfg.get('quality_required'):
        cut_errors = quality.cut_problems(words,segs,cuts)
        if cut_errors:
            sys.exit('Word boundary gate: '+ '; '.join(cut_errors))
    ws = retime(words, segs)
    wins, missing = cue_windows(ws, cfg.get('cues') or [], total,strict=cfg.get('quality_required',False))
    if cfg.get('quality_required') and missing:
        sys.exit('Missing spoken cue anchors: '+', '.join(missing))
    early = picture_warnings(cfg, base)
    # The episode framings: a push under each hidden cut, closer on a pivotal line (episode.py).
    emphasis = []
    for e in cfg.get('emphasis') or []:
        a = find_loose(ws, e['start'])
        b = find_loose(ws, e['end'], after=ws[a[0]]['s']) if a else None
        if a and b:
            emphasis.append((snap_to_join(max(0.0, ws[a[0]]['s'] - 0.1), ws[a[0]]['s'], segs), round(min(total, ws[b[1]]['e'] + 0.3), 3)))
        else:
            early.append(f'the emphasis "{e["start"]}" ... "{e["end"]}" was not found in what he said, so that line keeps its framing')
    if cfg.get('reframe') or emphasis:
        # A join made by a cut row has its framing change first; a plain pause cut gives way to it.
        cfg['_framing'] = episode.framing_windows(segs if cfg.get('reframe') else segs[:1], total, emphasis,
                                                  prefer=removal_joins(segs, cuts) if cfg.get('reframe') else ())
        bare = bare_joins(segs, cfg['_framing'], wins, 1 / FPS) if cfg.get('reframe') else []
        if bare:
            early.append(f'{len(bare)} hidden cut(s) have no framing change and no picture over them, so a viewer may see the jump: '
                         + ', '.join(f'{t // 60:.0f}:{t % 60:05.2f}' for t in bare) + ' (edited clock). Look at each in the preview')
    early += thin_cuts(words, cuts, segs)
    if speed:
        early.append(f'the take is sped up {speed[0]:g} times, picture and sound, pitch kept, as Krish said: "{speed[1]}"')
    # The captions spell a word as the script does (house rule BRITISH_SPELLING).
    spell = spellings(ws, script_words(cfg, P))
    # And a name the script spells as one word is captioned whole, however the transcriber split it.
    names = script_names(script_words(cfg, P))
    # His name never reaches a caption (Krish, 2026-10-28), checked before anything renders.
    named = name_in_captions(tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []), spell, names), words)
    if named:
        sys.exit(f'make: {name_refusal(named)}')
    spelt = [{'heard': ws[i]['w'], 'script': respell(ws[i]['w'], w), 'at': ws[i]['s']} for i, w in sorted(spell.items())]
    if cfg['crop'] == 'auto':
        cfg['crop'] = auto_crop(src, dur)
        print(f"crop auto: {cfg['crop']}", file=sys.stderr)
    cw, ch, cx, cy = cfg['crop']
    # The face band under a tall graphic: 100 to 550 down a 720-high picture
    # kept the eyes in frame for the launch videos, so scale that by default.
    cfg.setdefault('face', [round(ch * 100 / 720), round(ch * 450 / 720)])
    aspects = [args.only] if args.only else ['9x16', '16x9']
    visual_checks = {}
    if cfg.get('quality_required') and '9x16' in aspects:
        visual_checks = quality.coverage(expand_pages(wins, '9x16', ws), 0, total)
        problems = quality.coverage_problems(visual_checks)
        if problems:
            sys.exit('Visual gate: ' + '; '.join(problems) + '\n' + json.dumps(visual_checks))
    # The main's length in whole frames: every window is whole frames already.
    main_frames = sum(max(1, round((g['b'] - g['a']) * FPS)) for g in segs)
    if args.plan:
        toks = tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []), spell, names)
        toks,_=reviewed_caption_tokens(cfg,P,toks,identity,out/f"{cfg['name']}.edited.mkv",total)
        if name_in_captions(toks, words):
            sys.exit(f'make: {name_refusal(name_in_captions(toks, words))}')
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
            said, warns, _ = episode_extras(cfg, P, ws, wins, toks, tl)
            shapes[asp] = {'opening': opening_of(plan['intro']),
                           'intro': plan['intro'] and str(plan['intro']['file']), 'intro_source': plan['intro'] and plan['intro']['source'],
                           'intro_series': plan['intro'] and plan['intro']['series'], 'music': plan['bed'] and plan['bed']['track']['id'],
                           'intro_seconds': tl['intro_s'], 'main_seconds': tl['main_s'], 'outro_seconds': tl['outro_s'],
                           'total_seconds': tl['total_s'], 'episode': said, 'warnings': plan['warnings'] + warns}
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
    import segment_clock
    plan_lines = [f"sample-exact-v2 fps {FPS} {conform} source {sha256_file(src)}"] + [f"{g['a']:.8f} {g['b']:.8f} source_end={g.get('source_end')} crop={cw}:{ch}:{cx}:{cy}" for g in segs]
    g1 = out / 'stage1.plan'
    # The cut only changes when the words to remove or the pause rule change, so reuse it otherwise.
    if not (edited.exists() and g1.exists() and g1.read_text() == '\n'.join(plan_lines)):
        parts = out / 'parts'
        parts.mkdir(exist_ok=True)
        cached_parts = {}
        for stamp in parts.glob('*.mkv.clock.json'):
            try:
                recipe_data = json.loads(stamp.read_text())['recipe']
                cached_parts[json.dumps(recipe_data, sort_keys=True)] = Path(str(stamp).removesuffix('.clock.json'))
            except (OSError, ValueError, KeyError):
                continue
        names = []
        source_hash=sha256_file(src)
        for i, g in enumerate(segs):
            d = g['b'] - g['a']
            frames = round(d * FPS)
            vf=f'crop={cw}:{ch}:{cx}:{cy},{conform}'
            recipe={'version':2,'source_sha256':source_hash,'start':g['a'],'frames':frames,
                    'fps':FPS,'video_filter':vf,'source_end':g.get('source_end')}
            key = json.dumps(recipe, sort_keys=True)
            part = cached_parts.get(key, parts / (hashlib.sha256(key.encode()).hexdigest()[:24] + '.mkv'))
            if not segment_clock.reusable(part,recipe):
                run(segment_clock.encode_args(src,part,g['a'],frames,FPS,vf,source_end=g.get('source_end')),quiet=True)
                segment_clock.save_stamp(part,recipe)
            names.append(f"file '{part.as_posix()}'")
        listing = parts / 'list.txt'
        listing.write_text('\n'.join(names) + '\n')
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listing, '-c', 'copy', edited])
        segment_clock.require(edited,sum(round((g['b']-g['a'])*FPS) for g in segs),FPS)
        g1.write_text('\n'.join(plan_lines))
    if args.prepare_only:
        print(json.dumps({'edited':str(edited),'clock':segment_clock.require(edited,main_frames,FPS),
                          'source_provenance':identity,'status':'prepared_not_deliverable'},indent=2))
        return
        # The join holds every frame, so the parts only double the disk a long take needs
        # (a 14-minute take filled a cloud session's allowance on 2026-10-17).
        for part in parts.glob('*.mkv'):
            part.unlink()
    loud = measure_loudness(edited)
    # The dialogue repair (episode.py), before any level is set, so the level is set on the voice as it will be heard.
    voice_src, repaired = edited, None
    if cfg.get('voice') == 'repair':
        voice_src = out / f"{cfg['name']}.voice.wav"
        stamp, want = out / 'voice.plan', f'{edited.stat().st_size} {edited.stat().st_mtime_ns} {episode.VOICE_REPAIR} latency-v1'
        held = out / 'voice.latency.json'
        if not (voice_src.exists() and stamp.exists() and stamp.read_text() == want and held.exists()):
            raw = out / f"{cfg['name']}.voice.raw.wav"
            run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(edited), '-vn', '-af', f'{NORM},{episode.VOICE_REPAIR}',
                 '-c:a', 'pcm_f32le', str(raw)])
            # The chain's FFT denoiser (afftdn) delays the voice by about a frame (25 ms on Monday 26 Oct's takes), and
            # nothing downstream knows: measure it against the untreated voice and take it off, so lips and voice stay together.
            lag = chain_latency(edited, raw)
            shift = round(lag * RATE)
            if shift > 0:
                run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(raw), '-af',
                     f'atrim=start_sample={shift},asetpts=PTS-STARTPTS,apad=pad_len={shift}', '-c:a', 'pcm_f32le', str(voice_src)])
                raw.unlink()
            else:
                raw.replace(voice_src)
            held.write_text(json.dumps({'measured_ms': round(lag * 1000, 2), 'removed_samples': max(0, shift)}))
            stamp.write_text(want)
        repaired = {'chain': episode.VOICE_REPAIR, 'before_lufs': loud['input_i'], 'before_lra': loud.get('input_lra'),
                    'latency': json.loads(held.read_text())}
        loud = measure_loudness(voice_src)
        repaired.update(after_lufs=loud['input_i'], after_lra=loud.get('input_lra'))
    # Sniffs (episode.sniffs; Krish, 2026-10-17: "dampen that out surgically"): found only in the gaps between his
    # words and turned down with soft fades, never cut, so no word, timing or lip sync moves. On unless "desniff": false.
    sniffed = []
    if cfg.get('desniff', True):
        sniffed = episode.sniffs(voice_src, ws)
        if sniffed:
            dst = out / f"{cfg['name']}.desniff.wav"
            stamp2, want2 = out / 'desniff.plan', f'{voice_src.stat().st_size} {voice_src.stat().st_mtime_ns} {json.dumps(sniffed)}'
            if not (dst.exists() and stamp2.exists() and stamp2.read_text() == want2):
                episode.duck(voice_src, dst, sniffed)
                stamp2.write_text(want2)
            voice_src = dst
    voice_in = float(loud['input_i'])
    toks = tokens(ws, DEFAULT_FIXES + cfg.get('replacements', []), spell, names)
    retained_source_tokens = list(toks)
    toks,caption_repairs=reviewed_caption_tokens(cfg,P,toks,identity,edited,total)
    if name_in_captions(toks, words):
        sys.exit(f'make: {name_refusal(name_in_captions(toks, words))}')
    early += spelling_warnings(toks)
    bounds = sorted({c['s'] for c in wins} | {c['e'] for c in wins})
    groups = chunks(toks, bounds)
    report = {'name': cfg['name'], 'source_seconds': round(dur, 2), 'cut_seconds': total, 'segments': len(segs),
              'cues': [{k: c[k] for k in ('id', 's', 'e')} for c in wins], 'missing_cues': missing,
              'captions': len(groups), 'spellings': spelt, 'loudness_in': loud['input_i'],
              **({'voice_repair': repaired} if repaired else {}),
              'sniffs': [{'at': f"{e['s'] // 60:.0f}:{e['s'] % 60:05.2f}", **e} for e in sniffed],
              **({'speed': {'factor': speed[0], 'krish': speed[1]}} if speed else {}), 'fps': FPS}
    # The approved removals: the config's "remove" rows resolved to the take's words, each with Krish's words
    # when it carries them. The words gate (words_gate.py) reads this EDL; nothing else it finds missing is approved.
    removal_rows = cfg.get('remove', []) + cfg.get('remove_words', [])
    edl = {'schema': 'quick-edit-edl/1', 'take_words': str(wpath), 'removals': [
        {'take_index': [a, b], 'words': ' '.join(words[k]['w'].strip() for k in range(a, b + 1)),
         'from_s': words[a]['s'], 'to_s': words[b]['e'], **({'krish': r['krish']} if isinstance(r, dict) and r.get('krish') else {})}
        for (a, b), r in zip(cuts, removal_rows)],
        # The finished file's mishearings Krish has cleared, each with his words (words_gate.heard_as_rows).
        'heard_as': cfg.get('heard_as', [])}
    edl_path = out / f"{cfg['name']}.edl.json"
    edl_path.write_text(json.dumps(edl, indent=1), encoding='utf-8')
    if cfg.get('quality_required') and cfg.get('script') and P(cfg['script']).is_file():
        # A removal that cuts the only time he said a word of the script needs his words on the row: refused before any render.
        refused = words_gate.unapproved_removals(P(cfg['script']).read_text(encoding='utf-8-sig'), words, edl)
        if refused:
            sys.exit('Words gate: ' + ' | '.join(r['message'] for r in refused))
    words_held = []
    fonts = Path(__file__).resolve().parent / 'fonts'
    shapes = {}
    for asp in aspects:
        plan = cut_plan(cfg, asp, P, main_frames, ws, base)
        tl, intro, end, bed = plan['timeline'], plan['intro'], plan['end'], plan['bed']
        warnings = list(plan['warnings'])
        # The chapter cards on the video's clock: the continuous bed lifts under each and restarts inside one.
        tl['chapter_cards'] = [(c['s']+tl['intro_s'],c['e']+tl['intro_s'])
                               for c in wins if c.get('chapter') or c['id'].startswith('fri-chapter-')]
        # A config that asked for "episode" with no chapter cards lifts the bed a little at each spoken chapter turn instead.
        if bed and bed.get('lift_turns') and not tl['chapter_cards']:
            tl['accents'] = [(round(ws[h[0]]['s'] + tl['intro_s'] - music.ACCENT_BEFORE_S, 3), round(ws[h[0]]['s'] + tl['intro_s'] + music.ACCENT_AFTER_S, 3))
                             for c in episode.chapters_of(cfg, P)[1:] for h in [find_loose(ws, c['starts'])] if h]
        # Where a picture comes in or goes: a track shorter than the cut starts again on one of these when one is near (music.restarts).
        tl['turns'] = sorted({round(c[k] + tl['intro_s'], 3) for c in wins for k in ('s', 'e')})
        target = (bed['levels'] if bed else default_levels())['final_integrated_lufs']
        if voice_in <= -69.9:
            warnings.append('the recording measured as silence, so its level was left alone')
        voice_gain = 0.0 if voice_in <= -69.9 else max(-30.0, min(30.0, target - voice_in))
        cut_audio = build_audio(out / f'audio-{asp}', voice_src, voice_gain, intro, end, tl, bed)
        ass = out / f"{cfg['name']}-{asp}.ass"
        write_ass(ass, groups, wins, asp, series_accent(cfg, base) if cfg.get('caption_style') == 'house' else None)
        said, warns, files = episode_extras(cfg, P, ws, wins, toks, tl)
        warnings += warns
        (out / f"{cfg['name']}-{asp}.srt").write_text(files['srt'], encoding='utf-8')
        if files['chapters']:
            (out / f"{cfg['name']}-{asp}.chapters.txt").write_text(files['chapters'], encoding='utf-8')
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
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-/filter_complex', gfile.name, '-map', '[V]', '-map', audio_map,
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
        # A limited (or otherwise off) cut is brought back to the target: a plain gain on the sound with the
        # same oversampled limiter, measured again, at most twice. Wednesday's long cut went out at -15.2 LUFS
        # because the peak pass lowered it and nothing put it back (Krish, 2026-10-14).
        for _ in range(2):
            if bed and bed.get('mode')=='episode_bed':
                break  # Preserve the approved, separately measured stem levels.
            off = None if loudness.get('integrated') is None else levels['final_integrated_lufs'] - loudness['integrated']
            if off is None or abs(off) <= levels['tolerance_lu'] / 2:
                break
            ceiling = 10 ** ((levels['max_true_peak_dbtp'] - 0.8) / 20)
            fixed = final.with_name(final.stem + '.level.mp4')
            run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(final), '-map', '0', '-c:v', 'copy',
                 '-af', f'volume={off:.2f}dB,aresample=192000,alimiter=limit={ceiling:.3f}:attack=1:release=50:level=0,aresample=48000',
                 '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', str(fixed)])
            fixed.replace(final)
            loudness = {**measure_cut(final, tl, cut_audio), 'level_corrected_db': round(off, 2)}
        warnings += loudness_warnings(loudness, levels)
        if cfg.get('quality_required'):
            final_identity = quality.transcript_identity(final, 1, transcript_model)
            heard = transcribe(final, out/f'{final.stem}.heard.json', transcript_model, provenance=final_identity)
            narration_path = out/f'{final.stem}.narration.txt'
            narration_path.write_text(' '.join(w['w'].strip() for w in heard), encoding='utf-8')
            speech_check = quality.word_diff(toks, heard)
            receipt = {'video_sha256':quality.digest(final), 'piece_id':cfg.get('piece_id'),
                       'final_narration_sha256':quality.digest(narration_path),
                       'caption_repairs':None if caption_repairs is None else {
                           'document_sha256':cfg['caption_repairs_sha256'],
                           'provenance':caption_repairs['provenance'],
                           'retained_source_word_changes':quality.word_diff(retained_source_tokens,toks)},
                       'source_provenance':identity,
                       'transcript_document':{'sha256':quality.digest(wpath),'derivation':(document or {}).get('derivation')},'checks': {
                'heard':speech_check,
                'loudness':{'status':'fail' if loudness_warnings(loudness, levels) else 'pass', 'measurements':loudness},
                'visuals':{'status':'inconclusive','coverage':visual_checks,'reason':'Full-size card and font review required'}},
                # No placeholder statuses (plan W2.4): a check this run did not make is named here with what makes
                # it, and quality.delivery_problems holds the cut until that machine writes its measured result.
                'missing':{
                'sync':'the lip-sync measure (sync_check.py) on these bytes',
                'motion':'the camera-motion assessment and final framing review (wall_stabilize.py); stabilise when needed',
                'visual_clarity':'minimal rendered words, no script repetition, recognisable cues and three-second comprehension evidence (visual_clarity.py)',
                'full_review':'Krish playing the cut through at full size, in his own words'},
                'script_diff':quality.word_diff(script_words(cfg,P), heard)}
            # The words gate, blocking (plan W3 3a): no content word of the signed script he said in the take is
            # missing from this file beyond the EDL's approved removals. Machine written, bound to these bytes.
            script_file = P(cfg['script']) if cfg.get('script') else None
            script_text = script_file.read_text(encoding='utf-8-sig') if script_file and script_file.is_file() else ''
            # Every aligner's pass of the finished file (plan W2.4): faster-whisper's above. No paid second aligner
            # (Krish, 2026-10-29: "do not use eleven labs for this"), so the report says "single aligner".
            heard_by = cut_aligners.passes(final, heard={cut_settings.FIRST: heard})
            words_check = words_gate.bind(words_gate.check_aligners(script_text, words, heard_by['aligners'], edl),
                                          script=script_file if script_text else None, take=wpath,
                                          final_words=out/f'{final.stem}.heard.json', edl=edl_path, video=final,
                                          final_provenance=final_identity)
            words_check['second_aligner'] = heard_by['second']
            receipt['checks']['words'] = words_check
            if words_check['status'] != 'pass':
                words_held.append(f'{asp}: {words_gate.summary(words_check)}')
            # Joins in gaps and the captions' clock and renderer truth, machine written and bound to these bytes
            # (scripts/cutgates). They hold the cut for a post dated from config/gates.json required_from; before
            # it they are measured and listed, never blocking (the gates were not calibrated then).
            pages = advisory_qc.caption_pages(groups, wins, asp, tl['intro_s'], FPS)
            cut_checks = cut_receipt.cut_checks(
                final, joins=[round(tl['intro_s'] + g['off'], 3) for g in segs[1:]], aligners=heard_by['aligners'],
                captions=[(advisory_qc.CAPTION_BANDS[asp][band], [p for p in pages if p['band'] == band])
                          for band in ('normal', 'over_graphic')], fps=FPS, drew=cut_settings.FIRST)
            receipt['checks'].update(cut_checks)
            gates_blocking = cut_settings.required_on(cfg.get('date'))
            for check in cut_checks.values():
                check['blocking'] = gates_blocking
            if gates_blocking:
                words_held += [f'{asp}: {line}' for line in cut_receipt.held(cut_checks)]
            # The cut's joins reel, for his ear on the Monday board (joins_reel.py board feeds --materials).
            try:
                reel = joins_reel.build(final, cut_checks['joins']['joins'], out)
                receipt['joins_reel'] = {'file': reel['reel'], 'index': f'{final.stem}.joins-reel.json',
                                         **({'sha256': quality.digest(out / reel['reel'])} if (out / reel['reel']).is_file() else {})}
            except (OSError, subprocess.CalledProcessError, KeyError, ValueError) as error:
                receipt['joins_reel'] = {'error': f'{type(error).__name__}: {error}'[:300]}
            # The ve measures that can run on this cut, advisory only in Wave 1: they never block (advisory_qc.py).
            receipt['advisory'] = advisory_qc.rows(
                final, shape=asp, joins=[round(tl['intro_s'] + g['off'], 3) for g in segs[1:]],
                pages=advisory_qc.caption_pages(groups, wins, asp, tl['intro_s'], FPS),
                beats=advisory_qc.beats_of(wins, tl['main_s'], tl['intro_s'], FPS),
                mark=P(cfg['brand_mark']) if cfg.get('brand_mark') else None)
            Path(str(final)+'.validation.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
        shapes[asp] = {
            'file': final.name, 'opening': opening_of(intro), 'intro_seconds': tl['intro_s'], 'main_seconds': tl['main_s'], 'outro_seconds': tl['outro_s'],
            'total_seconds': tl['total_s'], 'voice_start_seconds': tl['voice_start_s'], 'voice_end_seconds': tl['voice_end_s'],
            'intro': intro and {'source': intro['source'], 'series': intro['series'], 'file': str(intro['file']), 'sha256': intro['sha256'],
                                'seconds': intro['seconds'], 'own_sound_replaced': intro['own_sound_replaced']},
            'music': cut_audio['music'], 'voice_gain_db': round(voice_gain, 2), 'loudness': loudness, 'episode': said,
            'srt': f"{cfg['name']}-{asp}.srt", 'warnings': warnings,
            **({'words': {'status': words_check['status'], 'summary': words_gate.summary(words_check)}}
               if cfg.get('quality_required') else {})}
        if args.share_mib:
            # A cut too long for a chat-size copy (Friday 16 Oct's 14-minute deep cut, 19 Oct) goes without one;
            # the cut itself is finished, so the report is still written.
            try:
                report[f'{asp}_share'] = share_copy(final, out / 'share' / final.name, args.share_mib)
            except SystemExit as e:
                report[f'{asp}_share'] = None
                report.setdefault('notes', []).append(f'no chat-size copy: {e}')
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
    if cfg.get('quality_required'):
        report['validation'] = {}
        for aspect in aspects:
            video = out / report[f'{aspect}_file']
            problems = quality.delivery_problems(video,str(video)+'.validation.json')
            report['validation'][aspect] = {'ready_for_delivery':not problems,'problems':problems}
    if archiving:
        # Copies only what this run made: a share copy left from an earlier
        # run is never picked up in place of a fresh one.
        made = {asp: out / report[f'{asp}_file'] for asp in aspects}
        try:
            if any(not v['ready_for_delivery'] for v in report.get('validation',{}).values()):
                raise ArchiveError('Archive blocked: video validation is failed, missing or incomplete')
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
    if words_held:
        # Everything is written first (the cut, its receipt, the report), so the evidence stays; the cut is held.
        sys.exit('Words gate: held, the cut is written but must not ship. ' + ' | '.join(words_held))  # joins and captions too
    if archive_failed:
        sys.exit(f'archive: {archive_failed}')


if __name__ == '__main__':
    main()
