"""Capture the real pages Monday's screen-proof beats show, with the proving words marked.

Each capture is the live page (or the court filing's own PDF page), the words the
signed direction names marked in mint at 30% behind the text, and the boxes of
those words recorded so the panel can keep them sharp and soften the rest of the
page (the visual-clarity word budget counts every legible word). Consent banners
are refused or closed, never accepted. Run from the repository root:

    python docs/plans/2026-10-26-monday/video/capture_sources.py
"""
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = Path(__file__).resolve().parents[1]
WORK = ROOT / '.cache/produce/2026-10-26-b358e788'
OUT = WORK / 'captures'
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand

SOURCES = json.loads((PLAN / 'sources.json').read_text(encoding='utf-8'))
BW = ('https://www.businesswire.com/news/home/20261012656385/en/Character.ai-Initiates-Voluntary-Chapter-11-'
      'Proceeding-to-Facilitate-Value-Maximizing-Sale-Process')
WIRED = 'https://www.wired.com/story/disney-asked-characterai-to-go-bankrupt-for-a-get-out-of-lawsuits-card/'

# id: (url, [phrases to mark, in the order the beat sweeps them])
PAGES = {
    'bw-filing': (BW, ['commenced a voluntary Chapter 11 case']),
    'bw-date': (BW, ['Oct 12, 2026']),
    'wired-majority': (WIRED, ['“vast majority”']),
    'disney-openai': (SOURCES['disney_openai'], ['$1 billion', 'more than 200']),
    'sora-shut': (SOURCES['sora_shutdown'], ['shuttering its stand-alone']),
    'disney-cto': (SOURCES['disney_cto'], ['newly created position']),
}
FILING = ('court-filing', SOURCES['court_filing'], ['diminishing cash reserve', 'litigation and regulatory risks'])

REFUSE = ['Reject All', 'Reject all', 'REJECT', 'Reject', 'Decline', 'Decline all']
HIDE = ('#onetrust-consent-sdk, #onetrust-banner-sdk, [id^="sp_message_container"], .fc-consent-root, '
        '#cookie-banner, .cookie-banner, [aria-label="Cookie banner"] {display:none !important}')

MARK_JS = r'''([phrases]) => {
  // Spaces in a phrase match any run of white space, non-breaking ones included.
  const pattern = p => new RegExp(p.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
  const found = [];
  for (const phrase of phrases) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node, hit = null;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el || !el.offsetParent) continue;
      const m = pattern(phrase).exec(node.textContent);
      if (m) { hit = [node, m.index, m[0].length]; break; }
    }
    if (!hit) { found.push(null); continue; }
    const [n, at, length] = hit;
    const range = document.createRange();
    range.setStart(n, at); range.setEnd(n, at + length);
    const mark = document.createElement('mark');
    mark.style.cssText = 'background: rgba(126,240,192,0.30); color: inherit; padding: 0 2px; border-radius: 2px';
    range.surroundContents(mark);
    found.push(mark);
  }
  if (!found[0]) return null;
  found[0].scrollIntoView({block: 'center'});
  window.scrollBy(0, -60);
  return true;
}'''

RECTS_JS = r'''() => [...document.querySelectorAll('mark')].map(m => [...m.getClientRects()].map(r => [r.x, r.y, r.width, r.height]))'''


def refuse_consent(page):
    for label in REFUSE:
        try:
            button = page.get_by_role('button', name=label, exact=True)
            if button.count():
                button.first.click(timeout=2000)
                time.sleep(1)
                return f'clicked "{label}"'
        except Exception:  # noqa: BLE001 - a banner that is not there is fine
            pass
    page.add_style_tag(content=HIDE)
    return 'hidden (no refuse button)'


def capture_page(context, key, url, phrases):
    page = context.new_page()
    response = page.goto(url, wait_until='domcontentloaded', timeout=60000)
    time.sleep(4)
    consent = refuse_consent(page)
    page.add_style_tag(content=HIDE)
    # Refusing consent can re-render the article: wait until the words are on the page again.
    page.wait_for_function('p => document.body.innerText.replace(/\\s+/g, " ").includes(p)', arg=phrases[0], timeout=30000)
    time.sleep(1)
    if not page.evaluate(MARK_JS, [phrases]):
        raise SystemExit(f'{key}: "{phrases[0]}" is not on {url}')
    # Late adverts move the page: centre the words again until they hold still inside the frame.
    for _ in range(4):
        time.sleep(1.5)
        page.evaluate("() => { document.querySelector('mark').scrollIntoView({block: 'center'}); window.scrollBy(0, -60); }")
        time.sleep(1.5)
        page.screenshot(path=str(OUT / f'{key}.png'))
        rects = page.evaluate(RECTS_JS)
        if all(rects) and all(0 <= y and y + h <= 900 for marks in rects for _, y, _, h in marks):
            break
    else:
        raise SystemExit(f'{key}: the marked words would not stay inside the frame')
    if len(rects) != len(phrases) or not all(rects):
        raise SystemExit(f'{key}: not every phrase was found and marked: {phrases}')
    text = page.evaluate('document.body.innerText')
    record = {'id': key, 'url': url, 'final_url': page.url, 'status': response.status if response else None,
              'title': page.title(), 'captured_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
              'viewport': [1440, 900], 'scale': 2, 'consent': consent, 'phrases': phrases,
              'rects_css': rects, 'phrases_in_text': [re.sub(r'\s+', ' ', p) in re.sub(r'\s+', ' ', text) for p in phrases]}
    page.close()
    return record


def capture_filing(key, url, phrases):
    """The court filing as filed: the PDF page that holds the words, at 200 dpi, word boxes from pdftotext."""
    pdf = OUT / 'court-filing.pdf'
    if not pdf.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        pdf.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    # Poppler's tools, which sit beside pdftoppm (an xpdf pdftotext earlier on PATH has no -bbox).
    poppler = Path(shutil.which('pdftoppm')).parent
    bbox = OUT / 'court-filing.bbox.html'
    subprocess.run([str(poppler / 'pdftotext'), '-bbox', str(pdf), str(bbox)], check=True)
    sheets = re.split(r'(?=<page )', bbox.read_text(encoding='utf-8'))[1:]
    pages = len(sheets)
    for n, html in enumerate(sheets, 1):
        size = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', html)
        words = [(float(a), float(b), float(c), float(d), w) for a, b, c, d, w in
                 re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', html)]
        tokens = [w[4] for w in words]
        boxes = []
        for phrase in phrases:
            want = phrase.split()
            at = next((i for i in range(len(tokens) - len(want) + 1)
                       if [t.strip('.,;:()"“”') for t in tokens[i:i + len(want)]] == want), None)
            boxes.append(None if at is None else [list(w[:4]) for w in words[at:at + len(want)]])
        if all(boxes):
            stem = OUT / key
            subprocess.run([str(poppler / 'pdftoppm'), '-f', str(n), '-l', str(n), '-r', '200', '-png', '-singlefile', str(pdf), str(stem)],
                           check=True)
            k = 200 / 72
            return {'id': key, 'url': url, 'pdf_page': n, 'pdf_pages': pages, 'dpi': 200,
                    'page_points': [float(size.group(1)), float(size.group(2))],
                    'captured_at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'phrases': phrases,
                    'rects_px': [[[x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k] for x0, y0, x1, y1 in b] for b in boxes],
                    'pdf_sha256': __import__('hashlib').sha256(pdf.read_bytes()).hexdigest()}
    raise SystemExit(f'{key}: no single page of the filing holds all of {phrases}')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    with brand.playwright() as p:
        browser = brand.browser(p)
        context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2,
                                      user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                                                 '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')
        for key, (url, phrases) in PAGES.items():
            records.append(capture_page(context, key, url, phrases))
            print(f"captured {key}: {records[-1]['title'][:70]} ({records[-1]['consent']})")
        browser.close()
    records.append(capture_filing(*FILING))
    print(f"captured court-filing: page {records[-1]['pdf_page']} of {records[-1]['pdf_pages']}")
    (OUT / 'captures.json').write_text(json.dumps(records, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
