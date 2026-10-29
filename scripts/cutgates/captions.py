"""Captions, in two parts (plan W2.4).

Clock truth: the finished audio is heard again by the aligner that did not draw the captions, and each caption
page's first frame is held to the first word of the page as that aligner heard it, within
captions.clock_tolerance_frames (config/gates.json; a placeholder until measured on Monday 26). Friday 16 Oct's
90-second cut drew its captions from a 17 Oct words file never heard again ("subtitles are still totally
garbled"); a clock like that is what this fails.

Renderer truth: the caption pages are found from pixel changes in the caption zone, and read by OCR only within
plus or minus captions.ocr_window_frames of each page start. The text must match the props exactly and score at
least captions.ocr_min_score. OCR is tesseract through scripts/velib/qc_captions.py; without it the check says
it is missing, and a missing check holds the cut.

Pages are {fromFrame, toFrame, words: [{text}]} on the cut's own frame clock, as ve's props and
advisory_qc.caption_pages give them, or read from a cut's .ass file (pages_from_ass).
"""
from __future__ import annotations

import difflib
import re
import shutil
import subprocess

from . import settings

MACHINE = 'scripts/cutgates/captions.py'
VERSION = 'captions/1'
_CONFUSABLE = str.maketrans('l1|', 'iii')


def tokens(text) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(text).lower().replace("'", ''))


def page_text(page) -> str:
    return ' '.join(w['text'] if isinstance(w, dict) else str(w) for w in page.get('words') or [])


def _pages_tokens(pages):
    out = []
    for p, page in enumerate(pages):
        for t in tokens(page_text(page)):
            out.append((p, t))
    return out


def _heard_tokens(words):
    out = []
    for k, w in enumerate(words):
        if isinstance(w.get('s'), (int, float)):
            for t in tokens(w.get('w', '')):
                out.append((k, t))
    return out


def clock_truth(pages, words, *, fps: float, drew: str, heard_by: str, independent: bool,
                tolerance_frames: int | None = None) -> dict:
    """Each page's first frame against its first word as `heard_by` heard it in the finished audio."""
    rule = settings.rule('captions')
    tol = int(rule['clock_tolerance_frames'] if tolerance_frames is None else tolerance_frames)
    report = {'machine': MACHINE, 'version': VERSION, 'part': 'clock', 'drawn_by': drew, 'heard_by': heard_by,
              'independent': independent,
              'agreement': ('heard by the aligner that did not draw the captions' if independent else
                            f'single aligner: the finished audio heard again by {heard_by}, the aligner that drew the captions'),
              'tolerance_frames': tol, 'tolerance_status': rule.get('clock_tolerance_status'), 'pages': [], 'failed': []}
    page_toks, heard_toks = _pages_tokens(pages), _heard_tokens(words)
    if not pages:
        report.update(status='fail', reason='no caption pages were given, so the caption clock cannot be checked')
        return report
    if not heard_toks:
        report.update(status='fail', reason=f'{heard_by} heard no words in the finished audio')
        return report
    first_of = {}
    matcher = difflib.SequenceMatcher(None, [t for _, t in page_toks], [t for _, t in heard_toks], autojunk=False)
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == 'equal' or (op == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                page = page_toks[i1 + k][0]
                first_of.setdefault(page, {'tok': i1 + k, 'heard': heard_toks[j1 + k][0], 'exact': op == 'equal'})
    starts = {}
    for k, (p, _) in enumerate(page_toks):
        starts.setdefault(p, k)
    for p, page in enumerate(pages):
        row = {'page': p, 'fromFrame': int(page['fromFrame']), 'text': page_text(page)}
        hit = first_of.get(p)
        if hit is None or hit['tok'] != starts.get(p):
            row.update(status='not_located', reason='the first word of the page is not where the aligner heard the words around it')
        else:
            heard = words[hit['heard']]
            want = round(float(heard['s']) * fps)
            row.update(heard_word=str(heard['w']).strip(), heard_s=heard['s'], heard_frame=want,
                       delta_frames=int(page['fromFrame']) - want, matched_exactly=hit['exact'])
            row['status'] = 'pass' if abs(row['delta_frames']) <= tol else 'fail'
            if row['status'] == 'fail':
                row['message'] = (f'caption page {p} ("{row["text"][:40]}") starts at frame {row["fromFrame"]}, '
                                  f'{abs(row["delta_frames"])} frames {"late" if row["delta_frames"] > 0 else "early"} on '
                                  f'"{row["heard_word"]}" as {heard_by} heard it at {heard["s"]:.3f} s (tolerance {tol})')
        report['pages'].append(row)
    located = [r for r in report['pages'] if r['status'] != 'not_located']
    report['failed'] = [r for r in report['pages'] if r['status'] == 'fail']
    report['located_fraction'] = round(len(located) / len(pages), 3)
    least = float(rule.get('min_located_fraction', 0.8))
    reasons = []
    if report['failed']:
        reasons.append(f'{len(report["failed"])} of {len(pages)} caption page(s) start off the heard clock by more than {tol} frames')
    if report['located_fraction'] < least:
        reasons.append(f'only {len(located)} of {len(pages)} caption pages could be placed on what {heard_by} heard '
                       f'(at least {least:.0%} must be): the captions say words the finished audio does not')
    report['status'] = 'fail' if reasons else 'pass'
    if reasons:
        report['reason'] = '; '.join(reasons)
    return report


def _ffmpeg():
    return shutil.which('ffmpeg') or 'ffmpeg'


def zone_frames(video, region, width: int = 160):
    """Every frame of the caption zone, small and grey, decoded in order (no seeking)."""
    import numpy as np
    x, y, w, h = (int(v) for v in region)
    height = max(2, round(h * width / w / 2) * 2)
    raw = subprocess.run([_ffmpeg(), '-nostdin', '-v', 'error', '-i', str(video), '-an', '-vf',
                          f'crop={w}:{h}:{x}:{y}:exact=1,scale={width}:{height},format=gray', '-fps_mode', 'passthrough',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, height, width).astype(np.float32)


def page_changes(video, region, *, threshold: float | None = None, frames=None) -> list[int]:
    """The frames on which the caption zone changes: mean absolute grey difference from the frame before above
    the threshold. A page change is the first frame of a run of changes."""
    import numpy as np
    rule = settings.rule('captions')
    limit = float(rule['pixel_change_threshold'] if threshold is None else threshold)
    frames = zone_frames(video, region) if frames is None else frames
    if len(frames) < 2:
        return []
    diffs = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    hot = [k + 1 for k, d in enumerate(diffs) if d > limit]
    return [f for k, f in enumerate(hot) if k == 0 or hot[k - 1] != f - 1]


def tesseract_reader(video, region):
    """The OCR the renderer check uses: tesseract on one frame of the caption zone, through ve's caption reader
    (qc_captions._read_candidates: the same polarity handling and confusable folding as ve qc). None when
    tesseract is not on PATH."""
    executable = shutil.which('tesseract')
    if not executable:
        return None
    return TesseractReader(executable, video, region)


class TesseractReader:
    """Reads caption-zone frames with tesseract. prefetch() decodes every frame the check will read in one pass
    from the start of the file (a seek per frame would decode the file again for each page)."""

    def __init__(self, executable, video, region):
        import sys
        scripts = str(settings.ROOT / 'scripts')
        if scripts not in sys.path:
            sys.path.append(scripts)
        from velib import qc_captions
        self.executable, self.video, self.region, self.qc_captions = executable, str(video), [int(v) for v in region], qc_captions
        self.frames = {}

    def prefetch(self, frames):
        import numpy as np
        wanted = sorted(set(int(f) for f in frames if f >= 0) - set(self.frames))
        if not wanted:
            return
        x, y, w, h = self.region
        runs, start = [], wanted[0]
        for a, b in zip(wanted, wanted[1:] + [None]):
            if b != a + 1:
                runs.append((start, a))
                start = b
        select = '+'.join(f'between(n\\,{a}\\,{b})' for a, b in runs)
        raw = subprocess.run([_ffmpeg(), '-nostdin', '-v', 'error', '-i', self.video, '-an', '-vf',
                              f'select={select},crop={w}:{h}:{x}:{y}:exact=1,format=gray', '-fps_mode', 'passthrough',
                              '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
        got = np.frombuffer(raw, np.uint8).reshape(-1, h, w)
        for frame, pixels in zip(wanted, got):
            self.frames[frame] = pixels

    def __call__(self, frame, expected_text):
        if frame not in self.frames:
            self.prefetch([frame])
        if frame not in self.frames:
            return {'text': '', 'score': 0.0}
        best = self.qc_captions._read_candidates(self.executable, self.frames[frame], self.qc_captions._tokens(expected_text))
        return {'text': best['text'], 'score': float(best['agreement'])}


def _fold(text):
    return [t.translate(_CONFUSABLE) for t in tokens(text)]


def renderer_truth(video, pages, region, *, ocr=None, window: int | None = None, min_score: float | None = None,
                   threshold: float | None = None, changes=None) -> dict:
    """Each page found as a pixel change within the window of its start, and read there by OCR."""
    rule = settings.rule('captions')
    win = int(rule['ocr_window_frames'] if window is None else window)
    least = float(rule['ocr_min_score'] if min_score is None else min_score)
    report = {'machine': MACHINE, 'version': VERSION, 'part': 'renderer', 'region': list(region), 'window_frames': win,
              'min_score': least, 'pixel_change_status': rule.get('pixel_change_status'), 'pages': [], 'failed': []}
    if not pages:
        report.update(status='fail', reason='no caption pages were given, so the burned captions cannot be read back')
        return report
    reader = ocr if ocr is not None else tesseract_reader(video, region)
    if reader is None:
        report.update(status='missing', reason='tesseract is not on PATH, so the burned captions cannot be read back; '
                                               'the check is missing and the cut is held')
        return report
    changes = page_changes(video, region, threshold=threshold) if changes is None else changes
    report['changes_found'] = len(changes)
    if hasattr(reader, 'prefetch'):
        wanted = []
        for page in pages:
            start, end = int(page['fromFrame']), int(page['toFrame'])
            near = [c for c in changes if abs(c - start) <= win]
            if near:
                change = min(near, key=lambda c: abs(c - start))
                wanted += range(max(change, start - win), min(start + win, end - 1) + 1)
        reader.prefetch(wanted)
    for p, page in enumerate(pages):
        start, end = int(page['fromFrame']), int(page['toFrame'])
        want = page_text(page)
        row = {'page': p, 'fromFrame': start, 'text': want}
        near = [c for c in changes if abs(c - start) <= win]
        if not near:
            row.update(status='fail', message=(f'caption page {p} ("{want[:40]}"): no change in the caption zone within '
                                               f'{win} frames of its start, frame {start}'))
            report['pages'].append(row)
            continue
        change = min(near, key=lambda c: abs(c - start))
        row['change_frame'] = change
        best = None
        for frame in range(max(change, start - win), min(start + win, end - 1) + 1):
            seen = reader(frame, want)
            exact = _fold(seen['text']) == _fold(want) or ''.join(_fold(seen['text'])) == ''.join(_fold(want))
            cand = {'frame': frame, 'read': seen['text'], 'score': round(float(seen['score']), 4), 'exact': exact}
            if best is None or (cand['exact'], cand['score']) > (best['exact'], best['score']):
                best = cand
            if exact and cand['score'] >= least:
                break
        row.update(best or {'frame': None, 'read': None, 'score': 0.0, 'exact': False})
        row['status'] = 'pass' if row['exact'] and row['score'] >= least else 'fail'
        if row['status'] == 'fail':
            row['message'] = (f'caption page {p} reads "{(row["read"] or "")[:60]}" near frame {start}, '
                              f'not "{want[:60]}" (score {row["score"]}, needs an exact match and {least})')
        report['pages'].append(row)
    report['failed'] = [r for r in report['pages'] if r['status'] == 'fail']
    report['status'] = 'fail' if report['failed'] else 'pass'
    if report['failed']:
        report['reason'] = f'{len(report["failed"])} of {len(pages)} caption page(s) are not drawn as the props say near their start'
    return report


def _ass_time(text):
    h, m, s = text.split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def pages_from_ass(path, fps: float) -> list[dict]:
    """Caption pages from a cut's .ass file (make.py's write_ass): one page a Dialogue line, override tags dropped."""
    from pathlib import Path
    pages = []
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        if not line.startswith('Dialogue:'):
            continue
        parts = line.split(',', 9)
        if len(parts) < 10:
            continue
        text = re.sub(r'\{[^}]*\}', '', parts[9]).replace('\\N', ' ').replace('\\n', ' ').strip()
        first, last = round(_ass_time(parts[1].strip()) * fps), round(_ass_time(parts[2].strip()) * fps)
        if text and last > first:
            pages.append({'fromFrame': first, 'toFrame': last, 'words': [{'text': t, 'atFrame': first} for t in text.split()]})
    pages.sort(key=lambda p: p['fromFrame'])
    merged = []
    for page in pages:  # one page drawn as several layers (outline, highlight) is one page
        if merged and merged[-1]['fromFrame'] == page['fromFrame'] and page_text(merged[-1]) == page_text(page):
            continue
        merged.append(page)
    return merged


def summary(report) -> str:
    if report.get('status') == 'pass':
        return 'every caption page is on the heard clock' if report.get('part') == 'clock' else 'every caption page reads as the props say'
    named = [r.get('message') for r in report.get('failed') or [] if r.get('message')]
    more = f' (and {len(named) - 4} more)' if len(named) > 4 else ''
    return f'{report.get("reason")}' + (f': {"; ".join(named[:4])}{more}' if named else '')
