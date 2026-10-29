"""Synthetic stand-ins for the calibration cuts and the mutation tests: a few seconds of ffmpeg tones (one a word),
caption boxes drawn in a caption zone, and the aligner's words as a fixture instead of a model. Nothing here is
media of Krish; nothing is committed. Each stand-in carries the one fault its real cut has.

    build(folder, 'intact' | 'lost_word' | 'join_in_speech' | 'tight_joins' | 'stale_captions' | 'burned_late') -> case
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

FPS = 30
SIZE = (320, 180)
ZONE = [0, 120, 320, 60]
SCRIPT = 'Disney is building its own team and hiring sixty six staff because the lawsuits will not stop soon'


def words(text=SCRIPT, start=0.40, step=0.30, length=0.22):
    """One word every step seconds, each length long: gaps of step - length between them."""
    out, t = [], start
    for w in text.split():
        out.append({'w': ' ' + w, 's': round(t, 3), 'e': round(t + length, 3)})
        t += step
    return out


def pages_of(heard, per=4, offset_s=0.0):
    """Caption pages of `per` words, each starting on its first word (plus offset_s, a stale clock)."""
    pages = []
    for k in range(0, len(heard), per):
        group = heard[k:k + per]
        first = round((group[0]['s'] + offset_s) * FPS)
        last = round((heard[k + per]['s'] + offset_s) * FPS) if k + per < len(heard) else round((group[-1]['e'] + 0.4 + offset_s) * FPS)
        pages.append({'fromFrame': first, 'toFrame': last, 'words': [{'text': w['w'].strip(), 'atFrame': first} for w in group]})
    return pages


def _ffmpeg():
    return shutil.which('ffmpeg') or 'ffmpeg'


def shade(k):
    """Each page's box its own grey, so neighbouring pages differ and no two pages look alike."""
    return 60 + 35 * (k % 6)


def render(path, heard, drawn, seconds):
    """A tone a word, and each drawn page a box in the caption zone, its shade changing page to page."""
    on = '+'.join(f'between(t,{w["s"]},{w["e"]})' for w in heard) or '0'
    boxes = ','.join(f"drawbox=x=10:y={ZONE[1] + 10}:w=300:h=40:color=0x{shade(k):02x}{shade(k):02x}{shade(k):02x}:t=fill:"
                     f"enable='between(n,{p['fromFrame']},{p['toFrame'] - 1})'" for k, p in enumerate(drawn))
    video = f'color=c=black:s={SIZE[0]}x{SIZE[1]}:r={FPS}:d={seconds}' + (f',{boxes}' if boxes else '')
    subprocess.run([_ffmpeg(), '-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', video, '-f', 'lavfi', '-i',
                    f'sine=frequency=440:sample_rate=48000:duration={seconds}', '-af', f"volume=enable='not({on})':volume=0",
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(path)], check=True)


def ocr_stub(drawn):
    """The OCR a test uses: the text of the drawn page on screen at that frame, read perfectly."""
    def read(frame, expected):
        page = next((p for p in drawn if p['fromFrame'] <= frame < p['toFrame']), None)
        text = ' '.join(w['text'] for w in page['words']) if page else ''
        return {'text': text, 'score': 1.0 if text and text.lower() == expected.lower() else 0.0}
    return read


def build(folder, kind='intact') -> dict:
    """One stand-in: the files a calibration case names, and the stubs the gates use in place of a model and OCR."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    take = words()
    heard = [dict(w) for w in take]  # the finished cut heard back: here the cut is the take, unedited
    joins = [round((heard[k]['e'] + heard[k + 1]['s']) / 2, 3) for k in (3, 7, 11)]  # the middle of three 80 ms gaps
    pages = pages_of(heard)
    drawn = pages
    if kind == 'lost_word':
        heard = [w for w in heard if w['w'].strip() != 'lawsuits']
    elif kind == 'join_in_speech':
        joins[1] = round((heard[8]['s'] + heard[8]['e']) / 2, 3)
    elif kind == 'tight_joins':
        joins = [round(heard[k]['e'] + 0.010, 3) for k in (3, 7, 11)]  # 10 ms after a word end, as F09's reel
    elif kind == 'stale_captions':
        pages = pages_of(heard, offset_s=0.35)  # the props and the burned pages both on an old clock
        drawn = pages
    elif kind == 'burned_late':
        drawn = pages_of(heard, offset_s=0.35)  # the props are right; the renderer drew the pages on an old clock
    elif kind != 'intact':
        raise ValueError(f'unknown stand-in {kind}')
    seconds = round(take[-1]['e'] + 1.0, 2)
    video = folder / f'{kind}.mp4'
    render(video, heard, drawn, seconds)
    (folder / 'script.txt').write_text(SCRIPT, encoding='utf-8')
    (folder / 'take.words.json').write_text(json.dumps({'words': take}), encoding='utf-8')
    (folder / f'{kind}.heard.json').write_text(json.dumps({'words': heard}), encoding='utf-8')
    (folder / f'{kind}.joins.json').write_text(json.dumps({'joins': joins}), encoding='utf-8')
    (folder / f'{kind}.pages.json').write_text(json.dumps({'pages': pages}), encoding='utf-8')
    return {'video': video, 'script': SCRIPT, 'take': take, 'heard': heard, 'joins': joins, 'pages': pages,
            'drawn': drawn, 'region': ZONE, 'fps': FPS, 'ocr': ocr_stub(drawn)}
