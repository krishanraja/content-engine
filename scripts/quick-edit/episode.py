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

PUSH = 0.90      # the slight push: 90% of the frame, about 11% closer
TIGHT = 0.82     # the closer framing for a pivotal line
HOLD_S = 1.5     # a framing is held at least this long, so it never flicks
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


def sped_path(src, out, factor, fps=30):
    return Path(out) / f'{Path(src).stem}.speed-{factor:.3f}-{fps}fps.mkv'


def sped_source(src, out, factor, fps=30):
    """The take at `factor`, picture and sound together, pitch kept (atempo),
    at the cut's frame rate. Made once per take, factor and rate, beside the
    run's other files."""
    dest = sped_path(src, out, factor, fps)
    if not dest.exists() or dest.stat().st_mtime < Path(src).stat().st_mtime:
        part = dest.with_name(dest.stem + '.part.mkv')
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src),
                        '-filter_complex', f'[0:v]setpts=PTS/{factor},fps={fps}[v];[0:a]atempo={factor}[a]', '-map', '[v]', '-map', '[a]',
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-c:a', 'pcm_s16le', str(part)], check=True)
        part.replace(dest)
    return dest


# ---------------------------------------------------------------- framing

def framing_windows(segs, total, emphasis=(), hold=HOLD_S):
    """[(s, e, scale)] on the edited clock: a push from one hidden cut to the
    next, alternating with the base framing, never changed again within
    `hold` seconds; then each emphasis window at TIGHT over whatever was
    there. Only windows that are not the base framing are returned."""
    cuts = [round(g['off'], 3) for g in segs[1:]]
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
        cut = []
        for a, b, sc in out:
            if b <= s or a >= e:
                cut.append((a, b, sc))
                continue
            if a < s:
                cut.append((a, s, sc))
            if b > e:
                cut.append((e, b, sc))
        out = sorted(cut + [(s, e, TIGHT)])
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


def framing_graph(src, dst, windows, cw, ch, face):
    """Filter-graph lines that lay each non-base framing over the stream
    `src` (a label without brackets), at its own size, into `dst`."""
    if not windows:
        return [f'[{src}]null[{dst}]']
    scales = sorted({sc for _, _, sc in windows}, reverse=True)
    lines = [f'[{src}]split={1 + len(scales)}[fb]' + ''.join(f'[fz{k}]' for k in range(len(scales)))]
    cur = 'fb'
    for k, sc in enumerate(scales):
        w, h, x, y = framing_crop(cw, ch, face, sc)
        en = '+'.join(f'between(t,{a},{b - 0.001:.3f})' for a, b, s in windows if s == sc)
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

def self_test():
    checks = []
    segs = [{'off': 0.0}, {'off': 2.0}, {'off': 2.8}, {'off': 6.0}, {'off': 9.0}]
    wins = framing_windows(segs, 12.0)
    checks.append(('a push from one hidden cut to the next, held at least 1.5 s; a cut sooner keeps its framing',
                   wins, [(2.0, 6.0, PUSH), (9.0, 12.0, PUSH)]))
    checks.append(('a pivotal line is closer, over whatever framing was there',
                   framing_windows(segs, 12.0, [(5.0, 7.0)]), [(2.0, 5.0, PUSH), (5.0, 7.0, TIGHT), (9.0, 12.0, PUSH)]))
    w, h, x, y = framing_crop(1080, 1920, [200, 900], PUSH)
    checks.append(('the push zooms about his face and stays inside the frame, even sizes',
                   (w, h, x, y, x + w <= 1080, y + h <= 1920), (972, 1728, 54, 64, True, True)))
    g = framing_graph('0:v', 'vf', [(2.0, 6.0, PUSH), (5.0, 7.0, TIGHT)], 1080, 1920, [200, 900])
    checks.append(('two framings: one split, two crops, laid in order, ending at the label asked for',
                   (g[0], g[-1].endswith('[vf]'), sum('crop=' in x for x in g)), ('[0:v]split=3[fb][fz0][fz1]', True, 2)))
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
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'episode self-test passed: {len(checks)} checks')
    return 1 if bad else 0


if __name__ == '__main__':
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    print(__doc__)
