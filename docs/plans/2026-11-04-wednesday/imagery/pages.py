"""Screenshots of the real pages the Wednesday direction cites, with the proving line marked in mint.
Never a rebuilt page: a page the headless browser cannot open is reported as blocked and skipped.
Run from the repository root: python3 docs/plans/2026-11-04-wednesday/imagery/pages.py"""
import glob, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / 'pages'
PAGES = [
    ('duet-announcement', 'https://claude.com/resources/articles/claude-duet', 'waits for your approval'),
    ('duet-carries-over', 'https://claude.com/resources/articles/claude-duet', 'carries over your memory'),
    ('help-microsoft', 'https://support.claude.com/en/articles/17631495-get-started-with-claude-duet', "Microsoft 365 isn"),
    ('help-limits', 'https://support.claude.com/en/articles/17631495-get-started-with-claude-duet', 'reach your limits sooner'),
    ('claire-vo-review', 'https://www.chatprd.ai/how-i-ai/claude-duet-review', 'I still forgot about the work'),
    ('reddit-normal-claude', 'https://old.reddit.com/r/ClaudeAI/comments/1xeiaqv/has_anyone_actually_gotten_into_claude_duet_yet_i/19rlwqm6sryrm/', "hadn't thought to use it"),
    ('reddit-36-hours', 'https://old.reddit.com/r/ClaudeAI/comments/1xeiaqv/has_anyone_actually_gotten_into_claude_duet_yet_i/19rlqkmapowqp/', '36 hours'),
]
MARK = """(needle) => {
  // hide usernames and avatars (no reviewer or Reddit username on screen)
  for (const el of document.querySelectorAll('a[href*="/user/"], faceplate-tracker[noun="comment_author"], [slot="commentAvatar"], shreddit-comment [slot="authorName"]'))
    { el.style.background = '#0C1512'; el.style.color = '#0C1512'; el.style.borderRadius = '2px'; }
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const low = needle.toLowerCase().replace(/[’']/g, "'");
  let n;
  while ((n = walk.nextNode())) {
    const t = n.nodeValue.replace(/[’']/g, "'"), i = t.toLowerCase().indexOf(low);
    if (i < 0 || !n.parentElement || n.parentElement.closest('script,style')) continue;
    const range = document.createRange();
    range.setStart(n, i); range.setEnd(n, i + needle.length);
    const mark = document.createElement('mark');
    mark.style.cssText = 'background:#7EF0C0;color:#0C1512;padding:0 2px;border-radius:2px';
    range.surroundContents(mark);
    let line = mark.closest('p,li,h1,h2,h3,blockquote,div') || mark;
    line.style.boxShadow = 'inset 4px 0 0 #B7A6FF';
    mark.scrollIntoView({block: 'center'});
    return true;
  }
  return false;
}"""
exe = os.environ.get('PLAYWRIGHT_CHROMIUM_PATH') or next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None)
report = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1,
                        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')
    for name, url, needle in PAGES:
        pg = ctx.new_page()
        try:
            r = pg.goto(url, wait_until='domcontentloaded', timeout=45000)
            pg.wait_for_timeout(3500)
            for label in ('Decline All', 'Reject all', 'Accept All'):
                try:
                    pg.get_by_role('button', name=label).first.click(timeout=1500); break
                except Exception:
                    pass
            status = r.status if r else None
            found = pg.evaluate(MARK, needle)
            pg.wait_for_timeout(500)
            if status and status >= 400:
                report[name] = f'blocked: HTTP {status}'
            elif not found:
                report[name] = 'opened, but the proving line was not found on the page'
                pg.screenshot(path=str(OUT / f'{name}.png'))
            else:
                report[name] = 'ok'
                box = pg.evaluate('''() => { const r = document.querySelector('mark').getBoundingClientRect();
                    return {x: r.x + window.scrollX, y: r.y + window.scrollY, h: document.documentElement.scrollHeight}; }''')
                top = max(0, min(box['y'] - 420, box['h'] - 900))
                pg.screenshot(path=str(OUT / f'{name}.png'), full_page=True, clip={'x': 0, 'y': top, 'width': 1440, 'height': 900})
        except Exception as e:
            report[name] = f'blocked: {type(e).__name__}: {str(e)[:120]}'
        pg.close()
    b.close()
(OUT / 'pages.json').write_text(json.dumps({n: {'url': u, 'line': l, 'result': report[n]} for n, u, l in PAGES}, indent=1))
print(json.dumps(report, indent=1))
