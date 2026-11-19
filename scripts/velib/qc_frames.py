"""Frame and spec checks from the Tue 17 and Wed 18 Nov 2026 failure lists, generic for any cut.

Krish carried the QA on both pieces: he caught twelve faults on Tue 17 and six on Wed 18 himself, most of them with a rule
already written. Each check here is one rule of his, as a number in config/ve/frame-checks.json (its `enforces` quotes him)
against one thing measured: the props the renderer was handed, or the rendered frames. Nothing is specific to a piece: a
check reads whatever beats, objects, captions and title moment the cut it is given carries.

  beats.one_carrier        (props)   a beat shows one picture, and a graphic never repeats the picture's point
  figures.shown            (props)   a figure is never dimmed or blurred, and fills its slot
  transition.ghost         (props + frames)  a face beat and a full-screen beat meet on a cut, no frame holds two faces
  backdrop.not_flat_black  (frames)  a graphics beat after a full-frame picture is not on flat black
  brand.render_current     (props)   the render knew the logo rule (explicit bodyLogo, false from its date)
  text.no_off_day          (props + frames)  "off.day" is drawn nowhere
  title.moment             (props + frames)  one title card, from his spoken line, captions empty while it holds, full width
  takes.restarts           (heard words)  no unlisted false start left in the cut
  motion.first_seconds     (frames)  something moves in the first seconds
  head.whole_in_frame      (frames)  his whole head is in frame on his lines; on 16:9 his take sits bottom right

A check that cannot read what it needs (no tesseract, no face detector, no heard words, no render) reports not_run and is
never a pass. A piece published before binds_from is measured and shown advisory, never counted (F33).
Adding a row for the next fault: the header of config/ve/frame-checks.json.
"""
from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from .common import CONFIG, ROOT, load_json

TOKEN = re.compile(r"[a-z0-9']+")


def config() -> dict:
    return load_json(CONFIG / 'frame-checks.json')


def tokens(text) -> list[str]:
    return TOKEN.findall(str(text).lower().replace('’', "'"))


def bound(publish_day: str | None, rules: dict | None = None) -> bool:
    rules = rules or config()
    return bool(publish_day) and str(publish_day)[:10] >= rules['binds_from']


def _row(problems: list, target: str, publish_day: str | None, rules: dict, value=None) -> dict:
    row = {'value': value if value is not None else problems[:20], 'target': target, 'pass': not problems}
    if not bound(publish_day, rules):
        row['status'] = 'advisory'
        row['note'] = f"binds pieces published from {rules['binds_from']} (config/ve/frame-checks.json)"
    return row


def _not_run(target: str, why: str, publish_day: str | None, rules: dict) -> dict:
    row = {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': why[:300]}
    if not bound(publish_day, rules):
        row['status'] = 'advisory'
    return row


def _beats(props: dict) -> list[dict]:
    return sorted(props.get('beats') or [], key=lambda b: b['fromFrame'])


def _objects(props: dict) -> dict[str, dict]:
    return {o['obj']: o for o in props.get('objects') or []}


def _strings(value, skip: set, key: str | None = None):
    """Every string a cut draws or carries, except the keys that name files and ids."""
    if key in skip:
        return
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _strings(v, skip, k)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v, skip, key)


def face_visible(beat: dict) -> bool:
    """Whether his face is on screen in the beat: his take is the plate, or the beat says a face window is drawn."""
    if beat.get('face') in ('full', 'window'):
        return True
    if beat.get('face') == 'off':
        return False
    return (beat.get('plate') or {}).get('source') == 'take'


def graphics_only(beat: dict) -> bool:
    return not face_visible(beat) and (beat.get('plate') or {}).get('source') in (None, 'none')


# ---------------------------------------------------------------- props checks (no render needed)


def one_carrier_problems(props: dict, rules: dict | None = None) -> list[dict]:
    """A beat shows one picture; a graphic beside it never says what the picture says (Tue 17: a photo and a graphic
    carrying the same point over one another). Meaning is read from the spec's own words for each object."""
    rule = (rules or config())['one_carrier']
    by_id = _objects(props)
    out = []
    for beat in _beats(props):
        objs = [by_id[u] for u in beat.get('uses') or [] if u in by_id]
        pictures = [o for o in objs if o.get('device') in rule['picture_devices']]
        graphics = [o for o in objs if o.get('device') not in rule['picture_devices'] and o.get('device') not in rule['neutral_devices']]
        if len(pictures) + (1 if beat.get('backdrop') else 0) > rule['max_pictures_per_beat'] and len(pictures) > 1:
            out.append({'beat': beat.get('id'), 'why': f"{len(pictures)} pictures carry the beat at once ({', '.join(o['obj'] for o in pictures)}): one picture a beat"})
        for pic in pictures:
            for gfx in graphics:
                a = set(tokens(pic.get('meaning'))) - set(tokens(''))
                b = set(tokens(gfx.get('meaning'))) | {t for s in _strings(gfx.get('params') or {}, set()) for t in tokens(s)}
                common = a & b - {'the', 'a', 'an', 'of', 'on', 'in', 'to', 'and', 'is', 'picture', 'generated', 'plate'}
                if len(common) >= rule['min_tokens'] and len(common) / max(1, min(len(a), len(b))) >= rule['same_point_share']:
                    out.append({'beat': beat.get('id'), 'why': f"{gfx['obj']} repeats the point of {pic['obj']} ({', '.join(sorted(common)[:5])}): "
                                                               'a graphic and a picture never both carry one point'})
    return out


def figure_problems(props: dict, rules: dict | None = None) -> list[dict]:
    rule = (rules or config())['figures']
    aspect = props.get('aspect') or '9:16'
    width, height = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    by_id = _objects(props)
    out = []
    for obj in by_id.values():
        if obj.get('device') not in rule['devices']:
            continue
        params = obj.get('params') or {}
        for key, ban in rule['forbid_params'].items():
            value = params.get(key)
            bad = (value is True) if ban is True else (value not in (None, False, 0, 0.0)) if ban == 'any' \
                else (isinstance(value, (int, float)) and not isinstance(value, bool) and value < 1) if ban == 'below_1' else False
            if bad:
                out.append({'obj': obj['obj'], 'why': f'{key}={value!r}: a figure is never dimmed or blurred'})
        at = params.get('at')
        if obj.get('device') == 'stat_strip' and isinstance(at, dict) and at.get('w') and at['w'] / width < rule['min_strip_width_share']:
            out.append({'obj': obj['obj'], 'why': f"the strip is {at['w']} px wide on a {width} px frame, under {rule['min_strip_width_share']:.0%}: "
                                                  'the figure a beat exists to show fills the frame'})
    try:
        from . import qc  # noqa: PLC0415
        layouts = qc._renderer_layouts().get(aspect, {})
    except (OSError, ValueError, AttributeError):
        layouts = {}
    for beat in _beats(props):
        if beat.get('layout') in ('STAGE', 'SPLIT', 'WINDOW'):
            continue   # the slot is the whole canvas: the figure's own size is what fills it
        for index, name in enumerate(beat.get('uses') or []):
            obj = by_id.get(name)
            slots = layouts.get(beat.get('layout')) or []
            if not obj or obj.get('device') not in rule['devices'] or index >= len(slots):
                continue
            x, y, w, h = slots[index]
            place = (obj.get('params') or {}).get('place')
            if isinstance(place, dict) and place.get('width') and place.get('height'):
                # A placed object is drawn in its own band, not the layout's slot (Fri 20 Nov: the hook figure's band).
                k = float(place.get('scale') or 1)
                w, h = float(place['width']) * k, float(place['height']) * k
            share = w * h / (width * height)
            if share < rule['min_slot_area_share']:
                out.append({'obj': name, 'beat': beat.get('id'), 'why': f"its slot is {share:.0%} of the frame, under {rule['min_slot_area_share']:.0%}: "
                                                                        'the figure a beat exists to show fills the frame'})
    return out


def ghost_transitions(props: dict, rules: dict | None = None) -> list[dict]:
    """Where a face beat and a full-screen beat meet; a dissolving transition there leaves his face as a ghost."""
    rule = (rules or config())['ghost_face']
    dissolving = (props.get('ingredients') or {}).get('transition') in rule['dissolving_transitions']
    beats = _beats(props)
    out = []
    for a, b in zip(beats, beats[1:]):
        if face_visible(a) != face_visible(b):
            out.append({'from': a.get('id'), 'to': b.get('id'), 'frame': b['fromFrame'], 'dissolves': dissolving})
    return out


def ghost_props_problems(props: dict, rules: dict | None = None) -> list[dict]:
    return [{**m, 'why': 'a dissolve between a full-screen beat and his face leaves a ghost of his face: this must be a cut'}
            for m in ghost_transitions(props, rules) if m['dissolves']]


def render_current_problems(props: dict, publish_day: str | None) -> list[dict]:
    """The render must know the logo rule: bodyLogo said, and false where the palette says no logo in the body."""
    if 'bodyLogo' not in props or not isinstance(props['bodyLogo'], bool):
        return [{'why': 'the props do not say bodyLogo: this was rendered before the logo rule (only the wordmark on the title frame and '
                        'the close); compile again and render again'}]
    if not publish_day:
        return [{'why': 'the cut has no publish day, so the logo rule cannot be applied'}] if props['bodyLogo'] else []
    import sys  # noqa: PLC0415
    sys.path.insert(0, str(ROOT / 'scripts'))
    import brand_palette  # noqa: PLC0415
    palette = brand_palette.load()
    rule = palette.get('logo_rule') or {}
    if str(publish_day)[:10] < str(rule.get('from') or '9999'):
        return []
    off = (props.get('series') or {}).get('label') == 'off.day'
    fmt = 'long_cut' if props.get('aspect') == '16:9' else 'short_cut'
    allowed = brand_palette.body_logo(publish_day, fmt, 'off' if off else None, palette)
    if props['bodyLogo'] and not allowed:
        return [{'why': f"bodyLogo is true, but from {rule.get('from')} the body carries no icon or wordmark (config/brand-palette.json logo_rule)"}]
    return []


def off_day_text_problems(props: dict, rules: dict | None = None) -> list[dict]:
    rule = (rules or config())['off_day_text']
    skip = set(rule['skip_keys'])
    out = []
    for text in _strings(props, skip):
        low = text.lower()
        for banned in rule['banned']:
            if banned in low:
                out.append({'text': text[:60], 'why': f'"{banned}" is never drawn on screen, in any cut'})
    return out


def title_problems(props: dict, rules: dict | None = None) -> list[dict]:
    """The title moment: a card, captions empty for the whole hold, built from his spoken line in order."""
    rule = (rules or config())['title']
    moment = props.get('titleMoment')
    if not moment:
        return []
    out = []
    if rule['require_card'] and not moment.get('card'):
        out.append({'why': 'the title arrives as bare words over his face: it is a card that slams or slides in (title_moment.card)'})
    start, end = int(moment['fromFrame']), int(moment['toFrame'])
    held = [p for p in props.get('captions') or [] if int(p['fromFrame']) < end and int(p['toFrame']) > start]
    for page in held[:6]:
        out.append({'frame': max(start, int(page['fromFrame'])),
                    'why': f"a caption page ({' '.join(w['text'] for w in page['words'])[:30]!r}) is on screen while the title holds"})
    words = moment.get('words') or []
    spoken = [w['text'] for w in words]
    at = [int(w['atFrame']) for w in words]
    if at != sorted(at) or any(not start <= f < end for f in at):
        out.append({'why': "the title's words are not timed to his words, in order, inside its hold"})
    ignore = set(rule['ignore_words'])
    title = [t for t in tokens(props.get('title')) if t not in ignore]
    line = tokens(' '.join(spoken))
    if title:
        pos, hit = 0, 0
        for t in title:
            try:
                pos = line.index(t, pos) + 1
                hit += 1
            except ValueError:
                continue
        if hit / len(title) < rule['title_words_share']:
            out.append({'why': f'the title is not built from his spoken line: {hit} of its {len(title)} words are in the words he says'})
    return out


def restart_problems(heard: dict | list | None, kept: list | None, rules: dict | None = None) -> list[dict]:
    """A phrase said twice in a row, inside max_gap_s, in the words heard on the finished cut (a restart left in), that the
    spec does not list as kept on purpose (cuts.<id>.kept_restarts)."""
    rule = (rules or config())['restarts']
    words_by_ear = heard if isinstance(heard, dict) else {'heard': heard}
    out = []
    for ear, rows in words_by_ear.items():
        if isinstance(rows, dict):
            rows = rows.get('words')
        flat = []
        for w in rows or []:
            text = w.get('w') if isinstance(w.get('w'), str) else w.get('word') or w.get('text')
            start = w.get('s', w.get('onset_s', w.get('start')))
            end = w.get('e', w.get('end_s', w.get('end')))
            if isinstance(text, str) and isinstance(start, (int, float)) and isinstance(end, (int, float)) and tokens(text):
                flat.append((tokens(text)[0], float(start), float(end)))
        i = 0
        while i + 2 * rule['min_words'] <= len(flat):
            # The longest phrase (up to max_words) that starts at word i and is said again straight after.
            for n in range(min(rule['max_words'], (len(flat) - i) // 2), rule['min_words'] - 1, -1):
                a, b = flat[i:i + n], flat[i + n:i + 2 * n]
                if [x[0] for x in a] == [x[0] for x in b] and b[0][1] - a[-1][2] <= rule['max_gap_s']:
                    at = a[0][1]
                    listed = any(abs(float(k.get('at_s', -99)) - at) <= rule['kept_tolerance_s'] for k in kept or [])
                    if not listed:
                        out.append({'at_s': round(at, 2), 'text': ' '.join(x[0] for x in a), 'ear': ear,
                                    'why': 'a phrase said twice in a row: a false start left in. Cut it, or list it in cuts.<id>.kept_restarts with its time and why'})
                    i += n
                    break
            else:
                i += 1
    # The same restart heard by every ear is one finding.
    seen, unique = set(), []
    for p in out:
        key = (round(p['at_s']), p['text'])
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def first_seconds_problems(diffs, props: dict | None, fps_sample: int = 5, rules: dict | None = None) -> list[dict]:
    """Something moves from the hook's first word: at least min_moving_seconds of the first window_s seconds change by more
    than the cut's own change threshold. `diffs` are the 5 fps frame differences qc already measured."""
    rule = (rules or config())['first_seconds']
    if diffs is None or not len(diffs):
        return [{'why': 'no frame differences were measured'}]
    from . import qc  # noqa: PLC0415
    skip = qc.opening_lead(props) * fps_sample // int((props or {}).get('fps') or 30) if props else 0
    window = np.asarray(diffs[skip: skip + rule['window_s'] * fps_sample])
    moving = 0
    for second in range(rule['window_s']):
        chunk = window[second * fps_sample:(second + 1) * fps_sample]
        if len(chunk) and float(chunk.max()) > rule['change_threshold']:
            moving += 1
    if moving < rule['min_moving_seconds']:
        return [{'moving_seconds': moving, 'of': rule['window_s'],
                 'why': f"only {moving} of the first {rule['window_s']} seconds move: something lands on his first word (a line slamming in, a clip in motion, a punch-in)"}]
    return []


# ---------------------------------------------------------------- frame checks (the render)


def _grab(path: str, frame: int, fps: float, size: tuple[int, int]):
    from . import qc_faces  # noqa: PLC0415
    return qc_faces.frame_at(path, int(frame), fps, size)


def backdrop_problems(path: str, props: dict, beats: list[dict], fps: float, grab=None, rules: dict | None = None) -> list[dict]:
    """A graphics beat straight after a beat that shows a full-frame picture, sampled mid-beat: flat black (a low, even
    luma) is the fault. `beats` are on the file's clock."""
    rule = (rules or config())['backdrop']
    size = tuple(rule['sample_size'])
    grab = grab or (lambda frame: _grab(path, frame, fps, size))
    out = []
    ordered = sorted(beats, key=lambda b: b['fromFrame'])
    for before, beat in zip(ordered, ordered[1:]):
        if not graphics_only(beat) or not (face_visible(before) or (before.get('plate') or {}).get('source') not in (None, 'none')
                                           or before.get('backdrop')):
            continue
        frame = beat['fromFrame'] + int((beat['toFrame'] - beat['fromFrame']) * rule['sample_share'])
        luma = np.asarray(grab(frame), np.float32).mean(axis=2)
        mean, std = float(luma.mean()), float(luma.std())
        if mean <= rule['flat_luma_max'] and std <= rule['flat_std_max']:
            out.append({'beat': beat.get('id'), 'at_s': round(frame / fps, 2), 'luma': round(mean, 1), 'std': round(std, 1),
                        'why': 'a graphics beat on flat black straight after a picture: put it on a graded, focus-racked backdrop'})
    return out


def ghost_frame_problems(path: str, props: dict, beats: list[dict], fps: float, aspect: str, detector, grab=None,
                         rules: dict | None = None) -> list[dict]:
    rule = (rules or config())['ghost_face']
    size = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    grab = grab or (lambda frame: _grab(path, frame, fps, size))
    ordered = sorted(beats, key=lambda b: b['fromFrame'])
    out = []
    for a, b in zip(ordered, ordered[1:]):
        if face_visible(a) == face_visible(b):
            continue
        edge = b['fromFrame']
        for frame in range(edge - rule['frames_each_side'], edge + rule['frames_each_side'] + 1):
            faces = detector(grab(max(0, frame)))
            if len(faces) > rule['faces_max']:
                out.append({'from': a.get('id'), 'to': b.get('id'), 'frame': frame, 'faces': len(faces),
                            'why': 'two faces in one frame at the change: a ghost of his face. The change is a clean cut'})
                break
    return out


def off_day_frame_problems(path: str, props: dict, fps: float, read=None, rules: dict | None = None, lead: int = 0) -> list[dict]:
    rule = (rules or config())['off_day_text']
    if read is None:
        import sys  # noqa: PLC0415
        sys.path.insert(0, str(ROOT / 'scripts'))
        import channel_safe  # noqa: PLC0415
        read = channel_safe.tesseract_words
    from . import qc_onscreen  # noqa: PLC0415
    total = int(props.get('durationFrames') or 0)
    step = max(1, int(rule['ocr_every_s'] * fps))
    frames = list(range(0, total, step))[: rule['ocr_max_frames']]
    out = []
    with tempfile.TemporaryDirectory() as temp:
        for frame in frames:
            for word in read(qc_onscreen.frame_png(path, frame + lead, Path(temp))):
                if word[1] >= rule['min_conf'] and any(b in str(word[0]).lower() for b in rule['banned']):
                    out.append({'frame': frame, 'text': str(word[0])[:30], 'why': 'the off.day tag is on screen'})
    return out


def title_width_problems(path: str, props: dict, fps: float, aspect: str, read=None, rules: dict | None = None, lead: int = 0) -> list[dict]:
    rule = (rules or config())['title']
    moment = props.get('titleMoment')
    if not moment:
        return []
    if read is None:
        import sys  # noqa: PLC0415
        sys.path.insert(0, str(ROOT / 'scripts'))
        import channel_safe  # noqa: PLC0415
        read = channel_safe.tesseract_words
    from . import qc_onscreen  # noqa: PLC0415
    frame = (int(moment['fromFrame']) + int(moment['toFrame'])) // 2 + lead
    want = set(tokens(' '.join(w['text'] for w in moment.get('words') or [])))
    with tempfile.TemporaryDirectory() as temp:
        hits = [w for w in read(qc_onscreen.frame_png(path, frame, Path(temp))) if w[1] >= 60 and set(tokens(w[0])) & want]
    width = 1080 if aspect == '9:16' else 1920
    if not hits:
        return [{'frame': frame, 'why': 'none of the title words can be read on the frame while it holds'}]
    left, right = min(w[2][0] for w in hits), max(w[2][0] + w[2][2] for w in hits)
    if (right - left) / width < rule['min_width_share']:
        return [{'frame': frame, 'why': f"the title spans {(right - left) / width:.0%} of the frame width, under {rule['min_width_share']:.0%}: it lands as a hero title at full stage width"}]
    return []


def title_lockup_problems(props: dict, rules: dict | None = None) -> list[dict]:
    """The title is one full-frame lockup with the wordmark inside it (Ruling, Krish, 2026-11-19). Compile says so on the
    props; a cut whose props do not was rendered with the old panel card and its separate, free-floating wordmark."""
    moment = props.get('titleMoment')
    if not moment or moment.get('lockup') is True:
        return []
    return [{'why': 'the title was rendered as a card in a panel or band with a separate wordmark, not one full-frame lockup '
                    'with the wordmark inside it: compile and render the cut again'}]


def title_lockup_frame_problems(path: str, props: dict, fps: float, aspect: str, read=None, rules: dict | None = None,
                                lead: int = 0) -> list[dict]:
    """Read the title lockup on the rendered frames: its type size, that it is centred, that it spans the frame and not a
    panel, that the wordmark sits inside it, and that the wordmark comes and goes with it."""
    rule = (rules or config())['title_lockup']
    moment = props.get('titleMoment')
    if not moment:
        return []
    if read is None:
        import sys  # noqa: PLC0415
        sys.path.insert(0, str(ROOT / 'scripts'))
        import channel_safe  # noqa: PLC0415
        read = channel_safe.tesseract_words
    from . import qc_onscreen  # noqa: PLC0415
    width, height = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    start, end = int(moment['fromFrame']), int(moment['toFrame'])
    last = max(int(w['atFrame']) for w in moment.get('words') or [{'atFrame': start}])
    hold = min(last + rule['settle_frames'], end - 11) if end - 11 > last else last
    frames = None
    # A proof excerpt can end a few frames before the settle point (Fri 20 Nov: 242 of 240): once every word has landed
    # inside the file, its last frame is a settled title frame.
    try:
        import subprocess  # noqa: PLC0415
        frames = int(round(float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                                                capture_output=True, text=True, check=True).stdout.strip()) * fps)) - lead
        if hold >= frames and frames - 1 > last + 3:
            hold = frames - 1
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    mark_words = set(rule['wordmark_tokens'])
    title_words = set(tokens(' '.join(w['text'] for w in moment.get('words') or []))) - mark_words

    def words_at(frame: int):
        with tempfile.TemporaryDirectory() as temp:
            return [w for w in read(qc_onscreen.frame_png(path, frame + lead, Path(temp))) if w[1] >= 60]

    seen = words_at(hold)
    title = [w for w in seen if set(tokens(w[0])) & title_words]
    mark = [w for w in seen if set(tokens(w[0])) & mark_words and not set(tokens(w[0])) & title_words]
    at = hold + lead
    if not title:
        return [{'frame': at, 'why': 'none of the title words can be read on the settled title frame'}]
    out = []
    caps = sorted(w[2][3] for w in title)
    cap = caps[len(caps) // 2] / height
    floor = rule['min_cap_height_share'][aspect]
    if cap < floor:
        out.append({'frame': at, 'why': f'the title type stands {cap:.1%} of the frame height, under {floor:.1%}: it is squeezed, '
                                        'not a full-frame lockup'})
    left, right = min(w[2][0] for w in title), max(w[2][0] + w[2][2] for w in title)
    off = abs((left + right) / 2 - width / 2) / width
    if off > rule['max_centre_offset_share']:
        out.append({'frame': at, 'why': f'the title sits {off:.0%} of the frame off centre: the lockup is centred'})
    if (right - left) / width < rule['min_width_share']:
        out.append({'frame': at, 'why': f"the title spans {(right - left) / width:.0%} of the frame width, under "
                                        f"{rule['min_width_share']:.0%}: it is confined to a panel or band, not the whole frame"})
    top = min(w[2][1] for w in title)
    inside = [w for w in mark if w[2][1] > top and w[2][0] >= left - width * 0.05 and w[2][0] + w[2][2] <= right + width * 0.05
              and abs(w[2][0] + w[2][2] / 2 - width / 2) / width <= rule['max_centre_offset_share'] * 2]
    if not inside:
        out.append({'frame': at, 'why': 'the wordmark is not read inside the title lockup, centred under the title'
                                        + (' (it is read elsewhere on the frame)' if mark else '')})
    for frame, when in ((start - rule['edge_frames'], 'before the title arrives'), (end + rule['edge_frames'], 'after the title leaves')):
        if frames is not None and not 0 <= frame < frames:
            continue  # a look outside a proof excerpt: nothing there to read
        if frame < 0:
            continue
        if any(set(tokens(w[0])) & mark_words and not set(tokens(w[0])) & title_words for w in words_at(frame)):
            out.append({'frame': frame + lead, 'why': f'the wordmark is on screen {when}: it enters and leaves with the title, never on its own'})
    return out


def head_problems(path: str, beats: list[dict], fps: float, aspect: str, detector, grab=None, rules: dict | None = None) -> dict:
    """His whole head in frame on every beat that shows him, and on a 16:9 cut his take in the bottom right."""
    rule = (rules or config())['head']
    width, height = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    grab = grab or (lambda frame: _grab(path, frame, fps, (width, height)))
    cut, outside, samples, no_face = [], [], 0, []
    for beat in beats:
        if not (beat.get('plate') or {}).get('source') == 'take' or beat.get('face') == 'off':
            continue
        span = beat['toFrame'] - beat['fromFrame']
        seen = 0
        for share in rule['samples']:
            frame = beat['fromFrame'] + int(span * share)
            samples += 1
            faces = detector(grab(frame))
            if not faces:
                continue
            seen += 1
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            crown, chin = y - rule['crown'] * h, y + (1 + rule['chin']) * h
            m = rule['edge_margin_px']
            for edge, off in (('crown', crown < m), ('chin', chin > height - m), ('left', x < m), ('right', x + w > width - m)):
                if off:
                    cut.append({'beat': beat.get('id'), 'at_s': round(frame / fps, 2), 'edge': edge})
            if aspect == '16:9':
                q = rule['wide_quadrant']
                cx, cy = (x + w / 2) / width, (y + h / 2) / height
                if cx < q['x_min'] or cy < q['y_min']:
                    outside.append({'beat': beat.get('id'), 'at_s': round(frame / fps, 2), 'centre': [round(cx, 2), round(cy, 2)]})
        if not seen:
            no_face.append(beat.get('id'))
    return {'cut': cut[:12], 'outside': outside[:12], 'samples': samples, 'no_face': no_face}


# ---------------------------------------------------------------- the rows


SPEC_ROWS = {
    'beats.one_carrier': ('one picture a beat; a graphic never repeats the picture\'s point', lambda p, r, d: one_carrier_problems(p, r)),
    'figures.shown': ('a figure is never dimmed or blurred and fills its slot', lambda p, r, d: figure_problems(p, r)),
    'transition.ghost_cut': ('a face beat and a full-screen beat meet on a cut', lambda p, r, d: ghost_props_problems(p, r)),
    'brand.render_current': ('the render knew the logo rule', lambda p, r, d: render_current_problems(p, d)),
    'text.no_off_day_props': ('"off.day" is in no drawn text', lambda p, r, d: off_day_text_problems(p, r)),
    'title.moment': ('one title card from his spoken line, captions empty while it holds', lambda p, r, d: title_problems(p, r)),
    'title.lockup': ('the title rendered as one full-frame lockup with the wordmark inside it', lambda p, r, d: title_lockup_problems(p, r)),
}


def rows(path: str | None, props: dict, publish_day: str | None = None, *, beats: list[dict] | None = None, aspect: str | None = None,
         fps: float = 30, diffs=None, heard=None, kept_restarts: list | None = None, face_detector=None, read=None,
         grab=None, lead: int = 0) -> dict:
    """Every check above as qc rows. `props` is the cut's props (any aspect); `beats` are on the file's clock."""
    rules = config()
    out = {name: _row(measure(props, rules, publish_day), target, publish_day, rules) for name, (target, measure) in SPEC_ROWS.items()}
    aspect = aspect or props.get('aspect') or '9:16'
    beats = beats if beats is not None else props.get('beats') or []

    def frame_row(name: str, target: str, needs_render: bool, measure):
        if needs_render and not path:
            out[name] = _not_run(target, 'no rendered file', publish_day, rules)
            return
        try:
            out[name] = _row(measure(), target, publish_day, rules)
        except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
            out[name] = _not_run(target, str(error), publish_day, rules)

    out['takes.restarts'] = (_row(restart_problems(heard, kept_restarts, rules), 'no unlisted false start left in the cut', publish_day, rules)
                             if heard else _not_run('no unlisted false start left in the cut', 'no words heard on the render (--transcribe or --heard)', publish_day, rules))
    out['motion.first_seconds'] = (_row(first_seconds_problems(diffs, props, rules=rules), 'something moves in the first seconds', publish_day, rules)
                                   if diffs is not None else _not_run('something moves in the first seconds', 'no frame differences', publish_day, rules))
    frame_row('backdrop.not_flat_black', 'no graphics beat on flat black after a picture', True,
              lambda: backdrop_problems(path, props, beats, fps, grab, rules))
    frame_row('text.no_off_day_frames', '"off.day" is on no sampled frame', True,
              lambda: off_day_frame_problems(path, props, fps, read, rules, lead))
    frame_row('title.stage_width', 'the title holds at full stage width', True,
              lambda: title_width_problems(path, props, fps, aspect, read, rules, lead))
    frame_row('title.lockup_frame', 'the title is one centred full-frame lockup, big type, the wordmark inside it and timed with it', True,
              lambda: title_lockup_frame_problems(path, props, fps, aspect, read, rules, lead))
    detector = face_detector
    if detector is None and any(face_visible(b) for b in beats):
        from . import qc_faces  # noqa: PLC0415
        detector = qc_faces.default_detector()
    no_detector = 'no face detector in this Python (opencv-python or mediapipe)'
    head_target = 'his whole head in frame on his lines; on 16:9 his take bottom right'
    ghost_target = 'no frame holds two faces where a face beat meets a full-screen beat'
    if detector is None:
        out['transition.no_ghost_frames'] = _not_run(ghost_target, no_detector, publish_day, rules)
        out['head.whole_in_frame'] = _not_run(head_target, no_detector, publish_day, rules)
    else:
        frame_row('transition.no_ghost_frames', ghost_target, True, lambda: ghost_frame_problems(path, props, beats, fps, aspect, detector, grab, rules))

        def head():
            found = head_problems(path, beats, fps, aspect, detector, grab, rules)
            return [{'kind': 'cut', **c} for c in found['cut']] + [{'kind': 'not_bottom_right', **o} for o in found['outside']] \
                + [{'kind': 'no_face', 'beat': b} for b in found['no_face']]
        frame_row('head.whole_in_frame', head_target, True, head)
    return out


def _spec_cuts(spec: dict):
    return (spec.get('cuts') or {}).items()


def lints(spec: dict) -> list[str]:
    """The spec-level guards for ve lint: a piece's title moment must be a card and name its kept restarts well. Binds a
    piece published from binds_from, like the rows."""
    rules = config()
    if not bound(spec.get('publish_day'), rules):
        return []
    out = []
    moment = spec.get('title_moment')
    if moment and rules['title']['require_card'] and not moment.get('card'):
        out.append('title.card title_moment.card: the title arrives as a card that slams or slides in over his hair, never bare words '
                   'over his face (Krish, Wed 18: "having naked captions over my face looks stupid"); set title_moment.card: true')
    for cut_id, cut in _spec_cuts(spec):
        for index, k in enumerate(cut.get('kept_restarts') or []):
            if not isinstance(k.get('at_s'), (int, float)) or not str(k.get('why') or '').strip():
                out.append(f'takes.restarts cuts.{cut_id}.kept_restarts.{index}: a kept restart names its time (at_s) and why it stays')
    text = list(_strings({k: v for k, v in spec.items() if k not in ('assets', 'datasets', 'approvals', 'signature', 'audio', 'budget')},
                         set(rules['off_day_text']['skip_keys'] + ['series', 'caption_theme', 'intro_sting', 'references', 'format', 'publish_day'])))
    for line in text:
        for banned in rules['off_day_text']['banned']:
            if banned in line.lower():
                out.append(f'text.no_off_day: "{banned}" is in the spec\'s own words ({line[:50]!r}): it is never drawn on screen, in any cut')
                break
    return out
