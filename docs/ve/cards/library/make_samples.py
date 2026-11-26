"""Draw the committed stand-ins in samples/ for the Library's local review files.

The Library's sample photographs and source documents live under .scratch/ on the machine that made them and are
never committed: the generated exemplars, the press photographs credited in library.json and the Spotify for Artists
capture. On a clean checkout library.html falls back to samples/<name>.svg for any of them it cannot load, so every
template still renders. Each stand-in is a small SVG at the registry's exact size: a flat house-colour field with a
lighter block on the photo's focal box, or grey bars on the document's measured lines. None is a photograph, and none
shows a person: Krish's private headshot files have no stand-in, and the templates show their camera guide instead.
SVG keeps them inside the repository's no-media rule (scripts/check-no-secrets.ts).

    python make_samples.py           # redraw samples/ from library.json
    python make_samples.py --check   # fail when a stand-in is missing, stale or not in the registry
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'samples'
INK = (12, 21, 18)
COLOURS = {'mint': (126, 240, 192), 'coral': (255, 106, 77), 'butter': (255, 216, 77), 'lilac': (183, 166, 255)}
PAGE, LINE = '#F5F5F5', '#3C3C3C'
DOCUMENT = ('doc-spotify-streams', 1800, 3000)


def stand_in(path):
    """The committed stand-in for a local review file, or None for files that must never have one."""
    if '.scratch/' not in path or '.scratch/private/' in path:
        return None
    return Path(path).stem + '.svg'


def mix(colour, amount):
    return '#%02X%02X%02X' % tuple(round(c*amount + i*(1-amount)) for c, i in zip(colour, INK))


def svg(width, height, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">{body}</svg>\n')


def n(value):
    return f'{value:.1f}'.rstrip('0').rstrip('.')


def photo_svg(photo):
    colour = next((COLOURS[word] for word in COLOURS if word in photo.get('exemplar', '').lower()), COLOURS['mint'])
    width, height = photo['width'], photo['height']
    focus = photo.get('focus') or {'x': .2, 'y': .1, 'w': .6, 'h': .8}
    x, y, w, h = focus['x']*width, focus['y']*height, focus['w']*width, focus['h']*height
    return svg(width, height, f'<rect width="{width}" height="{height}" fill="{mix(colour, .28)}"/>'
               f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" rx="{n(min(w, h)*.08)}" '
               f'fill="{mix(colour, .7)}"/>')


def document_svg(width, height, rows, ink=None):
    bars = ''
    for x, y, w, h in rows:
        bar = min(h, ink or h*.7)
        bars += f'<rect x="{n(x)}" y="{n(y+(h-bar)/2)}" width="{n(w)}" height="{n(bar)}"/>'
    return svg(width, height, f'<rect width="{width}" height="{height}" fill="{PAGE}"/><g fill="{LINE}">{bars}</g>')


def plan(registry):
    """File name to SVG text for every local review file the page reads."""
    jobs = {}
    for name, photo in registry['photos'].items():
        path = photo.get('path') or ('' if 'src' in photo else f'.scratch/why-ladder/assets/{name}.png')
        file = stand_in(path)
        if file:
            jobs[file] = photo_svg(photo)
    rows = {DOCUMENT[0]: []}
    for crop in registry['crops'].values():
        rows[DOCUMENT[0]] += [crop['logo'], *crop.get('lines', [])]
        mobile = crop.get('mobile')
        if mobile:
            target = rows.setdefault(Path(mobile['path']).stem, [])
            target += mobile.get('compact', [])
            for shape in mobile.get('video_rows', {}).values():
                target += [rect for row in shape for rect in row]
    jobs[DOCUMENT[0] + '.svg'] = document_svg(DOCUMENT[1], DOCUMENT[2], rows[DOCUMENT[0]])
    for shot in registry['screenshots'].values():
        file = stand_in(shot['src'])
        if not file:
            continue
        stem = Path(file).stem
        mobile = next((c['mobile'] for c in registry['crops'].values()
                       if Path(c.get('mobile', {}).get('path', '')).stem == stem), {})
        jobs[file] = document_svg(*shot['size'], rows.get(stem, []) + shot.get('crops', []), mobile.get('line_ink_px'))
    return jobs


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help='Verify the committed stand-ins without drawing')
    args = parser.parse_args()
    jobs = plan(json.loads((HERE/'library.json').read_text(encoding='utf-8')))
    if args.check:
        wrong = [file+' missing or stale' for file, text in sorted(jobs.items())
                 if not (OUT/file).is_file() or (OUT/file).read_text(encoding='utf-8') != text]
        wrong += [p.name+' is not a registry stand-in' for p in sorted(OUT.glob('*')) if p.name not in jobs]
        if wrong:
            sys.exit('Run python make_samples.py:\n' + '\n'.join(wrong))
        print(f'{len(jobs)} stand-ins match library.json.')
        return
    OUT.mkdir(exist_ok=True)
    for file, text in sorted(jobs.items()):
        (OUT/file).write_text(text, encoding='utf-8', newline='\n')
    print(f'Drew {len(jobs)} stand-ins in {OUT}.')


if __name__ == '__main__':
    main()
