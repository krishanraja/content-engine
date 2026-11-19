"""Guards carried forward from one piece's failures into every later piece (config/ve/piece-guards.json).

Ruling (Krish, 2026-11-19): every component that built a piece carries its failures forward as guards, so the next
piece cannot repeat them. The first rows come from the Build or buy piece (Wed 18 Nov 2026, piece db9f9f6a). Each is a
`ve lint` problem on the spec, so it is caught before anything is made, never after he has seen it. Nothing here is
about one piece: a new fault is a row in the config.
"""
from __future__ import annotations

import json
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[2] / 'config' / 've' / 'piece-guards.json'
WORDS_PER_SECOND = 2.6  # velib.lint.WORDS_PER_SECOND: his measured read rate, used before ingest gives real times


def config() -> dict:
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def _assets(spec: dict) -> dict:
    items = spec.get('assets') or []
    return {a.get('id'): a for a in (items if isinstance(items, list) else items.values()) if isinstance(a, dict)}


def _objects(spec: dict) -> dict:
    items = spec.get('objects') or []
    return {o.get('obj'): o for o in (items if isinstance(items, list) else items.values()) if isinstance(o, dict)}


def _seconds(beat: dict) -> float:
    span = beat.get('span') or {}
    return max(0.0, (span.get('to_w', 0) - span.get('from_w', 0)) / WORDS_PER_SECOND)


def take_orientation(spec: dict, rule: dict) -> list[str]:
    """A 16:9 cut on a vertical take must use a layout built for a vertical source; the take says its frame."""
    out = []
    assets = _assets(spec)
    for cid, cut in (spec.get('cuts') or {}).items():
        if cut.get('aspect') not in rule['wide_aspects']:
            continue
        take = assets.get(cut.get('take')) or {}
        frame = take.get('frame') or {}
        w, h = frame.get('width'), frame.get('height')
        if not (isinstance(w, (int, float)) and isinstance(h, (int, float))):
            out.append(f'piece.take_orientation cuts.{cid}: its take {cut.get("take")!r} names no frame {{width, height}}; '
                       'a 16:9 cut must know whether its take is vertical before any layout is chosen (Build or buy, 18 Nov: '
                       'a vertical take on 16:9 layouts cut the top of his head)')
            continue
        if h <= w:
            continue
        # A staging built for a vertical take (kit/staging.ts pillar) draws every staged beat's take whole.
        staging = (((spec.get('style') or {}).get('layout') or {}).get('mode'))
        vertical_staging = staging in rule.get('vertical_source_stagings', [])
        for beat in cut.get('beats') or []:
            if vertical_staging and beat.get('layout') not in ('WINDOW', 'SPLIT'):
                continue
            if beat.get('layout') in rule['take_layouts'] and beat.get('layout') not in rule['vertical_source_layouts']:
                out.append(f'piece.take_orientation cuts.{cid}.{beat.get("id")}: layout {beat.get("layout")} assumes a '
                           f'horizontal take, and this take is vertical ({int(w)}x{int(h)}); use a layout built for a vertical '
                           'source, or record the long take wide')
    return out


def logos(spec: dict, rule: dict) -> list[str]:
    """Logos sit on equal tiles when two or more share a card, or when a mark is dark (it vanishes on the dark stage)."""
    out = []
    dark = {d.lower() for d in rule['dark_marks']}
    for oid, obj in _objects(spec).items():
        if obj.get('device') != rule['device']:
            continue
        params = obj.get('params') or {}
        ids = [str(l.get('id', '')) for l in params.get('logos') or [] if isinstance(l, dict)]
        if params.get('tiles') is True:
            continue
        if len(ids) >= rule['tiles_from_count']:
            out.append(f'piece.logos objects.{oid}: {len(ids)} logos ({", ".join(ids)}) without equal tiles; mixed marks '
                       'side by side never match in size (set params.tiles true)')
        elif any(i.lower() in dark for i in ids):
            out.append(f'piece.logos objects.{oid}: {", ".join(i for i in ids if i.lower() in dark)} is a dark mark and the '
                       'stage is dark, so it vanishes; put it on a tile (params.tiles true)')
    return out


def _overlap(a: list, b: list) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def _tall_zones() -> list[tuple[str, list]]:
    zones = json.loads((CONFIG.parents[1] / 'channel-safe-zones.json').read_text(encoding='utf-8'))
    return [(f'{ch} {z["name"]}', z['box']) for ch, v in (zones.get('channels') or {}).items()
            for z in (v.get('zones') or []) if isinstance(z, dict) and isinstance(z.get('box'), list)]


def tall_windows(spec: dict, rule: dict) -> list[str]:
    """A window on a tall cut never sits in a channel's buttons or caption (config/channel-safe-zones.json)."""
    out = []
    hits = [name for name, box in _tall_zones() if _overlap(rule['window_box'], box)]
    if not hits:
        return out
    for cid, cut in (spec.get('cuts') or {}).items():
        if cut.get('aspect') != rule['aspect']:
            continue
        for beat in cut.get('beats') or []:
            if beat.get('layout') in rule['layouts']:
                out.append(f'piece.tall_windows cuts.{cid}.{beat.get("id")}: the {beat.get("layout")} box on a {rule["aspect"]} '
                           f'cut ({rule["window_box"]}) sits under {hits[0]}; put the take in a safe place or use another layout. '
                           'A layout is never added only to make up the layout count')
    return out


def screenshot_crop(spec: dict, rule: dict) -> list[str]:
    """A screenshot of a page is cropped to the words it is shown for before it renders."""
    out = []
    for oid, obj in _objects(spec).items():
        params = obj.get('params') or {}
        if obj.get('device') in rule['devices'] and params.get('kind') in rule['kinds'] and not isinstance(params.get('crop'), dict):
            out.append(f'piece.screenshot_crop objects.{oid}: a full-page screenshot is shown uncropped, so its words land under '
                       'the 40 px evidence floor; give it params.crop around the words it is shown for')
    return out


def idea_lock(spec: dict, rule: dict) -> list[str]:
    obj = ((spec.get('style') or {}).get('idea') or {}).get('object')
    if not (isinstance(obj, str) and obj.strip()):
        return ['piece.idea_lock style.idea.object: the idea he picked is not written down, so nothing holds the cut to it; '
                'a request for more ("15/10") means more of his idea, never spectacle beside it']
    return []


def talking_head(spec: dict, rule: dict) -> list[str]:
    """No long stretch of his face with nothing on screen; logos that only appear and pulse do not count as a picture."""
    out = []
    objects = _objects(spec)
    for cid, cut in (spec.get('cuts') or {}).items():
        beats = cut.get('beats') or []
        if not beats or cut.get('excerpt'):
            continue
        total = sum(_seconds(b) for b in beats)
        bare = 0.0
        for beat in beats:
            if beat.get('role') in rule['close_roles'] or beat.get('id') in rule['close_roles']:
                continue
            events = beat.get('events') or []
            thin = bool(events) and all(objects.get(e.get('obj'), {}).get('device') in rule['thin_devices']
                                        and e.get('verb') in rule['thin_verbs'] for e in events)
            if beat.get('face') == 'full' and not events or thin:
                s = _seconds(beat)
                bare += s
                if s > rule['max_bare_beat_s']:
                    out.append(f'piece.talking_head cuts.{cid}.{beat.get("id")}: {s:.0f} s with nothing on screen but '
                               f'{"his face" if not thin else "logos that only appear"}, over {rule["max_bare_beat_s"]} s')
        if total and bare / total > rule['max_bare_share']:
            out.append(f'piece.talking_head cuts.{cid}: {bare:.0f} s of {total:.0f} s ({bare / total:.0%}) is talking head or '
                       f'pulsing logos with nothing to see, over {rule["max_bare_share"]:.0%}; a dull, important topic needs '
                       'its pictures most')
    return out


def _words(spec_dir: Path | None, cid: str) -> list[str]:
    if spec_dir is None:
        return []
    path = spec_dir / f'words.{cid}.json'
    try:
        rows = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return []
    rows = rows.get('words') if isinstance(rows, dict) else rows
    return [str(r.get('word') or r.get('text') or '') for r in rows or [] if isinstance(r, dict)]


def caption_words(spec: dict, rule: dict, spec_dir: Path | None = None) -> list[str]:
    """Every word of a cut fits one caption line, and the site address is one word, never split or dropped."""
    from .compile import FITS_LONE_WORD_THEMES, caption_line_count  # noqa: PLC0415  (read only: the compile's own measure, so lint and compile agree)
    theme = (((spec.get('style') or {}).get('captions') or {}).get('theme'))
    lone_fits = theme in FITS_LONE_WORD_THEMES
    out = []
    address = rule['site_address'].lower()
    for cid, cut in (spec.get('cuts') or {}).items():
        words = _words(spec_dir, cid)
        low = [w.lower().strip(',;:!?') for w in words]
        for parts in rule['spoken_parts']:
            n = len(parts)
            for i in range(len(low) - n + 1):
                if low[i:i + n] == parts:
                    out.append(f'piece.caption_words cuts.{cid}: the address is split into {" ".join(words[i:i + n])!r} at word {i}; '
                               f'it is one word, {rule["site_address"]!r}, in the word clock')
        for i, w in enumerate(words):
            try:
                caption_line_count([{'text': w, 'w': i}], cut.get('aspect', '9:16'))
            except ValueError:
                if lone_fits:
                    continue  # the theme draws it as a page of its own, shrunk to its region (compile._caption_groups)
                what = 'the site address' if w.lower().strip('.,') == address else repr(w)
                out.append(f'piece.caption_words cuts.{cid}: {what} at word {i} is wider than one {cut.get("aspect")} caption line, '
                           f'so the cut cannot compile; fix: {rule["fix"]}')
    return out


CHECKS = {'take_orientation': take_orientation, 'logos': logos, 'tall_windows': tall_windows,
          'screenshot_crop': screenshot_crop, 'idea_lock': idea_lock, 'talking_head': talking_head}


def lints(spec: dict, bind_day: str | None = None, spec_dir: Path | None = None) -> list[str]:
    """Every row's problems, for a piece the rows bind (its bind day on or after binds_from)."""
    cfg = config()
    if str(bind_day if bind_day is not None else spec.get('publish_day') or '') < cfg['binds_from']:
        return []
    out = []
    for key, check in CHECKS.items():
        out += check(spec, cfg[key])
    out += caption_words(spec, cfg['caption_words'], spec_dir)
    return out
