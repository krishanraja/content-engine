"""Run the Library's native SVG checks without opening a browser.

Requires node, @resvg/resvg-js (or RESVG_MODULE), Pillow and fontTools.
Only review outputs and local font instances are written under the Library.
"""
import json
import os
import re
import subprocess
from uuid import uuid4
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageChops
from spacing import compare, include
from standard import audit
from pixel_alignment import close_stage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = HERE / '.scratch/library/out'


def native_fonts():
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    source = ROOT / 'assets/fonts/makeyourmindup'
    font_dir = OUT / 'fonts'
    font_dir.mkdir(parents=True, exist_ok=True)
    files = [ROOT / 'assets/fonts/makeyourmindup' / f for f in ('Anton-Regular.ttf', 'DMMono-Regular.ttf')]
    for style, weight in [('Upright', n) for n in (400, 500, 600, 800)] + [('Italic', 500)]:
        parent = source / f'Fraunces-{style}-Variable.ttf'
        target = font_dir / f'Fraunces-{style}-{weight}.ttf'
        if not target.exists() or target.stat().st_mtime < parent.stat().st_mtime:
            with TTFont(parent) as base:
                axes = {'opsz': 14, 'wght': weight, 'SOFT': 50, 'WONK': 0}
                instance = instantiateVariableFont(base, axes)
                instance['OS/2'].usWeightClass = weight
                instance.save(target)
        files.append(target)
    return list(map(str, files))


def run(mode, jobs, fonts):
    env = os.environ.copy()
    cache = ROOT.parents[1] / 'content-engine/.cache/visual-render/node_modules/@resvg/resvg-js'
    if cache.is_dir():
        env.setdefault('RESVG_MODULE', str(cache))
    result = subprocess.run(['node', 'native_raster.cjs'], input=json.dumps(dict(mode=mode, items=jobs, fonts=fonts)),
                            cwd=HERE, encoding='utf8', capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


def witnesses(item, svg):
    tree = ET.fromstring('<svg>'+svg+'</svg>')
    parents = {child: parent for parent in tree.iter() for child in parent}
    result = []
    for el in tree.iter():
        name = el.get('data-align-name') or el.get('data-spacing-name')
        if not name:
            continue
        branch = el
        ancestors = []
        parent = parents.get(el)
        while parent is not None and parent is not tree:
            ancestors.append(parent)
            shell = ET.Element(parent.tag,parent.attrib)
            shell.append(branch)
            branch = shell
            parent = parents[parent]
        scale, offset = 1, 0
        for a in reversed(ancestors):
            for kind, coords in re.findall(r'(translate|scale)\(([^)]*)\)',a.get('transform','')):
                v = list(map(float, re.split('[ ,]+',coords.strip())))
                if kind=='translate':
                    offset += scale*v[0]
                else:
                    scale *= v[0]
            if a.tag=='svg' and a.get('viewBox'):
                vx, _, vw, vh = map(float,a.get('viewBox').split())
                w, h = float(a.get('width')), float(a.get('height'))
                s = min(w/vw, h/vh)
                offset += scale*(float(a.get('x',0)) + (w-vw*s)/2-vx*s)
                scale *= s
        result.append((name, el.get('data-align-side'), scale, offset, ET.tostring(branch,encoding='unicode')))
    return result


def check(registry):
    fonts=native_fonts()
    native_dir=OUT/('alignment-'+uuid4().hex)
    native_dir.mkdir()
    try:
        measure_registry(registry, fonts, native_dir)
    finally:
        for image in native_dir.glob('*.png'):
            image.unlink()
        native_dir.rmdir()


def measure_registry(registry, fonts, native_dir):
    active={i['id']:i for i in registry['items'] if i.get('status')!='retired'}
    records=list(active.values())
    markup=run('art',[[i['id'],0,None] for i in records],fonts)
    alignment, spacing, endings = {}, {}, {}
    for batch in range(0,len(records),12):
        group=records[batch:batch+12]
        figures,isolated,annotations=[],[],[]
        for i,svg in zip(group,markup[batch:]):
            base=dict(w=i['width'],h=i['height'])
            figures.append(dict(**base,svg=svg,path=str(native_dir/(i['id']+'.png'))))
            for name,side,scale,offset,fragment in witnesses(i,svg):
                annotations.append((i,name,side,scale,offset))
                isolated.append(dict(**base,svg=fragment))
        run('paint',figures,fonts)
        pixels=run('paint',isolated,fonts)
        for i,svg in zip(group,markup[batch:]):
            ident=i['id']
            members=i['alignment']['members']
            columns=i['alignment']['columns']
            rows,intervals,painted=[],{},{}
            for (owner,name,side,scale,offset),bounds in zip(annotations,pixels):
                if owner is not i:
                    continue
                if bounds:
                    x,y,r,b=bounds
                    include(intervals,name,y,b)
                    painted.setdefault(name,[]).append(((r-x)/scale,(b-y)/scale))
                if side:
                    target=columns[members[name]]*scale+offset
                    measured=(bounds[2] if side=='right' else bounds[0]) if bounds else None
                    rows.append(dict(element=name,target=target,pixel=measured,
                                     passed=measured is not None and abs(target-measured)<=2))
            for missing in members.keys()-intervals.keys()-set(i['alignment'].get('optional',[])):
                rows.append(dict(element=missing,passed=False,reason='missing'))
            with Image.open(native_dir/(ident+'.png')) as im:
                if i.get('staircase'):
                    rows.append(close_stage(i,im))
                for error in audit(i,svg,painted,raster=im,templates=active):
                    rows.append(dict(reason=error,passed=False))
            spacing[ident]=compare(i,intervals,native=True)
            alignment[ident]=dict(passed=all(r['passed'] for r in rows),elements=rows)
    why = [i for i in records if i.get('headline_caption_gap')]
    sheets = run('art',[[i['id'],400,None] for i in why],fonts)
    for i,svg in zip(why,sheets):
        lines=[w for w in witnesses(i,svg) if w[0] in ('headline_1','house caption')]
        boxes=run('paint',[dict(svg=w[-1],w=i['width'],h=i['height']) for w in lines],fonts)
        tops=[b[1] for w,b in zip(lines,boxes) if b and w[0]=='house caption']
        ends=[b[3] for w,b in zip(lines,boxes) if b and w[0]=='headline_1']
        gap=min(tops)-max(ends) if tops and ends else None
        result=dict(element='headline to caption',gap_px=gap,passed=gap is not None and abs(gap-i['headline_caption_gap'])<=2)
        record=alignment[i['id']]
        record['elements'].append(result)
        record['passed'] = record['passed'] and result['passed']
    for shape in ('vertical','wide'):
        with Image.open(native_dir/f'video-{shape}-close.png') as a, Image.open(native_dir/f'video-{shape}-outro.png') as b:
            endings[shape]=ImageChops.difference(a.convert('RGB'),b.convert('RGB')).getbbox() is None
    (OUT/'ink-alignment.json').write_text(json.dumps(dict(method='native resvg isolated ink',tolerance_px=2,
          closing_matches=endings,items=alignment),indent=2),encoding='utf8')
    (OUT/'ink-spacing.json').write_text(json.dumps(dict(method='native resvg isolated ink',items=spacing),indent=2),encoding='utf8')
    bad=[k for k,v in alignment.items() if not v['passed']]
    short=[k for k,v in spacing.items() if not v['passed']]
    print(f'{len(records)} native items. Ink alignment failures {len(bad)}. Ink spacing failures {len(short)}. Close matches {endings}.')
    if bad or short or not all(endings.values()):
        raise SystemExit(f'Alignment: {bad}. Spacing: {short}.')
