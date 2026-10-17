#!/usr/bin/env python3
"""The story intro and outro (the stand-off), rendered from a piece's props.

The design lives in the renderer (apps/renderer/src/story): four Remotion
compositions, StoryIntroStandoffWide/Tall and StoryOutroStandoffWide/Tall,
driven entirely by one props object (apps/renderer/src/story/props.ts). They
are silent; the music is mixed elsewhere. Approved by Krish on 2026-10-12
(config/story-intro-outro.json); revised 2026-10-13 on his review of
Wednesday's video (docs/plans/2026-10-12-story-io/README.md).

    python story_io.py props [--plan PLAN] [--out PROPS.json]
        A piece's props from its plan folder's cover-facts.json:
          * `video_title`: the title card's words (short; else the cover's
            headline lines; never the article's long headline);
          * `standoff`: {"left": PLAYER, "right": [PLAYER, ...]}, each PLAYER
            {"label", "logos": [files], "tag"}, so a side can show the marks
            people know (Meta, Instagram and WhatsApp for Muse) with the
            product's name in type; else the cover rows, one logo each.
        Monday 12 October keeps its hand-made props (monday_props). The
        brand's own wordmark and masthead images come from
        scripts/pages/brand.py. Every optional value is written out (null),
        so the Studio's default props can never fill a gap.

    python story_io.py render --piece-props PROPS.json --out DIR [--browser PATH] [--only intro-16x9,...]
        Bundles apps/renderer/src/index.ts once and renders
        DIR/{intro,outro}-{16x9,9x16}.mp4 (h264, yuv420p, 30 fps, no audio).
        While it renders, every frame reports where each text, logo and badge
        is and which face each text is set in; the render FAILS when anything
        leaves the safe area (config/story-intro-outro.json `safe_areas`), two
        texts or logos collide, a text is not in a brand face, a face did not
        load, or words do not fit their area at the smallest size allowed.
        It always writes DIR/contact-<clip>.png (a frame every 0.25 s, the
        safe area outlined, any problem boxed in red) and DIR/check.json.

    python story_io.py --self-test
        The props, the title rule and the check, without rendering.

The browser is --browser, else REMOTION_BROWSER_EXECUTABLE, else the one
intro.py finds (the Studio's copy, or this container's).
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from intro import browser  # noqa: E402  (the same browser lookup as the sting)
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pages'))
import brand as house_brand  # noqa: E402  (the brand's own image files, from makeyourmindup.ai/brand/)
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "post-pack"))
import title_check  # noqa: E402  the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK)

REPO = Path(__file__).resolve().parents[2]
ENTRY = REPO / 'apps' / 'renderer' / 'src' / 'index.ts'
FONTS_CSS = REPO / 'apps' / 'renderer' / 'src' / 'house' / 'fonts.css'
CONFIG = REPO / 'config' / 'story-intro-outro.json'
MONDAY = REPO / 'docs' / 'plans' / '2026-10-12-monday'
FPS = 30
CLIPS = {
    'intro-16x9': ('StoryIntroStandoffWide', '16x9', (1920, 1080)),
    'intro-9x16': ('StoryIntroStandoffTall', '9x16', (1080, 1920)),
    'outro-16x9': ('StoryOutroStandoffWide', '16x9', (1920, 1080)),
    'outro-9x16': ('StoryOutroStandoffTall', '9x16', (1080, 1920)),
}
SERIES_COLOURS = {'follow.the.money': '#FFD84D', 'under.the.hood': '#B7A6FF', 'mind.the.gap': '#FF6A4D'}
TITLE_MAX_CHARS = 60
TONES = ('cream', 'mint', 'coral')
# Every optional top-level value, written out so Monday's default props
# (apps/renderer/src/story/monday.ts) can never leak into another piece.
OPTIONAL_KEYS = ('title', 'titleEmphasis', 'question', 'questionEmphasis', 'cast', 'nextColour', 'check')
CAST_MAX = 6


class StoryError(ValueError):
    """Why the story intro and outro cannot be made, in plain words."""


# ---------------------------------------------------------------- logos

def data_uri(svg_bytes):
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg_bytes).decode('ascii')


def svg_aspect(svg_bytes):
    """An SVG's width / height, from its viewBox (else its width and height)."""
    head = svg_bytes[:4000].decode('utf-8', 'replace')
    root = re.search(r'<svg\b[^>]*>', head, re.S)
    tag = root.group(0) if root else head
    vb = re.search(r'viewBox\s*=\s*"([^"]+)"', tag)
    if vb:
        parts = [float(x) for x in re.split(r'[\s,]+', vb.group(1).strip()) if x]
        if len(parts) == 4 and parts[2] > 0 and parts[3] > 0:
            return round(parts[2] / parts[3], 4)
    w = re.search(r'\bwidth\s*=\s*"([\d.]+)', tag)
    h = re.search(r'\bheight\s*=\s*"([\d.]+)', tag)
    if w and h and float(h.group(1)) > 0:
        return round(float(w.group(1)) / float(h.group(1)), 4)
    return 1.0


def logo_ref(svg_bytes):
    return {'src': data_uri(svg_bytes), 'aspect': svg_aspect(svg_bytes)}


def uri_ref(uri):
    """A logo data URI (as a cover file embeds it) with its aspect."""
    body = base64.b64decode(uri.split(',', 1)[1])
    return {'src': uri, 'aspect': svg_aspect(body)}


def embedded_marks(path):
    """{file name: data URI} for the official marks a composite cover file
    embeds unaltered, named from the file's own comment
    ("... unaltered: wmg-symbol-cream.svg, bmg-symbol-cream.svg")."""
    text = Path(path).read_text(encoding='utf-8')
    said = re.search(r'unaltered:\s*([^<>]+?)\s*-->', text)
    names = [n.strip() for n in said.group(1).split(',')] if said else []
    hrefs = re.findall(r'<image\b[^>]*\bhref="(data:image/svg\+xml;base64,[^"]+)"', text)
    if not names or len(names) != len(hrefs):
        raise StoryError(f'{path}: cannot tell which embedded mark is which (comment names {names}, {len(hrefs)} images)')
    return dict(zip(names, hrefs))


def brand_images():
    """The brand's one-line wordmark and stacked masthead, full size and
    unaltered, as data URIs (fetched through scripts/pages/brand.py, so any
    machine gets them from makeyourmindup.ai/brand/ or its cache)."""
    return {'wordmark': house_brand.brand_uri('wordmark', full=True), 'masthead': house_brand.brand_uri('masthead', full=True)}


NEXT_DAY = {'follow.the.money': 'Wednesday · under.the.hood', 'under.the.hood': 'Friday · mind.the.gap',
            'mind.the.gap': 'Monday · follow.the.money'}


def line_up(right, strip=(), folder=None, where=''):
    """The title card's line-up: the players against the first (each by its
    first logo), then the story's other names (cover-facts.json thumbs.strip),
    each once, at most six."""
    cast, seen = [], set()
    for r in right:
        if r['name'] not in seen and r.get('logos'):
            seen.add(r['name'])
            cast.append({'name': r['name'], 'logo': r['logos'][0]})
    for s in strip or []:
        name = str(s.get('name') or '').strip()
        path = Path(folder) / str(s.get('logo') or '') if folder else None
        if not name or name in seen or not path or not path.is_file():
            continue
        seen.add(name)
        cast.append({'name': name, 'logo': logo_ref(path.read_bytes())})
    for c in cast:
        if len(c['name']) > 16:
            raise StoryError(f'{where}: the line-up name "{c["name"]}" is longer than 16 characters')
    return cast[:CAST_MAX]


def complete(props):
    """Every optional value written out (null when unset)."""
    for k in OPTIONAL_KEYS:
        props.setdefault(k, None)
    return props


# ---------------------------------------------------------------- the title

def video_title(facts, where='cover-facts.json'):
    """The title card's words: `video_title`, else the cover's headline lines
    joined. Never the article's headline, which is written to be read, not
    set across a title card."""
    said = str(facts.get('video_title') or '').strip()
    if not said:
        lines = (facts.get('cover') or {}).get('headline') or []
        said = ' '.join(str(x).strip() for x in lines if str(x).strip())
    # Ordinary spaces collapse; a no-break space (U+00A0) is kept, so a phrase stays on one line of the card.
    said = re.sub(r'[ \t\r\n]+', ' ', said).strip()
    if not said:
        raise StoryError(f'{where} has no video_title and no cover headline lines, so the title card has no words; '
                         'add a short "video_title" (the article headline is never used: it does not fit a title card)')
    if len(said) > TITLE_MAX_CHARS:
        raise StoryError(f'{where}: the video title "{said}" is {len(said)} characters; a title card holds at most '
                         f'{TITLE_MAX_CHARS}. Write a shorter "video_title".')
    why = title_check.gate(said)
    if why:
        raise StoryError(f'{where}: the video title "{said}" is not ready (house rule TITLE_EARNS_THE_CLICK: the anti-dumb floor, then only a title Krish picked): ' + '; '.join(why))
    return said


# ---------------------------------------------------------------- props

def monday_props(folder=MONDAY):
    folder = Path(folder)
    facts = json.loads((folder / 'cover-facts.json').read_text(encoding='utf-8'))
    series = facts.get('subchannel')
    if series not in SERIES_COLOURS:
        raise StoryError(f'cover-facts.json names the series {series!r}, not one of {", ".join(SERIES_COLOURS)}')
    rows = {r['name']: r for r in facts['cover']['rows']}
    logos = folder / 'logos'

    def row_file(name):
        if name not in rows:
            raise StoryError(f'cover-facts.json has no cover row for {name!r}')
        return logos / Path(rows[name]['logo']).name

    suno = row_file('Suno').read_bytes()
    partners = embedded_marks(row_file('Warner Music Group and BMG'))
    suing = embedded_marks(row_file('Sony Music and Universal Music Group'))
    for want, have in (('wmg-symbol-cream.svg', partners), ('umg-logo-cream.svg', suing), ('sonymusic-symbol-cream.svg', suing)):
        if want not in have:
            raise StoryError(f'the cover logos do not embed {want}')
    props = {
        'seriesColour': SERIES_COLOURS[series],
        'seriesName': series,
        'left': {'name': 'Suno', 'logos': [logo_ref(suno)], 'tag': 'AI song app'},
        'right': [
            {'name': 'Warner', 'logos': [uri_ref(partners['wmg-symbol-cream.svg'])], 'tag': 'Suing', 'tagTone': 'coral',
             'tagAfter': 'Paid', 'tagAfterTone': 'mint', 'switchesSides': True},
            {'name': 'Universal', 'logos': [uri_ref(suing['umg-logo-cream.svg'])], 'tag': 'Suing', 'tagTone': 'coral'},
            {'name': 'Sony', 'logos': [uri_ref(suing['sonymusic-symbol-cream.svg'])], 'tag': 'Suing', 'tagTone': 'coral'},
        ],
        'cast': None,
        'title': 'Who gets paid for AI songs?',
        'titleEmphasis': 'gets paid',
        'link': 'makeyourmindup.ai',
        'commentQuestion': 'Should a singer get paid when an AI learns from their song?',
        'nextLabel': 'Wednesday · under.the.hood',
        'brand': brand_images(),
    }
    props['cast'] = line_up(props['right'])
    return complete(props)


def player(folder, spec, where):
    """A stand-off player from cover-facts.json's `standoff` (label, logos,
    tag) or from a cover row (name, logo, tag)."""
    name = str(spec.get('label') or spec.get('name') or '').strip()
    if not name:
        raise StoryError(f'{where}: a player has no label')
    files = spec.get('logos') or ([spec['logo']] if spec.get('logo') else [])
    if not files:
        raise StoryError(f'{where}: {name} has no logo; every player shows the real marks people know')
    if len(files) > 4:
        raise StoryError(f'{where}: {name} has {len(files)} logos; a badge holds at most 4')
    refs = []
    for rel in files:
        path = Path(folder) / rel
        if not path.is_file():
            raise StoryError(f'{where}: {name}\'s logo {rel} is not in the plan folder')
        refs.append(logo_ref(path.read_bytes()))
    out = {'name': name, 'logos': refs}
    for k in ('tag', 'tagAfter'):
        if spec.get(k):
            out[k] = str(spec[k]).strip()
    for k in ('tagTone', 'tagAfterTone'):
        if spec.get(k):
            if spec[k] not in TONES:
                raise StoryError(f'{where}: {name}\'s {k} is {spec[k]!r}, not one of {", ".join(TONES)}')
            out[k] = spec[k]
    if spec.get('switchesSides'):
        out['switchesSides'] = True
    return out


def plan_props(folder):
    """Any piece's props from its plan folder. Monday 12 October keeps its
    hand-made props (monday_props)."""
    folder = Path(folder)
    if folder.resolve() == MONDAY.resolve():
        return monday_props(folder)
    facts = json.loads((folder / 'cover-facts.json').read_text(encoding='utf-8'))
    where = f'{folder.name}/cover-facts.json'
    series = facts.get('subchannel')
    if series not in SERIES_COLOURS:
        raise StoryError(f'cover-facts.json names the series {series!r}, not one of {", ".join(SERIES_COLOURS)}')
    title = video_title(facts, where)
    emphasis = str(facts.get('video_title_emphasis') or '').strip() or None
    if emphasis and emphasis not in title:
        raise StoryError(f'{where}: video_title_emphasis "{emphasis}" is not in the video title "{title}"')
    standoff = facts.get('standoff')
    if standoff:
        left = player(folder, standoff.get('left') or {}, where)
        right = [player(folder, r, where) for r in standoff.get('right') or []]
    else:
        rows = (facts.get('cover') or {}).get('rows') or []
        if len(rows) < 2:
            raise StoryError(f'{where}: the cover has {len(rows)} row(s); the stand-off needs two or more, or a "standoff" block')
        left = player(folder, rows[0], where)
        right = [player(folder, r, where) for r in rows[1:]]
    if not 1 <= len(right) <= 3:
        raise StoryError(f'{where}: the stand-off has {len(right)} player(s) against the first; it holds 1 to 3')
    comment = str(facts.get('comment_question') or '').strip()
    if not comment:
        for script in sorted(folder.parent.glob(f'{folder.name[:10]}-draft-script*.md')) + sorted(folder.glob('script*.md')):
            said = re.search(r'Tell me in the comments:?\s*([^?]+\?)', script.read_text(encoding='utf-8'))
            if said:
                comment = said.group(1).strip()
                comment = comment[:1].upper() + comment[1:]
                break
    return complete({
        'seriesColour': SERIES_COLOURS[series],
        'seriesName': series,
        'left': left,
        'right': right,
        'cast': line_up(right, (facts.get('thumbs') or {}).get('strip') or [], folder, where),
        'title': title,
        'titleEmphasis': emphasis,
        'link': 'makeyourmindup.ai',
        'commentQuestion': comment or (title if title.endswith('?') else 'What would you have done?'),
        'nextLabel': NEXT_DAY[series],
        'brand': brand_images(),
    })


# ---------------------------------------------------------------- the faces

def brand_font_files(css=FONTS_CSS):
    """The font files the renderer's house faces load; StoryError when one is
    not installed (a missing face must stop the render, never fall back)."""
    text = Path(css).read_text(encoding='utf-8')
    rels = sorted(set(re.findall(r"url\('(@fontsource[^']+)'\)", text)))
    if not rels:
        raise StoryError(f'{css} names no @fontsource files')
    missing = [r for r in rels if not (REPO / 'node_modules' / r).is_file()]
    if missing:
        raise StoryError('brand font file(s) missing: ' + ', '.join(f'node_modules/{r}' for r in missing)
                         + '. Run `npm ci` in the repository first; the story clips are never set in a fallback font.')
    return [REPO / 'node_modules' / r for r in rels]


# ---------------------------------------------------------------- the check

def check_rules(config=CONFIG):
    cfg = json.loads(Path(config).read_text(encoding='utf-8'))
    rules = cfg.get('check') or {}
    areas = rules.get('safe_areas') or {}
    for shape in ('16x9', '9x16'):
        a = areas.get(shape)
        if not a or not all(k in a for k in ('x0', 'y0', 'x1', 'y1')):
            raise StoryError(f'{config}: check.safe_areas.{shape} needs x0, y0, x1 and y1')
    faces = rules.get('faces') or []
    if not faces:
        raise StoryError(f'{config}: check.faces names no brand faces')
    return {'safe_areas': areas, 'faces': faces, 'tolerance_px': float(rules.get('tolerance_px', 1)),
            'overlap_share': float(rules.get('overlap_share', 0.04))}


def first_family(css_family):
    return (css_family or '').split(',')[0].strip().strip('"\'')


def _span(frames):
    frames = sorted(frames)
    a, b = frames[0], frames[-1]
    return f'frame {a} ({a / FPS:.2f} s)' if a == b else f'frames {a} to {b} ({a / FPS:.2f} to {b / FPS:.2f} s)'


def check_clip(entries, clip, frames, shape, rules):
    """The problems in one clip's per-frame reports, as plain sentences plus a
    {frame: [boxes]} map for the contact sheet. Pure: no rendering."""
    safe = rules['safe_areas'][shape]
    tol = rules['tolerance_px']
    faces = set(rules['faces'])
    by_frame = {}
    for e in entries:
        if e.get('clip') == clip:
            by_frame[int(e['frame'])] = e
    found = {}  # (what, id) -> {'frames': [...], 'say': str}
    marks = {}

    def note(key, frame, say, box=None):
        hit = found.setdefault(key, {'frames': [], 'say': say})
        hit['frames'].append(frame)
        if box:
            marks.setdefault(frame, []).append(box)

    missing = [f for f in range(frames) if f not in by_frame]
    problems = []
    if missing:
        problems.append(f'{clip}: {len(missing)} of {frames} frames were never checked (first: {missing[:5]})')
    for frame in sorted(by_frame):
        items = by_frame[frame].get('items') or []
        for it in items:
            x0, y0, x1, y1 = it['r']
            label = f'{it["id"]}' + (f' "{it["text"]}"' if it.get('text') else '')
            out = {'left': safe['x0'] - x0, 'top': safe['y0'] - y0, 'right': x1 - safe['x1'], 'bottom': y1 - safe['y1']}
            over = {k: v for k, v in out.items() if v > tol}
            if over:
                side, by = max(over.items(), key=lambda kv: kv[1])
                note(('outside', it['id'], side), frame, f'{label} goes {round(by)} px past the {side} of the safe area', it['r'])
            if it.get('kind') == 'text':
                fam = first_family(it.get('family'))
                if fam not in faces:
                    note(('face', it['id']), frame, f'{label} is set in "{fam}", not a brand face ({", ".join(sorted(faces))})', it['r'])
                elif it.get('fontOk') is False:
                    note(('face', it['id']), frame, f'{label}: the face "{fam}" was not loaded, so it would draw in a fallback font', it['r'])
        leaves = [it for it in items if it.get('kind') in ('text', 'logo') and float(it.get('op', 1)) >= 0.99]
        for i, a in enumerate(leaves):
            for b in leaves[i + 1:]:
                if a.get('group') == b.get('group'):
                    continue
                ix = min(a['r'][2], b['r'][2]) - max(a['r'][0], b['r'][0])
                iy = min(a['r'][3], b['r'][3]) - max(a['r'][1], b['r'][1])
                if ix <= 0 or iy <= 0:
                    continue
                area = lambda r: max(1.0, (r[2] - r[0]) * (r[3] - r[1]))  # noqa: E731
                if ix * iy > rules['overlap_share'] * min(area(a['r']), area(b['r'])):
                    note(('overlap', a['id'], b['id']), frame, f'{a["id"]} and {b["id"]} collide', [min(a['r'][0], b['r'][0]), min(a['r'][1], b['r'][1]),
                                                                                                max(a['r'][2], b['r'][2]), max(a['r'][3], b['r'][3])])
    for key, hit in found.items():
        problems.append(f'{clip}: {hit["say"]} at {_span(hit["frames"])}')
    return problems, marks


def sheet_frames(frames, step_s=0.25):
    out, k = [], 0
    while True:
        f = round(k * step_s * FPS)
        if f >= frames:
            break
        out.append(f)
        k += 1
    if frames - 1 not in out:
        out.append(frames - 1)
    return out


def contact_sheet(video, frames, shape, safe, marks, out_png):
    """A frame every 0.25 s (and the last), the safe area outlined in magenta
    dashes and any problem boxed in red, for a person to look at."""
    picks = sheet_frames(frames)
    with tempfile.TemporaryDirectory() as tmp:
        expr = '+'.join(f'eq(n\\,{f})' for f in picks)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-vf', f"select='{expr}'", '-vsync', '0',
                        os.path.join(tmp, 'f%04d.png')], check=True)
        stills = sorted(Path(tmp).glob('f*.png'))
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            cols = 4 if shape == '16x9' else 7
            rows = -(-len(stills) // cols)
            scale = '480:-1' if shape == '16x9' else '216:-1'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-vf', f"select='{expr}',scale={scale},tile={cols}x{rows}",
                            '-vsync', '0', '-frames:v', '1', str(out_png)], check=True)
            return out_png
        tw = 480 if shape == '16x9' else 240
        cols = 4 if shape == '16x9' else 7
        label_h = 22
        imgs = [Image.open(p).convert('RGB') for p in stills]
        k = tw / imgs[0].width
        th = round(imgs[0].height * k)
        rows = -(-len(imgs) // cols)
        sheet = Image.new('RGB', (cols * (tw + 8) + 8, rows * (th + label_h + 8) + 8), (12, 21, 18))
        draw = ImageDraw.Draw(sheet)
        for i, (im, f) in enumerate(zip(imgs, picks)):
            x = 8 + (i % cols) * (tw + 8)
            y = 8 + (i // cols) * (th + label_h + 8)
            sheet.paste(im.resize((tw, th)), (x, y + label_h))
            bad = marks.get(f) or []
            draw.text((x + 2, y + 4), f'{f / FPS:.2f} s  (frame {f})' + ('  PROBLEM' if bad else ''), fill=(255, 106, 77) if bad else (244, 239, 228))
            sx = lambda v: x + v * k  # noqa: E731
            sy = lambda v: y + label_h + v * k  # noqa: E731
            r = [sx(safe['x0']), sy(safe['y0']), sx(safe['x1']), sy(safe['y1'])]
            for j in range(int(r[0]), int(r[2]), 8):
                draw.line([(j, r[1]), (min(j + 4, r[2]), r[1])], fill=(255, 0, 200))
                draw.line([(j, r[3]), (min(j + 4, r[2]), r[3])], fill=(255, 0, 200))
            for j in range(int(r[1]), int(r[3]), 8):
                draw.line([(r[0], j), (r[0], min(j + 4, r[3]))], fill=(255, 0, 200))
                draw.line([(r[2], j), (r[2], min(j + 4, r[3]))], fill=(255, 0, 200))
            for b in bad:
                draw.rectangle([sx(b[0]), sy(b[1]), sx(b[2]), sy(b[3])], outline=(255, 0, 0), width=2)
        sheet.save(out_png)
    return out_png


# ---------------------------------------------------------------- rendering

REMOTION = r"""
import { readFileSync, appendFileSync } from 'node:fs'
import { bundle } from '@remotion/bundler'
import { getCompositions, renderMedia } from '@remotion/renderer'
const job = JSON.parse(readFileSync(process.env.MINDMAKE_STORY_JOB, 'utf8'))
const opts = job.browser ? { browserExecutable: job.browser } : {}
const serveUrl = await bundle({ entryPoint: job.entry })
for (const clip of job.clips) {
  const all = await getCompositions(serveUrl, { inputProps: clip.inputProps, ...opts })
  const composition = all.find((c) => c.id === clip.id)
  if (!composition) {
    console.error(`not registered: ${clip.id}; the renderer has ${all.map((c) => c.id).join(', ')}`)
    process.exit(3)
  }
  const onBrowserLog = (log) => {
    const text = String(log.text || '')
    if (text.startsWith('STORYCHECK ')) appendFileSync(clip.checkOut, text.slice(11) + '\n')
  }
  await renderMedia({ composition, serveUrl, codec: 'h264', crf: 14, imageFormat: 'png', pixelFormat: 'yuv420p', muted: true,
    outputLocation: clip.out, inputProps: clip.inputProps, logLevel: 'error', onBrowserLog, ...opts })
  console.log(JSON.stringify({ id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, frames: composition.durationInFrames }))
}
"""


def render_failure(output):
    """Remotion's output, reduced to the sentence a person can act on."""
    said = re.search(r'(STORY_(?:FIT|FONT): .*?)(?:\\n|\n|"\s*[,}]|$)', output)
    if said:
        return said.group(1).replace('\\"', '"').strip()
    return f'Remotion could not render the story clips: {output.strip()[-1200:]}'


def probe(path):
    p = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height,r_frame_rate,pix_fmt,codec_name,nb_read_frames:format=duration', '-of', 'json', str(path)],
                       capture_output=True, text=True, check=True)
    data = json.loads(p.stdout)
    v = data['streams'][0]
    has_audio = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', str(path)],
                               capture_output=True, text=True).stdout.strip()
    return {'codec': v.get('codec_name'), 'width': v.get('width'), 'height': v.get('height'), 'fps': v.get('r_frame_rate'),
            'pix_fmt': v.get('pix_fmt'), 'frames': int(v.get('nb_read_frames') or 0), 'seconds': round(float(data['format']['duration']), 3),
            'audio': bool(has_audio)}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def render(props_path, out_dir, browser_path=None, only=None, entry=ENTRY):
    piece = json.loads(Path(props_path).read_text(encoding='utf-8'))
    piece.pop('shape', None)
    piece = complete(piece)
    piece['check'] = True
    out_dir = Path(out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    names = only or list(CLIPS)
    unknown = [n for n in names if n not in CLIPS]
    if unknown:
        raise StoryError(f'no such clip: {", ".join(unknown)} (the clips are {", ".join(CLIPS)})')
    if not shutil.which('node'):
        raise StoryError('node is not on the PATH, so the story intro and outro cannot be rendered here')
    brand_font_files()
    rules = check_rules()
    clips = [{'id': CLIPS[n][0], 'out': str(out_dir / f'{n}.part.mp4'), 'checkOut': str(out_dir / f'{n}.check.jsonl'),
              'inputProps': {**piece, 'shape': CLIPS[n][1]}} for n in names]
    for c in clips:
        Path(c['checkOut']).unlink(missing_ok=True)
    job = {'entry': str(Path(entry).resolve()), 'browser': browser(browser_path), 'clips': clips}
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as fh:
        json.dump(job, fh)
        job_file = fh.name
    try:
        p = subprocess.run(['node', '--input-type=module', '-e', REMOTION], cwd=REPO, capture_output=True, text=True,
                           env={**os.environ, 'MINDMAKE_STORY_JOB': job_file})
    finally:
        os.unlink(job_file)
    if p.returncode:
        raise StoryError(render_failure((p.stderr or '') + (p.stdout or '')))
    rendered = {}
    for line in (p.stdout or '').splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if isinstance(d, dict) and 'id' in d:
            rendered[d['id']] = d
    results, problems, report = [], [], {}
    for n, c in zip(names, clips):
        part, final = out_dir / f'{n}.part.mp4', out_dir / f'{n}.mp4'
        info = probe(part)
        w, h = CLIPS[n][2]
        want = {'codec': 'h264', 'width': w, 'height': h, 'fps': f'{FPS}/1', 'pix_fmt': 'yuv420p'}
        wrong = {k: (info[k], v) for k, v in want.items() if info[k] != v}
        if wrong:
            raise StoryError(f'{n} is not in the house form: {wrong}')
        frames = int((rendered.get(CLIPS[n][0]) or {}).get('frames') or info['frames'])
        log = Path(c['checkOut'])
        entries = [json.loads(x) for x in log.read_text(encoding='utf-8').splitlines() if x.strip()] if log.is_file() else []
        shape = CLIPS[n][1]
        found, marks = check_clip(entries, n, frames, shape, rules)
        sheet = contact_sheet(part, frames, shape, rules['safe_areas'][shape], marks, out_dir / f'contact-{n}.png')
        report[n] = {'frames_checked': len({e['frame'] for e in entries}), 'frames': frames, 'problems': found, 'contact_sheet': str(sheet)}
        problems += found
        if not found:
            os.replace(part, final)
            log.unlink(missing_ok=True)
            results.append({'clip': n, 'file': str(final), 'sha256': sha256(final), 'contact_sheet': str(sheet), **info})
    (out_dir / 'check.json').write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    if problems:
        shown = problems[:25]
        more = f'\n  ... and {len(problems) - len(shown)} more (check.json)' if len(problems) > len(shown) else ''
        sheets = ', '.join(r['contact_sheet'] for r in report.values())
        raise StoryError('the story clips failed the visual check, so they were not finished:\n  ' + '\n  '.join(shown) + more
                         + f'\nLook at the contact sheets: {sheets}')
    return results


# ---------------------------------------------------------------- self-test

def self_test():
    import tempfile
    # The title gate is title_check's to test; these checks use their own picked titles.
    with tempfile.TemporaryDirectory() as tmp, title_check.picked_for_tests(
            ['I scored Muse against its rivals', "Muse's real rival: Siri.", 'New Claude. New ChatGPT. Does it even matter?'], tmp):
        return _self_test()


def _self_test():
    failed, checks = [], 0

    def ok(cond, what):
        nonlocal checks
        checks += 1
        if not cond:
            failed.append(f'FAIL: {what}')

    def raises(fn, pattern, what):
        try:
            fn()
        except StoryError as e:
            ok(re.search(pattern, str(e)) is not None, f'{what}: said {e}')
            return
        ok(False, f'{what}: no error')

    # The title: video_title, else the cover lines; never the long headline.
    long = "I scored Meta's Muse against ChatGPT, Gemini, Claude and Siri. It tied with Siri, for opposite reasons."
    ok(video_title({'video_title': 'I scored Muse against its rivals', 'headline': long}) == 'I scored Muse against its rivals', 'video_title wins')
    ok(video_title({'headline': long, 'cover': {'headline': ["Muse's real", 'rival: Siri.']}}) == "Muse's real rival: Siri.", 'cover lines next')
    raises(lambda: video_title({'headline': long}), r'no video_title', 'the article headline is never the title')
    raises(lambda: video_title({'video_title': "Muse vs ChatGPT isn't a fair fight"}), r'anti-dumb floor', 'a straw man title is refused')
    raises(lambda: video_title({'video_title': 'Three kinds of AI'}), r'anti-dumb floor', 'a bare topic title is refused')
    raises(lambda: video_title({'video_title': 'x' * 61}), r'61 characters', 'a long title fails before rendering')

    # The SVG aspect, for optical logo sizes.
    ok(svg_aspect(b'<svg viewBox="0 0 41.5 51" xmlns="x"></svg>') == round(41.5 / 51, 4), 'aspect from viewBox')
    ok(svg_aspect(b'<svg width="200" height="100"></svg>') == 2.0, 'aspect from width and height')

    # Render failures reduce to the sentence that matters.
    ok(render_failure('Error: STORY_FIT: the video title "X" does not fit its 9x16 area (840 x 900 px) even at the smallest size, 84 px. '
                      'Shorten video_title.\n    at foo').startswith('STORY_FIT: the video title "X"'), 'STORY_FIT is surfaced')
    ok(render_failure('blah "message":"STORY_FONT: the brand face(s) x did not load"').startswith('STORY_FONT: the brand face'), 'STORY_FONT is surfaced')

    # The check, on synthetic frame reports.
    rules = {'safe_areas': {'9x16': {'x0': 120, 'y0': 250, 'x1': 960, 'y1': 1480}, '16x9': {'x0': 96, 'y0': 54, 'x1': 1824, 'y1': 1026}},
             'faces': ['MYMU Anton', 'MYMU Archivo', 'MYMU Plex Mono'], 'tolerance_px': 1, 'overlap_share': 0.04}
    good = {'id': 'title-0', 'group': 'title', 'kind': 'text', 'op': 1, 'r': [120, 400, 900, 560], 'family': '"MYMU Anton"', 'fontOk': True, 'text': 'I SCORED'}
    ok(check_clip([{'clip': 'c', 'frame': f, 'items': [good]} for f in range(3)], 'c', 3, '9x16', rules)[0] == [], 'a clean clip passes')
    off = dict(good, id='title-3', r=[120, 1400, 1100, 1620], text='IT TIED')
    probs, marks = check_clip([{'clip': 'c', 'frame': f, 'items': [good, off]} for f in range(3)], 'c', 3, '9x16', rules)
    ok(len(probs) == 1 and ('past the right' in probs[0] or 'past the bottom' in probs[0]), f'text off the page is caught: {probs}')
    ok(marks.get(0), 'the problem is boxed on the sheet')
    sys_font = dict(good, id='label', group='x', family='Arial, sans-serif', r=[130, 1000, 300, 1040])
    probs, _ = check_clip([{'clip': 'c', 'frame': 0, 'items': [sys_font]}], 'c', 1, '9x16', rules)
    ok(any('not a brand face' in p for p in probs), f'a system font is caught: {probs}')
    unloaded = dict(good, fontOk=False)
    probs, _ = check_clip([{'clip': 'c', 'frame': 0, 'items': [unloaded]}], 'c', 1, '9x16', rules)
    ok(any('fallback font' in p for p in probs), f'an unloaded face is caught: {probs}')
    a = dict(good, id='left-name', group='left', r=[200, 600, 600, 660])
    b = dict(good, id='vs-text', group='vs', r=[500, 610, 640, 700])
    probs, _ = check_clip([{'clip': 'c', 'frame': 0, 'items': [a, b]}], 'c', 1, '9x16', rules)
    ok(any('collide' in p for p in probs), f'a collision is caught: {probs}')
    probs, _ = check_clip([{'clip': 'c', 'frame': 0, 'items': [a, dict(b, op=0.5)]}], 'c', 1, '9x16', rules)
    ok(probs == [], 'a crossfade is not a collision')
    probs, _ = check_clip([{'clip': 'c', 'frame': 0, 'items': [good]}], 'c', 3, '9x16', rules)
    ok(any('never checked' in p for p in probs), 'unchecked frames fail')
    ok(sheet_frames(90) == [0, 8, 15, 22, 30, 38, 45, 52, 60, 68, 75, 82, 89], f'a frame every 0.25 s: {sheet_frames(90)}')

    # The house config and the font files.
    try:
        r = check_rules()
        ok(r['safe_areas']['9x16']['y1'] <= 1500 and r['safe_areas']['9x16']['y0'] >= 200, 'the tall safe area clears the app overlays')
    except StoryError as e:
        ok(False, f'check rules: {e}')
    if (REPO / 'node_modules').is_dir():
        try:
            ok(len(brand_font_files()) >= 4, 'the brand font files are installed')
        except StoryError as e:
            ok(False, str(e))
        with tempfile.TemporaryDirectory() as tmp:
            css = Path(tmp) / 'fonts.css'
            css.write_text("src: url('@fontsource/no-such-face/files/x.woff2')", encoding='utf-8')
            raises(lambda: brand_font_files(css), r'missing: node_modules/@fontsource/no-such-face', 'a missing font file stops the render')

    # The plans: Wednesday's stand-off, and Monday and Friday still make props.
    plans = REPO / 'docs' / 'plans'
    real_brand = globals()['brand_images']
    globals()['brand_images'] = lambda: {'wordmark': 'data:image/png;base64,AA==', 'masthead': 'data:image/png;base64,AA=='}
    try:
        wed = plans / '2026-10-14-wednesday'
        if (wed / 'cover-facts.json').is_file():
            p = plan_props(wed)
            ok(p['title'] == "Muse's real rival: Siri.", f'Wednesday title: {p["title"]}')
            ok([len(p['left']['logos'])] + [len(r['logos']) for r in p['right']] == [3, 1], 'Wednesday: Meta, Instagram and WhatsApp against Apple')
            ok(p['left']['name'] == 'Muse, by Meta' and p['left'].get('tag') == 'Does the most', 'Wednesday left badge')
            ok(p['right'][0]['name'] == 'Siri' and p['right'][0].get('tag') == 'Keeps it private', 'Wednesday right badge')
            ok(all(k in p for k in OPTIONAL_KEYS), 'every optional value is written out')
            ok([c['name'] for c in p['cast']] == ['Siri', 'ChatGPT', 'Gemini', 'Claude'], f'Wednesday line-up: {[c["name"] for c in p["cast"]]}')
        fri = plans / '2026-10-09-friday'
        if (fri / 'cover-facts.json').is_file():
            p = plan_props(fri)
            ok(p['title'] == 'New\u00a0Claude. New\u00a0ChatGPT. Does\u00a0it\u00a0even\u00a0matter?', f'Friday title: {p["title"]!r}')
            ok(p['left']['name'] == 'Claude' and p['right'][0]['name'] == 'ChatGPT', 'Friday stand-off: Claude against ChatGPT')
            ok(p['commentQuestion'] == 'Would you let your AI decide how hard it thinks?', 'Friday outro question')
        if (MONDAY / 'cover-facts.json').is_file():
            p = plan_props(MONDAY)
            ok(p['right'][0].get('tagAfter') == 'Paid' and p['right'][0].get('switchesSides'), 'Monday keeps its twist')
    finally:
        globals()['brand_images'] = real_brand
    print('\n'.join(failed) if failed else f'story_io self-test passed: {checks} checks')
    return not failed


def main():
    if '--self-test' in sys.argv[1:]:
        sys.exit(0 if self_test() else 1)
    ap = argparse.ArgumentParser(description='The story intro and outro (the stand-off), rendered from a piece\'s props.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('props', help='write a piece\'s props JSON (default: Monday 12 October\'s)')
    p.add_argument('--plan', help='the piece\'s plan folder (docs/plans/<date>-<day>), or its cover-facts.json')
    p.add_argument('--out', default=str(REPO / '.cache' / 'story-io' / 'monday' / 'props.json'))
    p = sub.add_parser('render', help='render the intro and outro in both shapes, checked frame by frame')
    p.add_argument('--piece-props', required=True, help='the props JSON (apps/renderer/src/story/props.ts, without shape)')
    p.add_argument('--out', required=True, help='the folder for {intro,outro}-{16x9,9x16}.mp4 and the contact sheets')
    p.add_argument('--browser', help='the headless browser Remotion uses')
    p.add_argument('--only', help='a comma-separated subset of ' + ', '.join(CLIPS))
    p.add_argument('--json', action='store_true', help='print the results as JSON')
    a = ap.parse_args()
    try:
        if a.cmd == 'props':
            out = Path(a.out)
            out.parent.mkdir(parents=True, exist_ok=True)
            plan = Path(a.plan) if a.plan else MONDAY
            plan = plan.parent if plan.is_file() else plan
            out.write_text(json.dumps(plan_props(plan), indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
            print(out)
        else:
            only = [x.strip() for x in a.only.split(',')] if a.only else None
            results = render(a.piece_props, a.out, a.browser, only)
            if a.json:
                print(json.dumps(results, indent=1))
            else:
                for r in results:
                    print(f'{r["file"]}  {r["seconds"]:.3f} s  {r["frames"]} frames  {r["width"]}x{r["height"]}  sha256 {r["sha256"]}')
                    print(f'  checked every frame; contact sheet {r["contact_sheet"]}')
    except StoryError as e:
        sys.exit(f'story_io: {e}')


if __name__ == '__main__':
    main()
