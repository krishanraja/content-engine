#!/usr/bin/env python3
"""Where ve dispatch runs Codex. Two routes (Ruling, Krish, 2026-11-15, later the same day: video production stays
rooted in the cloud and is never shown in Codex Desktop; only social-media management, started from a Claude session on
his own computer, runs where he can see it). Every video card and the lane's builds run under the Studio's own home below
when it is built, else Codex's own default home (velib.cards.codex_env); `ve dispatch --visible` runs under Krish's
everyday Codex home, the one his Codex Desktop app reads, found here, so he can attach his browser.

The earlier ruling the --visible route came from:

Ruling (Krish, 2026-11-15): every Codex session Claude starts runs where Krish can see it in his Codex Desktop app, so
he can attach his browser; this replaces the separate Studio Codex home of 30 Oct as the default. His words: "I want
Claude to spin up codex sessions I can actually see."

  desktop_home()   the home his Desktop app reads: VE_CODEX_DESKTOP_HOME when set (the override for a machine the rules
                   below get wrong), else CODEX_HOME when it names a folder other than the Studio home, else, inside
                   WSL, the Windows side's home (its %CODEX_HOME%, else %USERPROFILE%\\.codex, read through WSL's
                   Windows interop, else the one C:\\Users\\<name>\\.codex holding a sign-in), else ~/.codex. Cards build
                   in WSL, and a WSL ~/.codex is a folder the Windows Desktop app never reads.
  the ve-card profile   the per-run settings the Studio home used to carry (approval never, workspace-write sandbox,
                   no network, the connector and plugin features off; the browser stays
                   on so he can attach his), written as one marked [profiles.ve-card] block at the end of
                   his config.toml (install-profile; nothing else in the file is touched, and a profile does nothing
                   until a run names it). Dispatch passes --profile ve-card when the installed Codex plugin companion
                   takes it. A profile cannot drop the MCP servers his own config names, so a card's Codex can reach
                   them: the tool profile (config/codex-profile.json) still holds any card that names a forbidden tool,
                   and verify-card still refuses work outside write_allow.

The Studio's own home below is the video default again (it was an opt-in from 15 Nov until the ruling above): a run
with no MCP server and no plugin at all, which his Desktop app never shows.

The Studio home, as built since 30 Oct:

Krish, 30 Oct, on the Buffer and Teleprompter servers the preflight flagged on LORIMER: "no, we need those", then "do
the separate settings folder fix". Codex reads its settings from CODEX_HOME (default ~/.codex), so this folder is a
second home beside the Studio runtime (Documents\\MindmakeVideoStudio\\runtime\\codex-home):

  config.toml  written from config/codex-profile.json's codex_config alone, with the features that bring tools the
               profile does not allow turned off (FEATURES_OFF): no MCP server, no plugin, no app or connector, no
               browser or computer use, no notify hook. Nothing from ~/.codex/config.toml is copied, so a server or
               plugin added there never reaches it. On LORIMER (30 Oct) ~/.codex had 38 enabled plugins, GitHub,
               Supabase, Stripe, Vercel and Gmail among them, and the ChatGPT account's own connectors (Gmail, Google
               Drive) show in any home until apps and remote_plugin are off.
  auth.json    a hard link to ~/.codex/auth.json: one sign-in, and a token refresh by either Codex is seen by both. A
               copy would not do: a refresh in one home spends the refresh token the other still holds.
  sessions     a junction (a symlink off Windows) to ~/.codex/sessions, so the allowance reading and card usage
               (scripts/velib/cards.py, scripts/session_token_audit.py) see every run, whichever home made it.

  build   make or remake the folder (config.toml rewritten, links made or repaired). Never touches ~/.codex.
  check   the folder is still that: prints {ok, home, problems}; exit 1 on a problem. ve dispatch refuses to start
          Codex under a home that fails it, and the preflight's codex_profile check runs it.
  where   prints the folder's path.

    python scripts/overnight/codex_home.py build|check|where [--home DIR] [--main DIR]
    python scripts/overnight/codex_home.py desktop|install-profile [--main DIR]

  desktop          prints {home, how, profile_installed}: the home visible runs use and how it was found.
  install-profile  writes or rewrites the marked ve-card block in that home's config.toml (a copy of the file as it
                   was is kept beside it as config.toml.before-ve-card the first time).

A Codex session started inside a cloud container (claude.ai/code, Codex cloud) can never appear in his Desktop app:
its home is on a machine that is not his. Visible sessions are started from a Claude session on his own computer.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import codex_profile

HOME = Path.home() / 'Documents' / 'MindmakeVideoStudio' / 'runtime' / 'codex-home'
PROFILE = 've-card'
BEGIN = f'# >>> content-engine {PROFILE} profile: written by scripts/overnight/codex_home.py install-profile; never edit >>>'
END = f'# <<< content-engine {PROFILE} profile <<<'
STUDIO_FLAG = 'VE_CODEX_STUDIO_HOME'
VISIBLE_FLAG = 'VE_CODEX_VISIBLE'
DESKTOP_FLAG = 'VE_CODEX_DESKTOP_HOME'


def in_wsl(env=None, proc: Path = Path('/proc/version')) -> bool:
    env = os.environ if env is None else env
    if env.get('WSL_DISTRO_NAME') or env.get('WSL_INTEROP'):
        return True
    try:
        return 'microsoft' in proc.read_text(encoding='utf-8', errors='replace').lower()
    except OSError:
        return False


def windows_value(name: str) -> str | None:
    """A Windows environment variable read from inside WSL through cmd.exe interop; None when unset or unreachable."""
    try:
        out = subprocess.run(['cmd.exe', '/d', '/c', f'echo %{name}%'], capture_output=True, text=True, timeout=15,
                             cwd='/mnt/c' if Path('/mnt/c').is_dir() else None).stdout.strip()
        if not out or out == f'%{name}%':
            return None
        unix = subprocess.run(['wslpath', '-u', out], capture_output=True, text=True, timeout=15).stdout.strip()
        return unix or None
    except (OSError, subprocess.SubprocessError):
        return None


def _windows_homes(users: Path = Path('/mnt/c/Users')) -> list[Path]:
    try:
        return sorted(p / '.codex' for p in users.iterdir() if (p / '.codex' / 'auth.json').is_file())
    except OSError:
        return []


def desktop_home(env=None, wsl: bool | None = None, windows=windows_value,
                 users: Path = Path('/mnt/c/Users')) -> tuple[Path, str]:
    """(the Codex home Krish's Desktop app reads, how it was found). See the module's head for the order."""
    env = os.environ if env is None else env
    if env.get(DESKTOP_FLAG):
        return Path(env[DESKTOP_FLAG]).expanduser(), DESKTOP_FLAG
    if env.get('CODEX_HOME') and Path(env['CODEX_HOME']).expanduser() != HOME:
        return Path(env['CODEX_HOME']).expanduser(), 'CODEX_HOME'
    if in_wsl(env) if wsl is None else wsl:
        named = windows('CODEX_HOME')
        if named:
            return Path(named), 'Windows %CODEX_HOME%'
        profile = windows('USERPROFILE')
        if profile:
            return Path(profile) / '.codex', 'Windows %USERPROFILE%'
        found = _windows_homes(users)
        if len(found) == 1:
            return found[0], 'the one signed-in Windows home under /mnt/c/Users'
    return Path.home() / '.codex', '~/.codex'


def visible_opted_in(env=None) -> bool:
    """Whether a card takes the visible route: VE_CODEX_VISIBLE set (ve dispatch --visible sets it), for social-media
    legwork a session on his own computer starts. Ruling (Krish, 2026-11-15): video production stays rooted in the cloud
    and is never shown in Codex Desktop; only social-media management runs where he can see it."""
    env = os.environ if env is None else env
    return str(env.get(VISIBLE_FLAG, '')).strip().lower() in ('1', 'true', 'yes')


def studio_opted_in(env=None) -> bool:
    """Whether a card takes the video route (the Studio home when built, the layout's own worktrees): always, unless
    the visible route is asked for (visible_opted_in). VE_CODEX_STUDIO_HOME=1 still says so explicitly."""
    env = os.environ if env is None else env
    if str(env.get(STUDIO_FLAG, '')).strip().lower() in ('1', 'true', 'yes'):
        return True
    return not visible_opted_in(env)


# Krish's everyday Codex home, the one his Desktop app reads (resolved when a command runs, never at import).
MAIN = None
# What the config may carry: the profile's own settings. A table or key outside these is a problem.
TABLES = ('mcp_servers', 'plugins', 'marketplaces')
# Codex features that bring tools outside the profile's allowed_tools (codex features list names them).
FEATURES_OFF = ('apps', 'plugins', 'remote_plugin', 'browser_use', 'browser_use_external', 'computer_use')
# The visible ve-card profile leaves the browser and computer use features on: Krish attaches his signed-in browser to
# a visible session for the browser legwork (Ruling, Krish, 2026-11-15), and a profile that switched them off would
# stop him. The connectors and plugins stay off.
VISIBLE_FEATURES_OFF = ('apps', 'plugins', 'remote_plugin')


def config_text(profile: dict) -> str:
    """config.toml from the profile's codex_config: top-level keys, then dotted keys as their tables."""
    top, tables = [], {}
    for key, value in profile.get('codex_config', {}).items():
        table, _, name = key.rpartition('.')
        line = f'{name} = {json.dumps(value)}'
        (tables.setdefault(table, []) if table else top).append(line)
    tables['features'] = [f'{name} = false' for name in FEATURES_OFF]
    head = ['# Written by scripts/overnight/codex_home.py from config/codex-profile.json. Rebuild it; never edit it.']
    body = top + [line for table, lines in tables.items() for line in ['', f'[{table}]'] + lines]
    return '\n'.join(head + body) + '\n'


def _same(a: Path, b: Path) -> bool:
    try:
        return os.path.samefile(a, b)
    except OSError:
        return False


def _link_dir(link: Path, target: Path) -> None:
    if sys.platform == 'win32':
        # A junction needs no administrator, which a symlink on Windows does.
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(target)], check=True, capture_output=True)
    else:
        link.symlink_to(target, target_is_directory=True)


def build(home: Path = HOME, main: Path | None = MAIN, profile: dict | None = None) -> list[str]:
    main = main or desktop_home()[0]
    profile = profile or codex_profile.load()
    if codex_profile.audit(profile):
        return ['config/codex-profile.json fails its audit, so no home is built from it']
    if _same(home, main) or home.resolve() == main.resolve():
        return [f"{home} is Codex's everyday home; the Studio's home must be a folder of its own"]
    auth, sessions = main / 'auth.json', main / 'sessions'
    if not auth.is_file():
        return [f'{auth} is missing: sign in to Codex first (codex login)']
    home.mkdir(parents=True, exist_ok=True)
    (home / 'config.toml').write_text(config_text(profile), encoding='utf-8')
    link = home / 'auth.json'
    if not _same(link, auth):
        if link.exists() or link.is_symlink():
            link.unlink()
        os.link(auth, link)
    sessions.mkdir(parents=True, exist_ok=True)
    mine = home / 'sessions'
    if not _same(mine, sessions):
        if mine.is_dir() and not mine.is_symlink() and any(mine.iterdir()):
            return [f'{mine} holds session logs of its own; move them into {sessions}, then build again']
        if mine.exists() or mine.is_symlink():
            mine.rmdir() if mine.is_dir() else mine.unlink()
        _link_dir(mine, sessions)
    return check(home, main, profile)


def check(home: Path = HOME, main: Path | None = MAIN, profile: dict | None = None) -> list[str]:
    main = main or desktop_home()[0]
    profile = profile or codex_profile.load()
    config = home / 'config.toml'
    if not config.is_file():
        return [f'{config} is missing: run codex_home.py build']
    problems = []
    if config.read_text(encoding='utf-8') != config_text(profile):
        problems.append('config.toml is not what config/codex-profile.json writes: run codex_home.py build')
    for line in config.read_text(encoding='utf-8').splitlines():
        name = line.strip().strip('[]').split('.')[0]
        if line.startswith('[') and name in TABLES:
            problems.append(f'config.toml has a [{line.strip("[]")}] table')
    if not _same(home / 'auth.json', main / 'auth.json'):
        problems.append('auth.json is not the same file as ~/.codex/auth.json (a copy goes stale on the first token '
                        'refresh): run codex_home.py build')
    if not _same(home / 'sessions', main / 'sessions'):
        problems.append('sessions is not ~/.codex/sessions, so the allowance and card usage would miss its runs: '
                        'run codex_home.py build')
    return problems


def active(home: Path = HOME) -> Path | None:
    """The Studio home when it is built, else None. Every video card runs under it when it is built (velib.cards.codex_env)."""
    return home if (home / 'config.toml').is_file() else None


def profile_block(profile: dict | None = None) -> str:
    """The marked [profiles.ve-card] block: the profile's codex_config and the tool features off, under the profile."""
    profile = profile or codex_profile.load()
    top, tables = [], {}
    for key, value in profile.get('codex_config', {}).items():
        table, _, name = key.rpartition('.')
        line = f'{name} = {json.dumps(value)}'
        (tables.setdefault(table, []) if table else top).append(line)
    tables['features'] = [f'{name} = false' for name in VISIBLE_FEATURES_OFF]
    body = [f'[profiles.{PROFILE}]'] + top
    for table, lines in tables.items():
        body += ['', f'[profiles.{PROFILE}.{table}]'] + lines
    return '\n'.join([BEGIN] + body + [END]) + '\n'


def _split(text: str) -> tuple[str, str | None]:
    """(the config without our block, the block as it stands or None)."""
    if BEGIN not in text:
        return text, None
    before, _, rest = text.partition(BEGIN)
    block, _, after = rest.partition(END)
    return before.rstrip('\n') + ('\n' if before.strip() else '') + after.lstrip('\n'), BEGIN + block + END + '\n'


def profile_problems(main: Path | None = None, profile: dict | None = None) -> list[str]:
    main = main or desktop_home()[0]
    config = main / 'config.toml'
    text = config.read_text(encoding='utf-8') if config.is_file() else ''
    rest, block = _split(text)
    problems = []
    if f'[profiles.{PROFILE}]' in rest:
        problems.append(f'{config} has a [profiles.{PROFILE}] table of its own outside the marked block; remove it')
    if block is None:
        problems.append(f'{config} has no {PROFILE} profile: run python scripts/overnight/codex_home.py install-profile')
    elif block != profile_block(profile):
        problems.append(f'the {PROFILE} profile in {config} is not what config/codex-profile.json writes: run install-profile')
    return problems


def install_profile(main: Path | None = None, profile: dict | None = None) -> list[str]:
    """Write the marked block at the end of the home's config.toml; everything else in the file stays as it was."""
    profile = profile or codex_profile.load()
    if codex_profile.audit(profile):
        return ['config/codex-profile.json fails its audit, so no profile is written from it']
    main = main or desktop_home()[0]
    config = main / 'config.toml'
    text = config.read_text(encoding='utf-8') if config.is_file() else ''
    rest, _ = _split(text)
    if f'[profiles.{PROFILE}]' in rest:
        return [f'{config} has a [profiles.{PROFILE}] table of its own outside the marked block; remove it first']
    main.mkdir(parents=True, exist_ok=True)
    backup = main / 'config.toml.before-ve-card'
    if text and not backup.exists():
        backup.write_text(text, encoding='utf-8')
    config.write_text((rest.rstrip('\n') + '\n\n' if rest.strip() else '') + profile_block(profile), encoding='utf-8')
    return profile_problems(main, profile)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('command', choices=['build', 'check', 'where', 'desktop', 'install-profile'])
    ap.add_argument('--home', type=Path, default=HOME)
    ap.add_argument('--main', type=Path, default=None, help='default: the home his Codex Desktop app reads')
    a = ap.parse_args(argv)
    if a.command == 'where':
        print(a.home)
        return 0
    if a.command in ('desktop', 'install-profile'):
        main, how = (a.main, '--main') if a.main else desktop_home()
        problems = install_profile(main) if a.command == 'install-profile' else profile_problems(main)
        print(json.dumps({'ok': not problems, 'home': str(main), 'how': how, 'profile': PROFILE, 'problems': problems}))
        return 1 if problems else 0
    problems = build(a.home, a.main) if a.command == 'build' else check(a.home, a.main)
    print(json.dumps({'ok': not problems, 'home': str(a.home), 'problems': problems}))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
