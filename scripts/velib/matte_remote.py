"""The matte job that runs on the rented pod (scripts/velib/matte_pod.py sends it there); never run in a cut.

    python matte_remote.py IN.mp4 OUT_DIR MODELS_JSON

For each model named in MODELS_JSON (the entries of matte_pod.MODELS, with their pins) it writes
OUT_DIR/<model>.alpha.mp4, a lossless 8-bit gray video with one alpha frame per frame of IN.mp4 (the same layout as
velib/matte.py writes), and OUT_DIR/<model>.json with the pins it checked and how long it took. Weights are checked
against their sha256 before they load; a mismatch stops that model. A model that fails leaves its error in its JSON
and the next one still runs. Exit 0 when at least one model wrote its matte.

Licences: BiRefNet (MIT) loads from its Hugging Face repository at a pinned commit. RobustVideoMatting is GPL-3.0: it is
cloned on the pod at a pinned commit and run there as a separate tool, never copied into this repository.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path


def sha256(path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def probe(take):
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams',
                                               '-of', 'json', str(take)]))['streams'][0]
    return info['width'], info['height'], info['r_frame_rate']


def frames(take, width, height):
    decoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(take), '-map', '0:v:0', '-fps_mode', 'passthrough',
                                '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    size = width * height * 3
    try:
        while True:
            data = decoder.stdout.read(size)
            if not data:
                break
            if len(data) != size:
                raise ValueError('truncated decoded frame')
            yield data
    finally:
        decoder.stdout.close()
        if decoder.poll() is None:
            decoder.terminate()
        decoder.wait()


def encoder(path, width, height, fps):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'gray',
                             '-video_size', f'{width}x{height}', '-framerate', fps, '-i', '-',
                             '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'gray', str(path)], stdin=subprocess.PIPE)


def fetch(url, dest, want):
    import urllib.request  # noqa: PLC0415
    dest = Path(dest)
    if not dest.is_file():
        urllib.request.urlretrieve(url, dest)  # noqa: S310 - a pinned release asset, checked below
    got = sha256(dest)
    if got != want:
        raise ValueError(f'{dest.name}: sha256 {got} is not the pinned {want}')
    return dest


def birefnet(spec, cache):
    import torch  # noqa: PLC0415
    from huggingface_hub import hf_hub_download  # noqa: PLC0415
    from transformers import AutoModelForImageSegmentation  # noqa: PLC0415
    weights = hf_hub_download(spec['repo'], 'model.safetensors', revision=spec['revision'], cache_dir=cache)
    got = sha256(weights)
    if got != spec['sha256']:
        raise ValueError(f'model.safetensors sha256 {got} is not the pinned {spec["sha256"]}')
    model = AutoModelForImageSegmentation.from_pretrained(spec['repo'], revision=spec['revision'], cache_dir=cache,
                                                          trust_remote_code=True)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    half = device == 'cuda'
    model = model.to(device).eval()
    if half:
        model = model.half()
    side = int(spec['resolution'])
    mean = torch.tensor([0.485, 0.456, 0.406], device=device).view(1, 3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225], device=device).view(1, 3, 1, 1)

    def step(rgb, width, height):
        with torch.no_grad():
            x = torch.frombuffer(bytearray(rgb), dtype=torch.uint8).to(device).view(height, width, 3)
            x = x.permute(2, 0, 1).unsqueeze(0).float() / 255.0
            x = torch.nn.functional.interpolate(x, size=(side, side), mode='bilinear', align_corners=False)
            x = (x - mean) / std
            pred = model(x.half() if half else x)[-1].float().sigmoid()
            pred = torch.nn.functional.interpolate(pred, size=(height, width), mode='bilinear', align_corners=False)
            return (pred.clamp(0, 1)[0, 0] * 255).round().to(torch.uint8).cpu().numpy().tobytes()
    return step


def rvm(spec, cache):
    import torch  # noqa: PLC0415
    code = Path(cache) / 'RobustVideoMatting'
    if not code.is_dir():
        subprocess.run(['git', 'clone', '-q', spec['repo'], str(code)], check=True)
    subprocess.run(['git', '-C', str(code), 'checkout', '-q', spec['revision']], check=True)
    weights = fetch(spec['weights_url'], Path(cache) / Path(spec['weights_url']).name, spec['sha256'])
    sys.path.insert(0, str(code))
    from model import MattingNetwork  # noqa: PLC0415 - the pinned clone on the pod
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = MattingNetwork(spec['variant'])
    model.load_state_dict(torch.load(weights, map_location='cpu'))
    model = model.to(device).eval()
    state = {'rec': [None] * 4}
    ratio = float(spec['downsample_ratio'])

    def step(rgb, width, height):
        with torch.no_grad():
            x = torch.frombuffer(bytearray(rgb), dtype=torch.uint8).to(device).view(height, width, 3)
            x = x.permute(2, 0, 1).unsqueeze(0).float() / 255.0
            _fgr, pha, *rec = model(x, *state['rec'], downsample_ratio=ratio)
            state['rec'] = rec
            return (pha.clamp(0, 1)[0, 0] * 255).round().to(torch.uint8).cpu().numpy().tobytes()
    return step


LOADERS = {'birefnet': birefnet, 'rvm': rvm}


def main(argv=None) -> int:
    take, out_dir, models = (argv or sys.argv[1:])[:3]
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    cache = out_dir.parent / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    width, height, fps = probe(take)
    wrote = 0
    for name, spec in json.loads(models).items():
        report = {'model': name, **{k: v for k, v in spec.items()}, 'take_sha256': sha256(take),
                  'width': width, 'height': height, 'fps': fps}
        started = time.monotonic()
        path = out_dir / f'{name}.alpha.mp4'
        print(f'STEP {time.strftime("%H:%M:%S")} model {name}', flush=True)
        try:
            step = LOADERS[spec['family']](spec, cache)
            report['load_s'] = round(time.monotonic() - started, 1)
            sink = encoder(path, width, height, fps)
            count = 0
            try:
                for rgb in frames(take, width, height):
                    sink.stdin.write(step(rgb, width, height))
                    count += 1
                    if count % 100 == 0:
                        print(f'STEP {time.strftime("%H:%M:%S")} {name} frame {count}', flush=True)
            finally:
                sink.stdin.close()
                if sink.wait():
                    raise RuntimeError('the alpha encoder failed')
            if not count:
                raise ValueError('no frames decoded')
            report.update(frames=count, seconds=round(time.monotonic() - started, 1), sha256=sha256(path), state='done')
            wrote += 1
        except Exception as error:  # noqa: BLE001 - the next model still runs; the error is the record
            path.unlink(missing_ok=True)
            report.update(state='failed', error=f'{type(error).__name__}: {error}'[:2000])
            print(f'model {name} failed: {report["error"]}', flush=True)
        (out_dir / f'{name}.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return 0 if wrote else 2


if __name__ == '__main__':
    raise SystemExit(main())
