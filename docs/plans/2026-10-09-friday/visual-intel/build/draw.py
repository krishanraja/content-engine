"""Check and draw Friday's five exhibits.

For each /home/user/content-engine/.cache/visual-intel/<id>.html:
  1. scripts/pages/card.py (phone floor, nothing cut off by the card's edge), which writes <id>.png and <id>-phone.png;
  2. two checks card.py does not make: no word crosses the 64 px side margins, and no two runs of words overlap.
Writes .cache/visual-intel/draw.json with each result.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/draw.py [id ...]
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path('/home/user/content-engine')
OUT = ROOT / '.cache/visual-intel'
os.environ.setdefault('MYMU_BROWSER', '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand  # noqa: E402

IDS = ['launches', 'model-or-thinking-level', 'each-step-buys-less', 'new-version-or-more-thinking',
       'cheapest-route-to-each-score']
PAD = 64

RUNS_JS = r"""() => {
  const card = document.getElementById('card').getBoundingClientRect();
  const words = (t) => t.replace(/\s+/g, ' ').trim();
  const out = [];
  const walk = document.createTreeWalker(document.getElementById('card'), NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = words(n.nodeValue);
    if (!t || !n.parentElement) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    let k = 0;
    for (const r of range.getClientRects()) {
      if (!r.width || !r.height) continue;
      out.push({text: t, line: k++, el: n.parentElement.tagName,
                box: [r.left - card.left, r.top - card.top, r.right - card.left, r.bottom - card.top]});
    }
  }
  return {width: card.width, runs: out};
}"""


def layout_problems(html_path):
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': 1400, 'height': 1200})
        pg.goto(html_path.as_uri())
        pg.evaluate('document.fonts.ready.then(() => true)')
        pg.wait_for_timeout(300)
        got = pg.evaluate(RUNS_JS)
        b.close()
    w = got['width']
    runs = got['runs']
    bad = []
    for r in runs:
        x0, y0, x1, y1 = r['box']
        if x0 < PAD - 1 or x1 > w - PAD + 1:
            bad.append(f'outside the side margins: "{r["text"][:60]}" spans x {x0:.0f} to {x1:.0f}')
    # overlap between different runs; glyph boxes include line-gap, so shrink each box a little vertically
    for i in range(len(runs)):
        for j in range(i + 1, len(runs)):
            a, c = runs[i], runs[j]
            if a['text'] == c['text'] and a['line'] != c['line']:
                continue
            ax0, ay0, ax1, ay1 = a['box']
            cx0, cy0, cx1, cy1 = c['box']
            sa, sc = (ay1 - ay0) * .18, (cy1 - cy0) * .18
            ox = min(ax1, cx1) - max(ax0, cx0)
            oy = min(ay1 - sa, cy1 - sc) - max(ay0 + sa, cy0 + sc)
            if ox > 2 and oy > 2:
                bad.append(f'words overlap: "{a["text"][:40]}" and "{c["text"][:40]}" ({ox:.0f} x {oy:.0f} px)')
    return bad


def main():
    ids = sys.argv[1:] or IDS
    log = OUT / 'draw.json'
    results = json.loads(log.read_text()) if log.exists() else {}
    ok_all = True
    for i in ids:
        html_path = OUT / f'{i}.html'
        r = subprocess.run(['python3', '-I', str(ROOT / 'scripts/pages/card.py'), str(html_path), '--out', str(OUT)],
                           cwd=ROOT, capture_output=True, text=True, timeout=300)
        text = r.stdout + r.stderr
        m = re.search(r'drawn at (\d+) x (\d+)', text)
        card_results = re.findall(r'result: (.+)', text)
        runs = re.search(r'(\d+) run\(s\) of words: (\d+) big enough, (\d+) too small', text)
        lay = layout_problems(html_path)
        png = OUT / f'{i}.png'
        passed = r.returncode == 0 and bool(card_results) and all(x.startswith('every word') for x in card_results)
        results[i] = {
            'html': str(html_path), 'png': str(png) if png.exists() else None, 'phone_png': str(OUT / f'{i}-phone.png'),
            'size': [int(m.group(1)), int(m.group(2))] if m else None,
            'card_py': {'command': f'python3 {ROOT}/scripts/pages/card.py {html_path} --out {OUT}', 'exit_code': r.returncode,
                        'result': card_results, 'runs_of_words': int(runs.group(1)) if runs else None,
                        'too_small': int(runs.group(3)) if runs else None, 'passed': passed},
            'layout_checks': {'problems': lay, 'passed': not lay},
            'png_sha256': hashlib.sha256(png.read_bytes()).hexdigest() if png.exists() else None,
        }
        ok_all &= passed and not lay
        print(f'{i}: {results[i]["size"]} card.py {card_results} layout problems {len(lay)}')
        for x in lay:
            print('   ', x)
        if not passed:
            print(text)
    log.write_text(json.dumps(results, indent=1), encoding='utf-8')
    sys.exit(0 if ok_all else 1)


if __name__ == '__main__':
    main()
