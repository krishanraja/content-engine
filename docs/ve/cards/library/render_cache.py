"""Track exported template files. Publish their receipts only after a successful render."""
import io
import hashlib
import os
import re
import subprocess
from PIL import Image

from encode_motion import encode_frames
from frame_capture import decoded_hash, workspace
from render_inputs import active_items, digest, file_hash, load_registry, plan
from render_lock import atomic_json, read_json, verify


def read_manifest(out):
    path = out/'render-manifest.json'
    if not path.exists():
        return {}
    previous = read_json(path)
    if previous.get('version') != 1 or not isinstance(previous.get('items'),dict):
        raise ValueError('Unreadable render manifest. Move it aside to start a new baseline.')
    return previous


def filename(key, kind):
    return f'motion/{key}.mp4' if kind=='motion' else f'{kind}/{key}.png'


def current(path, record, input_hash):
    return bool(record and record.get('input_sha256')==input_hash and
                re.fullmatch('[0-9a-f]{64}', record.get('sha256','')) and file_hash(path)==record['sha256'])


def new_receipt(path, input_hash):
    value = file_hash(path)
    if value is None:
        raise ValueError(f'Missing export {path.name}')
    return dict(input_sha256=input_hash, sha256=value)


def export(here, out, backend, book, capture, *, full=None, phone=False, motion=False, only_motion=False):
    previous = read_manifest(out)
    if motion:
        codec = subprocess.check_output(['ffmpeg','-version'])
        encoder = [hashlib.sha256(codec).hexdigest(),file_hash(here/'encode_motion.py')]
    def output_input(entry, kind):
        value = entry['input_sha256']
        return digest([value,encoder]) if kind=='motion' else value
    data, html = load_registry(here)
    items = active_items(data)
    snapshot = plan(here,data,html,backend,previous)
    jobs = {}
    for key, entry in snapshot['items'].items():
        old = previous.get('items',{}).get(key,{})
        outputs = dict(old.get('outputs',{}))
        entry['outputs'] = outputs
        kinds = [] if only_motion else ['items']
        if phone:
            kinds.append('phone')
        if motion and (items[key].get('motion') or {}).get('tracks'):
            kinds.append('motion')
        for kind in kinds:
            name = filename(key,kind)
            if full or not current(out/name, outputs.get(name), output_input(entry,kind)):
                jobs.setdefault(key,[]).append(kind)
    # Check affected approvals before replacing any export. A full render also catches removals.
    rows = [row for row in book['locked'] if full or row['id'] in jobs or row['id'] not in items]
    locked = {row['id']:row['fingerprint'] for row in rows}
    if rows:
        verify(rows,items,capture,here/'.scratch/library')
        other = [dict(row, renderer=backend) for row in rows if row['renderer']!=backend]
        if other:
            verify(other,items,capture,here/'.scratch/library')
    if not jobs and not full and previous.get('items',{}).keys()==items.keys() and previous.get('planner')==snapshot['planner']:
        print('Rendered 0 templates. All requested exports match the manifest.')
        return
    out.mkdir(parents=True,exist_ok=True)
    with workspace(out) as staging:
        if full:
            full(staging)
        for key,kinds in jobs.items():
            item = items[key]
            outputs = snapshot['items'][key]['outputs']
            poster = None
            for kind in kinds:
                name = filename(key,kind)
                target = staging/name
                if not full:
                    target.parent.mkdir(parents=True,exist_ok=True)
                    if kind=='motion':
                        count = item['motion']['frames']
                        encode_frames(capture(backend)(item,range(count)),target,item['width'],item['height'],count)
                    else:
                        if poster is None:
                            settled = (item.get('motion') or {}).get('frames',1)-1
                            poster, = capture(backend)(item,[settled])
                        with Image.open(io.BytesIO(poster)) as image:
                            if image.size!=(item['width'],item['height']):
                                raise ValueError(f'{key}: unexpected poster dimensions')
                            if kind=='phone':
                                image.resize((360,max(1,round(image.height*360/image.width))),
                                             Image.Resampling.LANCZOS).save(target)
                            else:
                                target.write_bytes(poster)
                if key in locked and kind=='items':
                    with Image.open(target) as proof:
                        actual = hashlib.sha256(proof.convert('RGB').tobytes()).hexdigest()
                    if actual != locked[key]['settled_rgb24_sha256']:
                        raise ValueError(f'LOCK FAILED {key}: exported poster differs from approval')
                if key in locked and kind=='motion':
                    fp = locked[key]
                    size = fp['width']*fp['height']*3//2*fp['frames']
                    if decoded_hash(target,size)!=fp['decoded_yuv420p_sha256']:
                        raise ValueError(f'LOCK FAILED {key}: exported motion differs from approval')
                outputs[name] = new_receipt(target,output_input(snapshot['items'][key],kind))
            print(f'Rendered {key} ({", ".join(kinds)})',flush=True)
        now, source = load_registry(here)
        again = plan(here,now,source,backend,snapshot)
        if ({k:v['input_sha256'] for k,v in again['items'].items()} !=
            {k:v['input_sha256'] for k,v in snapshot['items'].items()}):
            raise ValueError('Render inputs changed during capture. Rerun to build a consistent manifest.')
        for path in staging.rglob('*'):
            if path.is_file():
                dest = out/path.relative_to(staging)
                dest.parent.mkdir(parents=True,exist_ok=True)
                if file_hash(dest)!=file_hash(path):
                    os.replace(path,dest)
        atomic_json(out/'render-manifest.json',dict(version=1,renderer=backend,**snapshot))
    print(f'Rendered {len(jobs)} of {len(items)} templates. Saved render-manifest.json.')
