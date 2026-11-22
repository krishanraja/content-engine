"""Run a GPU subject matte on one rented RunPod pod and bring the alpha mattes back. Spend, so: Krish approves it.

Ruling (Krish, 2026-11-20): one GPU matte comparison run on RunPod approved, about $0.10. It answers one question: is a
GPU matte clearly better than the engine's CPU candidate (velib/matte.py, MediaPipe SelfieSegmentation) on his real
takes, at hair edges, hands and fast movement. Nothing here is wired into a render; that waits for his read.

The pattern is velib/maxine_pod.py's, unchanged in its guards:
  1. The run is priced before anything starts: the hourly rate times the time cap must be within --max-usd, and nothing
     starts without yes=True (the CLI's --yes, given only after Krish approves the spend).
  2. One pod, ephemeral disk only. It starts the same small file server behind RunPod's proxy URL, answering only to a
     one-time token made for this run. RUNPOD_API_KEY stays on the runner; the pod needs no key at all.
  3. The take goes up, the job runs (velib/matte_remote.py, sent with the pod), and one tar of mattes comes back,
     checked against the size and sha256 the pod reports.
  4. The pod is terminated in a `finally`, on success, failure and the time cap; the receipt says what it cost.

The models, each pinned (MODELS): BiRefNet, MIT, at a fixed commit of its Hugging Face repository with the weights'
sha256; RobustVideoMatting, GPL-3.0, cloned on the pod at a fixed commit and run there as a separate tool, never
vendored here, kept only for its temporal stability as the comparison's second opinion.
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import sys
import tarfile
import time
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from velib.maxine_pod import (CHUNK, GPU_TRIES, GPU_WAIT_S, RATE_USD, SERVER as EYE_SERVER,  # noqa: E402
                              Refused, estimate, http, sha256)

# Runpod's REST API v2. v1 (rest.runpod.io) was retired on 15 Nov 2026 and its host no longer resolves: the first
# matte-trial run (44737946351, 20 Nov) died there before any pod was made, at no cost. v2 places one GPU type per
# create (no fallback list), so the runner reads the catalog and tries each affordable card in stock, cheapest first.
API = 'https://api.runpod.io/v2'
# Cards with 16 GB or more (BiRefNet at 2048 in half precision) that torch 2.5.1 with CUDA 12.4 runs (compute 7.0 to
# 9.0; Blackwell cards are not supported by that build). Which of them is tried, and in which cloud, is decided by the
# live catalog's price against the cap; the pod's own `cost` is re-checked either way.
GPUS = ['NVIDIA RTX A4000', 'NVIDIA RTX A4500', 'NVIDIA RTX A5000', 'NVIDIA RTX A6000', 'NVIDIA GeForce RTX 3090',
        'NVIDIA GeForce RTX 3090 Ti', 'NVIDIA GeForce RTX 4080 SUPER', 'NVIDIA GeForce RTX 4090', 'NVIDIA L4',
        'NVIDIA RTX 4000 Ada Generation', 'NVIDIA RTX 2000 Ada Generation', 'NVIDIA A40', 'Tesla V100-SXM2-16GB',
        'Tesla V100-PCIE-16GB']
CUDA_FLOOR = '12.4'      # hosts whose driver runs the image's CUDA 12.4 (a floor; an exact list misses unlisted versions)
IMAGE = 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime'   # torch 2.5.1, the version BiRefNet's requirements pin
PORT = 8000
PREFIX = 'matte-'
MAX_MINUTES = 30
MAX_USD = 0.50
REMOTE = Path(__file__).with_name('matte_remote.py')

MODELS = {
    'birefnet-hr': {'family': 'birefnet', 'licence': 'MIT', 'repo': 'ZhengPeng7/BiRefNet_HR-matting',
                    'revision': '5d6b6f8adcb5b417c871b1d84ceaae9871355b7f', 'resolution': 2048,
                    'sha256': 'a5a4de698739ea5e0e8bbab28e1b293dde95092b87a442d566cbc585c53cef55'},
    'birefnet': {'family': 'birefnet', 'licence': 'MIT', 'repo': 'ZhengPeng7/BiRefNet-matting',
                 'revision': 'eccde0a8cbdce7ac5fecfeb06340fe7b949e85d9', 'resolution': 1024,
                 'sha256': 'a9875de5b1e6c8eb5fdaa8c727a82927ce442cdc87ba3abee6a77e6fa46c25bb'},
    'rvm': {'family': 'rvm', 'licence': 'GPL-3.0 (run on the pod as a separate tool, never vendored)',
            'repo': 'https://github.com/PeterL1n/RobustVideoMatting.git',
            'revision': '53d74c6826735f01f4406b5ca9075eee27bec094', 'variant': 'resnet50', 'downsample_ratio': 0.25,
            'weights_url': 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth',
            'sha256': 'c191a807251164c073dce5fa408e7a816070d539b882b2a3150330a9fec112ce'},
}

# The same file server as the Maxine pod, serving a tar of mattes and naming itself `matte`.
SERVER = EYE_SERVER.replace('/out.mp4', '/out.tar').replace('server="eyeline"', 'server="matte"')

REMOTE_JOB = r'''
set -euo pipefail
cd /workspace
step() { echo "STEP $(date -u +%H:%M:%S) $*"; }
step packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq ffmpeg git >/dev/null
pip install -q "numpy<2" "transformers==4.46.3" "timm==1.0.11" "kornia==0.7.4" "einops==0.8.0" \
    "huggingface_hub==0.26.2" "safetensors==0.4.5" "accelerate==1.1.1"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
step matte
python /workspace/matte_remote.py /workspace/in.mp4 /workspace/mattes "$MATTE_MODELS"
step pack
tar -cf /workspace/out.tar -C /workspace mattes
step done
'''


def models_for(names: str) -> dict:
    chosen = [n.strip() for n in str(names).split(',') if n.strip()]
    unknown = [n for n in chosen if n not in MODELS]
    if unknown or not chosen:
        raise Refused(f'unknown model {", ".join(unknown) or "(none)"}; choose from {", ".join(MODELS)}')
    return {n: MODELS[n] for n in chosen}


def run(media, out_dir, *, models: str = 'birefnet-hr,rvm', yes: bool = False, max_usd: float = MAX_USD,
        max_minutes: int = MAX_MINUTES, api_key: str | None = None, call=http, sleep=time.sleep, clock=time.monotonic,
        poll_s: float = 10.0) -> dict:
    """Rent one pod, matte the take with each model, download the mattes, terminate the pod. Returns the receipt."""
    media, out_dir = Path(media), Path(out_dir)
    chosen = models_for(models)
    cost = estimate(RATE_USD, max_minutes)
    if cost > max_usd:
        raise Refused(f'{max_minutes} min at ${RATE_USD}/h is ${cost}, over the ${max_usd} cap')
    if not yes:
        raise Refused(f"spend needs Krish's yes: one GPU pod, up to {max_minutes} min, at most ${cost}; run again "
                      'with --yes once he has approved it')
    api_key = api_key or os.environ.get('RUNPOD_API_KEY')
    if not api_key:
        raise Refused('RUNPOD_API_KEY must be set as an environment secret (never in the repository)')
    token = secrets.token_urlsafe(24)
    receipt_path = out_dir / f'matte-pod.{media.stem}.json'
    started, pod_id = clock(), None
    receipt = {'schema': 'matte-pod/2', 'api': API, 'image': IMAGE, 'take': str(media), 'take_sha256': sha256(media),
               'models': chosen}

    def save():
        out_dir.mkdir(parents=True, exist_ok=True)
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')

    try:
        def pod_body(gpu, cloud):
            return {
                'name': f'{PREFIX}{media.stem}'[:60], 'image': IMAGE, 'cloud': cloud, 'disk': 40,
                'gpu': {'id': gpu, 'count': 1, 'minCudaVersion': CUDA_FLOOR},
                'ports': [f'{PORT}/http'],                     # no mounts: ephemeral disk only
                'env': {'EYE_TOKEN': token, 'EYE_PORT': str(PORT), 'MATTE_MODELS': json.dumps(chosen),
                        'EYE_SERVER': base64.b64encode(SERVER.encode()).decode(),
                        'EYE_JOB': base64.b64encode(REMOTE_JOB.encode()).decode(),
                        'MATTE_PY': base64.b64encode(REMOTE.read_bytes()).decode()},
                'entrypoint': ['bash', '-c', 'mkdir -p /workspace; echo "$EYE_JOB" | base64 -d > /workspace/job.sh; '
                               'echo "$EYE_SERVER" | base64 -d > /workspace/server.py; '
                               'echo "$MATTE_PY" | base64 -d > /workspace/matte_remote.py; '
                               'exec python3 /workspace/server.py']}

        pod, tries, gpu, cloud, said = None, 0, None, None, ''
        while pod is None:                            # no card free anywhere: ask again, waiting costs nothing
            for gpu, cloud, listed in candidates(call, api_key, max_usd, max_minutes):
                try:
                    pod = call('POST', f'{API}/pods', key=api_key, body=pod_body(gpu, cloud))
                    receipt['listed_usd_per_h'] = listed
                    break
                except urllib.error.HTTPError as error:
                    said = f'HTTP {error.code} ({gpu}, {cloud}): ' + error.read().decode('utf-8', 'replace')[:300]
                    if error.code == 402 or error.code == 422 or error.code == 401:
                        raise Refused(said) from error    # balance, a bad body or the key: no candidate will do
                    print(f'matte_pod: {said}', flush=True)  # 400 no capacity, 403 no access, 5xx: the next card
            if pod is None:
                tries += 1
                if tries >= GPU_TRIES:
                    raise Refused(f'no affordable GPU free on Runpod after {tries} tries {GPU_WAIT_S} s apart ({said})')
                print(f'matte_pod: no card free (try {tries}); asking again in {GPU_WAIT_S} s', flush=True)
                sleep(GPU_WAIT_S)
        started = clock()                             # billing, and the time cap, start with the pod
        pod_id = pod['id']
        receipt.update(cloud=cloud, pod=pod_id, gpu=gpu)
        rate = float(pod.get('cost') or receipt.get('listed_usd_per_h') or RATE_USD)
        receipt['rate_usd_per_h'] = rate
        save()
        if estimate(rate, max_minutes) > max_usd:
            raise Refused(f'the pod costs ${rate}/h, over the ${max_usd} cap for {max_minutes} min')
        base = f'https://{pod_id}-{PORT}.proxy.runpod.net'

        def deadline():
            if clock() - started > max_minutes * 60:
                raise Refused(f'time cap of {max_minutes} min reached')

        while True:                                   # the pod's own server answers once it is up
            deadline()
            info = call('GET', f'{API}/pods/{pod_id}', key=api_key, timeout=30)
            state = info.get('status') if isinstance(info, dict) else None
            if state in ('ERROR', 'EXITED', 'TERMINATED'):
                raise Refused(f'the pod went {state} before its server answered')
            receipt['pod_status'] = state
            try:
                up = call('GET', f'{base}/status', token=token, timeout=20)
                if isinstance(up, dict) and up.get('server') == 'matte':
                    break
            except (urllib.error.URLError, OSError):
                pass
            sleep(poll_s)
        data, sent = media.read_bytes(), ''
        for at in range(0, len(data), CHUNK):        # Cloudflare in front of the proxy caps a request at 100 MB
            deadline()
            sent = call('POST', f'{base}/in.mp4', token=token, data=data[at:at + CHUNK], timeout=600,
                        headers={'X-Offset': str(at)})
        if isinstance(sent, bytes):
            sent = sent.decode()
        if str(sent).strip() != receipt['take_sha256']:
            raise Refused('the take arrived damaged on the pod (sha256 differs)')
        call('POST', f'{base}/start', token=token)
        seen = {}
        while True:
            deadline()
            status = call('GET', f'{base}/status', token=token, timeout=30)
            status = status if isinstance(status, dict) else {}
            receipt['remote_log'] = status.get('log', '')
            save()
            steps = [line for line in receipt['remote_log'].splitlines() if line.startswith('STEP ')]
            if steps and steps[-1] != seen.get('step'):
                seen['step'] = steps[-1]
                print(f'matte_pod: {steps[-1]}', flush=True)
            if status.get('state') == 'done':
                break
            if status.get('state') == 'failed':
                raise Refused(f'the matte job failed on the pod (exit {status.get("code")}); its log is in the receipt')
            sleep(poll_s)
        bundle = out_dir / f'{media.stem}.mattes.tar'
        with open(bundle, 'wb') as handle:
            for at in range(0, int(status.get('size') or 0), CHUNK):
                deadline()
                raw = call('GET', f'{base}/out.tar?offset={at}&length={CHUNK}', token=token, timeout=600)
                handle.write(raw if isinstance(raw, bytes) else json.dumps(raw).encode())
        if bundle.stat().st_size != status.get('size') or sha256(bundle) != status.get('sha256'):
            bundle.unlink(missing_ok=True)
            raise Refused('the mattes arrived damaged (size or sha256 differs)')
        receipt.update(bundle=str(bundle), bundle_sha256=status['sha256'], state='done')
        receipt['mattes'] = unpack(bundle, out_dir)
        return receipt
    except Refused as error:
        receipt.update(state='refused', reason=str(error))
        raise
    except urllib.error.HTTPError as error:              # keep the provider's own words: they name the cause
        try:
            detail = error.read().decode('utf-8', 'replace')[:500]
        except Exception:  # noqa: BLE001
            detail = ''
        receipt.update(state='failed', reason=f'HTTP {error.code} from {error.url.split("?")[0]}: {detail}'.strip())
        raise
    finally:
        if pod_id:
            try:
                call('DELETE', f'{API}/pods/{pod_id}', key=api_key)
                receipt['terminated'] = True
            except Exception as error:  # noqa: BLE001 - say so loudly: a live pod keeps billing
                receipt['terminated'] = False
                receipt['terminate_error'] = f'{type(error).__name__}: terminate pod {pod_id} in the RunPod console now'
        seconds = round(clock() - started, 1)
        receipt['seconds'] = seconds
        receipt['cost_usd'] = round(seconds / 3600 * receipt.get('rate_usd_per_h', RATE_USD), 4) if pod_id else 0.0
        save()


def candidates(call, api_key, max_usd, max_minutes):
    """(gpu, cloud, listed $/h) for every card in GPUS the live catalog has in stock within the cap, cheapest first."""
    found = call('GET', f'{API}/catalog/gpus?include=AVAILABILITY&product=POD', key=api_key, timeout=30)
    rows = found.get('gpus', []) if isinstance(found, dict) else (found or [])
    out = []
    for row in rows:
        if row.get('id') not in GPUS or str(row.get('availability') or 'NONE').upper() == 'NONE':
            continue
        for cloud in ('SECURE', 'COMMUNITY'):
            price = (row.get('price') or {}).get(cloud.lower())
            if row.get(cloud.lower()) is False or not price or estimate(float(price), max_minutes) > max_usd:
                continue
            out.append((row['id'], cloud, float(price)))
    return sorted(out, key=lambda c: (c[2], GPUS.index(c[0])))


def unpack(bundle, out_dir) -> dict:
    """The tar's mattes into out_dir/mattes, refusing any member that would land outside it."""
    target = (Path(out_dir) / 'mattes').resolve()
    found = {}
    with tarfile.open(bundle) as tar:
        for member in tar.getmembers():
            name = Path(member.name)
            if not member.isfile() or name.parts[:1] != ('mattes',) or len(name.parts) != 2:
                continue
            dest = (target / name.name).resolve()
            if dest.parent != target:
                continue
            target.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as src, open(dest, 'wb') as handle:
                handle.write(src.read())
            if dest.suffix == '.json':
                report = json.loads(dest.read_text(encoding='utf-8'))
                found[report.get('model', dest.stem)] = {k: report.get(k) for k in
                                                         ('state', 'frames', 'seconds', 'load_s', 'sha256', 'error')}
    return found


def cleanup(api_key: str | None = None, call=http) -> list[str]:
    """Terminate every pod this runner made (named matte-*): the safety net after a cancelled run."""
    api_key = api_key or os.environ.get('RUNPOD_API_KEY')
    if not api_key:
        raise Refused('RUNPOD_API_KEY must be set')
    pods = call('GET', f'{API}/pods', key=api_key)
    pods = pods.get('pods', pods) if isinstance(pods, dict) else pods
    gone = []
    for pod in pods or []:
        if str(pod.get('name', '')).startswith(PREFIX):
            call('DELETE', f'{API}/pods/{pod["id"]}', key=api_key)
            gone.append(pod['id'])
    return gone


def _stop(signum, frame):  # noqa: ARG001 - GitHub cancels with SIGINT then SIGTERM: run the finally, end the pod
    raise KeyboardInterrupt


def main(argv=None) -> int:
    """python scripts/velib/matte_pod.py <take> <out_dir> --yes [--models birefnet-hr,rvm] [--max-usd 0.50]."""
    import argparse  # noqa: PLC0415
    parser = argparse.ArgumentParser(prog='matte_pod')
    parser.add_argument('take')
    parser.add_argument('out_dir')
    parser.add_argument('--yes', action='store_true')
    parser.add_argument('--max-usd', type=float, default=MAX_USD)
    parser.add_argument('--max-minutes', type=int, default=MAX_MINUTES)
    parser.add_argument('--models', default='birefnet-hr,rvm', help=f'comma-separated, from {", ".join(MODELS)}')
    args = parser.parse_args(argv)
    import signal  # noqa: PLC0415
    signal.signal(signal.SIGTERM, _stop)
    if args.take == 'cleanup':
        gone = cleanup()
        print(f'matte_pod: terminated {len(gone)} matte pod(s): {", ".join(gone) or "none running"}')
        return 0
    try:
        receipt = run(args.take, args.out_dir, models=args.models, yes=args.yes, max_usd=args.max_usd,
                      max_minutes=args.max_minutes)
    except Refused as error:
        print(f'matte_pod: refused: {error}')
        return 1
    print(f"matte_pod: {receipt['bundle']} ({receipt['seconds']} s on pod {receipt['pod']}, about "
          f"${receipt['cost_usd']}, terminated {receipt.get('terminated')}); mattes: {json.dumps(receipt['mattes'])}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
