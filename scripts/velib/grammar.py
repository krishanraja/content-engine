"""The shot grammar, checked from the spec before anything renders (ve lint grammar.*).

Krish, 2026-11-20, of the week's rejected cuts: "how we integrate title cards and real-world images and motion
animation is the issue". The study that answered him (docs/ve/INGREDIENTS.md, "Shot grammar") measured his good cuts
against the rejected ones: every good cut keeps his face in one fixed place for the whole body and puts real images and
motion inside one fixed region, sized to fill it; the rejected ones switched layout up to 14 times, cut his face away
for a second at a time, shrank real evidence onto blur and filled the gaps with generated stills. His rulings that day:

- one staging per cut: band, stage or anchor for the whole body, picked at the lock with the recipe; only the title, a
  chapter mark, the end card and, on an anchor cut, a full graphic plate break from it (the variety rule is retired);
- generated imagery (corrected the same day): allowed, photoreal included, when art-directed and clearly a metaphor;
  a generated stand-in for a real document, sign, place or person is refused;
- the shot grammar is approved.

Seven checks, each one rule in one place, every number in config/ve/shot-grammar.json with the measurement it rests on:

- grammar.staging: the cut's one staging, every beat's shot type from it, and the handovers the matrix allows;
- grammar.face_runs: his face on screen for the share of the body his good cuts hold, in runs of at least 4 s, at most 4
  switches a minute, a chapter mark at most 1.5 s, an end card 3.5 to 5 s;
- grammar.region: every device and real image in the staging's region, never a full-frame picture in his place, and
  the panel never empty longer than 0.5 s;
- grammar.evidence_size: a real image fills its region (at least 0.55 of the frame wide) and words are 40 px or more;
- grammar.generated: a generated picture declares `depicts`; a metaphor is allowed, a stand-in for a real thing refused;
- grammar.repeat: a device at most 3 times a cut, never twice running without a new state;
- grammar.caption_zone: one caption zone for the whole cut, the same y on every beat.

They bind pieces frozen at ve expect from floor.RECIPE_FROM, the same date and the same freeze the floor uses, so nothing
in production breaks (Ruling, Krish, 2026-11-19: a new rule binds from the next piece). Seconds come from the cut's
aligned words (words.<cut>.json beside the spec) when ve conform wrote them, else from his read rate.
"""
from __future__ import annotations

from pathlib import Path

from .common import CONFIG, load_json

TABLE = CONFIG / 'shot-grammar.json'
RULING_GENERATED = ('Ruling, Krish, 2026-11-20: generated imagery, photoreal included, is allowed when art-directed '
                    'and clearly a metaphor; generated stand-ins for real documents, signs, places or people are refused')
WORDS_PER_SECOND = 2.6          # velib.lint: his measured read rate, before ingest gives real times
STAGED_SHOTS = ('band', 'stage', 'anchor')
FACELESS = ('plate', 'end')
FRAME = {'9:16': (1080, 1920), '16:9': (1920, 1080)}


def table() -> dict:
    return load_json(TABLE)


# ------------------------------------------------------------------------------------------------------------ timing

def _words(directory: Path | None, cut_id: str) -> dict[int, dict] | None:
    if directory is None:
        return None
    path = Path(directory) / f'words.{cut_id}.json'
    if not path.is_file():
        return None
    try:
        rows = load_json(path)
    except (OSError, ValueError):
        return None
    rows = rows.get('words') if isinstance(rows, dict) else rows
    out = {r['w']: r for r in rows or [] if isinstance(r, dict) and isinstance(r.get('w'), int) and 'onset_s' in r}
    return out or None


def beat_seconds(cut: dict, words: dict[int, dict] | None = None) -> list[float]:
    """Each beat's length in seconds: from its first word to the next beat's first word on the aligned clock, else at his
    read rate."""
    beats = cut['beats']
    out = []
    for i, beat in enumerate(beats):
        start_w = beat['span']['from_w']
        if words and start_w in words:
            if i + 1 < len(beats) and beats[i + 1]['span']['from_w'] in words:
                end = words[beats[i + 1]['span']['from_w']]['onset_s']
            else:
                last = words.get(beat['span']['to_w']) or {}
                end = last.get('end_s', last.get('onset_s', words[start_w]['onset_s']))
            out.append(max(0.0, float(end) - float(words[start_w]['onset_s'])))
        else:
            out.append((beat['span']['to_w'] - start_w + 1) / WORDS_PER_SECOND)
    return out


# ----------------------------------------------------------------------------------------------------------- staging

def staging(spec: dict, cut_id: str, directory: Path | None = None) -> str | None:
    """The cut's one staging, as compile draws it (style.layout.cuts, then style.layout.mode, then the default)."""
    from . import takes  # noqa: PLC0415
    from .compile import cut_layout_mode  # noqa: PLC0415
    return cut_layout_mode(spec, cut_id, takes.cut_frame(spec, cut_id, directory)[1])


def body_shot(mode: str | None) -> str | None:
    return (table()['body_shots']).get(mode or '')


def _kind(shot: str, body: str) -> str:
    """A shot's row in the transition matrix: the cut's own body shot is 'staging'."""
    return 'staging' if shot == body else shot


def staging_lints(spec: dict, cut_id: str, mode: str | None) -> list[str]:
    cut = spec['cuts'][cut_id]
    aspect = cut['aspect']
    t = table()
    where = f'grammar.staging cuts.{cut_id}'
    if mode == 'anchor' and aspect not in t['stagings']['anchor']['aspects']:
        return [f'{where}: anchor on {aspect} is refused. {t["stagings"]["anchor"]["wide_refused"]} Use band or stage '
                'for this cut (style.layout.cuts)']
    body = body_shot(mode)
    if body is None or (mode == 'pillar' and aspect == '9:16'):
        return [f'{where}: the cut is drawn with {mode or "no staging"}; every cut uses one staging for its whole body, band, '
                'stage or anchor, picked at the lock with the recipe (style.layout; Ruling, Krish, 2026-11-20: one staging '
                'per cut)']
    out = []
    allowed = set(t['transitions'])
    for i, beat in enumerate(cut['beats']):
        at = f'{where}.beats.{i}'
        shot = beat.get('shot')
        if not shot:
            out.append(f'{at}: beat {beat["id"]} has no shot type; ve shots writes one from the cut\'s staging ({mode})')
            continue
        if beat.get('layout') in ('SPLIT', 'WINDOW'):
            out.append(f'{at}: a {beat["layout"]} beat switches the layout away from the cut\'s one staging ({mode})')
        if shot in STAGED_SHOTS and shot != body:
            out.append(f'{at}: shot {shot} in a {mode} cut; the body keeps one staging, so it is {body}')
        if shot == 'plate' and mode != 'anchor':
            out.append(f'{at}: a full graphic plate breaks a {mode} cut; plates belong only to anchor cuts, and on {mode} '
                       'the graphics stay in the panel with his face on screen')
        if shot == 'plate' and (beat.get('plate') or {}).get('source', 'take') == 'take' and beat.get('face') != 'off':
            out.append(f'{at}: a plate shows no take: set plate.source none (or face off)')
        if shot == 'title' and not (((spec.get('title_moment') or {}).get('spans') or {}).get(cut_id)):
            out.append(f'{at}: a title shot with no title_moment span on this cut is a detached title card (Wed 18\'s 6 s '
                       'card); the title builds on the line he says (title_moment.spans)')
        if shot == 'end' and i != len(cut['beats']) - 1:
            out.append(f'{at}: the end card is the last beat')
        if i + 1 < len(cut['beats']):
            nxt = cut['beats'][i + 1].get('shot')
            if nxt and _kind(shot, body) in allowed and _kind(nxt, body) not in t['transitions'][_kind(shot, body)]:
                out.append(f'{at}: {shot} may not hand to {nxt} (the transition matrix, docs/ve/INGREDIENTS.md "Shot grammar")')
    return out


# ------------------------------------------------------------------------------------------------------- face runs

def face_on(beat: dict) -> bool:
    return beat.get('shot') not in FACELESS and beat.get('face') != 'off'


def face_run_lints(spec: dict, cut_id: str, mode: str | None, seconds: list[float]) -> list[str]:
    cut = spec['cuts'][cut_id]
    t = table()
    where = f'grammar.face_runs cuts.{cut_id}'
    beats = cut['beats']
    out = []
    for i, beat in enumerate(beats):
        if beat.get('shot') == 'chapter' and seconds[i] > t['chapter_max_s']['value'] + 1e-6:
            out.append(f'{where}.beats.{i}: a chapter mark holds {seconds[i]:.1f} s; at most {t["chapter_max_s"]["value"]} s, '
                       'him on screen')
        if beat.get('shot') == 'end' and not t['end_card_s']['min'] - 1e-6 <= seconds[i] <= t['end_card_s']['max'] + 1e-6:
            out.append(f'{where}.beats.{i}: the end card holds {seconds[i]:.1f} s; it holds {t["end_card_s"]["min"]} to '
                       f'{t["end_card_s"]["max"]} s')
    body = [(b, s) for b, s in zip(beats, seconds) if b.get('shot') != 'end']
    total = sum(s for _b, s in body)
    if total <= 0 or cut.get('excerpt'):
        return out
    on = sum(s for b, s in body if face_on(b))
    plates = any(b.get('shot') == 'plate' for b, _s in body)
    if mode == 'anchor' and plates:
        anchor_total = sum(s for b, s in body if b.get('shot') != 'plate')
        anchor_on = sum(s for b, s in body if b.get('shot') != 'plate' and face_on(b))
        floor_all = t['face_share_min']['anchor_with_plates_overall']
        if anchor_total and anchor_on / anchor_total < t['face_share_min']['staged'] - 1e-9:
            out.append(f'{where}: his face is on {anchor_on / anchor_total:.0%} of the anchor beats; at least '
                       f'{t["face_share_min"]["staged"]:.0%} ({t["face_share_min"]["from"]})')
        if on / total < floor_all - 1e-9:
            out.append(f'{where}: his face is on {on / total:.0%} of the body with plates; at least {floor_all:.0%} '
                       f'({t["face_share_min"]["from"]})')
    elif on / total < t['face_share_min']['staged'] - 1e-9:
        out.append(f'{where}: his face is on {on / total:.0%} of the body; at least {t["face_share_min"]["staged"]:.0%} '
                   f'({t["face_share_min"]["from"]})')
    runs: list[list] = []   # [face_on, seconds, first beat index]
    for i, (b, s) in enumerate(body):
        state = face_on(b)
        if runs and runs[-1][0] == state:
            runs[-1][1] += s
        else:
            runs.append([state, s, i])
    least = t['face_run_min_s']['value']
    if len(runs) > 1:
        for state, s, first in runs:
            if s < least - 1e-6:
                out.append(f'{where}.beats.{first}: a run {"with" if state else "without"} his face lasts {s:.1f} s; every '
                           f'run with or without his face is at least {least:g} s ({t["face_run_min_s"]["from"]})')
    switches = len(runs) - 1
    per_min = switches / max(total / 60, 1.0)
    if per_min > t['switches_per_min_max']['value'] + 1e-9:
        out.append(f'{where}: {switches} face switches, {per_min:.1f} a minute; at most {t["switches_per_min_max"]["value"]} '
                   f'({t["switches_per_min_max"]["from"]})')
    return out


# ---------------------------------------------------------------------------------------------------------- region

def _content(beat: dict, objects: dict, skip=('stamp',)) -> list[dict]:
    return [objects[u] for u in beat.get('uses', []) if u in objects and objects[u]['device'] not in skip]


def region_lints(spec: dict, cut_id: str, mode: str | None, seconds: list[float]) -> list[str]:
    cut = spec['cuts'][cut_id]
    t = table()
    objects = {o['obj']: o for o in spec.get('objects', [])}
    where = f'grammar.region cuts.{cut_id}'
    out = []
    limit = t['panel_empty_max_s']['value']
    seen: set[str] = set()
    for i, beat in enumerate(cut['beats']):
        at = f'{where}.beats.{i}'
        shot = beat.get('shot')
        source = (beat.get('plate') or {}).get('source', 'take')
        for obj_id in beat.get('uses', []):
            if 'place' in ((objects.get(obj_id) or {}).get('params') or {}):
                out.append(f'{at}: {obj_id} sets its own place; under the grammar every device sits in the staging\'s region')
        if shot in STAGED_SHOTS and source.startswith('asset:'):
            out.append(f'{at}: a full-frame picture ({source}) replaces his take on a {shot} beat (Tue 17); the real image '
                       'goes in the region as a device, his face stays')
        if shot == 'anchor' and beat.get('backdrop'):
            out.append(f'{at}: a backdrop on an anchor beat has no panel to sit in; real objects are props at his scale in the '
                       'chest band, or a plate')
        if shot in ('title', 'end', 'chapter', 'number') or not shot:
            seen.update(o['obj'] for o in _content(beat, objects))
            continue
        if shot == 'anchor':
            seen.update(o['obj'] for o in _content(beat, objects))
            continue   # his face is the frame: no panel to keep full
        content = _content(beat, objects)
        fill = t['fills_region']
        for o in content:
            if o['device'] not in fill['devices']:
                out.append(f'{at}: {o["obj"]} ({o["device"]}) does not grow to fill the {mode} region; the panel\'s object fills at '
                           f'least {fill["fill_share"]} of its region (a small number in a large dark field was refused, 20 Nov); '
                           'use a device that fills its region (config/ve/shot-grammar.json fills_region)')
        carried = [o for o in content if o['obj'] in seen]
        words = beat['span']['to_w'] - beat['span']['from_w'] + 1
        if carried:
            empty = 0.0
        else:
            ids = {o['obj'] for o in content}
            enters = [e['at_w'] for e in beat.get('events', []) if e['obj'] in ids]
            empty_words = (min(enters) if enters else beat['span']['to_w'] + 1) - beat['span']['from_w']
            empty = seconds[i] * empty_words / max(words, 1)
        if empty > limit + 1e-6:
            what = 'only a backdrop' if beat.get('backdrop') else 'nothing'
            room = 'the plate' if shot == 'plate' else 'the panel'
            out.append(f'{at}: {room} holds {what} for about {empty:.1f} s (beat {beat["id"]}); a device or a real image is in '
                       f'it within {limit} s ({t["panel_empty_max_s"]["from"]})')
        seen.update(o['obj'] for o in content)
    return out


# -------------------------------------------------------------------------------------------------- evidence size

def _image_objects(spec: dict) -> dict[str, dict]:
    """Objects that draw a real image: a src or logoSrc param naming an asset of an image kind."""
    t = table()['evidence']
    paths = {a['path']: a for a in spec.get('assets', []) if a.get('kind') in t['image_kinds']}
    out = {}
    for o in spec.get('objects', []):
        found = []

        def visit(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if key in ('src', 'logoSrc') and isinstance(item, str) and item in paths:
                        found.append(item)
                    else:
                        visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        visit(o.get('params') or {})
        if found or o.get('device') == 'photo_plate':
            out[o['obj']] = o
    return out


def _numbers(params, keys):
    if isinstance(params, dict):
        for key, value in params.items():
            if key in keys and isinstance(value, (int, float)) and not isinstance(value, bool):
                yield key, value
            else:
                yield from _numbers(value, keys)
    elif isinstance(params, list):
        for item in params:
            yield from _numbers(item, keys)


def evidence_size_lints(spec: dict, cut_id: str, mode: str | None) -> list[str]:
    cut = spec['cuts'][cut_id]
    t = table()
    ev = t['evidence']
    where = f'grammar.evidence_size cuts.{cut_id}'
    width = FRAME[cut['aspect']][0]
    share = t['region_width_share'].get(f'{mode}@{cut["aspect"]}')
    out = []
    if share is not None and share < ev['image_width_min_share']:
        out.append(f'{where}: the {mode} region is {share:.2f} of the frame wide, under {ev["image_width_min_share"]}')
    images = _image_objects(spec)
    used = {u for b in cut['beats'] for u in b.get('uses', [])}
    objects = {o['obj']: o for o in spec.get('objects', [])}
    for obj_id in sorted(used):
        o = objects.get(obj_id)
        if not o:
            continue
        for key, value in _numbers(o.get('params') or {}, set(ev['size_params'])):
            if value < ev['words_min_px']:
                out.append(f'{where}: {obj_id}.{key} is {value:g} px; words on screen are at least {ev["words_min_px"]} px')
        if obj_id in images:
            for key, value in _numbers(o.get('params') or {}, set(ev['width_params'])):
                got = value if value <= 1 else value / width
                if got < ev['image_width_min_share']:
                    out.append(f'{where}: {obj_id}.{key} draws the real image {got:.2f} of the frame wide; it fills its region, '
                               f'at least {ev["image_width_min_share"]} ({ev["from"]})')
    for i, beat in enumerate(cut['beats']):
        shown = [u for u in beat.get('uses', []) if u in images]
        if not shown:
            continue
        others = [u for u in beat.get('uses', []) if u in objects and objects[u]['device'] not in ev['companions']]
        if len(others) > 1:
            out.append(f'{where}.beats.{i}: the real image {", ".join(shown)} shares the region with {len(others) - 1} other '
                       'device(s), so it draws smaller than its region; one picture a beat, filling it')
    return out


# ------------------------------------------------------------------------------------------------------- generated

def generated_lints(spec: dict) -> list[str]:
    """grammar.generated: a generated picture is art-directed and clearly a metaphor, never a stand-in for a real document,
    sign, place or person (Ruling, Krish, 2026-11-20); it declares which (`depicts`), and one that does not is refused until
    it does. It lives in the cut's one staging like any device (grammar.region refuses a full-frame picture in his place
    on band and stage). His approved clone voice and sound are not pictures."""
    t = table()['generated']
    kept = set(t['kept_kinds'])
    out = []
    for a in spec.get('assets', []):
        if a.get('origin') != 'generated' or a.get('kind') in kept:
            continue
        where = f'grammar.generated assets.{a.get("id")}'
        what = f'a generated {a.get("kind")} ({a.get("tool") or "no tool named"})'
        if a.get('depicts') == 'real':
            out.append(f'{where}: {what} stands in for a real document, sign, place or person; those are refused: use the real '
                       f'thing (a real photo, screenshot or document) ({RULING_GENERATED})')
        elif a.get('depicts') != 'metaphor':
            out.append(f'{where}: {what} does not say what it depicts; set depicts: metaphor for an art-directed image that '
                       f'reads as a metaphor, and use the real thing for a real document, sign, place or person '
                       f'({RULING_GENERATED})')
    return out


def generation_refusal(spec: dict, directory: Path | None, today: str | None = None) -> str | None:
    """ve brief (plate briefs and their generation route): for a piece the grammar binds, every generated picture the spec
    names is declared a metaphor before a brief is written; a stand-in for a real thing is never briefed."""
    from .floor import binds  # noqa: PLC0415
    if not binds(directory, today):
        return None
    found = generated_lints(spec)
    if not found:
        return None
    return ('grammar.generated: a plate brief needs every generated picture declared depicts: metaphor (never a stand-in '
            f'for a real document, sign, place or person; {RULING_GENERATED}): ' + '; '.join(found))


# ---------------------------------------------------------------------------------------------------------- repeat

def repeat_lints(spec: dict, cut_id: str) -> list[str]:
    cut = spec['cuts'][cut_id]
    t = table()['repeat']
    objects = {o['obj']: o for o in spec.get('objects', [])}
    where = f'grammar.repeat cuts.{cut_id}'
    through = ((spec.get('style') or {}).get('idea') or {}).get('object') if isinstance((spec.get('style') or {}).get('idea'), dict) else None
    out = []
    devices: dict[str, list[list[int]]] = {}
    for i, beat in enumerate(cut['beats']):
        for d in {objects[u]['device'] for u in beat.get('uses', []) if u in objects}:
            if d in t['annotations']:
                continue
            runs = devices.setdefault(d, [])
            if runs and runs[-1][-1] == i - 1:
                runs[-1].append(i)
            else:
                runs.append([i])

    def changes(i: int, device: str) -> bool:
        beat = cut['beats'][i]
        ids = {u for u in beat.get('uses', []) if u in objects and objects[u]['device'] == device}
        return any(e['obj'] in ids and e['verb'] != 'carry' for e in beat.get('events', []))

    for device, runs in sorted(devices.items()):
        every_changes = all(changes(i, device) for run in runs for i in run)
        if len(runs) > t['max_appearances'] and not (device == 'through_line' or (through and every_changes and device == through)):
            out.append(f'{where}: {device} appears {len(runs)} times; at most {t["max_appearances"]} a cut ({t["from"]})')
        for run in runs:
            for i in run[1:]:
                if not changes(i, device):
                    out.append(f'{where}.beats.{i}: {device} returns from the beat before with no new state; a device comes '
                               'back only with a new state')
    return out


# ---------------------------------------------------------------------------------------------------- caption zone

def caption_zone_lints(spec: dict, cut_id: str) -> list[str]:
    """One caption zone a cut: the y the captions sit at on each beat, within the measured spread."""
    from . import keepout, qc_faces  # noqa: PLC0415
    cut = spec['cuts'][cut_id]
    aspect = cut['aspect']
    t = table()['caption_zone']
    themed = ((spec.get('style') or {}).get('captions') or {}).get('theme') or (spec.get('brand') or {}).get('caption_theme')
    placement = ((spec.get('style') or {}).get('captions') or {}).get('placement') or 'lower'
    word = (spec.get('brand') or {}).get('captions') == 'word' and not ((spec.get('style') or {}).get('captions') or {}).get('theme')
    ys = []
    for i, beat in enumerate(cut['beats']):
        if beat.get('shot') in ('title', 'end'):
            continue   # no captions while the title holds; the end card carries none
        if themed and not word:
            box = keepout.theme_bands()[aspect][placement]
        elif word:
            g = qc_faces.word_geometry(aspect, beat.get('layout'), (beat.get('plate') or {}).get('source'))
            box = (0, int(g['centerY'] - g['size'] * 0.6), 0, int(g['size'] * 1.2))
        else:
            box = keepout.HOUSE_BAND[aspect]
        ys.append((i, (box[1] + box[3] / 2) / FRAME[aspect][1]))
    if not ys:
        return []
    lo, hi = min(y for _i, y in ys), max(y for _i, y in ys)
    if hi - lo > t['max_y_spread_share'] + 1e-9:
        moved = [i for i, y in ys if abs(y - ys[0][1]) > t['max_y_spread_share']]
        return [f'grammar.caption_zone cuts.{cut_id}: the captions sit at y {lo:.2f} to {hi:.2f} of the frame across the cut '
                f'(beats {", ".join(map(str, moved))} move them); one zone a cut, the same y on every beat within '
                f'{t["max_y_spread_share"]} ({t["from"]})']
    return []


# ------------------------------------------------------------------------------------------------------------ title

def _norm(word: str) -> str:
    return ''.join(ch for ch in str(word).lower() if ch.isalnum())


def title_timing_lints(spec: dict, cut_id: str, directory: Path | None) -> list[str]:
    """grammar.title_timing: the title lands as he says its words, inside the first 30 s (Krish, 2026-11-20: "a good
    looking title slide, and a good looking outro are hugely important. The title slide comes in as I say the words of the
    title within the opening 30 seconds"). A whole cut of a piece with a title moment names the span of his spoken title
    words; the span starts on the line's first word as he said it (the aligned words when ve conform wrote them, else the
    spec's own script words); and that word starts within title_by_s of the cut's first frame (the hook: nothing goes before it)."""
    moment = spec.get('title_moment') or {}
    cut = spec['cuts'][cut_id]
    if not moment or cut.get('excerpt'):
        return []
    t = table()['title']
    where = f'grammar.title_timing cuts.{cut_id}'
    span = (moment.get('spans') or {}).get(cut_id)
    if not span:
        return [f'{where}: the piece has a title moment but this cut names no span of his spoken title words '
                '(title_moment.spans); the title comes in as he says it, never as a card of its own']
    out = []
    words = _words(directory, cut_id)
    line = [w for w in (_norm(x) for x in str(moment.get('line') or '').split()) if w]
    if words and line:
        said = [_norm(words[i].get('word', words[i].get('text', ''))) for i in range(span['from_w'], span['to_w'] + 1) if i in words]
        if not said or said[0] != line[0]:
            out.append(f'{where}: the title span starts on "{said[0] if said else "?"}", not on the first word of his title line '
                       f'("{line[0]}"); it starts on the words he says as the title')
    if words and span['from_w'] in words:
        at = float(words[span['from_w']]['onset_s'])
    else:
        at = span['from_w'] / WORDS_PER_SECOND
    if at > t['by_s'] + 1e-6:
        out.append(f'{where}: the title starts {at:.1f} s into the cut; it comes in within the opening {t["by_s"]:g} s '
                   f'({t["from"]})')
    return out


# ------------------------------------------------------------------------------------------------------------ depth

def matte_record(directory: Path | None, cut_id: str) -> dict | None:
    """The subject matte `ve matte` recorded for this cut's picture (matte.<cut>.json beside the spec), when its cached
    files are still there for those bytes; else None."""
    if directory is None:
        return None
    path = Path(directory) / f'matte.{cut_id}.json'
    if not path.is_file():
        return None
    try:
        note = load_json(path)
    except (OSError, ValueError):
        return None
    from . import matte  # noqa: PLC0415
    root = Path(note['cache']) if note.get('cache') else matte.CACHE
    folder = matte.cache_dir(note.get('picture_sha256', ''), root)
    if not (folder / 'matte.json').is_file() or not (folder / 'subject.mov').is_file():
        return None
    return note


_ANTON: dict | None = None


def anton_advance() -> dict:
    """Anton's advance widths (thousandths of an em), read from the renderer's own table (house/metrics.ts)."""
    global _ANTON
    if _ANTON is None:
        import re  # noqa: PLC0415
        from .common import ROOT  # noqa: PLC0415
        text = (ROOT / 'apps' / 'renderer' / 'src' / 'house' / 'metrics.ts').read_text(encoding='utf-8')
        line = next(l for l in text.splitlines() if l.startswith('const CHARACTERS = '))
        raw = line[len("const CHARACTERS = '"):-1]
        chars = raw.replace("\\'", "'").replace('\\\\', '\\')
        widths = [int(n) for n in re.search(r'anton: \[([0-9, ]+)\]', text).group(1).split(',')]
        _ANTON = dict(zip(chars, widths))
    return _ANTON


def in_world_share(text: str, aspect: str) -> float:
    """kit/depth.ts inWorldShare: the glyph height, as a share of the frame's height, the in-world word gets."""
    t = table()['depth']
    w, h = FRAME[aspect]
    per_em = max(1, sum(anton_advance().get(ch, 600) for ch in text.upper())) / 1000
    cap = t['anton_cap_em']
    font = min(t['in_world_share']['target'] * h / cap, w * 0.94 / per_em, t['in_world_share']['max'] * h / cap)
    return cap * font / h


def depth_lints(spec: dict, cut_id: str, mode: str | None, seconds: list, directory: Path | None) -> list:
    """grammar.depth: the in-world number, the chapter marks and the anchor title behind him (shot grammar step 5)."""
    cut = spec['cuts'][cut_id]
    t = table()['depth']
    where = f'grammar.depth cuts.{cut_id}'
    out = []
    has_matte = matte_record(directory, cut_id) is not None
    no_matte = (f'take {cut.get("take")} has no subject matte; run `ve matte` (offline, no generation, no spend), so the type '
                'sits behind him and never on his chest')
    arrangements: list = []
    for i, beat in enumerate(cut['beats']):
        at = f'{where}.beats.{i}'
        shot = beat.get('shot')
        if beat.get('world') and shot != 'number':
            out.append(f'{at}: a world word on a {shot} beat; it is a number shot')
        if beat.get('chapter') and shot != 'chapter':
            out.append(f'{at}: a chapter mark on a {shot} beat; it is a chapter shot')
        if shot == 'number' and mode == 'anchor':
            world = beat.get('world')
            if not world:
                out.append(f'{at}: a number shot on an anchor cut is the in-world number behind him: give it world.text')
                continue
            share = in_world_share(world['text'], cut['aspect'])
            if share < t['in_world_share']['min'] - 1e-9:
                out.append(f'{at}: "{world["text"]}" stands {share:.2f} of the frame tall at its widest fit; an in-world number is '
                           f'{t["in_world_share"]["min"]} to {t["in_world_share"]["max"]} of the frame ({t["from"]}): '
                           'a shorter word or number, or put it in the space above his head')
            lo, hi = t['world_s']
            if not lo - 1e-6 <= seconds[i] <= hi + 1e-6:
                out.append(f'{at}: the in-world number holds {seconds[i]:.1f} s; it holds {lo:g} to {hi:g} s')
            span = beat['span']
            if world.get('at_w') is not None and not span['from_w'] <= world['at_w'] <= span['to_w']:
                out.append(f'{at}: world.at_w {world["at_w"]} is outside the beat; it slams in on a word he says in it')
            if not has_matte:
                out.append(f'{at}: an in-world number, but {no_matte}')
        elif shot == 'number' and beat.get('world'):
            out.append(f"{at}: a world word on a {mode} cut; behind him is anchor's, and on {mode} the number fills the panel")
        if shot == 'chapter':
            c = beat.get('chapter')
            if not c:
                out.append(f'{at}: a chapter shot with no chapter mark (chapter.mark and chapter.arrangement)')
                continue
            seen = arrangements[-(len(t['chapter_arrangements']) - 1):] if arrangements else []
            if c['arrangement'] in seen:
                out.append(f'{at}: chapter mark {c["mark"]} is {c["arrangement"]} again; a different arrangement each time '
                           f'({", ".join(t["chapter_arrangements"])})')
            arrangements.append(c['arrangement'])
            if c['arrangement'] == 'behind' and not has_matte:
                out.append(f'{at}: a chapter mark behind him, but {no_matte}')
    span = (((spec.get('title_moment') or {}).get('spans') or {}).get(cut_id))
    if mode == 'anchor' and span and not has_matte:
        out.append(f'{where}: the anchor title builds behind his head through the matte (never a small box on his chest), '
                   f'but {no_matte}')
    return out


# ------------------------------------------------------------------------------------------------------------ lints

def lints(spec: dict, spec_path: Path | None = None, *, today: str | None = None) -> list[str]:
    """Every grammar lint for ve lint, for a piece frozen from floor.RECIPE_FROM."""
    from .floor import binds  # noqa: PLC0415
    from .verdict import ve_dir  # noqa: PLC0415
    directory = ve_dir(spec_path) if spec_path else None
    if not binds(directory, today):
        return []
    return check(spec, directory)


def check(spec: dict, directory: Path | None = None) -> list[str]:
    out = generated_lints(spec)
    for cut_id, cut in spec['cuts'].items():
        mode = staging(spec, cut_id, directory)
        found = staging_lints(spec, cut_id, mode)
        out += found
        if any(': anchor on ' in f or 'is drawn with' in f for f in found):
            continue
        seconds = beat_seconds(cut, _words(directory, cut_id))
        out += face_run_lints(spec, cut_id, mode, seconds)
        out += region_lints(spec, cut_id, mode, seconds)
        out += evidence_size_lints(spec, cut_id, mode)
        out += repeat_lints(spec, cut_id)
        out += caption_zone_lints(spec, cut_id)
        out += depth_lints(spec, cut_id, mode, seconds, directory)
        out += title_timing_lints(spec, cut_id, directory)
    return out
