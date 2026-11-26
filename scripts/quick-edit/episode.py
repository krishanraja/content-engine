#!/usr/bin/env python3
"""episode: what a long one-shot episode needs beyond a quick cut.

Krish, 2026-10-16, handing over Friday's 15-minute take with a post-production
corpus (docs/production/one-shot-episode-corpus.md): "I'm very keen to see how
you produce this in the slickest, most professional way possible ... what
you're going to do to 10x the production quality", then "You're welcome to
put chapter dividers in the long video and things like that. I'm sure you've
got the corpus and know how to do this."

The corpus in one line: protect the performance, repair distractions, improve
comprehension; every intervention solves a named viewer problem. make.py reads
each of these from the cut's config, and a config without them renders as it
always has:

  "voice": "repair"     the gentle dialogue chain, before any level is set
                        (corpus, "Dialogue repair": clean, then level; never
                        metallic or gated)
  "reframe": true       each hidden cut (a pause taken out) sits under a change
                        of framing, base to a slight push and back, so a jump
                        reads as a cut, never a twitch ("Hide an audio edit
                        under a held frame or subtle reframe"); with a hold, so
                        framings never flick
  "emphasis": [{"start": WORDS, "end": WORDS}, ...]
                        a closer framing for the pivotal lines ("A subtle
                        digital push-in for a pivotal claim"); return to base after
  "captions": false     no captions burned into the picture. The caption file
                        (always written, NAME-SHAPE.srt, on the finished cut's
                        clock) goes to YouTube either way. Krish, 2026-10-16:
                        "Happy with you burning them in", so a long episode
                        keeps its burned captions and uploads the file too
  "chapters": [{"title": ..., "starts": WORDS}, ...] or "path/to/x.chapters.md"
                        NAME-SHAPE.chapters.txt for the description: 00:00
                        first, ascending, each at least 10 s (YouTube's rules)
  "end_screen_s": 20    no picture in the last N seconds, kept for YouTube's
                        end-screen tiles ("Reserve the final 15-20 seconds")
  "end_hold_s": 13      the end card's last frame held this long, so the
                        close runs 15 to 20 seconds under the tiles (Krish,
                        2026-10-16: "agree with your recommendation on the
                        ending")
  "speed": {"factor": 1.2, "krish": "Krish, DATE: his words"}
                        the take sped up, pitch kept, before anything else;
                        only on Krish's own words (2026-10-16, of the 90-second
                        cut: "if I go over 90sec, just speed the video up a bit
                        in post")

    python episode.py --self-test
"""
import re
import json
import subprocess
import sys
from pathlib import Path

# Gentle and in the corpus's order: rumble, then a light, tracking noise
# reduction, a little less mud, a little more presence, the hiss of an s
# softened, then a slow 2.5:1 levelling. Measured on a real take before it
# was used (WORKBENCH, 16 October).
VOICE_REPAIR = ('highpass=f=80,'
                'afftdn=nr=10:nf=-50:tn=1,'
                'equalizer=f=250:t=q:w=1.0:g=-2,'
                'equalizer=f=4000:t=q:w=1.2:g=1.5,'
                'deesser=i=0.35:m=0.5:f=0.5:s=o,'
                'acompressor=threshold=0.1:ratio=2.5:attack=12:release=180:knee=3:makeup=1.6')
FILTERS = ('afftdn', 'equalizer', 'deesser', 'acompressor', 'atempo')

PUSH = 0.90      # the slight push under a hidden cut: 90% of the frame, about 11% closer
HOLD_S = 1.5     # a framing is held at least this long, so it never flicks

# The pivotal line's push is ve's impact zoom, from the same config rows (config/ve/impact-zoom.json; Krish,
# 2026-11-26: "Zoom for impact ... classy and subtle rather than too aggressive"). It retires TIGHT, a jump to 82% of
# the frame (1.22x) laid on with no ease. The push eases out from his word's onset, holds through the line, and eases
# back; one that starts on a hidden cut keeps that cut's hard change, so the join stays hidden.
IMPACT = json.loads((Path(__file__).resolve().parents[2] / 'config' / 've' / 'impact-zoom.json').read_text(encoding='utf-8'))
IMPACT_TO = IMPACT['scale']['push_to'][IMPACT['quick_edit']['aspect']]
CLOSE = round(1 / IMPACT_TO, 4)                   # the closer framing for a pivotal line: 1.05x, not 1.22x
CLOSE_ON_PUSH = round(PUSH / IMPACT_TO, 4)        # the same push from the hidden-cut framing
IMPACT_SCALES = (CLOSE, CLOSE_ON_PUSH)
SPEED_RANGE = (1.0, 1.35)


class EpisodeError(Exception):
    pass


def krish_words(words):
    return isinstance(words, str) and words.strip().lower().startswith('krish')


# ---------------------------------------------------------------- the take, sped up

def speed_settings(cfg):
    """(factor, his words) or None. Refused without Krish's own words, or
    outside 1.0 to 1.35, where speech stops sounding like him."""
    sp = cfg.get('speed')
    if sp in (None, False):
        return None
    if not isinstance(sp, dict):
        raise EpisodeError('"speed" is {"factor": 1.2, "krish": "Krish, DATE: his words"}')
    f, words = sp.get('factor'), sp.get('krish')
    if not krish_words(words):
        raise EpisodeError('"speed" needs Krish\'s own words in "krish", starting "Krish": a cut is never sped up on anyone else\'s say')
    if not isinstance(f, (int, float)) or not SPEED_RANGE[0] < f <= SPEED_RANGE[1]:
        raise EpisodeError(f'"speed" factor must be over {SPEED_RANGE[0]} and at most {SPEED_RANGE[1]}, not {f!r}')
    return float(f), ' '.join(words.split())


def sped_path(src, out, factor, fps=30, even=False):
    return Path(out) / f'{Path(src).stem}.speed-{factor:.3f}-{fps}fps{"-even" if even else ""}.mkv'


def sped_source(src, out, factor, fps=30, even=False):
    """The take at `factor`, picture and sound together, pitch kept (atempo),
    at the cut's frame rate. `even`: the take's frames are laid one a frame
    period before the speed-up (make.conform_filter), so the frames dropped to
    speed it up fall evenly. Made once per take, factor, rate and way, beside
    the run's other files."""
    dest = sped_path(src, out, factor, fps, even)
    if not dest.exists() or dest.stat().st_mtime < Path(src).stat().st_mtime:
        dest.parent.mkdir(parents=True, exist_ok=True)
        streams = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(src)]))['streams']
        has_video = any(s['codec_type'] == 'video' and not s.get('disposition', {}).get('attached_pic') for s in streams)
        if not any(s['codec_type'] == 'audio' for s in streams):
            raise EpisodeError('The take has no audio to speed up')
        part = dest.with_name(dest.stem + '.part.mkv')
        video = (f'[0:v]setpts=N/({fps}*{factor}*TB),fps={fps}[v];' if even else f'[0:v]setpts=PTS/{factor},fps={fps}[v];') if has_video else ''
        args = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src),
                '-filter_complex', video + f'[0:a]atempo={factor}[a]']
        if has_video:
            args += ['-map', '[v]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12']
        args += ['-map', '[a]', '-c:a', 'pcm_s16le', str(part)]
        subprocess.run(args, check=True)
        part.replace(dest)
    return dest


# ---------------------------------------------------------------- framing

def impact_window(start, phrase_end, total):
    """(s, e) of a pivotal line's push: from his word's onset, held through the
    line (at least hold_min_s, at most hold_max_s past the push), then released
    over release_s."""
    t = IMPACT['timing']
    held = min(max(phrase_end, start + t['push_s'] + t['hold_min_s']), start + t['push_s'] + t['hold_max_s'])
    return round(start, 3), round(min(total, held + t['release_s']), 3)


def impact_onset(words):
    """The index in `words` (a pivotal line's words, in order) of the first one
    that is not a stop word (config words.stop), or None: a push never lands on
    "the" or "and"."""
    stop = set(IMPACT['words']['stop'])
    for i, w in enumerate(words):
        if re.sub(r"[^a-z0-9']", '', str(w).lower()) not in stop:
            return i
    return None


def _per_minute_ok(starts, cap):
    starts = sorted(starts)
    return all(sum(1 for t in starts if s <= t < s + 60) <= cap for s in starts)


def spaced_impacts(emphasis, total=None):
    """(kept, dropped): pivotal lines at least min_gap_s apart, none starting
    before the one before has released, none inside the cut's first
    cut_start_s or last cut_end_s (when `total` is given), and at most
    per_minute in any minute (ve's spacing and edges rows)."""
    sp, ed = IMPACT['spacing'], IMPACT['edges']
    cap = sp['per_minute'][IMPACT['quick_edit']['aspect']]
    kept, dropped = [], []
    for s, e in sorted(emphasis):
        if total is not None and (s < ed['cut_start_s'] or e > total - ed['cut_end_s']):
            dropped.append((s, e))
        elif kept and (s - kept[-1][0] < sp['min_gap_s'] or s < kept[-1][1]):
            dropped.append((s, e))
        elif not _per_minute_ok([k[0] for k in kept] + [s], cap):
            dropped.append((s, e))
        else:
            kept.append((s, e))
    return kept, dropped


def impact_problems(windows, total, joins=(), fps=30):
    """quick-edit's camera.impact row: the pivotal pushes in `windows` (the
    framing windows) checked by ve's own measure (velib/impact.py problems):
    scale against hard_cap, the rate, the spacing, per minute and the edges.
    [] when nothing is wrong."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from velib import impact as ve_impact
    t = IMPACT['timing']
    spans = []
    for a, b, sc in sorted(windows):
        if sc not in IMPACT_SCALES:
            continue
        if spans and abs(spans[-1][1] - a) < 1e-6:
            spans[-1][1] = b
        else:
            spans.append([a, b])
    hidden = {round(j, 3) for j in joins}
    frames = round(total * fps)
    hits = []
    for a, b in spans:
        f0, f1 = round(a * fps), round(b * fps)
        cut = round(b, 3) in hidden
        peak = min(f1, f0 + max(1, round(t['push_s'] * fps)))
        hold = f1 if cut else max(peak, f1 - round(t['release_s'] * fps))
        hits.append({'w': 0, 'word': f'{a:.2f}s', 'fromFrame': f0, 'peakFrame': peak, 'holdTo': hold, 'toFrame': f1,
                     'scale': IMPACT_TO, 'strength': 'normal', 'release': 'cut' if cut else 'ease'})
    if not hits:
        return []
    props = {'aspect': IMPACT['quick_edit']['aspect'], 'fps': fps, 'durationFrames': frames,
             'beats': [{'id': 'take', 'fromFrame': 0, 'toFrame': frames + 1, 'layout': 'FULL'}],
             'impact': {'pushEase': t['push_ease'], 'releaseEase': t['release_ease'],
                        'joins': sorted(h['toFrame'] for h in hits if h['release'] == 'cut'), 'hits': hits}}
    return ve_impact.problems(props, IMPACT, fps=fps)


def framing_windows(segs, total, emphasis=(), hold=HOLD_S, prefer=()):
    """[(s, e, scale)] on the edited clock: a push from one hidden cut to the
    next, alternating with the base framing, never changed again within
    `hold` seconds; then each emphasis window, the impact push, 1.05x closer
    than whatever framing was there (CLOSE over the base, CLOSE_ON_PUSH over a
    push). Only windows that are not the base framing are returned.
    `prefer`: joins made by a cut row (a stumble taken out), which have their
    change first; a plain pause cut within `hold` of one gives way to it."""
    cuts = [round(g['off'], 3) for g in segs[1:]]
    if prefer:
        chosen = []
        for t in sorted(round(x, 3) for x in prefer if round(x, 3) in cuts):
            if not chosen or t - chosen[-1] >= hold:
                chosen.append(t)
        cuts = sorted(chosen + [t for t in cuts if t not in chosen and all(abs(t - c) >= hold for c in chosen)])
    out, level, since = [], False, 0.0
    start = 0.0
    for t in cuts:
        if t - since < hold:
            continue
        if level:
            out.append((start, t, PUSH))
        level, since, start = not level, t, t
    if level:
        out.append((start, total, PUSH))
    for s, e in sorted(emphasis):
        cut, under = [], []
        for a, b, sc in out:
            if b <= s or a >= e:
                cut.append((a, b, sc))
                continue
            if a < s:
                cut.append((a, s, sc))
            if b > e:
                cut.append((e, b, sc))
            under.append((max(a, s), min(b, e)))
        # The push is relative to the framing under it: over a pushed stretch it closes in from there, never out.
        parts, t = [], s
        for a, b in sorted(under):
            if a > t:
                parts.append((t, a, CLOSE))
            parts.append((a, b, CLOSE_ON_PUSH))
            t = b
        if t < e:
            parts.append((t, e, CLOSE))
        out = sorted(cut + parts)
    return [(round(a, 3), round(b, 3), sc) for a, b, sc in out if b - a >= 0.2]


def framing_crop(cw, ch, face, scale):
    """The crop for one framing, zoomed about the middle of his face band, so
    his face keeps its place on screen and grows."""
    fy, fh = face
    w, h = int(cw * scale) // 2 * 2, int(ch * scale) // 2 * 2
    fx, fc = cw / 2, fy + fh / 2
    x = max(0, min(cw - w, round(fx * (1 - scale)))) // 2 * 2
    y = max(0, min(ch - h, round(fc * (1 - scale)))) // 2 * 2
    return w, h, x, y


def _ease_expr(name, x):
    """ve's impact curves (velib/impact.py ease) as an ffmpeg expression of x, clipped to 0..1."""
    x = f'clip({x},0,1)'
    if name == 'easeOutCubic':
        return f'(1-pow(1-{x},3))'
    if name == 'easeInOutCubic':
        return f'if(lt({x},0.5),4*pow({x},3),1-pow(2-2*{x},3)/2)'
    raise EpisodeError(f'impact ease {name} is not easeOutCubic or easeInOutCubic')


def impact_zoom_expr(spans, under, joins=()):
    """zoompan's zoom for one impact framing over its windows `spans`: the
    framing under it (1/under) at rest, IMPACT_TO closer at the peak. It eases
    out from each window's start and eases back by its end, except where that
    edge is a hidden cut (in `joins`), which keeps its hard change."""
    t = IMPACT['timing']
    hidden = {round(j, 3) for j in joins}
    terms = []
    for a, b in spans:
        up = '1' if round(a, 3) in hidden else _ease_expr(t['push_ease'], f'(it-{a:.3f})/{t["push_s"]}')
        down = '1' if round(b, 3) in hidden else _ease_expr(t['release_ease'], f'({b:.3f}-it)/{t["release_s"]}')
        terms.append(f'gte(it,{a:.3f})*lt(it,{b:.3f})*{up}*{down}')
    return f'{1 / under:.5f}*(1+{IMPACT_TO - 1:.4f}*({"+".join(terms)}))'


def framing_graph(src, dst, windows, cw, ch, face, joins=(), fps=30):
    """Filter-graph lines that lay each non-base framing over the stream
    `src` (a label without brackets), at its own size, into `dst`. An impact
    framing (IMPACT_SCALES) is drawn moving: zoompan eases it in about his face
    from the framing under it and back out (impact_zoom_expr); `joins` are the
    hidden cuts, where it changes hard instead."""
    if not windows:
        return [f'[{src}]null[{dst}]']
    scales = sorted({sc for _, _, sc in windows}, reverse=True)
    lines = [f'[{src}]split={1 + len(scales)}[fb]' + ''.join(f'[fz{k}]' for k in range(len(scales)))]
    cur = 'fb'
    for k, sc in enumerate(scales):
        w, h, x, y = framing_crop(cw, ch, face, sc)
        en = '+'.join(f'between(t,{a},{b - 0.001:.3f})' for a, b, s in windows if s == sc)
        if sc in IMPACT_SCALES:
            under = 1.0 if sc == CLOSE else PUSH
            z = impact_zoom_expr([(a, b) for a, b, s in windows if s == sc], under, joins)
            fc = face[0] + face[1] / 2
            lines.append(f"[fz{k}]zoompan=z='{z}':x='(iw-iw/zoom)/2':y='{fc}*(1-1/zoom)':d=1:s={cw}x{ch}:fps={fps},setsar=1[fs{k}]")
        else:
            lines.append(f'[fz{k}]crop={w}:{h}:{x}:{y},scale={cw}:{ch}:flags=lanczos,setsar=1[fs{k}]')
        nxt = dst if k == len(scales) - 1 else f'fo{k}'
        lines.append(f"[{cur}][fs{k}]overlay=0:0:enable='{en}'[{nxt}]")
        cur = nxt
    return lines


# ---------------------------------------------------------------- captions file

def srt_time(t):
    t = max(0.0, t)
    ms = round(t * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def wrap(words, max_chars=42):
    """Words into lines of at most `max_chars`, greedily (a single longer word
    sits on its own line)."""
    lines, line = [], ''
    for w in words:
        if line and len(line) + 1 + len(w) > max_chars:
            lines.append(line)
            line = w
        else:
            line = f'{line} {w}'.strip()
    return lines + ([line] if line else [])


def srt(toks, offset=0.0, max_chars=42, max_lines=2, max_dur=6.0, gap=0.6, min_dur=1.0):
    """The caption file, on the finished cut's clock (`offset` is the sting's
    length): lines of at most `max_chars`, at most `max_lines` a caption,
    broken at a sentence end, a long pause or `max_dur`, each shown at
    least `min_dur` and never over the next."""
    groups, cur = [], []
    for j, t in enumerate(toks):
        cur.append(t)
        nxt = toks[j + 1] if j + 1 < len(toks) else None
        full = bool(nxt) and len(wrap([x['w'] for x in cur] + [nxt['w']], max_chars)) > max_lines
        if (not nxt or full or re.search(r'[.!?]$', t['w']) or nxt['s'] - t['e'] > gap
                or nxt['e'] - cur[0]['s'] > max_dur):
            groups.append(cur)
            cur = []
    out = []
    for k, g in enumerate(groups):
        s = g[0]['s'] + offset
        e = max(g[-1]['e'] + offset, s + min_dur)
        if k + 1 < len(groups):
            e = min(e, groups[k + 1][0]['s'] + offset - 0.04)
        out.append(f'{k + 1}\n{srt_time(s)} --> {srt_time(e)}\n' + '\n'.join(wrap([x['w'] for x in g], max_chars)) + '\n')
    return '\n'.join(out)


# ---------------------------------------------------------------- chapters

CHAPTER_LINE = re.compile(r'^\s*-\s*(?P<title>.+?)\s*\|\s*starts:\s*"(?P<starts>[^"]+)"', re.M)


def chapters_of(cfg, P):
    ch = cfg.get('chapters')
    if not ch:
        return []
    if isinstance(ch, str):
        return [m.groupdict() for m in CHAPTER_LINE.finditer(Path(P(ch)).read_text(encoding='utf-8'))]
    return [{'title': str(c['title']), 'starts': str(c['starts'])} for c in ch]


def mmss(t):
    t = int(t)
    return f'{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}' if t >= 3600 else f'{t // 60:02d}:{t % 60:02d}'


def chapter_list(chapters, starts, intro_s):
    """The description's chapter lines, from each chapter's start on the edited
    clock (`starts`, None where his words were not found) plus the sting:
    the first at 00:00 whatever its start, ascending, each at least 10 s
    after the one before (YouTube's rules). (lines, warnings)."""
    lines, warn, last = [], [], None
    for k, (c, s) in enumerate(zip(chapters, starts)):
        if k == 0:
            t = 0.0
        elif s is None:
            warn.append(f'chapter "{c["title"]}": its first words ("{c["starts"]}") were not found, so it is left out of the list')
            continue
        else:
            t = s + intro_s
        if last is not None and t - last < 10:
            warn.append(f'chapter "{c["title"]}" starts {t - last:.1f} s after the one before; YouTube needs 10 s, so it is left out')
            continue
        lines.append(f'{mmss(t)} {c["title"]}')
        last = t
    if len(lines) < 3:
        warn.append(f'only {len(lines)} chapter(s): YouTube shows chapters from three')
    return lines, warn


# ---------------------------------------------------------------- the end screen

def end_screen_warnings(wins, intro_s, total_s, seconds):
    if not seconds:
        return []
    start = total_s - seconds
    hits = [c['id'] for c in wins if c['e'] + intro_s > start]
    return [f'picture {", ".join(hits)} runs into the last {seconds:g} s, kept clear for YouTube\'s end-screen tiles'] if hits else []


# ---------------------------------------------------------------- self-test

# Sniffs (Krish, 2026-10-17: "i was sniffing a bit so dampen that out surgically"). Seen on the spectrogram of his
# 90-second take: a sniff is a nasal in-breath in the middle of a pause, a sustained unvoiced noise band 0.3 to 0.6 s
# long, far quieter than speech. The "s" that starts or ends a word sits against the word (the transcriber times
# fricatives late), so the search keeps clear of both edges; voiced sound (a mumble, an untranscribed word) and
# anything near speech level are left alone. Only those spans are turned down, with soft fades, never cut, so no
# word, timing or lip sync changes; every one found is listed in the report to check. 18 dB down: on his take a
# sniff sits 25 to 40 dB over the room's floor, so it ends up near the room tone (an eighth as loud) without
# leaving a hole of silence in the pause.
SNIFF = {'after_word': 0.15, 'before_word': 0.22, 'min_gap': 0.15, 'min_s': 0.12, 'max_s': 1.2, 'over_floor_db': 12.0,
         'under_speech_db': 42.0, 'voiced_max': 0.35, 'duck_db': -18.0, 'fade_s': 0.04}


def read_audio(path, rate=48000):
    """The sound of a file as float32 samples (n, channels), and its channel count."""
    import json as _json
    import numpy as np
    info = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'json',
                           str(path)], capture_output=True, text=True, check=True).stdout
    ch = int(_json.loads(info)['streams'][0]['channels'])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ar', str(rate), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy(), ch


def sniffs(path, words, rate=48000, opts=None):
    """The sniffs in a cut's sound, from its words on the same clock: [{'s', 'e', 'peak_db', 'floor_db'}]."""
    import numpy as np
    o = dict(SNIFF, **(opts or {}))
    x, _ = read_audio(path, rate)
    mono = x.mean(axis=1)
    fl, hop = int(0.02 * rate), int(0.01 * rate)
    n = max(0, (len(mono) - fl) // hop)
    if n == 0 or not words:
        return []
    idx = np.arange(fl)[None, :] + hop * np.arange(n)[:, None]
    frames = mono[idx] * np.hanning(fl)[None, :]
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2 + 1e-12
    freqs = np.fft.rfftfreq(fl, 1 / rate)
    rms_db = 10 * np.log10(np.mean(frames ** 2, axis=1) + 1e-12)
    voiced = spec[:, (freqs >= 80) & (freqs <= 400)].sum(axis=1) / spec[:, (freqs >= 80) & (freqs <= 12000)].sum(axis=1)
    t = (np.arange(n) * hop + fl / 2) / rate
    ws = sorted((float(w['s']), float(w['e'])) for w in words)
    gaps = [(a[1] + o['after_word'], b[0] - o['before_word']) for a, b in zip(ws, ws[1:])]
    gaps = [(a, b) for a, b in gaps if b - a >= o['min_gap']]
    in_gap = np.zeros(n, bool)
    for a, b in gaps:
        in_gap |= (t >= a) & (t <= b)
    if not in_gap.any():
        return []
    floor = float(np.percentile(rms_db[in_gap], 10))
    hit = in_gap & (rms_db > floor + o['over_floor_db']) & (rms_db < floor + o['under_speech_db']) & (voiced < o['voiced_max'])
    events, i = [], 0
    while i < n:
        if not hit[i]:
            i += 1
            continue
        j = i
        while j + 1 < n and in_gap[j + 1] and (hit[j + 1] or (j + 3 < n and hit[j + 2:j + 4].any())):
            j += 1
        s, e = t[i] - fl / 2 / rate, t[j] + fl / 2 / rate
        if o['min_s'] <= e - s <= o['max_s']:
            events.append({'s': round(float(s), 3), 'e': round(float(e), 3), 'peak_db': round(float(rms_db[i:j + 1].max()), 1),
                           'floor_db': round(floor, 1)})
        i = j + 1
    return events


def duck(src, dst, events, rate=48000, db=SNIFF['duck_db'], fade=SNIFF['fade_s']):
    """A copy of src with each event turned down by db, faded in and out over fade seconds."""
    import numpy as np
    x, ch = read_audio(src, rate)
    g = np.ones(len(x), np.float32)
    low = 10 ** (db / 20)
    f = max(1, int(fade * rate))
    for ev in events:
        a, b = int(ev['s'] * rate), int(ev['e'] * rate)
        a0, b1 = max(0, a - f), min(len(g), b + f)
        g[a:b] = np.minimum(g[a:b], low)
        if a > a0:
            g[a0:a] = np.minimum(g[a0:a], np.linspace(1, low, a - a0, dtype=np.float32))
        if b1 > b:
            g[b:b1] = np.minimum(g[b:b1], np.linspace(low, 1, b1 - b, dtype=np.float32))
    y = (x * g[:, None]).astype(np.float32)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', str(ch), '-i', '-', '-c:a', 'pcm_f32le',
                    str(dst)], input=y.tobytes(), check=True)
    return dst


def _sniff_self_test(checks):
    """A stand-in take: two voiced words, a quiet breathy burst mid-pause, an "s" just before the second word."""
    import tempfile
    import numpy as np
    rate = 48000
    rng = np.random.default_rng(7)
    tt = np.arange(int(3.0 * rate)) / rate
    room = rng.normal(0, 0.0003, len(tt))
    voice = np.zeros(len(tt))
    for a, b in ((0.2, 1.0), (1.9, 2.8)):
        m = (tt >= a) & (tt < b)
        voice[m] = 0.2 * np.sin(2 * np.pi * 180 * tt[m]) + 0.1 * np.sin(2 * np.pi * 360 * tt[m])
    noise = np.zeros(len(tt))
    m = (tt >= 1.3) & (tt < 1.6)
    noise[m] = 0.004 * np.diff(rng.normal(0, 1, m.sum() + 1))
    s = (tt >= 1.78) & (tt < 1.88)
    noise[s] = 0.05 * np.diff(rng.normal(0, 1, s.sum() + 1))
    sig = (room + voice + noise).astype(np.float32)
    words = [{'s': 0.2, 'e': 1.0}, {'s': 1.9, 'e': 2.8}]
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / 'a.wav', Path(tmp) / 'b.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', '-', '-c:a', 'pcm_f32le', str(src)],
                       input=sig.tobytes(), check=True)
        ev = sniffs(src, words, rate)
        checks.append(('a breathy burst mid-pause is found as one sniff; the "s" before the next word is not',
                       [(e['s'] > 1.2 and e['e'] < 1.7) for e in ev], [True]))
        duck(src, dst, ev, rate)
        y, _ = read_audio(dst, rate)
        x0, _ = read_audio(src, rate)
        burst_db = 20 * np.log10(np.sqrt(np.mean(y[int(1.4 * rate):int(1.5 * rate), 0] ** 2)) /
                                 np.sqrt(np.mean(x0[int(1.4 * rate):int(1.5 * rate), 0] ** 2)))
        same = bool(np.allclose(y[int(0.3 * rate):int(0.9 * rate), 0], x0[int(0.3 * rate):int(0.9 * rate), 0], atol=1e-6)
                    and np.allclose(y[int(1.79 * rate):int(1.87 * rate), 0], x0[int(1.79 * rate):int(1.87 * rate), 0], atol=1e-6))
        checks.append(('the sniff is turned down by the set depth; the words and the "s" are untouched',
                       (abs(burst_db - SNIFF['duck_db']) < 1.0, same), (True, True)))
        checks.append(('a burst inside a word is never touched', sniffs(src, [{'s': 0.2, 'e': 2.8}], rate), []))


def _impact_render_check():
    """(still before the push, moved during it): a small test picture through framing_graph, read back frame by frame."""
    import numpy as np
    w, h, fps = 320, 180, 30
    g = framing_graph('0:v', 'out', [(0.8, 1.9, CLOSE)], w, h, [40, 100], fps=fps)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'testsrc2=size={w}x{h}:rate={fps}:duration=2.2',
                          '-filter_complex', ';'.join([f'[0:v]setpts=N/({fps}*TB)[0v]'] + [x.replace('[0:v]', '[0v]', 1) for x in g]),
                          '-map', '[out]', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    src = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'testsrc2=size={w}x{h}:rate={fps}:duration=2.2',
                          '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    out = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(int)
    ref = np.frombuffer(src, np.uint8).reshape(-1, h, w).astype(int)
    still = bool(np.abs(out[10] - ref[10]).mean() < 0.5)
    moved = bool(np.abs(out[45] - ref[45]).mean() > 2.0)
    return still, moved


def self_test():
    checks = []
    segs = [{'off': 0.0}, {'off': 2.0}, {'off': 2.8}, {'off': 6.0}, {'off': 9.0}]
    wins = framing_windows(segs, 12.0)
    checks.append(('a push from one hidden cut to the next, held at least 1.5 s; a cut sooner keeps its framing',
                   wins, [(2.0, 6.0, PUSH), (9.0, 12.0, PUSH)]))
    checks.append(('a pivotal line is pushed 1.05x closer than whatever framing was there, never out from a push',
                   framing_windows(segs, 12.0, [(5.0, 7.0)]),
                   [(2.0, 5.0, PUSH), (5.0, 6.0, CLOSE_ON_PUSH), (6.0, 7.0, CLOSE), (9.0, 12.0, PUSH)]))
    checks.append(('the pivotal push is the impact zoom, not the old 0.82 (1.22x): 1.05x, under the hard cap',
                   (CLOSE, round(1 / CLOSE_ON_PUSH, 4) < IMPACT['scale']['hard_cap'] * round(1 / PUSH, 4), 1 / CLOSE <= IMPACT['scale']['hard_cap']),
                   (0.9524, True, True)))
    checks.append(('a pivotal line is pushed from its word, held through it (at least hold_min_s, at most hold_max_s), then released',
                   (impact_window(5.0, 5.4, 60.0), impact_window(5.0, 8.0, 60.0), impact_window(59.0, 59.5, 60.0)),
                   ((5.0, 6.87), (5.0, 8.47), (59.0, 60.0))))
    checks.append(('a pivotal line held past hold_max_s releases at the cap, not at the phrase end',
                   impact_window(5.0, 20.0, 60.0), (5.0, round(5.0 + 0.37 + 2.4 + 0.7, 3))))
    checks.append(('pivotal lines closer than min_gap_s, or before the last has released, are dropped and named',
                   spaced_impacts([(10.0, 12.0), (5.0, 7.0), (7.5, 8.5)]), ([(5.0, 7.0), (10.0, 12.0)], [(7.5, 8.5)])))
    checks.append(("no push in the cut's first cut_start_s or last cut_end_s",
                   spaced_impacts([(0.1, 2.0), (10.0, 12.0), (58.0, 59.8)], total=60.0), ([(10.0, 12.0)], [(0.1, 2.0), (58.0, 59.8)])))
    many = [(5.0 + 4.5 * k, 6.9 + 4.5 * k) for k in range(8)]
    checks.append(('at most per_minute pushes in any minute on the long cut',
                   len(spaced_impacts(many, total=120.0)[0]), IMPACT['spacing']['per_minute'][IMPACT['quick_edit']['aspect']]))
    checks.append(("a push never lands on a stop word: it moves to the line's first content word, or there is none",
                   (impact_onset(['the', 'singers', 'get']), impact_onset(['and', 'so'])), (1, None)))
    good = framing_windows(segs, 60.0, [(10.0, 12.07)])
    checks.append(("the quick-edit camera.impact row passes a spaced, capped push (ve's own measure)",
                   impact_problems(good, 60.0, joins=[g['off'] for g in segs[1:]]), []))
    crowded = [(10.0, 12.07, CLOSE), (11.0, 13.07, CLOSE), (40.0, 42.07, 0.7)]
    bad = impact_problems(crowded, 60.0)
    checks.append(('the row fails pushes too close together, a push in the last cut_end_s and anything past hard_cap',
                   (any('closer than' in x for x in bad), any('first' in x and 'last' in x for x in impact_problems([(59.0, 60.0, CLOSE)], 60.0))),
                   (True, True)))
    expr = impact_zoom_expr([(5.0, 7.0)], 1.0)
    hidden = impact_zoom_expr([(5.0, 7.0)], PUSH, joins=[5.0])
    checks.append(('the push eases out from the word and eases back; on a hidden cut it changes hard, from the framing under it',
                   ('(1-pow(1-clip((it-5.000)' in expr, 'if(lt(clip((7.000-it)' in expr, '(it-5.000)' in hidden,
                    hidden.startswith(f'{1 / PUSH:.5f}*')), (True, True, False, True)))
    checks.append(('a join made by a cut row has its change first; the pause cut 1.08 s before it gives way',
                   framing_windows([{'off': 0.0}, {'off': 5.0}, {'off': 6.08}, {'off': 9.0}], 12.0, prefer=[6.08]),
                   [(6.08, 9.0, PUSH)]))
    w, h, x, y = framing_crop(1080, 1920, [200, 900], PUSH)
    checks.append(('the push zooms about his face and stays inside the frame, even sizes',
                   (w, h, x, y, x + w <= 1080, y + h <= 1920), (972, 1728, 54, 64, True, True)))
    g = framing_graph('0:v', 'vf', [(2.0, 5.0, PUSH), (5.0, 7.0, CLOSE)], 1080, 1920, [200, 900])
    checks.append(('two framings: one split, the hidden-cut push a still crop, the impact push a moving zoom, ending at the label',
                   (g[0], g[-1].endswith('[vf]'), sum('crop=' in x for x in g), sum('zoompan=' in x for x in g)),
                   ('[0:v]split=3[fb][fz0][fz1]', True, 1, 1)))
    checks.append(('the impact push renders: ffmpeg runs the graph, the frame is still before the push and moved in it',
                   _impact_render_check(), (True, True)))
    checks.append(('no framing is a plain pass-through', framing_graph('a', 'b', [], 10, 10, [0, 10]), ['[a]null[b]']))
    toks = [{'w': w, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, w in enumerate('This is one sentence. And here is another one that goes on.'.split())]
    text = srt(toks, offset=3.0)
    checks.append(('the caption file: numbered, on the finished clock, broken at the sentence',
                   text.split('\n')[:3], ['1', '00:00:03,000 --> 00:00:04,500', 'This is one sentence.']))
    long = [{'w': 'word', 's': i * 0.3, 'e': i * 0.3 + 0.25} for i in range(40)]
    blocks = [b.split('\n')[2:] for b in srt(long).strip().split('\n\n')]
    checks.append(('a long run without a full stop: every line 42 characters or fewer, two lines at most',
                   (max(len(x) for b in blocks for x in b) <= 42, max(len(b) for b in blocks) <= 2), (True, True)))
    checks.append(('times are hours:minutes:seconds,milliseconds', srt_time(3725.5), '01:02:05,500'))
    ch = [{'title': 'Open', 'starts': 'a'}, {'title': 'Two', 'starts': 'b'}, {'title': 'Three', 'starts': 'c'}, {'title': 'Four', 'starts': 'd'}]
    lines, warn = chapter_list(ch, [0.5, 40.0, 45.0, 120.0], 3.0)
    checks.append(('chapters: 00:00 first, the sting added, one under 10 s after the last left out',
                   (lines, len(warn)), (['00:00 Open', '00:43 Two', '02:03 Four'], 1)))
    checks.append(('the chapters file is read line by line',
                   [m.groupdict() for m in CHAPTER_LINE.finditer('- The names | starts: "First, the names."\n')],
                   [{'title': 'The names', 'starts': 'First, the names.'}]))
    checks.append(('a picture in the last 20 s is flagged; one before it is not',
                   (len(end_screen_warnings([{'id': 'x', 's': 100, 'e': 182}], 3.0, 200.0, 20)),
                    len(end_screen_warnings([{'id': 'x', 's': 100, 'e': 170}], 3.0, 200.0, 20))), (1, 0)))
    for label, cfg, ok in (('a speed-up with his words', {'speed': {'factor': 1.2, 'krish': 'Krish, 2026-10-16: speed it up'}}, True),
                           ('a speed-up without them', {'speed': {'factor': 1.2, 'krish': 'speed it up'}}, False),
                           ('a speed-up past 1.35', {'speed': {'factor': 1.6, 'krish': 'Krish, 2026-10-16: speed it up'}}, False)):
        try:
            speed_settings(cfg)
            got = True
        except EpisodeError:
            got = False
        checks.append((f'{label} is {"taken" if ok else "refused"}', got, ok))
    checks.append(('no "speed" is no speed-up', speed_settings({}), None))
    _sniff_self_test(checks)
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'episode self-test passed: {len(checks)} checks')
    return 1 if bad else 0


if __name__ == '__main__':
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    print(__doc__)
