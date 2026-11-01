"""Review aids for the rebuilt cuts: contact sheets of the whole cut at 2 frames a second, side-by-side comparisons
against the approved references, and 720p share copies. Run from the repository root:
    python3 docs/plans/2026-11-02-monday/rebuild/review.py long|short"""
import glob, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]; P = ROOT / '.cache/proof'; OUT = P / 'mon'
tools = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin'))); FF = str(Path(tools[-1]) / 'ffmpeg')
def run(*a): subprocess.run([FF, '-v', 'error', '-y', *a], check=True)
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)], capture_output=True, text=True).stdout)
cut = sys.argv[1]
if cut == 'long':
    f = OUT / 'mon-long-16x9.mp4'; d = dur(f); n = 0
    for k, s in enumerate(range(0, int(d) + 1, 100)):   # 200 frames a sheet, 10 x 20, each tile 192 x 108 with its time
        run('-ss', str(s), '-t', '100', '-i', str(f), '-vf', "fps=2,scale=192:108,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6,tile=10x20", '-frames:v', '1', str(OUT / f'sheet-long-{k}.jpg'))
    lab = lambda t: f"drawtext=text='{t}':x=20:y=20:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.7"
    run('-ss', '60', '-t', '36.8', '-i', str(f), '-i', str(P / 'mon-proof-16x9.mp4'), '-i', str(P / 'clip-mon19.mp4'), '-i', str(P / 'clip-fri23.mp4'), '-filter_complex',
        f"[0:v]scale=960:540,{lab('THIS CUT 1:00')}[a];[1:v]scale=960:540,{lab('PROOF')}[b];[2:v]scale=960:540,{lab('MONDAY 19')}[c];[3:v]scale=960:540,trim=0:36.8,setpts=PTS-STARTPTS,{lab('FRIDAY 23')}[d];[a][b]hstack[t];[c][d]hstack[u];[t][u]vstack[v]",
        '-map', '[v]', '-map', '0:a', '-t', '36.8', '-c:v', 'libx264', '-crf', '23', '-c:a', 'aac', str(OUT / 'compare-long-4up.mp4'))
    run('-i', str(f), '-vf', 'scale=1280:720', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(OUT / 'mon-long-16x9-share720.mp4'))
else:
    f = OUT / 'mon-short-9x16.mp4'
    run('-i', str(f), '-vf', "fps=2,scale=108:192,drawtext=text='%{pts\\:hms}':x=2:y=2:fontsize=11:fontcolor=white:box=1:boxcolor=black@0.6,tile=16x10", '-frames:v', '1', str(OUT / 'sheet-short.jpg'))
    lab = lambda t: f"drawtext=text='{t}':x=20:y=200:fontsize=50:fontcolor=white:box=1:boxcolor=black@0.7"
    run('-ss', '10', '-t', '30', '-i', str(f), '-ss', '10', '-t', '30', '-i', str(P / 'ref/fri23-short.mp4'), '-filter_complex',
        f"[0:v]scale=720:1280,{lab('THIS CUT 0:10')}[a];[1:v]scale=720:1280,{lab('FRIDAY 23')}[b];[a][b]hstack[v]", '-map', '[v]', '-map', '0:a', '-t', '30', '-c:v', 'libx264', '-crf', '23', '-c:a', 'aac', str(OUT / 'compare-short.mp4'))
    run('-i', str(f), '-vf', 'scale=720:1280', '-c:v', 'libx264', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(OUT / 'mon-short-9x16-share720.mp4'))
print('done', cut)
