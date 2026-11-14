import subprocess, sys, os
src, spans_file, outv, outa, work = sys.argv[1:6]
os.makedirs(work, exist_ok=True)
spans = [tuple(map(float, s.split(':'))) for s in open(spans_file).readline().split()]
lst = open(f'{work}/list.txt', 'w'); fa = ''; la = ''
for i, (a, b) in enumerate(spans):
    n = round((b - a) * 30); p = f'{work}/s{i:03d}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.4f}', '-i', src, '-frames:v', str(n), '-an', '-c:v', 'libx264', '-crf', '16', '-g', '1', '-pix_fmt', 'yuv420p', '-r', '30', p], check=True)
    lst.write(f"file '{p}'\n")
    fa += f'[0:a]atrim={a:.4f}:{b:.4f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={b - a - 0.012:.4f}:d=0.012[a{i}];'; la += f'[a{i}]'
lst.close()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{work}/list.txt', '-vf', 'setpts=PTS/1.06,fps=30', '-c:v', 'libx264', '-crf', '16', '-g', '1', '-pix_fmt', 'yuv420p', outv], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-vn', '-i', src, '-filter_complex', f'{fa}{la}concat=n={len(spans)}:v=0:a=1,atempo=1.06,loudnorm=I=-16:TP=-1.5:LRA=11[o]', '-map', '[o]', '-ar', '48000', outa], check=True)
for f in (outv, outa):
    print(f, subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip())
