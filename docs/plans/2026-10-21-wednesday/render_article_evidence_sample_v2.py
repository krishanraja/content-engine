"""Render one held, article-width inbox evidence figure. No board mutation."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand
import card


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    args = parser.parse_args()
    work = args.work.resolve()
    output = work / 'article-visual-review'
    output.mkdir(exist_ok=True)
    muse_draft = work / 'evidence-panels/draft-preview.png'
    grok_icon = work / 'head-to-head-v2/grok-brand-capture.png'
    muse_mark = work / 'head-to-head-v2/muse-brand-capture.png'
    assert all(path.is_file() for path in (muse_draft, grok_icon, muse_mark))

    html = '''<!doctype html><html lang="en"><meta charset="utf-8">
<style>__FONTS__
*{box-sizing:border-box}html,body{margin:0;background:#07150f}
#figure{width:1280px;height:790px;overflow:hidden;position:relative;background:#07150f;color:#f4efe4;font-family:Archivo,Arial,sans-serif}
.rail{position:absolute;left:54px;right:54px;top:0;height:76px;border-bottom:2px solid #416e58;display:flex;justify-content:space-between;align-items:center}
.wordmark{width:226px}.rail span{color:#9fb7aa;font:20px 'IBM Plex Mono',monospace;letter-spacing:.035em}
.mail{position:absolute;left:54px;top:112px;width:416px;height:246px;background:#f4f2ed;color:#102018;border:2px solid #a8b7ac;box-shadow:10px 10px 0 #1d392a}
.mail-head{height:52px;border-bottom:1px solid #b6c2b8;padding:13px 19px;font:19px 'IBM Plex Mono',monospace;color:#42604f}
.redact{display:inline-block;background:#aeb8af;height:13px;width:110px;vertical-align:middle;border-radius:2px}
.mail-body{padding:19px 21px;font:31px/1.14 Archivo,Arial,sans-serif;font-weight:650}
.missing{display:inline-block;margin-top:13px;border:2px solid #007c60;color:#00684e;background:#d7f4e8;padding:8px 12px;font:19px 'IBM Plex Mono',monospace}
.grok{position:absolute;left:550px;right:54px;top:112px;height:246px;background:#17251e;border:2px solid #5c8c70;border-left:9px solid #6de0ab;padding:20px 26px}
.grok-row,.muse-row{display:flex;align-items:center;gap:15px}
.grok-icon{width:62px;height:62px;object-fit:cover;border-radius:14px;border:1px solid #82998a}
.label{font:30px Anton,Impact,sans-serif;letter-spacing:.02em}
.tag{margin-left:auto;color:#83ddb0;font:18px 'IBM Plex Mono',monospace}
.quote{margin:17px 0 0;font:45px/1.03 Anton,Impact,sans-serif;letter-spacing:.004em}
.action{margin-top:17px;font:23px Archivo,Arial,sans-serif;color:#c8dacf}
.branch{position:absolute;left:470px;top:229px;width:80px;border-top:4px solid #a5b9a9}
.branch:after{content:'';position:absolute;right:-2px;top:-9px;border-left:13px solid #a5b9a9;border-top:7px solid transparent;border-bottom:7px solid transparent}
.muse{position:absolute;left:54px;right:54px;top:405px;height:320px;background:#18241e;border:2px solid #6e6983;border-left:9px solid #bba2ee;padding:15px 20px;overflow:hidden}
.muse-icon{position:relative;width:62px;height:62px;background:#fff;overflow:hidden;border-radius:12px;flex:none}
.muse-icon img{position:absolute;width:237px;height:auto;left:-135px;top:-23px}
.muse .tag{color:#d6c4ff}.muse-row{height:66px}
.capture{position:absolute;left:19px;right:19px;top:91px;height:211px;overflow:hidden;background:#ebe9ed;border:2px solid #a898c8}
.capture img{position:absolute;width:1150px;height:auto;left:-11px;top:-428px}
.capture-marker{position:absolute;right:19px;top:91px;background:#573e78;color:#fff;padding:8px 13px;font:17px 'IBM Plex Mono',monospace}
.footer{position:absolute;left:54px;right:54px;bottom:23px;display:flex;justify-content:space-between;color:#98b9a4;font:16px 'IBM Plex Mono',monospace}
</style><main id="figure">
<div class="rail"><img class="wordmark" src="__WORDMARK__" alt="makeyourmindup"><span>UNDER.THE.HOOD / THE INBOX</span></div>
<section class="mail" aria-label="Anonymised reconstruction of the incoming question"><div class="mail-head">INCOMING · <span class="redact"></span></div><div class="mail-body">“I’m thinking of ordering six products...”<br><span class="missing">PRODUCT NAMED: NONE</span></div></section>
<div class="branch" aria-hidden="true"></div>
<section class="grok"><div class="grok-row"><img class="grok-icon" src="__GROK_ICON__" alt=""><span class="label">GROK BOT</span><span class="tag">FLAGGED · SKIPPED</span></div><div class="quote">“Never names a product”</div><div class="action">It kept the suspected buyer scam out of the reply queue.</div></section>
<section class="muse"><div class="muse-row"><div class="muse-icon"><img src="__MUSE_MARK__" alt=""></div><span class="label">MUSE</span><span class="tag">DRAFTED A REPLY</span></div><div class="capture"><img src="__MUSE_DRAFT__" alt="Redacted capture of Muse's actual draft"></div><div class="capture-marker">ACTUAL DRAFT · REDACTED</div></section>
<div class="footer"><span>INCOMING MESSAGE RECONSTRUCTED FROM THE TEST READOUT</span><span>20 OCT · NOTHING SENT</span></div>
</main></html>'''
    html = (html.replace('__FONTS__', brand.font_css())
                .replace('__WORDMARK__', brand.brand_uri('wordmark'))
                .replace('__GROK_ICON__', brand.data_uri(grok_icon))
                .replace('__MUSE_MARK__', brand.data_uri(muse_mark))
                .replace('__MUSE_DRAFT__', brand.data_uri(muse_draft)))
    html_path = output / 'inbox-concept-v2.html'
    html_path.write_text(html, encoding='utf-8')
    image_path = output / 'inbox-concept-v2.png'
    with brand.playwright() as playwright:
        browser = brand.browser(playwright)
        page = browser.new_page(viewport={'width': 1280, 'height': 790}, device_scale_factor=1)
        page.goto(html_path.as_uri())
        card.settle(page)
        assert page.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)')
        assert not page.evaluate(card.CUT_JS, [0, 0, 1280, 790])
        image_path.write_bytes(page.screenshot(clip={'x': 0, 'y': 0, 'width': 1280, 'height': 790}))
        page.close()
        browser.close()
    assert 'KRISH' not in html.upper()
    (output / 'inbox-concept-v2.json').write_text(json.dumps({
        'status': 'held revision for visual approval; not on the board',
        'sha256': hashlib.sha256(image_path.read_bytes()).hexdigest(),
        'sources': [str(muse_draft), str(grok_icon), str(muse_mark),
                    'docs/plans/2026-10-19-week/test-results/README.md'],
        'privacy': 'Actual redacted draft; incoming email is explicitly reconstructed; no raw personal capture embedded',
    }, indent=2) + '\n', encoding='utf-8')
    print(image_path)


if __name__ == '__main__':
    main()
