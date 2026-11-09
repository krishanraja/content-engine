"""On-screen checks from the post-mortem of the week of 2 Nov (docs/learning/2026-11-07-week-of-2-nov-postmortem.md).

Three bugs on the 6 Nov reel and Wed 4 Nov's lowest production score, each refused mechanically:

  annotation.target       (props) a mark names the words it marks, in its `meaning` in quotes, and is not drawn in
                          frame pixels over a surface a camera tilts or scales (the AT STAKE underline, cause B);
  annotation.on_target    (rendered frames) the mark lands on those words: an underline under them, a loop round them;
  captions.phrase_breaks  (props) no caption page ends mid-phrase ("using | a Chinese AI.", cause C);
  captions.repeat_title   (props) no caption page repeats the headline on screen at the same moment
                          ("Does that" under DOES THAT MATTER?, cause C; learning visuals-add-not-repeat);
  evidence.readable       (rendered frames) the evidence's own words are read on the 9:16 frame at a readable height
                          (the hand-held phone, cause A).

Settings and the approved rule each enforces: config/ve/onscreen-checks.json. A piece published before its binds_from
is measured and shown as advisory, never counted (F33: the engine and its gates do not change mid-piece).
The frame reader is the one scripts/channel_safe.py uses (tesseract); without it the frame rows are not_run, never
passed.
"""
from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

from .common import CONFIG, ROOT, load_json

sys.path.insert(0, str(ROOT / 'scripts'))

QUOTED = re.compile(r'["“]([^"”]{2,})["”]')
TOKEN = re.compile(r"[a-z0-9']+")
MIN_CONF = 60


def config() -> dict:
    return load_json(CONFIG / 'onscreen-checks.json')


def bound(publish_day: str | None, rules: dict | None = None) -> bool:
    return bool(publish_day) and str(publish_day) >= (rules or config())['binds_from']


def tokens(text: str) -> list[str]:
    return TOKEN.findall(str(text).lower().replace('’', "'"))


def _row(problems: list, target: str, publish_day: str | None, rules: dict, value=None) -> dict:
    row = {'value': value if value is not None else problems[:20], 'target': target, 'pass': not problems}
    if not bound(publish_day, rules):
        row['status'] = 'advisory'
        row['note'] = f"binds pieces published from {rules['binds_from']} (config/ve/onscreen-checks.json)"
    return row


# ---------------------------------------------------------------- captions (props only)


def _visible(obj: dict, a: int, b: int) -> int:
    return max(0, min(b, int(obj.get('toFrame', 0))) - max(a, int(obj.get('fromFrame', 0))))


def phrase_breaks(props: dict, rules: dict | None = None) -> list[dict]:
    """Pages that end mid-phrase: on a weak word, or right before a page that opens on an article or possessive."""
    rules = (rules or config())['captions']
    weak, opens = set(rules['weak_ends']), set(rules['opens_phrase'])
    pages = props.get('captions') or []
    out = []
    for i, page in enumerate(pages[:-1]):
        words = page.get('words') or []
        if not words:
            continue
        last = words[-1]['text']
        if re.search(r'[,.!?;:]["\')’”]*$', last):
            continue
        nxt = (pages[i + 1].get('words') or [{}])[0].get('text', '')
        end, start = (tokens(last) or [''])[-1], (tokens(nxt) or [''])[0]
        if end in weak or start in opens:
            out.append({'fromFrame': page['fromFrame'], 'page': ' '.join(w['text'] for w in words),
                        'next': ' '.join(w['text'] for w in pages[i + 1].get('words') or []),
                        'why': f'ends on "{end}"' if end in weak else f'the next page opens on "{start}"'})
    return out


def title_repeats(props: dict, rules: dict | None = None) -> list[dict]:
    """Caption pages whose words are the headline on screen at the same moment: drop the page (or change the title)."""
    rules = (rules or config())['captions']
    titles = [o for o in props.get('objects') or [] if o.get('device') in rules['title_devices']]
    out = []
    for page in props.get('captions') or []:
        a, b = int(page['fromFrame']), int(page['toFrame'])
        said = tokens(' '.join(w['text'] for w in page.get('words') or []))
        if not said or b <= a:
            continue
        for obj in titles:
            if _visible(obj, a, b) < rules['page_overlap'] * (b - a):
                continue
            shown = set(tokens(' '.join((obj.get('params') or {}).get('lines') or [])))
            shared = [t for t in said if t in shown]
            if len(shared) >= rules['repeat_min_words'] and len(shared) >= rules['repeat_share'] * len(said):
                out.append({'fromFrame': a, 'page': ' '.join(w['text'] for w in page['words']), 'title': obj['obj'],
                            'lines': (obj.get('params') or {}).get('lines')})
                break
    return out


# ---------------------------------------------------------------- annotations


def target_words(obj: dict) -> list[str]:
    """The words a mark marks: the quoted words in its meaning ('underlines "Who sees your data"')."""
    found = QUOTED.findall(str(obj.get('meaning') or ''))
    return tokens(' '.join(found))


def annotation_problems(objects: list[dict], beats: list[dict], rules: dict | None = None) -> list[dict]:
    """Marks with no named target, or drawn in frame pixels over a camera-moved surface in the same beat."""
    rules = (rules or config())['annotation']
    by_id = {o.get('obj') or o.get('id'): o for o in objects}
    out = []
    for obj in objects:
        params = obj.get('params') or {}
        if obj.get('device') not in rules['devices'] or params.get('shape') not in rules['shapes']:
            continue
        name = obj.get('obj') or obj.get('id')
        if not target_words(obj):
            out.append({'obj': name, 'why': 'names no target: put the words it marks in its meaning, in quotes'})
        for beat in beats:
            if name not in (beat.get('uses') or []):
                continue
            under = [u for u in beat.get('uses') or [] if (by_id.get(u) or {}).get('device') in rules['surfaces']]
            if under:
                out.append({'obj': name, 'beat': beat.get('id'), 'surface': under[0],
                            'why': f'drawn in frame pixels over {under[0]}, which its camera tilts and scales: the mark '
                                   'cannot follow the card; mark a full-frame element instead'})
                break
    return out


def mark_box(params: dict) -> tuple[float, float, float, float] | None:
    """The mark's box in frame pixels, as the scribble device draws it (apps/renderer/.../scribble/state.ts)."""
    t = params.get('target')
    if params.get('shape') == 'underline':
        if t:
            return (t['x'], t['y'] + t['h'], t['w'], max(8.0, params.get('amp', 2) * 4))
        (x0, y0), (x1, y1) = params['from'], params['to']
        pad = max(4.0, params.get('amp', 2) * 2)
        return (min(x0, x1), min(y0, y1) - pad, abs(x1 - x0), abs(y1 - y0) + 2 * pad)
    if params.get('shape') == 'loop':
        if t:
            return (t['x'], t['y'], t['w'], t['h'])
        u, v = params.get('u') or [0, 0], params.get('v') or [0, 0]
        rx, ry = abs(u[0]) + abs(v[0]), abs(u[1]) + abs(v[1])
        return (params['cx'] - rx, params['cy'] - ry, 2 * rx, 2 * ry)
    return None


def _union(boxes):
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    return (x0, y0, max(b[0] + b[2] for b in boxes) - x0, max(b[1] + b[3] for b in boxes) - y0)


def _area_overlap(a, b) -> float:
    w = max(0.0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    h = max(0.0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    return w * h


def landed(params: dict, words: list[tuple[str, float, tuple]], want: list[str], rules: dict | None = None) -> dict:
    """Whether a mark sits on its words, given the words read on its rendered frame."""
    rules = (rules or config())['annotation']
    box = mark_box(params)
    hits = [w for w in words if w[1] >= MIN_CONF and set(tokens(w[0])) & set(want)]
    found = {t for w in hits for t in tokens(w[0])} & set(want)
    if not hits or len(found) < rules['found_share'] * len(set(want)):
        return {'ok': False, 'why': f'its words were not read on the frame ({len(found)} of {len(set(want))})'}
    text = _union([w[2] for w in hits])
    line = sorted(w[2][3] for w in hits)[len(hits) // 2]
    if params.get('shape') == 'underline':
        span = max(0.0, min(box[0] + box[2], text[0] + text[2]) - max(box[0], text[0]))
        mid = box[1] + box[3] / 2
        below = text[1] + text[3] - 0.5 * line <= mid <= text[1] + text[3] + 1.0 * line
        ok = span >= rules['underline_overlap'] * min(box[2], text[2]) and below
        return {'ok': ok, 'mark': [round(v) for v in box], 'words': [round(v) for v in text],
                'why': '' if ok else ('not under its words' if span else 'beside its words, not under them')}
    ok = _area_overlap(box, text) >= rules['loop_overlap'] * text[2] * text[3]
    return {'ok': ok, 'mark': [round(v) for v in box], 'words': [round(v) for v in text],
            'why': '' if ok else 'does not go round its words'}


# ---------------------------------------------------------------- rendered frames


def frame_png(path: str, frame: int, out: Path) -> Path:
    target = out / f'f{frame:06d}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-vf', f'select=eq(n\\,{int(frame)})',
                    '-frames:v', '1', str(target)], check=True)
    if not target.is_file():
        raise ValueError(f'frame {frame} is past the end of {Path(path).name}')
    return target


def _reader(read):
    if read is not None:
        return read
    import channel_safe  # noqa: PLC0415
    return channel_safe.tesseract_words


def _draw_frame(obj: dict, events: list[dict]) -> int | None:
    draws = [e['atFrame'] for e in events if e.get('obj') == obj.get('obj') and e.get('verb') == 'draw']
    return min(draws) if draws else None


def on_target(path: str, props: dict, read=None, rules: dict | None = None, lead: int = 0) -> list[dict]:
    rules = rules or config()
    ann = rules['annotation']
    draw_on = int(load_json(CONFIG / 'design-lock.json').get('scribble', {}).get('draw_on_frames', 10)
                  if (CONFIG / 'design-lock.json').is_file() else 10)
    read = _reader(read)
    out = []
    with tempfile.TemporaryDirectory() as temp:
        for obj in props.get('objects') or []:
            params = obj.get('params') or {}
            if obj.get('device') not in ann['devices'] or params.get('shape') not in ann['shapes']:
                continue
            want, at = target_words(obj), _draw_frame(obj, props.get('events') or [])
            if not want or at is None:
                continue   # annotation.target refuses a mark with no named target
            frame = min(at + draw_on + ann['settle_frames'], int(obj['toFrame']) - 1) + lead
            result = landed(params, read(frame_png(path, frame, Path(temp))), want, rules)
            if not result['ok']:
                out.append({'obj': obj['obj'], 'frame': frame, **result})
    return out


def _texts(value) -> list[str]:
    if isinstance(value, str):
        return [] if re.search(r'\.(png|jpe?g|webp|mp4|svg)$', value, re.I) or ' ' not in value.strip() else [value]
    if isinstance(value, dict):
        return [t for k, v in value.items() if k not in ('src', 'logoSrc', 'backdrop') for t in _texts(v)]
    if isinstance(value, list):
        return [t for v in value for t in _texts(v)]
    return []


def readable(path: str, props: dict, read=None, rules: dict | None = None, lead: int = 0) -> list[dict]:
    """Evidence whose own words are too small, or not read at all, on the 9:16 frame at each beat's key frame."""
    rules = rules or config()
    ev = rules['evidence']
    if props.get('aspect') != '9:16':
        return []
    read = _reader(read)
    by_id = {o['obj']: o for o in props.get('objects') or []}
    out = []
    with tempfile.TemporaryDirectory() as temp:
        for beat in props.get('beats') or []:
            for name in beat.get('uses') or []:
                obj = by_id.get(name)
                if not obj or obj.get('device') not in ev['devices']:
                    continue
                want = {t for text in _texts(obj.get('params') or {}) for t in tokens(text) if len(t) >= ev['min_token_chars']}
                if not want:
                    continue
                frame = int(beat.get('keyFrame', (beat['fromFrame'] + beat['toFrame']) // 2)) + lead
                hits = [w for w in read(frame_png(path, frame, Path(temp)))
                        if w[1] >= MIN_CONF and set(tokens(w[0])) & want]
                if not hits:
                    out.append({'obj': name, 'beat': beat.get('id'), 'frame': frame, 'word_px': None,
                                'why': 'none of its words can be read on the frame'})
                    continue
                height = sorted(w[2][3] for w in hits)[len(hits) // 2]
                if height < ev['min_word_px']:
                    out.append({'obj': name, 'beat': beat.get('id'), 'frame': frame, 'word_px': height,
                                'why': f"its words are {height} px tall on the 1080x1920 frame, under {ev['min_word_px']}"})
    return out


# ---------------------------------------------------------------- the rows


def rows(path: str | None, props: dict, publish_day: str | None = None, read=None, lead: int = 0) -> dict:
    rules = config()
    beats = props.get('beats') or []
    out = {
        'annotation.target': _row(annotation_problems(props.get('objects') or [], beats, rules),
                                  'every mark names its words and is not drawn over a moving surface', publish_day, rules),
        'captions.phrase_breaks': _row(phrase_breaks(props, rules), 'no caption page ends mid-phrase', publish_day, rules),
        'captions.repeat_title': _row(title_repeats(props, rules), 'no caption page repeats the headline on screen',
                                      publish_day, rules),
    }
    frame_rows = {
        'annotation.on_target': ('every mark lands on its words on the rendered frame', on_target),
        'evidence.readable': (f"evidence words at least {rules['evidence']['min_word_px']} px tall on 9:16", readable),
    }
    for name, (target, measure) in frame_rows.items():
        if not path:
            out[name] = {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': 'no rendered file'}
            continue
        try:
            out[name] = _row(measure(path, props, read=read, rules=rules, lead=lead), target, publish_day, rules)
        except (OSError, ValueError, subprocess.CalledProcessError) as error:
            # A missing reader never passes and never crashes the qc that called it (as scripts/channel_safe.py).
            out[name] = {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': str(error)[:300]}
            if not bound(publish_day, rules):
                out[name]['status'] = 'advisory'
    return out
