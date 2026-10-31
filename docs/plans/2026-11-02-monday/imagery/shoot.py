"""Screenshots the imagery board's drawn pages (codex/*.html) at 1920x1080. Run from this folder."""
import glob, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))[0]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    for f in sys.argv[1:]:
        pg.goto((HERE / f).as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(700)
        out = HERE / f.replace('.html', '.jpg'); pg.screenshot(path=str(out), type='jpeg', quality=88); print('wrote', out)
    b.close()
