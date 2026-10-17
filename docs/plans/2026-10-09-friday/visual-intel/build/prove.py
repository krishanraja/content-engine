"""Draw the feasibility proofs (proto.py) and run scripts/pages/card.py on each; write design/proof.json.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/prove.py
Writes only into /home/user/content-engine/.cache/visual-intel/design/.
"""
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path('/home/user/content-engine')
DESIGN = ROOT / '.cache/visual-intel/design'
SCRIPTS = ROOT / '.cache/visual-intel/scripts'
env = dict(os.environ, MYMU_BROWSER='/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
subprocess.run(['python3', '-I', str(SCRIPTS / 'proto.py')], cwd=ROOT, check=True, capture_output=True)
out = {}
for f in sorted(DESIGN.glob('exhibit-*.html')):
    r = subprocess.run(['python3', '-I', str(ROOT / 'scripts/pages/card.py'), str(f), '--out', str(DESIGN)], cwd=ROOT, env=env,
                       capture_output=True, text=True, timeout=180)
    text = r.stdout + r.stderr
    m = re.search(r'drawn at (\d+) x (\d+)', text)
    results = re.findall(r'result: (.+)', text)
    png = DESIGN / f'{f.stem}.png'
    key = re.sub(r'^exhibit-\d-', '', f.stem)
    out[key] = {
        'html': str(f.relative_to(ROOT)), 'png': str(png.relative_to(ROOT)) if png.exists() else None,
        'phone_png': str((DESIGN / f'{f.stem}-phone.png').relative_to(ROOT)),
        'size': [int(m.group(1)), int(m.group(2))] if m else None,
        'card_py': results, 'passed': bool(results) and all(x.startswith('every word') for x in results),
        'png_sha256': hashlib.sha256(png.read_bytes()).hexdigest() if png.exists() else None,
    }
    print(key, out[key]['size'], results)
(DESIGN / 'proof.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
