"""ve card, dispatch and verify-card: exact Codex task cards, sent through scripts/codex_thread.mjs (never the Codex
plugin's long-running broker, never the codex-rescue subagent), checked by Claude outside the sandbox. Codex's own report
is never evidence. Ruling (Krish, 2026-11-15): Claude starts Codex only through scripts/codex_thread.mjs."""
from __future__ import annotations

import fnmatch
import glob
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from .common import ROOT, card_worktree, load_json, native_path, write_json

MODEL = 'gpt-6.1-sol'   # measured cheapest per allowance point (27.0M tokens per 1%); pin, never inherit astra/high
EFFORT = 'medium'
ALLOWANCE_CEILING = 80  # percent of the weekly Codex window; dispatch refuses above this

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


# The one route for a carousel, a meme or a Notes image (Ruling, Krish, 2026-11-13: "all the carousels should now be
# done in Claude, but using the Codex plug in as per the other usual workflows"; then "memes and Notes images should go
# the same way"; docs/CAROUSEL-STANDARD.md, "How a carousel is made"). The Claude session writes the words, the story
# and the direction first, then one card of one of these kinds; Codex builds the pictures in code through the plugin
# (ve dispatch here, or the Codex lane for a venture's own card) and the session verifies them. ve card holds the card
# to the brand palette for its day and to the inspiration cards Krish ticked (F26), and a carousel's to its deck, which
# must pass scripts/carousel_check.py before anything is drawn. The deck's words never go into the card: a venture's
# card sits in a public repository, so the card carries only the deck's shape.
VISUAL_KINDS = ('carousel', 'meme', 'notes_image')


def visual_sections(fields: dict) -> str:
    """The card's own Brand, References and (for a carousel) Deck sections; refuses what the route forbids."""
    import datetime
    kind = fields['kind']
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
    palette_kind = fields.pop('palette_kind', None) or 'off'
    fmt = 'saturday_good_news' if kind == 'carousel' and fields.pop('good_news', False) else kind
    sys.path.insert(0, str(ROOT / 'scripts'))
    import brand_palette
    brand = brand_palette.expect(when, fmt, palette_kind)
    if brand is None:
        sys.exit(f've card: config/brand-palette.json has no {fmt} ({palette_kind}) for {when}')
    out = (f'\n## Brand ({fmt}, {palette_kind}, {when}; config/brand-palette.json, Ruling, Krish, 2026-11-12)\n'
           f'{json.dumps(brand, sort_keys=True)}\n'
           'Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.\n'
           '\n## References (the inspiration cards Krish ticked; build to them, never copy them)\n'
           + ''.join(f'- {r}\n' for r in refs))
    deck_path = fields.pop('deck', None)
    if kind == 'carousel':
        if not deck_path:
            sys.exit('ve card: a carousel card names its deck ("deck": a carousel-deck/1 file); the words come first')
        import carousel_check
        deck = load_json(ROOT / deck_path if not Path(deck_path).is_absolute() else Path(deck_path))
        problems = carousel_check.problems(deck)
        if problems:
            sys.exit('ve card: the deck does not pass scripts/carousel_check.py, so nothing is drawn yet:\n  '
                     + '\n  '.join(problems))
        cards = deck.get('cards') or []
        roles = {n: step for step, at in (deck.get('arc') or {}).items()
                 for n in (at if isinstance(at, list) else [at]) if isinstance(n, int)}
        out += (f'\n## Deck ({len(cards)} cards; the words are fixed and passed scripts/carousel_check.py)\n'
                + ''.join(f'- card {n}: {"cover" if n == 1 else "last card" if n == len(cards) else roles.get(n, "body")}'
                          f', one picture of its point\n' for n in range(1, len(cards) + 1))
                + 'Template every card with placeholders; the session fills in the deck\'s words when it renders.\n')
    return out


def write_card(path: Path, **fields) -> Path:
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
    if fields.get('spend_id'):
        # A venture's card carries its Control Center booking (reserve_credit_spend, pool codex) for the Codex lane.
        text = text.replace('\nkind:', f'\nspend_id: {fields["spend_id"]}\nkind:', 1)
    if visual:
        text = text.replace('\n## Acceptance', visual + '\n## Acceptance', 1)
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


def allowance() -> dict | None:
    """The latest Codex rate_limits record: weekly used_percent (0 once its window has reset), resets_at, credits."""
    import time
    logs = sorted({log for home in codex_homes() for log in glob.glob(str(home / 'sessions' / '*' / '*' / '*' / '*.jsonl'))},
                  key=os.path.getmtime)
    for log in reversed(logs[-5:]):
        lines = Path(log).read_text(encoding='utf-8', errors='replace').splitlines()
        for line in reversed(lines):
            if '"rate_limits"' not in line:
                continue
            try:
                payload = json.loads(line).get('payload', {})
                limits = payload.get('rate_limits') or {}
                primary = limits.get('primary') or {}
                if 'used_percent' not in primary:
                    continue
                resets = primary.get('resets_at')
                used = 0.0 if resets and time.time() > resets else float(primary['used_percent'])
                credits = (limits.get('credits') or {}).get('balance')
                return {'used_percent': used, 'resets_at': resets, 'credits': float(credits) if credits else None}
            except (ValueError, AttributeError, TypeError):
                continue
    return None


def weekly_used_percent() -> float | None:
    info = allowance()
    return info['used_percent'] if info else None


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
    """Every folder a card's Codex session can log to: the home Krish's Codex Desktop app reads (where dispatch runs
    cards by default since 15 Nov), the Studio's own Codex home when it is built (the --studio-home opt-in),
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


def ensure_worktree(cwd: Path, card_id: str) -> None:
    """A card runs in its own worktree cut from origin/main, with node_modules junctioned from the main checkout.
    A new worktree is made only where the local layout puts it (velib.common.card_worktree: config/studio.json
    local_roots.worktrees, W2.11): a card still naming a typed path is refused and rewritten with ve card. One that
    already exists (a re-queued card) first takes in the current origin/main: on 2026-11-02 three re-queued cards were
    built on their first attempt's stale main and failed on a fix main already had (F22)."""
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


def refresh_worktree(cwd: Path) -> None:
    """Bring an existing card worktree up to origin/main by a merge, so its branch still pushes as a fast-forward and
    any earlier attempt's work is kept. A merge that conflicts is aborted and the dispatch stops, naming the worktree.
    A folder that is not a git checkout is left alone."""
    if not (cwd / '.git').exists():
        return
    subprocess.run(['git', '-C', str(cwd), 'fetch', '-q', 'origin', 'main'], check=True, capture_output=True)
    merged = subprocess.run(['git', '-C', str(cwd), '-c', 'user.name=Codex lane', '-c',
                             'user.email=codex-lane@users.noreply.github.com', 'merge', '-q', '--no-edit', 'origin/main'],
                            capture_output=True, text=True)
    if merged.returncode != 0:
        subprocess.run(['git', '-C', str(cwd), 'merge', '--abort'], capture_output=True)
        sys.exit(f've dispatch: the worktree {cwd} cannot take in origin/main cleanly; remove it so the card starts '
                 f'fresh ({(merged.stderr or merged.stdout).strip()[-300:]})')


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
DEFAULT_ALLOWANCE_RESERVE = 1.0   # percent points of the weekly Codex window a card reserves unless it says (allowance_points:)
DEFAULT_PAID_RESERVE = 40.0       # Codex credits a card reserves past the ceiling unless it says (paid_credits:)


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


def exhausted(info: dict | None) -> str | None:
    """Why Codex's own readable allowance says no card can run, or None: the weekly window is used up and the paid
    credit balance it reports is nothing. Unread is never exhausted."""
    if not info or info.get('used_percent') is None or info['used_percent'] < 100:
        return None
    if info.get('credits') is None or info['credits'] > 0:
        return None
    return (f'Codex reports its weekly allowance used ({info["used_percent"]:.0f}%) and no paid credits left'
            + (f'; it resets {info["resets_at"]}' if info.get('resets_at') else ''))


def _reserve(card_path: Path, meta: dict) -> str:
    """Reserve the card's credits against Control Center's credit read, before anything is sent; refuse over it.
    Past the weekly allowance ceiling Codex draws paid credits, which reserve against their own cap.

    A machine with no Control Center connector (a local Claude Code install) has no credit read: the card is then
    reserved provisionally in the local ledger, with one warning line, and goes ahead (reconciled later by a session
    with the connector). The real limits still hold: a read that stands refuses over its cap, and Codex's own
    allowance read as exhausted refuses the card."""
    from . import ledger
    why = exhausted(allowance())
    if why:
        sys.exit(f've dispatch: not sent: {why}')
    used = weekly_used_percent()
    card = meta.get('card', card_path.stem)
    if used is not None and used > ALLOWANCE_CEILING:
        return ledger.reserve('codex_paid_credits', float(meta.get('paid_credits') or DEFAULT_PAID_RESERVE),
                              note=f'card {card}: allowance at {used:.0f}%', provisional_ok=True)
    return ledger.reserve('codex_allowance_points', float(meta.get('allowance_points') or DEFAULT_ALLOWANCE_RESERVE),
                          note=f'card {card}', provisional_ok=True)


def codex_env(studio: bool = False) -> dict:
    """The environment Codex runs cards in. By default CODEX_HOME is Krish's everyday home, the one his Codex Desktop
    app reads, so the session shows there and he can attach his browser to it (Ruling, Krish, 2026-11-15: every Codex
    session Claude starts runs where Krish can see it in his Codex Desktop app). The run's own settings come from the
    ve-card profile in that home (codex_home.py install-profile, written here when it is missing). With studio=True
    (ve dispatch --studio-home, or VE_CODEX_STUDIO_HOME=1) it is the Studio's own home of 30 Oct instead: no MCP
    server, no plugin, and never shown in his Desktop app. A shared Codex runtime another session started is never
    reused."""
    codex_home = _codex_home_module()
    env = {k: v for k, v in os.environ.items() if k != 'CODEX_COMPANION_APP_SERVER_ENDPOINT'}
    if studio or codex_home.studio_opted_in():
        home = codex_home.active()
        if not home:
            sys.exit("ve dispatch: --studio-home asks for the Studio's Codex home, which is not built "
                     '(python scripts/overnight/codex_home.py build)')
        problems = codex_home.check(home)
        if problems:
            sys.exit("ve dispatch: the Studio's Codex home fails its check: " + '; '.join(problems))
        env['CODEX_HOME'] = str(home)
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


def dispatch(card_path: Path, background: bool = True, booked: str | None = None,
             studio: bool = False, piece: str | None = None) -> subprocess.CompletedProcess:
    """booked: the id of a Control Center reservation (reserve_credit_spend) the queuing session already made for this
    card. Control Center is then the guard that refused anything over the share, so the local cap file is not read;
    the session settles the booking with settle_credit_spend once it has the result. studio: run under the Studio's
    own Codex home (not visible in Codex Desktop) instead of Krish's everyday one."""
    meta = parse_card(card_path)
    _require_design_lock(meta)
    _admit(card_path, meta)
    if not booked:
        _reserve(card_path, meta)
    cwd = meta.get('cwd') or str(ROOT)
    minutes, _ = card_limits(meta)
    ensure_worktree(Path(cwd), meta.get('card', 'card'))
    env = codex_env(studio)
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


def dry_run(card_path: Path, studio: bool = False, piece: str | None = None) -> str:
    """What dispatch would launch for this card, as one line, without reserving, making a worktree or starting Codex."""
    from . import codex_route
    meta = parse_card(card_path)
    options = ['--cwd', meta.get('cwd') or str(ROOT), '--sandbox', 'workspace-write', '--model', meta.get('model', MODEL),
               '--effort', meta.get('effort', EFFORT), '--prompt-file', str(titled_prompt(card_path, meta, piece).resolve())]
    return codex_route.describe(*plan(options, codex_env(studio)))


def verify(card_path: Path, cwd: Path) -> list[str]:
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
    problems += limit_problems(meta, card_usage(meta.get('card', ''), meta.get('cwd') or str(cwd)))
    return problems
