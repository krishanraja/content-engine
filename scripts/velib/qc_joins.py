"""Join discontinuities measured on decoded 48 kHz PCM, in +/-60 ms windows."""
from __future__ import annotations

import numpy as np

from .qc import audio_samples, measurement

RMS_STEP_DB = 6.0
CLICK_RATIO = 6.0
SPECTRAL_FLUX = 0.5


def decoder(render, joins) -> dict:
    """Joins are seconds or {atFrame} / {time_s} mappings; per-join limits optional.

    Flux is the L2 positive difference of unit-L2 magnitude spectra (0..1).
    The click baseline is the local median absolute sample difference, floored
    at 1e-5 full scale so numerical noise in silence cannot count as a click.
    """
    samples = audio_samples(render)
    rows, times = [], []
    for join in joins:
        opts = join if isinstance(join, dict) else {}
        time = float(opts['atFrame']) / 30 if 'atFrame' in opts else float(opts.get('time_s', join))
        times.append(time)
        center, radius = round(time * 48000), 2880
        row = {'time_s': time, 'pass': False}
        if center < radius or center + radius > len(samples):
            row['reason'] = 'Join lacks the full +/-60 ms measurement window'
            rows.append(row)
            continue
        before, after = samples[center - radius:center], samples[center:center + radius]
        rms = [max(float(np.sqrt(np.mean(a * a))), 1e-10) for a in (before, after)]
        step = abs(20 * np.log10(rms[1] / rms[0]))
        # Compare only the +/-10 ms join against local reference on each side:
        # 300 ms per side, excluding the +/-40 ms neighbourhood of the join.
        reference_radius, exclusion, click_radius = 14400, 1920, 480
        if center < reference_radius or center + reference_radius > len(samples):
            row['reason'] = 'Join lacks the full +/-300 ms reference window'
            rows.append(row)
            continue
        reference = np.concatenate((np.abs(np.diff(samples[center - reference_radius:center - exclusion])),
                                    np.abs(np.diff(samples[center + exclusion:center + reference_radius]))))
        diffs = np.abs(np.diff(samples[center - click_radius:center + click_radius + 1]))
        ratio = float(diffs.max() / max(float(np.median(reference)), 1e-5))
        spectra = [np.abs(np.fft.rfft(a * np.hanning(radius))) for a in (before, after)]
        spectra = [a / max(float(np.linalg.norm(a)), 1e-12) for a in spectra]
        flux = float(np.linalg.norm(np.maximum(spectra[1] - spectra[0], 0)))
        limits = {'rms_step_db': float(opts.get('rms_step_db', RMS_STEP_DB)),
                  'click_ratio': float(opts.get('click_ratio', CLICK_RATIO)),
                  'spectral_flux': float(opts.get('spectral_flux', SPECTRAL_FLUX))}
        values = {'rms_step_db': float(step), 'click_ratio': ratio, 'spectral_flux': flux}
        row.update(values, thresholds=limits, **{'pass': all(values[k] <= limits[k] for k in limits)})
        rows.append(row)
    report = measurement(rows, 'RMS step <= 6 dB, click <= 6x median, spectral flux <= 0.5')
    # No joins is a valid uninterrupted cut, rather than missing measurement data.
    if not rows:
        report['pass'] = True
    report['join_times_s'] = times
    report['failed_join_times_s'] = [r['time_s'] for r in rows if not r['pass']]
    return report
