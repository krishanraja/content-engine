"""Compile a linted ProductionSpec to the renderer's single 30 fps clock.

assets_dir holds the cut-ready ``audio.<cut>.wav`` premix and recordings named
by cut.take (or the matching spec asset path). Brand source paths are resolved
under that directory too. Compilation describes assets; rendering checks them.
Word rows carry numeric w, onset_s and word (textual w is also accepted).
Every word needs a finite end_s at or after its onset.
"""
from __future__ import annotations

import math
import json
import re
import sys
from pathlib import Path, PureWindowsPath

from .common import ROOT, load_json
from .lint import pending_devices_error

FPS = 30
ENDING_FRAMES = 180  # the house close: 6 s, settled by 2.75 s then held (docs/production/CLOSING.md)
# The tall close is a compact end beat of 2 s inside the tall core box (config/brand-palette.json statement_beat;
# Ruling, Krish, 2026-11-12: "I approve the brand palette sheet, but only if it falls in line with the attached").
ENDING_FRAMES_BY_ASPECT = {'16:9': ENDING_FRAMES, '9:16': 60}
# Krish, 10 Nov 2026: "The copy should read: "Built to help you decide."" (the same words as quick-edit's kit TAGLINE).
ENDING_TAGLINE = 'Built to help you decide.'
ENDING_CTA = 'Subscribe free'
# The opening, under test (Krish, 29 Oct 2026: "I'd pick number one here but I think that we need to test and learn.
# We need to figure out what the right tone is over time based on real engagement. Let's go with number one for
# now."): the hook is the intro. The first beat owns frame 0 with the logo and the series tag in its corners, and no
# story card comes before it. Nothing goes in front of it on any cut (Ruling, Krish, 2026-11-12: "Nothing before the
# hook, ever. Remove the sting exception for good."): the house sting that opened the 16:9 whole cut of a weekly
# series piece from 5 Nov is retired, sting_props gives no cut one, and sting_problems refuses props that carry one.
# Each compile report records the opening it used ("hook"), so real engagement can still be read against it.
NOTHING_BEFORE_HOOK = 'Nothing before the hook, ever. Remove the sting exception for good.'
STING_ASPECT, STING_SHAPE = '16:9', '16x9'  # the long cut, and the name config/intro-sting.json gives its shape
STING_POSITION = 'after_hook'  # where compile lays the series sting (hook_end; config/brand-palette.json); ve lint reads it



def _series_day(series_day: str, publish_day: str | None) -> str:
    """The day the ending band and its strip name. A piece published on its series' own day keeps the series day
    ("Wednesdays"); one published on another day names that day ("Thursday"), so an off-day cut never claims the
    wrong day (Thursday 5 Nov's under.the.hood cut read WEDNESDAYS; Krish, 2026-11-03)."""
    if not publish_day:
        return series_day
    from datetime import date
    weekday = date.fromisoformat(publish_day).strftime('%A')
    return series_day if series_day.lower().rstrip('s') == weekday.lower() else weekday


def _intro():
    """scripts/quick-edit/intro.py: the one reader of config/intro-sting.json and of the clips it names, shared with
    quick-edit, so both engines open a cut on the same bytes."""
    folder = str(ROOT / 'scripts' / 'quick-edit')
    if folder not in sys.path:
        sys.path.append(folder)
    import intro  # noqa: PLC0415  scripts/quick-edit/intro.py
    return intro


def sting_props(cut: dict, channel: str, off: bool, report: dict | None = None) -> dict | None:
    """props.sting for this cut: None, for every cut (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove
    the sting exception for good."). From 5 Nov to 12 Nov the 16:9 whole cut of a weekly series piece opened on the
    house sting; config/intro-sting.json keeps that record, retired, and is no longer read to open a cut."""
    return None


def hook_end(props: dict) -> int:
    """The cut's own frame the series sting plays at: the frame after the hook's last, the end of beat 0 (config/
    brand-palette.json long_cut sting after_hook; SOCIAL-BEST-PRACTICES-2026 section 4.3, a brand sting follows the hook
    and never precedes it). The hook must run at least the opening gate's windows (config/opening-gate.json), so the gate
    measures his hook and never the sting, and no caption page may run across it; a page that ends on a later word is
    refused, and one that only holds into the sting is closed on the hook's last frame (props changed in place)."""
    beats = props['beats']
    if len(beats) < 2:
        raise ValueError('the series sting follows the hook, so the cut needs a beat after its hook (beat 0)')
    at = int(beats[0]['toFrame'])
    gate = load_json(ROOT / 'config' / 'opening-gate.json')
    need = math.ceil(max(float(gate['dead_window_s']), float(gate['headline_window_s'])) * FPS)
    if at < need:
        raise ValueError(f'the hook (beat {beats[0].get("id")}) runs {at} frames, and the sting follows it: a hook shorter than '
                         f'{need} frames would put the sting inside the opening the gate measures (config/opening-gate.json)')
    for page in props['captions']:
        if page['fromFrame'] < at < page['toFrame']:
            late = [w['text'] for w in page['words'] if w['atFrame'] >= at]
            if late:
                raise ValueError(f'the caption page at frame {page["fromFrame"]} runs across the end of the hook into '
                                 f'"{" ".join(late)}": end the hook beat on a caption page\'s end')
            page['toFrame'] = at
    return at


def sting_problems(props: dict) -> list[str]:
    """Why compiled props must not render for their opening ([] when it is right): anything in front of the hook, a
    sting or an episode card (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for
    good."); a sting after the hook that config/intro-sting.json does not approve (retired: none is) or that is not its
    clip; or a stem premixed for another sting or another place (ve premix lays his voice from frame 0, with the sting's
    frames of silence only where a sting after the hook plays)."""
    sting = props.get('sting')
    series = (props.get('series') or {}).get('label') or ''
    wide_whole = props.get('aspect') == STING_ASPECT and bool(props.get('ending')) and series not in ('', 'off.day')
    problems = []
    if sting or wide_whole:
        intro = _intro()
        channel = series.replace('.', '_')
        try:
            cfg = intro.load()
        except intro.IntroError as error:
            return [f'the intro sting\'s config cannot be read, so this cut\'s opening cannot be checked: {error}']
        wanted = (cfg['status'] == 'approved' and not cfg.get('paused') and STING_SHAPE in cfg['shapes']
                  and channel in cfg['series'])
        if not sting and wanted:
            problems.append(f'this wide cut of a {series} piece opens on the approved intro sting, and its props have none '
                            '(compiled before the approval): run ve compile again, then ve premix')
        if sting:
            entry = (cfg['clips'].get(STING_SHAPE) or {}).get(sting.get('series')) or {}
            if not wanted:
                problems.append(f'the props carry a sting, and config/intro-sting.json lays none (status {cfg["status"]}): nothing '
                                f'goes before the hook (Ruling, Krish, 2026-11-12: "{NOTHING_BEFORE_HOOK}"), and a sting after '
                                'it plays only once he approves one; run ve compile again')
            elif cfg.get('source_sha256') != intro.source_hash(cfg):
                problems.append('the clips config/intro-sting.json names are not the ones Krish approved (source_sha256)')
            elif not int(sting.get('atFrame') or 0):
                problems.append(f'the props carry a sting in front of the hook: nothing goes before the hook (Ruling, Krish, '
                                f'2026-11-12: "{NOTHING_BEFORE_HOOK}"); run ve compile again')
            elif sting.get('series') != channel or sting.get('sha256') != entry.get('sha256') or sting.get('frames') != cfg['frames']:
                problems.append(f'the props\' sting ({sting.get("series")}, {sting.get("frames")} frames, sha256 {sting.get("sha256")}) '
                                f'is not the approved {channel} clip ({cfg["frames"]} frames, sha256 {entry.get("sha256")}): '
                                'run ve compile again')
    if (props.get('opening') or {}).get('kind') == 'episode_card':
        problems.append(f'the props open on an episode card where the sting was: nothing goes before the hook (Ruling, Krish, '
                        f'2026-11-12: "{NOTHING_BEFORE_HOOK}"); run ve compile again')
    lead = int((sting or {}).get('frames') or 0)
    stem = (props.get('audio') or {}).get('stem') or {}
    sidecar = Path(stem['src']).with_suffix('.bed.json') if stem.get('src') else None
    if sidecar is not None and sidecar.is_file():
        side = load_json(sidecar)
        made, made_at = int(side.get('lead_frames') or 0), int(side.get('sting_at_frame') or 0)
        at = int((sting or {}).get('atFrame') or 0)
        if made != lead or made_at != at:
            problems.append(f'the stem {Path(stem["src"]).name} was premixed with {made} frames of sting at frame {made_at}, and '
                            f'the cut plays {lead} at frame {at}: run ve premix again')
    elif lead:
        problems.append(f'the stem {stem.get("src")} has no ve premix sidecar to say his voice comes in after the sting: '
                        'run ve premix')
    return problems

def source(path: str, assets_dir: str | Path) -> str:
    """Resolve only relative media paths contained by the assets folder."""
    root = Path(assets_dir).resolve()
    if (re.match(r'^https?://', path, re.I) or Path(path).is_absolute()
            or PureWindowsPath(path).drive or PureWindowsPath(path).root):
        raise ValueError(f'asset source must be relative and contained: {path}')
    resolved = (root / path.replace('\\', '/')).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f'asset source escapes assets folder: {path}')
    return str(resolved)


def _frame(seconds: float) -> int:
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError('word times must be finite and nonnegative')
    return round(seconds * FPS)


# Mirror apps/renderer/src/engine/chrome/CaptionTrack.tsx captionLines.
# Exact advances/fallback from house/metrics.ts; sizes and insets from
# house/geometry.ts and engine/geometry.ts, including 0.1 em swipe padding.
_CAPTION_CHARACTERS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2018\u2019\u201c\u201d\u2013\u2026\xa3\u20ac\xb7\xd7'
_CAPTION_ADVANCES = [233, 361, 545, 714, 676, 1080, 973, 300, 389, 389, 419, 703, 356, 373, 356, 307, 736, 698, 735, 737, 740, 737, 738, 709, 744, 738, 351, 356, 703, 703, 703, 674, 1120, 862, 851, 855, 852, 788, 734, 919, 917, 381, 714, 907, 724, 1071, 917, 917, 791, 917, 857, 799, 796, 908, 855, 1110, 866, 868, 796, 389, 307, 389, 703, 615, 325, 735, 728, 735, 728, 736, 455, 729, 725, 331, 328, 718, 331, 1096, 725, 736, 728, 728, 478, 676, 492, 725, 678, 1051, 746, 678, 618, 389, 287, 389, 703, 300, 300, 556, 556, 560, 1068, 730, 740, 374, 703]
_CAPTION_WIDTHS = dict(zip(_CAPTION_CHARACTERS, _CAPTION_ADVANCES))


def _text_width(text: str, size: int) -> float:
    return sum(_CAPTION_WIDTHS.get(char, 600) - 15 for char in text) * size / 1000


def caption_line_count(rows: list[dict], aspect: str = '9:16', emphasis=()) -> int:
    size, available = (54, 1400 - 42 * 2) if aspect == '16:9' else (68, 1080 - 60 - 220 - 42 * 2)  # house/geometry.ts HOUSE.caption
    space = _text_width(' ', size)
    width, lines = 0, 1
    for row in rows:
        word_width = _text_width(row['text'], size) + (0.1 * 2 * size if row['w'] in emphasis else 0)
        if word_width > available:
            raise ValueError(f"caption word exceeds one line: {row['text']}")
        if width and width + space + word_width > available:
            lines += 1
            width = 0
        width += (space if width else 0) + word_width
    return lines


def _zone_runs(rows: list[dict], beats: list[dict]) -> list[list[dict]]:
    """Rows split where a beat change moves the caption between the SPLIT zone and the house zone, so no page jumps
    zones mid-phrase (Thursday 5 Nov: "things. Awesome," began under his chin and finished in the house zone). A run of
    one word stays with its neighbour: a jump beats a one-word orphan."""
    def split_at(frame):
        beat = next((b for b in beats if b['fromFrame'] <= frame < b['toFrame']), None)
        return beat is not None and beat['layout'] == 'SPLIT'
    runs = []
    for row in rows:
        if runs and split_at(row['atFrame']) == split_at(runs[-1][-1]['atFrame']):
            runs[-1].append(row)
        else:
            runs.append([row])
    merged = []
    for run in runs:
        if merged and (len(run) == 1 or len(merged[-1]) == 1):
            merged[-1].extend(run)
        else:
            merged.append(run)
    return merged


LAST_WORD_HELD_FRAMES = 6  # a page's last word shows at least this long before the next page replaces it


def _held(rows: list[dict], end: int) -> bool:
    """Whether a page ending before rows[end] leaves its last word on screen for LAST_WORD_HELD_FRAMES."""
    if end >= len(rows) or 'atFrame' not in rows[end] or 'atFrame' not in rows[end - 1]:
        return True
    return rows[end]['atFrame'] - rows[end - 1]['atFrame'] >= LAST_WORD_HELD_FRAMES


# Words a caption page should not end on: the reader is left mid-phrase (Thursday 5 Nov: "really helpful but a bit |
# dangerous", "or tells | you how to lock it").
_WEAK_ENDS = {'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'but', 'or', 'so', 'my', 'your', 'our', 'their',
              'its', 'it', 'i', 'you', 'we', 'they', 'is', 'are', 'was', 'be', 'once', 'that', 'this', 'no', 'not',
              'with', 'at', 'by', 'as', 'if', 'how', 'just', 'can', 'will'}
_END = re.compile(r'[.!?]["\x27)\u2019\u201d]*$')
_PAUSE = re.compile(r'[,.!?;:]["\x27)\u2019\u201d]*$')


def _page_cost(rows: list[dict], start: int, n: int) -> int:
    """How badly a page of rows[start:start+n] reads. Lower is better; every rule here is a reading, not a limit."""
    page = rows[start:start + n]
    last = re.sub(r'[^a-z\']', '', page[-1]['text'].lower())
    cost = 0
    if any(_END.search(r['text']) for r in page[:-1]):
        cost += 6   # a page runs past the end of a sentence ("myself. I just put")
    if start + n < len(rows) and not _PAUSE.search(page[-1]['text']) and last in _WEAK_ENDS:
        cost += 4   # it ends mid-phrase on a small word
    if any(_PAUSE.search(r['text']) for r in page[:-1]):
        cost += 3   # a clause break inside the page ("Amazon for your groceries, Google")
    if not _held(rows, start + n):
        cost += 5   # its last word flips away before it can be read
    if not _PAUSE.search(page[-1]['text']) and start + n < len(rows):
        cost += 1   # a break at punctuation reads best
    if n == 2:
        cost += 1   # very short pages flicker
    return cost


def _caption_groups(rows: list[dict], aspect: str = '9:16', emphasis=()) -> list[list[dict]]:
    """Fit 2-5 words per page, choosing the breaks that read best over the whole run, never stranding an orphan."""
    size, available = (54, 1316) if aspect == '16:9' else (68, 816)
    for row in rows:
        caption_line_count([row], aspect, emphasis)
    # best[start] = (cost, page length) for the rest of the run from start; the run's end costs nothing.
    best = {len(rows): (0, 0)}
    for start in range(len(rows) - 1, -1, -1):
        options = [(_page_cost(rows, start, n) + best[start + n][0], n) for n in range(2, min(5, len(rows) - start) + 1)
                   if start + n in best
                   and sum(r['w'] in emphasis for r in rows[start:start + n]) <= 1
                   and caption_line_count(rows[start:start + n], aspect, emphasis) <= 2]
        if options:
            best[start] = min(options, key=lambda option: (option[0], -option[1]))
        elif start + 1 in best:
            row = rows[start]
            width = _text_width(row['text'], size) + (0.2 * size if row['w'] in emphasis else 0)
            if width >= available - _text_width(' ', size):
                best[start] = (best[start + 1][0], 1)
    if not rows or 0 not in best:
        raise ValueError('captions cannot fit 2-5 words per page without a one-word orphan')
    groups, start = [], 0
    while start < len(rows):
        size = best[start][1]
        groups.append(rows[start:start + size])
        start += size
    return groups


def _params(params: dict, source) -> dict:
    """Copy device params, resolving media paths (src, rows[].logoSrc) against the assets folder."""
    def visit(value):
        if isinstance(value, list):
            return [visit(item) for item in value]
        if isinstance(value, dict):
            return {key: source(item) if key in ('src', 'logoSrc') and isinstance(item, str)
                    else visit(item) for key, item in value.items()}
        return value
    return visit(params)


def compile_cut(spec: dict, cut_id: str, words: list[dict], assets_dir: str | Path, *, report: dict | None = None,
                edl: dict | None = None) -> dict:
    """Return EngineRenderProps without writing files or changing the spec.

    With an EDL from ve conform (already through its F09 lint), the source edits are applied: the words are the
    conformed clock and the picture is the conformed take, rendered from the same graph as the dialogue."""
    pending_error = pending_devices_error(spec['format'])
    if pending_error:
        raise ValueError(pending_error)
    cut = spec['cuts'][cut_id]
    # These words already describe the dialogue master's final clock. Do not
    # silently apply source edits a second time, or retime only the picture.
    edit = cut.get('edit', {})
    if edl is not None:
        if edl.get('piece') != spec['piece_id'] or edl.get('cut') != cut_id:
            raise ValueError('the EDL is for a different piece or cut')
        if (edl.get('edit', {}).get('remove') != edit.get('remove', []) or edl.get('speed') != edit.get('speed', 1)
                or edl.get('edit', {}).get('speed_said') != edit.get('speed_said')):
            raise ValueError("the EDL's edit differs from the spec's approved edit: run ve conform again")
    elif edit.get('remove') or edit.get('speed', 1) != 1:
        raise ValueError('compile needs a cut-ready dialogue master; source edits must be conformed before compilation')
    assets_dir = Path(assets_dir).resolve()

    def resolve_source(path: str) -> str:
        return source(path, assets_dir)

    rows = []
    by_word = {}
    previous = -1
    for index, word in enumerate(words):
        key = word['w'] if isinstance(word['w'], int) and not isinstance(word['w'], bool) else index
        text = word.get('word', word.get('text', word['w'] if isinstance(word['w'], str) else ''))
        onset = float(word['onset_s'])
        frame = _frame(onset)
        if key in by_word or key < 0 or onset < previous or not isinstance(text, str) or not text.strip():
            raise ValueError('words need unique nonnegative indexes, ordered onsets and caption text')
        end_s = word.get('end_s')
        if (isinstance(end_s, bool) or not isinstance(end_s, (int, float))
                or not math.isfinite(end_s) or end_s < onset):
            raise ValueError(f'words need end_s finite and at least onset_s: word {key}')
        row = {'w': key, 'text': text, 'atFrame': frame, 'end_s': float(end_s)}
        rows.append(row)
        by_word[key] = row
        previous = onset
    if not rows:
        raise ValueError('words cannot be empty')

    def at(index: int) -> int:
        if index not in by_word:
            raise ValueError(f'no timing for word {index}')
        return by_word[index]['atFrame']

    beats = []
    events = []
    selected = cut['beats']
    device_verbs = load_json(ROOT / 'config' / 've' / 'devices.json')['devices']
    by_object = {obj['obj']: obj for obj in spec.get('objects', [])}
    duration = _frame(rows[-1]['end_s']) + 12
    for index, beat in enumerate(selected):
        plate_root = ROOT / 'assets' / 'plates' / spec['format']
        has_phone = any(by_object.get(name, {}).get('device') == 'hand_phone_stage'
                        for name in beat.get('uses', []))
        plate_source = beat.get('plate', {}).get('source', 'take')
        sidecar = plate_root / 'plates.json'
        plate_backed = has_phone and sidecar.is_file()
        if plate_source not in ('take', 'none'):
            asset = next((a for a in spec.get('assets', [])
                          if 'asset:' + a['id'] == plate_source), {})
            manifest = load_json(sidecar) if plate_backed else {}
            allowed_paths = {'plates/' + spec['format'] + '/' + name
                             for name in manifest.get('files', {})}
            if asset.get('path') not in allowed_paths:
                raise ValueError(f'beat {beat["id"]}: asset plates arrive in Phase 2')
        if has_phone and spec['format'] == 'hand-held-screen' and not plate_backed:
            raise ValueError(f'beat {beat["id"]}: missing plate sidecar {sidecar}')
        # The first beat owns the opening frames (pre-roll included), so a cut never opens on bare ink.
        start = 0 if index == 0 else at(beat['span']['from_w'])
        at(beat['span']['to_w'])
        end = at(selected[index + 1]['span']['from_w']) if index + 1 < len(selected) else duration
        if end <= start:
            raise ValueError(f'beat {beat["id"]} has no positive frame interval')
        beats.append({'id': beat['id'], 'role': beat['role'], 'layout': beat['layout'],
                      'fromFrame': start, 'toFrame': end, 'uses': list(beat.get('uses', [])),
                      **({'face': beat['face']} if 'face' in beat else {}),
                      'transitionOut': beat.get('transition_out', 'cut'), 'sectionBeat': index == 0,
                      **({'plate': {k: v for k, v in beat['plate'].items() if k in ('source', 'crop')}} if beat.get('plate') else {})})
        # The v2 spec reserves extensible metadata in style; beat-level keyFrame
        # is not yet in its strict schema. Always emit an explicit engine frame.
        fraction = spec.get('style', {}).get('keyFrames', {}).get(beat['id'], 0.8)
        if isinstance(fraction, bool) or not isinstance(fraction, (int, float)) or not 0 <= fraction < 1:
            raise ValueError(f'beat {beat["id"]}: keyFrames fraction must be in [0, 1)')
        beats[-1]['keyFrame'] = min(end - 1, start + round((end - start) * fraction))
        for event_index, event in enumerate(beat.get('events', [])):
            event_frame = at(event['at_w'])
            # The hook is the intro: an entrance on the cut's first word lands on frame 0, so the first frame is the
            # hook in the brand's dress, never a bare stage waiting for the first syllable (Krish, 2026-11-03: "We
            # fucking have standards for intro, background audio and outro"). Text typed on that word is typed by then
            # too (the renderer lands frame-0 entrances and typing whole, ve-thu-9).
            if index == 0 and event['verb'] in ('enter', 'type') and event['at_w'] == beat['span']['from_w']:
                event_frame = 0
            if not start <= event_frame < end:
                raise ValueError(f'event outside beat {beat["id"]}')
            compiled = {'id': f'{beat["id"]}-{event_index}', 'obj': event['obj'], 'verb': event['verb'],
                        'toState': event['to_state'], 'atFrame': event_frame}
            obj = by_object.get(event['obj'])
            if obj is None:
                raise ValueError(f'event {compiled["id"]}: object {event["obj"]} is missing')
            device = obj['device']
            if device not in device_verbs:
                raise ValueError(f'event {compiled["id"]}: object {event["obj"]}, device {device}, '
                                 f'verb {event["verb"]}: device missing from devices.json')
            if event['verb'] not in device_verbs[device]['verbs']:
                raise ValueError(f'event {compiled["id"]}: object {event["obj"]}, device {device} '
                                 f'does not draw verb {event["verb"]}')
            if event.get('sfx'):
                compiled['sfx'] = event['sfx']
            events.append(compiled)
    by_beat = {beat['id']: beat for beat in beats}
    datasets = {dataset['id']: dataset for dataset in spec.get('datasets', [])}
    objects = []
    used = {name for beat in selected for name in beat.get('uses', [])}
    generated = {ref for asset in spec.get('assets', []) if asset.get('origin') == 'generated'
                 for ref in (asset['id'], 'asset:' + asset['id'], asset['path'])}

    def check_generated(node):
        if isinstance(node, dict):
            for value in node.values():
                check_generated(value)
        elif isinstance(node, list):
            for value in node:
                check_generated(value)
        elif isinstance(node, str) and node.replace('\\', '/').removeprefix('./') in generated:
            raise ValueError(f'generated asset {node}: the generated assets pipeline arrives in Phase 2')

    for obj in spec.get('objects', []):
        if obj['obj'] not in used:
            continue
        check_generated(obj.get('params', {}))
        persist = obj['persist']
        if persist['from_beat'] not in by_beat or persist['to_beat'] not in by_beat:
            raise ValueError(f'object {obj["obj"]} references a persist beat missing from cut {cut_id}')
        compiled = {key: obj[key] for key in ('obj', 'device', 'meaning')}
        compiled.update(fromFrame=by_beat[persist['from_beat']]['fromFrame'],
                        toFrame=by_beat[persist['to_beat']]['toFrame'],
                        variants=dict(spec['signature'].get('variants', {}).get(obj['device'], {})), params=_params(obj.get('params', {}), resolve_source))
        if compiled['toFrame'] <= compiled['fromFrame']:
            raise ValueError(f'object {obj["obj"]} has reversed persistence')
        if obj.get('dataset'):
            dataset = datasets[obj['dataset']]
            compiled['dataset'] = {'unit': dataset['unit'], 'denominator': dataset['denominator'],
                                   'producerLabel': dataset['producer_label'], 'rows': dataset['rows']}
        objects.append(compiled)

    theme = next(t for t in load_json(ROOT / 'config' / 'studio.json')['brand_themes'] if t['theme_id'] == spec['theme'])
    publication = theme['publication']
    house = publication['house_style']
    tokens = house['tokens']
    channel = spec['brand']['series'].replace('.', '_')
    identity = house['channels'][channel]
    emphasis = set(cut['captions'].get('emphasis', []))
    word_mode = spec['brand'].get('captions') == 'word'
    groups = [[row] for row in rows] if word_mode else \
        [g for part in _zone_runs(rows, beats) for g in _caption_groups(part, cut['aspect'], emphasis)]
    captions = []
    for index, group in enumerate(groups):
        hits = [i for i, word in enumerate(group) if word['w'] in emphasis]
        if len(hits) > 1:
            raise ValueError('a caption page can swipe only one emphasized word')
        captions.append({'fromFrame': group[0]['atFrame'],
                         'toFrame': groups[index + 1][0]['atFrame'] if index + 1 < len(groups) else duration,
                         'words': [{'text': word['text'], 'atFrame': word['atFrame']} for word in group],
                         'swipeIndex': hits[0] if hits else None})
    assets = {asset['id']: asset for asset in spec.get('assets', [])}
    if edl is not None:
        take = resolve_source(edl['conformed']['picture'])
    else:
        take = resolve_source(assets[cut['take']]['path'] if cut['take'] in assets else cut['take'])
    # An off day (published on a day that is not its series' day) has its own look: the house mint, never the series
    # colour or its promise (Krish, 2026-11-04: "Yes, give off days their own music and look - Rotate.").
    off = _series_day(identity['day'], spec.get('publish_day')) != identity['day']
    opening = {}
    # Nothing goes before the hook (Ruling, Krish, 2026-11-12): no sting, and no episode card in its place (the
    # brand.opening_exception of 9 Nov, which ve lint now refuses).
    if (spec.get('brand') or {}).get('opening_exception'):
        raise ValueError(f'brand.opening_exception puts an episode card before the hook: nothing goes before the hook (Ruling, '
                         f'Krish, 2026-11-12: "{NOTHING_BEFORE_HOOK}"); remove it from the spec')
    sting = sting_props(cut, channel, off, opening)
    props = {
        'pieceId': spec['piece_id'], 'cutId': cut_id, 'format': spec['format'], 'aspect': cut['aspect'],
        'fps': FPS, 'durationFrames': duration,
        'tokens': {'ink': tokens['ink'], 'inkDeep': tokens['ink_deep'], 'inkSoft': tokens['ink_soft'],
                   'cream': tokens['cream'], 'mint': tokens['mint'],
                   'channel': tokens['mint'] if off else publication['channel_colors'][channel]},
        # An off-day piece wears the house dress of a series but never another day's name (Krish, 2026-11-03, of
        # Thursday's under.the.hood tag: "The branding is wrong").
        'series': {'label': spec['brand']['series'] if _series_day(identity['day'], spec.get('publish_day')) == identity['day']
                   else 'off.day', 'day': _series_day(identity['day'], spec.get('publish_day')),
                   'promise': house['copy']['site'] if off else identity['promise'], 'site': house['copy']['site']},
        'brand': {key: {'src': resolve_source(publication[key]['source_path']), 'pixelWidth': publication[key]['pixel_width'],
                        'pixelHeight': publication[key]['pixel_height']} for key in ('mark', 'logo', 'stacked')},
        'segments': [] if spec['audio']['master'] == 'vo' else [
            {'src': take, 'trimBeforeFrames': 0, 'fromFrame': 0, 'durationFrames': duration}],
        'audio': {'stem': {'src': resolve_source(f'audio.{cut_id}.wav'), 'trimBeforeFrames': 0}, 'sfx': []},
        'captions': captions, 'captionStyle': 'word' if word_mode else 'house',
        **({'captionTheme': spec['brand']['caption_theme']} if spec['brand'].get('caption_theme') else {}),
        **({'title': spec['brand']['title']} if spec['brand'].get('title') else {}),
        'beats': beats, 'objects': objects, 'events': events,
    }
    if sting:
        # After the hook, never in front of it (config/brand-palette.json long_cut sting after_hook): every frame in the
        # props stays on the cut's own clock, and the render plays the sting from this one (VeCut.tsx).
        sting = dict(sting, atFrame=hook_end(props))
        if 'sting' in opening:
            opening['sting']['at_frame'] = sting['atFrame']
    sfx, missing = [], []
    kit_path = ROOT / 'config' / 've' / 'sfx-kits' / f"{spec['audio']['sfx_kit']}.json"
    kit = load_json(kit_path) if kit_path.is_file() else {}
    for event in events:
        if not event.get('sfx'):
            continue
        sound = kit.get(event['sfx'])
        if sound is None:
            missing.append(event['id'])
            continue
        gain = sound['gain_db']
        if isinstance(gain, bool) or not isinstance(gain, (int, float)) or not math.isfinite(gain) or gain > 0:
            raise ValueError(f'invalid sfx gain for {event["id"]}')
        # The approved sound itself, staged into the cut's assets from MINDMAKE_MUSIC_ROOT (the brand kit's Music
        # folder) and checked by its sha256; a sound missing on this machine stops the compile, never drops out.
        from .sfx import ensure_staged  # noqa: PLC0415
        sfx.append({'src': resolve_source(ensure_staged(event['sfx'], sound['path'], assets_dir)), 'atFrame': event['atFrame'],
                    'gainDb': gain})
    props['audio']['sfx'] = sfx
    if report is not None:
        report.update(lint='clean', sfx_missing=missing, opening='sting' if sting else 'hook', **opening)
        if edl is not None:
            report['edl'] = {'cut': cut_id, 'joins_s': [join['at_s'] for join in edl.get('joins', [])],
                             'duration_frames': edl.get('duration_frames'),
                             'picture_short_frames': max(0, duration - int(edl.get('duration_frames') or 0))}
    # Every whole cut closes on the ending band (one calm close, held long enough to read: config/ve/formats
    # intro_outro; Krish, 2026-11-03: "We fucking have standards for intro, background audio and outro"), not only a
    # cut that carries a dated call; the call card still needs a call.
    if not cut.get('excerpt', False):
        props['ending'] = {'fromFrame': duration, 'url': props['series']['site'], 'tagline': ENDING_TAGLINE, 'cta': ENDING_CTA,
                           'days': [{'day': house['channels'][c]['day'], 'colour': publication['channel_colors'][c]}
                                    for c in house['channels'] if c in publication['channel_colors']] if not off else []}
        if spec.get('style', {}).get('ending_ticker') is False:
            props['ending']['ticker'] = False  # no scrolling promise strip (Krish: no marquee)
        props['durationFrames'] += ENDING_FRAMES_BY_ASPECT.get(cut['aspect'], ENDING_FRAMES)
        # The ending band is drawn by BrandFrame, which FormatMaster mounts only for an active beat, so the last
        # beat (and what persists to it) runs through the ending. Captions stop at its start.
        end_frame = props['durationFrames']
        props['beats'][-1]['toFrame'] = end_frame
        for compiled in props['objects']:
            if compiled['toFrame'] == duration:
                compiled['toFrame'] = end_frame
    if sting:
        # Never: sting_props gives no cut one (Ruling, Krish, 2026-11-12), and sting_problems refuses props that carry one.
        props['sting'] = sting
    if spec.get('call'):
        call = spec['call']
        props['call'] = {'statement': call['statement'], 'due': call['due'], 'confidencePercent': call['confidence_percent']}
    motion = motion_props(spec)
    if motion is not None:
        props['motion'] = motion
    return props


MOTION_PROFILES = ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'kit' / 'motion-profiles.json'


def motion_props(spec: dict) -> dict | None:
    """props.motion from the spec's style.motion: the style id and, when the renderer can draw it, its profile.

    The profiles live once, in the renderer's kit/motion-profiles.json; a style that needs its own device carries only
    its id and renders with the house motion. No style.motion means no props.motion, so the cut renders exactly as before.
    """
    module = ((spec.get('style') or {}).get('motion') or {}).get('module')
    if not module:
        return None
    table = load_json(MOTION_PROFILES)
    if module in table['profiles']:
        return {'style': module, 'profile': json.loads(json.dumps(table['profiles'][module]))}
    if module in table['needs_device']:
        return {'style': module}
    raise ValueError(f'style.motion.module {module} is not a motion style the renderer knows')
