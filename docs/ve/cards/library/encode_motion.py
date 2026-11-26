"""Encode the renderer's numbered PNG frames in bounded H.264 segments."""
import json
import shutil
import subprocess
from uuid import uuid4


def encode_frames(frames, target, width, height, count):
    """Keep the same encoding settings for playback, approval and verification."""
    target.parent.mkdir(parents=True, exist_ok=True)
    work = target.parent / ('.frames-' + uuid4().hex[:12])
    work.mkdir()
    try:
        parts = []
        seen = 0
        for index, png in enumerate(frames):
            if index >= count:
                raise ValueError(f'{target.name}: excess motion frames')
            offset = index % 150
            (work / f'{offset:04d}.png').write_bytes(png)
            seen += 1
            if offset == 149 or seen == count:
                part = f'part-{index-offset:06d}.mp4'
                subprocess.run(['ffmpeg','-v','error','-y','-framerate','25','-i','%04d.png',
                                '-frames:v',str(offset+1),'-c:v','libx264','-bf','0','-pix_fmt',
                                'yuv420p','-crf','18','-r','25',part], cwd=work, check=True)
                parts.append(f"file '{part}'")
                for image in work.glob('*.png'):
                    image.unlink()
        if seen != count:
            raise ValueError(f'{target.name}: {seen} of {count} motion frames')
        (work/'parts.txt').write_text('\n'.join(parts), encoding='ascii')
        subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','parts.txt',
                        '-c','copy','-movflags','+faststart','complete.mp4'], cwd=work, check=True)
        stream = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
            '-show_entries','stream=width,height,codec_name,pix_fmt,avg_frame_rate,nb_frames',
            '-of','json','complete.mp4'],cwd=work))['streams'][0]
        actual = (stream['width'],stream['height'],stream['codec_name'],stream['pix_fmt'],
                  stream['avg_frame_rate'],int(stream['nb_frames']))
        expected = (width,height,'h264','yuv420p','25/1',count)
        if actual != expected:
            raise ValueError(f'{target.name}: expected {expected}, encoded {actual}')
        (work/'complete.mp4').replace(target)
    finally:
        shutil.rmtree(work)


def encode_motion(page, registry, html, folder):
    from frame_capture import browser_frames
    items = {i['id']:i for i in registry['items']}
    jobs = [('item', i['id'], i['width'], i['height'], i['motion']['frames'])
            for i in registry['items'] if i.get('status')!='retired' and (i.get('motion') or {}).get('tracks')]
    jobs.extend(('seq',key,s['width'],s['height'],s['frames']) for key,s in registry['sequences'].items())
    for kind,key,w,h,count in jobs:
        print(f'{key} · {w} × {h} · {count} frames',flush=True)
        if kind=='item':
            frames = browser_frames(page,html.parent,items[key],range(count))
            encode_frames(frames,folder/(key+'.mp4'),w,h,count)
            continue
        page.set_viewport_size({'width':w,'height':h})
        page.goto(f'{html.as_uri()}?{kind}={key}&t=0')
        page.evaluate('window.ready')

        def frames():
            for t in range(count):
                page.evaluate('t => window.drawFrame(t)', t)
                yield page.screenshot()
        encode_frames(frames(),folder/(key+'.mp4'),w,h,count)
