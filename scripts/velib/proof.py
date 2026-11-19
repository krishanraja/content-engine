"""The moving proof: the cut's hardest beat rendered from his real take before any full cut (closes F04 and F13).

Krish, 2026-11-04: "Do we now ask all the right questions at the right times ... in order for you and Codex to never
need more than one production round in the future?" Thursday 5 Nov took 5+ renders; stills had stood in for motion
(F04) and the approach was scaled before its hardest sequence was proven (F13). Here:

  - `hardest_beat(spec, cut, props)`: by rule, never by taste. The beat named in `style.proof.beat` (or a top-level
    `proof.beat`); else the beat with the most distinct devices in `uses`; ties go to a SPLIT beat with a card device;
    then the longest; then the first.
  - `window(props, beat)`: the beat's frames, grown to at least 8 s into its neighbours and cut to at most 15 s.
  - `window_props(props, start, end)`: the same compiled props, cut to that window on the same clock, so the shared
    FormatMaster renders it through the one render path (`velib.render.render`), and `ve qc` measures it.
  - `structure(spec, cut)` / `structural_hash`: style.motion, the device set and each beat's id, uses and layout.
    Caption text, reasons and word spans are not in it, so a caption edit keeps the proof; a style or device change
    breaks it. A beat retimed by 0.5 s or more also breaks it (`problems`, against the beat times the proof recorded).
  - `problems(spec, cut, directory, gates)`: what holds a full cut's render from MOTION_FROM: no proof, a proof file
    that changed, a spec that changed structurally, or no approve press from Krish bound to the proof's sha256.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path

from .common import ROOT, load_json, sha256_file, write_json

FPS = 30
MIN_S, MAX_S = 8, 15
NUDGE_S = 0.5


def motion_from() -> str:
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    return creative_direction.MOTION_FROM


def required(spec: dict, cut: str) -> bool:
    """A whole cut (not a proof excerpt) of a piece published from MOTION_FROM renders only after its proof."""
    c = spec['cuts'][cut]
    return not c.get('excerpt', False) and str(spec.get('publish_day') or '') >= motion_from()


def devices_of(spec: dict, beat: dict) -> list[str]:
    by_obj = {o['obj']: o.get('device') for o in spec.get('objects') or []}
    return sorted({by_obj[name] for name in beat.get('uses') or [] if by_obj.get(name)})


def named_beat(spec: dict) -> str | None:
    for holder in ((spec.get('style') or {}).get('proof'), spec.get('proof')):
        if isinstance(holder, dict) and isinstance(holder.get('beat'), str):
            return holder['beat']
    return None


def _length(beat: dict, frames: dict) -> int:
    if beat['id'] in frames:
        a, b = frames[beat['id']]
        return b - a
    span = beat.get('span') or {}
    return int(span.get('to_w', 0)) - int(span.get('from_w', 0))


def hardest_beat(spec: dict, cut: str, props: dict | None = None) -> tuple[str, str]:
    """(beat id, the rule that chose it)."""
    beats = spec['cuts'][cut]['beats']
    named = named_beat(spec)
    if named:
        if named not in [b['id'] for b in beats]:
            raise ValueError(f'proof.beat {named!r} is not a beat of cut {cut}')
        return named, 'named in the spec (proof.beat)'
    frames = {b['id']: (b['fromFrame'], b['toFrame']) for b in (props or {}).get('beats') or []}
    scored = []
    for index, beat in enumerate(beats):
        devices = devices_of(spec, beat)
        split_card = beat.get('layout') == 'SPLIT' and any(d.endswith('_card') for d in devices)
        scored.append((len(devices), split_card, _length(beat, frames), -index, beat['id']))
    best = max(scored)
    ties = [row for row in scored if row[0] == best[0]]
    if len(ties) == 1:
        rule = f'most distinct devices ({best[0]})'
    elif best[1] and sum(1 for row in ties if row[1]) == 1:
        rule = f'most distinct devices ({best[0]}), tie broken by the SPLIT beat with a card'
    else:
        rule = f'most distinct devices ({best[0]}), tie broken by length'
    return best[4], rule


def content_end(props: dict) -> int:
    ending = props.get('ending')
    return int(ending['fromFrame']) if isinstance(ending, dict) else int(props['durationFrames'])


def window(props: dict, beat_id: str) -> tuple[int, int]:
    """[start, end) frames: the beat, grown to MIN_S into its neighbours, cut to MAX_S from its start."""
    beat = next((b for b in props['beats'] if b['id'] == beat_id), None)
    if beat is None:
        raise ValueError(f'beat {beat_id} is not in the compiled props: run ve compile for this cut first')
    fps = props.get('fps', FPS)
    limit = content_end(props)
    start, end = int(beat['fromFrame']), min(int(beat['toFrame']), limit)
    if end - start > MAX_S * fps:
        end = start + MAX_S * fps
    need = MIN_S * fps - (end - start)
    if need > 0:
        start, end = start - need // 2, end + need - need // 2
        if start < 0:
            end, start = min(limit, end - start), 0
        if end > limit:
            start, end = max(0, start - (end - limit)), limit
    # A window never spans the sting after the hook: the stem holds its frames of silence there, so a window that
    # crossed it would play his voice out of step. It stays on its own beat's side of the hook's end.
    at = int((props.get('sting') or {}).get('atFrame') or 0)
    if at and start < at < end:
        start, end = (at, end) if int(beat['fromFrame']) >= at else (start, at)
    if end <= start:
        raise ValueError(f'beat {beat_id} has no frames to prove')
    return start, end


def window_props(props: dict, start: int, end: int) -> dict:
    """The compiled props cut to [start, end) on the same clock: what the window shows, nothing the cut does not."""
    out = json.loads(json.dumps(props))
    length = end - start

    def shift(frame):
        return min(max(int(frame) - start, 0), length)

    def overlaps(a, b):
        return int(a) < end and int(b) > start

    out['durationFrames'] = length
    beats = []
    for beat in props['beats']:
        if not overlaps(beat['fromFrame'], beat['toFrame']):
            continue
        row = dict(beat, fromFrame=shift(beat['fromFrame']), toFrame=shift(beat['toFrame']))
        if 'keyFrame' in beat:
            row['keyFrame'] = min(max(shift(beat['keyFrame']), row['fromFrame']), row['toFrame'] - 1)
        row['sectionBeat'] = not beats
        beats.append(row)
    out['beats'] = beats
    alive = set()
    objects = []
    for obj in props.get('objects') or []:
        if overlaps(obj['fromFrame'], obj['toFrame']):
            objects.append(dict(obj, fromFrame=shift(obj['fromFrame']), toFrame=shift(obj['toFrame'])))
            alive.add(obj['obj'])
    out['objects'] = objects
    # An object alive in the window keeps every state it reached before it: earlier events land on frame 0, in order
    # (the renderer lands frame-0 entrances whole).
    out['events'] = [dict(e, atFrame=shift(e['atFrame'])) for e in props.get('events') or []
                     if e['obj'] in alive and int(e['atFrame']) < end]
    captions = []
    for page in props.get('captions') or []:
        if not overlaps(page['fromFrame'], page['toFrame']):
            continue
        captions.append(dict(page, fromFrame=shift(page['fromFrame']), toFrame=shift(page['toFrame']),
                             words=[dict(w, atFrame=shift(w['atFrame'])) for w in page['words']]))
    if not captions:
        raise ValueError('the proof window holds no caption page')
    out['captions'] = captions
    # The episode title moment is on the cut's clock like everything else: shifted into the window, or gone when the
    # window misses it (Wed 18, 18 Nov 2026: a proof of the title beat left it at frame 627 of a 240-frame window, unseen).
    moment = props.get('titleMoment')
    if moment and overlaps(moment['fromFrame'], moment['toFrame']):
        out['titleMoment'] = dict(moment, fromFrame=shift(moment['fromFrame']), toFrame=shift(moment['toFrame']),
                                  words=[dict(w, atFrame=shift(w['atFrame'])) for w in moment.get('words') or []])
    else:
        out.pop('titleMoment', None)
    out['segments'] = [dict(s, trimBeforeFrames=int(s.get('trimBeforeFrames', 0)) + max(0, start - int(s['fromFrame'])),
                            fromFrame=shift(s['fromFrame']),
                            durationFrames=min(int(s['fromFrame']) + int(s['durationFrames']), end) - max(int(s['fromFrame']), start))
                       for s in props.get('segments') or [] if overlaps(s['fromFrame'], int(s['fromFrame']) + int(s['durationFrames']))]
    # A window is never a whole cut, so it carries no sting; but the stem was premixed with the sting's frames where
    # it plays (ve premix), so cut frame f is stem frame velib.qc.to_file(f) (window keeps it off the sting).
    from .qc import to_file  # noqa: PLC0415
    out.pop('sting', None)
    out['audio'] = dict(props['audio'], stem=dict(props['audio']['stem'],
                        trimBeforeFrames=int(props['audio']['stem'].get('trimBeforeFrames', 0)) + to_file(start, props)),
                        sfx=[dict(s, atFrame=shift(s['atFrame'])) for s in props['audio'].get('sfx') or []
                             if start <= int(s['atFrame']) < end])
    ending = props.get('ending')
    if isinstance(ending, dict) and int(ending['fromFrame']) < end:
        out['ending'] = dict(ending, fromFrame=shift(ending['fromFrame']))
    else:
        out.pop('ending', None)
    return out


# The title frame is always in what Krish approves (Ruling, Krish, 2026-11-19): Wed 18's proofs covered the hook, the title
# came at 0:34 and 0:21, and a long render went ahead on "as long as the title card frame in each is strong" with nobody
# having looked at the title. A proof whose window misses the title renders the title as a second clip beside it.
TITLE_PAD_S = 2
TITLE_WORDS = re.compile(r'\btitles?\b', re.I)


def title_window(props: dict) -> tuple[int, int] | None:
    """[start, end) frames around the title moment, padded so captions on each side are in it; None with no title."""
    moment = props.get('titleMoment')
    if not moment:
        return None
    fps = props.get('fps', FPS)
    limit = content_end(props)
    start = max(0, int(moment['fromFrame']) - TITLE_PAD_S * fps)
    end = min(limit, int(moment['toFrame']) + TITLE_PAD_S * fps)
    at = int((props.get('sting') or {}).get('atFrame') or 0)
    if at and start < at < end:
        start, end = (at, end) if int(moment['fromFrame']) >= at else (start, at)
    return (start, end) if end > start else None


def title_clip_path(directory: Path, cut: str) -> Path:
    return Path(directory) / 'proof' / f'{cut}.title.mp4'


def record_title_looked(directory: Path, cut: str, text: str, now: str) -> dict:
    """Record that the title frame was looked at, at full size, and what was found. Refused with no title in the proof, or
    with too few words to say what was looked at."""
    path = record_path(directory, cut)
    if not path.is_file():
        raise ValueError(f'no proof record for {cut}: run ve proof first')
    record = load_json(path)
    title = record.get('title')
    if not title:
        raise ValueError('this proof records no title frame: run ve proof again (it renders the title with the proof)')
    if len(str(text).split()) < 12:
        raise ValueError('say what you saw on the title frame at full size, in at least 12 words (type size, centring, '
                         'the wordmark inside the lockup, the words timed to his)')
    title['looked'] = {'text': str(text).strip()[:1000], 'at': now}
    record['sendable'] = not sendable_problems(record)
    write_json(path, record)
    return record


def structure(spec: dict, cut: str) -> dict:
    """What a proof stands for: the style, the devices and each beat's id, uses and layout. Words and spans are not in it."""
    beats = spec['cuts'][cut]['beats']
    used = {name for b in beats for name in b.get('uses') or []}
    motion = (spec.get('style') or {}).get('motion')
    out = {
        'format': spec.get('format'), 'aspect': spec['cuts'][cut].get('aspect'),
        'motion': motion.get('module') if isinstance(motion, dict) else None,
        'objects': sorted([o['obj'], o.get('device')] for o in spec.get('objects') or [] if o['obj'] in used),
        'beats': [[b['id'], b.get('layout'), sorted(b.get('uses') or [])] for b in beats],
    }
    # An off-day short voiced by his approved clone (Ruling, Krish, 2026-11-15): his Approve proof stands for the clone
    # reading he heard, so a voice generated again shows him the proof again. A cut read from his own voice carries no
    # such key, so every proof recorded before this keeps its hash.
    voice = clone_voice(spec, cut)
    if voice:
        out['voice'] = voice
    return out


def clone_voice(spec: dict, cut: str) -> list | None:
    """[asset id, tool, sha256] of the clone voice the cut takes, or None for his own voice."""
    take = spec['cuts'][cut].get('take')
    asset = next((a for a in spec.get('assets') or [] if a.get('kind') == 'voice' and a.get('id') == take), None)
    return [asset['id'], asset.get('tool'), asset.get('sha256')] if asset else None


def structural_hash(spec: dict, cut: str) -> str:
    return hashlib.sha256(json.dumps(structure(spec, cut), sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()


def changes(old: dict, new: dict) -> list[str]:
    """Plain lines naming what changed between two structures."""
    out = []
    if old.get('motion') != new.get('motion'):
        out.append(f"style.motion {old.get('motion')} -> {new.get('motion')}")
    for key in ('format', 'aspect'):
        if old.get(key) != new.get(key):
            out.append(f'{key} {old.get(key)} -> {new.get(key)}')
    if old.get('voice') != new.get('voice'):
        def heard(voice):
            return f'clone {voice[0]} ({str(voice[2])[:12]})' if voice else 'his own voice'
        out.append(f"voice {heard(old.get('voice'))} -> {heard(new.get('voice'))}")
    a, b = {tuple(x) for x in old.get('objects') or []}, {tuple(x) for x in new.get('objects') or []}
    out += [f'device added: {o} ({d})' for o, d in sorted(b - a)] + [f'device removed: {o} ({d})' for o, d in sorted(a - b)]
    olds = {row[0]: row for row in old.get('beats') or []}
    news = {row[0]: row for row in new.get('beats') or []}
    out += [f'beat added: {bid}' for bid in news if bid not in olds] + [f'beat removed: {bid}' for bid in olds if bid not in news]
    for bid in news:
        if bid in olds and olds[bid] != news[bid]:
            out.append(f'beat {bid}: layout {olds[bid][1]} -> {news[bid][1]}, uses {olds[bid][2]} -> {news[bid][2]}'
                       if olds[bid][1] != news[bid][1] else f'beat {bid}: uses {olds[bid][2]} -> {news[bid][2]}')
    if not out and [r[0] for r in old.get('beats') or []] != [r[0] for r in new.get('beats') or []]:
        out.append('beat order changed')
    return out


def record_path(directory: Path, cut: str) -> Path:
    return Path(directory) / 'proof' / f'{cut}.json'


def clip_path(directory: Path, cut: str) -> Path:
    return Path(directory) / 'proof' / f'{cut}.mp4'


def beat_seconds(props: dict, beat_id: str) -> tuple[float, float] | None:
    beat = next((b for b in props.get('beats') or [] if b['id'] == beat_id), None)
    if beat is None:
        return None
    fps = props.get('fps', FPS)
    return round(beat['fromFrame'] / fps, 3), round(min(beat['toFrame'], content_end(props)) / fps, 3)


def make(spec: dict, cut: str, directory: Path, props: dict, render_fn, qc_fn=None) -> dict:
    """Choose the beat, write the window props, render them through render_fn(props_path, out_mp4) and record it."""
    if cut not in spec['cuts']:
        raise ValueError(f'{cut} is not a cut in the spec')
    if props.get('cutId') != cut:
        raise ValueError(f"the props are for {props.get('cutId')}, not {cut}")
    beat, rule = hardest_beat(spec, cut, props)
    start, end = window(props, beat)
    folder = Path(directory) / 'proof'
    folder.mkdir(parents=True, exist_ok=True)
    props_out = write_json(folder / f'props.{cut}.json', window_props(props, start, end))
    clip = clip_path(directory, cut)
    render_fn(props_out, clip)
    if not clip.is_file() or clip.stat().st_size == 0:
        raise ValueError(f'the proof render wrote nothing at {clip}')
    fps = props.get('fps', FPS)
    motion = (spec.get('style') or {}).get('motion')
    record = {'schema': 've-proof/1', 'piece': spec['piece_id'], 'cut': cut, 'beat': beat, 'rule': rule,
              'start': round(start / fps, 3), 'end': round(end / fps, 3), 'beat_s': beat_seconds(props, beat),
              'sha256': sha256_file(clip), 'spec_sha256': structural_hash(spec, cut), 'structure': structure(spec, cut),
              'style_module': motion.get('module') if isinstance(motion, dict) else None,
              'props_sha256': sha256_file(props_out)}
    titled = title_window(props)
    if titled is not None:
        fps_ = props.get('fps', FPS)
        if start <= int(props['titleMoment']['fromFrame']) and int(props['titleMoment']['toFrame']) <= end:
            record['title'] = {'in_main': True, 'start': round(titled[0] / fps_, 3), 'end': round(titled[1] / fps_, 3)}
        else:
            title_props = write_json(folder / f'props.{cut}.title.json', window_props(props, *titled))
            title_clip = title_clip_path(directory, cut)
            render_fn(title_props, title_clip)
            if not title_clip.is_file() or title_clip.stat().st_size == 0:
                raise ValueError(f'the title proof render wrote nothing at {title_clip}')
            record['title'] = {'in_main': False, 'clip': title_clip.name, 'sha256': sha256_file(title_clip),
                               'start': round(titled[0] / fps_, 3), 'end': round(titled[1] / fps_, 3)}
    if qc_fn is not None:
        try:
            report = qc_fn(clip, props_out)
            record['qc'] = {'measured_pass': report.get('measured_pass'), 'complete': report.get('complete'),
                            'failing': sorted(k for k, v in (report.get('checks') or {}).items() if v.get('pass') is False)}
        except Exception as error:  # noqa: BLE001 - QC on the proof is a first look, recorded either way
            record['qc'] = {'measured_pass': None, 'complete': False, 'error': str(error)[:200]}
    write_json(record_path(directory, cut), record)
    return record


def _standing_reproof(spec: dict, record: dict) -> bool:
    """A newer proof of a piece he has already approved a proof of needs no new press once the session recorded what it
    compared (Ruling, Krish, 2026-11-19; config/ve/production-guards.json standing_approval.reproof)."""
    from .guards import standing  # noqa: PLC0415
    approved = any(isinstance(a, dict) and a.get('gate') == 'proof' and a.get('by') == 'Krish' for a in spec.get('approvals') or [])
    compared = ((record.get('compare') or {}).get('compared') or {}).get('text')
    return standing('reproof') and approved and bool(compared)


def problems(spec: dict, cut: str, directory: Path, gates: dict, props: dict | None = None) -> list[str]:
    """[] when an approved proof stands for this cut as the spec is now; otherwise each reason, with what to do."""
    piece = spec.get('piece_id', '<piece>')
    path = record_path(directory, cut)
    run = f'run ve proof <spec> --cut {cut}, then Krish presses Approve proof on the board'
    if not path.is_file():
        return [f'no moving proof for {cut}: {run}']
    record = load_json(path)
    clip = clip_path(directory, cut)
    out = []
    out.extend(sendable_problems(record))
    if clip.is_file() and sha256_file(clip) != record.get('sha256'):
        out.append(f'proof/{cut}.mp4 is not the file proof/{cut}.json records: {run}')
    if record.get('spec_sha256') != structural_hash(spec, cut):
        what = changes(record.get('structure') or {}, structure(spec, cut))
        out.append(f"the spec changed since the proof ({'; '.join(what) or 'structure'}): {run}")
    if props is not None and record.get('beat_s'):
        now = beat_seconds(props, record['beat'])
        if now is None or any(abs(a - b) >= NUDGE_S for a, b in zip(now, record['beat_s'])):
            out.append(f"beat {record['beat']} moved by {NUDGE_S} s or more since the proof: {run}")
    if props is not None and props.get('titleMoment') and not record.get('title'):
        out.append(f'the proof never shows the title frame, so his approval cannot cover it: {run}')
    title = record.get('title') or {}
    if title.get('clip'):
        title_clip = title_clip_path(directory, cut)
        if not title_clip.is_file() or sha256_file(title_clip) != title.get('sha256'):
            out.append(f"proof/{title['clip']} is not the title clip proof/{cut}.json records: {run}")
    from .gates import for_hash
    press = for_hash(gates, 'proof', record.get('sha256'), cut)
    # An approval on a condition about the title ("as long as the title card frame in each is strong", Wed 18) is met
    # only when the title frame was looked at, at full size, and what was seen recorded (ve proof --title-looked).
    if press is not None and press.get('verdict') == 'approve' and TITLE_WORDS.search(str(press.get('words') or '')) \
            and not (title.get('looked') or {}).get('text'):
        out.append(f"Krish's approval names the title (\"{press['words']}\"), and nobody has recorded looking at the title frame at "
                   f'full size: open it, then ve proof <spec> --cut {cut} --title-looked "what you saw"')
    if press is None and _standing_reproof(spec, record):
        press = {'verdict': 'approve', 'words': ''}
    if press is None:
        out.append(f"Krish has not approved proof/{cut}.mp4 (sha256 {str(record.get('sha256'))[:12]}): he presses Approve proof "
                   f"on the board's day tab for {piece}")
    elif press.get('verdict') != 'approve':
        words = f": \"{press['words']}\"" if press.get('words') else ''
        out.append(f'Krish rejected this proof{words}; change the spec and run ve proof <spec> --cut {cut} again')
    return out


def summary(spec: dict, cut: str, directory: Path, gates: dict) -> str:
    """One plain line for the packet: approved or not, and what changed since."""
    path = record_path(directory, cut)
    if not path.is_file():
        return f'{cut}: no moving proof was made' + ('' if not required(spec, cut) else ' (required from 9 Nov)')
    record = load_json(path)
    reasons = problems(spec, cut, directory, gates)
    what = changes(record.get('structure') or {}, structure(spec, cut))
    since = f"; changed since: {'; '.join(what)}" if what else '; nothing structural changed since'
    if not reasons:
        return f"{cut}: proof of beat {record['beat']} approved by Krish{since}"
    return f"{cut}: proof of beat {record['beat']} not approved ({reasons[0].split(':')[0]}){since}"


# ---------------------------------------------------------------- what changed since the proof he last approved (F58)
# Krish, 2026-11-19, of Proof v10: "It has seriously regressed. The subtitles are now in the wrong place and there's loads
# of black space underneath." The engine's new caption engine and a screen asset had changed since the proof he approved,
# and the session sent the new one without putting it beside the old. Here the engine's and the assets' hashes are
# recorded on every proof; when either differs from the approved proof's, `ve proof` writes a sheet of the same moments
# (his approved proof above the new) and the proof is not sendable until the session records what it compared
# (`ve proof --compared "..."`). Comparing is the session's job; this makes skipping it impossible.


def stamp(spec: dict) -> dict:
    """The engine (guards.engine_sha) and the assets (id to sha256) this proof was made on."""
    from . import guards  # noqa: PLC0415
    assets = {str(a.get('id')): a.get('sha256') for a in spec.get('assets') or [] if isinstance(a, dict) and a.get('id')}
    return {'engine_sha256': guards.engine_sha(), 'assets_sha256': dict(sorted(assets.items()))}


def history_dir(directory: Path) -> Path:
    return Path(directory) / 'proof' / 'history'


def archive_previous(directory: Path, cut: str) -> Path | None:
    """Keep the proof about to be replaced (record and clip), by its hash, so the one he approved is never lost."""
    import shutil  # noqa: PLC0415
    path, clip = record_path(directory, cut), clip_path(directory, cut)
    if not path.is_file() or not clip.is_file():
        return None
    record = load_json(path)
    key = str(record.get('sha256') or sha256_file(clip))[:12]
    folder = history_dir(directory)
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copy2(clip, folder / f'{cut}.{key}.mp4')
    shutil.copy2(path, folder / f'{cut}.{key}.json')
    return folder / f'{cut}.{key}.mp4'


def approved_baseline(directory: Path, cut: str, gates: dict | None):
    """(record, clip) of the newest earlier proof of this cut he approved (a press bound to its sha256), or (None, None), read
    from proof/history (archive_previous keeps each proof there before a new one replaces it). With no gates read (offline),
    the newest earlier proof stands as the baseline: comparing is then asked, never skipped."""
    from .gates import for_hash  # noqa: PLC0415
    rows = []
    for rec_file in sorted(history_dir(directory).glob(f'{cut}.*.json')) if history_dir(directory).is_dir() else []:
        record = load_json(rec_file)
        clip = rec_file.with_suffix('.mp4')
        if clip.is_file():
            rows.append((record, clip))
    rows.sort(key=lambda row: row[1].stat().st_mtime)
    for record, clip in reversed(rows):
        if gates is None:
            return record, clip
        press = for_hash(gates, 'proof', record.get('sha256'), cut)
        if press is not None and press.get('verdict') == 'approve':
            return record, clip
    return None, None


def changed_since(old: dict, spec: dict) -> list[str]:
    """Why the new proof must be compared to the approved one: the engine or an asset differs from the one it was approved on.
    A proof made before these hashes were recorded cannot say, so that is asked too."""
    now = stamp(spec)
    out = []
    if not old.get('engine_sha256'):
        out.append('the approved proof recorded no engine hash, so what changed since cannot be told')
    elif old['engine_sha256'] != now['engine_sha256']:
        out.append('the engine changed since the proof he approved')
    before = old.get('assets_sha256')
    if before is None:
        out.append('the approved proof recorded no asset hashes')
    else:
        names = sorted(n for n in set(before) | set(now['assets_sha256']) if before.get(n) != now['assets_sha256'].get(n))
        if names:
            out.append(f"an asset changed since the proof he approved ({', '.join(names[:4])}{' and more' if len(names) > 4 else ''})")
    return out


def compare_sheet(old_clip: Path, new_clip: Path, out: Path, old_s: float, new_s: float, rules: dict | None = None) -> dict:
    """A sheet of the same moments: the approved proof's frames in the top row, the new proof's below, each at the same
    seconds into its clip. Returns {sheet, sha256, seconds}."""
    import numpy as np  # noqa: PLC0415
    from PIL import Image, ImageDraw  # noqa: PLC0415
    from .plainframes import config as plain_config  # noqa: PLC0415
    from .qc_faces import frame_at  # noqa: PLC0415
    spec = (rules or plain_config())['compare']
    n, tw = spec['frames'], spec['thumb_width']
    span = max(0.2, min(old_s, new_s))
    seconds = [round(span * (i + 0.5) / n, 2) for i in range(n)]
    th = round(tw * 16 / 9)
    sheet = Image.new('RGB', (tw * n, th * 2 + 40), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)
    for row, (clip, label) in enumerate(((old_clip, 'APPROVED'), (new_clip, 'NEW'))):
        y = row * (th + 20) + 20 * row
        draw.text((6, y + 2), label, fill=(255, 255, 255))
        for i, t in enumerate(seconds):
            frame = frame_at(str(clip), round(t * 30), 30, (tw, th))
            sheet.paste(Image.fromarray(np.asarray(frame, dtype=np.uint8)), (i * tw, y + 16))
            draw.text((i * tw + 4, y + 18), f'{t}s', fill=(255, 255, 0))
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    return {'sheet': out.name, 'sha256': sha256_file(out), 'seconds': seconds}


def sendable_problems(record: dict) -> list[str]:
    """Why this proof must not be sent to Krish yet, or []: its rendered frames fail a guard, or it has not been compared
    with the proof he approved."""
    out = []
    frames = record.get('frames') or {}
    if frames.get('status') == 'not_run' and os.environ.get('VE_FRAMES_OFFLINE') != '1':  # the offline switch is for tests, like VE_GATES_OFFLINE
        out.append(f"the frame guards did not run ({frames.get('reason')}): run ve proof again where the frames can be read")
    for problem in (frames.get('problems') or [])[:5]:
        out.append(f"the rendered frames fail: {problem.get('says')}")
    title = record.get('title')
    if title and not (title.get('looked') or {}).get('text'):
        where = f"proof/{title['clip']}" if title.get('clip') else f"the title in proof/{record.get('cut')}.mp4"
        out.append(f"nobody has looked at the title frame: open {where} at full size, then record it with "
                   f've proof <spec> --cut <cut> --title-looked "what you saw"')
    compare = record.get('compare')
    if compare and not compare.get('sheet'):
        out.append(f"the comparison sheet could not be made ({compare.get('error')}): run ve proof again where the frames can be read")
    elif compare and not compare.get('compared'):
        out.append(f"it has not been compared with the proof he approved ({'; '.join(compare.get('reasons') or [])}): open every frame of "
                   f"proof/{compare.get('sheet')} at full size beside his standing notes for the piece, then record it with "
                   f've proof <spec> --cut <cut> --compared "what you looked at and found"')
    return out


def record_compared(directory: Path, cut: str, text: str, now: str, rules: dict | None = None) -> dict:
    """Record what the session compared. Refused when nothing needs comparing, when the sheet is gone or not the one
    recorded, or when the words are too few to say what was looked at."""
    from .plainframes import config as plain_config  # noqa: PLC0415
    spec = (rules or plain_config())['compare']
    path = record_path(directory, cut)
    if not path.is_file():
        raise ValueError(f'no proof record for {cut}: run ve proof first')
    record = load_json(path)
    compare = record.get('compare')
    if not compare:
        raise ValueError('nothing to compare: this proof has no approved proof to be compared with')
    sheet = path.parent / compare['sheet']
    if not sheet.is_file() or sha256_file(sheet) != compare.get('sha256'):
        raise ValueError(f"the comparison sheet proof/{compare['sheet']} is missing or is not the one recorded: run ve proof again")
    if len(str(text).split()) < spec['min_words']:
        raise ValueError(f"say what you looked at and found, in at least {spec['min_words']} words (every beat change, at full size, "
                         "beside his standing notes)")
    compare['compared'] = {'text': str(text).strip()[:1000], 'at': now}
    record['sendable'] = not sendable_problems(record)
    write_json(path, record)
    return record
