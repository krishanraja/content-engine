"""Render the five Wednesday article figures from checked, bounded evidence.

The original captures stay local. Only the flattened, inspected PNGs may be
sent to the private review board. This renderer never publishes a board.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand
import card

SIZE = (1280, 820)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frame(body, section, evidence, w):
    grok = brand.data_uri(w / 'head-to-head-v2/grok-brand-capture.png')
    muse = brand.data_uri(w / 'head-to-head-v2/muse-brand-capture.png')
    shell = '''<!doctype html><html lang="en"><meta charset="utf-8"><style>__FONTS__
*{box-sizing:border-box}html,body{margin:0;background:#07150f}#figure{width:1280px;height:820px;position:relative;overflow:hidden;background:#07150f;color:#f4efe4;font-family:Archivo,Arial,sans-serif}
.rail{position:absolute;left:54px;right:54px;top:0;height:76px;border-bottom:2px solid #416e58;display:flex;align-items:center;justify-content:space-between}
.wordmark{width:226px}.rail span{font:20px 'IBM Plex Mono',monospace;color:#9fb7aa;letter-spacing:.03em}
.footer{position:absolute;left:54px;right:54px;bottom:20px;border-top:1px solid #355a46;padding-top:12px;display:flex;justify-content:space-between;color:#a2baab;font:16px 'IBM Plex Mono',monospace}
.grok-badge,.muse-badge{display:inline-flex;align-items:center;gap:12px;font:28px Anton,Impact,sans-serif;letter-spacing:.02em;white-space:nowrap}
.grok-badge img{width:58px;height:58px;object-fit:cover;border-radius:13px;border:1px solid #7b9887}
.muse-icon{width:58px;height:58px;position:relative;overflow:hidden;background:#fff;border-radius:11px;flex:none}.muse-icon img{position:absolute;width:222px;height:auto;left:-126px;top:-21px}
.mono{font-family:'IBM Plex Mono',monospace}.mint{color:#86e5b4}.lilac{color:#d7c0ff}.small{font-size:20px;color:#abc5b3}
.panel{background:#17251e;border:2px solid #506b59}.panel.mintline{border-left:9px solid #6de0ab}.panel.lilacline{border-left:9px solid #bba2ee}
.source{font:16px 'IBM Plex Mono',monospace;color:#9eb9a7}
__PAGE_CSS__
</style><main id="figure"><div class="rail"><img class="wordmark" src="__WORDMARK__" alt="makeyourmindup"><span>UNDER.THE.HOOD / __SECTION__</span></div>__BODY__<div class="footer"><span>__EVIDENCE__</span><span>20 OCT 2026 · NOTHING ACTIONED</span></div></main></html>'''
    return (shell.replace('__BODY__', body)
            .replace('__FONTS__', brand.font_css())
            .replace('__WORDMARK__', brand.brand_uri('wordmark'))
            .replace('__GROK_ICON__', grok)
            .replace('__MUSE_ICON__', muse)
            .replace('__SECTION__', section)
            .replace('__EVIDENCE__', evidence))


def grok():
    return '<span class="grok-badge"><img src="__GROK_ICON__" alt="">GROK BOT</span>'


def muse():
    return '<span class="muse-badge"><span class="muse-icon"><img src="__MUSE_ICON__" alt=""></span>MUSE</span>'


def flight(w):
    # This exact crop contains Muse's four-night assertion and no account
    # chrome. It is flattened into the PNG; the raw file is never uploaded.
    raw = (w / 'evidence-raw/muse-nights-claim.jpg').as_uri()
    body = '''<style>
.fare{position:absolute;left:54px;top:106px;width:1172px;height:99px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #426e55}
.fare strong{font:65px Anton,Impact,sans-serif}.fare span{font:22px 'IBM Plex Mono',monospace;color:#bbd1c2}
.trip{position:absolute;left:54px;right:54px;top:231px;height:330px}
.trip-top{font:21px 'IBM Plex Mono',monospace;color:#a7c5b2;display:flex;justify-content:space-between}
.track{position:absolute;left:9px;right:12px;top:77px;height:5px;background:#69dba8}.track:before,.track:after{content:'';position:absolute;top:-10px;width:25px;height:25px;background:#69dba8;border-radius:50%}.track:after{right:0}
.stop{position:absolute;top:103px;font:22px 'IBM Plex Mono',monospace}.stop b{display:block;font:36px Anton,Impact,sans-serif;margin-top:6px}.stop.a{left:0}.stop.b{left:380px}.stop.c{right:0;text-align:right}
.layover{position:absolute;left:375px;top:35px;padding:10px 18px;background:#bda5ec;color:#111817;font:31px Anton,Impact,sans-serif}
.nights{position:absolute;left:0;right:0;bottom:0;height:102px;display:flex;gap:16px;align-items:stretch}
.night{width:27%;background:#183326;border-top:5px solid #79dfab;padding:13px 18px;font:22px 'IBM Plex Mono',monospace}.night b{display:block;margin-top:5px;font:34px Anton,Impact,sans-serif}
.airport{flex:1;border:2px dashed #6b826f;padding:10px 13px;color:#aac3b0;font:18px 'IBM Plex Mono',monospace}.airport b{display:block;margin-top:5px;color:#f4efe4;font:22px Anton,Impact,sans-serif}
.proof{position:absolute;left:54px;right:54px;top:588px;height:173px;background:#1a271e;border-left:9px solid #bba2ee;padding:11px 18px}
.proof-label{display:flex;align-items:center;justify-content:space-between;height:49px}.proof-label b{font:25px Anton,Impact,sans-serif;color:#d7c0ff}
.crop{position:absolute;left:20px;right:20px;top:65px;height:91px;overflow:hidden;background:#eee;border:2px solid #a18ac5}
.crop img{position:absolute;width:2250px;height:auto;left:-766px;top:-595px}
</style><div class="fare"><strong>£335 <span class="small">AIRLINE DIRECT · HISTORICAL FARE</span></strong><span>SEARCHED 20 OCT · NO BOOKING</span></div>
<div class="trip"><div class="trip-top"><span>WED 18 NOV · LONDON</span><span>THU 19 NOV · NEW YORK 22:10</span><span>MON 23 NOV · DEPART 00:10</span></div><div class="track"></div><div class="layover">29H 05M IN LISBON</div><div class="stop a">10:40<b>DEPART</b></div><div class="stop b">22:10 THU<b>ARRIVE</b></div><div class="stop c">00:10 MON<b>FLY HOME</b></div><div class="nights"><div class="night">THU 19<b>NIGHT 1</b></div><div class="night">FRI 20<b>NIGHT 2</b></div><div class="night">SAT 21<b>NIGHT 3</b></div><div class="airport">SUN 22<b>TO THE AIRPORT</b></div></div></div>
<div class="proof"><div class="proof-label">''' + muse() + '''<b>THE ASSISTANT SAID FOUR NIGHTS</b></div><div class="crop"><img src="''' + raw + '''" alt="Cropped source interaction"></div></div>'''
    return frame(body, 'THE FLIGHT', 'FIELD TEST · ORIGINAL INTERACTION CROPPED', w)


def news(w):
    public = (w / 'evidence-raw/community-news.jpg').as_uri()
    body = '''<style>
.months{position:absolute;left:54px;right:54px;top:113px;height:117px;display:flex;align-items:stretch;gap:6px}
.month{flex:1;border-bottom:5px solid #467157;text-align:center;font:24px 'IBM Plex Mono',monospace;color:#89a996;padding-top:21px}.month.first{border-color:#8deab5;color:#fff}.month.last{border-color:#bba2ee;color:#fff}
.arrow{position:absolute;left:134px;right:124px;top:253px;height:3px;background:#769d82}.arrow:after{content:'';position:absolute;right:0;top:-8px;border-left:15px solid #769d82;border-top:9px solid transparent;border-bottom:9px solid transparent}
.date{position:absolute;top:289px;width:548px;height:210px;padding:18px 23px}.date.one{left:54px}.date.two{right:54px}.date h2{font:25px 'IBM Plex Mono',monospace;margin:0 0 11px;color:#a4c7b2}.date strong{font:56px Anton,Impact,sans-serif}.date p{margin:6px 0 0;font:21px Archivo,Arial,sans-serif;color:#cddfd1}.badge-row{height:58px;display:flex;align-items:center;gap:15px;color:#a4c7b2;font:21px 'IBM Plex Mono',monospace}.badge-row .grok-badge{font-size:25px}.badge-row img{height:42px;width:42px}
.research{position:absolute;left:54px;right:54px;top:523px;height:238px;background:#15221b;border-left:9px solid #bba2ee;padding:15px 20px}
.research-head{font:27px Anton,Impact,sans-serif}.research-head span{font:18px 'IBM Plex Mono',monospace;color:#acbdb0;margin-left:15px}
.research-crop{position:absolute;left:20px;right:20px;top:59px;height:161px;overflow:hidden;border:2px solid #9386a4;background:#eee}
.research-crop img{position:absolute;width:1440px;height:auto;left:-47px;top:-386px}
</style><div class="months"><div class="month first">APR</div><div class="month">MAY</div><div class="month">JUN</div><div class="month">JUL</div><div class="month">AUG</div><div class="month">SEP</div><div class="month last">OCT</div></div><div class="arrow"></div>
<section class="date one panel mintline"><h2>EMARKETER · SOURCE PAGE</h2><strong>29 APRIL 2026</strong><p>Publication date of the linked article.</p></section>
<section class="date two panel lilacline"><div class="badge-row">''' + grok() + '''<span>NEWS BRIEF</span></div><strong>9 OCTOBER</strong><p>The same article presented as current news.</p></section>
<section class="research"><div class="research-head">ANOTHER USER KEPT THE NEWS JOB <span>SEPARATE FIRST-WEEK REPORT</span></div><div class="research-crop"><img src="''' + public + '''" alt="Public first-week report"></div></section>'''
    return frame(body, 'THE NEWS', 'SOURCE DATE · TEST READOUT · PUBLIC USER REPORT', w)


def email(w):
    body = '''<style>
.input{position:absolute;left:54px;right:54px;top:112px;height:118px;background:#f1f0eb;color:#102018;border-left:9px solid #75dfab;padding:20px 27px;display:flex;align-items:center;justify-content:space-between}
.input strong{font:39px Anton,Impact,sans-serif}.input span{font:22px 'IBM Plex Mono',monospace}
.step{position:absolute;top:284px;height:145px;padding:15px 18px}.step.a{left:54px;width:342px}.step.b{left:469px;width:342px}.step.c{right:54px;width:342px}
.step small{font:19px 'IBM Plex Mono',monospace;color:#afd2b8}.step strong{display:block;margin-top:10px;font:30px/1.02 Anton,Impact,sans-serif}.step .muse-badge{font-size:21px;gap:8px}.step .muse-icon{width:32px;height:32px;border-radius:6px}.step .muse-icon img{width:122px;left:-69px;top:-11px}
.connector{position:absolute;top:349px;width:73px;height:3px;background:#7aab87}.connector:after{content:'';position:absolute;right:0;top:-7px;border-left:12px solid #7aab87;border-top:8px solid transparent;border-bottom:8px solid transparent}.connector.a{left:396px}.connector.b{left:811px}
.folders{position:absolute;left:54px;right:54px;top:474px;height:275px;background:#f3f1ed;color:#102018;border:2px solid #aaafa9;padding:19px 24px}
.folders-head{display:flex;align-items:center;justify-content:space-between;font:26px 'IBM Plex Mono',monospace;border-bottom:2px solid #cad3cb;padding-bottom:13px}
.folders-head strong{font:49px Anton,Impact,sans-serif;color:#006e4c}
.draft{height:65px;border-bottom:1px solid #ccd4ce;display:flex;align-items:center;gap:18px;font:27px Archivo,Arial,sans-serif}.draft b{width:220px;font:25px 'IBM Plex Mono',monospace}.bar{width:245px;height:15px;background:#abb9ae;border-radius:2px}
.note{position:absolute;right:25px;bottom:18px;font:18px 'IBM Plex Mono',monospace;color:#57715e}
</style><div class="input"><strong>“LESS FORMAL. DON'T PROMISE A DATE.”</strong><span>THE SAME CORRECTION TO BOTH</span></div>
<div class="step a panel mintline"><small>01 · ''' + muse() + '''</small><strong>EDIT DETACHED THE DRAFT</strong></div><div class="connector a"></div>
<div class="step b panel lilacline"><small>02 · SAME ASSISTANT</small><strong>RECREATED IT IN THE THREAD</strong></div><div class="connector b"></div>
<div class="step c panel mintline"><small>03 · GMAIL READBACK</small><strong>TWO DRAFTS REMAINED</strong></div>
<div class="folders"><div class="folders-head"><span>GMAIL · REDACTED READBACK</span><strong>2 DRAFTS</strong></div><div class="draft"><b>IN THREAD</b><span class="bar"></span><span>revised copy</span></div><div class="draft"><b>STANDALONE</b><span class="bar"></span><span>revised copy</span></div><div class="note">ANONYMISED RECONSTRUCTION · NOTHING SENT</div></div>'''
    return frame(body, 'THE WORK EMAIL', 'ASSISTANT DISCLOSURE · INDEPENDENT GMAIL READBACK', w)


def verdict(w):
    rows = [
        ('THE INBOX', 'GROK BOT', 'LEVEL · BOTH CAUGHT TRAPS'),
        ('THE FLIGHT', 'GROK BOT', 'GROK BOT · SEPARATE TRIP'),
        ('CANCELLATION', 'DRAW', 'NO COMPARABLE TEST'),
        ('MY DAY', 'DRAW', 'CAUTION ON GROK BOT'),
        ('THE NEWS', 'DRAW', 'GROK BOT · REPEAT USE'),
    ]
    lines = []
    for name, mine, research in rows:
        lines.append(f'<div class="row"><div class="job">{name}</div><div class="field">{mine}</div><div class="corpus">{research}</div></div>')
    body = '''<style>
.key{position:absolute;left:54px;right:54px;top:111px;height:116px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #477159}
.key-products{display:flex;align-items:center;gap:14px}.key-products .grok-badge,.key-products .muse-badge{font-size:26px}.key-products .grok-badge img,.key-products .muse-icon{width:45px;height:45px}.key-products .muse-icon img{width:172px;left:-98px;top:-16px}.key-products>span{font:20px 'IBM Plex Mono',monospace;color:#b4cdbb}.key strong{font:52px Anton,Impact,sans-serif}
.headers{position:absolute;left:54px;right:54px;top:250px;height:50px;display:grid;grid-template-columns:235px 1fr 1fr;gap:18px;color:#abc8b5;font:23px 'IBM Plex Mono',monospace}
.rows{position:absolute;left:54px;right:54px;top:305px}.row{display:grid;grid-template-columns:235px 1fr 1fr;gap:18px;height:74px;margin-bottom:9px}.row>div{background:#17261e;display:flex;align-items:center;padding:9px 19px}.job{font:27px Anton,Impact,sans-serif}.field{border-left:7px solid #6de0ab;font:28px Anton,Impact,sans-serif}.corpus{border-left:7px solid #bba2ee;font:25px/1.04 Anton,Impact,sans-serif}
.limit{position:absolute;left:54px;right:54px;bottom:71px;display:flex;justify-content:space-between;font:20px 'IBM Plex Mono',monospace;color:#b4cdbb}
</style><div class="key"><div class="key-products">''' + grok() + '''<span>VS</span>''' + muse() + '''</div><strong>KEEP THE SCORES SEPARATE</strong></div>
<div class="headers"><div>ROUND</div><div>MY TEST · ONE RUN EACH</div><div>SUPPLIED RESEARCH</div></div><div class="rows">''' + ''.join(lines) + '''</div><div class="limit"><span>NO AVERAGE · NO SUCCESS RATE</span><span>MISSING RESEARCH STAYS MISSING</span></div>'''
    return frame(body, 'THE VERDICT', 'FIELD READOUTS · ATTRIBUTED PUBLIC SOURCES', w)


def render(html, output, browser):
    html_path = output.with_suffix('.html')
    html_path.write_text(html, encoding='utf-8')
    page = browser.new_page(viewport={'width': SIZE[0], 'height': SIZE[1]}, device_scale_factor=1)
    page.goto(html_path.as_uri())
    card.settle(page)
    assert page.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)')
    assert not page.evaluate(card.CUT_JS, [0, 0, *SIZE])
    assert 'KRISH' not in page.locator('#figure').inner_text().upper()
    output.write_bytes(page.screenshot(clip={'x': 0, 'y': 0, 'width': SIZE[0], 'height': SIZE[1]}))
    page.close()
    return {'sha256': digest(output), 'bytes': output.stat().st_size}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    args = parser.parse_args()
    work = args.work.resolve()
    out = work / 'article-cards-v2'
    out.mkdir(exist_ok=True)
    subprocess.run([sys.executable, str(HERE / 'render_article_evidence_sample_v2.py'), str(work)], check=True)
    inbox = work / 'article-visual-review/inbox-concept-v2.png'
    shutil.copyfile(inbox, out / 'scam-grok.png')
    report = {'scam-grok': {'sha256': digest(out / 'scam-grok.png'), 'bytes': inbox.stat().st_size}}
    with brand.playwright() as playwright:
        browser = brand.browser(playwright)
        for name, make in [('flight-layover', flight), ('news-date', news),
                           ('email-duplicate', email), ('starting-point', verdict)]:
            report[name] = render(make(work), out / f'{name}.png', browser)
        browser.close()
    (out / 'render-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
