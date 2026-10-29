#!/usr/bin/env python3
"""snackable: a short cut taken from an approved master by word range, for the off-day lane (W2.9).

Growth's off-day lane takes "snackable cuts content-engine makes from approved masters by word range" (Wave 2 brief,
W2.9). A snackable is never a new edit of his words: it is one continuous stretch of a master he already approved, cut
in and out only in a clean gap between words, so no word is clipped, changed or put out of sync (floor never 3: his
words never cut, changed or out of sync).

    python3 scripts/quick-edit/snackable.py plan --master CUT.mp4 --words CUT.heard.json --manifest "0 Publish/manifest.json" \\
        --from 12 --to 58 [--out plan.json]
    python3 scripts/quick-edit/snackable.py render --plan plan.json --out snack.mp4
    python3 scripts/quick-edit/snackable.py self-test

- The master is approved when its sha256 is an asset of the piece's sealed manifest (piece_manifest.py seal): his
  Approve for publish digest is there and QA passed. Anything else is refused.
- --words is the master's own word clock ({"words": [{"w", "s", "e"}]}, seconds, as words_gate.py reads it): the
  words of the finished file, never the take's.
- --from and --to are word numbers in that clock, 1-based and inclusive. The cut starts in the gap before the first
  word and ends in the gap after the last, each gap at least 80 ms wide with 30 ms clear of both words (the joins rule,
  W2.4); a range whose edge has no such gap is refused, and the plan names the nearest range that has one.
- render re-encodes the stretch frame-accurately with ffmpeg; it never changes the order, the speed or a sample of the
  sound inside the range.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

GAP_MIN = 0.080      # a join sits in a gap at least this wide (W2.4)
CLEAR = 0.030        # and at least this far from either word
PAD_MAX = 0.250      # never more than this of the gap is kept beside the words
MIN_SECONDS, MAX_SECONDS = 5.0, 90.0


class SnackError(Exception):
    pass


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_words(data):
    words = data.get('words') if isinstance(data, dict) else data
    if not isinstance(words, list) or not words:
        raise SnackError('the word clock needs a "words" list of {"w", "s", "e"}')
    out = []
    for n, w in enumerate(words, 1):
        try:
            s, e = float(w['s']), float(w['e'])
        except (KeyError, TypeError, ValueError):
            raise SnackError(f'word {n} needs w, s and e')
        if e < s or (out and s < out[-1]['s']):
            raise SnackError(f'word {n}: the clock runs backwards')
        out.append({'w': str(w.get('w', '')), 's': s, 'e': e})
    return out


def approved(manifest, master_sha256):
    """Why this master is not approved, or None: its sha256 must be an asset of a sealed manifest whose QA passed."""
    if not isinstance(manifest, dict) or manifest.get('schema') != 'content-engine-piece-manifest/1':
        return 'the manifest is not the piece\'s sealed 0 Publish/manifest.json'
    if not isinstance(manifest.get('approval_sha256'), str) or len(manifest['approval_sha256']) != 64:
        return 'the manifest is not sealed by his Approve for publish'
    if (manifest.get('qa') or {}).get('state') != 'passed':
        return 'the manifest\'s QA has not passed'
    if master_sha256 not in {a.get('sha256') for a in manifest.get('assets') or [] if isinstance(a, dict)}:
        return 'this master is not one of the files he approved (its sha256 is not in the manifest)'
    return None


def edge(words, i, side):
    """(time, gap) for a cut before word i (side 'in') or after it (side 'out'), or (None, gap) when the gap is not clean."""
    if side == 'in':
        before = words[i - 1]['e'] if i > 0 else 0.0
        gap = words[i]['s'] - before
        if gap < GAP_MIN or (i == 0 and words[0]['s'] < CLEAR):
            return None, gap
        return words[i]['s'] - min(PAD_MAX, max(CLEAR, gap / 2)), gap
    after = words[i + 1]['s'] if i + 1 < len(words) else None
    gap = (after - words[i]['e']) if after is not None else PAD_MAX
    if gap < GAP_MIN:
        return None, gap
    return words[i]['e'] + min(PAD_MAX, max(CLEAR, gap / 2)), gap


def plan(words, first, last, master_sha256, master=None):
    """The cut: in and out in clean gaps around words first..last (1-based, inclusive)."""
    if not (isinstance(first, int) and isinstance(last, int) and 1 <= first <= last <= len(words)):
        raise SnackError(f'--from and --to are word numbers from 1 to {len(words)}, from not after to')
    a, b = first - 1, last - 1
    t_in, gap_in = edge(words, a, 'in')
    t_out, gap_out = edge(words, b, 'out')
    if t_in is None or t_out is None:
        near = nearest(words, a, b)
        side = 'start' if t_in is None else 'end'
        raise SnackError(f'the {side} has no clean gap ({(gap_in if t_in is None else gap_out) * 1000:.0f} ms, needs {GAP_MIN * 1000:.0f}):'
                         f' it would clip a word. ' + (f'The nearest clean range is {near[0]} to {near[1]}.' if near else 'No nearby range is clean.'))
    seconds = t_out - t_in
    if not MIN_SECONDS <= seconds <= MAX_SECONDS:
        raise SnackError(f'the cut is {seconds:.1f} s; a snackable is {MIN_SECONDS:.0f} to {MAX_SECONDS:.0f} s')
    return {'schema': 'content-engine-snackable/1', 'master': str(master) if master else None, 'master_sha256': master_sha256,
            'from': first, 'to': last, 'in': round(t_in, 3), 'out': round(t_out, 3), 'seconds': round(seconds, 3),
            'words': ' '.join(w['w'] for w in words[a:b + 1]), 'gaps_ms': [round(gap_in * 1000), round(gap_out * 1000)]}


def nearest(words, a, b, reach=8):
    """The nearest (from, to), 1-based, with clean gaps at both ends, moving each end at most reach words."""
    best = None
    for da in range(-reach, reach + 1):
        for db in range(-reach, reach + 1):
            i, j = a + da, b + db
            if 0 <= i <= j < len(words) and edge(words, i, 'in')[0] is not None and edge(words, j, 'out')[0] is not None:
                cost = abs(da) + abs(db)
                if best is None or cost < best[0]:
                    best = (cost, i + 1, j + 1)
    return best[1:] if best else None


def render(p, out, ffmpeg='ffmpeg'):
    """Re-encode exactly [in, out) of the master: frame-accurate, same order, same speed, the sound untouched inside."""
    master = p.get('master')
    if not master or not Path(master).exists():
        raise SnackError('the plan\'s master is not on this computer')
    if sha256_file(master) != p['master_sha256']:
        raise SnackError('the master changed since the plan was made: its sha256 differs')
    cmd = [ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{p["in"]:.3f}', '-i', str(master), '-t', f'{p["seconds"]:.3f}',
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(out)]
    subprocess.run(cmd, check=True)
    return out


def self_test():
    bad = []
    check = lambda name, ok: bad.append(name) if not ok else None
    # A synthetic clock: a word every 0.5 s, 0.3 s long (0.2 s gaps), one tight join after word 10 (40 ms).
    words = [{'w': f'w{n}', 's': 1.0 + n * 0.5, 'e': 1.3 + n * 0.5} for n in range(40)]
    words[10]['e'] = words[11]['s'] - 0.04
    words = read_words({'words': words})
    p = plan(words, 3, 20, 'a' * 64)
    check('the cut starts in the gap before its first word and ends in the gap after its last',
          words[1]['e'] < p['in'] < words[2]['s'] and words[19]['e'] < p['out'] < words[20]['s'])
    check('every word in the range is inside the cut, whole', all(p['in'] <= w['s'] and w['e'] <= p['out'] for w in words[2:20]))
    check('no word outside the range is in it', words[1]['e'] <= p['in'] and p['out'] <= words[20]['s'])
    check('the plan says the words it carries', p['words'].split()[0] == 'w2' and p['words'].split()[-1] == 'w19')
    try:
        plan(words, 3, 11, 'a' * 64)
        check('a range ending in a 40 ms gap is refused', False)
    except SnackError as error:
        check('a refused range names the nearest clean one', 'nearest clean range' in str(error))
    for f, t in ((0, 5), (5, 3), (3, 99)):
        try:
            plan(words, f, t, 'a' * 64)
            check(f'word range {f} to {t} is refused', False)
        except SnackError:
            pass
    try:
        plan(words, 3, 5, 'a' * 64)
        check('a cut under 5 s is refused', False)
    except SnackError:
        pass
    sealed = {'schema': 'content-engine-piece-manifest/1', 'approval_sha256': 'b' * 64, 'qa': {'state': 'passed'}, 'assets': [{'sha256': 'a' * 64}]}
    check('a master in the sealed manifest is approved', approved(sealed, 'a' * 64) is None)
    check('a master not in it is refused', approved(sealed, 'c' * 64) is not None)
    check('an unsealed draft is refused', approved({k: v for k, v in sealed.items() if k != 'approval_sha256'}, 'a' * 64) is not None)
    check('a manifest whose QA is held is refused', approved(dict(sealed, qa={'state': 'held'}), 'a' * 64) is not None)
    ffmpeg = shutil.which('ffmpeg')
    if ffmpeg:
        with tempfile.TemporaryDirectory() as tmp:
            master = Path(tmp) / 'master.mp4'
            subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=24',
                            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
                            '-shortest', str(master)], check=True)
            rp = plan(words, 3, 20, sha256_file(master), master)
            out = render(rp, Path(tmp) / 'snack.mp4', ffmpeg)
            probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)],
                                   capture_output=True, text=True).stdout.strip()
            check(f'the render is the plan\'s length ({probe} s, plan {rp["seconds"]} s)', abs(float(probe or 0) - rp['seconds']) < 0.1)
            master.write_bytes(master.read_bytes() + b'x')
            try:
                render(rp, Path(tmp) / 'again.mp4', ffmpeg)
                check('a master changed since the plan is refused', False)
            except SnackError:
                pass
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    p = sub.add_parser('plan', help='the cut from an approved master by word range')
    p.add_argument('--master', required=True)
    p.add_argument('--words', required=True, help='the master\'s own word clock, {"words": [{"w", "s", "e"}]}')
    p.add_argument('--manifest', required=True, help='the piece\'s sealed 0 Publish/manifest.json')
    p.add_argument('--from', dest='first', type=int, required=True)
    p.add_argument('--to', dest='last', type=int, required=True)
    p.add_argument('--out')
    r = sub.add_parser('render', help='cut the plan from its master')
    r.add_argument('--plan', required=True)
    r.add_argument('--out', required=True)
    sub.add_parser('self-test')
    a = ap.parse_args(argv)
    try:
        if a.cmd == 'self-test':
            bad = self_test()
            print('snackable self-test ' + ('FAILED:\n  ' + '\n  '.join(bad) if bad else 'passed'))
            return 1 if bad else 0
        if a.cmd == 'plan':
            sha = sha256_file(a.master)
            why = approved(json.loads(Path(a.manifest).read_text(encoding='utf-8')), sha)
            if why:
                raise SnackError(why)
            out = plan(read_words(json.loads(Path(a.words).read_text(encoding='utf-8'))), a.first, a.last, sha, Path(a.master).resolve())
            text = json.dumps(out, indent=1)
            if a.out:
                Path(a.out).write_text(text + '\n', encoding='utf-8')
            print(text)
            return 0
        if a.cmd == 'render':
            print(f'wrote {render(json.loads(Path(a.plan).read_text(encoding="utf-8")), a.out)}')
            return 0
    except (SnackError, OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'snackable: {error}', file=sys.stderr)
        return 1
    ap.print_help()
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
