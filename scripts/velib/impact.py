"""Impact zoom: a slow, small push onto his face on the most impactful word of a line, then a release.

Krish, 2026-11-26: "Can you make sure that on the most impactful words in any video, there's some form of camera zooming
to emulate a world-class professional? Zoom for impact. We should bake in all the obvious edge cases and have it be
classy and subtle rather than too aggressive."

Every number is a row of config/ve/impact-zoom.json. compile plans the pushes here (`plan`) and writes them to
props.impact; the renderer draws them on the take layer only (apps/renderer/src/engine/kit/impact.ts, the same curves as
`scale_at`), so the captions, the graphics and the frame never move with it. `problems` is the QC that measures the
compiled props (ve qc camera.impact, and compile itself): the scale, its rate, the spacing and the beats it lands on.

Which words: the cut's captions.emphasis and the caption kit's hero words (a number, a reversal, a content word), lifted
on the hook and the why-ladder's landing, never a stop word, the best one on a caption page, one kept of any within
merge_within_s. A spec pins its own (cuts.<cut>.impact: [{at_w, strength}]) or turns them off (impact_off); a pin that
breaks a hard rule is refused, never quietly dropped. A cut where no word qualifies gets none.

Where never: b-roll, WINDOW, SPLIT, a staged beat, a screen recording, a graphic or plate beat, across a picture cut, with
another camera move (MOTION-FLOOR F6) or a device event, through a transition, the title moment or the end card, the
first cut_start_s and last cut_end_s of the cut, on a word the aligners are unsure of or a fumbled or retaken word, on a
take that is not the one speaking, on a face the track does not hold steadily, or past the take's own resolution.
"""
from __future__ import annotations

import math
import re

from .common import ROOT, load_json

CONFIG = ROOT / 'config' / 've' / 'impact-zoom.json'
KRISH = 'Krish, 2026-11-26: "Zoom for impact ... classy and subtle rather than too aggressive."'


def load() -> dict:
    return load_json(CONFIG)


# ------------------------------------------------------------------------------------------------------------ curves

def ease(name: str, t: float) -> float:
    """The two curves the renderer draws (kit/impact.ts EASES): the push eases out, the release eases in and out."""
    t = min(1.0, max(0.0, t))
    if name == 'easeOutCubic':
        return 1 - (1 - t) ** 3
    if name == 'easeInOutCubic':
        return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2
    raise ValueError(f'impact ease {name} is not easeOutCubic or easeInOutCubic')


def scale_at(impact: dict | None, frame: int) -> float:
    """His take's scale on `frame` (1.0 outside every hit). kit/impact.ts impactAt draws the same numbers."""
    for hit in (impact or {}).get('hits') or []:
        if not hit['fromFrame'] <= frame < hit['toFrame']:
            continue
        peak = hit['scale']
        if frame < hit['peakFrame']:
            t = (frame - hit['fromFrame']) / max(1, hit['peakFrame'] - hit['fromFrame'])
            return 1 + (peak - 1) * ease(impact.get('pushEase', 'easeOutCubic'), t)
        if frame < hit['holdTo'] or hit['release'] == 'cut':
            return peak
        t = (frame - hit['holdTo']) / max(1, hit['toFrame'] - hit['holdTo'])
        return peak - (peak - 1) * ease(impact.get('releaseEase', 'easeInOutCubic'), t)
    return 1.0


def hit_at(impact: dict | None, frame: int) -> dict | None:
    return next((h for h in (impact or {}).get('hits') or [] if h['fromFrame'] <= frame < h['toFrame']), None)


# ------------------------------------------------------------------------------------------------------------ words

def token(text: str) -> str:
    return re.sub(r"[^\w']", '', str(text).lower().replace('’', "'"))


def _clean(text: str) -> str:
    return re.sub(r'[,.;:]+$', '', str(text))   # captions/kit.ts clean


def hero_score(text: str, emphasised: bool, cfg: dict) -> int:
    """captions/kit.ts heroScore, read from the config's lists: +5 for a number, +2 for a content word of four letters or
    more, +5 for a reversal, +2 for the page's emphasis, +1 when short enough to hold, -3 for a stop word."""
    words = cfg['words']
    raw = _clean(text)
    w = raw.lower()
    stop = set(words['stop'])
    reversal = w.endswith(words['reversal_suffix']) or w in set(words['reversal'])
    score = 0
    is_stop = w in stop
    if re.search(r'\d', raw):
        score += 5
    elif not is_stop and len(w) >= 4:
        score += 2
    if reversal:
        score += 5
    if emphasised:
        score += 2
    if len(raw) <= 10:
        score += 1
    if is_stop and not reversal:
        score -= 3
    return score


def confidence(word: dict, cfg: dict) -> str:
    """'agreed' (both aligners within agree_within_s), 'scored' (aligner score at least score_min), 'low', or 'unrated'
    (a plain words file that says nothing about how sure the aligner was)."""
    a = cfg['alignment']
    rated = False
    if word.get('b_onset_s') is not None:
        rated = True
        if abs(float(word['b_onset_s']) - float(word['onset_s'])) <= a['agree_within_s']:
            return 'agreed'
    if isinstance(word.get('score'), (int, float)) and not isinstance(word.get('score'), bool):
        rated = True
        if word['score'] >= a['score_min']:
            return 'scored'
    return 'low' if rated else 'unrated'


# ------------------------------------------------------------------------------------------------------------ geometry

def safe_zoom(take_frame: dict | None, box: tuple, lift: float, quality_floor: float) -> float | None:
    """The most the take may be pushed before one source pixel covers more than 1 / quality_floor output pixels: the
    virtual camera's maximumSafeZoom (packages/core/src/virtual-camera.ts), with his take drawn into `box` by cover and
    `lift`. None when the take's size is unknown, so nothing can prove the push stays sharp."""
    tw, th = ((take_frame or {}).get('width'), (take_frame or {}).get('height'))
    if not tw or not th:
        return None
    cover = max(box[2] / tw, box[3] / th) * lift
    return 1 / (cover * quality_floor)


def _face_in_frame(norm: list[float], box: tuple, take_frame: dict | None, lift: float) -> tuple[float, float, float, float]:
    from . import keepout  # noqa: PLC0415
    x, y, w, h = keepout.to_frame(norm, box, take_frame, lift, margin=0.0)
    return x, y, w, h


def scaled_box(face: tuple, origin: tuple, scale: float) -> tuple[float, float, float, float]:
    x, y, w, h = face
    ox, oy = origin
    return ox + (x - ox) * scale, oy + (y - oy) * scale, w * scale, h * scale


def _overlaps(a, b) -> bool:
    return min(a[0] + a[2], b[0] + b[2]) > max(a[0], b[0]) and min(a[1] + a[3], b[1] + b[3]) > max(a[1], b[1])


# ------------------------------------------------------------------------------------------------------------ the plan

class _Cut:
    """What the planner reads of one compiled cut, once."""

    def __init__(self, spec, cut_id, rows, words, props, edl, faces, take_frame, fps, cfg):
        from . import keepout  # noqa: PLC0415
        self.spec, self.cut_id, self.rows, self.words, self.props = spec, cut_id, rows, words, props
        self.edl, self.faces, self.take_frame, self.fps, self.cfg = edl, faces or {}, take_frame, fps, cfg
        self.aspect = props['aspect']
        self.frame_size = keepout.FRAME[self.aspect]
        self.mode = (props.get('layout') or {}).get('mode')
        self.spec_beats = {b['id']: b for b in spec['cuts'][cut_id]['beats']}
        self.cut_take = spec['cuts'][cut_id].get('take')
        self.end = (props.get('ending') or {}).get('fromFrame', props['durationFrames'])
        self.joins = sorted({round(float(j['at_s']) * fps) for j in (edl or {}).get('joins') or []})
        self.ambient = ((props.get('ingredients') or {}).get('camera') or 'none')
        self.events = sorted(e['atFrame'] for e in props.get('events') or [])
        title = props.get('titleMoment')
        self.title = (title['fromFrame'], title['toFrame']) if title else None
        self.lift = keepout.FACE_LIFT if self.aspect == '9:16' and not self.cropped() else 1.0
        self.suspect = self._suspect_rows()

    def s(self, seconds: float) -> int:
        return round(seconds * self.fps)

    def cropped(self) -> bool:
        return any(seg.get('crop') for seg in self.props.get('segments') or [])

    def beat_at(self, frame):
        return next((b for b in self.props['beats'] if b['fromFrame'] <= frame < b['toFrame']), None)

    def take_full_frame(self, beat) -> str | None:
        """Why this beat may not carry a push, None when it may: it shows his own take full frame, nothing drawn over it."""
        from . import keepout  # noqa: PLC0415
        b = self.cfg['beats']
        source = self.spec_beats.get(beat['id'], beat)
        if beat['layout'] in b['ban_layouts']:
            return f'a {beat["layout"]} beat'
        if self.mode in b['ban_staging_modes']:
            return f'a staged beat (his take in the {self.mode} staging\'s box)'
        if source.get('shot') and source['shot'] not in b['allow_shots']:
            return f'a {source["shot"]} shot'
        if beat.get('backdrop') or source.get('backdrop'):
            return 'a beat over b-roll'
        plate = (beat.get('plate') or {}).get('source', 'take')
        if plate != 'take':
            return 'a plate beat (b-roll or a picture, not his take)'
        devices = [(self._objects().get(u) or {}).get('device') for u in beat.get('uses') or []]
        drawn = [d for d in devices if d not in b['allow_devices']]
        if drawn:
            return f'a graphic beat ({", ".join(sorted(set(str(d) for d in drawn)))} over his take)'
        box = keepout.take_box(self.mode, self.aspect, source)
        if box != (0, 0) + self.frame_size:
            return 'a beat that does not show his take full frame'
        return None

    def _objects(self):
        if not hasattr(self, '_objs'):
            self._objs = {o['obj']: o for o in self.props.get('objects') or []}
        return self._objs

    def picture_take(self, seconds: float) -> str | None:
        if not self.edl:
            return self.cut_take
        for seg in self.edl.get('segments') or []:
            if seg['out_in_s'] - 1e-6 <= seconds < seg.get('out_out_s', math.inf):
                return seg['take']
        return None

    def _suspect_rows(self) -> set:
        """Rows that sounded wrong (a fumble), or sit within disfluency_guard_s of an unscripted sound the cut keeps, or of a
        join (where a retake was spliced in)."""
        from . import keepout  # noqa: PLC0415
        out = set()
        if not self.edl:
            return out
        guard = self.cfg['edges']['disfluency_guard_s']
        onsets = [(i, float(w['onset_s'])) for i, w in enumerate(self.words)]
        for row in self.edl.get('sounded_wrong') or []:
            for t in keepout.cut_times(float(row['src_s']), row['take'], self.edl, self.cut_take):
                out |= {i for i, onset in onsets if abs(onset - t) <= 0.08}
        for row in self.edl.get('unscripted_kept') or []:
            for t in keepout.cut_times(float(row['src_s']), row['take'], self.edl, self.cut_take):
                out |= {i for i, onset in onsets if abs(onset - t) <= guard}
        for frame in self.joins:
            out |= {i for i, onset in onsets if 0 <= onset - frame / self.fps <= guard}
        return out

    def face(self, take: str, a: int, b: int):
        """(median face box in the frame, coverage, drift) for frames [a, b) of the cut, or None with no samples."""
        from . import faceflags, keepout  # noqa: PLC0415
        samples = []
        for sample in self.faces.get(take) or []:
            for t in keepout.cut_times(float(sample['t']), take, self.edl, self.cut_take):
                if a <= round(t * self.fps) < b and sample.get('box'):
                    samples.append(sample['box'])
        if not samples:
            return None
        expected = max(1, math.floor((b - a) / self.fps / faceflags.EVERY_S))
        coverage = min(1.0, len(samples) / expected)
        median = [sorted(s[k] for s in samples)[len(samples) // 2] for k in range(4)]
        cx = [s[0] + s[2] / 2 for s in samples]
        cy = [s[1] + s[3] / 2 for s in samples]
        drift = max(max(cx) - min(cx), max(cy) - min(cy)) / max(median[2], 1e-6)
        return median, coverage, drift

    def pages_in(self, a: int, b: int):
        return [p for p in self.props.get('captions') or [] if p['fromFrame'] < b and p['toFrame'] > a]


def _phrase_end(cut: _Cut, index: int) -> float:
    """Where the phrase the word sits in ends: its own end, or the next word ending on a pause, within its caption page."""
    page = next((p for p in cut.props.get('captions') or [] if p['fromFrame'] <= cut.rows[index]['atFrame'] < p['toFrame']), None)
    end = cut.rows[index]['end_s']
    for row in cut.rows[index:]:
        if page and row['atFrame'] >= page['toFrame']:
            break
        end = row['end_s']
        if re.search(r'[,.!?;:]["\')’”]*$', row['text']):
            break
    return end


def window(cut: _Cut, index: int, strength: str, *, pinned: bool = False) -> tuple[dict | None, str | None]:
    """The push on rows[index], or (None, why not)."""
    cfg, fps = cut.cfg, cut.fps
    row, word = cut.rows[index], cut.words[index]
    if str(row['text']).startswith('<') or index in cut.suspect:
        return None, 'a fumbled, unscripted or retaken word'
    rated = confidence(word, cfg)
    if rated == 'low' or (rated == 'unrated' and not pinned and not cfg['alignment']['unrated_auto']):
        return None, f'the aligners are not sure of it ({rated})'
    start = row['atFrame']
    if cut.ambient in cfg['beats']['ambient_cameras_block']:
        return None, f'the cut already moves its camera ({cut.ambient}): one camera move at a time (MOTION-FLOOR F6)'
    if any(b['layout'] == 'WINDOW' for b in cut.props['beats']):
        return None, 'the cut moves his take into a window: one camera move at a time (MOTION-FLOOR F6)'
    if cut.cropped():
        return None, 'his take is cropped (segment.crop): the face keep-out cannot place his face yet'
    if start < cut.s(cfg['edges']['cut_start_s']):
        return None, f'inside the first {cfg["edges"]["cut_start_s"]} s of the cut'
    beat = cut.beat_at(start)
    if beat is None:
        return None, 'on no beat'
    why = cut.take_full_frame(beat)
    if why:
        return None, why
    if cut.title and cut.title[0] - cut.s(cfg['edges']['event_guard_s']) <= start < cut.title[1]:
        return None, 'on the title moment'
    guard = cut.s(cfg['edges']['event_guard_s'])
    if any(start - guard <= e <= start for e in cut.events):
        return None, 'on a device event (an ingredient hit)'
    take = cut.picture_take(word.get('onset_s', start / fps))
    if word.get('take') and take and word['take'] != take:
        return None, 'the picture is not on the take that is speaking'
    if take is None or not cut.faces.get(take):
        return None, 'no face track for the take on screen'
    asset = next((a for a in cut.spec.get('assets') or [] if a.get('id') == take), {})
    if str(asset.get('speaker') or asset.get('role') or 'krish').lower() not in ('krish', 'host'):
        return None, 'a guest\'s take: only the active speaker\'s face is pushed, and the speaker is not known'

    timing = cfg['timing']
    push, hold_min, hold_max, release = (max(1, cut.s(timing['push_s'])), cut.s(timing['hold_min_s']),
                                         cut.s(timing['hold_max_s']), max(1, cut.s(timing['release_s'])))
    peak = start + push
    want_hold = min(peak + hold_max, max(peak + hold_min, math.ceil(_phrase_end(cut, index) * fps)))
    # The next frame the push may not run past, and whether a picture cut there hides a reset.
    limits = [(cut.end - cut.s(cfg['edges']['cut_end_s']), False)]
    if cut.title and cut.title[0] > start:
        limits.append((cut.title[0] - guard, False))
    limits += [(e - guard, False) for e in cut.events if e > start]
    limits += [(j, True) for j in cut.joins if j > start]
    beats = cut.props['beats']
    after = next((b for b in beats if b['fromFrame'] == beat['toFrame']), None)
    tguard = cut.s(cfg['edges']['transition_guard_s'])
    plain_cut = beat.get('transitionOut', 'cut') == 'cut' and (cut.props.get('ingredients') or {}).get('transition', 'cut') == 'cut'
    hidden = plain_cut and after is not None and cut.take_full_frame(after) is not None
    limits.append((beat['toFrame'] - (0 if plain_cut else tguard), hidden))
    limit, hidden_at = min(limits, key=lambda item: (item[0], not item[1]))
    if peak + hold_min > limit:
        return None, 'too close to a cut, a transition, an event, the title or the end card to push and hold'
    if want_hold + release <= limit:
        hold_to, to, mode = want_hold, want_hold + release, 'ease'
    elif hidden_at:
        hold_to = to = limit
        mode = 'cut'
    elif peak + hold_min + release <= limit:
        hold_to = limit - release
        to, mode = limit, 'ease'
    else:
        return None, 'no room to release before the next cut, transition, event, title or end card'
    if strength not in ('normal', 'strong'):
        return None, f'strength {strength} is not normal or strong'

    track = cut.face(take, start, to)
    if track is None:
        return None, 'the face track does not see him through the push'
    norm, coverage, drift = track
    if coverage < cfg['face']['min_coverage']:
        return None, f'the face track sees him on {coverage:.0%} of the push (low confidence)'
    if drift > cfg['face']['max_drift']:
        return None, f'his face moves {drift:.0%} of its width through the push'
    box = (0, 0) + cut.frame_size
    target = cfg['scale']['strong_to' if strength == 'strong' else 'push_to'][cut.aspect]
    safe = safe_zoom(cut.take_frame, box, cut.lift, cfg['face']['quality_floor'])
    if safe is None:
        return None, 'the take\'s size is unknown, so the push cannot be proved sharp'
    scale = round(min(target, safe, cfg['scale']['hard_cap']), 4)
    if scale < cfg['scale']['min_effective']:
        return None, f'the take has no headroom to push without upscaling ({safe:.3f} at the quality floor)'
    fx, fy, fw, fh = _face_in_frame(norm, box, cut.take_frame, cut.lift)
    if fw <= 0 or fh <= 0:
        return None, 'his face is outside the frame'
    origin = (round(fx + fw / 2, 1), round(fy + fh * cfg['face']['eye_from_top'], 1))
    grown = scaled_box((fx, fy, fw, fh), origin, scale)
    m = cfg['face']['face_margin']
    kept = (grown[0] - grown[2] * m, grown[1] - grown[3] * m, grown[2] * (1 + 2 * m), grown[3] * (1 + 2 * m))
    from . import keepout  # noqa: PLC0415
    for page in cut.pages_in(start, to):
        if _overlaps(keepout.caption_box(cut.props, page, beat), kept):
            return None, 'the pushed face would meet a caption'
    return {'w': row['w'], 'word': row['text'], 'fromFrame': start, 'peakFrame': peak, 'holdTo': hold_to, 'toFrame': to,
            'scale': scale, 'strength': strength, 'release': mode, 'originX': origin[0], 'originY': origin[1],
            'eyeLine': round(origin[1] / box[3], 3)}, None


def _per_minute(hits: list[dict], fps: int, cap: int) -> bool:
    starts = sorted(h['fromFrame'] for h in hits)
    return all(sum(1 for t in starts if s <= t < s + 60 * fps) <= cap for s in starts)


def _fits(hit: dict, accepted: list[dict], cut: _Cut) -> bool:
    gap = cut.s(cut.cfg['spacing']['min_gap_s'])
    for other in accepted:
        if abs(hit['fromFrame'] - other['fromFrame']) < gap:
            return False
        first, second = sorted((hit, other), key=lambda h: h['fromFrame'])
        if second['fromFrame'] < first['toFrame']:
            return False
    return _per_minute(accepted + [hit], cut.fps, cut.cfg['spacing']['per_minute'][cut.aspect])


def plan(spec: dict, cut_id: str, rows: list[dict], words: list[dict], props: dict, *, edl: dict | None = None,
         faces: dict | None = None, take_frame: dict | None = None, fps: int = 30, cfg: dict | None = None,
         report: dict | None = None) -> dict | None:
    """props.impact for this cut ({'pushEase', 'releaseEase', 'joins', 'hits'}), or None when no word earns a push. Raises
    when a pinned impact breaks a hard rule."""
    cfg = cfg or load()
    spec_cut = spec['cuts'][cut_id]
    out_report = {'hits': 0, 'skipped': {}}
    if report is not None:
        report['impact'] = out_report
    if spec_cut.get('impact_off'):
        out_report['off'] = True
        return None
    cut = _Cut(spec, cut_id, rows, words, props, edl, faces, take_frame, fps, cfg)
    by_w = {row['w']: i for i, row in enumerate(rows)}
    pins = spec_cut.get('impact') or []
    accepted: list[dict] = []
    if pins:
        for pin in pins:
            if pin['at_w'] not in by_w:
                raise ValueError(f'cuts.{cut_id}.impact: word {pin["at_w"]} is not in the cut')
            hit, why = window(cut, by_w[pin['at_w']], pin.get('strength', 'normal'), pinned=True)
            if hit is None:
                raise ValueError(f'cuts.{cut_id}.impact at_w {pin["at_w"]} ("{rows[by_w[pin["at_w"]]]["text"]}"): no push here, '
                                 f'{why} ({KRISH})')
            if not _fits(hit, accepted, cut):
                raise ValueError(f'cuts.{cut_id}.impact at_w {pin["at_w"]}: closer than {cfg["spacing"]["min_gap_s"]} s to another '
                                 f'push, over a push that has not released, or past {cfg["spacing"]["per_minute"][cut.aspect]} '
                                 'a minute')
            accepted.append(hit)
        if sum(h['strength'] == 'strong' for h in accepted) > 1:
            raise ValueError(f'cuts.{cut_id}.impact: one strong push a cut, on its single biggest word')
    else:
        accepted = _auto(cut, out_report)
    accepted.sort(key=lambda h: h['fromFrame'])
    out_report['hits'] = len(accepted)
    out_report['words'] = [h['word'] for h in accepted]
    if not accepted:
        return None
    return {'pushEase': cfg['timing']['push_ease'], 'releaseEase': cfg['timing']['release_ease'], 'joins': cut.joins,
            'hits': accepted}


def _auto(cut: _Cut, report: dict) -> list[dict]:
    cfg = cut.cfg
    w = cfg['words']
    emphasis = set(cut.spec['cuts'][cut.cut_id]['captions'].get('emphasis') or [])
    beats = cut.spec['cuts'][cut.cut_id]['beats']
    hook = beats[0]['span'] if beats else None
    landings = [b['span'] for b in beats if b.get('landing')]
    stop = set(w['stop'])
    pages = cut.props.get('captions') or []
    best: dict[int, tuple[int, int]] = {}   # page -> (score, row index)
    for i, row in enumerate(cut.rows):
        page = next((k for k, p in enumerate(pages) if p['fromFrame'] <= row['atFrame'] < p['toFrame']), None)
        if page is None or token(row['text']) in stop or not token(row['text']):
            continue
        emphasised = row['w'] in emphasis
        score = hero_score(row['text'], emphasised, cfg)
        if hook and hook['from_w'] <= row['w'] <= hook['to_w']:
            score += w['hook_bonus']
        if any(s['from_w'] <= row['w'] <= s['to_w'] for s in landings):
            score += w['landing_bonus']
        if not emphasised and score < w['min_score']:
            continue
        if page not in best or score >= best[page][0]:
            best[page] = (score, i)
    found = []
    for score, i in best.values():
        hit, why = window(cut, i, 'normal')
        if hit is None:
            report['skipped'][why] = report['skipped'].get(why, 0) + 1
            continue
        found.append((score, hit, i))
    # One of any run of candidates within merge_within_s: the best, the later on a tie.
    merged = []
    for score, hit, i in sorted(found, key=lambda item: item[1]['fromFrame']):
        if merged and hit['fromFrame'] - merged[-1][1]['fromFrame'] < cut.s(cfg['spacing']['merge_within_s']):
            if score >= merged[-1][0]:
                merged[-1] = (score, hit, i)
            continue
        merged.append((score, hit, i))
    accepted = []
    for score, hit, i in sorted(merged, key=lambda item: (-item[0], -item[1]['fromFrame'])):
        if _fits(hit, [h for _s, h, _i in accepted], cut):
            accepted.append((score, hit, i))
    if accepted:
        score, hit, i = accepted[0]
        if score >= w['strong_min_score']:
            strong, _why = window(cut, i, 'strong')
            if strong is not None and strong['scale'] > hit['scale']:
                accepted[0] = (score, strong, i)
    return [h for _s, h, _i in accepted]


# ------------------------------------------------------------------------------------------------------------ lint

def spec_lints(spec: dict) -> list[str]:
    """ve lint's impact rows: a pinned push names a word the cut says, on a beat that may carry one."""
    cfg = load()
    out = []
    devices = {o['obj']: o.get('device') for o in spec.get('objects') or []}
    for cut_id, cut in (spec.get('cuts') or {}).items():
        pins = cut.get('impact') or []
        if pins and cut.get('impact_off'):
            out.append(f'impact cuts.{cut_id}: pins impact pushes and turns them off')
        for pin in pins:
            beat = next((b for b in cut.get('beats') or [] if b['span']['from_w'] <= pin['at_w'] <= b['span']['to_w']), None)
            where = f'impact cuts.{cut_id}.impact at_w {pin["at_w"]}'
            if beat is None:
                out.append(f"{where}: the word is on none of the cut's beats")
                continue
            b = cfg['beats']
            source = (beat.get('plate') or {}).get('source', 'take')
            why = ('a ' + beat['layout'] + ' beat' if beat['layout'] in b['ban_layouts'] else
                   f'a {beat["shot"]} shot' if beat.get('shot') and beat['shot'] not in b['allow_shots'] else
                   'a beat over b-roll' if beat.get('backdrop') or source != 'take' else
                   'a graphic beat' if any(devices.get(u) not in b['allow_devices'] for u in beat.get('uses') or []) else
                   'a beat his face is off' if beat.get('face') in ('off', 'window') else None)
            if why:
                out.append(f'{where}: on beat {beat["id"]}, {why}, which never carries an impact push ({KRISH})')
    return out


# ------------------------------------------------------------------------------------------------------------ QC

def problems(props: dict, cfg: dict | None = None, *, fps: int | None = None) -> list[str]:
    """camera.impact: what the compiled props' pushes break, [] when nothing. Measures the scale on every frame of every
    push, its rate, the spacing, and the beats, events, title and end card each one meets."""
    impact = props.get('impact')
    if not impact:
        return []
    cfg = cfg or load()
    fps = fps or props.get('fps', 30)
    aspect = props['aspect']
    out = []
    hits = sorted(impact.get('hits') or [], key=lambda h: h['fromFrame'])
    cap = min(cfg['scale']['hard_cap'], cfg['scale']['library_cap'])
    ceiling = cfg['scale']['strong_to'][aspect]
    end = (props.get('ending') or {}).get('fromFrame', props['durationFrames'])
    title = props.get('titleMoment')
    events = [e['atFrame'] for e in props.get('events') or []]
    guard = round(cfg['edges']['event_guard_s'] * fps)
    beats = props['beats']
    edges = {b['fromFrame'] for b in beats} | set(impact.get('joins') or [])
    ambient = (props.get('ingredients') or {}).get('camera') or 'none'
    devices = {o['obj']: o.get('device') for o in props.get('objects') or []}
    if hits and ambient in cfg['beats']['ambient_cameras_block']:
        out.append(f'camera.impact: the cut moves its camera ({ambient}) and pushes for impact too (MOTION-FLOOR F6)')
    if sum(h.get('strength') == 'strong' for h in hits) > 1:
        out.append('camera.impact: more than one strong push in the cut')
    for h in hits:
        at = f'camera.impact frame {h["fromFrame"]} ("{h.get("word", "")}")'
        if not (h['fromFrame'] < h['peakFrame'] <= h['holdTo'] <= h['toFrame']):
            out.append(f'{at}: its frames are out of order')
            continue
        if not 1 < h['scale'] <= min(cap, ceiling):
            out.append(f'{at}: scale {h["scale"]} is past the cap ({min(cap, ceiling)})')
        frames = range(h['fromFrame'], h['toFrame'] + 1)
        curve = [scale_at(impact, f) for f in frames]
        steps = [abs(b - a) * fps for a, b in zip(curve, curve[1:])][:-1] if h['release'] == 'cut' else \
            [abs(b - a) * fps for a, b in zip(curve, curve[1:])]
        if steps and max(steps) > cfg['timing']['max_rate_per_s'] + 1e-9:
            out.append(f'{at}: the push moves {max(steps):.2f} a second, past {cfg["timing"]["max_rate_per_s"]} (a punch, not a push)')
        if h['holdTo'] - h['peakFrame'] < round(cfg['timing']['hold_min_s'] * fps) - 1 and h['release'] == 'ease':
            out.append(f'{at}: held {h["holdTo"] - h["peakFrame"]} frames, under {cfg["timing"]["hold_min_s"]} s')
        if h['release'] == 'cut' and h['toFrame'] not in edges:
            out.append(f'{at}: resets at frame {h["toFrame"]}, which is no picture cut')
        if h['fromFrame'] < round(cfg['edges']['cut_start_s'] * fps) or h['toFrame'] > end - round(cfg['edges']['cut_end_s'] * fps):
            out.append(f'{at}: inside the cut\'s first {cfg["edges"]["cut_start_s"]} s, its last {cfg["edges"]["cut_end_s"]} s or the end card')
        beat = next((b for b in beats if b['fromFrame'] <= h['fromFrame'] < b['toFrame']), None)
        if beat is None or h['toFrame'] > beat['toFrame']:
            out.append(f'{at}: runs across a beat change')
        elif beat['layout'] in cfg['beats']['ban_layouts'] or beat.get('backdrop') or \
                (beat.get('plate') or {}).get('source', 'take') != 'take' or                 any(devices.get(u) not in cfg['beats']['allow_devices'] for u in beat.get('uses') or []) or \
                ((props.get('layout') or {}).get('mode') in cfg['beats']['ban_staging_modes']) or \
                (beat.get('shot') and beat['shot'] not in cfg['beats']['allow_shots']):
            out.append(f'{at}: on beat {beat["id"]}, which is not his take full frame with nothing over it')
        if any(h['fromFrame'] < j < h['toFrame'] for j in impact.get('joins') or []):
            out.append(f'{at}: runs across a picture cut')
        if any(h['fromFrame'] - guard <= e < h['toFrame'] + guard for e in events):
            out.append(f'{at}: meets a device event (an ingredient hit)')
        if title and h['fromFrame'] < title['toFrame'] and h['toFrame'] > title['fromFrame'] - guard:
            out.append(f'{at}: meets the title moment')
    gap = round(cfg['spacing']['min_gap_s'] * fps)
    for a, b in zip(hits, hits[1:]):
        if b['fromFrame'] - a['fromFrame'] < gap:
            out.append(f'camera.impact frames {a["fromFrame"]} and {b["fromFrame"]}: closer than {cfg["spacing"]["min_gap_s"]} s')
        if b['fromFrame'] < a['toFrame']:
            out.append(f'camera.impact frame {b["fromFrame"]}: pushes again before the push at {a["fromFrame"]} has released')
    if hits and not _per_minute(hits, fps, cfg['spacing']['per_minute'][aspect]):
        out.append(f'camera.impact: more than {cfg["spacing"]["per_minute"][aspect]} pushes in a minute')
    return out


def qc_row(props: dict | None) -> dict:
    """ve qc's camera.impact row from the cut's props."""
    target = 'pushes within the impact-zoom caps, spacing and beats (config/ve/impact-zoom.json)'
    if not props or not props.get('impact'):
        return {'value': {'hits': 0}, 'target': target, 'pass': None, 'status': 'not applicable'}
    found = problems(props)
    curve = [scale_at(props['impact'], f) for h in props['impact']['hits'] for f in range(h['fromFrame'], h['toFrame'])]
    return {'value': {'hits': len(props['impact']['hits']), 'max_scale': round(max(curve), 4), 'problems': found[:12]},
            'target': target, 'pass': not found}
