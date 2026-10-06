#!/usr/bin/env python3
"""broadcast: a broadcast email as a page with one Copy button, the pictures in
line and the subject beside it, for a mail tool that is not Substack (Maven,
LinkedIn, a list Krish sends from himself).

    python broadcast.py email.json --out OUTDIR [--check] [--shots] [--links]

Krish, 2026-10-06, asking for the Maven email that said makeyourmindup was
live: "Same as usual, one click copy job with pictures in line and an email
subject". The usual was the launch post's Substack copy, which carried its
pictures inside the page as data URIs. That works for Substack's editor and
fails in an email: Gmail and Outlook drop a picture carried inside the email.
So an email's pictures must already live on the web (the copies Substack
hosts once a post is published are fine), and this tool refuses a picture
that does not.

It writes into OUTDIR:

  email.html                 the copy page: the subject (with any other
                             subjects to choose from) and the preview text,
                             each with a Copy button; Copy email, which puts
                             the email on the clipboard with its pictures and
                             links in place; and Copy HTML code, for a tool
                             that takes HTML in a box.
  email-pictures-off.html    the email as Outlook and many work inboxes first
                             show it, every picture replaced by its alt text.

It stops before writing either if a picture is not on the web over https, a
picture's alt text is under eight words, a link is not https, or any of the
words has an em dash.

--check   presses Copy email the way a person would (Playwright) and counts
          what reached the clipboard: every picture, link and paragraph, and
          every sentence of the email.
--shots   screenshots email.html at 1440 and 390 pixels wide into OUTDIR/shots.
--links   asks the web for every picture and link, and stops if one does not
          answer 200.

The body is markdown: paragraphs, ## headings, lists, **bold**, *italic*,
[links](https://...) and a picture as a paragraph of its own,
![alt text](https://...). README.md, "Emails", has the facts file's fields.
"""
import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
from build import (ALT_MIN_WORDS, PALETTE, SUB_CSS, attr, esc, inline, parse_blocks,  # noqa: E402
                   pictures_off, plain)

PICTURE = re.compile(r'^!\[([^\]]+)\]\((\S+)\)$')
LINK = re.compile(r'(?<!!)\[[^\]]+\]\((\S+?)\)')
EM_DASH = '\u2014'
SUBJECT_MAX = 50   # past about this many characters a phone's inbox cuts the subject off
PREVIEW_MAX = 140  # and about this many for the grey line under it
IMG_WIDTH = 560    # the width an email shows a picture at on a computer

EMAIL_JS = r"""
(function () {
  function plainOf(node) {
    return Array.prototype.map.call(node.children, function (el) {
      if (el.querySelector('img') && !el.textContent.trim()) return '';
      var t = el.textContent.trim();
      el.querySelectorAll('a[href]').forEach(function (a) { t = t.replace(a.textContent.trim(), a.textContent.trim() + ' (' + a.href + ')'); });
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        return Array.prototype.map.call(el.children, function (li) { return '- ' + li.textContent.trim(); }).join('\n');
      }
      return t;
    }).filter(Boolean).join('\n\n');
  }
  function mark(btn, text) { var was = btn.dataset.label || btn.textContent; btn.dataset.label = was; btn.textContent = text; btn.classList.add('done'); setTimeout(function () { btn.textContent = was; btn.classList.remove('done'); }, 2200); }
  function selectNode(n) { var r = document.createRange(); r.selectNodeContents(n); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.querySelectorAll('button.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.dataset.copy);
      var rich = btn.dataset.rich === '1';
      var job;
      try {
        job = rich && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write
          ? navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([src.innerHTML], { type: 'text/html' }), 'text/plain': new Blob([plainOf(src)], { type: 'text/plain' }) })])
          : navigator.clipboard.writeText(src.textContent.trim());
      } catch (e) { job = Promise.reject(e); }
      job.then(function () { mark(btn, 'Copied'); }, function () { if (src.closest('details')) src.closest('details').open = true; selectNode(src); mark(btn, 'Selected: press copy'); });
    });
  });
})();
"""

EMAIL_CSS = """
.paper img { border-radius: 0; }
.subjects { display: flex; flex-direction: column; gap: 10px; }
.alt { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 10px; }
.alt p { margin: 0; font-size: 17px; font-weight: 700; color: var(--cream-2); }
details { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: var(--ink-soft); }
summary { cursor: pointer; font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--mono); font-size: 12px; line-height: 1.5; color: var(--cream-2); max-height: none; margin: 12px 0 0; }
"""


class EmailError(Exception):
    pass


def words(t):
    return len(re.findall(r"[\w'.]+", t))


def blocks_of(md):
    """parse_blocks, with a paragraph that is only a picture made a picture."""
    out = []
    for kind, value in parse_blocks(md):
        m = PICTURE.match(value.strip()) if kind == 'p' else None
        out.append(('img', (m.group(1), m.group(2))) if m else (kind, value))
    return out


def problems(facts, md):
    """Everything that would make the email fail in an inbox. Empty when it is fine."""
    found = []
    every = [('subject', facts.get('subject', ''))] + [('other subject', s) for s in facts.get('other_subjects', [])]
    every += [('preview', facts.get('preview', '')), ('email', md)]
    for name, text in every:
        if EM_DASH in text:
            found.append(f'the {name} has an em dash (house rule: none, anywhere)')
    if not facts.get('subject', '').strip():
        found.append('there is no subject')
    pictures = 0
    for kind, value in blocks_of(md):
        if kind == 'img':
            pictures += 1
            alt, src = value
            if not src.startswith('https://'):
                found.append(f'picture {pictures} is not on the web over https ({src[:60]}): Gmail and Outlook drop '
                             'a picture carried inside the email, so use the copy Substack hosts once the post is out')
            if words(alt) < ALT_MIN_WORDS:
                found.append(f'picture {pictures} has {words(alt)} words of alt text; a reader with pictures off needs '
                             f'at least {ALT_MIN_WORDS} to get its point ("{alt[:60]}")')
    if re.search(r'!\[\]\(', md):
        found.append('a picture has no alt text')
    for url in LINK.findall(md):
        if not url.startswith('https://') and not url.startswith('mailto:'):
            found.append(f'a link is not https ({url[:60]})')
    return found


def warnings(facts):
    out = []
    for s in [facts['subject']] + facts.get('other_subjects', []):
        if len(s) > SUBJECT_MAX:
            out.append(f'subject "{s}" is {len(s)} characters; a phone cuts it off after about {SUBJECT_MAX}')
    if len(facts.get('preview', '')) > PREVIEW_MAX:
        out.append(f'the preview is {len(facts["preview"])} characters; inboxes show about {PREVIEW_MAX}')
    return out


def email_html(md):
    """The email as clean HTML: what the Copy email button copies. Pictures get
    a width and a max-width so a phone's mail app shrinks them to fit."""
    parts = []
    for kind, value in blocks_of(md):
        if kind == 'img':
            alt, src = value
            parts.append(f'<p><img src="{attr(src)}" alt="{attr(alt)}" width="{IMG_WIDTH}" '
                         f'style="display:block;width:100%;max-width:{IMG_WIDTH}px;height:auto;border:0"></p>')
        elif kind in ('h2', 'h3'):
            parts.append(f'<{kind}>{inline(value)}</{kind}>')
        elif kind in ('ul', 'ol'):
            parts.append(f'<{kind}>' + ''.join(f'<li>{inline(x)}</li>' for x in value) + f'</{kind}>')
        elif kind == 'quote':
            parts.append(f'<blockquote><p>{inline(value)}</p></blockquote>')
        else:
            parts.append(f'<p>{inline(value)}</p>')
    return '\n'.join(parts)


def code_html(body):
    """The same email for a tool that takes HTML in a box: one 600-pixel
    column, styled inline because email apps ignore a style sheet."""
    p = 'margin:0 0 16px;font-family:Georgia,serif;font-size:17px;line-height:1.55;color:#0C1512'
    h = 'margin:24px 0 10px;font-family:Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.06em;color:#0C1512'
    styled = re.sub(r'<p>(?!<img)', f'<p style="{p}">', body)
    styled = re.sub(r'<p>(?=<img)', '<p style="margin:0 0 16px">', styled)
    styled = re.sub(r'<(h2|h3)>', lambda m: f'<{m.group(1)} style="{h}">', styled)
    styled = styled.replace('<a href=', '<a style="color:#0B5E43" href=')
    return f'<div style="max-width:600px;margin:0 auto">\n{styled}\n</div>'


def render(facts, body):
    accent = PALETTE.get(facts.get('accent', ''), '#7EF0C0')
    title = f'{facts.get("for", "Broadcast")} email'
    alts = ''.join(
        f'<div class="alt"><p id="s{n}">{esc(s)}</p><button class="copy" type="button" data-copy="s{n}">Copy</button></div>'
        for n, s in enumerate(facts.get('other_subjects', []), 1))
    other = f'<span class="label" style="margin-top:6px">Or one of these</span>{alts}' if alts else ''
    preview = ''
    if facts.get('preview'):
        preview = ('<div class="field"><div class="field-head"><span class="label">Preview text, the grey line after the subject</span>'
                   '<button class="copy" type="button" data-copy="pv">Copy</button></div>'
                   f'<p class="s" id="pv">{esc(facts["preview"])}</p></div>')
    note = facts.get('note') or ('Paste it into the email on a computer. The pictures come across with it, because '
                                 'they live on the web. Send yourself a test first and open it on your phone.')
    fonts = brand.font_css(extra=[brand.SERIF_FILE])
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>{fonts}</style>
<style>{SUB_CSS.replace('ACCENT', accent)}{EMAIL_CSS}</style>
</head>
<body>
<main class="wrap">
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="label">{esc(facts.get('about') or title)}</span>
    <h1>Ready to <em>send</em></h1>
    <p class="lede">The subject, the preview line and the email, each with its own Copy button. The pictures sit in the email, in place.</p>
  </header>
  <div class="field subjects"><div class="field-head"><span class="label">Subject</span><button class="copy" type="button" data-copy="sub">Copy</button></div><p class="t" id="sub">{esc(facts['subject'])}</p>{other}</div>
  {preview}
  <div class="bar"><span class="label">The email</span><button class="copy big" type="button" data-copy="email" data-rich="1">Copy email</button></div>
  <p class="note">{esc(note)}</p>
  <article class="paper" id="email">
{body}
  </article>
  <details><summary>HTML code, for a tool that takes HTML in a box</summary>
    <div class="bar" style="margin-top:12px"><span class="label">One 600-pixel column, styled inline</span><button class="copy" type="button" data-copy="code">Copy HTML code</button></div>
    <pre id="code">{esc(code_html(body))}</pre>
  </details>
</main>
<script>{EMAIL_JS}</script>
</body>
</html>
"""


def sentences(md):
    """The email's sentences as a reader sees them, for the clipboard check."""
    text = ' '.join(plain(v) if isinstance(v, str) else ' '.join(plain(x) for x in v)
                    for k, v in blocks_of(md) if k != 'img')
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if len(s.strip()) > 3]


def clipboard_check(path, md):
    with brand.playwright() as p:
        b = brand.browser(p)
        ctx = b.new_context(permissions=['clipboard-read', 'clipboard-write'])
        pg = ctx.new_page()
        pg.goto(Path(path).resolve().as_uri())
        pg.click('button[data-copy="email"]')
        pg.wait_for_timeout(600)
        res = pg.evaluate("""async () => {
          const items = await navigator.clipboard.read();
          const html = await (await items[0].getType('text/html')).text();
          const text = await (await items[0].getType('text/plain')).text();
          const ed = document.createElement('div'); ed.innerHTML = html;
          const imgs = [...ed.querySelectorAll('img')];
          const src = document.getElementById('email');
          return { button: document.querySelector('button[data-copy="email"]').textContent, types: items[0].types,
                   images: imgs.length, onweb: imgs.filter(i => (i.getAttribute('src') || '').startsWith('https://')).length,
                   withAlt: imgs.filter(i => (i.getAttribute('alt') || '').trim()).length,
                   want: src.querySelectorAll('img').length, links: ed.querySelectorAll('a[href]').length,
                   wantLinks: src.querySelectorAll('a[href]').length, words: ed.textContent.replace(/\\s+/g, ' '), text };
        }""")
        b.close()
    print(f'clipboard check: {path}')
    print(f'  button said "{res["button"]}"; clipboard holds {", ".join(res["types"])}')
    ok = res['button'] == 'Copied'
    for name, got, want in (('pictures', res['images'], res['want']), ('on the web', res['onweb'], res['want']),
                            ('with alt text', res['withAlt'], res['want']), ('links', res['links'], res['wantLinks'])):
        ok &= got == want
        print(f'  {name:<14} {got} of {want}' + ('' if got == want else '  <-- lost in the copy'))
    copied = html.unescape(res['words'])
    missing = [s for s in sentences(md) if s not in copied]
    for s in missing:
        print('  missing:', s[:110])
    ok &= not missing
    links_in_text = res['text'].count('https://')
    print(f'  plain-text copy: {len(res["text"])} characters, {links_in_text} links written out in full')
    print('  result:', 'it will paste whole' if ok else 'something did not copy; do not paste this yet')
    return ok


def check_links(md):
    """Every picture and link answers 200 from the web."""
    urls = [v[1] for k, v in blocks_of(md) if k == 'img'] + [u for u in LINK.findall(md) if u.startswith('https://')]
    bad = []
    for url in dict.fromkeys(urls):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (makeyourmindup email check)'})
            with urllib.request.urlopen(req, timeout=30) as r:
                code, kind = r.status, r.headers.get('Content-Type', '')
        except Exception as e:  # noqa: BLE001
            code, kind = getattr(e, 'code', 'no answer'), ''
        print(f'  {code} {kind.split(";")[0]:<12} {url[:100]}')
        if code != 200:
            bad.append(url)
    return bad


def shots(out):
    folder = Path(out) / 'shots'
    folder.mkdir(parents=True, exist_ok=True)
    with brand.playwright() as p:
        b = brand.browser(p)
        for w in (1440, 390):
            pg = b.new_page(viewport={'width': w, 'height': 900})
            pg.goto((Path(out) / 'email.html').resolve().as_uri())
            pg.evaluate('document.fonts.ready.then(() => true)')
            pg.wait_for_load_state('networkidle')
            sw = pg.evaluate('document.documentElement.scrollWidth')
            path = folder / f'email-{w}.png'
            pg.screenshot(path=str(path), full_page=True)
            print(f'  {path}' + (f'  <-- wider than the screen ({sw}px): something overflows' if sw > w else ''))
            pg.close()
        b.close()


def self_test():
    good = {'subject': 'A subject'}
    pic = '![A picture of the receipt with every line filled in](https://example.com/a.png)'
    cases = [
        ('a good email passes', good, f'Hello.\n\n{pic}', 0),
        ('an embedded picture is refused', good, '![A picture of the receipt with every line filled in](data:image/png;base64,AAAA)', 1),
        ('short alt text is refused', good, '![Receipt](https://example.com/a.png)', 1),
        ('an em dash is refused', good, 'One thing \u2014 another.', 1),
        ('an em dash in the subject is refused', {'subject': 'A \u2014 B'}, 'Hello.', 1),
        ('a plain http link is refused', good, '[here](http://example.com)', 1),
        ('no subject is refused', {'subject': ''}, 'Hello.', 1),
    ]
    failed = 0
    for name, facts, md, want in cases:
        got = len(problems(facts, md))
        ok = got == want
        failed += not ok
        print(('ok    ' if ok else 'FAIL  ') + name + ('' if ok else f' (found {got} problems, wanted {want})'))
    body = email_html(f'Read [this](https://example.com).\n\n{pic}')
    for name, ok in (('the picture keeps its web address', 'src="https://example.com/a.png"' in body),
                     ('the picture shrinks on a phone', 'max-width:560px' in body),
                     ('the HTML code is styled inline', 'style="margin:0 0 16px;font-family' in code_html(body))):
        failed += not ok
        print(('ok    ' if ok else 'FAIL  ') + name)
    print('self-test', 'passed' if not failed else f'failed ({failed})')
    return 1 if failed else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('facts', nargs='?')
    ap.add_argument('--out')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--shots', action='store_true')
    ap.add_argument('--links', action='store_true')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.facts or not a.out:
        ap.error('give the facts file and --out')
    facts_path = Path(a.facts)
    facts = json.loads(facts_path.read_text(encoding='utf-8'))
    md = (facts_path.parent / facts['body']).read_text(encoding='utf-8')
    found = problems(facts, md)
    if found:
        print('Not written. Fix these first:')
        for f in found:
            print('  -', f)
        return 1
    for w in warnings(facts):
        print('note:', w)
    if a.links:
        print('asking the web for every picture and link:')
        bad = check_links(md)
        if bad:
            print(f'Not written: {len(bad)} did not answer 200.')
            return 1
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    body = email_html(md)
    page = out / 'email.html'
    page.write_text(render(facts, body), encoding='utf-8')
    print(f'{page}  the copy page: subject, preview, Copy email, Copy HTML code')
    pictures_off(f'<meta charset="utf-8"><div style="max-width:600px;margin:24px auto;font:17px/1.55 Georgia,serif">{body}</div>', out)
    ok = True
    if a.check:
        ok = clipboard_check(page, md)
    if a.shots:
        shots(out)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
