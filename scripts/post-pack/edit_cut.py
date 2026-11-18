#!/usr/bin/env python3
"""edit_cut: apply the edit pass to a take, picture and sound in one graph, joins only in agreed gaps.

Krish, 2026-11-17: "the prompt should ensure it gets the session to look for places I've had to restart a sentence,
clip those out, clip out empty awkward silences, and then measure the total duration, and then speed it up if needed to
get it under the 90 second limit (longer video length does not matter)".

edit_pass.py proposes the keep spans from one word clock. This tool makes the cut, under the dialogue rules ve conform
holds (F09; Krish, 2026-10-19: "random little cuts and words chopped in the final video"):

  - every join sits inside a gap BOTH forced-aligner clocks agree on, with 30 ms clearance from the nearest word on
    each side; a pause the two clocks do not both see is kept whole (the span plays through), never cut;
  - the pause is left at a breath (0.25 s), split either side of the quietest point of the gap;
  - every join is checked quiet: the 40 ms either side of each cut point must sit well under the take's speech level;
    a loud join is refused, never cut;
  - each segment's ends are snapped to the take's own frame grid, so picture and sound are trimmed by the same
    amount, and each audio edge fades over 30 ms (only ever inside a quiet gap);
  - the even speed-up (pitch kept, rubberband) and the frame-rate change (the fps filter, never output -r) are in the
    same graph as the cuts, so picture and sound cannot drift (F10, av-sync-drift-converted-take);
  - extra removals (a restart the rule left in, with its reason) are given by time and obey the same gap rule.

    python3 scripts/post-pack/edit_cut.py TAKE --edit EDIT.json --clock-a A.json --clock-b B.json --out OUT.mov
        [--remove FROM-TO:why ...] [--speed S --speed-said "Krish, YYYY-MM-DD: his words"] [--fps 30] [--plan-only]

It writes OUT.mov (h264, pcm audio, so no AAC priming shifts the voice), OUT.edit-cut.json (every segment, every join
with its gap and loudness, the removals and the speed) and, at speed 1, OUT.av-sync-edl.json for scripts/av_sync.py.
After a speed-up the cut must be transcribed afresh and every cue timed from that clock (learning
speedup-without-glitches): this tool never scales times for anyone.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

BREATH = 0.25
QUIET_KEEP = 0.08   # quiet kept each side of a cut; with the word tails and clearance the pause heard is about BREATH
CLEARANCE = 0.03
MIN_GAP = 0.08
FADE = 0.03
QUIET_WINDOW = 0.04
QUIET_DB_UNDER_SPEECH = 18.0   # a join's 40 ms windows sit at least this far under the take's median speech level
MAX_SPEED = 1.25
TICK_DB_UNDER_SPEECH = 8.0     # a blip shorter than 40 ms and this far under speech is a tick, not a sound to keep


def clock_words(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    words = data['words'] if isinstance(data, dict) else data
    out = []
    for w in words:
        start = float(w.get('start', w.get('s', 0)))
        end = float(w.get('end', w.get('e', start)))
        out.append({'word': str(w.get('word', w.get('w', ''))), 'start': start, 'end': end})
    return sorted(out, key=lambda x: x['start'])


def probe(path: str) -> dict:
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=r_frame_rate,width,height', '-of', 'json', path], capture_output=True, text=True, check=True)
    s = json.loads(out.stdout)['streams'][0]
    num, den = (int(x) for x in s['r_frame_rate'].split('/'))
    return {'fps': num / den, 'width': s['width'], 'height': s['height']}


def pcm_levels(path: str, rate: int = 16000) -> tuple[list[float], int]:
    """The take's sound as 10 ms RMS levels in dBFS, decoded once in order."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(rate), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    n = len(raw) // 2
    hop = rate // 100
    import array
    samples = array.array('h', raw[:n * 2])
    levels = []
    for i in range(0, n - hop + 1, hop):
        chunk = samples[i:i + hop]
        rms = math.sqrt(sum(x * x for x in chunk) / hop) / 32768.0
        levels.append(20 * math.log10(max(rms, 1e-6)))
    return levels, 100


def level_at(levels: list[float], hz: int, t0: float, t1: float) -> float:
    a, b = max(0, int(t0 * hz)), max(int(t0 * hz) + 1, int(math.ceil(t1 * hz)))
    window = levels[a:b] or [-120.0]
    return max(window)


def gap_between(a: list[dict], b: list[dict], t_end: float, t_start: float) -> tuple[float, float] | None:
    """The gap both clocks agree is empty between a span ending near t_end and the next starting near t_start."""
    mid = (t_end + t_start) / 2
    lo, hi = t_end, t_start
    for clock in (a, b):
        before = [w['end'] for w in clock if w['start'] < mid]
        after = [w['start'] for w in clock if w['start'] >= mid]
        if before:
            lo = max(lo, max(before))   # a word one clock hears running over the middle closes the gap
        if after:
            hi = min(hi, min(after))
    lo, hi = lo + CLEARANCE, hi - CLEARANCE
    return (lo, hi) if hi - lo >= MIN_GAP else None


def plan(take: str, edit: dict, a: list[dict], b: list[dict], removes: list[tuple[float, float, str]]) -> dict:
    info = probe(take)
    fps = info['fps']
    spans = [list(s) for s in edit['keep']]
    # Extra removals: cut each kept span around the removed stretch.
    for lo, hi, why in removes:
        out = []
        for s, e in spans:
            if hi <= s or lo >= e:
                out.append([s, e])
                continue
            if lo > s:
                left_end = max([w['end'] for w in a if s <= w['start'] and w['end'] <= lo + 0.02] or [s])
                out.append([s, left_end])
            if hi < e:
                right_start = min([w['start'] for w in a if w['start'] >= hi - 0.02 and w['end'] <= e + 0.02] or [e])
                out.append([right_start, e])
        spans = [x for x in out if x[1] - x[0] > 0.05]
    levels, hz = pcm_levels(take)
    voiced = sorted(l for l in levels if l > -50)
    speech_db = voiced[len(voiced) // 2] if voiced else -20.0
    quiet_ceiling = speech_db - QUIET_DB_UNDER_SPEECH
    first = min(w['start'] for w in a)
    last = max(w['end'] for w in a)
    segments = [{'in': max(0.0, spans[0][0] - 0.12), 'out': None}]
    joins, kept_whole = [], []
    def quiet_run(lo: float, hi: float) -> tuple[float, float]:
        """The longest quiet run in [lo, hi]: only quiet is ever cut, so a sound the transcript left out (an aside, a
        filler, a laugh) is kept. A tick (under 40 ms, well under speech level) does not split a run."""
        a_i, b_i = int(math.ceil(lo * hz)), int(hi * hz)
        mask = [i < len(levels) and levels[i] <= quiet_ceiling for i in range(a_i, b_i)]
        k = 0
        while k < len(mask):
            if mask[k]:
                k += 1
                continue
            j = k
            while j < len(mask) and not mask[j]:
                j += 1
            peak = max(levels[a_i + k:a_i + j] or [-120.0])
            if j - k < 4 and 0 < k and j < len(mask) and peak < speech_db - TICK_DB_UNDER_SPEECH:
                mask[k:j] = [True] * (j - k)
            k = j
        best, run_start = (0, 0), None
        for i in range(a_i, b_i + 1):
            quiet = i < b_i and mask[i - a_i]
            if quiet and run_start is None:
                run_start = i
            if not quiet and run_start is not None:
                if i - run_start > best[1] - best[0]:
                    best = (run_start, i)
                run_start = None
        return best[0] / hz, best[1] / hz

    for (s0, e0), (s1, e1) in zip(spans, spans[1:]):
        removal = next(((lo_r, hi_r, why) for lo_r, hi_r, why in removes if e0 - 0.05 <= lo_r and hi_r <= s1 + 0.05), None)
        if removal:
            # A restart removed between two kept words: cut out just after the last kept word and back in just before
            # the next, each in its own quiet gap, so the abandoned attempt goes and a breath stays.
            dropped = [w for w in a if removal[0] - 0.02 <= w['start'] and w['end'] <= removal[1] + 0.02]
            left, right = gap_between(a, b, e0, dropped[0]['start']), gap_between(a, b, dropped[-1]['end'], s1)
            if not left or not right:
                kept_whole.append({'at': round(e0, 3), 'why': 'no agreed gap either side of the restart: not removed, for his ear'})
                continue
            la, lb = quiet_run(*left)
            ra, rb = quiet_run(*right)
            out_t = math.ceil(min(la + BREATH / 2, (la + lb) / 2) * fps) / fps
            in_t = math.floor(max(rb - BREATH / 2, (ra + rb) / 2) * fps) / fps
            lo, hi = left[0], right[1]
        else:
            gap = gap_between(a, b, e0, s1)
            if gap is None:
                kept_whole.append({'at': round(e0, 3), 'why': 'the two clocks do not both see a gap here: plays through'})
                continue
            lo, hi = gap
            qa, qb = quiet_run(lo, hi)
            out_t = math.ceil((qa + QUIET_KEEP) * fps) / fps
            in_t = math.floor((qb - QUIET_KEEP) * fps) / fps
            if in_t - out_t < 0.05:
                kept_whole.append({'at': round(e0, 3), 'why': f'no quiet run long enough to shorten ({qb - qa:.2f} s quiet): plays through'})
                continue
        loud = max(level_at(levels, hz, out_t - QUIET_WINDOW, out_t), level_at(levels, hz, in_t, in_t + QUIET_WINDOW))
        if loud > quiet_ceiling:
            kept_whole.append({'at': round(e0, 3), 'why': f'not quiet enough to join ({loud:.1f} dBFS): plays through'})
            continue
        segments[-1]['out'] = out_t
        last_end = max(w['end'] for clock in (a, b) for w in clock if w['start'] <= e0 - 0.01) if not removal else e0
        next_start = min(w['start'] for clock in (a, b) for w in clock if w['start'] >= s1 - 0.05) if not removal else s1
        joins.append({'cut_out_s': round(out_t, 4), 'cut_in_s': round(in_t, 4), 'gap': [round(lo, 3), round(hi, 3)],
                      'loudest_db': round(loud, 1), 'removed_s': round(in_t - out_t, 3),
                      'pause_heard_s': round((next_start - last_end) - (in_t - out_t), 3),
                      **({'restart_removed': removal[2]} if removal else {})})
        segments.append({'in': in_t, 'out': None})
    segments[-1]['out'] = min(spans[-1][1] + 0.5, last + 0.5)
    for seg in segments:
        seg['in'] = math.floor(seg['in'] * fps) / fps
        seg['out'] = math.ceil(seg['out'] * fps) / fps
    return {'take': take, 'take_fps': fps, 'size': [info['width'], info['height']], 'speech_db': round(speech_db, 1),
            'quiet_ceiling_db': round(quiet_ceiling, 1), 'segments': [{'in_s': round(s['in'], 7), 'out_s': round(s['out'], 7)}
                                                                      for s in segments],
            'joins': joins, 'kept_whole': kept_whole, 'removed': [{'from_s': lo, 'to_s': hi, 'why': why} for lo, hi, why in removes],
            'first_word_s': first, 'last_word_s': last}


def render(p: dict, out: str, speed: float, fps_out: int) -> None:
    """Stream, never buffer (a graph that trims one input many times holds every decoded frame: the 18 Nov short died
    of it). The picture is one select over the kept spans; the sound is cut here on the same frame grid (48 kHz holds a
    whole number of samples per frame of a 24, 30 or 48 fps take), each edge faded over FADE inside its quiet gap.
    Then the speed-up and the frame-rate change run in one graph from that file, so the two cannot drift."""
    import array
    import tempfile
    rate = 48000
    segs = [(s['in_s'], s['out_s']) for s in p['segments']]
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p['take'], '-vn', '-ac', '2', '-ar', str(rate), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    src = array.array('h', raw)
    outbuf = array.array('h')
    fade_n = int(FADE * rate)
    for k, (a, b) in enumerate(segs):
        i0, i1 = round(a * rate) * 2, round(b * rate) * 2
        chunk = src[i0:i1]
        n = len(chunk) // 2
        for j in range(min(fade_n, n)):
            g_in = j / fade_n if k > 0 else 1.0
            g_out = j / fade_n if k < len(segs) - 1 else 1.0
            for c in (0, 1):
                chunk[2 * j + c] = int(chunk[2 * j + c] * g_in)
                chunk[2 * (n - 1 - j) + c] = int(chunk[2 * (n - 1 - j) + c] * g_out)
        outbuf.extend(chunk)
    half = 0.5 / p['take_fps']   # segment ends sit on the take's frame grid; half a frame either side picks exactly its frames
    expr = '+'.join(f'between(t,{a - half:.6f},{b - half:.6f})' for a, b in segs)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'cut.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate); w.writeframes(outbuf.tobytes())
        flat = Path(tmp) / 'cut.mkv'
        script = Path(tmp) / 'select.txt'
        script.write_text(f"select='{expr}',setpts=N/FRAME_RATE/TB")
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', p['take'], '-i', str(wav),
                        '-filter_script:v', str(script), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium',
                        '-crf', '12', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', str(flat)], check=True)
        vf = f'setpts=PTS/{speed:.6f},fps={fps_out}' if speed != 1 else f'fps={fps_out}'
        af = f'rubberband=tempo={speed:.6f}:pitch=1:formant=preserved,aresample={rate}' if speed != 1 else f'aresample={rate}'
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(flat), '-filter_complex',
                        f'[0:v]{vf}[vo];[0:a]{af}[ao]', '-map', '[vo]', '-map', '[ao]', '-c:v', 'libx264', '-preset', 'medium',
                        '-crf', '14', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', str(rate), '-ac', '2', out], check=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('take')
    ap.add_argument('--edit', required=True)
    ap.add_argument('--clock-a', required=True)
    ap.add_argument('--clock-b', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--remove', action='append', default=[], metavar='FROM-TO:why')
    ap.add_argument('--speed', type=float, default=1.0)
    ap.add_argument('--speed-said')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--plan-only', action='store_true')
    args = ap.parse_args()
    if args.speed != 1 and not (args.speed_said or '').startswith('Krish'):
        sys.exit('edit_cut: a speed-up needs his words: --speed-said "Krish, YYYY-MM-DD: ..."')
    if not 1 <= args.speed <= MAX_SPEED:
        sys.exit(f'edit_cut: speed {args.speed} is outside 1 to {MAX_SPEED}')
    removes = []
    for r in args.remove:
        span, _, why = r.partition(':')
        lo, _, hi = span.partition('-')
        if not why.strip():
            sys.exit(f'edit_cut: removal {r} needs its reason after a colon')
        removes.append((float(lo), float(hi), why.strip()))
    p = plan(args.take, json.loads(Path(args.edit).read_text()), clock_words(args.clock_a), clock_words(args.clock_b), removes)
    kept = sum(s['out_s'] - s['in_s'] for s in p['segments'])
    p.update(speed=args.speed, speed_said=args.speed_said, fps_out=args.fps, kept_s=round(kept, 3),
             final_s=round(kept / args.speed, 3))
    out = Path(args.out)
    report = out.with_suffix('.edit-cut.json')
    report.write_text(json.dumps(p, indent=1) + '\n')
    if args.speed == 1:
        spans, t = [], 0.0
        for s in p['segments']:
            spans.append({'out_s': round(t, 4), 'src_s': s['in_s'], 'dur_s': round(s['out_s'] - s['in_s'], 4)})
            t += s['out_s'] - s['in_s']
        out.with_suffix('.av-sync-edl.json').write_text(json.dumps({'schema': 'av-sync-edl/1', 'spans': spans}, indent=1) + '\n')
    print(f'edit_cut: {len(p["segments"])} segments, {len(p["joins"])} joins, {len(p["kept_whole"])} pauses kept whole, '
          f'kept {kept:.2f} s, speed {args.speed}, final {kept / args.speed:.2f} s -> {report}')
    if not args.plan_only:
        render(p, str(out), args.speed, args.fps)
        print(f'edit_cut: wrote {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
