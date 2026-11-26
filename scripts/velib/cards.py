"""ve card, dispatch and verify-card: exact Codex task cards, sent through scripts/codex_thread.mjs (never the Codex
plugin's long-running broker, never the codex-rescue subagent), checked by Claude outside the sandbox. Codex's own report
is never evidence. Ruling (Krish, 2026-11-15): Claude starts Codex only through scripts/codex_thread.mjs."""
from __future__ import annotations

import fnmatch
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from . import ideaguard
from .common import ROOT, card_worktree, load_json, native_path, write_json

MODEL = 'gpt-6.1-sol'   # measured cheapest per allowance point (27.0M tokens per 1%); pin, never inherit astra/high
EFFORT = 'medium'

CARD_TEMPLATE = """---
card: {card_id}
kind: {kind}
model: {model}
effort: {effort}
max_minutes: {max_minutes}
max_calls: {max_calls}
cwd: {cwd}
write_allow: {write_allow}
read: {read}
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# {title}

## Goal
{goal}

## Contract
{contract}

## Acceptance (every command must exit 0 inside your sandbox)
{acceptance}

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{{"card": "{card_id}", "files_changed": [...], "commands": [{{"cmd": "...", "exit_code": 0}}], "open_questions": [...]}}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
"""


def _require_design_lock(meta: dict) -> None:
    fmt = meta.get('format')
    if fmt and meta.get('kind') in ('device', 'format_config'):
        from . import designlock
        try:
            lock = designlock.load()
            ok = not designlock.validate(lock) and designlock.frozen(lock, fmt)[0]
        except (OSError, ValueError, KeyError, TypeError):
            ok = False
        if not ok:
            sys.exit(f'no frozen design lock for {fmt}: run ve lock freeze')


def motion_section(style_id: str) -> str:
    """A card's own copy of the piece's motion style, from the style bank's motion layer, so Codex builds to the same
    rules Claude picked by: its name, what it is, its rules and what it never does. Brand roles and the design lock
    still win. A style the bank does not hold, or one Krish marked not for us, is refused."""
    bank = load_json(ROOT / 'config' / 'style-references.json').get('bank') or []
    m = next((x for x in bank if x.get('id') == style_id and x.get('layer') == 'motion'), None)
    if m is None:
        sys.exit(f've card: motion_style {style_id!r} is not a motion style in config/style-references.json')
    if m.get('krish_verdict') == 'not for us':
        sys.exit(f've card: Krish marked motion style {style_id!r} not for us')
    rules = '\n'.join(f'- {r}' for r in m.get('rules') or [])
    avoid = '\n'.join(f'- {r}' for r in m.get('avoid') or [])
    return (f'\n## Motion style: {m["name"]} ({style_id}, {m.get("krish_verdict")})\n{m["how"]}\n'
            f'Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.\n'
            f'{rules}\nNever:\n{avoid}\n')


RECIPES = ROOT / 'config' / 've' / 'recipes'


def recipe_section(style_id: str) -> str:
    """The style's recipe, when one was saved from a cut Krish approved (config/ve/recipes/<style>.json; ghost-editor's
    rule: a look is saved only from a reel the user loved): the thesis, the invariants and the signature devices, so a
    card builds the whole system, not one effect. No recipe, no section."""
    path = RECIPES / f'{style_id}.json'
    if not path.is_file():
        return ''
    r = load_json(path)
    saved = r.get('saved_from') or {}
    lines = [f'\n## Recipe: {r["name"]}', r['thesis'], 'Invariants:']
    lines += [f'- {x}' for x in r.get('invariants') or []]
    lines += ['Signature devices (one or two a beat):'] + [f'- {x}' for x in r.get('signature_devices') or []]
    lines.append(f"Worked example: {saved.get('title', '')}, cuts {', '.join(c['id'] for c in saved.get('cuts') or [])} "
                 f"(config/ve/recipes/{style_id}.json).")
    return '\n'.join(lines) + '\n'


def _piece_motion(fields: dict) -> None:
    """A card for one piece (fields['spec'], the piece's ve spec) carries that piece's motion style, so no route can
    send Codex a piece card without it. A library device card names no spec and stays style-free: it serves every
    piece. A piece due from creative_direction.MOTION_FROM with no style.motion is refused, as ve lint refuses it."""
    spec_path = fields.pop('spec', None)
    if not spec_path or fields.get('motion_style'):
        return
    spec = load_json(ROOT / spec_path if not Path(spec_path).is_absolute() else Path(spec_path))
    module = ((spec.get('style') or {}).get('motion') or {}).get('module')
    if module:
        fields['motion_style'] = module
        return
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: E402
    if str(spec.get('publish_day') or '') >= creative_direction.MOTION_FROM:
        sys.exit(f've card: {spec_path} names no style.motion; pick one from the bank before a card goes to Codex')


# The visual kinds (Ruling, Krish, 2026-11-13; then "memes and Notes images should go the same way"). The Claude session
# writes the words first, then one card; Codex builds in code through the plugin and the session verifies it. ve card
# holds the card to the brand palette for its day and to the inspiration cards Krish ticked (F26).
VISUAL_KINDS = ('carousel', 'meme', 'notes_image', 'cover')
# A carousel card is retired (Krish, 2026-11-26: "Tell the Content-engine story intelligence for makeyourmindup v5 session
# that it is to enforce carousel formatting"): a carousel is made only by the v5 Library's make_piece.py --set <set>, its
# first slide by make_covers.py, through scripts/carousel_make.py, which holds it to config/carousel-format.json. A Codex
# card that draws a carousel would be a second renderer, so ve card refuses the kind.
CAROUSEL_RETIRED = ('ve card: a carousel card is retired. A carousel is made only by the v5 Library: python3 '
                    'scripts/carousel_make.py <piece> --set <set> --deck DECK.json --out <folder> (make_piece.py --set '
                    '<set>, its first slide from make_covers.py, held to config/carousel-format.json by '
                    'scripts/carousel_check.py). Codex builds only a photoreal still of the specific thing.')
# A face-led cover (Ruling, Krish, 2026-11-17: "yes to the face plan", "actually use codex to draw"): his own accounts
# (TikTok, X, LinkedIn, Threads, Substack Notes) and the face arm of the YouTube test carry his cutout headshot large,
# like the Rio Meets reference; Instagram, Facebook and Substack keep the Receipt. The card names the channel and the
# photos (from scripts/post-pack/photos.py), and is held to the palette's thumbnail_wide and cover_tall formats and the
# cover standard (docs/production/COVER-STANDARD.md).
FACE_CHANNELS = ('tiktok', 'x', 'linkedin', 'threads', 'substack-notes', 'youtube')


def visual_sections(fields: dict) -> str:
    """The card's own Brand and References sections; refuses what the route forbids."""
    import datetime
    kind = fields['kind']
    if kind == 'carousel':
        sys.exit(CAROUSEL_RETIRED)
    fields.pop('deck', None)
    refs = fields.pop('references', None)
    refs = [str(r).strip() for r in (refs if isinstance(refs, (list, tuple)) else [refs] if refs else []) if str(r).strip()]
    if not refs:
        sys.exit(f've card: a {kind} card names the inspiration cards Krish ticked for it ("references": their ids); '
                 'a picture designed without its references is refused (F26)')
    when = str(fields.pop('date', '') or '')
    try:
        datetime.date.fromisoformat(when)
    except ValueError:
        sys.exit(f've card: a {kind} card names the day it posts ("date": YYYY-MM-DD), so it wears that day\'s palette')
    palette_kind = fields.pop('palette_kind', None) or ('series' if kind == 'cover' else 'off')
    fmt = 'saturday_good_news' if kind == 'carousel' and fields.pop('good_news', False) else kind
    sys.path.insert(0, str(ROOT / 'scripts'))
    import brand_palette
    out = ''
    if kind == 'cover':
        channel = str(fields.pop('channel', '') or '')
        photos = fields.pop('photos', None) or []
        if channel not in FACE_CHANNELS:
            sys.exit(f've card: a cover card names its channel, one of {", ".join(FACE_CHANNELS)} (Instagram, Facebook and '
                     'Substack keep the Receipt, Ruling, Krish, 2026-11-17)')
        if not photos:
            sys.exit('ve card: a cover card names the headshot cutouts it may use ("photos", from .cache/photos via '
                     'scripts/post-pack/photos.py fetch)')
        for f in ('thumbnail_wide', 'cover_tall'):
            out += (f'\n## Brand ({f}, {palette_kind}, {when}; config/brand-palette.json, Ruling, Krish, 2026-11-12)\n'
                    f'{json.dumps(brand_palette.expect(when, f, palette_kind), sort_keys=True)}\n')
        out += (f'\n## Face (channel {channel}; Ruling, Krish, 2026-11-17)\n'
                'His cutout headshot fills about a third of the frame, cut out on the series colour, never a circle; the '
                'headline is the largest thing (at most 7 words, docs/production/COVER-STANDARD.md); at most three parts '
                'besides it; no badge; his name never appears. Use only these photos, unedited apart from scale and '
                'position: ' + ', '.join(str(p) for p in photos) + '.\n'
                'Draw both sizes: 1280x720 and 1080x1920, the tall one clear of the 3:4 grid crop (scripts/channel_safe.py).\n')
        out += ('Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.\n'
                '\n## References (the inspiration cards Krish ticked; build to them, never copy them)\n'
                + ''.join(f'- {r}\n' for r in refs))
        return out
    brand = brand_palette.expect(when, fmt, palette_kind)
    if brand is None:
        sys.exit(f've card: config/brand-palette.json has no {fmt} ({palette_kind}) for {when}')
    out = (f'\n## Brand ({fmt}, {palette_kind}, {when}; config/brand-palette.json, Ruling, Krish, 2026-11-12)\n'
           f'{json.dumps(brand, sort_keys=True)}\n'
           'Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.\n'
           '\n## References (the inspiration cards Krish ticked; build to them, never copy them)\n'
           + ''.join(f'- {r}\n' for r in refs))
    return out


def never_section(spec: dict) -> str:
    """The piece's own never-list (style.idea.never), in the card Codex reads: a card was carrying the motion style's Never and
    nothing of the spec's, so a card could ask for what the spec forbids (Tue 17: "no invented numbers" against a card
    that asked for "Q3 revenue grew 40%")."""
    never = [str(n).strip() for n in ((spec.get('style') or {}).get('idea') or {}).get('never') or [] if str(n).strip()]
    if not never:
        return ''
    return "\n## Never (this piece's own list, style.idea.never in its spec; it binds this card too)\n" + '\n'.join(f'- {n}' for n in never) + '\n'


def _piece_spec(fields: dict) -> tuple[dict, Path, str] | None:
    """The spec a card names (fields['spec']), read before _piece_motion pops it: (spec, its file, its path as written)."""
    spec_path = fields.get('spec')
    if not spec_path:
        return None
    file = ROOT / spec_path if not Path(spec_path).is_absolute() else Path(spec_path)
    return load_json(file), file, str(spec_path)


def _piece_gates(fields: dict, named: tuple[dict, Path, str], path: Path) -> None:
    """A card for a piece is refused until the Critic's two questions have been asked of the spec (critic.pre), and while its
    quoted on-screen words carry a number the piece does not own (numbers.invented)."""
    from . import guards, precritic  # noqa: PLC0415
    spec, file, _ = named
    if guards.pre_critic_bound(spec):
        ok, why = precritic.state(spec, file)
        if not ok:
            sys.exit(f've card: {path.name}: {why}')
    problems = ideaguard.card_problems(fields, spec, file.parent, _supplied(fields))
    if problems:
        sys.exit(f've card: {path.name} refused:\n  ' + '\n  '.join(problems))


def _supplied(fields: dict) -> list[str]:
    raw = fields.get('numbers_supplied') or []
    return [x.strip() for x in raw.split(',') if x.strip()] if isinstance(raw, str) else [str(x) for x in raw]


def write_card(path: Path, **fields) -> Path:
    named = _piece_spec(fields)
    if named:
        _piece_gates(fields, named, path)
    _piece_motion(fields)
    _require_design_lock(fields)
    visual = visual_sections(fields) if fields.get('kind') in VISUAL_KINDS else ''
    fields.setdefault('model', MODEL)
    fields.setdefault('effort', EFFORT)
    fields.setdefault('max_minutes', 40)
    fields.setdefault('max_calls', 40)
    # Paths may come as a JSON list or as the card's own "[a, b]" text; the card always carries the text, since
    # verify() reads it back by splitting on commas (11 Nov 2026: a list written as Python's repr kept its quotes,
    # so no path matched and a correct build was refused as outside write_allow).
    for key in ('write_allow', 'read'):
        if isinstance(fields.get(key), (list, tuple)):
            fields[key] = '[' + ', '.join(str(p) for p in fields[key]) + ']'
    text = CARD_TEMPLATE.format(**fields)
    if fields.get('format'):
        text = text.replace('\nkind:', f'\nformat: {fields["format"]}\nkind:', 1)
    if fields.get('motion_style'):
        text = text.replace('\nkind:', f'\nmotion_style: {fields["motion_style"]}\nkind:', 1)
        text = text.replace('\n## Acceptance', motion_section(fields['motion_style']) + recipe_section(fields['motion_style'])
                            + '\n## Acceptance', 1)
    if visual:
        text = text.replace('\n## Acceptance', visual + '\n## Acceptance', 1)
    if named:
        # The card names its spec (verify-card and the pre-critic read it back) and carries the spec's never-list.
        text = text.replace('\nkind:', f'\nspec: {named[2]}\nkind:', 1)
        if _supplied(fields):
            text = text.replace('\nkind:', f'\nnumbers_supplied: {", ".join(_supplied(fields))}\nkind:', 1)
        text = text.replace('\n## Acceptance', never_section(named[0]) + '\n## Acceptance', 1)
    if len(text.encode('utf-8')) > 6144:
        sys.exit(f've card: {path.name} is {len(text.encode())} bytes; a card is 6 KB or less')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    return path


def parse_card(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    head = text.split('---', 2)[1]
    meta = {}
    for line in head.strip().splitlines():
        key, _, value = line.partition(':')
        meta[key.strip()] = value.strip()
    meta['acceptance'] = re.findall(r'^\s*`?(npx [^`\n]+|npm run [^`\n]+|pnpm [^`\n]+|python3? [^`\n]+|node [^`\n]+)`?\s*$', text.split('## Acceptance', 1)[1].split('## Return', 1)[0], re.M)
    return meta


CODEX_THREAD = ROOT / 'scripts' / 'codex_thread.mjs'


def codex_thread() -> str:
    """The one way Claude starts Codex: scripts/codex_thread.mjs drives `codex app-server` directly, one short-lived
    server per command, so each card is a permanent thread in Krish's Desktop home that he can open and type in. Which
    node and codex run it is velib.codex_route's (thread_command): in WSL with his Windows home, the Windows ones."""
    return str(CODEX_THREAD)


# A card's own limits (W2.12): max_minutes and max_calls are enforced, not advice. A foreground dispatch is stopped at
# max_minutes; verify-card reads the card's Codex session log and refuses a run that went past either limit.
def card_limits(meta: dict) -> tuple[int, int]:
    try:
        minutes, calls = int(meta.get('max_minutes', 40)), int(meta.get('max_calls', 40))
    except (TypeError, ValueError):
        sys.exit(f've card {meta.get("card")}: max_minutes and max_calls are whole numbers')
    if not (1 <= minutes <= 240 and 1 <= calls <= 400):
        sys.exit(f've card {meta.get("card")}: max_minutes is 1 to 240 and max_calls 1 to 400')
    return minutes, calls


def _codex_home_module():
    sys.path.insert(0, str(ROOT / 'scripts' / 'overnight'))
    import codex_home
    return codex_home


def codex_homes() -> list[Path]:
    """Every folder a card's Codex session can log to: the home Krish's Codex Desktop app reads (the --visible route),
    the Studio's own Codex home when it is built (where video cards run by default),
    CODEX_HOME when set, and ~/.codex. Reading only ~/.codex marked every card run under the Studio home as having no
    session log (found 2026-11-01 proving the Codex lane)."""
    homes = []
    try:
        codex_home = _codex_home_module()
        homes.append(Path(codex_home.desktop_home()[0]))
        built = codex_home.active()
        if built:
            homes.append(Path(built))
    except (ImportError, OSError, ValueError):
        pass
    if os.environ.get('CODEX_HOME'):
        homes.append(Path(os.environ['CODEX_HOME']))
    homes.append(Path.home() / '.codex')
    out = []
    for home in homes:
        if home not in out:
            out.append(home)
    return out


def card_usage(card_id: str, cwd: str, logs: list[str] | None = None) -> dict | None:
    """{minutes, calls, log} for the newest Codex session that ran this card (its cwd is the card's worktree, or its
    prompt names the card), from the session's own timestamps and tool calls; None when no log is found."""
    from datetime import datetime
    from . import codex_route
    if logs is None:
        logs = sorted((log for home in codex_homes() for log in glob.glob(str(home / 'sessions' / '*' / '*' / '*' / '*.jsonl'))),
                      key=os.path.getmtime)
    # Both sides in the form linux_form gives, so a drive path matches however either side wrote it.
    want_cwd = codex_route.linux_form(str(Path(cwd))).replace('\\', '/').rstrip('/').lower() if cwd else None
    for log in reversed(logs[-40:]):
        lines = Path(log).read_text(encoding='utf-8', errors='replace').splitlines()
        events = []
        for line in lines:
            try:
                events.append(json.loads(line))
            except ValueError:
                continue
        meta_cwd = next((str((e.get('payload') or {}).get('cwd') or '') for e in events if e.get('type') == 'session_meta'), '')
        meta_cwd = codex_route.linux_form(meta_cwd)  # Windows Codex logs a WSL worktree by its wsl.localhost path
        mine = (want_cwd and meta_cwd.replace('\\', '/').rstrip('/').lower() == want_cwd) or f'card: {card_id}' in '\n'.join(lines)
        if not mine:
            continue
        stamps = []
        for e in events:
            try:
                stamps.append(datetime.fromisoformat(str(e.get('timestamp')).replace('Z', '+00:00')))
            except ValueError:
                continue
        calls = sum(1 for e in events if (e.get('payload') or {}).get('type') in ('function_call', 'custom_tool_call', 'local_shell_call'))
        minutes = (max(stamps) - min(stamps)).total_seconds() / 60 if len(stamps) > 1 else 0.0
        return {'minutes': round(minutes, 1), 'calls': calls, 'log': log}
    return None


def limit_problems(meta: dict, usage: dict | None) -> list[str]:
    """Why a card's run went past its own limits, or []. A run with no session log found is said, never passed."""
    minutes, calls = card_limits(meta)
    if usage is None:
        return [f'no Codex session log found for card {meta.get("card")}: its minutes and calls cannot be checked against '
                f'max_minutes {minutes} and max_calls {calls}']
    out = []
    if usage['minutes'] > minutes:
        out.append(f'the run took {usage["minutes"]} minutes, past the card\'s max_minutes {minutes}')
    if usage['calls'] > calls:
        out.append(f'the run made {usage["calls"]} tool calls, past the card\'s max_calls {calls}')
    return out


MODULES_STAMP = '.ve-lock-sha256'


def fresh_modules(root: Path = ROOT, run=None) -> bool:
    """The main checkout's node_modules matches its package-lock.json before a card links it, so a card never builds
    against packages the repository no longer names. On 15 Nov 2026 the first card on the restored cloud lane reached
    its acceptance and failed on `import * as T from 'three'` and the @remotion/three JSX types: the lane clone had not
    installed since the 3D styles added them on 11 Nov, and the ve-style cards of that day failed the same way. The
    lockfile's sha256 is kept in node_modules/.ve-lock-sha256; when it differs, `npm ci` runs once here and the stamp is
    written. Returns whether it installed. A checkout with no lockfile is left alone."""
    lock = root / 'package-lock.json'
    if not lock.is_file():
        return False
    want = hashlib.sha256(lock.read_bytes()).hexdigest()
    stamp = root / 'node_modules' / MODULES_STAMP
    try:
        if stamp.read_text(encoding='utf-8').strip() == want:
            return False
    except OSError:
        pass
    run = run or subprocess.run
    npm = 'npm.cmd' if sys.platform == 'win32' else 'npm'
    done = run([npm, 'ci', '--no-audit', '--no-fund'], cwd=root, capture_output=True, text=True, timeout=1800)
    if done.returncode != 0:
        tail = ' '.join(((done.stdout or '') + (done.stderr or '')).strip().splitlines()[-3:])
        sys.exit(f've dispatch: npm ci in {root} failed, so no card builds against stale packages: {tail}')
    stamp.parent.mkdir(parents=True, exist_ok=True)
    stamp.write_text(want + '\n', encoding='utf-8')
    return True


def ensure_worktree(cwd: Path, card_id: str) -> None:
    """A card runs in its own worktree cut from origin/main, with node_modules junctioned from the main checkout.
    A new worktree is made only where the local layout puts it (velib.common.card_worktree: config/studio.json
    local_roots.worktrees, W2.11): a card still naming a typed path is refused and rewritten with ve card. One that
    already exists (a re-queued card) first takes in the current origin/main: on 2026-11-02 three re-queued cards were
    built on their first attempt's stale main and failed on a fix main already had (F22). Either way the main
    checkout's packages are brought up to its lockfile first (fresh_modules)."""
    fresh_modules()
    if cwd.exists():
        refresh_worktree(cwd)
        return
    try:
        expected = native_path(card_worktree(card_id))
    except ValueError as error:
        sys.exit(f've dispatch: {error}')
    if os.path.normcase(os.path.abspath(cwd)) != os.path.normcase(os.path.abspath(expected)):
        sys.exit(f've dispatch: card {card_id} names cwd {cwd}, but config/studio.json local_roots.worktrees puts its '
                 f'worktree at {expected}; write the card again with ve card (it fills cwd from the config)')
    cwd.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git', 'fetch', '-q', 'origin', 'main'], cwd=ROOT, check=True)
    subprocess.run(['git', 'worktree', 'add', '-q', '-b', f've-card/{card_id}', str(cwd), 'origin/main'], cwd=ROOT, check=True)
    modules = ROOT / 'node_modules'
    if modules.exists() and not (cwd / 'node_modules').exists():
        if sys.platform == 'win32':
            subprocess.run(['cmd', '/c', 'mklink', '/J', str(cwd / 'node_modules'), str(modules.resolve())], check=True, capture_output=True)
        else:
            os.symlink(modules.resolve(), cwd / 'node_modules')


FRESH_LEASE = 've-fresh-lease'


def refresh_worktree(cwd: Path) -> None:
    """Bring an existing card worktree up to origin/main by a merge, so its branch still pushes as a fast-forward and
    any earlier attempt's work is kept. A merge that conflicts is aborted and the card starts fresh from origin/main
    (restart_fresh): on 15 Nov 2026 two re-queued cards stopped on his PC, unattended, because main had changed the
    same files since their first attempt. Only a clean ve-card/ worktree restarts; anything else stops, naming it.
    A folder that is not a git checkout is left alone."""
    if not (cwd / '.git').exists():
        return
    subprocess.run(['git', '-C', str(cwd), 'fetch', '-q', 'origin', 'main'], check=True, capture_output=True)
    merged = subprocess.run(['git', '-C', str(cwd), '-c', 'user.name=Codex lane', '-c',
                             'user.email=codex-lane@users.noreply.github.com', 'merge', '-q', '--no-edit', 'origin/main'],
                            capture_output=True, text=True)
    if merged.returncode != 0:
        subprocess.run(['git', '-C', str(cwd), 'merge', '--abort'], capture_output=True)
        why = (merged.stderr or merged.stdout).strip()[-300:]
        if not restart_fresh(cwd):
            sys.exit(f've dispatch: the worktree {cwd} cannot take in origin/main cleanly; remove it so the card starts '
                     f'fresh ({why})')
        print(f've dispatch: {cwd} could not take in origin/main, so the card starts fresh from main; its build replaces '
              f'the earlier attempt on its branch ({why})', file=sys.stderr)


def fresh_lease_path(cwd: Path) -> Path:
    """Where a restarted worktree keeps the branch's remote commit it may replace: inside its own git directory."""
    out = subprocess.run(['git', '-C', str(cwd), 'rev-parse', '--git-path', FRESH_LEASE],
                         capture_output=True, text=True, check=True).stdout.strip()
    path = Path(out)
    return path if path.is_absolute() else cwd / path


def restart_fresh(cwd: Path) -> bool:
    """Start a card's worktree again from origin/main when its earlier attempt cannot take main in. Only a ve-card/
    branch with nothing uncommitted (the lane commits and pushes every attempt) is restarted. The branch's commit on
    origin, or nothing when it was never pushed, is kept as the lease the next push must find there
    (codex_lane.publish_branch), so a build replaces only the attempt it started from. Returns False when it may not."""
    git = ['git', '-C', str(cwd)]
    branch = subprocess.run(git + ['rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True).stdout.strip()
    if not branch.startswith('ve-card/'):
        return False
    status = subprocess.run(git + ['status', '--porcelain', '--untracked-files=all'], capture_output=True, text=True)
    if status.returncode != 0 or any(line[3:].strip().rstrip('/') != 'node_modules'
                                     for line in status.stdout.splitlines() if line.strip()):
        return False
    remote = subprocess.run(git + ['ls-remote', 'origin', f'refs/heads/{branch}'], capture_output=True, text=True)
    if remote.returncode != 0:
        return False
    lease = remote.stdout.split()[0] if remote.stdout.split() else ''
    if subprocess.run(git + ['checkout', '-q', '-B', branch, 'origin/main'], capture_output=True).returncode != 0:
        return False
    fresh_lease_path(cwd).write_text(lease + '\n', encoding='utf-8')
    return True


def _is_link(path: Path) -> bool:
    return path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction())


def unlink_links(folder: Path) -> list[Path]:
    """Remove every symlink or junction inside a card worktree WITHOUT following it, and return what was removed.
    27 Oct 2026: `rm -rf` on a card folder followed its node_modules junction and emptied the main checkout's
    node_modules. A link is removed as a link (os.unlink for a symlink, os.rmdir for a junction), never recursed."""
    removed: list[Path] = []
    for root, dirs, files in os.walk(folder, topdown=True, followlinks=False):
        for name in list(dirs) + files:
            path = Path(root) / name
            if _is_link(path):
                if path.is_symlink() and not (hasattr(path, 'is_junction') and path.is_junction()):
                    path.unlink()
                else:
                    os.rmdir(path)  # removes the junction itself; the target is untouched
                removed.append(path)
                if name in dirs:
                    dirs.remove(name)
    return removed


def remove_worktree(cwd: Path) -> None:
    """The only way ve removes a card worktree: links first (never followed), then git, and refuse if a link survives."""
    if not cwd.exists():
        return
    unlink_links(cwd)
    survivors = [p for p in cwd.rglob('*') if _is_link(p)] if cwd.exists() else []
    if survivors:
        sys.exit(f've: refusing to remove {cwd}: links remain ({survivors[:3]})')
    subprocess.run(['git', 'worktree', 'remove', '--force', str(cwd)], cwd=ROOT, check=True)


DEFAULT_TOOLS = 'shell, apply_patch'


def _hold(card_path: Path, reasons: list[str]) -> None:
    """A card that may not be sent is held: recorded beside it with the reason, and never sent."""
    from datetime import datetime, timezone
    write_json(card_path.with_suffix('.held.json'), {'card': card_path.name, 'held': True, 'reasons': reasons,
                                                     'at': datetime.now(timezone.utc).isoformat(timespec='seconds')})
    sys.exit('ve dispatch: held, not sent: ' + '; '.join(reasons))


def _admit(card_path: Path, meta: dict) -> None:
    """Codex runs only under its one tool profile (config/codex-profile.json, failure production-asked-to-publish):
    the profile must pass its audit and every tool the card names must be one it allows, or the card is held."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'overnight'))
    try:
        import codex_profile
        profile = codex_profile.load()
    except (ImportError, OSError, ValueError) as error:
        _hold(card_path, [f'no Codex tool profile to send it under ({error})'])
    tools = [t.strip() for t in (meta.get('tools') or DEFAULT_TOOLS).strip('[]').split(',') if t.strip()]
    reasons = codex_profile.admit(tools, profile)
    if reasons:
        _hold(card_path, reasons)


def codex_env(visible: bool = False) -> dict:
    """The environment Codex runs cards in. Two routes (Ruling, Krish, 2026-11-15: video production stays rooted in the
    cloud and is never shown in Codex Desktop; only social-media management, started from a Claude session on his own
    computer, runs where he can see it and attach his browser):

    - By default (every video card, the lane's builds and the venture lane): the Studio's own Codex home of 30 Oct when
      it is built (no MCP server, no plugin), else Codex's own default home on this machine, as before 15 Nov. Inside
      WSL a CODEX_HOME on a Windows drive is dropped, so a card never runs under the home his Desktop app reads and
      always takes the native route. A built Studio home that fails its check stops the dispatch.
    - visible=True (ve dispatch --visible, from a session on his computer, for browser legwork he watches): Krish's
      everyday home, the one his Codex Desktop app reads, with the ve-card profile written into it when missing.

    A shared Codex runtime another session started is never reused."""
    codex_home = _codex_home_module()
    env = {k: v for k, v in os.environ.items() if k != 'CODEX_COMPANION_APP_SERVER_ENDPOINT'}
    visible = visible or codex_home.visible_opted_in(env)
    if not visible:
        home = codex_home.active()
        if home:
            problems = codex_home.check(home)
            if problems:
                sys.exit("ve dispatch: the Studio's Codex home fails its check: " + '; '.join(problems))
            env['CODEX_HOME'] = str(home)
        elif codex_home.in_wsl() and str(env.get('CODEX_HOME', '')).replace('\\', '/').lower().startswith('/mnt/'):
            env.pop('CODEX_HOME')
        return env
    home, how = codex_home.desktop_home()
    if not (home / 'auth.json').is_file():
        sys.exit(f've dispatch: {home} (the Codex home his Desktop app reads, found by {how}) has no sign-in: open Codex '
                 f'Desktop and sign in, or set {codex_home.DESKTOP_FLAG} to the home it uses')
    if codex_home.profile_problems(home):
        problems = codex_home.install_profile(home)
        if problems:
            sys.exit('ve dispatch: the ve-card profile could not be written: ' + '; '.join(problems))
        print(f've dispatch: wrote the {codex_home.PROFILE} profile into {home / "config.toml"}', file=sys.stderr)
    env['CODEX_HOME'] = str(home)
    return env


def session_title(meta: dict, card_path: Path, piece: str | None = None) -> str:
    """The first line of the prompt, which is how Krish finds the session in his Codex Desktop app: the card, the piece
    it is for, its kind and its own title, e.g. "ve card fri-hero-plates for 2026-11-20-fri (plates): The ledger"."""
    card = meta.get('card') or card_path.stem
    heading = next((line[2:].strip() for line in card_path.read_text(encoding='utf-8').splitlines()
                    if line.startswith('# ')), '')
    parts = ['ve card', card]
    if piece:
        parts.append(f'for {piece}')
    if meta.get('kind'):
        parts.append(f'({meta["kind"]})')
    return ' '.join(parts) + (f': {heading}' if heading else '')


def titled_prompt(card_path: Path, meta: dict, piece: str | None = None) -> Path:
    """The card with its title line first, written beside the card's worktree cache; the card file is not changed."""
    out = ROOT / '.cache' / 've-dispatch' / f'{meta.get("card") or card_path.stem}.prompt.md'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(session_title(meta, card_path, piece) + '\n\n' + card_path.read_text(encoding='utf-8'), encoding='utf-8')
    return out


def dispatch(card_path: Path, background: bool = True, visible: bool = False, piece: str | None = None) -> subprocess.CompletedProcess:
    """Send a card to Codex. Codex use is not counted or reserved anywhere (Ruling, Krish, 2026-11-17: "We have plenty of
    Codex credits, you need to permanently stop counting codex credits everywhere"). visible: run under the home his
    Codex Desktop app reads, for social-media legwork started from his own computer; a video card never sets it."""
    meta = parse_card(card_path)
    _require_design_lock(meta)
    _admit(card_path, meta)
    cwd = meta.get('cwd') or str(ROOT)
    minutes, _ = card_limits(meta)
    ensure_worktree(Path(cwd), meta.get('card', 'card'))
    env = codex_env(visible)
    name = meta.get('card') or card_path.stem
    options = ['--cwd', cwd, '--sandbox', 'workspace-write', '--model', meta.get('model', MODEL),
               '--effort', meta.get('effort', EFFORT), '--prompt-file', str(titled_prompt(card_path, meta, piece).resolve())]
    if background:
        # The thread runs on in a detached child and releases itself when the turn ends; its log, in .ve-work (Claude may
        # not read .cache), names the thread id first: read it with codex_thread.mjs read.
        # verify-card holds it to max_minutes and max_calls from its session log.
        log = ROOT / '.ve-work' / 'dispatch' / f'{name}.log'
        log.parent.mkdir(parents=True, exist_ok=True)
        options += ['--detach', '--log', str(log)]
    cmd, env, _ = launch(options, env)
    if background:
        return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, env=env)
    try:
        return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, env=env, timeout=minutes * 60)
    except subprocess.TimeoutExpired:
        sys.exit(f've dispatch: card {meta.get("card")} ran past its max_minutes ({minutes}) and was stopped')


def plan(options: list, env: dict, sub: str = 'open') -> tuple[list[str], str, dict]:
    """(argv, route, extra) that start codex_thread.mjs under env's CODEX_HOME; nothing is written or started. Inside
    WSL with a Windows home (/mnt/c/...) it is Windows node and Windows codex.exe with Windows paths, never the Linux
    codex on /mnt/c (scripts/velib/codex_route.py says why); a route that cannot be taken stops in one line with its fix."""
    from . import codex_route
    home = env.get('CODEX_HOME') or str(Path.home() / '.codex')
    try:
        return codex_route.thread_command(codex_thread(), sub, [*options, '--home', home], home)
    except codex_route.RouteError as error:
        sys.exit(str(error))


def launch(options: list, env: dict, sub: str = 'open') -> tuple[list[str], dict, str]:
    """plan, then what the route needs before it starts: on wsl-windows the unchanged copy of codex_thread.mjs on the
    Windows drive. Returns the command, its environment and the route."""
    from . import codex_route
    cmd, chosen, extra = plan(options, env, sub)
    run_env = codex_route.environ_for(chosen, env, extra)
    if extra.get('stage'):
        try:
            codex_route.stage(*extra['stage'])
        except OSError as error:
            sys.exit(f've dispatch: codex_thread.mjs could not be copied beside the Windows Codex home ({error})')
        cwd = options[options.index('--cwd') + 1] if '--cwd' in options else None
        try:
            codex_route.smoke(cmd, run_env, cwd if cwd and Path(cwd).is_dir() else None)
        except codex_route.RouteError as error:
            sys.exit(str(error))
    return cmd, run_env, chosen


def dry_run(card_path: Path, visible: bool = False, piece: str | None = None) -> str:
    """What dispatch would launch for this card, as one line, without reserving, making a worktree or starting Codex."""
    from . import codex_route
    meta = parse_card(card_path)
    options = ['--cwd', meta.get('cwd') or str(ROOT), '--sandbox', 'workspace-write', '--model', meta.get('model', MODEL),
               '--effort', meta.get('effort', EFFORT), '--prompt-file', str(titled_prompt(card_path, meta, piece).resolve())]
    return codex_route.describe(*plan(options, codex_env(visible)))


IMAGE_SUFFIXES = {'.png', '.jpg', '.jpeg', '.webp'}
VIDEO_SUFFIXES = {'.mp4', '.mov', '.webm', '.m4v'}
SCREEN_FRAMES = (0.05, 0.3, 0.55, 0.8, 0.97)   # where in a produced clip the numbers are read


def _video_frames(path: Path, tmp: Path) -> list[tuple[str, Path]]:
    """A few frames of a produced clip: (label, png)."""
    try:
        seconds = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                                       capture_output=True, text=True, check=True).stdout.strip())
    except (OSError, ValueError, subprocess.CalledProcessError):
        return []
    out = []
    for i, at in enumerate(SCREEN_FRAMES):
        png = tmp / f'{path.stem}-{i}.png'
        done = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{seconds * at:.3f}', '-i', str(path), '-frames:v', '1', str(png)],
                              capture_output=True)
        if done.returncode == 0 and png.is_file():
            out.append((f'{path.name} at {seconds * at:.1f} s', png))
    return out


def read_screens(files: list[Path], read=None, frames_of=None) -> tuple[list[tuple[str, str]], str | None]:
    """The words OCR reads off each produced screen or still: ([(where, text)], None), or ([], why) when OCR is not on this
    machine. Never a silent pass: the caller says not_run."""
    import tempfile  # noqa: PLC0415
    if read is None:
        sys.path.insert(0, str(ROOT / 'scripts'))
        import channel_safe  # noqa: PLC0415
        read = channel_safe.tesseract_words
    frames_of = frames_of or _video_frames
    found: list[tuple[str, str]] = []
    with tempfile.TemporaryDirectory() as tmp:
        for file in files:
            targets = [(file.name, file)] if file.suffix.lower() in IMAGE_SUFFIXES else frames_of(file, Path(tmp))
            for where, png in targets:
                try:
                    words = read(png)
                except OSError as error:
                    return [], str(error)
                found.append((where, ' '.join(w for w, conf, _ in words if conf >= 40)))
    return found, None


def screen_numbers(meta: dict, cwd: Path, changed: list[str], notes: list[str] | None, read=None, frames_of=None) -> list[str]:
    """verify-card's numbers check: when the card's spec says no invented numbers, every screen or still Codex produced is read
    for figures the piece does not own (numbers.invented). OCR absent: a not_run note, never a pass."""
    if not meta.get('spec'):
        return []
    spec_file = ROOT / meta['spec'] if not Path(meta['spec']).is_absolute() else Path(meta['spec'])
    spec = load_json(spec_file)
    if not ideaguard.forbids_invented_numbers(spec):
        return []
    made = []
    for line in changed:
        rel = line[3:].strip().strip('"').replace('\\', '/')
        file = Path(cwd) / rel
        if file.is_file() and file.suffix.lower() in IMAGE_SUFFIXES | VIDEO_SUFFIXES:
            made.append(file)
    if not made:
        return []
    texts, why = read_screens(made, read, frames_of)
    if why:
        if notes is not None:
            notes.append(f'not_run: the numbers on {len(made)} produced screen(s) were NOT read ({why}); look at each one for a figure the spec does not own')
        return []
    supplied = [x.strip() for x in str(meta.get('numbers_supplied') or '').split(',') if x.strip()]
    return ideaguard.screen_problems(texts, spec, spec_file.parent, supplied)


def verify(card_path: Path, cwd: Path, notes: list[str] | None = None, read=None, frames_of=None) -> list[str]:
    """Re-run the card's acceptance outside the sandbox and check the diff stayed inside write_allow."""
    meta = parse_card(card_path)
    allowed = [p.strip().strip('\'"') for p in meta.get('write_allow', '').strip('[]').split(',') if p.strip()]
    problems: list[str] = []
    changed = subprocess.run(['git', 'status', '--porcelain', '--untracked-files=all'], capture_output=True, text=True, cwd=cwd).stdout.splitlines()
    for line in changed:
        path = line[3:].strip().strip('"').replace('\\', '/')
        if path.rstrip('/') == 'node_modules':
            continue  # the link ensure_worktree makes to the main checkout's packages, never Codex's work
        if not any(fnmatch.fnmatch(path, pattern) for pattern in allowed):
            problems.append(f'outside write_allow: {path}')
    for cmd in meta['acceptance']:
        shell_cmd = cmd if sys.platform != 'win32' else cmd
        result = subprocess.run(shell_cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        if result.returncode != 0:
            tail = (result.stdout + result.stderr).strip().splitlines()[-6:]
            problems.append(f'acceptance failed ({result.returncode}): {cmd}\n    ' + '\n    '.join(tail))
    problems += screen_numbers(meta, cwd, changed, notes, read, frames_of)
    problems += limit_problems(meta, card_usage(meta.get('card', ''), meta.get('cwd') or str(cwd)))
    return problems
