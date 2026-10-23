"""Render one held article-visual concept from already redacted, filed evidence.

This is a review sample. It does not alter the publish page or board.
"""
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

    # This image was already redacted for the reviewed video. The raw Muse
    # capture still contains names and an email address and is never embedded.
    muse = work / 'evidence-panels/draft-preview.png'
    community = work / 'evidence-raw/community-scams.jpg'
    assert muse.is_file() and community.is_file()
    html = '''<!doctype html><html lang="en"><meta charset="utf-8">
<style>__FONTS__
*{box-sizing:border-box}html,body{margin:0;background:#09130e}
#figure{width:1600px;height:1260px;overflow:hidden;position:relative;background:#09130e;color:#f6f3eb;font-family:Archivo,Arial,sans-serif}
.top{height:93px;padding:30px 64px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #34413a}
.wordmark{width:338px;height:auto}.series{font:23px 'IBM Plex Mono',monospace;color:#84e8bb;letter-spacing:.02em}
.head{padding:53px 64px 34px}.eyebrow{color:#84e8bb;font:25px 'IBM Plex Mono',monospace;letter-spacing:.05em}
h1{font:90px/.98 Anton,Impact,sans-serif;letter-spacing:.008em;margin:16px 0 0;max-width:1460px}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:0 64px}
.case{height:455px;background:#15231c;border-top:7px solid #84e8bb;padding:28px 32px;overflow:hidden}
.case.muse{border-color:#b5a0ef}.label{font:30px 'IBM Plex Mono',monospace;color:#84e8bb}.muse .label{color:#c6b4ff}
.quote{font:57px/1.12 Anton,Impact,sans-serif;margin:39px 0 0;max-width:580px}
.attribution{color:#b8c6bc;font:21px/1.3 'IBM Plex Mono',monospace;margin-top:35px}
.capture{height:262px;position:relative;overflow:hidden;margin-top:19px;background:#e7e6e8;border:1px solid #c6b4ff}
.capture img{position:absolute;width:720px;height:auto;left:-5px;top:-262px}
.capture-tag{font:18px 'IBM Plex Mono',monospace;color:#b8c6bc;margin-top:15px}
.community{margin:28px 64px 0;border-top:2px solid #557265;display:grid;grid-template-columns:395px 1fr;gap:30px;padding-top:23px}
.community h2{font:37px/1.05 Anton,Impact,sans-serif;margin:0 0 13px}.community p{font:22px/1.22 Archivo,Arial,sans-serif;margin:0;color:#d6e0d8}.source{color:#98b5a4;font:17px 'IBM Plex Mono',monospace;margin-top:14px}
.community-capture{height:174px;overflow:hidden;position:relative;border:1px solid #748b7e;background:#060906}
.community-capture img{position:absolute;width:1700px;height:auto;left:-513px;top:-434px}
.outcome{margin:72px 64px 0;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.result{padding:13px 20px 15px;border-left:8px solid #84e8bb;background:#15231c;font:35px/1 Anton,Impact,sans-serif}
.result.purple{border-color:#b5a0ef}
.result b{font:20px 'IBM Plex Mono',monospace;margin-right:24px;color:#a9c0b2}.result.purple b{color:#c6b4ff}
.bottom{position:absolute;left:64px;right:64px;bottom:20px;border-top:2px solid #34413a;padding-top:16px;display:flex;justify-content:space-between;font:18px 'IBM Plex Mono',monospace;color:#aec2b5}
</style><main id="figure">
<div class="top"><img class="wordmark" src="__WORDMARK__" alt="makeyourmindup"><div class="series">UNDER.THE.HOOD / 21 OCT 2026</div></div>
<div class="head"><div class="eyebrow">01 / THE INBOX</div><h1>WHICH ASSISTANT CAUGHT THE SCAM?</h1></div>
<div class="columns">
<section class="case"><div class="label">GROK BOT / KRISH'S TEST</div><div class="quote">“Never names a product”</div><div class="attribution">It flagged the buyer-scam warning and left the messages out of the reply queue.</div></section>
<section class="case muse"><div class="label">MUSE / KRISH'S TEST</div><div class="capture"><img src="__MUSE__" alt="Redacted capture of Muse's reply draft"></div><div class="capture-tag">ACTUAL INTERACTION · PRIVATE DETAIL REDACTED</div></section>
</div>
<div class="community"><div><h2>ANOTHER TEST. DIFFERENT SCAMS.</h2><p>Both assistants caught the traps in a fake-business trial.</p><div class="source">AI FOR MORTALS · LINKED IN ARTICLE</div></div><div class="community-capture"><img src="__COMMUNITY__" alt="Source-page capture of AI for Mortals scam test"></div></div>
<div class="outcome"><div class="result"><b>MY TEST</b>GROK BOT</div><div class="result purple"><b>OTHER TEST</b>LEVEL</div></div>
<div class="bottom"><span>ONE PERSONAL RUN PER JOB · 20 OCT 2026</span><span>NOTHING WAS SENT</span></div>
</main></html>'''
    html = (html.replace('__FONTS__', brand.font_css())
                .replace('__WORDMARK__', brand.brand_uri('wordmark'))
                .replace('__MUSE__', brand.data_uri(muse))
                .replace('__COMMUNITY__', brand.data_uri(community)))
    html_path = output / 'inbox-concept.html'
    html_path.write_text(html, encoding='utf-8')
    image_path = output / 'inbox-concept.png'
    with brand.playwright() as playwright:
        browser = brand.browser(playwright)
        page = browser.new_page(viewport={'width': 1600, 'height': 1260}, device_scale_factor=1)
        page.goto(html_path.as_uri())
        card.settle(page)
        assert page.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)')
        assert not page.evaluate(card.CUT_JS, [0, 0, 1600, 1260])
        image_path.write_bytes(page.screenshot(clip={'x': 0, 'y': 0, 'width': 1600, 'height': 1260}))
        page.close()
        browser.close()
    (output / 'inbox-concept.json').write_text(json.dumps({
        'status': 'held visual direction for Krish review',
        'sha256': hashlib.sha256(image_path.read_bytes()).hexdigest(),
        'sources': [str(muse), str(community), 'docs/plans/2026-10-19-week/test-results/README.md'],
        'privacy': 'Redacted video capture; no raw personal screenshot embedded',
    }, indent=2) + '\n', encoding='utf-8')
    print(image_path)


if __name__ == '__main__':
    main()
