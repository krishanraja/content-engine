"""Capture the exact native item frames used for PNG exports and motion approval."""
import hashlib
import io
import itertools
import shutil
import subprocess
from contextlib import contextmanager
from uuid import uuid4

from PIL import Image
from encode_motion import encode_frames


@contextmanager
def workspace(parent):
    path = parent / ('.render-' + uuid4().hex[:12])
    path.mkdir(parents=True)
    try:
        yield path
    finally:
        shutil.rmtree(path)


def browser_frames(page, here, item, times):
    page.set_viewport_size({'width':item['width'], 'height':item['height']})
    page.goto(f"{(here/'library.html').as_uri()}?item={item['id']}&t=0")
    page.evaluate('window.ready')
    for frame in times:
        page.evaluate('t => window.drawFrame(t)', frame)
        page.evaluate("""async () => {
            const paths = new Set([...document.querySelectorAll('main image')].map(el=>el.getAttribute('href')));
            await Promise.all([...paths].map(src=>{const image=new Image();image.src=src;return image.decode()}));
        }""")
        yield page.screenshot()


def native_frames(here, item, times):
    from native_proof import native_fonts, run
    fonts = native_fonts()
    times = iter(times)
    with workspace(here/'.scratch/library') as tmp:
        while batch := list(itertools.islice(times, 32)):
            art = run('art', [[item['id'],0,t] for t in batch], fonts)
            paths = [tmp/f'{t}.png' for t in batch]
            run('paint', [dict(w=item['width'],h=item['height'],svg=svg,path=str(path))
                          for svg,path in zip(art, paths, strict=True)], fonts)
            for path in paths:
                yield path.read_bytes()
                path.unlink()


def decoded_hash(path, expected_bytes):
    cmd = ['ffmpeg','-v','error','-i',str(path),'-map','0:v:0','-fps_mode','passthrough',
           '-pix_fmt','yuv420p','-f','rawvideo','pipe:1']
    result = hashlib.sha256()
    size = 0
    with subprocess.Popen(cmd, stdout=subprocess.PIPE) as decoder:
        while chunk := decoder.stdout.read(1024*1024):
            size += len(chunk)
            result.update(chunk)
        if decoder.wait() or size != expected_bytes:
            raise ValueError(f'Incomplete decoded frame sequence ({size}/{expected_bytes} bytes)')
    return result.hexdigest()


def fingerprint(item, capture, scratch):
    motion = item.get('motion') or {}
    count = motion.get('frames', 1)
    if not isinstance(count,int) or count < 1:
        raise ValueError('Invalid frame count')
    w,h = item['width'],item['height']
    record = {'width':w, 'height':h, 'frames':count}
    sequence = hashlib.sha256()
    def measured():
        for n,png in enumerate(capture(item,range(count))):
            with Image.open(io.BytesIO(png)) as image:
                if image.size!=(w,h):
                    raise ValueError(f'Expected {w} × {h}, captured {image.size}')
                pixels=image.convert('RGB').tobytes()
            if n==0:
                record['first_rgb24_sha256']=hashlib.sha256(pixels).hexdigest()
            if n==count-1:
                record['settled_rgb24_sha256']=hashlib.sha256(pixels).hexdigest()
            sequence.update(pixels)
            yield png
    if motion:
        if motion.get('fps',25)!=25:
            raise ValueError('Motion fingerprint requires the Library frame rate of 25 fps')
        with workspace(scratch) as tmp:
            movie=tmp/'approval.mp4'
            encode_frames(measured(), movie,w,h,count)
            record.update(fps=25,source_rgb24_sha256=sequence.hexdigest(),
                          decoded_yuv420p_sha256=decoded_hash(movie,w*h*3//2*count))
    else:
        if sum(1 for _ in measured()) != 1:
            raise ValueError('Expected one static frame')
    return record
