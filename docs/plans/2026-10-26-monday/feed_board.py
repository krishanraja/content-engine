"""Put Monday 26 Oct's two finished cuts on the week's web board, for review.

Krish, 28 Oct 2026: "get this done to completion so that we can get this into the publish board and all the
assets into the right places in my drive." The board's own rules apply (docs/PUBLISH_BOARDS.md): the fixed
layout is fed, never edited; Monday's `materials` card (board_materials.py) takes files with an explicit
status and note and never changes the day's state. The cuts go in as a "review" section, not "ready": the
validation gates that need Krish's words are still open and the card says so.

    python docs/plans/2026-10-26-monday/feed_board.py       # build board-new.html and board-assets.json, publish nothing
    python scripts/post-pack/board_web.py publish-web BOARD --assets ASSETS [--apply]     # dry run, then --apply

Nothing is posted anywhere: this writes the board (his workroom), where he ticks each place as he posts.
"""
import argparse
import base64
import hashlib
import html
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN = Path(__file__).resolve().parent
WORK = ROOT / '.cache/produce/2026-10-26-b358e788'
OUT = WORK / 'board'
WEEK, PIECE = '2026-10-26', 'b358e788-209f-427b-a84d-1f79a8ebb430'
sys.path.insert(0, str(ROOT / 'scripts/post-pack'))
import board_web as web  # noqa: E402
import week_board as board  # noqa: E402

LONG = WORK / 'long/share/disney-google-and-character-ai-long-16x9.mp4'
SHORT = WORK / 'short/share/disney-google-and-character-ai-short-9x16.mp4'
THUMBS = {'long': WORK / 'thumbs/thumb-wide-1280x720.jpg', 'short': WORK / 'thumbs/thumb-tall-1080x1920.jpg'}
# What waits on Krish on Monday's tab, in order (the 28 Oct state: the videos are made, and wait for his watch).
WAITING = [
    'Keep your prediction as recorded (1 March 2027, 75%)? It breaks the three-month and 80% rules',
    'Your yes to re-check four corrected article lines (about $0.13)',
    'Sign off seven lines no source confirms word for word',
    'Watch both cuts in full with sound (under The two cuts, for your review) and say yes, or what to change',
    'How many words may show on screen at once? I used 8 in the main picture and 16 in all; your number is the limit',
    'The article names Udio and ElevenLabs, so the video gate wants their real logos on both cuts and both thumbnails: add them, or cut those two names from the article?',
]
WAITING_BEFORE = [   # the board's own four lines on 27 Oct, for the control rebuild
    'Keep your prediction as recorded (1 March 2027, 75%)? It breaks the three-month and 80% rules',
    'Your yes to re-check four corrected article lines (about $0.13)',
    'Sign off seven lines no source confirms word for word',
    'Paste the Codex prompt to start the videos (docs/plans/2026-10-26-monday/CODEX_PROMPT.md)',
]
NOTE = ('For your review, not ready to post. The two cuts below are the 28 Oct rebuild: the new opener, the pictures '
        'that move, and one end screen. Still held, and yours: your full playback with sound, your ruling on how many '
        'words may show on screen, and the logos the article names (Udio and ElevenLabs) that neither cut or '
        'thumbnail carries yet. The full-quality masters are in the Drive archive.')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def preview(path, width):
    from PIL import Image
    im = Image.open(path).convert('RGB')
    im.thumbnail((width, width * 2))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=70)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--control', action='store_true',
                    help="rebuild with the board's own materials and waiting lines, to prove a rebuild changes nothing else")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    state = web.call('GET', f'/api/board/{WEEK}')
    before = OUT / f'board-before-{state["build_id"][:12]}.html'
    # The board as it stands, from the engine's own download (never from memory).
    import subprocess
    subprocess.run([sys.executable, str(ROOT / 'scripts/post-pack/board_web.py'), 'download', WEEK, '--output', str(before)],
                   check=True, capture_output=True, cwd=ROOT)
    assert web.sha(before.read_bytes()) == state['manifest']['html']['sha256'], 'the downloaded board is not the active build'
    page = before.read_text(encoding='utf-8')
    raw = re.findall(r'id="mon-materials" data-materials="([^"]*)"', page)[0]
    original = json.loads(html.unescape(raw))
    material = json.loads(json.dumps(original))
    material['status'], material['note'] = 'review', NOTE
    sections = [s for s in material['sections'] if s['id'] != 'videos']
    files, mappings = [], []
    for key, path, label in (('long', LONG, '5-minute cut, 16:9 (YouTube, Substack): for review, 4:45'),
                             ('short', SHORT, '90-second cut, 9:16 (Shorts, Reels, TikTok, LinkedIn): for review, 1:28')):
        digest = sha(path)
        asset = f'mon-video-{key}'
        url = f'/api/board/{WEEK}/assets/{asset}?sha={digest}'
        files.append({'label': label, 'url': url, 'preview': preview(THUMBS[key], 320)})
        mappings.append({'id': asset, 'source_url': url, 'path': str(path), 'type': 'video/mp4'})
    sections.insert(0, {'id': 'videos', 'title': 'The two cuts, for your review', 'files': files})
    material['sections'] = sections
    use = original if a.control else material
    material_path = (OUT / 'control-materials.json') if a.control else (OUT / 'release-materials.json')
    material_path.write_text(json.dumps(use, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    if a.control:
        mappings = []
    # The assets the board already holds keep their immutable links.
    for aid, spec in (state['manifest'].get('assets') or {}).items():
        rel = f'/api/board/{WEEK}/assets/{aid}?sha={spec["sha256"]}'
        if rel in json.dumps(use):
            mappings.append({'id': aid, 'source_url': rel, 'existing_sha256': spec['sha256']})
    # Monday's seven review boxes come back out of the board exactly as it holds them (words and all), so a
    # rebuild with the same words keeps each box's build time and edit guard.
    reviews = []
    (OUT / 'review').mkdir(exist_ok=True)
    for m in re.finditer(r'<textarea class="rv-text" id="rv-(mon-[^"]*)"[^>]*?data-item="([^"]*)"[^>]*?aria-label="([^"]*)"[^>]*>(.*?)</textarea>', page, re.S):
        path = OUT / 'review' / f'{m.group(2)}.md'
        path.write_text(html.unescape(m.group(4)), encoding='utf-8')
        reviews.append(('--review', f'mon={html.unescape(m.group(3))}|{path}'))
    waiting = WAITING_BEFORE if a.control else WAITING
    reader = board.live_reader()
    (OUT / 'queue.json').write_text(json.dumps(reader('/api/idea-queue'), ensure_ascii=False), encoding='utf-8')
    lessons = []
    try:
        (OUT / 'lessons.json').write_text(json.dumps(reader('/api/video-studio/learning-proposals'), ensure_ascii=False), encoding='utf-8')
        lessons = ['--lessons', str(OUT / 'lessons.json')]
    except board.BoardError as error:   # this key may not read the proposals; the board then keeps its own section
        print('lessons not read:', str(error)[:120])
    week = ROOT / 'docs/plans/2026-10-26-week'
    args = ['--week', WEEK, '--previous', str(before), '--live', '--target', 'web', '--piece', f'mon={PIECE}',
            '--draft', 'mon', '--brief', f'mon={PLAN / "brief.json"}',
            '--keep-draft', 'wed', '--keep-draft', 'fri',
            '--ideas', str(week / 'ideas.json'), '--combine', str(week / 'combine.json'),
            '--queue', str(OUT / 'queue.json'), *lessons,
            '--materials', f'mon={material_path}']
    for flag, value in reviews:
        args += [flag, value]
    for line in waiting:
        args += ['--waiting', f'mon={line}']
    new, meta = board.build(board.parser().parse_args(args))
    issues = board.verify(new)
    assert not issues, issues
    board.write(new, meta, OUT / ('board-control.html' if a.control else 'board-new.html'))
    (OUT / 'board-assets.json').write_text(json.dumps(mappings, indent=1) + '\n', encoding='utf-8')
    print(json.dumps({'expected_build': state['build_id'], 'assets': len(mappings), 'html_bytes': len(new.encode())}))


if __name__ == '__main__':
    main()
