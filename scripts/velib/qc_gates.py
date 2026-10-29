"""The calibrated cut gates as ve qc rows (plan W2.4): the same functions quick-edit runs, from scripts/cutgates.

words.lost, joins.in_gaps, captions.clock and captions.render. Each row is measured with its pass, or not_run when
it could not be measured here (no tesseract, no heard words): written by the machine, never a pass, and ve status
reads not_run as not ready. Thresholds are config/gates.json; with one aligner every row says "single aligner"."""
from __future__ import annotations

from .common import ROOT


def _cutgates():
    """scripts/cutgates, the cut gates quick-edit and ve share (plan W2.4), and quick-edit's words gate."""
    import sys
    for path in (str(ROOT / 'scripts'), str(ROOT / 'scripts' / 'quick-edit')):
        if path not in sys.path:
            sys.path.append(path)  # after velib's own modules, never ahead of them
    from cutgates import aligners, captions, gaps, settings
    import words_gate
    return aligners, captions, gaps, settings, words_gate


def _gate_row(result: dict, target: str, summary) -> dict:
    """A cutgates result as a qc row: measured with its pass, or not_run when it could not be measured here."""
    if result.get('status') == 'missing':
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': result.get('reason')}
    return {'value': result, 'target': target, 'pass': result.get('status') == 'pass', 'status': 'measured',
            'agreement': result.get('agreement'), 'summary': summary(result)}


def heard_words(path: str, *, heard: dict | None = None, model: str = 'small.en') -> dict:
    """Every aligner's words for the render: faster-whisper, and Scribe only when config/gates.json allows it."""
    aligners, *_ = _cutgates()
    return aligners.passes(path, heard=heard, model=model)['aligners']


def words_lost(script: str, take_words, heard: dict, edl=None) -> dict:
    """The words gate on every aligner's pass of the render (words_gate.check_aligners)."""
    *_, words_gate = _cutgates()
    result = words_gate.check_aligners(script, take_words, heard, edl)
    return _gate_row(result, 'no content word of the signed script lost on every aligner\'s pass', words_gate.summary)


def joins_in_gaps(joins, heard: dict) -> dict:
    """Every join in a gap every aligner agrees on (cutgates.gaps.joins_in_gaps, config/gates.json)."""
    _, _, gaps, settings, _ = _cutgates()
    rule = settings.rule('joins')
    return _gate_row(gaps.joins_in_gaps(joins, heard),
                     f"every join in an agreed gap >= {rule['min_gap_ms']} ms, {rule['clearance_ms']} ms clear each side", gaps.summary)


def captions_clock(pages, heard: dict, drawn_by: str, fps: float = 30) -> dict:
    """Each caption page's first frame on the clock of the aligner that did not draw the captions."""
    aligners, captions, _, settings, _ = _cutgates()
    by, independent = aligners.independent_of(drawn_by, heard)
    result = captions.clock_truth(pages, heard[by], fps=fps, drew=drawn_by, heard_by=by, independent=independent)
    return _gate_row(result, f"each page's first frame within {result['tolerance_frames']} frames of its first word as heard",
                     captions.summary)


def captions_render(path: str, pages, region, ocr=None) -> dict:
    """Caption pages found from pixel changes in the caption zone and read by OCR within the window of each start."""
    _, captions, _, settings, _ = _cutgates()
    rule = settings.rule('captions')
    result = captions.renderer_truth(path, pages, region, ocr=ocr)
    return _gate_row(result, f"a page change within {rule['ocr_window_frames']} frames of each start; exact text, OCR score >= "
                             f"{rule['ocr_min_score']}", captions.summary)
