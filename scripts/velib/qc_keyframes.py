"""Compare rendered beat keyframes with hash-verified approved stills."""
from __future__ import annotations

import io
import subprocess

import numpy as np
from PIL import Image, ImageFilter, ImageChops

from . import designlock
from .common import ffmpeg
from .qc import frame_span


def ssim(a, b) -> float:
    """Uniform 7x7 SSIM, using population moments over the valid area."""
    a, b = np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64)
    if a.shape != b.shape or a.ndim != 2 or min(a.shape) < 7:
        raise ValueError('SSIM needs equal-size grayscale arrays at least 7x7')
    if not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError('SSIM needs finite pixels')

    def mean(x):
        integral = np.pad(x, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
        return (integral[7:, 7:] - integral[:-7, 7:] -
                integral[7:, :-7] + integral[:-7, :-7]) / 49

    ma, mb = mean(a), mean(b)
    va, vb = np.maximum(0, mean(a * a) - ma * ma), np.maximum(0, mean(b * b) - mb * mb)
    cov = mean(a * b) - ma * mb
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    return float(np.mean(((2 * ma * mb + c1) * (2 * cov + c2)) /
                         ((ma * ma + mb * mb + c1) * (va + vb + c2))))


def _images(rendered, golden_path, lock):
    size = tuple(lock['thresholds']['keyframe_compare_size'])
    if isinstance(rendered, Image.Image):
        render = rendered.convert('L').resize(size, Image.Resampling.LANCZOS)
    else:
        with Image.open(rendered) as image:
            render = image.convert('L').resize(size, Image.Resampling.LANCZOS)
    with Image.open(golden_path) as image:
        golden = image.convert('L')
    if golden.size != size:
        raise ValueError(f'Golden size {golden.size} must equal comparison size {size}')
    return render, golden


def compare(rendered, golden_path, lock) -> dict:
    render, golden = _images(rendered, golden_path, lock)
    # Calibrated 28 Oct 2026 on a real engine render: raw SSIM scored the rejected frames as high as a faithful
    # render. Masking the engine-supplied caption zone and smoothing grain and sub-pixel drift separates them
    # (faithful >= 0.83, wrong beat <= 0.67, rejected <= 0.65).
    thresholds = lock['thresholds']
    blur = thresholds.get('keyframe_blur_px', 0)
    arrays = []
    for image in (render, golden):
        if blur:
            image = image.filter(ImageFilter.GaussianBlur(blur))
        array = np.asarray(image, dtype=float).copy()
        zone = lock.get('zones', {}).get('caption') if thresholds.get('keyframe_mask_caption') else None
        if zone:
            sx, sy = array.shape[1] / 1080, array.shape[0] / 1920
            array[int(zone['y'] * sy):int((zone['y'] + zone['h']) * sy), int(zone['x'] * sx):int((zone['x'] + zone['w']) * sx)] = 128
        arrays.append(array)
    score = ssim(arrays[0], arrays[1])
    minimum = lock['thresholds']['keyframe_ssim_min']
    return {'ssim': score, 'min': minimum, 'pass': score >= minimum}


def _applicability(lock, fmt):
    if fmt not in lock['formats']:
        return {'applies': False, 'note': 'legacy format'}
    frozen, reasons = designlock.frozen(lock, fmt)
    if not frozen:
        return {'applies': False, 'note': 'not frozen: ' + '; '.join(reasons)}
    return None


def _frame(video, beat):
    first, end = frame_span(beat)
    at = beat.get('keyFrame', first + int((end - first) * 0.8))
    if type(at) is not int or not first <= at < end:
        raise ValueError(f'keyFrame {at} must be an integer inside beat [{first}, {end})')
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(video), '-an',
                             '-vf', f'select=eq(n\\,{at})', '-fps_mode', 'passthrough',
                             '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                            capture_output=True, check=True)
    with Image.open(io.BytesIO(result.stdout)) as image:
        return image.convert('RGB'), at


def golden_owner(lock, fmt, beat_id):
    """The format whose approved still this beat is held to: the cut's own format first, then a module format.
    None means the beat is an extra the lock does not name, which is composition-checked only."""
    if beat_id in lock['formats'][fmt]['beats']:
        return fmt
    for name, settings in lock['formats'].items():
        if name != fmt and settings.get('role') == 'module' and beat_id in settings['beats']:
            return name if designlock.frozen(lock, name)[0] else None
    return None


def keyframe_checks(video, props, lock, fmt) -> dict:
    inactive = _applicability(lock, fmt)
    if inactive:
        return inactive
    own, actual = lock['formats'][fmt]['beats'], props.get('beats', [])
    rows, findings = {}, []
    minimum = lock['thresholds']['keyframe_ssim_min']
    present = [beat.get('id') for beat in actual]
    for name in own:
        if name not in present:
            rows[name] = {'ssim': None, 'min': minimum, 'pass': False, 'reason': f'locked beat {name} is missing'}
            findings.append(f'{name}: locked beat missing')
    for index, beat in enumerate(actual):
        name = beat.get('id')
        owner = golden_owner(lock, fmt, name)
        if owner is None:
            rows[name] = {'ssim': None, 'min': minimum, 'pass': True, 'golden': None,
                          'note': 'extra beat: no golden, composition-checked'}
            continue
        row = {'ssim': None, 'min': minimum, 'pass': False, 'golden': owner}
        try:
            image, at = _frame(video, beat)
            row.update(compare(image, designlock.golden_path(lock, owner, name), lock), frame=at)
        except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
            row['reason'] = str(error)
            row['pass'] = False
        rows[name] = row
        if not row['pass']:
            findings.append(f'{name}: ssim {row["ssim"]} min {minimum}' +
                            (f'; {row["reason"]}' if 'reason' in row else ''))
    golden_rows = [row for row in rows.values() if row.get('golden')]
    return {'applies': True, 'pass': bool(golden_rows) and not findings, 'beats': rows, 'findings': findings}


def sheet(video, props, lock, fmt, out_path):
    inactive = _applicability(lock, fmt)
    if inactive:
        raise ValueError(inactive['note'])
    beats = [(beat['id'], golden_owner(lock, fmt, beat['id']), beat) for beat in props.get('beats', [])]
    beats = [(name, owner, beat) for name, owner, beat in beats if owner]
    if not beats:
        raise ValueError('Contact sheet needs one rendered beat per golden')
    width, height = lock['thresholds']['keyframe_compare_size']
    canvas = Image.new('RGB', (width * 3, height * len(beats)))
    for index, (name, owner, beat) in enumerate(beats):
        image, _ = _frame(video, beat)
        render, golden = _images(image, designlock.golden_path(lock, owner, name), lock)
        difference = ImageChops.difference(golden, render).point(lambda value: min(255, value * 4))
        for column, tile in enumerate((golden, render, difference)):
            canvas.paste(tile, (column * width, index * height))
    canvas.save(out_path, format='JPEG', quality=90)
