"""Run NVIDIA Maxine Eye Contact on one rented GPU and bring the redirected copy back. Spend, so: Krish approves it.

Krish, 2026-11-05: Maxine AR SDK Eye Contact on a RunPod Secure Cloud RTX A5000 (about $0.27 an hour, no transfer
fees), never the Eye Contact NIM (it needs NVIDIA AI Enterprise). NVIDIA's NGC page: "This feature is available for
commercial/non-commercial use."

What a run does, and the guards on it:
  1. It prices the run before anything starts: the hourly rate times the time cap must be within --max-usd (default
     $1.00), and nothing starts without yes=True (the CLI's --yes, given only after Krish approves the spend).
  2. It creates one Secure Cloud pod (RUNPOD_API_KEY) with ephemeral disk only. The pod starts a small file server on
     its HTTP port, behind RunPod's proxy URL, that answers only to a one-time token made for this run. The NGC key
     (NGC_API_KEY) reaches the pod as an environment variable to fetch the Linux AR SDK; neither key is ever written to
     the repository or a log.
  3. It uploads the take, starts the job (REMOTE_JOB), polls until the redirected copy is ready, and downloads it,
     checking its size and sha256 against what the pod reports.
  4. It terminates the pod in a `finally`, on success, on any failure and at the time cap, and writes a receipt
     (pod id, GPU, seconds, the cost at the pod's own rate).

The redirected copy then goes through `ve eyeline --backend maxine --maxine-copy <file>`, which takes Maxine's eyes
only where the plan says to.

Not yet proved on a pod: that the Linux AR SDK installs in this image and how its GazeRedirect sample takes a file.
REMOTE_JOB tries the sample's documented offline flags and stops with its own output when they do not fit, so the
first trial shows exactly what to change.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import time
import urllib.error
import urllib.request
from pathlib import Path

API = 'https://rest.runpod.io/v1'
GPU = 'NVIDIA RTX A5000'
# Any of these will do (RTX with Tensor cores, which Maxine needs); RunPod gives the first with free stock. Run
# 42072590168 (5 Nov) found no A5000 at all. The cap is re-checked against the pod's own costPerHr either way.
GPUS = ['NVIDIA RTX A4000', 'NVIDIA RTX A4500', GPU, 'NVIDIA L4', 'NVIDIA RTX 4000 Ada Generation',
        'NVIDIA GeForce RTX 3090', 'NVIDIA GeForce RTX 4090', 'NVIDIA RTX A6000']   # cheapest first, then any RTX
CLOUDS = ['SECURE', 'COMMUNITY']   # run 42081806896 (5 Nov): Secure had none of the cheap cards; Community is the fallback
RATE_USD = 0.27                       # Secure Cloud, as listed on 5 Nov 2026; the pod's own costPerHr is re-checked
IMAGE = 'nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04'
PORT = 8000
USER_AGENT = 'content-engine-maxine/1'
CHUNK = 32 << 20                       # bytes per request through the pod proxy
MAX_MINUTES = 60
MAX_USD = 1.00
AR_SDK = os.environ.get('MAXINE_AR_SDK', 'nvidia/maxine/maxine_linux_ar_sdk')

# The pod's file server: PUT /in.mp4, POST /start, GET /status, GET /out.mp4; every request carries the token.
SERVER = r'''
import hashlib, http.server, json, os, subprocess, threading
TOKEN = os.environ["EYE_TOKEN"]; WORK = "/workspace"; state = {"state": "waiting"}
def job():
    state["state"] = "running"
    log = open(WORK + "/job.log", "wb")
    code = subprocess.call(["bash", WORK + "/job.sh"], stdout=log, stderr=subprocess.STDOUT)
    out = WORK + "/out.mp4"
    if code == 0 and os.path.isfile(out):
        h = hashlib.sha256(open(out, "rb").read()).hexdigest()
        state.update(state="done", size=os.path.getsize(out), sha256=h)
    else:
        state.update(state="failed", code=code, log=open(WORK + "/job.log", "rb").read()[-4000:].decode("utf-8", "replace"))
class H(http.server.BaseHTTPRequestHandler):
    def ok(self):
        if self.headers.get("X-Token") != TOKEN:
            self.send_response(403); self.end_headers(); return False
        return True
    def do_PUT(self):
        self.upload()
    def upload(self):
        if not self.ok(): return
        n = int(self.headers["Content-Length"]); left = n; at = int(self.headers.get("X-Offset", "0"))
        path = WORK + "/in.mp4"
        with open(path, "r+b" if at and os.path.exists(path) else "wb") as f:
            f.seek(at); f.truncate()
            while left:
                b = self.rfile.read(min(left, 1 << 20)); f.write(b); left -= len(b)
        self.send_response(200); self.end_headers(); self.wfile.write(hashlib.sha256(open(path, "rb").read()).hexdigest().encode())
    def do_POST(self):
        if self.path.startswith("/in.mp4"): return self.upload()   # RunPod's proxy answers PUT with 404 (run 42082234268)
        if not self.ok(): return
        threading.Thread(target=job, daemon=True).start(); self.send_response(202); self.end_headers()
    def do_GET(self):
        if not self.ok(): return
        if self.path.startswith("/out.mp4") and state.get("state") == "done":
            q = dict(kv.split("=", 1) for kv in self.path.partition("?")[2].split("&") if "=" in kv)
            at = int(q.get("offset", 0)); size = min(int(q.get("length", state["size"])), state["size"] - at)
            self.send_response(200); self.send_header("Content-Length", str(size)); self.end_headers()
            with open(WORK + "/out.mp4", "rb") as f:
                f.seek(at); left = size
                while left:
                    b = f.read(min(left, 1 << 20))
                    if not b: break
                    self.wfile.write(b); left -= len(b)
            return
        tail = open(WORK + "/job.log", "rb").read()[-4000:].decode("utf-8", "replace") if os.path.isfile(WORK + "/job.log") else ""
        body = json.dumps(dict(state, server="eyeline", log=state.get("log") or tail)).encode(); self.send_response(200)
        self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("EYE_PORT", "8000"))), H).serve_forever()
'''

# The job: fetch the Linux AR SDK from NGC, find the GazeRedirect sample, redirect /workspace/in.mp4 offline.
REMOTE_JOB = r'''
set -euo pipefail
cd /workspace
step() { echo "STEP $(date -u +%H:%M:%S) $*"; }
step packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq wget unzip ffmpeg >/dev/null
step ngc-cli
wget -q -O ngc.zip https://api.ngc.nvidia.com/v2/resources/nvidia/ngc-apps/ngc_cli/versions/3.41.4/files/ngccli_linux.zip
unzip -q ngc.zip && export PATH="$PWD/ngc-cli:$PATH"
# No interactive config: it loops forever on "Enter org" (run 42083307224 sat there 20 min). Env only, stdin closed.
export NGC_CLI_API_KEY="$NGC_API_KEY" NGC_CLI_FORMAT_TYPE=json NGC_CLI_TEAM=no-team NGC_CLI_ACE=no-ace
step "ngc org"
NGC_CLI_ORG=$(timeout 120 ngc org list --format_type json </dev/null 2>/dev/null | python3 -c '
import json, sys
try:
    rows = json.load(sys.stdin)
except Exception:
    rows = []
rows = rows if isinstance(rows, list) else [rows]
flat = [r for x in rows for r in (x if isinstance(x, list) else [x]) if isinstance(r, dict)]
print(next((str(r.get("name") or r.get("orgName") or r.get("id")) for r in flat if (r.get("name") or r.get("orgName") or r.get("id"))), ""))' || true)
if [ -z "$NGC_CLI_ORG" ]; then
  NGC_CLI_ORG=$(printf '\n' | timeout 30 ngc config set 2>&1 | grep -o "Choices: \['[0-9A-Za-z_-]*'" | head -1 | grep -o "'.*'" | tr -d "'" || true)
fi
echo "ngc org: ${NGC_CLI_ORG:-none found}"
export NGC_CLI_ORG
step "sdk download $AR_SDK"
timeout 900 ngc registry resource download-version "$AR_SDK" --dest /workspace/sdk </dev/null
du -sh /workspace/sdk; find /workspace/sdk -maxdepth 3 | head -40
SDK=$(find /workspace/sdk -maxdepth 3 -type d -name "*AR*SDK*" | head -1)
[ -n "$SDK" ] || SDK=/workspace/sdk
step unpack
find "$SDK" -name "*.tar.gz" -exec tar -xzf {} -C "$SDK" \;
APP=$(find "$SDK" -type f -iname "GazeRedirect*App*" -perm -u+x | head -1)
if [ -z "$APP" ]; then echo "no GazeRedirect sample binary in the SDK:"; find "$SDK" -maxdepth 4 | head -80; exit 3; fi
export LD_LIBRARY_PATH="$(dirname "$APP"):$(find "$SDK" -type d -name lib | tr '\n' ':')${LD_LIBRARY_PATH:-}"
MODELS=$(find "$SDK" -type d -name models | head -1)
step "sample $APP"
timeout 60 "$APP" --help 2>&1 | head -60 || true
step redirect
timeout 1500 "$APP" --offline_mode=true --in_file=/workspace/in.mp4 --out_file=/workspace/out.mp4 --redirect_gaze=true \
    ${MODELS:+--model_path=$MODELS} --capture_outputs=true
[ -s /workspace/out.mp4 ] || { echo "the sample wrote no out.mp4"; ls -la /workspace; exit 4; }
step done
'''


class Refused(RuntimeError):
    pass


def http(method: str, url: str, *, key: str | None = None, token: str | None = None, body=None, data: bytes | None = None,
         timeout: float = 60, headers: dict | None = None):
    # RunPod's API and pod proxy sit behind Cloudflare, which refuses urllib's default "Python-urllib" agent with a
    # 403 (error code 1010) before the key is read: the 5 Nov trial run 42067342305 died there. Name ourselves.
    headers = {'User-Agent': USER_AGENT, **(headers or {})}
    if key:
        headers['Authorization'] = f'Bearer {key}'
    if token:
        headers['X-Token'] = token
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed https endpoints
        raw = response.read()
    try:
        return json.loads(raw) if raw else {}
    except ValueError:
        return raw


def estimate(rate: float = RATE_USD, minutes: int = MAX_MINUTES) -> float:
    return round(rate * minutes / 60, 3)


def run(media, out_dir, *, yes: bool = False, max_usd: float = MAX_USD, max_minutes: int = MAX_MINUTES,
        api_key: str | None = None, ngc_key: str | None = None, call=http, sleep=time.sleep, clock=time.monotonic,
        poll_s: float = 10.0) -> dict:
    """Rent one pod, redirect the take with Maxine, download the copy, terminate the pod. Returns the receipt."""
    media, out_dir = Path(media), Path(out_dir)
    cost = estimate(RATE_USD, max_minutes)
    if cost > max_usd:
        raise Refused(f'{max_minutes} min at ${RATE_USD}/h is ${cost}, over the ${max_usd} cap')
    if not yes:
        raise Refused(f'spend needs Krish\'s yes: one RTX pod, up to {max_minutes} min, at most ${cost} '
                      f'(RunPod Secure Cloud, ${RATE_USD}/h); run again with --yes once he has approved it')
    api_key = api_key or os.environ.get('RUNPOD_API_KEY')
    ngc_key = ngc_key or os.environ.get('NGC_API_KEY')
    if not api_key or not ngc_key:
        raise Refused('RUNPOD_API_KEY and NGC_API_KEY must be set as environment secrets (never in the repository)')
    token = secrets.token_urlsafe(24)
    started, pod_id, receipt = clock(), None, {'schema': 'maxine-pod/1', 'gpu': GPUS, 'take': str(media)}
    try:

        def pod_body(cloud):
            return {
                'name': f'eyeline-{media.stem}'[:60], 'imageName': IMAGE, 'gpuTypeIds': GPUS, 'gpuTypePriority': 'availability', 'cloudType': cloud,
                'gpuCount': 1, 'containerDiskInGb': 40, 'volumeInGb': 0, 'ports': [f'{PORT}/http'],
                'env': {'EYE_TOKEN': token, 'EYE_PORT': str(PORT), 'NGC_API_KEY': ngc_key, 'AR_SDK': AR_SDK,
                        'EYE_SERVER': base64.b64encode(SERVER.encode()).decode(),
                        'EYE_JOB': base64.b64encode(REMOTE_JOB.encode()).decode()},
                'dockerStartCmd': ['bash', '-c', 'apt-get update -qq && apt-get install -y -qq python3 >/dev/null; mkdir -p /workspace; '
                                   'echo "$EYE_JOB" | base64 -d > /workspace/job.sh; echo "$EYE_SERVER" | base64 -d > /workspace/server.py; '
                                   'exec python3 /workspace/server.py']}

        pod = None
        for cloud in CLOUDS:                          # the first cloud with a free card wins
            try:
                pod = call('POST', f'{API}/pods', key=api_key, body=pod_body(cloud))
                break
            except urllib.error.HTTPError as error:
                said = error.read().decode('utf-8', 'replace')[:500]
                if 'no instances' not in said.lower() or cloud == CLOUDS[-1]:
                    raise Refused(f'HTTP {error.code} from {API}/pods ({cloud}): {said}') from error
        receipt['cloud'] = cloud
        pod_id = pod['id']
        receipt['pod'] = pod_id
        got = (pod.get('machine') or {}).get('gpuTypeId') or pod.get('gpuTypeId')
        if got:
            receipt['gpu'] = got
        rate = float(pod.get('costPerHr') or RATE_USD)
        if estimate(rate, max_minutes) > max_usd:
            raise Refused(f'the pod costs ${rate}/h, over the ${max_usd} cap for {max_minutes} min')
        receipt['rate_usd_per_h'] = rate
        base = f'https://{pod_id}-{PORT}.proxy.runpod.net'

        def deadline():
            if clock() - started > max_minutes * 60:
                raise Refused(f'time cap of {max_minutes} min reached')

        while True:                                   # the pod's own server answers once it is up
            deadline()                                # (RunPod's proxy answers for it until then, not in JSON)
            try:
                up = call('GET', f'{base}/status', token=token, timeout=20)
                if isinstance(up, dict) and up.get('server') == 'eyeline':
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
        if str(sent).strip() != sha256(media):
            raise Refused('the take arrived damaged on the pod (sha256 differs)')
        call('POST', f'{base}/start', token=token)
        seen = {}
        while True:
            deadline()
            status = call('GET', f'{base}/status', token=token, timeout=30)
            receipt['remote_log'] = status.get('log', '')      # kept on every exit: cap, cancel or failure
            out_dir.mkdir(parents=True, exist_ok=True)         # and on disk now, in case the runner is killed
            (out_dir / f'maxine-pod.{media.stem}.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
            steps = [line for line in receipt['remote_log'].splitlines() if line.startswith('STEP ')]
            if steps and steps[-1] != seen.get('step'):
                seen['step'] = steps[-1]
                print(f'maxine_pod: {steps[-1]}', flush=True)
            if status.get('state') == 'done':
                break
            if status.get('state') == 'failed':
                receipt['remote_log'] = status.get('log', '')
                raise Refused(f'Maxine failed on the pod (exit {status.get("code")}); its log is in the receipt')
            sleep(poll_s)
        out_dir.mkdir(parents=True, exist_ok=True)
        copy = out_dir / f'{media.stem}.maxine.mp4'
        with open(copy, 'wb') as handle:
            for at in range(0, int(status.get('size') or 0), CHUNK):
                deadline()
                raw = call('GET', f'{base}/out.mp4?offset={at}&length={CHUNK}', token=token, timeout=600)
                handle.write(raw if isinstance(raw, bytes) else json.dumps(raw).encode())
        if copy.stat().st_size != status.get('size') or sha256(copy) != status.get('sha256'):
            copy.unlink(missing_ok=True)
            raise Refused('the redirected copy arrived damaged (size or sha256 differs)')
        receipt.update(copy=str(copy), copy_sha256=status['sha256'], state='done')
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
        # Billing starts with a pod: no pod, no cost.
        receipt['cost_usd'] = round(seconds / 3600 * receipt.get('rate_usd_per_h', RATE_USD), 4) if pod_id else 0.0
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f'maxine-pod.{media.stem}.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')


def sha256(path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def cleanup(api_key: str | None = None, call=http) -> list[str]:
    """Terminate every pod this runner made (named eyeline-*): the safety net after a cancelled run."""
    api_key = api_key or os.environ.get('RUNPOD_API_KEY')
    if not api_key:
        raise Refused('RUNPOD_API_KEY must be set')
    pods = call('GET', f'{API}/pods', key=api_key)
    pods = pods.get('pods', pods) if isinstance(pods, dict) else pods
    gone = []
    for pod in pods or []:
        if str(pod.get('name', '')).startswith('eyeline-'):
            call('DELETE', f'{API}/pods/{pod["id"]}', key=api_key)
            gone.append(pod['id'])
    return gone


def _stop(signum, frame):  # noqa: ARG001 - GitHub cancels with SIGINT then SIGTERM: run the finally, end the pod
    raise KeyboardInterrupt


def main(argv=None) -> int:
    """python scripts/velib/maxine_pod.py <take> <out_dir> --yes [--max-usd 1.00]: the GitHub Actions job's entry."""
    import argparse  # noqa: PLC0415
    parser = argparse.ArgumentParser(prog='maxine_pod')
    parser.add_argument('take'); parser.add_argument('out_dir')
    parser.add_argument('--yes', action='store_true'); parser.add_argument('--max-usd', type=float, default=MAX_USD)
    parser.add_argument('--max-minutes', type=int, default=MAX_MINUTES)
    args = parser.parse_args(argv)
    import signal  # noqa: PLC0415
    signal.signal(signal.SIGTERM, _stop)
    if args.take == 'cleanup':
        gone = cleanup()
        print(f'maxine_pod: terminated {len(gone)} eyeline pod(s): {", ".join(gone) or "none running"}')
        return 0
    try:
        receipt = run(args.take, args.out_dir, yes=args.yes, max_usd=args.max_usd, max_minutes=args.max_minutes)
    except Refused as error:
        print(f'maxine_pod: refused: {error}')
        return 1
    print(f"maxine_pod: {receipt['copy']} ({receipt['seconds']} s on pod {receipt['pod']}, about ${receipt['cost_usd']}, "
          f"terminated {receipt.get('terminated')})")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
