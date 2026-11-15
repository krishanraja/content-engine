"""Compile the session's explicit character choices onto the cut clock."""
import hashlib
import json
import math
import wave
from pathlib import Path
import numpy as np
from . import character, character_library
from .common import ROOT


def compile_track(spec, cut_id, words, props, assets):
    ch = spec.get('character')
    if not ch or cut_id not in ch.get('cuts', []):
        return None
    errors = character.spec_lints(spec)
    if errors:
        raise ValueError('; '.join(errors))
    acting = json.loads(character.MANIFEST.read_text())['acting']
    cut = spec['cuts'][cut_id]
    if cut['aspect'] != '9:16':
        raise ValueError('character.aspect: 9:16 only')
    book = character_library.index(character_library.library_dir())
    by_word = {w['w']: w for w in words}
    poses = []
    zones = json.loads((ROOT / 'config/channel-safe-zones.json').read_text())
    obstacles = [z['box'] for c in zones['channels'].values() for z in c['zones']
                 if 'action rail' in z['name'] or 'top bar' in z['name']]
    # Caption geometry is shared with channel QC, including themed placements.
    from .qc_faces import caption_box
    caption_boxes = [caption_box(p, props.get('captionStyle', 'house'), '9:16', [60, 1207, 820, 113])
                     for p in props['captions']]
    if props.get('captionTheme'):
        regions = {'lower': [70, 990, 800, 330], 'upper': [70, 290, 940, 230], 'centre': [70, 700, 800, 420]}
        caption_boxes.append(regions[props.get('captionPlacement', 'lower')])
    def intersects(a, b):
        return a[0] < b[0]+b[2] and a[2] > b[0] and a[1] < b[1]+b[3] and a[3] > b[1]
    for i, cue in enumerate(ch.get('cues', [])):
        label = f'character.cues.{i}'
        if cue['at_w'] not in by_word:
            raise ValueError(f'{label}: no timing for word')
        frame = by_word[cue['at_w']]['atFrame'] - 4
        if frame < props['beats'][0]['toFrame']:
            raise ValueError(f'{label}: lead enters hook beat')
        if poses and frame - poses[-1]['fromFrame'] < 15:
            raise ValueError(f'{label}: two poses within 15 frames')
        if poses and frame - poses[-1]['fromFrame'] < 30 / acting['max_poses_per_second']:
            raise ValueError(f'{label}: more than 0.8 poses a second')
        pose = book['poses'][cue['pose']]
        spot = cue.get('spot', acting['default_spot'])
        if spot not in acting['spots_x']:
            raise ValueError(f'{label}: unknown spot {spot}')
        sink = cue.get('sink_px', 40)
        if not isinstance(sink, (int, float)) or not 0 <= sink <= 190:
            raise ValueError(f'{label}: sink_px outside 0..190')
        scale = 570 / pose['states']['closed']['size'][1]
        width = pose['states']['closed']['size'][0] * scale
        boxes = [s['opaque_box'] for s in pose['states'].values() if s['opaque_box']]
        opaque = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
        # All future beats are protected: this pose may hold through a handover.
        protected = obstacles + caption_boxes
        for beat in cut['beats']:
            if beat.get('key_box'):
                protected.append(beat['key_box'])
        found = None
        for depth in range(math.ceil(sink), 191):
            for x in dict.fromkeys([acting['spots_x'][spot], 540, 500, 460, 420, 380, 350]):
                left, top = x-width/2, 1985+depth-570
                # Reserve all sway, breathing and settling movement, including entrance below frame.
                box = [left+opaque[0]*scale-8, top+opaque[1]*scale-8,
                       left+opaque[2]*scale+8, 1920]
                if not any(intersects(box, b) for b in protected):
                    found = (x, depth)
                    break
            if found:
                break
        if not found:
            raise ValueError(f'{label}: opaque box cannot clear protected regions within 190 px sink')
        poses.append(dict(fromFrame=frame, pose=cue['pose'], spot=spot, sinkPx=found[1], x=found[0], width=width))
    duration = props['durationFrames']
    mouth = [False] * duration
    stem = Path(assets) / f'audio.{cut_id}.wav'
    with wave.open(str(stem), 'rb') as wav:
        if wav.getsampwidth() != 2:
            raise ValueError('character mouth requires 16-bit PCM stem')
        rate = wav.getframerate()
        samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(float).reshape(-1, wav.getnchannels()) / 32768
    for word in words:
        for f in range(word['atFrame'], min(duration, round(word['end_s'] * 30))):
            chunk = samples[round(f*rate/30):round((f+1)*rate/30)]
            mouth[f] = bool(chunk.size and np.sqrt(np.mean(chunk**2)) >= 10**(-50/20))
    seed = f'{spec["piece_id"]}:{cut_id}'
    blinks = []
    f = poses[0]['fromFrame'] if poses else duration
    n = 0
    while f < duration:
        gap = 90 + int(hashlib.sha256(f'{seed}:{n}'.encode()).hexdigest()[:8], 16) % 46
        f += gap
        n += 1
        active = next((p for p in reversed(poses) if p['fromFrame'] <= f), None)
        if f+4 <= duration and active and book['poses'][active['pose']].get('eye_box'):
            blinks.append(f)
    images = character_library.stage(book, [p['pose'] for p in poses], assets)
    from .compile import source
    images = {p: {s: source(str(Path(path).relative_to(Path(assets))), Path(assets)) for s, path in states.items()} for p, states in images.items()}
    return dict(poses=poses, mouth=mouth, blinks=blinks, images=images, seed=seed)
