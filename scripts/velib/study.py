"""ve study: what a reference does, in numbers, for the Critic to compare a cut with (F03: a motion reference was studied
as stills sampled every 5 s, not as timing, continuity and sound).

Until 5 Nov 2026 `ve study` wrote cuts and change density only, and nothing read the card. This adds what quick-edit's
reference study already measures (scripts/quick-edit/references.py: shots and pace, push-in and pull-out zooms, loudness,
a contact sheet of one frame per shot, and the words a minute when faster-whisper is installed), keeping ve's own cut
and motion measures, so one card holds both. The numbers describe the reference; they are never a target (THE_BAR:
cut counts, rates and levels are not the bar).
"""
from __future__ import annotations

import sys
from pathlib import Path

from .common import ROOT, write_json

_QUICK_EDIT = str(ROOT / 'scripts' / 'quick-edit')
if _QUICK_EDIT not in sys.path:
    sys.path.insert(0, _QUICK_EDIT)
import references  # noqa: E402

NOTE = 'Describes the reference; never a target (THE_BAR: cut counts, rates and levels are not the bar).'


def study(ref: str | Path, out: str | Path | None = None, words: bool = True) -> dict:
    """The reference's grammar card: ve's cut and motion measures plus quick-edit's shots, pace, zooms, loudness and
    words a minute; a contact sheet beside it. Returns the card."""
    import re  # noqa: PLC0415
    import subprocess  # noqa: PLC0415
    from .common import ffmpeg  # noqa: PLC0415
    from .qc import duration_s, frame_diffs, motion  # noqa: PLC0415
    ref = Path(ref)
    out = Path(out) if out else ref.with_suffix('.grammar.json')
    length = duration_s(str(ref))
    text = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-i', str(ref), '-vf', 'scdet=threshold=5,metadata=print',
                           '-f', 'null', '-'], capture_output=True, text=True, errors='replace').stderr
    cuts = [round(float(t), 2) for t in re.findall(r'lavfi\.scd\.time: ([\d.]+)', text)]
    move = motion(frame_diffs(str(ref)))
    shots = references.shots_from_cuts(references.cut_times(str(ref)), length)
    card = {'reference': str(ref), 'note': NOTE, 'duration_s': round(length, 2), 'cuts': cuts,
            'cuts_per_minute': round(len(cuts) / (length / 60), 1) if length else 0, **move,
            'pace': references.pace(shots, length), 'zooms': references.zoom_moves_pillow(str(ref), length),
            'loudness_lufs': references.loudness(str(ref))}
    segments = references.transcript(str(ref)) if words else None
    card['speech'] = references.speech_summary(segments, length) if segments else None
    sheet = out.with_suffix('.contact.jpg')
    card['contact_sheet'] = sheet.name if references.contact_sheet(str(ref), shots, sheet) else None
    write_json(out, card)
    return card
