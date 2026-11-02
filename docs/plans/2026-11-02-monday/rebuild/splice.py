"""Re-render only some spans of a finished cut and splice them back losslessly on its keyframes, so the rest of the
file is byte-for-byte the frames it was. Spans are given in frames and must start and end on keyframes of the silent
cut (the end may be the last frame). Then remixes nothing: the caller re-runs the audio only if the audio changed.
    python3 docs/plans/2026-11-02-monday/rebuild/splice.py long 500:1000 1750:2500 ..."""
import subprocess, sys
from multiprocessing import Process
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))
import compose as C

def frames(path):
    return int(subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets',
                               '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout.strip())

if __name__ == '__main__':
    name = sys.argv[1]; spans = sorted(tuple(map(int, s.split(':'))) for s in sys.argv[2:])
    cut = C.Cut(name); silent = cut.out.with_suffix('.silent.mp4'); total = frames(silent)
    work = []                 # split each span in two so four workers share the machine
    for a, b in spans:
        m = (a + b) // 2; work += [(a, m), (m, b)]
    parts = {w: C.OUT / f'{name}-splice-{w[0]}-{w[1]}.mp4' for w in work}
    ps = [Process(target=C.worker, args=(name, a, b, parts[(a, b)])) for a, b in work]
    for p in ps: p.start()
    for p in ps: p.join()
    for (a, b), f in parts.items():
        n = frames(f); assert n == b - a, (f, n, b - a)
    # the untouched stretches, copied from the old file starting on its keyframes
    pieces, cur = [], 0
    for a, b in spans:
        if a > cur:
            f = C.OUT / f'{name}-keep-{cur}-{a}.mp4'
            subprocess.run([C.FF, '-v', 'error', '-y', '-ss', f'{cur / C.FPS:.6f}', '-i', str(silent), '-frames:v', str(a - cur), '-c', 'copy', str(f)], check=True)
            assert frames(f) == a - cur, (f, frames(f), a - cur); pieces.append(f)
        pieces += [parts[(a, (a + b) // 2)], parts[((a + b) // 2, b)]]; cur = b
    if cur < total:
        f = C.OUT / f'{name}-keep-{cur}-{total}.mp4'
        subprocess.run([C.FF, '-v', 'error', '-y', '-ss', f'{cur / C.FPS:.6f}', '-i', str(silent), '-c', 'copy', str(f)], check=True)
        assert frames(f) == total - cur, (f, frames(f), total - cur); pieces.append(f)
    lst = C.OUT / f'{name}-splice.txt'; lst.write_text(''.join(f"file '{p}'\n" for p in pieces))
    new = silent.with_name(silent.stem + '.spliced.mp4')
    subprocess.run([C.FF, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(new)], check=True)
    assert frames(new) == total, (frames(new), total)
    new.replace(silent)
    # put the new picture under the existing, unchanged mix
    final = cut.out.with_suffix('.mp4'); tmp = final.with_name(final.stem + '.tmp.mp4')
    subprocess.run([C.FF, '-v', 'error', '-y', '-i', str(silent), '-i', str(final), '-map', '0:v', '-map', '1:a', '-c', 'copy', '-movflags', '+faststart', str(tmp)], check=True)
    tmp.replace(final)
    for p in pieces: p.unlink()
    print('spliced', name, spans, 'frames', total)
