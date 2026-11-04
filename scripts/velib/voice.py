"""The voice pass on a conformed cut's dialogue.

Sniffs, on every cut (Krish, 17 Oct 2026: "i was sniffing a bit so dampen that out surgically"; learning
sniffs-dampened). Quick-edit has done this on every render since 17 Oct with episode.sniffs and episode.duck; ve did
not. Each sniff found in a gap between his words is turned down 18 dB with soft fades, never cut, so no word, timing
or lip sync moves, and every one is listed in voice.<cut>.json to check.

The repair chain (quick-edit's VOICE_REPAIR: rumble cut, light noise reduction, less mud, more presence, softer s,
2.5:1 levelling) runs only when config/ve/voice-chain.json carries Krish's approval in his words: no approval of it
was found on 4 Nov 2026, so it waits on his ear. `ab` makes the 10-second raw and repaired pair he judges it by. The
chain delays the voice (afftdn, about 25 ms), so the delay is measured and taken out before anything else.
config/ve/voice-chain.json is part of the engine freeze (config/ve/production-guards.json): approved during a piece,
it needs his exception press before that piece's proof or cut renders, because it changes his voice in every cut.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from .common import ROOT, ffmpeg, sha256_file, write_json

_QUICK_EDIT = str(Path(__file__).resolve().parents[1] / 'quick-edit')
if _QUICK_EDIT not in sys.path:
    sys.path.insert(0, _QUICK_EDIT)
import episode  # noqa: E402

CHAIN_CONFIG = ROOT / 'config' / 've' / 'voice-chain.json'
RATE = 48000
MAX_LATENCY_LEFT_S = 0.001


def approved_chain(path: Path = CHAIN_CONFIG) -> str | None:
    """The repair chain Krish approved by ear, or None: the file must name him and carry his words."""
    if not Path(path).is_file():
        return None
    doc = json.loads(Path(path).read_text(encoding='utf-8'))
    if doc.get('approved_by') != 'Krish' or not str(doc.get('approval_words') or '').strip() or not doc.get('approved_on'):
        raise ValueError(f'{path}: a voice chain needs approved_by Krish, approved_on and his approval_words')
    chain = str(doc.get('chain') or '').strip()
    if not chain:
        raise ValueError(f'{path}: no chain')
    return chain


def chain_latency(ref, processed, seconds=60.0, rate=16000, most=0.25) -> float:
    """How much later the processed voice runs than the voice it was made from, in seconds (cross-correlation over
    the first minute, at most a quarter second either way). The same measure as quick-edit make.chain_latency."""
    import numpy as np  # noqa: PLC0415

    def pcm(path):
        raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(path), '-t', f'{seconds}', '-vn', '-ac', '1', '-ar', str(rate),
                              '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).astype(np.float64)
        return x - x.mean()
    a, b = pcm(ref), pcm(processed)
    n = min(len(a), len(b))
    if n < rate:
        return 0.0
    a, b = a[:n], b[:n]
    size = 1 << (2 * n - 1).bit_length()
    c = np.fft.irfft(np.fft.rfft(b, size) * np.conj(np.fft.rfft(a, size)), size)
    m = int(most * rate)
    lags = np.concatenate([np.arange(m + 1), np.arange(-m, 0)])
    return float(lags[np.argmax(np.concatenate([c[:m + 1], c[-m:]]))] / rate)


def _samples(path: Path) -> int:
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return len(raw) // 2


def repair(src: Path, dst: Path, chain: str) -> float:
    """Run the chain and take its delay out, so the repaired voice sits where the raw one did; return the delay."""
    with tempfile.TemporaryDirectory(prefix='ve-voice-') as temp:
        wet = Path(temp) / 'wet.wav'
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(src), '-af', chain, '-c:a', 'pcm_f32le',
                        '-ar', str(RATE), str(wet)], check=True, capture_output=True)
        lag = chain_latency(src, wet)
        shift = (f'atrim=start={lag:.6f},asetpts=PTS-STARTPTS,apad' if lag > 0 else
                 f'adelay={-lag * 1000:.3f}:all=1' if lag < 0 else 'anull')
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(wet), '-af', shift, '-t', f'{_samples(src) / RATE:.6f}',
                        '-c:a', 'pcm_f32le', '-ar', str(RATE), str(dst)], check=True, capture_output=True)
    return lag


def prepare(raw: Path, words: list[dict], out: Path, sidecar: Path) -> dict:
    """The cut's dialogue: repaired only if he approved the chain, then every sniff between his words turned down.
    words are the cut's words on the dialogue's own clock ({onset_s, end_s})."""
    raw, out = Path(raw), Path(out)
    chain = approved_chain()
    with tempfile.TemporaryDirectory(prefix='ve-voice-') as temp:
        source, lag = raw, None
        if chain:
            source = Path(temp) / 'repaired.wav'
            lag = repair(raw, source, chain)
        spans = [{'s': w['onset_s'], 'e': w['end_s']} for w in words]
        events = episode.sniffs(source, spans)
        episode.duck(source, out, events)
        left = chain_latency(raw, out) if chain else 0.0
    before, after = _samples(raw), _samples(out)
    if abs(before - after) > RATE // 1000:
        raise ValueError(f'the voice pass changed the dialogue length ({before} to {after} samples)')
    if abs(left) > MAX_LATENCY_LEFT_S:
        raise ValueError(f'the repaired voice still runs {left * 1000:.1f} ms off the raw voice')
    report = {'schema': 've-voice/1', 'raw': raw.name, 'raw_sha256': sha256_file(raw), 'out': out.name,
              'out_sha256': sha256_file(out), 'repair': bool(chain), 'chain': chain,
              'chain_latency_ms': round(lag * 1000, 2) if lag is not None else None,
              'latency_left_ms': round(left * 1000, 2), 'samples': {'raw': before, 'out': after},
              'sniffs': events, 'sniff_rule': {'duck_db': episode.SNIFF['duck_db'], 'fade_s': episode.SNIFF['fade_s']},
              'ruling': 'Krish, 2026-10-17: "i was sniffing a bit so dampen that out surgically."'}
    write_json(sidecar, report)
    return report


def ab(raw: Path, out_dir: Path, start_s: float, seconds: float = 10.0, chain: str | None = None) -> dict:
    """The pair Krish judges the repair chain by: the same seconds of his voice, raw and repaired (delay removed)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    chain = chain or episode.VOICE_REPAIR
    dry = out_dir / 'voice-ab.raw.wav'
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-ss', f'{start_s:.3f}', '-t', f'{seconds:.3f}', '-i', str(raw),
                    '-c:a', 'pcm_f32le', '-ar', str(RATE), str(dry)], check=True, capture_output=True)
    wet = out_dir / 'voice-ab.repaired.wav'
    lag = repair(dry, wet, chain)
    return {'raw': str(dry), 'repaired': str(wet), 'chain': chain, 'chain_latency_ms': round(lag * 1000, 2)}
