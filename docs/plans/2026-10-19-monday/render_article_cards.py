"""Render existing approved card HTML with an inset article accent rule."""
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path[:0]=[str(ROOT/'scripts/pages'),str(ROOT/'.cache/python-deps')]
import brand
WORK=ROOT/'.cache/produce/2026-10-19-5b5bfadc/kit/panels'
OUT=ROOT/'.cache/monday-release-gates/article-cards';OUT.mkdir(parents=True,exist_ok=True)
with brand.playwright() as p:
 browser=brand.browser(p);page=browser.new_page(viewport={'width':1314,'height':1080})
 for key in ['google','same','bill']:
  source=(WORK/f'{key}-16x9.html').read_text(encoding='utf8')
  source=source.replace('</style>','main{border-top-color:transparent}main:before{content:"";position:absolute;top:12px;left:24px;right:24px;height:12px;background:#ffd84d}</style>')
  (OUT/f'{key}.html').write_text(source,encoding='utf8');page.set_content(source);page.evaluate('document.fonts.ready')
  page.screenshot(path=str(OUT/f'{key}.png'))
 browser.close()
print('Three article cards rendered from the approved HTML; the accent rule is inset from the image edge.')
