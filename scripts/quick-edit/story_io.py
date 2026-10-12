#!/usr/bin/env python3
"""The story intro and outro (the stand-off), rendered from a piece's props.

The design lives in the renderer (apps/renderer/src/story): four Remotion
compositions, StoryIntroStandoffWide/Tall and StoryOutroStandoffWide/Tall,
driven entirely by one props object (apps/renderer/src/story/props.ts). They
are silent; the music is mixed elsewhere. Nothing here is approved yet:
docs/plans/2026-10-12-story-io/README.md.

    python story_io.py props [--out PROPS.json]
        Monday 12 October's props: the series from
        docs/plans/2026-10-12-monday/cover-facts.json, the real logo files
        from its logos folder as data URIs (Warner, Universal and Sony are the
        individual official marks embedded in the cover's composite files;
        BMG is left out), the brand's own wordmark and masthead images
        (scripts/pages/brand.py), and the story's words.

    python story_io.py render --piece-props PROPS.json --out DIR [--browser PATH] [--only intro-16x9,...]
        Bundles apps/renderer/src/index.ts once and renders
        DIR/{intro,outro}-{16x9,9x16}.mp4 (h264, yuv420p, 30 fps, no audio),
        then prints each file's sha256 and duration.

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

REPO = Path(__file__).resolve().parents[2]
ENTRY = REPO / 'apps' / 'renderer' / 'src' / 'index.ts'
MONDAY = REPO / 'docs' / 'plans' / '2026-10-12-monday'
FPS = 30
CLIPS = {
    'intro-16x9': ('StoryIntroStandoffWide', '16x9', (1920, 1080)),
    'intro-9x16': ('StoryIntroStandoffTall', '9x16', (1080, 1920)),
    'outro-16x9': ('StoryOutroStandoffWide', '16x9', (1920, 1080)),
    'outro-9x16': ('StoryOutroStandoffTall', '9x16', (1080, 1920)),
}
SERIES_COLOURS = {'follow.the.money': '#FFD84D', 'under.the.hood': '#B7A6FF', 'mind.the.gap': '#FF6A4D'}


class StoryError(ValueError):
    """Why the story intro and outro cannot be made, in plain words."""


def data_uri(svg_bytes):
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg_bytes).decode('ascii')


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
    return {
        'seriesColour': SERIES_COLOURS[series],
        'seriesName': series,
        'left': {'name': 'Suno', 'logo': data_uri(suno), 'role': 'AI song app'},
        'right': [
            {'name': 'Warner', 'logo': partners['wmg-symbol-cream.svg'], 'stampBefore': 'Suing', 'stampAfter': 'Paid', 'switchesSides': True},
            {'name': 'Universal', 'logo': suing['umg-logo-cream.svg'], 'stampBefore': 'Suing'},
            {'name': 'Sony', 'logo': suing['sonymusic-symbol-cream.svg'], 'stampBefore': 'Suing'},
        ],
        'question': 'Who gets paid for AI songs?',
        'questionEmphasis': 'gets paid',
        'link': 'makeyourmindup.ai',
        'commentQuestion': 'Should a singer get paid when an AI learns from their song?',
        'nextLabel': 'Wednesday · under.the.hood',
        'brand': brand_images(),
    }


def brand_images():
    """The brand's one-line wordmark and stacked masthead, full size and
    unaltered, as data URIs (fetched through scripts/pages/brand.py, so any
    machine gets them from makeyourmindup.ai/brand/ or its cache)."""
    return {'wordmark': house_brand.brand_uri('wordmark', full=True), 'masthead': house_brand.brand_uri('masthead', full=True)}


NEXT_DAY = {'follow.the.money': 'Wednesday · under.the.hood', 'under.the.hood': 'Friday · mind.the.gap',
            'mind.the.gap': 'Monday · follow.the.money'}


def plan_props(folder):
    """Any piece's props. A plan may hold its own (story-io.json beside
    cover-facts.json, logos as paths relative to the plan); otherwise they
    are drawn from the cover facts the piece already has: the first cover
    row is the left corner, the others line up against it with their cover
    tags as stamps, and the question is the cover's headline. Monday 12
    October keeps its hand-made props (monday_props)."""
    folder = Path(folder)
    if folder.resolve() == MONDAY.resolve():
        return monday_props(folder)
    facts = json.loads((folder / 'cover-facts.json').read_text(encoding='utf-8'))
    series = facts.get('subchannel')
    if series not in SERIES_COLOURS:
        raise StoryError(f'cover-facts.json names the series {series!r}, not one of {", ".join(SERIES_COLOURS)}')

    def logo(rel):
        return data_uri((folder / rel).read_bytes()) if rel and (folder / rel).is_file() else rel

    own = folder / 'story-io.json'
    if own.is_file():
        props = json.loads(own.read_text(encoding='utf-8'))
        props['left']['logo'] = logo(props['left'].get('logo'))
        for r in props.get('right') or []:
            r['logo'] = logo(r.get('logo'))
        return {'seriesColour': SERIES_COLOURS[series], 'seriesName': series, 'link': 'makeyourmindup.ai',
                'nextLabel': NEXT_DAY[series], **props}
    rows = (facts.get('cover') or {}).get('rows') or []
    if len(rows) < 2:
        raise StoryError(f'{folder.name}: the cover has {len(rows)} row(s); the stand-off needs two or more, or a story-io.json')
    first, rest = rows[0], rows[1:]
    question = str(facts.get('headline') or facts.get('title') or '').strip()
    comment = ''
    for script in sorted(folder.parent.glob(f'{folder.name[:10]}-draft-script*.md')):
        said = re.search(r'Tell me in the comments:?\s*([^?]+\?)', script.read_text(encoding='utf-8'))
        if said:
            comment = said.group(1).strip()
            comment = comment[:1].upper() + comment[1:]
            break
    return {
        'seriesColour': SERIES_COLOURS[series],
        'seriesName': series,
        'left': {'name': first['name'], 'logo': logo(first.get('logo')), 'role': str(first.get('tag') or '')},
        'right': [{'name': r['name'], 'logo': logo(r.get('logo')), 'stampBefore': str(r.get('tag') or '')} for r in rest],
        'question': question,
        'link': 'makeyourmindup.ai',
        'commentQuestion': comment or question,
        'nextLabel': NEXT_DAY[series],
    }


REMOTION = r"""
import { readFileSync } from 'node:fs'
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
  await renderMedia({ composition, serveUrl, codec: 'h264', crf: 14, imageFormat: 'png', pixelFormat: 'yuv420p', muted: true,
    outputLocation: clip.out, inputProps: clip.inputProps, logLevel: 'error', ...opts })
  console.log(JSON.stringify({ id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, frames: composition.durationInFrames }))
}
"""


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
    out_dir = Path(out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    names = only or list(CLIPS)
    unknown = [n for n in names if n not in CLIPS]
    if unknown:
        raise StoryError(f'no such clip: {", ".join(unknown)} (the clips are {", ".join(CLIPS)})')
    if not shutil.which('node'):
        raise StoryError('node is not on the PATH, so the story intro and outro cannot be rendered here')
    clips = [{'id': CLIPS[n][0], 'out': str(out_dir / f'{n}.part.mp4'), 'inputProps': {**piece, 'shape': CLIPS[n][1]}} for n in names]
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
        raise StoryError(f'Remotion could not render the story clips: {((p.stderr or "") + (p.stdout or "")).strip()[-1200:]}')
    results = []
    for n in names:
        part, final = out_dir / f'{n}.part.mp4', out_dir / f'{n}.mp4'
        info = probe(part)
        w, h = CLIPS[n][2]
        want = {'codec': 'h264', 'width': w, 'height': h, 'fps': f'{FPS}/1', 'pix_fmt': 'yuv420p'}
        wrong = {k: (info[k], v) for k, v in want.items() if info[k] != v}
        if wrong:
            raise StoryError(f'{n} is not in the house form: {wrong}')
        os.replace(part, final)
        results.append({'clip': n, 'file': str(final), 'sha256': sha256(final), **info})
    return results


def main():
    ap = argparse.ArgumentParser(description='The story intro and outro (the stand-off), rendered from a piece\'s props.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('props', help='write a piece\'s props JSON (default: Monday 12 October\'s)')
    p.add_argument('--plan', help='the piece\'s plan folder (docs/plans/<date>-<day>), or its cover-facts.json')
    p.add_argument('--out', default=str(REPO / '.cache' / 'story-io' / 'monday' / 'props.json'))
    p = sub.add_parser('render', help='render the intro and outro in both shapes')
    p.add_argument('--piece-props', required=True, help='the props JSON (apps/renderer/src/story/props.ts, without shape)')
    p.add_argument('--out', required=True, help='the folder for {intro,outro}-{16x9,9x16}.mp4')
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
    except StoryError as e:
        sys.exit(f'story_io: {e}')


if __name__ == '__main__':
    main()
