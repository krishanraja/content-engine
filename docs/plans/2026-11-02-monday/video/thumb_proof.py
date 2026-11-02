"""The format proof for Monday 2 November's two thumbnails, drawn by this piece's own thumbnails.py rather than the
house drawer, so making.py can record them (thumb_problem's approved custom-format receipt).

Each thumbnail's page (thumb-16x9.html, thumb-9x16.html, written beside the JPEG by thumbnails.py) is rendered again at
its delivery size; every text run is measured with scripts/pages/card.py (clipping and the smallest size a phone shows),
and the render must match the JPEG on file (mean absolute difference under MAX_DIFF, so the JPEG is that page). The proof
binds each JPEG by sha256. source_review_sha256 binds review.json: the words Krish picked and his acceptance of the cuts.

    python3 docs/plans/2026-11-02-monday/video/thumb_proof.py
"""
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import card  # noqa: E402

THUMBS = ROOT / '.cache/produce/2026-11-02-9a0c97af/thumbs'
SIZES = {'thumb-16x9.jpg': (1280, 720), 'thumb-9x16.jpg': (1080, 1920)}
MAX_DIFF = 4.0
sha = lambda b: hashlib.sha256(b).hexdigest()


def main():
    verdicts = json.loads((ROOT / 'config/title-verdicts.json').read_text(encoding='utf-8'))
    rows = verdicts if isinstance(verdicts, list) else next(v for v in verdicts.values() if isinstance(v, list))
    picked = [r for r in rows if r.get('piece', '').startswith('9a0c97af') and r.get('verdict') == 'picked']
    review = {'piece': '9a0c97af-f0d6-4d12-a7ce-773c622d4b67',
              'thumbnail_words': 'CLAUDE IS EATING ITS OWN JOBS (docs/plans/2026-11-02-monday/video/FILE.md)',
              'picked_titles': picked,
              'accepted': ['Krish, 2026-11-01: "Approved, file them and put them on the boards"',
                           'Krish, 2026-11-01, on the rebuilt Monday cuts: "I like it - looks good"']}
    rp = THUMBS / 'review.json'
    rp.write_text(json.dumps(review, indent=1), encoding='utf-8')
    proof = {}
    with sync_playwright() as p:
        import glob
        exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))
        browser = p.chromium.launch(executable_path=exe[-1]) if exe else p.chromium.launch()
        for name, (w, h) in SIZES.items():
            jpg = THUMBS / name
            page = browser.new_page(viewport={'width': w, 'height': h})
            page.goto((THUMBS / name.replace('.jpg', '.html')).as_uri())
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(400)
            runs = card.texts(page, (0, 0, w, h))
            clipped = page.evaluate(card.CUT_JS, [0, 0, w, h])
            shot = Image.open(BytesIO(page.screenshot(type='png'))).convert('RGB')
            diff = ImageStat.Stat(ImageChops.difference(shot, Image.open(jpg).convert('RGB'))).mean
            mean = sum(diff) / 3
            ok = card.report(name, w, h, runs)
            assert ok and not clipped and mean < MAX_DIFF, (name, ok, clipped, mean)
            proof[name] = {'sha256': sha(jpg.read_bytes()), 'dimensions': [w, h], 'clipped': clipped,
                           'minimum_phone_text_px': round(min(card.on_phone(r['px'], w) for r in runs), 2),
                           'page': name.replace('.jpg', '.html'), 'render_vs_file_mean_diff': round(mean, 3),
                           'texts': [r['text'] for r in runs]}
        browser.close()
    (THUMBS / 'format-proof.json').write_text(json.dumps({'source_review_sha256': sha(rp.read_bytes()),
        'status': 'approved treatment; delivery formats rendered', 'formats': proof}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: {x: v[x] for x in ('minimum_phone_text_px', 'render_vs_file_mean_diff')} for k, v in proof.items()}))


if __name__ == '__main__':
    main()
