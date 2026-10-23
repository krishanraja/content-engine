"""Extend the approved Grok Bot/Muse headshot treatment to delivery sizes.

Source captures and generated portraits stay in the local production folder.
Only rendered, reviewed artwork is sent to the private board/library.
"""
import argparse
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/pages'))
import brand
import card


def sha(data):return hashlib.sha256(data).hexdigest()


def compact_html(width,height,source,kind):
    uris={name:brand.data_uri(source/name) for name in ('elon.png','mark.png','grok-brand-capture.png','muse-brand-capture.png')}
    square=kind=='square'
    top=240 if square else 620
    panel_h=650 if square else 700
    portrait_h=515 if square else 540
    id_h=panel_h-portrait_h
    x=64 if square else 72
    card_w=456 if square else 448
    gap=40
    title_top=70 if square else 244
    title_size=76 if square else 104
    footer_top=936 if square else 1450
    footer_size=48 if square else 62
    css=f'''{brand.font_css()}
*{{box-sizing:border-box}}
html,body{{margin:0;background:#0C1512}}
#card{{width:{width}px;height:{height}px;position:relative;overflow:hidden;background:#0C1512;color:#F6F3EB}}
.title{{position:absolute;top:{title_top}px;left:64px;width:{width-128}px;text-align:center;font:{title_size}px/1 Anton,sans-serif;letter-spacing:.012em}}
.duo{{position:absolute;left:{x}px;top:{top}px;width:{card_w*2+gap}px;display:grid;grid-template-columns:{card_w}px {card_w}px;gap:{gap}px}}
.fighter{{position:relative;height:{panel_h}px;overflow:hidden;border:2px solid #F6F3EB55;background:#14221C}}
.fighter.left{{border-top:7px solid #79EDBE}}.fighter.right{{border-top:7px solid #B6A2FF}}
.portrait{{position:absolute;inset:0 0 auto;height:{portrait_h}px;overflow:hidden}}
.portrait img{{width:100%;height:100%;object-fit:cover;object-position:center 24%;display:block}}
.portrait:after{{content:'';position:absolute;inset:0;background:linear-gradient(transparent 82%,#14221C 100%)}}
.id{{position:absolute;top:{portrait_h}px;left:0;right:0;height:{id_h}px;background:#14221C;display:flex;align-items:center}}
.badge{{position:absolute;left:21px;top:{(id_h-86)//2}px;width:86px;height:86px;border:1px solid #F6F3EB55;border-radius:13px;overflow:hidden}}
.badge.grok{{background:#171717}}.badge.grok img{{width:100%;height:100%;object-fit:cover}}
.badge.muse{{background:#F8F8F8}}.badge.muse img{{position:absolute;width:254px;height:auto;left:-134px;top:-10px}}
.product{{position:absolute;left:127px;font:57px/1 Anton,sans-serif}}
.versus{{position:absolute;left:{x+card_w+gap//2-52}px;top:{top+panel_h//2-52}px;width:104px;height:104px;z-index:2;display:grid;place-items:center;border:2px solid #F6F3EB;border-radius:50%;background:#0C1512;font:50px/1 Anton,sans-serif}}
.footer{{position:absolute;left:{x}px;top:{footer_top}px;width:{card_w*2+gap}px;border-top:5px solid #79EDBE;padding-top:26px;text-align:center;font:{footer_size}px/1.15 Anton,sans-serif}}
'''
    return f'''<!doctype html><meta charset="utf-8"><style>{css}</style><div id="card">
<div class="title">GROK BOT vs MUSE</div>
<div class="duo">
<div class="fighter left"><div class="portrait"><img src="{uris['elon.png']}"></div><div class="id"><span class="badge grok"><img src="{uris['grok-brand-capture.png']}"></span><span class="product">GROK BOT</span></div></div>
<div class="fighter right"><div class="portrait"><img src="{uris['mark.png']}"></div><div class="id"><span class="badge muse"><img src="{uris['muse-brand-capture.png']}"></span><span class="product">MUSE</span></div></div>
</div><div class="versus">VS</div><div class="footer">FIVE REAL-WORLD TESTS</div></div>'''


def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);a=ap.parse_args()
    work=a.work.resolve();source=work/'head-to-head-v2';out=work/'head-to-head-final';out.mkdir(exist_ok=True)
    base=(source/'cover-1200x630.html').read_text(encoding='utf-8')
    targets=[('cover-1200x630.png',1200,630,'wide'),('cover.png',1200,800,'wide'),
        ('cover-1200x675.png',1200,675,'wide'),('cover-1080x1080.png',1080,1080,'square'),
        ('cover-1080x1920.png',1080,1920,'tall'),('thumb-wide-1280x720.jpg',1280,720,'wide'),
        ('thumb-tall-1080x1920.jpg',1080,1920,'tall')]
    proof={}
    with brand.playwright() as p:
        browser=brand.browser(p)
        for name,width,height,kind in targets:
            if kind=='wide':
                scale=min(width/1200,height/630)
                html=base+f'<style>body{{width:{width}px;height:{height}px;display:grid;place-items:center}}#card{{transform:scale({scale});transform-origin:center center}}</style>'
            else:html=compact_html(width,height,source,kind)
            page=out/(Path(name).stem+'.html');page.write_text(html,encoding='utf-8')
            pg=browser.new_page(viewport={'width':width,'height':height});pg.goto(page.as_uri());card.settle(pg)
            runs=card.texts(pg,(0,0,width,height));clipped=pg.evaluate(card.CUT_JS,[0,0,width,height])
            assert card.report(name,width,height,runs) and not clipped,(name,clipped)
            badges=pg.locator('.badge').evaluate_all('(els)=>els.map(e=>{let b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})')
            fighters=pg.locator('.fighter').evaluate_all('(els)=>els.map(e=>{let b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})')
            assert (len(badges)==len(fighters)==2
                and abs(badges[0]['w']-badges[1]['w'])<.02
                and abs(fighters[0]['y']-fighters[1]['y'])<.02)
            png=pg.screenshot(clip={'x':0,'y':0,'width':width,'height':height})
            if name.endswith('.jpg'):
                im=Image.open(BytesIO(png)).convert('RGB');im.save(out/name,quality=94,subsampling=0)
            else:(out/name).write_bytes(png)
            proof[name]={'sha256':sha((out/name).read_bytes()),'dimensions':[width,height],
                'badge_boxes':badges,'fighter_boxes':fighters,'clipped':clipped,
                'minimum_phone_text_px':round(min(card.on_phone(run['px'],width) for run in runs),2)}
            pg.close()
        browser.close()
    (out/'format-proof.json').write_text(json.dumps({'source_review_sha256':sha((source/'cover-1200x630.png').read_bytes()),
        'status':'approved treatment; delivery formats rendered','formats':proof},indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'formats':len(proof),'hashes':{k:v['sha256'] for k,v in proof.items()}}))


if __name__=='__main__':main()
