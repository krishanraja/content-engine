"""Content-addressed inputs for native template exports, independent of file mtimes."""
import ast
import hashlib
from importlib import metadata
import json
import os
import re
import subprocess
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import __version__ as pillow_version
from font_metrics import font_metrics


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(value):
    return sha(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def file_hash(path):
    if not path.is_file():
        return None
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def load_registry(here):
    data = json.loads((here/'library.json').read_text(encoding='utf-8'))
    html = (here/'library.html').read_text(encoding='utf-8')
    if json.loads(html.split('const registry=', 1)[1].split(';\n', 1)[0]) != data:
        raise ValueError('The embedded registry differs from library.json')
    return data, html


def active_items(data):
    items = {}
    for item in data['items']:
        key = item['id']
        if item.get('status') == 'retired':
            continue
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', key) or key in items:
            raise ValueError(f'Invalid or duplicate template ID: {key}')
        items[key] = item
    return items


def graph(here):
    root = here.parents[3]
    env = os.environ.copy()
    shared = root.parents[1]/'content-engine/node_modules'
    if shared.is_dir():
        env['NODE_PATH'] = os.pathsep.join(filter(None, (env.get('NODE_PATH'), str(shared))))
    result = subprocess.run(['node', 'render_graph.cjs'], cwd=here, env=env,
                            input=json.dumps(font_metrics(root)), capture_output=True, encoding='utf8')
    if result.returncode:
        raise ValueError('Template dependency analysis failed: '+result.stderr.strip())
    return json.loads(result.stdout)


def python_components(path, names):
    tree = ast.parse(path.read_text(encoding='utf8'))
    return {node.name:sha(ast.dump(node).encode()) for node in tree.body
            if isinstance(node,ast.FunctionDef) and node.name in names}


def export_css(css):
    # These selectors belong to the surrounding review sheet. Unknown or nested
    # rules stay in the hash so new export styling cannot slip past the planner.
    sheet = re.compile(r'^(?:header|h[1-4]|nav|figcaption|figure|summary|section|'
                      r'\.(?:grid|samples|week|marks|swatches|contact|crop-grid|rule|'
                      r'type-proof|player|meta|speeds|image-brief))(?![\w-])')
    def rule(match):
        selectors=match[1].strip().split(',')
        return '' if all(sheet.match(s.strip()) for s in selectors) else match[0]
    return re.sub(r'([^{}]+)\{([^{}]*)\}',rule,css).strip()


def plan(here, data, html, backend, prior):
    root = here.parents[3]
    bits = {file.name: file_hash(file) for file in
            [here/n for n in ('render.py','render_inputs.py','render_graph.cjs','frame_capture.py',
                              'encode_motion.py','render_cache.py','font_metrics.py','offline_art.cjs')]}
    if backend == 'resvg':
        for name in ('native_proof.py','native_raster.cjs'):
            bits[name] = file_hash(here/name)
    scripts = re.findall(r'<script\s+src="([^"]+)"',html)
    bank_path = here/data['imagery']['house_stills']
    bank = {entry['id']:entry for entry in json.loads(bank_path.read_text(encoding='utf8'))}
    css = re.search(r'<style>(.*?)</style>',html,re.S)[1]
    faces = re.findall(r'@font-face\s*\{([^}]+)\}',css)
    bootstrap = html.split('window.ready=',1)[1].split('const heading=',1)[0]
    # Review forms are registered between image loading and standalone item routing.
    bootstrap = bootstrap.split("main.addEventListener('change'",1)[0]+bootstrap.split('window.renderLibraryView=')[-1]
    paint = python_components(here/'render_cache.py', {'export'})
    if backend=='browser':
        paint.update(python_components(here/'render.py', {'capture_page','render_full'}))
        paint.update(python_components(here/'frame_capture.py', {'browser_frames'}))
        paint['playwright']=metadata.version('playwright')
    else:
        paint.update(python_components(here/'native_proof.py', {'native_fonts','run'}))
        paint.update(python_components(here/'frame_capture.py', {'native_frames'}))
        paint['raster']=bits['native_raster.cjs']
        paint['vm']=bits['offline_art.cjs']
        paint['fonttools']=metadata.version('fonttools')
    common = digest([paint, backend, pillow_version, scripts,
                     export_css(re.sub(r'@font-face\s*\{[^}]+\}', '', css)), bootstrap])
    # Re-discover code paths on a source edit. A media-only edit reuses the recipes.
    # Include file presence because a camera or photograph can replace a fallback.
    photos = data['photos']
    def relative(path):
        return Path(os.path.relpath(path.resolve(),here)).as_posix()
    def photo_path(key):
        row = photos[key]
        if 'src' in row:
            return here/row['src'] if row['src'] else None
        path = root/row['path'] if row.get('path') else root/'.scratch/why-ladder/assets'/f'{key}.png'
        # The page falls back to the committed stand-in (make_samples.py) when the local review file is absent.
        sample = here/'samples'/(path.stem+'.svg')
        if not path.is_file() and '.scratch' in path.parts and 'private' not in path.parts and sample.is_file():
            return sample
        return path
    # Font metrics can change fitted lines, hence the list of components traversed.
    font_files = [here/url for face in faces for url in re.findall(r"url\(['\"]?([^'\")]+)",face)]
    planner = digest([sha(html.encode()), [file_hash(here/f) for f in scripts],bits,
                      [file_hash(f) for f in font_files], [k for k in photos if (path:=photo_path(k)) and path.is_file()]])
    if prior.get('planner') == planner and prior.get('recipes'):
        traced = prior['recipes']
    else:
        traced = graph(here)
    items = active_items(data)
    if set(traced['recipes']) != set(items):
        raise ValueError('Dependency graph and active templates disagree')
    defs = ET.fromstring(re.search(r'<defs>.*?</defs>',html,re.S)[0])
    symbols = {el.get('id'):el for el in defs.iter() if el.get('id')}
    hashes = {}
    plans = {}
    for key, receipt in traced['recipes'].items():
        files = set(receipt['files'])
        code = {c:traced['components'][c] for c in receipt['code']}
        for startup in ('library.html/artFrame','imagery.js/registerCarouselEvidence'):
            code[startup] = traced['components'][startup]
        roots = {n:v for n,v in traced['roots'].items() if n!='review.js' or any(c.startswith(n+'/') for c in code)}
        symbols_used = {}
        def symbol(name):
            if name in symbols_used or name.startswith('stripe-'):
                return  # stripe clip paths are generated per render from the item's own text
            node=symbols.get(name)
            if node is None:
                raise ValueError(f'{key}: missing SVG component #{name}')
            xml=ET.tostring(node,encoding='unicode')
            symbols_used[name]=sha(xml.encode())
            for el in node.iter():
                url=el.get('href','')
                if url.startswith('#'):
                    symbol(url[1:])
                elif url and not url.startswith('data:'):
                    files.add(url)
            for ref in re.findall(r'url\(#([^)]*)\)',xml):
                symbol(ref)
        for name in receipt['defs']:
            symbol(name)
        photo_inputs = {}
        for name in receipt['photos']:
            if name not in photos:
                raise ValueError(f'{key}: unregistered photograph {name}')
            if path:=photo_path(name):
                files.add(relative(path))
            photo_inputs[name]=digest([photos[name],bank.get(name)])
        fonts = []
        for face in faces:
            name=re.search(r'font-family:\s*([^;]+)',face)[1].strip()
            name+=('/italic' if 'font-style:italic' in face else '')
            if name in receipt['fonts']:
                fonts.append(face)
                files.update(re.findall(r"url\(['\"]?([^'\")]+)",face))
        parts = {'entry':digest(items[key]), 'components':code, 'definitions':symbols_used,
                 'photos':photo_inputs,'fonts':digest(fonts),'globals':roots,'capture':common,
                 'svg_samples':receipt['svg_samples'],
                 'nested':{k:digest(items[k]) for k in receipt['items'] if k!=key},
                 'crops':{k:digest(data['crops'].get(k)) for k in receipt['crops']}}
        visual_items = [items[k] for k in receipt['items']]
        evidence = {}
        for vi in visual_items:
            for op in vi.get('scene',[]):
                kind,value=op['kind'],op.get('value')
                if kind=='screenshot':
                    evidence[value]=data['screenshots'].get(value)
                if kind in ('tool-logos','document'):
                    for logo in value if isinstance(value,list) else [value]:
                        if logo in data['tool_logos']:
                            evidence[logo]=data['tool_logos'][logo]
        parts['evidence']=digest(evidence)
        if backend=='resvg':
            # resvg instantiates upright Fraunces from the master in assets/fonts.
            if 'Fraunces' in receipt['fonts']:
                files.add(relative(root/'assets/fonts/makeyourmindup/Fraunces-Upright-Variable.ttf'))
        canvas_keys={str(i['width'])+'x'+str(i['height']) for i in visual_items}
        profiles={i.get('grid_profile') for i in visual_items}
        grid=data['grid']
        canvases={k:v for k,v in grid['canvases'].items() if k in canvas_keys or
                  (canvas_keys-grid['canvases'].keys() and profiles.intersection(v.get('profiles',{})))}
        parts['grid']=digest([{k:v for k,v in grid.items() if k!='canvases'},canvases])
        if receipt['fonts']:
            parts['spacing']=digest(data['spacing'])
        paths = {}
        for f in sorted(files):
            if re.match(r'^[a-z]+:',f,re.I):
                raise ValueError(f'{key}: non-local render input {f}')
            f=relative(here/f)
            if f not in hashes:
                hashes[f]=file_hash(here/f)
            paths[f]=hashes[f]
        parts['files']=paths
        plans[key]={'input_sha256':digest(parts),'dependencies':parts}
    return {'planner':planner,'recipes':traced,'items':plans}
